"use client";

import type { VoiceStatus } from "@/lib/tts/useTeacherVoice";

type Props = {
  status: VoiceStatus;
  error: string | null;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
};

// Simple teacher voice controls: Play, Pause/Resume, Stop and a speaking indicator.
// The error case is deliberately non-blocking: it never replaces the teaching speech.
export function TeacherVoiceControls({ status, error, onPlay, onPause, onStop }: Props) {
  const loading = status === "loading";
  const speaking = status === "speaking";
  const paused = status === "paused";

  const indicator = loading ? "Preparing voice..." : speaking ? "Teacher speaking..." : paused ? "Paused" : status === "error" ? "Voice unavailable" : "Voice ready";
  const dotClass = loading ? "voice-dot is-loading" : speaking ? "voice-dot is-speaking" : paused ? "voice-dot is-paused" : "voice-dot";

  return (
    <section className="voice-controls" aria-label="Teacher voice controls">
      <div className="voice-controls-title">Teacher voice <span>Text to speech</span></div>
      <div className="voice-status" aria-live="polite"><span className={dotClass} />{indicator}</div>
      <div className="voice-actions">
        <button onClick={onPlay} disabled={loading}>{paused ? "Resume" : "Play"}</button>
        <button onClick={paused ? onPlay : onPause} disabled={!speaking && !paused}>{paused ? "Resume" : "Pause"}</button>
        <button onClick={onStop} disabled={status === "idle"}>Stop</button>
      </div>
      {error && <p className="voice-error" role="status">{error}</p>}
    </section>
  );
}
