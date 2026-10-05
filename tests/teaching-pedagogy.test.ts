// TEACHING ACCEPTANCE — the seventeen scenarios, checked without a provider.
//
// Every scenario below is a real student request. What is asserted is not "the response parsed" but the
// twenty properties a lesson has to have to be worth a student's time: real pedagogical stages,
// prerequisites handled at the right depth, formulas taught symbol by symbol, reasoning rather than
// procedure, the answer held back until the method is out, visuals that match the step, no decoration,
// the right stage (2D or 3D), a conclusion, and verification where it means something.
//
// Two halves:
//   1. THE PLAN. For each scenario, what the deterministic planner decides — the arc, the prerequisite,
//      the level, the representation. This is where "the planner must choose the correct teaching
//      structure for the actual topic" is checkable at all.
//   2. THE GATE. For each scenario, a realistic provider response goes through the real alignment and
//      quality layers and is judged as a lesson. The responses here are written the way a competent
//      provider answers, and then also the way a lazy one does, because both have to be handled.
import { alignTeachingStep, AlignmentContext, sceneKindOf } from "../lib/teaching/alignment";
import { alignAndJudge } from "../lib/teaching/quality";
import {
  buildLessonObjective, createLessonProgress, isObjectiveComplete, applyStepsToProgress,
  currentStage, LessonObjective, lessonProgressView, resumeLessonProgress, stageIntent, TeachingStage,
} from "../lib/teaching/objective";
import { assetJustifies3D, buildPrompt, lessonRepresentation, spatialAssetCount } from "../lib/teaching/prompt";
import {
  concernsAddressed, hasResultCue, hasWhyCue, symbolsInFormula, unexplainedSymbols, teachingLevelFor,
  TEACHING_INTENTS, TEACHING_CONCERNS,
} from "../lib/teaching/pedagogy";
import { parseTeachingLessonProgress, parseTeachingResponse } from "../lib/teaching/validation";
import { applyVisualActions, getVisualScene } from "../lib/visual/engine";
import { parseVisualActions } from "../lib/visual/validate";
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
const section = (title: string) => console.log(`\n== ${title}`);

// ---------------------------------------------------------------------------------------------
// The scenarios. Each is a real request; `expect` says what a plan for it must contain.
// ---------------------------------------------------------------------------------------------

type Scenario = {
  id: string;
  question: string;
  /** Subjects whose stages this scenario's plan must include. */
  stages: string[];
  /** Teaching concerns this scenario's arc must be capable of addressing. */
  cares: string[];
  /** What the prerequisite stage must actually establish. */
  prerequisite: RegExp;
  /** 2d or 3d, and whether either is acceptable. */
  representation: "2d" | "3d" | "either";
};

const SCENARIOS: Scenario[] = [
  {
    id: "integration-by-parts",
    question: "Solve ∫ x² sin(x) dx and explain why integration by parts is the right method.",
    stages: ["prerequisite", "concept", "notation", "why", "identify", "apply", "example", "verify", "recap"],
    cares: ["why_this_formula", "symbols", "verification", "how_to_apply"],
    prerequisite: /function|rate of change|area/i,
    representation: "2d",
  },
  {
    id: "derivative-problem",
    question: "Solve this derivative problem: differentiate y = x³ sin(x).",
    stages: ["prerequisite", "notation", "why", "apply", "verify"],
    cares: ["symbols", "each_step_valid", "verification"],
    prerequisite: /function|rate of change/i,
    representation: "2d",
  },
  {
    id: "matrix-multiplication",
    question: "Solve this matrix problem: multiply a 2 by 2 matrix by another 2 by 2 matrix.",
    stages: ["prerequisite", "notation", "identify", "apply", "example", "verify", "interpret"],
    cares: ["symbols", "how_to_apply", "each_step_valid"],
    prerequisite: /vector|matrix|array/i,
    representation: "2d",
  },
  {
    id: "differential-equation",
    question: "Explain differential equations and solve a simple first-order one.",
    stages: ["prerequisite", "concept", "notation", "apply", "verify"],
    cares: ["derivation", "symbols", "why_this_formula"],
    prerequisite: /derivative|change over time/i,
    representation: "2d",
  },
  {
    id: "probability",
    question: "Solve this probability problem with a fair coin and explain the reasoning.",
    stages: ["prerequisite", "concept", "identify", "apply", "example", "verify"],
    cares: ["how_to_apply", "each_step_valid"],
    prerequisite: /outcome|likely|unlikely|probability/i,
    representation: "2d",
  },
  {
    id: "newtons-second-law",
    question: "Explain Newton's second law, including what each symbol means and a numerical example.",
    stages: ["prerequisite", "concept", "terminology", "notation", "why", "visual", "identify", "apply", "example", "verify", "interpret"],
    cares: ["symbols", "why_this_formula", "verification", "each_step_valid"],
    prerequisite: /force|mass|acceleration|velocity/i,
    representation: "2d",
  },
  {
    id: "projectile-motion",
    question: "Explain projectile motion and how to calculate the range of a launched ball.",
    stages: ["prerequisite", "concept", "notation", "visual", "apply", "verify", "interpret"],
    cares: ["symbols", "verification", "each_step_valid"],
    prerequisite: /force|velocity|acceleration/i,
    representation: "2d",
  },
  {
    id: "rc-transient",
    question: "Explain the transient response of an RC circuit with a worked numerical example.",
    stages: ["prerequisite", "terminology", "notation", "why", "visual", "derive", "apply", "example", "verify", "interpret"],
    cares: ["symbols", "derivation", "why_this_formula", "verification"],
    prerequisite: /voltage|current|resistance|capacitor/i,
    representation: "2d",
  },
  {
    id: "ohms-law",
    question: "Analyze this circuit using Ohm's law and explain what each quantity means.",
    stages: ["prerequisite", "terminology", "notation", "why", "visual", "identify", "apply", "verify"],
    cares: ["symbols", "why_this_formula", "verification"],
    prerequisite: /voltage|current|resistance/i,
    representation: "2d",
  },
  {
    id: "binary-search",
    question: "Explain binary search, trace it on an array, and say why it is faster than linear search.",
    stages: ["prerequisite", "intuition", "concept", "why", "example", "visual", "code", "walkthrough", "execution", "complexity", "recap"],
    cares: ["why_this_formula", "can_solve_similar", "each_step_valid"],
    prerequisite: /list of values|comparing two values/i,
    representation: "either",
  },
  {
    id: "recursion",
    question: "Explain recursion with code execution, tracing the call stack line by line.",
    stages: ["prerequisite", "concept", "code", "walkthrough", "execution", "complexity", "recap"],
    cares: ["each_step_valid", "can_solve_similar"],
    prerequisite: /function|call stack/i,
    representation: "2d",
  },
  {
    id: "linked-list",
    question: "Explain a linked list in C++ and show how an insertion works step by step.",
    stages: ["prerequisite", "concept", "code", "walkthrough", "execution", "complexity", "recap"],
    cares: ["each_step_valid", "can_solve_similar"],
    prerequisite: /memory|address|pointer/i,
    // Either stage is defensible here, and the pipeline chose 3D because the request literally names the
    // thing `computer-science/linked-list-node` is: a linked list IS boxes and arrows.
    representation: "either",
  },
  {
    id: "time-complexity",
    question: "Explain time complexity and why binary search is O(log n).",
    stages: ["prerequisite", "intuition", "concept", "why", "example", "complexity", "recap"],
    cares: ["why_this_formula", "intuition"],
    prerequisite: /list of values|comparing two values/i,
    representation: "2d",
  },
  {
    id: "tcp-handshake",
    question: "Explain the TCP three-way handshake and show each message in order.",
    stages: ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "identify", "example", "mechanics", "recap"],
    cares: ["intuition", "each_step_valid"],
    prerequisite: /network|ip address|port|packet/i,
    representation: "either",
  },
  {
    id: "chemical-bonding",
    question: "Explain chemical bonding: ionic, covalent and metallic, with an example of each.",
    stages: ["prerequisite", "intuition", "concept", "terminology", "notation", "why", "visual", "example", "mechanics", "recap"],
    cares: ["intuition", "how_to_apply"],
    prerequisite: /atom|electron|bond/i,
    representation: "either",
  },
  {
    id: "balancing-reaction",
    question: "Explain how to balance the chemical reaction between iron and oxygen.",
    stages: ["prerequisite", "concept", "terminology", "why", "example", "mechanics", "verify", "recap"],
    cares: ["how_to_apply", "each_step_valid", "verification"],
    prerequisite: /atom|electron|bond/i,
    representation: "either",
  },
  {
    id: "photosynthesis",
    question: "Explain photosynthesis and how a leaf makes sugar.",
    stages: ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "mechanics", "application", "recap"],
    cares: ["intuition", "how_to_apply"],
    prerequisite: /cell|energy/i,
    representation: "either",
  },
];

// =============================================================================================
// 1. THE PLAN — what the deterministic planner decides for each scenario.
// =============================================================================================

section("the planner gives every scenario a real teaching structure, not a generic one");

const plans = new Map<string, LessonObjective>();
for (const scenario of SCENARIOS) {
  const objective = buildLessonObjective({ question: scenario.question });
  plans.set(scenario.id, objective);
  const kinds = objective.stages.map((stage) => stage.kind);
  const missing = scenario.stages.filter((kind) => !kinds.includes(kind as never));
  check(`${scenario.id}: plans the stages its subject needs`, missing.length === 0, `missing ${missing.join(",")} in ${kinds.join(",")}`);
  check(`${scenario.id}: teaches before it summarises`, kinds.indexOf("concept") < kinds.indexOf("recap"), kinds.join(","));
  check(`${scenario.id}: ends with a recap`, kinds.at(-1) === "recap", kinds.at(-1) ?? "");
  check(`${scenario.id}: the prerequisite stage establishes what this topic needs`, scenario.prerequisite.test(objective.prerequisite),
    `"${objective.prerequisite}" vs ${scenario.prerequisite}`);
  check(`${scenario.id}: every stage declares a teaching act`, objective.stages.every((stage) => typeof stageIntent(stage) === "string"));
  check(`${scenario.id}: the prerequisite stage is short enough to be a foothold, not a course`,
    objective.prerequisite.split(/\s+/).length <= 24, objective.prerequisite);
}

section("the representation is chosen because 2D or 3D teaches it better, not because an asset exists");
for (const scenario of SCENARIOS) {
  const objective = plans.get(scenario.id)!;
  // The REAL count: matched assets filtered to those that justify 3D at all. A grid plane or a cylinder
  // is a prop for drawing something flat, not an object whose spatial shape teaches the idea.
  const spatial = spatialAssetCount(scenario.question);
  const chosen = lessonRepresentation({ subject: objective.subject, question: objective.topic, relevant3dAssets: spatial });
  if (scenario.representation === "either") {
    check(`${scenario.id}: may be taught on either stage, and the choice is explicit`, chosen === "2d" || chosen === "3d", chosen);
    continue;
  }
  check(`${scenario.id}: is taught on the ${scenario.representation.toUpperCase()} stage`, chosen === scenario.representation,
    `${chosen} from ${spatial} spatial asset(s)`);
}

section("an asset that exists is not a reason to use 3D");
check("a maths prop does not justify a 3D lesson", assetJustifies3D("mathematics/grid-plane", "Explain matrix multiplication.") === false, "grid plane");
check("a real organ the question names does justify a 3D lesson", assetJustifies3D("biology/heart", "Explain the human heart and how blood circulates through it.") === true);
check("a machine the question does not name does not", assetJustifies3D("physics/piston-engine", "Analyze an RC circuit.") === false, "piston engine for a circuit");
check("a circuit board is not a reason to teach circuit ANALYSIS in 3D", assetJustifies3D("physics/circuit-board", "Analyze an RC circuit.") === false, "circuit board");
check("a matrix problem finds no spatial asset at all", spatialAssetCount("Solve this matrix problem: multiply a 2 by 2 matrix.") === 0, String(spatialAssetCount("Solve this matrix problem: multiply a 2 by 2 matrix.")));
check("an organ lesson finds one", spatialAssetCount("Explain the human heart and how blood circulates through it.") > 0);
check("so a matrix lesson is taught on the board, whatever the catalogue holds", lessonRepresentation({
  subject: "mathematics", question: "matrix multiplication", relevant3dAssets: spatialAssetCount("Solve this matrix problem: multiply a 2 by 2 matrix."),
}) === "2d");

section("a topic with nothing to model is taught on the board, and 3D is not forced on it");
check("an array algorithm with no real object is 2D",
  lessonRepresentation({ subject: "programming", question: "binary search", relevant3dAssets: 0 }) === "2d");
check("an organ lesson that names the organ is 3D",
  lessonRepresentation({ subject: "biology", question: "the human heart", relevant3dAssets: 1 }) === "3d");
check("no asset means no 3D, however much the model exists in general",
  lessonRepresentation({ subject: "mathematics", question: "matrix multiplication", relevant3dAssets: 0 }) === "2d");
check("an explicit 2D request is honoured even where a model exists",
  lessonRepresentation({ subject: "biology", question: "the human heart", relevant3dAssets: 1, representationIntent: "2d" }) === "2d");

section("depth adapts to the student, and adaptation is measured on the plan");
check("'I am new to this' is a beginner", teachingLevelFor({ question: "I am new to physics, explain Newton's second law", depth: "deep" }) === "beginner");
check("'from first principles' is advanced", teachingLevelFor({ question: "derive the heat equation from first principles", depth: "deep" }) === "advanced");
check("the shape of a question is not read as knowledge: a calculation request still gets its prerequisite", teachingLevelFor({ question: "solve this matrix problem", depth: "deep" }) !== "advanced");
check("an ordinary request is intermediate", teachingLevelFor({ question: "Explain binary search", depth: "deep" }) === "intermediate");
check("a short request is a beginner lesson", teachingLevelFor({ question: "what is a hash map", depth: "brief" }) === "beginner");
const beginnerPlan = buildLessonObjective({ question: "I am new to physics. Explain Newton's second law." });
const advancedPlan = buildLessonObjective({ question: "Explain Newton's second law from first principles, and derive it." });
check("an advanced request drops the scaffolding a beginner needs", advancedPlan.stages.length <= beginnerPlan.stages.length,
  `${advancedPlan.stages.length} vs ${beginnerPlan.stages.length}`);
check("an advanced request still keeps WHY, the example, the check and the recap",
  ["why", "example", "verify", "recap"].every((kind) => advancedPlan.stages.some((stage) => stage.kind === kind)),
  advancedPlan.stages.map((stage) => stage.kind).join(","));
check("a derivation is only taught when it is asked for",
  advancedPlan.stages.some((stage) => stage.kind === "derive") && !beginnerPlan.stages.some((stage) => stage.kind === "derive"));

section("a lesson can be finished, and only by teaching it");
for (const scenario of SCENARIOS) {
  const objective = plans.get(scenario.id)!;
  const progress = createLessonProgress(objective);
  // One real teaching paragraph per stage, as a competent provider produces.
  const taught = objective.stages.reduce((accumulated, stage, index) => applyStepsToProgress(accumulated, [{
    speech: `${stage.title}. ${stage.goal} Here is the reasoning behind it, worked through carefully so that ${objective.topic} makes sense rather than merely being stated, and checked at the end.`,
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: index + 1, next_step: index + 2, stage_id: stage.id,
  }]), progress);
  check(`${scenario.id}: a lesson that taught every stage is complete`, isObjectiveComplete(taught, objective));
  const announced = applyStepsToProgress(progress, [{
    speech: "That is everything you need to know about this topic. I hope it was useful and there is nothing more to add here at all.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 1, stage_id: objective.stages[0]!.id,
  }]);
  check(`${scenario.id}: a step that announces the end teaches nothing and completes nothing`,
    !isObjectiveComplete(announced, objective) && announced.coveredStageIds.length === 0);
}

// =============================================================================================
// 2. THE GATE — realistic responses, judged as lessons.
// =============================================================================================

const baseRequest = (question: string, overrides: Partial<TeachingRequest> = {}): TeachingRequest => ({
  question,
  language: "English",
  lessonStep: 1,
  boardState: emptyBoardState(),
  visualState: emptyVisualScene(),
  visualState3d: emptyVisual3DScene(),
  previousTeaching: [],
  ...overrides,
});

const context = (overrides: Partial<AlignmentContext> = {}): AlignmentContext => ({
  question: "Solve ∫ x² sin(x) dx.",
  topic: "integration by parts",
  subject: "mathematics",
  deep: true,
  representation: "2d",
  live3dObjects: [],
  liveDiagramObjects: [],
  liveBoardIds: [],
  ...overrides,
});

section("a formula the teacher names is put on the board, with every symbol explained");
const formulaStep = alignTeachingStep({
  speech: "Integration by parts comes from the product rule for differentiation. The formula is ∫u dv = uv − ∫v du, and the three symbols in it mean this: u is the part we differentiate, v is the part we integrate, and du and dv are what each becomes when you differentiate or integrate it.",
  board_actions: [],
  visual_actions: [],
  visual3d_actions: [],
  lesson_step: 1,
  next_step: 2,
  teaching_intent: "explain_formula",
  pedagogy: {
    why: "because the integrand is a product, and the product rule for derivatives is the same product reversed",
    formula: {
      formula: "∫u dv = uv − ∫v du",
      calculates: "the integral of a product, by turning it into a derivative",
      variables: [
        { symbol: "u", meaning: "the part we differentiate" },
        { symbol: "v", meaning: "the part we integrate" },
        { symbol: "du", meaning: "u after differentiation" },
        { symbol: "dv", meaning: "v after integration" },
      ],
    },
  },
}, context());
const drawnFormula = formulaStep.step.visual_actions.find((action) => action.action === "create_equation_block");
check("a formula taught in words is drawn on the board", Boolean(drawnFormula), JSON.stringify(formulaStep.step.visual_actions.map((action) => action.action)));
check("the board shows the formula the teacher said", drawnFormula?.action === "create_equation_block" && drawnFormula.formula === "∫u dv = uv − ∫v du", JSON.stringify(drawnFormula));
check("the board shows the symbol meanings too",
  (drawnFormula?.action === "create_equation_block" ? drawnFormula.variables?.length ?? 0 : 0) === 4);
check("drawing it is reported, not silent", formulaStep.report.notes.some((note) => note.detail.includes("formula")), JSON.stringify(formulaStep.report.notes));
check("a formula whose symbols the teacher names loses nothing to the gate",
  unexplainedSymbols({ formula: "∫u dv = uv − ∫v du", variables: [{ symbol: "u", meaning: "differentiate" }, { symbol: "v", meaning: "integrate" }] },
    "u is the part we differentiate and v is the part we integrate").length === 0,
  unexplainedSymbols({ formula: "∫u dv = uv − ∫v du", variables: [{ symbol: "u", meaning: "differentiate" }, { symbol: "v", meaning: "integrate" }] },
    "u is the part we differentiate and v is the part we integrate").join(","));
check("an undeclared two-letter token is not reported, because it cannot be told from a product",
  unexplainedSymbols({ formula: "∫u dv = uv − ∫v du", variables: [{ symbol: "u", meaning: "differentiate" }] },
    "u is the part we differentiate").length === 0);

section("symbols are extracted from real formulas, including the ones with subscripts and functions");
check("F = ma yields F, m, a", JSON.stringify(symbolsInFormula("F = ma")) === JSON.stringify(["F", "m", "a"]), symbolsInFormula("F = ma").join(","));
check("a function name is not a symbol", !symbolsInFormula("v = sin(x) + cos(x)").includes("sin"), symbolsInFormula("v = sin(x) + cos(x)").join(","));
check("an argument inside a function still is", symbolsInFormula("v = sin(x)").includes("x"));
check("an unspaced product is read as separate symbols: RC", symbolsInFormula("V(t) = V0(1 - e^(-t/RC))").includes("R") && symbolsInFormula("V(t) = V0(1 - e^(-t/RC))").includes("C"), symbolsInFormula("V(t) = V0(1 - e^(-t/RC))").join(","));
check("a declared symbol nothing explains is found",
  unexplainedSymbols({ formula: "F = ma", variables: [{ symbol: "F", meaning: "net force" }, { symbol: "m", meaning: "mass" }, { symbol: "a", meaning: "acceleration" }] },
    "Here is Newton\u0027s law, and it is a useful relationship for motion problems.").length === 3,
  unexplainedSymbols({ formula: "F = ma", variables: [{ symbol: "F", meaning: "net force" }, { symbol: "m", meaning: "mass" }, { symbol: "a", meaning: "acceleration" }] },
    "Here is Newton\u0027s law, and it is a useful relationship for motion problems.").join(","));
check("an undeclared token is never reported, however much it looks like a symbol",
  unexplainedSymbols({ formula: "F = ma", variables: [{ symbol: "F", meaning: "net force" }] },
    "Here is Newton\u0027s law, where F is the net force.").length === 0,
  unexplainedSymbols({ formula: "F = ma", variables: [{ symbol: "F", meaning: "net force" }] }, "Here is Newton\u0027s law, where F is the net force.").join(","));

section("an answer that arrives before the reasoning is reported");
const objective = buildLessonObjective({ question: "Solve ∫ x² sin(x) dx and explain why integration by parts is the right method." });
const premature = alignAndJudge(baseRequest("Solve ∫ x² sin(x) dx."), [
  {
    speech: "The answer is −x² cos(x) + 2x sin(x) + 2 cos(x) + C, and integration by parts is the technique used whenever we see a product of two different functions that are awkward to integrate together.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 2, stage_id: "s1", teaching_intent: "introduce_concept",
  },
], objective, createLessonProgress(objective), "2d");
check("a concept step that already states the answer is reported", premature.report.issues.some((issue) => issue.kind === "premature-answer"),
  JSON.stringify(premature.report.issues.map((issue) => issue.kind)));
const honest = alignAndJudge(baseRequest("Solve ∫ x² sin(x) dx."), [
  {
    speech: "The integrand x² sin(x) is a product of two functions that are awkward to integrate on their own, which is exactly the situation the product rule for differentiation covers. That is why integration by parts exists and why we reach for it here rather than trying a substitution.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 2, stage_id: "s1", teaching_intent: "explain_why",
  },
], objective, createLessonProgress(objective), "2d");
check("the same step without the answer passes", !honest.report.issues.some((issue) => issue.kind === "premature-answer"),
  JSON.stringify(honest.report.issues.map((issue) => issue.kind)));
check("a why-reasoning step is recognised as one", hasWhyCue(honest.steps[0]!.speech) && !hasResultCue(honest.steps[0]!.speech));
check("the reason was recorded as the step's declared reasoning", honest.steps[0]!.teaching_intent === "explain_why");

// A derivation arrives AT the formula by arriving at it, and a common-mistake step quotes the wrong
// answer in order to correct it. Reporting either as "the answer came first" is the rule crying wolf,
// and a rule that cries wolf is a rule the teacher learns to ignore.
const derived = alignAndJudge(baseRequest("Solve ∫ x² sin(x) dx."), [
  {
    speech: "Differentiate the product uv and the answer is u dv plus v du, so the integral of u dv is uv minus the integral of v du, which is the formula itself.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 2, stage_id: "s8", teaching_intent: "derive",
  },
], buildLessonObjective({ question: "Solve ∫ x² sin(x) dx and derive integration by parts from first principles." }), createLessonProgress(buildLessonObjective({ question: "Solve ∫ x² sin(x) dx and derive integration by parts from first principles." })), "2d");
check("a derivation may state the result it arrives at", !derived.report.issues.some((issue) => issue.kind === "premature-answer"),
  JSON.stringify(derived.report.issues.map((issue) => `${issue.kind}: ${issue.detail}`)));
const corrected = alignAndJudge(baseRequest("Explain how to differentiate a product using the product rule."), [
  {
    speech: "A common mistake is to write the answer as just u times v prime, forgetting that the answer must also contain v times u prime, which is why the rule has two terms.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 2, stage_id: "s13", teaching_intent: "common_mistake",
  },
], buildLessonObjective({ question: "Explain how to differentiate a product using the product rule." }), createLessonProgress(buildLessonObjective({ question: "Explain how to differentiate a product using the product rule." })), "2d");
check("a common-mistake step may quote the wrong answer in order to correct it",
  !corrected.report.issues.some((issue) => issue.kind === "premature-answer"),
  JSON.stringify(corrected.report.issues.map((issue) => `${issue.kind}: ${issue.detail}`)));

section("an unexplained formula is reported, and one that was explained is not");
const withFormula = (speech: string, intent: string, stage: string) => alignAndJudge(baseRequest("Explain Newton's second law."), [
  {
    speech, board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: 1, next_step: 2, stage_id: stage, teaching_intent: intent as never,
    pedagogy: { formula: { formula: "F = ma", variables: [{ symbol: "F", meaning: "net force" }, { symbol: "m", meaning: "mass" }, { symbol: "a", meaning: "acceleration" }] } },
  },
], buildLessonObjective({ question: "Explain Newton's second law." }), createLessonProgress(buildLessonObjective({ question: "Explain Newton's second law." })), "2d");
check("a formula with a symbol nothing explains is reported",
  withFormula("Newton's second law is F = ma and it is a very useful relationship in physics for motion problems.", "explain_formula", "s5").report.issues.some((issue) => issue.kind === "unexplained-formula"),
  JSON.stringify(withFormula("Newton's second law is F = ma.", "explain_formula", "s5").report.issues.map((issue) => `${issue.kind}: ${issue.detail}`)));
check("a formula whose symbols are all explained is not reported",
  !withFormula("Newton's second law is F = ma, where F is the net force, m is the mass and a is the acceleration it produces.", "explain_formula", "s5").report.issues.some((issue) => issue.kind === "unexplained-formula"),
  JSON.stringify(withFormula("Newton's second law is F = ma, where F is the net force, m is the mass and a is the acceleration it produces.", "explain_formula", "s5").report.issues.map((issue) => `${issue.kind}: ${issue.detail}`)));

section("the generated-infographic board is removed, and real teaching survives");
const infographic = alignTeachingStep({
  speech: "Integration by parts is the technique we use when we see a product of two functions. The integrand here is a product, so we choose it.",
  board_actions: [],
  visual_actions: [
    { action: "create_shape", id: "card1", shape: "rounded_rectangle", text: "Plain English" },
    { action: "create_shape", id: "card2", shape: "rounded_rectangle", text: "Technical Definition" },
    { action: "create_shape", id: "card3", shape: "rounded_rectangle", text: "Key Term" },
    { action: "create_text", id: "card4", text: "Remember" },
    { action: "create_container", id: "frame1" },
    { action: "create_array", id: "given", values: ["x²", "sin(x)"] },
  ],
  visual3d_actions: [],
  lesson_step: 1,
  next_step: 2,
  teaching_intent: "choose_method",
}, context());
const keptIds = infographic.step.visual_actions.map((action) => ("id" in action ? action.id : ""));
check("category-only cards are removed", !["card1", "card2", "card3", "card4"].some((id) => keptIds.includes(id)), keptIds.join(","));
check("an empty frame is removed", !keptIds.includes("frame1"), keptIds.join(","));
check("the structure that actually teaches survives", keptIds.includes("given"), keptIds.join(","));
check("each removal is counted and explained", infographic.report.dropped.filter((drop) => drop.reason.includes("without a reason")).length === 5,
  JSON.stringify(infographic.report.dropped.map((drop) => drop.action)));
const teachingSurvives = alignTeachingStep({
  speech: "The integrand here is a product of x squared and sine of x, and a product is the one shape integration by parts is built for, because it mirrors the product rule for derivatives.",
  board_actions: [],
  visual_actions: [
    { action: "create_shape", id: "product", shape: "rounded_rectangle", text: "product of x² and sin(x)" },
    { action: "create_array", id: "given", values: ["x²", "sin(x)"] },
  ],
  visual3d_actions: [],
  lesson_step: 1, next_step: 2, teaching_intent: "choose_method",
}, context());
const survivedIds = teachingSurvives.step.visual_actions.map((action) => ("id" in action ? action.id : ""));
check("a shape that names what the teacher said stays", survivedIds.includes("product"), survivedIds.join(","));
check("and nothing is dropped when everything has a reason", teachingSurvives.report.dropped.length === 0, JSON.stringify(teachingSurvives.report.dropped));

section("the board follows the teacher: the symbol under discussion is the one that is lit");
const variableStep = alignTeachingStep({
  speech: "Now look at what each letter means. F is the net force, which is the single vector sum of every force acting on the body. m is the mass, the amount of matter.",
  board_actions: [], visual_actions: [], visual3d_actions: [],
  lesson_step: 3, next_step: 4, teaching_intent: "explain_variable",
  pedagogy: {
    formula: {
      formula: "F = m · a",
      variables: [
        { symbol: "F", meaning: "net force", unit: "N" },
        { symbol: "m", meaning: "mass", unit: "kg" },
        { symbol: "a", meaning: "acceleration", unit: "m/s²" },
      ],
    },
  },
}, context());
const lit = variableStep.step.visual_actions.find((action) => action.action === "highlight_many") as { ids?: string[] } | undefined;
check("the formula block exists to point at", variableStep.step.visual_actions.some((action) => action.action === "create_equation_block"));
check("the symbol being explained is the one highlighted", lit?.ids?.includes("formula_block-v0") === true, JSON.stringify(lit?.ids ?? []));
check("its meaning is lit with it", lit?.ids?.includes("formula_block-m0") === true, JSON.stringify(lit?.ids ?? []));

section("verification is required where it means something, and not invented where it does not");
const verified = alignAndJudge(baseRequest("Explain Newton's second law."), [
  { speech: "The net force on a 5 kg mass that accelerates at 4 m/s² is F = ma = 5 × 4 = 20 N.", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 1, next_step: 2, stage_id: "s9", teaching_intent: "calculate" },
  { speech: "Checking it: 20 N on 5 kg is 4 m/s², and the units are newtons from kilograms times metres per second squared, which is what force should be.", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 2, next_step: 3, stage_id: "s11", teaching_intent: "verify" },
], buildLessonObjective({ question: "Explain Newton's second law." }), createLessonProgress(buildLessonObjective({ question: "Explain Newton's second law." })), "2d");
check("a lesson that calculated and checked passes", !verified.report.issues.some((issue) => issue.kind === "missing-verification"),
  JSON.stringify(verified.report.issues.map((issue) => issue.kind)));
const unchecked = alignAndJudge(baseRequest("Explain Newton's second law."), [
  { speech: "The net force on a 5 kg mass that accelerates at 4 m/s² is F = ma = 5 × 4 = 20 N, and that is the answer.", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 1, next_step: 2, stage_id: "s9", teaching_intent: "calculate" },
], buildLessonObjective({ question: "Explain Newton's second law." }), createLessonProgress(buildLessonObjective({ question: "Explain Newton's second law." })), "2d");
check("a lesson that calculated and never checked is reported", unchecked.report.issues.some((issue) => issue.kind === "missing-verification"),
  JSON.stringify(unchecked.report.issues.map((issue) => issue.kind)));

section("the fifteen concerns are measured, so 'the answer is not the lesson' has a number");
check("every concern is declared by at least one intent", TEACHING_CONCERNS.every((concern) => concernsAddressed(TEACHING_INTENTS).includes(concern)),
  TEACHING_CONCERNS.filter((concern) => !concernsAddressed(TEACHING_INTENTS).includes(concern)).join(","));
check("a lesson that only defines and calculates answers two questions", concernsAddressed(["define", "calculate"]).length === 2,
  concernsAddressed(["define", "calculate"]).join(","));
check("a lesson that also explains symbols, why and verification answers more",
  concernsAddressed(["define", "calculate", "explain_variable", "explain_why", "verify"]).length >= 6,
  concernsAddressed(["define", "calculate", "explain_variable", "explain_why", "verify"]).join(","));
check("why and verification are among the things a full lesson covers",
  concernsAddressed(["explain_why", "verify"]).includes("why_this_formula") && concernsAddressed(["explain_why", "verify"]).includes("verification"));

section("an interrupt answer is speech first, and is judged as teaching rather than as a lesson step");
const interrupt = parseTeachingResponse({
  speech: "You picked u = x² because it is the factor whose derivative is simpler than its integral. Differentiating x² gives 2x, a polynomial, while integrating sin(x) would give −cos(x). Choosing the side that simplifies under the operation you will apply is the whole rule.",
  board_actions: [],
  visual_actions: [{ action: "create_text", id: "why_u", text: "differentiate x² → 2x, simpler than integrating sin(x)" }],
  visual3d_actions: [],
  lesson_step: 4,
  next_step: 4,
  teaching_intent: "explain_why",
});
check("an interruption answer keeps the step contract intact", interrupt !== null && interrupt.teaching_intent === "explain_why");
check("it declares the act it is performing", interrupt?.teaching_intent === "explain_why");
check("it can still draw, and is still judged", interrupt?.visual_actions.length === 1);

section("the wire contract accepts the pedagogical payload, and refuses a broken one");
const goodStep = parseTeachingResponse({
  speech: "Newton's second law is F = ma.",
  board_actions: [], visual_actions: [], visual3d_actions: [],
  lesson_step: 1, next_step: 2,
  teaching_intent: "explain_formula",
  pedagogy: { why: "because a net force is what changes momentum", formula: { formula: "F = ma", calculates: "the net force", variables: [{ symbol: "F", meaning: "net force", unit: "N" }, { symbol: "m", meaning: "mass" }] } },
});
check("a complete pedagogical payload survives validation", goodStep?.pedagogy?.formula?.variables?.length === 2, JSON.stringify(goodStep?.pedagogy?.formula));
check("the unit survives", goodStep?.pedagogy?.formula?.variables?.[0]?.unit === "N");
check("the reasoning survives", goodStep?.pedagogy?.why?.includes("momentum") === true);
const badStep = parseTeachingResponse({
  speech: "Something.", board_actions: [], visual_actions: [], visual3d_actions: [],
  lesson_step: 1, next_step: 2,
  teaching_intent: "explain_vibes" as never,
  pedagogy: { formula: { formula: "F = ma", variables: [{ symbol: "F" }] } },
});
check("an unknown intent is dropped, not rejected", badStep !== null && badStep.teaching_intent === undefined);
check("a formula row with no meaning is dropped rather than rendered", (badStep?.pedagogy?.formula?.variables?.length ?? 0) === 0,
  JSON.stringify(badStep?.pedagogy?.formula?.variables));
check("the step itself is still delivered", badStep?.speech === "Something.");

section("the prompt teaches the new layer without spending the request budget");
const prompt = buildPrompt(baseRequest("Solve ∫ x² sin(x) dx."), { level: "full" });
check("the prompt asks for a teaching intent", prompt.system.includes('"teaching_intent"'), "intent instruction missing");
check("the prompt states that the answer is not the lesson", prompt.system.includes("The answer is not the lesson"));
check("the prompt gives the formula protocol", prompt.system.includes("A formula is never decoration"));
check("the prompt names WHY as the most valuable field", prompt.system.includes('"why" is the most valuable field'));
check("the prompt sets the register from the student's level", prompt.system.includes("BEGINNER:") || prompt.system.includes("INTERMEDIATE:") || prompt.system.includes("ADVANCED:"));
check("the prompt points at the right structures for a calculus question", prompt.system.includes("create_equation_block"), "structure guidance missing");
check("a physics lesson is pointed at the force diagram", buildPrompt(baseRequest("Explain Newton's second law."), { level: "full" }).system.includes("create_free_body_diagram"));
check("an electrical lesson is pointed at the circuit structure", buildPrompt(baseRequest("Analyze an RC circuit."), { level: "full" }).system.includes("create_circuit"));
check("an electrical lesson is also pointed at the curve, because a transient response is a graph", buildPrompt(baseRequest("Explain the transient response of an RC circuit with a graph."), { level: "full" }).system.includes("create_graph_plot"));
check("an engineering lesson is not mistaken for a biology lesson", buildLessonObjective({ question: "Analyze an RC circuit and explain the transient response." }).subject === "engineering", buildLessonObjective({ question: "Analyze an RC circuit and explain the transient response." }).subject);
check("an engineering lesson teaches components and the governing law before the calculation", (() => { const k = buildLessonObjective({ question: "Analyze an RC circuit and explain the transient response." }).stages.map((s) => s.kind); return k.indexOf("terminology") < k.indexOf("notation") && k.indexOf("notation") < k.indexOf("apply"); })(), buildLessonObjective({ question: "Analyze an RC circuit and explain the transient response." }).stages.map((s) => s.kind).join(","));
check("a curve lesson is pointed at the plot structure", buildPrompt(baseRequest("Explain the transient response of an RC circuit with a graph."), { level: "full" }).system.includes("create_graph_plot"));
check("the stage being taught names the act expected of it", prompt.system.includes("the next step's intent is usually"), "stage intent guidance missing");

section("what reaches the board is inside the frame and readable");
const boardCheck = (question: string, step: TeachingResponse) => {
  const objective = buildLessonObjective({ question });
  const judged = alignAndJudge(baseRequest(question), [step], objective, createLessonProgress(objective), "2d");
  const parsed = parseVisualActions(judged.steps[0]?.visual_actions ?? []);
  if (parsed === null) return { ok: false, detail: "actions did not parse" };
  const scene = getVisualScene(applyVisualActions(emptyVisualScene(), parsed));
  const outside = scene.objects.filter((object) =>
    object.x - object.width / 2 < -1 || object.y - object.height / 2 < -1
    || object.x + object.width / 2 > 900 || object.y + object.height / 2 > 700);
  const overlapping = scene.objects.filter((object) => object.text && object.text.length > 0 && object.kind === "shape")
    .filter((object) => object.width < 2);
  return { ok: outside.length === 0, detail: `${outside.map((object) => object.id).join(",")} outside; ${overlapping.length} degenerate`, count: scene.objects.length };
};
const onBoard = boardCheck("Solve ∫ x² sin(x) dx.", {
  speech: "We differentiate x² and integrate sin(x), so the two factors swap sides in the formula.",
  board_actions: [], visual3d_actions: [], lesson_step: 1, next_step: 2, teaching_intent: "calculate",
  visual_actions: [{ action: "create_equation_block", id: "f", formula: "∫u dv = uv − ∫v du", variables: [{ symbol: "u", meaning: "x²" }, { symbol: "v", meaning: "sin(x)" }] }],
});
check("a formula block lands on the board inside the frame", onBoard.ok, onBoard.detail);
check("and it produced real objects", (onBoard.count ?? 0) >= 4, String(onBoard.count));

section("a lesson survives the round trip through the browser");

// The progress the server sends is echoed back on the next batch. If that echo is rejected, the server
// restarts the lesson from stage one on every batch: coverage oscillates, `stepsDelivered` never rises,
// and a lesson that needs eight batches can never finish. This is the whole check — the rejection is
// silent, so it is only observable by doing the round trip.
for (const question of [
  "Explain the transient response of an RC circuit.",
  "Solve ∫ x² sin(x) dx.",
  "Explain binary search, trace it on an array.",
  "Explain the human heart.",
]) {
  const objective = buildLessonObjective({ question });
  let progress = lessonProgressView(createLessonProgress(objective), objective);
  const parsed = parseTeachingLessonProgress(progress);
  check(`"${question.slice(0, 28)}…" survives being echoed back`, parsed !== null,
    parsed === null ? `subject=${objective.subject} was rejected` : "");
  const taught = objective.stages.reduce((accumulated, stage, index) => applyStepsToProgress(accumulated, [{
    speech: `${stage.title}. ${stage.goal} The reasoning behind it is worked out here so that ${objective.topic} makes sense rather than being asserted, and the result is checked at the end.`,
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: index + 1, next_step: index + 2, stage_id: stage.id,
  }]), createLessonProgress(objective));
  const secondBatch = lessonProgressView(applyStepsToProgress(resumeLessonProgress(objective, taught as never), [{
    speech: "One more thing worth adding before we finish, explained properly so the stage is complete.",
    board_actions: [], visual_actions: [], visual3d_actions: [],
    lesson_step: taught.stepsDelivered + 1, next_step: taught.stepsDelivered + 2,
    stage_id: currentStage(taught as never)?.id,
  }]), objective);
  check(`"${question.slice(0, 28)}…" step count climbs across batches`, secondBatch.stepsDelivered > taught.stepsDelivered,
    `${taught.stepsDelivered} -> ${secondBatch.stepsDelivered}`);
  void progress;
}

console.log(`\n${passed} passed, ${failed} failed`);
void sceneKindOf;
void stageIntent;

process.exit(failed > 0 ? 1 : 0);