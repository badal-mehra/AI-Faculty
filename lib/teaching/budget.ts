// REQUEST SIZE BUDGET.
//
// Groq's free tier allows 8,000 tokens per minute, and a lesson request counts the system prompt,
// the user prompt AND the structured-output schema. We therefore never aim at the limit: we
// estimate every request before sending it and compact it until it fits comfortably.
//
// The estimator is intentionally pessimistic (see estimateTokens): JSON and identifier-heavy text
// tokenize worse than prose, so dividing by 3.5 characters per token under-counts rather than
// over-counts, which is the safe direction for a guard.
import { ContextLevel } from "./context";

// The teaching request carries the lesson objective (the stage list the lesson is planned against), the
// 2D action vocabulary (array, stack, queue, tree, graph, sequence, pipeline, timeline, comparison) and
// now the pedagogical contract (teaching intent, reasoning, and a formula with its symbols). Every one of
// those is real teaching content, and the wire schema has to name every action because these providers
// reject undeclared properties.
//
// The budget has been resized twice for that, always keeping a reserve under the provider's ~8000
// tokens-per-minute ceiling: what is left unspent is what a rejected request can be retried at the next
// context level without hitting the same wall. The reserve is now 600 tokens for the budget and 400 for
// the hard limit.
//
// It also stopped being the only lever. The wire schema is now built from the families the prompt is
// actually documenting, so a 2D lesson is not billed for the 3D action vocabulary at all — worth about a
// thousand tokens a batch. That is what paid for the pedagogical layer without any of it being cut, and
// it means the reserve above is genuinely reserve rather than slack a lesson was already using.
//
// The three compaction levels still protect the busiest lessons, so this is a resize and not a
// relaxation: anything that cannot be compacted below the hard limit is still rejected outright.
export const TOKEN_BUDGET = 7500;
export const TOKEN_HARD_LIMIT = 7700;

/** Chars-per-token divisor. 3.5 is deliberately conservative for JSON + code-like prompts. */
const CHARS_PER_TOKEN = 3.5;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export type RequestSize = {
  systemTokens: number;
  userTokens: number;
  schemaTokens: number;
  totalTokens: number;
  chars: number;
};

export function measureRequest(system: string, user: string, schemaJson: string): RequestSize {
  const systemTokens = estimateTokens(system);
  const userTokens = estimateTokens(user);
  const schemaTokens = estimateTokens(schemaJson);
  return {
    systemTokens,
    userTokens,
    schemaTokens,
    totalTokens: systemTokens + userTokens + schemaTokens,
    chars: system.length + user.length + schemaJson.length,
  };
}

export type FitsDecision = { fits: boolean; level: ContextLevel; reason?: string };

/**
 * Chooses the most detailed context level whose request fits the budget. Order matters: a compacted
 * asset list is dropped before teaching context is, and teaching context is dropped before the
 * instructions the model needs to produce valid actions at all.
 */
export function chooseLevel(sizes: Record<ContextLevel, RequestSize>): FitsDecision {
  if (sizes.full.totalTokens <= TOKEN_BUDGET) return { fits: true, level: "full" };
  if (sizes.compact.totalTokens <= TOKEN_BUDGET) {
    return { fits: true, level: "compact", reason: "full request exceeded the budget; using compact context" };
  }
  if (sizes.minimal.totalTokens <= TOKEN_HARD_LIMIT) {
    return { fits: true, level: "minimal", reason: "compact request exceeded the budget; using minimal context" };
  }
  return { fits: false, level: "minimal", reason: "request cannot be compacted below the hard limit" };
}