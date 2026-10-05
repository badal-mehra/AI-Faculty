// REQUEST PLANNING.
//
// One place that decides how detailed a teaching request may be. The router plans at the most
// detailed level that fits the budget, sends that, and can rebuild the SAME request more compactly
// (once) if the provider still rejects it for size. Nothing is ever sent twice unchanged.
//
// The plan also carries the lesson objective and its progress, so the router measures coverage and
// decides completion from the very same objects the prompt was built from.
import { ContextLevel } from "./context";
import { ContextLevel as Level } from "./context";
import { RequestSize, chooseLevel, measureRequest } from "./budget";
import { VisualFamilies, buildPrompt } from "./prompt";
import { TeachingRequest } from "./types";
import { LessonObjective, LessonProgress, buildLessonObjective, createLessonProgress, resumeLessonProgress } from "./objective";

export type RequestPlan = {
  system: string;
  user: string;
  level: Level;
  size: RequestSize;
  assetCount: number;
  /** Which stage this lesson shows, taken from the very prompt that is about to be sent. */
  representation: "2d" | "3d";
  /**
   * Which renderers this lesson may draw into, taken from the same prompt.
   *
   * The wire schema is built from this, so a lesson taught on the 2D board is not billed for the 3D
   * action vocabulary on every batch — and, more importantly, is never shown an action whose
   * documentation the prompt deliberately withheld.
   */
  families: VisualFamilies;
  stateChars: number;
  speechChars: number;
  objective: LessonObjective;
  progress: LessonProgress;
};

export type RequestPath = "lesson" | "step";

/**
 * How a caller supplies the wire schema.
 *
 * A FUNCTION of the families is what the router uses: the schema then carries only the action arrays the
 * prompt documented, which is both smaller and less confusing for the model. A plain STRING is still
 * accepted, for a caller that owns its schema outright (and for tests that measure a fixed shape).
 */
export type SchemaSource = string | ((families: VisualFamilies) => string);

const schemaFrom = (source: SchemaSource, families: VisualFamilies): string =>
  typeof source === "string" ? source : source(families);

/** Builds the most detailed plan that fits the budget, falling back through compact -> minimal. */
export function planRequest(request: TeachingRequest, path: RequestPath, schemaSource: SchemaSource): RequestPlan {
  const objective = buildLessonObjective(request);
  const progress = resumeLessonProgress(objective, request.lessonProgress);
  const sizes = {} as Record<Level, RequestSize>;
  const built = {} as Record<Level, ReturnType<typeof buildPrompt>>;
  const families = {} as Record<Level, VisualFamilies>;
  for (const level of ["full", "compact", "minimal"] as Level[]) {
    const prompt = buildPrompt(request, { level, objective, progress });
    built[level] = prompt;
    families[level] = familiesFor(prompt);
    // Each level is measured against the schema its own prompt implies, because the schema is derived
    // from the families and the families are the same at every level for a given request.
    sizes[level] = measureRequest(prompt.system, prompt.user, schemaFrom(schemaSource, families[level]));
  }
  const decision = chooseLevel(sizes);
  const level = decision.level;
  return {
    system: built[level].system,
    user: built[level].user,
    level,
    size: sizes[level],
    assetCount: built[level].assets.relevant.length,
    representation: built[level].representation,
    families: families[level],
    stateChars: built[level].stateChars,
    speechChars: built[level].speechChars,
    objective,
    progress,
  };
}

/** Which families a built prompt is documenting, read back off its own vocabulary decisions. */
function familiesFor(prompt: ReturnType<typeof buildPrompt>): VisualFamilies {
  return {
    graph: prompt.system.includes("1) GRAPH"),
    diagram: prompt.system.includes("2) DIAGRAM"),
    scene3d: prompt.system.includes("3) 3D"),
  };
}

/**
 * Rebuilds an existing plan at a more compact level (used after an oversized-request rejection).
 * The objective and its progress are preserved: compacting the request must never reset the lesson.
 */
export function replan(lesson: TeachingRequest, schemaSource: SchemaSource, current: Level, previous?: RequestPlan): RequestPlan | null {
  const order: Level[] = ["full", "compact", "minimal"];
  const next = order[order.indexOf(current) + 1];
  if (!next) return null;
  const objective = previous?.objective ?? buildLessonObjective(lesson);
  const progress = previous?.progress ?? (lesson.lessonProgress ? resumeLessonProgress(objective, lesson.lessonProgress) : createLessonProgress(objective));
  const prompt = buildPrompt(lesson, { level: next, objective, progress });
  const families = previous?.families ?? familiesFor(prompt);
  return {
    system: prompt.system,
    user: prompt.user,
    level: next,
    size: measureRequest(prompt.system, prompt.user, schemaFrom(schemaSource, families)),
    assetCount: prompt.assets.relevant.length,
    representation: prompt.representation,
    families,
    stateChars: prompt.stateChars,
    speechChars: prompt.speechChars,
    objective,
    progress,
  };
}

export type { ContextLevel };