// LESSON QUALITY — the gate a lesson must pass before it may be called a lesson.
//
// A 200 response, a schema-valid batch and a board full of actions are all *transport* facts. None of
// them says a student learned anything. This module judges the teaching itself, and it exists because
// every previous gate was satisfied by the exact failures that reached the screen: a lesson about the
// heart returned valid actions and produced one white cube; a lesson about derivatives said "on the
// board, imagine a secant line" and drew nothing.
//
// The verdict is deliberately conservative and always returns REASONS. It is used by the acceptance
// run, by the diagnostics endpoint, and by the classroom (which refuses to announce completion for a
// lesson that failed its own quality bar), so it must never be a rubber stamp.
import { TeachingRequest, TeachingResponse } from "./types";
import { LessonObjective, LessonProgress, wordCount } from "./objective";
import { alignTeachingStep, AlignmentContext, sceneKindOf, StepAlignmentReport } from "./alignment";
import { applyVisualActions } from "../visual/engine";
import { parseVisualActions } from "../visual/validate";
import { emptyVisualScene, VisualScene } from "../visual/types";
import { assessScene, optimiseScene } from "../visual/semantics";
import { referencedIds } from "../visual/lifecycle";
import { composeScene, compositionLogLine, HARD_CURRENT_SHARE, type CompositionDiagnostics } from "../visual/composition";
import { classifyDomain } from "./taxonomy";
import { visualPolicyFor, ALL_STRUCTURE_ACTIONS } from "./visualPolicy";
import {
  CONCERN_TARGET,
  concernsAddressed,
  hasResultCue,
  hasVerificationCue,
  TeachingConcern,
  TeachingIntent,
  unexplainedSymbols,
} from "./pedagogy";
import { stageIntent } from "./objective";

export type TeachingQualityIssue = {
  /** Machine-readable kind, so an acceptance check can assert on it without matching prose. */
  kind:
    | "meta-narration"
    | "repetition"
    | "thin-step"
    | "unbacked-visual"
    | "visual-stagnation"
    | "premature-answer"
    | "unexplained-formula"
    | "formula-not-shown"
    | "missing-verification"
    | "intent-mismatch"
    | "thin-concern-coverage"
    | "unclear-visual-focus"
    | "no-conclusion";
  lessonStep: number;
  detail: string;
};

export type LessonQualityReport = {
  topic: string;
  subject: string;
  /** The stage this lesson shows for its whole duration. */
  representation: "2d" | "3d";
  steps: number;
  /** Words of real teaching speech delivered. */
  words: number;
  /** Steps whose board changed. */
  visualSteps: number;
  /** The real things the lesson talked about, and how many of them reached the board. */
  entitiesNamed: string[];
  entitiesShown: string[];
  /** Of the fifteen concerns a lesson is supposed to answer, the ones these steps actually addressed. */
  concernsCovered: string[];
  /** What the lesson should have reached, per its subject. */
  concernsTarget: number;
  /** The teaching acts the steps declared, in order. */
  intentsDeclared: (string | null)[];
  /** How many steps declared one at all. */
  stepsWithIntent: number;
  /** Words of real teaching speech delivered. */
  modelledEntities: string[];
  promotedPrimitives: number;
  labelsAdded: number;
  substitutions: string[];
  droppedActions: number;
  /** Decorative elements removed because nothing in the speech gave them a reason to be on the board. */
  decorativeDropped: number;
  /** 0-100 for the board the student will see: focus, currency, identity, readability, density, connectivity. */
  visualScore: number;
  /** What is wrong with that board, in the order the repair pass would fix it. */
  visualProblems: string[];
  /** Objects the repair pass removed, and restatements it merged. */
  visualRemoved: number;
  visualMerged: number;
  /**
   * What each composed step's board actually showed: what was current, what was retired, how crowded it
   * was, and how many foreign representations survived. This is the "the board is not a history" evidence.
   */
  composition: Array<CompositionDiagnostics & { lessonStep: number }>;
  issues: TeachingQualityIssue[];
  perStep: StepAlignmentReport[];
  /** False when any issue above is severe enough that the lesson did not teach its topic. */
  ok: boolean;
};

// Teaching acts that owe the student a picture. A step with one of these and nothing on the board is a
// gap; a step without one may legitimately be words only.
const VISUAL_INTENTS = new Set(["visual", "demonstrate", "worked_example", "identify_given", "calculate", "verify", "intuition"]);

// Sentences that talk ABOUT the lesson instead of teaching it. A real tutor does not spend a stage on
// "as we move forward, keep in mind that…": it is the most common filler in generated lessons and it
// consumes the stage a concept should have been taught in.
//
// Deliberately narrow. "Remember that the handshake is three steps" IS the summary the recap stage is
// for, and flagging it as filler would punish exactly the behaviour the same prompt demands.
const META_NARRATION = [
  /\bas we (?:move|proceed|go) forward\b/i,
  /\byou are now ready\b/i,
  /\bnow that you (?:understand|know|have)\b/i,
  /\bbefore we (?:dive|move|go) (?:in|into|deeper)\b/i,
  /\blet(?:'s| us) (?:now )?(?:move on|dive|get started|continue)\b/i,
  /\bwe (?:have|had) (?:established|covered) (?:that|the basics)\b/i,
];

/** The teacher's own words that promise something on the board. */
const VISUAL_CLAIM = /\b(?:on the board|here (?:is|are) the (?:code|listing|formula|equation|diagram|picture|array|stack|tree|graph|pipeline|sequence)|let(?:'s| us) (?:visuali[sz]e|show|draw|look at|see|write)|we (?:will|'ll) (?:write|see|draw|look at|walk through)|as you can see|watch (?:as|how)|imagine (?:a|an|the|two|three) [\w\s]{0,30} (?:on|connected|next to|above|below|inside|between))\b/i;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?।])\s+/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 0);
}

/** Words that carry no information when comparing two steps for repetition. */
const NOISE_WORDS: ReadonlySet<string> = new Set([
  "that", "this", "with", "from", "have", "will", "they", "them", "then", "than", "when", "what",
  "your", "here", "into", "also", "just", "like", "more", "some", "each", "which", "because",
  "were", "been", "being", "their", "there", "these", "those", "about", "would", "could", "should",
]);

/** Content words, used for the repetition test. */
function contentWords(text: string): Set<string> {
  return new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/)
      .filter((word) => word.length > 3)
      .filter((word) => !NOISE_WORDS.has(word)),
  );
}

function overlapRatio(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/**
 * Runs alignment over a whole batch and judges the teaching.
 *
 * `context` is built from what the CLASSROOM sent (the live scene), so the same function works for the
 * first batch of a lesson, for a mid-lesson continuation and for a student interruption.
 */
export function alignAndJudge(
  request: TeachingRequest,
  steps: TeachingResponse[],
  objective: LessonObjective,
  progress: LessonProgress,
  representation: "2d" | "3d",
): { steps: TeachingResponse[]; report: LessonQualityReport } {
  const live3dObjects = (request.visualState3d?.objects ?? []).map((object) => ({ id: object.id, asset: object.asset }));
  const liveDiagramObjects = (request.visualState?.objects ?? []).map((object) => ({ id: object.id, kind: object.kind }));
  const liveBoardIds = [...request.boardState.nodes.map((node) => node.id), ...request.boardState.texts.map((text) => text.id)];
  // What the board already holds, GROWING as the batch is replayed. A batch is a sequence of steps, and
  // step four legitimately refers to the model step two created; without this, every cross-step reference
  // inside one batch looked like a reference to nothing and was dropped.
  const known3d: Array<{ id: string; asset?: string }> = [...live3dObjects];
  const known2d: Array<{ id: string; kind: string }> = [...liveDiagramObjects];
  const knownBoard: string[] = [...liveBoardIds];

  const perStep: StepAlignmentReport[] = [];
  const compositionLog: Array<CompositionDiagnostics & { lessonStep: number }> = [];
  // The domain and its representation policy, resolved ONCE for the batch: every step of one lesson is
  // about the same thing, and re-resolving per step would let the subject drift mid-lesson.
  const decision = classifyDomain(objective.topic, request.question).primary;
  const domain = decision.domain;
  const subdomain = decision.subdomain ?? undefined;
  const policy = visualPolicyFor(domain, objective.subject);
  const compositionPolicy = {
    domain,
    coarse: policy.coarse,
    allowCode: policy.allowCode,
    structures: policy.structures,
    structureActions: ALL_STRUCTURE_ACTIONS,
  };
  const issues: TeachingQualityIssue[] = [];
  const aligned: TeachingResponse[] = [];
  const spokenSoFar: Array<{ step: number; words: Set<string> }> = [];
  const seenWords = new Set(request.previousTeaching ?? []);
  const entityOrder: string[] = [];
  const shown = new Set<string>();

  let known2dScene: VisualScene = emptyVisualScene();
  let visual = { score: 0, problems: [] as string[], removed: 0, merged: 0, step: 0 };
  let visualSteps = 0;
  let totalWords = 0;
  let stagnantRun = 0;
  let lastVisual = false;
  const intentsDeclared: (string | null)[] = [];
  const decorativeDropped = perStepCount(perStep, "decorative");

  for (const step of steps) {
    const stage = step.stage_id ? objective.stages.find((candidate) => candidate.id === step.stage_id) : undefined;
    const context: AlignmentContext = {
      question: request.question,
      topic: objective.topic,
      subject: objective.subject,
      deep: objective.depth === "deep",
      representation,
      live3dObjects: known3d,
      liveDiagramObjects: known2d,
      liveBoardIds: knownBoard,
      // The ONLY thing that makes a code listing legitimate. Without this threaded through, a design lesson
      // could not be told apart from a programming one at the point where the decision is enforced.
      codeRelevant: objective.codeRelevant,
      ...(stage ? { stageKind: stage.kind } : {}),
    };
    const { step: alignedStep, report } = alignTeachingStep(step, context);
    // Replay what the student will see, so the NEXT step of this batch is judged against a board that
    // actually exists rather than the one that existed before the batch started.
    for (const action of alignedStep.visual3d_actions) {
      if (action.action === "create_3d_object") {
        known3d.push({ id: action.id, ...(action.asset ? { asset: action.asset } : {}) });
      }
    }
    for (const action of alignedStep.visual_actions) {
      if ("id" in action && typeof action.id === "string") known2d.push({ id: action.id, kind: sceneKindOf(action) });    }
    for (const action of alignedStep.board_actions) {
      if ("id" in action && typeof action.id === "string") knownBoard.push(action.id);
    }
    perStep.push(report);
    intentsDeclared.push(step.teaching_intent ?? null);
    // THE BOARD, SCORED AND REPAIRED.
    //
    // The step is replayed through the real engine so the verdict describes the scene the student will
    // actually see, not a count of actions that were issued. A step that painted fourteen things and
    // left the student hunting through them fails here even though every one of those actions applied
    // cleanly — which is exactly the failure a schema check cannot see.
      const parsedActions = parseVisualActions(alignedStep.visual_actions);
      if (parsedActions) {
        const played = applyVisualActions(known2dScene, parsedActions, {
          step: step.lesson_step,
          stage: Math.max(0, (progress.coveredStageIds?.length ?? 0) - 1),
        });
        // What the optimiser WOULD remove from this step's input. Reported, never applied.
        const optimised = optimiseScene(played, {
          step: step.lesson_step,
          ...(step.teaching_intent ? { intent: step.teaching_intent } : {}),
          referenced: referencedIds(parsedActions),
        });
        // CURRENT-STEP COMPOSITION, replayed through the same code the classroom runs.
        //
        // The lifecycle decides what is stale; composition decides what FITS and whether what remains is about
        // now. Replaying it here is what makes the numbers in the log describe the board a student would
        // actually see, rather than a scene that only exists inside the quality gate.
        //
        // IT COMPOSES `played`, NOT `optimised.scene` — and that distinction was worth a real bug. The
        // classroom composes straight from the engine's output, so feeding the gate's own repair pass in first
        // made this replay describe a board the student never sees. In the first acceptance run that phantom
        // board was BLANK for four consecutive steps of a working calculus lesson while the browser screenshots
        // showed ten objects standing. A gate that reports on a different board than the one on screen is not a
        // gate; the optimiser still runs inside composition, bounded to two passes, exactly as it runs live.
        const composition = composeScene(played, parsedActions, {
        subject: objective.subject,
        domain,
        ...(subdomain ? { subdomain } : {}),
        ...(step.teaching_intent ? { teachingIntent: step.teaching_intent } : {}),
        step: step.lesson_step,
        stage: Math.max(0, (progress.coveredStageIds?.length ?? 0) - 1),
        ...(step.representation === "3d" ? {} : { policy: compositionPolicy }),
      });
      compositionLog.push({ lessonStep: step.lesson_step, ...composition.diagnostics });
      known2dScene = composition.scene;
      // SCORE THE BOARD THE STUDENT WILL SEE. The pre-composition problems are reported for what they are —
      // a diagnostic of the input — and the issue below is raised from the composed scene instead. Measuring
      // overlaps on the scene that has already been laid out and repaired reported four overlapping pairs on a
      // board that had none by the time it rendered, which is the worst kind of finding: one that teaches the
      // reader that this gate cries wolf.
      const finalQuality = assessScene(composition.scene, {
        step: step.lesson_step,
        ...(step.teaching_intent ? { intent: step.teaching_intent } : {}),
        referenced: referencedIds(parsedActions),
      });
      visual = { score: composition.diagnostics.visualFocusScore, problems: finalQuality.problems, removed: optimised.quality.removed.length, merged: optimised.quality.merged.length, step: step.lesson_step };
      // AN EMPTY BOARD IS NOT A FAILURE. The brief is explicit that a board with nothing relevant on it
      // beats one with something unrelated, and a text-only step is a legitimate outcome. An empty board is
      // only a problem when the step TRIED to draw or promised a picture, which is what the two conditions
      // below test.
      const promisedVisual = parsedActions.length > 0 || VISUAL_INTENTS.has(step.teaching_intent ?? "");
      const onlyComplaintIsEmptiness = finalQuality.problems.length === 1 && finalQuality.problems[0] === "the board is empty";
      // "Nothing on the board belongs to this step" is not always a finding. The semantic gate judges by
      // LIFECYCLE, and the lifecycle demotes anything this step merely points at, so a step whose whole job was
      // to walk through the diagram already on screen was reported as owning none of it — on a board that
      // composition had already checked, budgeted and protected. When composition says this step owns nothing
      // BY DESIGN, that sentence is the lifecycle restating itself, not a student left hunting, and it is
      // dropped rather than shipped. Overlaps and emptiness stay: those are about the board, not about who
      // owns it.
      const problems = composition.diagnostics.focusedObjectCount === 0
        ? finalQuality.problems.filter((problem) => !problem.includes("belongs to this step"))
        : finalQuality.problems;
      if (problems.length > 0 && promisedVisual && !(problems.length === 1 && problems[0] === "the board is empty")) {
        issues.push({ kind: "unclear-visual-focus", lessonStep: step.lesson_step, detail: problems.join("; ") });
      }
      // A composition that could not get the board onto this step is reported rather than shipped: this is the
      // "the board is a history" failure, and the only way it becomes visible is by being counted.
      //
      // The floor here is HARD_CURRENT_SHARE, the same floor composition itself falls back to, and it is only
      // applied when this step contributed something current. Two earlier failures taught the difference. A
      // step that only speaks, only dims what is already there, or only moves a label the board already had
      // deliberately keeps the previous picture — that is the lifecycle rule, not a student left hunting — and
      // counting it produced "nothing on the board belongs to this step" on steps that were correct. A step
      // that DID draw and still left the board less than a fifth about itself is the real failure.
      const diagnostics = composition.diagnostics;
      const share = diagnostics.visibleObjectCount === 0 ? 0 : diagnostics.focusedObjectCount / diagnostics.visibleObjectCount;
      if (diagnostics.focusedObjectCount > 0 && share < HARD_CURRENT_SHARE) {
        issues.push({
          kind: "unclear-visual-focus",
          lessonStep: step.lesson_step,
          detail: `only ${Math.round(share * 100)}% of the board is what this step teaches`,
        });
      }
    }
    // `stagnantRun + 1` because this step IS the run: passing the value from before this step made the
    // first unchanged step of a pair invisible, and the failure it exists to catch is always a PAIR.
    issues.push(...stepIssues(alignedStep, report, objective, spokenSoFar, seenWords, stagnantRun + 1));
    spokenSoFar.push({ step: step.lesson_step, words: contentWords(step.speech) });
    for (const word of contentWords(step.speech)) seenWords.add(word);

    // A visual that does not change anything between one step and the next is an empty board with a
    // speech over it. Two in a row is a system failure, not a teaching decision.
    stagnantRun = report.visualChanged ? 0 : stagnantRun + 1;
    lastVisual = report.visualChanged;
    if (report.visualChanged) visualSteps += 1;
    totalWords += wordCount(step.speech);
    for (const assetId of report.entitiesNamed) if (!entityOrder.includes(assetId)) entityOrder.push(assetId);
    for (const assetId of report.entitiesShown) shown.add(assetId);
    aligned.push(alignedStep);
  }

  // A lesson that taught its stages and never said what the student should now know has not concluded.
  // The recap is located by STAGE, not by position: a provider may finish a batch with steps that come
  // after it, and the summary a student needs is in the recap step, not in the last line returned.
  if (objective.depth === "deep" && steps.length > 0) {
    const recap = objective.stages[objective.stages.length - 1];
    const recapStep = recap ? steps.find((step) => step.stage_id === recap.id) : undefined;
    if (recapStep) {
      const summary = /\b(?:so|to (?:sum|summar)|in summary|remember|recap|take away|key (?:points?|ideas?|takeaways?)|in short|you should now)\b/i;
      if (!summary.test(recapStep.speech)) {
        issues.push({ kind: "no-conclusion", lessonStep: recapStep.lesson_step, detail: "the recap stage produced no summary the student can write down" });
      }
    }
  }

  const severe = issues.filter((issue) => issue.kind !== "no-conclusion");

  // THE FIFTEEN CONCERNS, measured.
  //
  // "The answer is not the lesson" only becomes checkable when the lesson's declared teaching acts are
  // compared against the questions a lesson is supposed to answer. A lesson whose steps only ever declare
  // `introduce_concept` and `calculate` has answered two of them however many words it spoke, and this is
  // the number that says so.
  const concernsCovered = concernsAddressed(intentsDeclared as (TeachingIntent | null)[]);
  const concernsTarget = CONCERN_TARGET[objective.subject] ?? 6;
  if (concernsCovered.length < concernsTarget && steps.length >= 4) {
    issues.push({
      kind: "thin-concern-coverage",
      lessonStep: steps[steps.length - 1]!.lesson_step,
      detail: `the batch addressed ${concernsCovered.length} of the questions a lesson should answer (${concernsTarget} expected): ${concernsCovered.join(", ") || "none"}`,
    });
  }

  // A calculation that was never checked. Only enforced when the lesson actually calculated something,
  // because forcing a check where none is meaningful is the same padding this gate exists to catch.
  const calculated = aligned.some((step) => step.teaching_intent === "calculate" || step.teaching_intent === "substitute");
  if (calculated && !aligned.some((step) => step.teaching_intent === "verify" || hasVerificationCue(step.speech))) {
    issues.push({
      kind: "missing-verification",
      lessonStep: steps[steps.length - 1]!.lesson_step,
      detail: "the lesson reached a result and never checked it",
    });
  }

  return {
    steps: aligned,
    report: {
      topic: objective.topic,
      subject: objective.subject,
      representation,
      steps: steps.length,
      words: totalWords,
      visualSteps,
      entitiesNamed: entityOrder,
      entitiesShown: Array.from(shown),
      concernsCovered,
      concernsTarget,
      intentsDeclared,
      stepsWithIntent: intentsDeclared.filter(Boolean).length,
      modelledEntities: entityOrder.filter((assetId) => shown.has(assetId)),
      promotedPrimitives: perStep.reduce((total, entry) => total + entry.promoted.length, 0),
      labelsAdded: perStep.reduce((total, entry) => total + entry.labelsAdded, 0),
      substitutions: perStep.flatMap((entry) => entry.notes.filter((note) => note.pass === "representation").map((note) => note.detail)),
      droppedActions: perStep.reduce((total, entry) => total + entry.dropped.length, 0),
      decorativeDropped,
      visualScore: visual.score,
      visualProblems: visual.problems,
      visualRemoved: visual.removed,
      visualMerged: visual.merged,
      composition: compositionLog,
      issues,
      perStep,
      ok: severe.length === 0,
    },
  };
}

/** How many decorative elements the gate removed, read back off the notes it wrote. */
function perStepCount(perStep: StepAlignmentReport[], kind: "decorative"): number {
  return perStep.reduce(
    (total, entry) => total + entry.dropped.filter((drop) => drop.reason.includes("without a reason")).length,
    0,
  );
}

function stepIssues(
  step: TeachingResponse,
  report: StepAlignmentReport,
  objective: LessonObjective,
  spokenSoFar: Array<{ step: number; words: Set<string> }>,
  seenWords: Set<string>,
  stagnantRun: number,
): TeachingQualityIssue[] {
  const issues: TeachingQualityIssue[] = [];
  const stage = step.stage_id ? objective.stages.find((candidate) => candidate.id === step.stage_id) : undefined;

  for (const sentence of sentences(step.speech)) {
    if (META_NARRATION.some((pattern) => pattern.test(sentence))) {
      issues.push({ kind: "meta-narration", lessonStep: step.lesson_step, detail: `"${sentence.slice(0, 90)}"` });
      break;
    }
  }

  const words = contentWords(step.speech);
  const against = seenWords.size > 0 ? words : new Set<string>();
  if (against.size >= 8 && overlapRatio(against, seenWords) > 0.82) {
    issues.push({ kind: "repetition", lessonStep: step.lesson_step, detail: "this step restates earlier speech almost word for word" });
  } else {
    for (const previous of spokenSoFar.slice(-3)) {
      if (previous.words.size >= 8 && overlapRatio(words, previous.words) > 0.85) {
        issues.push({ kind: "repetition", lessonStep: step.lesson_step, detail: `almost identical to step ${previous.step}` });
        break;
      }
    }
  }

  if (objective.depth === "deep") {
    const minimum = Math.round((stage?.minWords ?? 30) * 0.6);
    if (wordCount(step.speech) < minimum) {
      issues.push({ kind: "thin-step", lessonStep: step.lesson_step, detail: `${wordCount(step.speech)} words for a stage that needs ${stage?.minWords ?? 30}` });
    }
  }

  if (VISUAL_CLAIM.test(step.speech) && !report.visualChanged) {
    issues.push({ kind: "unbacked-visual", lessonStep: step.lesson_step, detail: "the speech promises something on the board and no action produced one" });
  }
  if (report.unbackedSpeech) {
    issues.push({
      kind: "unbacked-visual",
      lessonStep: step.lesson_step,
      detail: `the speech names ${report.entitiesNamed.join(", ")} but none of them is on the board`,
    });
  } else if (report.entitiesNamed.length > 1 && report.entitiesShown.length * 2 < report.entitiesNamed.length) {
    // Naming two real things and showing neither is the same failure as naming one and showing none, so
    // it is measured the same way: the board has to demonstrate most of what the teacher says.
    issues.push({
      kind: "unbacked-visual",
      lessonStep: step.lesson_step,
      detail: `the speech names ${report.entitiesNamed.join(", ")} but the board only shows ${report.entitiesShown.join(", ") || "none of them"}`,
    });
  }
  // A run of two unchanged boards in a row is a failure, not a teaching decision. `stagnantRun` counts
  // THIS step too, so the first unchanged step of a pair reads 1 and is not yet a pair.
  if (stagnantRun >= 2 && !report.visualChanged) {
    issues.push({ kind: "visual-stagnation", lessonStep: step.lesson_step, detail: "two consecutive steps left the board unchanged" });
  }

  // ---- The pedagogical layer's own checks -----------------------------------------------------------
  const intent = step.teaching_intent ?? null;

  // THE ANSWER BEFORE THE METHOD. A step that is introducing, defining or explaining and already says
  // "the answer is" has given away the thing the rest of the lesson teaches. Detected from the declared
  // intent when there is one, and from the stage when there is not.
  const stageIntentValue = stage ? stageIntent(stage) : null;
  const teachingAct = intent ?? stageIntentValue;
  // Acts whose purpose IS to name a result, and which are therefore not giving it away.
  //
  // `derive` arrives at the formula by arriving at it — that is what a derivation is. `common_mistake`
  // quotes the wrong answer precisely in order to correct it. Both were reported as premature answers in
  // the first calculus lesson the gate saw, which is the failure mode of a rule with no exceptions: the
  // teacher stops trusting it.
  const stillTeaching = !teachingAct || ![
    "calculate", "substitute", "interpret", "verify", "worked_example", "recap", "check_understanding",
    "derive", "common_mistake",
  ].includes(teachingAct);
  if (stillTeaching && hasResultCue(step.speech)) {
    issues.push({
      kind: "premature-answer",
      lessonStep: step.lesson_step,
      detail: `this step is ${teachingAct ?? "teaching"} and already states the result; the reasoning has to come first`,
    });
  }

  // A formula the step declared and never explained. Symbols are extracted from the formula itself, so
  // this catches "F = ma" written three times with nothing said about F, m or a.
  const formula = step.pedagogy?.formula;
  if (formula) {
    const unexplained = unexplainedSymbols(formula, step.speech);
    if (unexplained.length > 0) {
      issues.push({
        kind: "unexplained-formula",
        lessonStep: step.lesson_step,
        detail: `${formula.formula} was introduced but nothing explains ${unexplained.join(", ")}`,
      });
    }
    // And it should be ON the board, not only said. The gate draws it, so this can only fire if the
    // drawing was itself rejected — which is worth knowing.
    const drawn = (step.visual_actions ?? []).some((action) =>
      action.action === "create_equation_block" && action.formula.replace(/\s+/g, "") === formula.formula.replace(/\s+/g, ""));
    if (!drawn) {
      issues.push({ kind: "formula-not-shown", lessonStep: step.lesson_step, detail: `${formula.formula} was taught but never drawn` });
    }
  }

  // The step declared an act, and the stage it was teaching asked for a different one. This is the
  // planner, the prompt and the verdict finally agreeing on what the step was for.
  if (intent && stageIntentValue && intent !== stageIntentValue && !INTENT_NEIGHBOURS.has(`${stageIntentValue}:${intent}`)) {
    issues.push({
      kind: "intent-mismatch",
      lessonStep: step.lesson_step,
      detail: `the stage asks for ${stageIntentValue} but the step declared ${intent}`,
    });
  }

  return issues;
}

/**
 * Intents that legitimately appear in a stage other than the one its own name suggests.
 *
 * `example` and `advanced` are both worked examples; `identify` stages routinely end by calculating;
 * `notation` stages are largely about explaining variables. Without this, the mismatch check would fire
 * on correct teaching, which is how a gate stops being read.
 */
const INTENT_NEIGHBOURS = new Set([
  "example:worked_example", "example:calculate", "example:substitute", "example:demonstrate",
  "advanced:worked_example", "advanced:calculate", "advanced:derive",
  "identify:calculate", "identify:substitute", "identify:identify_unknown",
  "notation:explain_variable", "notation:explain_units", "notation:explain_formula",
  "terminology:define", "terminology:explain_variable",
  "mechanics:demonstrate", "mechanics:calculate", "mechanics:explain_why",
  "code:demonstrate", "walkthrough:demonstrate", "execution:demonstrate",
  "apply:calculate", "apply:substitute", "apply:interpret",
  "why:choose_method", "why:derive",
  "concept:intuition", "concept:define",
  "visual:intuition", "visual:demonstrate",
  "application:interpret", "application:compare",
  "mistakes:check_understanding", "mistakes:common_mistake",
]);

/** One-line, credential-free summary for the server log. */
export function summariseQuality(report: LessonQualityReport): string {
  const issues = report.issues.length === 0 ? "none" : Array.from(new Set(report.issues.map((issue) => issue.kind))).join(",");
  return `topic="${report.topic}" subject=${report.subject} steps=${report.steps} words=${report.words} visualSteps=${report.visualSteps} named=[${report.entitiesNamed.join(",")}] shown=[${report.entitiesShown.join(",")}] promoted=${report.promotedPrimitives} labels=${report.labelsAdded} dropped=${report.droppedActions} ok=${report.ok} issues=${issues}`;
}