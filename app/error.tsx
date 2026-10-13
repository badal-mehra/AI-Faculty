"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div className="error-state">
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred while loading this page.</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button onClick={() => reset()} className="auth-button primary">Try again</button>
        <Link href="/dashboard" className="auth-button secondary">Your lessons</Link>
      </div>
    </div>
  );
}
