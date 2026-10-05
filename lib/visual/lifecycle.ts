// THE VISUAL TEACHING-STATE LIFECYCLE.
//
// The board is not a history of everything the teacher has said. It is a representation of what the
// student currently needs to understand. Those are different things, and the difference is this file.
//
// The problem it solves was measured, not imagined: a real Newton's-second-law lesson grew from 8 objects
// at step 1 to 58 at step 18, with 57 of the 58 on screen belonging to earlier steps. Force, Mass,
// Acceleration, Velocity, Given, Cause→Effect, an old formula, a new label and a duplicated concept were
// all still there, all equally loud, while the numerical calculation the teacher was actually doing sat
// among them. Nothing in the pipeline ever decided that any of it had stopped being relevant, because
// no stage of the pipeline had that job.
//
// So the lifecycle is DERIVED, not authored. The model describes teaching — an intent, a formula, a
// structure — and this decides, deterministically, what that means for what is already on the board:
//
//   born this step                  -> current      what the teacher is talking about
//   referenced by this step         -> supporting   still needed to understand it
//   within the grace window         -> supporting   finished, but not long ago
//   past the grace window           -> completed    and retired from the board
//   an interruption's answer        -> temporary    gone as soon as the lesson resumes
//
// Retirement is per GROUP, not per object: a structure compiles into dozens of primitives sharing a
// prefix, and a lesson that cannot retire "the whole previous diagram" is a lesson that cannot retire
// anything. Nothing here clears the board. What it does is remove the parts that stopped being true, and
// the gate's job of drawing something current means the stage is never left empty.

import {
  LIFECYCLE_GRACE_STAGES, MIN_BOARD_OBJECTS, VISUAL_PRIORITY, VisualAction, VisualLifecycle, VisualObject, VisualScene,
} from "./types";

/** Where the objects a step creates stand before anything else is decided. */
export type StepVisualContext = {
  /** The structure group these actions belong to, when the layout compiler knows it. */
  group?: string;
  /** The lesson step being applied. Recorded on every object it creates. */
  step?: number;
  /** Index of the objective stage that step teaches. Decides what has become stale. */
  stage?: number;
  /** Set when these actions answer an interruption rather than advancing the lesson. */
  temporary?: boolean;
};

/** Why an object left the board, so the report can say it rather than a student noticing it. */
export type Retirement = {
  group: string;
  lifecycle: VisualLifecycle;
  /** Lesson step that introduced the group. */
  bornStep: number;
  /** How many stages it outlived. */
  stagesOld: number;
  objectIds: string[];
};

export type LifecycleResult = {
  scene: VisualScene;
  retired: Retirement[];
  /** The group the current step's own objects belong to, for the report. */
  currentGroups: string[];
};

/** Every id these actions address. A referenced object is never retired out from under a pointer. */
export function referencedIds(actions: readonly VisualAction[]): Set<string> {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === "string" && value.length > 0) ids.add(value);
  };
  for (const action of actions) {
    const record = action as unknown as Record<string, unknown>;
    add(record.id);
    add(record.target);
    add(record.from);
    add(record.to);
    add(record.relativeTo);
    if (Array.isArray(record.ids)) for (const id of record.ids) add(id);
  }
  return ids;
}

/**
 * The group an object belongs to.
 *
 * Set explicitly by the layout compilers, which know their own id scheme — that is the reliable way,
 * because a structure's children are named by that scheme and nothing else can be sure which suffix is
 * structural and which is part of a name. A model-emitted primitive has no group, so it is its own
 * group and retires on its own.
 */
export function groupOf(id: string, declared?: string): string {
  if (declared && declared.length > 0) return declared;
  return id;
}

/** Objects whose whole group matches, plus the objects themselves (a group of one). */
function groupOfObject(object: VisualObject): string {
  return groupOf(object.id, object.group);
}

function groupMembers(objects: readonly VisualObject[], group: string): VisualObject[] {
  return objects.filter((object) => groupOfObject(object) === group);
}

/**
 * The lifecycle for one object, given what this step is doing.
 *
 * `stagesOld` is how many objective stages have been passed since this object arrived. It is the only
 * input that decides staleness, which is what makes the behaviour identical for a derivative, a
 * handshake and a free-body diagram.
 */
export function lifecycleFor(
  object: VisualObject,
  current: { step?: number; stage?: number; temporary?: boolean },
  referenced: ReadonlySet<string>,
): VisualLifecycle {
  const bornHere = object.bornStep !== undefined && current.step !== undefined && object.bornStep >= current.step;
  // TEMPORARY IS ABOUT WHAT AN INTERRUPTION ADDED, not about the whole board.
  //
  // Classifying everything as temporary while an aside was on screen meant the lesson's own diagram was
  // marked temporary too, and the first step after the aside retired it: a two-second question about tau
  // deleted the work in progress. Only objects born during the aside are temporary.
  if (current.temporary && (bornHere || object.bornTemporary === true)) return "temporary";
  if (bornHere) return "current";
  if (referenced.has(object.id)) return "supporting";
  if (object.group !== undefined && referenced.has(object.group)) return "supporting";

  const stagesOld = stagesSince(object, current);
  if (stagesOld <= LIFECYCLE_GRACE_STAGES) return "supporting";
  // A single old object that nothing points at is finished; a whole diagram that was once the whole
  // point of the lesson is worth one more glance as context before it goes.
  return object.lifecycle === "supporting" ? "context" : "completed";
}

function stagesSince(object: VisualObject, current: { stage?: number }): number {
  if (object.bornStage === undefined || current.stage === undefined) return 0;
  return Math.max(0, current.stage - object.bornStage);
}

/**
 * Applies the lifecycle to a scene as a step is applied.
 *
 * Called from the engine BEFORE the new actions are reduced, so the objects this step is about are laid
 * out into the space the stale ones just vacated rather than into a board that is already full.
 */
export function applyLifecycle(scene: VisualScene, actions: readonly VisualAction[], context: StepVisualContext): LifecycleResult {
  // With no lesson step and no stage there is no history to judge against — a standalone diagram, a
  // snapshot rebuilt from scratch, a test. Classifying against nothing would dim every object to
  // "supporting" for a board that has no current step at all, which is how a perfectly good diagram ends
  // up looking half-erased.
  if (context.step === undefined && context.stage === undefined && !context.temporary) {
    return { scene, retired: [], currentGroups: [] };
  }
  const referenced = referencedIds(actions);
  const currentStage = context.stage;

  // 1. What should be on the board once this step has run?
  const kept: VisualObject[] = [];
  const retired: Retirement[] = [];
  const retiredGroups = new Map<string, Retirement>();
  const lifecycles = new Map<string, VisualLifecycle>();

  for (const object of scene.objects) {
    const lifecycle = lifecycleFor(object, context, referenced);
    lifecycles.set(object.id, lifecycle);
    // TEMPORARY objects belong to an interruption's answer. They are visible while it is explained and
    // gone as soon as the lesson itself applies a step, which is the only difference between an aside and
    // part of the lesson. `bornTemporary` is what identifies them: an object the aside did not create is
    // not part of the aside, however temporary the board looked while it was there.
    const expiredInterruption = object.bornTemporary === true && !context.temporary;
    if (lifecycle === "completed" || lifecycle === "obsolete" || expiredInterruption) {
      const group = groupOfObject(object);
      const entry = retiredGroups.get(group) ?? {
        group,
        lifecycle: expiredInterruption ? "temporary" : lifecycle,
        bornStep: object.bornStep ?? -1,
        stagesOld: stagesSince(object, { stage: currentStage }),
        objectIds: [],
      };
      entry.objectIds.push(object.id);
      retiredGroups.set(group, entry);
      continue;
    }
    kept.push(applyAttention({ ...object, lifecycle }));
  }

  // 2. A group retires together. Anything still referenced keeps the group alive, so an arrow pointing at
  //    a diagram never leaves the diagram stranded on its own.
  const survivors = new Set<string>();
  for (const object of kept) {
    if (object.group && referenced.has(object.group)) survivors.add(object.group);
  }
  const stillReferenced = kept.some((object) => referenced.has(object.id));
  const finalObjects = [...kept];
  if (!stillReferenced && survivors.size === 0) {
    for (const [group, entry] of retiredGroups) {
      // Anything in the same group that survived keeps the group on the board.
      if (finalObjects.some((object) => groupOfObject(object) === group)) {
        entry.objectIds = entry.objectIds.filter((id) => !finalObjects.some((object) => object.id === id));
        if (entry.objectIds.length === 0) continue;
      }
      retired.push(entry);
    }
  } else {
    retired.push(...retiredGroups.values());
  }

  const dropped = new Set(retired.flatMap((entry) => entry.objectIds));
  // NEVER WIPE THE BOARD TO TEACH A STEP THAT ADDS NOTHING.
  //
  // Retirement is correct in principle and wrong in this corner: a recap or an application step that draws
  // nothing would otherwise leave the student staring at an empty stage, which is worse than a slightly
  // stale picture. A teacher who says something new without drawing anything leaves the previous diagram
  // up, and so does the board — the most recent picture stays until something replaces it.
  //
  // An aside is NEVER restored: it belongs to the interruption that produced it, and putting it back would
  // defeat the whole point of scoping it.
  // 2. A stage jump can put everything past its grace window at once. Retirement is a trickle, not a purge.
  const budget = retirementBudget(scene.objects.length);
  let allowed = budget;
  const droppedFinal = new Set<string>();
  for (const object of scene.objects) {
    if (!dropped.has(object.id) || allowed <= 0) continue;
    droppedFinal.add(object.id);
    allowed -= 1;
  }
  const remaining = finalObjects.filter((object) => !droppedFinal.has(object.id));
  const restored = remaining.length >= MIN_BOARD_OBJECTS ? remaining : keepMostRecent(scene.objects, MIN_BOARD_OBJECTS - remaining.length);
  return {
    scene: { ...scene, objects: restored },
    retired: restored.length >= remaining.length
      ? retired.filter((entry) => entry.objectIds.some((id) => droppedFinal.has(id)))
      : [],
    currentGroups: Array.from(new Set(context.temporary ? [] : actions.filter(isCreating).map((action) => groupOf(actionId(action), actionGroup(action))))),
  };
}

/**
 * The most recent pictures, enough of them to reach `wanted`.
 *
 * This used to be an all-or-nothing safety net for a completely emptied board, and being all-or-nothing is what
 * let a board sit at a single object for four steps: the trickle retired almost everything, one object
 * survived, the net did not fire, and nothing downstream could put the picture back. It now tops the board up
 * to a floor, oldest picture last, and always whole groups.
 */
function keepMostRecent(objects: readonly VisualObject[], wanted = 0): VisualObject[] {
  if (objects.length === 0) return [];
  const usable = objects.filter((object) => object.bornTemporary !== true && object.lifecycle !== "temporary");
  if (usable.length === 0) return [];
  const newestStage = usable.reduce((best, object) => Math.max(best, object.bornStage ?? -1), -1);
  const restored: VisualObject[] = [];
  for (let stage = newestStage; stage >= 0 && restored.length < wanted; stage -= 1) {
    restored.push(...usable.filter((object) => (object.bornStage ?? -1) === stage));
  }
  return restored;
}

/**
 * How much a single step may take off the board.
 *
 * Retirement is meant to be a steady trickle, not a purge. A stage jump — the plan moving from
 * `intuition` to `identify` in one batch — can put every object past its grace window at once, and a board
 * that loses twenty-seven items in one step is a board that flashes empty before it refills. A teacher
 * replaces a diagram, they do not clear a room.
 */
function retirementBudget(total: number): number {
  return Math.max(1, Math.ceil(total / 3));
}

/**
 * Applies the attention model.
 *
 * Objects that carry their own explicit opacity (a deliberately faded annotation) keep it; everything else
 * is scaled by its lifecycle, so "supporting" is quieter than "current" without either becoming
 * unreadable.
 */
export function applyAttention(object: VisualObject): VisualObject {
  const weight = VISUAL_PRIORITY[object.lifecycle ?? "current"];
  const base = object.dimmed ? object.opacity * 0.5 : object.opacity;
  return { ...object, opacity: round2(base * weight) };
}

const round2 = (value: number): number => Math.round(value * 100) / 100;

const CREATING = new Set([
  "create_shape", "create_text", "create_label", "create_icon", "create_arrow", "create_connector",
  "create_container", "write_formula", "create_code_block", "create_array", "update_array",
  "create_linked_list", "create_stack", "create_queue", "create_tree", "create_graph", "create_sequence",
  "create_pipeline", "create_timeline", "create_compare", "create_equation_block",
  "create_free_body_diagram", "create_circuit", "create_graph_plot",
]);

function isCreating(action: VisualAction): boolean {
  return CREATING.has(action.action);
}

function actionId(action: VisualAction): string {
  const id = (action as unknown as { id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

function actionGroup(action: VisualAction): string | undefined {
  const group = (action as unknown as { group?: unknown }).group;
  return typeof group === "string" ? group : undefined;
}

/**
 * Stamps the lifecycle metadata onto an object as it is created.
 *
 * Deliberately in the ENGINE rather than the gate: the engine is the only place that knows when an
 * object actually entered the scene, and every create path already passes through one helper.
 */
export function stampLifecycle(object: VisualObject, context: StepVisualContext): VisualObject {
  return {
    ...object,
    bornStep: context.step,
    bornStage: context.stage,
    group: groupOf(object.id, context.group),
    lifecycle: context.temporary ? "temporary" : "current",
    ...(context.temporary ? { bornTemporary: true } : {}),
  };
}

/**
 * Stamps every object that arrived during this application.
 *
 * The group comes from the ACTION that created the object, not from the step, because only the layout
 * compiler knows that `values-c0` and `values-frame` belong to one array. Reading it from the creating
 * action is what makes a structure retirable as a unit; guessing from the id cannot distinguish a
 * structure's own suffix from a name that happens to contain a dash.
 */
export function stampNewObjects(
  scene: VisualScene,
  context: StepVisualContext,
  actions: readonly VisualAction[] = [],
): VisualScene {
  if (context.step === undefined && context.stage === undefined && !context.temporary) return scene;
  const groupById = new Map<string, string | undefined>();
  for (const action of actions) {
    const record = action as unknown as { id?: unknown; group?: unknown };
    if (typeof record.id === "string") groupById.set(record.id, typeof record.group === "string" ? record.group : undefined);
  }
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (object.bornStep !== undefined) return object;
    changed = true;
    return stampLifecycle(object, { ...context, group: groupById.get(object.id) ?? context.group });
  });
  return changed ? { ...scene, objects } : scene;
}
