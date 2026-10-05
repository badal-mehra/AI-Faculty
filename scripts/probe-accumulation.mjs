// Visual accumulation probe.
//
// The complaint this measures is specific: the board becomes a history of everything the teacher has
// said instead of a representation of what is being taught NOW. So this replays a real lesson through
// the real engines and reports, step by step, how many objects are on the board, how many arrived with
// THIS step, and how much of what is on screen belongs to a stage that is already finished.
//
//   node scripts/probe-accumulation.mjs "Explain Newton's second law..." [batches]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { applyVisualActions, getVisualScene, settleVisualScene } = require("../.test-out/lib/visual/engine.js");
const { applyVisual3DActions, getVisual3DScene } = require("../.test-out/lib/visual3d/engine.js");
const { parseVisualActions } = require("../.test-out/lib/visual/validate.js");
const { emptyVisualScene } = require("../.test-out/lib/visual/types.js");
const { emptyVisual3DScene } = require("../.test-out/lib/visual3d/types.js");
const { emptyBoardState } = require("../.test-out/lib/board/types.js");

const QUESTION = process.argv[2] ?? "Explain Newton's second law including what each variable means.";
const BATCHES = Number(process.argv[3] ?? 3);
const base = process.env.PROBE_BASE ?? "http://localhost:3000";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let visual = emptyVisualScene();
let scene3d = emptyVisual3DScene();
const board = emptyBoardState();
const spoken = [];
let progress = null;
const born = new Map();

const rows = [];
for (let batch = 0; batch < BATCHES; batch += 1) {
  const startedAt = Date.now();
  const response = await fetch(`${base}/api/teaching/lesson?diagnostics=1`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: QUESTION,
      language: "English",
      lessonStep: rows.length + 1,
      boardState: board,
      visualState: visual,
      visualState3d: scene3d,
      previousTeaching: spoken.slice(-8),
      // The classroom sends this, and without it every batch restarts the lesson from stage one — which
      // makes the lifecycle look broken when it is merely being asked the wrong question.
      ...(progress ? { lessonProgress: progress } : {}),
    }),
  });
  const payload = await response.json();
  if (!payload.steps?.length) { console.log(`batch ${batch + 1}: ERROR ${payload.error ?? "no steps"} ${payload.message ?? ""}`); break; }
  progress = payload.progress ?? progress;
  for (const step of payload.steps) {
    const before = visual.objects.length;
    const parsed = parseVisualActions(step.visual_actions ?? []);
    // The SAME context the classroom passes: the lesson step, and how far the objective has advanced. The
    // stage index is the covered-stage count rather than the provider's declared `stage_id`, because the
    // provider repeats stage ids and a backwards index means nothing ever goes stale.
    const stages = progress?.stages ?? [];
    const covered = progress?.coveredStageIds?.length ?? 0;
    visual = settleVisualScene(getVisualScene(applyVisualActions(visual, parsed ?? [], {
      step: step.lesson_step,
      stage: Math.max(covered, step.stage_id ? stages.findIndex((stage) => stage.id === step.stage_id) : 0),
    })));
    scene3d = getVisual3DScene(applyVisual3DActions(scene3d, step.visual3d_actions ?? []));
    for (const object of visual.objects) if (!born.has(object.id)) born.set(object.id, step.lesson_step);
    const kept = visual.objects.filter((object) => born.get(object.id) === step.lesson_step).length;
    const total = visual.objects.length + scene3d.objects.length;
    rows.push({
      step: step.lesson_step,
      stage: step.stage_id ?? "-",
      intent: step.teaching_intent ?? "-",
      objects: total,
      added: visual.objects.length - before + Math.max(0, scene3d.objects.length - 0),
      newThisStep: kept,
      older: visual.objects.length - kept,
      ms: Date.now() - startedAt,
    });
    spoken.push(step.speech);
  }
  console.log(`batch ${batch + 1}: ${payload.steps.length} steps, ${(payload.progress?.coveredStageIds ?? []).length}/${payload.progress?.stages?.length} stages, complete=${payload.progress?.complete}`);
  if (payload.progress?.complete) break;
}

console.log(`\n${QUESTION}\n`);
console.log("step  stage intent              objects  new  older");
for (const row of rows) {
  const bar = "#".repeat(Math.min(60, row.objects));
  console.log(
    `${String(row.step).padStart(4)}  ${row.stage.padEnd(5)} ${row.intent.padEnd(20)} ${String(row.objects).padStart(6)}  ${String(row.newThisStep).padStart(4)}  ${String(row.older).padStart(5)}  ${bar}`,
  );
}
const peak = Math.max(...rows.map((row) => row.objects));
const last = rows[rows.length - 1];
const growth = rows.length > 1 ? last.objects - rows[0].objects : 0;
console.log(`\npeak objects ${peak}; final ${last.objects}; total growth ${growth >= 0 ? "+" : ""}${growth}`);
console.log(`objects still on screen at the end that belong to an earlier step: ${last.older} of ${last.objects}`);
