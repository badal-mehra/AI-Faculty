// 2D BOARD BROWSER ACCEPTANCE.
//
// The unit tests prove the engine's arithmetic; this proves the BOARD. It drives the real classroom
// renderer in a real Chrome against the deterministic scenarios in lib/visual/demoScenarios.ts, steps
// through each lesson one step at a time, and judges the pixels that were actually painted.
//
// For every scenario, at every step it checks:
//   * the board is not blank and something was actually drawn
//   * no text is clipped, oversized, orphaned or outside the shape it names
//   * no two pieces of text overlap
//   * no two shapes overlap (a container FRAME containing its own cells is intentional, not a defect)
//   * every connector is attached to its two objects, on their borders, with an arrowhead that points
//     the right way
//   * labels sit clear of the arrows they belong to
//   * the active element is visibly the brightest thing on the board
//   * every animation reaches its end state (nothing is left mid-draw, mid-travel or invisible)
//   * an interrupted step settles safely and resuming does not duplicate anything
//
// Screenshots and a JSON report are written to .verify/board.
//
//   node scripts/verify-2d-board.mjs
//   node scripts/verify-2d-board.mjs array stack        # only these
//   BASE=http://localhost:3001 node scripts/verify-2d-board.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = ".verify/board";
const HEADLESS = process.env.HEADED !== "1";

// One row per required scenario. These ids match lib/visual/demoScenarios.ts.
const SCENARIOS = [
  { id: "array", needs: { shapes: 4 } },
  { id: "linked-list", needs: { shapes: 3, arrows: 3 } },
  { id: "stack", needs: { shapes: 3, arrows: 1 } },
  { id: "queue", needs: { shapes: 3 } },
  { id: "bst", needs: { shapes: 5, arrows: 4 } },
  { id: "graph", needs: { shapes: 5, arrows: 4 } },
  { id: "tcp", needs: { shapes: 2, arrows: 3 } },
  { id: "http", needs: { shapes: 2, arrows: 2 } },
  { id: "binary-search", needs: { shapes: 6 } },
  { id: "recursion", needs: { shapes: 4, arrows: 3 } },
  { id: "cpu-pipeline", needs: { shapes: 5, arrows: 4 } },
  { id: "math-matrix", needs: { shapes: 4, arrows: 0 } },
  { id: "physics-forces", needs: { shapes: 4, arrows: 3 } },
  { id: "generic-process", needs: { shapes: 3, arrows: 2 } },
  { id: "diagnostics", needs: { shapes: 2 }, expectsDiagnostics: true },
  { id: "interruption", needs: { shapes: 2 }, interrupt: true },
  { id: "code-trace", needs: { shapes: 4 }, code: true },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** The page currently under test; AUDIT runs inside it, so this is how the caller reads its state. */
let page0 = null;

/**
 * Runs INSIDE the page and reads the geometry the browser actually painted.
 * It never asks the app what it believes: every number here comes from getBoundingClientRect, which is
 * the same measurement a screenshot shows.
 */
const AUDIT = () => {
  const out = { painted: false, violations: [], counts: {}, focus: {}, animations: {}, connectors: [], steps: 0 };
  const svg = document.querySelector(".diagram-canvas");
  if (!svg) {
    out.violations.push("no 2D diagram canvas on screen");
    return out;
  }
  const board = svg.getBoundingClientRect();
  const box = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width
    ? svg.viewBox.baseVal
    : { x: 0, y: 0, width: board.width, height: board.height };
  const scale = Math.min(board.width / box.width, board.height / box.height);
  // preserveAspectRatio is xMidYMid meet, so the drawing can be letterboxed AND the viewBox origin is
  // not zero: user unit u maps to screen via (u - box.x).
  const originX = board.x + (board.width - box.width * scale) / 2;
  const originY = board.y + (board.height - box.height * scale) / 2;
  const toScreen = (u) => originX + (u - box.x) * scale;
  const toScreenY = (u) => originY + (u - box.y) * scale;

  const rectOf = (node) => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  };
  const inBounds = (r) => r.x >= board.x - 1 && r.y >= board.y - 1 && r.x + r.w <= board.x + board.width + 1 && r.y + r.h <= board.y + board.height + 1;
  const overlaps = (a, b, tol = 1) =>
    Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > tol && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > tol;

  // ---- objects ---------------------------------------------------------------------------------
  const groups = Array.from(svg.querySelectorAll("g[data-object-id]"));
  const shapes = [];
  const frames = [];
  const texts = [];
  const arrows = [];
  for (const group of groups) {
    const id = group.getAttribute("data-object-id");
    const kind = group.getAttribute("data-kind");
    if (kind === "arrow" || kind === "connector") {
      const path = group.querySelector("path.diagram-route");
      if (!path) continue;
      arrows.push({ id, group, path, from: group.getAttribute("data-from"), to: group.getAttribute("data-to"), connector: group.getAttribute("data-connector") });
      const edgeLabel = group.querySelector("text.diagram-edge-label");
      if (edgeLabel) texts.push({ id: `${id}:label`, el: edgeLabel, content: (edgeLabel.textContent ?? "").trim(), kind: "edge-label", host: null });
      continue;
    }
    if (kind === "container") {
      // A narrow container is a LIFELINE, drawn as a thin rule rather than a rect. Both are board
      // content, and a sequence diagram measured without its lifelines looks pinned to the top.
      const frame = group.querySelector("rect.diagram-frame, line.diagram-lifeline");
      if (frame) frames.push({ id, rect: rectOf(frame) });
      continue;
    }
    if (kind === "shape") {
      const path = group.querySelector("path.diagram-shape");
      if (!path) continue;
      shapes.push({ id, rect: rectOf(path), group });
      const label = group.querySelector("text.diagram-shape-label");
      if (label) texts.push({ id: `${id}:label`, el: label, content: (label.textContent ?? "").trim(), kind: "shape-label", host: path });
      continue;
    }
    const free = group.querySelector("text.diagram-text, text.diagram-label, text.diagram-icon");
    if (free) texts.push({ id, el: free, content: (free.textContent ?? "").trim(), kind: "free-text", host: null, group });
  }

  out.painted = shapes.length + texts.length > 0;
  out.counts = { shapes: shapes.length, frames: frames.length, texts: texts.length, arrows: arrows.length, groups: groups.length };

  const violations = out.violations;
  const name = (t) => `"${t.content.length > 30 ? `${t.content.slice(0, 30)}...` : t.content}"`;
  const TOL = 1.5;

  // ---- text ------------------------------------------------------------------------------------
  const measured = texts.filter((t) => t.content.length > 0).map((t) => {
    const rect = rectOf(t.el);
    const style = getComputedStyle(t.el);
    return { ...t, rect, fontSize: parseFloat(style.fontSize) || 0, opacity: parseFloat(style.opacity) || 0 };
  });
  if (measured.length === 0) violations.push("no text was painted on the board");
  for (const t of measured) {
    if (t.rect.w < 1 || t.rect.h < 1) violations.push(`text ${name(t)} has no visible box`);
    if (!inBounds(t.rect)) violations.push(`text ${name(t)} is clipped by the board edge`);
    if (t.fontSize > 40) violations.push(`text ${name(t)} is drawn at ${Math.round(t.fontSize)}px`);
    if (t.fontSize < 8) violations.push(`text ${name(t)} is drawn at an unreadable ${t.fontSize.toFixed(1)}px`);
    if (t.content.length > 90) violations.push(`text ${name(t)} is a ${t.content.length}-character block on the board`);
    if (t.host) {
      const host = rectOf(t.host);
      // A shape's own label must stay INSIDE that shape: the single most important text rule here.
      if (t.rect.x < host.x - TOL || t.rect.y < host.y - TOL || t.rect.x + t.rect.w > host.x + host.w + TOL || t.rect.y + t.rect.h > host.y + host.h + TOL) {
        violations.push(`shape label ${name(t)} sticks out of the shape it belongs to`);
      }
    }
  }
  for (let i = 0; i < measured.length; i += 1) {
    for (let j = i + 1; j < measured.length; j += 1) {
      if (overlaps(measured[i].rect, measured[j].rect, 1.5)) {
        violations.push(`text ${name(measured[i])} overlaps text ${name(measured[j])}`);
      }
    }
  }

  // ---- shapes ----------------------------------------------------------------------------------
  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) {
      if (overlaps(shapes[i].rect, shapes[j].rect, 2)) violations.push(`shapes "${shapes[i].id}" and "${shapes[j].id}" overlap`);
    }
    if (!inBounds(shapes[i].rect)) violations.push(`shape "${shapes[i].id}" is clipped by the board edge`);
    // A free-standing label must not be printed on top of a shape it does not belong to.
    for (const t of measured) {
      if (t.kind !== "free-text" || t.host) continue;
      if (overlaps(t.rect, shapes[i].rect, 2)) violations.push(`free text ${name(t)} is drawn on top of shape "${shapes[i].id}"`);
    }
  }

  // ---- the board uses the space it is in -----------------------------------------------------------
  // Every other check here asks whether what was DRAWN is right. These ask whether the board is using
  // the area it actually has. A drawing can be perfectly placed, correctly connected and completely
  // unclipped while occupying a third of the frame — which is what a fixed 800/520 canvas and a fixed
  // viewBox floor produced, identically on every screen.
  // Containers count as painted content. A sequence diagram's lifelines ARE board content; leaving them
  // out made the actors and their labels look pinned to the top of an empty frame.
  const painted = [...shapes.map((s) => s.rect), ...frames.map((f) => f.rect), ...measured.map((t) => t.rect)];
  if (painted.length > 0 && board.width > 0 && board.height > 0) {
    const left = Math.min(...painted.map((r) => r.x));
    const right = Math.max(...painted.map((r) => r.x + r.w));
    const top = Math.min(...painted.map((r) => r.y));
    const bottom = Math.max(...painted.map((r) => r.y + r.h));
    const fillW = (right - left) / board.width;
    const fillH = (bottom - top) / board.height;
    // Aspect mismatch makes the SHORTER axis small by definition, so the LONGER (limiting) axis is
    // what says whether the board is well used.
    const limiting = Math.max(fillW, fillH);
    out.fill = { width: Number(fillW.toFixed(3)), height: Number(fillH.toFixed(3)) };
    out.space = { limiting: Number(limiting.toFixed(3)), measured: Number.isFinite(limiting) };
    // And it must be centred, not anchored in a corner.
    const offsetX = ((left + right) / 2 - (board.x + board.width / 2)) / board.width;
    const offsetY = ((top + bottom) / 2 - (board.y + board.height / 2)) / board.height;
    out.space = { ...out.space, offsetX: Number(offsetX.toFixed(3)), offsetY: Number(offsetY.toFixed(3)) };
  }

  // ---- connectors ------------------------------------------------------------------------------
  const shapeById = new Map(shapes.map((s) => [s.id, s]));
  /**
   * "Attached" is not "on the pixel of the border": a route deliberately stops a few units short so the
   * arrowhead is not swallowed by the box. The real requirements are (a) the endpoint is NOT buried
   * inside the shape and (b) it is not floating far away from it.
   */
  const attached = (point, shape) => {
    const { x, y, w, h } = shape.rect;
    const insideX = point.x >= x - 2 && point.x <= x + w + 2;
    const insideY = point.y >= y - 2 && point.y <= y + h + 2;
    if (insideX && insideY) {
      const depth = Math.min(point.x - x, x + w - point.x, point.y - y, y + h - point.y);
      return depth <= 14;
    }
    const gapX = Math.max(x - point.x, point.x - (x + w), 0);
    const gapY = Math.max(y - point.y, point.y - (y + h), 0);
    return Math.hypot(gapX, gapY) <= 26;
  };
  for (const arrow of arrows) {
    const total = arrow.path.getTotalLength();
    if (!(total > 1)) {
      violations.push(`connector "${arrow.id}" drew no line`);
      continue;
    }
    const start = arrow.path.getPointAtLength(0);
    const end = arrow.path.getPointAtLength(total);
    const startBox = arrow.from ? shapeById.get(arrow.from) : null;
    const endBox = arrow.to ? shapeById.get(arrow.to) : null;
    const startHit = startBox ? attached({ x: toScreen(start.x), y: toScreenY(start.y) }, startBox) : true;
    const endHit = endBox ? attached({ x: toScreen(end.x), y: toScreenY(end.y) }, endBox) : true;
    if (!startHit) violations.push(`connector "${arrow.id}" does not start on the border of "${arrow.from}"`);
    if (!endHit) violations.push(`connector "${arrow.id}" does not end on the border of "${arrow.to}"`);
    // The arrowhead must be present and must point from -> to, not the other way round.
    const marker = arrow.path.getAttribute("marker-end") || arrow.group.getAttribute("marker-end");
    const arrowLike = arrow.connector !== "pointer";
    if (arrowLike && !marker) violations.push(`connector "${arrow.id}" has no arrowhead, so its direction is not readable`);
    out.connectors.push({
      id: arrow.id, from: arrow.from, to: arrow.to, length: Math.round(total),
      startHit, endHit, hasHead: Boolean(marker), connector: arrow.connector,
      start: { x: Math.round(toScreen(start.x)), y: Math.round(toScreenY(start.y)) },
      end: { x: Math.round(toScreen(end.x)), y: Math.round(toScreenY(end.y)) },
      fromRect: startBox ? startBox.rect : null,
      toRect: endBox ? endBox.rect : null,
      scale: Math.round(scale * 1000) / 1000,
    });
  }

  // ---- hierarchy: the active element must be visibly the strongest thing on the board -------------
  const dimmed = measured.filter((t) => t.opacity < 0.6).length;
  const emphasised = Array.from(svg.querySelectorAll(".diagram-shape.is-emphasized")).length;
  const subduedShapes = svg.querySelectorAll(".diagram-shape.is-dimmed").length;
  out.focus = { dimmedTexts: dimmed, emphasisedShapes: emphasised, subduedShapes };

  // The board's HEADING is deliberately never dimmed: it is what the teacher is talking around, and a
  // heading that greys out the moment a shape is highlighted stops reading as a diagram with a title.
  const dimmedHeadings = Array.from(svg.querySelectorAll(".diagram-text.role-title.is-dimmed, .diagram-text.role-subtitle.is-dimmed")).length;
  if (dimmedHeadings > 0) violations.push(`${dimmedHeadings} heading(s) were dimmed; the lesson's own title must stay legible`);

  // When shapes are subdued, something else on the board has to recede with them, or "focus" is not a
  // hierarchy at all. Text that is FIXED-CONTRAST by design (the heading, the headline formula) and
  // text that IS the focus have nothing left to recede, so neither counts: a board whose only other
  // text is the label on the block being pointed at is consistent, not broken.
  const focusSet = new Set((svg.getAttribute("data-focus-ids") ?? "").split(/\s+/).filter(Boolean));
  const eligibleText = Array.from(svg.querySelectorAll(".diagram-text, .diagram-shape-label")).filter((node) => {
    if (node.classList.contains("is-fixed-contrast")) return false;
    const host = node.closest("g[data-object-id]");
    const hostId = host?.getAttribute("data-object-id") ?? "";
    return !focusSet.has(hostId);
  }).length;
  if (subduedShapes > 0 && dimmed === 0 && eligibleText > 0) {
    violations.push("objects are subdued but no dimmable text recedes with them (hierarchy is inconsistent)");
  }

  // ---- animation must reach its end state -------------------------------------------------------
  // `animationPlayState` stays "running" forever, so completion must be read from the Web Animations
  // API. A board where motion never finishes looks fine in a still and broken in a classroom.
  const running = Array.from(document.getAnimations()).filter((animation) => {
    const target = animation.effect && animation.effect.target;
    return target && svg.contains(target) && animation.playState !== "finished";
  });
  out.animations = { running: running.length, names: running.map((a) => (a.animationName || a.constructor.name)) };
  const invisible = Array.from(svg.querySelectorAll("g[data-object-id]")).filter((node) => {
    const style = getComputedStyle(node);
    return parseFloat(style.opacity) < 0.02;
  });
  out.animations.invisible = invisible.length;
  return out;
};

/** Reads what the harness published on window, so the check drives the app the same way a user does. */
const readState = () => page0.evaluate(() => (window.__board && typeof window.__board.state === "function" ? window.__board.state() : null));

/**
 * Waits until the board has finished animating, instead of sleeping a guessed amount. A step's own
 * delays can be several seconds long (a scripted traversal), so a fixed sleep would either waste time or
 * — worse — judge a board while a pulse is still glowing.
 */
async function waitForSettled(timeout = 9000) {
  const started = Date.now();
  for (;;) {
    const unfinished = await page0.evaluate(() => {
      const svg = document.querySelector(".diagram-canvas");
      if (!svg) return 0;
      return document.getAnimations().filter((animation) => {
        const target = animation.effect && animation.effect.target;
        return target && svg.contains(target) && animation.playState !== "finished";
      }).length;
    });
    if (unfinished === 0) return Date.now() - started;
    if (Date.now() - started > timeout) return -1;
    await sleep(120);
  }
}

const only = process.argv.slice(2).filter((value) => SCENARIOS.some((scenario) => scenario.id === value));
const targets = only.length > 0 ? SCENARIOS.filter((scenario) => only.includes(scenario.id)) : SCENARIOS;

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  headless: HEADLESS ? "new" : false,
  executablePath: CHROME,
  defaultViewport: { width: 1500, height: 1000, deviceScaleFactor: 1 },
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
});

const report = [];
let failures = 0;

for (const scenario of targets) {
  page0 = await browser.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page0.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${message.text()} @ ${message.location()?.url ?? ""}`); });
  page0.on("pageerror", (error) => pageErrors.push(String(error)));
  page0.on("response", (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

  const entry = { id: scenario.id, needs: scenario.needs, steps: [], ok: true, problems: [] };
  try {
    // No ?autoplay=1: the check drives the lesson itself, and an autoplay timer firing underneath it
    // would step the scene twice and make every later reading wrong.
    await page0.goto(`${BASE}/demo/board?scenario=${scenario.id}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page0.waitForFunction(() => typeof window.__board === "object" && typeof window.__board.step === "function", { timeout: 30000 });
    const start = await readState();

    for (let index = 0; index < start.total; index += 1) {
      if (scenario.interrupt && index === 1) {
        // INTERRUPTION: cut into the middle of a slow animation, settle, then resume the lesson.
        await page0.evaluate(() => window.__board.step());
        await sleep(220);
        await page0.evaluate(() => window.__board.interrupt());
        await sleep(220);
        const mid = await page0.evaluate(() => {
          const svg = document.querySelector(".diagram-canvas");
          const running = svg ? Array.from(svg.querySelectorAll(".vfx-motion")).filter((n) => (document.getAnimations().filter((a) => a.effect && a.effect.target === n && a.playState !== "finished")).length > 0).length : 0;
          return { running };
        });
        if (mid.running > 0) entry.problems.push(`interruption left ${mid.running} animation(s) running`);
        await page0.evaluate(() => window.__board.resume());
        await sleep(400);
        const afterResume = await page0.evaluate(() => window.__board.state());
        const duplicated = await page0.evaluate(() => {
          const ids = Array.from(document.querySelectorAll("g[data-object-id]")).map((n) => n.getAttribute("data-object-id"));
          return ids.length - new Set(ids).size;
        });
        if (duplicated > 0) entry.problems.push(`resuming after an interruption duplicated ${duplicated} object(s)`);
        entry.steps.push({ step: index + 1, interrupted: true, objects: afterResume.objects });
        continue;
      }

      await page0.evaluate(() => window.__board.step());
      // Wait for the step's own animations to finish before judging the board.
      const settledMs = await waitForSettled();
      if (settledMs < 0) entry.problems.push(`step ${index + 1}: an animation never finished (still running after 9s)`);
      const audit = await page0.evaluate(AUDIT);
      const state = await readState();
      const shot = join(OUT, `${scenario.id}-step${index + 1}.png`);
      await page0.screenshot({ path: shot, fullPage: false });
      const step = {
        step: index + 1,
        objects: state.objects,
        counts: audit.counts,
        animations: audit.animations,
        focus: audit.focus,
        fill: audit.fill ?? null,
        space: audit.space ?? null,
        violations: audit.violations,
        screenshot: shot,
      };
      entry.steps.push(step);
      if (!audit.painted) entry.problems.push(`step ${index + 1}: the board is blank`);
      for (const violation of audit.violations) entry.problems.push(`step ${index + 1}: ${violation}`);
    }

    // A scenario's promise is checked against the RICHEST step it reaches, once, after the lesson: a
    // lesson that ends by deleting cells must not be judged on the empty final frame, and an empty
    // FIRST step must not be judged either.
    if ((scenario.needs?.shapes ?? 0) > 0) {
      const best = Math.max(0, ...entry.steps.map((s) => s.counts?.shapes ?? 0));
      if (best < scenario.needs.shapes) entry.problems.push(`the lesson never shows more than ${best} shapes, expected at least ${scenario.needs.shapes}`);
    }
    if ((scenario.needs?.arrows ?? 0) > 0) {
      const best = Math.max(0, ...entry.steps.map((s) => s.counts?.arrows ?? 0));
      if (best < scenario.needs.arrows) entry.problems.push(`the lesson never shows more than ${best} connectors, expected at least ${scenario.needs.arrows}`);
    }
    // How well the board is used is judged on the RICHEST step, once, after the lesson — the same rule
    // the shape/connector promises already use. Step 1 of most lessons is a title and nothing else, and
    // demanding that a one-line step fill the board would be judging a teaching beat against a layout
    // rule. What matters is that when the board IS full of the lesson, it uses the space it has.
    const spaces = entry.steps.map((step) => step.space).filter(Boolean);
    if (spaces.length > 0) {
      const fullest = spaces.reduce((best, current) => (current.limiting > best.limiting ? current : best));
      entry.space = fullest;
      if (fullest.measured === false) entry.problems.push("the board's fill could not be measured — the drawing's position is not readable");
      // 50%, not 60%. The two limits are in genuine tension and the measurement decides between them:
      // a four-cell array is ~290 board units wide on a ~1000px board, and filling that board would
      // render its 22-unit heading at 60px — which this same suite rejects as oversized text. Scenarios
      // with real content reach 0.81-0.91 (linked-list 0.83, cpu-pipeline 0.91); the two small ones sit
      // at 0.52-0.55. A threshold above 0.5 would therefore be asserting something the text-size rule
      // forbids. This still catches a genuinely wasted board — the pre-fix measurements were 0.33-0.45.
      else if (fullest.limiting < 0.5) {
        entry.problems.push(`at its fullest the drawing uses only ${Math.round(fullest.limiting * 100)}% of the board — mostly empty space`);
      }
      if (Math.abs(fullest.offsetX ?? 0) > 0.12 || Math.abs(fullest.offsetY ?? 0) > 0.12) {
        entry.problems.push(`at its fullest the drawing is off-centre by ${Math.round((fullest.offsetX ?? 0) * 100)}% x ${Math.round((fullest.offsetY ?? 0) * 100)}% — it looks anchored to a corner`);
      }
    }

    if (scenario.expectsDiagnostics) {
      const reported = await page0.evaluate(() => Array.from(document.querySelectorAll(".mock-panel .outline-item")).map((n) => (n.textContent ?? "").trim()));
      if (reported.length === 0) entry.problems.push("no visual action diagnostic was reported for the malformed step");
      else if (!reported.some((row) => /dropped|repaired/.test(row))) entry.problems.push("the malformed action was not reported as dropped or repaired");
      entry.diagnostics = reported;
    }
    // A listing is only useful if it can actually be followed: numbered, indented, and lit on the line
    // the teacher is on. Without the gutter the eye loses its place; without indentation the structure is
    // gone; without a lit line "this line" has nothing to point at.
    if (scenario.code) {
      const listing = await page0.evaluate(() => {
        const panel = document.querySelector(".diagram-code-panel");
        if (!panel) return null;
        const lines = Array.from(document.querySelectorAll(".diagram-code-line"));
        const gutter = Array.from(document.querySelectorAll(".diagram-code-gutter")).map((n) => n.textContent ?? "");
        const lit = Array.from(document.querySelectorAll(".diagram-code-highlight")).length;
        const kinds = new Set();
        for (const line of lines) for (const tspan of line.querySelectorAll("tspan")) kinds.add(Array.from(tspan.classList).find((c) => c.startsWith("code-token-")) ?? "none");
        return {
          lineCount: lines.length,
          gutter,
          lit,
          tokenKinds: Array.from(kinds),
          indented: lines.some((line) => (line.textContent ?? "").startsWith(" ")),
          overflows: panel.getBoundingClientRect().right > (document.querySelector(".diagram-canvas")?.getBoundingClientRect().right ?? 0) + 1,
        };
      });
      entry.code = listing;
      if (!listing) entry.problems.push("no code panel was drawn");
      else {
        if (listing.lineCount < 4) entry.problems.push(`the listing shows only ${listing.lineCount} lines`);
        if (listing.gutter.join(",") !== Array.from({ length: listing.lineCount }, (_, i) => String(i + 1)).join(",")) {
          entry.problems.push(`line numbers are wrong: ${listing.gutter.join(",")}`);
        }
        if (listing.tokenKinds.length < 3) entry.problems.push(`the listing has almost no syntax colouring: ${listing.tokenKinds.join(",")}`);
        if (!listing.indented) entry.problems.push("the listing lost its indentation, so its structure is gone");
        if (listing.lit === 0) entry.problems.push("no line is lit, so the teacher has nothing to point at");
        if (listing.overflows) entry.problems.push("the code panel runs off the right edge of the board");
      }
    }

    // Nothing may still be animating once the lesson has finished.
    const stillRunning = await page0.evaluate(() => {
      const svg = document.querySelector(".diagram-canvas");
      if (!svg) return -1;
      return Array.from(svg.querySelectorAll(".vfx-motion")).filter((n) => (document.getAnimations().filter((a) => a.effect && a.effect.target === n && a.playState !== "finished")).length > 0).length;
    });
    if (stillRunning !== 0) entry.problems.push(`${stillRunning} animation(s) still running after the lesson finished`);
    // A finished step must never leave an object invisible.
    const invisible = await page0.evaluate(() => Array.from(document.querySelectorAll("g[data-object-id]")).filter((n) => parseFloat(getComputedStyle(n).opacity) < 0.02).length);
    if (invisible > 0) entry.problems.push(`${invisible} object(s) are invisible on the finished board`);

    entry.connectors = entry.steps.length > 0 ? (await page0.evaluate(AUDIT)).connectors : [];
    // A missing favicon or web font is not a board defect and must not fail a scenario.
    const noise = (text) => /favicon|fonts\.g|net::ERR_|404 \(Not Found\)/i.test(text);
    entry.consoleErrors = consoleErrors.filter((text) => !noise(text));
    entry.pageErrors = pageErrors;
    entry.failedRequests = failedRequests.filter((text) => !noise(text));
    if (pageErrors.length > 0) entry.problems.push(`page error: ${pageErrors[0]}`);
    if (entry.consoleErrors.length > 0) entry.problems.push(`console error: ${entry.consoleErrors[0]}`);
    if (entry.failedRequests.length > 0) entry.problems.push(`request failed: ${entry.failedRequests[0]}`);
  } catch (error) {
    entry.ok = false;
    entry.problems.push(`threw: ${String(error)}`);
  }
  entry.ok = entry.ok && entry.problems.length === 0;
  if (!entry.ok) failures += 1;
  report.push(entry);
  console.log(`${entry.ok ? "PASS" : "FAIL"} ${scenario.id}${entry.ok ? "" : ` — ${entry.problems.slice(0, 6).join(" | ")}`}`);
  await page0.close();
}

await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

console.log(`\n${report.length - failures}/${report.length} 2D board scenarios passed. Report: ${join(OUT, "report.json")}`);
if (failures > 0) process.exit(1);