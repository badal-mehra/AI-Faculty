// LIGHTWEIGHT 3D VISUAL TIMELINE.
//
// Mirrors lib/visual/timeline.ts: a teaching step owns an ordered list of visual3d actions. Because
// exact word-level synchronization is not available, timing is STEP-LEVEL. `wait` and per-action
// delays advance a cursor so a step can express:
//
//   [create planet, wait 300ms, animate_flow earth -> sun, ...]
//
// without any timers, and deterministically (same actions -> same start times).
import { MAX_ANIMATION_MS, Visual3DAction } from "./types";
import type { TimedVisual3DAction } from "./types";

export function action3DDelay(action: Visual3DAction): number {
  if ("animate" in action && action.animate) {
    return typeof action.animate.delayMs === "number" ? action.animate.delayMs : 0;
  }
  return 0;
}

function clampDelay(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_ANIMATION_MS, Math.max(0, value));
}

export function buildTimeline(actions: Visual3DAction[]): TimedVisual3DAction[] {
  let cursor = 0;
  return actions.map((action) => {
    const startAtMs = cursor + clampDelay(action3DDelay(action));
    if (action.action === "wait") {
      cursor += Math.min(MAX_ANIMATION_MS, Math.max(0, action.durationMs));
    }
    return { action, startAtMs };
  });
}

export function timelineDuration(timeline: TimedVisual3DAction[]): number {
  return timeline.reduce((total, entry) => {
    if (entry.action.action === "wait") {
      return Math.max(total, entry.startAtMs + Math.min(MAX_ANIMATION_MS, Math.max(0, entry.action.durationMs)));
    }
    const anim = "animate" in entry.action && entry.action.animate ? entry.action.animate : undefined;
    const duration = anim ? (typeof anim.durationMs === "number" ? anim.durationMs : 0) : 0;
    return Math.max(total, entry.startAtMs + Math.min(MAX_ANIMATION_MS, Math.max(0, duration)));
  }, 0);
}
