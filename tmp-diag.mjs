const BASE = "http://localhost:3001";
const puppeteer = (await import("puppeteer-core")).default;
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.setRequestInterception(true);
page.on("request", (r) => {
  if (r.url().includes("/api/teaching/lesson")) r.continue({ url: `${r.url()}?scenario=solar-system` });
  else r.continue();
});
await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector("#lesson-question", { timeout: 60000 });
await page.type("#lesson-question", "Show me the solar system and how planets orbit the sun", { delay: 3 });
await page.click("button.primary-action");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const snap = async (tag) => {
  const d = await page.evaluate(() => {
    const f = window.__visual3dFit;
    const g = window.__visual3dGraph;
    const jup = (g?.parts ?? []).find((p) => p.name === "jupiter");
    return { fit: f, geom: g?.geometry ?? null, jupiter: jup ?? null };
  });
  const f = d.fit;
  console.log(`${tag}: dist=${f?.distance?.toFixed(2)} radius=${f?.radius?.toFixed(2)} mode=${f ? "?" : "?"} tick=${f?.tick}`);
  console.log(`   target=(${f?.target?.x?.toFixed(2)},${f?.target?.y?.toFixed(2)},${f?.target?.z?.toFixed(2)})`);
  console.log(`   jupiterWorld=${d.jupiter ? `(${d.jupiter.x},${d.jupiter.y},${d.jupiter.z})` : "n/a"}`);
  console.log(`   screen w=${d.geom?.screenBox ? (d.geom.screenBox.width * 50).toFixed(0) : "?"}% h=${d.geom?.screenBox ? (d.geom.screenBox.height * 50).toFixed(0) : "?"}% meshes=${d.geom?.meshCount}`);
};
await sleep(5000);
await snap("step1");
await page.evaluate(() => { const s = document.querySelector("button.stop-action"); if (s && !s.disabled) s.click(); });
await sleep(800);
await page.evaluate(() => { const n = document.querySelector("button.continue-action"); if (n && !n.disabled) n.click(); });
await sleep(6000);
await snap("step2");
await browser.close();
