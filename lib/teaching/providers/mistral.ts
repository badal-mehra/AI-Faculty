// Mistral is the THIRD and FINAL teaching provider: it runs only after both Gemini and Groq could not
// answer. It reuses the SAME teaching prompt, the SAME shared JSON Schema and the SAME
// parseTeachingResponse() validation as the other providers, so the resulting TeachingResponse is
// identical in contract — there is no Mistral-specific response shape anywhere in the teaching engine.
//
// Mistral-specific concerns are isolated to this file:
//   - JSON schema mode is requested first and degraded to JSON-object mode if a model rejects it,
//   - model output is recovered from a ```json fenced block or surrounding prose before parsing,
//   - one bounded repair turn reuses the SHARED repairTurn() correction,
//   - the API key is read from the server environment only and is never sent to the client.
import { Mistral } from "@mistralai/mistralai";
import { TeachingLessonResponse, TeachingRequest, TeachingResponse } from "../types";
import { parseAllTeachingSteps, parseTeachingResponse, describeMalformedLessonSteps } from "../validation";
import { RequestPlan } from "../requestPlan";
import { ProviderError, asProviderError, statusOf, withProviderTimeout } from "./error";
import { repairTurn } from "./repair";
import { JSON_MODE_INSTRUCTIONS, jsonTeachingLessonSchema, jsonTeachingSchema } from "./jsonSchema";

// Overridable so the model can be swapped (or A/B tested) without a code change; the default is
// Mistral's own documented small general-purpose model id.
const MISTRAL_TEACHING_MODEL = process.env.MISTRAL_MODEL ?? "mistral-small-latest";

/** Bounded per-attempt timeout, matching the other providers' behaviour of never hanging a lesson. */
const MISTRAL_TIMEOUT_MS = Number(process.env.MISTRAL_TIMEOUT_MS ?? 30_000);

export const MISTRAL_TEACHING_MODEL_NAME = MISTRAL_TEACHING_MODEL;

// Some Mistral models reject json_schema; once detected, remember json_object for this process.
let preferJsonObjectMode = false;

function messagesFor(plan: RequestPlan, extraSystem = "", correction?: string) {
  return [
    { role: "system" as const, content: `${plan.system}\n\n${JSON_MODE_INSTRUCTIONS}${extraSystem}` },
    { role: "user" as const, content: correction ? `${plan.user}\n\n${correction}` : plan.user },
  ];
}

/**
 * Extracts the JSON payload from a model response.
 *
 * JSON mode does not guarantee a bare document: a model may still wrap the object in a ```json fence
 * or prefix it with a sentence. Both are recoverable, so they are unwrapped here rather than being
 * failed over to the next provider. Only genuinely unparseable text returns null.
 */
export function extractJsonPayload(content: string): unknown | null {
  const trimmed = content.trim();
  if (trimmed === "") return null;

  const direct = tryParse(trimmed);
  if (direct !== null) return direct;

  // ```json ... ``` (with or without a language tag), including an unterminated trailing fence.
  const fenced = /```(?:json)?\s*([\s\S]*?)```?/i.exec(trimmed);
  if (fenced?.[1]) {
    const parsed = tryParse(fenced[1].trim());
    if (parsed !== null) return parsed;
  }

  // Prose around the object: take the outermost balanced { ... } span.
  const balanced = firstBalancedObject(trimmed);
  if (balanced !== null) {
    const parsed = tryParse(balanced);
    if (parsed !== null) return parsed;
  }
  return null;
}

function tryParse(text: string): unknown | null {
  try {
    const value = JSON.parse(text);
    return typeof value === "object" && value !== null ? value : null;
  } catch {
    return null;
  }
}

/** Finds the first {...} span, ignoring braces inside JSON strings so a "}" in speech cannot end it. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (escaped) { escaped = false; continue; }
    if (character === "\\") { escaped = true; continue; }
    if (character === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function mistralClient(): Mistral {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new ProviderError("mistral", "Mistral is not configured on this server.", { status: 503, transient: false, configuration: true });
  }
  // Server-side only: the key is read here and never returned to the caller or logged.
  return new Mistral({ apiKey });
}

export async function generateTeachingStepWithMistral(lesson: TeachingRequest, plan: RequestPlan): Promise<TeachingResponse> {
  const mistral = mistralClient();
  try {
    // One bounded repair attempt, exactly like Gemini and Groq: an invalid field costs a repair turn,
    // not the whole lesson.
    let correction: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await requestCompletion(mistral, plan, correction);
      const content = completion?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new ProviderError("mistral", "Mistral returned an empty teaching response.", { status: 502, transient: true });

      const raw = extractJsonPayload(content);
      if (raw === null) throw new ProviderError("mistral", "Mistral returned an invalid structured response.", { status: 502, transient: true });

      const teachingResponse = parseTeachingResponse(raw);
      if (teachingResponse) return teachingResponse;
      if (attempt === 2) {
        if (process.env.NODE_ENV !== "production") console.warn("[Mistral] step response rejected twice by validation:", JSON.stringify(raw).slice(0, 400));
        throw new ProviderError("mistral", "Mistral returned unsupported board instructions.", { status: 502, transient: true });
      }
      console.warn("[Mistral] step response rejected by validation; sending one corrected retry");
      correction = repairTurn(raw);
    }
    throw new ProviderError("mistral", "Mistral returned an unsupported teaching response.", { status: 502, transient: true });
  } catch (error) {
    throw asProviderError(error, "mistral");
  }
}

export async function generateTeachingLessonWithMistral(lesson: TeachingRequest, plan: RequestPlan): Promise<TeachingLessonResponse> {
  const mistral = mistralClient();
  try {
    const completion = await withProviderTimeout("mistral", "A Mistral lesson batch", MISTRAL_TIMEOUT_MS, () => mistral.chat.complete({
      model: MISTRAL_TEACHING_MODEL,
      messages: messagesFor(plan, ` Return an object with a steps array containing the ${plan.objective.batchSize} consecutive teaching responses requested in section F, each labelled with its stage_id.`),
      temperature: 0.4,
      maxTokens: 8192,
      responseFormat: { type: "json_object" },
    }, { timeoutMs: MISTRAL_TIMEOUT_MS }));
    const content = completion?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new ProviderError("mistral", "Mistral returned an empty teaching lesson.", { status: 502, transient: true });
    const raw = extractJsonPayload(content);
    if (raw === null) throw new ProviderError("mistral", "Mistral returned an invalid structured lesson.", { status: 502, transient: true });
    const steps = parseAllTeachingSteps(raw);
    if (!steps) {
      if (process.env.NODE_ENV !== "production") console.warn("[Mistral] lesson response rejected by validation:", describeMalformedLessonSteps(raw).join("; ") || JSON.stringify(raw).slice(0, 900));
      throw new ProviderError("mistral", "Mistral returned an invalid teaching lesson.", { status: 502, transient: true });
    }
    if (process.env.NODE_ENV !== "production" && steps.length < (raw as { steps: unknown[] }).steps.length) {
      console.warn(`[Mistral] ${(raw as { steps: unknown[] }).steps.length - steps.length} malformed lesson step(s) dropped; keeping ${steps.length}: ${describeMalformedLessonSteps(raw).join("; ")}`);
    }
    return { steps };
  } catch (error) {
    throw asProviderError(error, "mistral");
  }
}

async function requestCompletion(mistral: Mistral, plan: RequestPlan, correction?: string) {
  if (!preferJsonObjectMode) {
    try {
      return await mistral.chat.complete({
        model: MISTRAL_TEACHING_MODEL,
        messages: messagesFor(plan, "", correction),
        temperature: 0.4,
        maxTokens: 2048,
        responseFormat: {
          type: "json_schema",
          jsonSchema: { name: "teaching_response", strict: false, schemaDefinition: jsonTeachingSchema as Record<string, unknown> },
        },
      }, { timeoutMs: MISTRAL_TIMEOUT_MS });
    } catch (error) {
      // Only a rejected response_format falls back; anything else is a real failure.
      if (statusOf(error) !== 400 || preferJsonObjectMode) throw error;
      preferJsonObjectMode = true;
      console.warn("[Teaching Router] Mistral json_schema rejected; switching to json_object mode");
    }
  }
  return mistral.chat.complete({
    model: MISTRAL_TEACHING_MODEL,
    messages: messagesFor(plan, "", correction),
    temperature: 0.4,
    maxTokens: 2048,
    responseFormat: { type: "json_object" },
  }, { timeoutMs: MISTRAL_TIMEOUT_MS });
}
