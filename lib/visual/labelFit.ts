/**
 * FITS A LABEL INSIDE THE SHAPE THAT OWNS IT.
 *
 * A diagram shape's own text is centred on the shape, so text longer than the shape simply spills out
 * over its border and over whatever is next to it. The renderer cannot measure text (SVG has no text
 * measurement before paint), so width is estimated from the font: a sans-serif face averages about
 * 0.56em per character, which is close enough to choose a size and a line break that really do fit.
 *
 * The label always wins over the default size: a smaller, wrapped, complete label teaches the same
 * thing as a large one running off the shape, and only the first is readable.
 */

const CHAR_WIDTH_EM = 0.56;
const LINE_HEIGHT_EM = 1.18;
const MIN_FONT_SIZE = 9;
const PADDING_EM = 0.5;
/** A label is never drawn unreadably small: below this the fitter prefers to shorten or break words. */
export const MIN_LABEL_FONT_SIZE = 10;
/** …and never so large that it overflows a small shape. */
export const MAX_LABEL_FONT_SIZE = 24;

export type FittedLabel = {
  fontSize: number;
  lines: string[];
  /** True when the text had to be shortened to fit. The caller may surface this in diagnostics. */
  truncated: boolean;
};

/** Greedy word wrap at the largest size that fits the box both ways. */
export function fitLabelInBox(text: string, width: number, height: number, preferredFontSize: number): FittedLabel {
  const content = text.replace(/\s+/g, " ").trim();
  if (!content) return { fontSize: preferredFontSize, lines: [], truncated: false };

  for (let fontSize = Math.round(preferredFontSize); fontSize >= MIN_FONT_SIZE; fontSize -= 1) {
    const padding = fontSize * PADDING_EM * 2;
    const innerWidth = width - padding;
    const innerHeight = height - padding;
    if (innerWidth <= 0 || innerHeight <= 0) continue;
    const lines = wrap(content, innerWidth / (fontSize * CHAR_WIDTH_EM));
    if (lines.length * fontSize * LINE_HEIGHT_EM <= innerHeight) return { fontSize, lines, truncated: false };
  }

  // Nothing fits whole: keep the shortest prefix that fits one line, so the student still sees the
  // beginning of the label rather than an empty shape.
  const fontSize = MIN_FONT_SIZE;
  const innerWidth = Math.max(1, width - fontSize * PADDING_EM * 2);
  return { fontSize, lines: [truncateTo(content, innerWidth / (fontSize * CHAR_WIDTH_EM))], truncated: true };
}

function wrap(text: string, columns: number): string[] {
  if (columns < 1) return [text];
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line === "") {
      line = word;
    } else if (`${line} ${word}`.length <= columns) {
      line = `${line} ${word}`;
    } else {
      lines.push(line);
      line = word;
    }
    // A single word longer than the box has to be broken, or it overflows on its own.
    while (line.length > columns) {
      lines.push(line.slice(0, columns));
      line = line.slice(columns);
    }
  }
  if (line !== "") lines.push(line);
  return lines;
}

function truncateTo(text: string, columns: number): string {
  if (text.length <= columns) return text;
  if (columns <= 1) return text.slice(0, Math.max(1, Math.floor(columns)));
  return `${text.slice(0, Math.floor(columns) - 1).trimEnd()}…`;
}