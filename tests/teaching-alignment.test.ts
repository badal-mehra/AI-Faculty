// EDUCATIONAL ALIGNMENT — the gate, and the quality verdict it produces.
//
// These tests exist because every failure they cover was a RESPONSE THAT WAS PERFECTLY VALID. A box for a
// lesson about the heart, a ventricle highlighted on an object with no parts, an `update_array` aimed at a
// stack, a step that said "let's visualise this" and drew nothing: all of them passed schema validation,
// loaded without error, painted something, and taught nothing. A test that only checks the shape of a
// response cannot see any of it.
import { assetForPhrase, assetIdsIn, bestAssetFor, calledSequence, conceptsIn, enumeratedItems, identifierPhrase, labelFromId, partsMentioned, speechShape } from "../lib/teaching/concepts";
import { alignTeachingStep, representationFromSpeech, AlignmentContext } from "../lib/teaching/alignment";
import { alignAndJudge, summariseQuality } from "../lib/teaching/quality";
import { buildLessonObjective, createLessonProgress, applyStepsToProgress } from "../lib/teaching/objective";
import { buildPrompt, visualFamiliesFor, lessonRepresentation, representationForRequest } from "../lib/teaching/prompt";
import { detectRepresentationIntent } from "../lib/teaching/representation";
import { emptyBoardState } from "../lib/board/types";
import { emptyVisualScene } from "../lib/visual/types";
import { emptyVisual3DScene } from "../lib/visual3d/types";
import { TeachingRequest, TeachingResponse } from "../lib/teaching/types";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};

const request = (overrides: Partial<TeachingRequest> = {}): TeachingRequest => ({
  question: "Explain the human heart and how blood circulates through it.",
  language: "English",
  lessonStep: 1,
  boardState: emptyBoardState(),
  visualState: emptyVisualScene(),
  visualState3d: emptyVisual3DScene(),
  previousTeaching: [],
  ...overrides,
});

const step = (overrides: Partial<TeachingResponse> = {}): TeachingResponse => ({
  speech: "The heart is a muscle that pumps blood. It has four chambers, and each one does a different job on every beat.",
  board_actions: [],
  visual_actions: [],
  visual3d_actions: [],
  lesson_step: 1,
  next_step: 2,
  ...overrides,
});

const context = (overrides: Partial<AlignmentContext> = {}): AlignmentContext => ({
  question: "Explain the human heart and how blood circulates through it.",
  topic: "human heart",
  subject: "biology",
  deep: true,
  representation: "3d",
  live3dObjects: [],
  liveDiagramObjects: [],
  liveBoardIds: [],
  ...overrides,
});

// ---------------------------------------------------------------------------------- semantic concepts
console.log("\n== semantic concepts are derived from the registry, not from a topic list");

check("a headline term resolves to its asset", assetForPhrase("heart") === "biology/heart", String(assetForPhrase("heart")));
check("a hyphenated asset name resolves", assetForPhrase("blood vessel") === "biology/blood-vessel", String(assetForPhrase("blood vessel")));
check("a fragment of a multi-word name does NOT resolve",
  assetForPhrase("vessel") === undefined, String(assetForPhrase("vessel")));
check("a concept is subject-restricted when asked to be",
  assetForPhrase("heart", { requiredCategory: "physics" }) === undefined, String(assetForPhrase("heart", { requiredCategory: "physics" })));
check("an unrelated subject's assets are invisible to a subject-restricted lookup",
  bestAssetFor("the human heart", { requiredCategory: "chemistry" }) === undefined, String(bestAssetFor("the human heart", { requiredCategory: "chemistry" })));
check("a topic with no asset returns no asset", bestAssetFor("the water cycle") === undefined, String(bestAssetFor("the water cycle")));
check("a named part is found inside its own asset's text", partsMentioned("biology/heart", "the left ventricle pumps").includes("left_ventricle"));
check("concepts in a sentence are ordered strongest first",
  conceptsIn("the heart and its left ventricle")[0]?.assetId === "biology/heart",
  conceptsIn("the heart and its left ventricle").map((entry) => entry.term).join(","));
check("an entity list is de-duplicated", assetIdsIn("heart, heart, blood vessel").length === 2, assetIdsIn("heart, heart, blood vessel").join(","));
check("a numbered object id resolves to its name", assetForPhrase(identifierPhrase("heartModel")) === "biology/heart", identifierPhrase("heartModel"));
check("a chemical symbol keeps its digits", labelFromId("co2") === "Co2", labelFromId("co2"));
check("a numbered instance loses its digits", labelFromId("vessel1") === "Vessel", labelFromId("vessel1"));
check("a wordless id falls back to the topic", labelFromId("box", "matrix multiplication") === "matrix multiplication", labelFromId("box", "matrix multiplication"));
check("a label keeps the word that names the thing", labelFromId("mat_box") === "Mat", labelFromId("mat_box"));

// -------------------------------------------------------------------------------------- the speech itself
console.log("\n== the teacher's own words are enough to recover a representation");

check("an ordered enumeration is recognised", enumeratedItems("First the atrium fills. Second it contracts. Third the blood leaves.").length === 3,
  enumeratedItems("First the atrium fills. Second it contracts. Third the blood leaves.").join(" | "));
check("a colon list is recognised", enumeratedItems("The stages are: evaporation, condensation, precipitation.").length === 3,
  enumeratedItems("The stages are: evaporation, condensation, precipitation.").join(" | "));
check("a sentence with nothing to enumerate yields nothing", enumeratedItems("The heart is a muscle.").length === 0);
check("an exchange is recognised as a sequence", speechShape("The client sends a SYN, the server replies with SYN-ACK.") === "sequence", speechShape("The client sends a SYN, the server replies with SYN-ACK."));
check("a contrast is recognised", speechShape("Whereas the left side is increasing, the right side is decreasing.") === "contrast", speechShape("Whereas the left side is increasing, the right side is decreasing."));
check("a run of calls the teacher walked through is recovered",
  JSON.stringify(calledSequence("When we call countdown(3), it calls countdown(2), which calls countdown(1), and then countdown(0) returns.")) === JSON.stringify(["countdown(3)", "countdown(2)", "countdown(1)", "countdown(0)"]),
  JSON.stringify(calledSequence("When we call countdown(3), it calls countdown(2), which calls countdown(1), and then countdown(0) returns.")));
check("one call is not a trace", calledSequence("A function calls itself with n minus one.").length === 0,
  JSON.stringify(calledSequence("A function calls itself with n minus one.")));

const sequenceFromSpeech = representationFromSpeech(
  "First the client sends SYN. Second the server replies SYN-ACK. Third the client acknowledges.",
  { topic: "TCP handshake", subject: "networking", representation: "2d" },
);
check("a spoken exchange produces a sequence diagram with real parties",
  sequenceFromSpeech?.actions2d[0]?.action === "create_sequence"
  && JSON.stringify(sequenceFromSpeech.actions2d[0]).includes("client")
  && JSON.stringify(sequenceFromSpeech.actions2d[0]).includes("server"),
  JSON.stringify(sequenceFromSpeech?.actions2d[0]));
const noParties = representationFromSpeech("The server replies. Then the client responds.", { topic: "heart", subject: "biology", representation: "2d" });
check("an exchange with no named parties produces nothing rather than Sender/Receiver boxes",
  noParties === null, JSON.stringify(noParties));
const callTrace = representationFromSpeech(
  "When we call countdown(3), it is not finished, so it calls countdown(2), which calls countdown(1), and then countdown(0) returns.",
  { topic: "recursion", subject: "programming", representation: "2d" },
);
check("a code stage whose listing never arrived still shows the run of calls the teacher walked through",
  Boolean(callTrace?.actions2d.some((action) => action.action === "create_pipeline" && JSON.stringify(action).includes("countdown(2)"))),
  JSON.stringify(callTrace?.actions2d));
check("a 2D lesson is never handed a 3D model",
  representationFromSpeech("Explain the human heart.", { topic: "human heart", subject: "biology", representation: "2d" }) === null);
check("a 3D lesson with no model is offered nothing fake",
  representationFromSpeech("It depends on the weather today.", { topic: "weather", subject: "general", representation: "3d" }) === null);

// --------------------------------------------------------------------------------- the gate, pass by pass
console.log("\n== a generic primitive standing in for a real thing is promoted");

const promotedRun = alignTeachingStep(
  step({
    speech: "The heart is a muscular pump with four chambers that push blood around the body in one continuous loop.",
    visual3d_actions: [
      { action: "create_3d_object", id: "heart_model", type: "box" },
      { action: "frame_camera" },
    ],
  }),
  context(),
);
const promotedObject = promotedRun.step.visual3d_actions.find((action) => action.action === "create_3d_object");
check("a box standing in for the heart becomes the real model",
  promotedObject?.action === "create_3d_object" && promotedObject.type === "model" && promotedObject.asset === "biology/heart",
  JSON.stringify(promotedObject));
check("the promotion is reported, not silent", promotedRun.report.promoted.length === 1 && promotedRun.report.notes.some((note) => note.pass === "promote"));

const unpromotable = alignTeachingStep(
  step({
    speech: "The water cycle has three forms: solid ice, liquid water and water vapour, and the sun drives all of it.",
    visual3d_actions: [{ action: "create_3d_object", id: "ice", type: "box" }],
  }),
  context({ question: "Explain the water cycle.", topic: "water cycle", subject: "earth" as never }),
);
const iceObject = unpromotable.step.visual3d_actions.find((action) => action.action === "create_3d_object");
check("a fragment match does not promote: ice never becomes a water droplet",
  iceObject?.action === "create_3d_object" && iceObject.type === "box",
  JSON.stringify(iceObject));
check("an unpromotable primitive is still labelled",
  iceObject?.action === "create_3d_object" && typeof iceObject.label === "string" && iceObject.label.length > 0,
  JSON.stringify(iceObject));

console.log("\n== a part the model does not have is removed instead of silently ignored");

const partRun = alignTeachingStep(
  step({
    speech: "The left ventricle pushes blood out through the aorta into the body, and the septum separates the halves.",
    visual3d_actions: [
      { action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" },
      { action: "highlight_3d_object", id: "heart_model", part: "left_ventricle" },
      { action: "highlight_3d_object", id: "heart_model", part: "portal_vein" },
    ],
  }),
  context(),
);
const highlights = partRun.step.visual3d_actions.filter((action) => action.action === "highlight_3d_object") as Array<{ part?: string }>;
check("a real part survives", highlights.some((action) => action.part === "left_ventricle"), JSON.stringify(highlights));
check("an invented part is removed", !highlights.some((action) => action.part === "portal_vein"), JSON.stringify(highlights));
check("the repair is counted", partRun.report.repaired === 1, String(partRun.report.repaired));

const partOnPrimitive = alignTeachingStep(
  step({
    speech: "The concept sits at the centre and matters, because everything else depends on it.",
    visual3d_actions: [
      { action: "create_3d_object", id: "marker", type: "sphere", label: "Concept" },
      { action: "isolate_part", id: "marker", part: "left_ventricle" },
      { action: "highlight_3d_object", id: "marker", part: "left_ventricle" },
    ],
  }),
  context(),
);
check("isolate_part on a primitive with no parts is dropped entirely",
  !partRun.step.visual3d_actions.some((action) => action.action === "isolate_part" && action.id === "marker")
  && !partOnPrimitive.step.visual3d_actions.some((action) => action.action === "isolate_part"),
  JSON.stringify(partOnPrimitive.step.visual3d_actions));
check("highlight on a primitive keeps its highlight but loses the fictional part",
  partOnPrimitive.step.visual3d_actions.some((action) => action.action === "highlight_3d_object" && action.id === "marker" && !("part" in action)),
  JSON.stringify(partOnPrimitive.step.visual3d_actions));

console.log("\n== an action that addresses nothing is not a drawing");

const wrongTarget = alignTeachingStep(
  step({
    speech: "Recursion works by making the call stack hold one frame per call, and the base case stops it.",
    visual_actions: [
      { action: "create_stack", id: "call_stack", values: ["fact(3)"], topLabel: "top" },
      { action: "update_array", id: "call_stack", values: ["fact(3)", "fact(2)"] },
      { action: "highlight", id: "nowhere" },
    ],
  }),
  context({ representation: "2d", subject: "programming", topic: "recursion", question: "Explain recursion." }),
);
check("update_array aimed at a stack is dropped",
  !wrongTarget.step.visual_actions.some((action) => action.action === "update_array"),
  JSON.stringify(wrongTarget.step.visual_actions.map((action) => action.action)));
check("an array mutator aimed at a real array is kept",
  alignTeachingStep(step({
    speech: "Now the middle value is compared against the target and the array halves in size each time.",
    visual_actions: [{ action: "create_array", id: "values", values: ["1", "2", "3", "4"] }, { action: "update_array", id: "values", values: ["1", "2", "3"] }],
  }), context({ representation: "2d", subject: "programming", topic: "binary search", question: "Explain binary search." })).step.visual_actions.some((action) => action.action === "update_array"));
check("highlight aimed at nothing is dropped",
  !wrongTarget.step.visual_actions.some((action) => action.action === "highlight"),
  JSON.stringify(wrongTarget.step.visual_actions.map((action) => action.action)));
check("the real structure survives", wrongTarget.step.visual_actions.some((action) => action.action === "create_stack"));
check("every drop is reported with a reason",
  wrongTarget.report.dropped.length === 2 && wrongTarget.report.dropped.every((entry) => entry.reason.length > 0),
  JSON.stringify(wrongTarget.report.dropped));

// The layout compiler names a structure's parts deterministically, so pointing at one of them later is
// addressed — and a gate that does not know those names would drop a correct action as malformed.
const partTargets = alignTeachingStep(step({
  speech: "Third stage is where the result appears, so look at it now, then compare it with the first stage.",
  visual_actions: [
    { action: "create_pipeline", id: "walkthrough", stages: ["Read the input", "Compare the middle", "Report the result"] },
    { action: "highlight", id: "walkthrough-p2" },
  ],
}), context({ representation: "2d", subject: "mathematics", topic: "binary search", question: "Explain binary search." }));
check("a reference to a named part of a structure is recognised",
  partTargets.step.visual_actions.some((action) => action.action === "highlight"),
  JSON.stringify(partTargets.report.dropped));

const retargeted = alignTeachingStep(
  step({
    speech: "The left ventricle is the thickest chamber, and the aorta carries the blood away from it.",
    visual3d_actions: [
      { action: "highlight_3d_object", id: "heartMain", part: "left_ventricle" },
      { action: "show_3d_label", id: "lv", target: "heartMain", text: "Left ventricle", part: "left_ventricle" },
    ],
  }),
  context({ live3dObjects: [{ id: "heart_model", asset: "biology/heart" }, { id: "blood_vessel", asset: "biology/blood-vessel" }] }),
);
check("a mistyped object name is retargeted to the one it can only have meant",
  retargeted.step.visual3d_actions.some((action) => action.action === "highlight_3d_object" && action.id === "heart_model"),
  JSON.stringify(retargeted.step.visual3d_actions));

console.log("\n== the part the teacher names is the part on the board");

const labelledRun = alignTeachingStep(
  step({
    speech: "The right atrium receives blood from the body through the vena cava, and the left ventricle pushes it out through the aorta.",
    visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }],
  }),
  context(),
);
const autoLabels = labelledRun.step.visual3d_actions.filter((action) => action.action === "show_3d_label") as Array<{ part?: string; text: string }>;
check("named parts are labelled from the speech itself",
  autoLabels.some((action) => action.part === "right_atrium") && autoLabels.some((action) => action.part === "left_ventricle"),
  autoLabels.map((action) => action.part).join(","));
const labelText = (text: string) => text.toLowerCase();
check("the label text is the human name, not the internal anchor",
  autoLabels.some((action) => labelText(action.text) === "right atrium"),
  autoLabels.map((action) => action.text).join(","));
check("labelling is bounded so a step cannot flood the stage", autoLabels.length <= 3, String(autoLabels.length));

console.log("\n== an empty step gets a representation taken from what the teacher said");

const emptyStep = alignTeachingStep(
  step({
    speech: "Water moves through three stages in this loop. First evaporation lifts it into the air. Second condensation forms cloud. Third precipitation returns it to the ground.",
    visual3d_actions: [],
    visual_actions: [],
  }),
  context({ representation: "2d", question: "Explain the water cycle.", topic: "water cycle", subject: "general" }),
);
check("a step that taught nothing visually is given the ordered steps it just enumerated",
  emptyStep.step.visual_actions.some((action) => action.action === "create_pipeline")
  && emptyStep.report.representationAdded !== null,
  JSON.stringify(emptyStep.step.visual_actions.map((action) => action.action)));
check("the substituted representation is reported", emptyStep.report.notes.some((note) => note.pass === "representation"));

const empty3dStep = alignTeachingStep(
  step({
    speech: "It depends on the weather today, and nothing about it can be drawn.",
    visual3d_actions: [],
    visual_actions: [],
  }),
  context({ question: "Explain the water cycle.", topic: "water cycle", subject: "general" }),
);
check("a step with nothing drawable in it is left honest rather than decorated",
  empty3dStep.step.visual3d_actions.length === 0 && empty3dStep.step.visual_actions.length === 0,
  JSON.stringify(empty3dStep.step.visual3d_actions));

const alreadyDrawn = alignTeachingStep(
  step({
    speech: "First evaporation lifts it into the air. Second condensation forms cloud. Third precipitation returns it to the ground.",
    visual3d_actions: [{ action: "create_3d_object", id: "leaf", type: "model", asset: "biology/leaf" }, { action: "frame_camera" }],
  }),
  context(),
);
check("a step that already drew something real is not given a second copy of it",
  alreadyDrawn.step.visual3d_actions.filter((action) => action.action === "create_3d_object" && action.asset === "biology/leaf").length === 1,
  JSON.stringify(alreadyDrawn.step.visual3d_actions.map((action) => (action as { asset?: string }).asset ?? "")));
check("no process diagram is stacked on top of a working 3D step",
  !alreadyDrawn.step.visual_actions.some((action) => action.action === "create_pipeline"),
  JSON.stringify(alreadyDrawn.step.visual_actions.map((action) => action.action)));

console.log("\n== a step must end on a board the student can see");

const closeUp = alignTeachingStep(
  step({
    speech: "Now look closely at the chloroplast itself, because that is where the light is captured and turned into sugar.",
    visual3d_actions: [
      { action: "create_3d_object", id: "leaf", type: "model", asset: "biology/leaf" },
      { action: "create_3d_object", id: "cell", type: "model", asset: "biology/plant-cell" },
      { action: "frame_camera", target: "cell" },
    ],
  }),
  context(),
);
const frames = closeUp.step.visual3d_actions.filter((action) => action.action === "frame_camera");
check("a close-up is still followed by a frame of everything the step added",
  frames.length === 2 && !("target" in frames[frames.length - 1]),
  JSON.stringify(closeUp.step.visual3d_actions.map((action) => action.action)));
check("the reason is recorded", closeUp.report.notes.some((note) => note.detail.includes("framed everything")), JSON.stringify(closeUp.report.notes));

const alreadyFramed = alignTeachingStep(
  step({
    speech: "Now look closely at the chloroplast itself, because that is where the light is captured and turned into sugar.",
    visual3d_actions: [
      { action: "create_3d_object", id: "leaf", type: "model", asset: "biology/leaf" },
      { action: "frame_camera", target: "leaf" },
      { action: "frame_camera" },
    ],
  }),
  context(),
);
check("a step that already frames everything is not framed twice",
  alreadyFramed.step.visual3d_actions.filter((action) => action.action === "frame_camera").length === 2,
  JSON.stringify(alreadyFramed.step.visual3d_actions.map((action) => action.action)));

console.log("\n== a stage that is wiped and never rebuilt erases the lesson instead of teaching it");

const wipeStep = alignTeachingStep(
  step({
    speech: "So that is the whole lesson, and now the screen is empty again because the summary has nothing new to draw.",
    visual3d_actions: [{ action: "clear_3d_scene" }],
  }),
  context({ live3dObjects: [{ id: "heart_model", asset: "biology/heart" }] }),
);
check("a wipe followed by nothing is dropped",
  !wipeStep.step.visual3d_actions.some((action) => action.action === "clear_3d_scene"),
  JSON.stringify(wipeStep.step.visual3d_actions.map((action) => action.action)));
check("the reason is recorded", wipeStep.report.dropped.some((entry) => entry.reason.includes("erases the lesson")),
  JSON.stringify(wipeStep.report.dropped));

const rebuildStep = alignTeachingStep(
  step({
    speech: "Let us start again with the same organ, this time looking at it from the outside.",
    visual3d_actions: [{ action: "clear_3d_scene" }, { action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }, { action: "frame_camera" }],
  }),
  context({ live3dObjects: [{ id: "heart_model", asset: "biology/heart" }] }),
);
check("a wipe that IS rebuilt is allowed, because that is a legitimate reset",
  rebuildStep.step.visual3d_actions.some((action) => action.action === "clear_3d_scene"),
  JSON.stringify(rebuildStep.step.visual3d_actions.map((action) => action.action)));

console.log("\n== one lesson shows one stage");

const twoFamilies = alignTeachingStep(
  step({
    speech: "Here is the array being searched, and here is the heart being pumped, and both matter to this lesson.",
    visual_actions: [{ action: "create_array", id: "values", values: ["1", "2", "3"] }],
    visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }],
  }),
  context(),
);
check("2D content is removed from a 3D lesson", twoFamilies.step.visual_actions.length === 0, JSON.stringify(twoFamilies.step.visual_actions));
check("the 3D content is kept", twoFamilies.step.visual3d_actions.filter((action) => action.action === "create_3d_object").length === 1,
  JSON.stringify(twoFamilies.step.visual3d_actions.map((action) => action.action)));
check("the removal says why", twoFamilies.report.dropped.some((entry) => entry.reason.includes("never be seen")), JSON.stringify(twoFamilies.report.dropped));

const twoFamilies2d = alignTeachingStep(
  step({
    speech: "Here is the array being searched, drawn as real cells on the board so you can read the indices.",
    visual_actions: [{ action: "create_array", id: "values", values: ["1", "2", "3"] }],
    visual3d_actions: [{ action: "create_3d_object", id: "marker", type: "sphere" }],
  }),
  context({ representation: "2d", subject: "programming", topic: "binary search", question: "Explain binary search." }),
);
check("3D content is removed from a 2D lesson", twoFamilies2d.step.visual3d_actions.length === 0, JSON.stringify(twoFamilies2d.step.visual3d_actions));
check("the 2D content survives", twoFamilies2d.step.visual_actions.length === 1);

console.log("\n== a model from another subject is decoration, not teaching");

const crossSubject = alignTeachingStep(
  step({
    speech: "The heart works like a pump, so imagine a piston engine pushing blood instead of air, driven by the same pressure difference.",
    visual3d_actions: [
      { action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" },
      { action: "create_3d_object", id: "analogy", type: "model", asset: "physics/piston-engine" },
    ],
  }),
  context(),
);
check("another subject's model is removed from a biology lesson",
  !crossSubject.step.visual3d_actions.some((action) => action.action === "create_3d_object" && action.asset === "physics/piston-engine"),
  JSON.stringify(crossSubject.step.visual3d_actions.map((action) => (action as { asset?: string }).asset ?? "")));
check("the lesson's own model survives", crossSubject.step.visual3d_actions.some((action) => action.action === "create_3d_object" && action.asset === "biology/heart"));
check("the removal is reported as a category decision",
  crossSubject.report.notes.some((note) => note.pass === "category"), JSON.stringify(crossSubject.report.notes));

const onlyCrossSubject = alignTeachingStep(
  step({
    speech: "A piston engine is a good way to picture what a heart does, because it moves a fluid the same way.",
    visual3d_actions: [{ action: "create_3d_object", id: "analogy", type: "model", asset: "physics/piston-engine" }],
  }),
  context(),
);
check("the step is never emptied: an analogy keeps the stage alive when it is all there is",
  onlyCrossSubject.step.visual3d_actions.length > 0,
  JSON.stringify(onlyCrossSubject.step.visual3d_actions.map((action) => (action as { asset?: string }).asset ?? "")));

const unclassifiedSubject = alignTeachingStep(
  step({
    speech: "A heart, a piston engine and a spreadsheet all exist in the same room here.",
    visual3d_actions: [{ action: "create_3d_object", id: "analogy", type: "model", asset: "physics/piston-engine" }],
  }),
  context({ subject: "general" }),
);
check("an unrecognised subject is not allowed to reject anything",
  unclassifiedSubject.step.visual3d_actions.some((action) => action.action === "create_3d_object" && action.asset === "physics/piston-engine"),
  JSON.stringify(unclassifiedSubject.step.visual3d_actions.map((action) => (action as { asset?: string }).asset ?? "")));

console.log("\n== a model with no asset is a dead action and is removed as one");

const deadModel = alignTeachingStep(
  step({
    speech: "The core idea sits in the middle and everything else hangs off it, so put it in the centre of the model.",
    visual3d_actions: [
      { action: "create_3d_object", id: "main", type: "model" },
      { action: "frame_camera", target: "main" },
    ],
  }),
  context(),
);
check("a model object with no catalog asset is dropped",
  !deadModel.step.visual3d_actions.some((action) => action.action === "create_3d_object" && action.id === "main"),
  JSON.stringify(deadModel.step.visual3d_actions.map((action) => action.action)));
check("its camera framing is dropped with it",
  !deadModel.step.visual3d_actions.some((action) => action.action === "frame_camera" && "target" in action && action.target === "main"),
  JSON.stringify(deadModel.step.visual3d_actions));
check("the step is then given the real model instead of nothing",
  deadModel.step.visual3d_actions.some((action) => action.action === "create_3d_object" && action.asset === "biology/heart"),
  JSON.stringify(deadModel.step.visual3d_actions.map((action) => (action as { asset?: string }).asset ?? "")));

// -------------------------------------------------------------------------------------- teaching quality
console.log("\n== a lesson is not a lesson because it returned 200 and valid actions");

const objective = buildLessonObjective(request());
const fillerSteps: TeachingResponse[] = [
  step({
    lesson_step: 1,
    stage_id: "s1",
    speech: "As we move forward, keep in mind that these four quantities describe every push the heart makes, and that they never change on their own.",
    visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }],
  }),
  step({
    lesson_step: 2,
    stage_id: "s2",
    speech: "The lungs bring oxygen into the blood and the heart then carries that oxygen everywhere, which is why the two work together.",
  }),
  step({
    lesson_step: 3,
    stage_id: "s3",
    speech: "As we move forward, keep in mind that these four quantities describe every push the heart makes, and that they never change on their own.",
  }),
];
const lungRequest = request({ question: "Explain the lungs and how they bring oxygen into the blood." });
const lungObjective = buildLessonObjective(lungRequest);
const fillerRun = alignAndJudge(lungRequest, fillerSteps, lungObjective, createLessonProgress(lungObjective), "3d");
check("meta-narration is reported", fillerRun.report.issues.some((issue) => issue.kind === "meta-narration"), JSON.stringify(fillerRun.report.issues.map((issue) => issue.kind)));
check("the lesson's own subject is put on the board even when the provider never asked for it",
  fillerRun.steps.some((candidate) => candidate.visual3d_actions.some((action) => action.action === "create_3d_object" && action.asset === "biology/lungs")),
  JSON.stringify(fillerRun.steps.map((candidate) => candidate.visual3d_actions.filter((action) => action.action === "create_3d_object").map((action) => (action as { asset?: string }).asset))));
check("so no step is left claiming a picture it does not have",
  !fillerRun.report.issues.some((issue) => issue.kind === "unbacked-visual"),
  JSON.stringify(fillerRun.report.issues.filter((issue) => issue.kind === "unbacked-visual").map((issue) => `${issue.lessonStep}: ${issue.detail}`)));
check("a step that says the same thing twice is reported", fillerRun.report.issues.some((issue) => issue.kind === "repetition"));
check("the verdict is a failure", fillerRun.report.ok === false);
check("a summary of the failure names the lesson and its issues", summariseQuality(fillerRun.report).includes("ok=false"), summariseQuality(fillerRun.report));

// A full stage. The gate is not allowed to keep adding a model to every step forever, so past the limit
// the honest outcome is that the missing thing is REPORTED rather than quietly ignored.
const crowdedSteps: TeachingResponse[] = [
  step({
    lesson_step: 1,
    stage_id: "s1",
    speech: "The lungs and the heart and the blood and the brain all have to work together, and every one of them is doing something right now.",
    visual3d_actions: [
      { action: "create_3d_object", id: "a", type: "model", asset: "biology/heart" },
      { action: "create_3d_object", id: "b", type: "model", asset: "biology/brain" },
      { action: "create_3d_object", id: "c", type: "model", asset: "biology/muscle" },
      { action: "create_3d_object", id: "d", type: "model", asset: "biology/blood-cell" },
      { action: "create_3d_object", id: "e", type: "model", asset: "biology/cell" },
      { action: "create_3d_object", id: "f", type: "model", asset: "biology/blood-vessel" },
    ],
  }),
  step({
    lesson_step: 2,
    stage_id: "s2",
    speech: "The lungs bring oxygen into the blood, and then every other organ in the body depends on that oxygen arriving on time.",
  }),
];
const crowdedRun = alignAndJudge(lungRequest, crowdedSteps, lungObjective, createLessonProgress(lungObjective), "3d");
check("a crowded stage cannot take another model, so the missing thing is reported instead",
  crowdedRun.report.issues.some((issue) => issue.kind === "unbacked-visual" && issue.lessonStep === 2 && issue.detail.includes("lungs")),
  JSON.stringify(crowdedRun.report.issues.map((issue) => `${issue.kind}@${issue.lessonStep}: ${issue.detail}`)));

// Nothing can be drawn for any of these steps: no model for the topic, an unclassified subject, and no
// structure in the words. Two empty boards in a row is the failure being measured.
const hopelessRequest = request({ question: "Explain how a database index speeds up a query." });
const hopelessObjective = buildLessonObjective(hopelessRequest);
const hopelessSteps: TeachingResponse[] = [
  step({ lesson_step: 1, stage_id: "s1", speech: "An index is a data structure the database keeps beside its table so that a query does not have to read every row to find the ones it wants." }),
  step({ lesson_step: 2, stage_id: "s2", speech: "Without an index the database scans every row from the beginning and compares each one against the value it is looking for, one row at a time." }),
  step({ lesson_step: 3, stage_id: "s3", speech: "With an index it can jump straight to the right part of the data, which is why a query that took a second can take a thousandth of one." }),
];
const hopelessRun = alignAndJudge(hopelessRequest, hopelessSteps, hopelessObjective, createLessonProgress(hopelessObjective), "3d");
check("two consecutive steps that changed nothing are reported",
  hopelessRun.report.issues.some((issue) => issue.kind === "visual-stagnation"),
  JSON.stringify(hopelessRun.report.issues.map((issue) => `${issue.kind}@${issue.lessonStep}`)));

const thinRun = alignAndJudge(request(), [step({ speech: "The heart pumps blood." })], objective, createLessonProgress(objective), "3d");
check("a one-sentence stage of a deep lesson is reported as too thin", thinRun.report.issues.some((issue) => issue.kind === "thin-step"), JSON.stringify(thinRun.report.issues.map((issue) => issue.kind)));

const honestRun = alignAndJudge(request(), [
  step({
    speech: "A heart is a pump made of muscle. It has four chambers: two atria that receive blood and two ventricles that push it out again. Every beat sends the same blood round the body once, so a good heart beats about a hundred thousand times a day without ever being told to.",
    visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }, { action: "show_3d_label", id: "l", target: "heart_model", text: "Left ventricle", part: "left_ventricle" }],
  }),
], objective, createLessonProgress(objective), "3d");
check("a lesson that teaches and shows passes", honestRun.report.ok === true, JSON.stringify(honestRun.report.issues));
check("what was named is reported as shown", honestRun.report.entitiesShown.includes("biology/heart"), honestRun.report.entitiesShown.join(","));

const recapObjective = buildLessonObjective(request());
const noSummary = alignAndJudge(request(), [
  step({ lesson_step: 1, stage_id: "s1", speech: "A heart is a muscle with four chambers that move blood around the body, and it never stops doing it while you sleep.", visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }] }),
  step({
    lesson_step: recapObjective.stages.length,
    stage_id: recapObjective.stages[recapObjective.stages.length - 1]!.id,
    speech: "That is the interesting part of it. There is more to look at if you keep going, and the next lesson builds on this one.",
  }),
], recapObjective, createLessonProgress(recapObjective), "3d");
check("a recap that summarises nothing is reported",
  noSummary.report.issues.some((issue) => issue.kind === "no-conclusion"), JSON.stringify(noSummary.report.issues.map((issue) => issue.kind)));
const withSummary = alignAndJudge(request(), [
  step({ lesson_step: 1, stage_id: "s1", speech: "A heart is a muscle with four chambers that move blood around the body, and it never stops doing it while you sleep.", visual3d_actions: [{ action: "create_3d_object", id: "heart_model", type: "model", asset: "biology/heart" }] }),
  step({
    lesson_step: recapObjective.stages.length,
    stage_id: recapObjective.stages[recapObjective.stages.length - 1]!.id,
    speech: "To sum up what you can now do: name the four chambers, say which two receive blood and which two push it out, and explain why the left ventricle has the thickest wall.",
  }),
], recapObjective, createLessonProgress(recapObjective), "3d");
check("a recap that summarises is accepted", !withSummary.report.issues.some((issue) => issue.kind === "no-conclusion"), JSON.stringify(withSummary.report.issues.map((issue) => issue.kind)));

// --------------------------------------------------------------------------------- progress and completion
console.log("\n== a lesson that repeats its own stage id still moves forward");

const newtonRequest = request({ question: "Explain Newton's laws of motion with a worked example." });
const newtonObjective = buildLessonObjective(newtonRequest);
const repeatingSteps: TeachingResponse[] = Array.from({ length: 6 }, (_, index) => step({
  lesson_step: index + 1,
  stage_id: "s1",
  speech: "Newton's first law says a body keeps doing what it is already doing unless a net force acts on it, and that covers everything from a book on a table to a ball thrown across a room.",
  visual_actions: [{ action: "create_shape", id: `body_${index}`, shape: "rectangle", text: "Body" }],
}));
const repeatingProgress = applyStepsToProgress(createLessonProgress(newtonObjective), repeatingSteps);
check("six steps that all declare the first stage still teach six stages",
  repeatingProgress.coveredStageIds.length >= 5,
  `${repeatingProgress.coveredStageIds.length} of ${newtonObjective.stages.length}`);
check("coverage never names a stage the plan does not contain",
  repeatingProgress.coveredStageIds.every((id) => newtonObjective.stages.some((stage) => stage.id === id)));

// --------------------------------------------------------------------------------------- representation
console.log("\n== the stage is chosen once, and never flips mid-lesson");

check("a biology topic with a real model is taught in 3D",
  lessonRepresentation({ subject: "biology", question: "Explain the human heart", relevant3dAssets: 3 }) === "3d");
check("a topic with nothing to model is taught on the board",
  lessonRepresentation({ subject: "programming", question: "Explain recursion", relevant3dAssets: 0 }) === "2d");
check("an explicit 2D choice is respected even when a model exists",
  lessonRepresentation({ subject: "biology", question: "Explain the human heart", relevant3dAssets: 3, representationIntent: "2d" }) === "2d");
check("an explicit 3D choice is honoured when no model exists",
  lessonRepresentation({ subject: "programming", question: "Explain recursion", relevant3dAssets: 0, representationIntent: "3d" }) === "3d");
check("the default rule still degrades upward without an explicit choice",
  visualFamiliesFor({ subject: "biology", representationIntent: "2d", relevant3dAssets: 1 }).scene3d === true);
check("an explicit 2D choice removes the 3D family entirely",
  visualFamiliesFor({ subject: "biology", representationIntent: "2d", explicitTwoDimensional: true, relevant3dAssets: 1 }).scene3d === false);

// The same lesson, asked again with everything a later batch has learned. The stage must not move.
const firstBatch = request({ question: "Explain the TCP three-way handshake and show each message." });
const laterBatch = request({
  question: firstBatch.question,
  lessonStep: 7,
  // A model already placed on the 3D stage. The assertion below is about a placed model staying
  // DESCRIBED, so the fixture has to actually place one.
  visualState3d: {
    ...emptyVisual3DScene(),
    objects: [{ id: "router-1", type: "model", asset: "network/router", position: { x: 0, y: 0, z: 0 }, scale: 1, rotation: { x: 0, y: 0, z: 0 }, tint: "", opacity: 1 } as never],
  },
  visualState: { objects: [{ id: "seq", kind: "shape", order: 0, x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1 }], tick: 3 },
  previousTeaching: ["A client is any machine that opens a connection, and a server is the machine that waits for one and answers it."],
});
const firstPrompt = buildPrompt(firstBatch, { level: "full" });
const laterPrompt = buildPrompt(laterBatch, { level: "full" });
check("the stage does not flip when a later batch has more context",
  firstPrompt.representation === laterPrompt.representation,
  `first=${firstPrompt.representation} later=${laterPrompt.representation}`);
check("the representation a whole lesson uses is a stable function of the question",
  representationForRequest(firstBatch, "networking") === representationForRequest(laterBatch, "networking"),
  `${representationForRequest(firstBatch, "networking")} vs ${representationForRequest(laterBatch, "networking")}`);
check("an explicit choice is part of that stable decision",
  representationForRequest({ ...firstBatch, representationIntent: "2d" }, "networking") === "2d");
check("assets already on screen are still described even though they do not decide the stage",
  // The property is that a placed model is still DESCRIBED, not that the later batch lists more of
  // them: the two prompts are built at different limits, so comparing counts compares two different
  // questions rather than testing anything about continuity.
  laterPrompt.assets.relevant.some((asset) => asset.id === "network/router"),
  laterPrompt.assets.relevant.map((asset) => asset.id).join(","));

const stagePrompt = buildPrompt(request(), { level: "full" });
check("the prompt states which stage is on screen", stagePrompt.system.includes("THIS LESSON IS SHOWN ON THE 3D STAGE"), stagePrompt.system.slice(0, 160));
check("the built prompt reports its representation", stagePrompt.representation === "3d");
const boardPrompt = buildPrompt(request({ question: "Explain Newton's laws of motion with a worked example." }), { level: "full" });
check("a board lesson is told so too", boardPrompt.system.includes("THIS LESSON IS SHOWN ON THE 2D BOARD") && boardPrompt.representation === "2d", boardPrompt.representation);
const explicitBoard = buildPrompt(request({ question: "Explain the human heart.", representationIntent: "2d" }), { level: "full" });
check("an explicit 2D request is not overruled by a catalogued model",
  explicitBoard.representation === "2d" && explicitBoard.system.includes("THIS LESSON IS SHOWN ON THE 2D BOARD"), explicitBoard.representation);
check("the ladder is present in both directions",
  stagePrompt.system.includes('"type":"model" REQUIRES an "asset" id from the catalog') === true
  && boardPrompt.system.includes("no catalog model"), "ladder text");
check("no rule invites a primitive in place of something real",
  !stagePrompt.system.includes("No asset means no model"), "the old invitation is gone");
check("the anti-filler rule is present", stagePrompt.system.includes("Never spend a step on the lesson itself"));
check("the board-must-change rule is present", stagePrompt.system.includes("Every deep step MUST change the board"));

check("a question that names its own representation is still detected", detectRepresentationIntent("draw an array in separate boxes") === "2d");

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);