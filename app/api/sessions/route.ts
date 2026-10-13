import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";
import { normalizeLanguage } from "@/lib/teaching/normalize";

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();

  const { data: sessions, error } = await supabase
    .from("teaching_sessions")
    .select(
      `
      id,
      title,
      topic,
      subject,
      status,
      preferred_language,
      teaching_depth,
      current_step_index,
      current_stage_id,
      board_state,
      visual_state,
      visual3d_state,
      lesson_objective,
      created_at,
      updated_at,
      last_activity_at
    `
    )
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sessions });
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();

  try {
    const body = await request.json();
    const { title, topic, subject, preferred_language, teaching_depth, board_state, visual_state, visual3d_state, lesson_objective } = body;

    const { data: session, error } = await supabase
      .from("teaching_sessions")
      .insert({
        user_id: user.id,
        title: title || topic,
        topic,
        subject: subject || null,
        preferred_language: normalizeLanguage(preferred_language),
        teaching_depth: teaching_depth || "beginner",
        board_state: board_state || { nodes: [], edges: [], texts: [], highlights: [] },
        visual_state: visual_state || { objects: [], tick: 0 },
        visual3d_state: visual3d_state || { objects: [], flows: [], labels: [], annotations: [], camera: {}, bounds: {}, memory: {}, tick: 0 },
        lesson_objective: lesson_objective || null,
        status: "active",
        current_step_index: 0,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}