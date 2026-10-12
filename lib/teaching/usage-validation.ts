// USAGE RECORDS — server-side write contract.
//
// The migration (supabase/migrations/001_initial_schema.sql) deliberately gives users no INSERT
// policy on `usage_records`: usage records are created server-side only. This module holds the
// pure validation logic so the request contract is unit-testable outside a Next.js runtime.
//
// The route handler at app/api/usage/route.ts imports this, authenticates the caller, verifies
// session ownership and inserts with the service role.

export const VALID_REQUEST_TYPES = new Set(["lesson", "step", "interruption"]);

export type UsageRequest = {
  session_id: string;
  provider: string;
  model: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  request_type: string;
};

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Validates the request body without touching the database or the session. Pure logic. */
export function validateUsageRequest(body: unknown): { valid: true; data: UsageRequest } | { valid: false; error: string; status: number } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "The request body must be an object.", status: 400 };
  }
  const { session_id, provider, model, input_tokens, output_tokens, total_tokens, request_type } = body as Record<string, unknown>;

  if (!session_id || typeof session_id !== "string") {
    return { valid: false, error: "session_id is required.", status: 400 };
  }
  if (!provider || typeof provider !== "string" || provider.trim().length === 0) {
    return { valid: false, error: "provider is required.", status: 400 };
  }
  if (!VALID_REQUEST_TYPES.has(request_type as string)) {
    return { valid: false, error: `request_type must be one of: ${[...VALID_REQUEST_TYPES].join(", ")}.`, status: 400 };
  }
  if (!isPositiveInteger(input_tokens) || !isPositiveInteger(output_tokens) || !isPositiveInteger(total_tokens)) {
    return { valid: false, error: "input_tokens, output_tokens and total_tokens must be non-negative integers.", status: 400 };
  }

  return {
    valid: true,
    data: {
      session_id,
      provider: provider.trim(),
      model: typeof model === "string" && model.trim().length > 0 ? model.trim() : null,
      input_tokens,
      output_tokens,
      total_tokens,
      request_type: request_type as string,
    },
  };
}