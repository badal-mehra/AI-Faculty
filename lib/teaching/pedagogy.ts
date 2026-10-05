// PEDAGOGICAL SEMANTIC LAYER — the vocabulary the teacher thinks in.
//
// The gap this file exists to close: the model used to be asked for rendering instructions, so it
// answered with rendering instructions. A lesson about integrating x²·sin(x) came back with the answer,
// a formula box, and no explanation of what the symbols meant or why integration by parts was the right
// choice — technically a valid lesson, and educationally nothing at all. The board looked like a
// generated infographic because the only thing the model could describe was *shapes*.
//
// So the model is now asked to describe TEACHING: what act of teaching this step is, which concept it
// serves, what a formula means symbol by symbol, why a method applies. This module holds those types.
//
// It is deliberately NOT a renderer and NOT a planner:
//
//   * it declares no geometry, no coordinates, no React;
//   * `lib/visual/**` and `lib/visual3d/**` still compile everything deterministically;
//   * `lib/teaching/alignment.ts` still decides what may reach a screen.
//
// The one thing this module does on its own is *measure*: given what a teacher said, work out which of
// the concerns a lesson is supposed to address (see `concernsAddressed`) are actually addressed. That is
// how "answer first, explanation later" becomes a measured failure instead of a matter of opinion.
//
// Every list here is derived from the request text, not from a topic table. "Which prerequisites does
// this question actually need?" is answered by reading the question's own vocabulary and the lesson arc
// that was planned for it — the same mechanism the asset registry already uses.

import type { TeachingDepth, TeachingSubject } from "./intent";

// ---------------------------------------------------------------------------------------------
// Teaching intent — the act this step performs
// ---------------------------------------------------------------------------------------------

/**
 * The single most important addition to the contract.
 *
 * `StageKind` (`lib/teaching/objective.ts`) answers "which PART of the lesson is this"; a
 * `TeachingIntent` answers "what is the teacher DOING right now". They are different questions and a
 * lesson needs both: the recap stage is made of `explain_why` and `check_understanding` steps, not of
 * one undifferentiated kind.
 *
 * They are also different frequencies. A stage is taught across several steps; an intent is what ONE
 * step is for, which is why it belongs on the step and not on the stage.
 */
export const TEACHING_INTENTS = [
  // Opening the idea
  "introduce_concept",
  "prerequisite",
  "define",
  "intuition",
  // Making meaning out of symbols
  "explain_formula",
  "explain_variable",
  "explain_units",
  "explain_relationship",
  // The reasoning a student actually needs
  "explain_why",
  "choose_method",
  "derive",
  // Working a problem
  "identify_given",
  "identify_unknown",
  "substitute",
  "calculate",
  "simplify",
  // Making it stick
  "demonstrate",
  "worked_example",
  "verify",
  "compare",
  "application",
  // What the result means. Distinct from `application`: this is reading THIS answer, not pointing at
  // where the method gets used later.
  "interpret",
  "common_mistake",
  "check_understanding",
  "recap",
] as const;

export type TeachingIntent = typeof TEACHING_INTENTS[number];

// A teaching step that performs no teaching act is a narration step. Kept separate so `parsePedagogy`
// can accept a step with speech only (an interruption answer) without inventing an intent for it.
export const UNDECLARED_INTENT = null;

// ---------------------------------------------------------------------------------------------
// Formula teaching — first class, never decoration
// ---------------------------------------------------------------------------------------------

export type FormulaVariable = {
  /** Exactly the symbol as it appears in the formula: "F", "m", "v₀", "τ". */
  symbol: string;
  /** What it is, in the student's words: "net force". */
  meaning: string;
  /** Its unit, when it has one: "N", "kg", "m/s²", "s". Empty string when dimensionless. */
  unit?: string;
};

export type FormulaTeaching = {
  /** The formula itself, written out: "F = ma", "V(t) = V₀(1 - e^(-t/RC))". */
  formula: string;
  /** What the formula CALCULATES, in one sentence: "the net force needed to give a mass that acceleration". */
  calculates?: string;
  /** Why this formula is the right one HERE: "because we know the mass and the acceleration, and need the force". */
  why?: string;
  /** What must be true for it to apply at all: "constant mass", "a rigid body in one dimension". */
  assumptions?: string[];
  /** The symbol table. This is what makes a formula teach rather than decorate. */
  variables?: FormulaVariable[];
  /** The steps from the formula to the worked values, when a derivation is educationally useful. */
  derivation?: string[];
};

/**
 * A symbol a formula contains, extracted deterministically.
 *
 * Written so it works on real formulas rather than the textbook subset: a symbol is a letter or a
 * letter-digit group, and it is only a symbol if it is not a known function name. Getting this right is
 * what lets the gate notice a lesson that wrote "F = ma" three times and never once said what F means.
 */
export function symbolsInFormula(formula: string, declared?: readonly string[]): string[] {
  if (!formula) return [];
  // Function names are not symbols: sin(x) contributes "x", not "sin".
  const withoutFunctions = formula.replace(/\b(sin|cos|tan|log|ln|exp|sqrt|abs|min|max|lim|int|sum|diff)\b/gi, " ");
  const found = withoutFunctions.match(/\b[A-Za-z](?:_\{[^{}]*\}|[0-9]+|[A-Za-z])*\b/g) ?? [];
  const protectedNames = new Set((declared ?? []).map((symbol) => symbol.toLowerCase()));
  const tokens = found.flatMap((token) => (protectedNames.has(token.toLowerCase()) ? [token] : splitMathematicalToken(token)));
  return Array.from(new Set(tokens.filter((symbol) => !/^\d/.test(symbol) && symbol.length <= 6)));
}

/**
 * Splits a run of letters into the individual variables it almost always is.
 *
 * Textbooks write products without spacing — "F = ma", "t/RC" — so a word-boundary rule reads `ma` as
 * one symbol and `RC` as none at all, which is how a lesson about Newton's law ends up with the gate
 * reporting that `m` and `a` were never explained while the formula plainly contains them. Two and
 * three letter runs are split; anything longer is left alone, because a four-letter run is a word.
 */
function splitMathematicalToken(token: string): string[] {
  const match = /^([A-Za-z])([A-Za-z]{0,2})$/.exec(token);
  if (match && token.length >= 2 && token.length <= 3) return token.split("");
  return [token];
}

/** The words that mark a definition being given rather than a term merely being used. */
const DEFINITION_CUE = /\b(?:where|means|stands for|refers to|represents|denotes|called|symbol|is the|are the)\b/i;

/**
 * True when the speech actually says what a symbol stands for.
 *
 * Two forms are accepted, and only two: the teacher defining the symbol directly ("where F is the net
 * force", "m stands for mass"), or using the symbol's own declared MEANING in a defining sentence ("F is
 * the net force"). Both require a definition cue.
 *
 * A bare mention is deliberately not enough. "…is F = ma and it is a very useful relationship…" mentions
 * F, m and a and explains none of them, and treating the mention as the explanation is precisely how a
 * formula ends up looking taught while nothing about it was. The declared meaning is used only as a way to
 * recognise the second form, never as evidence by itself: the meaning being in the payload is not the
 * teacher saying it out loud, and the student learns from what is said.
 */
export function speechExplainsSymbol(speech: string, symbol: string, meaning?: string): boolean {
  const base = symbol.replace(/_\{.*\}/, "").toLowerCase();
  if (!base) return false;
  const lower = speech.toLowerCase();
  if (!lower.includes(base)) return false;
  const escaped = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (new RegExp(`\\bwhere\\s+${escaped}\\b`).test(lower)) return true;
  if (new RegExp(`\\b${escaped}\\s*(?:is|are|means|stands for|represents|refers to|denotes)\\b`).test(lower)) return true;
  if (!meaning || !DEFINITION_CUE.test(speech)) return false;
  const words = meaning.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
  return words.length > 0 && words.some((word) => lower.includes(word));
}

/**
 * The symbols a formula introduced that nothing in the lesson ever explained.
 *
 * The formula's own `variables` list is deliberately NOT treated as an explanation: it is the intent to
 * explain, and the gate draws it onto the board as a table, but the student learns the symbols from what
 * the teacher says. Counting the declaration would make every formula look explained the moment the
 * provider declared it, which is the failure this exists to catch.
 */
/**
 * The symbols a formula introduced that nothing in the lesson ever explained.
 *
 * Only DECLARED symbols are reported. A teacher who writes `variables: [F, m, a]` and then says nothing
 * about any of them has taught a formula by displaying it, which is the failure this exists to catch.
 *
 * Undeclared tokens are not reported, and the reason is specific rather than cautious: textbooks write
 * products with no spacing ("F = ma") and differentials the same way ("∫u dv"), so `ma` and `dv` are
 * indistinguishable from the string alone. Reporting the ambiguity would cry wolf on every correct
 * lesson, and a gate that cries wolf gets ignored — which is worse than missing a symbol.
 */
export function unexplainedSymbols(formula: FormulaTeaching | undefined, allSpeech: string): string[] {
  if (!formula) return [];
  const declared = (formula.variables ?? []).map((variable) => variable.symbol);
  const meanings = new Map((formula.variables ?? []).map((variable) => [variable.symbol.toLowerCase(), variable.meaning]));
  return declared.filter((symbol) => !speechExplainsSymbol(allSpeech, symbol, meanings.get(symbol.toLowerCase())));
}

// ---------------------------------------------------------------------------------------------
// The per-step pedagogical payload
// ---------------------------------------------------------------------------------------------

/**
 * Everything the teacher knows about this step that is NOT a rendering instruction.
 *
 * Bounded on purpose: twelve optional short strings and one optional formula object. A lesson is six
 * steps a batch, and the request budget is 7000 tokens shared with a large action vocabulary — a payload
 * that tried to carry every pedagogical field on every step would push a busy lesson off the most
 * detailed context level and lose the scene state it needed. Only `teaching_intent` is worth filling in
 * every step; the rest belongs exactly where it applies.
 */
export type PedagogicalBlock = {
  /** The one concept the step is about, in the student's vocabulary. */
  concept?: string;
  /** What must be understood before this step makes sense. */
  prerequisite?: string;
  /** WHY — the reasoning that makes a choice non-arbitrary. The single most valuable field here. */
  why?: string;
  /** A worked value, calculation, or trace, when the step contains one. */
  example?: string;
  /** How the result should be read. "This means the object needs 20 N to accelerate at 4 m/s²." */
  interpretation?: string;
  /** How the result was checked. Differentiate it back; substitute it in; check the units. */
  verification?: string;
  /** The formula this step teaches, symbol by symbol. */
  formula?: FormulaTeaching;
};

// ---------------------------------------------------------------------------------------------
// Adaptive depth
// ---------------------------------------------------------------------------------------------

export type TeachingLevel = "beginner" | "intermediate" | "advanced";

/**
 * The level a lesson starts at, inferred from the request.
 *
 * The brief is explicit that the student must not have to pick a level, so this is inferred from three
 * signals the request already carries: how explicitly brief it is, whether it names a specific artefact
 * to reason about (a formula to solve, a circuit to analyse — that is a student who can handle detail),
 * and whether it asks for the deep treatment by name ("from first principles", "derive", "why").
 */
export function teachingLevelFor(request: { question: string; depth: TeachingDepth }): TeachingLevel {
  const text = request.question.toLowerCase();
  if (request.depth === "brief") return "beginner";
  // ADVANCED is only ever inferred from an EXPLICIT request for the deep treatment.
  //
  // An earlier version also counted "solve this matrix problem" as advanced, on the reasoning that a
  // student naming an artefact wants method rather than introduction. That inference is wrong: the shape
  // of a question says what is being ASKED for, never what is already KNOWN, and reading it as knowledge
  // silently deleted the prerequisite stage from every calculation request — exactly the student who most
  // needs it.
  if (/\b(?:first principles|from scratch,? derive|derive (?:it |this |the )?(?:fully|carefully|properly)|rigorous(?:ly)?|proof|prove|proof of|why (?:does|do|is|are) (?:this|it|that))\b/i.test(text)) return "advanced";
  if (/\b(?:deep dive|in depth|step by step derivation|full derivation|show (?:me )?(?:the )?(?:derivation|proof))\b/i.test(text)) return "advanced";
  // The student saying they DO already know something is the one reliable knowledge signal in a first
  // message, and it is why "I already know this, take it further" is honoured rather than ignored.
  if (/\b(?:i (?:already )?know|i (?:have )?(?:already )?(?:done|covered|studied)|skip the basics|no need to explain (?:the )?basics|assume i know|you can skip)\b/i.test(text)) return "advanced";
  if (/\b(?:beginner|simple|basic|eli5|i (?:am|'m) new|don'?t know|never (?:studied|learned)|introduction to|what is|what'?s|how does .{0,30} work)\b/i.test(text)) return "beginner";
  return "intermediate";
}

/** The one-paragraph rule the prompt uses to set register. Deliberately short: it is sent every request. */
export function levelGuidance(level: TeachingLevel): string {
  switch (level) {
    case "beginner":
      return "BEGINNER: plain language, no unexplained jargon, define every term the first time it appears, lean on intuition and small concrete numbers, and show the visual before the symbols.";
    case "advanced":
      return "ADVANCED: assume the standard prerequisites, do not re-define common terms, and spend the steps on the reasoning — why this method, what it assumes, where it breaks, and what the result means physically or algorithmically.";
    case "intermediate":
      return "INTERMEDIATE: brief prerequisite refresh, then the concept, the formula or algorithm with its symbols named, the reasoning behind each step, one worked example, and where it is used.";
  }
}

// ---------------------------------------------------------------------------------------------
// The seventeen concerns, measured
// ---------------------------------------------------------------------------------------------

/** The questions a lesson is supposed to answer, grouped the way the brief groups them. */
export const TEACHING_CONCERNS = [
  "what_is_asked",
  "prerequisites",
  "central_concept",
  "relevant_rules",
  "symbols",
  "why_this_formula",
  "what_the_formula_does",
  "derivation",
  "how_to_apply",
  "each_step_valid",
  "verification",
  "intuition",
  "where_used",
  "what_to_remember",
  "can_solve_similar",
] as const;

export type TeachingConcern = typeof TEACHING_CONCERNS[number];

/**
 * Which concerns each intent is *evidence* for.
 *
 * This is what turns "the answer is not the lesson" from a slogan into a number. A lesson whose steps
 * only ever declare `introduce_concept` and `calculate` has answered two concerns; one that also
 * declares `explain_variable`, `explain_why`, `explain_units` and `verify` has answered six, and the
 * difference is visible in `LessonQualityReport.concernsCovered` without anybody reading the speech.
 */
const INTENT_EVIDENCE: Record<TeachingIntent, readonly TeachingConcern[]> = {
  introduce_concept: ["what_is_asked", "central_concept"],
  prerequisite: ["prerequisites"],
  define: ["central_concept"],
  intuition: ["intuition"],
  explain_formula: ["relevant_rules", "what_the_formula_does"],
  explain_variable: ["symbols"],
  explain_units: ["symbols"],
  explain_relationship: ["how_to_apply"],
  explain_why: ["why_this_formula", "each_step_valid"],
  choose_method: ["why_this_formula"],
  derive: ["derivation"],
  identify_given: ["how_to_apply"],
  identify_unknown: ["how_to_apply"],
  substitute: ["how_to_apply"],
  calculate: ["how_to_apply"],
  simplify: ["how_to_apply"],
  demonstrate: ["each_step_valid", "intuition"],
  worked_example: ["how_to_apply", "each_step_valid"],
  verify: ["verification"],
  compare: ["intuition"],
  application: ["where_used"],
  interpret: ["each_step_valid"],
  common_mistake: ["can_solve_similar"],
  check_understanding: ["can_solve_similar"],
  recap: ["what_to_remember", "can_solve_similar"],
};

export function concernsForIntent(intent: TeachingIntent): readonly TeachingConcern[] {
  return INTENT_EVIDENCE[intent];
}

/** Every concern the lesson's declared intents actually addressed. */
export function concernsAddressed(intents: readonly (TeachingIntent | null | undefined)[]): TeachingConcern[] {
  const covered = new Set<TeachingConcern>();
  for (const intent of intents) {
    if (!intent) continue;
    for (const concern of INTENT_EVIDENCE[intent]) covered.add(concern);
  }
  return TEACHING_CONCERNS.filter((concern) => covered.has(concern));
}

/** A subject lesson is expected to touch at least this much of the seventeen. */
export const CONCERN_TARGET: Record<TeachingSubject, number> = {
  mathematics: 9,
  physics: 9,
  engineering: 9,
  chemistry: 8,
  programming: 8,
  networking: 7,
  "computer-science": 8,
  biology: 7,
  astronomy: 7,
  humanities: 6,
  general: 6,
};

// ---------------------------------------------------------------------------------------------
// Reasoning, results and verification, detected in plain speech
// ---------------------------------------------------------------------------------------------

/**
 * Whether the teacher gave a REASON, as opposed to a procedure.
 *
 * "Then we differentiate x²" is a procedure. "We differentiate x² rather than sin(x) because the
 * product rule makes the integral worse" is a reason. Only the second one teaches a student to choose
 * for themselves, so it is the only one this recognises.
 */
const WHY_CUE = /\b(?:because|since|so that|which means that|the reason|we (?:use|choose|pick|take) this|this works (?:because|since)|it would (?:be|get) (?:harder|worse|hard)|instead of|rather than|the point is|the whole idea|that'?s why|the key (?:idea|insight|trick))\b/i;

/**
 * Whether a step CONCLUDES a result.
 *
 * Deliberately narrow. An earlier version also matched "we get", "hence" and "equals", and those fire on
 * ordinary teaching — "we get a quadratic", "hence the force doubles", "F equals m times a" — so it
 * reported a step that simply wrote down the law as having given the answer away. A rule that fires on
 * correct teaching is a rule the teacher learns to ignore, which is worse than not having it.
 *
 * What remains is an explicit statement that THIS step is the one where the answer arrives.
 */
const RESULT_CUE = /\b(?:the answer (?:is|to)|so the answer|therefore the answer|the final answer is|the final answer is|hence the answer|the result is therefore|the solution is therefore)\b/i;

/** Whether the result was checked. Bounded: verification is required where it is meaningful, not always. */
const VERIFY_CUE = /\b(?:verify|check(?:ing)? (?:it|the (?:answer|result|units|dimensions|behaviour|output|trace))|differentiate(?:d)? (?:it|the result|back)|substitut(?:e|ing) back|sanit(?:y|ise|ize)|by symmetry|does it make sense|dimension(?:al)?(?:ly)? consistent|unit check|cross-check|as a sanity check|plot(?:ting)? it|does that match)\b/i;

export function hasWhyCue(speech: string): boolean {
  return WHY_CUE.test(speech);
}

export function hasResultCue(speech: string): boolean {
  return RESULT_CUE.test(speech);
}

export function hasVerificationCue(speech: string): boolean {
  return VERIFY_CUE.test(speech);
}

/** Every teaching line that carried no reasoning. Filler lines are reported per step. */
export function sentencesWithoutReasoning(speech: string): string[] {
  return speech
    .split(/(?<=[.!?।])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 12)
    .filter((sentence) => !WHY_CUE.test(sentence) && !RESULT_CUE.test(sentence) && !VERIFY_CUE.test(sentence));
}

/**
 * How deep the request's own vocabulary suggests the lesson should go, independent of subject.
 *
 * Used only to decide whether a concept arc needs its notation and mechanics stages trimmed, so a
 * "what is X" question does not get a derivation lesson. It is a floor, never a ceiling: a student who
 * asks a shallow question still gets a complete lesson if the subject arc calls for one.
 */
export function wantsDerivation(request: { question: string }): boolean {
  return /\b(derive|derivation|prove|proof|from first principles|why)\b/i.test(request.question);
}
