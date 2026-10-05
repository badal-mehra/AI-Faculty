import { NextResponse } from "next/server";
import { MOCK_TEACHING_COMPLETE, MOCK_TEACHING_STEPS } from "@/lib/teaching/mockLesson";
import { describeTeachingRequestError, parseTeachingRequest, parseTeachingResponse } from "@/lib/teaching/validation";

export const runtime = "nodejs";

// DEVELOPMENT ONLY endpoint.
//
// It mirrors the /api/teaching response contract but serves a deterministic offline
// Binary Search Tree lesson so the complete pipeline is testable without Gemini.
// The raw mock payload is still pushed through `parseTeachingResponse()`, so the
// existing validation, board actions and SVG board renderer are exercised exactly
// like the real teaching flow. Gemini behaviour is untouched.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "MOCK_TEACHING_DISABLED", message: "Mock Teaching Mode is available in development only." }, { status: 403 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is not valid JSON." }, { status: 400 }); }
  const lesson = parseTeachingRequest(body);
  if (!lesson) {
    console.warn("[Mock Teaching API] rejected request:", describeTeachingRequestError(body));
    return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is missing required information." }, { status: 400 });
  }

  const raw = MOCK_TEACHING_STEPS.find((step) => step.lesson_step === lesson.lessonStep) ?? MOCK_TEACHING_COMPLETE;
  const teachingResponse = parseTeachingResponse(raw);
  if (!teachingResponse) {
    console.error("[Mock Teaching API] validation failed", { lessonStep: lesson.lessonStep });
    return NextResponse.json({ error: "TEACHING_SERVICE_ERROR", message: "The mock teaching step failed validation." }, { status: 502 });
  }

  console.info("[Mock Teaching API] served step", { lessonStep: lesson.lessonStep, nextStep: teachingResponse.next_step, actionCount: teachingResponse.board_actions.length });
  return NextResponse.json(teachingResponse);
}
