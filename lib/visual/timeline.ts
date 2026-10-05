// Lightweight VISUAL TIMELINE.
//
// A teaching step owns an ordered list of visual actions. Because exact word-level
// synchronization is not available, timing is STEP-LEVEL: the classroom applies a step's
// actions when that step's speech starts, and this module only sequences actions *within* the
// step. `wait` and per-action `animate.delayMs` advance a cursor, so a step can express:
//
//   [create SYN packet, wait 200ms, animate SYN -> server]
//
// without any timers, and deterministically (same actions -> same start times).
import { MAX_ANIMATION_MS, VisualAction } from "./types";
import { clamp } from "./geometry";

export type TimedVisualAction = {
  action: VisualAction;
  startAtMs: number;
};

function actionDelay(action: VisualAction): number {
  return "animate" in action && action.animate ? (action.animate.delayMs ?? 0) : 0;
}

export function buildTimeline(actions: VisualAction[]): TimedVisualAction[] {
  let cursor = 0;
  return actions.map((action) => {
    const startAtMs = cursor + clamp(actionDelay(action), 0, MAX_ANIMATION_MS);
    // Only an explicit `wait` advances the cursor for subsequent actions.
    if (action.action === "wait") cursor += clamp(action.durationMs, 0, MAX_ANIMATION_MS);
    return { action, startAtMs };
  });
}

// Total duration of a step's visual timeline (used for diagnostics / future word-level sync).
export function timelineDuration(timeline: TimedVisualAction[]): number {
  return timeline.reduce((total, entry) => {
    const animation = "animate" in entry.action ? entry.action.animate : undefined;
    const duration = entry.action.action === "wait" ? entry.action.durationMs : (animation?.durationMs ?? 0);
    return Math.max(total, entry.startAtMs + clamp(duration, 0, MAX_ANIMATION_MS));
  }, 0);
}
