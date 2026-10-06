// EXPLICIT ALIGNMENT CONSTRAINTS.
//
// PHASE 7. A BOARD IS ALIGNED WHEN IT IS ALIGNED ON PURPOSE.
//
// Every structure in lib/visual/layout.ts happened to come out aligned — array cells share a baseline,
// comparison panels share a top edge, tree levels share a row — but none of it was stated anywhere. The
// alignment was a SIDE EFFECT of the arithmetic, which means:
//
//   * it breaks the moment a value is long enough to change a box's size, because nothing re-asserts it;
//   * it cannot be CHECKED, so a regression shows up as a picture and not as a failed assertion;
//   * and it cannot be added to a structure that did not happen to have it.
//
// So alignment is now a first-class constraint that a composition declares, a layout pass enforces, and
// the quality gate MEASURES. That last part is the important one: "the cells share a baseline" becomes a
// number on the board's quality report instead of a thing a reviewer has to squint at.
import { boxOfObject, type Box } from "./geometry";
import type { VisualObject } from "./types";

/**
 * The relationships a layout can assert between a set of objects.
 *
 * Deliberately small. Each one is a thing a reader actually notices when it is missing: cells in a row
 * that are not the same size, columns in a matrix that do not line up, a circuit whose components do not
 * sit on the schematic grid. A long tail of exotic constraints would be decoration.
 */
export type AlignmentConstraint =
  | { kind: "sameRow"; ids: string[] }
  | { kind: "sameColumn"; ids: string[] }
  | { kind: "centerX"; ids: string[] }
  | { kind: "centerY"; ids: string[] }
  | { kind: "leftEdge"; ids: string[] }
  | { kind: "rightEdge"; ids: string[] }
  | { kind: "topEdge"; ids: string[] }
  | { kind: "bottomEdge"; ids: string[] }
  | { kind: "equalWidth"; ids: string[] }
  | { kind: "equalHeight"; ids: string[] }
  | { kind: "equalGap"; ids: string[] };

const TOLERANCE = 1.5;

export type AlignmentViolation = {
  constraint: AlignmentConstraint;
  /** Ids whose position or size disagrees with the group. */
  offenders: string[];
  /** The largest disagreement, in pixels. Zero when the constraint holds. */
  drift: number;
};

const members = (ids: string[], byId: Map<string, VisualObject>): VisualObject[] =>
  ids.map((id) => byId.get(id)).filter((object): object is VisualObject => Boolean(object));

/** How far apart two numbers are, counted as zero inside the tolerance. */
const driftOf = (...values: number[]): number => {
  if (values.length < 2) return 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min <= TOLERANCE ? 0 : max - min;
};

/**
 * How far a set of objects is from satisfying one constraint.
 *
 * The number is the SPREAD, not a boolean, because "the four cells are 0.4px off" and "the four cells
 * are 40px off" are both "unaligned" and the second is a very different problem from the first.
 */
export function constraintDrift(constraint: AlignmentConstraint, byId: Map<string, VisualObject>): { drift: number; offenders: string[] } {
  const objects = members(constraint.ids, byId);
  if (objects.length < 2) return { drift: 0, offenders: [] };
  switch (constraint.kind) {
    case "sameRow":
    case "centerY": {
      const centres = objects.map((object) => object.y);
      const spread = driftOf(...centres);
      return { drift: spread, offenders: spread === 0 ? [] : objects.filter((object) => Math.abs(object.y - centres[0]) > TOLERANCE).map((object) => object.id) };
    }
    case "sameColumn":
    case "centerX": {
      const centres = objects.map((object) => object.x);
      const spread = driftOf(...centres);
      return { drift: spread, offenders: spread === 0 ? [] : objects.filter((object) => Math.abs(object.x - centres[0]) > TOLERANCE).map((object) => object.id) };
    }
    case "leftEdge": return edgeDrift(objects, "left", byId, constraint);
    case "rightEdge": return edgeDrift(objects, "right", byId, constraint);
    case "topEdge": return edgeDrift(objects, "top", byId, constraint);
    case "bottomEdge": return edgeDrift(objects, "bottom", byId, constraint);
    case "equalWidth": {
      const widths = objects.map((object) => object.width);
      const spread = driftOf(...widths);
      return { drift: spread, offenders: spread === 0 ? [] : objects.filter((object) => Math.abs(object.width - widths[0]) > TOLERANCE).map((object) => object.id) };
    }
    case "equalHeight": {
      const heights = objects.map((object) => object.height);
      const spread = driftOf(...heights);
      return { drift: spread, offenders: spread === 0 ? [] : objects.filter((object) => Math.abs(object.height - heights[0]) > TOLERANCE).map((object) => object.id) };
    }
    case "equalGap": return gapDrift(objects, byId);
  }
}

function edgeDrift(objects: VisualObject[], edge: "left" | "right" | "top" | "bottom", byId: Map<string, VisualObject>, constraint: AlignmentConstraint): { drift: number; offenders: string[] } {
  const values = objects.map((object) => {
    const box = boxOfObject(object);
    return edge === "left" ? box.left : edge === "right" ? box.right : edge === "top" ? box.top : box.bottom;
  });
  const spread = driftOf(...values);
  return {
    drift: spread,
    offenders: spread === 0 ? [] : objects.filter((_, index) => Math.abs(values[index] - values[0]) > TOLERANCE).map((object) => object.id),
  };
}

/**
 * `equalGap` means the SPACE between neighbours is the same, not that their centres are.
 *
 * It is the only constraint that has to decide a reading order first, and it is stated rather than assumed:
 * a row reads left to right on a wide board and top to bottom on a tall one, and getting that wrong makes
 * a five-stage pipeline read as a column.
 */
function gapDrift(objects: VisualObject[], byId: Map<string, VisualObject>): { drift: number; offenders: string[] } {
  if (objects.length < 3) return { drift: 0, offenders: [] };
  const row = objects.every((object) => Math.abs(object.y - objects[0].y) <= TOLERANCE);
  const key = row ? "x" : "y";
  const sorted = [...objects].sort((a, b) => (key === "x" ? a.x - b.x : a.y - b.y));
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = boxOfObject(sorted[index - 1]);
    const current = boxOfObject(sorted[index]);
    gaps.push(key === "x" ? current.left - previous.right : current.top - previous.bottom);
  }
  const spread = driftOf(...gaps);
  return { drift: spread, offenders: spread === 0 ? [] : sorted.slice(1).filter((_, index) => Math.abs(gaps[index] - gaps[0]) > TOLERANCE).map((object) => object.id) };
}

/** Every constraint the scene does not currently satisfy. */
export function findAlignmentViolations(constraints: readonly AlignmentConstraint[], objects: readonly VisualObject[]): AlignmentViolation[] {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const violations: AlignmentViolation[] = [];
  for (const constraint of constraints) {
    const { drift, offenders } = constraintDrift(constraint, byId);
    if (drift > 0) violations.push({ constraint, offenders, drift });
  }
  return violations;
}

/**
 * The board's alignment, 0-100.
 *
 * Scored as "how close is the worst offender to acceptable" rather than as a percentage of satisfied
 * constraints, because one badly broken row among six good ones is a board that looks broken, and a rule
 * that counted it as 5/6 would let it through. 3px of drift is forgiven; 40px is not.
 */
export function alignmentScore(constraints: readonly AlignmentConstraint[], objects: readonly VisualObject[]): number {
  if (constraints.length === 0) return 100;
  const byId = new Map(objects.map((object) => [object.id, object]));
  let total = 0;
  for (const constraint of constraints) {
    const { drift } = constraintDrift(constraint, byId);
    // 0px -> 100, 3px -> 100 (forgiven), 24px -> 0, and worse than 24 is simply 0.
    total += drift <= TOLERANCE ? 100 : Math.max(0, 100 - (drift - TOLERANCE) * (100 / 21));
  }
  return Math.round(total / constraints.length);
}

/**
 * The constraints a structure's own shape implies.
 *
 * This is the "strengthen the concept" part: alignment is no longer something each compiler happens to
 * produce, it is something each structure DECLARES, so it is enforced uniformly and scored uniformly.
 * A compiler that gets the arithmetic wrong now fails a constraint instead of quietly shipping a crooked
 * row.
 *
 * AN UNIDENTIFIED STRUCTURE ASSERTS NOTHING, and that is the important case rather than an omission. The
 * `default` branch used to assert `sameRow` for anything it could not classify, which meant the gate held
 * a graph plot to "all your dots are on one line" — a requirement no plot can satisfy, because the y
 * positions of the dots ARE the curve. It reported `alignmentScore: 0` on a perfectly drawn plot and took
 * the whole board's score down with it.
 *
 * A gate must not invent requirements it cannot justify. If we cannot classify a structure then we do not
 * know what its alignment contract is, and the honest answer is to assert nothing — which also makes
 * classification quality the thing that drives `alignmentScore`, exactly as it should be.
 */
export function constraintsForStructure(kind: string, ids: readonly string[]): AlignmentConstraint[] {
  const constraints: AlignmentConstraint[] = [];
  const all = [...ids];
  switch (kind) {
    case "array":
    case "pipeline":
    case "queue":
      if (all.length > 1) {
        constraints.push({ kind: "equalWidth", ids: all }, { kind: "sameRow", ids: all }, { kind: "equalHeight", ids: all });
        if (all.length > 2) constraints.push({ kind: "equalGap", ids: all });
      }
      break;
    case "stack":
      if (all.length > 1) constraints.push({ kind: "equalWidth", ids: all }, { kind: "equalHeight", ids: all });
      if (all.length > 2) constraints.push({ kind: "sameColumn", ids: all }, { kind: "equalGap", ids: all });
      break;
    case "compare":
      if (all.length > 1) constraints.push({ kind: "topEdge", ids: all });
      if (all.length > 2) {
        constraints.push({ kind: "equalWidth", ids: all }, { kind: "equalHeight", ids: all });
      }
      break;
    case "tree":
    case "graph":
    case "linked_list":
      if (all.length > 1) constraints.push({ kind: "equalWidth", ids: all }, { kind: "equalHeight", ids: all }, { kind: "sameRow", ids: all });
      break;
    case "equation_block":
    case "graph_plot":
    case "circuit":
    case "free_body_diagram":
      // One focal object or one freely-arranged diagram: there is nothing to align against, and saying so
      // is better than inventing a constraint over the axis lines, which are decoration rather than content.
      break;
    default:
      // Unclassified, and deliberately unconstrained. See the note above: inventing a contract here is how
      // a correct diagram gets reported as crooked.
      break;
  }
  return constraints;
}

/** Re-centre and re-size a set of objects so they satisfy their constraints. */
export function enforceAlignment(constraints: readonly AlignmentConstraint[], objects: VisualObject[]): VisualObject[] {
  const byId = new Map(objects.map((object) => [object.id, object]));
  const patches = new Map<string, Partial<VisualObject>>();
  const patch = (id: string, value: Partial<VisualObject>) => patches.set(id, { ...patches.get(id), ...value });

  for (const constraint of constraints) {
    const group = members(constraint.ids, byId);
    if (group.length < 2) continue;
    switch (constraint.kind) {
      case "sameRow":
      case "centerY": {
        const y = median(group.map((object) => object.y));
        for (const object of group) patch(object.id, { y });
        break;
      }
      case "sameColumn":
      case "centerX": {
        const x = median(group.map((object) => object.x));
        for (const object of group) patch(object.id, { x });
        break;
      }
      case "equalWidth": {
        const width = Math.max(...group.map((object) => object.width));
        for (const object of group) patch(object.id, { width });
        break;
      }
      case "equalHeight": {
        const height = Math.max(...group.map((object) => object.height));
        for (const object of group) patch(object.id, { height });
        break;
      }
      case "equalGap": {
        // Re-space around the group's own midpoint so re-aligning a row does not slide it across the board.
        const row = group.every((object) => Math.abs(object.y - group[0].y) <= TOLERANCE);
        const key = row ? "x" : "y";
        const sorted = [...group].sort((a, b) => (key === "x" ? a.x - b.x : a.y - b.y));
        if (sorted.length < 3) break;
        const first = boxOfObject(sorted[0]);
        const last = boxOfObject(sorted[sorted.length - 1]);
        const span = key === "x" ? last.right - first.left : last.bottom - first.top;
        const total = sorted.reduce((sum, object) => sum + (key === "x" ? object.width : object.height), 0);
        const gap = Math.max(0, (span - total) / (sorted.length - 1));
        let cursor = key === "x" ? first.left : first.top;
        for (const object of sorted) {
          if (key === "x") patch(object.id, { x: cursor + object.width / 2 });
          else patch(object.id, { y: cursor + object.height / 2 });
          cursor += (key === "x" ? object.width : object.height) + gap;
        }
        break;
      }
      default:
        break;
    }
  }
  if (patches.size === 0) return objects;
  return objects.map((object) => {
    const value = patches.get(object.id);
    return value ? { ...object, ...value } : object;
  });
}

/** The median, which is the right target when a couple of members are off and the rest are not. */
const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** The union box of a set of objects, which is what a group's "where it is" is. */
export function groupBounds(objects: readonly VisualObject[]): Box | null {
  if (objects.length === 0) return null;
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const object of objects) {
    const box = boxOfObject(object);
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
  }
  return { left, top, right, bottom };
}
