import { BoardAction, BoardState, TextAnchor } from "../board/types";
import { parseVisualActions, parseVisualScene, repairVisualActions } from "../visual/validate";
import { parseVisual3DActions, parseVisual3DScene } from "../visual3d/validate";
import { TEACHING_LANGUAGES, TeachingLessonResponse, TeachingRequest, TeachingResponse } from "./types";
import { logVisualContract } from "./diagnostics";
import { LessonProgressView, TEACHING_DEPTHS, TEACHING_SUBJECTS, TeachingStage } from "./objective";
import { FormulaTeaching, PedagogicalBlock, TEACHING_INTENTS, TeachingIntent } from "./pedagogy";
import type { TeachingDepth, TeachingSubject } from "./intent";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

// Parse a TextAnchor from an unknown value. Returns null when the value is malformed.
function parseTextAnchor(value: unknown): TextAnchor | null {
  if (!isRecord(value)) return null;
  if (value.type === "point") {
    return isNumber(value.x) && isNumber(value.y) ? { type: "point", x: value.x as number, y: value.y as number } : null;
  }
  if (value.type === "object") {
    const positions = ["inside", "above", "below", "left", "right", "center"] as const;
    return isString(value.id) && value.id.trim() && isString(value.position) && positions.includes(value.position as typeof positions[number])
      ? { type: "object", id: value.id as string, position: value.position as "inside" | "above" | "below" | "left" | "right" | "center" }
      : null;
  }
  if (value.type === "edge") {
    const positions = ["midpoint", "start", "end", "offset"] as const;
    if (!isString(value.id) || !value.id.trim()) return null;
    const position = isString(value.position) && positions.includes(value.position as typeof positions[number])
      ? value.position as "midpoint" | "start" | "end" | "offset" : "midpoint";
    return { type: "edge", id: value.id as string, position };
  }
  return null;
}

export function parseBoardState(value: unknown): BoardState | null {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges) || !Array.isArray(value.texts) || !Array.isArray(value.highlights)) return null;
  const nodes = value.nodes.every((node) => isRecord(node) && isString(node.id) && isString(node.value) && isNumber(node.x) && isNumber(node.y));
  const edges = value.edges.every((edge) => isRecord(edge) && isString(edge.id) && isString(edge.from) && isString(edge.to));
  const texts = value.texts.every((text) => {
    if (!isRecord(text) || !isString(text.id) || !isString(text.text)) return false;
    // Accept texts that have a valid anchor, OR texts with raw x/y (legacy round-trip).
    if (isRecord(text.anchor) && parseTextAnchor(text.anchor) !== null) return true;
    if (isNumber(text.x) && isNumber(text.y)) return true;
    return false;
  });
  const highlights = value.highlights.every(isString);
  return nodes && edges && texts && highlights ? value as BoardState : null;
}


export function parseTeachingLessonProgress(value: unknown): LessonProgressView | null {
  if (!isRecord(value)) return null;
  if (!isString(value.topic) || !value.topic.trim()) return null;
  if (!TEACHING_DEPTHS.includes(value.depth as typeof TEACHING_DEPTHS[number])) return null;
  if (!TEACHING_SUBJECTS.includes(value.subject as typeof TEACHING_SUBJECTS[number])) return null;
  if (typeof value.codeRelevant !== "boolean") return null;
  if (!Array.isArray(value.stages)) return null;
  const stages: TeachingStage[] = [];
  for (const raw of value.stages) {
    const stage = parseTeachingStage(raw);
    if (!stage) return null;
    stages.push(stage);
  }
  const coveredStageIds = Array.isArray(value.coveredStageIds) ? value.coveredStageIds.filter(isString) : [];
  const remainingStageIds = Array.isArray(value.remainingStageIds) ? value.remainingStageIds.filter(isString) : [];
  const counts = [value.stepsDelivered, value.minSteps, value.maxSteps];
  if (!counts.every((count) => isNumber(count) && count >= 0)) return null;
  // Stage words are optional in an echoed payload: a client from before this field existed still sends
  // a usable progress, and coverage simply re-accumulates. Rejecting the whole progress instead would
  // restart the lesson from stage one, which is far worse than losing the running word count.
  const stageWords: Record<string, number> = isRecord(value.stageWords)
    ? Object.fromEntries(
        Object.entries(value.stageWords)
          .filter((entry): entry is [string, number] => isNumber(entry[1]) && entry[1] >= 0),
      )
    : {};
  return {
    topic: value.topic.trim(),
    subject: value.subject as TeachingSubject,
    depth: value.depth as TeachingDepth,
    codeRelevant: value.codeRelevant,
    stages,
    coveredStageIds,
    remainingStageIds,
    currentStageId: isString(value.currentStageId) ? value.currentStageId : null,
    currentStageTitle: isString(value.currentStageTitle) ? value.currentStageTitle : null,
    stageWords,
    stepsDelivered: Math.trunc(value.stepsDelivered as number),
    minSteps: Math.trunc(value.minSteps as number),
    maxSteps: Math.trunc(value.maxSteps as number),
    complete: value.complete === true,
  };
}

function parseTeachingStage(value: unknown): TeachingStage | null {
  if (!isRecord(value)) return null;
  if (!isString(value.id) || !value.id.trim()) return null;
  if (!isString(value.kind) || !isString(value.title) || !value.title.trim()) return null;
  if (!isString(value.goal)) return null;
  if (!isNumber(value.minWords) || value.minWords < 0) return null;
  // `intent` is optional on the wire: a stage echoed back from a client that predates the pedagogical
  // layer does not carry it. Consumers resolve it through `stageIntent`, which falls back to the
  // stage kind, so a missing field costs a default rather than a crash.
  const intent = isString(value.intent) && (TEACHING_INTENTS as readonly string[]).includes(value.intent)
    ? value.intent as TeachingIntent
    : undefined;
  return {
    id: value.id,
    kind: value.kind as TeachingStage["kind"],
    title: value.title,
    goal: value.goal,
    minWords: value.minWords,
    needsVisual: value.needsVisual === true,
    needsCode: value.needsCode === true,
    ...(intent ? { intent } : {}),
  };
}

export function parseTeachingRequest(value: unknown): TeachingRequest | null {
  if (!isRecord(value)) return null;
  if (!isString(value.question) || !value.question.trim()) return null;
  if (!TEACHING_LANGUAGES.includes(value.language as typeof TEACHING_LANGUAGES[number])) return null;
  if (!isNumber(value.lessonStep) || !Number.isInteger(value.lessonStep) || value.lessonStep < 1) return null;
  const boardState = parseBoardState(value.boardState);
  if (!boardState) return null;
  const visualState = parseVisualScene(value.visualState);
  if (!visualState) return null;
  const visualState3d = parseVisual3DScene(value.visualState3d);
  if (!visualState3d) return null;
  const previousTeaching = Array.isArray(value.previousTeaching) && value.previousTeaching.every(isString) ? value.previousTeaching.slice(-8) : undefined;
  // Progress is optional and self-describing: an unparseable copy is dropped rather than failing the
  // lesson, because the objective is rebuilt from the question anyway.
  const lessonProgress = value.lessonProgress === undefined ? undefined : parseTeachingLessonProgress(value.lessonProgress);
  return {
    question: value.question.trim(),
    language: value.language as typeof TEACHING_LANGUAGES[number], lessonStep: value.lessonStep, boardState,
    ...(value.visualState !== undefined ? { visualState } : {}),
    ...(value.visualState3d !== undefined ? { visualState3d } : {}),
    ...(previousTeaching ? { previousTeaching } : {}),
    ...(lessonProgress ? { lessonProgress } : {}),
    ...(isString(value.studentQuestion) && value.studentQuestion.trim() ? { studentQuestion: value.studentQuestion.trim() } : {}),
  };
}

// Development-only diagnostics: returns the FIRST reason a teaching request was rejected so the
// server log can pinpoint a frontend/backend contract mismatch WITHOUT weakening validation or
// printing the whole request body.
export function describeTeachingRequestError(value: unknown): string {
  if (!isRecord(value)) return "The request body must be a JSON object.";
  if (!isString(value.question) || !value.question.trim()) return "The 'question' field is required and must be a non-empty string.";
  if (!TEACHING_LANGUAGES.includes(value.language as typeof TEACHING_LANGUAGES[number])) return `The 'language' field must be one of: ${TEACHING_LANGUAGES.join(", ")}.`;
  if (!isNumber(value.lessonStep) || !Number.isInteger(value.lessonStep) || value.lessonStep < 1) return "The 'lessonStep' field must be a positive integer.";
  if (!parseBoardState(value.boardState)) return "The 'boardState' field must be a valid board state.";
  if (value.visualState !== undefined && !parseVisualScene(value.visualState)) return "The 'visualState' field must be a valid visual scene.";
  if (value.visualState3d !== undefined && !parseVisual3DScene(value.visualState3d)) return "The 'visualState3d' field must be a valid 3D scene.";
  if (value.lessonProgress !== undefined && !parseTeachingLessonProgress(value.lessonProgress)) return "The 'lessonProgress' field must be a valid lesson progress view.";
  // The request arrived from a BROWSER, not from a caller we control, so the last line matters: it is the
  // difference between "some field was wrong" and a 400 nobody can act on. It has been observed on a real
  // lesson, and naming the field is what turns it from a mystery into a bug.
  const unexpected = Object.keys(value).filter((key) => !KNOWN_REQUEST_FIELDS.has(key));
  if (unexpected.length > 0) return `Unrecognised field(s) in the teaching request: ${unexpected.join(", ")}.`;
  return "The teaching request could not be parsed.";
}

/** Exactly what a lesson request may carry. Anything else is a client sending something the server ignores. */
const KNOWN_REQUEST_FIELDS: ReadonlySet<string> = new Set([
  "question", "language", "lessonStep", "boardState", "visualState", "visualState3d",
  "previousTeaching", "studentQuestion", "representationIntent", "lessonProgress",
]);

export function parseBoardAction(value: unknown): BoardAction | null {
  if (!isRecord(value) || !isString(value.action)) return null;
  switch (value.action) {
    case "draw_node":
      return isString(value.id) && isString(value.value) && (value.x === undefined || isNumber(value.x)) && (value.y === undefined || isNumber(value.y)) && (value.parentId === undefined || isString(value.parentId)) && (value.side === undefined || value.side === "left" || value.side === "right")
        ? { action: value.action, id: value.id, value: value.value, ...(isNumber(value.x) ? { x: value.x } : {}), ...(isNumber(value.y) ? { y: value.y } : {}), ...(isString(value.parentId) ? { parentId: value.parentId } : {}), ...(value.side === "left" || value.side === "right" ? { side: value.side } : {}) } : null;
    case "connect": return isString(value.from) && isString(value.to) && (value.id === undefined || isString(value.id)) ? { action: value.action, from: value.from, to: value.to, ...(isString(value.id) ? { id: value.id } : {}) } : null;
    case "write_text": {
      if (!isString(value.id) || !isString(value.text)) return null;
      // Accept the new semantic anchor format.
      if (isRecord(value.anchor)) {
        const anchor = parseTextAnchor(value.anchor);
        if (!anchor) return null;
        return {
          action: "write_text", id: value.id, text: value.text, anchor,
          ...(isNumber(value.fontSize) ? { fontSize: value.fontSize as number } : {}),
          ...(isNumber(value.maxWidth) ? { maxWidth: value.maxWidth as number } : {}),
        };
      }
      // Accept the legacy {x, y} format: convert to a point anchor automatically so old
      // lesson data, mock steps, and AI responses that haven't migrated yet all still work.
      if (isNumber(value.x) && isNumber(value.y)) {
        return {
          action: "write_text", id: value.id, text: value.text,
          anchor: { type: "point", x: value.x as number, y: value.y as number },
        };
      }
      return null;
    }
    case "highlight": case "erase": return isString(value.target) ? { action: value.action, target: value.target } : null;
    case "move_node": return isString(value.id) && isNumber(value.x) && isNumber(value.y) ? { action: value.action, id: value.id, x: value.x, y: value.y } : null;
    case "clear": return { action: "clear" };
    default: return null;
  }
}


export function parseTeachingResponse(value: unknown): TeachingResponse | null {
  if (!isRecord(value) || !isString(value.speech) || !isNumber(value.lesson_step) || !Number.isInteger(value.lesson_step) || !isNumber(value.next_step) || !Number.isInteger(value.next_step)) return null;
  // board_actions (Graph Renderer), visual_actions (Diagram Renderer), and visual3d_actions (3D
  // Renderer) are all optional and default to empty, so a step may drive any renderer — or none.
  const rawBoardActions = value.board_actions === undefined || value.board_actions === null ? [] : value.board_actions;
  if (!Array.isArray(rawBoardActions)) return null;
  const actions = rawBoardActions.map(parseBoardAction);
  if (actions.some((action) => action === null)) return null;
  // 2D actions are repaired PER ACTION, not rejected as a batch: one malformed decorative action must
  // never cost the student the diagram the rest of the step is teaching. Every drop is logged.
  const repaired = repairVisualActions(value.visual_actions);
  for (const diagnostic of repaired.diagnostics) {
    console.warn(
      `[teaching] visual action ${diagnostic.action}${diagnostic.target ? ` (${diagnostic.target})` : ""} ${diagnostic.outcome}: ${diagnostic.reason}`,
    );
    // A drop with no payload is not a diagnosis. "highlight dropped: malformed" says nothing about
    // WHICH field was wrong, and this is the only place the model's own words are still visible: the
    // action never reaches the board, so nothing downstream can report on it. Bounded so a large or
    // hostile payload cannot flood the log.
    if (diagnostic.outcome === "dropped") {
      const raw = Array.isArray(value.visual_actions) ? value.visual_actions[diagnostic.index] : undefined;
      if (isRecord(raw)) console.warn(`[teaching] visual action rejected payload: ${JSON.stringify(raw).slice(0, 600)}`);
    }
  }
  const visual3dActions = parseVisual3DActions(value.visual3d_actions);
  const raw3d = value.visual3d_actions === undefined || value.visual3d_actions === null ? [] : value.visual3d_actions;
  const raw3dList = Array.isArray(raw3d) ? raw3d : [];
  const dropped3d = visual3dActions === null ? raw3dList.length : raw3dList.length - visual3dActions.length;
  // THE VISUAL CONTRACT, measured per step. Without this, a lesson that asked for 14 visual actions
  // and used none looks identical to a perfect one from the outside — both render, neither errors.
  logVisualContract({
    lessonStep: value.lesson_step,
    requested2d: Array.isArray(value.visual_actions) ? value.visual_actions.length : 0,
    requested3d: raw3dList.length,
    requestedBoard: rawBoardActions.length,
    accepted2d: repaired.actions.length,
    accepted3d: visual3dActions?.length ?? 0,
    acceptedBoard: actions.length,
    repaired2d: repaired.diagnostics.filter((diagnostic) => diagnostic.outcome === "repaired").length,
    dropped2d: repaired.diagnostics.filter((diagnostic) => diagnostic.outcome === "dropped").length,
    dropped3d,
    representation: visual3dActions && visual3dActions.length > 0
      ? "3d"
      : repaired.actions.length > 0
        ? "2d"
        : actions.length > 0
          ? "board"
          : "none",
    droppedNames: [
      ...repaired.diagnostics.filter((diagnostic) => diagnostic.outcome === "dropped").map((diagnostic) => diagnostic.action),
      ...(dropped3d > 0 ? ["<3d-action>"] : []),
    ],
  });
  if (visual3dActions === null) return null;
  const pedagogy = parsePedagogy(value.pedagogy);
  const intent = isString(value.teaching_intent) && (TEACHING_INTENTS as readonly string[]).includes(value.teaching_intent)
    ? value.teaching_intent as TeachingIntent
    : undefined;
  return {
    speech: value.speech,
    board_actions: actions as BoardAction[],
    visual_actions: repaired.actions,
    visual3d_actions: visual3dActions,
    lesson_step: value.lesson_step,
    next_step: value.next_step,
    ...(isString(value.stage_id) && value.stage_id.trim() ? { stage_id: value.stage_id.trim() } : {}),
    ...(value.representation === "2d" || value.representation === "3d" ? { representation: value.representation } : {}),
    // A step with no declared intent is not a rejected step: an interruption answer is speech plus
    // whatever it adds to the board, and inventing an intent for it would put a number in the coverage
    // report that nobody earned.
    ...(intent ? { teaching_intent: intent } : {}),
    ...(pedagogy ? { pedagogy } : {}),
  };
}

/** Hard caps on the pedagogical payload, so a step cannot smuggle a whole essay through it. */
const PEDAGOGY_TEXT_LIMIT = 600;
const PEDAGOGY_LINE_LIMIT = 240;
const PEDAGOGY_LIST_LIMIT = 12;
const FORMULA_VARIABLE_LIMIT = 12;

const cleanText = (value: unknown, limit = PEDAGOGY_TEXT_LIMIT): string | undefined =>
  isString(value) && value.trim().length > 0 ? value.trim().slice(0, limit) : undefined;

const cleanList = (value: unknown, limit = PEDAGOGY_LIST_LIMIT, each = PEDAGOGY_LINE_LIMIT): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const lines = value.filter((line): line is string => isString(line) && line.trim().length > 0)
    .map((line) => line.trim().slice(0, each));
  return lines.length > 0 ? lines.slice(0, limit) : undefined;
};

/**
 * The authoritative parser for a step's teaching content.
 *
 * Deliberately forgiving about missing fields and strict about their shape: a step that omits
 * `pedagogy` entirely is perfectly valid (an interruption answer is), while a malformed formula is
 * discarded rather than half-applied, because a formula with an unexplained symbol is the exact failure
 * this layer exists to stop.
 */
export function parsePedagogy(value: unknown): PedagogicalBlock | null {
  if (!isRecord(value)) return null;
  const formula = parseFormulaTeaching(value.formula);
  const block: PedagogicalBlock = {
    ...(cleanText(value.concept, 200) ? { concept: cleanText(value.concept, 200)! } : {}),
    ...(cleanText(value.prerequisite, 300) ? { prerequisite: cleanText(value.prerequisite, 300)! } : {}),
    ...(cleanText(value.why) ? { why: cleanText(value.why)! } : {}),
    ...(cleanText(value.example) ? { example: cleanText(value.example)! } : {}),
    ...(cleanText(value.interpretation, 400) ? { interpretation: cleanText(value.interpretation, 400)! } : {}),
    ...(cleanText(value.verification, 400) ? { verification: cleanText(value.verification, 400)! } : {}),
    ...(formula ? { formula } : {}),
  };
  return Object.keys(block).length > 0 ? block : null;
}

function parseFormulaTeaching(value: unknown): FormulaTeaching | null {
  if (!isRecord(value)) return null;
  const formula = cleanText(value.formula, 300);
  if (!formula) return null;
  const variables = Array.isArray(value.variables)
    ? value.variables
      .filter(isRecord)
      .map((entry) => ({
        symbol: cleanText(entry.symbol, 24),
        meaning: cleanText(entry.meaning, 200),
        ...(cleanText(entry.unit, 40) ? { unit: cleanText(entry.unit, 40)! } : {}),
      }))
      // A variable with no symbol cannot be pointed at; one with no meaning is decoration. Both are dropped.
      .filter((entry): entry is { symbol: string; meaning: string; unit?: string } => Boolean(entry.symbol && entry.meaning))
      .slice(0, FORMULA_VARIABLE_LIMIT)
    : undefined;
  return {
    formula,
    ...(cleanText(value.calculates, 300) ? { calculates: cleanText(value.calculates, 300)! } : {}),
    ...(cleanText(value.why, 400) ? { why: cleanText(value.why, 400)! } : {}),
    ...(cleanList(value.assumptions) ? { assumptions: cleanList(value.assumptions)! } : {}),
    ...(variables && variables.length > 0 ? { variables } : {}),
    ...(cleanList(value.derivation) ? { derivation: cleanList(value.derivation)! } : {}),
  };
}

/**
 * Development-only diagnostics: the FIRST reason each malformed step in a batch was rejected.
 *
 * A dropped step is the designed behaviour, but silently dropping most of a batch is a bug in
 * something else — the schema, the prompt, or this parser — so the server log has to say which.
 */
export function describeMalformedLessonSteps(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.steps)) return [];
  return value.steps.flatMap((step, index) => {
    if (parseTeachingResponse(step) !== null) return [];
    const boardActions = isRecord(step) && Array.isArray(step.board_actions) ? step.board_actions : [];
    const reason = !isRecord(step)
      ? "the step is not an object"
      : !isString(step.speech) || !step.speech.trim()
        ? "speech is missing or not a string"
        : !isNumber(step.lesson_step) || !isNumber(step.next_step)
          ? "lesson_step/next_step are missing or not integers"
          : !Array.isArray(step.board_actions ?? [])
            ? "board_actions is not an array"
            : boardActions.some((action) => parseBoardAction(action) === null)
              ? `a board action is not a supported one (${boardActions.find((action) => parseBoardAction(action) === null) && JSON.stringify(boardActions.find((action) => parseBoardAction(action) === null)).slice(0, 160)})`
              : parseVisualActions(step.visual_actions) === null
                ? `visual_actions is not an array (${JSON.stringify(step.visual_actions).slice(0, 160)})`
                : `a 3D action is not a supported one (${JSON.stringify(step.visual3d_actions).slice(0, 300)})`;
    return [`step ${index + 1}: ${reason}`];
  });
}

export function parseTeachingLessonResponse(value: unknown): TeachingLessonResponse | null {
  if (!isRecord(value)) return null;
  const steps = parseAllTeachingSteps(value);
  if (!steps) return null;
  const progress = value.progress === undefined ? undefined : parseTeachingLessonProgress(value.progress);
  return { steps, ...(progress ? { progress } : {}) };
}

/**
 * Parses a lesson batch KEEPING the steps that are valid and dropping only the malformed ones.
 *
 * A batch is six teaching steps, and rejecting all six because one of them carried a bad field throws
 * away good teaching and triggers a long failover chain. The classroom is objective-driven, so a
 * dropped step simply leaves its stage for the next batch, which is the correct outcome.
 */
export function parseAllTeachingSteps(value: unknown): TeachingResponse[] | null {
  if (!isRecord(value) || !Array.isArray(value.steps)) return null;
  const steps = value.steps.map(parseTeachingResponse).filter((step): step is TeachingResponse => step !== null);
  return steps.length > 0 ? steps : null;
}
