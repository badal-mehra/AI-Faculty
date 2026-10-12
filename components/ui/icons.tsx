"use client";

/**
 * Shared SVG icon set.
 *
 * Replaces the emoji-based password toggles (🙈 / 👁️) used across the auth pages,
 * which rendered inconsistently across platforms and gave no accessible affordance.
 * Every icon is a focused, labelled stroke icon so a screen reader can name its action
 * and the visual stays identical on every OS.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

export function EyeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M1 12s8-8 11-8 11 8 11 8-8 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <line x1="1" y1="1" x2="23" y2="23" />
      <path d="M8.5 8.5a7.5 7.5 0 0 0 10.5 10.5 7.5 7.5 0 0 0-10.5-10.5z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
