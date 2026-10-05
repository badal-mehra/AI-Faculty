// LESSON OBJECTIVE + OBJECTIVE-BASED COVERAGE.
//
// The old contract let the MODEL decide when a lesson was over: a step whose "next_step" repeated its
// own step number was reported to the classroom as "Lesson complete". A provider that answered once
// therefore ended a "Explain linked list in C++." request after one paragraph — the observed
// 8-10 second lesson.
//
// This module replaces that with an objective the system owns:
//   1. `buildLessonObjective` turns the request into an ordered list of teaching STAGES. The stages
//      come from the subject's teaching profile plus the topic's own prerequisites, so they are
//      generated for whatever the student asked about — nothing is hardcoded per topic.
//   2. `applyStepsToProgress` records what the generated steps ACTUALLY taught. A stage counts as
//      covered only when real teaching speech was delivered for it; a provider announcing "done" can
//      never mark a stage covered.
//   3. `isObjectiveComplete` is the only definition of "lesson complete": every planned stage has
//      been taught with enough substance, and the lesson has run at least its minimum number of steps.
//
// Duration is therefore an OUTCOME of content: nothing sleeps, nothing waits, and there is no minimum
// wall-clock time anywhere in this file.

import { classifyTeachingIntent, TeachingDepth, TeachingIntent, TeachingSubject } from "./intent";
import { TeachingRequest, TeachingResponse } from "./types";
import { TeachingIntent as PedagogicalIntent, TeachingLevel, teachingLevelFor, wantsDerivation } from "./pedagogy";

export type StageKind =
  | "prerequisite"
  | "intuition"
  | "concept"
  // Why a method applies — the stage the old arc had no room for at all, and the one that decides
  // whether a student can solve a SIMILAR problem later or only recognise this one.
  | "why"
  | "terminology"
  | "notation"
  | "identify"
  | "apply"
  | "derive"
  | "verify"
  | "interpret"
  | "visual"
  | "example"
  | "advanced"
  | "mechanics"
  | "code"
  | "walkthrough"
  | "execution"
  | "complexity"
  | "mistakes"
  | "application"
  | "recap";

export type TeachingStage = {
  /** Stable within one lesson ("s3"), so a resumed lesson knows exactly where it was. */
  id: string;
  kind: StageKind;
  /** Student-facing heading, used in the on-screen lesson outline. */
  title: string;
  /** One sentence the teacher must satisfy before this stage counts as taught. */
  goal: string;
  /** Words of real teaching speech this stage needs before it counts as covered. */
  minWords: number;
  needsVisual: boolean;
  needsCode: boolean;
  /**
   * The teaching act a step teaching THIS stage is mostly performing.
   *
   * This is what ties the plan to the pedagogical layer: the objective says "now explain why this method
   * applies", the prompt tells the model to declare `explain_why`, and the quality gate can then notice a
   * lesson that taught the stage with a step that declared `define`. Without this link the arc, the
   * prompt and the verdict are three independent opinions about the same lesson.
   *
   * Optional only because a `TeachingStage` can also arrive from a browser echoing an older payload; use
   * `stageIntent` rather than reading it directly.
   */
  intent?: PedagogicalIntent;
};

/** The teaching act for a stage, falling back to the stage's own name when the field is absent. */
export function stageIntent(stage: Pick<TeachingStage, "kind" | "intent">): PedagogicalIntent {
  return stage.intent ?? STAGE_INTENTS[stage.kind];
}

export type LessonObjective = {
  topic: string;
  subject: TeachingSubject;
  depth: TeachingDepth;
  /**
   * The register this lesson teaches in, inferred from the request.
   *
   * The brief is explicit that a student must not have to choose a level, so nothing here is a UI
   * control: it is read off the question (see `teachingLevelFor`) and threaded into the prompt, which
   * adjusts how much prerequisite to spell out and how much derivation to assume.
   */
  level: TeachingLevel;
  codeRelevant: boolean;
  codeLanguage?: string;
  prerequisite: string;
  stages: TeachingStage[];
  /** A lesson must be at least this long; a single short paragraph can never be "complete". */
  minSteps: number;
  /** Hard stop, so a provider that never advances cannot loop forever. */
  maxSteps: number;
  /** How many steps one batch should ask for. */
  batchSize: number;
};

export type LessonProgress = {
  topic: string;
  subject: TeachingSubject;
  depth: TeachingDepth;
  codeRelevant: boolean;
  stages: TeachingStage[];
  coveredStageIds: string[];
  /** Teaching words delivered per stage, which is what coverage is actually measured from. */
  stageWords: Record<string, number>;
  stepsDelivered: number;
  totalWords: number;
};

/** What the browser receives so it can show the outline and never guess completion itself. */
export type LessonProgressView = {
  topic: string;
  subject: TeachingSubject;
  depth: TeachingDepth;
  codeRelevant: boolean;
  stages: TeachingStage[];
  coveredStageIds: string[];
  remainingStageIds: string[];
  currentStageId: string | null;
  currentStageTitle: string | null;
  /**
   * Teaching words already credited to each stage, so coverage accumulates ACROSS batches.
   *
   * Without this the round trip through the browser lost it, and a stage needed a full stage-worth of
   * speech inside ONE batch to be counted. On a long lesson — an RC transient response needs eight
   * batches — that made every batch restart its own count, which is why coverage oscillated instead of
   * climbing.
   */
  stageWords: Record<string, number>;
  stepsDelivered: number;
  minSteps: number;
  maxSteps: number;
  complete: boolean;
};

/** Runtime lists, so an echoed progress payload can be validated rather than trusted. */
export const TEACHING_DEPTHS: readonly TeachingDepth[] = ["deep", "brief"];
export const TEACHING_SUBJECTS: readonly TeachingSubject[] = [
  "programming", "networking", "biology", "physics", "engineering", "chemistry", "mathematics",
  "astronomy", "computer-science", "humanities", "general",
];

const STAGE_TITLES: Record<StageKind, string> = {
  prerequisite: "Before we start: what the student needs first",
  intuition: "Intuition and everyday analogy",
  concept: "The core concept",
  why: "Why this approach is the right one",
  terminology: "Key terminology",
  notation: "Notation, symbols and formulas",
  identify: "What we are given, and what we must find",
  apply: "Applying it, step by step",
  derive: "Where it comes from",
  verify: "Checking the answer",
  interpret: "What the answer means",
  visual: "Seeing it: the visual explanation",
  example: "Worked step-by-step example",
  advanced: "A harder example",
  mechanics: "How it actually works, step by step",
  code: "The code",
  walkthrough: "Code walkthrough, line by line",
  execution: "Running it: tracing the execution",
  complexity: "Cost and complexity",
  mistakes: "Common mistakes and why they fail",
  application: "Where it is used in the real world",
  recap: "Recap you can write down",
};

/**
 * What a step teaching each stage is mostly DOING.
 *
 * Read straight off the stage's own name, so the two can never drift apart. It is what the prompt asks
 * the model to declare, and what the quality gate compares the declaration against.
 */
const STAGE_INTENTS: Record<StageKind, PedagogicalIntent> = {
  prerequisite: "prerequisite",
  intuition: "intuition",
  concept: "introduce_concept",
  why: "explain_why",
  terminology: "define",
  notation: "explain_formula",
  identify: "identify_given",
  apply: "calculate",
  derive: "derive",
  verify: "verify",
  interpret: "interpret",
  visual: "intuition",
  example: "worked_example",
  advanced: "worked_example",
  mechanics: "demonstrate",
  code: "demonstrate",
  walkthrough: "demonstrate",
  execution: "demonstrate",
  complexity: "explain_relationship",
  mistakes: "common_mistake",
  application: "application",
  recap: "recap",
};

const VISUAL_KINDS: StageKind[] = ["visual"];
const CODE_KINDS: StageKind[] = ["code", "walkthrough", "execution"];

// For a programming topic the "notation" stage means the basic shape of the code — its syntax — so it
// is taught before any full program exists.
const SYNTAX_KIND: StageKind = "notation";

// THE ORDERED TEACHING ARC for each subject.
//
// The order encodes a teaching decision, not a list of topics. Three things are true of every arc here
// and are what the old arcs got wrong:
//
//   1. `why` comes BEFORE `apply`. A student who is told to integrate a product without being told why
//      integration by parts beats the obvious choice can only copy the next one; one who was told why
//      can choose. The answer is not the lesson.
//   2. `identify` → `apply` → `verify` → `interpret`. A worked problem is not finished when the number
//      appears: the student has to have been told what was given, how each manipulation is valid, how
//      to check the result, and what the result MEANS.
//   3. `notation` (the formula and its symbols) comes before the first use of that formula, and
//      `recap` is last.
//
// Programming adds the code stages only when code is relevant to the request, which is why "Explain
// linked list in C++." and "Explain the idea behind linked lists" produce different — both complete —
// lessons. `derive` appears only when the student asked for it: forcing a derivation onto "what is a
// matrix" is padding, and padding is what made lessons read like generated infographics.
const SUBJECT_ARCS: Record<TeachingSubject, StageKind[]> = {
  programming: ["prerequisite", "intuition", "concept", "why", SYNTAX_KIND, "example", "visual", "code", "walkthrough", "execution", "complexity", "mistakes", "application", "recap"],
  networking: ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "identify", "example", "mechanics", "verify", "application", "mistakes", "recap"],
  biology: ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "mechanics", "example", "application", "mistakes", "recap"],
  physics: ["prerequisite", "intuition", "concept", "terminology", "notation", "why", "visual", "identify", "example", "apply", "verify", "interpret", "mistakes", "application", "recap"],
  // ENGINEERING, from the brief: physical problem → required concepts → components and variables →
  // governing law → why that law applies → model → calculation → interpretation → edge cases → use.
  // The component and variable stage comes before the law on purpose: "what is a capacitor" is a
  // different question from "what is the time constant RC", and the second is unanswerable without the
  // first. `verify` here is a unit and dimension check, which is what makes it meaningful.
  engineering: ["prerequisite", "concept", "terminology", "notation", "why", "visual", "identify", "derive", "apply", "example", "verify", "interpret", "mistakes", "application", "recap"],
  chemistry: ["prerequisite", "intuition", "concept", "terminology", "notation", "why", "visual", "example", "mechanics", "verify", "interpret", "application", "mistakes", "recap"],
  mathematics: ["prerequisite", "intuition", "concept", "notation", "why", "visual", "identify", "apply", "advanced", "example", "verify", "interpret", "mistakes", "recap"],
  astronomy: ["prerequisite", "intuition", "concept", "notation", "why", "visual", "example", "verify", "interpret", "application", "mistakes", "recap"],
  "computer-science": ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "example", "mechanics", "complexity", "verify", "mistakes", "application", "recap"],
  humanities: ["prerequisite", "intuition", "concept", "terminology", "why", "example", "application", "mistakes", "recap"],
  general: ["prerequisite", "intuition", "concept", "terminology", "why", "visual", "example", "mechanics", "application", "mistakes", "recap"],
};

/**
 * Adds the derivation stage only when the student asked for it.
 *
 * A derivation is the most expensive thing a lesson can teach and the least useful when unasked: it
 * turns a five-stage lesson into a nine-stage one and the student still walks away with the same
 * procedure. So it is opt-in, and it arrives AFTER the concept and the formula, because you cannot
 * derive what you have not yet been told.
 */
function withDerivation(arc: StageKind[], request: Pick<TeachingRequest, "question">): StageKind[] {
  if (!wantsDerivation(request)) return arc;
  const index = arc.indexOf("notation");
  const insertAt = index >= 0 ? index + 1 : arc.indexOf("concept") + 1;
  if (arc.includes("derive")) return arc;
  return [...arc.slice(0, insertAt), "derive", ...arc.slice(insertAt)];
}

// The arc used when programming is the subject but the student did not ask for code.
const CONCEPT_ONLY_ARC: StageKind[] = ["prerequisite", "intuition", "concept", "why", "example", "visual", "mechanics", "complexity", "mistakes", "application", "recap"];

/**
 * Prerequisites derived from the NOTATION a question uses.
 *
 * The curated topic list below is the honest way to answer "what must a student already know about
 * this subject?", but it cannot cover a request nobody wrote a topic for. This table answers the
 * question that generalises: "solve ∫ x² sin(x) dx", "explain differential equations", "solve this
 * matrix problem", "analyze an RC circuit" — none of those is a listed topic, and all four name a piece
 * of notation that already presumes a concept. The notation is the reliable signal, because a student
 * writes it precisely when they cannot yet use it.
 */
const NOTATION_PREREQUISITES: Array<{ notation: RegExp; prerequisite: string }> = [
  // Order matters: the most specific notation first, because a question can contain two ("solve this
  // differential equation") and the derivative it rests on is the one the student must have first.
  { notation: /\bdifferential equation\w*|\bode\b|\bpde\b|\bdv\/dt\b|\bdy\/dx\b/i, prerequisite: "what a derivative means and what it means for something to change over time" },
  { notation: /\b(integral|integrate|integration|antiderivative)\b|∫/i, prerequisite: "what a function, a rate of change and an accumulated area mean" },
  { notation: /\b(derivative|differentiate|differentiation|gradient|tangent)\b|d\/d[dx]|∂/i, prerequisite: "what a function and its rate of change mean, and what a graph of that rate looks like" },
  { notation: /\b(matrix|matrices|determinant|eigenvalue|eigenvector)\b/i, prerequisite: "what a vector is, how vectors are added and scaled, and what a matrix is as a rectangular array of them" },
  { notation: /\b(probability|distribution|expected value|variance|random variable)\b/i, prerequisite: "what an outcome is, and what it means for something to be likely or unlikely" },
  { notation: /\b(circuit|circuits|resistor|capacitor|inductor|impedance|transistor|diode|mosfet|op ?amp|transient|ohm'?s law|kirchhoff|voltage|current)\b/i, prerequisite: "what voltage, current and resistance are, and what a capacitor does that a resistor does not" },
  { notation: /\b(force|momentum|acceleration|velocity|newton|friction|projectile|torque)\b/i, prerequisite: "what force, mass, velocity and acceleration mean, and what units they are measured in" },
  // "O(log n)" is a growth rate, not a request about logarithms, so a bare `log` must not match here.
  { notation: /\blogarithm|\bln\b|\blog\s+of\b|\blog\s*\d/i, prerequisite: "what a power and a logarithm are, and how they undo each other" },
  { notation: /\b(fourier|frequency|spectrum|harmonic|sinusoid|convolution)\b/i, prerequisite: "what a function, a frequency and a repeating wave mean, and how a wave can be described by numbers" },
  { notation: /\breaction\w*|\bstoichiometr\w*|\bbond\w*|\borbital\w*|\belectron\w*|\bion\w*|\bisotope\w*|\bmole\w*|\bstoichiometr\w*|\bvalence\b/i, prerequisite: "what an atom, an electron and a chemical bond are" },
  { notation: /\b(entropy|enthalpy|thermodynamic|gibbs|carnot)\w*/i, prerequisite: "what heat, work, temperature and energy are, and that energy is conserved" },
];

function prerequisiteFor(intent: TeachingIntent): string {
  const text = `${intent.question} ${intent.topic}`;
  // Notation first: it is the most specific signal the request carries, and a question that names both
  // a subject topic and a piece of notation is asking about the notation.
  for (const entry of NOTATION_PREREQUISITES) {
    if (entry.notation.test(text)) return entry.prerequisite;
  }
  const lower = text.toLowerCase();
  for (const entry of PREREQUISITE_TOPICS) {
    if (entry.keys.some((key) => lower.includes(key))) return entry.prerequisite;
  }
  return SUBJECT_PREREQUISITES[intent.subject];
}

// Prerequisite ideas, chosen from the topic's own vocabulary. This is the difference between "define
// Node*" and "here is what a pointer is first, because Node* needs it". Only the prerequisite the
// topic actually requires is taught, never a whole prerequisite course.
const PREREQUISITE_TOPICS: Array<{ keys: string[]; prerequisite: string }> = [
  { keys: ["linked list", "node", "tree", "graph", "pointer", "pointers", "malloc", "memory"], prerequisite: "how memory, addresses and pointers work" },
  { keys: ["recursion", "recursive", "function", "stack overflow"], prerequisite: "what a function is and what happens on the call stack" },
  { keys: ["binary search", "sorting", "sort", "algorithm", "complexity"], prerequisite: "what a list of values is, and what comparing two values means" },
  { keys: ["tcp", "udp", "handshake", "socket", "network", "http", "dns", "port"], prerequisite: "what a network, an IP address, a port and a packet are" },
  { keys: ["photosynthesis", "plant", "leaf", "chloroplast", "chlorophyll"], prerequisite: "what a cell is and where a plant's energy comes from" },
  { keys: ["heart", "blood", "circulation", "lung", "lungs", "breathing"], prerequisite: "what blood, blood vessels and muscles are" },
  { keys: ["ram", "rom", "cpu", "operating system", "memory", "hard disk"], prerequisite: "what a computer, its processor and its memory are" },
  { keys: ["cell", "organelle", "mitochondria", "nucleus", "dna"], prerequisite: "what a living cell is and what makes something alive" },
  { keys: ["atom", "electron", "molecule", "element"], prerequisite: "what matter is made of" },
  { keys: ["algorithm", "program", "programming", "code", "loop"], prerequisite: "what a program is, and what an instruction means" },
];

const SUBJECT_PREREQUISITES: Record<TeachingSubject, string> = {
  programming: "the bare minimum of programming needed to read the example",
  networking: "how two computers talk to each other at all",
  biology: "the smallest pieces of living things needed to make sense of this",
  physics: "the basic quantities (distance, time, force) this topic is built on",
  chemistry: "what matter is made of, before the chemistry starts",
  mathematics: "the arithmetic and symbols this topic assumes",
  astronomy: "what matter, light and gravity are before looking outward",
  engineering: "the quantities every circuit and machine is measured in — voltage, current, resistance, power and time",
  "computer-science": "what a computer is and what it is asked to do",
  humanities: "the background needed to understand why this mattered",
  general: "the basic idea the student needs before the details make sense",
};


function stageGoal(kind: StageKind, topic: string, prerequisite: string, language?: string): string {
  const inLanguage = language ? ` in ${language}` : "";
  switch (kind) {
    case "prerequisite": return `Start from the very basics and explain ${prerequisite}, because the student cannot understand ${topic} without it. Keep it to what this topic actually needs — a prerequisite lesson is a foothold, not a course.`;
    case "intuition": return `Give an everyday analogy for ${topic} FIRST, before any technical definition, so the idea feels obvious.`;
    case "concept": return `Define ${topic} in plain language, then give the correct technical definition using the right terms.`;
    case "why": return `Explain WHY this is the right approach for ${topic} and what the alternatives would get wrong. The student must be able to recognise when to use it, not only follow it.`;
    case "terminology": return `Name the key terms used for ${topic} and say what each one means in simple words.`;
    case "notation": return `Write down the formula, notation or symbols ${topic} uses, then go through EVERY symbol one at a time: what it stands for, and its unit if it has one. A formula whose symbols are not explained is decoration.`;
    case "identify": return `List what the question GIVES us and what it asks us to FIND, in the student's own words. Do not solve it yet.`;
    case "apply": return `Work ${topic} through step by step. For each step say what you are doing, why that step is valid, and what the result of that step means.`;
    case "derive": return `Show where ${topic} comes from, deriving it rather than asserting it, and stop at the depth that makes the reason for each step obvious.`;
    case "verify": return `Check the result you just reached: differentiate it back, substitute it in, check its units, or confirm the behaviour is physically or logically sensible. Say which check you used.`;
    case "interpret": return `Say what the result MEANS in the student's situation — the physical reading, the algorithmic consequence, the real-world implication — not just what it equals.`;
    case "visual": return `Draw ${topic} so the student can SEE its structure or flow, and point at what you are describing.`;
    case "example": return `Work through one small example of ${topic} slowly, value by value, narrating every single step.`;
    case "advanced": return `Work through a harder example of ${topic} where the detail matters, and check the answer.`;
    case "mechanics": return `Explain step by step HOW ${topic} actually happens inside, in the order things really occur.`;
    case "code": return `Write the ${language ? language : ""} code for ${topic} on the board${inLanguage}, small enough to read at a glance.`;
    case "walkthrough": return `Go through that code line by line and say what every important line does and why it is there.`;
    case "execution": return `Trace what happens when the code runs, one line at a time, following the values.`;
    case "complexity": return `State what ${topic} costs (time, memory or effort), and why it has that cost.`;
    case "mistakes": return `Name the mistakes students actually make with ${topic}, and explain exactly why each one breaks.`;
    case "application": return `Say where ${topic} is really used and why it is worth learning at all.`;
    case "recap": return `Summarise ${topic} as an ordered list of what the student can now DO or recall — one line each, no new material — so they can write it down. Name what they are now able to explain, compute or do; do not announce that the lesson was interesting.`;
  }
}

// Coverage is measured in delivered teaching words. 30 words is a real teacher paragraph (roughly 12
// seconds of speech, several real sentences) and not a filler line; asking for more than a provider
// typically writes in one step would leave a stage permanently "uncovered" and make the lesson re-teach
// it forever, which is worse than accepting a slightly shorter step.
const DEEP_STAGE_MIN_WORDS = 30;
const BRIEF_STAGE_MIN_WORDS = 20;

/**
 * Adds the code stages to an arc that did not already have them.
 *
 * Inserted before the mistakes stage rather than appended, because a lesson that ends on an execution
 * trace has not summarised itself — the recap has to stay last.
 */
function insertCodeStages(arc: StageKind[]): StageKind[] {
  if (arc.includes("code")) return arc;
  const insertAt = arc.indexOf("mistakes") >= 0 ? arc.indexOf("mistakes") : arc.length;
  return [...arc.slice(0, insertAt), "code", "walkthrough", "execution", ...arc.slice(insertAt)];
}

/**
 * The stages this request actually needs.
 *
 * Three things are trimmed here rather than in the arc tables, because they depend on the REQUEST and
 * not on the subject:
 *
 *   * a brief request is one concept, not an arc — "define X in one sentence" must not be answered with
 *     fifteen stages of scaffolding the student explicitly did not ask for;
 *   * `derive` only when asked for, because a derivation nobody requested is padding;
 *   * `prerequisite` only when the student is unlikely to already have it. A request that names the
 *     thing it needs ("Explain the formula I already have in front of me") gets a refresh, not a course.
 */
function buildStages(intent: TeachingIntent, prerequisite: string, level: TeachingLevel, request: Pick<TeachingRequest, "question">): TeachingStage[] {
  const brief = intent.depth === "brief";
  const base: StageKind[] = brief
    ? ["concept"]
    : intent.subject === "programming"
      ? (intent.codeRelevant ? [...SUBJECT_ARCS.programming] : [...CONCEPT_ONLY_ARC])
      // Code belongs in any computational lesson where the student asked for it, not only when the
      // subject was classified as `programming`. "Explain binary search, trace it on an array" is a
      // computer-science request whose whole answer is code, and without the code stages it got a
      // lesson ABOUT an algorithm that never contained one.
      : (intent.codeRelevant && intent.subject === "computer-science"
        ? insertCodeStages(SUBJECT_ARCS["computer-science"])
        : [...SUBJECT_ARCS[intent.subject]]);
  const arc = brief ? base : trimForLevel(withDerivation(base, request), level);

  return arc.map((kind, index): TeachingStage => ({
    id: `s${index + 1}`,
    kind,
    title: kind === "notation" && intent.subject === "programming" ? "The basic shape of the code (syntax)" : STAGE_TITLES[kind],
    goal: stageGoal(kind, intent.topic, prerequisite, intent.codeLanguage),
    minWords: brief ? BRIEF_STAGE_MIN_WORDS : DEEP_STAGE_MIN_WORDS,
    needsVisual: !brief && VISUAL_KINDS.includes(kind),
    needsCode: !brief && intent.codeRelevant && CODE_KINDS.includes(kind),
    intent: STAGE_INTENTS[kind],
  }));
}

/**
 * Progressive depth, applied to the PLAN rather than to the speech register.
 *
 * Only the ADVANCED level is trimmed, and only of scaffolding: `intuition` (they do not need an
 * everyday analogy), `prerequisite` (they can be assumed to have it) and `advanced` (a harder worked
 * example teaches a student who has finished the easy one). Everything that makes a lesson a lesson —
 * `concept`, `why`, the worked example, `verify`, `recap` — survives at every level, because a student
 * who asked a sharp question still needs to be told why, and still needs the answer checked.
 *
 * Nothing is trimmed for a beginner or an intermediate student. There was a version of this that dropped
 * the harder example at intermediate level, on the theory that not everyone has finished the easy one;
 * that turned out to be a guess that removed real teaching, and the level's job is to set register, which
 * the prompt already does from `objective.level`.
 *
 * The level is re-inferred on the interruption path from the student's own words, so "I already know
 * this" genuinely does take the lesson forward rather than being stored as a preference.
 */
function trimForLevel(arc: StageKind[], level: TeachingLevel): StageKind[] {
  if (level !== "advanced") return arc;
  return arc.filter((kind) => !["intuition", "prerequisite", "advanced"].includes(kind));
}

/** Builds the complete teaching objective for a request. Deterministic: same question, same plan. */
export function buildLessonObjective(request: Pick<TeachingRequest, "question">): LessonObjective {
  const intent = classifyTeachingIntent(request.question);
  const brief = intent.depth === "brief";
  const level = teachingLevelFor({ question: request.question, depth: intent.depth });
  const prerequisite = brief ? "" : prerequisiteFor(intent);
  const stages = buildStages(intent, prerequisite, level, request);
  return {
    topic: intent.topic,
    subject: intent.subject,
    depth: intent.depth,
    level,
    codeRelevant: intent.codeRelevant,
    ...(intent.codeLanguage ? { codeLanguage: intent.codeLanguage } : {}),
    prerequisite,
    stages,
    // A deep lesson is not allowed to finish in one or two steps; a brief request is allowed to.
    minSteps: brief ? 1 : Math.max(6, Math.ceil(stages.length / 2)),
    maxSteps: brief ? 2 : 60,
    batchSize: brief ? 1 : 6,
  };
}

export function createLessonProgress(objective: LessonObjective): LessonProgress {
  return {
    topic: objective.topic,
    subject: objective.subject,
    depth: objective.depth,
    codeRelevant: objective.codeRelevant,
    stages: objective.stages,
    coveredStageIds: [],
    stageWords: {},
    stepsDelivered: 0,
    totalWords: 0,
  };
}

/** Rebuilds a progress record from what the browser echoed back, so an interruption never loses it. */
export function resumeLessonProgress(objective: LessonObjective, progress: LessonProgressView | undefined): LessonProgress {
  const fresh = createLessonProgress(objective);
  if (!progress) return fresh;
  const known = new Set(objective.stages.map((stage) => stage.id));
  const covered = (progress.coveredStageIds ?? []).filter((id) => known.has(id));
  const delivered = Number.isFinite(progress.stepsDelivered) ? Math.max(0, Math.trunc(progress.stepsDelivered)) : 0;
  return {
    ...fresh,
    coveredStageIds: covered,
    // Restored as well as the covered set, so a stage already credited in one batch does not have to be
    // credited again from nothing in the next one.
    stageWords: { ...fresh.stageWords, ...(progress.stageWords ?? {}) },
    stepsDelivered: delivered,
  };
}

export const wordCount = (text: string): number => (text.trim().match(/\S+/g) ?? []).length;

/** The stage the next batch must teach: the first planned stage that is not covered yet. */
export function currentStage(progress: LessonProgress): TeachingStage | null {
  return progress.stages.find((stage) => !progress.coveredStageIds.includes(stage.id)) ?? null;
}

export function remainingStages(progress: LessonProgress): TeachingStage[] {
  return progress.stages.filter((stage) => !progress.coveredStageIds.includes(stage.id));
}

/**
 * The stage a step is credited to.
 *
 * The model's own `stage_id` is honoured when it names a stage that is still uncovered — `covered` is the
 * LIVE set, so a stage covered earlier in the same batch already counts. When it names one that is
 * ALREADY covered, the step is credited to the first stage still uncovered instead: the provider is
 * plainly teaching on and only its bookkeeping is stale. Without that fallback a lesson re-taught its
 * first stage forever — a Newton-laws run reached twenty-four steps and covered one stage of eleven,
 * because every step of every batch declared the stage id it had just been told to teach.
 */
function stageForStep(progress: LessonProgress, step: TeachingResponse, covered: Set<string>, cursor: TeachingStage | null): TeachingStage | null {
  const declared = step.stage_id ? progress.stages.find((stage) => stage.id === step.stage_id) : undefined;
  if (!declared) return cursor;
  return covered.has(declared.id) ? cursor : declared;
}

/**
 * Records what a batch ACTUALLY taught. Coverage is measured in delivered teaching words, so a step
 * that only says "lesson complete", or a provider that repeats its own step number, credits nothing.
 */
export function applyStepsToProgress(progress: LessonProgress, steps: TeachingResponse[]): LessonProgress {
  const covered = new Set(progress.coveredStageIds);
  const stageWords = { ...progress.stageWords };
  let cursor = currentStage(progress);
  let totalWords = progress.totalWords;

  for (const step of steps) {
    const stage = stageForStep(progress, step, covered, cursor);
    const words = wordCount(step.speech ?? "");
    totalWords += words;
    if (stage) {
      stageWords[stage.id] = (stageWords[stage.id] ?? 0) + words;
      if ((stageWords[stage.id] ?? 0) >= stage.minWords) covered.add(stage.id);
    }
    // Move the cursor on once the current stage has been taught, so the next step in the same batch
    // starts the following stage even when the provider did not label its steps.
    if (stage && cursor && (covered.has(cursor.id) || stage.id === cursor.id)) {
      cursor = remainingStages({ ...progress, coveredStageIds: Array.from(covered), stageWords }).find((candidate) => !covered.has(candidate.id)) ?? null;
    }
  }

  return {
    ...progress,
    coveredStageIds: progress.stages.filter((stage) => covered.has(stage.id)).map((stage) => stage.id),
    stageWords,
    stepsDelivered: progress.stepsDelivered + steps.length,
    totalWords,
  };
}

/**
 * The ONLY definition of "lesson complete": every planned stage was taught with enough substance and
 * the lesson ran long enough to be a lesson. Never a timer, never a provider flag, never a batch.
 */
export function isObjectiveComplete(progress: LessonProgress, objective: LessonObjective): boolean {
  if (progress.stepsDelivered >= objective.maxSteps) return true;
  if (progress.stepsDelivered < objective.minSteps) return false;
  return progress.stages.every((stage) => progress.coveredStageIds.includes(stage.id));
}

/**
 * ONE AUTHORITATIVE LESSON STATE.
 *
 * "Complete" was previously read straight off the server's objective while the step rail counted the
 * steps actually delivered, so a lesson could announce "Lesson complete" beside "Step 2 of 5" — two
 * truths from two sources, disagreeing, with the student left to guess which one to believe. The
 * objective answers "has the topic been covered?"; the client knows "what can I still play?". This
 * combines them into a single derived state, so the panel, the rail and the buttons cannot disagree.
 *
 * The distinction that matters: the TOPIC being covered and the LESSON being finished are different
 * facts. A teacher can have said everything the plan required while three more cached steps remain
 * that the student may still step through or replay.
 */
export type LessonPhase = "teaching" | "objective-covered" | "complete";

export type LessonState = {
  /** Every stage the plan listed has been taught. */
  stagesComplete: boolean;
  /** The teacher has nothing further to add against the objective. */
  objectiveComplete: boolean;
  /** Already-fetched steps the student can still step to from here. */
  remainingCachedSteps: number;
  /** Another request would fetch more teaching. */
  canFetchMore: boolean;
  phase: LessonPhase;
  /** Nothing is reachable by any route: no cached steps left, and no more would be fetched. */
  nothingLeft: boolean;
};

export function deriveLessonState(input: {
  progress: Pick<LessonProgressView, "stages" | "coveredStageIds" | "complete"> | null;
  /** Highest step number fetched so far; steps are not necessarily contiguous. */
  deliveredSteps: number;
  /** Step number currently on screen, or null before the first step. */
  activeStep: number | null;
}): LessonState {
  const progress = input.progress;
  const stagesComplete = Boolean(progress) && progress!.stages.every((stage) => progress!.coveredStageIds.includes(stage.id));
  const objectiveComplete = Boolean(progress?.complete);
  const remainingCachedSteps = Math.max(0, input.deliveredSteps - (input.activeStep ?? 0));
  const canFetchMore = !objectiveComplete;
  // Covered-but-not-finished is a real state, and hiding it is what produced the contradiction: the
  // teacher had said everything required, yet the student still had steps to step through.
  const phase: LessonPhase = objectiveComplete
    ? (remainingCachedSteps > 0 || input.activeStep === null ? "objective-covered" : "complete")
    : "teaching";
  return {
    stagesComplete,
    objectiveComplete,
    remainingCachedSteps,
    canFetchMore,
    phase,
    nothingLeft: objectiveComplete && remainingCachedSteps === 0 && input.activeStep !== null,
  };
}

export function lessonProgressView(progress: LessonProgress, objective: LessonObjective): LessonProgressView {
  const current = currentStage(progress);
  return {
    topic: progress.topic,
    subject: progress.subject,
    depth: progress.depth,
    codeRelevant: progress.codeRelevant,
    stages: progress.stages,
    coveredStageIds: progress.coveredStageIds,
    remainingStageIds: remainingStages(progress).map((stage) => stage.id),
    currentStageId: current?.id ?? null,
    currentStageTitle: current?.title ?? null,
    stageWords: { ...progress.stageWords },
    stepsDelivered: progress.stepsDelivered,
    minSteps: objective.minSteps,
    maxSteps: objective.maxSteps,
    complete: isObjectiveComplete(progress, objective),
  };
}