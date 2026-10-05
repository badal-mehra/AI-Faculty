// VISUALIZATION ENGINE — deterministic reducer for the generalized visual action schema.
//
//   AI visual_actions -> applyVisualActions(scene, actions) -> VisualScene -> renderer
//
// It is UI-agnostic (no React, like lib/board/engine.ts) and TOPIC-AGNOSTIC: given the same ordered
// actions it always produces the same scene, and it never needs to know what the diagram depicts.
//
// The pipeline for one teaching step is always the same, and each stage feeds the next:
//
//   1. LOWER        semantic structures (array / linked list / stack / tree / sequence ...) become
//                   ordinary primitives with layout-computed coordinates          (lib/visual/layout.ts)
//   2. REDUCE       actions run in order through the step timeline                 (lib/visual/timeline.ts)
//   3. MEASURE      shapes grow to fit their own label; text is measured, not assumed
//   4. DETECT       connections re-derive their extent from live endpoints
//   5. ADJUST       objects that still overlap are separated along the axis of least penetration
//   6. PLACE        labels follow the object they name; free text takes a free spot
//   7. REROUTE      connection lanes are re-chosen so no label lands on a shape or another label
//
// Nothing here is random, and nothing is "nudged until it fits": every correction is a fixed rule,
// so the same lesson always produces the same board.
import {
  Anchor, AnimationKind, Point, ShapeKind, VisualAction, VisualActionDiagnostic, VisualAnimation,
  VisualMotion, VisualObject, VisualPlacement, VisualRole, VisualScene,
} from "./types";
import { MAX_OBJECTS, MIN_OBJECT_SIZE, DIAGRAM_WIDTH, VISUAL_MARGIN } from "./types";
import {
  boxOf, boxOfObject, boxesOverlap, clamp, clampOffset, clampSize, connectionEndpoints, connectionLabelPoint,
  connectionsBetween, fitLaneOffset, findFreeSpot, findObject, nextLaneOffset, overlapArea, parkingSpot,
  resolvePlacement, sidePoint, VIEWPORT,
} from "./geometry";
import type { Box } from "./geometry";
import { buildTimeline } from "./timeline";
import { measureText, shapeSizeForText } from "./measure";
import { normaliseFormula } from "./formula";
import { compileArray, compileCodeBlock, compileStructure } from "./layout";
import { applyAttention, applyLifecycle, Retirement, stampNewObjects, StepVisualContext } from "./lifecycle";
import { semanticKey } from "./semantics";
import { relationConnector } from "./semantics";

// Default size per shape kind. These are MINIMUMS, not answers: a shape with a label grows until the
// measured label fits (see shapeSizeForText), so nothing ever prints outside its own box.
const DEFAULT_SIZE: Record<ShapeKind, { width: number; height: number }> = {
  rectangle: { width: 160, height: 72 },
  rounded_rectangle: { width: 160, height: 72 },
  square: { width: 92, height: 92 },
  circle: { width: 96, height: 96 },
  ellipse: { width: 170, height: 92 },
  capsule: { width: 168, height: 64 },
  diamond: { width: 152, height: 112 },
  triangle: { width: 150, height: 118 },
  hexagon: { width: 176, height: 92 },
  pentagon: { width: 158, height: 104 },
  cylinder: { width: 132, height: 122 },
  arrow: { width: 170, height: 10 },
  line: { width: 170, height: 8 },
  container: { width: 224, height: 152 },
  polygon: { width: 168, height: 108 },
  point: { width: 16, height: 16 },
  marker: { width: 18, height: 18 },
};

const DEFAULT_ANIMATION_MS = 600;

export function getVisualScene(scene: VisualScene): VisualScene {
  return {
    tick: scene.tick,
    ...(scene.theme ? { theme: scene.theme } : {}),
    ...(scene.focusIds ? { focusIds: [...scene.focusIds] } : {}),
    objects: scene.objects.map((object) => ({
      ...object,
      refs: object.refs ? { ...object.refs } : undefined,
      motion: object.motion ? { ...object.motion } : undefined,
      ...(object.textLines ? { textLines: [...object.textLines] } : {}),
    })),
  };
}

export const sceneHasObjects = (scene: VisualScene): boolean => scene.objects.length > 0;
export const sceneIsEmpty = (scene: VisualScene): boolean => scene.objects.length === 0;

function motionOf(animate: VisualAnimation | undefined, startAtMs: number, tick: number, override?: { kind?: AnimationKind; fromX?: number; fromY?: number; toX?: number; toY?: number }): VisualMotion | undefined {
  if (!animate && !override) return undefined;
  return {
    kind: override?.kind ?? animate?.kind ?? "appear",
    durationMs: animate?.durationMs ?? DEFAULT_ANIMATION_MS,
    delayMs: startAtMs,
    tick,
    ...(override?.fromX !== undefined ? { fromX: override.fromX } : {}),
    ...(override?.fromY !== undefined ? { fromY: override.fromY } : {}),
    ...(override?.toX !== undefined ? { toX: override.toX } : {}),
    ...(override?.toY !== undefined ? { toY: override.toY } : {}),
  };
}

function withObject(scene: VisualScene, object: VisualObject, tick: number): VisualScene {
  return { ...scene, objects: [...scene.objects, object], tick };
}

/**
 * The object this one would repeat.
 *
 * A restatement is something said AGAIN, not something drawn twice. Two rules make that concrete:
 *
 *   * only meaningful objects can restate each other — a shape or a piece of text that says something.
 *     An unlabelled arrow has no meaning to repeat, and treating every bare primitive as a candidate
 *     would collapse a whole diagram into its first box.
 *   * only ACROSS steps. Two identically-labelled boxes in one step are a deliberate pair — the two
 *     columns of a comparison, the two halves of a before-and-after — and merging them would delete half
 *     the diagram. The same label arriving in a later step is the teacher saying it again.
 */
function findRestatement(
  objects: readonly VisualObject[],
  candidate: { kind: VisualObject["kind"]; text?: string },
  context: StepVisualContext,
): VisualObject | undefined {
  if (!candidate.text || !candidate.text.trim()) return undefined;
  if (context.step === undefined) return undefined;
  const key = semanticKey(candidate as { kind: VisualObject["kind"]; text?: string });
  if (!key) return undefined;
  return objects.find((object) =>
    object.kind === candidate.kind
    && semanticKey(object) === key
    && object.bornStep !== undefined
    && object.bornStep < context.step!);
}

/**
 * Refreshes an object that already exists rather than adding a second one.
 *
 * Only the content changes. Position, size, lifecycle and every id pointing at it are left alone, because
 * a restatement of something already on the board is not a new thing — it is the same thing said again,
 * and moving it would break the layout for no reason.
 */
function refreshInPlace(
  scene: VisualScene,
  target: VisualObject,
  patch: { text?: string; role?: VisualRole },
  tick: number,
): VisualScene {
  return patchObject(scene, target.id, tick, (object) => ({
    ...object,
    ...(patch.text !== undefined ? { text: patch.text, textLines: undefined } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    // Re-stating something means it is being talked about again, so it earns current attention.
    lifecycle: "current",
    opacity: 1,
  }));
}
function patchObject(scene: VisualScene, id: string, tick: number, patch: (object: VisualObject) => VisualObject | null): VisualScene {
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (object.id !== id) return object;
    const next = patch(object);
    if (!next) return object;
    changed = true;
    return next;
  });
  return changed ? { ...scene, objects, tick } : scene;
}

// ---------------------------------------------------------------------------------------------
// Stage 3 — MEASURE
// ---------------------------------------------------------------------------------------------

/** Font size a shape asks for, derived from its own box when the model did not choose one. */
function shapeFontSize(object: { width: number; height: number; fontSize?: number }): number {
  if (object.fontSize !== undefined) return object.fontSize;
  return Math.max(11, Math.min(23, Math.min(object.width, object.height) * 0.36));
}

/** Estimated box of a free-standing text, measured from the font. Capped by the BOARD, not by the
 *  object limit: clamping to the object limit would make the engine believe a long caption is
 *  narrower than it paints, which is how text ends up drawn over a shape. */
const MAX_TEXT_BOX_WIDTH = DIAGRAM_WIDTH - 2 * VISUAL_MARGIN;

function textBox(text: string, fontSize: number, maxWidth = MAX_TEXT_BOX_WIDTH): { width: number; height: number; lines: string[] } {
  const measured = measureText(text, fontSize, maxWidth, { maxLines: 4 });
  const lines = measured.lines.length > 0 ? measured.lines : [text.trim()];
  return {
    width: Math.min(MAX_TEXT_BOX_WIDTH, Math.max(24, measured.width + fontSize * 0.3)),
    height: Math.max(MIN_OBJECT_SIZE, measured.height),
    lines,
  };
}

// Pick the clearest side for a label attached to `target`: the first side with room, so labels do
// not automatically pile up on the right of every object.
const LABEL_SIDE_ORDER: Array<"right" | "left" | "above" | "below"> = ["right", "left", "above", "below"];

function bestLabelSide(target: VisualObject, size: { width: number; height: number }, objects: VisualObject[], preferred?: "left" | "right" | "above" | "below"): "left" | "right" | "above" | "below" {
  const order = preferred ? [preferred, ...LABEL_SIDE_ORDER.filter((side) => side !== preferred)] : LABEL_SIDE_ORDER;
  let fallback: { side: "left" | "right" | "above" | "below"; collisions: number } | null = null;
  for (const side of order) {
    const wanted = sidePoint(target, side, 8, size.width / 2, size.height / 2);
    const placed = findFreeSpot(objects, size, wanted, { gap: 8 });
    const moved = Math.hypot(placed.x - wanted.x, placed.y - wanted.y);
    if (moved < 0.5) return side;
    if (!fallback || moved < fallback.collisions) fallback = { side, collisions: moved };
  }
  return fallback?.side ?? "right";
}

/** A connection stores the bounding box of the geometry it currently spans, so the scene the model
 * receives back describes exactly what is on screen. */
function connectionBounds(start: Point, end: Point, pad = 14): { x: number; y: number; width: number; height: number } {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
    width: clampSize(Math.max(Math.abs(end.x - start.x) + pad, MIN_OBJECT_SIZE)),
    height: clampSize(Math.max(Math.abs(end.y - start.y) + pad, MIN_OBJECT_SIZE)),
  };
}

type Placement = { x: number; y: number; anchor?: Anchor };

function placeNew(placement: VisualPlacement | undefined, size: { width: number; height: number }, objects: VisualObject[]): Placement {
  const point = resolvePlacement(placement, size, objects);
  const anchor = placement?.kind === "anchor" ? placement.anchor : undefined;
  return anchor ? { ...point, anchor } : point;
}

const isTextLike = (object: VisualObject): boolean =>
  object.kind === "text" || object.kind === "label" || object.kind === "formula" || object.kind === "icon";

// ---------------------------------------------------------------------------------------------
// Applies ONE action at a step-relative start time. `tick` uniquely stamps animations so the
// renderer replays them exactly once (and re-runs when the same action is issued again).
// ---------------------------------------------------------------------------------------------
export function applyVisualAction(scene: VisualScene, action: VisualAction, startAtMs = 0, tick = scene.tick + 1, context: StepVisualContext = {}): VisualScene {
  if (scene.objects.length >= MAX_OBJECTS && action.action.startsWith("create_")) return scene;
  switch (action.action) {
    case "clear":
      return { objects: [], tick };

    case "remove": {
      const target = findObject(scene.objects, action.id);
      if (!target) return scene;
      // Removing an object removes the connections that only existed to reach it: an arrow left
      // pointing at nothing is exactly the orphan the board must never show.
      const orphans = new Set(
        scene.objects
          .filter((object) => object.refs && (object.refs.from === action.id || object.refs.to === action.id))
          .map((object) => object.id),
      );
      return {
        ...scene,
        objects: scene.objects.filter((object) => object.id !== action.id && !orphans.has(object.id) && object.labelOf?.id !== action.id),
        tick,
      };
    }

    case "create_shape": {
      if (findObject(scene.objects, action.id)) return scene;
      // The same restatement rule as text: a shape that says what an existing shape says is that shape.
      // A comparison panel with two identical cells is one cell shown twice, not two cells.
      if (action.text) {
        const restates = findRestatement(scene.objects, { kind: "shape", text: action.text }, context);
        if (restates) return refreshInPlace(scene, restates, { text: action.text, role: action.role }, tick);
      }
      const base = DEFAULT_SIZE[action.shape];
      const requested = { width: clampSize(action.width ?? base.width), height: clampSize(action.height ?? base.height) };
      // A layout module states the type size it measured for, so a row of uniform stages does not have
      // each box re-derive a slightly different font from its own dimensions.
      const fontSize = clamp(action.fontSize ?? shapeFontSize(requested), 10, 60);
      // MEASURE: the box grows until the label genuinely fits, instead of the label shrinking to 9px.
      const measured = shapeSizeForText(action.text, requested, fontSize);
      const width = clampSize(measured.width);
      const height = clampSize(measured.height);
      const placement = placeNew(action.placement, { width, height }, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "shape", order: scene.objects.length, x: placement.x, y: placement.y,
        width, height, rotation: clamp(action.rotation ?? 0, -360, 360), opacity: 1, shape: action.shape, fontSize,
        ...(action.semantic ? { semantic: action.semantic } : {}),
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.text ? { text: action.text } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_container": {
      if (findObject(scene.objects, action.id)) return scene;
      const width = clampSize(action.width ?? DEFAULT_SIZE.container.width);
      const height = clampSize(action.height ?? DEFAULT_SIZE.container.height);
      const placement = placeNew(action.placement, { width, height }, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "container", order: scene.objects.length, x: placement.x, y: placement.y,
        width, height, rotation: 0, opacity: 1, shape: "container",
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.text ? { text: action.text } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_text": {
      if (findObject(scene.objects, action.id)) return scene;
      // RESTATEMENT, NOT A SECOND OBJECT.
      //
      // A teacher who says "force" four times is describing one force. Without this the board grows a
      // fourth "Force" every time the word comes round, and the screenshots show it: five copies of
      // "Force", four of "Mass", each slightly offset from the last. The existing object is refreshed in
      // place instead, so its position, its label and anything pointing at it all survive.
      const restates = findRestatement(scene.objects, { kind: "text", text: action.text }, context);
      if (restates) return refreshInPlace(scene, restates, { text: action.text, role: action.role }, tick);
      const fontSize = clamp(action.size ?? 17, 10, 60);
      const size = textBox(action.text, fontSize);
      const placement = placeNew(action.placement, size, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "text", order: scene.objects.length, x: placement.x, y: placement.y,
        width: size.width, height: size.height, rotation: 0, opacity: 1, text: action.text, fontSize,
        textLines: size.lines,
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_code_block": {
      if (findObject(scene.objects, action.id)) return scene;
      const block = compileCodeBlock(action.code, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.highlightLines ? { highlightLines: action.highlightLines } : {}),
        ...(action.size ? { fontSize: action.size } : {}),
      });
      const placement = placeNew(action.placement ?? { kind: "anchor", anchor: "center" }, { width: block.width, height: block.height }, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "code_block", order: scene.objects.length, x: placement.x, y: placement.y,
        width: block.width, height: block.height, rotation: 0, opacity: 1,
        code: action.code, codeLines: block.lines, language: action.language, highlightLines: block.highlightLines,
        ...(action.title ? { title: action.title } : {}),
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "set_code_pointer": {
      // Only a code block has a line to point at. Anything else is a silent no-op, consistent with
      // every other action that names an object which does not exist.
      const target = findObject(scene.objects, action.id);
      if (!target || target.kind !== "code_block") return scene;
      const highlightLines = action.lines.filter((line) => line >= 1 && line <= (target.codeLines?.length ?? 0));
      // patchObject REPLACES the listing. withObject would append, leaving two blocks with the same id —
      // the pointer would appear to move while the old one stayed on the board.
      return patchObject(scene, action.id, tick, (object) => ({ ...object, highlightLines }));
    }

    case "write_formula": {
      if (findObject(scene.objects, action.id)) return scene;
      // Set the formula the way a board sets it, for the same reason the equation block does: a real
      // continuity lesson rendered `\lim_{x \to a} f(x) = f(a)` verbatim, which is correct mathematics and
      // unreadable to the student it is meant to teach.
      const display = normaliseFormula(action.formula);
      const fontSize = clamp(action.size ?? 21, 10, 60);
      const size = textBox(display, fontSize);
      const placement = placeNew(action.placement, size, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "formula", order: scene.objects.length, x: placement.x, y: placement.y,
        width: size.width, height: size.height, rotation: 0, opacity: 1, text: display, fontSize,
        textLines: size.lines,
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_icon": {
      if (findObject(scene.objects, action.id)) return scene;
      const size = clampSize(action.size ?? 52);
      const placement = placeNew(action.placement, { width: size, height: size }, scene.objects);
      return withObject(scene, {
        id: action.id, kind: "icon", order: scene.objects.length, x: placement.x, y: placement.y,
        width: size, height: size, rotation: 0, opacity: 1, glyph: action.glyph, fontSize: size * 0.7,
        ...(action.role ? { role: action.role } : {}),
        ...(placement.anchor ? { anchor: placement.anchor } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_label": {
      const target = findObject(scene.objects, action.target);
      if (!target || findObject(scene.objects, action.id)) return scene;
      const fontSize = clamp(14, 10, 60);
      const size = textBox(action.text, fontSize);
      const side = action.side ?? bestLabelSide(target, size, scene.objects);
      const point = resolvePlacement({ kind: "relative", relativeTo: action.target, side, gap: 8 }, size, scene.objects, { gap: 6 });
      return withObject(scene, {
        id: action.id, kind: "label", order: scene.objects.length, x: point.x, y: point.y,
        width: size.width, height: size.height, rotation: 0, opacity: 1, text: action.text, fontSize,
        textLines: size.lines,
        ...(action.role ? { role: action.role } : {}),
        // Remember what this label names, so it can be re-resolved whenever that object moves.
        labelOf: { id: action.target, side },
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
      }, tick);
    }

    case "create_arrow":
    case "create_connector": {
      const from = findObject(scene.objects, action.from);
      const to = findObject(scene.objects, action.to);
      if (!from || !to || findObject(scene.objects, action.id)) return scene;
      // Automatic lanes: every connection that shares this pair of endpoints gets its own parallel
      // lane, so the model never has to hand-tune offsets for arrows and their labels to separate.
      // The lane is defined on the CANONICAL endpoint order, so a message travelling one way and a
      // message travelling the other way can never claim the same physical lane.
      const authored = action.offset !== undefined;
      const lane = authored ? clampOffset(action.offset as number) : nextLaneOffset(connectionsBetween(scene.objects, action.from, action.to).length);
      // An AUTO lane index is signed by the canonical endpoint order, so the same physical lane is used
      // whichever way the message travels. An AUTHORED offset is already expressed in world terms (a
      // sequence diagram's row N), so it must be applied verbatim — re-signing it would mirror every
      // right-to-left message onto the wrong row.
      const signed = authored ? lane : lane * (action.from <= action.to ? 1 : -1);
      const offset = fitLaneOffset(from, to, signed);
      const { start, end } = connectionEndpoints(from, to, 6, offset);
      const bounds = connectionBounds(start, end);
      // THE RELATION DECIDES HOW THE LINE LOOKS, not the other way round. A model that says
      // `relation: "derives_from"` gets a dashed dependency line and `relation: "part_of"` gets a
      // parent-child link, without naming a drawing style — and when it names no relation at all the
      // styles fall back exactly as they did before.
      const relation = action.relation;
      const relationLook = relationConnector(relation);
      const connector = action.kind ?? (action.action === "create_arrow" && !relation ? undefined : relationLook.kind);
      return withObject(scene, {
        id: action.id, kind: action.action === "create_arrow" ? "arrow" : "connector", order: scene.objects.length,
        x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, rotation: 0, opacity: 1,
        refs: { from: action.from, to: action.to },
        ...(offset ? { offset } : {}),
        ...(authored ? { explicitLane: true } : {}),
        ...(connector ? { connector } : {}),
        // The relation travels with the connection so later passes — labelling, focus, assessment — can
        // reason about what the link MEANS rather than guessing from its geometry.
        ...(relation ? { relation } : {}),
        ...(action.label ? { text: action.label } : {}),
        ...(action.action === "create_arrow" ? { arrowStyle: action.style ?? (relation ? relationLook.style : "solid") } : {}),
        ...(action.role ? { role: action.role } : {}),
        // A connection is "created" by DRAWING itself, which is how a step that says "now connect
        // them" looks like the line being drawn.
        motion: motionOf(action.animate ?? { kind: "draw", durationMs: DEFAULT_ANIMATION_MS, delayMs: 0 }, startAtMs, tick, { kind: "draw" }),
      }, tick);
    }

    case "move": {
      return patchObject(scene, action.id, tick, (object) => {
        const position = resolvePlacement(action.placement, { width: object.width, height: object.height }, scene.objects, { ignore: [object.id] });
        const anchor = action.placement?.kind === "anchor" ? action.placement.anchor : object.anchor;
        const changed = Math.abs(position.x - object.x) > 0.5 || Math.abs(position.y - object.y) > 0.5;
        return {
          ...object, x: position.x, y: position.y,
          ...(anchor ? { anchor } : {}),
          motion: motionOf(action.animate, startAtMs, tick, { kind: action.animate?.kind ?? "move", fromX: object.x, fromY: object.y, toX: position.x, toY: position.y }),
          // A move that goes nowhere is not an animation; keep the object still.
          ...(changed ? {} : { motion: undefined }),
        };
      });
    }

    case "resize": {
      return patchObject(scene, action.id, tick, (object) => {
        const width = clampSize(action.width);
        const height = clampSize(action.height);
        const position = resolvePlacement({ kind: "point", x: object.x, y: object.y }, { width, height }, scene.objects, { ignore: [object.id], gap: 2 });
        return {
          ...object, width, height, x: position.x, y: position.y,
          ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick) } : {}),
        };
      });
    }

    case "rotate":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        rotation: clamp(action.degrees, -360, 360),
        motion: motionOf(action.animate, startAtMs, tick, { kind: "rotate" }),
      }));

    case "highlight":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object, emphasis: true, dimmed: false,
        motion: motionOf(action.animate ?? { kind: "highlight", durationMs: DEFAULT_ANIMATION_MS, delayMs: 0 }, startAtMs, tick, { kind: "highlight" }),
      }));

    case "highlight_many":
      return action.ids.reduce((current, id) => applyVisualAction(current, { action: "highlight", id, ...(action.animate ? { animate: action.animate } : {}) }, startAtMs, tick), scene);

    // FOCUS: the teacher's attention moves to these objects and everything else is visibly subdued.
    case "focus":
      return { ...scene, focusIds: [...action.ids] };

    // DIM: an explicit "this half was eliminated" / "this node was already visited".
    case "dim":
      return action.ids.reduce((current, id) => patchObject(current, id, tick, (object) => ({ ...object, dimmed: true })), scene);

    case "restore": {
      const ids = action.ids;
      return { ...scene, objects: scene.objects.map((object) => (ids && !ids.includes(object.id) ? object : { ...object, dimmed: false })), tick };
    }

    case "pulse":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        motion: motionOf(action.animate ?? { kind: "pulse", durationMs: 900, delayMs: 0 }, startAtMs, tick, { kind: "pulse" }),
      }));

    case "fade_in":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object, opacity: 1,
        motion: motionOf(action.animate ?? { kind: "fade", durationMs: DEFAULT_ANIMATION_MS, delayMs: 0 }, startAtMs, tick, { kind: "appear" }),
      }));

    case "fade_out":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object, opacity: 0,
        motion: motionOf(action.animate ?? { kind: "fade", durationMs: DEFAULT_ANIMATION_MS, delayMs: 0 }, startAtMs, tick, { kind: "disappear" }),
      }));

    // FLOW: a packet runs along the connection. The renderer draws it; the scene only records it.
    case "flow": {
      const durationMs = clamp(action.durationMs ?? 1100, 100, 8000);
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        motion: { kind: "flow", durationMs, delayMs: startAtMs, tick, flowProgress: 0 },
      }));
    }

    case "animate_path": {
      const mover = findObject(scene.objects, action.id);
      const target = findObject(scene.objects, action.to);
      if (!mover || !target) return scene;
      const park = parkingSpot(mover, target, scene.objects);
      const durationMs = clamp(action.durationMs ?? 1200, 100, 8000);
      return patchObject(scene, action.id, tick, (object) => ({
        ...object, x: park.x, y: park.y,
        motion: { kind: "travel", durationMs, delayMs: startAtMs, tick, fromX: object.x, fromY: object.y, toX: park.x, toY: park.y },
      }));
    }

    // `wait` only advances the timeline cursor; `camera_focus` is handled by the 2D viewport.
    case "wait":
      return scene;

    case "set_theme":
      return { ...scene, theme: action.theme, tick };

    case "camera_focus":
      return { ...scene, focusIds: [action.id] };

    case "update_array":
      return updateArrayInScene(scene, action, startAtMs, tick);

    // Semantic structures are lowered before they reach the reducer.
    default:
      return scene;
  }
}

// ---------------------------------------------------------------------------------------------
// Stage 5 — DETECT + ADJUST (collision is a first-class stage, not a side effect of placement)
// ---------------------------------------------------------------------------------------------

const OVERLAP_TOLERANCE = 3;

/** Objects that occupy the board for the purposes of separating two things that must not touch. */
function isSeparable(object: VisualObject): boolean {
  // Connections are derived geometry, text follows whatever it names, and a container's contents
  // belong inside it: none of these may be shoved aside by the separation pass.
  return object.kind !== "arrow" && object.kind !== "connector" && object.kind !== "container" && !isTextLike(object);
}

function containedIn(candidate: Box, frame: Box): boolean {
  return candidate.left >= frame.left - 1 && candidate.right <= frame.right + 1 && candidate.top >= frame.top - 1 && candidate.bottom <= frame.bottom + 1;
}

/**
 * Separates objects that still overlap.
 *
 * The mover is always the later object in scene order, it moves along the axis of least penetration,
 * and by exactly the penetration plus a gap — so the result is the smallest change that fixes the
 * collision, and the same actions always produce the same separation. This replaces "push it
 * somewhere random until it fits" with a rule a reader can predict.
 */
export function resolveSceneOverlaps(scene: VisualScene): VisualScene {
  const frames = scene.objects.filter((object) => object.kind === "container").map((object) => boxOfObject(object));
  const movable = scene.objects.filter((object) => isSeparable(object));
  if (movable.length < 2) return scene;

  const positions = new Map<string, Point>();
  for (const object of movable) positions.set(object.id, { x: object.x, y: object.y });

  for (let pass = 0; pass < 5; pass += 1) {
    let changed = false;
    for (let i = 0; i < movable.length; i += 1) {
      for (let j = i + 1; j < movable.length; j += 1) {
        const a = movable[i];
        const b = movable[j];
        const pa = positions.get(a.id)!;
        const pb = positions.get(b.id)!;
        const boxA = boxOf(pa, a);
        const boxB = boxOf(pb, b);
        if (!boxesOverlap(boxA, boxB, -OVERLAP_TOLERANCE)) continue;
        // A container frames its contents; those two boxes are not a collision.
        if (frames.some((frame) => containedIn(boxB, frame) || containedIn(boxA, frame))) continue;
        const overlapX = (a.width + b.width) / 2 + OVERLAP_TOLERANCE - Math.abs(pa.x - pb.x);
        const overlapY = (a.height + b.height) / 2 + OVERLAP_TOLERANCE - Math.abs(pa.y - pb.y);
        const direction = pa.x <= pb.x ? 1 : -1;
        positions.set(b.id, overlapX <= overlapY
          ? { x: pb.x + direction * overlapX, y: pb.y }
          : { x: pb.x, y: pb.y + (pa.y <= pb.y ? 1 : -1) * overlapY });
        const clamped = positions.get(b.id)!;
        const hw = Math.min(b.width / 2, VIEWPORT.width / 2 - VISUAL_MARGIN);
        const hh = Math.min(b.height / 2, VIEWPORT.height / 2 - VISUAL_MARGIN);
        positions.set(b.id, {
          x: clamp(clamped.x, VIEWPORT.margin + hw, VIEWPORT.width - VIEWPORT.margin - hw),
          y: clamp(clamped.y, VIEWPORT.margin + hh, VIEWPORT.height - VIEWPORT.margin - hh),
        });
        changed = true;
      }
    }
    if (!changed) break;
  }

  let dirty = false;
  const objects = scene.objects.map((object) => {
    const point = positions.get(object.id);
    if (!point) return object;
    if (Math.abs(point.x - object.x) < 0.5 && Math.abs(point.y - object.y) < 0.5) return object;
    dirty = true;
    // A separation is not a teaching animation, so it must not replay on the next render.
    return { ...object, x: point.x, y: point.y };
  });
  return dirty ? { ...scene, objects } : scene;
}

// ---------------------------------------------------------------------------------------------
// Stage 4 — connections keep their stored extent in step with their live endpoints
// ---------------------------------------------------------------------------------------------
function refreshConnections(scene: VisualScene): VisualScene {
  let changed = false;
  const objects = scene.objects.map((object) => {
    if ((object.kind !== "arrow" && object.kind !== "connector") || !object.refs) return object;
    const from = findObject(scene.objects, object.refs.from);
    const to = findObject(scene.objects, object.refs.to);
    if (!from || !to) return object;
    const { start, end } = connectionEndpoints(from, to, 6, object.offset ?? 0);
    const bounds = connectionBounds(start, end);
    if (Math.abs(bounds.x - object.x) < 0.5 && Math.abs(bounds.y - object.y) < 0.5 && Math.abs(bounds.width - object.width) < 0.5 && Math.abs(bounds.height - object.height) < 0.5) return object;
    changed = true;
    return { ...object, x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  return changed ? { ...scene, objects } : scene;
}

// Stage 6 — labels follow the object they name; free text takes a free spot.
//
// The blockers are EVERY filled object, not only the ones walked so far: a caption created before the
// objects it must clear is still above them on screen, so resolving it against a partial list is how a
// label ends up printed across a shape.
function refreshTextPlacement(scene: VisualScene): VisualScene {
  const blockers = scene.objects.filter((object) => !isTextLike(object));
  const floating = scene.objects.filter((object) => isTextLike(object));
  const resolved = new Map<string, VisualObject>();
  for (const object of floating) {
    const target = object.labelOf ? findObject(blockers, object.labelOf.id) : undefined;
    const placement: VisualPlacement = target && object.labelOf
      ? { kind: "relative", relativeTo: target.id, side: object.labelOf.side, gap: 8 }
      : { kind: "point", x: object.x, y: object.y };
    const ignore = [object.id, ...(target ? [target.id] : [])];
    const against = [...blockers, ...[...resolved.values()]];
    const point = resolvePlacement(placement, { width: object.width, height: object.height }, against, { ignore, gap: 6 });
    resolved.set(object.id, Math.abs(point.x - object.x) < 0.5 && Math.abs(point.y - object.y) < 0.5 ? object : { ...object, x: point.x, y: point.y });
  }
  if ([...resolved.values()].every((object, index) => object === floating[index])) return scene;
  return { ...scene, objects: [...blockers, ...resolved.values()] };
}

// Stage 7 — a connection's label rides its own lane; colliding lanes are re-chosen deterministically
function refreshConnectionLabels(scene: VisualScene): VisualScene {
  const isConnection = (object: VisualObject): boolean => object.kind === "arrow" || object.kind === "connector";
  const labelled = scene.objects.filter((object) => isConnection(object) && object.text && object.refs);
  if (labelled.length === 0) return scene;
  const obstacles = scene.objects.filter((object) => !isConnection(object)).map((object) => boxOfObject(object));
  const laneLabel = (object: VisualObject, offset: number): { box: Box; point: Point; mid: Point; pair: string } | null => {
    const refs = object.refs;
    if (!refs) return null;
    const from = findObject(scene.objects, refs.from);
    const to = findObject(scene.objects, refs.to);
    if (!from || !to || !object.text) return null;
    const fitted = fitLaneOffset(from, to, offset);
    const point = connectionLabelPoint(from, to, fitted);
    const { start, end } = connectionEndpoints(from, to, 6, fitted);
    const fontSize = 12;
    const width = object.text.length * fontSize * 0.58;
    const pair = refs.from < refs.to ? `${refs.from}|${refs.to}` : `${refs.to}|${refs.from}`;
    return { box: boxOf(point, { width, height: fontSize * 1.3 }), point, mid: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }, pair };
  };
  const LADDER = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5].map(nextLaneOffset);
  const placed: Array<{ box: Box; point: Point; mid: Point; pair: string }> = [];
  const offsets = new Map<string, number>();
  const cost = (box: Box) => [...obstacles, ...placed.map((entry) => entry.box)].reduce((total, other) => total + overlapArea(box, other), 0);
  const far = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y) > 10;
  const usable = (label: { box: Box; point: Point; mid: Point; pair: string }) =>
    cost(label.box) === 0
    && placed.every((entry) => far(entry.point, label.point) && (entry.pair !== label.pair || far(entry.mid, label.mid)));
  for (const object of labelled) {
    const start = object.offset ?? 0;
    // A CHOSEN lane is honoured unless its label would land on an object: a sequence diagram's rows are
    // chosen deliberately, and re-shuffling them because another label preferred a lane would destroy
    // the order the teacher is explaining. An AUTO lane still gets the full avoidance ladder.
    const candidates = object.explicitLane
      ? [start]
      : [start, ...LADDER.filter((offset) => offset !== start)];
    let chosen = start;
    let chosenLabel = laneLabel(object, start);
    for (const candidate of candidates) {
      const label = laneLabel(object, candidate);
      if (!label) break;
      if (usable(label)) {
        chosen = candidate;
        chosenLabel = label;
        break;
      }
      if (chosenLabel === null || cost(label.box) < cost(chosenLabel.box)) {
        chosen = candidate;
        chosenLabel = label;
      }
    }
    if (chosenLabel) placed.push(chosenLabel);
    if (chosen !== start) offsets.set(object.id, chosen);
  }
  if (offsets.size === 0) return scene;
  return {
    ...scene,
    objects: scene.objects.map((object) => (offsets.has(object.id) ? { ...object, offset: offsets.get(object.id)! } : object)),
  };
}

// ---------------------------------------------------------------------------------------------
// update_array — insertion, deletion and swapping as ANIMATED change
// ---------------------------------------------------------------------------------------------

/**
 * Re-lays an array out and turns the difference into moves, one appear and one removal.
 *
 * Cells are matched BY VALUE, so a swap moves two cells towards each other at the same time, and an
 * insertion slides the tail along by one cell instead of redrawing the whole array. That is the
 * difference between "the picture changed" and "the teacher showed you the insert".
 */
function updateArrayInScene(
  scene: VisualScene,
  action: Extract<VisualAction, { action: "update_array" }>,
  startAtMs: number,
  tick: number,
): VisualScene {
  const prefix = `${action.id}-`;
  const cells = scene.objects.filter((object) => object.kind === "shape" && object.id.startsWith(`${prefix}c`) && object.text !== undefined);
  const compiled = compileArray(action.id, action.values, {
    indices: true,
    ...(action.vertical !== undefined ? { vertical: action.vertical } : {}),
  });
  const cellTargets = new Map<string, { x: number; y: number; width: number; height: number }>();
  const labelTargets = new Map<string, { x: number; y: number }>();
  for (const primitive of compiled) {
    if (primitive.action === "create_shape" && primitive.placement?.kind === "point") {
      cellTargets.set(primitive.id, { x: primitive.placement.x, y: primitive.placement.y, width: primitive.width ?? 0, height: primitive.height ?? 0 });
    }
    if (primitive.action === "create_text" && primitive.placement?.kind === "point") {
      labelTargets.set(primitive.id, { x: primitive.placement.x, y: primitive.placement.y });
    }
  }

  const byValue = new Map<string, VisualObject[]>();
  for (const cell of cells) byValue.set(cell.text ?? "", [...(byValue.get(cell.text ?? "") ?? []), cell]);
  const used = new Set<string>();
  const kept: VisualObject[] = [];
  const durationMs = action.animate?.durationMs ?? 480;

  action.values.forEach((value, index) => {
    const cellId = `${prefix}c${index}`;
    const target = cellTargets.get(cellId);
    if (!target) return;
    const candidates = byValue.get(value) ?? [];
    const existing = candidates.find((candidate) => !used.has(candidate.id));
    if (!existing) {
      // A genuinely new cell appears in place.
      kept.push({
        id: cellId, kind: "shape", order: scene.objects.length + index, x: target.x, y: target.y,
        width: target.width, height: target.height, rotation: 0, opacity: 1, shape: "rectangle",
        semantic: "data", role: "primary", text: value, fontSize: 20,
        motion: motionOf(action.animate ?? { kind: "appear", durationMs: 420, delayMs: 0 }, startAtMs, tick),
      });
      return;
    }
    used.add(existing.id);
    const moved = Math.abs(existing.x - target.x) > 0.5 || Math.abs(existing.y - target.y) > 0.5;
    kept.push({
      ...existing,
      id: cellId,
      x: target.x,
      y: target.y,
      width: target.width,
      height: target.height,
      order: scene.objects.length + index,
      ...(moved ? { motion: { kind: "move" as const, durationMs, delayMs: startAtMs, tick, fromX: existing.x, fromY: existing.y, toX: target.x, toY: target.y } } : { motion: undefined }),
    });
  });

  // Index captions follow their own index: existing ones move, new ones are created, and the ones the
  // shorter array no longer has are dropped with the cells.
  const existingLabels = new Map(scene.objects
    .filter((object) => object.kind === "text" && object.id.startsWith(`${prefix}i`))
    .map((object) => [object.id, object] as const));
  const indexLabels: VisualObject[] = [];
  for (const [labelId, target] of labelTargets) {
    const existing = existingLabels.get(labelId);
    if (!existing) {
      const index = Number(labelId.slice(`${prefix}i`.length));
      indexLabels.push({
        id: labelId, kind: "text", order: scene.objects.length + 100 + index, x: target.x, y: target.y,
        width: measureText(String(index), 13, 200, { mono: true, maxLines: 1 }).width + 4, height: 18,
        rotation: 0, opacity: 1, text: String(index), fontSize: 13, textLines: [String(index)],
        role: "caption", motion: motionOf(action.animate ?? { kind: "appear", durationMs: 320, delayMs: 0 }, startAtMs, tick),
      });
      continue;
    }
    indexLabels.push(Math.abs(existing.x - target.x) < 0.5 && Math.abs(existing.y - target.y) < 0.5
      ? existing
      : { ...existing, x: target.x, y: target.y, motion: undefined });
  }

  // Everything that is NOT part of this array is carried through untouched; the cells and index
  // captions of this array are entirely rebuilt from the new contents.
  const managed = new Set(scene.objects.filter((object) => object.id.startsWith(`${prefix}c`) || object.id.startsWith(`${prefix}i`)).map((object) => object.id));
  const others = scene.objects.filter((object) => !managed.has(object.id));

  // The array must re-flow AROUND what is already on the board — a heading above it, a caption beside it
  // — rather than through it. Compiled coordinates are only a starting point, so anything the array
  // would land on is cleared. The heading is NOT moved (it is the anchor of the whole board); the row
  // slides past it, which is what stops an updated array printing over the lesson's own title.
  const foreign = others.filter((object) => object.id !== `${action.id}-title`);
  const boxes = kept.map((cell) => boxOfObject(cell));
  let shiftY = 0;
  if (boxes.length > 0) {
    const topOfBlock = Math.min(...boxes.map((box) => box.top));
    const bottomOfBlock = Math.max(...boxes.map((box) => box.bottom));
    for (const obstacle of foreign) {
      const box = boxOfObject(obstacle);
      if (!boxes.some((cellBox) => boxesOverlap(cellBox, box, -2))) continue;
      // Prefer sliding DOWN past the obstacle; slide up only when there is no room below.
      const down = box.bottom - topOfBlock + 10;
      const up = topOfBlock - box.top + 10;
      shiftY = down + bottomOfBlock <= VIEWPORT.height - VIEWPORT.margin ? Math.max(shiftY, down) : Math.min(shiftY, -up);
    }
  }
  if (Math.abs(shiftY) > 0.5) {
    for (const cell of kept) cell.y = clamp(cell.y + shiftY, VIEWPORT.margin + cell.height / 2, VIEWPORT.height - VIEWPORT.margin - cell.height / 2);
    for (const label of indexLabels) label.y = clamp(label.y + shiftY, VIEWPORT.margin + label.height / 2, VIEWPORT.height - VIEWPORT.margin - label.height / 2);
  }
  return { ...scene, objects: [...others, ...kept, ...indexLabels], tick };
}

// ---------------------------------------------------------------------------------------------
// Stage 1 — LOWER semantic structures into primitives
// ---------------------------------------------------------------------------------------------

/**
 * Replaces semantic structure actions with the primitives the reducer already understands. Layout
 * is computed here, from the live scene where it matters, and the emitted coordinates are final.
 */
export function lowerVisualActions(scene: VisualScene, actions: VisualAction[]): { actions: VisualAction[]; diagnostics: VisualActionDiagnostic[] } {
  const out: VisualAction[] = [];
  const diagnostics: VisualActionDiagnostic[] = [];
  actions.forEach((action, index) => {
    if (action.action === "update_array") {
      out.push(action);
      return;
    }
    const compiled = compileStructure(action);
    if (compiled === null) {
      out.push(action);
      return;
    }
    const budget = MAX_OBJECTS - scene.objects.length;
    if (compiled.length > budget) {
      // Repair rather than fail: keep as much of the structure as fits and say what was lost.
      const kept = compiled.slice(0, Math.max(0, budget));
      diagnostics.push({
        action: action.action,
        target: "id" in action ? action.id : undefined,
        reason: `structure needs ${compiled.length} objects but only ${budget} fit on the board`,
        outcome: "repaired",
        sceneObjects: scene.objects.length,
        index,
      });
      out.push(...kept);
      return;
    }
    out.push(...compiled);
  });
  return { actions: out, diagnostics };
}

/**
 * Runs a step's actions in order using the step timeline (wait + per-action delay => start times).
 * Returns the resolved scene, how many objects the step added, and one diagnostic per action that could
 * not be used as sent. `applied` counts objects CREATED, because that is the only outcome an action can
 * produce that a later action cannot quietly undo.
 */
export function applyVisualActionsDetailed(
  scene: VisualScene,
  actions: VisualAction[],
  context: StepVisualContext = {},
): { scene: VisualScene; applied: number; diagnostics: VisualActionDiagnostic[]; retired: Retirement[] } {
  const lowered = lowerVisualActions(scene, actions);
  const timeline = buildTimeline(lowered.actions);
  const diagnostics = [...lowered.diagnostics];
  let applied = 0;

  // THE BOARD IS NOT A HISTORY. Everything already on screen is classified against what THIS step is
  // doing before a single new object is placed, so the step is laid out into the space the stale content
  // just vacated instead of into a board that is already full. Without this the board only ever grows:
  // a real Newton's-second-law lesson reached 58 objects at step 18 with 57 of them belonging to earlier
  // steps, and the calculation the teacher was actually doing was one more voice in the crowd.
  const lifecycle = applyLifecycle(scene, timeline.map((entry) => entry.action), context);

  let reduced = lifecycle.scene;
  // Focus is per-step: without a new `focus` the board returns to a neutral, fully readable scene
  // instead of staying permanently subdued by an idea from two steps ago.
  reduced = { ...reduced, focusIds: undefined };

  timeline.forEach((entry, index) => {
    // The reason must be judged BEFORE the action runs: afterwards a successful create looks exactly like
    // a duplicate, and every step would report its own objects as duplicates.
    const reason = skipReason(entry.action, reduced);
    const before = reduced.objects.length;
    reduced = applyVisualAction(reduced, entry.action, entry.startAtMs, reduced.tick + 1, context);
    if (reduced.objects.length > before) applied += 1;
    if (reason) diagnostics.push({ ...reason, sceneObjects: reduced.objects.length, index });
  });

  // Stamped in ONE place rather than inside every create branch, so no create path can be missed. An
  // object already carrying a stamp arrived in an earlier step and keeps the stage it was born in —
  // which is the whole point: the lifecycle compares stages, and re-stamping would make every object
  // look new on every step.
  reduced = stampNewObjects(reduced, context, lowered.actions);

  for (const entry of lifecycle.retired) {
    diagnostics.push({
      action: "retire",
      target: entry.group,
      reason: `left the board after ${entry.stagesOld} stages (born at step ${entry.bornStep})`,
      outcome: "dropped",
      sceneObjects: reduced.objects.length,
      index: -1,
    });
  }

  return {
    scene: refreshConnectionLabels(refreshTextPlacement(resolveSceneOverlaps(refreshConnections(reduced)))),
    applied,
    diagnostics,
    retired: lifecycle.retired,
  };
}

export function applyVisualActions(scene: VisualScene, actions: VisualAction[], context: StepVisualContext = {}): VisualScene {
  return applyVisualActionsDetailed(scene, actions, context).scene;
}

/** Why an action had no effect, phrased for a diagnostic log rather than for a student. */
function skipReason(action: VisualAction, scene: VisualScene): Omit<VisualActionDiagnostic, "sceneObjects" | "index"> | null {
  const id = "id" in action && typeof action.id === "string" ? (action.id as string) : undefined;
  const target = "target" in action && typeof action.target === "string" ? action.target : undefined;
  const refs = "from" in action && typeof action.from === "string" && "to" in action && typeof action.to === "string"
      ? { from: action.from as string, to: action.to as string }
      : undefined;
  const missing = (name: string, id: string) => ({ action: action.action, target: id, reason: `referenced object "${id}" does not exist`, outcome: "dropped" as const });

  if (action.action === "create_shape" || action.action === "create_container" || action.action === "create_text"
    || action.action === "create_icon" || action.action === "create_label" || action.action === "write_formula") {
    if (id && findObject(scene.objects, id)) return { action: action.action, target: id, reason: `duplicate object id "${id}"`, outcome: "dropped" };
    if (action.action === "create_label" && target && !findObject(scene.objects, target)) return missing("target", target);
  }
  if (refs) {
    if (id && findObject(scene.objects, id)) return { action: action.action, target: id, reason: `duplicate object id "${id}"`, outcome: "dropped" };
    if (!findObject(scene.objects, refs.from)) return missing("from", refs.from);
    if (!findObject(scene.objects, refs.to)) return missing("to", refs.to);
  }
  if (id && !findObject(scene.objects, id) && ["move", "resize", "rotate", "highlight", "pulse", "fade_in", "fade_out", "remove", "flow", "animate_path"].includes(action.action)) {
    return { action: action.action, target: id, reason: `target "${id}" does not exist`, outcome: "skipped" };
  }
  if (action.action === "move" && id && !action.placement) return { action: action.action, target: id, reason: "move without a placement has no destination", outcome: "dropped" };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Interruption
// ---------------------------------------------------------------------------------------------

/**
 * Completes every in-flight animation immediately and finishes delayed ones at their end state.
 *
 * Called when the student interrupts the lesson: the animation stops safely, no timer is left
 * running, and the scene the answer is applied to is the finished scene — never a half-drawn arrow.
 * The same function is what `prefers-reduced-motion` needs.
 */
export function settleVisualScene(scene: VisualScene): VisualScene {
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (!object.motion) return object;
    if (object.motion.kind === "travel" || object.motion.kind === "move") return object; // already at the destination
    changed = true;
    return { ...object, motion: { ...object.motion, delayMs: 0, durationMs: 1, flowProgress: object.motion.kind === "flow" ? 1 : object.motion.flowProgress } };
  });
  return changed ? { ...scene, objects } : scene;
}

export const visualSceneCenter = (object: VisualObject) => ({ x: object.x, y: object.y });
export type { VisualRole };