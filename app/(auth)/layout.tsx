import { Suspense } from "react";

/**
 * Auth route group layout.
 *
 * The auth pages (login, signup, forgot-password, reset-password) are client components
 * that call `useSearchParams()` to read a `redirectTo` query parameter. In the Next.js
 * App Router, `useSearchParams()` is a client hook that reads the URL during client
 * rendering, so it must be wrapped in a React Suspense boundary during static
 * prerendering. Without it, `next build` fails with:
 *
 *   useSearchParams() should be wrapped in a suspense boundary at page "/login".
 *
 * This layout provides that boundary for every page in the (auth) group, preserving
 * query-parameter handling, redirect safety, validation, styling, and navigation.
 * The fallback is empty because the auth pages are fully self-contained: once the
 * boundary resolves there is no meaningful intermediate state to show.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <Suspense>{children}</Suspense>;
}
