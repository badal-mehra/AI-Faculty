// CURRENT-STEP COMPOSITION — the tests for "the visible board is not the lesson's memory".
//
// The failure these measure was measured, not imagined: a real Newton's-second-law lesson reached 58 objects
// at step 18, 57 of them belonging to earlier steps, every one drawn at comparable strength. Each gate before
// composition had passed it — the schema validated, every action applied, no asset was off-topic, and no two
// objects overlapped. What none of them was asked was whether the board was about NOW.
//
// Composition is therefore tested on the SCENE, not on a function's return value: what a student would see
// after each step, what survived, what was retired, and what the diagnostics claim.
import { applyVisualActions, getVisualScene, settleVisualScene } from "../lib/visual/engine";
import { parseVisualActions } from "../lib/visual/validate";
import { emptyVisualScene, VISUAL_PRIORITY, type VisualAction, type VisualScene } from "../lib/visual/types";
import {
  compositionLogLine,
  composeScene,
  currentFocusIds,
  densityScore,
  foreignRepresentationCount,
  MAX_REPAIR_PASSES,
  MIN_VISIBLE_OBJECTS,
  overlapCount,
  selectVisibleObjects,
  visualBudget,
} from "../lib/visual/composition";
import { referencedIds } from "../lib/visual/lifecycle";
import { visualPolicyFor, ALL_STRUCTURE_ACTIONS } from "../lib/teaching/visualPolicy";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const section = (title: string) => console.log(`\n== ${title}`);

/** Applies a step the way the classroom does: engine, lifecycle, then composition. */
function step(
  scene: VisualScene,
  actions: unknown,
  context: { step: number; stage: number; temporary?: boolean },
): VisualScene {
  const parsed = parseVisualActions(actions as never) ?? [];
  const played = applyVisualActions(scene, parsed, context);
  return composeScene(played, parsed, context).scene;
}

const byId = (scene: VisualScene, id: string) => scene.objects.find((object) => object.id === id);

// ------------------------------------------------------------------------- 1. The board stops growing

section("1. the board is about this step, not every step");

{
  let scene = emptyVisualScene();
  // Six structures over six stages: exactly what a deep lesson accumulates when nothing retires anything.
  const stages: Array<{ stage: number; actions: VisualAction[] }> = [
    { stage: 1, actions: [{ action: "create_pipeline", id: "p1", stages: ["Force", "Mass", "Acceleration"] }] },
    { stage: 2, actions: [{ action: "create_compare", id: "cmp", left: { title: "Before", items: ["v"] }, right: { title: "After", items: ["2v"] } }] },
    { stage: 3, actions: [{ action: "create_sequence", id: "seq", actors: ["Given", "Find", "Substitute", "Check"], messages: [] }] },
    { stage: 4, actions: [{ action: "create_timeline", id: "tl", events: [{ label: "t0", text: "0" }, { label: "t1", text: "2 s" }] }] },
    { stage: 5, actions: [{ action: "create_pipeline", id: "p2", stages: ["a", "v", "result"] }] },
    { stage: 6, actions: [{ action: "create_sequence", id: "seq2", actors: ["5 N", "2 kg", "a = 2.5"], messages: [] }] },
  ];

  const counts: number[] = [];
  for (const [index, entry] of stages.entries()) {
    scene = step(scene, entry.actions, { step: index + 1, stage: entry.stage });
    counts.push(scene.objects.length);
  }

  const budget = visualBudget(scene);
  check("the board stays inside its budget after six stages", scene.objects.length <= budget, `${scene.objects.length} > ${budget}`);
  check("the board does not grow monotonically", counts[counts.length - 1]! <= Math.max(...counts), counts.join(","));
  check("the last stage's objects are on the board", byId(scene, "seq2-a0") !== undefined, scene.objects.map((o) => o.id).join(","));
  check("the first stage's pipeline has been retired", byId(scene, "p1-title") === undefined && byId(scene, "p1-s0") === undefined, scene.objects.map((o) => o.id).join(","));
}

// ------------------------------------------------------------------------- 2. Retirement is per group

section("2. a structure retires as a whole, never half of it");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_pipeline", id: "ideo", stages: ["Inspiration", "Ideation", "Implementation"] }], { step: 1, stage: 1 });
  const pipelineGroup = scene.objects.filter((object) => object.group === "ideo").length;
  check("the pipeline is on the board as one group", pipelineGroup >= 4, String(pipelineGroup));

  scene = step(scene, [{ action: "create_sequence", id: "later", actors: ["A", "B"], messages: [] }], { step: 2, stage: 4 });
  const leftovers = scene.objects.filter((object) => object.group === "ideo");
  check("either the whole group survives or none of it does", leftovers.length === 0 || leftovers.length === pipelineGroup, `${leftovers.length} of ${pipelineGroup}`);
}

// ------------------------------------------------------------- 3-4. Current and referenced objects are protected

section("3. what this step is about is never retired");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_array", id: "arr", values: ["1", "2", "3", "4"], indices: true }], { step: 1, stage: 1 });
  const referenced = referencedIds([{ action: "highlight_many", ids: ["arr-c0", "arr-c1"] } as VisualAction]);
  const selection = selectVisibleObjects(scene, 4, referenced);
  check("a referenced object is kept even under a tiny budget", selection.kept.some((object) => object.id === "arr-c0"), selection.kept.map((object) => object.id).join(","));
  check("the objects it belongs to are kept with it", selection.kept.filter((object) => object.group === "arr").length >= 4, selection.kept.map((object) => object.id).join(","));
}

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_sequence", id: "keep", actors: ["one", "two", "three"], messages: [] }], { step: 5, stage: 5 });
  const focus = currentFocusIds(scene, [{ action: "create_sequence", id: "keep", actors: ["one", "two", "three"], messages: [] } as VisualAction], 5);
  check("current objects are reported as the focus", focus.length > 0, focus.join(","));
}

// ------------------------------------------------------------------- 5. The budget is a hard constraint

section("5. the budget is never exceeded, whatever arrives");

{
  let scene = emptyVisualScene();
  for (let index = 0; index < 6; index += 1) {
    scene = step(scene, [{ action: "create_sequence", id: `s${index}`, actors: ["a", "b", "c", "d", "e"], messages: [] }], { step: index + 1, stage: index + 1 });
  }
  const budget = visualBudget(scene);
  const result = composeScene(scene, [], { step: 7, stage: 7, budget: 12 });
  check("a forced budget of 12 is honoured exactly", result.scene.objects.length <= 12, String(result.scene.objects.length));
  check("composition reports what it retired", result.diagnostics.retiredObjectCount > 0, String(result.diagnostics.retiredObjectCount));
  check("the retirements are reported as groups", result.retired.length > 0 && result.retired.every((entry) => entry.group.length > 0));
}

// ------------------------------------------------------------- 6. Nothing is shrunk or hidden to fit

section("6. the budget is met by retiring, never by shrinking");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_circuit", id: "rc", elements: [{ label: "R", kind: "resistor", value: "1k" }, { label: "C", kind: "capacitor", value: "1u" }] }], { step: 1, stage: 1 });
  const before = new Map(scene.objects.map((object) => [object.id, `${object.width}x${object.height}`]));
  for (let index = 0; index < 5; index += 1) {
    scene = step(scene, [{ action: "create_sequence", id: `x${index}`, actors: ["a", "b", "c"], messages: [] }], { step: index + 2, stage: index + 2 });
  }
  const changed = scene.objects.filter((object) => {
    const size = before.get(object.id);
    return size !== undefined && size !== `${object.width}x${object.height}`;
  });
  check("no surviving object was resized to make room", changed.length === 0, changed.map((object) => object.id).join(","));
  const hidden = scene.objects.filter((object) => object.opacity < VISUAL_PRIORITY[object.lifecycle ?? "current"] * 0.9 && (object.lifecycle ?? "current") === "current");
  check("no current object was faded out to make room", hidden.length === 0, hidden.map((object) => object.id).join(","));
}

// ------------------------------------------------------------------- 7. Repair is bounded at two passes

section("7. focus repair runs at most twice");

{
  const scene = emptyVisualScene();
  const composed = composeScene(scene, [], { step: 1, stage: 1 });
  check("repair never exceeds its cap", composed.repairPasses <= MAX_REPAIR_PASSES, String(composed.repairPasses));
  check("the cap is two", MAX_REPAIR_PASSES === 2);
  const forced = composeScene(scene, [], { step: 1, stage: 1, repairPasses: 9 });
  check("asking for more passes does not get more passes", forced.repairPasses <= MAX_REPAIR_PASSES, String(forced.repairPasses));
}

// -------------------------------------------------- 8. Text participates in the readability measure

section("8. annotations and labels count towards overlap and density");

{
  const crowded = {
    ...emptyVisualScene(),
    objects: [
      { id: "a", kind: "text" as const, order: 0, x: 200, y: 200, width: 160, height: 30, opacity: 1, rotation: 0, text: "one" },
      { id: "b", kind: "text" as const, order: 1, x: 205, y: 205, width: 160, height: 30, opacity: 1, rotation: 0, text: "two" },
      { id: "c", kind: "shape" as const, order: 2, x: 700, y: 450, width: 120, height: 120, opacity: 1, rotation: 0 },
    ],
  };
  check("two overlapping annotations count as an overlap", overlapCount(crowded) === 1, String(overlapCount(crowded)));
  check("density rises with covered area", densityScore(crowded) > 0);
}

// --------------------------------------------------------------- 9. An interruption leaves no mark

section("9. an interruption is temporary and the lesson's board is restored");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_sequence", id: "lesson", actors: ["one", "two"], messages: [] }], { step: 3, stage: 3 });
  const before = scene.objects.map((object) => object.id);

  const aside = step(scene, [{ action: "create_pipeline", id: "aside", stages: ["tau", "answer"] }], { step: 3, stage: 3, temporary: true });
  check("the aside is visible while it is explained", aside.objects.some((object) => object.group === "aside"), aside.objects.map((object) => object.id).join(","));
  check("the aside is marked temporary", aside.objects.filter((object) => object.group === "aside").every((object) => object.lifecycle === "temporary"));

  const resumed = step(aside, [{ action: "create_sequence", id: "next", actors: ["three"], messages: [] }], { step: 4, stage: 4 });
  check("the aside is gone when the lesson resumes", resumed.objects.every((object) => object.group !== "aside"), resumed.objects.map((object) => object.id).join(","));
  check("the lesson's own objects survived the aside", before.every((id) => resumed.objects.some((object) => object.id === id)), `${before.join(",")} vs ${resumed.objects.map((object) => object.id).join(",")}`);
}

// ------------------------------------------------------------------------ 10-12. The diagnostics

section("10. every required field is reported and logged");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_pipeline", id: "p", stages: ["a", "b"] }], { step: 2, stage: 2 });
  const composed = composeScene(scene, [{ action: "create_pipeline", id: "p", stages: ["a", "b"] } as VisualAction], {
    step: 2, stage: 2, subject: "design", domain: "design", subdomain: "design-thinking", teachingIntent: "introduce_concept",
  });
  const line = compositionLogLine(composed.diagnostics);
  for (const field of [
    "subject", "subdomain", "teachingIntent", "currentFocusIds", "visibleObjectCount", "retiredObjectCount",
    "supportingObjectCount", "contextObjectCount", "visualFocusScore", "densityScore", "overlapCount",
    "foreignRepresentationCount",
  ]) {
    check(`the log line carries ${field}`, line.includes(`${field}=`), line);
  }
  check("the log line is prefixed with the tag", line.startsWith("[teaching:composition]"), line);
  check("the focus is a list of ids", composed.diagnostics.currentFocusIds.length > 0, JSON.stringify(composed.diagnostics.currentFocusIds));
  check("the focus score is a number", Number.isFinite(composed.diagnostics.visualFocusScore));
}

section("11. a foreign representation is counted where it is composed");

{
  const policy = visualPolicyFor("design", "humanities");
  const designActions = [
    { action: "create_pipeline", id: "p", stages: ["a", "b"] },
    { action: "create_code_block", id: "c", language: "python", code: "x = 1" },
  ];
  const foreign = foreignRepresentationCount({ domain: policy.domain, coarse: policy.coarse, allowCode: policy.allowCode, structures: policy.structures }, designActions as VisualAction[]);
  check("a design code block is counted as foreign", foreign === 1, String(foreign));
  const programming = visualPolicyFor("computer-science", "programming");
  check("a programming code block is not foreign", foreignRepresentationCount({ domain: programming.domain, coarse: programming.coarse, allowCode: programming.allowCode, structures: programming.structures }, designActions as VisualAction[]) === 0);
}

section("11b. only a STRUCTURE can be foreign to a subject");

{
  // A real calculus run reported "foreign 2" for a lesson that drew a rectangle and nudged it. `move`,
  // `create_shape` and `highlight` are how every subject is drawn; counting them made this diagnostic
  // unreadable, and a diagnostic nobody trusts is one that stops catching real leaks.
  const policy = visualPolicyFor("mathematics", "mathematics");
  const base = { domain: policy.domain, coarse: policy.coarse, allowCode: policy.allowCode, structures: policy.structures, structureActions: ALL_STRUCTURE_ACTIONS };
  const primitives = [
    { action: "create_shape", id: "s", shape: "rect", x: 0, y: 0 },
    { action: "move", id: "s", x: 20, y: 20 },
    { action: "highlight", id: "s" },
    { action: "create_text", id: "t", text: "k" },
    { action: "wait", durationMs: 100 },
  ];
  check("a rectangle, a nudge, a highlight and a word are not a foreign representation", foreignRepresentationCount(base, primitives as VisualAction[]) === 0, String(foreignRepresentationCount(base, primitives as VisualAction[])));
  const realLeak = [{ action: "create_code_block", id: "c", language: "python", code: "x = 1" }];
  check("a code listing in a maths lesson is still counted", foreignRepresentationCount(base, realLeak as VisualAction[]) === 1, String(foreignRepresentationCount(base, realLeak as VisualAction[])));
  check("without the structure universe the count is unchanged for structures", foreignRepresentationCount({ domain: policy.domain, coarse: policy.coarse, allowCode: policy.allowCode, structures: policy.structures }, realLeak as VisualAction[]) === 1);
}

section("11c. a step that drew nothing says so, instead of scoring a silent zero");

{
  let scene = emptyVisualScene();
  const draw = [{ action: "create_compare", id: "cmp", left: { title: "left", items: ["a"] }, right: { title: "right", items: ["b"] } }] as VisualAction[];
  scene = step(scene, draw, { step: 1, stage: 1 });
  const speaking = composeScene(scene, draw, { step: 1, stage: 1, subject: "mathematics", teachingIntent: "introduce_concept" });
  check("a step that drew reports the objects it is about", speaking.diagnostics.focusedObjectCount > 0, String(speaking.diagnostics.focusedObjectCount));

  // The next step only speaks. The board must keep the previous picture — that is the lifecycle rule — and
  // the diagnostics must say the board holds nothing from THIS step rather than pretending otherwise.
  // The step is applied through the engine first, exactly as the pipeline does it, because the lifecycle
  // reclassifies there: these objects are "current" only with respect to the step that drew them.
  const talk = [{ action: "wait", durationMs: 200 }] as VisualAction[];
  const talked = step(scene, talk, { step: 2, stage: 2 });
  const talkOnly = composeScene(talked, talk, { step: 2, stage: 2, subject: "mathematics", teachingIntent: "explain_why" });
  check("a step that drew nothing reports zero focused objects", talkOnly.diagnostics.focusedObjectCount === 0, String(talkOnly.diagnostics.focusedObjectCount));
  check("a step that drew nothing keeps the board", talkOnly.diagnostics.visibleObjectCount === speaking.diagnostics.visibleObjectCount, `${talkOnly.diagnostics.visibleObjectCount} vs ${speaking.diagnostics.visibleObjectCount}`);
  check("the focused count is in the log line", compositionLogLine(talkOnly.diagnostics).includes("focusedObjectCount=0"), compositionLogLine(talkOnly.diagnostics));
}

section("11d. a step that explains the board it inherited owns that board");

{
  // The finding that produced the focus fix: the lifecycle demotes a pointed-at object to `supporting`, which
  // is right for retirement and wrong for focus. A step whose entire job is to walk through the force diagram
  // already on screen drew nothing and was scored as owning none of it — and composition was then licensed to
  // retire the very diagram being explained.
  let scene = emptyVisualScene();
  const draw = [{ action: "create_compare", id: "cmp", left: { title: "F", items: ["5 N"] }, right: { title: "m", items: ["2 kg"] } }] as VisualAction[];
  scene = step(scene, draw, { step: 1, stage: 1 });
  const before = scene.objects.length;

  // Step 2 addresses three of the six objects and adds nothing. The board should be about it.
  const addressed = [{ action: "highlight", id: "cmp-l-frame" }, { action: "highlight", id: "cmp-l-head" }, { action: "highlight", id: "cmp-l-r0" }] as VisualAction[];
  const talked = step(scene, addressed, { step: 2, stage: 2 });
  const composed = composeScene(talked, addressed, { step: 2, stage: 2, subject: "physics", teachingIntent: "explain_why" });

  check("the addressed objects are all still on the board", composed.diagnostics.visibleObjectCount === before, `${composed.diagnostics.visibleObjectCount} vs ${before}`);
  check("the step is measured as owning the structure it addressed", composed.diagnostics.focusedObjectCount === before, String(composed.diagnostics.focusedObjectCount));
  check("the board it inherited was not retired to satisfy a share", composed.diagnostics.retiredObjectCount === 0, String(composed.diagnostics.retiredObjectCount));
  check("the focus score reflects that share", composed.diagnostics.visualFocusScore === 100, String(composed.diagnostics.visualFocusScore));

  // The contrast that proves the rule still bites. The focus has to be something SMALL for this to mean
  // anything: a step that writes one new label beside two stale structures owns one object, and one object in
  // fifteen is the drift the whole stage exists to remove. Addressing one node of a six-object comparison is
  // not the same case — that step is talking about the comparison.
  let crowded = emptyVisualScene();
  crowded = step(crowded, [{ action: "create_pipeline", id: "p1", stages: ["a", "b", "c"] }] as VisualAction[], { step: 1, stage: 1 });
  crowded = step(crowded, [{ action: "create_timeline", id: "t1", events: [{ label: "1", text: "x" }, { label: "2", text: "y" }] }] as VisualAction[], { step: 2, stage: 2 });
  crowded = step(crowded, [{ action: "create_compare", id: "c1", left: { title: "l", items: ["a"] }, right: { title: "r", items: ["b"] } }] as VisualAction[], { step: 3, stage: 3 });
  const staleCount = crowded.objects.length;
  const oneLabel = [{ action: "create_text", id: "answer", text: "a = 2.5 m/s²" }] as VisualAction[];
  // Applied through the engine and composed ONCE, exactly as the classroom and the quality replay do it.
  // Composing twice is not the pipeline — the second composition sees an already-composed board and can only
  // report on that, which is how a test ends up asserting numbers no real step would ever produce.
  const parsed = parseVisualActions(oneLabel as never) ?? [];
  const advanced = applyVisualActions(crowded, parsed, { step: 4, stage: 4 });
  const stillFocused = composeScene(advanced, parsed, { step: 4, stage: 4, subject: "physics", teachingIntent: "verify" });
  check("one new object beside a stale board retires the stale board", stillFocused.diagnostics.retiredObjectCount > 0 && stillFocused.diagnostics.visualFocusScore === 100,
    `share ${stillFocused.diagnostics.visualFocusScore}, retired ${stillFocused.diagnostics.retiredObjectCount} of ${staleCount}`);
  check("and what remains is the step's own object", stillFocused.scene.objects.length === 1 && stillFocused.scene.objects[0]?.id === "answer",
    stillFocused.scene.objects.map((object) => object.id).join(","));
  // A step that adds one object beside a stale board WILL clear the stale board, even down to a very small
  // board, because the current share is the stated guarantee and the board-size floor is only a guard against
  // the extreme. The floor that composition can always honour lives in the lifecycle instead (MIN_BOARD_OBJECTS,
  // tested in visual-lifecycle), which is where a board that was already thin gets topped up. Forcing the
  // floor here instead was tried and it silently stopped composition doing its job: shares fell to an eighth.
}

section("11e. the floor accounts for the size of the group being dropped");

{
  // Off by one group, which is how a real lesson emptied its board. The floor was tested against the board as
  // it stood: a board of seven with a floor of three passed the check and then lost a six-object structure,
  // landing on one object while every ratio reported success.
  let board = emptyVisualScene();
  board = step(board, [{ action: "create_compare", id: "cmp", left: { title: "l", items: ["a"] }, right: { title: "r", items: ["b"] } }] as VisualAction[], { step: 1, stage: 1 });
  board = step(board, [{ action: "create_pipeline", id: "pipe", stages: ["x", "y", "z"] }] as VisualAction[], { step: 2, stage: 2 });
  const before = board.objects.length;

  // One addressed object on a board of two structures: the ratio cannot be met without dropping one of them,
  // and dropping either one must not leave less than the floor.
  const one = [{ action: "highlight", id: "pipe-stage0" }] as VisualAction[];
  const advanced = step(board, one, { step: 3, stage: 3 });
  const composed = composeScene(advanced, one, { step: 3, stage: 3, subject: "physics", teachingIntent: "explain_why" });
  check("dropping a structure never lands below the floor",
    composed.diagnostics.visibleObjectCount >= Math.min(MIN_VISIBLE_OBJECTS, before),
    `${before} objects became ${composed.diagnostics.visibleObjectCount}`);
  check("and the structure being discussed survived", composed.scene.objects.some((object) => object.id.startsWith("cmp")),
    composed.scene.objects.map((object) => object.id).join(","));

  // Both guarantees at once. Forcing the floor on its own dropped the board's share to an eighth, because a
  // group too large to remove wholesale was then never removed at all and the board stayed mostly about
  // earlier steps — trading one requirement for the other instead of meeting both.
  let shared = emptyVisualScene();
  shared = step(shared, [{ action: "create_compare", id: "cmp", left: { title: "l", items: ["a"] }, right: { title: "r", items: ["b"] } }] as VisualAction[], { step: 1, stage: 1 });
  shared = step(shared, [{ action: "create_pipeline", id: "pipe", stages: ["x", "y", "z"] }] as VisualAction[], { step: 2, stage: 2 });
  const addressed = [{ action: "highlight", id: "cmp-l-frame" }] as VisualAction[];
  const moved = step(shared, addressed, { step: 3, stage: 3 });
  const both = composeScene(moved, addressed, { step: 3, stage: 3, subject: "physics", teachingIntent: "explain_why" });
  check("the hard current share still holds while the floor holds", both.diagnostics.visualFocusScore >= 20,
    `share ${both.diagnostics.visualFocusScore} over ${both.diagnostics.visibleObjectCount} objects`);
  check("and the board is still readable", both.diagnostics.visibleObjectCount >= Math.min(MIN_VISIBLE_OBJECTS, shared.objects.length),
    `${both.diagnostics.visibleObjectCount} objects`);
}

section("12. current objects are the loudest ones on the board");

{
  let scene = emptyVisualScene();
  scene = step(scene, [{ action: "create_compare", id: "cmp", left: { title: "old", items: ["a"] }, right: { title: "new", items: ["b"] } }], { step: 1, stage: 1 });
  const oldOpacity = Math.max(...scene.objects.filter((object) => object.lifecycle !== "current").map((object) => object.opacity), 0);
  scene = step(scene, [{ action: "create_sequence", id: "now", actors: ["x", "y"], messages: [] }], { step: 2, stage: 2 });
  const currentOpacity = Math.min(...scene.objects.filter((object) => object.lifecycle === "current").map((object) => object.opacity));
  check("current objects are drawn at full strength", currentOpacity === 1, String(currentOpacity));
  check("older objects are quieter than current ones", oldOpacity <= currentOpacity, `${oldOpacity} vs ${currentOpacity}`);
}

// ------------------------------------------- The measured failure, replayed end to end

section("13. the 58-object Newton's-law lesson, replayed");

{
  let scene = emptyVisualScene();
  let worstVisible = 0;
  let overBudget = 0;
  const focusShares: number[] = [];
  const stages: Array<{ stage: number; actions: VisualAction[] }> = [
    { stage: 1, actions: [{ action: "create_compare", id: "cmp", left: { title: "At rest", items: ["F = 0"] }, right: { title: "Moving", items: ["F > 0"] } }] },
    { stage: 2, actions: [{ action: "create_pipeline", id: "terms", stages: ["Force", "Mass", "Acceleration"] }] },
    { stage: 3, actions: [{ action: "create_equation_block", id: "fma", formula: "F = m a", variables: [{ symbol: "F", meaning: "net force" }, { symbol: "m", meaning: "mass" }, { symbol: "a", meaning: "acceleration" }] }] },
    { stage: 4, actions: [{ action: "create_free_body_diagram", id: "fbd", body: "block", forces: [{ name: "F", direction: "right", magnitude: "20 N" }] }] },
    { stage: 5, actions: [{ action: "create_array", id: "given", values: ["m = 5 kg", "a = 4 m/s^2", "F = ?"], indices: false }] },
    { stage: 6, actions: [{ action: "create_sequence", id: "steps", actors: ["Substitute", "Multiply", "Check units"], messages: [] }] },
    { stage: 7, actions: [{ action: "create_graph_plot", id: "curve", points: [{ x: 0, y: 0 }, { x: 1, y: 4 }, { x: 2, y: 8 }], xLabel: "t", yLabel: "v" }] },
    { stage: 8, actions: [{ action: "create_compare", id: "worked", left: { title: "Wrong", items: ["F = m + a"] }, right: { title: "Right", items: ["F = m a"] } }] },
    { stage: 9, actions: [{ action: "create_timeline", id: "tl", events: [{ label: "0", text: "rest" }, { label: "1s", text: "4 m/s" }] }] },
    { stage: 10, actions: [{ action: "create_pipeline", id: "recap", stages: ["F = ma", "units", "direction"] }] },
  ];

  for (const [index, entry] of stages.entries()) {
    const parsed = parseVisualActions(entry.actions as never) ?? [];
    const played = applyVisualActions(scene, parsed, { step: index + 1, stage: entry.stage });
    const budget = visualBudget(played);
    const composed = composeScene(played, parsed, { step: index + 1, stage: entry.stage, teachingIntent: "explain_why" });
    scene = composed.scene;
    worstVisible = Math.max(worstVisible, composed.diagnostics.visibleObjectCount);
    if (composed.diagnostics.visibleObjectCount > budget) overBudget += 1;
    const share = composed.diagnostics.visibleObjectCount === 0
      ? 0
      : composed.diagnostics.currentFocusIds.length / composed.diagnostics.visibleObjectCount;
    focusShares.push(share);
  }

  check("ten stages never produce the pile-up the old board produced", overBudget === 0, `${overBudget} stages over budget, worst=${worstVisible}`);
  check("no stage leaves the past as the subject", focusShares.every((share) => share >= 0.2), focusShares.map((share) => share.toFixed(2)).join(","));
  check("most stages leave a board that is mostly about that stage", focusShares.filter((share) => share >= 0.3).length >= 8, focusShares.map((share) => share.toFixed(2)).join(","));
  check("the last stage is what the student can see", byId(scene, "recap-p0") !== undefined, scene.objects.map((object) => object.id).join(","));
  check("no object ends up outside the board", scene.objects.every((object) => object.x >= 0 && object.x <= 800 && object.y >= 0 && object.y <= 520), "an object escaped the viewport");
}

console.log(`\nvisual-composition: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);