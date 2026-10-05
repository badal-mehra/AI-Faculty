// SHARED TEACHING VOCABULARY.
//
// The pipeline needs to answer one question over and over, in several places: "is this word the thing
// the student asked about?". Asset selection asked it with its own tokenizer; the relevance gate asks
// it before a primitive is allowed on screen; the prompt asks it when it lists the models a topic can
// use. Three copies of the same stop-word list is three places for the list to rot, so there is one.
//
// The rule the lists encode: a word that is meaningful for ASSETS but too generic to identify a
// specific thing is not evidence. "system", "cell", "model", "wave" appear in dozens of asset names;
// matching them alone would drag a pulley into a solar-system lesson and a stomach into a biology one.

/** Words that carry no teaching meaning for asset or concept matching. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "what", "how", "why", "when",
  "does", "are", "is", "it", "of", "to", "in", "on", "a", "an", "be", "use", "using", "show",
  "teach", "me", "explain", "please", "can", "you", "i", "want", "need", "about", "model",
  "visualization", "visual", "diagram", "picture", "draw", "make", "give", "help", "understand",
  "working", "works", "work", "teaching", "lesson", "3d", "2d",
]);

/** Words too generic to identify a specific asset or concept on their own. */
export const GENERIC_WORDS: ReadonlySet<string> = new Set([
  "system", "model", "structure", "layer", "unit", "object", "particle", "cell", "machine",
  "device", "tool", "process", "state", "type", "wave", "field", "line", "ring", "plate",
]);

/** Lowercase, collapse every run of non-alphanumerics to a single space, trim. */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalized word list: length >= 3, stop-words and pure numbers removed. */
export function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token) && !/^\d+$/.test(token));
}

/** Same as {@link tokenize}, for fragments that are already small (an asset id, a name, an anchor). */
export function wordsOf(...values: string[]): string[] {
  return values.flatMap((value) => normalizeText(value).split(" ")).filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/**
 * A crude singular form, so "vessels"/"vessel" and "atoms"/"atom" are the same concept.
 *
 * It is deliberately not a real stemmer: it only removes a trailing "s" (and "es" after s/x/z/ch/sh),
 * which is what makes the difference between a plural noun and an asset id. A wrong guess costs a
 * missed match, never a wrong substitution, because substitution additionally requires a headline
 * term to line up (see `concepts.ts`).
 */
export function singularize(word: string): string {
  const lower = word.toLowerCase();
  if (lower.length <= 3) return lower;
  if (/(?:ss|us|is)$/.test(lower)) return lower;
  if (/(?:ch|sh|s|x|z)es$/.test(lower)) return `${lower.slice(0, -2)}`;
  if (/ies$/.test(lower)) return `${lower.slice(0, -3)}y`;
  if (/s$/.test(lower)) return lower.slice(0, -1);
  return lower;
}

/** Content words, singularised, for set comparison. */
export function conceptTokens(text: string): string[] {
  return Array.from(new Set(tokenize(text).map(singularize)));
}

/** Normalized multi-word phrase, singularised per word. */
export function phraseKey(text: string): string {
  return tokenize(text).map(singularize).join(" ");
}

/** True when `phrase` is a whole-word prefix match inside `text` (never a substring match). */
export function containsPhrase(text: string, phrase: string): boolean {
  const target = phraseKey(phrase);
  if (!target) return false;
  return new RegExp(`(?:^| )${target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).test(phraseKey(text));
}