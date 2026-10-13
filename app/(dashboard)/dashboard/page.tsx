import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import LessonActions from "../dashboard/LessonActions";

export const metadata = {
  title: "Your Lessons",
  description: "Your saved lessons and teaching sessions from AI Faculty.",
};

export default async function DashboardPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: sessions } = await supabase
    .from("teaching_sessions")
    .select(
      `
      id,
      title,
      topic,
      subject,
      status,
      current_step_index,
      created_at,
      updated_at,
      last_activity_at
      `
    )
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(20);

  return (
    <div className="dashboard-page">
      <div className="dashboard-header-actions">
        <h1>Your Lessons</h1>
        <Link href="/dashboard/new" className="auth-button primary">
          <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Lesson
        </Link>
      </div>

      {sessions && sessions.length > 0 ? (
        <div className="lessons-list">
          {sessions.map((session) => (
            <article key={session.id} className="lesson-card">
              <div className="lesson-card-main">
                <Link href={`/dashboard/${session.id}`} className="lesson-link">
                  <div className="lesson-info">
                    <h2 className="lesson-title">{session.title || session.topic}</h2>
                    <p className="lesson-topic">{session.topic}</p>
                    {session.subject && <span className="lesson-subject">{session.subject}</span>}
                  </div>
                  <div className="lesson-meta">
                    <span className={`lesson-status ${session.status}`}>{session.status}</span>
                    <span className="lesson-step">Step {session.current_step_index + 1}</span>
                    <time className="lesson-date" dateTime={session.last_activity_at}>
                      {format(new Date(session.last_activity_at), "MMM d, yyyy HH:mm")}
                    </time>
                  </div>
                </Link>
              </div>
              <LessonActions session={session} />
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <svg className="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <h2>No Lessons Yet</h2>
          <p>Start your first lesson to begin learning with AI Faculty</p>
          <Link href="/dashboard/new" className="auth-button primary">
            <svg className="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Your First Lesson
          </Link>
        </div>
      )}
    </div>
  );
}
