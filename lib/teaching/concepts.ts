// SEMANTIC TEACHING CONCEPTS.
//
// One index, built from the asset registry, that answers "which real thing is this text talking
// about?" — and it is the ONLY place that decides it. Everything downstream reuses it:
//
//   * the prompt uses it to name the models a topic may legitimately use,
//   * the relevance gate uses it to replace a generic primitive standing in for a real object,
//   * the part gate uses it to tell a real named part ("left ventricle") from a made-up one,
//   * the coverage report uses it to measure whether what the teacher SAID is what the board SHOWS.
//
// THE HEADLINE RULE. A primitive may only be promoted to a model when the text names the model
// ITSELF — "heart", "piston engine", "blood vessel" — not when it shares a fragment with one. A
// water-cycle lesson talks about "ice", "liquid water" and "water vapour"; none of those is
// `earth/water-droplet`, so none of them is silently turned into a water droplet. That asymmetry is
// deliberate: a wrong promotion teaches the student something false, while a missed promotion only
// means the teacher keeps using a simplified drawing.
import { AssetDescriptor, getAsset, listAssets } from "../visual3d/assets";
import { conceptTokens, containsPhrase, normalizeText, phraseKey, singularize } from "./vocabulary";

export type ConceptKind = "asset" | "part";

export type TeachingConcept = {
  kind: ConceptKind;
  /** The asset this concept is about. Parts always name their asset. */
  assetId: string;
  /** Named part ("left_ventricle"), for `kind === "part"`. */
  part?: string;
  /** The surface text that identified the concept. */
  term: string;
  /** Student-facing name, e.g. "Left ventricle". */
  label: string;
  /** How strongly the text named it. Headline terms outrank part names. */
  weight: number;
};

type ConceptIndex = {
  /** Exact normalized headline phrase -> asset id. */
  headline: Map<string, string>;
  /** Exact normalized part phrase -> { assetId, part }. */
  partPhrase: Map<string, { assetId: string; part: string }>;
  /** Every headline phrase, longest first, so the longest match wins. */
  headlineOrder: string[];
  /** Every part phrase, longest first. */
  partOrder: string[];
  /** Single content word -> asset ids it is a headline term for (only single-word headlines). */
  singleWord: Map<string, string>;
};

let cached: ConceptIndex | null = null;

/** Title-cases a registry identifier for display: "left_ventricle" -> "Left ventricle". */
export function humanizePart(part: string): string {
  return part
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((word) => (word.length <= 2 ? word : `${word[0].toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

/**
 * The phrases that identify this asset on their own.
 *
 * The slug, the display name and every alias — but NOT the individual words inside a multi-word
 * name. "water droplet" identifies `earth/water-droplet`; "water" alone does not, because a lesson
 * about the water cycle mentions water roughly fifty times and means the cycle, not a droplet.
 */
function headlinePhrases(asset: AssetDescriptor): string[] {
  const slug = (asset.id.split("/")[1] ?? "").replace(/-/g, " ");
  const values = [slug, asset.name, ...asset.aliases];
  return Array.from(new Set(values.map((value) => phraseKey(value)).filter((value) => value.length > 0)));
}

function buildIndex(): ConceptIndex {
  const headline = new Map<string, string>();
  const partPhrase = new Map<string, { assetId: string; part: string }>();
  const singleWord = new Map<string, string>();
  for (const asset of listAssets()) {
    for (const phrase of headlinePhrases(asset)) {
      // First writer wins so registry order stays stable and an alias never shadows a canonical slug.
      if (!headline.has(phrase)) headline.set(phrase, asset.id);
      if (!phrase.includes(" ")) singleWord.set(phrase, asset.id);
    }
    for (const part of asset.semanticAnchors) {
      const phrase = phraseKey(part);
      if (!phrase || partPhrase.has(phrase)) continue;
      partPhrase.set(phrase, { assetId: asset.id, part });
    }
  }
  const byLength = (values: Iterable<string>) => Array.from(values).sort((a, b) => b.length - a.length || a.localeCompare(b));
  return {
    headline,
    partPhrase,
    headlineOrder: byLength(headline.keys()),
    partOrder: byLength(partPhrase.keys()),
    singleWord,
  };
}

export function conceptIndex(): ConceptIndex {
  if (!cached) cached = buildIndex();
  return cached;
}

/**
 * Every teaching concept named in `text`, most specific first.
 *
 * Specific means: a longer headline beats a shorter one, a whole asset name beats a part name, and a
 * part name beats a single content word. The result is what "this lesson is about" means for the
 * gate, the prompt and the coverage report, and it is derived only from the registry — no topic is
 * named anywhere in this file.
 */
export function conceptsIn(text: string): TeachingConcept[] {
  const index = conceptIndex();
  const source = normalizeText(text);
  if (!source) return [];
  const found = new Map<string, TeachingConcept>();
  const add = (concept: TeachingConcept) => {
    const key = `${concept.kind}:${concept.assetId}:${concept.part ?? ""}`;
    if (!found.has(key)) found.set(key, concept);
  };

  // Asset headlines are resolved first so a part name is only evidence of a concept when its own asset
  // is named too. Resolved once, up front: a part pass that called back into this function would
  // recurse.
  const namedAssets = new Set<string>();
  for (const phrase of index.headlineOrder) {
    if (containsPhrase(source, phrase)) {
      const assetId = index.headline.get(phrase);
      if (assetId) namedAssets.add(assetId);
    }
  }

  for (const phrase of index.headlineOrder) {
    if (!containsPhrase(source, phrase)) continue;
    const asset = getAsset(index.headline.get(phrase)!);
    if (!asset) continue;
    add({
      kind: "asset",
      assetId: asset.id,
      term: phrase,
      label: asset.name,
      // A multi-word headline is stronger evidence than a single word, because a single word can be
      // an ordinary noun ("atom" in a chemistry sentence, "cell" in a biology sentence).
      weight: 20 + phrase.split(" ").length * 6,
    });
  }
  for (const phrase of index.partOrder) {
    if (!containsPhrase(source, phrase)) continue;
    const entry = index.partPhrase.get(phrase)!;
    const asset = getAsset(entry.assetId);
    if (!asset) continue;
    // A part name is only evidence of a concept when it is a part of an asset this text also named,
    // or when the part phrase is distinctive enough on its own (two or more words).
    const ownerNamed = namedAssets.has(entry.assetId);
    if (!ownerNamed && !phrase.includes(" ")) continue;
    add({
      kind: "part",
      assetId: entry.assetId,
      part: entry.part,
      term: phrase,
      label: humanizePart(entry.part),
      weight: 10 + phrase.split(" ").length * 6,
    });
  }
  return Array.from(found.values()).sort((a, b) => b.weight - a.weight || a.term.localeCompare(b.term));
}

function conceptsOwnAsset(source: string, assetId: string): boolean {
  const index = conceptIndex();
  for (const phrase of index.headlineOrder) {
    if (index.headline.get(phrase) === assetId && containsPhrase(source, phrase)) return true;
  }
  return false;
}

/** Asset ids this text names outright, strongest first. Never returns an invented id. */
export function assetIdsIn(text: string): string[] {
  return Array.from(new Set(conceptsIn(text).filter((concept) => concept.kind === "asset").map((concept) => concept.assetId)));
}

/**
 * The single best asset for this text, or undefined when the text names no real asset.
 *
 * `requiredCategory` restricts the answer to one asset category, which is how a cross-subject
 * substitution is prevented: a biology lesson may not illustrate its pump analogy with a piston
 * engine, because `physics` is not a category the lesson's own vocabulary matched.
 */
export function bestAssetFor(text: string, options: { requiredCategory?: string } = {}): string | undefined {
  const candidates = conceptsIn(text).filter((concept) => concept.kind === "asset");
  if (candidates.length === 0) return undefined;
  const allowed = options.requiredCategory;
  const best = candidates.find((concept) => !allowed || getAsset(concept.assetId)?.category === allowed);
  return best?.assetId;
}

/**
 * The asset that best represents `phrase`, used to replace a generic primitive.
 *
 * Returns undefined unless the phrase names an asset on its own terms, so a partial match can never
 * turn "ice" into a water droplet.
 */
export function assetForPhrase(phrase: string, options: { requiredCategory?: string; requiredCategories?: readonly string[] } = {}): string | undefined {
  // `requiredCategories` is the newer, domain-aware form: an engineering lesson may illustrate with network
  // hardware OR computer-science models OR physics, where a single category could only ever be one of the
  // three. A single `requiredCategory` is still honoured for callers that have exactly one in mind.
  const allowed = options.requiredCategories
    ? (assetId: string | undefined) => assetId !== undefined && options.requiredCategories!.includes(getAsset(assetId)?.category ?? "")
    : options.requiredCategory
      ? (assetId: string | undefined) => (getAsset(assetId ?? "")?.category ?? undefined) === options.requiredCategory
      : (_assetId: string | undefined) => true;
  const key = phraseKey(phrase);
  if (!key) return undefined;
  const index = conceptIndex();
  const direct = index.headline.get(key);
  if (direct && allowed(direct)) return direct;
  // A single-word phrase may be a registry alias the index already holds; nothing looser is accepted.
  return undefined;
}

/** Named parts of `assetId` that this text actually mentions, in registry order. */
export function partsMentioned(assetId: string, text: string): string[] {
  const asset = getAsset(assetId);
  if (!asset) return [];
  const source = normalizeText(text);
  return asset.semanticAnchors.filter((part) => {
    const phrase = phraseKey(part);
    return phrase.length > 0 && containsPhrase(source, phrase);
  });
}

/** Human-readable label for a part id, whether or not the asset is known. */
export function partLabel(part: string): string {
  return humanizePart(part);
}

/**
 * A repeated CALL the teacher just walked through, in order.
 *
 * "when we call countdown(3), it calls countdown(2), and then countdown(1)" contains a complete execution
 * trace and the words for it. That is what makes it safe to build a diagram from: nothing is invented, the
 * board shows exactly the calls the teacher named. It is also the one thing a code lesson can show while
 * the listing itself has not arrived, which is the commonest way a code stage ends up as an empty board.
 *
 * Purely linguistic — a callable name with arguments, repeated with different arguments.
 */
export function calledSequence(speech: string, limit = 5): string[] {
  const pattern = /\b([A-Za-z_][\w]*)\(([^()]{0,24})\)/g;
  const byName = new Map<string, string[]>();
  for (const match of speech.matchAll(pattern)) {
    const name = match[1]!;
    const argument = (match[2] ?? "").trim();
    if (argument.length === 0) continue;
    const seen = byName.get(name) ?? [];
    const call = `${name}(${argument})`;
    if (!seen.includes(call)) seen.push(call);
    byName.set(name, seen);
  }
  const best = Array.from(byName.values()).sort((a, b) => b.length - a.length)[0];
  return best && best.length >= 2 ? best.slice(0, limit) : [];
}

/**
 * The teaching shape of a piece of SPEECH: what the teacher is doing with language.
 *
 * This is linguistics, not topic knowledge, and it is what lets a visually empty step still be given
 * a representation that is guaranteed to agree with what was just said — the items are the teacher's
 * own words, so the drawing cannot contradict the explanation.
 */
export type SpeechShape = "sequence" | "contrast" | "process" | "enumeration" | "code" | "none";

const ORDERED_CUE = /\b(?:first|second|third|fourth|fifth|sixth|next|then|after that|afterwards|finally|lastly|step \d|stage \d|begin by|start by|proceed|follows)\b/i;
const CONTRAST_CUE = /\b(?:whereas|while|on the other hand|in contrast|unlike|instead of|but\b|however|compared (?:to|with)|versus|vs\.?|left side|right side|two (?:types|kinds|cases|types of))\b/i;
const EXCHANGE_CUE = /\b(?:sends?|sent|replies?|responds?|requests?|acknowledges?|transmits?|receives?|connects? to|listens?|answers?|rejects?)\b/i;
// A bare "loop" is the word for any cycle at all, and calling a water cycle "code" because it says "loop"
// cost a real lesson its diagram. Only the programming shapes count.
const CODE_CUE = /\b(?:code|function|method|program|algorithm|pseudocode|pseudo-code|snippet|class|recursion|recursive|return statement|(?:for|while|do)\s+loop\b|loop\s+over\b)\b/i;

/**
 * Short, ordered items the teacher just enumerated.
 *
 * Only the first, second, third / colon-list / "X, Y and Z" shapes count, each item is trimmed to
 * something that fits on a board, and the whole list is discarded unless it has enough entries to be
 * a structure rather than a stray aside.
 */
export function enumeratedItems(speech: string): string[] {
  if (!speech.trim()) return [];
  const items: string[] = [];

  // "First, ... Second, ... Third, ..." — one item per ordinal cue.
  const ordinal = /(?:\b(?:first|firstly|second|secondly|third|thirdly|fourth|fifth|sixth|seventh|lastly|finally)\b\s*[:,]?\s*)/gi;
  const matches = Array.from(speech.matchAll(ordinal));
  for (let index = 0; index < matches.length; index += 1) {
    const start = (matches[index].index ?? 0) + matches[index][0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? speech.length : speech.length;
    items.push(speech.slice(start, end));
  }
  if (items.length >= 3) return cleanItems(items);

  // "The main stages are: evaporation, condensation, precipitation and runoff."
  const colonList = speech.match(/(?:stages?|steps?|phases?|parts?|components?|stages|terms?|types?|kinds?)\s*(?:are|is|of[^:]{0,40})?\s*:\s*([^.;]{6,220})/i);
  if (colonList) return cleanItems(colonList[1].split(/\s*(?:,|;|\band\b|\bor\b)\s*/i));
  return [];
}

function cleanItems(parts: string[]): string[] {
  return Array.from(new Set(parts
    .map((part) => part
      .split(/(?<=[.!?])\s/)[0]                      // the clause that belongs to this item
      .replace(/^[\s,;:.–—-]+/, "")
      .replace(/\s+/g, " ")
      .trim())
    .filter((part) => part.length >= 2 && part.length <= 48 && conceptTokens(part).length > 0)));
}

/** What the teacher is doing with language in this speech. */
export function speechShape(speech: string): SpeechShape {
  if (!speech.trim()) return "none";
  if (CODE_CUE.test(speech)) return "code";
  if (CONTRAST_CUE.test(speech)) return "contrast";
  if (EXCHANGE_CUE.test(speech)) return "sequence";
  if (ORDERED_CUE.test(speech)) return "process";
  const items = enumeratedItems(speech);
  return items.length >= 3 ? "enumeration" : "none";
}

/**
 * Names the two parties of an exchange, when the speech names exactly two.
 *
 * Used only to build a sequence diagram from the teacher's own words, so it accepts a narrow, general
 * pattern — a capitalised or quoted term on each side of a sending/receiving verb.
 */
export function exchangeParties(speech: string): [string, string] | null {
  const pattern = /\b([A-Za-z][\w-]{2,20})\s+(?:sends?|replies?|responds?|requests?|acknowledges?|returns?)\b[^.]{0,40}?\b([A-Za-z][\w-]{2,20})\b/;
  const match = pattern.exec(speech);
  if (!match) return null;
  return [match[1], match[2]];
}

/** Words that name an object's ROLE rather than what it is, so they say nothing on a label. */
const ID_ROLE_WORDS = /^(?:main|model|obj|object|node|shape|mesh|part|group|copy|temp|tmp|new|old|teaching|stage|step|box|plane|item|thing|marker|counter|dot|unit|holder|frame|layer|slot|slotx?)$/i;

/**
 * Shortest sensible display label for an object id a provider invented: "heart_model" -> "Heart".
 *
 * Digits and camel-case are separated first, because providers number their objects ("vessel1",
 * "heartModel") and a label that reads "Vessel1" tells a student nothing. When nothing in the id names a
 * thing — "mat_box", "stage_2", "teaching-atom" — `fallback` is used instead, because a label reading
 * "Mat Box" is noise, while the stage's topic is the only thing it could honestly be called.
 */
export function labelFromId(id: string, fallback?: string): string {
  const separated = id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const words = separated.split(" ").filter((word) => word.length > 0);
  // A short token with a number in it is a SYMBOL, not a numbered instance: "co2" is carbon dioxide and
  // "h2o" is water, while "vessel1" is the first of several vessels. Stripping the digit from the first
  // and not the second is what keeps a chemistry lesson from labelling a molecule "Co".
  const tokens = words.map((word) => (/^[a-z]{1,3}\d+$/i.test(word) ? word : word.replace(/\d+/g, " ")));
  const flattened = tokens.flatMap((token) => token.split(" ")).filter((word) => word.length > 0);
  const meaningful = flattened.filter((word) => !ID_ROLE_WORDS.test(word));
  if (meaningful.length === 0) return fallback && fallback.trim().length > 0 ? fallback.trim().slice(0, 48) : id;
  return meaningful.slice(0, 3)
    .map((word) => `${word[0].toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

/** The searchable phrase for an object identifier: digits dropped, camel-case and separators split. */
export function identifierPhrase(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}