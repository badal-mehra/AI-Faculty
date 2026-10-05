// A one-off look at what the classroom actually renders at the end of a lesson.
// It exists because a harness assertion ("the objective was reported covered") failed while the server
// reported complete=true, and guessing between the two was slower than reading the DOM.
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:3000";
const QUESTION = process.argv[2] ?? "Explain the human heart and how blood circulates through it.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("console", (message) => { if (message.type() === "error") console.log("console.error:", message.text().slice(0, 200)); });

await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
await page.type("#lesson-question", QUESTION, { delay: 3 });
await page.click("button.primary-action");

for (let index = 0; index < 30; index += 1) {
  await sleep(2200);
  const advanced = await page.evaluate(() => {
    const stop = document.querySelector("button.stop-action");
    if (stop && !stop.disabled) { stop.click(); return true; }
    return false;
  });
  if (!advanced) break;
  let continued = false;
  for (let wait = 0; wait < 30 && !continued; wait += 1) {
    continued = await page.evaluate(() => {
      const next = document.querySelector("button.continue-action");
      if (next && !next.disabled) { next.click(); return true; }
      return false;
    });
    if (!continued) await sleep(500);
  }
  if (!continued) break;
}

await sleep(3000);
const summary = await page.evaluate(() => ({
  statusNotes: Array.from(document.querySelectorAll(".status-note")).map((node) => ({ className: node.className, text: node.textContent })),
  outline: Array.from(document.querySelectorAll(".outline-item")).map((node) => node.className).join(" | "),
  rail: (document.querySelector(".step-rail")?.textContent ?? "").trim(),
  hasContinue: Boolean(document.querySelector("button.continue-action")),
  hasStartNew: Boolean(document.querySelector("button.primary-action")),
  livePanelText: (document.querySelector(".live-panel")?.textContent ?? document.body.innerText).slice(0, 1200),
}));
console.log(JSON.stringify(summary, null, 2));
await browser.close();