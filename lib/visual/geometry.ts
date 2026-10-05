// Geometry + semantic layout resolution.
//
// The model picks semantic placements (anchor / relative / between / explicit point) and never has
// to reason about pixels. Everything below is deterministic and TOPIC-AGNOSTIC: the same actions
// always produce the same scene, and the layout guarantees hold for any subject (networking,
// biology, physics, recursion frames, ...). Nothing here knows what the diagram is "about".
//
// Three general mechanisms keep a scene readable no matter what the model asks for:
//
//   1. SLOT PLACEMENT      - semantic anchors are subdivided into slots, so N objects anchored to
//                            "left" spread down the left edge instead of stacking.
//   2. FREE-SPOT SEARCH    - a resolved position that collides with an existing object is nudged to
//                            the nearest free spot (deterministic spiral), so nothing collapses.
//   3. LANE ALLOCATION     - connections between the SAME pair of objects are automatically placed
//                            on separate parallel lanes, so arrows and their labels never overlap.
import {
  DIAGRAM_HEIGHT, DIAGRAM_WIDTH, MAX_ARROW_OFFSET, MAX_OBJECT_SIZE, MIN_OBJECT_SIZE, VISUAL_MARGIN,
  Anchor, Point, SemanticRelation, VisualObject, VisualObjectKind, VisualPlacement,
} from "./types";
import { relationLayout } from "./semantics";

export const VIEWPORT = { width: DIAGRAM_WIDTH, height: DIAGRAM_HEIGHT, margin: VISUAL_MARGIN };

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const clampSize = (value: number): number => clamp(value, MIN_OBJECT_SIZE, MAX_OBJECT_SIZE);

export const clampOffset = (value: number): number => clamp(value, -MAX_ARROW_OFFSET, MAX_ARROW_OFFSET);

// Clamp an object centre so its full box (plus margin) stays inside the viewport.
export function clampCenter(point: Point, halfWidth: number, halfHeight: number): Point {
  const hw = clamp(halfWidth, 0, VIEWPORT.width / 2 - VIEWPORT.margin);
  const hh = clamp(halfHeight, 0, VIEWPORT.height / 2 - VIEWPORT.margin);
  return {
    x: clamp(point.x, VIEWPORT.margin + hw, VIEWPORT.width - VIEWPORT.margin - hw),
    y: clamp(point.y, VIEWPORT.margin + hh, VIEWPORT.height - VIEWPORT.margin - hh),
  };
}

export const centerOf = (object: VisualObject): Point => ({ x: object.x, y: object.y });

export function findObject(objects: VisualObject[], id: string): VisualObject | undefined {
  return objects.find((object) => object.id === id);
}

// Midpoint between two object centres (used by the "between" semantic placement).
export function midpointOf(a: VisualObject, b: VisualObject): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// ---------------------------------------------------------------------------------------------
// Boxes and collision
// ---------------------------------------------------------------------------------------------

export type Box = { left: number; top: number; right: number; bottom: number };

export function boxOf(center: Point, size: { width: number; height: number }): Box {
  return { left: center.x - size.width / 2, top: center.y - size.height / 2, right: center.x + size.width / 2, bottom: center.y + size.height / 2 };
}

export function boxOfObject(object: VisualObject): Box {
  return boxOf(centerOf(object), { width: object.width, height: object.height });
}

export const boxesOverlap = (a: Box, b: Box, pad = 0): boolean =>
  a.left - pad < b.right && b.left - pad < a.right && a.top - pad < b.bottom && b.top - pad < a.bottom;

// Connections are derived from their two endpoints; they are never blockers for a new object.
const NON_BLOCKING_KINDS: VisualObjectKind[] = ["arrow", "connector"];

// Does `obstacle` prevent a new object from being placed where it wants to be?
export const blocksPlacement = (obstacle: VisualObject): boolean => !NON_BLOCKING_KINDS.includes(obstacle.kind);

/** Is `candidate` entirely inside `frame`? */
export function boxInsideBox(candidate: Box, frame: Box, tolerance = 1): boolean {
  return candidate.left >= frame.left - tolerance
    && candidate.right <= frame.right + tolerance
    && candidate.top >= frame.top - tolerance
    && candidate.bottom <= frame.bottom + tolerance;
}

/**
 * Containers are FRAMES, not space reservations. They group what belongs inside them, so a frame must
 * never push anything away — otherwise a stack's own cells and its TOP label get shoved outside it by
 * the free-spot search. Real overlap between two filled shapes is still detected and separated later, by
 * resolveSceneOverlaps in the engine; a frame simply never wins that argument.
 */
export function blocksCandidate(obstacle: VisualObject, candidate: Box): boolean {
  if (!blocksPlacement(obstacle)) return false;
  if (obstacle.kind === "container") return false;
  return true;
}

export function isBoxFree(box: Box, objects: VisualObject[], ignore: string[] = []): boolean {
  return !objects.some((object) => {
    if (ignore.includes(object.id) || !blocksCandidate(object, box)) return false;
    return boxesOverlap(box, boxOfObject(object));
  });
}

// ---------------------------------------------------------------------------------------------
// Free-spot search
// ---------------------------------------------------------------------------------------------

// Preferred positions for objects the model did NOT place. Deterministic and well spread: the
// first object takes the centre, later ones fan out to the viewport edges before spreading further.
const AUTO_SLOTS: Point[] = [
  { x: VIEWPORT.width / 2, y: VIEWPORT.height / 2 },
  { x: VIEWPORT.margin + 60, y: VIEWPORT.height / 2 },
  { x: VIEWPORT.width - VISUAL_MARGIN - 60, y: VIEWPORT.height / 2 },
  { x: VIEWPORT.width / 2, y: VISUAL_MARGIN + 50 },
  { x: VIEWPORT.width / 2, y: VIEWPORT.height - VISUAL_MARGIN - 50 },
  { x: VISUAL_MARGIN + 60, y: VISUAL_MARGIN + 50 },
  { x: VIEWPORT.width - VISUAL_MARGIN - 60, y: VISUAL_MARGIN + 50 },
  { x: VISUAL_MARGIN + 60, y: VIEWPORT.height - VISUAL_MARGIN - 50 },
  { x: VIEWPORT.width - VISUAL_MARGIN - 60, y: VIEWPORT.height - VISUAL_MARGIN - 50 },
];

export const autoSlotPoint = (index: number): Point => AUTO_SLOTS[index % AUTO_SLOTS.length];

const SPIRAL_STEP = 24;
const SPIRAL_RINGS = 26;

// Overlap area of two boxes (0 when they are apart). Used as a last resort below.
export function overlapArea(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
}

// Deterministic "nearest free spot" search. `preferred` is tried first; if it is taken the search
// expands outwards in fixed rings so the result never depends on iteration order of a hash map.
// A crowded scene can have no free spot at all for a large label, so the search also remembers the
// least-overlapping position it saw: returning that beats dropping the object back on top of a
// neighbour, which is how text ends up printed over other text.
export function findFreeSpot(
  objects: VisualObject[],
  size: { width: number; height: number },
  preferred: Point,
  options: { ignore?: string[]; gap?: number } = {},
): Point {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const gap = options.gap ?? 10;
  const ignore = options.ignore ?? [];
  const start = clampCenter(preferred, halfWidth, halfHeight);
  if (isBoxFree(boxOf(start, size), objects, ignore)) return start;
  let bestPoint = start;
  let bestOverlap = Infinity;
  const consider = (candidate: Point) => {
    const box = boxOf(candidate, size);
    if (isBoxFree(box, objects, ignore)) return true;
    const overlap = objects.reduce((total, object) => {
      if (ignore.includes(object.id) || !blocksCandidate(object, box)) return total;
      return total + overlapArea(box, boxOfObject(object));
    }, 0);
    if (overlap < bestOverlap) {
      bestOverlap = overlap;
      bestPoint = candidate;
    }
    return false;
  };
  for (let ring = 1; ring <= SPIRAL_RINGS; ring += 1) {
    const radius = ring * SPIRAL_STEP;
    const steps = ring * 8;
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const candidate = clampCenter({ x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius }, halfWidth, halfHeight);
      if (consider(candidate)) return candidate;
    }
  }
  return bestPoint;
}

// ---------------------------------------------------------------------------------------------
// Anchor slots
// ---------------------------------------------------------------------------------------------

// Slide along the edge the anchor names. Vertical edges spread downwards, horizontal edges across.
// Slot 0 keeps the anchor exactly where the anchor points; later slots step along the edge.
export function anchorSlotOffset(anchor: Anchor, index: number, object: { width: number; height: number }): Point {
  if (index <= 0) return { x: 0, y: 0 };
  const step = Math.max(46, (anchor === "left" || anchor === "right" || anchor === "center"
    ? object.height : object.width) + 16);
  const shift = index * step;
  switch (anchor) {
    case "left": case "right": return { x: 0, y: shift };
    case "top": case "bottom": return { x: shift, y: 0 };
    case "top_left": case "bottom_left": return { x: 0, y: shift };
    case "top_right": case "bottom_right": return { x: shift, y: 0 };
    case "center":
    default: return { x: shift, y: 0 };
  }
}

function anchorPoint(anchor: Anchor): Point {
  const { width, height, margin } = VIEWPORT;
  const left = margin; const right = width - margin; const top = margin; const bottom = height - margin;
  switch (anchor) {
    case "top": return { x: width / 2, y: top };
    case "bottom": return { x: width / 2, y: bottom };
    case "left": return { x: left, y: height / 2 };
    case "right": return { x: right, y: height / 2 };
    case "top_left": return { x: left, y: top };
    case "top_right": return { x: right, y: top };
    case "bottom_left": return { x: left, y: bottom };
    case "bottom_right": return { x: right, y: bottom };
    case "center":
    default: return { x: width / 2, y: height / 2 };
  }
}

// Anchor points are "outer" points; offset by our own half-size so the whole object stays inside.
function placeFromAnchor(anchor: Anchor, halfWidth: number, halfHeight: number): Point {
  const base = anchorPoint(anchor);
  const dirX = Math.sign(base.x - VIEWPORT.width / 2);
  const dirY = Math.sign(base.y - VIEWPORT.height / 2);
  return { x: base.x + dirX * halfWidth, y: base.y + dirY * halfHeight };
}

// ---------------------------------------------------------------------------------------------
// Placement resolution
// ---------------------------------------------------------------------------------------------

// Slot index for an anchor, derived from the objects already occupying that edge.
function anchorSlotIndex(objects: VisualObject[], anchor: Anchor, ignore: string[]): number {
  return objects.filter((object) => !ignore.includes(object.id) && object.anchor === anchor).length;
}

// Deterministic layout for objects with no usable placement (missing placement, or a
// `relative`/`between` reference to an object that does not exist). Positions fan out over the
// viewport and a free-spot search guarantees separation, so unplaced objects never stack.
export function autoPosition(objects: VisualObject[], size: { width: number; height: number }, ignore: string[] = []): Point {
  const others = objects.filter((object) => !ignore.includes(object.id));
  const preferred = autoSlotPoint(others.length);
  return findFreeSpot(objects, size, preferred, { ignore });
}

export function resolvePlacement(
  placement: VisualPlacement | undefined,
  size: { width: number; height: number },
  objects: VisualObject[],
  options: { ignore?: string[]; anchorIndex?: number; gap?: number } = {},
): Point {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  const ignore = options.ignore ?? [];
  const finalize = (point: Point): Point => clampCenter(point, halfWidth, halfHeight);

  if (!placement) return autoPosition(objects, size, ignore);

  switch (placement.kind) {
    case "point": {
      const wanted = finalize({ x: placement.x, y: placement.y });
      // An explicit point is the model's deliberate choice; only rescue it when it is impossible.
      return findFreeSpot(objects, size, wanted, { ignore, gap: 2 });
    }
    case "anchor": {
      const slot = options.anchorIndex ?? anchorSlotIndex(objects, placement.anchor, ignore);
      const base = placeFromAnchor(placement.anchor, halfWidth, halfHeight);
      const shift = anchorSlotOffset(placement.anchor, slot, size);
      const wanted = finalize({ x: base.x + shift.x, y: base.y + shift.y });
      return findFreeSpot(objects, size, wanted, { ignore, gap: options.gap ?? 10 });
    }
    case "between": {
      const [first, second] = placement.between.map((id) => findObject(objects, id));
      if (!first || !second) return autoPosition(objects, size, ignore);
      return findFreeSpot(objects, size, finalize(midpointOf(first, second)), { ignore, gap: options.gap ?? 10 });
    }
    case "relative": {
      const anchorObject = findObject(objects, placement.relativeTo);
      if (!anchorObject) return autoPosition(objects, size, ignore);
      const gap = placement.gap;
      const wanted = finalize(sidePoint(anchorObject, placement.side, gap, halfWidth, halfHeight));
      return findFreeSpot(objects, size, wanted, { ignore, gap: options.gap ?? 8 });
    }
  }
}

/**
 * The side of `anchor` that `relation` puts `other` on.
 *
 * Exported so a structure compiler can lay a chain out along a spine without repeating the table: a
 * `left_to_right` relation puts its head to the right, a `derives_from` puts its source above, and a
 * `part_of` nests under its whole. The model then never chooses a side — which is what stops a
 * process diagram arriving with its steps stacked vertically for no reason.
 */
export function sideForRelation(relation: string | undefined, downstream = true): "left" | "right" | "above" | "below" | undefined {
  const layout = relationLayout(relation);
  if (layout === "left_to_right") return downstream ? "right" : "left";
  if (layout === "top_to_bottom") return downstream ? "below" : "above";
  if (layout === "inward") return downstream ? "below" : "above";
  if (layout === "apart") return downstream ? "right" : "left";
  return undefined;
}

/**
 * Raw (unclamped, un-nudged) position of a box placed `side` of an object.
 */
export function sidePoint(target: VisualObject, side: "left" | "right" | "above" | "below", gap: number, halfWidth: number, halfHeight: number): Point {
  switch (side) {
    case "right": return { x: target.x + target.width / 2 + gap + halfWidth, y: target.y };
    case "left": return { x: target.x - target.width / 2 - gap - halfWidth, y: target.y };
    case "below": return { x: target.x, y: target.y + target.height / 2 + gap + halfHeight };
    case "above":
    default: return { x: target.x, y: target.y - target.height / 2 - gap - halfHeight };
  }
}

// ---------------------------------------------------------------------------------------------
// Connections: geometry and lanes
// ---------------------------------------------------------------------------------------------

// Point on the rectangle border of `object` that lies on the segment towards `towards`.
export function borderPoint(object: VisualObject, towards: Point): Point {
  const dx = towards.x - object.x;
  const dy = towards.y - object.y;
  if (dx === 0 && dy === 0) return centerOf(object);
  const halfWidth = Math.max(object.width / 2, 1);
  const halfHeight = Math.max(object.height / 2, 1);
  const scale = 1 / Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  return { x: object.x + dx * scale, y: object.y + dy * scale };
}

// Shorten a connection by `inset` pixels on each end so arrowheads sit nicely outside the shapes.
// `offset` shifts BOTH endpoints perpendicular to the connection axis, so several messages between
// the same two objects form distinct parallel lanes instead of collapsing onto one line.
export function connectionEndpoints(from: VisualObject, to: VisualObject, inset = 6, offset = 0): { start: Point; end: Point } {
  const start = borderPoint(from, centerOf(to));
  const end = borderPoint(to, centerOf(from));
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = (dx / length) * inset;
  const uy = (dy / length) * inset;
  const rawStart = { x: start.x + ux, y: start.y + uy };
  const rawEnd = { x: end.x - ux, y: end.y - uy };
  if (!offset) return { start: rawStart, end: rawEnd };
  const px = -dy / length;
  const py = dx / length;
  return {
    start: { x: rawStart.x + px * offset, y: rawStart.y + py * offset },
    end: { x: rawEnd.x + px * offset, y: rawEnd.y + py * offset },
  };
}

// Perpendicular unit vector of a connection (points "left" of the from -> to direction).
export function connectionPerpendicular(from: VisualObject, to: VisualObject, offset: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: (-dy / length) * offset, y: (dx / length) * offset };
}

// Where a connection's label sits: the middle of its own lane, nudged off the line so the text is
// readable. Because every lane has its own offset, several labels between the same pair separate.
export const EDGE_LABEL_CLEARANCE = 13;

/**
 * Which side of a connection its label sits on.
 *
 * A travel-relative perpendicular would flip the label to the other side for every arrow drawn right to
 * left, so a protocol trace would read "label above / below / above". Labels therefore always sit ABOVE a
 * horizontal connection and to the RIGHT of a vertical one, whichever way the arrow points.
 *
 * `labelWidth` matters: the offset has to clear the label's own half-width, not just nudge it past the
 * line. A fixed 13-unit nudge put "W = m g" — about 40 units wide — with its first seven units sitting on
 * the force arrow it names, so the line struck through the text it was labelling.
 */
export function edgeLabelOffset(start: Point, end: Point, clearance = EDGE_LABEL_CLEARANCE, labelWidth = 0): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) return { x: 0, y: -clearance };
  return { x: clearance + Math.max(0, labelWidth) / 2, y: 0 };
}

/** Half the width a connection label will occupy, estimated the same way `measure.ts` estimates text. */
export function edgeLabelHalfWidth(text: string | undefined, fontSize = 12): number {
  if (!text) return 0;
  return (text.length * fontSize * 0.56) / 2;
}

export function connectionLabelPoint(from: VisualObject, to: VisualObject, offset: number, label?: string): Point {
  const { start, end } = connectionEndpoints(from, to, 6, offset);
  const perpendicular = edgeLabelOffset(start, end, EDGE_LABEL_CLEARANCE, edgeLabelHalfWidth(label));
  return { x: start.x + (end.x - start.x) / 2 + perpendicular.x, y: start.y + (end.y - start.y) / 2 + perpendicular.y };
}

// Automatic lane allocation. Connections that share the SAME pair of objects get successive lanes
// (0, +1, -1, +2, -2 lane widths), so the model never has to hand-pick offsets to stay readable.
export const LANE_WIDTH = 78;

const unorderedPairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function nextLaneOffset(index: number): number {
  if (index <= 0) return 0;
  const magnitude = Math.ceil(index / 2) * LANE_WIDTH;
  return clampOffset(index % 2 === 1 ? magnitude : -magnitude);
}

export function connectionsBetween(objects: VisualObject[], from: string, to: string): VisualObject[] {
  const key = unorderedPairKey(from, to);
  return objects.filter((object) => {
    if (object.kind !== "arrow" && object.kind !== "connector") return false;
    if (!object.refs) return false;
    return unorderedPairKey(object.refs.from, object.refs.to) === key;
  });
}

// Clamp a lane so the middle of the connection always stays on the board. Without this, a lane on
// an object near the edge of the viewport would draw its line (and label) off-screen.
export function fitLaneOffset(from: VisualObject, to: VisualObject, offset: number): number {
  const perpendicular = connectionPerpendicular(from, to, 1);
  const { start, end } = connectionEndpoints(from, to, 0, 0);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  let low = -MAX_ARROW_OFFSET;
  let high = MAX_ARROW_OFFSET;
  const restrict = (value: number, center: number, min: number, max: number) => {
    if (Math.abs(value) < 1e-6) return;
    const a = (min - center) / value;
    const b = (max - center) / value;
    low = Math.max(low, Math.min(a, b));
    high = Math.min(high, Math.max(a, b));
  };
  restrict(perpendicular.x, mid.x, VIEWPORT.margin, VIEWPORT.width - VIEWPORT.margin);
  restrict(perpendicular.y, mid.y, VIEWPORT.margin, VIEWPORT.height - VIEWPORT.margin);
  if (low > high) return clampOffset(offset);
  return clampOffset(clamp(offset, low, high));
}

// Where a travelling object should park next to its destination (just outside the border), nudged
// to a free spot so two packets never finish on top of each other.
export function parkingSpot(mover: VisualObject, target: VisualObject, objects: VisualObject[] = [], gap = 12): Point {
  const approach = borderPoint(target, centerOf(mover));
  const dx = approach.x - target.x;
  const dy = approach.y - target.y;
  const length = Math.hypot(dx, dy) || 1;
  const wanted = {
    x: approach.x + (dx / length) * (gap + mover.width / 2),
    y: approach.y + (dy / length) * (gap + mover.height / 2),
  };
  return findFreeSpot(objects, { width: mover.width, height: mover.height }, wanted, { ignore: [mover.id], gap: 8 });
}

// ---------------------------------------------------------------------------------------------
// CONNECTOR ROUTING
//
// A line between two boxes is only correct when it starts on the border, ends on the border, points
// at the right box, and does not cross anything on the way. The helpers above decide WHERE a
// connection starts and ends; the ones below decide the PATH it takes, and they take the objects it
// must avoid. Every candidate is geometric and every preference order is fixed, so the same scene
// always routes the same way.
// ---------------------------------------------------------------------------------------------

/** A linked-list / tree node drawn as `value | pointer`: the pointer compartment starts here. */
export function pointerCompartmentCenter(object: VisualObject): Point {
  return { x: object.x + object.width / 4, y: object.y };
}

/** Where a `next_pointer` connection must LEAVE a node: its pointer compartment, not its edge. */
export function nextPointerStart(node: VisualObject, towards: Point): Point {
  const inside = pointerCompartmentCenter(node);
  const right = inside.x + node.width / 4;
  // Aim for the near border of the pointer compartment, not the middle of the whole node.
  return towards.x >= node.x ? { x: right, y: inside.y } : { x: node.x - node.width / 4, y: inside.y };
}

/**
 * Where a `next_pointer` connection must ENTER the next node: on its BORDER, at the height of the value
 * compartment. Ending at the compartment's centre would bury the arrowhead inside the node.
 */
export function nextPointerEnd(node: VisualObject, from: Point): Point {
  return from.x <= node.x
    ? { x: node.x - node.width / 2, y: node.y }
    : { x: node.x + node.width / 2, y: node.y };
}

/** Liang–Barsky clip: does the segment actually overlap the box, or merely pass outside it? */
function segmentHitsBox(start: Point, end: Point, box: Box): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  let t0 = 0;
  let t1 = 1;
  const checks: Array<[number, number]> = [
    [-dx, start.x - box.left],
    [dx, box.right - start.x],
    [-dy, start.y - box.top],
    [dy, box.bottom - start.y],
  ];
  for (const [p, q] of checks) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t0 <= t1;
}

/** Does this polyline cross any obstacle box (the two endpoints' own boxes excluded)? */
export function pathCrossesObstacles(points: Point[], obstacles: Box[]): boolean {
  for (let index = 0; index + 1 < points.length; index += 1) {
    for (const box of obstacles) {
      if (segmentHitsBox(points[index], points[index + 1], box)) return true;
    }
  }
  return false;
}

/** A rounded orthogonal path through waypoints, so an elbow never looks like a broken line. */
export function orthogonalPath(points: Point[], radius = 10): string {
  if (points.length < 2) return "";
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let index = 1; index + 1 < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const next = points[index + 1];
    const incoming = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoing = Math.hypot(next.x - current.x, next.y - current.y);
    const r = Math.min(radius, incoming / 2, outgoing / 2);
    if (r < 1) continue;
    const enter = { x: current.x + (previous.x - current.x) / (incoming || 1) * r, y: current.y + (previous.y - current.y) / (incoming || 1) * r };
    const leave = { x: current.x + (next.x - current.x) / (outgoing || 1) * r, y: current.y + (next.y - current.y) / (outgoing || 1) * r };
    d += ` L ${round(enter.x)} ${round(enter.y)} Q ${round(current.x)} ${round(current.y)} ${round(leave.x)} ${round(leave.y)}`;
  }
  const last = points[points.length - 1];
  return `${d} L ${round(last.x)} ${round(last.y)}`;
}

/** A symmetric cubic that leaves and enters perpendicular to the boxes it connects. */
export function curvedPath(start: Point, end: Point, offset = 0): string {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = -dy / length;
  const py = dx / length;
  const bend = Math.min(90, length * 0.32) + offset * 0.35;
  const c1 = { x: start.x + dx * 0.32 + px * bend, y: start.y + dy * 0.32 + py * bend };
  const c2 = { x: start.x + dx * 0.68 + px * bend, y: start.y + dy * 0.68 + py * bend };
  return `M ${round(start.x)} ${round(start.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(end.x)} ${round(end.y)}`;
}

const round = (value: number): number => Math.round(value * 100) / 100;

export type ConnectionRoute = {
  /** SVG path data. A straight connection is still a path, so draw-in animation works for all. */
  d: string;
  start: Point;
  end: Point;
  /** Where the label sits: on the path's midpoint, nudged clear of the line. */
  label: Point;
  /** Points the path passes through, used for flow packets and obstacle checks. */
  points: Point[];
  /** True when the direct line was blocked and a detour was used. */
  rerouted: boolean;
};

/**
 * Routes one connection.
 *
 * `kind` chooses the shape of the route; obstacles only ever make the router take a detour, never
 * change the endpoints. Elbow routes are tried in a fixed order (mid-x, mid-y, above, below) and
 * the first clear one wins, so two runs of the same lesson always draw the same elbow.
 */
export function routeConnection(
  from: VisualObject,
  to: VisualObject,
  options: { offset?: number; kind?: string; obstacles?: Box[]; gap?: number; label?: string } = {},
): ConnectionRoute {
  const offset = options.offset ?? 0;
  const kind = options.kind ?? "straight";
  const gap = options.gap ?? 6;
  const obstacles = options.obstacles ?? [];

  // A next-pointer leaves the pointer compartment, everything else leaves the box border.
  const startBase = kind === "next_pointer" ? nextPointerStart(from, centerOf(to)) : borderPoint(from, centerOf(to));
  const endBase = kind === "next_pointer" ? nextPointerEnd(to, from) : borderPoint(to, centerOf(from));
  const dx = endBase.x - startBase.x;
  const dy = endBase.y - startBase.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = (dx / length) * gap;
  const uy = (dy / length) * gap;
  const px = (-dy / length) * offset;
  const py = (dx / length) * offset;
  // A STRAIGHT connection is displaced by its lane offset, which is how several arrows between the same
  // pair occupy parallel lanes. A CURVED or ELBOW route must NOT be: there the offset chooses the way the
  // line bends, so the endpoints stay ON the borders and the arrowhead is not left floating.
  const displaced = kind === "curved" || kind === "elbow" ? { x: 0, y: 0 } : { x: px, y: py };
  const start = { x: startBase.x + ux + displaced.x, y: startBase.y + uy + displaced.y };
  const end = { x: endBase.x - ux + displaced.x, y: endBase.y - uy + displaced.y };
  const labelOffset = edgeLabelOffset(start, end, EDGE_LABEL_CLEARANCE, edgeLabelHalfWidth(options.label));
  const label = {
    x: (start.x + end.x) / 2 + labelOffset.x,
    y: (start.y + end.y) / 2 + labelOffset.y,
  };

  const straightBlocked = pathCrossesObstacles([start, end], obstacles);
  if (kind === "curved") return { d: curvedPath(start, end, offset), start, end, label, points: [start, end], rerouted: false };

  if (!straightBlocked && kind !== "elbow") {
    return { d: `M ${round(start.x)} ${round(start.y)} L ${round(end.x)} ${round(end.y)}`, start, end, label, points: [start, end], rerouted: false };
  }

  // Elbow candidates, in a fixed order of preference: split the dominant axis, then take a corridor
  // above or below the pair. The midpoint routes are preferred because they look the most direct.
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  const corridor = 34;
  const above = Math.min(start.y, end.y) - corridor;
  const below = Math.max(start.y, end.y) + corridor;
  const candidates: Point[][] = [
    [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end],
    [start, { x: start.x, y: midY }, { x: end.x, y: midY }, end],
    [start, { x: start.x, y: above }, { x: end.x, y: above }, end],
    [start, { x: start.x, y: below }, { x: end.x, y: below }, end],
  ];
  const chosen = candidates.find((points) => !pathCrossesObstacles(points, obstacles)) ?? candidates[0];
  const simplified = simplifyWaypoints(chosen);
  return {
    d: orthogonalPath(simplified),
    start,
    end,
    label,
    points: simplified,
    rerouted: true,
  };
}

/** Drop waypoints a rounded path would collapse anyway, so the path data stays short. */
function simplifyWaypoints(points: Point[]): Point[] {
  const kept: Point[] = [points[0]];
  for (let index = 1; index + 1 < points.length; index += 1) {
    const previous = kept[kept.length - 1];
    const current = points[index];
    const next = points[index + 1];
    const sameX = Math.abs(previous.x - current.x) < 0.5 && Math.abs(current.x - next.x) < 0.5;
    const sameY = Math.abs(previous.y - current.y) < 0.5 && Math.abs(current.y - next.y) < 0.5;
    if (!sameX && !sameY) kept.push(current);
  }
  kept.push(points[points.length - 1]);
  return kept;
}

/** Where a moving packet sits at progress t (0..1) along a route, and where it is heading. */
export function pointAlongRoute(route: ConnectionRoute, t: number): { x: number; y: number; angle: number } {
  const points = route.points;
  if (points.length === 1) return { x: points[0].x, y: points[0].y, angle: 0 };
  const lengths: number[] = [];
  let total = 0;
  for (let index = 0; index + 1 < points.length; index += 1) {
    const length = Math.hypot(points[index + 1].x - points[index].x, points[index + 1].y - points[index].y);
    lengths.push(length);
    total += length;
  }
  let remaining = Math.min(1, Math.max(0, t)) * total;
  for (let index = 0; index + 1 < points.length; index += 1) {
    if (remaining <= lengths[index]) {
      const ratio = lengths[index] === 0 ? 0 : remaining / lengths[index];
      const from = points[index];
      const to = points[index + 1];
      return {
        x: from.x + (to.x - from.x) * ratio,
        y: from.y + (to.y - from.y) * ratio,
        angle: (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI,
      };
    }
    remaining -= lengths[index];
  }
  const last = points[points.length - 1];
  const beforeLast = points[points.length - 2];
  return { x: last.x, y: last.y, angle: (Math.atan2(last.y - beforeLast.y, last.x - beforeLast.x) * 180) / Math.PI };
}
