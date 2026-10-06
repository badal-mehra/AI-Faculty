// REAL PROVIDER TOKEN USAGE — the accounting for what a teaching request actually cost.
//
// One rule governs this whole file: a token count may only be produced from something a provider
// REPORTED. The request planner produces a token figure too (`plan.size.totalTokens`), but that is an
// ESTIMATE of how large the outgoing request is — it is measured from the prompt and the schema before
// anything is sent, it never sees the answer, and it is deliberately not reachable from anything here. A
// developer reading a usage indicator is asking what the request was charged; an estimate printed in the
// same place answers a different question while looking as though it does not, and there is no way to
// tell the two apart afterwards.
//
// So: unavailable is a first-class answer (null, rendered as an em dash), never zero, and never a guess.
import type { ProviderTokenUsage } from "./types";

/** Shown wherever the providers reported nothing. Not a zero — a zero would be a claim. */
export const UNKNOWN_TOKENS = "\u2014";

/** The exact wording of the indicator, defined once so the UI and its tests cannot drift apart. */
export const TOKEN_USAGE_LABEL = "Tokens used";

/** A count a provider reported: a finite, non-negative integer. Anything else is not a measurement. */
function reported(value: number | null | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.trunc(value);
}

/**
 * What ONE attempt consumed, or null when the provider reported nothing usable.
 *
 * An explicit total wins over the split counts, because it is the provider's own arithmetic over parts
 * this code cannot see (Gemini counts thoughts and tool-use prompt tokens inside it, for instance). When
 * there is no total, only the components the provider DID report are added — a provider that reports one
 * half and omits the other is missing a measurement, and supplying the missing half would be an estimate.
 */
export function totalOfUsage(usage: ProviderTokenUsage | null | undefined): number | null {
  if (!usage) return null;
  const total = reported(usage.totalTokens);
  if (total !== undefined) return total;
  const input = reported(usage.inputTokens);
  const output = reported(usage.outputTokens);
  if (input === undefined && output === undefined) return null;
  return (input ?? 0) + (output ?? 0);
}

/**
 * The total across every attempt made for one request.
 *
 * A request that fell back through providers, or was repaired after a response failed validation, really
 * did cost each of those calls, so all of them are added. Attempts that reported nothing contribute
 * nothing and do not make the result unavailable on their own; if none of them reported anything, the
 * answer is null rather than 0.
 */
export function sumUsage(attempts: readonly (ProviderTokenUsage | null | undefined)[]): number | null {
  let total = 0;
  let measured = false;
  for (const attempt of attempts) {
    const value = totalOfUsage(attempt);
    if (value === null) continue;
    total += value;
    measured = true;
  }
  return measured ? total : null;
}

/**
 * The `usage` field to spread onto a provider result.
 *
 * Absent rather than empty when usage is unavailable, so a payload that never reported usage stays
 * byte-identical to one from before this existed and no reader has to distinguish "no usage" from "none".
 */
export function usageField(total: number | null): { usage?: ProviderTokenUsage } {
  return total === null ? {} : { usage: { totalTokens: total } };
}

/**
 * `6,842`, or an em dash when there is nothing to report.
 *
 * The grouping is applied here rather than through `toLocaleString` so the separator is the same in the
 * browser, in a server log and in a test on any machine — a usage readout whose digits move with the host
 * locale is one nobody trusts twice.
 */
export function formatTokens(total: number | null): string {
  if (total === null || !Number.isFinite(total)) return UNKNOWN_TOKENS;
  const digits = Math.abs(Math.trunc(total)).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return total < 0 ? `-${grouped}` : grouped;
}

/** The whole indicator, e.g. `Tokens used: 6,842` / `Tokens used: —`. */
export function formatTokenUsage(total: number | null): string {
  return `${TOKEN_USAGE_LABEL}: ${formatTokens(total)}`;
}