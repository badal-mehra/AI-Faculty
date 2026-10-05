// Teaching router: Gemini model pool, then Groq, then Mistral — with a request budget and bounded latency.
//
// Order of operations for one request:
//   1. plan it at the most detailed context level that fits the token budget (never oversize),
//   2. ask the API which Gemini models this key can actually call, and skip the rest,
//   3. try those models with a per-attempt timeout, classifying 404 / 429 / 5xx correctly,
//   4. fall back to Groq; if Groq rejects the request for size, COMPACT it and retry once per level,
//   5. fall back to Mistral last, reusing the plan Groq already settled on,
//   6. otherwise fail fast with a clear error.
//
// No step is ever repeated unchanged, and no model that already failed is retried in the same call.
import { TeachingLessonResponse, LessonQualitySummary, TeachingRequest, TeachingResponse } from "../types";
import { ProviderError, TeachingProviderName, asProviderError, statusOf } from "./error";
import {
  GEMINI_TEACHING_MODELS,
  availableGeminiTeachingModels,
  generateTeachingLessonWithGemini,
  generateTeachingStepWithGemini,
  geminiTeachingSchemaFor,
  geminiTeachingLessonSchemaFor,
} from "./gemini";
import { GROQ_TEACHING_MODEL_NAME, generateTeachingLessonWithGroq, generateTeachingStepWithGroq } from "./groq";
import { MISTRAL_TEACHING_MODEL_NAME, generateTeachingLessonWithMistral, generateTeachingStepWithMistral } from "./mistral";
import { TeachingSimulation, simulateGemini, simulateGroq, simulateMistral } from "./devSimulation";
import { getPreferredGeminiModel, isGeminiModelAvailable, markGeminiModelUnavailable, recordGeminiFailure, recordGeminiSuccess } from "./health";
import { ContextLevel } from "../context";
import { RequestPlan, planRequest, replan } from "../requestPlan";
import type { VisualFamilies } from "../prompt";
import { applyStepsToProgress, buildLessonObjective, currentStage, lessonProgressView } from "../objective";
import { alignAndJudge, LessonQualityReport, summariseQuality } from "../quality";
import { compositionLogLine } from "../../visual/composition";
import { logProviderOutcome, logProviderRequest } from "../diagnostics";

export type TeachingStepResult = {
  response: TeachingResponse;
  provider: TeachingProviderName;
  geminiAttempts: number;
  fallback: boolean;
  latencyMs: number;
  level: ContextLevel;
  estimatedTokens: number;
};

const GEMINI_RETRY_DELAY_MS = 250;
/** Once Gemini has consumed this much wall clock, skip straight to Groq instead of burning more. */
const GEMINI_TIME_BUDGET_MS = Number(process.env.GEMINI_TOTAL_BUDGET_MS ?? 45_000);

/**
 * The whole ladder (Gemini models, then Groq, then Mistral) is capped by one deadline.
 *
 * Each provider is individually bounded, but a ladder of bounded attempts is still unbounded in
 * total, and the classroom shows one spinner for the entire request. Giving up is the only way a
 * student is not left waiting, and the batch is simply requested again.
 */
const REQUEST_DEADLINE_MS = Number(process.env.TEACHING_REQUEST_DEADLINE_MS ?? 150_000);
const outOfTime = (startedAt: number): boolean => Date.now() - startedAt > REQUEST_DEADLINE_MS;

const wait = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * The wire schema for a request, built from the families the plan resolved.
 *
 * Keyed on the families rather than fixed, because declaring all three renderers on every request cost
 * roughly a thousand tokens a batch for actions the prompt had deliberately withheld documentation of —
 * and an action the model can see in the schema but was never told about is one it will guess at.
 */
function schemaFor(path: "lesson" | "step", families: VisualFamilies): string {
  return JSON.stringify(path === "lesson"
    ? geminiTeachingLessonSchemaFor(families)
    : geminiTeachingSchemaFor(families));
}

/** 413/400 "request too large" — never retried unchanged; the caller compacts and retries. */
export function isOversizedStatus(status: number | undefined): boolean {
  if (status === 413) return true;
  if (status === 400 && false) return false;
  return false;
}

/**
 * Runs the Gemini pool for one request. Returns null when no model could serve it, so the caller can
 * fall back to Groq without re-planning the request.
 */
async function tryGemini(
  lesson: TeachingRequest,
  plan: RequestPlan,
  path: "lesson" | "step",
  simulation: TeachingSimulation,
  startedAt: number,
): Promise<{ response: TeachingResponse | TeachingLessonResponse; model: string; attempts: number } | null> {
const discovered = await availableGeminiTeachingModels();
  // The model that answered last is tried first, so a working id is not buried under probes.
  const preferred = getPreferredGeminiModel();
  const models = preferred && discovered.includes(preferred) ? [preferred, ...discovered.filter((model) => model !== preferred)] : discovered;
  let attempts = 0;

  for (const model of models) {
    if (!isGeminiModelAvailable(model)) continue;
    if (Date.now() - startedAt > GEMINI_TIME_BUDGET_MS) {
      console.warn("[Teaching Router] Gemini time budget reached; moving to the next provider");
      break;
    }

    for (let modelAttempt = 1; modelAttempt <= 2; modelAttempt += 1) {
      attempts += 1;
      const attemptStartedAt = Date.now();
      try {
        // The dev-simulation helper is typed for single steps; the lesson payload flows through the
        // same path and is validated identically.
        const call = async () => (path === "lesson"
          ? (await generateTeachingLessonWithGemini(lesson, model, plan)) as unknown as TeachingResponse
          : await generateTeachingStepWithGemini(lesson, model, plan));
        const response = await simulateGemini(simulation, lesson, attempts, call);
        recordGeminiSuccess(model);
        logProviderOutcome({ provider: "gemini", model, lessonStep: lesson.lessonStep, outcome: "success", latencyMs: Date.now() - attemptStartedAt });
        return { response, model, attempts };
      } catch (error) {
        const providerError = asProviderError(error, "gemini");
        const status = providerError.status ?? statusOf(error);
        if (status === 404) {
          // The model does not exist for this key: never call it again.
          markGeminiModelUnavailable(model, "404 model not found");
          logProviderOutcome({ provider: "gemini", model, lessonStep: lesson.lessonStep, status: 404, outcome: "not-found", latencyMs: Date.now() - attemptStartedAt });
          break;
        }
        if (providerError.configuration) throw providerError;
        recordGeminiFailure(model, status);
        logProviderOutcome({
          provider: "gemini",
          model,
          lessonStep: lesson.lessonStep,
          status,
          outcome: status === 429 ? "rate-limited" : "transient",
          latencyMs: Date.now() - attemptStartedAt,
        });
        if (status !== 503 || modelAttempt === 2) break;
        await wait(GEMINI_RETRY_DELAY_MS);
      }
    }
  }
  return null;
}

/** Groq, with compaction on a size rejection: oversized -> more compact -> one retry per level. */
async function tryGroq(
  lesson: TeachingRequest,
  initialPlan: RequestPlan,
  path: "lesson" | "step",
  simulation: TeachingSimulation,
): Promise<{ response: TeachingResponse | TeachingLessonResponse; plan: RequestPlan; compacted: boolean } | null> {
  // A simulated provider run (development fault injection) needs no real credentials.
  if (!process.env.GROQ_API_KEY && !simulation.groq) return null;
  let plan = initialPlan;
  const schemaJson = schemaFor(path, plan.families);

  for (let level = 0; level <= 2; level += 1) {
    logProviderRequest({
      provider: "groq",
      model: GROQ_TEACHING_MODEL_NAME,
      path,
      lessonStep: lesson.lessonStep,
      level: plan.level,
      size: plan.size,
      assetCount: plan.assetCount,
      stateChars: plan.stateChars,
      speechChars: plan.speechChars,
      ...(level > 0 ? { note: "retried with a more compact request after a size rejection" } : {}),
    });
    const startedAt = Date.now();
    try {
      const call = async () => (path === "lesson"
        ? (await generateTeachingLessonWithGroq(lesson, plan)) as unknown as TeachingResponse
        : await generateTeachingStepWithGroq(lesson, plan));
      const response = await simulateGroq(simulation, lesson, call);
      logProviderOutcome({ provider: "groq", model: GROQ_TEACHING_MODEL_NAME, lessonStep: lesson.lessonStep, outcome: "success", latencyMs: Date.now() - startedAt });
      return { response, plan, compacted: level > 0 };
    } catch (error) {
      const providerError = asProviderError(error, "groq");
      const status = providerError.status ?? statusOf(error);
      const oversized = status === 413 || (status === 400 && /too large|tokens per minute|maximum context|request size/i.test(providerError.message));
      logProviderOutcome({
        provider: "groq",
        model: GROQ_TEACHING_MODEL_NAME,
        lessonStep: lesson.lessonStep,
        status,
        outcome: oversized ? "oversized" : "transient",
        latencyMs: Date.now() - startedAt,
        ...(oversized ? { note: "compacting the request instead of retrying it unchanged" } : {}),
      });
      if (!oversized) return null;
const next = replan(lesson, (families) => schemaFor(path, families), plan.level, plan);
      if (!next) return null;
      plan = next;
    }
  }
  return null;
}

/**
 * Mistral, the THIRD and FINAL provider. Same contract as Groq: a size rejection is compacted and
 * retried once per level rather than surfaced, and every other failure returns null so the caller can
 * fail fast with one clear error. It never re-plans from scratch — it inherits the plan Groq already
 * settled on, so a compacted request stays compacted.
 */
async function tryMistral(
  lesson: TeachingRequest,
  initialPlan: RequestPlan,
  path: "lesson" | "step",
  simulation: TeachingSimulation,
): Promise<{ response: TeachingResponse | TeachingLessonResponse; plan: RequestPlan; compacted: boolean } | null> {
  // A simulated provider run (development fault injection) needs no real credentials.
  if (!process.env.MISTRAL_API_KEY && !simulation.mistral) return null;
  let plan = initialPlan;
  const schemaJson = schemaFor(path, plan.families);

  for (let level = 0; level <= 2; level += 1) {
    logProviderRequest({
      provider: "mistral",
      model: MISTRAL_TEACHING_MODEL_NAME,
      path,
      lessonStep: lesson.lessonStep,
      level: plan.level,
      size: plan.size,
      assetCount: plan.assetCount,
      stateChars: plan.stateChars,
      speechChars: plan.speechChars,
      ...(level > 0 ? { note: "retried with a more compact request after a size rejection" } : {}),
    });
    const startedAt = Date.now();
    try {
      const call = async () => (path === "lesson"
        ? (await generateTeachingLessonWithMistral(lesson, plan)) as unknown as TeachingResponse
        : await generateTeachingStepWithMistral(lesson, plan));
      const response = await simulateMistral(simulation, lesson, call);
      logProviderOutcome({ provider: "mistral", model: MISTRAL_TEACHING_MODEL_NAME, lessonStep: lesson.lessonStep, outcome: "success", latencyMs: Date.now() - startedAt });
      return { response, plan, compacted: level > 0 };
    } catch (error) {
      const providerError = asProviderError(error, "mistral");
      const status = providerError.status ?? statusOf(error);
      const oversized = status === 413 || (status === 400 && /too large|maximum context|request size|reduce the length/i.test(providerError.message));
      logProviderOutcome({
        provider: "mistral",
        model: MISTRAL_TEACHING_MODEL_NAME,
        lessonStep: lesson.lessonStep,
        status,
        outcome: oversized ? "oversized" : status === 429 ? "rate-limited" : "transient",
        latencyMs: Date.now() - startedAt,
        ...(oversized ? { note: "compacting the request instead of retrying it unchanged" } : {}),
      });
      if (!oversized) return null;
      const next = replan(lesson, (families) => schemaFor(path, families), plan.level, plan);
      if (!next) return null;
      plan = next;
    }
  }
  return null;
}

async function run<T extends TeachingResponse | TeachingLessonResponse>(
  lesson: TeachingRequest,
  path: "lesson" | "step",
  simulation: TeachingSimulation,
): Promise<{ response: T; provider: TeachingProviderName; geminiAttempts: number; latencyMs: number; plan: RequestPlan }> {
  const startedAt = Date.now();
  const plan = planRequest(lesson, path, (families) => schemaFor(path, families));
  const schemaJson = schemaFor(path, plan.families);

logProviderRequest({
    provider: "gemini",
    model: GEMINI_TEACHING_MODELS[0],
    path,
    lessonStep: lesson.lessonStep,
    level: plan.level,
    size: plan.size,
    assetCount: plan.assetCount,
    stateChars: plan.stateChars,
    speechChars: plan.speechChars,
    lesson: {
      topic: plan.objective.topic,
      depth: plan.objective.depth,
      stages: plan.objective.stages.length,
      covered: plan.progress.coveredStageIds.length,
      stepsDelivered: plan.progress.stepsDelivered,
      currentStage: currentStage(plan.progress)?.id ?? null,
    },
  });

const geminiConfigured = Boolean(process.env.GEMINI_API_KEY) || Boolean(simulation.gemini);
  const gemini = geminiConfigured ? await tryGemini(lesson, plan, path, simulation, startedAt) : null;
  if (gemini) {
    const response = (path === "lesson" ? (gemini.response as TeachingLessonResponse) : (gemini.response as TeachingResponse));
    return { response: response as T, provider: "gemini", geminiAttempts: gemini.attempts, latencyMs: Date.now() - startedAt, plan };
  }

  // A lesson is made of many batches, so a student waiting several minutes for ONE of them is worse
  // than a clear failure the classroom retries. Past the deadline the remaining providers are skipped.
  if (outOfTime(startedAt)) {
    throw new ProviderError("gemini", "No teaching provider answered within the time budget for this batch.", { status: 504, transient: true });
  }

  const groq = await tryGroq(lesson, plan, path, simulation);
  if (groq) {
    const response = (path === "lesson" ? (groq.response as TeachingLessonResponse) : (groq.response as TeachingResponse));
    return { response: response as T, provider: "groq", geminiAttempts: 0, latencyMs: Date.now() - startedAt, plan: groq.plan };
  }

  if (outOfTime(startedAt)) {
    throw new ProviderError("groq", "No teaching provider answered within the time budget for this batch.", { status: 504, transient: true });
  }

  // Last resort: Mistral, only when both Gemini and Groq could not answer.
  const mistral = await tryMistral(lesson, plan, path, simulation);
  if (mistral) {
    const response = (path === "lesson" ? (mistral.response as TeachingLessonResponse) : (mistral.response as TeachingResponse));
    return { response: response as T, provider: "mistral", geminiAttempts: 0, latencyMs: Date.now() - startedAt, plan: mistral.plan };
  }

  if (!geminiConfigured && !process.env.GROQ_API_KEY && !process.env.MISTRAL_API_KEY) {
    throw new ProviderError("groq", "No teaching provider is configured on this server.", { status: 503, transient: false, configuration: true });
  }
  throw new ProviderError("groq", "No teaching provider could complete this request.", {
    status: 502,
    transient: true,
  });
}

export async function generateTeachingStep(lesson: TeachingRequest, simulation: TeachingSimulation = {}): Promise<TeachingStepResult> {
  const result = await run<TeachingResponse>(lesson, "step", simulation);
  // The same educational gate a lesson batch goes through. A follow-up answer is a teaching act and
  // gets the same treatment, so "the teacher is drawing a cube for the heart" cannot reappear through
  // the interruption path.
  const judged = alignAndJudge(lesson, [result.response], result.plan.objective, result.plan.progress, result.plan.representation);
  logQuality(judged.report, lesson);
  logComposition(judged.report, lesson);
  return {
    response: { ...(judged.steps[0] ?? result.response), representation: result.plan.representation },
    provider: result.provider,
    geminiAttempts: result.geminiAttempts,
    fallback: result.provider !== "gemini",
    latencyMs: result.latencyMs,
    level: result.plan.level,
    estimatedTokens: result.plan.size.totalTokens,
  };
}

/**
 * Logs the composition verdict: what each step's board actually showed.
 *
 * This is deliberately a separate line from `[teaching:quality]`. The quality verdict answers "did this
 * batch teach", and the composition verdict answers "did the board show the step being taught" — the second
 * question is the one every earlier gate answered "yes" to on a board with 57 stale objects on it, so it has
 * to be readable on its own in a log, per step, with its numbers.
 */
function logComposition(report: LessonQualityReport, lesson: TeachingRequest): void {
  for (const entry of report.composition) {
    console.info(`${compositionLogLine(entry)} lessonStep=${entry.lessonStep}`);
  }
  void lesson;
}

/**
 * Logs the teaching verdict next to the transport verdict.
 *
 * A request can be perfectly healthy at the transport level and still teach nothing — that is the
 * failure this whole gate exists for, so it has to be as visible in the log as a provider error.
 */
function logQuality(report: LessonQualityReport, lesson: TeachingRequest): void {
  if (report.ok && report.promotedPrimitives === 0 && report.labelsAdded === 0 && report.droppedActions === 0) return;
  const line = `[teaching:quality] step=${lesson.lessonStep} ${summariseQuality(report)}`;
  if (report.ok) console.info(line);
  else console.warn(line);
}

/**
 * A provider numbers its own steps, and it does not always number them consecutively: it can skip the
 * starting step, repeat a number, or hand back a step that points backwards. The classroom advances on
 * `next_step`, so a gap would stall a deep lesson and a backwards pointer would restart it. The numbers
 * are ours to decide, not the model's, so they are rewritten here before the classroom ever sees them.
 */
export function renumberLessonSteps(steps: TeachingResponse[], startingAt: number): TeachingResponse[] {
  return steps.map((step, index) => {
    const lessonStep = startingAt + index;
    return step.lesson_step === lessonStep && step.next_step === lessonStep + 1 ? step : { ...step, lesson_step: lessonStep, next_step: lessonStep + 1 };
  });
}

export async function generateTeachingLesson(lesson: TeachingRequest, options: { diagnostics?: boolean } = {}): Promise<TeachingLessonResponse> {
  const result = await run<TeachingLessonResponse>(lesson, "lesson", {});
  // COMPLETION IS OBJECTIVE-BASED. The provider's steps are recorded as teaching content, and the
  // lesson is only complete when every planned stage has actually been taught. A provider that
  // answers once, or repeats its own step number, therefore cannot end the lesson.
  const numbered = renumberLessonSteps(result.response.steps ?? [], lesson.lessonStep);
  // EDUCATIONAL ALIGNMENT + QUALITY, before the classroom can see anything. A step that draws a
  // generic primitive for something the library can model, labels a part the model does not have, or
  // points at an object that does not exist, is corrected or dropped here — and counted, because a
  // silently discarded action is how a lesson "drew 14 things and used 0" passed as a success.
  const judged = alignAndJudge(lesson, numbered, result.plan.objective, result.plan.progress, result.plan.representation);
  logQuality(judged.report, lesson);
  logComposition(judged.report, lesson);
  const progress = applyStepsToProgress(result.plan.progress, judged.steps);
  return {
    // The stage travels with every step, so the classroom cannot flip mid-lesson when a later batch
    // happens to draw in the other family.
    steps: judged.steps.map((step) => ({ ...step, representation: result.plan.representation })),
    progress: lessonProgressView(progress, result.plan.objective),
    ...(options.diagnostics ? { quality: summariseLessonQuality(judged.report) } : {}),
  };
}

/** The compact verdict an acceptance run asserts on. */
function summariseLessonQuality(report: LessonQualityReport): LessonQualitySummary {
  return {
    ok: report.ok,
    topic: report.topic,
    subject: report.subject,
    representation: report.representation,
    steps: report.steps,
    words: report.words,
    visualSteps: report.visualSteps,
    entitiesNamed: report.entitiesNamed,
    entitiesShown: report.entitiesShown,
    concernsCovered: report.concernsCovered,
    concernsTarget: report.concernsTarget,
    intentsDeclared: report.intentsDeclared,
    stepsWithIntent: report.stepsWithIntent,
    promotedPrimitives: report.promotedPrimitives,
    labelsAdded: report.labelsAdded,
    droppedActions: report.droppedActions,
    decorativeDropped: report.decorativeDropped,
    visualScore: report.visualScore,
    visualProblems: report.visualProblems,
    visualRemoved: report.visualRemoved,
    visualMerged: report.visualMerged,
    composition: report.composition.map((entry) => ({
      lessonStep: entry.lessonStep,
      subject: entry.subject,
      subdomain: entry.subdomain,
      teachingIntent: entry.teachingIntent,
      visibleObjectCount: entry.visibleObjectCount,
      retiredObjectCount: entry.retiredObjectCount,
      supportingObjectCount: entry.supportingObjectCount,
      contextObjectCount: entry.contextObjectCount,
      focusedObjectCount: entry.focusedObjectCount,
      visualFocusScore: entry.visualFocusScore,
      densityScore: entry.densityScore,
      overlapCount: entry.overlapCount,
      foreignRepresentationCount: entry.foreignRepresentationCount,
    })),
    notes: report.perStep.flatMap((entry) => entry.notes.map((note) => `${note.pass}: ${note.detail}`)),
    issues: report.issues.map((issue) => ({ kind: issue.kind, lessonStep: issue.lessonStep, detail: issue.detail })),
  };
}