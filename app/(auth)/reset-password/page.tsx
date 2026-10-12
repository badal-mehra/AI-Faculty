"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { safeRedirectPath } from "@/lib/redirect";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = safeRedirectPath(searchParams.get("redirectTo"));

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isValidToken, setIsValidToken] = useState(true);

  const validatePassword = (password: string) => {
    return password.length >= 8;
  };

  useEffect(() => {
    const code = searchParams.get("code");
    const type = searchParams.get("type");
    if (!code || type !== "recovery") {
      setIsValidToken(false);
      setError("Invalid or expired reset link. Please request a new one.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isValidToken) return;

    if (!validatePassword(password)) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess("Password updated successfully. Redirecting to sign in...");
      setTimeout(() => {
        router.push(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
        router.refresh();
      }, 2000);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isValidToken) {
    return (
      <div className="auth-page">
        <div className="auth-container">
          <div className="auth-header">
            <h1>Reset Password</h1>
          </div>
          <div className="auth-error" role="alert">{error}</div>
          <p className="auth-footer">
            <a href={`/forgot-password?redirectTo=${encodeURIComponent(redirectTo)}`}>Request a new reset link</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-header">
          <h1>Reset Password</h1>
          <p>Enter your new password</p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-success" role="status">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your new password"
              required
              autoComplete="new-password"
              disabled={isLoading}
            />
          </div>

          <button type="submit" className="auth-button primary" disabled={isLoading}>
            {isLoading ? "Updating…" : "Update Password"}
          </button>
        </form>

        <p className="auth-footer">
          <a href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}>Back to Sign In</a>
        </p>
      </div>
    </div>
  );
}