"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="error-state">
          <h1>Something went wrong</h1>
          <p>An unexpected error occurred. Please try again.</p>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
            <button onClick={() => reset()} className="auth-button primary">Try again</button>
            <Link href="/login" className="auth-button secondary">Sign in</Link>
          </div>
        </div>
      </body>
    </html>
  );
}
