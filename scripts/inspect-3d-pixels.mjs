// RENDERED-PIXEL INSPECTION — the objective form of "look at the screenshot".
//
// Automated checks can all pass while the viewport shows nothing: an object exists in engine state, a
// camera moved, a label rendered — and the GPU draws a black rectangle because the model is a
// microscopic speck, sits behind the camera, or its GLB silently fell back to an invisible primitive.
// This script reads the ACTUAL rendered pixels of the WebGL canvas and reports what is really on
// screen, per step, per scenario:
//
//   drawnRatio      fraction of pixels that are not the clear colour (is anything there at all?)
//   distinctColors  quantized colour count (a flat fill is a blank frame, not a rendered model)
//   contentBox      screen-space bounding box of drawn pixels (microscopic / off-camera / oversized)
//   luma            mean and spread (a model too dark to read is a failure, not a pass)
//
// It also reports the GPU-side geometry occupancy measured by the Scene3D probe, so a rendered but
// unreadably tiny model is caught as well as a blank one.
//
// Usage: node scripts/inspect-3d-pixels.mjs [scenario...]
//        BASE=http://localhost:3001 node scripts/inspect-3d-pixels.mjs
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = ".verify/pixels";

// The clear colour the scene paints behind everything (see Scene3D <color attach="background">).
const BACKGROUND = { r: 0x08, g: 0x11, b: 0x0f };

const SCENARIOS = [
  { id: "heart", question: "How does the human heart pump blood?", expect: ["biology/heart"] },
  { id: "brain", question: "Show me the parts of the human brain", expect: ["biology/brain"] },
  { id: "lungs", question: "How do the lungs work in the body?", expect: ["biology/lungs"] },
  { id: "cell", question: "What is inside an animal cell?", expect: ["biology/cell"] },
  { id: "photosynthesis", question: "How does photosynthesis work inside a leaf?", expect: ["biology/leaf"] },
  { id: "atom", question: "Describe the structure of an atom and its electron shells", expect: [] },
  { id: "solar-system", question: "Show me the solar system and how planets orbit the sun", expect: ["astronomy/sun"] },
  { id: "tcp", question: "What is the TCP three way handshake?", expect: ["network/laptop", "network/server", "network/router"] },
  { id: "pendulum", question: "Explain the period of a simple pendulum", expect: [] },
  { id: "cylinder-volume", question: "What is the volume of a cylinder?", expect: ["mathematics/cylinder"] },
  { id: "bst", question: "Insert values into a binary search tree", expect: [] },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const only = process.argv.slice(2).filter((value) => SCENARIOS.some((s) => s.id === value));
const targets = only.length > 0 ? SCENARIOS.filter((s) => only.includes(s.id)) : SCENARIOS;

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME to your Chrome executable.`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});

/**
 * Runs inside the page. Reads the WebGL canvas's real pixels through a 2D canvas (the GL context is
 * created with preserveDrawingBuffer, so the drawing buffer is still readable after the frame).
 */
function measureCanvas() {
  const canvas = document.querySelector(".scene3d-wrap canvas");
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));

  const off = document.createElement("canvas");
  off.width = width;
  off.height = height;
  const ctx = off.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  // Tolerance absorbs the ground grid and fog, which legitimately paint near-background pixels.
  const TOLERANCE = 14;
  let drawn = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  let lumaSum = 0;
  const drawnLuma = [];
  const colors = new Set();
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      lumaSum += luma;
      if (Math.abs(r - 8) <= TOLERANCE && Math.abs(g - 17) <= TOLERANCE && Math.abs(b - 15) <= TOLERANCE) continue;
      drawn += 1;
      drawnLuma.push(luma);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      colors.add(((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4));
    }
  }

  drawnLuma.sort((a, b) => a - b);
  const total = width * height;
  const box = maxX < 0 ? null : {
    x: minX / width, y: minY / height,
    width: (maxX - minX) / width, height: (maxY - minY) / height,
  };

  return {
    canvas: { width, height },
    drawnRatio: drawn / total,
    distinctColors: colors.size,
    meanLuma: lumaSum / total,
    drawnLumaP50: drawnLuma.length ? drawnLuma[Math.floor(drawnLuma.length * 0.5)] : 0,
    drawnLumaP05: drawnLuma.length ? drawnLuma[Math.floor(drawnLuma.length * 0.05)] : 0,
    drawnLumaP95: drawnLuma.length ? drawnLuma[Math.floor(drawnLuma.length * 0.95)] : 0,
    contentBox: box,
    graph: window.__visual3dGraph?.geometry ?? null,
    materials: window.__visual3dGraph?.materials ?? [],
    camera: window.__visual3dGraph?.camera ?? null,
    fit: window.__visual3dFit ?? null,
    labels: document.querySelectorAll(".scene-label").length,
  };
}

const report = [];

for (const scenario of targets) {
  // The dev server compiles the lesson route on first use, and the very first request after a compile
  // can be served from a stale hot-update (404) which leaves the scenario with no canvas at all.
  // Warming the exact route first removes that dev-server noise from the measurements.
  try {
    const warm = await fetch(`${BASE}/api/teaching/lesson?scenario=${scenario.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        question: scenario.question,
        language: "English",
        lessonStep: 1,
        boardState: { nodes: [], edges: [], texts: [], highlights: [] },
        visualState: { objects: [], tick: 0 },
        visualState3d: { objects: [], flows: [], particles: [], labels: [], annotations: [], camera: { position: { x: 0, y: 0, z: 8 }, target: { x: 0, y: 0, z: 0 }, fov: 45, mode: "default" }, tick: 0 },
      }),
    });
    await warm.arrayBuffer();
  } catch { /* the real run reports any genuine failure */ }

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const consoleErrors = [];
  const pageErrors = [];
  const models = new Set();
  const failedRequests = [];
  page.on("console", (m) => {
    const text = m.text();
    if (text.includes("favicon.ico")) return;
    if (m.type() === "error") consoleErrors.push(text);
    if (text.startsWith("[3D asset]") && text.includes("failed to load")) consoleErrors.push(text);
  });
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  page.on("requestfailed", (r) => failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
  page.on("response", (r) => {
    if (r.url().includes("/models/") && r.url().endsWith(".glb")) {
      if (r.ok()) models.add(r.url().split("/models/")[1].replace(".glb", ""));
      else failedRequests.push(`${r.url()} :: HTTP ${r.status()}`);
    }
  });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}${request.url().includes("?") ? "&" : "?"}scenario=${scenario.id}` });
      return;
    }
    request.continue();
  });

  const entry = { id: scenario.id, expect: scenario.expect, steps: [], models: [], consoleErrors, pageErrors, failedRequests };

  try {
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#lesson-question", { timeout: 60000 });
    const textarea = await page.$("#lesson-question");
    if (!textarea) throw new Error("#lesson-question not found");
    await textarea.type(scenario.question, { delay: 3 });
    await page.click("button.primary-action");

    for (let step = 0; step < 8; step += 1) {
      await sleep(2600);
      const m = await page.evaluate(measureCanvas);
      if (m) entry.steps.push(m);
      const shot = join(OUT, `${scenario.id}-step${step + 1}.png`);
      const el = await page.$(".scene3d-wrap canvas");
      if (el) await el.screenshot({ path: shot });

      const advanced = await page.evaluate(() => {
        const stop = document.querySelector("button.stop-action");
        if (stop && !stop.disabled) stop.click();
        return Boolean(stop);
      });
      if (!advanced) break;
      await sleep(700);
      const cont = await page.evaluate(() => {
        const next = document.querySelector("button.continue-action");
        if (next && !next.disabled) { next.click(); return true; }
        return false;
      });
      if (!cont) break;
    }
  } catch (error) {
    entry.error = String(error);
  }

  // A dev server serves a stale hot-update 404 on the very first request after a cold start, which can
  // leave the first scenario with no canvas at all. One clean retry keeps that dev-server noise
  // distinguishable from a genuine rendering failure.
  if (entry.steps.length === 0) {
    const wasCold = entry.failedRequests.concat(entry.consoleErrors).join(" ").includes("hot-update")
      || entry.failedRequests.concat(entry.consoleErrors).join(" ").includes("404");
    if (wasCold) {
      console.log(`  (${scenario.id}: no canvas on first attempt, retrying once for dev-server cold start)`);
      entry.steps = [];
      entry.consoleErrors = [];
      entry.pageErrors = [];
      entry.failedRequests = [];
      await page.close();
      const retry = await browser.newPage();
      await retry.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
      retry.on("console", (m) => { const t = m.text(); if (!t.includes("favicon.ico") && m.type() === "error") entry.consoleErrors.push(t); });
      retry.on("pageerror", (e) => entry.pageErrors.push(String(e)));
      retry.on("requestfailed", (r) => entry.failedRequests.push(`${r.url()} :: ${r.failure()?.errorText}`));
      retry.on("response", (r) => { if (r.url().includes("/models/") && r.url().endsWith(".glb")) { if (r.ok()) models.add(r.url().split("/models/")[1].replace(".glb", "")); else entry.failedRequests.push(`${r.url()} :: HTTP ${r.status()}`); } });
      await retry.setRequestInterception(true);
      retry.on("request", (request) => {
        if (request.url().includes("/api/teaching/lesson")) {
          request.continue({ url: `${request.url()}${request.url().includes("?") ? "&" : "?"}scenario=${scenario.id}` });
          return;
        }
        request.continue();
      });
      try {
        await retry.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
        await retry.waitForSelector("#lesson-question", { timeout: 60000 });
        const ta = await retry.$("#lesson-question");
        if (!ta) throw new Error("#lesson-question not found on retry");
        await ta.type(scenario.question, { delay: 3 });
        await retry.click("button.primary-action");
        for (let step = 0; step < 8; step += 1) {
          await sleep(2600);
          const m = await retry.evaluate(measureCanvas);
          if (m) entry.steps.push(m);
          const el = await retry.$(".scene3d-wrap canvas");
          if (el) await el.screenshot({ path: join(OUT, `${scenario.id}-step${step + 1}.png`) });
          const advanced = await retry.evaluate(() => { const s = document.querySelector("button.stop-action"); if (s && !s.disabled) s.click(); return Boolean(s); });
          if (!advanced) break;
          await sleep(700);
          const cont = await retry.evaluate(() => { const n = document.querySelector("button.continue-action"); if (n && !n.disabled) { n.click(); return true; } return false; });
          if (!cont) break;
        }
      } catch (error) {
        entry.error = String(error);
      }
      entry.models = Array.from(models);
      report.push(entry);
      printScenario(entry);
      await retry.close();
      continue;
    }
  }

  entry.models = Array.from(models);
  report.push(entry);
  printScenario(entry);
  await page.close();
}

function printScenario(entry) {
  const scenario = SCENARIOS.find((s) => s.id === entry.id);
  const steps = entry.steps;
  console.log(`\n=== ${entry.id} ===`);
  console.log(`  canvas steps: ${steps.length}  models: ${entry.models.join(",") || "(none)"}`);
  for (const [i, s] of steps.entries()) {
    const sb = s.graph?.screenBox;
    console.log(
      `  step${i + 1}: drawn=${(s.drawnRatio * 100).toFixed(1)}% colors=${s.distinctColors}` +
      ` luma p05/p50/p95=${s.drawnLumaP05.toFixed(0)}/${s.drawnLumaP50.toFixed(0)}/${s.drawnLumaP95.toFixed(0)}` +
      ` screen w=${sb ? (sb.width * 50).toFixed(0) : "?"}% h=${sb ? (sb.height * 50).toFixed(0) : "?"}%` +
      ` meshes=${s.graph?.meshCount ?? 0} offCam=${s.graph?.offCameraCorners ?? 0} labels=${s.labels}`,
    );
  }
  if (entry.error) console.log(`  error: ${entry.error}`);
  if (entry.consoleErrors.length) console.log(`  consoleErrors: ${entry.consoleErrors.length} -> ${entry.consoleErrors.slice(0, 2).join(" | ")}`);
  if (entry.pageErrors.length) console.log(`  pageErrors: ${entry.pageErrors.length} -> ${entry.pageErrors.slice(0, 2).join(" | ")}`);
  if (entry.failedRequests.length) console.log(`  failedRequests: ${entry.failedRequests.slice(0, 2).join(" | ")}`);
  void scenario;
}

await browser.close();
writeFileSync(join(OUT, "pixels.json"), JSON.stringify(report, null, 2));
console.log(`\nWrote ${join(OUT, "pixels.json")}`);
