/**
 * ONE text measurement for the whole 2D board.
 *
 * Layout must reserve the space text will really need, the engine must size a shape around its own
 * label, and the renderer must break that label into exactly the lines that were reserved. When those
 * three disagree, the board draws text over shapes and labels — which is exactly the "disconnected
 * text" failure this module exists to remove.
 *
 * The glyph metrics are the same constants labelFit.ts uses, so a label that fits its box by one
 * module fits by the other. The font stack is Manrope / DM Mono / system sans-serif: measured in
 * Chrome, a mixed-case string averages ~0.56em per glyph, and DM Mono digits are 0.60em.
 */
import { fitLabelInBox } from "./labelFit";

/** Average advance width of one glyph, as a fraction of the font size. */
export const CHAR_WIDTH_EM = 0.58;
/** Mono (DM Mono) advance width — used for indices, formulas and codes, which render monospaced. */
export const MONO_CHAR_WIDTH_EM = 0.6;
export const LINE_HEIGHT_EM = 1.2;
/** Breathing room inside a shape, as a fraction of the font size, per side. */
export const TEXT_PADDING_EM = 0.42;
/** A label at most this long is grown to sit on ONE line rather than wrapped across two. */
const SHORT_LABEL_CHARS = 18;

export type MeasuredText = {
  lines: string[];
  fontSize: number;
  width: number;
  height: number;
};

const normalize = (text: string): string => text.replace(/\s+/g, " ").trim();

/** Width in px of one unwrapped line at a given font size. */
export const measureLine = (text: string, fontSize: number, mono = false): number =>
  text.length * fontSize * (mono ? MONO_CHAR_WIDTH_EM : CHAR_WIDTH_EM);

/** Greedy word wrap. A single word longer than the column is broken rather than allowed to overflow,
 * because a long identifier ("photosynthesis") must not run past the cell it names. */
export function wrapText(text: string, maxWidth: number, fontSize: number, mono = false): string[] {
  const content = normalize(text);
  if (!content) return [];
  const em = fontSize * (mono ? MONO_CHAR_WIDTH_EM : CHAR_WIDTH_EM);
  const columns = Math.max(1, Math.floor(Math.max(1, maxWidth) / em));
  const lines: string[] = [];
  let line = "";
  for (const word of content.split(" ")) {
    const candidate = line === "" ? word : `${line} ${word}`;
    if (candidate.length <= columns) {
      line = candidate;
      continue;
    }
    if (line !== "") lines.push(line);
    line = word;
    while (line.length > columns) {
      lines.push(line.slice(0, columns));
      line = line.slice(columns);
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

/** Measured block for a free-standing text object: wrapped lines plus the box they really occupy. */
export function measureText(
  text: string,
  fontSize: number,
  maxWidth: number,
  options: { mono?: boolean; maxLines?: number } = {},
): MeasuredText {
  const mono = options.mono ?? false;
  const maxLines = options.maxLines ?? 3;
  const lines = wrapText(text, maxWidth, fontSize, mono).slice(0, maxLines);
  const width = lines.reduce((widest, line) => Math.max(widest, measureLine(line, fontSize, mono)), 0);
  const height = Math.max(1, lines.length) * fontSize * LINE_HEIGHT_EM;
  return { lines, fontSize, width, height };
}

/** Widest single word — a long identifier can never be wrapped away, so it sets the minimum width. */
export function longestWordWidth(text: string, fontSize: number, mono = false): number {
  const em = fontSize * (mono ? MONO_CHAR_WIDTH_EM : CHAR_WIDTH_EM);
  return normalize(text).split(" ").reduce((widest, word) => Math.max(widest, word.length * em), 0);
}

/**
 * The size a SHAPE must be so its own label sits inside it at a READABLE size.
 *
 * A shape never shrinks below its requested size; it grows when the label would otherwise only fit by
 * being shrunk to nothing. `minFontSize` is the line below which a label stops being readable, which
 * is what turns "the text technically fits at 9px" into "the box grows instead".
 *
 * The growth loop and the final size use the SAME fitter and the SAME padding rule the renderer uses
 * (`lines * fontSize * 1.18 + fontSize`), so "fits by measurement" and "fits on screen" cannot diverge
 * by a single pixel.
 */
export function shapeSizeForText(
  text: string | undefined,
  shape: { width: number; height: number },
  fontSize: number,
  options: { maxWidth?: number; minFontSize?: number } = {},
): { width: number; height: number } {
  const content = normalize(text ?? "");
  if (!content) return { width: shape.width, height: shape.height };
  const minFontSize = options.minFontSize ?? 13;
  const maxWidth = options.maxWidth ?? 280;

  const asIs = fitLabelInBox(content, shape.width, shape.height, fontSize);
  const wordCount = content.split(" ").length;
  // `lines.length > wordCount` means the fitter had to break a word mid-way ("photosynthesis" ->
  // "photos" / "synthes" / "is"). That is legal as a last resort but it is not what a teaching board
  // should show when widening the box by 50px would show the whole word.
  const keepsWordsWhole = (fitted: { lines: string[] }) => fitted.lines.length <= wordCount;
  if (!asIs.truncated && asIs.fontSize >= minFontSize && keepsWordsWhole(asIs)) {
    // A SHORT label still deserves one line: five pipeline stages must not have one box wrapping
    // because its name happens to be two words. Only genuinely long text wraps.
    const oneLine = Math.ceil(measureLine(content, fontSize) + fontSize);
    const prefersOneLine = content.length <= SHORT_LABEL_CHARS && oneLine <= maxWidth && shape.width < oneLine;
    if (!prefersOneLine) return { width: shape.width, height: shape.height };
    const grown = fitLabelInBox(content, oneLine, shape.height, fontSize);
    return { width: oneLine, height: Math.max(shape.height, Math.ceil(grown.lines.length * grown.fontSize * 1.18 + grown.fontSize)) };
  }

  // Prefer the WHOLE label on ONE line: a stage called "Write Back" next to "Execute" must not wrap just
  // because it has more characters. Widening is always preferable to breaking a short label in two.
  const oneLineWidth = Math.ceil(measureLine(content, fontSize) + fontSize);
  const wordFloor = Math.ceil(longestWordWidth(content, minFontSize) + minFontSize);

  const measure = (width: number) => {
    const fitted = fitLabelInBox(content, width, Number.MAX_SAFE_INTEGER, minFontSize);
    return { fitted, height: Math.ceil(fitted.lines.length * fitted.fontSize * 1.18 + fitted.fontSize) };
  };

  let width = Math.min(maxWidth, Math.max(shape.width, oneLineWidth, wordFloor));
  let result = measure(width);
  while ((result.fitted.truncated || result.fitted.fontSize < minFontSize) && width < maxWidth) {
    width = Math.min(maxWidth, Math.ceil(width * 1.18) + 6);
    result = measure(width);
  }
  const widthOut = Math.min(maxWidth, Math.max(shape.width, Math.ceil(width)));
  return { width: widthOut, height: Math.max(shape.height, result.height) };
}

/**
 * Height of the shape needed so the label fits without any shrink, for callers that size first
 * (array cells, stack rows, pipeline stages) and then place.
 */
export function heightForLabel(text: string, width: number, fontSize: number): number {
  const lines = wrapText(text, width - fontSize * TEXT_PADDING_EM * 2, fontSize);
  return Math.ceil(Math.max(fontSize * 2.1, lines.length * fontSize * LINE_HEIGHT_EM + fontSize * TEXT_PADDING_EM * 2));
}

/** Width of the shape needed so the label fits without wrapping, for callers that size first. */
export function widthForLabel(text: string, fontSize: number, min = 0, max = 320): number {
  return Math.min(max, Math.max(min, Math.ceil(measureLine(text, fontSize) + fontSize)));
}

/**
 * Width for a run of sibling items that must look UNIFORM (pipeline stages, queue cells, table
 * columns): every item is measured whole, so the row shares one width and no single label wraps while
 * its neighbours do not.
 */
export function uniformWidthForLabels(texts: string[], fontSize: number, min = 0, max = 320): number {
  const widest = texts.reduce((value, text) => Math.max(value, widthForLabel(text, fontSize, 0, Number.MAX_SAFE_INTEGER)), 0);
  return Math.min(max, Math.max(min, widest));
}