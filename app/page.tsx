import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getUser();

  if (user) {
    // Authenticated user goes to dashboard
    redirect("/dashboard");
  }

  // Unauthenticated user goes to login
  redirect("/login");
}