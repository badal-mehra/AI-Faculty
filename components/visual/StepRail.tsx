"use client";

// STEP RAIL — where the student is in the lesson, and the three controls that move them.
//
// The lesson plan in the panel lists STAGES ("how it actually works"); this lists STEPS ("the thing
// happening right now"). Both matter, and conflating them is why a student watching step 6 of 8 has no
// way to know whether step 5 is still available or what comes next.
//
// Replay is the important one. A teacher says "watch the packet travel" and the student looks away for
// a second; without replay the only way to see it again is to interrupt and ask, which costs a round
// trip and breaks the flow. Replay re-runs the step from the exact scene it was built on, so it cannot
// duplicate anything.

type Props = {
  /** 1-based number of the step on screen, or null before the lesson starts. */
  step: number | null;
  /** Highest step number delivered so far. */
  total: number;
  canGoBack: boolean;
  canGoForward: boolean;
  canReplay: boolean;
  onBack: () => void;
  onForward: () => void;
  onReplay: () => void;
};

export function StepRail({ step, total, canGoBack, canGoForward, canReplay, onBack, onForward, onReplay }: Props) {
  if (step === null || total <= 0) return null;
  return (
    <div className="step-rail" aria-label="Lesson steps">
      <span className="step-rail-position" aria-live="polite">
        Step {step} <span className="step-rail-of">of {total}</span>
      </span>
      <div className="step-rail-buttons">
        <button type="button" onClick={onBack} disabled={!canGoBack} title="Go back one step" aria-label="Go back one step">Back</button>
        <button type="button" className="is-replay" onClick={onReplay} disabled={!canReplay} title="Play this step again" aria-label="Replay this step">Replay</button>
        <button type="button" onClick={onForward} disabled={!canGoForward} title="Go forward one step" aria-label="Go forward one step">Next</button>
      </div>
    </div>
  );
}