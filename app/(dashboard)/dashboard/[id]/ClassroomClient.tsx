"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ClassroomCore } from "./ClassroomCore";
import type { TeachingResponse } from "@/lib/teaching/types";

interface ClassroomClientProps {
  initialSession: {
    id: string;
    current_step_index: number;
    [key: string]: unknown;
  };
  initialQuestion?: string;
}

export default function ClassroomClient({ initialSession, initialQuestion }: ClassroomClientProps) {
  const [session, setSession] = useState(initialSession);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const saveSession = async (data: Record<string, unknown>) => {
    if (!session) return;

    setSaveError(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("teaching_sessions")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
          last_activity_at: new Date().toISOString(),
        })
        .eq("id", session.id);

      if (error) throw error;

      setSession((prev: any) => (prev ? { ...prev, ...data } : prev));
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save session");
    } finally {
      setIsSaving(false);
    }
  };

  const debouncedSave = (data: Record<string, unknown>) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveSession(data);
    }, 2000);
  };

  const saveLessonSteps = async (steps: Array<Record<string, unknown>>) => {
    if (!session) return;

    try {
      const supabase = createClient();
      // The caller sends the API's step shape (lesson_step / teaching_intent); the columns are
      // step_index / stage_intent. Mapping the wrong names silently produced step_index: undefined,
      // which the NOT NULL column rejected, so no lesson ever stored a single step.
      const stepsToInsert = steps.map((step) => ({
        session_id: session.id,
        step_index: step.lesson_step,
        stage_id: step.stage_id || null,
        stage_intent: step.teaching_intent || null,
        speech: step.speech || "",
        board_actions: step.board_actions || [],
        visual_actions: step.visual_actions || [],
        visual3d_actions: step.visual3d_actions || [],
        pedagogy: step.pedagogy || null,
      }));

      const { error } = await supabase
        .from("lesson_steps")
        .upsert(stepsToInsert, {
          onConflict: "session_id,step_index",
        });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to save lesson steps:", error);
    }
  };

  const saveMessage = async (message: Record<string, unknown>) => {
    if (!session) return;

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("messages")
        .insert({
          session_id: session.id,
          user_id: user.id,
          role: message.role,
          content: message.content,
          message_type: message.message_type || null,
          metadata: message.metadata || null,
        });

      if (error) throw error;
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  };

  const saveUsage = async (usage: Record<string, unknown>) => {
    if (!session) return;

    try {
      // The usage_records table has no INSERT policy for users (the migration says records are
      // created server-side only), so the write goes through /api/usage, which authenticates
      // the caller, verifies session ownership and inserts with the service role.
      const response = await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: session.id,
          provider: usage.provider,
          model: usage.model ?? null,
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: usage.total_tokens,
          request_type: usage.request_type ?? "step",
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { message?: string }).message ?? `usage write failed (${response.status})`);
      }
    } catch (error) {
      // A failed write must not be reported as successful. The caller (Classroom.tsx) already
      // swallows the rejection, so the message is logged here for diagnosis.
      console.error("Failed to save usage:", error instanceof Error ? error.message : String(error));
    }
  };

  const persistHandlers = {
    saveSession: debouncedSave,
    saveLessonSteps,
    saveMessage,
    saveUsage,
    setSaveError,
  };

  // Fetch saved lesson steps so a reopened lesson can be restored exactly.
  const [savedSteps, setSavedSteps] = useState<TeachingResponse[]>([]);
  useEffect(() => {
    if (!initialSession.id) return;
    const fetchSteps = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("lesson_steps")
          .select("*")
          .eq("session_id", initialSession.id)
          .order("step_index", { ascending: true });
        if (error) throw error;
        // Map DB columns back to the API's TeachingResponse shape.
        setSavedSteps((data ?? []).map((row: any, idx: number, arr: any[]): TeachingResponse => {
          const stepIndex = row.step_index;
          const isLast = idx === arr.length - 1;
          return {
            lesson_step: stepIndex,
            stage_id: row.stage_id ?? undefined,
            teaching_intent: row.stage_intent ?? undefined,
            speech: row.speech,
            board_actions: row.board_actions ?? [],
            visual_actions: row.visual_actions ?? [],
            visual3d_actions: row.visual3d_actions ?? [],
            pedagogy: row.pedagogy ?? undefined,
            next_step: isLast ? stepIndex : stepIndex + 1,
          };
        }));
      } catch (err) {
        console.error("Failed to fetch saved steps:", err);
      }
    };
    void fetchSteps();
  }, [initialSession.id]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <ClassroomCore
      session={session}
      persistHandlers={persistHandlers}
      savedSteps={savedSteps}
      isSaving={isSaving}
      saveError={saveError}
      initialQuestion={initialQuestion}
    />
  );
}