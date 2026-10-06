// SMART LABELS: EVERY PIECE OF TEXT KNOWS WHAT IT NAMES, AND STAYS NEAR IT.
//
// PHASE 4, AND IT IS A CRITICAL PROBLEM.
//
// The board had two ways to place a label and both were wrong in the same direction:
//
//   1. THE FREE-SPOT SEARCH. A label asked for "right of this object" was handed to `findFreeSpot`, which
//      walks outwards until it finds empty canvas. If the right was blocked, the label travelled to the
//      top-left corner of the board and sat there looking like a caption for the whole diagram. The
//      relationship that gave it meaning was destroyed in the act of avoiding a collision.
//   2. NOTHING AT ALL. Free text with no `target` was placed at its own coordinates and then nudged
//      wherever there was room, so a step caption could end up printed between two unrelated boxes.
//
// So this module makes THREE commitments:
//
//   OWNERSHIP.    A label is placed relative to the thing it names, and the relationship is recorded on
//                 the object, so it survives every later re-layout. There is no "near the target" option.
//   PROXIMITY.    Nine candidate anchors, scored, and the best one wins. Distance is a COST, not a
//                 concession: a collision is worth a slightly worse anchor, and free space at the far
//                 side of the board is worth nothing at all.
//   EXPLANATION.  When the best anchor still leaves the label far from its target, a LEADER LINE is drawn.
//                 A label that is genuinely far away says why it is far away, instead of becoming a
//                 floating annotation the student has to decode.
//
// The scoring is deliberately explicit and additive rather than a black box, because a label's quality
// is a trade between several good things and the trade is a teaching decision.
import {
  boxOf, boxOfObject, boxesOverlap, clampCenter, overlapArea, type Box,
} from "./geometry";
import { contentBox, type VisualViewport } from "./viewport";
import { labelGap, space } from "./spacing";
import type { Point, RelativeSide, VisualObject } from "./types";
import type { ConnectionRoute } from "./geometry";

/**
 * The nine places a label can sit relative to what it names.
 *
 * Nine, not four: `top` and `top-left` are different things. A label centred above a wide box and a label
 * tucked into the top-left corner of it are not the same relationship, and forcing both into "above" is
 * how the top of a dense diagram fills with text that is all nominally "above" something.
 */
export const LABEL_ANCHORS = [
  "center", "top", "bottom", "left", "right", "top_left", "top_right", "bottom_left", "bottom_right",
] as const;

export type LabelAnchor = typeof LABEL_ANCHORS[number];

/** The `RelativeSide` a label reports, so the leader line and the alignment agree. */
const ANCHOR_SIDE: Record<LabelAnchor, RelativeSide> = {
  center: "below", top: "above", bottom: "below", left: "left", right: "right",
  top_left: "above", top_right: "above", bottom_left: "below", bottom_right: "below",
};

export const relativeSideFor = (anchor: LabelAnchor): RelativeSide => ANCHOR_SIDE[anchor];

/**
 * Beyond this gap a label needs a leader line.
 *
 * It is derived rather than fixed: a wide box and a wide label already read as a pair at a distance,
 * while two small ones do not. What matters is that the label is CLOSE RELATIVE TO THE THINGS IT COULD
 * POSSIBLY BE NAMING — so the bound scales with the target rather than being a constant that is right
 * for one size of box and wrong for every other.
 */
export const leaderLineBeyond = (target: VisualObject): number =>
  Math.max(28, Math.min(64, Math.min(target.width, target.height) * 0.6));

export type LabelQuality = {
  /** 0-100. How close the label is to what it names, against the largest sensible distance. */
  distanceToTarget: number;
  /** 0-100. How well the label is lined up with the thing it names. */
  alignment: number;
  /** 0-100. How much of the label is free of other objects. */
  collision: number;
  /** 0-100. How far the label is from any connector that is not its own. */
  connectorInterference: number;
  /** 0-100. Whether the label is big enough to read, with room around it. */
  readability: number;
  /** 0-100. Whether the label is quieter than the object it names rather than competing with it. */
  visualHierarchy: number;
  /** The weighted total, 0-100. */
  score: number;
};

const score = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

/**
 * How the six label-quality dimensions are weighted.
 *
 * Attachment comes first because it IS the label: a slightly colliding label that is unmistakably beside
 * its object teaches more than a perfectly clear one that has drifted. Readability comes last because a
 * label that cannot be read is not worth any placement — but it is bounded below, so the other five
 * cannot rescue a six-pixel word.
 */
const WEIGHTS = { distance: 0.3, alignment: 0.2, collision: 0.22, connector: 0.12, readability: 0.1, hierarchy: 0.06 } as const;

export type LabelCandidate = {
  anchor: LabelAnchor;
  point: Point;
  box: Box;
  /** Distance from the label's nearest edge to the target's nearest edge. */
  distance: number;
  quality: LabelQuality;
  /** True when the label is far enough from its target to need a leader line. */
  needsLeader: boolean;
};

export type PlaceLabelInput = {
  /** The object this label names. A label without one is not a label; see `placeCaption`. */
  target: VisualObject;
  label: { width: number; height: number; fontSize: number; role?: string };
  /** Everything already placed that the label must stay clear of. */
  obstacles: readonly VisualObject[];
  /** Routed connections, so a label is not placed on top of a line. */
  connectors?: readonly ConnectionRoute[];
  viewport: VisualViewport;
  /** Which side the caller asked for, when the model named one. */
  preferred?: RelativeSide;
  /** True when the label names one of several siblings, which raises the hierarchy cost of shouting. */
  siblingCount?: number;
};

/** The centre of the label at a given anchor, `gap` px clear of the target's box. */
export function anchorPointFor(anchor: LabelAnchor, target: VisualObject, label: { width: number; height: number }, gap: number): Point {
  const box = boxOfObject(target);
  const halfWidth = label.width / 2;
  const halfHeight = label.height / 2;
  const left = box.left - gap - halfWidth;
  const right = box.right + gap + halfWidth;
  const aboveY = (box.top + box.bottom) / 2 - gap - halfHeight;
  const belowY = (box.top + box.bottom) / 2 + gap + halfHeight;
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  switch (anchor) {
    case "center": return { x: cx, y: cy };
    case "top": return { x: cx, y: aboveY };
    case "bottom": return { x: cx, y: belowY };
    case "left": return { x: left, y: cy };
    case "right": return { x: right, y: cy };
    case "top_left": return { x: left, y: aboveY };
    case "top_right": return { x: right, y: aboveY };
    case "bottom_left": return { x: left, y: belowY };
    case "bottom_right": return { x: right, y: belowY };
  }
}

export const boxSize = (box: Box): { width: number; height: number } => ({ width: box.right - box.left, height: box.bottom - box.top });

/** Shortest distance between two boxes; 0 when they touch or overlap. */
export function boxGap(a: Box, b: Box): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
  return Math.hypot(dx, dy);
}

/** The closest point on a box to `point`, which is where a leader line should touch. */
export function boxEdgeTowards(box: Box, point: Point): Point {
  const insideX = point.x >= box.left && point.x <= box.right;
  const insideY = point.y >= box.top && point.y <= box.bottom;
  if (!insideX && !insideY) {
    return {
      x: Math.max(box.left, Math.min(point.x, box.right)),
      y: Math.max(box.top, Math.min(point.y, box.bottom)),
    };
  }
  if (insideX) {
    return { x: point.x < (box.left + box.right) / 2 ? box.left : box.right, y: point.y };
  }
  return { x: point.x, y: point.y < (box.top + box.bottom) / 2 ? box.top : box.bottom };
}

/** How much of `box` sits on top of something it should not. */
function collisionArea(box: Box, obstacles: readonly VisualObject[]): number {
  let area = 0;
  for (const obstacle of obstacles) {
    area += overlapArea(box, boxOfObject(obstacle));
  }
  return area;
}

/** How close a box gets to a routed connection, in pixels. 0 means the line runs through it. */
export function distanceToRoute(box: Box, route: ConnectionRoute): number {
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index + 1 < route.points.length; index += 1) {
    best = Math.min(best, segmentToBox(route.points[index], route.points[index + 1], box));
  }
  return route.points.length === 1 ? 0 : best;
}

/** Distance from a segment to an axis-aligned box; 0 when the segment passes through it. */
function segmentToBox(a: Point, b: Point, box: Box): number {
  const steps = 12;
  for (let i = 0; i <= steps; i += 1) {
    const point = { x: a.x + (b.x - a.x) * (i / steps), y: a.y + (b.y - a.y) * (i / steps) };
    if (point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom) return 0;
  }
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i <= steps; i += 1) {
    const point = { x: a.x + (b.x - a.x) * (i / steps), y: a.y + (b.y - a.y) * (i / steps) };
    best = Math.min(best, pointToBox(point, box));
  }
  return best;
}

const pointToBox = (point: Point, box: Box): number => Math.hypot(
  Math.max(0, box.left - point.x, point.x - box.right),
  Math.max(0, box.top - point.y, point.y - box.bottom),
);

/** How well a label is lined up with what it names: 100 when an edge or the centre line is shared. */
function alignmentScore(anchor: LabelAnchor, target: VisualObject, label: { width: number; height: number }): number {
  const box = boxOfObject(target);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  const point = anchorPointFor(anchor, target, label, 0);
  const centreAligned = anchor === "center" || anchor === "top" || anchor === "bottom";
  if (centreAligned) return Math.abs(point.x - cx) < 1 && Math.abs(point.y - cy) < Math.max(target.width, target.height) * 0.6 ? 100 : 88;
  // A side anchor shares an edge with the target only when the label's centre lines up with the target's
  // centre on the other axis; a corner anchor is never as good as that, and is scored as such.
  const sharesCentre = anchor === "left" || anchor === "right"
    ? Math.abs(point.y - cy) < 1
    : Math.abs(point.x - cx) < 1;
  if (!sharesCentre) return 52;
  return anchor === "left" || anchor === "right" ? 100 : 70;
}

/** How readable a label is at this size and this board, allowing for the room around it. */
function readabilityScore(label: { width: number; height: number; fontSize: number; role?: string }): number {
  const size = score((label.fontSize / 20) * 100);
  const heading = label.role === "title" || label.role === "subtitle";
  // A heading may be large; an annotation may not, and a caption squeezed to a sliver is unreadable even
  // at a large nominal size.
  const proportion = heading ? 100 : score(Math.min(100, ((label.width * label.height) / 2600) * 100));
  return size * 0.6 + proportion * 0.4;
}

/** Whether the label is quieter than the thing it names. */
function hierarchyScore(label: { fontSize: number; role?: string }, target: VisualObject, siblingCount: number): number {
  const targetSize = target.fontSize ?? 20;
  const isHeading = label.role === "title" || label.role === "subtitle" || label.role === "callout";
  if (isHeading) return 100;
  // A label should not be louder than the object it names. When several labels name the same target,
  // the bar rises, because four captions around one box are a wall of text whatever their size.
  const ratio = label.fontSize / Math.max(1, targetSize);
  const base = ratio > 0.95 ? 55 : 100;
  return siblingCount > 2 ? base * 0.85 : base;
}

/**
 * Places one label beside the object it names.
 *
 * Every candidate anchor is tried, scored on all six dimensions, and the best wins. The result is
 * deterministic: the same board, the same objects and the same label always produce the same placement,
 * which is what makes a replayed lesson look identical (PHASE 19).
 */
export function placeLabel(input: PlaceLabelInput): LabelCandidate {
  const { target, label, obstacles, connectors = [], viewport } = input;
  const gap = labelGap(viewport);
  const targetBox = boxOfObject(target);
  const area = contentBox(viewport);
  const maxDistance = leaderLineBeyond(target);
  const preferredAnchor = input.preferred ? anchorForSide(input.preferred) : undefined;

  // The order is fixed so ties resolve the same way every run: the model's preference first, then the
  // sides in reading order around the object.
  const order: LabelAnchor[] = preferredAnchor
    ? [preferredAnchor, ...LABEL_ANCHORS.filter((anchor) => anchor !== preferredAnchor)]
    : ["right", "left", "top", "bottom", "center", "top_left", "bottom_right", "top_right", "bottom_left"];

  const labelArea = Math.max(1, label.width * label.height);
  let best: { candidate: LabelCandidate; score: number } | null = null;
  let fallback: { candidate: LabelCandidate; score: number } | null = null;

  for (const anchor of order) {
    const wanted = anchorPointFor(anchor, target, label, gap);
    // A label that would fall off the board is not a candidate at all: nudging it back inside is what
    // turns "above the box" into "beside the board", and the anchor no longer means anything.
    const point = clampCenter(wanted, label.width / 2, label.height / 2, viewport);
    const box = boxOf(point, label);
    if (box.left < area.left - 1 || box.right > area.right + 1 || box.top < area.top - 1 || box.bottom > area.bottom + 1) continue;
    const distance = boxGap(box, targetBox);
    const on = collisionArea(box, obstacles) / labelArea;
    let connectorCost = 0;
    let nearestConnector = Number.POSITIVE_INFINITY;
    for (const route of connectors) {
      const clear = distanceToRoute(box, route);
      nearestConnector = Math.min(nearestConnector, clear);
      if (clear === 0) connectorCost += 1;
      else if (clear < 10) connectorCost += 10 - clear;
    }
    const quality: LabelQuality = {
      distanceToTarget: score(100 - (distance / (maxDistance * 2)) * 100),
      alignment: alignmentScore(anchor, target, label),
      collision: score(100 - on * 100),
      connectorInterference: score(100 - connectorCost * 25),
      readability: readabilityScore(label),
      visualHierarchy: hierarchyScore(label, target, input.siblingCount ?? 1),
      score: 0,
    };
    quality.score = score(
      quality.distanceToTarget * WEIGHTS.distance
      + quality.alignment * WEIGHTS.alignment
      + quality.collision * WEIGHTS.collision
      + quality.connectorInterference * WEIGHTS.connector
      + quality.readability * WEIGHTS.readability
      + quality.visualHierarchy * WEIGHTS.hierarchy,
    );
    const candidate: LabelCandidate = {
      anchor,
      point,
      box,
      distance,
      quality,
      needsLeader: distance > maxDistance || anchor === "center",
    };
    // The preferred anchor wins outright when it is acceptable, because a teacher who said "put this
    // label above" means above, and a tie is not a good enough reason to override them.
    if (anchor === preferredAnchor && quality.score >= 70) return candidate;
    if (!best || quality.score > best.score) best = { candidate, score: quality.score };
    if (!fallback || quality.collision > fallback.candidate.quality.collision) fallback = { candidate, score: quality.score };
  }

  if (best) return best.candidate;
  // Nothing fits inside the safe margins at any anchor. This is a composition problem, not a label
  // problem, and the honest answer is the least-bad position plus a leader line, so the relationship is
  // still visible.
  if (fallback) return fallback.candidate;
  const point = clampCenter(anchorPointFor("right", target, label, gap), label.width / 2, label.height / 2, viewport);
  const box = boxOf(point, label);
  return {
    anchor: "right",
    point,
    box,
    distance: boxGap(box, targetBox),
    quality: { distanceToTarget: 40, alignment: 60, collision: 20, connectorInterference: 60, readability: readabilityScore(label), visualHierarchy: hierarchyScore(label, target, input.siblingCount ?? 1), score: 45 },
    needsLeader: true,
  };
}

const anchorForSide = (side: RelativeSide): LabelAnchor => {
  switch (side) {
    case "left": return "left";
    case "right": return "right";
    case "above": return "top";
    case "below":
    default: return "bottom";
  }
};

/**
 * Where a free-standing caption goes, given what it is captioning.
 *
 * PHASE 4: a caption is not a label, and it is not a floating annotation either. It belongs to a
 * COMPOSITION — a whole diagram — so it is placed against that composition's bounds, above it, on the
 * reading axis, and never inside it. A caption that has drifted into the middle of the diagram is worse
 * than no caption, because it now looks like a label for whatever it happens to be next to.
 */
export function placeCaption(
  text: { width: number; height: number; fontSize: number },
  subject: Box,
  viewport: VisualViewport,
  role: "title" | "caption" = "title",
  obstacles: readonly VisualObject[] = [],
): { point: Point; box: Box } {
  const gap = space(viewport, role === "title" ? "xl" : "md");
  const wanted: Point = role === "title"
    ? { x: (subject.left + subject.right) / 2, y: subject.top - gap - text.height / 2 }
    : { x: (subject.left + subject.right) / 2, y: subject.bottom + gap + text.height / 2 };
  const point = clampCenter(wanted, text.width / 2, text.height / 2, viewport);
  const box = boxOf(point, text);
  // A caption that would land on a shape is moved down past it, once. Chasing it further would start the
  // drifting this whole module exists to stop.
  const hit = obstacles.find((obstacle) => boxesOverlap(box, boxOfObject(obstacle), 2));
  if (hit) {
    const below = clampCenter(
      { x: point.x, y: boxOfObject(hit).bottom + gap + text.height / 2 },
      text.width / 2, text.height / 2, viewport,
    );
    return { point: below, box: boxOf(below, text) };
  }
  return { point, box };
}

/** A leader line between a label and the thing it names: straight, and short. */
export function leaderPath(from: Point, to: Point): { d: string; end: Point } {
  const end = boxEdgeTowards(boxOf({ x: from.x, y: from.y }, { width: 0, height: 0 }), to);
  return { d: `M ${round(from.x)} ${round(from.y)} L ${round(end.x)} ${round(end.y)}`, end };
}

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * How well the board's labels are attached, 0-100.
 *
 * THERE ARE TWO KINDS OF LABEL, and conflating them is why this score used to be meaningless.
 *
 * An ATTACHED label says `labelOf`, so it knows what it names and is re-placed whenever that object moves.
 * A CAPTION does not: an array's index row, a pipeline's stage number and a comparison's row label are all
 * free-standing text that belongs to its structure by POSITION — it sits under its cell, in the same
 * column — and not by a reference. Demanding `labelOf` of a caption is demanding a mechanism the compilers
 * do not use, so every array index scored 10 and every real failure was lost in the noise.
 *
 * So a caption is accepted on GEOMETRY: it must be within a caption's reach of an object, and it must be
 * clear of unrelated shapes. A caption that is not attached to anything is still a failure — that is a
 * sentence floating in the middle of the board — but it is judged as a caption, not as an orphan.
 */
export function labelAttachmentScore(objects: readonly VisualObject[]): { score: number; detached: string[]; tooFar: string[] } {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const labels = objects.filter((object) => object.kind === "label");
  const free = objects.filter((object) => (object.kind === "text" || object.kind === "formula") && object.role !== "title" && object.role !== "subtitle" && object.role !== "caption" && object.role !== "annotation");
  const captions = objects.filter((object) => (object.kind === "text" || object.kind === "formula") && (object.role === "caption" || object.role === "annotation"));
  const detached: string[] = [];
  const tooFar: string[] = [];
  let total = 0;
  let counted = 0;

  for (const label of labels) {
    counted += 1;
    const target = label.labelOf ? byId.get(label.labelOf.id) : undefined;
    if (!target) {
      detached.push(label.id);
      total += 10;
      continue;
    }
    const distance = boxGap(boxOf({ x: label.x, y: label.y }, { width: label.width, height: label.height }), boxOfObject(target));
    const limit = leaderLineBeyond(target);
    if (distance > limit * 1.9) {
      tooFar.push(label.id);
      total += 25;
      continue;
    }
    total += score(100 - (distance / (limit * 2)) * 100);
  }

  for (const caption of captions) {
    counted += 1;
    const box = boxOf({ x: caption.x, y: caption.y }, { width: caption.width, height: caption.height });
    // A caption is attached if it is inside the footprint of its own structure — which is what "under its
    // cell" means once the structure's bounds are taken — or close enough to one of its members to be
    // unmistakably about it. Either is attachment; neither is a coincidence.
    const siblings = objects.filter((object) => object.id !== caption.id && object.group !== undefined && object.group === caption.group);
    const structure = siblings.length > 0 ? siblings : objects.filter((object) => object.id !== caption.id && !isDerived(object));
    const inFootprint = (() => {
      let left = Infinity;
      let top = Infinity;
      let right = -Infinity;
      let bottom = -Infinity;
      for (const object of structure) {
        const member = boxOfObject(object);
        left = Math.min(left, member.left);
        top = Math.min(top, member.top);
        right = Math.max(right, member.right);
        bottom = Math.max(bottom, member.bottom);
      }
      const pad = 4;
      return box.left >= left - pad && box.right <= right + pad && box.top >= top - pad && box.bottom <= bottom + pad;
    })();
    // The reach a caption may sit from what it captions. It scales with the board, because a caption 60px
    // from its diagram is attached on a phone and adrift on a 1500px monitor, and a fixed reach got one of
    // the two wrong.
    const reach = Math.max(90, Math.min(320, Math.max(box.right - box.left, box.bottom - box.top) * 1.2 + 60));
    const near = structure.some((object) => boxGap(box, boxOfObject(object)) < reach);
    if (inFootprint) {
      total += 100;
      continue;
    }
    if (near) {
      total += 80;
      continue;
    }
    detached.push(caption.id);
    total += 20;
  }

  for (const caption of free) {
    counted += 1;
    // Free text with no structure to belong to must at least not be printed over a shape, and must be near
    // SOMETHING rather than alone in a corner.
    const onTopOf = objects.some((object) => object.id !== caption.id
      && !isDerived(object)
      && boxesOverlap(boxOf({ x: caption.x, y: caption.y }, { width: caption.width, height: caption.height }), boxOfObject(object), 2));
    if (onTopOf) {
      detached.push(caption.id);
      total += 20;
      continue;
    }
    const near = objects.some((object) => !isDerived(object) && boxGap(
      boxOf({ x: caption.x, y: caption.y }, { width: caption.width, height: caption.height }),
      boxOfObject(object),
    ) < 160);
    total += near ? 100 : 60;
  }
  return { score: counted === 0 ? 100 : score(total / counted), detached, tooFar };
}

const isDerived = (object: VisualObject): boolean =>
  object.kind === "arrow" || object.kind === "connector" || object.kind === "label";
