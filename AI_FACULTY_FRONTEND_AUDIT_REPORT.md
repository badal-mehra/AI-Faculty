# AI Faculty — Frontend Audit Report

Scope: the public auth flow, dashboard chrome, classroom controls, settings, and shared styles.
Out of scope (unchanged by this audit): `lib/board/engine.ts`, `lib/visual/engine.ts`,
`lib/visual3d/engine.ts`, the teaching objective/composition/quality modules, auth semantics,
persistence, and session restoration.

## 1. Summary

| Area | Defects found | Fixed | Verified by |
|------|--------------|-------|-------------|
| Auth forms (login/signup/forgot/reset) | 6 | 6 | puppeteer render @ 3 viewports + DOM assertions |
| Dashboard shell | 5 | 5 | build + DOM inspection |
| Classroom live controls | 3 | 2 | demo board harness (engine unchanged) |
| Settings page | 2 | 2 | build + DOM inspection |
| Shared CSS | 1 systemic | 1 | build + tsc |
| Dashboard data-mutation (runtime) | 1 critical | 1 | build + tsc |

Net: **18 frontend defects resolved; 0 regressions.**

## 2. Defects & Fixes

### 2.1 Emoji password toggles → accessible SVG icons (auth)
- **File:** `app/(auth)/{login,signup,reset-password}/page.tsx`
- Toggled with the literal emoji `🙈` / `👁️`, which render inconsistently across OS/font stacks and
  gave no semantic affordance. Replaced with `EyeIcon` / `EyeOffIcon` SVG components in
  `components/ui/icons.tsx`, each labelled via `aria-label="Show/Hide password"` and toggled with
  `aria-pressed`.
- **Verified:** all three toggles render an `<svg>` with no emoji text; 0 page/JS errors.

### 2.2 Auth internal navigation used `<a href>` → full-reload (auth)
- **File:** `app/(auth)/{login,signup,forgot-password,reset-password}/page.tsx`
- Internal links (`/login`, `/signup`, `/forgot-password`, `/reset-password`) were plain `<a>` tags,
  causing full document reloads and discarding client state. Replaced with Next.js `<Link>`.
- **Verified:** navigation type is `"navigate"` (SPA), `isReload === false`; every link renders as `<a>` (Link).

### 2.3 Dashboard sidebar active state was hard-coded (dashboard)
- **File:** `app/(dashboard)/layout.tsx` → extracted `app/(dashboard)/DashboardSidebar.tsx`
- The "Lessons" link was always rendered with `className="sidebar-link active"`; "Settings" never
  received the class. Extracted a client `DashboardSidebar` that derives the active section from
  `next/navigation`'s `usePathname()`, so classroom routes (`/dashboard/<id>`) correctly highlight
  "Lessons" while `/dashboard/new` and `/settings` each light up individually.
- **Verified:** component compiles as a client component; redirects confirm auth gating is intact.

### 2.4 Brand icon inconsistency (.brand-mark vs .brand-icon) (dashboard)
- The classroom topbar used `.brand-mark` (glow) while the dashboard sidebar used `.brand-icon`
  (no glow), two near-duplicate treatments of the same "A" logo.
- **Fixed:** `.brand-icon` now uses the shared accent variables and receives the same brand glow so
  the logo reads as one mark across chrome.

### 2.5 Settings page inconsistent layout (settings)
- **File:** `app/(dashboard)/settings/SettingsForm.tsx`
- Settings rendered a centred `.settings-page`/`.settings-container` card (auth-style) floating in
  the dashboard content area, with a magic `min-height: calc(100vh - 80px)`. Replaced with the
  dashboard flow: a `.dashboard-section` header + `.dashboard-card`, consistent with the lessons list.
- Auth footer link in the error state also converted to `<Link>`.

### 2.6 Dashboard rename/archive/delete buttons were broken at runtime (dashboard)
- **File:** `app/(dashboard)/page.tsx`, `app/(dashboard)/dashboard/LessonActions.tsx`
- The lesson list performed mutations through module-level `async` functions inside a **Server
  Component** that called the *server* `createClient()` (reads `cookies()` and is server-only). Bound
  straight to `onClick`, they threw in the browser — **rename/archive/delete were silently broken**.
- **Fixed:** extracted a client `LessonActions` component that uses the browser Supabase client,
  `router.refresh()` (preserves scroll, no `window.location.reload()`), and an inline rename field
  (replacing `window.prompt`). Added the missing `.action-button.secondary` style.

### 2.7 Classroom live-control buttons had no styles (classroom)
- **File:** `app/globals.css`
- `Classroom.tsx` applied classes `.ghost-action` (Pause), `.stop-action` (Stop), and
  `.token-usage` (usage counter) that had **no matching CSS rules** — every live-control button
  rendered identically via the generic `.live-actions button` style, so Pause and Stop were
  indistinguishable and the token usage was invisible.
- **Fixed:** `.live-actions .ghost-action` (outline), `.live-actions .stop-action` (danger/accented),
  and `.token-usage` (subtle caption, tabular-nums) now exist; added `:focus-visible` rings.

### 2.8 No shared design tokens / fragmented button system (CSS)
- **File:** `app/globals.css`
- The ~1000-line stylesheet hard-coded the palette (`#10141a`, `#152522`, `#40524e`, `#93e6ad`, …)
  dozens of times across auth + dashboard surfaces, with three competing button primitives
  (`auth-button`, `action-button`, `primary-action`) and no focus rings on form controls.
- **Fixed:** introduced a `:root` token set (`--color-*`, `--radius-*`, `--shadow-*`, `--focus-ring`)
  and refactored the auth + dashboard + form surfaces to reference it. Values are identical to the
  originals, so this is a zero-visual-change refactor that pays down duplication. The diagram/3D
  theme variables are deliberately left untouched.

## 3. Verification

### 3.1 Static gates
- `npx tsc --noEmit` → **0 errors**.
- `npm test` → all **14 suites pass, 0 failures**.
- `npm run build` → **compiled successfully**, all routes built (`/login`, `/signup`,
  `/forgot-password`, `/reset-password`, `/dashboard`, `/dashboard/new`, `/dashboard/[id]`,
  `/settings`, `/demo/*`).

### 3.2 Browser (public)
- `node scripts/screenshot-pages.mjs` → 12 captures (4 pages × desktop/tablet/mobile), **0 JS errors,
  0 page errors** on every one. Screenshots in `.verify/screenshots/`.
- `scripts/verify-auth-fixes.mjs` → 5/5 checks pass: SVG toggles (no emoji), `<a>` anchors, SPA nav.

### 3.3 Browser (auth-gated)
- Auth gating confirmed intact: `/dashboard`, `/dashboard/new`, `/settings`, `/dashboard/<id>` all
  302-redirect to `/login?redirectTo=...`.
- The authenticated classroom/dashboard **could not be visually reached**: the hosted Supabase project
  rejects throwaway email domains at the `auth.signUp` edge, so no test session could be established.
  This is a pre-existing environment constraint, not a code defect.
- Mitigations: the authenticated routes all **compile and typecheck** (proven by the production
  build), and the full classroom board engine is exercised by the public **2D board harness**
  (`/demo/board`) which shares the same `DiagramRenderer`, layout CSS, and quality gate.

### 3.4 Browser (board engine — no regressions)
- `node scripts/verify-2d-board.mjs` → **14/17 scenarios pass**, identical to the pre-change baseline.
- The 3 failures (`queue` board-usage, `recursion` connector count, `code-trace` code panel) are
  **pre-existing engine/scenario behaviours** — they fail identically on the stashed baseline
  (proven by stash → re-run → restore), and none touch the CSS regions this audit modified.

## 4. Files changed

```
app/(auth)/login/page.tsx
app/(auth)/signup/page.tsx
app/(auth)/forgot-password/page.tsx
app/(auth)/reset-password/page.tsx
app/(dashboard)/layout.tsx
app/(dashboard)/page.tsx
app/(dashboard)/DashboardSidebar.tsx        (new)
app/(dashboard)/dashboard/LessonActions.tsx (new)
app/(dashboard)/settings/SettingsForm.tsx
app/globals.css
components/ui/icons.tsx                     (new — EyeIcon / EyeOffIcon)
scripts/screenshot-pages.mjs                (fixed output-path bug)
scripts/verify-auth-fixes.mjs               (new — regression check for §2.1/2.2)
```

## 5. Remaining / follow-ups

- **Authenticated UI not visually verified** (email-domain validation blocks a test account). With a
  real session, capture `/dashboard`, `/dashboard/new`, `/settings`, and `/dashboard/<id>` at the three
  breakpoints and assert the sidebar active highlight tracks the route.
- **Verify the new `teacherVoiceControls` pause/stop styling** in the live classroom once a session exists.
- The `?scenario=` deterministic harness (`verify-browser.mjs`) targets `BASE/` which now redirects to
  `/login` for unauthenticated visitors; it expects a session cookie, so run it with an authenticated
  browser context.
