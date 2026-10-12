"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { TeachingSession } from "@/lib/supabase/types";

/**
 * The subset of `teaching_sessions` columns the dashboard list actually selects. The full
 * `TeachingSession` row is never available there, so the action buttons only depend on these.
 */
export interface DashboardSession {
  id: string;
  title: string;
  topic: string;
  subject: string | null;
  status: TeachingSession["status"];
  current_step_index: number;
  last_activity_at: string;
}

/**
 * Per-lesson action buttons (View / Rename / Archive / Delete).
 *
 * The dashboard previously performed these mutations through module-level `async` functions
 * declared inside a **Server Component** that called the *server* Supabase client (which reads
 * `cookies()` and is therefore server-only). Wiring them straight to `onClick` meant they ran in
 * the browser but referenced a server-only API — they threw at runtime and the buttons were
 * silently broken.
 *
 * This component is the client-side owner of those actions. It uses the browser Supabase client,
 * never reloads the page (which discards scroll position), and replaces the modal `window.prompt`
 * rename with an inline edit field so the row stays in place while editing.
 */
export default function LessonActions({ session }: { session: DashboardSession }) {
  const router = useRouter();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title || session.topic || "");
  const [isSaving, setIsSaving] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const updateTitle = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || trimmed === (session.title || session.topic)) {
      setIsRenaming(false);
      return;
    }
    setIsSaving(true);
    try {
      const supabase = createClient();
      await supabase
        .from("teaching_sessions")
        .update({ title: trimmed })
        .eq("id", session.id);
      router.refresh();
    } finally {
      setIsSaving(false);
      setIsRenaming(false);
    }
  };

  const toggleArchive = async () => {
    setIsToggling(true);
    try {
      const supabase = createClient();
      const next = session.status === "archived" ? "active" : "archived";
      await supabase
        .from("teaching_sessions")
        .update({
          status: next,
          archived_at: next === "archived" ? new Date().toISOString() : null,
        })
        .eq("id", session.id);
      router.refresh();
    } finally {
      setIsToggling(false);
    }
  };

  const deleteSession = async () => {
    if (
      !confirm(`Delete "${session.title || session.topic}"? This cannot be undone.`)
    ) {
      return;
    }
    setIsDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from("teaching_sessions").delete().eq("id", session.id);
      router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  const status = session.status;
  return (
    <div className="lesson-actions">
      <Link
        href={`/dashboard/${session.id}`}
        className="action-button primary"
        aria-label={status === "active" ? "Continue lesson" : "View lesson"}
      >
        {status === "active" ? "Continue" : "View"}
      </Link>

      {isRenaming ? (
        <>
          <input
            className="rename-input"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setRenameValue(session.title || session.topic || "");
                setIsRenaming(false);
              } else if (e.key === "Enter") {
                void updateTitle();
              }
            }}
            autoFocus
            disabled={isSaving}
            aria-label="New lesson title"
          />
          <button
            type="submit"
            className="action-button primary"
            onClick={updateTitle}
            disabled={isSaving}
            aria-label="Save title"
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => {
              setRenameValue(session.title || session.topic || "");
              setIsRenaming(false);
            }}
            disabled={isSaving}
            aria-label="Cancel rename"
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="action-button secondary"
            onClick={() => setIsRenaming(true)}
            aria-label={`Rename ${session.title || session.topic || "lesson"}`}
          >
            Rename
          </button>
          <button
            type="button"
            className="action-button secondary"
            onClick={toggleArchive}
            disabled={isToggling}
            aria-label={
              status === "archived" ? "Unarchive lesson" : "Archive lesson"
            }
          >
            {isToggling ? "…" : status === "archived" ? "Unarchive" : "Archive"}
          </button>
          <button
            type="button"
            className="action-button danger"
            onClick={deleteSession}
            disabled={isDeleting}
            aria-label={`Delete ${session.title || session.topic || "lesson"}`}
          >
            {isDeleting ? "…" : "Delete"}
          </button>
        </>
      )}
    </div>
  );
}
