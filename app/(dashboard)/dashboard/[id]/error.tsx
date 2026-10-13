"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ClassroomError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[classroom/error]", error);
  }, [error]);

  return (
    <div className="error-state" style={{ padding: "4rem 1rem" }}>
      <h2>Could not load the lesson</h2>
      <p>The classroom session could not be started. It may have been deleted or you may not have access.</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => reset()} className="auth-button primary">Try again</button>
        <Link href="/dashboard" className="auth-button secondary">Back to lessons</Link>
      </div>
    </div>
  );
}
