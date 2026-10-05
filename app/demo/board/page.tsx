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
import { applyVisualActionsDetailed, getVisualScene, settleVisualScene } from "../../../lib/visual/engine";
import { repairVisualActions } from "../../../lib/visual/validate";
import { emptyVisualScene } from "../../../lib/visual/types";
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

  const apply = useCallback((index: number) => {
    const actions: VisualAction[] = script[index] ?? [];
    const result = applyVisualActionsDetailed(getVisualScene(scene), actions);
    setScene(result.scene);
    setDiagnostics(result.diagnostics);
    setStep(index + 1);
  }, [scene, script]);

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
      }),
      text: () => scenario.narration[Math.max(0, step - 1)] ?? "",
    };
  }, [scene, step, script.length, scriptDiagnostics, diagnostics, paused, scenario, go, autoplay]);

  // Autoplay advances one teaching step at a time, which is what makes the screenshots show a lesson
  // being taught rather than a finished diagram appearing at once.
  useEffect(() => {
    if (!autoplay || paused || step >= script.length) return;
    const timer = setTimeout(() => go(step), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [autoplay, step, script.length, paused, go]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const allDiagnostics = [...scriptDiagnostics, ...diagnostics];

  return (
    <main className="classroom">
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
            <DiagramRenderer scene={scene} focusId={focusId} onSelectObject={setFocusId} animating={!paused} />
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