// DEVELOPMENT ONLY — safe fault injection for verifying the Gemini → Groq fallback.
//
// It is completely inert in production: readTeachingSimulation() returns {} whenever
// NODE_ENV === "production", and the simulation wrappers below only act when a fault is
// explicitly present. Faults are supplied per-request via non-standard headers by a local
// test client; there is no production bypass and no hidden "force fallback" switch.
import { TeachingRequest, TeachingResponse } from "../types";
import { parseTeachingResponse } from "../validation";
import { ProviderError, TeachingProviderName } from "./error";
import { extractJsonPayload } from "./mistral";

export type GeminiFault = "sample" | "retry-success" | "unavailable" | "rate-limit" | "invalid-response" | "not-found";
export type GroqFault = "sample" | "unavailable" | "invalid-response" | "oversized";
export type MistralFault = "sample" | "unavailable" | "rate-limit" | "invalid-response" | "oversized" | "fenced-json";
export type TeachingSimulation = { gemini?: GeminiFault; groq?: GroqFault; mistral?: MistralFault };

const GEMINI_FAULTS = new Set<string>(["sample", "retry-success", "unavailable", "rate-limit", "invalid-response", "not-found"]);
const GROQ_FAULTS = new Set<string>(["sample", "unavailable", "invalid-response", "oversized"]);
const MISTRAL_FAULTS = new Set<string>(["sample", "unavailable", "rate-limit", "invalid-response", "oversized", "fenced-json"]);

export function readTeachingSimulation(request: Request): TeachingSimulation {
  if (process.env.NODE_ENV === "production") return {};
  const gemini = request.headers.get("x-teaching-simulate-gemini") ?? "";
  const groq = request.headers.get("x-teaching-simulate-groq") ?? "";
  const mistral = request.headers.get("x-teaching-simulate-mistral") ?? "";
  return {
    gemini: GEMINI_FAULTS.has(gemini) ? (gemini as GeminiFault) : undefined,
    groq: GROQ_FAULTS.has(groq) ? (groq as GroqFault) : undefined,
    mistral: MISTRAL_FAULTS.has(mistral) ? (mistral as MistralFault) : undefined,
  };
}

// Deterministic sample payloads. Both are pushed through the SAME shared validator.
const geminiRaw = (lesson: TeachingRequest) => ({
  speech: "Gemini sample (development simulation): 50 root banate hain aur 30 ko left mein rakhte hain.",
  board_actions: [
    { action: "clear" },
    { action: "draw_node", id: "node-50", value: "50" },
    { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
    { action: "connect", from: "node-50", to: "node-30" },
  ],
  lesson_step: lesson.lessonStep,
  next_step: lesson.lessonStep + 1,
});

const groqRaw = (lesson: TeachingRequest) => ({
  speech: "Groq fallback: 50 root banate hain aur 30 ko 50 se compare karke left side rakhte hain.",
  board_actions: [
    { action: "clear" },
    { action: "draw_node", id: "node-50", value: "50" },
    { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
    { action: "connect", from: "node-50", to: "node-30" },
    { action: "highlight", target: "node-30" },
  ],
  lesson_step: lesson.lessonStep,
  next_step: lesson.lessonStep + 1,
});

export async function simulateGemini(simulation: TeachingSimulation, lesson: TeachingRequest, attempt: number, real: () => Promise<TeachingResponse>): Promise<TeachingResponse> {
  switch (simulation.gemini) {
    case "sample": return validated("gemini", geminiRaw(lesson));
    case "retry-success": if (attempt === 1) throw new ProviderError("gemini", "Simulated Gemini transient failure on first attempt (development simulation).", { status: 503, transient: true }); return validated("gemini", geminiRaw(lesson));
    case "unavailable": throw new ProviderError("gemini", "Simulated Gemini 503 UNAVAILABLE (development simulation).", { status: 503, transient: true });
    case "rate-limit": throw new ProviderError("gemini", "Simulated Gemini 429 RESOURCE_EXHAUSTED (development simulation).", { status: 429, transient: true });
    case "invalid-response": throw new ProviderError("gemini", "Simulated Gemini response rejected by validation (development simulation).", { status: 502, transient: true });
    // A model that does not exist for this key: the router must disable it, not retry it.
    case "not-found": throw new ProviderError("gemini", "Simulated Gemini 404 model not found (development simulation).", { status: 404, transient: false });
    default: return real();
  }
}

export async function simulateGroq(simulation: TeachingSimulation, lesson: TeachingRequest, real: () => Promise<TeachingResponse>): Promise<TeachingResponse> {
  switch (simulation.groq) {
    case "sample": return validated("groq", groqRaw(lesson));
    case "unavailable": throw new ProviderError("groq", "Simulated Groq 503 UNAVAILABLE (development simulation).", { status: 503, transient: true });
    // Demonstrates that invalid provider output is rejected by the SHARED validator.
    case "invalid-response": return validated("groq", { speech: 42, board_actions: "not-an-array", lesson_step: "one", next_step: null });
    // Fails ONCE per lesson step with a size rejection, so the router's compaction path is testable:
    // the second attempt (with a compacted request) must succeed.
    case "oversized": {
      const key = `oversized:${lesson.lessonStep}`;
      if (!oversizedFired.has(key)) {
        oversizedFired.add(key);
        throw new ProviderError("groq", "Simulated Groq 413 request too large (development simulation).", { status: 413, transient: true });
      }
      // The compacted retry is served successfully, which is exactly what the router must achieve.
      return validated("groq", groqRaw(lesson));
    }
    default: return real();
  }
}

const mistralRaw = (lesson: TeachingRequest) => ({
  speech: "Mistral fallback: 50 root banate hain aur 30 ko 50 se compare karke left side rakhte hain.",
  board_actions: [
    { action: "clear" },
    { action: "draw_node", id: "node-50", value: "50" },
    { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
    { action: "connect", from: "node-50", to: "node-30" },
  ],
  lesson_step: lesson.lessonStep,
  next_step: lesson.lessonStep + 1,
});

export async function simulateMistral(simulation: TeachingSimulation, lesson: TeachingRequest, real: () => Promise<TeachingResponse>): Promise<TeachingResponse> {
  switch (simulation.mistral) {
    case "sample": return validated("mistral", mistralRaw(lesson));
    case "unavailable": throw new ProviderError("mistral", "Simulated Mistral 503 UNAVAILABLE (development simulation).", { status: 503, transient: true });
    case "rate-limit": throw new ProviderError("mistral", "Simulated Mistral 429 rate limited (development simulation).", { status: 429, transient: true });
    // Demonstrates that invalid provider output is rejected by the SHARED validator.
    case "invalid-response": return validated("mistral", { speech: 42, board_actions: "not-an-array", lesson_step: "one", next_step: null });
    // Fails ONCE per lesson step with a size rejection, so the router's compaction path is testable for
    // Mistral exactly as it already is for Groq.
    case "oversized": {
      const key = `mistral-oversized:${lesson.lessonStep}`;
      if (!oversizedFired.has(key)) {
        oversizedFired.add(key);
        throw new ProviderError("mistral", "Simulated Mistral 413 request too large (development simulation).", { status: 413, transient: true });
      }
      return validated("mistral", mistralRaw(lesson));
    }
    // The lesson endpoint still answers: a fenced JSON block is unwrapped rather than failed over.
    case "fenced-json": {
      const parsed = extractJsonPayload("```json\n" + JSON.stringify(mistralRaw(lesson)) + "\n```");
      return validated("mistral", parsed);
    }
    default: return real();
  }
}

const oversizedFired = new Set<string>();
function validated(provider: TeachingProviderName, raw: unknown): TeachingResponse {
  const parsed = parseTeachingResponse(raw);
  if (!parsed) throw new ProviderError(provider, "Simulated provider response was rejected by the shared validation layer.", { status: 502, transient: false });
  return parsed;
}
