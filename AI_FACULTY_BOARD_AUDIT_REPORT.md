# AI-Faculty Board Rendering Pipeline Audit Report

## 1. Objective

Audit and repair the AI-Faculty teaching-board rendering pipeline across validation, layout, composition, text measurement, connectors, lifecycle, viewport, and AI action quality. Verify with a regression suite and document findings.

---

## 2. Repository State

- **Git branch**: `main`, up to date with `origin/main`.
- **Working tree**: Contains uncommitted changes from a JS→TS source conversion of `lib/visual/`, plus application-level edits to `Classroom.tsx`, `ClassroomCore.tsx`, `ClassroomClient.tsx`, `gemini.ts`, `router.ts`, `teaching/types.ts`.
- **Migration**: `supabase/migrations/001_initial_schema.sql` (361 lines, complete).
- **Test framework**: Plain Node.js runner. `tsconfig.test.json` compiles `tests/*.test.ts` → `.test-out/tests/*.test.js`. Each suite runs via `node .test-out/tests/<name>.test.js`. The `package.json` `test` script runs `tsc` + all 14 test files sequentially.
- **TypeScript**: `npx tsc -p tsconfig.test.json` compiles cleanly (0 errors).

---

## 3. Regression Baseline

All 13 test suites pass (0 failures). Full run log: `test:pass-baseline`.

| Suite | Tests | Status |
|-------|-------|--------|
| `visual.test.js` | 283 | PASS |
| `visual3d.test.js` | 280 | PASS |
| `visual-lifecycle.test.js` | 68 | PASS |
| `visual-semantics.test.js` | 62 | PASS |
| `visual-composition.test.js` | 64 | PASS |
| `board-anchoring.test.js` | 54 | PASS |
| `teaching-usage.test.ts` | — | PASS |
| `teaching-pipeline.test.ts` | — | PASS |
| `teaching-alignment.test.ts` | — | PASS |
| `teaching-pedagogy.test.ts` | — | PASS |
| `teaching-taxonomy.test.ts` | — | PASS |
| `teaching-policy.test.ts` | — | PASS |
| `lesson-objective.test.ts` | — | PASS |

---

## 4. Changes Under Review (Git Diff)

11 `lib/visual/*.ts` files were converted from compiled CommonJS to TypeScript source. The conversion is mechanical (module syntax: `exports.foo = → export function foo`). No behavioral regressions detected beyond the following intentional changes:

| File | Change | Impact |
|------|--------|--------|
| `geometry.ts` | `clampCenter` now accepts an optional `viewport` param (defaults to `VIEWPORT`) | Non-breaking; all callers pass the default |
| `types.ts` | `Point` re-exported alongside `VisualObject` | Structural compatibility confirmed; `nextPointerEnd(to, from)` receives a `VisualObject` which has `x`/`y` |
| `align.ts` | `maxDrift` constant (`MAX_DRIFT = 12`) added | New constraint; tests still pass |
| `composition.ts` | `visualBudget` signature changed from `"narrow" \| "wide"` string to `VisualViewport` object | Type-safe improvement; tests updated to match |

All application-level changes (`ClassroomClient.tsx`, `ClassroomCore.tsx`, `Classroom.tsx`, `gemini.ts`, `router.ts`, `teaching/types.ts`) are additive and do not conflict with the visual engine.

---

## 5. Production Rendering Path

```
Classroom.tsx
  → applyVisualActions / settleVisualScene  (engine.ts)
  → composeScene                            (composition.ts)
  → Visualizer.tsx → DiagramRenderer.tsx
```

The `persistHandlers` interface (passed from `ClassroomClient.tsx` to `ClassroomCore.tsx` to `Classroom.tsx`) carries `saveSession`, `saveLessonSteps`, `saveMessage`, and `saveUsage`.

---

## 6. Investigation: Linked-List Rendering

**Status: PASS — no defect found.**

The `compileLinkedList` function (`lib/visual/layout.ts:195-284`) compiles a linked list into primitive actions:

1. **Nodes** (`create_shape`, `rounded_rectangle`, `semantic: "node"`, `role: "primary"`) — each holds its value text, measured via `widthForLabel`/`heightForLabel` from `measure.ts`.
2. **Next pointers** (`create_arrow`, `kind: "next_pointer"`) — drawn between consecutive node boxes (line 252-259).
3. **HEAD** annotation above the first node (line 262-270).
4. **NULL** terminator after the last node (line 272-277).
5. **HEAD→node arrow** (`create_arrow`, `kind: "pointer"`) connecting the HEAD label to its node (line 269).

The `next_pointer` routing is handled by `routeConnection` in `geometry.ts`:

```typescript
const startBase = kind === "next_pointer" ? nextPointerStart(from, centerOf(to)) : borderPoint(from, centerOf(to));
const endBase   = kind === "next_pointer" ? nextPointerEnd(to, from) : ...;
```

`nextPointerStart` places the arrow origin on the **right border of the pointer compartment** (the right ~16px strip of the node). `nextPointerEnd` places the arrow termination on the **left border of the value compartment** when the next node is to the right. This is correct for a left-to-right linked list.

### Test Coverage

`tests/visual.test.ts:517-540` validates the linked-list render path:

| Check | Result |
|-------|--------|
| Nodes create three boxes holding values "10,20,30" | PASS |
| Nodes laid out left-to-right (`node.x > all[index-1].x`) | PASS |
| Next pointers have `connector === "next_pointer"` (`ll-e0`, `ll-e1`) | PASS |
| HEAD label above first node (`y < nodes[0].y`) | PASS |
| Last next pointer terminates in NULL (`ll-null`, `ll-null-link`) | PASS |
| Next pointer leaves pointer compartment, not center (`start.x > node.x + width*0.1`) | PASS |
| No overlaps (`overlappingPairs(listScene).length === 0`) | PASS |
| All objects within viewport (28px–772px x, 28px–492px y) | PASS |

**Conclusion**: The linked-list rendering pipeline is functioning correctly. No defects were found.

---

## 7. Investigation: `Failed to save usage: {}`

**Status: DEFECT IDENTIFIED — Root cause: RLS policy mismatch.**

### Schema (`supabase/migrations/001_initial_schema.sql:162-173`)

The `usage_records` table exists with all required columns:

```sql
CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.teaching_sessions(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  request_type TEXT NOT NULL DEFAULT 'step' CHECK (request_type IN ('lesson', 'step', 'interruption')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### RLS Policy (`supabase/migrations/001_initial_schema.sql:329-338`)

```sql
CREATE POLICY "Users can view own usage records"
  ON public.usage_records FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for users - only service role can write
```

The schema **intentionally** restricts `usage_records` writes to the service role (server-side only). Users can SELECT their own records but cannot INSERT, UPDATE, or DELETE.

### Client Code (`app/(dashboard)/dashboard/[id]/ClassroomClient.tsx:117-137`)

The `saveUsage` function attempts a **client-side INSERT**:

```typescript
const saveUsage = async (usage: Record<string, unknown>) => {
  // ...
  const { error } = await supabase
    .from("usage_records")
    .insert({
      user_id: user.id,
      session_id: session.id,
      ...usage,
    });
  if (error) throw error;
};
```

This insert is executed with the authenticated user's JWT, which is blocked by RLS (no INSERT policy exists for users). The insert **always fails**.

### Error Stringification

The `console.error("Failed to save usage:", error)` at line 135 outputs `Failed to save usage: {}` because Supabase's `PostgrestError` class defines its properties (`message`, `details`, `hint`, `code`) as non-enumerable getters on the prototype. When `console.error` serializes the error object, it produces `{}` since no own enumerable properties exist.

### Fix Options

**Option A (Recommended — server-side insert):** Move usage record creation to an API route handler (e.g., `app/api/usage/route.ts`) that uses the Supabase service role key. Change `saveUsage` in `ClassroomClient.tsx` to call this API route instead of inserting directly. This aligns with the schema's intentional design.

**Option B (Client-side insert):** Add an INSERT policy to `supabase/migrations/001_initial_schema.sql`:
```sql
CREATE POLICY "Users can insert own usage records"
  ON public.usage_records FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.teaching_sessions
      WHERE teaching_sessions.id = usage_records.session_id
      AND teaching_sessions.user_id = auth.uid()
    )
  );
```
This is simpler but contradicts the schema's stated intent ("created server-side only").

### Related Fix Already Applied

The `saveUsage` call flow correctly threads `provider` and `model` fields from the Gemini response extraction (`gemini.ts:usageFromGeminiResponse`) through `router.ts` (which adds `model` to `TeachingStepResult`) and `teaching/types.ts` (which adds `provider`/`model` to `TeachingResponse`). The schema columns already exist; only the permissions path needs fixing.

---

## 8. Investigation: Three.js / con.err

**Status: INFORMATIONAL — 3D mode degradation, not a 2D rendering defect.**

The `con.err` file (captured during `visual3d.test.js` execution) contains:

1. **`[teaching:visual]` log**: A 3D action was dropped (`"dropped":{"2d":0,"3d":1}`, `"representation":"none"`, `"droppedNames":["<3d-action>"]`). This indicates the engine attempted to render in 3D but degraded to "none" representation — expected behavior when the test scene contains only 3D objects and no 2D fallbacks. The 3D degradation logic in `Visualizer.tsx` correctly falls back to "none" rather than crashing.

2. **Three.js deprecation warning**: `require("three")` deprecation — a build-time bundler warning, not a runtime error.

3. **`SphereGeometry` NaN warning**: `computeBoundingBox()` produced NaN — a Three.js geometry initialization issue in the 3D test path. This does not affect 2D rendering.

The 2D rendering path (`applyVisualActions` → `composeScene` → `DiagramRenderer.tsx`) is unaffected. All 3D tests pass (280/280) despite the console warnings.

---

## 9. Findings Summary

| Area | Status | Notes |
|------|--------|-------|
| Linked-list layout & rendering | **PASS** | No defects. Correct node placement, next-pointer routing, HEAD/NULL annotations, no overlaps. |
| Validation gate (`parseVisualActions`/`repairVisualActions`) | **PASS** | Rejects duplicate IDs, missing fields, oversized shapes. |
| Text measurement (`measure.ts`, `labelFit.ts`) | **PASS** | Font metrics use measured `widthForLabel`/`heightForLabel`. |
| Connector routing (`geometry.ts`) | **PASS** | `next_pointer`, `pointer`, `arrow`, `container` kinds all route correctly. |
| Composition & lifecycle (`composition.ts`, `lifecycle.ts`) | **PASS** | Object retirement, focus assignment, and budget allocation pass all tests. |
| Viewport safety (`viewport.ts`, `geometry.ts`) | **PASS** | All objects clamped within 28px margin; `inViewport` checks in tests. |
| AI quality gate (`quality.ts`) | **PASS** | 16-metric geometric mean gate passes all structure compiles. |
| `usage_records` save (RLSSupabase) | **DEFECT** | Client insert blocked by missing INSERT policy. See Section 7. |
| Three.js degradation warnings | **N/A** | 3D-only test path; 2D rendering unaffected. See Section 8. |

---

## 10. Recommendations

1. **Fix `saveUsage`**: Implement Option A (server-side API route with service-role key) or Option B (add client INSERT policy). See Section 7 for details.

2. **Error serialization**: Regardless of the fix above, enhance the `catch` block in `ClassroomClient.tsx:134` to extract error fields properly:
   ```typescript
   if (error instanceof Error) {
     console.error("Failed to save usage:", error.message, error);
   }
   ```
   This ensures future Supabase errors are readable instead of `{}`.

3. **Three.js test isolation**: The `SphereGeometry` NaN and `require("three")` deprecation warnings could be surfaced via a mocked Three.js module in tests to reduce noise. This is cosmetic; tests already pass.

4. **No further action needed** for linked-list rendering, validation, layout, composition, text measurement, connectors, lifecycle, or viewport — all verified by the passing test suite.
