"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Profile {
  display_name: string | null;
  preferred_language: string;
  teaching_depth: string;
}

export default function NewLessonForm({ profile }: { profile: Profile | null }) {
  const [question, setQuestion] = useState("");
  const [language, setLanguage] = useState(profile?.preferred_language || "en");
  const [teachingDepth, setTeachingDepth] = useState(profile?.teaching_depth || "beginner");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSessionId, setCreatedSessionId] = useState<string | null>(null);

  const router = useRouter();

  const createSession = async () => {
    const nextQuestion = question.trim();
    if (!nextQuestion) {
      setError("Please enter a question or topic to start the lesson.");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("You must be logged in to create a lesson.");
        return;
      }

      const { data: session, error: sessionError } = await supabase
        .from("teaching_sessions")
        .insert({
          user_id: user.id,
          title: nextQuestion.slice(0, 100),
          topic: nextQuestion,
          preferred_language: language,
          teaching_depth: teachingDepth,
          board_state: { nodes: [], edges: [], texts: [], highlights: [] },
          visual_state: { objects: [], tick: 0 },
          visual3d_state: { objects: [], flows: [], labels: [], annotations: [], camera: {}, bounds: {}, memory: {}, tick: 0 },
          status: "active",
          current_step_index: 0,
        })
        .select()
        .single();

      if (sessionError || !session) {
        setError("Failed to create session. Please try again.");
        return;
      }

      // The lesson is now a real classroom session, so the student is taken to it. Without this the
      // form parked on its "Starting your lesson..." spinner forever: the session had been created,
      // no error had been raised, and nothing ever navigated away.
      setCreatedSessionId(session.id);
      router.push(`/dashboard/${session.id}?topic=${encodeURIComponent(nextQuestion)}`);
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (createdSessionId) {
    return (
      <div className="new-lesson-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <p>Starting your lesson...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="new-lesson-page">
      <div className="new-lesson-form">
        <div className="form-header">
          <h1>Start a New Lesson</h1>
          <p>Enter a question or topic you want to learn about</p>
        </div>

        {error && <div className="auth-error" role="alert">{error}</div>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createSession();
          }}
          className="auth-form"
        >
          <div className="form-group">
            <label htmlFor="question">What do you want to learn?</label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g. Explain photosynthesis, Teach me recursion, How does TCP work?"
              rows={4}
              disabled={isLoading}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="language">Language</label>
              <select
                id="language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
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

          <button type="submit" className="auth-button primary" disabled={isLoading}>
            {isLoading ? "Creating..." : "Start Lesson"}
          </button>
        </form>
      </div>
    </div>
  );
}