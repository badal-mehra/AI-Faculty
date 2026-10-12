"use client";

import { useState } from "react";
import { Classroom } from "@/components/Classroom";
import type { BoardState } from "@/lib/board/types";
import type { VisualScene } from "@/lib/visual/types";
import type { Visual3DScene } from "@/lib/visual3d/types";
import type { TeachingResponse } from "@/lib/teaching/types";
import type { LessonProgressView } from "@/lib/teaching/objective";

interface PersistHandlers {
  saveSession: (data: Record<string, unknown>) => void;
  saveLessonSteps: (steps: Array<Record<string, unknown>>) => Promise<void>;
  saveMessage: (message: Record<string, unknown>) => Promise<void>;
  saveUsage: (usage: Record<string, unknown>) => Promise<void>;
  setSaveError: (error: string | null) => void;
}

interface ClassroomCoreProps {
  session: {
    id: string;
    current_step_index: number;
    board_state?: BoardState;
    visual_state?: VisualScene;
    visual3d_state?: Visual3DScene;
    [key: string]: unknown;
  };
  persistHandlers: PersistHandlers;
  savedSteps: TeachingResponse[];
  isSaving: boolean;
  saveError: string | null;
  initialQuestion?: string;
}

export function ClassroomCore({
  session,
  persistHandlers,
  savedSteps,
  isSaving,
  saveError,
  initialQuestion,
}: ClassroomCoreProps) {
  const [error, setError] = useState<string | null>(null);

  if (error) {
    return (
      <div className="error-state">
        <h2>Something went wrong</h2>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  const hasSavedSteps = savedSteps && savedSteps.length > 0;

  return (
    <div className="classroom-container">
      {saveError && (
        <div className="save-error-banner" role="alert">
          {saveError}
          <button onClick={() => persistHandlers.setSaveError(null)}>Dismiss</button>
        </div>
      )}
      {isSaving && (
        <div className="saving-indicator">
          Saving...
        </div>
      )}
      <Classroom
        sessionId={session.id}
        initialStep={session.current_step_index}
        persistHandlers={persistHandlers}
        initialQuestion={initialQuestion}
        initialBoardState={session.board_state as BoardState | undefined}
        initialVisualState={session.visual_state as VisualScene | undefined}
        initialVisual3dState={session.visual3d_state as Visual3DScene | undefined}
        initialSteps={hasSavedSteps ? savedSteps : undefined}
        initialProgress={session.lesson_objective ? (session.lesson_objective as LessonProgressView) : null}
      />
    </div>
  );
}