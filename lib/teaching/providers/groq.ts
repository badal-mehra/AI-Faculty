// Groq is the FALLBACK teaching provider (used only when Gemini fails transiently).
// It reuses the SAME teaching prompt and the SAME parseTeachingResponse() validation as
// Gemini, so the resulting TeachingResponse is identical in contract. Groq-specific
// structured-output differences are isolated here.
import Groq from "groq-sdk";
import { TeachingLessonResponse, TeachingRequest, TeachingResponse } from "../types";
import { parseAllTeachingSteps, parseTeachingResponse, describeMalformedLessonSteps } from "../validation";
import { RequestPlan } from "../requestPlan";
import { ProviderError, asProviderError, statusOf, withProviderTimeout } from "./error";
import { repairTurn } from "./repair";
import { JSON_MODE_INSTRUCTIONS, jsonTeachingLessonSchema as groqTeachingLessonSchema, jsonTeachingSchema as groqTeachingSchema } from "./jsonSchema";

// Current production Groq model (OpenAI gpt-oss 120B) — reasoning-capable and recommended
// by Groq for structured outputs. See console.groq.com/docs/models. The id is overridable so the model
// can be swapped (or A/B tested) without a code change; it is never invented — the default comes from
// Groq's own model documentation and the fallback list is verified against models.list().
const GROQ_TEACHING_MODEL = process.env.GROQ_TEACHING_MODEL ?? "openai/gpt-oss-120b";
const GROQ_TEACHING_FALLBACK_MODELS = ["openai/gpt-oss-20b"];

// The JSON Schema that Groq is asked to follow is the SHARED teaching schema (./jsonSchema), shared with
// Mistral so both OpenAI-compatible providers always describe the identical teaching contract.

const GROQ_JSON_INSTRUCTIONS = JSON_MODE_INSTRUCTIONS;

// Some Groq models/plans reject json_schema; once detected, remember json_object for this process.
let preferJsonObjectMode = false;

export const GROQ_TEACHING_MODEL_NAME = GROQ_TEACHING_MODEL;

/** A lesson batch is a long generation; it still must not be able to hang a classroom. */
const LESSON_TIMEOUT_MS = Number(process.env.GROQ_LESSON_TIMEOUT_MS ?? 90_000);

function messagesFor(plan: RequestPlan, extraSystem = "", correction?: string) {
  return [
    { role: "system" as const, content: `${plan.system}\n\n${GROQ_JSON_INSTRUCTIONS}${extraSystem}` },
    { role: "user" as const, content: correction ? `${plan.user}\n\n${correction}` : plan.user },
  ];
}

export async function generateTeachingStepWithGroq(lesson: TeachingRequest, plan: RequestPlan): Promise<TeachingResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new ProviderError("groq", "Groq is not configured on this server.", { status: 503, transient: false, configuration: true });
  }

  try {
    const groq = new Groq({ apiKey });
    // One bounded repair attempt: an invalid field costs a repair turn, not the whole lesson.
    let correction: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const completion = await requestCompletion(groq, plan, correction);
      const content = completion.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) throw new ProviderError("groq", "Groq returned an empty teaching response.", { status: 502, transient: true });

      let raw: unknown;
      try { raw = JSON.parse(content); } catch { throw new ProviderError("groq", "Groq returned an invalid structured response.", { status: 502, transient: true }); }

      const teachingResponse = parseTeachingResponse(raw);
      if (teachingResponse) return teachingResponse;
      if (attempt === 2) {
        if (process.env.NODE_ENV !== "production") console.warn("[Groq] step response rejected twice by validation:", JSON.stringify(raw).slice(0, 400));
        throw new ProviderError("groq", "Groq returned unsupported board instructions.", { status: 502, transient: true });
      }
      console.warn("[Groq] step response rejected by validation; sending one corrected retry");
      correction = repairTurn(raw);
    }
    throw new ProviderError("groq", "Groq returned an unsupported teaching response.", { status: 502, transient: true });
  } catch (error) {
    throw asProviderError(error, "groq");
  }
}

export async function generateTeachingLessonWithGroq(lesson: TeachingRequest, plan: RequestPlan): Promise<TeachingLessonResponse> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ProviderError("groq", "Groq is not configured on this server.", { status: 503, transient: false, configuration: true });

  try {
    const groq = new Groq({ apiKey });
    const completion = await withProviderTimeout("groq", "A Groq lesson batch", LESSON_TIMEOUT_MS, () => requestLessonCompletion(groq, plan));
    const content = completion.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new ProviderError("groq", "Groq returned an empty teaching lesson.", { status: 502, transient: true });
    let raw: unknown;
    try { raw = JSON.parse(content); } catch { throw new ProviderError("groq", "Groq returned an invalid structured lesson.", { status: 502, transient: true }); }
    const steps = parseAllTeachingSteps(raw);
    if (!steps) {
      if (process.env.NODE_ENV !== "production") console.warn("[Groq] lesson response rejected by validation:", describeMalformedLessonSteps(raw).join("; ") || JSON.stringify(raw).slice(0, 900));
      throw new ProviderError("groq", "Groq returned an invalid teaching lesson.", { status: 502, transient: true });
    }
    if (process.env.NODE_ENV !== "production" && steps.length < (raw as { steps: unknown[] }).steps.length) {
      console.warn(`[Groq] ${(raw as { steps: unknown[] }).steps.length - steps.length} malformed lesson step(s) dropped; keeping ${steps.length}: ${describeMalformedLessonSteps(raw).join("; ")}`);
    }
    return { steps };
  } catch (error) {
    throw asProviderError(error, "groq");
  }
}

async function requestCompletion(groq: Groq, plan: RequestPlan, correction?: string) {
  if (!preferJsonObjectMode) {
    try {
      return await groq.chat.completions.create({
        model: GROQ_TEACHING_MODEL,
        messages: messagesFor(plan, "", correction),
        temperature: 0.4,
        max_tokens: 2048,
        response_format: { type: "json_schema", json_schema: { name: "teaching_response", strict: false, schema: groqTeachingSchema } },
      });
    } catch (error) {
      // Only a rejected response_format falls back; anything else is a real failure.
      if (statusOf(error) !== 400 || preferJsonObjectMode) throw error;
      preferJsonObjectMode = true;
      console.warn("[Teaching Router] Groq json_schema rejected; switching to json_object mode");
    }
  }
  return groq.chat.completions.create({
    model: GROQ_TEACHING_MODEL,
    messages: messagesFor(plan, "", correction),
    temperature: 0.4,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  });
}

async function requestLessonCompletion(groq: Groq, plan: RequestPlan) {
  return groq.chat.completions.create({
    model: GROQ_TEACHING_MODEL,
    messages: messagesFor(plan, ` Return an object with a steps array containing the ${plan.objective.batchSize} consecutive teaching responses requested in section F, each labelled with its stage_id.`),
    temperature: 0.4,
    max_tokens: 8192,
    response_format: { type: "json_schema", json_schema: { name: "teaching_lesson", strict: false, schema: groqTeachingLessonSchema } },
  });
}
