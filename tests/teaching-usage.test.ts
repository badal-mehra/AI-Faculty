// Regression tests for token-usage attribution and provider/model reporting.
//
// Covers the fixes for:
//   - Gemini never extracting token usage (callGemini now captures usageMetadata),
//   - the router not reporting which model answered a request,
//   - the interruption path attributing the provider as "unknown".
// These run through the development simulation, so no real provider credentials are needed.
import { usageFromGeminiResponse, GEMINI_TEACHING_MODELS } from "../lib/teaching/providers/gemini";
import { sumUsage, usageField, totalOfUsage } from "../lib/teaching/usage";
import { generateTeachingStep } from "../lib/teaching/providers/router";
import { clearGeminiHealth } from "../lib/teaching/providers/health";
import { emptyVisual3DScene } from "../lib/visual3d/types";
import { TeachingRequest } from "../lib/teaching/types";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }

const baseRequest = (question: string, overrides: Partial<TeachingRequest> = {}): TeachingRequest => ({
  question,
  language: "English",
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  visualState: { objects: [], tick: 0 },
  visualState3d: emptyVisual3DScene(),
  ...overrides,
});

section("A. Gemini usage extraction");
{
  check("no usageMetadata yields undefined", usageFromGeminiResponse({}) === undefined);
  check("null usageMetadata yields undefined", usageFromGeminiResponse({ usageMetadata: null }) === undefined);
  check("undefined usageMetadata yields undefined", usageFromGeminiResponse({ usageMetadata: undefined }) === undefined);

  const full = usageFromGeminiResponse({ usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 } });
  check("full metadata maps all three counts", full?.inputTokens === 10 && full?.outputTokens === 20 && full?.totalTokens === 30, JSON.stringify(full));

  // Absent fields are omitted, never coerced to zero — an absent count is "not reported", not a measurement.
  const partial = usageFromGeminiResponse({ usageMetadata: { totalTokenCount: 99 } });
  check("partial metadata keeps only the reported field", partial?.totalTokens === 99 && partial?.inputTokens === undefined && partial?.outputTokens === undefined, JSON.stringify(partial));

  const onlyInput = usageFromGeminiResponse({ usageMetadata: { promptTokenCount: 7 } });
  check("input-only metadata keeps only inputTokens", onlyInput?.inputTokens === 7 && onlyInput?.outputTokens === undefined && onlyInput?.totalTokens === undefined, JSON.stringify(onlyInput));
}

section("B. usage reduction rules");
{
  check("a missing total falls back to input + output", totalOfUsage({ inputTokens: 5, outputTokens: 7 }) === 12);
  check("an explicit total wins over the component sum", totalOfUsage({ inputTokens: 5, outputTokens: 7, totalTokens: 20 }) === 20);
  check("an absent usage stays null, never zero", totalOfUsage(undefined) === null && totalOfUsage(null) === null);
  check("usageField is absent when nothing was measured", usageField(null).usage === undefined);
  check("usageField exposes totalTokens when measured", usageField(42).usage?.totalTokens === 42);
  check("sumUsage adds measured attempts and skips nulls", sumUsage([{ totalTokens: 10 }, undefined, { totalTokens: 5 }]) === 15);
  check("sumUsage is null when nothing was measured", sumUsage([undefined, null]) === null);
}

section("C. Router reports provider + model attribution");
async function routerAttribution(): Promise<void> {
  clearGeminiHealth();

  // Gemini via the development simulator: no real credentials are called, and the answered
  // provider + model must still be reported on the step result.
  const gemini = await generateTeachingStep(baseRequest("Explain binary search trees."), { gemini: "sample" }).catch((error) => error);
  check("a Gemini-simulated step reports provider = gemini", gemini?.provider === "gemini", String(gemini?.provider ?? ""));
  check("a Gemini-simulated step reports a tracked model", Boolean(gemini?.model) && (GEMINI_TEACHING_MODELS as readonly string[]).includes(gemini?.model as string), String(gemini?.model ?? ""));

  clearGeminiHealth();

  // Full failover: Gemini and Groq unavailable, Mistral answers. The provider identity must be
  // reported as mistral (not "unknown") and a model must be tracked.
  const mistral = await generateTeachingStep(baseRequest("Explain binary search trees."), {
    gemini: "unavailable", groq: "unavailable", mistral: "sample",
  }).catch((error) => error);
  check("a Mistral-simulated step reports provider = mistral", mistral?.provider === "mistral", String(mistral?.provider ?? ""));
  check("a Mistral-simulated step reports a tracked model", Boolean(mistral?.model), String(mistral?.model ?? ""));
  check("a Mistral-simulated step is flagged as a fallback", mistral?.fallback === true);
}

routerAttribution()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
