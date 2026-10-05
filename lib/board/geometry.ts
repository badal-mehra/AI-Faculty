// Board geometry utilities — resolves semantic TextAnchor positions to actual SVG coordinates.
//
// The board engine stores text with a semantic anchor (e.g. "inside node-60", "above node-60")
// rather than raw pixel coordinates. This module converts those anchors to pixel positions at
// render time, so text always follows its host object, never drifts, and cannot render far from
// its target.
//
// Rules:
//   - "inside"  → object centre (text is centred over the circle/box)
//   - "above"   → directly above the object, with a safe gap
//   - "below"   → directly below the object, with a safe gap
//   - "left"    → to the left of the object
//   - "right"   → to the right of the object
//   - "center"  → object centre (alias for inside)
//   - edge mid  → midpoint of the line segment, offset slightly perpendicular
//   - point     → the x/y stored verbatim (legacy / absolute annotations)

import { BoardEdge, BoardNode, BoardText, TextAnchor } from "./types";

export const NODE_RADIUS = 31; // Must match BoardNode.tsx circle r

// Gap (px) between the target object and an external label.
const LABEL_GAP = 12;

// Vertical gap for above/below labels relative to node centre.
const ABOVE_DY = -(NODE_RADIUS + LABEL_GAP + 10);
const BELOW_DY = NODE_RADIUS + LABEL_GAP + 10;
const SIDE_DX = NODE_RADIUS + LABEL_GAP + 10;

// Board viewport (matches engine.ts BOARD_BOUNDS + outer SVG size).
const BOARD_W = 800;
const BOARD_H = 520;
const MARGIN = 16;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function clampPoint(x: number, y: number): { x: number; y: number } {
  return {
    x: clamp(x, MARGIN, BOARD_W - MARGIN),
    y: clamp(y, MARGIN, BOARD_H - MARGIN),
  };
}

// Rough rendered box of a label. The board draws text CENTRED on the resolved point, so clamping that
// point alone can still leave a wide label hanging over the edge; the box is what has to stay on the
// board. The character width is measured against the board font (about 0.62em per character at the
// default 23px), so this tracks what the renderer actually paints closely enough to keep text whole.
const DEFAULT_TEXT_FONT_SIZE = 23;
const TEXT_CHAR_WIDTH = 0.66;
const TEXT_LINE_HEIGHT = 1.45;

export function textExtent(item: BoardText): { halfWidth: number; halfHeight: number } {
  const fontSize = item.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const width = item.maxWidth ?? Math.max(24, item.text.length * fontSize * TEXT_CHAR_WIDTH);
  return {
    halfWidth: Math.min(width, BOARD_W - 2 * MARGIN) / 2,
    halfHeight: (fontSize * TEXT_LINE_HEIGHT) / 2,
  };
}

// Keep a whole label on the board, not just its centre. A label wider than the board falls back to
// centring it, which is the least-wrong place for it.
function clampLabel(x: number, y: number, halfWidth: number, halfHeight: number): { x: number; y: number } {
  return {
    x: halfWidth * 2 > BOARD_W - 2 * MARGIN ? clampPoint(x, y).x : clamp(x, MARGIN + halfWidth, BOARD_W - MARGIN - halfWidth),
    y: halfHeight * 2 > BOARD_H - 2 * MARGIN ? clampPoint(x, y).y : clamp(y, MARGIN + halfHeight, BOARD_H - MARGIN - halfHeight),
  };
}

/**
 * Resolve a text item's final render position given the live board state.
 * Returns {x, y} in SVG board coordinates.
 * Falls back to the item's stored .x/.y if the anchor target cannot be found.
 */
export function resolveTextPosition(
  item: BoardText,
  nodes: BoardNode[],
  edges: BoardEdge[],
  texts: BoardText[] = [],
): { x: number; y: number } {
  const anchor: TextAnchor = item.anchor;
  const extent = textExtent(item);
  const fit = (x: number, y: number) => clampLabel(x, y, extent.halfWidth, extent.halfHeight);
  // A label sits a fixed distance from its target, so two labels (a queue's "front" and "rear" on one
  // node, or two labels that happen to sit over the same spot) would land on top of each other.
  // Stacked apart vertically, both stay beside the object they name and both stay readable.
  const withSiblings = (x: number, y: number) => {
    if (anchor.type !== "object" || texts.length === 0) return { x, y };
    let px = x;
    let py = y;
    for (let pass = 0; pass < 4; pass += 1) {
      const box = rectOf(px, py, extent.halfWidth, extent.halfHeight);
      // Sibling positions are resolved WITHOUT separation, so this stays deterministic and cannot
      // recurse; one pass of separation is enough to stop two labels printing over each other.
      const sibling = texts.find((other) => {
        if (other.id === item.id || other.anchor.type !== "object") return false;
        const siblingPosition = resolveTextPosition(other, nodes, edges);
        const siblingExtent = textExtent(other);
        return overlaps(box, rectOf(siblingPosition.x, siblingPosition.y, siblingExtent.halfWidth, siblingExtent.halfHeight));
      });
      if (!sibling) break;
      const siblingPosition = resolveTextPosition(sibling, nodes, edges);
      const siblingExtent = textExtent(sibling);
      const siblingBox = rectOf(siblingPosition.x, siblingPosition.y, siblingExtent.halfWidth, siblingExtent.halfHeight);
      const overlap = Math.min(box.bottom, siblingBox.bottom) - Math.max(box.top, siblingBox.top);
      py += py <= siblingPosition.y ? -(overlap + 4) : overlap + 4;
    }
    return clampLabel(px, py, extent.halfWidth, extent.halfHeight);
  };

  if (anchor.type === "point") {
    return fit(anchor.x, anchor.y);
  }

  if (anchor.type === "object") {
    const node = nodes.find((n) => n.id === anchor.id);
    if (!node) {
      // Target doesn't exist — fall back to the stored coords so we don't lose the text.
      return fit(item.x, item.y);
    }
    switch (anchor.position) {
      case "inside":
      case "center":
        return fit(node.x, node.y);
      case "above":
        return withSiblings(node.x, node.y + ABOVE_DY);
      case "below":
        return withSiblings(node.x, node.y + BELOW_DY);
      case "left":
        return withSiblings(node.x - SIDE_DX, node.y);
      case "right":
        return withSiblings(node.x + SIDE_DX, node.y);
    }
  }

  if (anchor.type === "edge") {
    const edge = edges.find((e) => e.id === anchor.id);
    if (!edge) {
      return fit(item.x, item.y);
    }
    const fromNode = nodes.find((n) => n.id === edge.from);
    const toNode = nodes.find((n) => n.id === edge.to);
    if (!fromNode || !toNode) {
      return fit(item.x, item.y);
    }
    // Midpoint of the edge, nudged perpendicular to avoid sitting on the line.
    const mx = (fromNode.x + toNode.x) / 2;
    const my = (fromNode.y + toNode.y) / 2;
    const dx = toNode.x - fromNode.x;
    const dy = toNode.y - fromNode.y;
    const len = Math.hypot(dx, dy) || 1;
    const perpX = (-dy / len) * 14;
    const perpY = (dx / len) * 14;
    switch (anchor.position) {
      case "start":
        return fit(fromNode.x + (dx / len) * (NODE_RADIUS + 8), fromNode.y + (dy / len) * (NODE_RADIUS + 8));
      case "end":
        return fit(toNode.x - (dx / len) * (NODE_RADIUS + 8), toNode.y - (dy / len) * (NODE_RADIUS + 8));
      case "midpoint":
      case "offset":
      default:
        return fit(mx + perpX, my + perpY);
    }
  }

  // Fallback — should not happen with a valid TextAnchor, but be safe.
  return fit(item.x, item.y);
}

/**
 * Returns a fresh TextAnchor that points to a specific node.
 */
export function nodeAnchor(
  nodeId: string,
  position: "inside" | "above" | "below" | "left" | "right" | "center" = "above",
): TextAnchor {
  return { type: "object", id: nodeId, position };
}

/**
 * Returns a fresh TextAnchor that encodes an absolute position (legacy / annotation use).
 */
export function pointAnchor(x: number, y: number): TextAnchor {
  return { type: "point", x, y };
}

// ---- Free-annotation placement ---------------------------------------------------------------
// A point-anchored label is a free annotation: it names nothing, so the engine may move it as long as
// it stays on the board and readable. Two annotations (or an annotation and a node) must never be
// printed on top of each other, so a colliding annotation is nudged to the nearest clear spot.

const FREE_SPOT_STEP = 18;
const FREE_SPOT_RINGS = 22;

type Rect = { left: number; top: number; right: number; bottom: number };

const rectOf = (cx: number, cy: number, halfWidth: number, halfHeight: number): Rect => ({
  left: cx - halfWidth, top: cy - halfHeight, right: cx + halfWidth, bottom: cy + halfHeight,
});

const overlaps = (a: Rect, b: Rect): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

const overlapArea = (a: Rect, b: Rect): number => {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
};

function textBoxOf(item: BoardText): Rect {
  const { halfWidth, halfHeight } = textExtent(item);
  return rectOf(item.x, item.y, halfWidth, halfHeight);
}

function nodeBoxOf(node: BoardNode): Rect {
  return rectOf(node.x, node.y, NODE_RADIUS, NODE_RADIUS);
}

/**
 * Move a free (point-anchored) annotation to the nearest spot where it overlaps nothing, keeping it
 * fully on the board. Deterministic: the same board always produces the same annotation layout.
 * Object- and edge-anchored text is never touched — those positions come from their target.
 */
export function resolveFreeTextPosition(item: BoardText, state: { nodes: BoardNode[]; texts: BoardText[] }): { x: number; y: number } {
  if (item.anchor.type !== "point") return { x: item.x, y: item.y };
  const { halfWidth, halfHeight } = textExtent(item);
  const start = { x: clamp(item.x, MARGIN + halfWidth, BOARD_W - MARGIN - halfWidth), y: clamp(item.y, MARGIN + halfHeight, BOARD_H - MARGIN - halfHeight) };
  const blockers = [
    ...state.nodes.map(nodeBoxOf),
    ...state.texts.filter((other) => other.id !== item.id).map(textBoxOf),
  ];
  const cost = (x: number, y: number) => blockers.reduce((total, box) => total + overlapArea(rectOf(x, y, halfWidth, halfHeight), box), 0);
  if (cost(start.x, start.y) === 0) return start;
  let best = start;
  let bestCost = cost(start.x, start.y);
  for (let ring = 1; ring <= FREE_SPOT_RINGS; ring += 1) {
    const radius = ring * FREE_SPOT_STEP;
    const steps = ring * 8;
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const x = clamp(start.x + Math.cos(angle) * radius, MARGIN + halfWidth, BOARD_W - MARGIN - halfWidth);
      const y = clamp(start.y + Math.sin(angle) * radius, MARGIN + halfHeight, BOARD_H - MARGIN - halfHeight);
      const box = rectOf(x, y, halfWidth, halfHeight);
      if (!blockers.some((blocker) => overlaps(box, blocker))) return { x, y };
      const current = cost(x, y);
      if (current < bestCost) { bestCost = current; best = { x, y }; }
    }
  }
  return best;
}
