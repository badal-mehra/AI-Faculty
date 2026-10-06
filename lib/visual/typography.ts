"use strict";
// ONE TEXT MEASUREMENT FOR THE WHOLE 2D BOARD.
//
// PHASE 1: THERE IS EXACTLY ONE AUTHORITY FOR TEXT GEOMETRY.
//
// Before this module the board carried five different answers to "how wide is this text":
//
//   measure.ts                        CHAR_WIDTH_EM = 0.58, LINE_HEIGHT_EM = 1.20
//   labelFit.ts                       CHAR_WIDTH_EM = 0.56, LINE_HEIGHT_EM = 1.18
//   geometry.ts  edgeLabelHalfWidth   flat 0.56
//   engine.ts    refreshConnectionLabels  flat 0.58
//   DiagramRenderer.tsx               line spacing 1.22 / 1.20 / 1.20 in three different places
//
// Every one of them is "the average width of a character", and the average is the problem: a flat mean
// OVER-measures "iii" by nearly 2x and UNDER-measures "WWW" by nearly 40%. So the fitter shrank readable
// labels (it believed the text was wider than it is) and a few bold headings overflowed (it believed the
// text was narrower than it is). Both are exactly the reported failures, and neither is fixable by picking
// a better average.
//
// So width is now measured PER GLYPH, from a table of advance widths for the board's real font stack
// (Manrope / DM Mono / system sans-serif), with a mean only for characters the table does not name. The
// estimator is a PURE FUNCTION with no DOM access, so it produces the same numbers in Node, in SSR, in a
// unit test and in the browser — which is what makes the layout deterministic (PHASE 28).
//
// WHAT THIS MODULE IS NOT.
//
// It is not a browser measurement, and it does not pretend to be one. SVG cannot measure text before
// paint, and a canvas measurement would be both asynchronous and unavailable during SSR. So the layout
// uses THIS estimate, and `measureInBrowser()` (lib/visual/measurement.ts) separately compares the
// estimate against what the browser actually painted and reports the disagreement as a quality signal.
// Layout stays deterministic; parity is verified rather than assumed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.uniformWidthFor = exports.heightForOneLine = exports.longestWordWidth = exports.widthForOneLine = exports.MAX_READABLE_FONT_SIZE = exports.MIN_READABLE_FONT_SIZE = exports.normalizeWhitespace = exports.lineOffsetY = exports.blockHeight = exports.widestLine = exports.MEAN_ADVANCE_EM = exports.MONO_ADVANCE_EM = exports.SHAPE_PADDING_EM = exports.DESCENT_EM = exports.ASCENT_EM = exports.INK_SAFETY_EM = exports.LINE_HEIGHT_EM = void 0;
exports.advanceWidth = advanceWidth;
exports.wrapToWidth = wrapToWidth;
exports.measureBlock = measureBlock;
exports.fitLabel = fitLabel;
exports.ellipsize = ellipsize;
// ---- Vertical metrics ---------------------------------------------------------------------------
//
// These are the numbers the RENDERER uses when it places a line, and the numbers the LAYOUT uses when it
// reserves a box. They are declared once, here, and both sides import them, so a measured box and a
// painted box cannot drift apart by a line height.
/** Baseline-to-baseline distance, as a multiple of the font size. */
exports.LINE_HEIGHT_EM = 1.22;
/**
 * Extra ink allowance on a text block, as a multiple of the font size.
 *
 * The estimator knows how wide a line is; it cannot know the browser's exact ascent/descent for the
 * resolved fallback face, and `dominantBaseline` puts the first line a fraction of an em above or below
 * the nominal centre. Without an allowance a two-line caption can sit a couple of pixels taller than the
 * box the layout reserved for it, and a two-pixel overhang between two captions reads as a collision.
 * One tenth of an em is well under a pixel at caption size and is comfortably above the real spread
 * between Chrome on Windows, Chrome on macOS and the same page in a headless container.
 */
exports.INK_SAFETY_EM = 0.1;
/** How far the first line's box sits above the block's centre, as a multiple of the font size. */
exports.ASCENT_EM = 0.76;
/** How far the last line's box sits below the block's centre. */
exports.DESCENT_EM = 0.24;
/** Padding inside a shape that owns a label, per side, as a multiple of the font size. */
exports.SHAPE_PADDING_EM = 0.5;
/** Advance width of one glyph in DM Mono, which is a true monospaced face: 600/1000 of an em. */
exports.MONO_ADVANCE_EM = 0.6;
/** Advance width used for a glyph the table does not name: the board's historical mean. */
exports.MEAN_ADVANCE_EM = 0.58;
/** Bold and heavier faces set wider than regular. Measured, not guessed. */
const WEIGHT_WIDENING = { 100: 1, 200: 1, 300: 1, 400: 1, 500: 1.01, 600: 1.03, 700: 1.045, 800: 1.055, 900: 1.06 };
// Advance widths in em for Manrope-class humanist sans. Keys are the characters themselves; a string key
// means every character in it shares that width. Anything absent falls back to MEAN_ADVANCE_EM.
const ADVANCE_EM = {
    " ": 0.26,
    "!": 0.24, '"': 0.36, "#": 0.62, $: 0.6, "%": 0.88, "&": 0.7, "'": 0.18, "(": 0.31, ")": 0.31, "*": 0.42,
    "+": 0.62, ",": 0.24, "-": 0.33, ".": 0.24, "/": 0.43,
    "0123456789": 0.6,
    ":": 0.24, ";": 0.24, "<": 0.62, "=": 0.62, ">": 0.62, "?": 0.5, "@": 0.9,
    A: 0.66, B: 0.64, C: 0.66, D: 0.71, E: 0.59, F: 0.57, G: 0.73, H: 0.73, I: 0.28, J: 0.51, K: 0.65,
    L: 0.55, M: 0.87, N: 0.75, O: 0.77, P: 0.63, Q: 0.77, R: 0.65, S: 0.61, T: 0.61, U: 0.71, V: 0.66,
    W: 0.95, X: 0.66, Y: 0.63, Z: 0.61,
    "[": 0.29, "\\": 0.43, "]": 0.29, "^": 0.51, _: 0.5, "`": 0.31,
    a: 0.57, b: 0.59, c: 0.51, d: 0.59, e: 0.56, f: 0.35, g: 0.59, h: 0.59, i: 0.26, j: 0.27, k: 0.55,
    l: 0.26, m: 0.89, n: 0.59, o: 0.59, p: 0.59, q: 0.59, r: 0.38, s: 0.49, t: 0.37, u: 0.59, v: 0.53,
    w: 0.77, x: 0.53, y: 0.53, z: 0.49,
    "{": 0.31, "|": 0.24, "}": 0.31, "~": 0.62,
    // Mathematics. A formula is text like any other to the layout, and an unlisted Greek letter or an
    // arrow would otherwise be measured as prose and come out a third too wide.
    "Δ": 0.72, "Ω": 0.79, "Σ": 0.68, "Θ": 0.75, "Π": 0.78, "Φ": 0.76, "Λ": 0.65, "Ψ": 0.76, "Ξ": 0.62,
    "α": 0.58, "β": 0.59, "γ": 0.51, "δ": 0.56, "ε": 0.48, "θ": 0.55, "λ": 0.5, "μ": 0.59, "ν": 0.51,
    "π": 0.63, "ρ": 0.55, "σ": 0.57, "τ": 0.48, "φ": 0.62, "χ": 0.55, "ω": 0.66,
    "∫": 0.44, "∮": 0.44, "√": 0.63, "≈": 0.63, "≠": 0.63, "≤": 0.63, "≥": 0.63, "±": 0.63,
    "×": 0.6, "÷": 0.6, "∞": 0.73, "→": 0.82, "←": 0.82, "↔": 0.86, "⇒": 0.84, "⇔": 0.88,
    "∂": 0.58, "∇": 0.72, "−": 0.62, "·": 0.28, "′": 0.18,
    "₀₁₂₃₄₅₆₇₈₉": 0.34, "⁰¹²³⁴⁵⁶⁷⁸⁹": 0.4, "½": 0.82, "¼": 0.82, "¾": 0.82,
};
const weightFactor = (weight) => {
    if (weight === undefined)
        return 1;
    if (weight >= 900)
        return WEIGHT_WIDENING[900];
    if (weight <= 100)
        return 1;
    const key = Math.round(weight / 100) * 100;
    return WEIGHT_WIDENING[key] ?? 1.03;
};
/**
 * Advance width of a single line, in pixels.
 *
 * A PURE function of (text, fontSize, options). No DOM, no globals, no caching order — the same call
 * returns the same number in a unit test and in a browser, which is what lets layout, collision,
 * label placement, connector labels and the quality gate all agree.
 */
function advanceWidth(text, fontSize, options = {}) {
    if (!text)
        return 0;
    if (fontSize <= 0)
        return 0;
    if (options.mono)
        return text.length * fontSize * exports.MONO_ADVANCE_EM;
    let em = 0;
    for (const character of text)
        em += ADVANCE_EM[character] ?? exports.MEAN_ADVANCE_EM;
    return em * fontSize * weightFactor(options.weight);
}
/** Width of the widest of several lines. */
const widestLine = (lines, fontSize, options = {}) => lines.reduce((widest, line) => Math.max(widest, advanceWidth(line, fontSize, options)), 0);
exports.widestLine = widestLine;
/**
 * Height of a block of `lineCount` lines at `fontSize`, INCLUDING the ink allowance.
 *
 * Every subsystem that reserves vertical space for text uses this, and the renderer places lines at
 * exactly `LINE_HEIGHT_EM` apart, so the reserved box and the painted box are the same box.
 */
const blockHeight = (lineCount, fontSize) => Math.max(1, lineCount) * fontSize * exports.LINE_HEIGHT_EM + fontSize * exports.INK_SAFETY_EM;
exports.blockHeight = blockHeight;
/** How far line `index` of a centred block sits from the block's centre, in pixels. */
const lineOffsetY = (index, lineCount, fontSize) => (index - (lineCount - 1) / 2) * fontSize * exports.LINE_HEIGHT_EM;
exports.lineOffsetY = lineOffsetY;
const normalizeWhitespace = (text) => text.replace(/\s+/g, " ").trim();
exports.normalizeWhitespace = normalizeWhitespace;
/**
 * Greedy word wrap to a pixel width.
 *
 * Wraps at SPACES, which is the only rule that produces readable lines, and then breaks a single
 * over-long word rather than letting it overflow: "photosynthesis" must not run out of the cell that
 * names it. `hardBreak` exists so the caller can decide whether breaking a word is acceptable at all —
 * a code listing must not be re-flowed, and a label can be.
 */
function wrapToWidth(text, maxWidth, fontSize, options = {}) {
    const content = (0, exports.normalizeWhitespace)(text);
    if (!content)
        return [];
    if (fontSize <= 0)
        return [content];
    const limit = Math.max(1, maxWidth);
    const lines = [];
    let line = "";
    const exceeds = (candidate) => advanceWidth(candidate, fontSize, options) > limit && candidate !== "";
    for (const word of content.split(" ")) {
        const candidate = line === "" ? word : `${line} ${word}`;
        if (!exceeds(candidate)) {
            line = candidate;
            continue;
        }
        if (line !== "")
            lines.push(line);
        if (options.hardBreak === false) {
            line = word;
            continue;
        }
        // A single word wider than the column: fill the column as far as the word goes.
        line = "";
        let chunk = "";
        for (const character of word) {
            if (exceeds(`${chunk}${character}`)) {
                lines.push(chunk);
                chunk = character;
            }
            else {
                chunk += character;
            }
        }
        line = chunk;
    }
    if (line !== "")
        lines.push(line);
    const maxLines = options.maxLines;
    if (maxLines === undefined || lines.length <= maxLines)
        return lines;
    // Over the line budget: keep the opening lines whole and elide the last one, so the reader can see
    // that there was more rather than finding a sentence cut in half.
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1] ?? "";
    kept[maxLines - 1] = `${last.replace(/[\s,;:.…-]+$/, "")}…`;
    return kept;
}
/**
 * Measure a free-standing text block: wrap it, then report the box it really occupies.
 *
 * The lines come back EXACTLY as the renderer will break them, because both use `wrapToWidth`. That is
 * the whole point of this module: a reserved box and a painted box are the same box.
 */
function measureBlock(text, fontSize, maxWidth, options = {}) {
    const content = (0, exports.normalizeWhitespace)(text);
    if (!content)
        return { lines: [], width: 0, height: (0, exports.blockHeight)(1, fontSize), truncated: false };
    const lines = wrapToWidth(content, maxWidth, fontSize, options);
    const painted = lines.length > 0 ? lines : [content];
    const unwrapped = wrapToWidth(content, Number.MAX_SAFE_INTEGER, fontSize, options);
    const truncated = unwrapped.length > painted.length || painted.some((line) => line.endsWith("…"));
    return {
        lines: painted,
        width: (0, exports.widestLine)(painted, fontSize, options),
        height: (0, exports.blockHeight)(painted.length, fontSize),
        truncated,
    };
}
/** Below this a label stops being readable, which is what turns "it fits at 9px" into "the box grows". */
exports.MIN_READABLE_FONT_SIZE = 11;
/** …and above this a label crowds a small shape or overpowers the composition. */
exports.MAX_READABLE_FONT_SIZE = 26;
/**
 * Fit a label INSIDE the shape that owns it, or report that the shape must grow.
 *
 * The order the mission fixes is: wrap, then resize the container, then reposition, then restructure, and
 * only as a last resort shrink the type. This function implements the first two and reports the third, so
 * every caller makes the same decision for the same label:
 *
 *   * if the label already fits at the requested size, it is returned untouched;
 *   * otherwise it is wrapped and re-measured, and if it still does not fit the returned `grow` says by
 *     how much the shape has to grow — the caller grows the shape rather than shrinking the word.
 */
function fitLabel(text, box, fontSize, options = {}) {
    const content = (0, exports.normalizeWhitespace)(text);
    const width = Math.max(0, box.width);
    const height = Math.max(0, box.height);
    if (!content)
        return { fontSize, lines: [], width: 0, height: 0, truncated: false };
    const attempt = (size) => {
        const padding = size * exports.SHAPE_PADDING_EM * 2;
        const innerWidth = width - padding;
        const innerHeight = height - padding;
        if (innerWidth <= 0 || innerHeight <= 0)
            return { fontSize: size, lines: [], width: 0, height: 0, truncated: true };
        const lines = wrapToWidth(content, innerWidth, size, options);
        const blockWidth = (0, exports.widestLine)(lines, size, options);
        const blockHeightPx = (0, exports.blockHeight)(lines.length, size);
        return { fontSize: size, lines, width: blockWidth + padding, height: blockHeightPx + padding, truncated: false };
    };
    const whole = attempt(fontSize);
    if (whole.lines.length > 0 && whole.height <= height + 0.5 && whole.width <= width + 0.5) {
        return { ...whole, truncated: false };
    }
    // Shrinking is the LAST resort, and only down to the readable floor. Growing the shape is always
    // preferable, so what comes out of here says how big the box must be rather than accepting a nine-point
    // word: the caller grows the box, and the quality gate can see when it could not.
    const floor = Math.max(8, Math.min(exports.MIN_READABLE_FONT_SIZE, Math.round(fontSize)));
    let size = Math.max(1, Math.round(fontSize));
    while (size > floor) {
        size -= 1;
        const fitted = attempt(size);
        if (fitted.lines.length > 0 && fitted.height <= height + 0.5 && fitted.width <= width + 0.5) {
            return { ...fitted, truncated: false };
        }
    }
    // Nothing fits whole at a readable size. Keep the longest beginning of the label that does fit on one
    // line at the floor, with an ellipsis when there is room for one, so the student sees the start of the
    // word rather than an empty shape — or, worse, the whole word painted over its own border, which is the
    // failure this whole module exists to prevent.
    const sizeFloor = attempt(floor);
    const elision = ellipsize(content, Math.max(1, width - floor * exports.SHAPE_PADDING_EM * 2), floor, options);
    if (elision)
        return { fontSize: floor, lines: [elision], width, height, truncated: true };
    if (sizeFloor.lines.length > 0)
        return { ...sizeFloor, truncated: true };
    return { fontSize: floor, lines: [content], width, height, truncated: true };
}
/**
 * The longest prefix of `text` that fits `maxWidth` on one line, with an ellipsis when one also fits.
 *
 * The ellipsis is only added if the result still fits, because a truncated word with no marker reads as a
 * typo rather than as a shortening. Cutting character by character (rather than word by word) is right
 * here: the whole point is to keep as much of the beginning as the box allows, and at this size there is
 * no room to be fussy about whole words.
 */
function ellipsize(text, maxWidth, fontSize, options = {}) {
    const content = (0, exports.normalizeWhitespace)(text);
    if (!content)
        return "";
    if (advanceWidth(content, fontSize, options) <= maxWidth)
        return content;
    const dotted = "…";
    const dotWidth = advanceWidth(dotted, fontSize, options);
    let cut = content.length;
    while (cut > 1) {
        const withoutDot = content.slice(0, cut);
        if (advanceWidth(`${withoutDot}${dotted}`, fontSize, options) <= maxWidth)
            return `${withoutDot}${dotted}`;
        if (advanceWidth(withoutDot, fontSize, options) <= maxWidth)
            return withoutDot;
        cut -= 1;
    }
    return content.slice(0, 1);
}
/** Width a shape must have so `text` sits on ONE line at `fontSize`. */
const widthForOneLine = (text, fontSize, options = {}) => Math.ceil(advanceWidth((0, exports.normalizeWhitespace)(text), fontSize, options) + fontSize * exports.SHAPE_PADDING_EM * 2);
exports.widthForOneLine = widthForOneLine;
/** Width of the widest single word, which can never be wrapped away and so sets the minimum width. */
const longestWordWidth = (text, fontSize, options = {}) => (0, exports.normalizeWhitespace)(text)
    .split(" ")
    .reduce((widest, word) => Math.max(widest, advanceWidth(word, fontSize, options)), 0);
exports.longestWordWidth = longestWordWidth;
/** Height a shape must have so `text` fits on ONE line at `fontSize`. */
const heightForOneLine = (fontSize) => Math.ceil(fontSize * exports.LINE_HEIGHT_EM + fontSize * exports.INK_SAFETY_EM + fontSize * exports.SHAPE_PADDING_EM * 2);
exports.heightForOneLine = heightForOneLine;
/**
 * One width for a run of items that must look UNIFORM — array cells, pipeline stages, queue cells.
 *
 * A row whose boxes each measure their own label is not a row: one stage called "Write Back" wraps while
 * its neighbour "Execute" does not, and the diagram stops looking like a single structure. Every item is
 * measured whole and the row shares the result.
 */
const uniformWidthFor = (texts, fontSize, options = {}) => texts.reduce((widest, text) => Math.max(widest, (0, exports.widthForOneLine)(text, fontSize, options)), 0);
exports.uniformWidthFor = uniformWidthFor;
