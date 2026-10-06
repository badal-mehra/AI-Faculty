"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_LABEL_FONT_SIZE = exports.MIN_LABEL_FONT_SIZE = exports.TYPE_WEIGHT = exports.TYPE_SCALE = exports.titleGap = exports.labelGap = exports.siblingGap = exports.space = exports.SPACE_TIERS = exports.SPACE = void 0;
exports.spacingScale = spacingScale;
exports.minimumFontSizeFor = minimumFontSizeFor;
exports.maximumFontSizeFor = maximumFontSizeFor;
const viewport_1 = require("./viewport");
exports.SPACE = {
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
};
exports.SPACE_TIERS = ["xs", "sm", "md", "lg", "xl", "xxl"];
/**
 * The gaps this board can afford.
 *
 * On a wide board the scale is used as written. On a tall or small one it is compressed, because a
 * structure that is 900px wide must not be laid out as if it had 1066: it would be scaled down to fit and
 * become microscopic, which is the failure the whole viewport change exists to remove. A compact board
 * compresses hardest, so a second structure drops to `context` and the first one keeps its room.
 */
function spacingScale(viewport) {
    const kind = (0, viewport_1.viewportKind)(viewport);
    const factor = kind === "compact" ? 0.7 : kind === "tall" ? 0.85 : kind === "narrow" ? 0.92 : 1;
    return {
        xs: Math.max(3, Math.round(exports.SPACE.xs * factor)),
        sm: Math.max(6, Math.round(exports.SPACE.sm * factor)),
        md: Math.max(10, Math.round(exports.SPACE.md * factor)),
        lg: Math.max(16, Math.round(exports.SPACE.lg * factor)),
        xl: Math.max(24, Math.round(exports.SPACE.xl * factor)),
        xxl: Math.max(34, Math.round(exports.SPACE.xxl * factor)),
    };
}
/** One gap of the given tier, already adapted to this board. */
const space = (viewport, tier) => spacingScale(viewport)[tier];
exports.space = space;
/** The gap between two objects that are siblings, which is the one a structure compiler asks for most. */
const siblingGap = (viewport) => (0, exports.space)(viewport, "md");
exports.siblingGap = siblingGap;
/** The gap between an object and the label that names it. Deliberately small: a label that drifts is a
 *  label the student has to hunt for, and proximity is what makes the relationship obvious. */
const labelGap = (viewport) => (0, exports.space)(viewport, "sm");
exports.labelGap = labelGap;
/** The gap from a structure's title to the structure itself. */
const titleGap = (viewport) => (0, exports.space)(viewport, "xl");
exports.titleGap = titleGap;
// ---- The type scale ---------------------------------------------------------------------------
/**
 * Roles carry the hierarchy, and the hierarchy is a SCALE, not a per-role constant.
 *
 * The renderer used to own the role -> size table, so the layout could not know how large a title would
 * paint and sized its own space against a guess. Both sides now read this table, which is why a title
 * always looks like a title on every subject and at every zoom level.
 */
exports.TYPE_SCALE = {
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
};
exports.TYPE_WEIGHT = {
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
};
/**
 * The SMALLEST type this board will use, derived from its size.
 *
 * A caption at 13px on a 1066px board is 13px. The same board unit on a 366px column would be 4.5px, which
 * is not a caption. Rather than let the scale decide, the type floor rises as the board shrinks, so a
 * narrow screen gets FEWER, LARGER objects instead of a shrunken version of the same board.
 */
function minimumFontSizeFor(viewport) {
    if ((0, viewport_1.isConstrained)(viewport))
        return 13;
    if (viewport.width < 520)
        return 12;
    if (viewport.width < 760)
        return 11;
    return exports.MIN_LABEL_FONT_SIZE;
}
/** A label is never drawn unreadably small, whatever the board. */
exports.MIN_LABEL_FONT_SIZE = 11;
/** …and never so large that it overflows a small shape or overpowers the composition. */
exports.MAX_LABEL_FONT_SIZE = 26;
/** The largest type this board will use, so a compact board never has a headline wider than it is. */
function maximumFontSizeFor(viewport) {
    const usable = Math.min(viewport.width, viewport.height);
    return Math.max(16, Math.min(exports.MAX_LABEL_FONT_SIZE, Math.round(usable / 18)));
}
