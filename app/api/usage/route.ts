// USAGE RECORDS API.
//
// Writes usage records server-side, using the service role, because the migration
// (supabase/migrations/001_initial_schema.sql) deliberately gives users no INSERT policy on
// `usage_records` — usage records are created server-side only.
//
// The client calls this endpoint instead of inserting directly into the restricted table.
// The caller's user_id is derived from the verified server-side session, never from the
// request body, so a client cannot forge a record for another user.
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/auth";
import { validateUsageRequest, type UsageRequest } from "@/lib/teaching/usage-validation";

export const runtime = "nodejs";

export type { UsageRequest };

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "INVALID_REQUEST", message: "The request body is not valid JSON." }, { status: 400 });
  }

  const validation = validateUsageRequest(body);
  if (!validation.valid) {
    return NextResponse.json({ error: "INVALID_REQUEST", message: validation.error }, { status: validation.status });
  }
  const { session_id, provider, model, input_tokens, output_tokens, total_tokens, request_type } = validation.data;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set() {},
        remove() {},
      },
    },
  );

  // Verify the lesson session belongs to this user. A client cannot insert a record for a
  // session it does not own, and the user_id comes from the verified session, not the body.
  const { data: session, error: sessionError } = await supabase
    .from("teaching_sessions")
    .select("id, user_id")
    .eq("id", session_id)
    .eq("user_id", user.id)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "SESSION_NOT_FOUND", message: "The referenced lesson session was not found." }, { status: 404 });
  }

  const { data: record, error } = await supabase
    .from("usage_records")
    .insert({
      user_id: session.user_id,
      session_id: session.id,
      provider,
      model,
      input_tokens,
      output_tokens,
      total_tokens,
      request_type,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: "DB_ERROR", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, record }, { status: 201 });
}