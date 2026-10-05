// VISUAL TEACHING-STATE LIFECYCLE — the tests for "the board is not a history".
//
// Every case here corresponds to something a real browser run got wrong. The board grew monotonically to
// 58 objects with 57 of them belonging to earlier steps; an interruption's diagram stayed for the rest of
// the lesson; a continuity problem was taught with a call stack; "an array of four cells" was illustrated
// with a heart. None of those are visible in a schema check, and all of them are invisible to a snapshot
// test that only asserts "the scene is reproducible".
//
// What is asserted is the BEHAVIOUR: what is on screen, how much of it belongs to this step, how loud each
// part is, and whether anything from another subject ever appears.
import { applyLifecycle, groupOf, lifecycleFor, referencedIds, stampNewObjects } from "../lib/visual/lifecycle";
import { MIN_BOARD_OBJECTS, VISUAL_PRIORITY } from "../lib/visual/types";
import { applyVisualActions, getVisualScene, settleVisualScene } from "../lib/visual/engine";
import { parseVisualActions } from "../lib/visual/validate";
import { emptyVisualScene } from "../lib/visual/types";
import { VisualAction, VisualScene } from "../lib/visual/types";
import { hasUnrenderableMarkup, normaliseFormula, normaliseFormulaLines } from "../lib/visual/formula";
import { classifyTeachingIntent } from "../lib/teaching/intent";
import { selectAssetsForLesson } from "../lib/teaching/assetSelection";
import { emptyVisual3DScene } from "../lib/visual3d/types";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const section = (title: string) => console.log(`\n== ${title}`);

/** Applies a step the way the classroom does, with the context that makes staleness decidable. */
function step(
  scene: VisualScene,
  actions: VisualAction[],
  context: { step: number; stage: number; temporary?: boolean },
): VisualScene {
  const parsed = parseVisualActions(actions) ?? [];
  return settleVisualScene(getVisualScene(applyVisualActions(scene, parsed, context)));
}

const byStage = (scene: VisualScene) => {
  const counts = new Map<number, number>();
  for (const object of scene.objects) counts.set(object.bornStage ?? -1, (counts.get(object.bornStage ?? -1) ?? 0) + 1);
  return counts;
};

// --------------------------------------------------------------------------- the core: growth is bounded
section("the board stops being a history");

// The measured failure, reproduced exactly: eight objects at step 1, and every step afterwards adding
// without anything ever leaving. Eighteen steps of a real Newton's-law lesson reached 58 objects.
const lesson: Array<{ step: number; stage: number; actions: VisualAction[] }> = [
  { step: 1, stage: 0, actions: [{ action: "create_shape", id: "force", shape: "rounded_rectangle", text: "Force" }, { action: "create_text", id: "force-def", text: "a push or a pull", role: "annotation" }] },
  { step: 2, stage: 1, actions: [{ action: "create_shape", id: "push", shape: "arrow", semantic: "data" }] },
  { step: 3, stage: 2, actions: [{ action: "create_text", id: "law-name", text: "Newton's second law", role: "title" }] },
  { step: 4, stage: 3, actions: [{ action: "create_equation_block", id: "law", formula: "F = ma", variables: [{ symbol: "F", meaning: "force", unit: "N" }] }] },
  { step: 5, stage: 4, actions: [{ action: "create_text", id: "why", text: "acceleration depends on the net force" }] },
  { step: 6, stage: 5, actions: [{ action: "create_array", id: "given", values: ["F = 10 N", "m = 2 kg", "a = ?"] }] },
  { step: 7, stage: 6, actions: [{ action: "create_equation_block", id: "law", formula: "a = F/m" }] },
  { step: 8, stage: 7, actions: [{ action: "create_equation_block", id: "work", formula: "a = 10/2 = 5 m/s²" }] },
  { step: 9, stage: 8, actions: [{ action: "create_text", id: "result", text: "5 m/s²", role: "primary" }] },
  { step: 10, stage: 9, actions: [{ action: "create_text", id: "meaning", text: "the velocity grows by 5 m/s every second" }] },
  { step: 11, stage: 10, actions: [{ action: "create_text", id: "mistake", text: "forgetting that force is a net force" }] },
  { step: 12, stage: 11, actions: [{ action: "create_text", id: "recap", text: "You can now rearrange F = ma and use it." }] },
];

let scene = emptyVisualScene();
const sizes: number[] = [];
for (const entry of lesson) {
  scene = step(scene, entry.actions, { step: entry.step, stage: entry.stage });
  sizes.push(scene.objects.length);
}
const peak = Math.max(...sizes);
check("the board does not grow without bound", peak <= 14, `peak ${peak}, final ${scene.objects.length}, sizes ${sizes.join(",")}`);
check("the board is not monotonically increasing", sizes.some((value, index) => index > 0 && value <= sizes[index - 1]!), sizes.join(","));
check("the final board is about the size of a final step, not a whole lesson", scene.objects.length <= 8, String(scene.objects.length));
check("the calculation the last step taught is still on the board", scene.objects.some((object) => object.id.startsWith("result") || object.id.startsWith("recap")), scene.objects.map((object) => object.id).join(","));
check("the stage-0 introduction from eleven steps ago is not", !scene.objects.some((object) => object.id === "force"), scene.objects.map((object) => object.id).join(","));

// ------------------------------------------------------------------- the board keeps something to teach
section("the board is never thinned below something teachable");

{
  // The measured failure: a real Newton's-law run retired a seventeen-object board in a single step down to
  // one box and then taught several more steps over it. The empty-board safety net did not fire, because one
  // object is not zero objects, and nothing downstream could put the picture back — composition only chooses
  // what to keep from what it is handed.
  let thin = emptyVisualScene();
  for (let index = 0; index < 6; index += 1) {
    thin = step(thin, [{ action: "create_timeline", id: `t${index}`, events: [{ label: `${index}a`, text: "a" }, { label: `${index}b`, text: "b" }] }], { step: index + 1, stage: index });
  }
  const built = thin.objects.length;
  // A stage jump puts everything past its grace window at once, which is when the trickle used to hollow the
  // board out rather than trim it.
  thin = step(thin, [{ action: "create_text", id: "closing", text: "so the acceleration is 2.5" }], { step: 7, stage: 12 });
  check("a stage jump does not leave a board too small to teach with", thin.objects.length >= MIN_BOARD_OBJECTS,
    `${built} objects became ${thin.objects.length}`);
  check("and it is not simply the empty board being restored", thin.objects.length >= 1 && thin.objects.some((object) => object.id === "closing"),
    thin.objects.map((object) => object.id).join(","));
}

// --------------------------------------------------------------- attention: the current step dominates
section("the current concept dominates the board");

let attended = emptyVisualScene();
attended = step(attended, lesson[0]!.actions, { step: 1, stage: 0 });
attended = step(attended, lesson[1]!.actions, { step: 2, stage: 1 });
attended = step(attended, lesson[2]!.actions, { step: 3, stage: 2 });
const currentWeights = attended.objects.filter((object) => object.lifecycle === "current").length;
const olderWeights = attended.objects.filter((object) => object.lifecycle !== "current").length;
check("the objects this step created are marked current", currentWeights >= 1, `${currentWeights} current`);
check("earlier objects are still marked supporting rather than current", olderWeights >= 1, `${olderWeights} older`);
const currentOpacity = Math.max(...attended.objects.filter((object) => object.lifecycle === "current").map((object) => object.opacity));
const olderOpacity = Math.max(...attended.objects.filter((object) => object.lifecycle !== "current").map((object) => object.opacity));
check("the current step is louder than what came before", currentOpacity > olderOpacity, `current ${currentOpacity} vs older ${olderOpacity}`);
check("the attention model says what it means",
  VISUAL_PRIORITY.current > VISUAL_PRIORITY.supporting
  && VISUAL_PRIORITY.supporting > VISUAL_PRIORITY.context
  && VISUAL_PRIORITY.context > VISUAL_PRIORITY.completed,
  JSON.stringify(VISUAL_PRIORITY));

// ------------------------------------------------------------------- support survives, context goes
section("context that is still needed survives; context that is not does not");

let kept = emptyVisualScene();
kept = step(kept, [{ action: "create_equation_block", id: "law", formula: "F = ma", variables: [{ symbol: "F", meaning: "force" }] }], { step: 1, stage: 0 });
kept = step(kept, [{ action: "create_text", id: "step2", text: "a" }], { step: 2, stage: 1 });
// Referencing the formula two stages later is how a lesson says "still need this".
kept = step(kept, [{ action: "highlight_many", ids: ["law-v0"] }], { step: 3, stage: 2 });
check("an object the current step points at is kept", kept.objects.some((object) => object.id === "law-v0"), kept.objects.map((object) => object.id).join(","));

let released = emptyVisualScene();
released = step(released, [{ action: "create_equation_block", id: "law", formula: "F = ma", variables: [{ symbol: "F", meaning: "force" }] }], { step: 1, stage: 0 });
released = step(released, [{ action: "create_text", id: "s2", text: "a" }], { step: 2, stage: 1 });
released = step(released, [{ action: "create_text", id: "s3", text: "b" }], { step: 3, stage: 2 });
released = step(released, [{ action: "create_text", id: "s4", text: "c" }], { step: 4, stage: 3 });
released = step(released, [{ action: "create_text", id: "s5", text: "d" }], { step: 5, stage: 4 });
released = step(released, [{ action: "create_text", id: "s6", text: "e" }], { step: 6, stage: 5 });
check("an object nobody points at is eventually released", !released.objects.some((object) => object.id.startsWith("law")), released.objects.map((object) => object.id).join(","));

// A structure retires as ONE unit, which is the only way a twenty-object array can leave at all.
let grouped = emptyVisualScene();
grouped = step(grouped, [{ action: "create_array", id: "values", values: ["10", "20", "30", "40", "50"] }], { step: 1, stage: 0 });
const arrayObjects = grouped.objects.filter((object) => object.group === "values").length;
check("a structure's objects all carry its group", arrayObjects >= 5, `${arrayObjects} grouped`);
for (let index = 2; index <= 8; index += 1) {
  grouped = step(grouped, [{ action: "create_text", id: `n${index}`, text: `note ${index}` }], { step: index, stage: index - 1 });
}
check("a whole structure leaves the board together", !grouped.objects.some((object) => object.group === "values"), grouped.objects.map((object) => object.id).join(","));
check("the array's cells were all removed, not just its frame", !grouped.objects.some((object) => object.id.includes("values-c")));

// --------------------------------------------------------------------------- interruption is temporary
section("an interruption's visuals do not become part of the lesson");

let interrupted = emptyVisualScene();
interrupted = step(interrupted, [{ action: "create_equation_block", id: "law", formula: "RC dv/dt + v = Vs" }], { step: 5, stage: 3 });
const beforeInterruption = interrupted.objects.length;
interrupted = step(interrupted, [{ action: "create_text", id: "aside", text: "tau is the time constant" }], { step: 5, stage: 3, temporary: true });
check("the aside is visible while it is being explained", interrupted.objects.some((object) => object.id === "aside"), interrupted.objects.map((object) => object.id).join(","));
check("and it is marked temporary", interrupted.objects.find((object) => object.id === "aside")?.lifecycle === "temporary");
interrupted = step(interrupted, [{ action: "create_text", id: "next", text: "substituting the values" }], { step: 6, stage: 4 });
check("the aside is gone when the lesson moves on", !interrupted.objects.some((object) => object.id === "aside"), interrupted.objects.map((object) => object.id).join(","));
check("and the lesson's own content is still there", interrupted.objects.length >= 1 && interrupted.objects.length <= beforeInterruption + 1, `${beforeInterruption} -> ${interrupted.objects.length}`);

// ------------------------------------------------------------------------ snapshots still reproduce
section("a step is still a reproducible state");

let replayable = emptyVisualScene();
replayable = step(replayable, [{ action: "create_equation_block", id: "law", formula: "F = ma" }], { step: 1, stage: 0 });
const snapshot = replayable;
replayable = step(replayable, [{ action: "create_text", id: "later", text: "later" }], { step: 2, stage: 1 });
check("applying the next step changes the scene", replayable.objects.length !== snapshot.objects.length || snapshot.objects.some((object) => !replayable.objects.includes(object)));
const rebuilt = step(snapshot, [{ action: "create_text", id: "later", text: "later" }], { step: 2, stage: 1 });
check("replaying a step from its own starting scene produces the same board",
  rebuilt.objects.length === replayable.objects.length,
  `${rebuilt.objects.length} vs ${replayable.objects.length}`);

// ------------------------------------------------------------------- lifecycle decisions in isolation
section("lifecycle decisions are explainable");

const action = (over: Partial<VisualAction> & { action: string }): VisualAction => over as VisualAction;
const bornAt = { bornStep: 1, bornStage: 0, group: "g", lifecycle: "supporting" } as never;
const object = (over: Record<string, unknown>): never => ({ id: "x", kind: "shape", order: 0, x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, ...over }) as never;
check("an object born this step is current",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>), bornStep: 9 }), { step: 9, stage: 9 }, new Set()) === "current");
check("an object this step points at is supporting",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>) }), { step: 9, stage: 9 }, new Set(["x"])) === "supporting");
check("an object within the grace window is supporting",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>) }), { step: 9, stage: 1 }, new Set()) === "supporting");
check("an object past the grace window stops being supporting", (() => {
  const past = lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>) }), { step: 9, stage: 6 }, new Set());
  return past === "context" || past === "completed";
})());
check("and one stage later it is finished outright",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>), lifecycle: "context" }), { step: 9, stage: 7 }, new Set()) === "completed");
// TEMPORARY IS ABOUT WHAT THE ASIDE ADDED. The earlier rule marked the WHOLE board temporary while an
// interruption was on screen, which meant the lesson's own diagram was retired the first step after the
// aside: asking "what is tau?" mid-lesson cost the student the work in progress. The flag below is what
// separates an aside's objects from the lesson's.
check("an object born during an interruption is temporary",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>), bornStep: 9, bornStage: 9, bornTemporary: true }), { step: 9, stage: 9, temporary: true }, new Set()) === "temporary");
check("and it stays temporary for as long as the aside lasts",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>), bornStep: 9, bornStage: 9, bornTemporary: true }), { step: 12, stage: 12, temporary: true }, new Set()) === "temporary");
check("the lesson's own object is NOT temporary during an aside",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>) }), { step: 9, stage: 9, temporary: true }, new Set()) !== "temporary",
  lifecycleFor(object({ ...(bornAt as unknown as Record<string, unknown>) }), { step: 9, stage: 9, temporary: true }, new Set()));
check("a group is named by the layout compiler, not guessed from a string",
  groupOf("values-c3", "values") === "values" && groupOf("law-v0", "law") === "law");
check("an object with no declared group is its own group", groupOf("lonely") === "lonely");
check("stamping only touches objects that just arrived", (() => {
  const before = stampNewObjects({ objects: [{ id: "a", bornStep: 1 }] } as never, { step: 5, stage: 5 });
  return (before.objects[0] as { bornStep?: number }).bornStep === 1;
})());
check("referenced ids are read from every kind of addressing action",
  referencedIds([
    action({ action: "highlight", id: "a" }),
    action({ action: "create_label", target: "b" }),
    action({ action: "create_arrow", from: "c", to: "d" }),
    action({ action: "highlight_many", ids: ["e"] }),
  ]).size === 5);

// ------------------------------------------------------------------- subject isolation, measured
section("a subject's models never appear in another subject's lesson");

const SUBJECT_ISOLATION: Array<{ question: string; subject: string; forbidden: string[] }> = [
  {
    question: "Find the value of k for which f(x) = (1 - cos(4x)) / (8x^2) is continuous at x = 0.",
    subject: "mathematics",
    forbidden: ["biology/", "network/", "earth/", "astronomy/", "physics/", "computer-science/"],
  },
  {
    question: "Explain binary search, trace it on an array.",
    subject: "computer-science",
    forbidden: ["biology/", "network/", "earth/", "astronomy/"],
  },
  {
    question: "Explain the human heart and how blood circulates through it.",
    subject: "biology",
    forbidden: ["network/", "computer-science/"],
  },
  {
    question: "Explain Newton's second law with a numerical example.",
    subject: "physics",
    forbidden: ["biology/", "network/", "earth/", "astronomy/", "computer-science/"],
  },
  {
    question: "Explain the transient response of an RC circuit.",
    subject: "engineering",
    forbidden: ["biology/", "astronomy/"],
  },
  {
    question: "Explain photosynthesis and how a leaf makes sugar.",
    subject: "biology",
    forbidden: ["network/", "computer-science/"],
  },
  {
    question: "Explain the TCP three-way handshake and show each message.",
    subject: "networking",
    forbidden: ["biology/", "earth/", "astronomy/"],
  },
  {
    question: "Explain chemical bonding between ions and metals.",
    subject: "chemistry",
    forbidden: ["biology/", "network/", "astronomy/", "computer-science/"],
  },
];

for (const entry of SUBJECT_ISOLATION) {
  const detected = classifyTeachingIntent(entry.question).subject;
  check(`"${entry.question.slice(0, 34)}…" is classified as ${entry.subject}`, detected === entry.subject, detected);
  const offered = selectAssetsForLesson(entry.question, { limit: 10, maxParts: 3, sceneAssets: [], recentSpeech: [] }).relevant.map((asset) => asset.id);
  const leaked = offered.filter((id) => entry.forbidden.some((prefix) => id.startsWith(prefix)));
  check(`  and is offered no models from another subject`, leaked.length === 0, `${offered.join(",")} leaked ${leaked.join(",")}`);
}

// The specific words that caused the contamination.
section("words shared between subjects are not evidence of a subject");
for (const [question, expected] of [
  ["Find the limit of f(x) as x approaches 0, where f is a function.", "mathematics"],
  ["Differentiate the function f(x) using the chain rule.", "mathematics"],
  ["Teach me an array of four cells", "programming"],
  ["What is a hash table and why does it store entries by a computed key?", "programming"],
] as Array<[string, string]>) {
  const detected = classifyTeachingIntent(question).subject;
  check(`"${question.slice(0, 40)}" is ${expected}`, detected === expected, detected);
}
check("a mathematical 'function' does not ask for code", classifyTeachingIntent("What is a function?").codeRelevant === false);
check("a programming 'function' does", classifyTeachingIntent("Write a function in Python that reverses a list.").codeRelevant === true);
check("a mathematical 'variable' does not ask for code", classifyTeachingIntent("A variable is a symbol standing for a number. Use a variable to solve this.").codeRelevant === false);

// ------------------------------------------------------------------- the board must be able to SET it
section("a formula is written the way a board can set it");

check("a limit reads as mathematics, not as markup",
  normaliseFormula("\\lim_{x \\to a} f(x) = f(a)") === "lim(x → a) f(x) = f(a)", normaliseFormula("\\lim_{x \\to a} f(x) = f(a)"));
check("text commands keep their words", normaliseFormula("\\text{no gaps allowed at } x = 0") === "no gaps allowed at x = 0", normaliseFormula("\\text{no gaps allowed at } x = 0"));
check("a fraction becomes readable without a typesetting engine",
  normaliseFormula("RC \\frac{dv}{dt} + v = V_s") === "RC dv / dt + v = Vₛ", normaliseFormula("RC \\frac{dv}{dt} + v = V_s"));
check("an exponential keeps its superscript", normaliseFormula("V_s (1 - e^(-t/\\tau))") === "Vₛ (1 - e( - t / τ))", normaliseFormula("V_s (1 - e^(-t/\\tau))"));
check("a square root reads as a root", normaliseFormula("\\sqrt{a^2+b^2}").startsWith("√"), normaliseFormula("\\sqrt{a^2+b^2}"));
check("a quadratic formula is fully readable", !hasUnrenderableMarkup(normaliseFormula("\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}")), normaliseFormula("\\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}"));
check("an integral reads as an integral", normaliseFormula("\\int_0^\\infty e^{-x} dx = 1").includes("∫"), normaliseFormula("\\int_0^\\infty e^{-x} dx = 1"));
check("nothing set on the board still contains LaTeX markup",
  !hasUnrenderableMarkup(normaliseFormula("\\left( \\frac{x}{y} \\right)^2")), normaliseFormula("\\left( \\frac{x}{y} \\right)^2"));
check("plain mathematics is left alone", normaliseFormula("F = ma") === "F = ma", normaliseFormula("F = ma"));
check("a multi-line derivation keeps its lines", normaliseFormulaLines("u = x^2\\\\\\\\v = -\\cos(x)").length === 2,
  JSON.stringify(normaliseFormulaLines("u = x^2\\\\\\\\v = -\\cos(x)")));

const drawn = step(emptyVisualScene(), [{
  action: "create_equation_block",
  id: "law",
  formula: "RC \\frac{dv}{dt} + v = V_s",
  variables: [{ symbol: "V", meaning: "capacitor voltage", unit: "V" }],
}], { step: 1, stage: 0 });
const boardText = drawn.objects.map((object) => object.text ?? "").join(" ");
check("the board sets the formula in readable notation", !hasUnrenderableMarkup(boardText) && boardText.includes("dv") && boardText.includes("dt"), boardText.slice(0, 160));

console.log(`\n${passed} passed, ${failed} failed`);
void emptyVisual3DScene;
void byStage;
void applyLifecycle;
process.exit(failed > 0 ? 1 : 0);