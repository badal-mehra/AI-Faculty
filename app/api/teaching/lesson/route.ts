import { NextResponse } from "next/server";
import { describeTeachingRequestError, parseTeachingRequest, parseTeachingResponse } from "@/lib/teaching/validation";
import { matchScenario, findScenario } from "@/lib/teaching/scenarios";
import { generateTeachingLesson } from "@/lib/teaching/providers/router";
import { ProviderError } from "@/lib/teaching/providers/error";
import { applyStepsToProgress, buildLessonObjective, lessonProgressView, resumeLessonProgress } from "@/lib/teaching/objective";
import { alignAndJudge, summariseQuality } from "@/lib/teaching/quality";
import { representationForRequest } from "@/lib/teaching/prompt";
import type { LessonQualitySummary, TeachingRequest } from "@/lib/teaching/types";

export const runtime = "nodejs";

const isDevelopment = process.env.NODE_ENV !== "production";

/** The compact teaching verdict, returned only when the caller explicitly asks for diagnostics. */
function qualitySummary(report: ReturnType<typeof alignAndJudge>["report"]): LessonQualitySummary {
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
      visualFocusScore: entry.visualFocusScore,
      densityScore: entry.densityScore,
      overlapCount: entry.overlapCount,
      foreignRepresentationCount: entry.foreignRepresentationCount,
    })),
    notes: report.perStep.flatMap((entry) => entry.notes.map((note) => `${note.pass}: ${note.detail}`)),
    issues: report.issues.map((issue) => ({ kind: issue.kind, lessonStep: issue.lessonStep, detail: issue.detail })),
  };
}

// DEVELOPMENT + ACCEPTANCE ONLY: a deterministic scenario is served ONLY when it is explicitly
// requested (`?scenario=heart` or the x-teaching-scenario header), so a real lesson always reaches
// the real providers. Production never reaches this branch, and nothing here runs by accident.
//
// The scenario's own steps are still measured against the real lesson objective and still go through
// the real educational gate, so a deterministic scenario can never report something the pipeline would
// not allow for a generated lesson.
function scenarioResponse(request: Request, lesson: TeachingRequest, lessonStep: number, question: string, previousProgress: Parameters<typeof resumeLessonProgress>[1], diagnostics: boolean) {
  const requested = new URL(request.url).searchParams.get("scenario") ?? request.headers.get("x-teaching-scenario") ?? "";
  if (!requested) return null;
  const scenario = findScenario(requested) ?? matchScenario(question);
  if (!scenario) return null;
  const steps = scenario.steps
    .filter((step) => step.lesson_step >= lessonStep)
    .slice(0, 8)
    .map((step) => parseTeachingResponse(step))
    .filter((step): step is NonNullable<typeof step> => step !== null);
  if (steps.length === 0) return null;
  const objective = buildLessonObjective({ question });
  // The SAME function the live pipeline uses, so a deterministic scenario can never report a different
  // representation from the one a student would actually see.
  const representation = representationForRequest(lesson, objective.subject, objective.codeRelevant);
  const judged = alignAndJudge(
    {
      question,
      language: "English",
      lessonStep,
      boardState: { nodes: [], edges: [], texts: [], highlights: [] },
      visualState: { objects: [], tick: 0 },
      visualState3d: undefined,
    },
    steps,
    objective,
    resumeLessonProgress(objective, previousProgress),
    representation,
  );
  const progress = applyStepsToProgress(resumeLessonProgress(objective, previousProgress), judged.steps);
  // A deterministic scenario is still measured, so it cannot quietly drift from what the pipeline allows.
  if (!judged.report.ok || judged.report.promotedPrimitives > 0 || judged.report.droppedActions > 0) {
    console.warn(`[teaching:quality] scenario=${scenario.id} ${summariseQuality(judged.report)}`);
  }
  return NextResponse.json({
    steps: judged.steps.map((step) => ({ ...step, representation })),
    progress: lessonProgressView(progress, objective),
    scenario: { id: scenario.id, title: scenario.title, domain: scenario.domain },
    ...(diagnostics ? { quality: qualitySummary(judged.report) } : {}),
  });
}

export async function POST(request: Request) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is not valid JSON." }, { status: 400 }); }
  const lesson = parseTeachingRequest(body);
  if (!lesson) {
    // Diagnose the exact contract mismatch server-side during development; never log the whole body.
    if (isDevelopment) console.warn("[Teaching Lesson API] rejected request:", describeTeachingRequestError(body));
    return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is missing required information." }, { status: 400 });
  }

  const diagnostics = new URL(request.url).searchParams.get("diagnostics") === "1";

  if (isDevelopment) {
    const scenario = scenarioResponse(request, lesson, lesson.lessonStep, lesson.question, lesson.lessonProgress, diagnostics);
    if (scenario) return scenario;
  }

  try {
    return NextResponse.json(await generateTeachingLesson(lesson, { diagnostics }));
  } catch (error) {
    if (error instanceof ProviderError && error.configuration) return NextResponse.json({ error: "TEACHING_SERVICE_UNAVAILABLE", message: "The teaching service has not been configured on this server." }, { status: 503 });
    if (isDevelopment && error instanceof Error) console.error("[Teaching Lesson API] lesson generation failed:", error.message);
    return NextResponse.json({ error: "TEACHING_SERVICE_ERROR", message: "The teaching service could not complete this lesson. Please try again." }, { status: 502 });
  }
}