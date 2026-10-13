import { TEACHING_LANGUAGES, type TeachingLanguage } from "./types";

/**
 * Legacy ISO-code to canonical TeachingLanguage mapping.
 * Used by the signup form and profile save UI before the fix that
 * switched selects to emit canonical names directly.
 */
const LANGUAGE_ISO_TO_CANONICAL: Record<string, TeachingLanguage> = {
  en: "English",
  hinglish: "Hinglish",
  hi: "Hindi",
  te: "Telugu",
  ta: "Tamil",
  kn: "Kannada",
  ml: "Malayalam",
  mr: "Marathi",
  bn: "Bengali",
  pa: "Punjabi",
};

/**
 * Normalizes any language string to a valid TeachingLanguage.
 *
 * Accepts:
 * - Canonical names ("English", "Hindi", ...)
 * - ISO codes ("en", "hi", ...) — legacy values stored by older clients
 * - Mixed-case variants ("english", "ENGLISH", "hindustani")
 *
 * Falls back to "English" for unrecognized values. Never throws.
 */
export function normalizeLanguage(value: string | null | undefined): TeachingLanguage {
  if (!value || typeof value !== "string") return "English";

  const trimmed = value.trim();

  // Direct canonical match (case-insensitive for safety)
  const canonicalMatch = TEACHING_LANGUAGES.find(
    (lang) => lang.toLowerCase() === trimmed.toLowerCase()
  );
  if (canonicalMatch) return canonicalMatch;

  // Try ISO code lookup
  const isoMatch = LANGUAGE_ISO_TO_CANONICAL[trimmed.toLowerCase()];
  if (isoMatch) return isoMatch;

  // Try matching by first word (handles "Hindi (India)" etc.)
  const firstWord = trimmed.split(/\s/)[0];
  const firstWordMatch = TEACHING_LANGUAGES.find(
    (lang) => lang.toLowerCase() === firstWord.toLowerCase()
  );
  if (firstWordMatch) return firstWordMatch;

  return "English";
}

/**
 * Type guard: returns true if the value is a valid TeachingLanguage.
 */
export function isTeachingLanguage(value: string): value is TeachingLanguage {
  return TEACHING_LANGUAGES.includes(value as TeachingLanguage);
}
