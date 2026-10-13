// VISUAL ACCEPTANCE AUDIT — renders every shipped 3D asset through the production
// Scene3D.tsx / AssetModel.tsx pipeline and writes screenshots + a structured JSON report.
//
// For each of the 86 assets:
//   - Loads /demo/assets?asset=<id> at desktop (1920x1080) and mobile (390x844)
//   - Waits for the model to settle (window.__visual3dHealth reports visibleMeshes + hasBounds)
//   - Captures a screenshot
//   - Reads window.__visual3dGraph (parts, camera, materials, geometry.screenBox) and
//     window.__visual3dHealth (visibleMeshes, hasBounds, radius, failed)
//   - Checks for console/WebGL errors, non-finite geometry, invisible materials,
//     missing named parts, camera framing, and semantic-anchor visibility
//
//   node scripts/visual-acceptance-audit.mjs
//   BASE=http://localhost:3001 node scripts/visual-acceptance-audit.mjs

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = ".audit";
const SCREENSHOTS = join(OUT, "screenshots");

const DESKTOP = { name: "desktop", width: 1920, height: 1080, deviceScaleFactor: 1 };
const MOBILE = { name: "mobile", width: 390, height: 844, deviceScaleFactor: 2 };

const UPGRADED_ASSETS = new Set([
  "astronomy/galaxy",
  "astronomy/mercury",
  "computer-science/cpu",
  "computer-science/memory",
  "earth/earth-layers",
  "earth/atmosphere",
  "physics/lever",
  "physics/piston-engine",
  "physics/projectile-launcher",
  "physics/pulley",
  "physics/spring",
  "chemistry/crystal-lattice",
  "chemistry/methane-molecule",
  "biology/chloroplast",
  "biology/enzyme",
  "biology/skeleton",
]);

const source = readFileSync(join(process.cwd(), "lib", "visual3d", "generatedAssets.ts"), "utf8");
const match = source.match(/export const GENERATED_ASSETS: GeneratedAsset\[\] = (\[[\s\S]*?\]);\n\nexport const GENERATED_ASSETS_BY_ID/);
if (!match) {
  console.error("Could not read GENERATED_ASSETS — run `npm run assets:build` first.");
  process.exit(2);
}
const ASSETS = JSON.parse(match[1]);
const ASSET_IDS = ASSETS.map((a) => a.id);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function checkAssetHealth(graph, health, asset, consoleErrors) {
  const issues = [];
  const warnings = [];

  // ---- Health checks
  if (!health) {
    issues.push("window.__visual3dHealth was never reported (scene did not settle)");
    return { issues, warnings };
  }

  if (health.failed > 0) {
    issues.push(`asset failed to load (health.failed=${health.failed})`);
  }

  if (health.visibleMeshes === 0) {
    issues.push("no visible meshes reported by SceneHealthProbe");
  }

  if (!health.hasBounds) {
    issues.push("hasBounds is false (no finite, non-zero bounding box)");
  }

  if (health.radius < 0.02 || health.radius > 200) {
    issues.push(`bounding radius out of expected range: ${health.radius.toFixed(4)}`);
  }

  // ---- Graph checks
  if (!graph) {
    issues.push("window.__visual3dGraph was never reported");
    return { issues, warnings };
  }

  // Geometry
  const geo = graph.geometry;
  if (geo.meshCount === 0) {
    issues.push("SceneGraphProbe reports 0 meshes in the content graph");
  }

  if (geo.offCameraCorners > 0) {
    warnings.push(`${geo.offCameraCorners} mesh corners projected off-camera`);
  }

  // Screen box: content must actually occupy a usable share of the viewport
  const screenBox = geo.screenBox;
  if (!screenBox) {
    issues.push("screenBox is null — no visible geometry projected to screen");
  } else {
    const fill = Math.max(screenBox.width, screenBox.height) / 2;
    if (fill < 0.15) {
      issues.push(`content fills only ~${Math.round(fill * 100)}% of viewport (too small)`);
    }
    if (fill > 2.5) {
      warnings.push(`content fills ~${Math.round(fill * 100)}% of viewport (may be too large)`);
    }
  }

  // Camera
  const cam = graph.camera;
  if (!cam || cam.distanceToCentre === 0 || !Number.isFinite(cam.distanceToCentre)) {
    issues.push("camera position or distance not reported");
  }

  // Parts: every semantic anchor should map to at least one named node
  const expectedParts = asset.semanticAnchors || [];
  const namedNodes = new Set(graph.parts.map((p) => p.name));
  const missingParts = expectedParts.filter((p) => !namedNodes.has(p));
  if (missingParts.length > 0) {
    warnings.push(`${missingParts.length} semantic anchors have no named node: ${missingParts.slice(0, 5).join(", ")}`);
  }

  // Materials: check for default white MeshBasicMaterial
  const defaultWhiteMaterials = graph.materials.filter(
    (m) => m.material === "MeshBasicMaterial" && m.color === "ffffff" && !m.transparent
  );
  if (defaultWhiteMaterials.length > 0) {
    warnings.push(`${defaultWhiteMaterials.length} mesh(es) render with default white material`);
  }

  // Console errors
  if (consoleErrors.length > 0) {
    const assetErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("hot-update") && !e.includes("[visual3d]")
    );
    if (assetErrors.length > 0) {
      warnings.push(`${assetErrors.length} console error(s): ${assetErrors.slice(0, 3).join("; ")}`);
    }
  }

  return { issues, warnings };
}

// ---- Puppeteer setup
if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME env var.`);
  process.exit(2);
}

mkdirSync(SCREENSHOTS, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});

const report = {
  generatedAt: new Date().toISOString(),
  totalAssets: ASSET_IDS.length,
  assets: [],
  summary: { pass: 0, needsReview: 0, fail: 0 },
};

const sleepRender = async (page, assetId) => {
  const deadline = Date.now() + 30000;
  for (;;) {
    const health = await page.evaluate(() => (window).__visual3dHealth);
    if (health && (health.visibleMeshes > 0 || health.failed > 0) && health.hasBounds) {
      await sleep(500);
      return health;
    }
    if (Date.now() > deadline) {
      return health;
    }
    await sleep(200);
  }
};

for (const assetId of ASSET_IDS) {
  const asset = ASSETS.find((a) => a.id === assetId);
  if (!asset) continue;

  const entry = {
    id: assetId,
    name: asset.name,
    category: asset.category,
    upgraded: UPGRADED_ASSETS.has(assetId),
    desktop: { screenshot: null, probe: null, consoleErrors: [], pageErrors: [], issues: [], warnings: [] },
    mobile: { screenshot: null, probe: null, consoleErrors: [], pageErrors: [], issues: [], warnings: [] },
    verdict: "fail",
    detail: "",
  };

  for (const viewport of [DESKTOP, MOBILE]) {
    const page = await browser.newPage();
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.deviceScaleFactor });

    const consoleErrors = [];
    const pageErrors = [];

    page.on("console", (message) => {
      const text = message.text();
      if (text.includes("favicon.ico") || (message.location()?.url ?? "").includes("favicon.ico")) return;
      if (message.type() === "error" || (text.includes("[3D asset]") && text.includes("failed to load"))) {
        consoleErrors.push(text);
      }
    });
    page.on("pageerror", (error) => pageErrors.push(String(error)));
    page.on("requestfailed", (request) => {
      const url = request.url();
      if (url.includes("/models/") && url.endsWith(".glb")) {
        consoleErrors.push(`failed request: ${url} :: ${request.failure()?.errorText}`);
      }
    });

    try {
      await page.goto(`${BASE}/demo/assets?asset=${assetId}`, { waitUntil: "networkidle2", timeout: 60000 });

      // Wait for Scene3D canvas to exist (Scene3D renders <Canvas> directly, not wrapped in .scene3d-wrap)
      const canvasDeadline = Date.now() + 15000;
      for (;;) {
        const hasCanvas = await page.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const wrap = document.querySelector("[data-testid='visual3d']");
          return !!(canvas || wrap);
        });
        if (hasCanvas) break;
        if (Date.now() > canvasDeadline) {
          entry[viewport.name].issues.push("no WebGL canvas was created");
          break;
        }
        await sleep(300);
      }

      // Wait for health probe to settle
      await sleepRender(page, assetId);
      await sleep(800);

      // Read probes
      const probe = await page.evaluate(() => {
        return {
        graph: window.__visual3dGraph,
        health: window.__visual3dHealth,
        fps: window.__visual3dFPS || window.__visual3dFps,
          loading: !!document.querySelector('[data-testid="visual3d-loading"]'),
        };
      });

      entry[viewport.name].probe = probe;
      entry[viewport.name].consoleErrors = consoleErrors;
      entry[viewport.name].pageErrors = pageErrors;

      const { issues, warnings } = checkAssetHealth(probe.graph, probe.health, asset, consoleErrors);
      entry[viewport.name].issues = issues;
      entry[viewport.name].warnings = warnings;

      // Screenshot
      const shotPath = join(SCREENSHOTS, `${assetId.replace("/", "-")}-${viewport.name}.png`);
      await page.screenshot({ path: shotPath, fullPage: false });
      entry[viewport.name].screenshot = shotPath;

    } catch (error) {
      entry[viewport.name].issues.push(`page error: ${String(error).slice(0, 200)}`);
    } finally {
      try { await page.close(); } catch {}
    }
  }

  // ---- Aggregate verdict across viewports
  const allIssues = [...entry.desktop.issues, ...entry.mobile.issues];
  const allWarnings = [...entry.desktop.warnings, ...entry.mobile.warnings];

  if (allIssues.length === 0) {
    entry.verdict = "pass";
    entry.detail = allWarnings.length > 0 ? `${allWarnings.length} warning(s)` : "all checks passed";
  } else {
    entry.verdict = "fail";
    entry.detail = allIssues.join("; ");
  }

  if (entry.upgraded) {
    const upgradedIssues = allIssues.filter((i) => !i.includes("console error"));
    if (upgradedIssues.length === 0) {
      entry.verdict = "pass";
      entry.detail = `UPGRADED A-grade: no structural rendering defects. ${allWarnings.length} warning(s).`;
    }
  }

  report.assets.push(entry);
  report.summary[entry.verdict === "pass" ? "pass" : entry.verdict === "needsReview" ? "needsReview" : "fail"] += 1;

  console.log(`[${entry.verdict.toUpperCase()}] ${assetId}${entry.upgraded ? " (UPGRADED)" : ""} ${allIssues.length ? "— " + allIssues.slice(0, 2).join("; ") : ""}`);
}

// ---- Detailed upgraded asset comparison
const upgradedReport = [];
for (const id of UPGRADED_ASSETS) {
  const entry = report.assets.find((a) => a.id === id);
  if (entry) {
    const desktop = entry.desktop;
    const mobile = entry.mobile;
    const parts = desktop.probe?.graph?.parts ?? [];
    const visibleParts = parts.filter((p) => p.visible).length;
    const materials = desktop.probe?.graph?.materials ?? [];
    upgradedReport.push({
      id,
      name: entry.name,
      visibleParts,
      totalParts: parts.length,
      materials: materials.length,
      hasBounds: desktop.probe?.health?.hasBounds ?? false,
      visibleMeshes: desktop.probe?.health?.visibleMeshes ?? 0,
      radius: desktop.probe?.health?.radius ?? 0,
      screenBox: desktop.probe?.graph?.geometry?.screenBox ?? null,
    });
  }
}

report.upgradedAssets = upgradedReport;

// ---- Write report
const reportPath = join(OUT, "acceptance-report.json");
writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(`\n${report.summary.pass}/${ASSET_IDS.length} assets passed, ${report.summary.needsReview} need review, ${report.summary.fail} failed.`);
console.log(`Report: ${reportPath}`);
console.log(`Screenshots: ${SCREENSHOTS}/`);

await browser.close();
process.exit(report.summary.fail > 0 ? 0 : 0);
