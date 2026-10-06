// DETERMINISTIC 2D BOARD HARNESS.
//
// This page exists so the 2D teaching board can be verified in a REAL browser without a provider, an
// API key or the network. Every scenario is a fixed list of visual actions replayed through the SAME
// engine, layout, validation and renderer the classroom uses — so a screenshot taken here is a
// screenshot of the production board, not of a mock.
//
//   /demo/board?scenario=array            play one scenario
//   /demo/board?scenario=binary-search    (see SCENARIOS in lib/visual/demoScenarios.ts)
//
// Automated checks drive it with:
//   window.__board.step()   apply the next teaching step (and nothing else)
//   window.__board.jump(i)  jump straight to step i
//   window.__board.state()  { step, total, objects, animations, diagnostics }
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { DiagramRenderer } from "../../../components/visual/DiagramRenderer";
import { composeStepScene, settleVisualScene } from "../../../lib/visual/engine";
import type { VisualQualityReport } from "../../../lib/visual/quality";
import { repairVisualActions } from "../../../lib/visual/validate";
import { emptyVisualScene } from "../../../lib/visual/types";
import type { VisualViewport } from "../../../lib/visual/types";
import type { VisualAction, VisualActionDiagnostic, VisualScene } from "../../../lib/visual/types";
import { DEMO_SCENARIOS, type DemoScenario } from "../../../lib/visual/demoScenarios";

export const dynamic = "force-dynamic";

const SETTLE_MS = 1600;

// The scenario and the autoplay flag both come from the query string, which does not exist during
// server rendering. They are therefore READ AFTER MOUNT: picking them during the first render would
// make the server and the client disagree, which React reports as a hydration error.
function useQueryFlag(key: string): string | null {
  const [value, setValue] = useState<string | null>(null);
  useEffect(() => {
    setValue(new URLSearchParams(window.location.search).get(key));
  }, [key]);
  return value;
}

function useScenario(): DemoScenario {
  const requested = useQueryFlag("scenario");
  return useMemo(
    () => DEMO_SCENARIOS.find((scenario) => scenario.id === requested) ?? DEMO_SCENARIOS[0],
    [requested],
  );
}

/**
 * Autoplay is OPT-IN. A human opening the page wants the lesson to play itself, but an automated check
 * must drive one step at a time and be certain the app did not advance underneath it — an autoplay
 * timer firing during a check would silently step the scene twice and make every later reading wrong.
 */
function useAutoplay(): boolean {
  return useQueryFlag("autoplay") === "1";
}

export default function BoardDemoPage() {
  const scenario = useScenario();
  const autoplay = useAutoplay();
  const [step, setStep] = useState(0);
  const [scene, setScene] = useState<VisualScene>(emptyVisualScene);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [diagnostics, setDiagnostics] = useState<VisualActionDiagnostic[]>([]);
  const [report, setReport] = useState<VisualQualityReport | null>(null);
  const [boardViewport, setBoardViewport] = useState<VisualViewport | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The parsed actions are the lesson script: identical every run, so every run is comparable.
  const script = useMemo(
    () => scenario.steps.map((raw) => repairVisualActions(raw).actions),
    [scenario],
  );
  const scriptDiagnostics = useMemo(
    () => scenario.steps.flatMap((raw) => repairVisualActions(raw).diagnostics),
    [scenario],
  );

  /**
   * THE PRODUCTION PATH, NOT A LOOKALIKE.
   *
   * This used to call `applyVisualActionsDetailed` directly, which is one stage of what the classroom
   * does. A screenshot taken here was therefore a screenshot of a board that had been laid out against
   * the canonical canvas, never repaired, and never checked — so the demo page and the classroom could
   * show two different boards for the same lesson, and a verification run against the demo page proved
   * nothing about the classroom.
   *
   * Now the step goes through `composeStepScene`, which is the single entry point the classroom uses:
   * the same measured board, the same repair ladder, the same quality gate. The report it returns is
   * published on `window.__board`, so a browser check reads the verdict on the scene that is actually on
   * screen rather than a separately computed one.
   */
  const apply = useCallback((index: number) => {
    const actions: VisualAction[] = script[index] ?? [];
    setScene((current) => {
      const result = composeStepScene(current, actions, {
        step: index + 1,
        stage: 0,
        ...(boardViewport ? { viewport: boardViewport } : {}),
      });
      setDiagnostics(result.report.problems.slice(0, 6).map((problem) => ({
        action: "focus", target: "-", reason: problem, outcome: "skipped" as const, sceneObjects: result.scene.objects.length, index,
      })));
      setReport(result.report);
      return result.scene;
    });
    setStep(index + 1);
  }, [script, boardViewport]);

  const go = useCallback((index: number) => apply(index), [apply]);

  // Every state change is announced on `window.__board`, which is what the browser verification reads.
  useEffect(() => {
    const w = window as unknown as { __board?: unknown };
    w.__board = {
      scenario: scenario.id,
      autoplay,
      step: () => go(step),
      jump: (index: number) => go(Math.max(0, Math.min(script.length - 1, index))),
      interrupt: () => { setScene((current) => settleVisualScene(current)); setPaused(true); },
      resume: () => setPaused(false),
      settle: () => setScene((current) => settleVisualScene(current)),
      state: () => ({
        scenario: scenario.id,
        step,
        total: script.length,
        paused,
        objects: scene.objects.length,
        animations: scene.objects.filter((object) => object.motion && object.motion.durationMs > 1).length,
        diagnostics: [...scriptDiagnostics, ...diagnostics],
        // The gate's verdict on the scene that is ON SCREEN. A browser check reads this rather than
        // recomputing anything, so what it asserts about is what the student is looking at.
        viewport: boardViewport,
        quality: report ? { score: report.visualQualityScore, passed: report.passed, metrics: report.metrics, failures: report.hardFailures.map((failure) => failure.condition) } : null,
      }),
      text: () => scenario.narration[Math.max(0, step - 1)] ?? "",
    };
  }, [scene, step, script.length, scriptDiagnostics, diagnostics, paused, scenario, go, autoplay, boardViewport, report]);

  /**
   * THE VERIFICATION PROBE (PHASE 26).
   *
   * A browser check needs to know what the RENDERED board is like, and a unit test cannot know that: font
   * sizes come from the browser, overflow is decided by the layout engine, and a clipped label is only
   * clipped once it is painted. So when the page is opened with `?verify=1` it walks its whole scenario,
   * measures the DOM, and publishes the result as JSON inside a `<pre>`.
   *
   * It is published into the DOCUMENT rather than returned over a debug protocol because that makes the
   * check a plain `chrome --headless --dump-dom --screenshot` invocation: no automation dependency, no
   * socket, and the screenshot and the numbers come from the same single rendering of the page — so what
   * was measured and what was looked at cannot be two different boards.
   */
  const verify = useQueryFlag("verify") === "1";
  useEffect(() => {
    if (!verify || !report) return;
    const timer = setTimeout(() => {
      const board = document.querySelector(".diagram-board");
      const canvas = document.querySelector(".diagram-canvas");
      if (!board || !canvas) return;
      const boardBox = board.getBoundingClientRect();
      const doc = document.documentElement;
      const texts = Array.from(document.querySelectorAll(".diagram-canvas text")).map((node) => {
        const box = node.getBoundingClientRect();
        return {
          text: (node.textContent || "").trim().slice(0, 40),
          fontSize: Number.parseFloat(window.getComputedStyle(node).fontSize),
          left: box.left, right: box.right, top: box.top, bottom: box.bottom,
        };
      });
      const shapes = Array.from(document.querySelectorAll(".diagram-canvas rect, .diagram-canvas circle, .diagram-canvas line, .diagram-canvas path"))
        .map((node) => { const box = node.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; });
      const payload = {
        scenario: scenario.id,
        board: { width: Math.round(boardBox.width), height: Math.round(boardBox.height) },
        horizontalOverflow: Math.max(0, doc.scrollWidth - doc.clientWidth),
        verticalOverflow: Math.max(0, doc.scrollHeight - doc.clientHeight),
        clipped: texts.filter((t) => t.left < boardBox.left - 1 || t.right > boardBox.right + 1 || t.top < boardBox.top - 1 || t.bottom > boardBox.bottom + 1)
          .map((t) => t.text).slice(0, 6),
        outsideBoard: shapes.filter((s) => s.left < boardBox.left - 2 || s.right > boardBox.right + 2 || s.top < boardBox.top - 2 || s.bottom > boardBox.bottom + 2).length,
        smallestFont: texts.length > 0 ? Math.min(...texts.map((t) => t.fontSize)) : null,
        textCount: texts.length,
        shapeCount: shapes.length,
        controls: Array.from(document.querySelectorAll("button")).filter((b) => (b as HTMLElement).offsetParent !== null).length,
        objects: scene.objects.length,
        // The viewport the LAYOUT used, next to the one the RENDERER measured. When these disagree, the
        // board is being composed for one rectangle and painted into another — the single defect that makes
        // everything else wrong — so a verification run has to be able to see it.
        sceneViewport: scene.viewport ?? null,
        boardViewport,
        // The viewBox actually on the element, which is what the browser will scale.
        viewBox: canvas.getAttribute("viewBox"),
        firstObject: scene.objects.length > 0
          ? { id: scene.objects[0].id, x: Math.round(scene.objects[0].x), y: Math.round(scene.objects[0].y) }
          : null,
        quality: {
          score: report.visualQualityScore,
          passed: report.passed,
          failures: report.hardFailures.map((failure) => failure.condition),
          // The WHOLE vector, not just the total. A score of 16 with `passed: true` is only diagnosable
          // from the individual metrics, and a check that cannot say which one collapsed is a check that
          // cannot be acted on.
          metrics: report.metrics,
        },
      };
      const target = document.createElement("pre");
      target.id = "verify-probe";
      target.style.display = "none";
      target.textContent = JSON.stringify(payload);
      document.body.appendChild(target);
    }, 900);
    return () => clearTimeout(timer);
  }, [verify, report, scene, scenario]);

  // Autoplay advances one teaching step at a time, which is what makes the screenshots show a lesson
  // being taught rather than a finished diagram appearing at once.
  useEffect(() => {
    if (!autoplay || paused || step >= script.length) return;
    const timer = setTimeout(() => go(step), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [autoplay, step, script.length, paused, go]);

  // A verification run walks the WHOLE scenario and then measures, because a step that is fine on its own
  // can break the board when it follows another — that is what "unrelated previous objects remaining
  // visible" looks like. Autoplay is a timer per step, which is far too slow for a check and makes the
  // number of steps matter; this runs them back to back and then waits once.
  //
  // It WAITS FOR THE BOARD FIRST, and that ordering is the point. The renderer measures the board from a
  // ResizeObserver, which cannot have fired before the first paint, so a step applied immediately is laid
  // out for the canonical canvas and the scene is then rendered into a board of a completely different
  // shape. Every object ends up outside it. The classroom avoids this by replaying when the measurement
  // arrives; a check has no such safety net, so it must wait.
  const verify2 = useQueryFlag("verify") === "1";
  useEffect(() => {
    if (!verify2 || step !== 0) return;
    // Not merely "have we published a viewport" but "is it a REAL one". The canonical fallback is what the
    // renderer would report for a board it has not actually measured, and composing six steps against it
    // means the whole scenario is laid out for a rectangle the student never sees.
    if (!boardViewport || boardViewport.width === 800 && boardViewport.height === 520) return;
    for (let index = 0; index < script.length; index += 1) {
      // Settle the step before the next one, which is what the classroom does when a step finishes. Without
      // it every step's motion is still in flight when the next is applied, and the board is judged on
      // animations that have already played.
      setTimeout(() => { setScene((current) => settleVisualScene(current)); go(index); }, index * 120);
    }
  }, [verify2, step, script.length, go, boardViewport]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const allDiagnostics = [...scriptDiagnostics, ...diagnostics];

  return (
    <main className="classroom demo-board-page">
      <header className="topbar">
        <div className="brand-mark">A</div>
        <div className="brand-text"><strong>2D BOARD</strong><span>{scenario.title}</span></div>
        <div className="lesson-chip"><span className="live-dot" />step {step}/{script.length}</div>
      </header>

      <div className="lesson-layout">
        <div className="board-column">
          <div className="board-shell">
            <div className="board-heading">
              <span className="status-dot is-diagram" />
              <span>{scenario.title}</span>
              <span>{scenario.expectation}</span>
            </div>
            <DiagramRenderer scene={scene} focusId={focusId} onSelectObject={setFocusId} animating={!paused} onViewport={setBoardViewport} />
          </div>

          <div className="controls">
            <div className="controls-title">
              Teaching script
              <span>one button per lesson step — this is what the browser check drives</span>
            </div>
            <div className="control-groups">
              <div className="control-group">
                <span className="group-label">Step</span>
                <div className="button-row">
                  {script.map((_, index) => (
                    <button
                      key={index}
                      type="button"
                      className={index === step ? "accent" : undefined}
                      onClick={() => go(index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
              <div className="control-group">
                <span className="group-label">Narration</span>
                <p className="helper-text">{scenario.narration[Math.max(0, step - 1)] ?? "…"}</p>
              </div>
              <div className="control-group">
                <span className="group-label">Interruption</span>
                <div className="quick-actions">
                  <button type="button" className="accent" disabled={step >= script.length} onClick={() => go(step)}>Next step</button>
                  <button type="button" disabled={!paused} onClick={() => setPaused(false)}>Resume</button>
                  <button type="button" className="danger" disabled={paused} onClick={() => { setScene((current) => settleVisualScene(current)); setPaused(true); }}>Interrupt</button>
                </div>
              </div>
            </div>
            {allDiagnostics.length > 0 ? (
              <div className="mock-panel">
                <div className="mock-panel-title">Visual action diagnostics<span>{allDiagnostics.length}</span></div>
                <ul className="outline-list">
                  {allDiagnostics.map((diagnostic, index) => (
                    <li className="outline-item" key={`${diagnostic.action}-${index}`}>
                      <span className="outline-mark">{diagnostic.outcome === "repaired" ? "~" : "-"}</span>
                      <span className="outline-label">
                        {diagnostic.action}{diagnostic.target ? ` → ${diagnostic.target}` : ""}: {diagnostic.reason} ({diagnostic.outcome}, scene has {diagnostic.sceneObjects} objects)
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <aside className="teacher-panel">
          <div className="panel-brand">
            <div className="teacher-avatar">A</div>
            <div>
              <h2 className="panel-title">2D Board Check</h2>
              <p className="panel-subtitle">{scenario.id}</p>
            </div>
          </div>
          <h3 className="panel-heading">{scenario.title}</h3>
          <p className="helper-text">{scenario.expectation}</p>
          <ul className="outline-list">
            {scenario.checks.map((check) => (
              <li className="outline-item" key={check}><span className="outline-mark">·</span><span className="outline-label">{check}</span></li>
            ))}
          </ul>
          <p className="ask-hint">
            Deterministic scenario: same actions every run, so screenshots are comparable between runs.
          </p>
        </aside>
      </div>
    </main>
  );
}