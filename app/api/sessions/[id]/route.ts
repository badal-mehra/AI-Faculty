import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { id } = await params;

  const { data: session, error } = await supabase
    .from("teaching_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Also fetch lesson steps
  const { data: steps } = await supabase
    .from("lesson_steps")
    .select("*")
    .eq("session_id", id)
    .order("step_index", { ascending: true });

  // Fetch messages
  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({ session, steps: steps || [], messages: messages || [] });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { id } = await params;

  try {
    const body = await request.json();
    const { title, topic, subject, status, current_step_index, current_stage_id, board_state, visual_state, visual3d_state, lesson_objective } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    if (title !== undefined) updateData.title = title;
    if (topic !== undefined) updateData.topic = topic;
    if (subject !== undefined) updateData.subject = subject;
    if (status !== undefined) updateData.status = status;
    if (current_step_index !== undefined) updateData.current_step_index = current_step_index;
    if (current_stage_id !== undefined) updateData.current_stage_id = current_stage_id;
    if (board_state !== undefined) updateData.board_state = board_state;
    if (visual_state !== undefined) updateData.visual_state = visual_state;
    if (visual3d_state !== undefined) updateData.visual3d_state = visual3d_state;
    if (lesson_objective !== undefined) updateData.lesson_objective = lesson_objective;
    if (status === "archived") updateData.archived_at = new Date().toISOString();
    if (status === "active") updateData.archived_at = null;

    const { data: session, error } = await supabase
      .from("teaching_sessions")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ session });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { id } = await params;

  const { error } = await supabase
    .from("teaching_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}