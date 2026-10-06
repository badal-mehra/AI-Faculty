// A BOARD CAN HAVE ZERO OVERLAPS AND STILL LOOK BROKEN.
//
// PHASE 11. Every metric in this file exists because of a specific way a board can be *technically* fine
// and *visually* wrong:
//
//   * a diagram hugging the top-left corner with a third of the board empty  ->  centring, not scale
//   * five objects crowded into a 200px patch, microscope-small on a 1920 screen  ->  recomposition
//   * one enormous title with three captions under it  ->  hierarchy, not collision
//   * a wide sparse diagram letterboxed into a tall phone panel  ->  viewport shape, not size
//
// And the rule that follows from all of it: DO NOT ENLARGE CONTENT BLINDLY. A diagram blown up to fill a
// board it does not belong in is not a fixed diagram, it is a different bad one. The repair is to
// RECOMPOSE, and these metrics are what tell the engine when that is required.
import { boxOfObject, boxesOverlap, overlapArea, type Box } from "./geometry";
import { contentBox, type VisualViewport } from "./viewport";
import type { VisualObject } from "./types";

export type Occupancy = {
  /**
   * The board this was measured against, in pixels.
   *
   * Carried because balance is a question about PROPORTION and cannot be answered from normalised ratios
   * alone: a drawing 40px from the middle is a rounding difference on a 1000px board and a crash on a
   * 200px one, and a metric that cannot tell those apart is not measuring balance.
   */
  board: { width: number; height: number };
  /** Where everything is, in one box. */
  occupiedBounds: Box | null;
  occupiedArea: number;
  boardArea: number;
  /** Share of the board's width the drawing actually uses. */
  horizontalUtilization: number;
  /** Share of the board's height the drawing actually uses. */
  verticalUtilization: number;
  /** Share of the board's area the drawing's INK covers. Thin-heavy drawings read low here. */
  areaUtilization: number;
  /**
   * Share of the board's area the drawing's EXTENT covers.
   *
   * The two differ for a composition that is mostly lines: a function graph is a set of two-pixel segments
   * with real ink coverage near zero, and calling that "microscopic" is wrong — the student sees a plot
   * filling a fifth of the board. Extent is what the eye reads as "how big is this diagram", so it is the
   * measure the size checks use, while `areaUtilization` stays as the density reading.
   */
  extentUtilization: number;
  /** Where the drawing's weight sits, as a fraction of the board from 0 to 1. */
  centerOfMass: { x: number; y: number };
  /** The offset of that centre from the middle of the board, in pixels. */
  centreOffset: number;
  /** The widest gap between objects, as a share of the board. A huge one is dead space. */
  largestEmptyShare: number;
  /** The tightest cluster's area as a share of the drawing's. A small one is a pile. */
  largestDenseShare: number;
  /** How different the drawing's shape is from the board's. 1 is a perfect match. */
  shapeFit: number;
  /** The single largest object's share of the drawing's area. Above ~0.7 nothing else can be seen. */
  focusShare: number;
  /** How many separate clusters the objects fall into, and how evenly they are spread. */
  clusterCount: number;
  clusterBalance: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * How much of a thin object's height counts as "occupying" space.
 *
 * A line two pixels tall is still a visible part of the drawing, and it still takes up room. Counting its
 * literal area makes a plot, a circuit's wires and a circuit's rails all measure as empty board, which is
 * how a correctly sized graph was reported as microscopic. This is a MEASUREMENT choice, not a layout one:
 * nothing is drawn thicker, and no diagram is resized because of it.
 */
const MIN_VISIBLE_THICKNESS = 12;

/** Every way a board can be badly used, measured at once. */
export function occupancyOf(objects: readonly VisualObject[], viewport: VisualViewport): Occupancy {
  const area = contentBox(viewport);
  const boardArea = Math.max(1, area.width * area.height);
  const solids = objects.filter((object) => object.kind !== "arrow" && object.kind !== "connector");
  const boxes = (solids.length > 0 ? solids : objects).map((object) => boxOfObject(object));
  if (boxes.length === 0) {
    return {
      board: { width: area.width, height: area.height },
      occupiedBounds: null, occupiedArea: 0, boardArea,
      horizontalUtilization: 0, verticalUtilization: 0, areaUtilization: 0, extentUtilization: 0,
      centerOfMass: { x: 0.5, y: 0.5 }, centreOffset: 0,
      largestEmptyShare: 1, largestDenseShare: 0, shapeFit: 0, focusShare: 0,
      clusterCount: 0, clusterBalance: 0,
    };
  }
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  let occupiedArea = 0;
  let weightedX = 0;
  let weightedY = 0;
  let totalWeight = 0;
  let largestSingle = 0;
  for (const box of boxes) {
    left = Math.min(left, box.left);
    top = Math.min(top, box.top);
    right = Math.max(right, box.right);
    bottom = Math.max(bottom, box.bottom);
    const raw = Math.max(1, (box.right - box.left) * (box.bottom - box.top));
    // A DRAWING WEIGHT, NOT AN INK WEIGHT.
    //
    // Summing literal areas said a function graph covered 1% of a large board, and the gate then reported
    // it as microscopic — when it was a perfectly sized plot. The reason is that a plot is made of two-pixel
    // lines: its ink is almost nothing and its EXTENT is the whole frame. What the student sees is the
    // extent, and what fills the board is the extent, so a thin object is measured by the area it OCCUPIES
    // with a minimum width that represents how much of it is actually visible.
    const size = Math.max(raw, (box.right - box.left) * MIN_VISIBLE_THICKNESS);
    occupiedArea += size;
    weightedX += (box.left + box.right) / 2 * size;
    weightedY += (box.top + box.bottom) / 2 * size;
    totalWeight += size;
    largestSingle = Math.max(largestSingle, size);
  }
  const bounds: Box = { left, top, right, bottom };
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  const centerOfMass = { x: weightedX / totalWeight, y: weightedY / totalWeight };
  const boardCentre = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
  const centreOffset = Math.hypot(centerOfMass.x - boardCentre.x, centerOfMass.y - boardCentre.y);
  const drawingArea = Math.max(1, width * height);

  const gaps = largestEmptyRun(boxes, { left, top, right, bottom });
  const largestEmptyShare = gaps > 0 ? clamp01(gaps / Math.max(width, height)) : 0;
  const clusters = clusterBoxes(boxes);
  const largestDenseShare = clusters.length > 0 ? Math.max(...clusters.map((box) => ((box.right - box.left) * (box.bottom - box.top)) / drawingArea)) : 1;

  return {
    board: { width: area.width, height: area.height },
    occupiedBounds: bounds,
    occupiedArea,
    boardArea,
    horizontalUtilization: clamp01(width / area.width),
    verticalUtilization: clamp01(height / area.height),
    areaUtilization: clamp01(occupiedArea / boardArea),
    centerOfMass,
    centreOffset,
    largestEmptyShare,
    largestDenseShare,
    // How much of the board the drawing OCCUPIES, as opposed to how much of it it inks. A graph is a few
    // hundred pixels of line inside a frame the size of a fifth of the board, and it is the frame the
    // student sees.
    extentUtilization: clamp01((width / area.width) * (height / area.height)),
    // The shape of the drawing against the shape of the board. A wide diagram in a tall panel is a
    // mismatch no amount of centring fixes; this is the number that says so.
    shapeFit: clamp01(1 - Math.abs(width / height - area.width / area.height) / Math.max(2, area.width / area.height)),
    focusShare: largestSingle / drawingArea,
    clusterCount: clusters.length,
    clusterBalance: clusterBalance(clusters),
  };
}

const centreOf = (box: Box) => ({ x: (box.left + box.right) / 2, y: (box.top + box.bottom) / 2 });

/** The largest horizontal/vertical gap between the boxes, in pixels. */
/**
 * The longest stretch of EMPTY BOARD, in pixels, found by SWEEPING the drawing.
 *
 * It used to be the largest distance between any two object boxes, which is not a hole in the board — it
 * is the board. A title at the top and a plot at the bottom are 900px apart on a 1000px board, and that
 * distance is exactly what a correct composition should have, so `largestEmptyShare` was 0.9 on almost
 * every scene and the dead-space term contributed nothing while looking like it was measuring something.
 *
 * A sweep is the honest question: if a straight line across the drawing runs through empty space for a
 * long stretch, the board has a hole in it. Coarse and bounded — a fixed grid over the drawing's bounds —
 * because this runs over every scene in the fixture sweep and the answer only needs to distinguish "evenly
 * used" from "a third of it is empty".
 */
function largestEmptyRun(boxes: readonly Box[], bounds: Box): number {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (width <= 0 || height <= 0 || boxes.length === 0) return 0;
  const STEPS = 24;
  let worst = 0;
  for (let i = 0; i <= STEPS; i += 1) {
    const t = i / STEPS;
    // One horizontal sweep and one vertical sweep per step, through the drawing's own extent.
    const hy = bounds.top + height * t;
    let run = 0;
    for (let x = bounds.left; x <= bounds.right; x += Math.max(4, width / STEPS)) {
      const covered = boxes.some((box) => x >= box.left && x <= box.right && hy >= box.top && hy <= box.bottom);
      run = covered ? 0 : run + 1;
      if (run > worst) worst = run;
    }
    const vx = bounds.left + width * t;
    run = 0;
    for (let y = bounds.top; y <= bounds.bottom; y += Math.max(4, height / STEPS)) {
      const covered = boxes.some((box) => vx >= box.left && vx <= box.right && y >= box.top && y <= box.bottom);
      run = covered ? 0 : run + 1;
      if (run > worst) worst = run;
    }
  }
  // The sweep steps in whole pixels of the grid, so the run is in grid units; scale it back to pixels.
  return worst * Math.max(width, height) / STEPS;
}

/**
 * The clusters the objects actually form.
 *
 * Two objects are in the same cluster when their boxes are within a normal reading gap of one another, so
 * a title with its caption is one cluster and a distant second diagram is another. The number of clusters
 * is what distinguishes "one diagram" from "several unrelated things", and the sizes are what tells us
 * whether the board is one composition or a pile.
 */
function clusterBoxes(boxes: readonly Box[]): Box[] {
  if (boxes.length === 0) return [];
  const gapLimit = 90;
  const clusters: Box[] = [];
  const queue = [...boxes];
  while (queue.length > 0) {
    const seed = queue.shift()!;
    let current: Box = { ...seed };
    const members = [seed];
    let grew = true;
    while (grew) {
      grew = false;
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const candidate = queue[index];
        if (current.right + gapLimit >= candidate.left && candidate.right + gapLimit >= current.left
          && current.bottom + gapLimit >= candidate.top && candidate.bottom + gapLimit >= current.top) {
          current = {
            left: Math.min(current.left, candidate.left),
            top: Math.min(current.top, candidate.top),
            right: Math.max(current.right, candidate.right),
            bottom: Math.max(current.bottom, candidate.bottom),
          };
          members.push(candidate);
          queue.splice(index, 1);
          grew = true;
        }
      }
    }
    clusters.push(current);
  }
  return clusters;
}

/**
 * How evenly the clusters are sized, normalised so it does not depend on HOW MANY there are.
 *
 * The previous form was `1 - (largestShare - 1/n) * n`, which multiplies by the cluster count. That makes
 * it impossible to satisfy for a scene with more than about three clusters: to score above zero, the
 * largest cluster has to hold less than 2/n of the area, so six clusters of very different sizes score 0 no
 * matter how reasonable they are — and `evenness` carried 16 of the 100 points.
 *
 * What "even" means does not depend on the count, so neither does the measure: 0 when one cluster holds
 * everything, 1 when they are all equal.
 */
function clusterBalance(clusters: readonly Box[]): number {
  if (clusters.length <= 1) return 1;
  const areas = clusters.map((box) => Math.max(1, (box.right - box.left) * (box.bottom - box.top)));
  const total = areas.reduce((sum, value) => sum + value, 0);
  const largestShare = Math.max(...areas) / total;
  const evenShare = 1 / clusters.length;
  if (evenShare >= 1) return 1;
  return clamp01(1 - (largestShare - evenShare) / (1 - evenShare));
}

/**
 * The board's balance, 0-100.
 *
 * The components are the four ways a board is visibly unbalanced, weighted by how badly each reads:
 * a drawing shoved into one corner is the worst, a sparse-but-centred board is merely a little empty, and
 * one dominant object is only a problem when it is *both* dominant and on its own.
 */
export function balanceScore(occupancy: Occupancy): number {
  if (!occupancy.occupiedBounds) return 100;
  // THE BOARD'S SHORT SIDE IS THE UNIT. Balance is a question about PROPORTION, so it has to be measured
  // against the board and not in pixels.
  //
  // It was not, and the expression was dead rather than merely wrong: `Math.min(boardArea, 1)` clamps a
  // pixel area to 1, so the centring tolerance collapsed to a flat 40px at every size. On a 1000px-tall
  // board that forgives 2.7% of the height — so almost every drawing scored zero on the centring term,
  // which carries 34 of the 100 points, and `balanceScore` sat at 38 on boards that were perfectly
  // composed. A metric that reports "unbalanced" for a well-centred diagram is worse than no metric.
  const shortSide = Math.max(1, Math.min(occupancy.board.width, occupancy.board.height));
  // Forgiven within a fifth of the short side; zero at half of it. Both bounds are proportions, so the
  // same diagram scores the same on a phone and on a monitor.
  const centreTolerance = shortSide * 0.5;
  const centring = clamp01(1 - occupancy.centreOffset / centreTolerance);
  // Fill: using less than 55% of the SHORTER axis means the drawing has not been composed for this board.
  // The shorter axis is the one that runs out first, so it is the honest one to measure.
  const fill = clamp01(Math.min(occupancy.horizontalUtilization, occupancy.verticalUtilization) / 0.55);
  // Evenness: one object holding the board makes everything else unreadable, and vice versa.
  const evenness = occupancy.focusShare > 0.92 && occupancy.clusterCount <= 1
    ? clamp01(1 - (occupancy.focusShare - 0.92) * 8)
    : occupancy.clusterBalance;
  // Shape: a drawing whose proportions fight the board's is being letterboxed, and reads as too small.
  const shape = occupancy.shapeFit;
  // Dead space: a gap wider than a third of the drawing's own longer side means the board has a hole in it.
  const even = clamp01(1 - Math.max(0, occupancy.largestEmptyShare - 0.33) * 2);

  const score = 100 * (centring * 0.34 + fill * 0.28 + evenness * 0.16 + shape * 0.12 + even * 0.1);
  return Math.max(0, Math.min(100, Math.round(score)));
}

/** What to do about a balance problem, which is a DECISION rather than a number. */
export type BalanceAdvice = {
  /** Move the whole drawing to the middle of the board. */
  centre: boolean;
  /** The drawing is too small for this board and should be laid out larger, not blown up. */
  expand: boolean;
  /** The drawing's proportions fight the board's: re-flow it (rows to columns on a portrait board). */
  reflow: boolean;
  /** One thing has swallowed the board. */
  rebalanceClusters: boolean;
  /** There is a hole in the board worth filling or closing. */
  closeGaps: boolean;
};

export function adviseBalance(occupancy: Occupancy, viewport: VisualViewport): BalanceAdvice {
  const area = contentBox(viewport);
  return {
    centre: occupancy.centreOffset > Math.min(area.width, area.height) * 0.08,
    expand: Math.min(occupancy.horizontalUtilization, occupancy.verticalUtilization) < 0.42,
    reflow: occupancy.shapeFit < 0.55,
    rebalanceClusters: occupancy.clusterCount > 3 || occupancy.clusterBalance < 0.5,
    closeGaps: occupancy.largestEmptyShare > 0.45,
  };
}

/**
 * Move a whole drawing so its weight sits in the middle of the board.
 *
 * A pure translation: nothing is resized, re-spaced or reordered, because those are compositions and a
 * composition is not something to patch. This only fixes a drawing that is in the right place in the
 * wrong board — which is exactly what a viewport change produces, and exactly what should be answered by
 * moving it rather than rebuilding it.
 */
export function centreComposition(objects: readonly VisualObject[], occupancy: Occupancy, viewport: VisualViewport): VisualObject[] {
  if (!occupancy.occupiedBounds) return [...objects];
  const area = contentBox(viewport);
  const bounds = occupancy.occupiedBounds;
  const dx = area.left + area.width / 2 - (bounds.left + bounds.right) / 2;
  const dy = area.top + area.height / 2 - (bounds.top + bounds.bottom) / 2;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return [...objects];
  return objects.map((object) => ({
    ...object,
    x: object.x + dx,
    y: object.y + dy,
    // A motion is stated in absolute coordinates, so shifting the object has to shift its animation too or
    // the object will animate back to where it used to be.
    ...(object.motion?.fromX !== undefined ? { motion: { ...object.motion, fromX: object.motion.fromX + dx, fromY: (object.motion.fromY ?? 0) + dy, toX: (object.motion.toX ?? object.x) + dx, toY: (object.motion.toY ?? object.y) + dy } } : {}),
  }));
}

/** How much of the board a set of objects covers, used by the gate to fail a microscopic diagram. */
export function fillShare(objects: readonly VisualObject[], viewport: VisualViewport): number {
  return occupancyOf(objects, viewport).areaUtilization;
}

/** Whether two boxes overlap by more than a hair, ignoring the tolerance the collision pass uses. */
export function boxesCollide(a: Box, b: Box): boolean {
  return boxesOverlap(a, b, -1) || overlapArea(a, b) > 4;
}
