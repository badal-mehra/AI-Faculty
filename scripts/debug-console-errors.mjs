import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const EMAIL = process.env.VERIFY_EMAIL ?? "badalmehra142@gmail.com";
const PASSWORD = process.env.VERIFY_PASS ?? "Badal@admin";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });

// Capture console errors
const consoleMessages = [];
page.on("console", msg => {
  const text = msg.text();
  if (text.includes("favicon") || text.includes("compiled")) return;
  consoleMessages.push({ type: msg.type(), text: text.slice(0, 300) });
});
page.on("pageerror", err => consoleMessages.push({ type: "pageerror", text: String(err).slice(0, 500) }));
page.on("requestfailed", req => consoleMessages.push({ type: "requestfailed", text: req.url() + " - " + (req.failure()?.errorText || "unknown") }));

// Login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle2", timeout: 30000 });
await page.type("#email", EMAIL);
await page.type("#password", PASSWORD);
await page.click("button.auth-button.primary[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));

// Create a lesson
await page.goto(`${BASE}/dashboard/new`, { waitUntil: "networkidle2", timeout: 30000 });
await new Promise(r => setTimeout(r, 2000));
await page.type("#question", "Explain photosynthesis in one step", { delay: 5 });
await page.click("button.auth-button.primary[type=submit]");
await page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 });
await new Promise(r => setTimeout(r, 2000));
const classroomUrl = page.url();
console.log("Classroom URL:", classroomUrl);

// Wait for teaching to start
console.log("Waiting 25s for teaching to start...");
await new Promise(r => setTimeout(r, 25000));

// Check console messages
const errors = consoleMessages.filter(m => m.type === "error" || m.type === "pageerror" || m.type === "requestfailed" || m.type === "warning");
console.log("Console messages:", JSON.stringify(errors, null, 2));

// Check classroom state
const state = await page.evaluate(() => {
  return {
    hasClassroom: !!document.querySelector(".classroom"),
    hasLive: !!document.querySelector(".teacher-live"),
    hasSetup: !!document.querySelector(".teacher-setup"),
    hasSpeechCard: !!document.querySelector(".speech-card"),
    hasStartButton: !!document.querySelector("button.primary-action"),
    startBtnText: document.querySelector("button.primary-action")?.textContent?.trim(),
    errorText: document.querySelector(".teaching-error")?.textContent?.slice(0, 200),
    has3D: !!document.querySelector(".scene3d-wrap"),
    hasBoard: !!document.querySelector(".board-canvas, svg.board"),
    bodyText: document.body?.innerText?.slice(0, 300),
  };
});
console.log("Classroom state:", JSON.stringify(state, null, 2));

await page.screenshot({ path: ".verify/debug-console-errors.png", fullPage: true });
await browser.close();
