import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ClassroomClient from "./ClassroomClient";

export default async function ClassroomPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // The topic the student typed on the new-lesson screen, carried across the redirect so the
  // classroom opens on the lesson they already asked for instead of an empty prompt.
  searchParams: Promise<{ topic?: string }>;
}) {
  const user = await getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { topic } = await searchParams;
  const supabase = await createClient();

  const { data: session } = await supabase
    .from("teaching_sessions")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!session) {
    redirect("/dashboard");
  }

  return <ClassroomClient initialSession={session} initialQuestion={topic} />;
}