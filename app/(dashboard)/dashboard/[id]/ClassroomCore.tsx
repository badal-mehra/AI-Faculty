"use client";

import { useEffect, useState } from "react";
import { Classroom } from "@/components/Classroom";

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
    [key: string]: unknown;
  };
  persistHandlers: PersistHandlers;
  isSaving: boolean;
  saveError: string | null;
  initialQuestion?: string;
}

export function ClassroomCore({
  session,
  persistHandlers,
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
      />
    </div>
  );
}