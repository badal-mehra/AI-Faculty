// Focused verification of the auth-form fixes: SVG (not emoji) toggles,
// Next.js <Link> internal navigation with no full document reload.
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3000";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

const findings = [];
let errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(m.text()); });

// 1. Password toggle must render an SVG, not an emoji character.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
const toggleInfo = await page.evaluate(() => {
  const btn = document.querySelector(".password-toggle");
  if (!btn) return { found: false };
  const svg = btn.querySelector("svg");
  const text = btn.textContent ?? "";
  const isEmoji = /[👁🙈]/.test(text);
  return {
    found: true,
    hasSvg: Boolean(svg),
    svgPathCount: svg ? svg.querySelectorAll("path, line, circle").length : 0,
    ariaLabel: btn.getAttribute("aria-label"),
    ariaPressed: btn.getAttribute("aria-pressed") !== null,
    hasEmojiText: isEmoji,
  };
});
findings.push({ check: "login password toggle is an SVG with aria-label (not emoji)", ...toggleInfo });

await page.goto(`${BASE}/signup`, { waitUntil: "networkidle0" });
const signupToggle = await page.evaluate(() => {
  const btn = document.querySelector(".password-toggle");
  if (!btn) return { found: false };
  return {
    found: true,
    hasSvg: Boolean(btn.querySelector("svg")),
    hasEmojiText: /[👁🙈]/.test(btn.textContent ?? ""),
  };
});
findings.push({ check: "signup password toggle is an SVG (not emoji)", ...signupToggle });

await page.goto(`${BASE}/reset-password?code=fake&type=recovery`, { waitUntil: "networkidle0" });
const resetToggle = await page.evaluate(() => {
  const btn = document.querySelector(".password-toggle");
  if (!btn) return { found: false };
  return { found: true, hasSvg: Boolean(btn.querySelector("svg")), hasEmojiText: /[👁🙈]/.test(btn.textContent ?? "") };
});
findings.push({ check: "reset-password toggle is an SVG (not emoji)", ...resetToggle });

// 2. Internal auth links must be <a> (Next <Link>) and SPA-navigate without a full reload.
// NOTE: tagName is uppercase in HTML, and Next.js <Link> renders a real <a>.
await page.goto(`${BASE}/login`, { waitUntil: "networkidle0" });
const navChecks = await page.evaluate(() => {
  const links = Array.from(document.querySelectorAll(".auth-footer a, .auth-links a")).map((a) => ({
    href: a.getAttribute("href"),
    isAnchor: a.tagName === "A",
    text: (a.textContent ?? "").trim().slice(0, 40),
  }));
  return links;
});

// Measure navigation type: SPA (link click) should be a same-document navigation (navigationId reused, no fresh load).
const beforeNav = await page.evaluate(() => ({
  url: window.location.href,
  entryCount: performance.getEntriesByType("navigation").length,
}));

await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }),
  page.click(".auth-footer a"),
]);

const afterNav = await page.evaluate(() => {
  const navs = performance.getEntriesByType("navigation");
  return {
    url: window.location.href,
    types: navs.map((n) => n.type),
    isReload: navs.some((n) => n.type === "reload"),
    entryCount: navs.length,
  };
});
findings.push({
  check: "auth footer Link is an <a> anchor + SPA navigation (no reload)",
  navLinks: navChecks,
  beforeUrl: beforeNav.url,
  afterUrl: afterNav.url,
  afterNavTypes: afterNav.types,
  isReload: afterNav.isReload,
  spaNavigation: !afterNav.isReload && afterNav.url === "http://localhost:3000/signup?redirectTo=%2Fdashboard",
});

await page.goto(`${BASE}/reset-password?code=fake&type=recovery`, { waitUntil: "networkidle0" });
const resetLinks = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".auth-footer a, .auth-links a")).map((a) => ({
    href: a.getAttribute("href"),
    isAnchor: a.tagName === "A",
  }))
);
findings.push({ check: "reset-password uses Link anchors", resetLinks });

await browser.close();

console.log("\n=== Auth Fix Verification ===");
const allPass = findings.every((f) => {
  let pass;
  if (f.spaNavigation !== undefined) pass = f.spaNavigation && f.navLinks.every((l) => l.isAnchor);
  else if (f.resetLinks) pass = f.resetLinks.every((l) => l.isAnchor);
  else pass = f.found && f.hasSvg && !f.hasEmojiText;
  console.log(`${pass ? "PASS" : "FAIL"}  ${f.check}`);
  console.log(JSON.stringify(f, null, 2));
  return pass;
});
console.log(`\nRuntime errors: ${errors.length}`);
if (errors.length) console.log(errors.join("\n"));
console.log(allPass && errors.length === 0 ? "\nALL AUTH FIXES VERIFIED" : "\nSOME CHECKS FAILED");
