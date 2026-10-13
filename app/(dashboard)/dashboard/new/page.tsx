import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NewLessonForm from "./NewLessonForm";

export const metadata = {
  title: "New Lesson",
  description: "Start a new lesson on any topic with your AI teacher.",
};

export default async function NewLessonPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferred_language, teaching_depth")
    .eq("id", user.id)
    .single();

  return <NewLessonForm profile={profile} />;
}