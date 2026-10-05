// RELEVANT ASSET SELECTION.
//
// The registry holds 86 models; sending all of them on every request is what blew the prompt past
// the provider's token limit. The model only needs the handful of assets that could plausibly be
// used for THIS question, so we score every asset against the question text and return a small,
// compact subset.
//
// The selection is generic: it uses only what the registry already knows (id, name, category,
// semantic part names) plus the current scene. There are no hardcoded topic lists â€” a question
// about a car engine matches "physics/engine" because the words appear in the registry, not because
// somebody special-cased engines.
import { AssetDescriptor, getAsset, listAssets } from "../visual3d/assets";
import { classifyTeachingIntent, type TeachingSubject } from "./intent";

export type SelectedAsset = {
  id: string;
  /** Short human description, e.g. "Human Heart". */
  name: string;
  category: string;
  /** Up to MAX_PARTS semantic part names (relevance-ordered). */
  parts: string[];
  /** Alias without the category prefix, which the model may use instead of the full id. */
  alias: string;
};

export type AssetSelectionOptions = {
  /** Hard cap on how many assets reach the prompt. */
  limit?: number;
  /** Cap on part names per asset. */
  maxParts?: number;
  /** Assets already present in the live scene are always kept, so a lesson never loses its models. */
  sceneAssets?: string[];
  /** Longest part name kept verbatim; longer names are truncated. */
  maxPartLength?: number;
};

const STOPWORDS = new Set([
  "the", "and", "for", "with", "that", "this", "from", "into", "what", "how", "why", "when",
  "does", "are", "is", "it", "of", "to", "in", "on", "a", "an", "be", "use", "using", "show",
  "teach", "me", "explain", "please", "can", "you", "i", "want", "need", "about", "model",
  "visualization", "visual", "diagram", "picture", "draw", "make", "give", "help", "understand",
  "working", "works", "work", "teaching", "lesson", "3d", "2d",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

/** Splits an asset id/name into meaningful words ("blood-vessel" -> ["blood", "vessel"]). */
function wordsOf(...values: string[]): string[] {
  return values
    .flatMap((value) => value.split(/[^a-z0-9]+/i))
    .map((word) => word.toLowerCase())
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

// Words that are meaningful for assets but too generic to score a question on their own.
const GENERIC_PARTS = new Set(["model", "main", "body", "part", "core", "shell", "top", "base"]);

// Words that appear inside many asset names ("solar system", "digestive system", "coordinate
// system"). Matching them would drag unrelated models into every prompt.
const GENERIC_WORDS = new Set([
  "system", "model", "structure", "layer", "unit", "object", "particle", "cell", "machine",
  "device", "tool", "process", "state", "type", "wave", "field", "line", "ring", "plate",
]);

type ScoredAsset = { asset: AssetDescriptor; score: number; parts: string[] };

function scoreAsset(asset: AssetDescriptor, questionTokens: Set<string>, spokenTokens: Set<string>): ScoredAsset {
  const idWords = wordsOf(asset.id.split("/")[1] ?? "");
  const nameWords = wordsOf(asset.name);
  const categoryWords = wordsOf(asset.category);
  let specific = 0;
  let generic = 0;
  // A match on a GENERIC word alone ("system", "cell", "field") is not evidence that this model is
  // the one the question is about: "Pulley System" and "Digestive System" both contain "system", so a
  // solar-system question would otherwise pull in a pulley and a stomach. Track the generic matches
  // separately and require at least one specific match before an asset may be described in detail.

  for (const word of idWords) {
    if (!questionTokens.has(word)) continue;
    if (GENERIC_WORDS.has(word)) generic += 3; else specific += 12;
  }
  for (const word of nameWords) {
    if (!questionTokens.has(word)) continue;
    if (GENERIC_WORDS.has(word)) generic += 3; else specific += 10;
  }
  for (const word of categoryWords) if (questionTokens.has(word)) specific += 4;

  // A short asset id ("heart") already matched as a whole phrase is the strongest signal there is.
  const alias = asset.id.split("/")[1] ?? "";
  for (const token of questionTokens) {
    if (token.length < 4 || GENERIC_WORDS.has(token)) continue;
    // Only a WHOLE-WORD match counts: "system" inside "digestive-system" must not score.
    if (alias.split(/[^a-z0-9]+/i).some((word) => word.toLowerCase().length >= 4 && word.toLowerCase().startsWith(token))) specific += 6;
  }

  // Part names are a weak signal (many parts repeat across models) but break ties usefully.
  const partScores: Array<{ part: string; score: number }> = [];
  for (const part of asset.semanticAnchors) {
    let partScore = 0;
    for (const word of wordsOf(part)) {
      if (GENERIC_WORDS.has(word)) continue;
      if (questionTokens.has(word)) partScore += 2;
      if (spokenTokens.has(word)) partScore += 1;
    }
    if (partScore > 0) {
      // A part naming the exact thing asked about is still a specific signal.
      specific += Math.min(partScore, 4);
    }
    partScores.push({ part, score: partScore });
  }

  // Parts that look like the thing being asked about come first, then registry order is preserved.
  partScores.sort((a, b) => b.score - a.score);
  const parts = partScores.filter((entry) => entry.score > 0).map((entry) => entry.part);
  // A generic-only match is not "relevant": "Pulley System" must not be offered as a detailed model
  // just because the question said "system". The compact library index already tells the model it
  // exists, so dropping it here costs nothing and keeps the detail budget for real matches.
  return { asset, score: specific > 0 ? specific + generic : 0, parts: specific > 0 ? parts : [] };
}

export type AssetSelection = {
  /** Assets whose vocabulary matched the question; these carry semantic parts. */
  relevant: SelectedAsset[];
  /** How strong that match was. "low" means the model must rely on the library index. */
  confidence: "high" | "medium" | "low";
  /** Total assets considered, for diagnostics. */
  considered: number;
};

/**
 * Vocabulary that belongs to one subject only. "Cells", "nodes", "servers" and "queues" name a data
 * structure in a computing lesson and a piece of anatomy or a counter in another, and the model that
 * is offered the wrong one teaches the wrong subject with a real-looking picture.
 */
const SUBJECT_ONLY_WORDS: Record<string, string> = {
  cell: "computer-science", cells: "computer-science", node: "computer-science", nodes: "computer-science",
  array: "computer-science", arrays: "computer-science", pointer: "computer-science", pointers: "computer-science",
  queue: "computer-science", queues: "computer-science", stack: "computer-science", stacks: "computer-science",
  linked: "computer-science", list: "computer-science", tree: "computer-science", trees: "computer-science",
  byte: "computer-science", bytes: "computer-science", bit: "computer-science", bits: "computer-science",
  thread: "computer-science", threads: "computer-science", kernel: "computer-science", cache: "computer-science",
  router: "network", packet: "network", packets: "network", socket: "network", protocol: "network",
  neuron: "biology", synapse: "biology", mitochondria: "biology", chloroplast: "biology", ribosome: "biology",
  vacuum: "physics", magnet: "physics", pendulum: "physics", lens: "physics", spring: "physics", circuit: "physics",
};

type Scored = ScoredAsset;

/** Whether a question is clearly about one subject, judged only on words that belong to that subject. */
export function subjectOfVocabulary(text: string): string | null {
  const counts = new Map<string, number>();
  for (const word of wordsOf(text)) {
    const subject = SUBJECT_ONLY_WORDS[word];
    if (!subject) continue;
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked.length > 0 ? ranked[0][0] : null;
}

/**
 * Selects the assets worth describing in detail. Always returns the strongest matches; the caller
 * pairs this with `libraryIndexText()` so the model still knows the whole library exists at a cost
 * of a few hundred tokens instead of several thousand.
 */
export function selectAssetsForLesson(
  question: string,
  options: AssetSelectionOptions & { recentSpeech?: string[] } = {},
): AssetSelection {
  const limit = options.limit ?? 12;
  const maxParts = options.maxParts ?? 6;
  const maxPartLength = options.maxPartLength ?? 28;

  const questionTokens = new Set(tokenize(question));
  const spokenTokens = new Set(tokenize((options.recentSpeech ?? []).join(" ")));
  const scored = listAssets().map((asset) => scoreAsset(asset, questionTokens, spokenTokens));

  // Scene assets are pinned: a lesson must be able to keep using the models it already placed.
  const pinned = new Set((options.sceneAssets ?? []).filter((id) => getAsset(id) !== undefined));
  for (const entry of scored) if (pinned.has(entry.asset.id)) entry.score += 1000;

  // Which asset categories may illustrate which subject.
  //
  // This is the strong semantic constraint the asset search has been missing. The previous version keyed
  // off a narrow keyword table that returned `null` for most questions, so "no subject" meant "no
  // constraint at all" and a continuity problem was offered a skeleton, a pair of lungs and a laptop â€” a
  // bag of words that happened to appear in a phrase. A subject is the strongest signal a request
  // carries, and it is now the gate.
  const SUBJECT_ASSET_CATEGORIES: Partial<Record<TeachingSubject, readonly string[]>> = {
  mathematics: ["mathematics"],
  physics: ["physics", "mathematics"],
  engineering: ["physics", "computer-science", "mathematics"],
  chemistry: ["chemistry", "mathematics"],
  biology: ["biology", "chemistry"],
  astronomy: ["astronomy", "mathematics"],
  networking: ["network", "computer-science"],
  "computer-science": ["computer-science", "mathematics"],
  programming: ["computer-science", "mathematics"],
  };
  const MATH_LIKE = new Set(["mathematics", "physics", "engineering", "chemistry", "astronomy"]);

/** How many of the subject's own models are offered when the request's wording matched none of them. */
const SUBJECT_FALLBACK_LIMIT = 3;

  // When the wording names a subject only one subject owns, a model from another subject is not a near
  // miss worth offering: "an array of four cells" must not be illustrated with a biological cell. `general`
  // and the humanities deliberately impose nothing â€” a lesson whose subject was not recognised is exactly
  // the lesson where an unconstrained search is better than a wrong one.
  const subject = classifyTeachingIntent(question).subject;
  const allowed = SUBJECT_ASSET_CATEGORIES[subject];
  const matched = scored
    .filter((entry) => entry.score > 0)
    .map((entry) => (allowed && !allowed.includes(entry.asset.category) && !pinned.has(entry.asset.id) ? { ...entry, score: 0 } : entry))
    // A mathematical, physical or engineering lesson must not be illustrated with a body, a planet or a
    // network device even when a token matched, because those are different worlds, not similar pictures.
    .map((entry) => (MATH_LIKE.has(subject)
      && (entry.asset.category === "biology" || entry.asset.category === "earth" || entry.asset.category === "network" || entry.asset.category === "astronomy")
      && !pinned.has(entry.asset.id) ? { ...entry, score: 0 } : entry))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // A subject constraint must never make the subject's OWN models unreachable. "The solar system" says
  // "sun" only to a human, so the wording matched nothing and the correct answer — an astronomy model —
  // was filtered out along with the contamination. When the question's own words match nothing, the
  // subject itself is the evidence: offer a few of ITS models, and only its own.
  //
  // Judged on the CONTENT matches, never on the pinned ones. A lesson that already has a heart on the
  // board would otherwise count as "we matched something" and suppress its own subject's models
  // forever, which is how a TCP handshake ended up being illustrated by a heart and nothing else.
  const contentMatched = matched.filter((entry) => !pinned.has(entry.asset.id));
  const ranked = contentMatched.length > 0
    ? matched
    : allowed
      // Whatever is already ON the BOARD stays described even when the subject filter says it does not
      // belong here: it is there, the student is looking at it, and describing it is how the lesson can
      // go on to explain it. The filter governs what NEW gets offered.
      ? [
        ...matched.filter((entry) => pinned.has(entry.asset.id)),
        ...scored
          .filter((entry) => allowed.includes(entry.asset.category) && !pinned.has(entry.asset.id))
          .slice(0, SUBJECT_FALLBACK_LIMIT),
      ]
      : matched;
  const top = ranked;
  const best = top[0]?.score ?? 0;

  const confidence: AssetSelection["confidence"] = best >= 20 ? "high" : best > 0 ? "medium" : "low";

  const relevant = top.map((entry, index) => {
    const matched = entry.parts.filter((part) => !GENERIC_PARTS.has(part));
    // The strongest matches also show a few of their parts even when the wording did not name them:
    // knowing a heart has "aorta" and "left_ventricle" is what lets the model use anchorPart at all.
    const fallbackParts = matched.length === 0 && index < 3
      ? entry.asset.semanticAnchors.filter((part) => !GENERIC_PARTS.has(part)).slice(0, 3)
      : [];
    return {
      id: entry.asset.id,
      name: entry.asset.name,
      category: entry.asset.category,
      alias: entry.asset.id.split("/")[1] ?? entry.asset.id,
      parts: [...matched, ...fallbackParts]
        .slice(0, maxParts)
        .map((part) => (part.length > maxPartLength ? `${part.slice(0, maxPartLength - 1)}â€¦` : part)),
    };
  });

  return { relevant, confidence, considered: scored.length };
}

/** Compact catalog block for the prompt. */
export function assetCatalogText(assets: SelectedAsset[], header: string): string {
  if (assets.length === 0) return "";
  const lines = assets.map((asset) => {
    const parts = asset.parts.length > 0 ? ` | parts: ${asset.parts.join(", ")}` : "";
    return `- ${asset.id} | ${asset.name}${parts}`;
  });
  return `${header}\n${lines.join("\n")}`;
}

/**
 * The whole library as one short line per category. This is what keeps the model aware of all 86
 * models (so it never invents an id) at a fraction of the cost of a full entry per model.
 */
export function libraryIndexText(): string {
  const byCategory = new Map<string, string[]>();
  for (const asset of listAssets()) {
    const name = (asset.id.split("/")[1] ?? asset.id).replace(/-/g, " ");
    byCategory.set(asset.category, [...(byCategory.get(asset.category) ?? []), name]);
  }
  const lines = Array.from(byCategory.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, names]) => `${category}: ${names.join(", ")}`);
  return `Full library (id prefix / names only, use "<category>/<name>"):\n${lines.join("\n")}`;
}