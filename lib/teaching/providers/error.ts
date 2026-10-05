// Server-side teaching provider primitives.
// This module is imported ONLY by the server-side teaching route / router. It never
// touches API keys itself, and it must never be imported from a client component.

// Provider chain order is Gemini -> Groq -> Mistral. Mistral is the LAST fallback: it only runs when
// both earlier providers could not answer.
export type TeachingProviderName = "gemini" | "groq" | "mistral";

export type ProviderErrorOptions = {
  status?: number;
  /** Availability-style failures (429 / 5xx / network) may be retried and fall back to Groq. */
  transient: boolean;
  /** Missing credentials / bad configuration. Never retried and never triggers a fallback. */
  configuration?: boolean;
};

export class ProviderError extends Error {
  readonly provider: TeachingProviderName;
  readonly status?: number;
  readonly transient: boolean;
  readonly configuration: boolean;

  constructor(provider: TeachingProviderName, message: string, options: ProviderErrorOptions) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = options.status;
    this.transient = options.transient;
    this.configuration = options.configuration ?? false;
  }
}

// Availability candidates from the spec: 408 timeout, 429 RESOURCE_EXHAUSTED, and 5xx
// (500 INTERNAL, 502 BAD_GATEWAY, 503 UNAVAILABLE, 504 DEADLINE_EXCEEDED).
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

// Best-effort HTTP status extraction across provider SDK error shapes.
export function statusOf(error: unknown): number | undefined {
  if (typeof error === "object" && error !== null) {
    const candidate = error as { status?: unknown; statusCode?: unknown; code?: unknown };
    for (const value of [candidate.status, candidate.statusCode, candidate.code]) {
      if (typeof value === "number" && Number.isFinite(value)) return value;
    }
  }
  const message = error instanceof Error ? error.message : "";
  const embeddedCode = /"code"\s*:\s*(\d{3})/.exec(message);
  if (embeddedCode) return Number(embeddedCode[1]);
  const bare = /\b(429|500|502|503|504)\b/.exec(message);
  return bare ? Number(bare[1]) : undefined;
}

// Network / upstream-availability signatures when the SDK does not surface a status.
const NETWORK_OR_AVAILABILITY = /ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket hang up|fetch failed|network|timed out|timeout|UNAVAILABLE|RESOURCE_EXHAUSTED|overloaded|high demand|rate limit/i;

export function asProviderError(error: unknown, provider: TeachingProviderName): ProviderError {
  if (error instanceof ProviderError) return error;
  const status = statusOf(error);
  const message = error instanceof Error ? error.message : "Unknown provider error.";
  // Known status -> classify by status. Unknown status -> only retry/fallback when it looks
  // like a network or upstream-availability problem, never for obvious programming errors.
  const transient = status !== undefined ? isTransientStatus(status) : error instanceof TypeError || NETWORK_OR_AVAILABILITY.test(message);
  return new ProviderError(provider, message, { status, transient });
}

/**
 * A hard wall-clock cap on one provider call.
 *
 * The SDK timeouts are advisory and have been observed not to fire, which let a single lesson batch
 * hang for fifteen minutes and stall a classroom that was otherwise teaching fine. A lesson is made of
 * many batches, so the right answer to a slow batch is to give up on THIS attempt and let the router
 * move on — never to hold the student. The losing promise keeps a handler attached so an eventual
 * rejection is never an unhandled rejection.
 */
export async function withProviderTimeout<T>(
  provider: TeachingProviderName,
  description: string,
  milliseconds: number,
  run: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = milliseconds >= 10_000 ? `${Math.round(milliseconds / 1000)}s` : `${Math.round(milliseconds)}ms`;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new ProviderError(provider, `${description} did not answer within ${limit}.`, { status: 504, transient: true })),
      milliseconds,
    );
  });
  try {
    return await Promise.race([run(), guard]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
