import { NextResponse } from "next/server";
import { describeTeachingRequestError, parseTeachingRequest } from "@/lib/teaching/validation";
import { ProviderError } from "@/lib/teaching/providers/error";
import { readTeachingSimulation } from "@/lib/teaching/providers/devSimulation";
import { generateTeachingStep } from "@/lib/teaching/providers/router";

export const runtime = "nodejs";

// Server-only secrets: never logged, never returned, never sent to the client.
// Every configured provider key must appear here, or an upstream error message that quotes the key
// would be echoed back to the client verbatim.
const secrets = () => [process.env.GEMINI_API_KEY, process.env.GROQ_API_KEY, process.env.MISTRAL_API_KEY].filter((value): value is string => typeof value === "string" && value.length > 0);
const redact = (message: string) => secrets().reduce((acc, secret) => acc.replaceAll(secret, "[REDACTED]"), message);

// Thin route: validate the request, then delegate to the teaching router
// (Gemini model pool -> Groq -> Mistral). The client sees one contract.
// Used ONLY for explicit student interruption / follow-up questions.
export async function POST(request: Request) {
  console.info("[Teaching API] request received");

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is not valid JSON." }, { status: 400 }); }
  const lesson = parseTeachingRequest(body);
  if (!lesson) {
    console.warn("[Teaching API] rejected request:", describeTeachingRequestError(body));
    return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is missing required information." }, { status: 400 });
  }

  const simulation = readTeachingSimulation(request);

  try {
    const result = await generateTeachingStep(lesson, simulation);
    return NextResponse.json(result.response, { headers: { "X-Teaching-Provider": result.provider } });
  } catch (error) {
    if (error instanceof ProviderError && error.configuration) {
      console.error("[Teaching API] teaching service not configured", { provider: error.provider });
      return NextResponse.json({ error: "TEACHING_SERVICE_UNAVAILABLE", message: "The teaching service has not been configured on this server." }, { status: 503 });
    }
    const details = error instanceof Error ? redact(error.message) : "Unknown error";
    console.error("[Teaching API] teaching step failed:", details);
    return NextResponse.json({ error: "TEACHING_SERVICE_ERROR", message: "The teaching service could not complete this teaching step. Please try again." }, { status: 502 });
  }
}
