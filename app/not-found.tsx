import Link from "next/link";

export default function NotFound() {
  return (
    <div className="error-state">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist or has moved.</p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link href="/dashboard" className="auth-button primary">Go to your lessons</Link>
        <Link href="/login" className="auth-button secondary">Sign in</Link>
      </div>
    </div>
  );
}
