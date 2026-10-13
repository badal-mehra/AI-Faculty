// Lightweight browser capture for frontend verification.
// Usage: node scripts/screenshot-pages.mjs
// Launches headless Chrome on the local dev server, captures full-page + element
// screenshots of the public auth screens and any logged-out-reachable page.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = join(".verify", "screenshots");

mkdirSync(OUT, { recursive: true });

const SIZES = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "mobile-390", width: 390, height: 844 },
];

const PAGES = [
  { path: "/login", file: "login" },
  { path: "/signup", file: "signup" },
  { path: "/forgot-password", file: "forgot-password" },
  { path: "/reset-password", file: "reset-password" },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});

const results = [];
for (const size of SIZES) {
  const page = await browser.newPage();
  await page.setViewport({ width: size.width, height: size.height, deviceScaleFactor: 1 });
  const pageErrors = [];
  const consoleErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  for (const target of PAGES) {
    const url = `${BASE}${target.path}`;
    try {
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });
      const file = `${target.file}-${size.name}.png`;
      await page.screenshot({ path: join(OUT, file), fullPage: true });
      results.push({ page: target.path, size: size.name, file, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length });
      consoleErrors.length = 0;
      pageErrors.length = 0;
    } catch (error) {
      results.push({ page: target.path, size: size.name, error: String(error) });
    }
  }
  await page.close();
}

await browser.close();

console.log("\n=== Screenshot Summary ===");
for (const result of results) {
  if (result.error) console.log(`FAIL ${result.page} @ ${result.size}: ${result.error}`);
  else console.log(`ok  ${result.file}  (js errors=${result.consoleErrors}, page errors=${result.pageErrors})`);
}
