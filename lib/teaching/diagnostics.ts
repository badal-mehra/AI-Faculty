// PROVIDER DIAGNOSTICS.
//
// Logs request SIZES only — provider, model, estimated tokens, context sizes and the asset count.
// No API keys, no headers, no prompt bodies, no model output are ever logged here.
import { RequestSize } from "./budget";
import { TeachingProviderName } from "./providers/error";

export type ProviderRequestLog = {
  provider: TeachingProviderName;
  model: string;
  path: "lesson" | "step";
  lessonStep: number;
  level: string;
  size: RequestSize;
  assetCount: number;
  stateChars: number;
  speechChars: number;
  /** Objective state for this request: which stage of a how-long lesson is being generated. */
  lesson?: {
    topic: string;
    depth: string;
    stages: number;
    covered: number;
    stepsDelivered: number;
    currentStage: string | null;
  };
  /** Present when a request was compacted or retried. */
  note?: string;
};

export function logProviderRequest(entry: ProviderRequestLog): void {
  console.info("[teaching:request]", JSON.stringify({
    provider: entry.provider,
    model: entry.model,
    path: entry.path,
    lessonStep: entry.lessonStep,
    level: entry.level,
    estimatedTokens: entry.size.totalTokens,
    systemTokens: entry.size.systemTokens,
    userTokens: entry.size.userTokens,
    schemaTokens: entry.size.schemaTokens,
    chars: entry.size.chars,
    assetCount: entry.assetCount,
    stateChars: entry.stateChars,
    speechChars: entry.speechChars,
    ...(entry.lesson ? { lesson: entry.lesson } : {}),
    ...(entry.note ? { note: entry.note } : {}),
  }));
}

export function logProviderOutcome(entry: {
  provider: TeachingProviderName;
  model: string;
  lessonStep: number;
  status?: number;
  outcome: "success" | "transient" | "rate-limited" | "not-found" | "oversized" | "invalid-response" | "timeout";
  latencyMs: number;
  note?: string;
}): void {
  console.warn("[teaching:provider]", JSON.stringify({ ...entry }));
}

/**
 * THE VISUAL CONTRACT, MEASURED.
 *
 * Every other metric here describes the transport. This one describes the thing that actually decides
 * whether a lesson teaches: how many of the actions the model ASKED FOR reached the board. A lesson can
 * have a perfect response, no errors, and a blank board — that is what "the model drew 14 things and we
 * used 0" looks like, and until this was logged the only symptom was a screenshot.
 *
 * Counts, reasons and action NAMES only. No speech, no prompt text, no keys.
 */
export type VisualContractLog = {
  lessonStep: number;
  /** Raw actions the model produced, before any parsing. */
  requested2d: number;
  requested3d: number;
  requestedBoard: number;
  accepted2d: number;
  accepted3d: number;
  acceptedBoard: number;
  /** Applied, but after a bounded deterministic fix (a field alias, a derived id, code routed to a listing). */
  repaired2d: number;
  dropped2d: number;
  dropped3d: number;
  /** Which family the step will actually render through. */
  representation: "2d" | "3d" | "board" | "none";
  /** Action names that were dropped, so a systematic contract mismatch is obvious in one glance. */
  droppedNames: string[];
};

export function logVisualContract(entry: VisualContractLog): void {
  const summary = {
    lessonStep: entry.lessonStep,
    requested: { "2d": entry.requested2d, "3d": entry.requested3d, board: entry.requestedBoard },
    accepted: { "2d": entry.accepted2d, "3d": entry.accepted3d, board: entry.acceptedBoard },
    repaired2d: entry.repaired2d,
    dropped: { "2d": entry.dropped2d, "3d": entry.dropped3d },
    representation: entry.representation,
    ...(entry.droppedNames.length > 0 ? { droppedNames: entry.droppedNames.slice(0, 12) } : {}),
  };
  // Healthy steps are silent: a log line per step trains everyone to ignore the log, which is how a
  // regression that drops every action can ship unnoticed.
  const lossy = entry.dropped2d + entry.dropped3d > 0 || entry.repaired2d > 0;
  const method = lossy ? "warn" : "info";
  if (method === "warn") console.warn("[teaching:visual]", JSON.stringify(summary));
  else if (process.env.NODE_ENV !== "production") console.info("[teaching:visual]", JSON.stringify(summary));
}