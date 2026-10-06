import { BoardAction, BoardState } from "../board/types";
import { VisualAction, VisualScene } from "../visual/types";
import { Visual3DAction, Visual3DScene } from "../visual3d/types";
import type { LessonProgressView } from "./objective";
import type { PedagogicalBlock, TeachingIntent } from "./pedagogy";

/**
 * The teaching verdict for one batch, in the compact form an acceptance run can assert on.
 *
 * A 200 with schema-valid actions is a transport fact; these fields are the teaching facts — whether
 * the things the teacher named are actually on the board, and what had to be corrected to get there.
 */
export type LessonQualitySummary = {
  ok: boolean;
  topic: string;
  subject: string;
  /** The stage this lesson is shown on for its whole duration. */
  representation: "2d" | "3d";
  steps: number;
  words: number;
  visualSteps: number;
  entitiesNamed: string[];
  entitiesShown: string[];
  /** Of the fifteen questions a lesson should answer, the ones this batch's declared intents covered. */
  concernsCovered: string[];
  concernsTarget: number;
  intentsDeclared: (string | null)[];
  stepsWithIntent: number;
  promotedPrimitives: number;
  labelsAdded: number;
  droppedActions: number;
  /** Elements removed because nothing in the speech gave them a reason to be on the board. */
  decorativeDropped: number;
  /** 0-100 for the board the student sees: focus, currency, identity, readability, density, connectivity. */
  visualScore: number;
  /** What is wrong with that board, in repair order. */
  visualProblems: string[];
  visualRemoved: number;
  visualMerged: number;
  /**
   * Per-step composition evidence: how many objects were on the board, how many were retired, how much of
   * it belonged to the step being taught, and how many foreign representations got through. This is the
   * measurable form of "the visible board is not the lesson's memory", and it is what the acceptance run
   * asserts on rather than a screenshot.
   */
  composition: Array<{
    lessonStep: number;
    subject: string;
    subdomain: string;
    teachingIntent: string;
    visibleObjectCount: number;
    retiredObjectCount: number;
    supportingObjectCount: number;
    contextObjectCount: number;
    focusedObjectCount: number;
    visualFocusScore: number;
    densityScore: number;
    overlapCount: number;
    foreignRepresentationCount: number;
  }>;
  /** What was corrected or dropped, per step, as "pass: detail". */
  notes: string[];
  issues: Array<{ kind: string; lessonStep: number; detail: string }>;
};

/**
 * What one provider call ACTUALLY consumed, as that provider reported it.
 *
 * Deliberately not comparable with the request planner's estimate (`RequestPlan.size.totalTokens`): that
 * measures how big the outgoing request is before it is sent, this measures what was billed after it
 * came back, and the two answer different questions. Every field is optional because the three providers
 * report usage differently and any of them may report none of it — see `lib/teaching/usage.ts` for how
 * the fields are reduced, and for why an absent report is never turned into a number.
 */
export type ProviderTokenUsage = {
  /** Tokens the provider counted as the request. */
  inputTokens?: number;
  /** Tokens the provider counted as the answer. */
  outputTokens?: number;
  /** The provider's own total, when it reports one. */
  totalTokens?: number;
};

export const TEACHING_LANGUAGES = ["English", "Hinglish", "Hindi", "Telugu", "Tamil", "Kannada", "Malayalam", "Marathi", "Bengali", "Punjabi"] as const;
export type TeachingLanguage = typeof TEACHING_LANGUAGES[number];

export type TeachingRequest = {
  // The single, generalized topic field: any free-form educational request
  // ("Explain photosynthesis", "Teach me recursion", "Explain TCP 3-way handshake", ...).
  question: string;
  language: TeachingLanguage;
  lessonStep: number;
  boardState: BoardState;
  // Current generalized diagram scene, so the model can extend (not redraw) an existing diagram.
  visualState?: VisualScene;
  // Current 3D scene state, so the model can extend a 3D scene across steps and interruptions.
  visualState3d?: Visual3DScene;
  previousTeaching?: string[];
  studentQuestion?: string;
  /**
   * The stage the STUDENT chose, from the 2D/3D buttons. Null means Auto.
   *
   * It is a request field rather than something re-derived from the question because the buttons are a
   * decision made after the question was typed: "Explain the heart" followed by pressing 2D is a real
   * instruction that the text alone cannot express.
   */
  representationIntent?: "2d" | "3d" | null;
  // Lesson progress echoed back by the classroom. It is how a resumed, interrupted or language
  // switched lesson keeps its place in the objective instead of restarting from zero.
  lessonProgress?: LessonProgressView;
};

// One teaching step. `board_actions` (existing Graph Renderer), `visual_actions` (2D Diagram Renderer),
// and `visual3d_actions` (3D Renderer) are ALL supported; any may be empty. The model picks whichever
// fits the topic. In Auto mode, the classroom prefers 3D when visual3d_actions is non-empty.
export type TeachingResponse = {
  speech: string;
  board_actions: BoardAction[];
  visual_actions: VisualAction[];
  visual3d_actions: Visual3DAction[];
  lesson_step: number;
  next_step: number;
  // Which objective stage this step teaches ("s3"). Optional, because coverage is measured from the
  // speech itself and never depends on the model labelling its work.
  stage_id?: string;
  /**
   * Which stage this lesson is shown on, decided once and carried on every step.
   *
   * The classroom renders ONE stage, so a lesson that drew into both families shipped content the
   * student never saw — twenty-five laid-out array cells on a hidden board beside an empty world. The
   * pipeline decides this before the first request and repeats it here, so the stage cannot flip
   * mid-lesson when a later batch happens to draw in the other family.
   */
  representation?: "2d" | "3d";
  /**
   * What this step is TEACHING, as opposed to what it draws.
   *
   * The single field worth filling in on every step. It is what lets the quality gate measure "did this
   * lesson explain why, or did it just produce an answer", and it is what a teacher would say they are
   * about to do before they say it: "choose_method", then "substitute", then "verify".
   */
  teaching_intent?: TeachingIntent;
  /**
   * The step's teaching content: the concept, the prerequisite it assumes, the reasoning behind a
   * choice, a worked example, how to read the result, how it was checked, and the formula with its
   * symbols explained.
   *
   * Optional and partial by design — a step fills in only what applies to it. See `PedagogicalBlock` for
   * why this is one bounded object rather than a dozen top-level fields.
   */
  pedagogy?: PedagogicalBlock;
  /**
   * What the provider was actually charged for producing THIS step, when it reported it.
   *
   * Attached by the provider from the real response, and summed by the router across the attempts it took
   * to produce the step. Absent means "the provider did not say", which is displayed as such rather than
   * filled in from an estimate.
   */
  usage?: ProviderTokenUsage;
};

export type TeachingLessonResponse = {
  steps: TeachingResponse[];
  /** Objective-based state of the lesson. Absent only for legacy/dev payloads. */
  progress?: LessonProgressView;
  /**
   * The teaching verdict for this batch. Returned only when the caller asks for diagnostics, so the
   * normal student-facing payload is unchanged.
   */
  quality?: LessonQualitySummary;
  /**
   * What the provider was actually charged for this BATCH, when it reported it.
   *
   * Batch-level, not per step: a lesson request is one call that happens to return several steps, so
   * splitting the figure across them would be inventing precision the provider never reported.
   */
  usage?: ProviderTokenUsage;
};