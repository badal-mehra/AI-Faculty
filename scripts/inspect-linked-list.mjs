// Inspect the linked-list demo board in production.
// Usage: node scripts/inspect-linked-list.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = ".verify/board";

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({
  headless: "new",
  executablePath: CHROME,
  defaultViewport: { width: 1500, height: 1000, deviceScaleFactor: 1 },
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
});

const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${message.text()} @ ${message.location()?.url ?? ""}`); });
page.on("pageerror", (error) => pageErrors.push(String(error)));

await page.goto(`${BASE}/demo/board?scenario=linked-list&autoplay=1`, { waitUntil: "networkidle2", timeout: 60000 });
await page.waitForFunction(() => typeof window.__board === "object" && typeof window.__board.step === "function", { timeout: 30000 });

// Wait for autoplay to step through all 5 steps (each step has ~1600ms settle + animation)
await sleep(12000);

// Capture the full board state
const result = await page.evaluate(() => {
  const svg = document.querySelector(".diagram-canvas");
  if (!svg) return { error: "no svg" };
  const board = svg.getBoundingClientRect();
  const viewBox = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;

  const groups = Array.from(svg.querySelectorAll("g[data-object-id]"));
  const objects = groups.map((g) => ({
    id: g.getAttribute("data-object-id"),
    kind: g.getAttribute("data-kind"),
    rect: (() => { const r = g.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    transform: g.getAttribute("transform") ?? "",
    dataFrom: g.getAttribute("data-from") ?? "",
    dataTo: g.getAttribute("data-to") ?? "",
    dataConnector: g.getAttribute("data-connector") ?? "",
  }));

  // Text content
  const texts = Array.from(svg.querySelectorAll("text")).map((t) => ({
    text: (t.textContent ?? "").trim().slice(0, 60),
    rect: (() => { const r = t.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
    fontSize: parseFloat(getComputedStyle(t).fontSize) || 0,
    parent: t.closest("g[data-object-id]")?.getAttribute("data-object-id") ?? null,
  }));

  // Shape paths
  const paths = Array.from(svg.querySelectorAll("path.diagram-shape, path.diagram-route")).map((p) => ({
    id: p.closest("g[data-object-id]")?.getAttribute("data-object-id") ?? "unknown",
    class: p.getAttribute("class") ?? "",
    d: (p.getAttribute("d") ?? "").slice(0, 120),
  }));

  return {
    board: { x: Math.round(board.x), y: Math.round(board.y), w: Math.round(board.width), h: Math.round(board.height) },
    viewBox: viewBox ? { x: viewBox.x, y: viewBox.y, w: viewBox.width, h: viewBox.height } : null,
    objects,
    texts,
    paths,
    consoleErrors: [],
    pageErrors: [],
  };
});

result.consoleErrors = consoleErrors;
result.pageErrors = pageErrors;

// Screenshot
await page.screenshot({ path: join(OUT, "linked-list-inspect.png"), fullPage: false });

writeFileSync(join(OUT, "linked-list-inspect.json"), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));

await browser.close();