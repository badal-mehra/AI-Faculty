import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { safeRedirectPath } from "@/lib/redirect";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  // Only a relative path may be returned to. redirectTo is unvalidated input, and an absolute,
  // protocol-relative or backslash value would send the just-authenticated user to an attacker's
  // site — this is the moment their guard is lowest. The same value is echoed into the login URL
  // below, so it must be safe before either use.
  const requested = searchParams.get("redirectTo");
  const redirectTo = safeRedirectPath(requested);

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(redirectTo);
    }
  }

  // If there's an error or no code, redirect to login with error
  redirect(`/login?error=${encodeURIComponent("Could not verify email. Please try again.")}&redirectTo=${encodeURIComponent(redirectTo)}`);
}