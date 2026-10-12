// SPACING AND TYPE SCALE — one authority for gaps and sizes.
//
// PHASE 8. A board is well spaced when the gaps between related things are visibly smaller than the gaps
// between unrelated things. Every near pair is measured against the tier their relationship implies, so
// "a label 4px from its object" and "two structures 6px apart" are both wrong, and for the same reason.
//
// The type scale is the other half: roles carry the hierarchy, and the hierarchy is a SCALE, not a
// per-role constant. The renderer used to own the role -> size table, so the layout could not know how
// large a title would paint and sized its own space against a guess. Both sides now read this table,
// which is why a title always looks like a title on every subject and at every zoom level.

import { VisualViewport, viewportKind, isConstrained } from "./viewport";

export const SPACE = {
  /** Inside one object: padding, the gap between a line and its shape's edge. */
  xs: 6,
  /** Inside one idea: an object's own label, a caption on its own axis. */
  sm: 12,
  /** Between siblings: two cells of one array, two stages of one pipeline. */
  md: 20,
  /** Between groups: two structures, a diagram and its explanation. */
  lg: 32,
  /** Between a title and the thing it titles, and around a composition's outer edge. */
  xl: 48,
  /** Between competing compositions, when more than one is genuinely on the board. */
  xxl: 72,
} as const;

export const SPACE_TIERS = ["xs", "sm", "md", "lg", "xl", "xxl"] as const;

/**
 * The gaps this board can afford.
 *
 * On a wide board the scale is used as written. On a tall or small one it is compressed, because a
 * structure that is 900px wide must not be laid out as if it had 1066: it would be scaled down to fit and
 * become microscopic, which is the failure the whole viewport change exists to remove. A compact board
 * compresses hardest, so a second structure drops to `context` and the first one keeps its room.
 */
export function spacingScale(viewport: VisualViewport): Record<keyof typeof SPACE, number> {
  const kind = viewportKind(viewport);
  const factor = kind === "compact" ? 0.7 : kind === "tall" ? 0.85 : kind === "narrow" ? 0.92 : 1;
  return {
    xs: Math.max(3, Math.round(SPACE.xs * factor)),
    sm: Math.max(6, Math.round(SPACE.sm * factor)),
    md: Math.max(10, Math.round(SPACE.md * factor)),
    lg: Math.max(16, Math.round(SPACE.lg * factor)),
    xl: Math.max(24, Math.round(SPACE.xl * factor)),
    xxl: Math.max(34, Math.round(SPACE.xxl * factor)),
  };
}

/** One gap of the given tier, already adapted to this board. */
export function space(viewport: VisualViewport, tier: keyof typeof SPACE): number {
  return spacingScale(viewport)[tier];
}

/** The gap between two objects that are siblings, which is the one a structure compiler asks for most. */
export function siblingGap(viewport: VisualViewport): number {
  return space(viewport, "md");
}

/** The gap between an object and the label that names it. Deliberately small: a label that drifts is a
 *  label the student has to hunt for, and proximity is what makes the relationship obvious. */
export function labelGap(viewport: VisualViewport): number {
  return space(viewport, "sm");
}

/** The gap from a structure's title to the structure itself. */
export function titleGap(viewport: VisualViewport): number {
  return space(viewport, "xl");
}

// ---- The type scale ---------------------------------------------------------------------------

export const TYPE_SCALE = {
  title: 22,
  subtitle: 17,
  step: 16,
  callout: 15,
  caption: 13,
  annotation: 13,
  secondary: 16,
  primary: 20,
  /** A shape's own label, when the model did not choose one. */
  body: 20,
  /** A value inside a cell: an array element, a stack entry, a tree node. */
  value: 20,
  /** A monospace index or a small marker. */
  index: 13,
  /** Free-standing text when nothing else applies. */
  body_text: 17,
  /** A formula, set large because a formula that cannot be read is not a formula. */
  formula: 21,
  /** A code listing. */
  code: 15,
} as const;

export const TYPE_WEIGHT = {
  title: 800,
  subtitle: 700,
  step: 700,
  callout: 700,
  caption: 600,
  annotation: 500,
  secondary: 600,
  primary: 700,
  body: 700,
  value: 600,
  index: 500,
  body_text: 600,
  formula: 700,
  code: 400,
} as const;

/**
 * The SMALLEST type this board will use, derived from its size.
 *
 * A caption at 13px on a 1066px board is 13px. The same board unit on a 366px column would be 4.5px, which
 * is not a caption. Rather than let the scale decide, the type floor rises as the board shrinks, so a
 * narrow screen gets FEWER, LARGER objects instead of a shrunken version of the same board.
 */
export function minimumFontSizeFor(viewport: VisualViewport): number {
  if (isConstrained(viewport)) return 13;
  if (viewport.width < 520) return 12;
  if (viewport.width < 760) return 11;
  return MIN_LABEL_FONT_SIZE;
}

/** A label is never drawn unreadably small, whatever the board. */
export const MIN_LABEL_FONT_SIZE = 11;

/** …and never so large that it overflows a small shape or overpowers the composition. */
export const MAX_LABEL_FONT_SIZE = 26;

/** The largest type this board will use, so a compact board never has a headline wider than it is. */
export function maximumFontSizeFor(viewport: VisualViewport): number {
  const usable = Math.min(viewport.width, viewport.height);
  return Math.max(16, Math.min(MAX_LABEL_FONT_SIZE, Math.round(usable / 18)));
}