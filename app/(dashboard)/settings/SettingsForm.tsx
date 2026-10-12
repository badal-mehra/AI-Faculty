"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  preferred_language: string;
  teaching_depth: string;
}

export default function SettingsForm({ user, profile }: { user: any; profile: Profile | null }) {
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [preferredLanguage, setPreferredLanguage] = useState(profile?.preferred_language || "en");
  const [teachingDepth, setTeachingDepth] = useState(profile?.teaching_depth || "beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: displayName.trim() || null,
          preferred_language: preferredLanguage,
          teaching_depth: teachingDepth,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setSuccess("Settings saved successfully!");
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <section className="dashboard-section">
      <div className="dashboard-header-actions">
        <h1>Settings</h1>
      </div>

      <div className="dashboard-card">
        {error && <div className="auth-error" role="alert">{error}</div>}
        {success && <div className="auth-success" role="status">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={user?.email || ""}
              disabled
              readOnly
            />
          </div>

          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              disabled={isLoading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="preferredLanguage">Preferred Language</label>
              <select
                id="preferredLanguage"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                disabled={isLoading}
              >
                <option value="en">English</option>
                <option value="hinglish">Hinglish</option>
                <option value="hi">Hindi</option>
                <option value="te">Telugu</option>
                <option value="ta">Tamil</option>
                <option value="kn">Kannada</option>
                <option value="ml">Malayalam</option>
                <option value="mr">Marathi</option>
                <option value="bn">Bengali</option>
                <option value="pa">Punjabi</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="teachingDepth">Teaching Depth</label>
              <select
                id="teachingDepth"
                value={teachingDepth}
                onChange={(e) => setTeachingDepth(e.target.value)}
                disabled={isLoading}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="auth-button primary" disabled={isLoading}>
              {isLoading ? "Saving..." : "Save Changes"}
            </button>
            <button type="button" className="auth-button secondary" onClick={handleSignOut}>
              Sign Out
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}