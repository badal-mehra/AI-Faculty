// A timeline probe for one real lesson in a real browser.
//
// It exists because the end-of-lesson DOM said "nothing visual to draw" while the harness had measured
// thirteen visible meshes mid-lesson. Both were true at their own moments, and the only way to tell a
// scene that was wiped from one that was never built is to watch the scene while the lesson runs.
//
//   node scripts/inspect-lesson-timeline.mjs [question]
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const BASE = process.env.BASE ?? "http://localhost:3000";
const QUESTION = process.argv[2] ?? "Explain the human heart and how blood circulates through it.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
page.on("console", (message) => { if (message.type() === "error") console.log("console.error:", message.text().slice(0, 160)); });
page.on("pageerror", (error) => console.log("PAGE ERROR:", String(error).slice(0, 300)));
page.on("response", async (response) => {
  const url = response.url();
  if (!url.includes("/api/teaching/lesson")) return;
  try {
    const payload = await response.json();
    const steps = payload.steps ?? [];
    console.log(`<< ${response.status()} lesson: ${steps.length} steps ${steps.map((step) => step.lesson_step).join(",")} rep=${steps[0]?.representation} progress=${payload.progress ? `${payload.progress.stepsDelivered}/${payload.progress.maxSteps} covered=${payload.progress.coveredStageIds.length}/${payload.progress.stages.length} complete=${payload.progress.complete}` : "none"} ok=${payload.quality ? payload.quality.ok : "no-diagnostics"}`);
  } catch {
    console.log(`<< ${response.status()} lesson: unreadable`);
  }
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
await page.type("#lesson-question", QUESTION, { delay: 3 });
await page.click("button.primary-action");

const sample = async (tag) => {
  const state = await page.evaluate(() => ({
    graph: window.__visual3dGraph ? { meshes: window.__visual3dGraph.geometry.meshCount, parts: window.__visual3dGraph.parts.length } : null,
    scene: window.__visual3dHealth ?? null,
    diagram: document.querySelectorAll(".diagram-canvas g[data-object-id]").length,
    stage: document.querySelector(".scene3d-wrap") ? "3d" : document.querySelector(".diagram-canvas") ? "2d" : document.querySelector(".board-canvas") ? "graph" : "none",
    rail: (document.querySelector(".step-rail")?.textContent ?? "").replace(/\s+/g, " ").trim(),
    speech: (document.querySelector(".speech-card")?.textContent ?? "").slice(0, 60),
    loading: Boolean(document.querySelector(".teaching-loading")),
    notes: Array.from(document.querySelectorAll(".status-note")).map((node) => node.className),
    fallback: document.querySelector('[data-testid="text-fallback"]')?.textContent?.slice(0, 60) ?? null,
    voice: document.querySelector(".live-actions")?.getAttribute("data-voice-status") ?? null,
    continueVisible: Boolean(document.querySelector("button.continue-action")),
    errors: Array.from(document.querySelectorAll(".error, .error-card, [role='alert']")).map((node) => node.textContent?.slice(0, 120)),
  }));
  console.log(`-- ${tag}: stage=${state.stage} 3d=${state.graph?.meshes ?? 0} 2d=${state.diagram} rail="${state.rail}" loading=${state.loading} voice=${state.voice} continue=${state.continueVisible} notes=${state.notes.join(",")} errors=${JSON.stringify(state.errors)} | "${state.speech}"`);
  return state;
};

// The first batch can take half a minute. Touching the controls while a fetch is in flight is a different
// lesson from the one a student gets, so wait for a step to actually be on screen before interacting.
const firstPaint = Date.now() + 90000;
while (Date.now() < firstPaint) {
  if (await page.evaluate(() => Boolean(document.querySelector(".step-rail")))) break;
  await sleep(700);
}
await sample("first-paint");

const askAt = Number(process.argv[3] ?? "-1");
for (let index = 0; index < 60; index += 1) {
  await sleep(2500);
  const state = await sample(`t${index}`);
  if (index === askAt) {
    const typed = await page.evaluate((question) => {
      const input = document.querySelector("#student-question");
      const button = document.querySelector(".ask-card button");
      if (!input || !button) return "no-ask-card";
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, question);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      return "typed";
    }, "Can you repeat the most important point of this lesson in one sentence?");
    await sleep(400);
    const clicked = await page.evaluate(() => {
      const button = document.querySelector(".ask-card button");
      if (!button || button.disabled) return `disabled:${button?.disabled}`;
      button.click();
      return "clicked";
    });
    console.log(`   interrupt: ${typed} -> ${clicked}`);
  }
  if (state.notes.length > 0) { console.log("   (the classroom reported the lesson state)"); break; }
  // Continue is only present when the lesson is NOT auto-advancing. While it is, the synchronization
  // watchdog is what moves the lesson on, so the right move is to wait rather than to stop it.
  const advanced = await page.evaluate(() => {
    const next = document.querySelector("button.continue-action");
    if (next && !next.disabled) { next.click(); return true; }
    return false;
  });
  if (advanced) continue;
}
await sleep(4000);
await sample("final");
await page.screenshot({ path: ".teaching-verify/inspect-final.png" });
await browser.close();