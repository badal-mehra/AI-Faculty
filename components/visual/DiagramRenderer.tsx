// DIAGRAM RENDERER — paints a VisualScene as a professional teaching board.
//
// It is a pure function of the scene: no timers, no measurement side effects, no business rules. Every
// decision about WHERE something is was already made deterministically by the engine and the layout
// module; this file only decides how it looks and how it moves.
//
// Four things it must get right, because they are what separates a classroom whiteboard from a pile of
// SVG primitives:
//
//   1. PAINT ORDER  connections under nodes, nodes under text. A parent-child edge must not cut through
//                    the circle it belongs to.
//   2. HIERARCHY    role decides type size, weight and stroke; a dimmed object recedes; the focused
//                    object is unmistakably the brightest thing on the board.
//   3. TEACHING     motion is drawn, not just faded: a connector EXTENDS itself, a packet RUNS along it,
//                    a flow packet travels the route the router chose.
//   4. VIEWPORT     the board fits its own content with classroom margins and can be zoomed/panned,
//                    and it never clips and never renders a diagram microscopically small.
import { type CSSProperties, type PointerEvent, type ReactElement, type ReactNode, type WheelEvent, memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Point, VisualObject, VisualScene } from "../../lib/visual/types";
import { boxOfObject, clamp, pointAlongRoute, routeConnection } from "../../lib/visual/geometry";
import type { Box, ConnectionRoute } from "../../lib/visual/geometry";
import { fitLabelInBox, MAX_LABEL_FONT_SIZE, MIN_LABEL_FONT_SIZE } from "../../lib/visual/labelFit";
import { codeLanguageLabel, highlightCode } from "../../lib/visual/code";
import { CODE_FONT_SIZE } from "../../lib/visual/layout";

// Code panel metrics. These MUST match compileCodeBlock() in lib/visual/layout.ts, or the text will be
// positioned against a box the layout never reserved. They are asserted equal in the test suite.
const CODE_LINE_HEIGHT_EM = 21;
const CODE_CHAR_WIDTH_EM = 0.6;
const CODE_GUTTER_MIN = 34;
const CODE_PADDING_X = 16;
const CODE_PADDING_Y = 14;

const STROKE = 2.4;
const THIN_STROKE = 1.8;
const SHADOW_FILTER = "drop-shadow(0 3px 5px rgb(2 12 16 / 55%))";
const EMPHASIS_FILTER = "drop-shadow(0 0 12px rgb(142 247 182 / 45%))";

type Props = {
  scene: VisualScene;
  /** Id of the object the teacher is talking about. Everything else is subdued while it is set. */
  focusId?: string | null;
  /** Reports the object the student clicked, so the classroom can point at it (click again to clear). */
  onSelectObject?: (id: string | null) => void;
  /** Raised while a step is being applied, so in-flight motion can be settled instead of replayed. */
  animating?: boolean;
};

// Roles carry the hierarchy. This is the ONLY place role -> type size is defined, so a title looks like
// a title on every topic and at every zoom level.
/**
 * A listing, drawn the way a listing has to be drawn to be readable: monospace, line-numbered,
 * indentation preserved, and with the line the teacher is talking about lit behind the text.
 *
 * Code that is centred, proportional and unnumbered cannot be followed by eye down a loop — the reader
 * loses their place between one statement and the next. Indentation is reproduced exactly because in
 * most languages it IS the structure, and the gutter gives every line a fixed address.
 */
function CodeBlock({ object, subdued }: { object: VisualObject; subdued: boolean }): ReactNode {
  const lines = object.codeLines ?? [];
  const tokens = useMemo(() => highlightCode(lines), [lines]);
  const fontSize = Math.min(22, Math.max(12, object.fontSize ?? CODE_FONT_SIZE));
  const lineHeight = fontSize * (CODE_LINE_HEIGHT_EM / CODE_FONT_SIZE);
  const charWidth = fontSize * CODE_CHAR_WIDTH_EM;
  const gutter = Math.max(CODE_GUTTER_MIN, String(Math.max(1, lines.length)).length * fontSize * 0.6 + 16);
  const title = object.title ?? codeLanguageLabel(object.language);
  const titleHeight = title ? fontSize * 1.7 : 0;
  const top = -object.height / 2;
  const firstLine = top + CODE_PADDING_Y + titleHeight + lineHeight / 2;
  const highlighted = new Set(object.highlightLines ?? []);
  return (
    <>
      <rect
        className={`diagram-code-panel${subdued ? " is-dimmed" : ""}`}
        x={-object.width / 2}
        y={top}
        width={object.width}
        height={object.height}
        rx={12}
      />
      {title ? (
        <text className="diagram-code-title" x={-object.width / 2 + CODE_PADDING_X} y={top + titleHeight} dominantBaseline="central">
          {title}
        </text>
      ) : null}
      {lines.map((line, index) => {
        const y = firstLine + index * lineHeight;
        const isHighlighted = highlighted.has(index + 1);
        return (
          <g key={`${object.id}-code-${index}`}>
            {isHighlighted ? (
              <rect className="diagram-code-highlight" x={-object.width / 2 + 4} y={y - lineHeight / 2 + 1} width={object.width - 8} height={lineHeight - 2} rx={5} />
            ) : null}
            <text className="diagram-code-gutter" x={-object.width / 2 + CODE_PADDING_X + gutter - 12} y={y} textAnchor="end" dominantBaseline="central" fontSize={fontSize * 0.82}>
              {index + 1}
            </text>
            <text
              className={`diagram-code-line${subdued ? " is-dimmed" : ""}${isHighlighted ? " is-current" : ""}`}
              x={-object.width / 2 + CODE_PADDING_X + gutter}
              y={y}
              dominantBaseline="central"
              fontSize={fontSize}
              // Long listings are clipped rather than scaled down: unreadable code teaches nothing, and
              // a truncated line still reads as "this line continues".
              style={{ fontVariantLigatures: "none" }}
              textLength={undefined}
              lengthAdjust="spacingAndGlyphs"
            >
              <title>{line}</title>
              {tokens[index]?.map((token, tokenIndex) => (
                <tspan key={`${object.id}-t${index}-${tokenIndex}`} className={`code-token-${token.kind}`} xmlSpace="preserve">
                  {token.text}
                </tspan>
              ))}
              {line.length === 0 ? " " : null}
            </text>
          </g>
        );
      })}
      {object.code && object.code.length > lines.join("\n").length ? (
        <text className="diagram-code-more" x={0} y={top + object.height - CODE_PADDING_Y / 2} textAnchor="middle" dominantBaseline="central">
          …listing continues
        </text>
      ) : null}
    </>
  );
}

const ROLE_FONT: Record<string, number> = {
  title: 22,
  subtitle: 17,
  step: 16,
  caption: 13,
  annotation: 13,
  callout: 15,
  primary: 20,
  secondary: 16,
};

const ROLE_WEIGHT: Record<string, number> = {
  title: 800,
  subtitle: 700,
  step: 700,
  caption: 600,
  annotation: 500,
  callout: 700,
  primary: 700,
  secondary: 600,
};

/** Paint layer: 0 = connections, 1 = shapes, 2 = labels. Arrow tails must disappear under their nodes. */
const layerOf = (object: VisualObject): number =>
  object.kind === "arrow" || object.kind === "connector" ? 0 : object.kind === "text" || object.kind === "formula" || object.kind === "label" || object.kind === "icon" || object.kind === "code_block" ? 2 : 1;

const shapeFill = (object: VisualObject): string => {
  switch (object.semantic) {
    case "process":
      return "var(--shape-process)";
    case "state":
      return "var(--shape-state)";
    case "packet":
      return "var(--shape-packet)";
    case "note":
      return "var(--shape-note)";
    case "terminal":
    case "decision":
    case "service":
      return "var(--shape-decision)";
    case "actor":
      return "var(--shape-actor)";
    case "data":
    case "node":
      return "var(--shape-data)";
    case "component":
      return "var(--shape-component)";
    default:
      return "var(--shape-default)";
  }
};

const shapeStroke = (object: VisualObject): string => {
  switch (object.semantic) {
    case "process":
      return "var(--stroke-process)";
    case "state":
      return "var(--stroke-state)";
    case "packet":
      return "var(--stroke-packet)";
    case "note":
      return "var(--stroke-note)";
    case "terminal":
    case "decision":
    case "service":
      return "var(--stroke-decision)";
    case "actor":
      return "var(--stroke-actor)";
    case "data":
    case "node":
      return "var(--stroke-data)";
    case "component":
      return "var(--stroke-component)";
    default:
      return "var(--stroke-default)";
  }
};

/** <line> and <arrow> primitives are thin bars; `arrow` gets an arrowhead, `line` does not. */
const BAR_SHAPES = new Set(["line", "arrow", "connector"]);

/** The geometry of a shape, centred on the origin so it can be placed with one transform. */
function shapeGeometry(shape: VisualObject["shape"], w: number, h: number): string {
  switch (shape) {
    case "rectangle":
      return `M ${-w / 2} ${-h / 2} H ${w / 2} V ${h / 2} H ${-w / 2} Z`;
    case "square": {
      const s = Math.min(w, h);
      return `M ${-s / 2} ${-s / 2} H ${s / 2} V ${s / 2} H ${-s / 2} Z`;
    }
    case "capsule": {
      const r = Math.min(h / 2, w / 2);
      return `M ${-w / 2 + r} ${-h / 2} H ${w / 2 - r} A ${r} ${r} 0 0 1 ${w / 2 - r} ${h / 2} H ${-w / 2 + r} A ${r} ${r} 0 0 1 ${-w / 2 + r} ${-h / 2} Z`;
    }
    case "diamond":
      return `M 0 ${-h / 2} L ${w / 2} 0 L 0 ${h / 2} L ${-w / 2} 0 Z`;
    case "triangle":
      return `M 0 ${-h / 2} L ${w / 2} ${h / 2} L ${-w / 2} ${h / 2} Z`;
    case "hexagon": {
      const k = w * 0.26;
      return `M ${-w / 2 + k} ${-h / 2} H ${w / 2 - k} L ${w / 2} 0 L ${w / 2 - k} ${h / 2} H ${-w / 2 + k} L ${-w / 2} 0 Z`;
    }
    case "pentagon": {
      const r = Math.min(w, h) / 2;
      const points = Array.from({ length: 5 }, (_, index) => {
        const angle = -Math.PI / 2 + (index * 2 * Math.PI) / 5;
        return `${(Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r * 1.15).toFixed(2)}`;
      });
      return `M ${points.join(" L ")} Z`;
    }
    case "ellipse":
      return `M ${-w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${w / 2} 0 A ${w / 2} ${h / 2} 0 1 0 ${-w / 2} 0 Z`;
    case "circle": {
      const r = Math.min(w, h) / 2;
      return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
    }
    case "point":
    case "marker": {
      const r = Math.min(w, h) / 2;
      return `M 0 ${-r} A ${r} ${r} 0 1 0 0 ${r} A ${r} ${r} 0 1 0 0 ${-r} Z`;
    }
    case "cylinder": {
      const ry = Math.min(h * 0.16, w * 0.16);
      return `M ${-w / 2} ${-h / 2 + ry} A ${w / 2} ${ry} 0 0 1 ${w / 2} ${-h / 2 + ry} V ${h / 2 - ry} A ${w / 2} ${ry} 0 0 1 ${-w / 2} ${h / 2 - ry} Z`;
    }
    case "polygon": {
      // A hexagon-ish generic polygon keeps an arbitrary "polygon" from looking like a default box.
      const k = w / 2;
      return `M ${-k * 0.6} ${-h / 2} L ${k * 0.6} ${-h / 2} L ${k} ${-h * 0.1} L ${k * 0.7} ${h / 2} L ${-k * 0.7} ${h / 2} L ${-k} ${-h * 0.1} Z`;
    }
    default:
      return `M ${-w / 2} ${-h / 2} H ${w / 2} V ${h / 2} H ${-w / 2} Z`;
  }
}

/**
 * Honours `prefers-reduced-motion`.
 *
 * The CSS media query covers every declarative keyframe, but SMIL (the travelling packet) is not
 * governed by it, so the renderer checks it directly and simply does not emit motion. A student who
 * asked for less movement gets the finished board, which is exactly the information the animation was
 * going to convey.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/** A linked-list / tree node: the value compartment on the left, the pointer compartment on the right. */
function nodeCompartment(shape: VisualObject): ReactNode {
  return <line x1={0} y1={-shape.height / 2 + 8} x2={0} y2={shape.height / 2 - 8} className="diagram-compartment" />;
}

/**
 * Roles that carry the LESSON rather than the data, and only for TEXT.
 *
 * Focus dimming exists to say "look here now", and it was applied to everything that is not the current
 * subject — which quietly included the title, the formula and the step caption. Those are the words
 * the teacher is saying out loud, and a bar chart whose heading greys out the moment a bar is
 * highlighted stops reading as a chart with a heading. They keep full contrast no matter where the
 * focus is; only the material being contrasted against it recedes.
 *
 * Scoped to TEXT on purpose. A shape that plays a `primary` role — a sequence diagram's participant
 * box — still has to recede with its own label, or the shape fades while its name stays at full
 * strength and the label appears to float unattached.
 */
const NEVER_DIMMED_TEXT_ROLES = new Set(["title", "subtitle", "callout", "step", "primary"]);

/** Text the board refuses to dim. Published as `is-fixed-contrast` so tests can see the decision. */
const isFixedContrast = (object: VisualObject): boolean =>
  object.kind === "formula" || (object.kind === "text" && NEVER_DIMMED_TEXT_ROLES.has(object.role ?? ""));

/** An object is subdued when the teacher has moved on, but it is never erased. */
const subduedFor = (object: VisualObject, focusIds: string[] | undefined): boolean => {
  if (object.dimmed) return true;
  if (isFixedContrast(object)) return false;
  if (!focusIds || focusIds.length === 0) return false;
  return !focusIds.includes(object.id);
};

const connectorClass = (object: VisualObject, animated: boolean): string => {
  const parts = ["diagram-line"];
  if (object.arrowStyle === "dashed" || object.connector === "dashed" || object.connector === "parent_child") parts.push("is-dashed");
  if (object.arrowStyle === "dotted" || object.connector === "dotted") parts.push("is-dotted");
  if (animated) parts.push("is-drawn");
  return parts.join(" ");
};

const ARROW_DIRECTIONS: Record<string, number> = { above: 0, right: 90, below: 180, left: -90 };

/** A leader line from a label to the object it names — never a floating annotation. */
function LeaderLine({ from, to, className }: { from: Point; to: Point; className: string }): ReactNode {
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const d = `M ${from.x} ${from.y} Q ${mid.x} ${mid.y - 4} ${to.x} ${to.y}`;
  return (
    <g className={className}>
      <path d={d} fill="none" strokeWidth={THIN_STROKE} markerEnd="url(#diagram-arrowhead-small)" />
      <circle cx={to.x} cy={to.y} r={2.4} className="diagram-leader-dot" />
    </g>
  );
}

function DiagramRendererImpl({ scene, focusId, onSelectObject, animating = true }: Props): ReactElement {
  const reducedMotion = usePrefersReducedMotion();
  const motionEnabled = animating && !reducedMotion;
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [autoFit, setAutoFit] = useState(true);
  const panRef = useRef<{ pointerId: number; x: number; y: number; panX: number; panY: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  // THE USABLE BOARD AREA, measured rather than assumed.
  //
  // The board is not the browser window: it is whatever is left after the header, the panel, the board
  // heading and the page padding, and that changes with the viewport, the stacking mode and the panel
  // width. The viewBox has to be derived from it, or `preserveAspectRatio` letterboxes the drawing and
  // the same 36% of the board stays empty on a 390px phone as on a 1920px monitor.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stage, setStage] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => {
      const width = node.clientWidth;
      const height = node.clientHeight;
      // Zero means the node is not laid out yet (first paint, or a hidden tab); keeping the previous
      // value avoids a frame computed from a 0x0 stage, which would zoom the board to nothing.
      if (width > 0 && height > 0) setStage((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const byId = useMemo(() => {
    const map = new Map<string, VisualObject>();
    for (const object of scene.objects) map.set(object.id, object);
    return map;
  }, [scene.objects]);

  // Paint order is fixed: connections, then shapes, then labels — regardless of creation order.
  const painted = useMemo(
    () => [...scene.objects].sort((a, b) => layerOf(a) - layerOf(b) || a.order - b.order),
    [scene.objects],
  );

  // Obstacles a connector must route around: every filled shape, minus the two it connects.
  const obstacles = useMemo(
    () => scene.objects.filter((object) => object.kind !== "arrow" && object.kind !== "connector" && object.kind !== "text" && object.kind !== "formula" && object.kind !== "icon" && object.kind !== "label"),
    [scene.objects],
  );

  // Routes are computed once per scene, not per frame, so an animation tick never re-routes anything.
  const routes = useMemo(() => {
    const map = new Map<string, ConnectionRoute>();
    for (const object of scene.objects) {
      if (object.kind !== "arrow" && object.kind !== "connector") continue;
      if (!object.refs) continue;
      const from = byId.get(object.refs.from);
      const to = byId.get(object.refs.to);
      if (!from || !to) continue;
      const localObstacles = obstacles
        .filter((obstacle) => obstacle.id !== from.id && obstacle.id !== to.id)
        .map((obstacle) => boxOfObject(obstacle));
      map.set(object.id, routeConnection(from, to, { offset: object.offset ?? 0, kind: object.connector, obstacles: localObstacles, label: object.text ?? "" }));
    }
    return map;
  }, [scene.objects, byId, obstacles]);

  // Viewport: the board frames its own content with classroom margins, so a small diagram is not lost
  // in a sea of background and a large one is not clipped.
  const view = useMemo(() => {
    const solids = scene.objects.filter((object) => object.kind !== "arrow" && object.kind !== "connector");
    const boxes = solids.length > 0
      ? solids.map((object) => boxOfObject(object))
      : scene.objects.map((object) => boxOfObject(object));
    if (boxes.length === 0) return { x: 0, y: 0, w: 800, h: 520 };
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const box of boxes) {
      left = Math.min(left, box.left);
      top = Math.min(top, box.top);
      right = Math.max(right, box.right);
      bottom = Math.max(bottom, box.bottom);
    }
    // Connections can stick out beyond their endpoints' union (a detour, an arrowhead).
    for (const object of scene.objects) {
      if (object.kind !== "arrow" && object.kind !== "connector") continue;
      const box = boxOfObject(object);
      left = Math.min(left, box.left);
      top = Math.min(top, box.top);
      right = Math.max(right, box.right);
      bottom = Math.max(bottom, box.bottom);
    }
const margin = 34;
    // THE FRAME IS THE DRAWING PLUS ITS MARGINS — not a fixed minimum inflated to a canonical size.
    //
    // A 620-wide floor against a 372-wide listing meant the drawing occupied 60% of the board and 40%
    // was dead space, identically at every screen size, because the floor is in board units and the
    // board is a different pixel width on every display. Content that does not fill the frame does not
    // become more legible by being surrounded by emptiness; it just looks unfinished.
    //
    // The remaining floor is small and exists only so a genuinely tiny drawing (one arrow, one cell)
    // is not magnified into a poster. Above the ceiling the board stops growing and the extra room is
    // left as margin, which is what a whiteboard does.
    const minimum = { w: 380, h: 300 };
    const maximum = { w: 1040, h: 660 };
    const contentW = right - left + margin * 2;
    const contentH = bottom - top + margin * 2;
    let w = clamp(contentW, minimum.w, maximum.w);
    let h = clamp(contentH, minimum.h, maximum.h);
    // MATCH THE AVAILABLE AREA'S SHAPE, so nothing is letterboxed away.
    //
    // The viewBox is scaled to fit the element with `meet`, which picks the limiting axis and leaves
    // equal dead bands on the other one. A 440x528 frame in a 1118x727 board scaled on height, so the
    // drawing occupied 64% of the width and a third of the board was background — at every screen size,
    // because the mismatch was baked into the frame rather than measured from the screen. Widening (or
    // heightening) the frame to the stage's aspect costs nothing and hands the drawing all of the room.
    if (stage) {
      const stageAspect = stage.width / Math.max(stage.height, 1);
      if (w / h < stageAspect) w = Math.min(h * stageAspect, maximum.w * 1.6);
      else h = Math.min(w / stageAspect, maximum.h * 1.6);
    }
    // The frame is CENTRED on the drawing on BOTH axes. Top-aligning it left the bottom two thirds
    // of the board empty whenever a structure was short (a four-cell array), which reads as a broken
    // board rather than as deliberate framing.
    return { x: left - (w - contentW) / 2 - margin, y: top - (h - contentH) / 2 - margin, w, h };
  }, [scene.objects, stage]);

  // Focus must NEVER crop the board. The whole scene stays framed at all times; pointing at one object
  // is carried by its brightness and by the rest receding, not by zooming in until everything else has
  // been pushed off the edge. This is the "no clipping, nothing thrown off screen" rule.
  const focusBox = useMemo(() => {
    const id = focusId ?? scene.focusIds?.[0];
    if (!id) return null;
    const object = byId.get(id);
    if (!object) return null;
    const box = boxOfObject(object);
    const pad = Math.max(40, Math.max(box.right - box.left, box.bottom - box.top) * 0.6);
    return { x: box.left - pad, y: box.top - pad, w: pad * 2, h: pad * 2 };
  }, [focusId, scene.focusIds, byId]);

  const baseView = useMemo(() => {
    if (!focusBox) return view;
    // Union: keep the whole drawing visible, and only GROW the frame when the focus sits outside it.
    const left = Math.min(view.x, focusBox.x);
    const top = Math.min(view.y, focusBox.y);
    const right = Math.max(view.x + view.w, focusBox.x + focusBox.w);
    const bottom = Math.max(view.y + view.h, focusBox.y + focusBox.h);
    return { x: left, y: top, w: right - left, h: bottom - top };
  }, [view, focusBox]);
  const frame = useMemo(() => {
    const cx = baseView.x + baseView.w / 2;
    const cy = baseView.y + baseView.h / 2;
    const w = baseView.w / zoom;
    const h = baseView.h / zoom;
    return { x: cx - w / 2 + pan.x, y: cy - h / 2 + pan.y, w, h };
  }, [baseView, zoom, pan]);

  // The viewBox is the ONLY thing that changes when the teacher zooms; the scene is untouched, so a new
  // object can never silently throw the existing drawing off screen.
  const viewBox = `${frame.x.toFixed(1)} ${frame.y.toFixed(1)} ${frame.w.toFixed(1)} ${frame.h.toFixed(1)}`;

  // A new step re-frames the drawing and drops any manual pan, so the student always sees the whole board.
  useEffect(() => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setAutoFit(true);
  }, [scene.tick]);

  const onPointerDown = useCallback((event: PointerEvent<SVGSVGElement>) => {
    panRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, panX: pan.x, panY: pan.y };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [pan]);

  const onPointerMove = useCallback((event: PointerEvent<SVGSVGElement>) => {
    const start = panRef.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const scale = frame.w / (event.currentTarget.clientWidth || frame.w);
    setPan({ x: start.panX - (event.clientX - start.x) * scale, y: start.panY - (event.clientY - start.y) * scale });
    setAutoFit(false);
  }, [frame]);

  const onPointerUp = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) {
      panRef.current = null;
      setDragging(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  // A click on empty canvas clears the focus, so "point at one thing" is always reversible.
  const onCanvasClick = useCallback((event: PointerEvent<SVGSVGElement>) => {
    if (event.target === event.currentTarget) onSelectObject?.(null);
  }, [onSelectObject]);

  const onWheel = useCallback((event: WheelEvent<SVGSVGElement>) => {
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setZoom((current) => Math.min(2.6, Math.max(1, Number((current * factor).toFixed(3)))));
  }, []);

  const focusIds = useMemo(() => {
    if (focusId) return [focusId];
    return scene.focusIds;
  }, [focusId, scene.focusIds]);

  return (
    <div className="diagram-board" ref={stageRef}>
      <svg
        className={`diagram-canvas theme-${scene.theme ?? "general"}${dragging ? " is-panning" : ""}`}
        viewBox={viewBox}
        role="img"
        aria-label="Teaching board"
        // What the teacher is pointing at, published so the acceptance harness can tell "nothing receded
        // with the focus" apart from "everything left is the focus itself".
        data-focus-ids={(focusIds ?? []).join(" ")}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onClick={onCanvasClick}
      >
        <defs>
          {/* Arrowheads are marker-end units, so they scale with stroke width instead of looking like
              separate little triangles pasted onto the line. */}
          <marker id="diagram-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 Z" className="diagram-arrowhead" />
          </marker>
          <marker id="diagram-arrowhead-small" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M 0 1 L 9 5 L 0 9 Z" className="diagram-arrowhead-small" />
          </marker>
        </defs>

        {painted.map((object) => {
          if (object.kind === "arrow" || object.kind === "connector") {
            const route = routes.get(object.id);
            if (!route) return null;
            return (
              <DiagramConnection
                key={object.id}
                object={object}
                route={route}
                subdued={subduedFor(object, focusIds)}
                animated={motionEnabled}
              />
            );
          }
          if (object.kind === "code_block") {
            return (
              <g
                key={object.id}
                className="diagram-float"
                data-object-id={object.id}
                data-kind={object.kind}
                transform={`translate(${object.x} ${object.y})`}
              >
                {object.motion ? (
                  <MotionGroup motion={object.motion} disabled={!motionEnabled}>
                    <CodeBlock object={object} subdued={subduedFor(object, focusIds)} />
                  </MotionGroup>
                ) : (
                  <CodeBlock object={object} subdued={subduedFor(object, focusIds)} />
                )}
              </g>
            );
          }
          if (object.kind === "text" || object.kind === "formula") {
            const lines = object.textLines ?? (object.text ? [object.text] : []);
            const fontSize = Math.min(MAX_LABEL_FONT_SIZE, Math.max(MIN_LABEL_FONT_SIZE, object.fontSize ?? 17));
            const role = object.role ?? (object.kind === "formula" ? "annotation" : "secondary");
            // `is-fixed-contrast` marks text the board refuses to dim (see NEVER_DIMMED_ROLES). It is
            // published in the DOM so the acceptance harness can tell "nothing receded" apart from
            // "nothing was allowed to recede" instead of failing a correct board.
            const fixedContrast = isFixedContrast(object);
return (
              <g
                key={object.id}
                className="diagram-float"
                data-object-id={object.id}
                data-kind={object.kind}
                transform={`translate(${object.x} ${object.y})`}
              >
                {object.motion ? (
                  <MotionGroup motion={object.motion} disabled={!motionEnabled}>
                    <text
                      className={`diagram-text role-${role}${subduedFor(object, focusIds) ? " is-dimmed" : ""}${fixedContrast ? " is-fixed-contrast" : ""}`}
                      fontSize={fontSize}
                      fontWeight={ROLE_WEIGHT[role] ?? 600}
                      textAnchor="middle"
                    >
                      {lines.map((line, index) => (
                        <tspan key={`${object.id}-l${index}`} x={0} y={(index - (lines.length - 1) / 2) * fontSize * 1.22}>
                          {line}
                        </tspan>
                      ))}
                    </text>
                  </MotionGroup>
                ) : (
                  <text
                    className={`diagram-text role-${role}${subduedFor(object, focusIds) ? " is-dimmed" : ""}${fixedContrast ? " is-fixed-contrast" : ""}`}
                    fontSize={fontSize}
                    fontWeight={ROLE_WEIGHT[role] ?? 600}
                    textAnchor="middle"
                  >
                    {lines.map((line, index) => (
                      <tspan key={`${object.id}-l${index}`} x={0} y={(index - (lines.length - 1) / 2) * fontSize * 1.22}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
              </g>
            );
          }
          if (object.kind === "label") {
            const fontSize = Math.min(MAX_LABEL_FONT_SIZE, Math.max(MIN_LABEL_FONT_SIZE, object.fontSize ?? 14));
            const target = object.labelOf ? byId.get(object.labelOf.id) : undefined;
            const anchor = target ? sidePointFor(target, object) : undefined;
            return (
              <g key={object.id} className="diagram-float" data-object-id={object.id} data-kind={object.kind}>
                {anchor ? <LeaderLine from={{ x: object.x, y: object.y }} to={anchor} className="diagram-leader" /> : null}
                <text
                  className={`diagram-label${subduedFor(object, focusIds) ? " is-dimmed" : ""}`}
                  x={object.x}
                  y={object.y}
                  fontSize={fontSize}
                  textAnchor="middle"
                  dominantBaseline="middle"
                >
                  {object.textLines?.length ? object.textLines.map((line, index) => (
                    <tspan key={`${object.id}-l${index}`} x={object.x} y={object.y + (index - ((object.textLines?.length ?? 1) - 1) / 2) * fontSize * 1.2}>
                      {line}
                    </tspan>
                  )) : object.text}
                </text>
              </g>
            );
          }
          if (object.kind === "icon") {
            return (
              <g key={object.id} className="diagram-float" data-object-id={object.id} data-kind={object.kind} transform={`translate(${object.x} ${object.y})`}>
                <text className={`diagram-icon${subduedFor(object, focusIds) ? " is-dimmed" : ""}`} textAnchor="middle" dominantBaseline="central" fontSize={object.fontSize ?? 24}>
                  {object.glyph}
                </text>
              </g>
            );
          }
          const subdued = subduedFor(object, focusIds);
          const emphasised = object.emphasis === true;
          const bar = object.shape !== undefined && BAR_SHAPES.has(object.shape);
          const selectable = Boolean(onSelectObject) && object.kind !== "container" && !bar;
          const fill = shapeFill(object);
          const stroke = shapeStroke(object);
          const fontSize = Math.min(MAX_LABEL_FONT_SIZE, Math.max(MIN_LABEL_FONT_SIZE, object.fontSize ?? 20));
          const role = object.role ?? "primary";
          const label = object.text ? fitLabelInBox(object.text, object.width, object.height, fontSize) : null;
          // A "node" (linked list / tree / graph) is drawn as two compartments so the next pointer has
          // somewhere real to start from.
          const compartments = object.semantic === "node" && object.shape !== "circle" && object.width > 110;
          const body = (
            <>
              <path
                className={`diagram-shape${subdued ? " is-dimmed" : ""}${emphasised ? " is-emphasized" : ""}${bar ? " is-bar" : ""}`}
                d={bar ? `M ${-object.width / 2} ${-object.height / 2} H ${object.width / 2} V ${object.height / 2} H ${-object.width / 2} Z` : shapeGeometry(object.shape, object.width, object.height)}
                style={{ fill: object.shape === "container" || bar ? "none" : fill, stroke, filter: emphasised ? EMPHASIS_FILTER : object.shape === "container" || bar ? "none" : SHADOW_FILTER }}
              />
              {object.shape === "container" ? (
                // A narrow container is a LIFELINE, not a frame: it is drawn as a thin rule, because a
                // 3px dashed rectangle reads as a stray box rather than a vertical line.
                object.width <= 8 ? (
                  <line className={`diagram-lifeline${subdued ? " is-dimmed" : ""}`} x1={-0.75} y1={-object.height / 2} x2={-0.75} y2={object.height / 2} style={{ stroke }} />
                ) : (
                  <rect
                    className={`diagram-frame${subdued ? " is-dimmed" : ""}`}
                    x={-object.width / 2}
                    y={-object.height / 2}
                    width={object.width}
                    height={object.height}
                    rx={14}
                    style={{ stroke }}
                  />
                )
              ) : null}
              {compartments ? nodeCompartment(object) : null}
              {label && label.lines.length > 0 ? (
                <text
                  className={`diagram-shape-label role-${role}${subdued ? " is-dimmed" : ""}`}
                  fontSize={label.fontSize}
                  fontWeight={ROLE_WEIGHT[role] ?? 700}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {label.lines.map((line, index) => {
                    const y = (index - (label.lines.length - 1) / 2) * label.fontSize * 1.2;
                    // In a compartmented node the value belongs in the LEFT compartment only.
                    return (
                      <tspan key={`${object.id}-l${index}`} x={compartments ? -object.width / 4 : 0} y={y}>
                        {line}
                      </tspan>
                    );
                  })}
                </text>
              ) : null}
            </>
          );
          return (
            <g
              key={object.id}
              className={selectable ? "is-selectable" : undefined}
              data-object-id={object.id}
              data-kind={object.kind}
              transform={`translate(${object.x} ${object.y}) rotate(${object.rotation})`}
              onPointerUp={selectable ? (event) => { event.stopPropagation(); onSelectObject?.(focusId === object.id ? null : object.id); } : undefined}
            >
              {object.motion ? (
                <MotionGroup motion={object.motion} disabled={!motionEnabled}>
                  {body}
                </MotionGroup>
              ) : body}
            </g>
          );
        })}

        {scene.objects.length === 0 ? (
          <text className="diagram-empty" x={frame.x + frame.w / 2} y={frame.y + frame.h / 2} textAnchor="middle">
            The board is ready — the teacher is drawing on it.
          </text>
        ) : null}
      </svg>

      <div className="diagram-toolbar" role="group" aria-label="Board view controls">
        <button type="button" onClick={() => setZoom((current) => Math.max(1, Number((current / 1.2).toFixed(3))))} disabled={zoom <= 1} aria-label="Zoom out">
          −
        </button>
        <span className="diagram-zoom">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => setZoom((current) => Math.min(2.6, Number((current * 1.2).toFixed(3))))} disabled={zoom >= 2.6} aria-label="Zoom in">
          +
        </button>
        <button type="button" className={autoFit ? "is-active" : ""} onClick={() => { setAutoFit(true); setZoom(1); setPan({ x: 0, y: 0 }); }}>
          Fit
        </button>
        {focusId ? (
          <button type="button" onClick={() => { setAutoFit(true); setZoom(1); setPan({ x: 0, y: 0 }); }}>
            Focus
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Where a leader line should touch its target: the border on the label's side, never the centre. */
function sidePointFor(target: VisualObject, label: VisualObject): Point {
  const side = label.labelOf?.side ?? "right";
  const y = clamp(label.y, target.y - target.height / 2 + 6, target.y + target.height / 2 - 6);
  const x = clamp(label.x, target.x - target.width / 2 + 6, target.x + target.width / 2 - 6);
  if (side === "left") return { x: target.x - target.width / 2 - 2, y };
  if (side === "above") return { x, y: target.y - target.height / 2 - 2 };
  if (side === "below") return { x, y: target.y + target.height / 2 + 2 };
  return { x: target.x + target.width / 2 + 2, y };
}

/**
 * Motion, applied declaratively.
 *
 * Every animation is a CSS keyframe on a group that is keyed by `motion.tick`, so it plays exactly once
 * and replays only when the same action is issued again. Nothing here schedules a timer, which is what
 * makes interruption safe: when a step replaces the scene, the old groups unmount and their animations
 * simply stop where they are.
 */
function MotionGroup({ motion, children, disabled }: { motion: NonNullable<VisualObject["motion"]>; children: ReactNode; disabled: boolean }): ReactElement {
  const dx = (motion.fromX ?? 0) - (motion.toX ?? 0);
  const dy = (motion.fromY ?? 0) - (motion.toY ?? 0);
  // A settle()ed motion has duration 1ms: it is already at its final state and must not animate.
  const instant = disabled || motion.durationMs <= 1;
  if (instant) return <g className="vfx-static">{children}</g>;
  const className = ["vfx-motion", `vfx-${motion.kind}`, motion.kind === "travel" ? "vfx-travel" : ""].filter(Boolean).join(" ");
  return (
    <g
      className={className}
      key={`${motion.kind}-${motion.tick}`}
      style={{
        ["--vfx-dx" as string]: `${dx}px`,
        ["--vfx-dy" as string]: `${dy}px`,
        animationDuration: `${motion.durationMs}ms`,
        animationDelay: `${motion.delayMs}ms`,
      }}
    >
      {children}
    </g>
  );
}

type ConnectionProps = {
  object: VisualObject;
  route: ConnectionRoute;
  subdued: boolean;
  animated: boolean;
};

/**
 * A connection.
 *
 * The router already decided the path, so this only draws it: correct start and end on the borders, an
 * arrowhead on the end (or both ends when the relationship is bidirectional), the right dash pattern,
 * and — when the step said so — the line EXTENDING itself from start to finish.
 */
function DiagramConnection({ object, route, subdued, animated }: ConnectionProps): ReactElement {
  const kind = object.connector ?? "straight";
  const bidirectional = kind === "bidirectional";
  const hasHead = object.kind === "arrow" && kind !== "pointer";
  const hasTail = bidirectional && object.kind === "arrow";
  // A connection is created by DRAWING itself: the stroke extends from the start to the end.
  const motion = object.motion;
  const drawn = animated && motion !== undefined && motion.kind !== "flow" && motion.durationMs > 1;
  const flowMotion = motion?.kind === "flow" ? motion : null;
  const packet = flowMotion ? pointAlongRoute(route, flowMotion.flowProgress ?? 0) : null;

  return (
    <g
      className={`diagram-edge${object.emphasis ? " is-emphasized" : ""}${subdued ? " is-dimmed" : ""}`}
      data-object-id={object.id}
      data-kind={object.kind}
      data-from={object.refs?.from}
      data-to={object.refs?.to}
      data-connector={kind}
    >
      <path
        d={route.d}
        className={`${connectorClass(object, drawn)} diagram-route`}
        pathLength={drawn ? 1 : undefined}
        style={drawn ? { animationDuration: `${motion!.durationMs}ms`, animationDelay: `${motion!.delayMs}ms` } : undefined}
        markerStart={hasTail ? "url(#diagram-arrowhead)" : undefined}
        markerEnd={hasHead ? "url(#diagram-arrowhead)" : undefined}
      />
      {/* A leader (a caption pointing at an object) is not a flow line: no head, no dash. */}
      {object.text ? (
        <text
          className="diagram-edge-label"
          x={route.label.x}
          y={route.label.y}
          fontSize={12}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {object.text}
        </text>
      ) : null}
      {flowMotion ? (
        // A travelling packet rides the ROUTED path, including any detour the router chose.
        // SMIL animateMotion is used rather than CSS `offset-path`: inside SVG, `offset-path` anchors
        // relative to the element and strands the packet away from the line it belongs to. The circle
        // itself sits at the ORIGIN so that the motion supplies the position — Chrome applies
        // animateMotion on top of cx/cy rather than replacing it, so a non-zero start would double it.
        <circle
          className="diagram-packet"
          key={`flow-${flowMotion.tick}`}
          r={6}
          cx={animated ? 0 : route.end.x}
          cy={animated ? 0 : route.end.y}
        >
          {animated ? (
            <animateMotion
              dur={`${flowMotion.durationMs}ms`}
              begin={`${flowMotion.delayMs}ms`}
              fill="freeze"
              path={route.d}
            />
          ) : null}
        </circle>
      ) : null}
    </g>
  );
}

export const DiagramRenderer = memo(DiagramRendererImpl);