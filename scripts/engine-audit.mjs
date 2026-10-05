// Engine-level check with REAL provider output (development tool).
//
// Fetches a lesson for any topic, replays it through the visualization engine exactly as the app
// does, and reports the resulting scene geometry: is everything on the board, do labels overlap,
// do objects collapse, does the scene round-trip through the server's strict validation?
// Usage: node scripts/engine-audit.mjs "Explain photosynthesis step by step"
import { emptyVisualScene } from "../.test-out/lib/visual/types.js";
import { applyVisualActions, getVisualScene } from "../.test-out/lib/visual/engine.js";
import { parseVisualScene } from "../.test-out/lib/visual/validate.js";

const APP = process.env.APP_URL || "http://localhost:3111/";
const QUESTION = process.argv[2] || "Explain photosynthesis step by step";
const box = (o) => ({ l: o.x - o.width / 2, t: o.y - o.height / 2, r: o.x + o.width / 2, b: o.y + o.height / 2 });
const overlaps = (a, b, pad = 0) => a.l - pad < b.r && b.l - pad < a.r && a.t - pad < b.b && b.t - pad < a.b;

const response = await fetch(`${APP}api/teaching/lesson`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    question: QUESTION, language: "English", lessonStep: 1,
    boardState: { nodes: [], edges: [], texts: [], highlights: [] },
    visualState: { tick: 0, objects: [] }, previousTeaching: [],
  }),
});
const lesson = await response.json();
if (!lesson.steps) { console.error("no lesson:", JSON.stringify(lesson).slice(0, 300)); process.exit(1); }

let scene = emptyVisualScene();
let bad = 0;
console.log(`lesson "${QUESTION}" -> ${lesson.steps.length} step(s); per-step actions:`);
lesson.steps.forEach((step) => console.log(`  step ${step.lesson_step}->${step.next_step}: board=${step.board_actions.length} diagram=${step.visual_actions.length}`));
lesson.steps.forEach((step, index) => {
  scene = applyVisualActions(scene, step.visual_actions);
  const solids = scene.objects.filter((o) => o.kind !== "arrow" && o.kind !== "connector");
  const pairs = [];
  for (let i = 0; i < solids.length; i += 1) for (let j = i + 1; j < solids.length; j += 1) {
    if (overlaps(box(solids[i]), box(solids[j]), -4)) pairs.push(`${solids[i].id}<->${solids[j].id}`);
  }
  const off = scene.objects.filter((o) => o.x < 20 || o.x > 780 || o.y < 20 || o.y > 500).map((o) => o.id);
  const distinct = new Set(solids.map((o) => `${Math.round(o.x)},${Math.round(o.y)}`)).size;
  const roundTrip = parseVisualScene(getVisualScene(scene)) !== null;
  if (pairs.length || off.length || distinct !== solids.length || !roundTrip) bad += 1;
  console.log(`step ${index + 1}: objects=${scene.objects.length} solids=${solids.length} arrows=${scene.objects.length - solids.length}`);
  console.log(`  labels: ${solids.map((o) => `${o.id}@${Math.round(o.x)},${Math.round(o.y)}${o.text ? ` "${o.text}"` : ""}`).join("  ")}`);
  console.log(`  arrows: ${scene.objects.filter((o) => o.refs).map((o) => `${o.id}[${o.refs.from}->${o.refs.to}] lane=${o.offset ?? 0} "${o.text ?? ""}"`).join("  ")}`);
  console.log(`  overlaps=${pairs.length ? pairs.join(",") : "none"} offBoard=${off.length ? off.join(",") : "none"} distinctPoints=${distinct}/${solids.length} roundTrip=${roundTrip}`);
});
console.log(bad === 0 ? "\nLAYOUT AUDIT: PASS" : `\nLAYOUT AUDIT: ${bad} step(s) with problems`);
process.exit(bad === 0 ? 0 : 1);