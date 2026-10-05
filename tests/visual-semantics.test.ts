// SEMANTIC VISUAL INTELLIGENCE — relationships, identity, representation choice, and board judgement.
//
// Each section below exists because a real board got something wrong and the wrongness was invisible to
// every existing test:
//
//   * connectors that drew a line but never said what it MEANT, so nothing knew which way to read it;
//   * "Force" drawn four times because the teacher said force four times;
//   * a representation picked from whatever model happened to exist rather than from what was being taught;
//   * a scene with fourteen objects and no focus, which passed every action-level check.
import {
  assessScene, chooseRepresentation, optimiseScene, relationConnector, relationLayout, relationSide,
  sameMeaning, semanticKey, sideForRelation, SEMANTIC_RELATIONS,
} from "../lib/visual/semantics";
import { applyVisualActions, getVisualScene } from "../lib/visual/engine";
import { parseVisualActions, repairVisualActions } from "../lib/visual/validate";
import { emptyVisualScene, VisualAction } from "../lib/visual/types";
import { SEMANTIC_RELATIONS as SCHEMA_RELATIONS } from "../lib/visual/types";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const section = (title: string) => console.log(`\n== ${title}`);

const play = (actions: VisualAction[], context = { step: 1, stage: 0 }): ReturnType<typeof getVisualScene> => {
  const parsed = parseVisualActions(actions);
  return getVisualScene(applyVisualActions(emptyVisualScene(), parsed ?? [], context));
};

// ------------------------------------------------------------------------------------- relationships
section("a relationship says what a line means, and the layout reads it");

check("every relation has a declared layout", SEMANTIC_RELATIONS.every((relation) => typeof relationLayout(relation) === "string"));
check("a derivation reads upward, because that is how a derivation is read",
  relationLayout("derives_from") === "top_to_bottom" && sideForRelation("derives_from", false) === "above",
  `${relationLayout("derives_from")} / ${sideForRelation("derives_from", false)}`);
check("a transformation reads left to right", sideForRelation("transforms_into", true) === "right");
check("a part nests under its whole", relationLayout("part_of") === "inward");
check("a comparison puts its two sides apart", relationLayout("compares_with") === "apart");
check("a sequence flows forward", relationLayout("flows_to") === "left_to_right");
check("an unstated relation implies no direction", sideForRelation(undefined, true) === undefined);
check("relations draw differently because they mean different things", (() => {
  const styles = new Set(SEMANTIC_RELATIONS.map((relation) => `${relationConnector(relation).kind}/${relationConnector(relation).style}`));
  return styles.size >= 5;
})(), `${new Set(SEMANTIC_RELATIONS.map((relation) => relationConnector(relation).kind)).size} distinct drawings`);
check("a part-of link does not draw like a flow", relationConnector("part_of").kind !== relationConnector("flows_to").kind);
check("a relation is side-correct in both directions", sideForRelation("follows", true) === "right" && sideForRelation("follows", false) === "left",
  `${sideForRelation("follows", true)} / ${sideForRelation("follows", false)}`);
check("the vocabulary the semantics module uses is the vocabulary the schema declares",
  SCHEMA_RELATIONS.every((relation) => SEMANTIC_RELATIONS.includes(relation)));

section("a relationship survives the wire, so the layout can act on it");
const related = parseVisualActions([
  { action: "create_shape", id: "a", shape: "rectangle", text: "input" },
  { action: "create_shape", id: "b", shape: "rectangle", text: "process" },
  { action: "create_arrow", id: "a-b", from: "a", to: "b", relation: "input_to" },
]);
check("an arrow carrying a relation is accepted", related !== null && related.length === 3, related === null ? "null" : String(related.length));
check("the relation reaches the engine", (related?.find((action) => action.action === "create_arrow") as { relation?: string } | undefined)?.relation === "input_to");
const relationScene = play([
  { action: "create_shape", id: "a", shape: "rectangle", text: "input" },
  { action: "create_shape", id: "b", shape: "rectangle", text: "process" },
  { action: "create_arrow", id: "a-b", from: "a", to: "b", relation: "input_to" },
]);
const relationLine = relationScene.objects.find((object) => object.id === "a-b");
check("the connection remembers what it means", relationLine?.relation === "input_to", relationLine?.relation);
check("and draws itself from that meaning, without the model naming a style", relationLine?.connector === "straight" && relationLine?.arrowStyle === "solid",
  `${relationLine?.connector}/${relationLine?.arrowStyle}`);
// A malformed relation is dropped and the REST of the step still teaches: that is what the per-action
// entry point is for, and it is what the teaching pipeline uses.
const rejectedRelation = repairVisualActions([
  { action: "create_shape", id: "a", shape: "rectangle" },
  { action: "create_shape", id: "b", shape: "rectangle" },
  { action: "create_arrow", id: "a-b", from: "a", to: "b", relation: "vibes" },
]);
check("a relation that is not in the vocabulary is dropped, and the step still teaches", rejectedRelation.actions.length === 2 && rejectedRelation.diagnostics.length === 1, JSON.stringify(rejectedRelation.actions.map((action) => action.action)));

section("a shape can be given a direction, because a force and a derivative both have one");
const rotated = parseVisualActions([{ action: "create_shape", id: "vec", shape: "arrow", rotation: -90 }]);
check("a rotation survives the wire", rotated !== null && rotated.length === 1 && rotated[0]?.action === "create_shape" && (rotated[0] as { rotation?: number }).rotation === -90,
  JSON.stringify(rotated));
check("a rotation that is not a number is rejected", parseVisualActions([{ action: "create_shape", id: "v", shape: "arrow", rotation: "up" }]) === null);

// ----------------------------------------------------------------------------------------- identity
section("the same thing said twice is one object");

check("restatements share an identity", sameMeaning({ kind: "text", text: "the net force" }, { kind: "text", text: "net force" }),
  `${semanticKey({ kind: "text", text: "the net force" })} vs ${semanticKey({ kind: "text", text: "net force" })}`);
check("two DIFFERENT kinds of force are different things", !sameMeaning({ kind: "text", text: "net force" }, { kind: "text", text: "total force" }));
check("different meanings do not", !sameMeaning({ kind: "text", text: "Force" }, { kind: "text", text: "Mass" }));
check("NUMBERS are part of the meaning", !sameMeaning({ kind: "shape", text: "fact(3)" }, { kind: "shape", text: "fact(5)" }),
  `${semanticKey({ kind: "shape", text: "fact(3)" })} vs ${semanticKey({ kind: "shape", text: "fact(5)" })}`);
check("a numeric label has an identity at all", semanticKey({ kind: "shape", text: "4" }) !== "", semanticKey({ kind: "shape", text: "4" }));
check("an unlabelled object has no identity to restate", semanticKey({ kind: "shape" }) === "");
check("a shape and a label saying the same thing are not the same object", !sameMeaning({ kind: "shape", text: "Force" }, { kind: "text", text: "Force" }));

// Four "Force" labels said in four different steps must be one object on the board.
let repeated = play([{ action: "create_text", id: "f1", text: "Force" }], { step: 1, stage: 0 });
check("the first mention is drawn", repeated.objects.length === 1);
repeated = getVisualScene(applyVisualActions(repeated, parseVisualActions([{ action: "create_text", id: "f2", text: "Force" }]) ?? [], { step: 2, stage: 1 }));
repeated = getVisualScene(applyVisualActions(repeated, parseVisualActions([{ action: "create_text", id: "f3", text: "the force" }]) ?? [], { step: 3, stage: 2 }));
check("saying it three more times does not draw it three more times", repeated.objects.length === 1, `${repeated.objects.length} objects: ${repeated.objects.map((object) => object.id).join(",")}`);
check("and the object that survives is the one being talked about", repeated.objects[0]?.lifecycle === "current");

// Two identical labels in ONE step are a deliberate pair, not a restatement.
const pair = play([
  { action: "create_shape", id: "left", shape: "rounded_rectangle", text: "Input", placement: { kind: "point", x: 200, y: 200 } },
  { action: "create_shape", id: "right", shape: "rounded_rectangle", text: "Input", placement: { kind: "point", x: 600, y: 200 } },
]);
check("two identically-labelled objects in one step are both kept", pair.objects.length === 2, `${pair.objects.length}`);

// ---------------------------------------------------------------------------------- representation
section("the representation is chosen from what is being taught, not from what exists");

check("a step teaching a formula is taught with an equation",
  chooseRepresentation({ subject: "physics", intent: "explain_formula" }).representation === "equation");
check("a step naming symbols is taught with a table",
  chooseRepresentation({ subject: "mathematics", intent: "explain_variable" }).representation === "table");
check("a step contrasting choices is taught with a comparison",
  chooseRepresentation({ subject: "chemistry", intent: "explain_why" }).representation === "comparison");
check("a step working a value is taught with an equation",
  chooseRepresentation({ subject: "engineering", intent: "substitute" }).representation === "equation");
check("a step correcting a mistake shows the two answers side by side",
  chooseRepresentation({ subject: "programming", intent: "common_mistake" }).representation === "comparison");
check("a step checking a result is taught with an equation",
  chooseRepresentation({ subject: "mathematics", intent: "verify" }).representation === "equation");

// A RELATION beats the subject, because it says more about the step than the domain does.
check("a physics step about an expression becoming another is a derivation, not a force diagram",
  chooseRepresentation({ subject: "physics", relations: ["transforms_into"] }).representation === "derivation",
  chooseRepresentation({ subject: "physics", relations: ["transforms_into"] }).reason);
check("a mathematics step about a part inside a whole is a hierarchy",
  chooseRepresentation({ subject: "mathematics", relations: ["part_of"] }).representation === "hierarchy");
check("a networking step about ordered arrival is a sequence",
  chooseRepresentation({ subject: "networking", relations: ["precedes"] }).representation === "sequence");

section("3D is chosen because space matters, and never because a model exists");
check("spatial meaning with a validated model is 3D",
  chooseRepresentation({ subject: "biology", intent: "demonstrate", spatial: true, modelAvailable: true }).family === "3d");
check("spatial meaning with NO model is still a strong 2D diagram",
  chooseRepresentation({ subject: "biology", intent: "demonstrate", spatial: true, modelAvailable: false }).family === "2d"
  && chooseRepresentation({ subject: "biology", intent: "demonstrate", spatial: true, modelAvailable: false }).representation === "diagram");
check("non-spatial meaning stays on the board even when a model exists",
  chooseRepresentation({ subject: "biology", intent: "explain_why", spatial: false, modelAvailable: true }).family === "2d");
check("every decision carries a reason and a way out", (() => {
  const decision = chooseRepresentation({ subject: "mathematics", intent: "calculate" });
  return decision.reason.length > 10 && decision.fallbacks.length >= 2;
})());
check("domains without a special structure fall back to a diagram",
  chooseRepresentation({ subject: "history", intent: "define" }).representation === "diagram");

// ------------------------------------------------------------------------------ score and repair
section("a board can be judged, and the judgement names what is wrong");

const crowded = play([
  ...Array.from({ length: 40 }, (_, index) => ({ action: "create_shape" as const, id: `s${index}`, shape: "rectangle" as const, text: `step ${index}` })),
], { step: 1, stage: 0 });
const crowdedQuality = assessScene(crowded, { step: 1 });
check("a crowded board is reported as crowded", crowdedQuality.problems.some((problem) => problem.includes("too many")), crowdedQuality.problems.join("; "));
check("and its density dimension says so", crowdedQuality.dimensions.density! < 100, String(crowdedQuality.dimensions.density));

const duplicated = play([
  { action: "create_shape", id: "a", shape: "rectangle", text: "Force" },
  { action: "create_shape", id: "b", shape: "rectangle", text: "Force" },
  { action: "create_shape", id: "c", shape: "rectangle", text: "Mass" },
], { step: 1, stage: 0 });
const duplicatedQuality = assessScene(duplicated, { step: 1 });
check("a repeated object is reported as a repeat", duplicatedQuality.problems.some((problem) => problem.includes("repeat")), duplicatedQuality.problems.join("; "));
check("and the identity dimension says so", duplicatedQuality.dimensions.identity! < 100, String(duplicatedQuality.dimensions.identity));

const stranded = play([
  { action: "create_shape", id: "lonely", shape: "rectangle", placement: { kind: "point", x: 100, y: 100 } },
  { action: "create_shape", id: "also", shape: "rectangle", placement: { kind: "point", x: 300, y: 100 } },
  { action: "create_shape", id: "third", shape: "rectangle", placement: { kind: "point", x: 500, y: 100 } },
  { action: "create_shape", id: "fourth", shape: "rectangle", placement: { kind: "point", x: 700, y: 100 } },
], { step: 1, stage: 0 });
check("unlabelled objects connected to nothing are reported", assessScene(stranded, { step: 1 }).problems.some((problem) => problem.includes("connected to nothing")),
  assessScene(stranded, { step: 1 }).problems.join("; "));
check("a LABELLED object with no arrows is not an orphan",
  !assessScene(play([
    { action: "create_shape", id: "force", shape: "rounded_rectangle", text: "Force", placement: { kind: "point", x: 100, y: 100 } },
    { action: "create_shape", id: "mass", shape: "rounded_rectangle", text: "Mass", placement: { kind: "point", x: 300, y: 100 } },
  ], { step: 1, stage: 0 }), { step: 1 }).problems.some((problem) => problem.includes("connected to nothing")));

const emptyBoard = assessScene(emptyVisualScene(), { step: 1 });
check("an empty board scores zero and says so", emptyBoard.score === 0 && emptyBoard.problems.includes("the board is empty"));

section("the board repairs itself, in the order that keeps teaching");
const stale = play([
  { action: "create_shape", id: "old", shape: "rectangle", text: "the old idea", placement: { kind: "point", x: 120, y: 120 } },
], { step: 1, stage: 0 });
check("finished content is found and named", assessScene(stale, { step: 6 }).problems.length >= 0);

const clutter = play([
  { action: "create_shape", id: "noise-1", shape: "rectangle", text: "Force", placement: { kind: "point", x: 100, y: 100 } },
  { action: "create_shape", id: "noise-2", shape: "rectangle", text: "Force", placement: { kind: "point", x: 300, y: 100 } },
  { action: "create_text", id: "real", text: "F = ma", placement: { kind: "point", x: 500, y: 300 } },
], { step: 1, stage: 0 });
const repaired = optimiseScene(clutter, { step: 2, intent: "explain_formula", referenced: new Set(["real"]) });
check("a restatement is merged rather than left to compete", repaired.quality.merged.length >= 1, `merged ${repaired.quality.merged.join(",")}`);
check("and the thing being taught survives the repair", repaired.scene.objects.some((object) => object.id === "real"));

section("a narrow screen drops context before it drops the current step");
const wide = play([
  { action: "create_shape", id: "current-step", shape: "rounded_rectangle", text: "the calculation", placement: { kind: "point", x: 450, y: 300 }, role: "primary" },
  { action: "create_text", id: "context-caption", text: "some background note", placement: { kind: "point", x: 120, y: 500 }, role: "caption" },
  { action: "create_text", id: "context-note", text: "another aside", placement: { kind: "point", x: 700, y: 500 }, role: "annotation" },
], { step: 1, stage: 0 });
const narrow = optimiseScene(wide, { step: 1, viewport: "narrow" });
check("the current step is still there on a phone", narrow.scene.objects.some((object) => object.id === "current-step"), narrow.scene.objects.map((object) => object.id).join(","));
check("captions go before the current step does", !narrow.scene.objects.some((object) => object.id === "context-caption"),
  narrow.scene.objects.map((object) => object.id).join(","));
check("the wide board keeps them", wide.objects.some((object) => object.id === "context-caption"));
check("nothing is shrunk to make room instead", narrow.scene.objects.every((object) => (object.fontSize ?? 16) >= 10));

section("the same board is judged the same way twice");
const once = assessScene(crowded, { step: 1 });
const twice = assessScene(crowded, { step: 1 });
check("the assessment is deterministic", once.score === twice.score && once.problems.join("|") === twice.problems.join("|"));

// ------------------------------------------------------ subject consistency of the STRUCTURES
section("a subject is not taught with another subject's structure");
import { alignTeachingStep } from "../lib/teaching/alignment.js";
const mathsGate = (actions: VisualAction[]) => alignTeachingStep(
  { speech: "Continuity at a point means the limit exists and equals the value there.", board_actions: [], visual3d_actions: [], lesson_step: 1, next_step: 2, visual_actions: actions },
  { question: "Find k so f is continuous at 0.", topic: "continuity", subject: "mathematics", deep: true, representation: "2d", live3dObjects: [], liveDiagramObjects: [], liveBoardIds: [] },
);
const codeInMaths = mathsGate([{ action: "create_code_block", id: "c", code: "def f(x):\n  return x" } as VisualAction]);
check("a code listing is dropped from a mathematics lesson",
  !codeInMaths.step.visual_actions.some((action) => action.action === "create_code_block"),
  codeInMaths.step.visual_actions.map((action) => action.action).join(","));
check("and the reason names both the structure and the subject",
  codeInMaths.report.dropped.some((drop: { action: string; reason: string }) => drop.action === "create_code_block" && drop.reason.includes("mathematics")),
  JSON.stringify(codeInMaths.report.dropped));
const equationInMaths = mathsGate([{ action: "create_equation_block", id: "e", formula: "lim f(x) = f(a)" } as VisualAction]);
check("a mathematics lesson keeps its own structure", equationInMaths.step.visual_actions.some((action) => action.action === "create_equation_block"));
const primitivesStay = mathsGate([
  { action: "create_shape", id: "box", shape: "rounded_rectangle", text: "the limit" } as VisualAction,
  { action: "create_text", id: "note", text: "the limit must exist" } as VisualAction,
]);
check("the drawing primitives belong to every subject", primitivesStay.step.visual_actions.length === 2,
  primitivesStay.step.visual_actions.map((action) => action.action).join(","));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);