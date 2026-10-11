import { getUser } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, preferred_language, teaching_depth")
    .eq("id", user.id)
    .single();

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
              <div className="lesson-actions">
                <Link href={`/dashboard/${session.id}`} className="action-button primary">
                  {session.status === "active" ? "Continue" : "View"}
                </Link>
                <button className="action-button secondary" onClick={() => renameSession(session.id, session.title)}>
                  Rename
                </button>
                <button
                  className="action-button secondary"
                  onClick={() => archiveSession(session.id, session.status)}
                >
                  {session.status === "archived" ? "Unarchive" : "Archive"}
                </button>
                <button
                  className="action-button danger"
                  onClick={() => confirmDelete(session.id, session.title || session.topic)}
                >
                  Delete
                </button>
              </div>
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

async function renameSession(sessionId: string, currentTitle: string) {
  const newTitle = prompt("Enter new title:", currentTitle);
  if (!newTitle || newTitle === currentTitle) return;

  const supabase = await createClient();
  await supabase.from("teaching_sessions").update({ title: newTitle }).eq("id", sessionId);
  window.location.reload();
}

async function archiveSession(sessionId: string, currentStatus: string) {
  const supabase = await createClient();
  const newStatus = currentStatus === "archived" ? "active" : "archived";
  await supabase
    .from("teaching_sessions")
    .update({ status: newStatus, archived_at: newStatus === "archived" ? new Date().toISOString() : null })
    .eq("id", sessionId);
  window.location.reload();
}

function confirmDelete(sessionId: string, title: string) {
  if (confirm(`Delete "${title}"? This cannot be undone.`)) {
    deleteSession(sessionId);
  }
}

async function deleteSession(sessionId: string) {
  const supabase = await createClient();
  await supabase.from("teaching_sessions").delete().eq("id", sessionId);
  window.location.reload();
}