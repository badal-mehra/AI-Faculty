// BROWSER ACCEPTANCE RUN — verifies the generalized 3D pipeline in a real Chrome instance.
//
// For every required domain it drives the REAL classroom UI: types a question, waits for the lesson,
// checks that a WebGL canvas exists, that the expected models were actually fetched (no silent
// primitive fallback), that labels/particles are on screen, that the camera framed the scene, and
// that the console/network stayed clean. Screenshots and a JSON report are written to
// .verify/ for the report.
//
//   node scripts/verify-browser.mjs                 # all scenarios, dev server on :3001
//   node scripts/verify-browser.mjs heart solar     # only these
//   BASE=http://localhost:3000 node scripts/verify-browser.mjs
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const CHROME = process.env.CHROME ?? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = ".verify";

const SCENARIOS = [
  { id: "heart", question: "How does the human heart pump blood?", expect: { models: ["biology/heart"], labels: 1, flows: 1, family: "3d", isolatePart: "left_ventricle" } },
  { id: "brain", question: "Teach me the parts of the human brain and what each does.", expect: { models: ["biology/brain"], labels: 1, family: "3d" } },
  { id: "lungs", question: "How do the lungs and trachea bring oxygen into the body?", expect: { models: ["biology/lungs"], labels: 1, family: "3d" } },
  { id: "cell", question: "What organelles are inside an animal cell?", expect: { models: ["biology/cell"], labels: 1, family: "3d" } },
  { id: "photosynthesis", question: "How does photosynthesis work inside a leaf?", expect: { models: ["biology/leaf"], labels: 1, flows: 1, family: "3d" } },
  { id: "pendulum", question: "Explain the period of a simple pendulum", expect: { models: [], labels: 1, orbits: 2, family: "3d" } },
  { id: "tcp", question: "What is the TCP three way handshake?", expect: { models: ["network/laptop", "network/server", "network/router"], labels: 1, flows: 1, family: "3d" } },
  { id: "atom", question: "Describe the structure of an atom and its electron shells", expect: { models: [], labels: 1, orbits: 3, family: "3d" } },
  { id: "solar-system", question: "Show me the solar system and how planets orbit the sun", expect: { models: ["astronomy/sun"], labels: 1, orbits: 5, family: "3d" } },
  { id: "cylinder-volume", question: "What is the volume of a cylinder?", expect: { models: ["mathematics/cylinder"], labels: 1, family: "3d" } },
  { id: "bst", question: "Insert values into a binary search tree", expect: { models: [], graphNodes: 2, family: "graph" } },
];

// LIVE SCENARIOS — no `?scenario=` override, so these questions reach the REAL providers and
// whatever 2D/graph representation the teacher actually produces is what gets verified. The
// visual text audit below is what judges them, so a provider is never trusted to be "correct".
const LIVE_SCENARIOS = [
  { id: "array", question: "Draw an array of four cells holding 10, 20, 30 and 40, with each index written next to its cell.", followUp: "Now insert 50 at index 4 and show it as a fifth cell at the end.", live: true, expect: { family: "live" } },
  { id: "stack", question: "Draw a stack with 10, 20 and 30 in separate boxes, one on top of the other, marking where push and pop happen.", followUp: "Now move the box holding 30 out to the side, and keep its label attached to it.", live: true, expect: { family: "live" } },
  { id: "linked-list", question: "Draw a singly linked list 10, 20, 30 where every node holds a value and points at the next one.", followUp: "Now move the node holding 30 to the far right of the board, keeping its value inside the node.", live: true, expect: { family: "live" } },
  { id: "queue", question: "Draw a queue holding 1, 2, 3 with the front and the rear marked, and showing where enqueue and dequeue happen.", live: true, expect: { family: "live" } },
  { id: "graph", question: "Draw a graph with vertices A, B, C, D and E and the edges A-B, B-C, C-D, A-E.", followUp: "Now move the vertex labelled C down to the bottom of the board, keeping its letter inside the node.", live: true, expect: { family: "live" } },
  { id: "two-d-topic", question: "Why does the sky look blue during the day? Show it as a diagram.", live: true, expect: { family: "live" } },
];

const ALL_SCENARIOS = [...SCENARIOS, ...LIVE_SCENARIOS];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// VISUAL TEXT AUDIT — runs INSIDE the real page and reads the geometry the browser actually
// painted, so it judges the same pixels a screenshot shows. It reports, per step:
//   * every painted text (content, box, font size) and the board/node geometry around it,
//   * objective defects: text with no box, text clipped by the board, oversized text, the
//     teacher's spoken explanation leaking onto the board as board text, text overlapping other
//     text, an "inside" label that is not inside its object, and an anchored label that is no
//     longer sitting at its target's anchor slot.
// It never judges "looks right": that judgement comes from the screenshots in the report.
const AUDIT_TEXT = () => {
  const result = { board: null, nodes: [], texts: [], violations: [] };
  const speechNode = document.querySelector(".speech-card");
  const speech = speechNode ? (speechNode.textContent ?? "").trim() : "";
  const svg = document.querySelector(".board-canvas");
  if (!svg) return result;
  const board = svg.getBoundingClientRect();
  const box = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : { width: board.width, height: board.height };
  // preserveAspectRatio defaults to "xMidYMid meet", so the drawing can be letterboxed inside the
  // element: the mapping from board units to screen pixels is not simply board.width / box.width.
  const scale = Math.min(board.width / box.width, board.height / box.height);
  const originX = board.x + (board.width - box.width * scale) / 2;
  const originY = board.y + (board.height - box.height * scale) / 2;
  const isDiagram = svg.classList.contains("diagram-canvas");
  result.board = { isDiagram, scale, originX, originY, unitWidth: box.width, unitHeight: box.height };

  const rectOf = (node) => {
    const r = node.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, cy: r.y + r.height / 2 };
  };

  const nodes = Array.from(svg.querySelectorAll(".board-node .node-circle")).map((node) => {
    const r = rectOf(node);
    return { cx: r.cx, cy: r.cy, r: r.w / 2 };
  });
  result.nodes = nodes;

  // The generalized diagram renderer paints `g[data-object-id]` groups (shapes, text, connections), so
  // the audit reads those rather than the older per-class groups. Every measurement is still taken from
  // the painted rectangle, which is what a screenshot shows.
  const items = [];
  if (isDiagram) {
    Array.from(svg.querySelectorAll('g[data-object-id][data-kind="shape"]')).forEach((group, index) => {
      const label = group.querySelector(".diagram-shape-label");
      const shape = group.querySelector("path.diagram-shape");
      items.push({ kind: "shape-label", key: `${group.getAttribute("data-object-id") || `shape${index}`}`, el: label, host: shape, content: label ? (label.textContent ?? "") : "" });
    });
    Array.from(svg.querySelectorAll('g[data-object-id][data-kind="container"]')).forEach((group, index) => {
      const frame = group.querySelector(".diagram-frame");
      items.push({ kind: "frame", key: group.getAttribute("data-object-id") || `frame${index}`, el: frame, host: null, content: "" });
    });
    Array.from(svg.querySelectorAll('g[data-object-id][data-kind="text"], g[data-object-id][data-kind="label"], g[data-object-id][data-kind="icon"]')).forEach((group, index) => {
      const el = group.querySelector(".diagram-text, .diagram-label, .diagram-icon");
      items.push({ kind: "free-label", key: group.getAttribute("data-object-id") || `free${index}`, el, host: null, content: el ? (el.textContent ?? "") : "" });
    });
    Array.from(svg.querySelectorAll(".diagram-edge-label")).forEach((el, index) => {
      items.push({ kind: "edge-label", key: `edge${index}`, el, host: null, content: el.textContent ?? "" });
    });
  } else {
    Array.from(svg.querySelectorAll(".board-node")).forEach((group, index) => {
      items.push({ kind: "node-label", key: `node${index}`, el: group.querySelector(".node-label"), host: group.querySelector(".node-circle"), content: group.querySelector(".node-label") ? (group.querySelector(".node-label").textContent ?? "") : "" });
    });
    Array.from(svg.querySelectorAll(".board-text")).forEach((el, index) => {
      items.push({ kind: "board-text", key: `text${index}`, el, host: null, content: el.textContent ?? "" });
    });
  }

  const painted = [];
  for (const item of items) {
    if (!item.el) continue;
    const content = item.content.trim();
    const box2 = rectOf(item.el);
    const style = getComputedStyle(item.el);
    const fontSize = parseFloat(style.fontSize) || 0;
    // An object that is deliberately animated away (vfx-disappear) is allowed to be invisible.
    const animatedAway = Boolean(item.el.closest(".vfx-disappear")) || (parseFloat(style.opacity) < 0.05);
    painted.push({ ...item, rect: box2, fontSize, animatedAway });
  }
  result.texts = painted.map((item) => ({ kind: item.kind, key: item.key, content: item.content, cx: item.rect.cx, cy: item.rect.cy, w: item.rect.w, h: item.rect.h, fontSize: item.fontSize }));

  const violations = result.violations;
  const TOL = 1.5;
  const name = (item) => `"${item.content.length > 34 ? `${item.content.slice(0, 34)}...` : item.content}"`;

  for (const item of painted) {
    if (item.content.length === 0 || item.animatedAway) continue;
    const r = item.rect;
    if (r.w < 1 || r.h < 1) violations.push(`${item.kind} ${name(item)} has no visible box`);
    const outside = r.x < board.x + TOL || r.y < board.y + TOL || r.x + r.w > board.x + board.width - TOL || r.y + r.h > board.y + board.height - TOL;
    if (outside) violations.push(`${item.kind} ${name(item)} is clipped by the board edge`);
    if (item.fontSize > 40) violations.push(`${item.kind} ${name(item)} is drawn at ${item.fontSize.toFixed(0)}px`);
    if (item.content.length > 90) violations.push(`${item.kind} ${name(item)} is a ${item.content.length}-character block of text on the board`);
    if (speech.length > 0 && item.content.length >= 30 && speech.includes(item.content.slice(0, 30))) violations.push(`the spoken explanation was drawn on the board as ${item.kind} ${name(item)}`);
    // "inside" labels are painted as children of their object, so leaving the object's box is a
    // real text/object overlap.
    if (item.host) {
      const h = rectOf(item.host);
      if (r.x < h.x - TOL || r.y < h.y - TOL || r.x + r.w > h.x + h.w + TOL || r.y + r.h > h.y + h.h + TOL) violations.push(`${item.kind} ${name(item)} sticks out of the object it belongs to`);
    }
  }

  // Text over text.
  for (let i = 0; i < painted.length; i += 1) {
    for (let j = i + 1; j < painted.length; j += 1) {
      const a = painted[i];
      const b = painted[j];
      if (a.content.length === 0 || b.content.length === 0 || a.animatedAway || b.animatedAway) continue;
      const overlapX = Math.min(a.rect.x + a.rect.w, b.rect.x + b.rect.w) - Math.max(a.rect.x, b.rect.x);
      const overlapY = Math.min(a.rect.y + a.rect.h, b.rect.y + b.rect.h) - Math.max(a.rect.y, b.rect.y);
      if (overlapX > 1 && overlapY > 1) violations.push(`${a.kind} ${name(a)} overlaps ${b.kind} ${name(b)} (${Math.round(overlapX)}x${Math.round(overlapY)}px)`);
    }
  }

  // Text over a board object. A circle is measured against its own geometry, not its bounding box,
  // so a label beside a node is not reported merely for being near it.
  const circleGap = (rect, circle) => {
    const dx = Math.max(rect.x - circle.cx, circle.cx - (rect.x + rect.w), 0);
    const dy = Math.max(rect.y - circle.cy, circle.cy - (rect.y + rect.h), 0);
    return Math.hypot(dx, dy) - circle.r;
  };
  for (const item of painted) {
    if (item.content.length === 0 || item.animatedAway || item.kind === "node-label") continue;
    for (let n = 0; n < nodes.length; n += 1) {
      const gap = circleGap(item.rect, nodes[n]);
      if (gap < -1) violations.push(`${item.kind} ${name(item)} overlaps node ${n}`);
    }
  }

  // Anchored board text must sit beside its target on the side the anchor names, fully on the board.
  // The board places a label a fixed distance from the node centre and then clamps the label so its
  // whole box stays inside the margin, so a label next to a node near the edge is further out, not
  // detached. The expected position is computed from the label's OWN measured box.
  const slots = ["center", "above", "below", "left", "right"];
  const BOARD_MARGIN = 16;
  const ANCHOR_DISTANCE = 53;
  // The viewBox origin is not necessarily zero (the diagram renderer frames its own content), so a user
  // unit maps to screen via (u - box.x).
  const toScreenX = (units) => originX + (units - box.x) * scale;
  const toScreenY = (units) => originY + (units - box.y) * scale;
  for (const item of painted) {
    if (item.kind !== "board-text" || item.animatedAway) continue;
    const halfWidth = item.rect.w / 2 / scale;
    const halfHeight = item.rect.h / 2 / scale;
    const fitX = (units) => Math.max(BOARD_MARGIN + halfWidth, Math.min(box.width - BOARD_MARGIN - halfWidth, units));
    const fitY = (units) => Math.max(BOARD_MARGIN + halfHeight, Math.min(box.height - BOARD_MARGIN - halfHeight, units));
    let best = Infinity;
    let bestNode = -1;
    let bestSlot = "";
    nodes.forEach((node, index) => {
      const nu = (node.cx - originX) / scale;
      const nv = (node.cy - originY) / scale;
      const candidates = [
        ["center", nu, nv],
        ["above", nu, nv - ANCHOR_DISTANCE],
        ["below", nu, nv + ANCHOR_DISTANCE],
        ["left", nu - ANCHOR_DISTANCE, nv],
        ["right", nu + ANCHOR_DISTANCE, nv],
      ];
      candidates.forEach(([slot, u, v]) => {
        const deviation = Math.hypot(item.rect.cx - toScreenX(fitX(u)), item.rect.cy - toScreenY(fitY(v)));
        if (deviation < best) { best = deviation; bestNode = index; bestSlot = slot; }
      });
    });
    const attached = best <= 6;
    const nearestNode = nodes.reduce((acc, node) => Math.min(acc, circleGap(item.rect, node)), Infinity);
    result.texts.find((entry) => entry.key === item.key).attached = attached ? { node: bestNode, slot: bestSlot, deviation: best } : null;
    result.texts.find((entry) => entry.key === item.key).nearestNodeGap = nearestNode;
    if (!attached && best <= 40) violations.push(`${item.kind} ${name(item)} sits ${Math.round(best)}px from an anchor slot, so it has drifted off its object`);
  }

  return result;
};
// The heart is the multi-part model the generic inspection lesson runs on; these are its real node names.
const HEART_PART = /^(left_ventricle|right_ventricle|left_atrium|right_atrium|septum|aorta|pulmonary_artery|vena_cava|pulmonary_vein|mitral_valve|tricuspid_valve)$/;
const only = process.argv.slice(2).filter((value) => ALL_SCENARIOS.some((scenario) => scenario.id === value));
const targets = only.length > 0 ? ALL_SCENARIOS.filter((scenario) => only.includes(scenario.id)) : ALL_SCENARIOS;

if (!existsSync(CHROME)) {
  console.error(`Chrome not found at ${CHROME}. Set CHROME to your Chrome/Edge executable.`);
  process.exit(2);
}
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "new",
  // A real GPU is used when available; SwiftShader is the fallback for machines without one.
  args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=default", "--window-size=1440,900"],
});

const report = [];

async function runScenario(browser, scenario) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });

  const consoleErrors = [];
  const pageErrors = [];
  const models = new Set();
  const failedRequests = [];
  const webgl = { context: false, renderer: "" };

  page.on("console", (message) => {
    const text = message.text();
    // The browser always asks for /favicon.ico; that 404 is not an application error.
    if (text.includes("favicon.ico") || (message.location()?.url ?? "").includes("favicon.ico")) return;
    if (message.type() === "error") consoleErrors.push(text);
    if (text.startsWith("[3D asset]") && text.includes("failed to load")) consoleErrors.push(text);
  });
  page.on("pageerror", (error) => pageErrors.push(String(error)));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`));
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("favicon.ico")) return;
    if (response.status() >= 400) failedRequests.push(`${url} :: HTTP ${response.status()}`);
    if (url.includes("/models/") && url.endsWith(".glb")) {
      if (response.ok()) models.add(url.split("/models/")[1].replace(".glb", ""));
    }
  });

  const result = { id: scenario.id, question: scenario.question, expect: scenario.expect, steps: [] };

  // Deterministic scenarios are opt-in on the lesson endpoint, so the acceptance run asks for one
  // explicitly and still drives the real UI, validation, engines and renderers. Live scenarios are
  // left untouched on purpose: they must reach the real providers.
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (!scenario.live && request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}${request.url().includes("?") ? "&" : "?"}scenario=${scenario.id}` });
      return;
    }
    request.continue();
  });

  try {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });

    // Start a lesson with the scenario question through the UI itself.
    const textarea = await page.$("#lesson-question");
    // A missing input means the app never rendered — almost always because the server died or a
    // `next build` replaced `.next` underneath a running dev server. Saying so once is worth far more
    // than the same error repeated for every remaining scenario.
    if (!textarea) {
      const body = await page.evaluate(() => document.body?.innerText?.slice(0, 200) ?? "");
      throw new Error(`question input #lesson-question not found (page said: ${body.replace(/\s+/g, " ").trim() || "nothing"})`);
    }
    await textarea.type(scenario.question, { delay: 4 });
    await page.click("button.primary-action");

    // A real provider can take a while to answer, so a live scenario waits for the first painted
    // board/diagram instead of screenshotting an empty classroom.
    if (scenario.live) {
      const deadline = Date.now() + 90000;
      for (;;) {
        const painted = await page.evaluate(() => document.querySelectorAll(".diagram-canvas g[data-object-id], .board-canvas .board-node, .scene3d-wrap canvas").length);
        if (painted > 0 || Date.now() > deadline) break;
        await sleep(1000);
      }
    }

    // Wait for the classroom to actually paint before the first capture. The very first scenario of
    // a run also pays for compiling the lazy 3D bundle, and a live provider can take a minute, so a
    // fixed pause would screenshot an empty classroom and report a rendering failure that is only
    // latency. Bounded, so a classroom that never paints is still captured and fails.
    const paintSelector = scenario.expect.family === "3d"
      ? ".scene3d-wrap canvas"
      : scenario.live
        ? ".board-node, .diagram-canvas g[data-object-id], .scene3d-wrap canvas"
        : ".board-node, .diagram-canvas g[data-object-id]";
    const paintDeadline = Date.now() + 90000;
    for (;;) {
      if (await page.evaluate((selector) => document.querySelectorAll(selector).length > 0, paintSelector)) break;
      if (Date.now() > paintDeadline) break;
      await sleep(1000);
    }

    // Read one painted state: the DOM the browser produced, the geometry it laid text out with, and
    // the screenshot of exactly that state.
    const captureStep = async (index) => {
      const state = await page.evaluate(() => {
        const canvas = document.querySelector(".scene3d-wrap canvas");
        const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
        const wrap = document.querySelector(".scene3d-wrap");
        const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
        // Whether each label is fully inside the stage. A label pushed to the viewport edge and cut in
        // half is unreadable, and "labels rendered" counts it as a pass.
        const labels = Array.from(document.querySelectorAll(".scene-label")).map((node) => {
          const rect = node.getBoundingClientRect();
          const clipped = Boolean(wrapRect) && (
            rect.left < wrapRect.left - 0.5 || rect.top < wrapRect.top - 0.5
            || rect.right > wrapRect.right + 0.5 || rect.bottom > wrapRect.bottom + 0.5
          );
          return { text: node.textContent ?? "", clipped };
        });
        const graphNodes = document.querySelectorAll(".board-node").length;
        const diagramObjects = document.querySelectorAll(".diagram-canvas *").length;
        const hud = Array.from(document.querySelectorAll(".scene3d-hud span")).map((node) => node.textContent ?? "");
        return {
          has3D: Boolean(canvas),
          canvasSize: canvas ? { width: canvas.clientWidth, height: canvas.clientHeight } : null,
          glContext: Boolean(gl),
          labels,
          labelCount: labels.length,
          graphNodes,
          diagramObjects,
          hud,
          fit: window.__visual3dFit ?? null,
          graph: window.__visual3dGraph ?? null,
          health: window.__visual3dHealth ?? null,
          loading: Boolean(document.querySelector('[data-testid="visual3d-loading"]')),
        };
      });
      const cameraPresent = await page.evaluate(() => Boolean(document.querySelector(".scene3d-wrap")));
      // The geometry the browser really painted, so the text checks read the same pixels the
      // screenshot of this step shows.
      const visual = await page.evaluate(AUDIT_TEXT);
      const shot = join(OUT, `${scenario.id}-step${index}.png`);
      await page.screenshot({ path: shot });
      const entry = { step: index, ...state, visual, screenshot: shot, cameraPresent };
      result.steps.push(entry);
      return entry;
    };

    // Step through the whole batch of lesson steps. The bound is generous on purpose: a lesson that
    // inspects a model (explode -> isolate -> measure) needs several steps before the interesting
    // state is on screen, and a truncated run would report PASS without ever reaching it.
    for (let step = 0; step < 10; step += 1) {
      await sleep(2600);
      // The 3D loader is a real state, but it is not the state under test: wait for it to clear so
      // the screenshot shows the finished scene. Bounded, so a stuck loader still fails the check.
      const settleDeadline = Date.now() + 30000;
      for (;;) {
        const busy = await page.evaluate(() => Boolean(document.querySelector('[data-testid="visual3d-loading"]')));
        if (!busy || Date.now() > settleDeadline) break;
        await sleep(500);
      }
      const state = await captureStep(step + 1);
      if (step === 0) Object.assign(webgl, { context: state.glContext });

      // Advance the lesson through the real UI: continuous playback only advances when the
      // teacher audio ends, which never happens in a headless browser, so we stop and continue.
      const advanced = await page.evaluate(() => {
        const stop = document.querySelector("button.stop-action");
        if (stop && !(stop).disabled) stop.click();
        return Boolean(stop);
      });
      if (!advanced) break;
      // Stop reveals the Continue control, but a live provider keeps React busy for a moment, so the
      // control is polled instead of assumed: a fixed pause would re-screenshot the same step and
      // stop the run before the drawing ever reached the screen.
      let continued = false;
      for (let wait = 0; wait < 25 && !continued; wait += 1) {
        continued = await page.evaluate(() => {
          const next = document.querySelector("button.continue-action");
          if (next && !(next).disabled) { next.click(); return true; }
          return false;
        });
        if (!continued) await sleep(300);
      }
      if (!continued) break;
    }

    // A follow-up question is a real user path that redraws ON TOP of the finished lesson, so the
    // changed state (and any move the teacher makes) is verified too.
    if (scenario.followUp && result.steps.length > 0) {
      const asked = await page.evaluate((question) => {
        const input = document.querySelector("#student-question");
        const button = document.querySelector(".ask-card button");
        if (!input || !button) return false;
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        setter.call(input, question);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        button.click();
        return true;
      }, scenario.followUp);
      if (asked) {
        const deadline = Date.now() + 90000;
        for (;;) {
          const busy = await page.evaluate(() => Boolean(document.querySelector(".teaching-loading")) || Boolean(document.querySelector(".ask-card button[disabled]")));
          if (!busy || Date.now() > deadline) break;
          await sleep(1000);
        }
        await sleep(1800);
        await captureStep(result.steps.length + 1);
      }
    }

    const final = result.steps[result.steps.length - 1] ?? {};
    const any3D = result.steps.some((entry) => entry.has3D);
    const allLabels = result.steps.flatMap((entry) => entry.labels ?? []);
    const hudAll = result.steps.flatMap((entry) => entry.hud ?? []);
    const maxGraphNodes = Math.max(0, ...result.steps.map((entry) => entry.graphNodes ?? 0));
    const usedModels = Array.from(models);
    result.usedModels = usedModels;
    result.consoleErrors = consoleErrors;
    result.pageErrors = pageErrors;
    result.failedRequests = failedRequests;

    const checks = [];
    const add = (name, pass, detail = "") => checks.push({ name, pass, detail });

    // The steps whose board/diagram really carries text: everything below reads these.
    const paintedSteps = result.steps.map((entry) => entry.visual).filter((visual) => visual && visual.board && visual.texts.some((text) => text.content.trim().length > 0));

    if (scenario.expect.family === "3d") {
      add("WebGL canvas is present", any3D === true);
      add("canvas has a real drawing buffer", (final.canvasSize?.width ?? 0) > 200 && (final.canvasSize?.height ?? 0) > 200, JSON.stringify(final.canvasSize));
      add("WebGL context is live", final.glContext === true);
      for (const model of scenario.expect.models) add(`model fetched: ${model}`, usedModels.includes(model), usedModels.join(", "));
      // ---- "never blank" acceptance: a visible, bounded mesh with no failed loads and no stuck loader.
      const healths = result.steps.map((entry) => entry.health).filter(Boolean);
      const bestHealth = healths.find((health) => health.visibleMeshes > 0 && health.hasBounds) ?? healths[healths.length - 1];
      add("the scene reports visible geometry with finite, non-zero bounds", Boolean(bestHealth && bestHealth.visibleMeshes > 0 && bestHealth.hasBounds === true && bestHealth.radius > 1e-4), JSON.stringify(bestHealth));
      add("the scene is not stuck loading", result.steps.every((entry) => entry.loading !== true), `final loading=${final.loading}`);
      if (scenario.expect.models.length > 0) {
        add("every requested model resolved (loaded or fell back, never pending)", Boolean(bestHealth && bestHealth.pending === 0), JSON.stringify(bestHealth));
        add("no model silently fell back to a primitive", Boolean(bestHealth && bestHealth.failed === 0), JSON.stringify(bestHealth));
      }
      add("labels rendered", allLabels.length >= (scenario.expect.labels ?? 1), allLabels.map((label) => label.text).join(" | "));
      if (scenario.expect.flows) add("diagnostics HUD reports flows", hudAll.some((entry) => /[1-9]\d* flows/.test(entry)), hudAll.join(" | "));
      add("diagnostics HUD reports objects", hudAll.some((entry) => /objects/.test(entry)), hudAll.join(" | "));
      add("lesson advanced through multiple steps", result.steps.length >= 2, `${result.steps.length} steps`);

      // ---- READABILITY OF WHAT WAS ACTUALLY DRAWN.
      // Three.js's default material is an UNLIT PURE WHITE basic material. Any procedural primitive
      // whose material never reached its mesh therefore renders as a white blob: correct size, correct
      // position, colour ignored. Asking the AI for a red electron shell and getting a white sphere is
      // invisible to every other check, so the live material state is asserted directly.
      const materials = result.steps.flatMap((entry) => (entry.graph?.materials ?? []).map((material) => material));
      const defaultMaterial = materials.filter((material) => material.material === "MeshBasicMaterial" && material.color === "ffffff");
      add("no primitive renders with Three.js's default white material", defaultMaterial.length === 0,
        defaultMaterial.length ? `${defaultMaterial.length} mesh(es): ${Array.from(new Set(defaultMaterial.map((m) => m.mesh))).join(", ")}` : `${materials.length} materials inspected`);

      // Measured framing, not the requested fill. `fit.fill` is the number the camera ASKED for and is
      // 0.7 for every scene that ever worked; the number that matters is how much of the viewport the
      // content actually occupies once projected.
      const measured = result.steps
        .map((entry) => (entry.graph?.geometry?.offCameraCorners === 0 ? entry.graph?.geometry?.screenBox : null))
        .filter((box) => box && Number.isFinite(box.width) && box.width > 0);
      const fillsMeasured = measured.map((box) => Math.max(box.width, box.height) / 2);
      add("the framed content fills a usable share of the viewport (not a speck, not a wall)",
        fillsMeasured.some((value) => value >= 0.45 && value <= 1.25),
        fillsMeasured.map((value) => `${Math.round(value * 100)}%`).join(", "));

      // A label that runs off the edge of the canvas is a label the student cannot read.
      const clipped = result.steps.flatMap((entry) => (entry.labels ?? []).filter((label) => label.clipped === true));
      add("no 3D label is clipped by the canvas edge", clipped.length === 0,
        clipped.map((label) => `${label.text ?? ""}@${label.side ?? ""}`).join(", "));
      const fit = result.steps.map((entry) => entry.fit).filter(Boolean).pop();
      add("framed camera is a real perspective rig", Boolean(fit && fit.near > 0 && fit.far > fit.near && fit.distance > 0), JSON.stringify(fit && { near: fit.near, far: fit.far, distance: fit.distance }));

      // Node-level proof that the generic inspection actions reached the real scene graph. The engine
      // can hold "isolate this part" in its state while the renderer shows an untouched model, so these
      // read the live THREE hierarchy: a semantic part is a NAMED node, and hiding/moving it must be
      // observable there rather than only in engine state.
      const graphs = result.steps.map((entry) => entry.graph).filter(Boolean);
      if (scenario.expect.isolatePart) {
        const part = scenario.expect.isolatePart;
        // The step where the part is isolated shows exactly that one heart node; an earlier step shows
        // every part. Comparing the two proves isolation happened in the renderer, not just the state.
        const before = graphs.find((graph) => graph.parts.filter((entry) => HEART_PART.test(entry.name)).length > 3);
        const isolated = graphs.find((graph) => {
          const parts = graph.parts.filter((entry) => HEART_PART.test(entry.name));
          return parts.length > 3 && parts.every((entry) => entry.visible === (entry.name === part));
        });
        const allVisibleBefore = before?.parts.filter((entry) => HEART_PART.test(entry.name)).every((entry) => entry.visible) === true;
        add("every named heart part exists as a real node in the scene graph", Boolean(before), `names: ${graphs[graphs.length - 1]?.parts.map((entry) => entry.name).join(",")}`);
        add("all parts are visible before isolating", allVisibleBefore);
        const isolatedParts = isolated?.parts.filter((entry) => HEART_PART.test(entry.name)) ?? [];
        add(`isolate_part leaves only "${part}" visible in the renderer`, isolatedParts.length > 3 && isolatedParts.filter((entry) => entry.visible).length === 1 && isolatedParts.find((entry) => entry.visible)?.name === part, `visible: ${isolatedParts.filter((entry) => entry.visible).map((entry) => entry.name).join(",") || "none"}`);
        const restored = [...graphs].reverse().find((graph) => graph.parts.filter((entry) => HEART_PART.test(entry.name)).every((entry) => entry.visible) && graph.parts.filter((entry) => HEART_PART.test(entry.name)).length > 3);
        add("restore_parts brings every part back", Boolean(restored));
        // Explode must actually displace geometry: several distinct part positions, not one shared origin.
        const spread = Math.max(0, ...graphs.map((graph) => {
          const parts = graph.parts.filter((entry) => HEART_PART.test(entry.name));
          if (parts.length < 3) return 0;
          const xs = parts.map((entry) => entry.x), ys = parts.map((entry) => entry.y), zs = parts.map((entry) => entry.z);
          return Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), Math.max(...zs) - Math.min(...zs));
        }));
        add("explode_group really moves named parts apart in the scene graph", spread > 0.5, `largest part spread = ${spread.toFixed(2)}`);
      }
    } else if (scenario.expect.family === "live") {
      // A live provider decides what to draw, so the run only asserts that SOMETHING real was
      // painted, with text on it, and that it advanced. Whether the picture is good is judged from
      // the screenshots and by the text audit below.
      const paintedElements = Math.max(0, ...result.steps.map((entry) => Math.max(entry.diagramObjects ?? 0, (entry.visual?.texts?.length ?? 0))));
      const visibleTexts = (paintedSteps[paintedSteps.length - 1]?.texts ?? []).filter((entry) => entry.content.trim().length > 0);
      // Which representation the teacher chose. For a DETERMINISTIC scenario this is the fixture's promise.
// For a LIVE one the provider decides, so a lesson that opened on the 3D stage is as correct as one
// that opened on the 2D board — asserting "2D" for a live question about a real object was reporting
// the teacher's representation choice as a defect.
const drewIn3D = result.steps.some((entry) => entry.has3D || (entry.hud ?? []).some((text) => /\d+ objects/.test(text)));
      const paintedSomething = maxGraphNodes > 0 || paintedElements > 0 || drewIn3D;
      add(scenario.live ? "the teacher painted a real representation (2D, 3D or graph)" : "the teacher painted a real 2D/graph representation",
        paintedSomething,
        `graph nodes=${maxGraphNodes}, painted board/diagram elements=${paintedElements}, 3d=${drewIn3D}`);
      if (scenario.live && !paintedSomething) {
        add("text with content is actually on screen", visibleTexts.length >= 1, `${visibleTexts.length}: ${visibleTexts.slice(0, 8).map((entry) => entry.content).join(" / ")}`);
      }
      // A provider may answer in one step, so the number of steps is not asserted; the run must
      // simply have produced a real state and, when a follow-up was asked, a second one.
      add("the lesson produced at least one painted state", result.steps.length >= 1, `${result.steps.length} steps`);
      if (scenario.followUp) add("the follow-up question produced a second painted state", result.steps.length >= 2, `${result.steps.length} steps`);
    } else {
      add("graph nodes rendered", maxGraphNodes >= (scenario.expect.graphNodes ?? 1), `max ${maxGraphNodes}`);
      add("lesson advanced through multiple steps", result.steps.length >= 2, `${result.steps.length} steps`);
    }

    // ---- VISUAL TEXT AUDIT: the geometry the browser actually painted, step by step.
    const violations = [...new Set(paintedSteps.flatMap((visual) => visual.violations))];
    const matched = (pattern) => violations.filter((entry) => pattern.test(entry));
    result.visual = {
      stepsWithText: paintedSteps.length,
      texts: paintedSteps[paintedSteps.length - 1]?.texts ?? [],
      violations,
    };
    if (paintedSteps.length > 0) {
      add("every painted text has content and a real box", matched(/no visible box/).length === 0, matched(/no visible box/).slice(0, 4).join(" | "));
      add("no text is clipped by the board edge", matched(/clipped by the board/).length === 0, matched(/clipped by the board/).slice(0, 4).join(" | "));
      add("no text overlaps other text", matched(/overlaps (text|board-text|node-label|shape-label|free-label)/).length === 0, matched(/overlaps (text|board-text|node-label|shape-label|free-label)/).slice(0, 4).join(" | "));
      add("no text overlaps a board object it does not belong to", matched(/overlaps node \d/).length === 0, matched(/overlaps node \d/).slice(0, 4).join(" | "));
      add("inside labels stay inside their object", matched(/sticks out of the object/).length === 0, matched(/sticks out of the object/).slice(0, 4).join(" | "));
      add("anchored labels sit at their object's anchor slot", matched(/drifted off/).length === 0, matched(/drifted off/).slice(0, 4).join(" | "));
      add("the teacher's spoken explanation is never drawn as board text", matched(/spoken explanation/).length === 0, matched(/spoken explanation/).slice(0, 4).join(" | "));
      add("no board text is oversized or a block of prose", matched(/drawn at \d+px|character block of text/).length === 0, matched(/drawn at \d+px|character block of text/).slice(0, 4).join(" | "));

      // Moving an object must carry its text with it. Two things are compared across two steps: a label
      // anchored to the object (a board text) and the value drawn inside the object itself. Both node
      // sets must match, otherwise DOM order no longer identifies the same object and the comparison
      // proves nothing.
      const moves = [];
      for (let i = 1; i < paintedSteps.length; i += 1) {
        const before = paintedSteps[i - 1];
        const after = paintedSteps[i];
        if (before.nodes.length !== after.nodes.length) continue;
        const record = (label, beforeText, afterText, nodeDelta) => {
          const textDelta = Math.hypot(afterText.cx - beforeText.cx, afterText.cy - beforeText.cy);
          moves.push({ text: label, nodeMoved: Math.round(nodeDelta), textMoved: Math.round(textDelta), drift: Math.round(Math.abs(textDelta - nodeDelta)) });
        };
        for (let n = 0; n < after.nodes.length; n += 1) {
          const beforeNode = before.nodes[n];
          const afterNode = after.nodes[n];
          const nodeDelta = Math.hypot(afterNode.cx - beforeNode.cx, afterNode.cy - beforeNode.cy);
          if (nodeDelta < 3) continue;
          const beforeInside = before.texts.find((entry) => entry.kind === "node-label" && entry.key === `node${n}`);
          const afterInside = after.texts.find((entry) => entry.kind === "node-label" && entry.key === `node${n}`);
          if (beforeInside && afterInside) record(`value in node ${n} (${afterInside.content})`, beforeInside, afterInside, nodeDelta);
          for (const text of after.texts) {
            if (text.kind !== "board-text" || !text.attached || text.attached.node !== n) continue;
            const previous = before.texts.find((entry) => entry.kind === text.kind && entry.content === text.content && entry.attached?.slot === text.attached.slot);
            if (previous) record(`label "${text.content}" on node ${n}`, previous, text, nodeDelta);
          }
        }
      }
      result.visual.moves = moves;
      add("moving an object carries its anchored text with it", moves.every((entry) => entry.drift <= 3), moves.length === 0 ? "no object moved during this lesson" : JSON.stringify(moves));
    }
    add("no failed requests", failedRequests.length === 0, failedRequests.slice(0, 3).join(" | "));
    add("no 3D asset load failures", !consoleErrors.some((entry) => entry.includes("failed to load")), consoleErrors.filter((entry) => entry.includes("failed to load")).join(" | "));
    add("no uncaught page errors", pageErrors.length === 0, pageErrors.slice(0, 2).join(" | "));
    add("no console errors", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));

    result.checks = checks;
    result.pass = checks.every((check) => check.pass);
  } catch (error) {
    result.pass = false;
    result.error = String(error);
    result.checks = [{ name: "scenario ran", pass: false, detail: String(error) }];
    result.consoleErrors = consoleErrors;
    result.pageErrors = pageErrors;
    result.failedRequests = failedRequests;
  }

  // A browser that has already died must not take the whole run's results with it.
  try {
    await page.close();
  } catch {
    // ignored: this scenario's result is already recorded
  }
  return result;
}

// FALLBACK CHAIN: with WebGL unavailable the classroom must degrade 3D -> 2D -> graph -> text
// instead of showing a blank viewport.
async function verifyFallbackChain(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    // @ts-ignore
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      if (typeof type === "string" && /webgl/i.test(type)) return null;
      return original.call(this, type, ...rest);
    };
  });
  const warnings = [];
  const errors = [];
  page.on("console", (message) => {
    const text = message.text();
    if (text.includes("favicon.ico") || (message.location()?.url ?? "").includes("favicon.ico")) return;
    if (text.includes("[visualizer]")) warnings.push(text);
    if (message.type() === "error") errors.push(text);
  });
  page.on("pageerror", (error) => errors.push(String(error)));

  const result = { id: "fallback-chain", checks: [] };
  const add = (name, pass, detail = "") => result.checks.push({ name, pass, detail });

  // The degradation chain must be deterministic, so it is driven by the heart scenario instead of
  // whatever the live model happens to answer for this question.
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}?scenario=heart` });
      return;
    }
    request.continue();
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.type("#lesson-question", "How does the human heart pump blood?");
  await page.click("button.primary-action");
  await sleep(5000);

  const state = await page.evaluate(() => ({
    canvases: document.querySelectorAll(".scene3d-wrap canvas").length,
    textFallback: Boolean(document.querySelector('[data-testid="text-fallback"]')),
    graphNodes: document.querySelectorAll(".board-node").length,
  }));

  add("no WebGL canvas is created when WebGL is unavailable", state.canvases === 0, `canvases=${state.canvases}`);
  add("the visualizer reports the degradation", warnings.some((entry) => entry.includes("3D unavailable")), warnings.join(" | "));
  add("the board degrades to a lower representation (text/2d/graph)", state.textFallback || state.graphNodes > 0, JSON.stringify(state));
  add("no uncaught errors during degradation", errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.screenshot({ path: join(OUT, "fallback-chain.png") });
  result.screenshot = join(OUT, "fallback-chain.png");
  result.pass = result.checks.every((check) => check.pass);
  await page.close();
  return result;
}

// A FAILED ASSET MUST STILL PRODUCE A USEFUL SCENE.
//
// The heart scenario is driven through the real UI while every /models/*.glb request is aborted. The
// classroom must not go blank: the documented fallback primitive renders, the lesson survives, the HUD
// reports the failure, and React does not crash.
async function verifyFailedAssetFallback(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error && error.stack ? error.stack : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon.ico")) errors.push(message.text());
  });

  const result = { id: "failed-asset-fallback", checks: [] };
  const add = (name, pass, detail = "") => result.checks.push({ name, pass, detail });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/api/teaching/lesson")) {
      request.continue({ url: `${url}${url.includes("?") ? "&" : "?"}scenario=heart` });
      return;
    }
    if (url.includes("/models/") && url.endsWith(".glb")) {
      request.abort("failed");
      return;
    }
    request.continue();
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.type("#lesson-question", "How does the human heart pump blood?");
  await page.click("button.primary-action");
  await sleep(6000);

  const state = await page.evaluate(() => {
    const canvas = document.querySelector(".scene3d-wrap canvas");
    const gl = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl") ?? null;
    const hud = Array.from(document.querySelectorAll(".scene3d-hud span")).map((node) => node.textContent ?? "");
    return {
      has3D: Boolean(canvas),
      glContext: Boolean(gl),
      hud,
      health: window.__visual3dHealth ?? null,
      labels: document.querySelectorAll(".scene-label").length,
      loading: Boolean(document.querySelector('[data-testid="visual3d-loading"]')),
    };
  });

  add("the 3D stage still renders when every model 404s", state.has3D === true && state.glContext === true, JSON.stringify(state));
  add("a visible fallback still occupies the scene", Boolean(state.health && state.health.visibleMeshes > 0 && state.health.hasBounds === true), JSON.stringify(state.health));
  add("the failed assets are reported, not silently ignored", Boolean(state.health && state.health.failed > 0) || state.hud.some((entry) => entry.startsWith("fallback:")), `${JSON.stringify(state.health)} hud=${state.hud.join(" | ")}`);
  add("the loader is not left spinning", state.loading === false);
  add("the lesson content survives the asset failure", state.labels > 0 || state.hud.length > 0, JSON.stringify(state));
  // This scenario DELIBERATELY fails every model request, so the browser's own "Failed to load
  // resource" network line and our deliberate "[3D asset] failed to load" diagnostic are expected
  // here — the dedicated checks above already assert the failure is reported and the fallback
  // renders. What this check must still catch is a genuine crash: an uncaught exception, a React
  // error boundary trip, or a TypeError. Those must never be excluded.
  const expectedAssetNoise = (entry) => /failed to load resource|\[3D asset\] failed to load|could not load \//i.test(entry);
  add("React did not crash", errors.filter((entry) => !expectedAssetNoise(entry)).length === 0, errors.filter((entry) => !expectedAssetNoise(entry)).slice(0, 3).join(" | "));

  await page.screenshot({ path: join(OUT, "failed-asset-fallback.png") });
  result.screenshot = join(OUT, "failed-asset-fallback.png");
  result.pass = result.checks.every((check) => check.pass);
  await page.close();
  return result;
}

// ONE clean retry, only for noise that is not the classroom's doing. Nothing here can hide a
// rendering or text defect: every retry still has to pass every check, so a real failure fails on
// the retry as well.
const VOICE_CDN = /puter\.com/i;
function retryReason(result, scenario) {
  if (!result.checks) return "scenario did not run";
  if ((result.failedRequests ?? []).some((entry) => entry.includes("hot-update"))) return "dev server hot-update noise";
  // A provider 5xx is upstream, not a classroom defect.
  if ((result.failedRequests ?? []).some((entry) => /api\/teaching.*HTTP 5\d\d/.test(entry))) return "teaching provider returned a 5xx";
  // The teacher voice is fetched from a third-party CDN; a dropped connection there is its outage,
  // not the classroom's. The browser only reports the host in the network log, so the console line
  // itself says nothing about which host failed.
  const failures = result.checks.filter((check) => !check.pass);
  if (failures.length > 0 && failures.every((check) => VOICE_CDN.test(check.detail ?? "") || /^(no console errors|no failed requests)$/.test(check.name))
    && (result.failedRequests ?? []).length > 0 && (result.failedRequests ?? []).every((entry) => VOICE_CDN.test(entry))) return "teacher voice CDN unreachable";
  // "Drew nothing" has to mean drew nothing AT ALL. A live lesson may legitimately pick the 3D stage —
// the provider decides the representation, and a question phrased around a real object ("the parts of
// a computer", "how a linked list is stored") can be answered with models. This rule only looked at
// the 2D board, so a lesson that correctly opened in 3D was retried as though the provider had failed,
// and six live scenarios were reported as "drew nothing" while the server log showed every step
// accepted and rendered.
if (scenario.live && failures.every((check) => /painted a real 2D|at least one painted state|text with content/.test(check.name))) {
    const drew3d = result.steps.some((entry) => entry.has3D || (entry.hud ?? []).some((text) => /\d+ objects/.test(text)));
    const hasSpeech = result.steps.some((entry) => (entry.speech ?? "").trim().length > 0);
    if (!drew3d && !hasSpeech) return "live provider drew nothing";
  }
  return null;
}

// Infrastructure failures (a dead server, a page that never renders) look identical for every
// scenario. After three of them in a row the run stops: a genuine visual regression fails only its own
// scenario, and reporting the same missing server twelve times hides that completely.
// THE STUDENT PICKS THE VIEW BEFORE THE LESSON STARTS.
//
// The View selector used to appear only once a lesson was already running, which made the decision
// impossible to make: the student could not ask for 3D until the teacher had drawn 2D, and the words
// they had typed were then re-read to override the one deliberate signal they had given. This drives
// the real UI and asserts the whole contract — present before the lesson, explained, keyboard
// reachable, authoritative over the wording, and still set afterwards.
async function verifyViewChoice(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error && error.stack ? error.stack : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon.ico")) errors.push(message.text());
  });

  const result = { id: "view-choice", checks: [] };
  const add = (name, pass, detail = "") => result.checks.push({ name, pass, detail });

  // Deliberately contradictory: the wording says 3D, the button says 2D. The button is the deliberate
  // signal; if the text wins, the control is decorative.
  const WORDING = "Explain the human heart in 3D";
  const PICK = "2D";

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}${request.url().includes("?") ? "&" : "?"}scenario=heart` });
      return;
    }
    request.continue();
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#lesson-question", { timeout: 30000 });

  const setup = await page.evaluate(() => {
    const panel = document.querySelector(".teacher-setup");
    const group = panel?.querySelector('[role="radiogroup"]');
    const radios = Array.from(group?.querySelectorAll('[role="radio"]') ?? []);
    const startButton = panel?.querySelector(".primary-action");
    const groupBox = group?.getBoundingClientRect();
    const startBox = startButton?.getBoundingClientRect();
    return {
      hasPicker: Boolean(group),
      isLabelled: Boolean(group?.getAttribute("aria-labelledby")),
      options: radios.map((node) => node.textContent?.trim() ?? ""),
      oneTabStop: radios.filter((node) => node.tabIndex === 0).length === 1,
      hasHint: Boolean(panel?.querySelector(".visual-mode-hint")),
      beforeStart: Boolean(groupBox && startBox && groupBox.bottom <= startBox.top),
      emptyTitle: document.querySelector('[data-testid="text-fallback"] strong')?.textContent ?? null,
      starterCount: document.querySelectorAll(".starter-topic").length,
      mentionsStep: /this step|step yet/i.test(document.querySelector('[data-testid="text-fallback"] p')?.textContent ?? ""),
    };
  });

  add("a View selector exists BEFORE any lesson starts", setup.hasPicker, JSON.stringify(setup.options));
  add("it offers Auto, 2D and 3D", setup.options.join(",") === "Auto,2D,3D", setup.options.join(","));
  add("it is a labelled radio group for assistive technology", setup.isLabelled);
  add("it is a single tab stop with arrow-key selection", setup.oneTabStop, `tabbable=${setup.oneTabStop}`);
  add("it explains what the current choice does", setup.hasHint);
  add("it sits above the Start button, before the lesson begins", setup.beforeStart);
  add("the empty board does not talk about a lesson step that does not exist yet", !setup.mentionsStep,
    `mentionsStep=${setup.mentionsStep}`);
  add("the empty board offers a way in rather than a blank rectangle", setup.starterCount >= 4, `${setup.starterCount} starter topics`);
  await page.screenshot({ path: join(OUT, "view-choice-before.png") });

  // Selecting 3D must change both the explanation and the empty board's own message.
  const picked3d = await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll(".teacher-setup [role='radio']")).find((node) => node.textContent?.trim() === "3D");
    button?.click();
    return true;
  });
  await sleep(300);
  const after3d = await page.evaluate(() => ({
    hint: document.querySelector(".visual-mode-hint")?.textContent ?? "",
    emptyFor: document.querySelector('[data-testid="text-fallback"]')?.getAttribute("data-empty-for") ?? null,
    emptyTitle: document.querySelector('[data-testid="text-fallback"] strong')?.textContent ?? null,
  }));
  add("selecting 3D explains itself", picked3d && /3D/i.test(after3d.hint), after3d.hint);
  add("the empty board matches the chosen view", after3d.emptyFor === "3d" && /3D/i.test(after3d.emptyTitle ?? ""), `${after3d.emptyFor} / ${after3d.emptyTitle}`);
  await page.screenshot({ path: join(OUT, "view-choice-3d.png") });

  // Keyboard: arrow keys must move the selection, not just the focus.
  await page.evaluate(() => document.querySelector(".teacher-setup [role='radio'][tabindex='0']")?.focus());
  await page.keyboard.press("ArrowRight");
  await sleep(250);
  const afterArrow = await page.evaluate(() => Array.from(document.querySelectorAll(".teacher-setup [role='radio']"))
    .filter((node) => node.getAttribute("aria-checked") === "true").map((node) => node.textContent?.trim() ?? ""));
  add("an arrow key changes the selected view", afterArrow.length === 1 && afterArrow[0] === "Auto", afterArrow.join(","));

  // Pick 2D, then start a lesson whose wording demands 3D.
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll(".teacher-setup [role='radio']")).find((node) => node.textContent?.trim() === "2D");
    button?.click();
  });
  await page.type("#lesson-question", WORDING, { delay: 3 });
  await page.click("button.primary-action");
  await sleep(7000);

  const live = await page.evaluate(() => ({
    checked: Array.from(document.querySelectorAll(".teacher-live [role='radio']"))
      .filter((node) => node.getAttribute("aria-checked") === "true").map((node) => node.textContent?.trim() ?? ""),
    pickerStillThere: Boolean(document.querySelector(".teacher-live [role='radiogroup']")),
    emptyFor: document.querySelector('[data-testid="text-fallback"]')?.getAttribute("data-empty-for") ?? null,
    hasCanvas: Boolean(document.querySelector(".scene3d-wrap canvas")),
    hasDiagram: Boolean(document.querySelector(".diagram-canvas")),
    graphNodes: document.querySelectorAll(".board-node").length,
    notice: document.querySelector(".representation-notice")?.textContent?.trim() ?? null,
  }));

  add("the View selector is still available during the lesson", live.pickerStillThere);
  add("an explicit choice outranks the wording in the question", live.checked.join(",") === "2D",
    `picked ${PICK}, question said "${WORDING}", board shows ${live.checked.join(",") || "(auto)"}`);
  // The board must never be blank while the lesson has something to show. This scenario is exactly
  // where that used to happen: the student pinned 2D, the lesson produced only 3D, and the teacher
  // said "let us look at the whole organ first" over an empty rectangle.
  add("the board is never blank while the lesson has content",
    live.hasCanvas || live.hasDiagram || live.graphNodes > 0,
    `canvas=${live.hasCanvas} diagram=${live.hasDiagram} graph=${live.graphNodes}`);
  add("if the chosen view could not be honoured, the substitution is stated on the board",
    !live.hasDiagram ? Boolean(live.notice) : true, String(live.notice ?? "(not needed)"));
  add("no uncaught errors choosing a view", errors.length === 0, errors.slice(0, 2).join(" | "));
  await page.screenshot({ path: join(OUT, "view-choice-during.png") });

  result.screenshot = join(OUT, "view-choice-before.png");
  result.pass = result.checks.every((check) => check.pass);
  await page.close();
  return result;
}

// THE STUDENT CONTROLS THE LESSON: back, replay, forward.
//
// A lesson step's actions are INCREMENTAL, so a replay that simply re-applies them duplicates every
// object it builds. This drives the real UI through several steps, replays, goes back and forward, and
// asserts that the board is IDENTICAL to where it was — same object count, same ids — which is the
// property that makes replay safe rather than a way to slowly fill the board with copies.
async function verifyStepControls(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error && error.stack ? error.stack : String(error)}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon.ico")) errors.push(message.text());
  });

  const result = { id: "step-controls", checks: [] };
  const add = (name, pass, detail = "") => result.checks.push({ name, pass, detail });

  // `code-trace` is used because it is a real 2D teaching scenario with five steps that GROW the board
  // and then MUTATE it, so a replay that duplicated anything would change the object count. A scenario
  // that only ever adds objects would hide the bug.
  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}?scenario=code-trace` });
      return;
    }
    request.continue();
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#lesson-question", { timeout: 30000 });

  const readBoard = () => page.evaluate(() => {
    const ids = Array.from(document.querySelectorAll(".diagram-canvas g[data-object-id]")).map((node) => node.getAttribute("data-object-id"));
    return {
      objects: ids.length,
      unique: new Set(ids).size,
      ids: ids.slice().sort().join(","),
      stepLabel: document.querySelector(".step-rail-position")?.textContent?.replace(/\s+/g, " ").trim() ?? null,
      replayDisabled: document.querySelector(".step-rail-buttons .is-replay")?.disabled ?? null,
      backDisabled: document.querySelector(".step-rail-buttons button[aria-label='Go back one step']")?.disabled ?? null,
      speech: document.querySelector(".speech-card")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 60) ?? null,
    };
  });

  await page.type("#lesson-question", "Trace the swap in bubble sort one line at a time", { delay: 3 });
  await page.click(".primary-action");
  await sleep(6000);

  const first = await readBoard();
  add("the lesson position is shown while teaching", /\d/.test(first.stepLabel ?? ""), String(first.stepLabel));
  add("Replay is available once a step has been played", first.replayDisabled === false, `disabled=${first.replayDisabled}`);
  add("Back is unavailable on the first step", first.backDisabled === true, `disabled=${first.backDisabled}`);


  await page.evaluate(() => document.querySelector(".step-rail-buttons button[aria-label='Go forward one step']")?.click());
  await sleep(3200);
  const second = await readBoard();
  add("the lesson advanced to a later step", second.stepLabel !== first.stepLabel, `${first.stepLabel} -> ${second.stepLabel}`);
  add("Back becomes available once there is a previous step", second.backDisabled === false, `disabled=${second.backDisabled}`);

  // REPLAY twice: the board must be byte-identical to where it already was.
  await page.evaluate(() => document.querySelector(".step-rail-buttons .is-replay")?.click());
  await sleep(2600);
  const replayedOnce = await readBoard();
  await page.evaluate(() => document.querySelector(".step-rail-buttons .is-replay")?.click());
  await sleep(2600);
  const replayedTwice = await readBoard();
  add("replaying does not duplicate objects",
    replayedOnce.objects === second.objects && replayedTwice.objects === second.objects,
    `${second.objects} -> ${replayedOnce.objects} -> ${replayedTwice.objects}`);
  add("every object on the board has a unique id after replaying twice",
    replayedTwice.objects === replayedTwice.unique && replayedOnce.objects === replayedOnce.unique,
    `${replayedTwice.unique} unique of ${replayedTwice.objects}`);
  add("replaying returns to exactly the same board", replayedTwice.ids === second.ids,
    replayedTwice.ids === second.ids ? "identical" : `${second.objects} vs ${replayedTwice.objects} objects`);
  add("replaying keeps the student on the same step", replayedTwice.stepLabel === second.stepLabel,
    `${second.stepLabel} -> ${replayedTwice.stepLabel}`);
  await page.screenshot({ path: join(OUT, "step-controls-replay.png") });

  // BACK must restore the earlier board, not merely change the words.
  await page.evaluate(() => document.querySelector(".step-rail-buttons button[aria-label='Go back one step']")?.click());
  await sleep(2600);
  const back = await readBoard();
  add("going back restores the earlier board", back.stepLabel === first.stepLabel && back.objects === first.objects,
    `${back.stepLabel}, ${back.objects} objects (expected ${first.stepLabel}, ${first.objects})`);
  add("going back does not leave duplicated objects", back.objects === back.unique, `${back.unique} unique of ${back.objects}`);
  await page.screenshot({ path: join(OUT, "step-controls-back.png") });

  // FORWARD again must return to the step we came from.
  await page.evaluate(() => document.querySelector(".step-rail-buttons button[aria-label='Go forward one step']")?.click());
  await sleep(2600);
  const forward = await readBoard();
  add("going forward returns to the later step", forward.stepLabel === second.stepLabel && forward.objects === second.objects,
    `${forward.stepLabel}, ${forward.objects} objects`);

  add("no uncaught errors while navigating steps", errors.length === 0, errors.slice(0, 2).join(" | "));

  result.screenshot = join(OUT, "step-controls-replay.png");
  result.pass = result.checks.every((check) => check.pass);
  await page.close();
  return result;
}

// The execution pointer must FOLLOW the words. A teacher says "now line three" and nothing may light is
// the exact failure the pointer exists to prevent, so the lit line is read from the DOM and compared
// against what each step says it should be.
async function verifyCodePointer(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error && error.stack ? error.stack : String(error)}`));

  const result = { id: "code-pointer", checks: [] };
  const add = (name, pass, detail = "") => result.checks.push({ name, pass, detail });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    if (request.url().includes("/api/teaching/lesson")) {
      request.continue({ url: `${request.url()}?scenario=code-trace` });
      return;
    }
    request.continue();
  });

  await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
  await page.waitForSelector("#lesson-question", { timeout: 30000 });
  await page.type("#lesson-question", "Trace the swap in bubble sort one line at a time", { delay: 3 });
  await page.click(".primary-action");
  await sleep(6000);

  /** Which 1-based line is lit, and how many listings there are. */
  const readPointer = () => page.evaluate(() => {
    const panels = document.querySelectorAll(".diagram-code-panel").length;
    const lines = Array.from(document.querySelectorAll(".diagram-code-line"));
    const lit = Array.from(document.querySelectorAll(".diagram-code-highlight")).map((rect) => {
      const y = Number(rect.getAttribute("y"));
      // The highlight rect is positioned from the line's own centre; find the line whose text baseline
      // sits inside it, rather than guessing from the rectangle's height.
      const index = lines.findIndex((line) => {
        const lineY = Number(line.getAttribute("y"));
        return Math.abs(lineY - (y + 9)) < 12;
      });
      return index >= 0 ? index + 1 : null;
    });
    return { panels, lineCount: lines.length, lit: lit.filter((value) => value !== null) };
  });

  const first = await readPointer();
  add("the listing is drawn as a numbered listing", first.lineCount >= 4, `${first.lineCount} lines`);
  add("exactly one listing exists", first.panels === 1, `${first.panels} panels`);
  add("a line is lit on the first step", first.lit.length === 1, JSON.stringify(first.lit));

  const step2 = await page.evaluate(() => {
    const next = document.querySelector(".step-rail-buttons button[aria-label='Go forward one step']");
    next?.click();
    return true;
  });
  await sleep(3000);
  const second = await readPointer();
  add("the pointer follows the explanation to the next step",
    step2 && second.lit.length === 1 && second.lit[0] === 2,
    `step 1 lit ${JSON.stringify(first.lit)}, step 2 lit ${JSON.stringify(second.lit)}`);
  add("moving the pointer never adds a second listing", second.panels === 1, `${second.panels} panels`);
  add("moving the pointer keeps every line of the listing", second.lineCount === first.lineCount,
    `${first.lineCount} -> ${second.lineCount}`);
  await page.screenshot({ path: join(OUT, "code-pointer-step2.png") });

  const step3 = await page.evaluate(() => {
    const next = document.querySelector(".step-rail-buttons button[aria-label='Go forward one step']");
    next?.click();
    return true;
  });
  await sleep(3000);
  const third = await readPointer();
  add("the pointer moves again as the explanation moves on",
    step3 && third.lit.length === 1 && third.lit[0] === 3,
    `step 3 lit ${JSON.stringify(third.lit)}`);
  add("no uncaught errors while moving the pointer", errors.length === 0, errors.slice(0, 2).join(" | "));

  result.screenshot = join(OUT, "code-pointer-step2.png");
  result.pass = result.checks.every((check) => check.pass);
  await page.close();
  return result;
}

const INFRA_FAILURE = /lesson-question not found|waiting failed|Navigation timeout|net::ERR/i;
let consecutiveInfraFailures = 0;

for (const scenario of targets) {
  let result = await runScenario(browser, scenario);
  const reason = result.pass ? null : retryReason(result, scenario);
  if (reason) {
    console.log(`  (retrying ${scenario.id}: ${reason})`);
    const retry = await runScenario(browser, scenario);
    retry.retriedBecause = reason;
    retry.attempts = 2;
    result = retry;
  }
  report.push(result);
  const status = result.pass ? "PASS" : "FAIL";
  console.log(`${status}  ${scenario.id}  (${result.usedModels?.length ?? 0} models)`);
  for (const check of result.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);
  if (!result.pass && result.checks.filter((entry) => !entry.pass).every((check) => INFRA_FAILURE.test(check.detail ?? ""))) {
    consecutiveInfraFailures += 1;
    if (consecutiveInfraFailures >= 3) {
      console.error(`\nAborting: ${consecutiveInfraFailures} scenarios in a row failed for infrastructure reasons, not visual ones.`);
      console.error("Is the dev server up on " + BASE + "? A `next build` also replaces .next underneath a running dev server.");
      break;
    }
  } else {
    consecutiveInfraFailures = 0;
  }
}

// The degradation chain is verified once, regardless of which scenarios were selected.
const fallback = await verifyFallbackChain(browser);
report.push(fallback);
console.log(`${fallback.pass ? "PASS" : "FAIL"}  ${fallback.id}`);
for (const check of fallback.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);

const failedAsset = await verifyFailedAssetFallback(browser);
report.push(failedAsset);
console.log(`${failedAsset.pass ? "PASS" : "FAIL"}  ${failedAsset.id}`);
for (const check of failedAsset.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);

const viewChoice = await verifyViewChoice(browser);
report.push(viewChoice);
console.log(`${viewChoice.pass ? "PASS" : "FAIL"}  ${viewChoice.id}`);
for (const check of viewChoice.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);

const stepControls = await verifyStepControls(browser);
report.push(stepControls);
console.log(`${stepControls.pass ? "PASS" : "FAIL"}  ${stepControls.id}`);
for (const check of stepControls.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);

const codePointer = await verifyCodePointer(browser);
report.push(codePointer);
console.log(`${codePointer.pass ? "PASS" : "FAIL"}  ${codePointer.id}`);
for (const check of codePointer.checks.filter((entry) => !entry.pass)) console.log(`      x ${check.name}${check.detail ? ` -> ${check.detail}` : ""}`);

await browser.close();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
const failed = report.filter((entry) => !entry.pass);
console.log(`\n${report.length - failed.length}/${report.length} scenarios passed. Report: ${join(OUT, "report.json")}`);
process.exit(failed.length > 0 ? 1 : 0);
