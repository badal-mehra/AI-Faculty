/**
 * Normalise an untrusted redirect target so it can only ever point at this application.
 *
 * The value comes from the query string, which an attacker fully controls, and it is handed to
 * `router.push`, `NextResponse.redirect` and `redirect()` — all of which honour ABSOLUTE URLs.
 *
 * Three separate bypasses have to be closed, not one:
 *
 *   1. "https://evil.example" — absolute. `new URL(v, base)` ignores the base entirely.
 *   2. "//evil.example"       — protocol-relative. It becomes the authority, not the path.
 *   3. "/\evil.example"       — backslash. In http(s) URLs the parser rewrites "\" as "/", so this
 *                               becomes "//evil.example" and escapes. Backslashes are therefore
 *                               rejected outright rather than pattern-matched.
 *
 * Control characters are rejected too: parsers strip them, and a stripped character can change
 * where the authority starts.
 *
 * A relative path like "/../other" is fine and deliberately kept — it resolves inside this origin.
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (!value) return fallback;

  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.startsWith("/\\")) return fallback;
  if (value.includes("\\")) return fallback;

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return fallback;
  }

  return value;
}
