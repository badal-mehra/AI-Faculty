"use client";

// VISUALIZATION ENGINE (client entry point).
//
//   visual3d_actions -> 3D scene (lib/visual3d/engine.ts) -> Scene3D   (real 3D: GLB models, flows, labels, camera)
//   visual_actions   -> VisualScene  -> DiagramRenderer                (generalized 2D diagram)
//   board_actions    -> BoardState   -> GraphVisualization             (existing node/line graph)
//
// Representation choice:
//   auto  — prefers 3D whenever the lesson produced visual3d_actions, then the 2D diagram, then the
//           graph, then text. This is the required ordering: a 3D topic must actually render in 3D.
//   3d    — forces 3D, degrading 3D -> 2D -> graph -> text if 3D is unavailable.
//   2d    — forces the 2D diagram, degrading to the graph when no diagram objects exist.
//
// Degradation is automatic and never throws: missing WebGL, a crashed renderer, or an empty 3D scene
// all fall through to the next representation. The Three.js bundle is lazy-loaded, so 2D/graph/text
// lessons never pay for it.
import { useCallback, useState, type ReactNode } from "react";
import { DiagramRenderer } from "./DiagramRenderer";
import { GraphVisualization } from "./GraphVisualization";
import { Visual3DWrapper } from "./visual3d-wrapper";
import type { BoardState } from "@/lib/board/types";
import type { VisualScene } from "@/lib/visual/types";
import type { Visual3DScene } from "@/lib/visual3d/types";

export type VisualMode = "auto" | "2d" | "3d";

type Props = {
  mode: VisualMode;
  board: BoardState;
  scene: VisualScene;
  scene3d: Visual3DScene;
  /** Object the teacher is pointing at; everything else on the 2D board is subdued while it is set. */
  focusId?: string | null;
  onFocusObject?: (id: string | null) => void;
  onEraseBoard: (id: string) => void;
  /**
   * Content for the empty stage — offered by the screen that owns lesson start-up (the starter topics).
   * It is passed in rather than imported so the visual engine keeps no opinion about what a student
   * might want to learn; before a lesson the board is empty, and an empty board is a large blank area,
   * so the surrounding screen is allowed to fill it with the actual call to action.
   */
  emptyStage?: ReactNode;
};

export function Visualizer({ mode, board, scene, scene3d, focusId, onFocusObject, onEraseBoard, emptyStage }: Props) {
  const hasDiagram = scene.objects.length > 0;
  const hasGraph = board.nodes.length > 0 || board.texts.length > 0;
  const has3D = scene3d.objects.length > 0;
  // The lesson produced 3D and nothing else. A student who asked for 2D cannot be given a 2D board for
  // this step, because there is nothing to draw on it — and a blank board under a teacher saying "let
  // us look at the whole organ" teaches nothing at all. The view they chose is a preference about HOW
  // to teach, not permission to show nothing, so the 3D is shown and the substitution is stated.
  const only3DContent = has3D && !hasDiagram && !hasGraph;

  // A 3D failure permanently degrades this render pass to the 2D chain.
  const [degrade3D, setDegrade3D] = useState(false);
  const on3DFallback = useCallback((reason: string) => {
    // eslint-disable-next-line no-console
    console.warn(`[visualizer] 3D unavailable (${reason}); falling back to 2D diagram.`);
    setDegrade3D(true);
  }, []);

  // Reset the degrade latch when the lesson moves on to a fresh 3D scene.
  const sceneKey = `${scene3d.lessonId ?? ""}:${scene3d.tick}:${scene3d.objects.length}`;
  const [lastKey, setLastKey] = useState(sceneKey);
  if (lastKey !== sceneKey) {
    setLastKey(sceneKey);
    setDegrade3D(false);
  }

  const allow3D = mode === "3d" || (mode === "auto" && has3D) || (mode === "2d" && only3DContent);
  const use3D = allow3D && has3D && !degrade3D;
  // Shown when the student's 2D choice was overridden because the lesson's ONLY visual content is 3D.
  const overrodeChoice = use3D && mode === "2d" && only3DContent;

  if (use3D) {
    // 3D -> 2D -> graph -> text is handled here: the wrapper reports failure, then we continue down.
    return (
      <div className="representation-stage">
        {overrodeChoice ? (
          <p className="representation-notice" role="status">
            No 2D diagram was drawn for this step, so the 3D view is being shown instead.
          </p>
        ) : null}
        <Visual3DWrapper key={sceneKey} scene={scene3d} onFallback={on3DFallback} />
      </div>
    );
  }

  if (hasDiagram) {
    return (
      <div className="board-shell">
        <div className="board-heading">
          <span className="status-dot is-diagram" />
          <span>Teaching board · 2D</span>
          <span>drag to pan · scroll to zoom · click an object to focus</span>
        </div>
        <DiagramRenderer scene={scene} focusId={focusId ?? null} onSelectObject={onFocusObject} />
      </div>
    );
  }
  if (hasGraph) return <GraphVisualization state={board} onErase={onEraseBoard} />;

  // Nothing to draw yet. The message must agree with (a) the view the student chose and (b) whether a
  // lesson is running at all. Telling someone who explicitly asked for 3D to "ask for a 3D view" is
  // wrong, and describing the pre-lesson board as "this step" when no step exists is equally wrong —
  // it was the first thing on screen, above the starter topics it contradicted.
  const standby: Record<VisualMode, { lesson: { title: string; body: string }; before: { title: string; body: string } }> = {
    "3d": {
      lesson: { title: "Nothing in 3D for this step", body: "There is no model for this moment, so the board stays empty. Keep listening, or ask for a diagram." },
      before: { title: "3D stage ready", body: "Ask your question and the model will appear here, where you can rotate it and look inside." },
    },
    "2d": {
      lesson: { title: "Nothing to draw for this step", body: "The teacher is explaining this moment in words. Keep listening, or ask for a diagram." },
      before: { title: "2D board ready", body: "Ask your question and the diagram will be drawn here, step by step." },
    },
    "auto": {
      lesson: { title: "Text explanation", body: "Nothing visual to draw for this step yet. The teacher is explaining it in words — read the explanation, then ask for a diagram or a 3D view if you would like to see it." },
      before: { title: "Board ready", body: "Choose a view, ask a question, or start from one of the topics below. I will draw it as I explain." },
    },
  };
  const empty = emptyStage ? standby[mode].before : standby[mode].lesson;

  return (
    <div className={`scene3d-fallback${emptyStage ? " has-stage" : ""}`} data-testid="text-fallback" data-empty-for={mode}>
      <div className="empty-stage-message">
        <strong>{empty.title}</strong>
        <p>{empty.body}</p>
      </div>
      {emptyStage}
    </div>
  );
}
