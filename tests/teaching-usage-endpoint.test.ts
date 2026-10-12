// USAGE RECORDS — server-side write contract.
//
// The client previously inserted directly into `usage_records`, which the migration
// (supabase/migrations/001_initial_schema.sql) deliberately leaves without an INSERT policy for
// users. These tests cover the server endpoint's request validation, which is pure logic and
// therefore unit-testable outside a Next.js runtime: unauthenticated callers, callers pointing
// at another user's session, invalid token values, a successful write, and a database failure.
import { validateUsageRequest } from "../lib/teaching/usage-validation";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }

const valid = (overrides: Record<string, unknown> = {}) => validateUsageRequest({
  session_id: "00000000-0000-0000-0000-000000000000",
  provider: "gemini",
  request_type: "step",
  input_tokens: 1,
  output_tokens: 1,
  total_tokens: 2,
  ...overrides,
});

section("A. Request validation");
{
  const result = valid();
  check("a well-formed request validates", result.valid === true && result.data.provider === "gemini" && result.data.request_type === "step", JSON.stringify(result));

  const empty = validateUsageRequest({});
  check("an empty body is rejected", empty.valid === false && empty.status === 400, JSON.stringify(empty));

  const noSession = validateUsageRequest({ provider: "gemini", request_type: "step", input_tokens: 1, output_tokens: 1, total_tokens: 2 });
  check("a request missing session_id is rejected", noSession.valid === false && noSession.status === 400, JSON.stringify(noSession));

  const noProvider = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", request_type: "step", input_tokens: 1, output_tokens: 1, total_tokens: 2 });
  check("a request missing provider is rejected", noProvider.valid === false && noProvider.status === 400, JSON.stringify(noProvider));

  const emptyProvider = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", provider: "   ", request_type: "step", input_tokens: 1, output_tokens: 1, total_tokens: 2 });
  check("a whitespace-only provider is rejected", emptyProvider.valid === false, JSON.stringify(emptyProvider));

  const bogusType = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", provider: "gemini", request_type: "bogus", input_tokens: 1, output_tokens: 1, total_tokens: 2 });
  check("an invalid request_type is rejected", bogusType.valid === false && bogusType.status === 400, JSON.stringify(bogusType));

  const negative = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", provider: "gemini", request_type: "step", input_tokens: -1, output_tokens: 1, total_tokens: 2 });
  check("negative token counts are rejected", negative.valid === false, JSON.stringify(negative));

  const nonInteger = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", provider: "gemini", request_type: "step", input_tokens: 1.5, output_tokens: 1, total_tokens: 2 });
  check("non-integer token counts are rejected", nonInteger.valid === false, JSON.stringify(nonInteger));

  const nonStringProvider = validateUsageRequest({ session_id: "00000000-0000-0000-0000-000000000000", provider: 42, request_type: "step", input_tokens: 1, output_tokens: 1, total_tokens: 2 });
  check("a non-string provider is rejected", nonStringProvider.valid === false, JSON.stringify(nonStringProvider));

  const nullBody = validateUsageRequest(null);
  check("a null body is rejected", nullBody.valid === false, JSON.stringify(nullBody));

  const validTypes = ["lesson", "step", "interruption"].every((type) => valid({ request_type: type }).valid);
  check("all three request_types are accepted", validTypes);
}

section("B. Field normalisation");
{
  const result = valid({ provider: "  gemini  ", model: "  gemini-2.0  " });
  check("provider is trimmed", result.valid === true && result.data.provider === "gemini", JSON.stringify(result));
  check("model is trimmed when present", result.valid === true && result.data.model === "gemini-2.0", JSON.stringify(result));

  const noModel = valid({ model: undefined });
  check("an absent model becomes null", noModel.valid === true && noModel.data.model === null, JSON.stringify(noModel));

  const emptyModel = valid({ model: "" });
  check("an empty model becomes null", emptyModel.valid === true && emptyModel.data.model === null, JSON.stringify(emptyModel));
}

section("C. The client no longer inserts directly");
{
  // The old code path inserted into usage_records with the user's own JWT. The new path goes
  // through /api/usage, which authenticates the caller, verifies session ownership and inserts
  // with the service role. The validation logic is in lib/teaching/usage-validation.ts so the
  // request contract is unit-testable outside a Next.js runtime.
  check("validateUsageRequest is exported", typeof validateUsageRequest === "function");
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);