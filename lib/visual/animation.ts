// ANIMATION MUST NEVER CORRUPT A NEWER SCENE.
//
// PHASE 18, and this is the class of bug that is invisible in a screenshot and obvious in a classroom.
//
// The mechanism is `setTimeout` and CSS transitions, both of which are ASYNCHRONOUS and both of which can
// outlive the thing that started them:
//
//   * the student presses Next while step 4 is still animating -> step 4's pending transition resolves
//     against step 5's scene, and an object from the abandoned step slides into the new one;
//   * speech is interrupted mid-step -> the step is abandoned, but its timeouts are still armed;
//   * Replay re-applies the same step, and the already-pending timers fire a second time -> the object
//     animates from wherever it had got to, not from where it started, so the replay is not the lesson;
//   * Back then Next again -> the same action runs twice, and "Next must never duplicate existing
//     objects" holds only for the objects, not for the motion attached to them.
//
// The fix is not "cancel more carefully". It is that an animation CARRIES ITS OWN IDENTITY, and anything
// that mutates a scene checks the identity of the event first. An event from an older step cannot touch a
// newer scene, no matter how it was scheduled, how late it is, or how many times it fired.
import { teachesWith, type VisualMotion, type VisualScene } from "./types";

/** The four things that together identify one animation of one object in one step of one lesson. */
export type AnimationIdentity = {
  lessonId: string;
  stepId: string;
  visualTick: number;
  objectId: string;
};

/** What a caller must supply before any timed event is allowed to touch the scene. */
export type AnimationContext = AnimationIdentity & {
  scene: VisualScene;
};

export const identityOf = (motion: VisualMotion | undefined, objectId: string): AnimationIdentity | null => {
  if (!motion || motion.lessonId === undefined || motion.stepId === undefined || motion.visualTick === undefined) return null;
  return { lessonId: motion.lessonId, stepId: motion.stepId, visualTick: motion.visualTick, objectId: motion.objectId ?? objectId };
};

/**
 * Is this event still talking about the scene on screen?
 *
 * The comparison is deliberately strict. A mismatch on ANY of the four fields means the event belongs to a
 * step the student has already left, and applying it would put the old scene's objects into the new one.
 * Absent fields are treated as a mismatch rather than as a pass: an animation with no identity is an
 * animation we cannot prove is current, and an unprovable event must not mutate what the student is
 * reading.
 */
export function isCurrentAnimation(context: AnimationContext, motion: VisualMotion | undefined, objectId?: string): boolean {
  if (!motion) return false;
  if (motion.lessonId === undefined || motion.stepId === undefined || motion.visualTick === undefined) return false;
  if (motion.lessonId !== context.lessonId) return false;
  if (motion.stepId !== context.stepId) return false;
  if (motion.visualTick !== context.visualTick) return false;
  // The scene must still be on the tick the animation was started for, and must still HAVE the object.
  if (context.scene.tick !== context.visualTick) return false;
  if (objectId !== undefined && motion.objectId !== undefined && motion.objectId !== objectId) return false;
  return objectId === undefined || context.scene.objects.some((object) => object.id === objectId);
}

/**
 * Apply a timed mutation ONLY if it still belongs to this scene.
 *
 * Every deferred update in the classroom goes through here, which is the only way to make "old events
 * cannot mutate a newer scene" a property of the system rather than a thing each caller has to remember.
 */
export function applyIfCurrent<T>(context: AnimationContext, objectId: string, run: () => T): T | null {
  const object = context.scene.objects.find((entry) => entry.id === objectId);
  if (!isCurrentAnimation(context, object?.motion, objectId)) return null;
  return run();
}

/**
 * Is a step's motion a settled state rather than something in flight?
 *
 * Used by `settleVisualScene` to decide whether a step being interrupted should be left half-animated. A
 * step that is showing a CHANGE should be brought to its end state; a step that is only fading things in
 * can be dropped, because the end state is just "present".
 */
export function isSettled(motion: VisualMotion | undefined): boolean {
  if (!motion) return true;
  if (motion.fromX === undefined && motion.fromY === undefined) return !teachesWith(motion.kind);
  return false;
}

/**
 * The animations a scene still has in flight, and whether any of them is STALE.
 *
 * Stale means the animation belongs to a step that has already been replaced, which is a defect rather
 * than a state to settle: it is what the quality gate reports as `animationQualityScore` and what
 * `purgeStaleAnimations` removes.
 */
export function staleAnimations(scene: VisualScene, current: { stepId: string; visualTick: number; lessonId?: string }): VisualObjectId[] {
  return scene.objects
    .filter((object) => {
      const motion = object.motion;
      if (!motion || motion.lessonId === undefined || motion.stepId === undefined) return false;
      if (motion.stepId !== current.stepId) return true;
      if (motion.visualTick !== undefined && motion.visualTick !== current.visualTick) return true;
      return current.lessonId !== undefined && motion.lessonId !== current.lessonId;
    })
    .map((object) => object.id);
}

type VisualObjectId = string;

/**
 * Drop animations that belong to a step the student has left.
 *
 * Called when a step is applied and when a lesson is interrupted. Without it, a scene can carry a
 * `move_along_path` from three steps ago, and any component that reacts to `motion` will keep reacting to
 * it — which is the "stale animation state surviving into the next step" failure, and the reason a replay
 * of the same step could differ from the first time through.
 */
export function purgeStaleAnimations(scene: VisualScene, current: { stepId: string; visualTick: number; lessonId?: string }): VisualScene {
  const stale = new Set(staleAnimations(scene, current));
  if (stale.size === 0) return scene;
  return { ...scene, objects: scene.objects.map((object) => (stale.has(object.id) ? { ...object, motion: undefined } : object)) };
}

/**
 * Stamp an animation with its identity.
 *
 * Applied by the engine as it creates motion, so EVERY animation in the system carries one and the guard
 * above is a total function rather than a check that quietly passes for animations that forgot.
 */
export function stampIdentity(motion: VisualMotion, identity: AnimationIdentity): VisualMotion {
  return {
    ...motion,
    lessonId: motion.lessonId ?? identity.lessonId,
    stepId: motion.stepId ?? identity.stepId,
    visualTick: motion.visualTick ?? identity.visualTick,
    objectId: motion.objectId ?? identity.objectId,
  };
}

/** How much of a step's motion actually teaches, 0-1. The quality gate's `animationQualityScore` input. */
export function teachingRatio(objects: ReadonlyArray<{ motion?: VisualMotion }>): number {
  const moving = objects.filter((object) => object.motion);
  if (moving.length === 0) return 1;
  return moving.filter((object) => teachesWith(object.motion!.kind)).length / moving.length;
}
