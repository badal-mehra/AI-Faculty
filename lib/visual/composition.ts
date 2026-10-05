// CURRENT-STEP COMPOSITION — making the board show THIS moment rather than the lesson's memory.
//
// THE FAILURE THIS MEASURES. A real Newton's-second-law lesson grew to 58 objects, with 57 of them
// belonging to earlier steps, all drawn at comparable strength. Everything worked: the schema validated,
// every action applied, no asset was off-topic, and the student still could not look at the board for two
// seconds and say what was being explained. Each individual gate had answered "is this action legal?" and
// none of them was ever asked "is this board about now?".
//
// SO COMPOSITION IS A STAGE, NOT A FILTER. The order is fixed and each stage is independently testable:
//
//   generated step
//     -> semantic validation      (existing: the actions are well formed)
//     -> subject validation       (existing: this representation belongs to this domain)
//     -> lifecycle classification (existing: what is current, supporting, context, temporary)
//     -> current focus            (what this step is actually about)
//     -> visible-object selection (a budget, decided by viewport and complexity)
//     -> retire obsolete/supporting objects
//     -> layout + collision resolution
//     -> focus/readability assessment
//     -> render
//
// THE BUDGET IS A HARD CONSTRAINT, NOT A TARGET. Objects are never shrunk to fit and never hidden: a
// structure that no longer fits is RETIRED, which is what a teacher does with a whiteboard. Retiring by
// group matters here for the same reason it does in the lifecycle: a structure compiles into dozens of
// primitives, and a composition that could only retire individual objects could never retire a diagram.
//
// REPAIR IS BOUNDED AT TWO PASSES, and deliberately so. Each pass re-runs the layout and the semantic
// optimiser on what remains, so a third pass would keep re-arranging a board that has already been asked
// twice, and "it looks tidy" would become a reason to never retire anything. Two passes is enough to
// separate a pile of overlapping boxes; anything still wrong after that is a composition problem the
// student should see rather than have hidden behind an unbounded loop.
//
// NOTHING HERE IMPORTS THE TEACHING LAYER. The subject policy arrives as data (`CompositionPolicy`), because
// `lib/teaching` already imports this package and a runtime import in the other direction would make the
// dependency cycle that both files exist to avoid.
import { DIAGRAM_HEIGHT, DIAGRAM_WIDTH, MIN_BOARD_OBJECTS, VISUAL_PRIORITY } from "./types";
import type { VisualAction, VisualLifecycle, VisualObject, VisualScene } from "./types";
import { groupOf, referencedIds, type Retirement } from "./lifecycle";
import { assessScene, optimiseScene, attentionWeight } from "./semantics";
import { resolveSceneOverlaps, settleVisualScene } from "./engine";
import { VIEWPORT, boxOfObject, boxesOverlap } from "./geometry";

/**
 * The subject's representation policy, as DATA.
 *
 * `lib/teaching/visualPolicy.ts` builds one of these from the resolved domain; the visual layer never needs
 * to know how it was decided, only what it permits.
 */
export type CompositionPolicy = {
  domain: string;
  coarse: string;
  allowCode: boolean;
  structures: ReadonlySet<string>;
  /**
   * Every action that IS a semantic structure, across all domains.
   *
   * Without this the foreign count is a count of everything the policy does not name, which includes `move`,
   * `highlight` and every primitive — a first real run reported "foreign 2" for a calculus lesson that had
   * drawn a rectangle and nudged it. Only a structure can be foreign to a subject, so only a structure counts.
   */
  structureActions?: ReadonlySet<string>;
};

export type CompositionInput = {
  /** The coarse subject, for the log line. */
  subject?: string;
  /** The teaching domain, for the log line. */
  domain?: string;
  /** The subdomain, for the log line. */
  subdomain?: string;
  /** The step's teaching act, for the log line. */
  teachingIntent?: string;
  /** The lesson step being applied. */
  step?: number;
  /** Index of the objective stage being taught. */
  stage?: number;
  /** True when this step answers an interruption rather than advancing the lesson. */
  temporary?: boolean;
  /** The stage the composition is being planned for. */
  viewport?: "narrow" | "wide";
  /** The policy this composition is enforcing, when the caller has one. */
  policy?: CompositionPolicy;
  /** Overrides the computed budget. Used by tests to make the pressure explicit. */
  budget?: number;
  /** How many repair passes to run. Capped at two whatever this says. */
  repairPasses?: number;
};

/**
 * What one composed step reports. The field names are the log contract for `[teaching:composition]`.
 *
 * `visibleObjectCount` against `retiredObjectCount` is the pair that matters: a board that keeps growing
 * is visible in a single number, and a composition that retires nothing is wrong even when nothing overlaps.
 */
export type CompositionDiagnostics = {
  subject: string;
  subdomain: string;
  teachingIntent: string;
  /** Ids this step is about, after selection. */
  currentFocusIds: string[];
  visibleObjectCount: number;
  retiredObjectCount: number;
  supportingObjectCount: number;
  contextObjectCount: number;
  /**
   * How many of the visible objects this step is actually about — the ones it drew plus the ones its actions
   * point at.
   *
   * This exists to separate two very different zeros. A share near 0 with objects on the board means the board
   * drifted off the step. A share near 0 with `focusedObjectCount` also 0 means the step added nothing and the
   * previous picture was deliberately kept — a step that only speaks, or that only dims what is already there,
   * and which must not be reported as a student left hunting.
   */
  focusedObjectCount: number;
  /**
   * 0-100: how much of the board is what is being taught right now.
   *
   * This is the focused share, not the semantic gate's focus dimension. The two disagreed, and the semantic one
   * was the misleading half: it scored 0 for a step that spent its turn explaining the diagram already on the
   * screen, which is not a lost student, it is a teacher doing the most ordinary thing there is to do. Every
   * consumer of this number — the log line, the router's provider summary, the acceptance run — is asking "how
   * much of the board is about now", so this is the number that answers that question.
   */
  visualFocusScore: number;
  /** 0-100: how crowded the board is, before repair. */
  densityScore: number;
  /** Overlapping pairs left after layout and repair. */
  overlapCount: number;
  /** Representations this step issued that the subject policy does not permit. */
  foreignRepresentationCount: number;
};

export type CompositionResult = {
  scene: VisualScene;
  /** The actions this composition is responsible for, in order. */
  actions: VisualAction[];
  /** Groups removed to fit the budget, with why. */
  retired: Retirement[];
  diagnostics: CompositionDiagnostics;
  /** How many repair passes actually ran. Never more than two. */
  repairPasses: number;
};

/** The hard cap on repair passes. A board that needs a third pass needs a retirement, not a re-layout. */
export const MAX_REPAIR_PASSES = 2;

// -------------------------------------------------------------------------------------- The budget

/**
 * HOW MANY OBJECTS FIT, decided from the board itself rather than a constant.
 *
 * A single large diagram needs far fewer objects than a lesson that accumulates small labels, so the budget
 * is measured against usable area and the average size of what is actually on screen. It is deliberately
 * generous for a nearly empty board: the cost of a wrong budget is a diagram that got retired while there
 * was still room for it.
 */
export function visualBudget(scene: VisualScene, viewport: "narrow" | "wide" = "wide"): number {
  const width = VIEWPORT.width * (viewport === "narrow" ? 0.62 : 1);
  const height = VIEWPORT.height * (viewport === "narrow" ? 0.7 : 1);
  const usable = Math.max(1, (width - VIEWPORT.margin * 2) * (height - VIEWPORT.margin * 2));
  const objects = scene.objects;
  if (objects.length === 0) return viewport === "narrow" ? 22 : 34;
  const meanArea = objects.reduce((total, object) => total + object.width * object.height, 0) / objects.length;
  // Each object needs its own box plus breathing room, and the board should be at most ~65% covered.
  const fits = Math.floor((usable * 0.65) / Math.max(1200, meanArea));
  const ceiling = viewport === "narrow" ? 26 : 40;
  return Math.max(10, Math.min(ceiling, fits));
}

// ---------------------------------------------------------------------------- Selection and retirement

const LIFECYCLE_ORDER: Record<VisualLifecycle, number> = {
  current: 0, temporary: 1, supporting: 2, context: 3, completed: 4, obsolete: 5,
};

/** The order objects are kept in: what is being taught now, then what explains it, then old context. */
function keepRank(object: VisualObject): number {
  const lifecycle = object.lifecycle ?? "current";
  // Newer first inside a lifecycle, so two equally relevant diagrams keep the later one.
  return LIFECYCLE_ORDER[lifecycle] * 1000 - (object.bornStage ?? 0);
}

/**
 * How much of a composed board must be what the current step is teaching.
 *
 * A budget alone is not enough. A step that draws four objects while twenty older ones sit inside the grace
 * window is inside its budget and still unreadable: the student sees a stage, not a step. So the share of
 * the board that belongs to this step is a SECOND constraint, applied after the budget, and it can retire
 * groups the budget would have allowed. It never retires the current objects themselves.
 */
export const MIN_CURRENT_SHARE = 0.34;

/**
 * The share below which the grace window itself may be broken.
 *
 * Most of the time composition only retires what the lifecycle already demoted to `context`. But a step that
 * draws three objects beside twenty that are all still "supporting" produces a board where the past is the
 * subject, and a rule that refuses to act in that case is not protecting the student, it is protecting the
 * bookkeeping. So below this floor, supporting groups may go too — oldest first, and never the current step.
 */
export const HARD_CURRENT_SHARE = 0.2;

/**
 * The fewest objects a composition will leave a board with, whatever the arithmetic says.
 *
 * The focus floor above is relative — it is the size of the structure being talked about, which for a step
 * that added one label is one object. That is enough to satisfy every ratio and not enough to teach with: a
 * real Newton's-law run retired a thirteen-object board down to a single box, and the semantic gate then
 * correctly reported that the board was nearly empty while a step was being taught. Three is the smallest
 * board on which a shape, its label and the arrow between them can exist, so below that there is nothing left
 * to retire — the student needs the picture more than the ratio needs to be satisfied.
 *
 * The value lives in `types.ts` because the lifecycle retires before this stage runs, and this floor has to
 * mean the same number on both sides of that boundary.
 */
export const MIN_VISIBLE_OBJECTS = MIN_BOARD_OBJECTS;

/**
 * Selects what stays on screen, and retires the rest BY GROUP.
 *
 * Retirement is additive to the lifecycle's own decisions: this runs on what the lifecycle already marked
 * supporting, and removes the oldest of those groups until the board fits AND is mostly about this step.
 * Anything the current step points at is never retired, however old it is — a formula the teacher is still
 * using is not stale.
 */
export function selectVisibleObjects(
  scene: VisualScene,
  budget: number,
  keep: ReadonlySet<string>,
  minCurrentShare = MIN_CURRENT_SHARE,
): { kept: VisualObject[]; retired: Retirement[] } {
  const objects = scene.objects;
  const overBudget = objects.length > budget;

  const ranked = [...objects].sort((a, b) => keepRank(a) - keepRank(b));
  const survivors = new Set<string>();
  // The budget counts OBJECTS, not groups. Filling the survivor set by group until it reached the budget
  // kept every group whose total size happened to land under it, which is how a board of six four-object
  // structures sat at twenty-four objects under a budget of twelve and reported nothing retired: the
  // removal then happened inside the semantic repair pass instead, invisible in the diagnostics.
  const groupSize = new Map<string, number>();
  for (const object of objects) {
    const group = groupOf(object.id, object.group);
    groupSize.set(group, (groupSize.get(group) ?? 0) + 1);
  }
  if (overBudget) {
    let keptBySurvivors = 0;
    for (const object of ranked) {
      const group = groupOf(object.id, object.group);
      if (survivors.has(group)) continue;
      if (keptBySurvivors >= budget) break;
      survivors.add(group);
      keptBySurvivors += groupSize.get(group) ?? 1;
    }
  } else {
    // Under budget, every group is a candidate — and the share constraint below still applies, because a
    // step that draws four objects beside twenty older ones is inside its budget and still unreadable.
    for (const object of objects) survivors.add(groupOf(object.id, object.group));
  }

  // SECOND CONSTRAINT: the board must also be mostly about this step. Only groups the LIFECYCLE has already
  // demoted to `context` may go — supporting objects are inside the grace window, which exists precisely so
  // a diagram the student is still using survives the step that followed it. Applying the share rule to
  // supporting objects too would let a four-object step delete the diagram the teacher is still talking
  // about, which is the same class of bug this whole file exists to remove.
  // WHAT THIS STEP IS ABOUT IS NOT THE SAME AS WHAT IT DREW.
  //
  // The lifecycle demotes a referenced object to `supporting` — a correct decision for RETIREMENT, because
  // something the teacher is pointing at must never be taken off the board. But using the lifecycle's
  // `current` count as the focus measure produced the opposite verdict on a real lesson: a step that
  // highlighted six nodes of a force diagram and spoke about them was scored as owning NOTHING, because it
  // had not created them, and composition was then free to retire the very diagram being explained. The two
  // questions need different inputs, and conflating them is what let that happen.
  //
  // So focus is "born here or addressed here": the objects this step created, plus the ones its actions
  // point at. A step that draws one object beside fifty stale ones still measures ~0, which is the case the
  // rule exists for. A step that explains the diagram in front of it measures ~1, which is the truth.
  const protectedIds = new Set(objects.filter((object) => keep.has(object.id) || object.lifecycle === "current" || object.lifecycle === "temporary").map((object) => object.id));
  // Focus uses the same rule as `currentFocusIds`: a structure the step points at is focus in full, because a
  // structure the step is halfway through explaining is not "one addressed object with five bystanders".
  const referencedGroups = new Set(objects.filter((object) => keep.has(object.id)).map((object) => groupOf(object.id, object.group)));
  const focusedIds = new Set(objects.filter((object) => protectedIds.has(object.id) || referencedGroups.has(groupOf(object.id, object.group))).map((object) => object.id));
  const candidate = objects.filter((object) => survivors.has(groupOf(object.id, object.group)) || protectedIds.has(object.id));
  const focusedCount = candidate.filter((object) => protectedIds.has(object.id)).length;
  // A SHARE OF NOTHING IS NOT A SMALL SHARE — IT IS NO SHARE AT ALL.
  //
  // This constraint only exists to stop the board drifting off the step, and it is enforced by removing the
  // oldest context. When a step contributes no current objects at all — it only speaks, or only dims and
  // points at what is already there — no amount of removing context can make the board "mostly about" it,
  // so the loop below ran to the end of its list and retired everything. That is the failure this whole file
  // exists to prevent, arrived at through the fix for it: a step that said one sentence erased the diagram
  // the teacher was still using, and a first real run showed a lesson blanking mid-explanation.
  //
  // So with nothing current the board is kept whole, and only the budget may retire from it. "Keep the last
  // picture" is what the lifecycle already decided; this stage is not entitled to disagree just because it
  // could not find a current object to point at.
  const shareApplies = focusedCount > 0;
  // The board is never stripped below the thing being talked about.
  //
  // Whole-group retirement overshoots by construction, because one drop removes a whole structure at once. With
  // one addressed object on a twenty-object board, the ratio misses the floor, the next group of five goes, and
  // the board is left holding a single box — the teacher says "look at this part of the diagram" and the
  // diagram vanishes, which serves the ratio and fails the student. The floor is the size of the structure the
  // focus lives in, and at least MIN_VISIBLE_OBJECTS: that structure is readable on its own, so a composition
  // that cannot say more than that keeps it and stops.
  const focusGroups = new Set(objects.filter((object) => focusedIds.has(object.id)).map((object) => groupOf(object.id, object.group)));
  const focusFloor = [...groupSize.entries()].reduce((total, [group, size]) => total + (focusGroups.has(group) ? size : 0), 0);
  const dropWholeGroupsUntil = (shareFloor: number, allowSupporting: boolean): VisualObject[] => {
    let visibleObjects = [...candidate];
    const droppable = [...candidate]
      .filter((object) => survivors.has(groupOf(object.id, object.group))
        && !protectedIds.has(object.id)
        && (allowSupporting || (object.lifecycle !== undefined && object.lifecycle !== "supporting")))
      .sort((a, b) => keepRank(b) - keepRank(a));
    let dropFrom = 0;
    while (visibleObjects.length > 0 && dropFrom < droppable.length) {
      if (focusedCount / visibleObjects.length >= shareFloor) break;
      // THE FLOOR IS CHECKED AGAINST THE RESULT OF THIS DROP, not against the board as it stands.
      //
      // Testing `length - focusFloor > 0` before removing a whole group is off by exactly the size of that
      // group: a board of seven with a floor of three passes the check and then loses a six-object structure,
      // landing on one. That is how a real Newton's-law run emptied its board to a single box while every
      // ratio it was enforcing reported success. The question is not "is there room to drop" but "is there
      // room to drop THIS and still have a board".
      const group = groupOf(droppable[dropFrom]!.id, droppable[dropFrom]!.group);
      const size = visibleObjects.filter((object) => groupOf(object.id, object.group) === group).length;
      // The floor is a floor on the board as it stands, not on the result of this particular drop.
      //
      // This was tried the stricter way — refusing any drop that would leave less than the floor — and it
      // satisfied the floor by refusing to do its job: shares fell to an eighth of the board being about the
      // current step, which is the drift the stage exists to remove. The hard share is the stated guarantee
      // and the floor is a guard against the extreme, so where the two disagree the guarantee wins and the
      // board is allowed to get small. One small board is a cosmetic problem; a board about nothing is a
      // teaching one. Retirement still happens a whole group at a time, so what is left is always a readable
      // structure rather than a scatter of fragments.
      if (visibleObjects.length - focusFloor <= 0) break;
      visibleObjects = visibleObjects.filter((object) => groupOf(object.id, object.group) !== group);
      dropFrom += size;
    }
    return visibleObjects;
  };
  let visible = shareApplies ? dropWholeGroupsUntil(minCurrentShare, false) : [...candidate];
  if (shareApplies && visible.length > 0 && focusedCount / visible.length < HARD_CURRENT_SHARE) {
    visible = dropWholeGroupsUntil(HARD_CURRENT_SHARE, true);
  }
  survivors.clear();
  for (const object of visible) survivors.add(groupOf(object.id, object.group));

  const retiredByGroup = new Map<string, Retirement>();
  const kept: VisualObject[] = [];
  for (const object of objects) {
    const group = groupOf(object.id, object.group);
    const retained = survivors.has(group);
    // The current step's own objects and anything it references are kept whatever the budget says.
    const protectedObject = keep.has(object.id) || object.lifecycle === "current" || object.lifecycle === "temporary";
    if (retained || protectedObject) {
      kept.push(object);
      continue;
    }
    const entry = retiredByGroup.get(group) ?? {
      group,
      lifecycle: object.lifecycle ?? "supporting",
      bornStep: object.bornStep ?? -1,
      stagesOld: 0,
      objectIds: [],
    };
    entry.objectIds.push(object.id);
    retiredByGroup.set(group, entry);
  }

  // A group can be over budget on its own — one diagram with forty primitives. Then the group itself is
  // trimmed, oldest first, because leaving it whole would break the budget the composition exists to enforce.
  let overflow = kept.length - budget;
  if (overflow > 0) {
    const removable = kept
      .filter((object) => !keep.has(object.id) && object.lifecycle !== "current" && object.lifecycle !== "temporary")
      .sort((a, b) => keepRank(b) - keepRank(a));
    const remove = new Set<string>();
    for (const object of removable) {
      if (overflow <= 0) break;
      remove.add(object.id);
      overflow -= 1;
    }
    if (remove.size > 0) {
      for (const object of removable) {
        if (!remove.has(object.id)) continue;
        const group = groupOf(object.id, object.group);
        const entry = retiredByGroup.get(group) ?? {
          group,
          lifecycle: object.lifecycle ?? "supporting",
          bornStep: object.bornStep ?? -1,
          stagesOld: 0,
          objectIds: [],
        };
        entry.objectIds.push(object.id);
        retiredByGroup.set(group, entry);
      }
      const finalKept = kept.filter((object) => !remove.has(object.id));
      return { kept: finalKept, retired: [...retiredByGroup.values()] };
    }
  }

  return { kept, retired: [...retiredByGroup.values()] };
}

// ------------------------------------------------------------------------------- Focus and diagnostics

/**
 * Ids this step is about: what it created, plus what it explicitly points at — and a pointed-at structure
 * counts WHOLE.
 *
 * The last clause is the difference between "the step owns one of these six boxes" and "the step is talking
 * about this comparison". A teacher who says "look at the left side here" is not raising the share by one
 * object; the entire comparison is what the sentence is about, and it is unreadable if half of it is retired.
 * Counting only the named object also made the focus floor and the hard share unsatisfiable together — the
 * floor insisted on keeping a six-object structure while the share insisted on a board of five — and the only
 * resolutions available were to break one requirement or strip the board to a single box.
 */
export function currentFocusIds(scene: VisualScene, actions: readonly VisualAction[], step?: number): string[] {
  const referenced = referencedIds(actions);
  const referencedGroups = new Set(
    scene.objects.filter((object) => referenced.has(object.id)).map((object) => groupOf(object.id, object.group)),
  );
  return scene.objects
    .filter((object) => (step !== undefined && object.bornStep === step)
      || object.lifecycle === "current"
      || ((referenced.has(object.id) || referencedGroups.has(groupOf(object.id, object.group))) && object.lifecycle !== "completed"))
    .map((object) => object.id);
}

/** Overlapping pairs that the layout still leaves, measured the same way the semantic gate measures them. */
export function overlapCount(scene: VisualScene): number {
  const solids = scene.objects.filter((object) => object.kind === "shape" || object.kind === "text" || object.kind === "formula");
  let count = 0;
  for (let a = 0; a < solids.length; a += 1) {
    for (let b = a + 1; b < solids.length; b += 1) {
      if (boxesOverlap(boxOfObject(solids[a]!), boxOfObject(solids[b]!), -4)) count += 1;
    }
  }
  return count;
}

/** 0-100: how crowded the board is, measured as coverage of the usable area. */
export function densityScore(scene: VisualScene): number {
  const usable = VIEWPORT.width * VIEWPORT.height;
  const covered = scene.objects.reduce((total, object) => total + object.width * object.height, 0);
  return Math.round(Math.min(100, (covered / usable) * 220));
}

/** Representations in `actions` that the policy does not permit. */
export function foreignRepresentationCount(policy: CompositionPolicy | undefined, actions: readonly VisualAction[]): number {
  if (!policy) return 0;
  const foreign = new Set<string>();
  for (const action of actions) {
    if (action.action === "update_array" || action.action === "set_code_pointer") continue;
    if (policy.structures.has(action.action)) continue;
    if (action.action === "create_code_block" && policy.allowCode) continue;
    // Not a structure: a primitive, a placement, an animation or a mutator. Those are how any subject is drawn.
    if (policy.structureActions && !policy.structureActions.has(action.action)) continue;
    foreign.add(action.action);
  }
  return foreign.size;
}

// ----------------------------------------------------------------------------------- The composition

/**
 * Composes one step into a board that shows this moment.
 *
 * The scene passed in is expected to be the scene AFTER the lifecycle has run (see `applyLifecycle`), so
 * composition only has to answer the two questions lifecycle does not: how much may be on screen, and is
 * what remains actually readable and about what is being taught.
 */
export function composeScene(
  scene: VisualScene,
  actions: readonly VisualAction[],
  input: CompositionInput = {},
): CompositionResult {
  const referenced = referencedIds(actions);
  const keep = new Set<string>([...referenced, ...currentFocusIds(scene, actions, input.step)]);
  const budget = input.budget ?? visualBudget(scene, input.viewport ?? "wide");

  const selected = selectVisibleObjects(scene, budget, keep);
  let working: VisualScene = { ...scene, objects: selected.kept };

  // Layout and collision resolution. `settleVisualScene` is the engine's own final pass, so composition
  // cannot leave a scene the renderer would have had to correct itself.
  working = settleVisualScene(resolveSceneOverlaps(working));

  /**
   * BOUNDED FOCUS REPAIR.
   *
   * Each pass re-runs the semantic optimiser (which merges duplicates and clears anything the step does not
   * need) and the layout, then stops if the board stops improving. Two passes maximum: the reason repair
   * exists is to rescue a crowded board, not to keep re-arranging a good one forever.
   */
  const requested = Math.max(0, Math.min(MAX_REPAIR_PASSES, input.repairPasses ?? MAX_REPAIR_PASSES));
  let passes = 0;
  let bestQuality = assessScene(working, {
    ...(input.step !== undefined ? { step: input.step } : {}),
    ...(input.teachingIntent ? { intent: input.teachingIntent } : {}),
    referenced,
  });
  const smallestAcceptable = Math.min(working.objects.length, MIN_VISIBLE_OBJECTS);
  for (let pass = 0; pass < requested; pass += 1) {
    const optimised = optimiseScene(working, {
      ...(input.step !== undefined ? { step: input.step } : {}),
      ...(input.teachingIntent ? { intent: input.teachingIntent } : {}),
      referenced,
    });
    const candidate = settleVisualScene(resolveSceneOverlaps(optimised.scene));
    const quality = assessScene(candidate, {
      ...(input.step !== undefined ? { step: input.step } : {}),
      ...(input.teachingIntent ? { intent: input.teachingIntent } : {}),
      referenced,
    });
    passes += 1;
    // A REPAIR MAY NOT EMPTY THE BOARD, however much it improves the score.
    //
    // The repair pass exists to tidy a crowded board, and it removes what it judges unnecessary — which is
    // sound until the step it is judging against is a step that only spoke. Then "unnecessary" is the entire
    // lesson so far, the score improves precisely because nothing is left to be unclear about, and the student
    // is shown an empty stage at the exact moment a real run reported one. This is the same blind spot the
    // selection rule above was fixed for, reached through the repair pass instead of the retirement pass, so
    // it gets the same guard: a candidate that destroys the board is not a better board.
    if (candidate.objects.length < smallestAcceptable) break;
    if (quality.score <= bestQuality.score) break;
    working = candidate;
    bestQuality = quality;
  }

  const finalObjects = working.objects;
  const count = (lifecycle: VisualLifecycle): number => finalObjects.filter((object) => object.lifecycle === lifecycle).length;
  const focusIds = currentFocusIds(working, actions, input.step);
  const focusedObjectCount = focusIds.filter((id) => finalObjects.some((object) => object.id === id)).length;
  const visualFocusScore = finalObjects.length === 0 ? 0 : Math.round((focusedObjectCount / finalObjects.length) * 100);
  const diagnostics: CompositionDiagnostics = {
    subject: input.subject ?? input.policy?.coarse ?? "general",
    subdomain: input.subdomain ?? input.policy?.domain ?? "general-academic",
    teachingIntent: input.teachingIntent ?? "unspecified",
    currentFocusIds: focusIds,
    visibleObjectCount: finalObjects.length,
    retiredObjectCount: selected.retired.reduce((total, entry) => total + entry.objectIds.length, 0),
    supportingObjectCount: count("supporting"),
    contextObjectCount: count("context"),
    focusedObjectCount,
    visualFocusScore,
    densityScore: densityScore(working),
    overlapCount: overlapCount(working),
    foreignRepresentationCount: foreignRepresentationCount(input.policy, actions),
  };

  return { scene: working, actions: [...actions], retired: selected.retired, diagnostics, repairPasses: passes };
}

/** The one-line log the composition is required to emit, in a stable field order. */
export function compositionLogLine(diagnostics: CompositionDiagnostics): string {
  return "[teaching:composition]"
    + ` subject=${diagnostics.subject}`
    + ` subdomain=${diagnostics.subdomain}`
    + ` teachingIntent=${diagnostics.teachingIntent}`
    + ` currentFocusIds=${diagnostics.currentFocusIds.length ? diagnostics.currentFocusIds.join("|") : "none"}`
    + ` visibleObjectCount=${diagnostics.visibleObjectCount}`
    + ` retiredObjectCount=${diagnostics.retiredObjectCount}`
    + ` supportingObjectCount=${diagnostics.supportingObjectCount}`
    + ` contextObjectCount=${diagnostics.contextObjectCount}`
    + ` focusedObjectCount=${diagnostics.focusedObjectCount}`
    + ` visualFocusScore=${diagnostics.visualFocusScore}`
    + ` densityScore=${diagnostics.densityScore}`
    + ` overlapCount=${diagnostics.overlapCount}`
    + ` foreignRepresentationCount=${diagnostics.foreignRepresentationCount}`;
}

/** How loud an object should be, so the caller can apply the attention model without importing lifecycle. */
export const compositionPriority: Record<VisualLifecycle, number> = VISUAL_PRIORITY;

/** The board's own geometry, exposed so callers do not re-derive the viewport from the constants. */
export const COMPOSITION_VIEWPORT = { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT };

/** Attention weight for one object, shared with the semantic repair pass so the two cannot disagree. */
export { attentionWeight };