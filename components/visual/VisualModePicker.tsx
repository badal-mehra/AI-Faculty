"use client";

// VISUAL MODE PICKER — the student's explicit choice of how the lesson should be drawn.
//
// This is one component, used in BOTH the setup panel (before a lesson starts) and the live panel.
// It used to exist only after the lesson began, which made the decision impossible to make: the
// student could not say "I want this in 3D" until the teacher had already drawn it in 2D, and the
// text they had typed was then re-read by `detectRepresentationIntent`, silently overriding the one
// signal the student had actually given.
//
// The control is a proper segmented radio group: one tab stop, arrow keys move between options, and
// each option explains itself. "What will Auto do?" and "what happens if I pick 3D for something
// with no 3D model?" are the questions a student asks while looking at three unexplained buttons, so
// they are answered on the control rather than discovered later.

import { useCallback, useRef } from "react";
import type { VisualMode } from "./Visualizer";

type ModeOption = {
  id: VisualMode;
  label: string;
  /** Shown under the control, so the choice is never a guess. */
  description: string;
};

export const VISUAL_MODE_OPTIONS: ModeOption[] = [
  {
    id: "auto",
    label: "Auto",
    description: "I choose: 3D when depth matters — anatomy, molecules, machines — otherwise a 2D board.",
  },
  {
    id: "2d",
    label: "2D",
    description: "Always a 2D board: arrays, trees, flowcharts, code, equations, sequences.",
  },
  {
    id: "3d",
    label: "3D",
    description: "Always 3D: real models you can rotate and look inside. Falls back to 2D if there is no model.",
  },
];

type Props = {
  value: VisualMode;
  onChange: (mode: VisualMode) => void;
  /** `compact` for the live panel, where vertical space competes with the lesson outline. */
  compact?: boolean;
  idPrefix?: string;
};

export function VisualModePicker({ value, onChange, compact = false, idPrefix = "visual-mode" }: Props) {
  const buttons = useRef(new Map<VisualMode, HTMLButtonElement | null>());
  const selected = VISUAL_MODE_OPTIONS.find((option) => option.id === value) ?? VISUAL_MODE_OPTIONS[0];

  /** Arrow keys move the selection, which is what a radio group is expected to do. */
  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1
      : 0;
    const jump = event.key === "Home" ? -VISUAL_MODE_OPTIONS.length : event.key === "End" ? VISUAL_MODE_OPTIONS.length : 0;
    if (step === 0 && jump === 0) return;
    event.preventDefault();
    const currentIndex = VISUAL_MODE_OPTIONS.findIndex((option) => option.id === value);
    const nextIndex = jump !== 0
      ? (jump > 0 ? VISUAL_MODE_OPTIONS.length - 1 : 0)
      : (currentIndex + step + VISUAL_MODE_OPTIONS.length) % VISUAL_MODE_OPTIONS.length;
    const next = VISUAL_MODE_OPTIONS[nextIndex];
    onChange(next.id);
    buttons.current.get(next.id)?.focus();
  }, [onChange, value]);

  return (
    <div className={`visual-mode${compact ? " is-compact" : ""}`}>
      <span className="visual-mode-label" id={`${idPrefix}-label`}>View</span>
      <div
        className="visual-mode-buttons"
        role="radiogroup"
        aria-labelledby={`${idPrefix}-label`}
        onKeyDown={onKeyDown}
      >
        {VISUAL_MODE_OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              id={`${idPrefix}-${option.id}`}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              className={active ? "is-active" : ""}
              ref={(node) => { buttons.current.set(option.id, node); }}
              onClick={() => onChange(option.id)}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {!compact ? <p className="visual-mode-hint" id={`${idPrefix}-hint`}>{selected.description}</p> : null}
    </div>
  );
}