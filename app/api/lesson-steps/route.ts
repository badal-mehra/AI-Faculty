import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();

  try {
    const body = await request.json();
    const { session_id, steps } = body;

    if (!session_id || !Array.isArray(steps)) {
      return NextResponse.json({ error: "Invalid request: session_id and steps array required" }, { status: 400 });
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from("teaching_sessions")
      .select("id")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Upsert lesson steps (using unique constraint on session_id + step_index)
    const stepsToInsert = steps.map((step: Record<string, unknown>, index: number) => ({
      session_id,
      step_index: step.lesson_step ?? step.step_index ?? index + 1,
      stage_id: step.stage_id || null,
      stage_intent: step.teaching_intent || step.stage_intent || null,
      speech: step.speech || "",
      board_actions: step.board_actions || [],
      visual_actions: step.visual_actions || [],
      visual3d_actions: step.visual3d_actions || [],
      pedagogy: step.pedagogy || null,
    }));

    const { data: insertedSteps, error } = await supabase
      .from("lesson_steps")
      .upsert(stepsToInsert, {
        onConflict: "session_id,step_index",
      })
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ steps: insertedSteps }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ error: "session_id required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify session ownership
  const { data: session } = await supabase
    .from("teaching_sessions")
    .select("id")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const { data: steps, error } = await supabase
    .from("lesson_steps")
    .select("*")
    .eq("session_id", sessionId)
    .order("step_index", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ steps: steps || [] });
}