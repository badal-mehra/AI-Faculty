// Live teaching-pipeline probe.
//
// Calls the REAL /api/teaching/lesson endpoint (no scenarios, no mocks) with the exact request
// contract the classroom sends, and records what the providers actually produced: how many steps,
// how many actions per representation, what the speech says, and — critically — whether the words
// the teacher used match the objects it drew.
//
// It also CARRIES THE SCENE FORWARD between batches with the real engines, exactly as the browser
// does. That matters: a provider routinely refers to an object it created two steps ago, and a probe
// that starts every batch from an empty board reports those references as failures that a student would
// never see. The lesson runs until the server reports the objective covered, so completion is exercised
// rather than assumed.
//
//   node scripts/probe-lessons.mjs [--out .probe] [--batches 3] [topic ...]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
// The compiled engines, so the probe replays the scene exactly the way the classroom does.
const { applyVisual3DActions, getVisual3DScene } = require("../.test-out/lib/visual3d/engine.js");
const { applyVisualActions, getVisualScene } = require("../.test-out/lib/visual/engine.js");
const { executeBoardActions, getBoardState } = require("../.test-out/lib/board/engine.js");
const { emptyVisual3DScene } = require("../.test-out/lib/visual3d/types.js");
const { emptyVisualScene } = require("../.test-out/lib/visual/types.js");
const { emptyBoardState } = require("../.test-out/lib/board/types.js");

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const batchIndex = args.indexOf("--batches");
const OUT = outIndex >= 0 ? args[outIndex + 1] : ".probe";
const MAX_BATCHES = batchIndex >= 0 ? Number(args[batchIndex + 1]) : 3;
const topics = args.filter((value, index) => index !== outIndex && index !== outIndex + 1 && index !== batchIndex && index !== batchIndex + 1);

const DEFAULT_TOPICS = [
  "explain human heart",
  "explain photosynthesis",
  "explain binary search",
  "explain recursion with code execution",
  "explain TCP three-way handshake",
  "explain Newton's laws",
  "explain chemical bonding",
  "explain matrix multiplication",
];

const base = process.env.PROBE_BASE ?? "http://localhost:3000";

function initialRequest(question, language = "English") {
  return {
    question,
    language,
    lessonStep: 1,
    boardState: emptyBoardState(),
    visualState: emptyVisualScene(),
    visualState3d: emptyVisual3DScene(),
    previousTeaching: [],
  };
}

/** Plays a batch into the live scene the way the browser does, then reports what the student sees. */
function playBatch(state, steps) {
  const next = {
    board: state.board ?? getBoardState(emptyBoardState()),
    visual: state.visual ?? emptyVisualScene(),
    scene3d: state.scene3d ?? emptyVisual3DScene(),
  };
  for (const step of steps) {
    next.board = executeBoardActions(next.board, step.board_actions ?? []);
    next.visual = applyVisualActions(next.visual, step.visual_actions ?? []);
    next.scene3d = applyVisual3DActions(next.scene3d, step.visual3d_actions ?? []);
    next.speech = [...(state.speech ?? []), step.speech].slice(-8);
  }
  return next;
}

const summarise = (payload) => payload?.steps ?? [];

const slug = (topic) => topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);

mkdirSync(OUT, { recursive: true });
const report = [];

for (const topic of topics.length > 0 ? topics : DEFAULT_TOPICS) {
  console.log(`\n=== ${topic}`);
  const state = { board: undefined, visual: undefined, scene3d: undefined, speech: [] };
  const allSteps = [];
  let progress = null;
  let quality = null;
  let error = null;
  let totalMs = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
    const request = {
      question: topic,
      language: "English",
      lessonStep: state.board ? (allSteps[allSteps.length - 1]?.next_step ?? 1) : 1,
      boardState: state.board ?? emptyBoardState(),
      visualState: state.visual ?? emptyVisualScene(),
      visualState3d: state.scene3d ?? emptyVisual3DScene(),
      previousTeaching: state.speech,
      ...(progress ? { lessonProgress: progress } : {}),
    };
    const startedAt = Date.now();
    let payload = null;
    try {
      const response = await fetch(`${base}/api/teaching/lesson?diagnostics=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      payload = await response.json();
      if (!response.ok) error = `${response.status} ${payload?.error ?? ""} ${payload?.message ?? ""}`;
    } catch (caught) {
      error = String(caught);
    }
    totalMs += Date.now() - startedAt;
    if (error) { console.log(`  ERROR ${error}`); break; }
    if (!payload.steps?.length) { console.log("  EMPTY BATCH"); break; }

    allSteps.push(...payload.steps);
    progress = payload.progress ?? progress;
    quality = payload.quality ?? quality;
    const played = playBatch(state, payload.steps);
    state.board = getBoardState(played.board);
    state.visual = getVisualScene(played.visual);
    state.scene3d = getVisual3DScene(played.scene3d);
    state.speech = played.speech;

    console.log(`  batch ${batch + 1}: steps=${payload.steps.length} covered=${(progress?.coveredStageIds ?? []).length}/${(progress?.stages ?? []).length} complete=${progress?.complete}`);
    for (const step of summarise(payload)) {
      const a3 = step.visual3d_actions ?? [];
      console.log(`   step ${step.lesson_step}: board=${step.board_actions?.length ?? 0} 2d=${step.visual_actions?.length ?? 0} 3d=${a3.length} assets=[${a3.filter((a) => a.action === "create_3d_object").map((a) => a.asset ?? a.type).join(",")}] labels=${a3.filter((a) => String(a.action).includes("label")).length} flows=${a3.filter((a) => String(a.action).startsWith("animate_")).length}`);
    }
    if (progress?.complete) break;
  }

  // What the student is actually looking at when the lesson ends.
  const scene = state.scene3d ?? emptyVisual3DScene();
  const diagram = state.visual ?? emptyVisualScene();
  const board = state.board ?? { nodes: [], edges: [], texts: [] };
  console.log(`  FINAL BOARD: 3d objects=${scene.objects.length} (models=${scene.objects.filter((o) => o.asset).length}, primitives=${scene.objects.filter((o) => !o.asset).length}) labels=${scene.labels.length} flows=${scene.flows.length} | 2d objects=${diagram.objects.length} | graph nodes=${board.nodes.length}`);
  console.log(`  FINAL: ok=${quality?.ok} visualSteps=${quality?.visualSteps}/${quality?.steps} named=[${(quality?.entitiesNamed ?? []).join(",")}] shown=[${(quality?.entitiesShown ?? []).join(",")}] promoted=${quality?.promotedPrimitives} labelsAdded=${quality?.labelsAdded} dropped=${quality?.droppedActions}`);
  for (const note of (quality?.notes ?? []).slice(0, 12)) console.log(`    + ${note}`);
  for (const issue of (quality?.issues ?? [])) console.log(`    ! ${issue.kind} @${issue.lessonStep}: ${issue.detail}`);

  writeFileSync(join(OUT, `${slug(topic)}.json`), JSON.stringify({ topic, totalMs, error, progress, quality, steps: allSteps, final: { scene, diagram, board } }, null, 2));
  report.push({ topic, totalMs, steps: allSteps.length, complete: progress?.complete ?? false, ok: quality?.ok ?? null, quality });
  error = null;
}

writeFileSync(join(OUT, "index.json"), JSON.stringify(report, null, 2));
console.log(`\nWrote ${OUT}/`);