import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/auth";

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();

  try {
    const body = await request.json();
    const { session_id, role, content, message_type, metadata } = body;

    if (!session_id || !role || !content) {
      return NextResponse.json({ error: "session_id, role, and content required" }, { status: 400 });
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

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        session_id,
        user_id: user.id,
        role,
        content,
        message_type: message_type || null,
        metadata: metadata || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message }, { status: 201 });
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

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ messages: messages || [] });
}