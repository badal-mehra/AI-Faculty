"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.viewportRect = exports.itemsPerColumn = exports.itemsPerRow = exports.isConstrained = exports.contentCenterY = exports.contentCenterX = exports.MAX_MEASURED_VIEWPORT = exports.MIN_MEASURED_VIEWPORT = exports.sameViewport = exports.canonicalViewport = exports.CANONICAL_VIEWPORT = void 0;
exports.isRealMeasurement = isRealMeasurement;
exports.viewportFromStage = viewportFromStage;
exports.viewportMargin = viewportMargin;
exports.contentBox = contentBox;
exports.viewportKind = viewportKind;
// THE BOARD'S REAL AVAILABLE AREA.
//
// PHASE 12: LAYOUT MUST USE THE ACTUAL BOARD, NOT A CANONICAL 800x520.
//
// The board was laid out against a fixed 800x520 authoring canvas and then the renderer scaled whatever
// came out into whatever the element happened to measure. That single indirection is the root cause of
// three separate reported failures:
//
//   * TEXT BECOMING TOO SMALL.   A 13px annotation on an 800-wide canvas, shown in a 366px phone column,
//                                 is painted at 13 * (366/800) = 6px. The layout had done its job — it
//                                 chose a readable size — and the renderer then threw it away.
//   * TINY UNREADABLE DIAGRAMS.  The same scale-down, applied to a whole board.
//   * EXCESSIVE EMPTY SPACE.     A 620-wide drawing framed inside an 1040-wide frame, on every screen,
//                                 because the frame floor is in board units and the board is a different
//                                 pixel width on every display.
//
// So the viewport is no longer a constant. It is a VALUE, carried on the scene, and one board unit is one
// CSS pixel: the renderer frames exactly the rectangle the layout filled, so a font size the layout
// chose is the font size the student reads.
//
//   canvas 1066 x 610  ->  layout fills 1066 x 610  ->  viewBox "0 0 1066 610"  ->  1:1, no scaling
//
// CanonicalViewport stays the fallback for the places that have no DOM to measure — SSR, unit tests, and
// the first paint before a ResizeObserver has reported — so the whole pipeline stays deterministic.
const types_1 = require("./types");
exports.CANONICAL_VIEWPORT = {
    width: types_1.DIAGRAM_WIDTH,
    height: types_1.DIAGRAM_HEIGHT,
    margin: types_1.VISUAL_MARGIN,
};
const canonicalViewport = () => ({ ...exports.CANONICAL_VIEWPORT });
exports.canonicalViewport = canonicalViewport;
const sameViewport = (a, b) => Boolean(a) && Boolean(b)
    && a.width === b.width
    && a.height === b.height
    && a.margin === b.margin;
exports.sameViewport = sameViewport;
/**
 * Below this the board is not a board, and laying out into it produces a diagram the student cannot read.
 * The renderer reports a degenerate 0x0 on first paint and on a hidden tab; a phone in a stack is short.
 * Anything smaller is treated as "not measured yet" and the canonical canvas is used until it is real.
 */
exports.MIN_MEASURED_VIEWPORT = { width: 240, height: 200 };
/**
 * Is this a REAL measurement, or the browser's first useless one?
 *
 * PHASE 12, and this distinction is the whole reason a board can be composed for 800x520 and painted into
 * 986x641. A `ResizeObserver` fires once before layout settles, and on a page that is still mounting the
 * element can be tiny — and `viewportFromStage` answers a degenerate measurement with the canonical canvas.
 * That answer is indistinguishable from a genuine one, so a consumer that takes the first reading composes
 * its whole lesson for 800x520 and never knows the real size arrived.
 *
 * So "not measured yet" and "measured as 800x520" are kept apart: the renderer publishes only a real
 * measurement, and a consumer that needs the board before it can teach waits. The fallback still exists
 * for SSR and for the first paint, where there is nothing to measure and something must be assumed.
 */
function isRealMeasurement(width, height) {
    return Number.isFinite(width) && Number.isFinite(height)
        && width >= exports.MIN_MEASURED_VIEWPORT.width && height >= exports.MIN_MEASURED_VIEWPORT.height;
}
/** Above this the drawing stops growing and the extra room is left as margin, which is what a whiteboard does. */
exports.MAX_MEASURED_VIEWPORT = { width: 2200, height: 1500 };
/**
 * Turn a measured element size into a viewport the layout may use.
 *
 * The margin SCALES with the board, because a fixed 28px on a 390px phone is 7% of the width and reads as
 * a huge gutter, while the same 28px on a 1920px monitor is invisible. It is clamped so it never becomes
 * either a waste of space or a sliver of drawing.
 */
function viewportFromStage(width, height, fallback = exports.CANONICAL_VIEWPORT) {
    if (!Number.isFinite(width) || !Number.isFinite(height))
        return { ...fallback };
    if (width < exports.MIN_MEASURED_VIEWPORT.width || height < exports.MIN_MEASURED_VIEWPORT.height)
        return { ...fallback };
    const w = Math.min(exports.MAX_MEASURED_VIEWPORT.width, Math.round(width));
    const h = Math.min(exports.MAX_MEASURED_VIEWPORT.height, Math.round(height));
    return { width: w, height: h, margin: viewportMargin(w, h) };
}
/** The safe margin for a board of this size: 2.4% of the short side, bounded to something readable. */
function viewportMargin(width, height) {
    return Math.round(Math.max(12, Math.min(34, Math.min(width, height) * 0.024)));
}
/** The area inside the safe margins: what a composition is actually allowed to occupy. */
function contentBox(viewport) {
    const margin = Math.max(0, viewport.margin);
    const left = margin;
    const top = margin;
    const right = Math.max(left, viewport.width - margin);
    const bottom = Math.max(top, viewport.height - margin);
    return { left, top, right, bottom, width: right - left, height: bottom - top };
}
const contentCenterX = (viewport) => viewport.width / 2;
exports.contentCenterX = contentCenterX;
const contentCenterY = (viewport) => viewport.height / 2;
exports.contentCenterY = contentCenterY;
/**
 * What SHAPE of board this is.
 *
 * The distinction is a teaching decision, not a cosmetic one. A board that is much wider than it is tall
 * reads left-to-right in one band, so a five-stage pipeline belongs on one row; the same five stages on a
 * tall board have to stack, because a row of five would be squeezed into a few hundred pixels of width
 * and every label would wrap. A very small board drops decorative content before it drops meaning.
 */
function viewportKind(viewport) {
    const aspect = viewport.width / Math.max(1, viewport.height);
    const area = viewport.width * viewport.height;
    if (area < 150000)
        return "compact";
    if (aspect >= 1.45)
        return "wide";
    if (aspect <= 0.82)
        return "tall";
    return "narrow";
}
/** True when the board cannot usefully show a row of more than a few items. */
const isConstrained = (viewport) => viewportKind(viewport) === "compact";
exports.isConstrained = isConstrained;
/**
 * How many items fit on one line at `itemWidth`.
 *
 * The layout compilers all ask this question, and each of them used to answer it with its own copy of the
 * arithmetic against a hard-coded width. This is the one answer, and it takes the real viewport.
 */
const itemsPerRow = (count, itemWidth, gap, viewport) => {
    if (count <= 0)
        return 0;
    const usable = contentBox(viewport).width;
    return Math.max(1, Math.min(count, Math.floor((usable + gap) / Math.max(1, itemWidth + gap))));
};
exports.itemsPerRow = itemsPerRow;
/** How many items fit in one column at `itemHeight` (the vertical sibling of `itemsPerRow`). */
const itemsPerColumn = (count, itemHeight, gap, viewport) => {
    if (count <= 0)
        return 0;
    const usable = contentBox(viewport).height;
    return Math.max(1, Math.min(count, Math.floor((usable + gap) / Math.max(1, itemHeight + gap))));
};
exports.itemsPerColumn = itemsPerColumn;
/** The board area as a plain rect, for the quality gate and the diagnostics overlay. */
const viewportRect = (viewport) => ({
    left: 0, top: 0, right: viewport.width, bottom: viewport.height, width: viewport.width, height: viewport.height,
});
exports.viewportRect = viewportRect;
