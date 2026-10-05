// DETERMINISTIC 2D LAYOUT + SEMANTIC STRUCTURE COMPILER.
//
// The teaching model says WHAT has to be shown â "an array of four cells holding 10, 20, 30, 40",
// "a stack with these three values", "a BST with these nodes and edges", "Client SYN Server" â and
// this module decides WHERE everything goes. There is no randomness anywhere: the same structure and
// the same viewport always produce the same boxes, so a replayed lesson looks identical.
//
// Every layout is built from MEASURED geometry (lib/visual/measure.ts), never from assumed 100x40
// cells, and every layout returns boxes that do not overlap by construction â which is what lets the
// engine accept them without nudging anything afterwards.
//
// A compiled structure is emitted as ORDINARY primitive actions (create_shape / create_text /
// create_arrow) with computed point placements. The scene model, the reducer and the SVG renderer are
// therefore exactly what they were: this module only decides coordinates.
import {
  CircuitElement, DIAGRAM_HEIGHT, DIAGRAM_WIDTH, ForceVector, FormulaRow, PlotPoint, StructureEdge,
  StructureMessage, StructureNode, VISUAL_MARGIN, VisualAction, VisualAnimation,
} from "./types";
import { VIEWPORT } from "./geometry";
import { heightForLabel, measureText, uniformWidthForLabels, widthForLabel } from "./measure";
import { normaliseFormula } from "./formula";

// ---------------------------------------------------------------------------------------------
// Canvas budget
// ---------------------------------------------------------------------------------------------

/** Usable area once the classroom margins around the drawing are taken off. */
const CONTENT = {
  left: VISUAL_MARGIN + 6,
  right: DIAGRAM_WIDTH - VISUAL_MARGIN - 6,
  top: VISUAL_MARGIN + 6,
  bottom: DIAGRAM_HEIGHT - VISUAL_MARGIN - 6,
};
const CONTENT_WIDTH = CONTENT.right - CONTENT.left;
const CONTENT_HEIGHT = CONTENT.bottom - CONTENT.top;
const CENTRE_X = (CONTENT.left + CONTENT.right) / 2;
const CENTRE_Y = (CONTENT.top + CONTENT.bottom) / 2;

export type Placed = { id: string; x: number; y: number; width: number; height: number };

/** Keeps a box completely on the board; a structure is never allowed to clip. */
function fitBox(box: Placed): Placed {
  const width = Math.min(box.width, VIEWPORT.width - 2 * VISUAL_MARGIN);
  const height = Math.min(box.height, VIEWPORT.height - 2 * VISUAL_MARGIN);
  return {
    id: box.id,
    width,
    height,
    x: Math.min(Math.max(box.x, CONTENT.left + width / 2), CONTENT.right - width / 2),
    y: Math.min(Math.max(box.y, CONTENT.top + height / 2), CONTENT.bottom - height / 2),
  };
}

const round2 = (value: number): number => Math.round(value * 10) / 10;

/** How many items fit on one line, and how wide that line is. */
function packLine(count: number, itemWidth: number, gap: number, maxWidth = CONTENT_WIDTH): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.min(count, Math.floor((maxWidth + gap) / (itemWidth + gap))));
}

// ---------------------------------------------------------------------------------------------
// Shared type scale
// ---------------------------------------------------------------------------------------------

const TITLE_SIZE = 21;
const BODY_SIZE = 16;
const VALUE_SIZE = 20;
const INDEX_SIZE = 13;

const withAnimate = (animate: VisualAnimation | undefined): Record<string, never> =>
  (animate ? { animate } : {}) as Record<string, never>;

/** A text action at an absolute point, with its size already measured. */
function textAction(
  id: string,
  text: string,
  x: number,
  y: number,
  role: "title" | "annotation" | "caption" | "step",
  size: number,
  mono = false,
): VisualAction {
  // The measured block is what the engine will reserve; roles are what make a title read as a title.
  measureText(text, size, CONTENT_WIDTH * 0.86, { mono, maxLines: 3 });
  return {
    action: "create_text",
    id,
    text,
    role,
    size,
    placement: { kind: "point", x: round2(x), y: round2(y) },
  };
}

/** Caption above (or below) a box â TOP / FRONT / HEAD â placed clear of the box it names. */
function caption(id: string, text: string, box: Placed, above = true): VisualAction {
  const gap = 22;
  return textAction(id, text, box.x, box.y + (above ? -(box.height / 2 + gap) : box.height / 2 + gap), "annotation", INDEX_SIZE, true);
}

/** Cell whose measured size is derived from the values it must hold. */
function valueSize(values: string[], options: { min: number; max: number; font?: number; minHeight?: number }): { width: number; height: number } {
  const font = options.font ?? VALUE_SIZE;
  const width = Math.min(options.max, Math.max(options.min, ...values.map((value) => widthForLabel(value, font, options.min, options.max))));
  const height = Math.min(132, Math.max(options.minHeight ?? 56, ...values.map((value) => heightForLabel(value, width, font))));
  return { width: Math.round(width), height: Math.round(height) };
}

// ---------------------------------------------------------------------------------------------
// ARRAY â real cells: equal size, aligned, indices, wrapped instead of shrunk
// ---------------------------------------------------------------------------------------------

export function compileArray(
  id: string,
  values: string[],
  options: { indices?: boolean; title?: string; vertical?: boolean; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  if (values.length === 0) return actions;
  const animate = withAnimate(options.animate);
  const size = valueSize(values, { min: 68, max: 190 });
  const gap = 5; // cells share their borders; a hair of space keeps each stroke readable
  const vertical = options.vertical === true;

  const perLine = vertical
    ? Math.max(1, Math.min(values.length, Math.floor((CONTENT_HEIGHT - 96) / (size.height + 46))))
    : packLine(values.length, size.width, gap);
  const lines = Math.ceil(values.length / perLine);
  const rowSpan = size.height + 46;
  const titleHeight = options.title ? 32 : 0;
  const blockHeight = lines * rowSpan - 46;
  const originY = CONTENT.top + titleHeight + blockHeight / 2;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  values.forEach((value, index) => {
    const line = Math.floor(index / perLine);
    const slot = index % perLine;
    const inLine = Math.min(perLine, values.length - line * perLine);
    const span = inLine * size.width + (inLine - 1) * gap;
    const box = fitBox({
      id: `${id}-c${index}`,
      x: vertical ? CENTRE_X : CENTRE_X - span / 2 + size.width / 2 + slot * (size.width + gap),
      y: vertical
        ? originY - blockHeight / 2 + line * rowSpan + size.height / 2
        : originY,
      width: size.width,
      height: size.height,
    });
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rectangle",
      semantic: "data",
      role: "primary",
      text: value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
    if (options.indices !== false) {
      actions.push(textAction(`${id}-i${index}`, String(index), box.x, box.y + box.height / 2 + 19, "caption", INDEX_SIZE, true));
    }
  });
  return actions;
}

/** Which cells changed between two array contents: used to turn a re-layout into moves. */
export function diffArray(previous: string[], next: string[]): { moved: Array<{ from: number; to: number }>; removed: number[]; added: number[] } {
  const remaining = [...previous];
  const moved: Array<{ from: number; to: number }> = [];
  const added: number[] = [];
  next.forEach((value, index) => {
    const at = remaining.indexOf(value);
    if (at === -1) {
      added.push(index);
      return;
    }
    remaining.splice(at, 1);
    if (at !== index) moved.push({ from: at, to: index });
  });
  return { moved, removed: remaining.map((_, index) => index), added };
}

// ---------------------------------------------------------------------------------------------
// LINKED LIST â `value | next` compartments, arrows out of the pointer compartment
// ---------------------------------------------------------------------------------------------

const NODE_WIDTH_MIN = 136;
const NODE_HEIGHT = 66;

export function compileLinkedList(
  id: string,
  nodes: StructureNode[],
  options: { head?: string; tail?: boolean; doubly?: boolean; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  if (nodes.length === 0) return actions;
  const animate = withAnimate(options.animate);
  const nodeWidth = Math.min(230, Math.max(
    NODE_WIDTH_MIN,
    ...nodes.map((node) => widthForLabel(node.value, VALUE_SIZE, NODE_WIDTH_MIN - 46, 190) + 46),
  ));
  const gap = 86; // arrow + lane + the NULL terminator label all need real room

  const perLine = packLine(nodes.length, nodeWidth, gap);
  const lines = Math.ceil(nodes.length / perLine);
  const rowSpan = NODE_HEIGHT + 58;
  const titleHeight = options.title ? 32 : 0;
  const blockHeight = lines * rowSpan - 58;
  const originY = CONTENT.top + titleHeight + blockHeight / 2;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  const boxes: Placed[] = [];
  nodes.forEach((node, index) => {
    const line = Math.floor(index / perLine);
    const slot = index % perLine;
    const inLine = Math.min(perLine, nodes.length - line * perLine);
    const span = inLine * nodeWidth + (inLine - 1) * gap;
    const box = fitBox({
      id: `${id}-${node.id}`,
      x: CENTRE_X - span / 2 + nodeWidth / 2 + slot * (nodeWidth + gap),
      y: originY - blockHeight / 2 + line * rowSpan + NODE_HEIGHT / 2,
      width: nodeWidth,
      height: NODE_HEIGHT,
    });
    boxes.push(box);
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rounded_rectangle",
      semantic: "node",
      role: "primary",
      text: node.value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
    if (node.sub) {
      actions.push(textAction(`${id}-${node.id}-sub`, node.sub, box.x, box.y + NODE_HEIGHT / 2 + 19, "caption", INDEX_SIZE));
    }
  });

  // Next pointers: drawn out of the pointer compartment into the next node's value side.
  for (let index = 0; index + 1 < boxes.length; index += 1) {
    actions.push({
      action: "create_arrow",
      id: `${id}-e${index}`,
      from: boxes[index].id,
      to: boxes[index + 1].id,
      kind: "next_pointer",
      ...animate,
    });
  }

  const headIndex = options.head
    ? Math.max(0, nodes.findIndex((node) => `${id}-${node.id}` === options.head))
    : 0;
  const headBox = boxes[headIndex];
  if (headBox) {
    const headId = `${id}-head`;
    actions.push({ action: "create_text", id: headId, text: "HEAD", role: "annotation", size: INDEX_SIZE, placement: { kind: "point", x: round2(headBox.x), y: round2(headBox.y - headBox.height / 2 - 22) } });
    actions.push({ action: "create_arrow", id: `${id}-head-link`, from: headId, to: headBox.id, kind: "pointer", ...animate });
  }

  if (options.tail !== false && boxes.length > 0) {
    const last = boxes[boxes.length - 1];
    const nullId = `${id}-null`;
    actions.push({ action: "create_text", id: nullId, text: "NULL", role: "annotation", size: INDEX_SIZE, placement: { kind: "point", x: round2(last.x + last.width / 2 + 48), y: round2(last.y) } });
    actions.push({ action: "create_arrow", id: `${id}-null-link`, from: last.id, to: nullId, kind: "next_pointer", ...animate });
  }

  if (options.doubly) {
    for (let index = boxes.length - 1; index > 0; index -= 1) {
      actions.push({
        action: "create_arrow",
        id: `${id}-p${index}`,
        from: boxes[index].id,
        to: boxes[index - 1].id,
        kind: "dashed",
        label: "prev",
        offset: 26,
        ...animate,
      });
    }
  }
  return actions;
}

// ---------------------------------------------------------------------------------------------
// STACK â reads top-down from its live end
// ---------------------------------------------------------------------------------------------

export function compileStack(
  id: string,
  values: string[],
  options: { topLabel?: string; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  const size = valueSize(values, { min: 150, max: 250, minHeight: 52 });
  const titleHeight = options.title ? 32 : 0;
  const topLabelHeight = 30;
  const topY = CONTENT.top + titleHeight + topLabelHeight;
  const firstRow = topY + size.height / 2;
  const lastRow = firstRow + Math.max(0, values.length - 1) * size.height;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // The frame is centred on the CELLS' own extent with equal padding above and below. Centring it on the
  // block instead would push the frame off the bottom of the column and leave the top row unclad.
  actions.push({
    action: "create_container",
    id: `${id}-frame`,
    width: size.width + 24,
    height: Math.round(lastRow - firstRow + size.height + 26),
    placement: { kind: "point", x: round2(CENTRE_X), y: round2((firstRow + lastRow) / 2) },
    role: "secondary",
    ...animate,
  });

  values.forEach((value, index) => {
    const box = fitBox({ id: `${id}-s${index}`, x: CENTRE_X, y: topY + size.height / 2 + index * size.height, width: size.width, height: size.height });
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rectangle",
      semantic: "data",
      role: "primary",
      text: value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  if (values.length > 0) {
    const topBox = fitBox({ id: `${id}-top`, x: CENTRE_X, y: topY, width: size.width, height: size.height });
    actions.push(caption(`${id}-top-label`, options.topLabel ?? "TOP", topBox, true));
    actions.push({ action: "create_arrow", id: `${id}-top-link`, from: `${id}-top-label`, to: topBox.id, kind: "pointer", ...animate });
  }
  return actions;
}

// ---------------------------------------------------------------------------------------------
// QUEUE â FRONT on the left, REAR on the right, cells in one row
// ---------------------------------------------------------------------------------------------

export function compileQueue(
  id: string,
  values: string[],
  options: { frontLabel?: string; rearLabel?: string; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  const size = valueSize(values, { min: 76, max: 180, minHeight: 60 });
  const gap = 6;
  const perLine = packLine(values.length, size.width, gap);
  const lines = Math.ceil(values.length / perLine);
  const rowSpan = size.height + 50;
  const titleHeight = options.title ? 32 : 0;
  const blockHeight = lines * rowSpan - 50;
  const originY = CONTENT.top + titleHeight + blockHeight / 2 + 10;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  const boxes: Placed[] = [];
  values.forEach((value, index) => {
    const line = Math.floor(index / perLine);
    const slot = index % perLine;
    const inLine = Math.min(perLine, values.length - line * perLine);
    const span = inLine * size.width + (inLine - 1) * gap;
    const box = fitBox({
      id: `${id}-q${index}`,
      x: CENTRE_X - span / 2 + size.width / 2 + slot * (size.width + gap),
      y: originY - blockHeight / 2 + line * rowSpan + size.height / 2,
      width: size.width,
      height: size.height,
    });
    boxes.push(box);
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rectangle",
      semantic: "data",
      role: "primary",
      text: value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  if (boxes.length > 0) {
    actions.push(caption(`${id}-front`, options.frontLabel ?? "FRONT", boxes[0], true));
    actions.push(caption(`${id}-rear`, options.rearLabel ?? "REAR", boxes[boxes.length - 1], true));
  }
  return actions;
}

// ---------------------------------------------------------------------------------------------
// TREE â tidy layered layout: every parent centred over its children, siblings evenly spaced
// ---------------------------------------------------------------------------------------------

type TidyResult = { boxes: Placed[]; level: Map<string, number> };

export function layoutTree(nodes: StructureNode[], edges: StructureEdge[], levelGap = 84): TidyResult {
  const present = new Set(nodes.map((node) => node.id));
  const children = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of edges) {
    if (!present.has(edge.from) || !present.has(edge.to) || edge.from === edge.to) continue;
    children.set(edge.from, [...(children.get(edge.from) ?? []), edge.to]);
    hasParent.add(edge.to);
  }
  const roots = nodes.filter((node) => !hasParent.has(node.id)).map((node) => node.id);

  const size = valueSize(nodes.map((node) => node.value), { min: 66, max: 168, minHeight: 56 });
  const siblingGap = 34;
  const span = new Map<string, number>();
  const level = new Map<string, number>();
  const guard = new Set<string>();

  const measureWidth = (id: string): number => {
    if (span.has(id)) return span.get(id)!;
    if (guard.has(id)) return size.width; // a cycle cannot make the layout infinite
    guard.add(id);
    const kids = children.get(id) ?? [];
    const width = kids.length === 0
      ? size.width
      : kids.reduce((total, kid, index) => total + measureWidth(kid) + (index < kids.length - 1 ? siblingGap : 0), 0);
    guard.delete(id);
    span.set(id, width);
    return width;
  };
  roots.forEach((root) => measureWidth(root));

  const centres = new Map<string, number>();
  const place = (id: string, left: number, depth: number): void => {
    level.set(id, depth);
    const width = span.get(id) ?? size.width;
    const kids = children.get(id) ?? [];
    if (kids.length === 0) {
      centres.set(id, left + width / 2);
      return;
    }
    let cursor = left;
    for (const kid of kids) {
      place(kid, cursor, depth + 1);
      cursor += (span.get(kid) ?? size.width) + siblingGap;
    }
    centres.set(id, ((centres.get(kids[0]) ?? left) + (centres.get(kids[kids.length - 1]) ?? left)) / 2);
  };
  let cursor = 0;
  for (const root of roots) {
    place(root, cursor, 0);
    cursor += (span.get(root) ?? size.width) + siblingGap * 2;
  }
  for (const node of nodes) if (!centres.has(node.id)) centres.set(node.id, size.width / 2);

  const rawLefts = [...centres.values()].map((centre) => centre - size.width / 2);
  const rawRights = [...centres.values()].map((centre) => centre + size.width / 2);
  const minLeft = Math.min(...rawLefts);
  const maxRight = Math.max(...rawRights);
  const totalWidth = maxRight - minLeft;
  const scale = totalWidth > CONTENT_WIDTH - 24 ? (CONTENT_WIDTH - 24) / totalWidth : 1;
  const offsetX = CONTENT.left + (CONTENT_WIDTH - totalWidth * scale) / 2 - minLeft * scale;

  const maxLevel = nodes.length === 0 ? 0 : Math.max(...[...level.values()]);
  const totalHeight = maxLevel * levelGap;
  const offsetY = Math.max(CONTENT.top + 34 + size.height / 2, CENTRE_Y - totalHeight / 2);

  const boxes = nodes.map((node) => fitBox({
    id: node.id,
    x: (centres.get(node.id) ?? 0) * scale + offsetX,
    y: offsetY + (level.get(node.id) ?? 0) * levelGap,
    width: size.width,
    height: size.height,
  }));
  return { boxes, level };
}

export function compileTree(
  id: string,
  nodes: StructureNode[],
  edges: StructureEdge[],
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  const named = nodes.map((node) => ({ ...node, id: `${id}-${node.id}` }));
  const namedEdges: StructureEdge[] = edges.map((edge) => ({ ...edge, from: `${id}-${edge.from}`, to: `${id}-${edge.to}` }));
  const { boxes } = layoutTree(named, namedEdges);
  const byId = new Map(boxes.map((box) => [box.id, box]));

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // Nodes are emitted BEFORE their edges, because an arrow needs both endpoints to exist. Paint order
  // is not creation order: the renderer always draws connections beneath nodes, so the tail of an
  // arrow disappears under the node it belongs to.
  named.forEach((node) => {
    const box = byId.get(node.id);
    if (!box) return;
    actions.push({
      action: "create_shape",
      id: node.id,
      shape: "circle",
      semantic: "node",
      role: "primary",
      text: node.value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  namedEdges.forEach((edge, index) => {
    if (!byId.has(edge.from) || !byId.has(edge.to)) return;
    actions.push({
      action: "create_arrow",
      id: `${id}-edge${index}`,
      from: edge.from,
      to: edge.to,
      kind: "parent_child",
      ...(edge.label ? { label: edge.label } : {}),
      ...animate,
    });
  });
  return actions;
}

// ---------------------------------------------------------------------------------------------
// GRAPH â grid / circle / layered, all deterministic
// ---------------------------------------------------------------------------------------------

function placeGraphNodes(
  nodes: StructureNode[],
  edges: StructureEdge[],
  mode: "grid" | "circle" | "layered",
  size: { width: number; height: number },
  topInset: number,
): Map<string, Placed> {
  const boxes = new Map<string, Placed>();
  const top = CONTENT.top + topInset;
  const usableWidth = CONTENT_WIDTH - 24;
  const usableHeight = CONTENT.bottom - top - 16;

  if (mode === "circle") {
    const radius = Math.max(60, Math.min(usableWidth, usableHeight) / 2 - Math.max(size.width, size.height) / 2);
    const centre = { x: CENTRE_X, y: top + usableHeight / 2 };
    nodes.forEach((node, index) => {
      const angle = -Math.PI / 2 + (index / nodes.length) * Math.PI * 2;
      boxes.set(node.id, fitBox({
        id: node.id,
        x: centre.x + Math.cos(angle) * radius,
        y: centre.y + Math.sin(angle) * radius,
        width: size.width,
        height: size.height,
      }));
    });
    return boxes;
  }

  // Longest-path layering keeps a tree-like graph readable and is stable under re-runs.
  const parents = new Map<string, string[]>();
  const hasParent = new Set<string>();
  const present = new Set(nodes.map((node) => node.id));
  for (const edge of edges) {
    if (!present.has(edge.from) || !present.has(edge.to) || edge.from === edge.to) continue;
    parents.set(edge.to, [...(parents.get(edge.to) ?? []), edge.from]);
    hasParent.add(edge.to);
  }
  const level = new Map<string, number>();
  const depthOf = (id: string, guard: Set<string>): number => {
    if (level.has(id)) return level.get(id)!;
    if (guard.has(id)) return 0;
    guard.add(id);
    const value = (parents.get(id) ?? []).length === 0 ? 0 : Math.max(...(parents.get(id) ?? []).map((parent) => depthOf(parent, guard))) + 1;
    guard.delete(id);
    level.set(id, value);
    return value;
  };
  nodes.forEach((node) => depthOf(node.id, new Set()));

  if (mode === "layered") {
    const columns = new Map<number, string[]>();
    for (const node of nodes) {
      const value = level.get(node.id) ?? 0;
      columns.set(value, [...(columns.get(value) ?? []), node.id]);
    }
    const entries = [...columns.entries()].sort((a, b) => a[0] - b[0]);
    const columnGap = usableWidth / Math.max(1, entries.length);
    const maxInColumn = Math.max(...entries.map(([, members]) => members.length));
    const rowGap = Math.min(76, (usableHeight - size.height) / Math.max(1, maxInColumn - 1) || 40);
    for (const [value, members] of entries) {
      const x = CONTENT.left + 12 + columnGap * (value + 0.5);
      const span = members.length * size.height + (members.length - 1) * rowGap;
      members.forEach((nodeId, index) => {
        boxes.set(nodeId, fitBox({
          id: nodeId,
          x,
          y: top + usableHeight / 2 - span / 2 + size.height / 2 + index * (size.height + rowGap),
          width: size.width,
          height: size.height,
        }));
      });
    }
    return boxes;
  }

  // Grid: row-major, centred, deterministic spacing that always clears the node size.
  const perRow = Math.max(1, Math.min(nodes.length, Math.ceil(Math.sqrt(nodes.length * 1.7))));
  const gapX = Math.max(30, Math.min(96, (usableWidth - perRow * size.width) / Math.max(1, perRow - 1)));
  const gapY = Math.max(46, Math.min(96, (usableHeight - size.height) / Math.max(1, Math.ceil(nodes.length / perRow) - 1) || 46));
  const rows = Math.ceil(nodes.length / perRow);
  const spanY = rows * size.height + (rows - 1) * gapY;
  nodes.forEach((node, index) => {
    const row = Math.floor(index / perRow);
    const slot = index % perRow;
    const inRow = Math.min(perRow, nodes.length - row * perRow);
    const rowSpan = inRow * size.width + (inRow - 1) * gapX;
    boxes.set(node.id, fitBox({
      id: node.id,
      x: CENTRE_X - rowSpan / 2 + size.width / 2 + slot * (size.width + gapX),
      y: top + usableHeight / 2 - spanY / 2 + size.height / 2 + row * (size.height + gapY),
      width: size.width,
      height: size.height,
    }));
  });
  return boxes;
}

export function compileGraph(
  id: string,
  nodes: StructureNode[],
  edges: StructureEdge[],
  options: { layout?: "grid" | "circle" | "layered"; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  if (nodes.length === 0) return actions;
  const size = valueSize(nodes.map((node) => node.value), { min: 66, max: 170, minHeight: 58 });
  const named = nodes.map((node) => ({ ...node, id: `${id}-${node.id}` }));
  const namedEdges: StructureEdge[] = edges.map((edge) => ({ ...edge, from: `${id}-${edge.from}`, to: `${id}-${edge.to}` }));
  const boxes = placeGraphNodes(named, namedEdges, options.layout ?? "grid", size, options.title ? 34 : 8);
  const known = new Set(named.map((node) => node.id));

if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // Nodes before edges (an arrow needs both endpoints to exist); the renderer paints edges underneath.
  named.forEach((node) => {
    const box = boxes.get(node.id);
    if (!box) return;
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: node.value.length <= 2 ? "circle" : "rounded_rectangle",
      semantic: "node",
      role: "primary",
      text: node.value,
      fontSize: VALUE_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  namedEdges.forEach((edge, index) => {
    if (!known.has(edge.from) || !known.has(edge.to) || edge.from === edge.to) return;
    actions.push({
      action: "create_arrow",
      id: `${id}-edge${index}`,
      from: edge.from,
      to: edge.to,
      kind: "straight",
      ...(edge.dashed ? { style: "dashed" as const } : {}),
      ...(edge.label ? { label: edge.label } : {}),
      ...animate,
    });
  });
  return actions;
}

// ---------------------------------------------------------------------------------------------
// SEQUENCE â lifelines and one message per row, exactly like a protocol trace
// ---------------------------------------------------------------------------------------------

export function compileSequence(
  id: string,
  actors: string[],
  messages: StructureMessage[],
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  if (actors.length === 0) return actions;
  const actorWidth = uniformWidthForLabels(actors, BODY_SIZE, 124, 200);
  const actorHeight = 52;
  const rowHeight = 58;
  const gap = Math.max(40, Math.min(150, (CONTENT_WIDTH - actors.length * actorWidth) / Math.max(1, actors.length - 1)));
  const span = actors.length * actorWidth + (actors.length - 1) * gap;
  const originX = CENTRE_X - span / 2 + actorWidth / 2;
  const topY = CONTENT.top + (options.title ? 34 : 8) + actorHeight / 2;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  const boxes: Placed[] = [];
  actors.forEach((actor, index) => {
    const box = fitBox({ id: `${id}-a${index}`, x: originX + index * (actorWidth + gap), y: topY, width: actorWidth, height: actorHeight });
    boxes.push(box);
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rounded_rectangle",
      semantic: "actor",
      role: "primary",
      text: actor,
      fontSize: BODY_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  const nameToBox = new Map(actors.map((actor, index) => [actor, boxes[index]]));

  // A message does NOT run from actor box to actor box: it runs between their LIFELINES, at its own row.
  // That is what keeps every arrow attached to something â the lifeline it crosses â instead of
  // floating below the actor boxes, and it is what makes row N of the trace land on row N.
  //
  // The lifelines are FULL-HEIGHT and therefore STABLE: their size must not depend on how many messages
  // have been sent yet, because the lane offset that places message N on row N is measured from the
  // lifeline's centre. A lifeline that grew with the trace would leave every earlier row misaligned.
  const firstRow = topY + actorHeight / 2 + 34;
  const rowLimit = CONTENT.bottom - 16;
  const visible = messages.filter((message, index) => {
    const fromBox = nameToBox.get(message.from);
    const toBox = nameToBox.get(message.to);
    return Boolean(fromBox && toBox && message.from !== message.to) && firstRow + index * rowHeight <= rowLimit;
  });
  const lifelineTop = topY + actorHeight / 2 + 6;
  const lifelineHeight = Math.max(40, rowLimit - lifelineTop);
  const lifelineCentre = lifelineTop + lifelineHeight / 2;

  boxes.forEach((box, index) => {
    actions.push({
      action: "create_container",
      id: `${id}-life${index}`,
      width: 3,
      height: Math.round(lifelineHeight),
      placement: { kind: "point", x: round2(box.x), y: round2(lifelineCentre) },
      role: "annotation",
      ...animate,
    });
  });

  const rows: VisualAction[] = [];
  visible.forEach((message, index) => {
    const fromIndex = actors.indexOf(message.from);
    const toIndex = actors.indexOf(message.to);
    const fromBox = boxes[fromIndex];
    const toBox = boxes[toIndex];
    const rowY = firstRow + index * rowHeight;
    // A lane offset shifts the endpoint perpendicular to the connection; since the lifelines are vertical
    // and the connection is horizontal, this lands the endpoint exactly on the lifeline at row Y.
    const direction = Math.sign(toBox.x - fromBox.x) || 1;
    rows.push({
      action: "create_arrow",
      id: `${id}-m${index}`,
      from: `${id}-life${fromIndex}`,
      to: `${id}-life${toIndex}`,
      kind: "straight",
      offset: round2((rowY - lifelineCentre) * direction),
      ...(message.label ? { label: message.label } : {}),
      ...(message.dashed ? { style: "dashed" as const } : {}),
      ...animate,
    });
  });
  actions.push(...rows);
  return actions;
}

// ---------------------------------------------------------------------------------------------
// PIPELINE â a row of stages that wraps; arrows only between neighbours on the same line
// ---------------------------------------------------------------------------------------------

export function compilePipeline(
  id: string,
  stages: string[],
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  if (stages.length === 0) return actions;
  // Sibling stages share ONE measured width, so "Write Back" sits on one line exactly like "Execute"
  // instead of being the only box that wrapped.
  const stageWidth = uniformWidthForLabels(stages, BODY_SIZE, 100, 180);
  const stageHeight = 66;
  const gap = 34;
  const perLine = packLine(stages.length, stageWidth, gap);
  const lines = Math.ceil(stages.length / perLine);
  const rowSpan = stageHeight + 54;
  const titleHeight = options.title ? 32 : 0;
  const blockHeight = lines * rowSpan - 54;
  const originY = CONTENT.top + titleHeight + blockHeight / 2 + 10;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  const boxes: Placed[] = [];
  stages.forEach((stage, index) => {
    const line = Math.floor(index / perLine);
    const slot = index % perLine;
    const inLine = Math.min(perLine, stages.length - line * perLine);
    const span = inLine * stageWidth + (inLine - 1) * gap;
    const box = fitBox({
      id: `${id}-p${index}`,
      x: CENTRE_X - span / 2 + stageWidth / 2 + slot * (stageWidth + gap),
      y: originY - blockHeight / 2 + line * rowSpan + stageHeight / 2,
      width: stageWidth,
      height: stageHeight,
    });
    boxes.push(box);
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rounded_rectangle",
      semantic: "process",
      role: "primary",
      text: stage,
      fontSize: BODY_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
  });

  for (let index = 0; index + 1 < boxes.length; index += 1) {
    // A wrap is not a data flow, so only same-line neighbours are connected.
    if (Math.abs(boxes[index].y - boxes[index + 1].y) > 2) continue;
    actions.push({ action: "create_arrow", id: `${id}-pa${index}`, from: boxes[index].id, to: boxes[index + 1].id, kind: "flow", ...animate });
  }
  return actions;
}

// ---------------------------------------------------------------------------------------------
// TIMELINE â an axis with evenly spaced events, alternating above and below
// ---------------------------------------------------------------------------------------------

export function compileTimeline(
  id: string,
  events: Array<{ label: string; text: string }>,
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  if (events.length === 0) return actions;
  const top = CONTENT.top + (options.title ? 40 : 12);
  const axisY = top + 118;
  const step = CONTENT_WIDTH / events.length;
  const boxWidth = Math.min(176, Math.max(92, step - 14));
  const boxHeight = 64;
  const marker = 16;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));
  actions.push({
    action: "create_shape",
    id: `${id}-axis`,
    shape: "line",
    role: "annotation",
    width: CONTENT_WIDTH,
    height: 4,
    placement: { kind: "point", x: round2(CENTRE_X), y: round2(axisY) },
    ...animate,
  });

  events.forEach((event, index) => {
    const x = CONTENT.left + step * (index + 0.5);
    const above = index % 2 === 0;
    actions.push({
      action: "create_shape",
      id: `${id}-d${index}`,
      shape: "circle",
      semantic: "state",
      role: "secondary",
      width: marker,
      height: marker,
      placement: { kind: "point", x: round2(x), y: round2(axisY) },
      ...animate,
    });
    const box = fitBox({
      id: `${id}-e${index}`,
      x,
      y: axisY + (above ? -(marker / 2 + 24 + boxHeight / 2) : marker / 2 + 24 + boxHeight / 2),
      width: boxWidth,
      height: boxHeight,
    });
    actions.push({
      action: "create_shape",
      id: box.id,
      shape: "rounded_rectangle",
      semantic: "state",
      role: "primary",
      text: event.text,
      fontSize: BODY_SIZE,
      width: box.width,
      height: box.height,
      placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
      ...animate,
    });
    actions.push(textAction(`${id}-l${index}`, event.label, box.x, box.y + (above ? boxHeight / 2 + 16 : -(boxHeight / 2 + 16)), "caption", INDEX_SIZE, true));
    actions.push({ action: "create_arrow", id: `${id}-link${index}`, from: `${id}-d${index}`, to: box.id, kind: "straight", ...animate });
  });
  return actions;
}

// ---------------------------------------------------------------------------------------------
// COMPARE â two measured columns under one title
// ---------------------------------------------------------------------------------------------

export function compileCompare(
  id: string,
  left: { title: string; items: string[] },
  right: { title: string; items: string[] },
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const animate = withAnimate(options.animate);
  const columnGap = 36;
  const columnWidth = Math.round((CONTENT_WIDTH - columnGap) / 2);
  const titleHeight = options.title ? 34 : 0;
  const top = CONTENT.top + titleHeight + 18;
  const headerHeight = 46;
  const rowHeight = 44;
  const rows = Math.max(left.items.length, right.items.length, 1);

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  const panels: Array<{ key: string; panel: { title: string; items: string[] }; centre: number }> = [
    { key: "l", panel: left, centre: CONTENT.left + columnWidth / 2 },
    { key: "r", panel: right, centre: CONTENT.left + columnWidth + columnGap + columnWidth / 2 },
  ];
  for (const { key, panel, centre } of panels) {
    const frameHeight = headerHeight + rows * rowHeight + 14;
    if (top + frameHeight > CONTENT.bottom) break;
    actions.push({
      action: "create_container",
      id: `${id}-${key}-frame`,
      width: columnWidth,
      height: frameHeight,
      placement: { kind: "point", x: round2(centre), y: round2(top + frameHeight / 2) },
      role: "secondary",
      ...animate,
    });
    actions.push({
      action: "create_shape",
      id: `${id}-${key}-head`,
      shape: "rounded_rectangle",
      semantic: "component",
      role: "primary",
      text: panel.title,
      fontSize: BODY_SIZE,
      width: columnWidth - 22,
      height: headerHeight - 10,
      placement: { kind: "point", x: round2(centre), y: round2(top + (headerHeight - 10) / 2 + 6) },
      ...animate,
    });
    panel.items.forEach((item, index) => {
      const box = fitBox({
        id: `${id}-${key}-r${index}`,
        x: centre,
        y: top + headerHeight + 12 + index * rowHeight,
        width: columnWidth - 36,
        height: rowHeight - 10,
      });
      actions.push({
        action: "create_shape",
        id: box.id,
        shape: "rounded_rectangle",
        semantic: "note",
        role: "secondary",
        text: item,
        fontSize: BODY_SIZE,
        width: box.width,
        height: box.height,
        placement: { kind: "point", x: round2(box.x), y: round2(box.y) },
        ...animate,
      });
    });
  }
  return actions;
}

// ---------------------------------------------------------------------------------------------
// Public compiler
// ---------------------------------------------------------------------------------------------

/**
 * Compiles one semantic structure action into primitive actions with deterministic coordinates.
 * Returns null when the action is not a structure, so the caller passes it straight through.
 * `update_array` returns null on purpose: it needs the LIVE scene to turn a change into moves, so the
 * engine handles it where the current objects are known.
 */
/**
 * Stamps every compiled action with the structure it belongs to.
 *
 * The lifecycle retires by GROUP, and a structure compiles into dozens of primitives whose ids encode
 * their own suffix scheme. Only the compiler knows that scheme, so it is the compiler that says which
 * objects are one thing — anything else would have to guess from strings.
 */
function inGroup(actions: VisualAction[], group: string): VisualAction[] {
  return actions.map((entry) => ({ ...entry, group })) as VisualAction[];
}

export function compileStructure(action: VisualAction): VisualAction[] | null {
  const compiled = compileStructureParts(action);
  const id = (action as unknown as { id?: unknown }).id;
  return compiled === null || typeof id !== "string" ? compiled : inGroup(compiled, id);
}

function compileStructureParts(action: VisualAction): VisualAction[] | null {
  switch (action.action) {
    case "create_array":
      return compileArray(action.id, action.values, {
        ...(action.indices !== undefined ? { indices: action.indices } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.vertical !== undefined ? { vertical: action.vertical } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_linked_list":
      return compileLinkedList(action.id, action.nodes, {
        ...(action.head ? { head: `${action.id}-${action.head}` } : {}),
        ...(action.tail !== undefined ? { tail: action.tail } : {}),
        ...(action.doubly !== undefined ? { doubly: action.doubly } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_stack":
      return compileStack(action.id, action.values, {
        ...(action.topLabel ? { topLabel: action.topLabel } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_queue":
      return compileQueue(action.id, action.values, {
        ...(action.frontLabel ? { frontLabel: action.frontLabel } : {}),
        ...(action.rearLabel ? { rearLabel: action.rearLabel } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_tree":
      return compileTree(action.id, action.nodes, action.edges, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_graph":
      return compileGraph(action.id, action.nodes, action.edges, {
        ...(action.layout ? { layout: action.layout } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_sequence":
      return compileSequence(action.id, action.actors, action.messages, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_pipeline":
      return compilePipeline(action.id, action.stages, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_timeline":
      return compileTimeline(action.id, action.events, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
case "create_compare":
      return compileCompare(action.id, action.left, action.right, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_equation_block":
      return compileEquationBlock(action.id, action.formula, action.variables ?? [], {
        ...(action.calculates ? { calculates: action.calculates } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_free_body_diagram":
      return compileFreeBodyDiagram(action.id, action.body, action.forces, action.motion, {
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_circuit":
      return compileCircuit(action.id, action.elements, {
        ...(action.current !== undefined ? { current: action.current } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    case "create_graph_plot":
      return compileGraphPlot(action.id, action.points, {
        ...(action.xLabel ? { xLabel: action.xLabel } : {}),
        ...(action.yLabel ? { yLabel: action.yLabel } : {}),
        ...(action.shape ? { shape: action.shape } : {}),
        ...(action.guide ? { guide: action.guide } : {}),
        ...(action.title ? { title: action.title } : {}),
        ...(action.animate ? { animate: action.animate } : {}),
      });
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------------------------
// EQUATION BLOCK — a formula with its symbols named
// ---------------------------------------------------------------------------------------------

const FORMULA_SIZE = 26;

/**
 * The formula, set large, with its symbols explained beneath it.
 *
 * This is the answer to "F = ma appeared and nothing was learned". `write_formula` draws a formula as a
 * line of text; it cannot show that F is a force in newtons, and it cannot be pointed at afterwards. So
 * an equation block is the formula plus a symbol table, and each symbol row is its own addressable
 * object (`<id>-v0`, `<id>-v1`, …) so a later step can highlight the ONE symbol it is explaining rather
 * than re-drawing the whole thing.
 *
 * Symbol rows are capped and measured, so a formula with nine symbols becomes a real table instead of a
 * column of overflow.
 */
function compileEquationBlock(
  id: string,
  formula: string,
  variables: FormulaRow[],
  options: { calculates?: string; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const rows = variables.slice(0, EQUATION_MAX_ROWS);
  // Set the formula the way a BOARD sets it. A real continuity lesson rendered
  // `\lim_{x \to a} f(x) = f(a)` and `RC \frac{dv}{dt} + v = V_s` verbatim, which is correct mathematics
  // and unreadable to the student it is meant to teach. The notation is normalised here, at the one place
  // that decides what the board shows, so every other caller gets it for free.
  const display = normaliseFormula(formula);
  const formulaHeight = 62;
  const rowHeight = 26;
  const tableHeight = rows.length > 0 ? rows.length * rowHeight + 12 : 0;
  const calculatesHeight = options.calculates ? 30 : 0;
  const titleHeight = options.title ? 32 : 0;
  const totalHeight = titleHeight + formulaHeight + calculatesHeight + tableHeight;
  const top = CONTENT.top + totalHeight / 2 - formulaHeight / 2;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // The formula itself, centred, in the monospace face: a formula that is proportional and unlabelled
  // cannot be read symbol by symbol.
  actions.push({
    action: "create_shape",
    id: `${id}-formula`,
    shape: "rounded_rectangle",
    semantic: "component",
    role: "primary",
    text: display,
    fontSize: FORMULA_SIZE,
    width: Math.min(measureText(display, FORMULA_SIZE, CONTENT_WIDTH * 0.8, { mono: true, maxLines: 2 }).width + 56, CONTENT_WIDTH),
    height: formulaHeight,
    placement: { kind: "point", x: CENTRE_X, y: top },
  });

  let cursor = top + formulaHeight / 2 + calculatesHeight / 2;
  if (options.calculates) {
    actions.push(textAction(`${id}-calc`, `what it gives you: ${options.calculates}`, CENTRE_X, cursor, "annotation", BODY_SIZE));
    cursor += calculatesHeight / 2 + 8;
  }

  if (rows.length > 0) {
    const symbolWidth = Math.max(...rows.map((row) => measureText(row.symbol, VALUE_SIZE, 120, { mono: true }).width)) + 20;
    const meaningWidth = uniformWidthForLabels(rows.map((row) => `${row.symbol}  ${row.meaning}  ${row.unit ?? ""}`.trim()), BODY_SIZE, 160, CONTENT_WIDTH);
    const tableWidth = Math.min(symbolWidth + meaningWidth + 24, CONTENT_WIDTH);
    const tableLeft = CENTRE_X - tableWidth / 2;
    rows.forEach((row, index) => {
      const y = cursor + 6 + index * rowHeight + rowHeight / 2;
      actions.push(textAction(`${id}-v${index}`, row.symbol, tableLeft + symbolWidth / 2, y, "annotation", VALUE_SIZE, true));
      const detail = row.unit ? `${row.meaning}   (${row.unit})` : row.meaning;
      actions.push({
        action: "create_text",
        id: `${id}-m${index}`,
        text: detail,
        size: BODY_SIZE,
        role: "annotation",
        placement: { kind: "point", x: tableLeft + symbolWidth + meaningWidth / 2, y },
      });
      // A rule under each row, so the symbol and its meaning stay visually paired when the table grows.
      actions.push({
        action: "create_shape",
        id: `${id}-r${index}`,
        shape: "rectangle",
        role: "caption",
        width: tableWidth,
        height: 1,
        placement: { kind: "point", x: CENTRE_X, y: cursor + 6 + (index + 1) * rowHeight },
      });
    });
  }
  return actions;
}

const EQUATION_MAX_ROWS = 6;

// ---------------------------------------------------------------------------------------------
// FREE-BODY DIAGRAM — a body with the forces acting on it
// ---------------------------------------------------------------------------------------------

/**
 * The diagram every mechanics explanation is drawn on.
 *
 * Asked for it explicitly, the model stopped hand-placing rectangles and arrows at slightly wrong angles
 * with no way to say which arrow was weight. Here the geometry is fixed by the physics: `down` really is
 * down, a force acting at the centre acts at the centre, and every arrow is named and addressable as
 * `<id>-f0`, so the next step can highlight the one force it is now discussing.
 *
 * Arrows start at the body and point OUTWARD along their direction. An inward arrow for a normal force
 * would be ambiguous, so the convention is stated on the diagram itself.
 */
function compileFreeBodyDiagram(
  id: string,
  body: string,
  forces: ForceVector[],
  motion: { label: string; direction: ForceVector["direction"] } | undefined,
  options: { title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const shown = forces.slice(0, FREE_BODY_MAX_FORCES);
  const titleHeight = options.title ? 32 : 0;
  const reach = 92;
  const bodyWidth = Math.max(150, Math.min(measureText(body, BODY_SIZE, 200).width + 60, 250));
  const bodyHeight = 92;
  const centreY = CONTENT.top + titleHeight + 30 + reach + bodyHeight / 2;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // The body first, so every force is drawn on top of it.
  actions.push({
    action: "create_shape",
    id: `${id}-body`,
    shape: "rounded_rectangle",
    semantic: "component",
    role: "primary",
    text: body,
    fontSize: BODY_SIZE,
    width: bodyWidth,
    height: bodyHeight,
    placement: { kind: "point", x: CENTRE_X, y: centreY },
  });

  // Two forces in the same direction are drawn at different lengths rather than overlapping, so a
  // diagram carrying weight AND a downward applied force stays readable instead of hiding one.
  const used: Record<ForceVector["direction"], number> = { up: 0, down: 0, left: 0, right: 0 };
  const perDirection: Record<ForceVector["direction"], number> = { up: 0, down: 0, left: 0, right: 0 };
  for (const force of shown) perDirection[force.direction] += 1;

  shown.forEach((force, index) => {
    const rank = used[force.direction]++;
    const step = perDirection[force.direction];
    const horizontal = force.direction === "left" || force.direction === "right";
    const dx = force.direction === "right" ? 1 : force.direction === "left" ? -1 : 0;
    const dy = force.direction === "down" ? 1 : force.direction === "up" ? -1 : 0;
    const length = reach - rank * (horizontal ? 18 : 12) * Math.max(0, step - 1);
    // A surface force acts on the face it touches; a field force acts at the centre of the body.
    const surface = force.acts === "surface";
    const tailX = CENTRE_X + (surface && horizontal ? (dx > 0 ? bodyWidth / 2 : -bodyWidth / 2) : 0);
    const tailY = centreY + (surface && !horizontal ? (dy > 0 ? bodyHeight / 2 : -bodyHeight / 2) : 0);
    const headX = tailX + dx * length;
    const headY = tailY + dy * length;
    const label = force.magnitude ? `${force.name} (${force.magnitude})` : force.name;

    // An arrow shape, rotated to its real direction. `create_arrow` needs two existing objects to join,
    // which cannot express "a force leaving the surface of a box at this angle" — this can, and it is
    // the same primitive the rest of the board is made of.
    actions.push({
      action: "create_shape",
      id: `${id}-f${index}`,
      shape: "arrow",
      semantic: "data",
      role: "primary",
      width: length,
      height: 16,
      // The arrow shape points right at 0 degrees, so the rotation IS the direction. Kept in degrees
      // rather than radians because that is what a teacher reading the action expects.
      rotation: horizontal ? (dx > 0 ? 0 : 180) : dy < 0 ? -90 : 90,
      placement: { kind: "point", x: (tailX + headX) / 2, y: (tailY + headY) / 2 },
      ...(options.animate ? { animate: options.animate } : {}),
    });
    const labelWidth = measureText(label, BODY_SIZE, 200).width;
    actions.push(textAction(
      `${id}-fl${index}`,
      label,
      headX + dx * (labelWidth / 2 + 10) + (horizontal ? 0 : dx),
      headY + dy * 22,
      "annotation",
      BODY_SIZE,
    ));
    if (surface) {
      // A small contact mark on the face, so "the table pushes back HERE" is visible.
      actions.push({
        action: "create_shape",
        id: `${id}-fs${index}`,
        shape: "rectangle",
        role: "caption",
        width: 12,
        height: 12,
        placement: { kind: "point", x: tailX, y: tailY },
      });
    }
  });

  if (motion) {
    const dx = motion.direction === "right" ? 1 : motion.direction === "left" ? -1 : 0;
    const dy = motion.direction === "down" ? 1 : motion.direction === "up" ? -1 : 0;
    const horizontal = motion.direction === "left" || motion.direction === "right";
    const length = reach + 20;
    actions.push({
      action: "create_shape",
      id: `${id}-motion`,
      shape: "arrow",
      semantic: "data",
      role: "annotation",
      width: length,
      height: 14,
      rotation: horizontal ? (dx > 0 ? 0 : 180) : dy < 0 ? -90 : 90,
      placement: { kind: "point", x: CENTRE_X + (dx * length) / 2, y: centreY + (dy * length) / 2 },
    });
    const labelWidth = measureText(motion.label, BODY_SIZE, 180).width;
    actions.push(textAction(`${id}-motionl`, motion.label, CENTRE_X + dx * (length + labelWidth / 2 + 8), centreY + dy * 26, "annotation", BODY_SIZE));
  }

  actions.push(textAction(
    `${id}-note`,
    "Each arrow shows the direction that force acts; an arrow touching a face acts on that face.",
    CENTRE_X,
    centreY + Math.max(reach, bodyHeight / 2) + 40,
    "caption",
    BODY_SIZE,
  ));
  return actions;
}

// ---------------------------------------------------------------------------------------------
// CIRCUIT — components in a loop, current in order
// ---------------------------------------------------------------------------------------------

/**
 * A circuit drawn as the loop it actually is.
 *
 * "Explain an RC transient response" previously produced either a sentence or a row of disconnected
 * boxes. Here the components are placed round a loop in the order current passes through them, each with
 * its value, joined by wires, and `current` optionally draws the loop current — which is the thing the
 * rest of the lesson is about.
 *
 * Symbols are drawn from primitives rather than imported as images, so they scale with the board, are
 * colour-coded by role, and need no asset pipeline.
 */
function compileCircuit(
  id: string,
  elements: CircuitElement[],
  options: { current?: boolean; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const shown = elements.slice(0, CIRCUIT_MAX_ELEMENTS);
  if (shown.length < 2) return actions;

  const titleHeight = options.title ? 32 : 0;
  const top = CONTENT.top + titleHeight + 40;
  const loopWidth = Math.min(CONTENT_WIDTH - 60, 500);
  const loopHeight = Math.min(200, Math.max(120, CONTENT.bottom - top - 60));
  const left = CENTRE_X - loopWidth / 2;
  const right = CENTRE_X + loopWidth / 2;
  const topY = top + 34;
  const bottomY = topY + loopHeight;

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // The wires. Each is a thin rotated `line` between two measured points, because `create_connector`
  // joins two EXISTING objects by id and cannot express a wire drawn between two empty points.
  wire(actions, `${id}-wire-bottom`, CENTRE_X, bottomY, loopWidth, 0);
  wire(actions, `${id}-wire-left`, left, (topY + bottomY) / 2, loopHeight, 90);
  wire(actions, `${id}-wire-right`, right, (topY + bottomY) / 2, loopHeight, 90);

  const perLine = Math.max(1, Math.min(shown.length, Math.floor(loopWidth / 130)));
  const cell = loopWidth / perLine;
  shown.forEach((element, index) => {
    const line = Math.floor(index / perLine);
    const slot = index % perLine;
    drawCircuitElement(actions, `${id}-c${index}`, element, left + cell * (slot + 0.5), topY + line * (bottomY - topY));
  });

  if (options.current) {
    const arrowY = topY - 26;
    actions.push({
      action: "create_shape",
      id: `${id}-current`,
      shape: "arrow",
      semantic: "data",
      role: "annotation",
      width: Math.min(180, loopWidth * 0.4),
      height: 14,
      placement: { kind: "point", x: CENTRE_X - Math.min(180, loopWidth * 0.4) / 4, y: arrowY },
    });
    actions.push(textAction(`${id}-currentl`, "current", CENTRE_X + Math.min(180, loopWidth * 0.4) / 2 + 30, arrowY, "annotation", BODY_SIZE));
  }
  actions.push(textAction(
    `${id}-note`,
    "The components are drawn in the order the current passes through them.",
    CENTRE_X,
    bottomY + 26,
    "caption",
    BODY_SIZE,
  ));
  return actions;
}

/**
 * A wire between two empty points.
 *
 * A `line` shape with a measured length and a rotation. The rotation is degrees clockwise from "pointing
 * right", so 90 is vertical — which is why the left and right rails are the same call with a different
 * rotation, and why the geometry of a circuit is expressed as arithmetic rather than as coordinates
 * sprinkled through the model.
 */
function wire(actions: VisualAction[], id: string, x: number, y: number, length: number, rotation: number): void {
  actions.push({
    action: "create_shape",
    id,
    shape: "line",
    role: "caption",
    width: length,
    height: 2,
    rotation,
    placement: { kind: "point", x, y },
  });
}

/**
 * One component, drawn from primitives so it needs no asset pipeline and scales with the board.
 *
 * The FIRST primitive of each component takes the bare id, so the component itself is addressable: a
 * later step can `highlight { id: "rc-c2" }` to talk about the capacitor alone. Without that, a circuit
 * was a pile of plates with no object to point at, and the only way to discuss one component was to
 * redraw the whole circuit.
 */
function drawCircuitElement(actions: VisualAction[], id: string, element: CircuitElement, x: number, y: number): void {
  const plate = (name: string, width: number, height: number, atX: number, atY: number, primary = false) => {
    actions.push({ action: "create_shape", id: primary ? id : `${id}-${name}`, shape: "rectangle", role: "caption", width, height, placement: { kind: "point", x: atX, y: atY } });
  };
  switch (element.kind) {
    case "resistor":
      // The zig-zag, as five short diagonals.
      for (let index = 0; index < 5; index += 1) {
        const fromX = x - 34 + index * 14;
        const toX = fromX + 14;
        const flip = index % 2 === 0;
        wire(actions, index === 0 ? id : `${id}-z${index}`, (fromX + toX) / 2, y + (flip ? -7 : 7), 18, flip ? -34 : 34);
      }
      break;
    case "capacitor":
      plate("plate-b", 4, 32, x - 7, y);
      plate("plate-a", 4, 32, x + 7, y, true);
      break;
    case "inductor":
      for (let index = 0; index < 3; index += 1) {
        actions.push({ action: "create_shape", id: index === 0 ? id : `${id}-coil${index}`, shape: "circle", role: "caption", width: 24, height: 24, placement: { kind: "point", x: x - 24 + index * 24, y } });
      }
      break;
    case "source": case "battery":
      plate("cell-short", 4, 16, x - 7, y);
      plate("cell-long", 4, 30, x + 7, y, true);
      break;
    case "switch":
      wire(actions, id, x - 2, y - 8, 40, -34);
      actions.push({ action: "create_shape", id: `${id}-dot-a`, shape: "circle", role: "caption", width: 8, height: 8, placement: { kind: "point", x: x - 22, y } });
      actions.push({ action: "create_shape", id: `${id}-dot-b`, shape: "circle", role: "caption", width: 8, height: 8, placement: { kind: "point", x: x + 20, y } });
      break;
    case "diode":
      actions.push({ action: "create_shape", id, shape: "triangle", role: "caption", width: 30, height: 28, placement: { kind: "point", x: x - 4, y } });
      plate("bar", 4, 28, x + 14, y);
      break;
    case "opamp":
      actions.push({ action: "create_shape", id, shape: "triangle", role: "caption", width: 58, height: 54, placement: { kind: "point", x, y } });
      break;
    case "ground":
      for (let index = 0; index < 3; index += 1) {
        plate(index === 0 ? "bar" : `bar${index}`, 36 - index * 10, 3, x, y + index * 6);
      }
      break;
  }
  actions.push(textAction(`${id}-label`, element.value ? `${element.label}  (${element.value})` : element.label, x, y + 40, "annotation", BODY_SIZE));
}
const FREE_BODY_MAX_FORCES = 6;
const CIRCUIT_MAX_ELEMENTS = 8;

// ---------------------------------------------------------------------------------------------
// GRAPH PLOT — a relationship, with axes that mean something
// ---------------------------------------------------------------------------------------------

/**
 * A plotted relationship on labelled axes.
 *
 * One structure for everything of this shape: a function graph, a motion graph, a charging curve, a
 * velocity-time profile, an energy diagram and a spectrum. The axis labels and the shape caption are
 * part of the payload because "the curve rises exponentially" is only true relative to an axis — a curve
 * on unlabelled axes is the decorative filler this module exists to replace.
 *
 * Points are drawn as a polyline of connectors, scaled into a plot frame, with the frame itself drawn so
 * a student can see that axes exist.
 */
function compileGraphPlot(
  id: string,
  points: PlotPoint[],
  options: { xLabel?: string; yLabel?: string; shape?: string; guide?: { y: number; label: string }; title?: string; animate?: VisualAnimation } = {},
): VisualAction[] {
  const actions: VisualAction[] = [];
  const shown = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)).slice(0, PLOT_MAX_POINTS);
  if (shown.length < 2) return actions;

  const titleHeight = options.title ? 32 : 0;
  const axisLabelHeight = 34;
  const captionHeight = options.shape ? 26 : 0;
  const top = CONTENT.top + titleHeight + 30;
  const plotWidth = Math.min(CONTENT_WIDTH - 90, 520);
  const plotHeight = Math.min(CONTENT_HEIGHT - top - axisLabelHeight - captionHeight - CONTENT.top - 20, 260);
  const left = CENTRE_X - plotWidth / 2;
  const bottom = top + plotHeight;

  const xs = shown.map((point) => point.x);
  const ys = shown.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const dataMinY = Math.min(...ys);
  const dataMaxY = Math.max(...ys);
  // The guide is part of the range so a threshold line is never drawn off the top of the plot, and the
  // zero-anchoring keeps a positive curve from being stretched to fill the frame.
  const minY = options.guide ? Math.min(anchorLow(dataMinY), options.guide.y) : anchorLow(dataMinY);
  const maxY = Math.max(anchorHigh(dataMaxY), options.guide ? options.guide.y : anchorHigh(dataMaxY));
  const sx = (value: number) => left + (maxX === minX ? plotWidth / 2 : ((value - minX) / (maxX - minX)) * plotWidth);
  const sy = (value: number) => bottom - (maxY === minY ? plotHeight / 2 : ((value - minY) / (maxY - minY)) * plotHeight);

  if (options.title) actions.push(textAction(`${id}-title`, options.title, CENTRE_X, CONTENT.top + 10, "title", TITLE_SIZE));

  // The frame. A plot with no visible axes is a scribble, so the axes are drawn as objects.
  actions.push({ action: "create_shape", id: `${id}-axis-x`, shape: "rectangle", role: "caption", width: plotWidth, height: 2, placement: { kind: "point", x: CENTRE_X, y: bottom } });
  actions.push({ action: "create_shape", id: `${id}-axis-y`, shape: "rectangle", role: "caption", width: 2, height: plotHeight, placement: { kind: "point", x: left, y: top + plotHeight / 2 } });

  if (options.guide) {
    actions.push({
      action: "create_shape",
      id: `${id}-guide`,
      shape: "rectangle",
      role: "caption",
      width: plotWidth,
      height: 1,
      placement: { kind: "point", x: CENTRE_X, y: sy(options.guide.y) },
    });
    actions.push(textAction(`${id}-guide-label`, options.guide.label, left + plotWidth + 6, sy(options.guide.y), "caption", BODY_SIZE));
  }

  // The curve itself: one rotated `line` per segment. A polyline drawn this way is a series of ordinary
  // measurable objects, so the renderer needs no curve support and every segment is inspectable.
  for (let index = 0; index < shown.length - 1; index += 1) {
    const from = shown[index]!;
    const to = shown[index + 1]!;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) continue;
    // SVG rotates clockwise in screen space (y grows downwards), so the angle is the screen-space
    // direction of travel. Negating it would draw a rising curve as a falling one.
    const angle = Math.atan2(sy(to.y) - sy(from.y), sx(to.x) - sx(from.x)) * (180 / Math.PI);
    actions.push({
      action: "create_shape",
      id: `${id}-seg${index}`,
      shape: "line",
      role: "primary",
      width: length,
      height: 3,
      rotation: angle,
      placement: { kind: "point", x: (sx(from.x) + sx(to.x)) / 2, y: (sy(from.y) + sy(to.y)) / 2 },
      ...(options.animate ? { animate: options.animate } : {}),
    });
  }
  // Endpoints get a dot and their value, so the student can read the answer off the curve.
  [0, shown.length - 1].forEach((position, which) => {
    const point = shown[position];
    if (!point) return;
    actions.push({ action: "create_shape", id: `${id}-dot${which}`, shape: "circle", role: "primary", width: 10, height: 10, placement: { kind: "point", x: sx(point.x), y: sy(point.y) } });
    if (point.label) actions.push(textAction(`${id}-dot${which}l`, point.label, sx(point.x) + 10, sy(point.y) - 10, "annotation", BODY_SIZE));
  });

  if (options.xLabel) actions.push(textAction(`${id}-x`, options.xLabel, CENTRE_X, bottom + 20, "caption", BODY_SIZE));
  if (options.yLabel) actions.push(textAction(`${id}-y`, options.yLabel, left - 10, top + plotHeight / 2, "caption", BODY_SIZE));
  if (options.shape) actions.push(textAction(`${id}-shape`, options.shape, CENTRE_X, bottom + 44, "annotation", BODY_SIZE));
  return actions;
}

/**
 * A curve is usually anchored at zero, so the vertical range keeps it that way unless the data says
 * otherwise — a curve of positive values stretched to fill the frame reads as a much bigger change than
 * the data contains.
 */
const anchorLow = (value: number): number => (value > 0 && value < 3 ? 0 : value);
const anchorHigh = (value: number): number => (value < 0 && value > -3 ? 0 : value);
const PLOT_MAX_POINTS = 24;

// ---------------------------------------------------------------------------------------------
// CODE BLOCK — a measured, syntax-ready source panel
// ---------------------------------------------------------------------------------------------

// A monospace face is required for code to line up at all, and code is read as code, not as prose:
// a slightly larger size than body text keeps a whole line on screen without wrapping.
export const CODE_FONT_SIZE = 15;
const CODE_LINE_HEIGHT = 21;
const CODE_GUTTER_WIDTH = 34;
const CODE_PADDING_X = 16;
const CODE_PADDING_Y = 14;
const CODE_TITLE_HEIGHT = 26;
const MAX_CODE_LINES = 22;
const MAX_CODE_COLUMNS = 78;

export type CompiledCodeBlock = {
  width: number;
  height: number;
  lines: string[];
  highlightLines: number[];
};

/**
 * Measures a source listing for the board.
 *
 * Source is kept VERBATIM — indentation is meaning in most languages, so it is never trimmed, never
 * re-wrapped and never collapsed. The block is sized to the widest line it actually has, with a hard
 * cap on both columns and rows: past that a listing stops being something a student reads and starts
 * being a wall of text, so the extra lines are dropped rather than shrunk to an unreadable size.
 */
export function compileCodeBlock(
  code: string,
  options: { title?: string; highlightLines?: number[]; fontSize?: number } = {},
): CompiledCodeBlock {
  const fontSize = Math.min(24, Math.max(11, options.fontSize ?? CODE_FONT_SIZE));
  const charWidth = fontSize * 0.6;
  const raw = String(code ?? "").replace(/\r\n/g, "\n").replace(/\t/g, "  ").split("\n");
  // A trailing newline is an artefact of how code is pasted, not a line of code.
  while (raw.length > 1 && raw[raw.length - 1].trim() === "") raw.pop();
  const dropped = Math.max(0, raw.length - MAX_CODE_LINES);
  const lines = raw.slice(0, MAX_CODE_LINES);
  const widest = Math.max(0, ...lines.map((line) => line.length));
  const columns = Math.min(Math.max(widest, 12), MAX_CODE_COLUMNS);
  const gutter = Math.max(CODE_GUTTER_WIDTH, String(lines.length).length * 9 + 18);
  const width = Math.round(gutter + CODE_PADDING_X * 2 + columns * charWidth);
  const height = Math.round(
    CODE_PADDING_Y * 2 + lines.length * (fontSize * CODE_LINE_HEIGHT / CODE_FONT_SIZE) + (options.title ? CODE_TITLE_HEIGHT : 0),
  );
  const highlightLines = (options.highlightLines ?? [])
    .filter((line) => Number.isInteger(line) && line >= 1 && line <= lines.length);
  return { width, height, lines: lines.map((line) => line.slice(0, MAX_CODE_COLUMNS)), highlightLines };
}