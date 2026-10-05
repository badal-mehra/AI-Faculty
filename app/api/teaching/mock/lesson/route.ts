import { NextResponse } from "next/server";
import { MOCK_TEACHING_STEPS } from "@/lib/teaching/mockLesson";
import { describeTeachingRequestError, parseTeachingRequest, parseTeachingResponse } from "@/lib/teaching/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "MOCK_TEACHING_DISABLED", message: "Mock Teaching Mode is available in development only." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is not valid JSON." }, { status: 400 }); }
  const lesson = parseTeachingRequest(body);
  if (!lesson) {
    console.warn("[Mock Teaching Lesson API] rejected request:", describeTeachingRequestError(body));
    return NextResponse.json({ error: "INVALID_REQUEST", message: "The lesson request is missing required information." }, { status: 400 });
  }
  const steps = MOCK_TEACHING_STEPS
    .filter((step) => step.lesson_step >= lesson.lessonStep)
    .slice(0, 5)
    .map(parseTeachingResponse)
    .filter((step): step is NonNullable<typeof step> => step !== null);
  if (steps.length === 0) return NextResponse.json({ error: "TEACHING_SERVICE_ERROR", message: "The mock teaching lesson failed validation." }, { status: 502 });
  return NextResponse.json({ steps });
}
