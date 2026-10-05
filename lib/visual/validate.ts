// STRICT validation for visual actions. This is the single gate between model output and the
// renderer: malformed output is rejected (never coerced), exactly like the graph board's
// parseBoardAction. Nothing here executes model-provided code — only known action shapes survive.
//
// Two entry points, deliberately:
//   parseVisualActions()  ALL OR NOTHING. Used where a caller genuinely cannot proceed with a
//                         partially-understood batch.
//   repairVisualActions() PER ACTION. Used by the teaching pipeline: one malformed decorative action
//                         is dropped or repaired, every other action in the step still teaches, and
//                         each decision is recorded as a VisualActionDiagnostic. A teaching step is
//                         never thrown away because one arrow was misspelled.
import {
  ANCHORS, ANIMATION_KINDS, ARROW_STYLES, CONNECTOR_KINDS, MAX_ANIMATION_MS, MAX_ARROW_OFFSET,
  MAX_GLYPH_LENGTH, MAX_OBJECT_SIZE, MAX_OBJECTS, MAX_TEXT_LENGTH, MAX_VISUAL_ACTIONS_PER_STEP,
  MIN_OBJECT_SIZE, RELATIVE_SIDES, SEMANTIC_KINDS, SEMANTIC_RELATIONS, SHAPE_KINDS, VISUAL_ROLES,
  VISUAL_THEMES, AnimationKind, ArrowStyle, ConnectorKind, SemanticKind, SemanticRelation, ShapeKind,
  VisualAction, VisualActionDiagnostic, VisualAnimation, VisualObject, VisualPlacement, VisualRole,
  VisualScene, VisualTheme,
} from "./types";
import { looksLikeCode } from "./code";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isInteger = (value: unknown): value is number => isFiniteNumber(value) && Number.isInteger(value);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const isId = (value: unknown): value is string => isString(value) && ID_PATTERN.test(value);
const isText = (value: unknown, max = MAX_TEXT_LENGTH): value is string => isString(value) && value.trim().length > 0 && value.length <= max;

// Coordinates far outside any sane board are treated as a malformed response (not clamped).
const COORD_LIMIT = 100_000;
const isCoord = (value: unknown): value is number => isFiniteNumber(value) && Math.abs(value) <= COORD_LIMIT;
const isSize = (value: unknown): value is number => isFiniteNumber(value) && value >= MIN_OBJECT_SIZE && value <= MAX_OBJECT_SIZE;
const isDuration = (value: unknown): value is number => isFiniteNumber(value) && value >= 0 && value <= MAX_ANIMATION_MS;
const isDegrees = (value: unknown): value is number => isFiniteNumber(value) && Math.abs(value) <= 3600;
const isOffset = (value: unknown): value is number => isFiniteNumber(value) && Math.abs(value) <= MAX_ARROW_OFFSET;
// A type size is bounded like everything else: 10px is unreadable and 60px does not fit a board.
const isFontSize = (value: unknown): value is number => isFiniteNumber(value) && value >= 10 && value <= 60;
const isNumber = (value: unknown): value is number => isFiniteNumber(value);
const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.length <= 64 && value.every(isId);
const oneOf = <T extends readonly string[]>(list: T, value: unknown): value is T[number] => isString(value) && (list as readonly string[]).includes(value);

export function parseVisualAnimation(value: unknown): VisualAnimation | null {
  if (value === undefined) return null;
  if (!isRecord(value) || !oneOf(ANIMATION_KINDS, value.kind)) return null;
  const durationMs = value.durationMs === undefined ? 600 : value.durationMs;
  if (!isDuration(durationMs)) return null;
  const delayMs = value.delayMs === undefined ? 0 : value.delayMs;
  if (!isDuration(delayMs)) return null;
  return { kind: value.kind as AnimationKind, durationMs, delayMs };
}

export function parseVisualPlacement(value: unknown): VisualPlacement | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case "anchor":
      return oneOf(ANCHORS, value.anchor) ? { kind: "anchor", anchor: value.anchor } : null;
    case "point":
      return isCoord(value.x) && isCoord(value.y) ? { kind: "point", x: value.x, y: value.y } : null;
    case "relative": {
      if (!isId(value.relativeTo) || !oneOf(RELATIVE_SIDES, value.side)) return null;
      const gap = value.gap === undefined ? 24 : value.gap;
      if (!isFiniteNumber(gap) || gap < 0 || gap > 400) return null;
      return { kind: "relative", relativeTo: value.relativeTo, side: value.side, gap };
    }
    case "between": {
      const between = value.between;
      if (!Array.isArray(between) || between.length !== 2 || !isId(between[0]) || !isId(between[1])) return null;
      return { kind: "between", between: [between[0], between[1]] };
    }
    default: return null;
  }
}

type OptionalAnimation = { animate?: VisualAnimation };

function withAnimation<T extends object>(base: T, value: Record<string, unknown>): (T & OptionalAnimation & { role?: VisualRole }) | null {
  const role = value.role === undefined ? undefined : (oneOf(VISUAL_ROLES, value.role) ? (value.role as VisualRole) : undefined);
  // An unknown role is dropped, not fatal: it is pure presentation and must never cost a diagram.
  const withRole = role ? { ...base, role } : { ...base };
  if (value.animate === undefined) return withRole;
  const animate = parseVisualAnimation(value.animate);
  return animate ? { ...withRole, animate } : null;
}

/** Structural list helpers for the semantic structure actions. */
const isStringList = (value: unknown, max = 64, maxLength = MAX_TEXT_LENGTH): value is string[] =>
  Array.isArray(value) && value.length > 0 && value.length <= max && value.every((entry) => isString(entry) && entry.trim().length > 0 && entry.length <= maxLength);

type RawNode = { id: string; value: string; sub?: string };
const isRawNode = (value: unknown): value is RawNode => {
  if (!isRecord(value) || !isId(value.id) || !isText(value.value)) return false;
  if (value.sub !== undefined && !isText(value.sub)) return false;
  return true;
};
const isNodeList = (value: unknown): value is RawNode[] => Array.isArray(value) && value.length > 0 && value.length <= 40 && value.every(isRawNode);

type RawEdge = { from: string; to: string; label?: string; dashed?: boolean };
const isRawEdge = (value: unknown): value is RawEdge => {
  if (Array.isArray(value) && value.length === 2 && isId(value[0]) && isId(value[1])) return true;
  if (!isRecord(value) || !isId(value.from) || !isId(value.to) || value.from === value.to) return false;
  if (value.label !== undefined && !isText(value.label)) return false;
  if (value.dashed !== undefined && typeof value.dashed !== "boolean") return false;
  return true;
};
const isEdgeList = (value: unknown): value is RawEdge[] => Array.isArray(value) && value.length <= 80 && value.every(isRawEdge);

type RawMessage = { from: string; to: string; label?: string; dashed?: boolean };
const isRawMessage = (value: unknown): value is RawMessage => isRawEdge(value) && typeof value.from === "string";
const isMessageList = (value: unknown): value is RawMessage[] => Array.isArray(value) && value.length <= 40 && value.every(isRawMessage);

/** Accepts both [{from,to}] and ["from","to"] so the model may write either form. */
const edgeOf = (edge: RawEdge): RawEdge => (Array.isArray(edge) ? { from: (edge as unknown as string[])[0], to: (edge as unknown as string[])[1] } : edge);
const edgeListOf = (edges: RawEdge[]): RawEdge[] => edges.map(edgeOf);

const isPanel = (value: unknown): value is { title: string; items: string[] } =>
  isRecord(value) && isText(value.title) && isStringList(value.items, 12, 80);

export function parseVisualAction(value: unknown): VisualAction | null {
  if (!isRecord(value) || !isString(value.action)) return null;
  const v = value;
  const declaredPlacement = parseVisualPlacement(v.placement);
  if (v.placement !== undefined && declaredPlacement === null) return null;
  // Explicit top-level coordinates are accepted as a shorthand for a point placement.
  const placement: VisualPlacement | null = declaredPlacement ?? (hasPoint(v) ? { kind: "point", x: v.x as number, y: v.y as number } : null);
  switch (value.action) {
    case "create_shape": {
      if (!isId(v.id) || !oneOf(SHAPE_KINDS, v.shape)) return null;
      if (v.text !== undefined && !isText(v.text)) return null;
      if (v.semantic !== undefined && !oneOf(SEMANTIC_KINDS, v.semantic)) return null;
      if (v.width !== undefined && !isSize(v.width)) return null;
      if (v.height !== undefined && !isSize(v.height)) return null;
      if (v.fontSize !== undefined && !isFontSize(v.fontSize)) return null;
      // A shape can point somewhere: an arrow rotated to the direction a force acts, a bar at the angle a
      // derivative has. Without this the field exists in the engine and can never arrive, because every
      // provider rejects an undeclared property.
      if (v.rotation !== undefined && !isNumber(v.rotation)) return null;
      return withAnimation({ action: "create_shape" as const, id: v.id, shape: v.shape as ShapeKind, ...(isText(v.text) ? { text: v.text } : {}), ...(v.semantic !== undefined ? { semantic: v.semantic as SemanticKind } : {}), ...(isSize(v.width) ? { width: v.width } : {}), ...(isSize(v.height) ? { height: v.height } : {}), ...(isFontSize(v.fontSize) ? { fontSize: v.fontSize } : {}), ...(isNumber(v.rotation) ? { rotation: v.rotation } : {}), ...(placement ? { placement } : {}) }, v);
    }
    case "create_container": {
      if (!isId(v.id)) return null;
      if (v.text !== undefined && !isText(v.text)) return null;
      if (v.width !== undefined && !isSize(v.width)) return null;
      if (v.height !== undefined && !isSize(v.height)) return null;
      return withAnimation({ action: "create_container" as const, id: v.id, ...(isText(v.text) ? { text: v.text } : {}), ...(isSize(v.width) ? { width: v.width } : {}), ...(isSize(v.height) ? { height: v.height } : {}), ...(placement ? { placement } : {}) }, v);
    }
    case "create_text": {
      if (!isId(v.id) || !isText(v.text)) return null;
      if (v.size !== undefined && !isSize(v.size)) return null;
      return withAnimation({ action: "create_text" as const, id: v.id, text: v.text, ...(isSize(v.size) ? { size: v.size } : {}), ...(placement ? { placement } : {}) }, v);
    }
    case "write_formula": {
      if (!isId(v.id) || !isText(v.formula)) return null;
      if (v.size !== undefined && !isFontSize(v.size)) return null;
      return withAnimation({ action: "write_formula" as const, id: v.id, formula: v.formula, ...(placement ? { placement } : {}), ...(isFontSize(v.size) ? { size: v.size } : {}) }, v);
    }
    case "create_label": {
      if (!isId(v.id) || !isId(v.target) || !isText(v.text)) return null;
      if (v.side !== undefined && !oneOf(RELATIVE_SIDES, v.side)) return null;
      return withAnimation({ action: "create_label" as const, id: v.id, target: v.target, text: v.text, ...(v.side !== undefined ? { side: v.side } : {}) }, v);
    }
    case "create_code_block": {
      if (!isId(v.id) || !isText(v.code, 1200) || v.code.trim().length === 0) return null;
      if (v.language !== undefined && !isText(v.language, 24)) return null;
      if (v.title !== undefined && !isText(v.title, 60)) return null;
      if (v.size !== undefined && !isFontSize(v.size)) return null;
      const highlightLines = v.highlightLines === undefined ? undefined : intList(v.highlightLines, 1, 40);
      if (v.highlightLines !== undefined && !highlightLines) return null;
      return withAnimation({
        action: "create_code_block" as const, id: v.id, code: v.code,
        ...(v.language !== undefined && isText(v.language, 24) ? { language: v.language } : {}),
        ...(v.title !== undefined && isText(v.title, 60) ? { title: v.title } : {}),
        ...(highlightLines ? { highlightLines } : {}),
        ...(v.size !== undefined && isFontSize(v.size) ? { size: v.size } : {}),
        ...(placement ? { placement } : {}),
      }, v);
    }
    case "set_code_pointer": {
      // The EXECUTION POINTER. Moving it is a first-class action rather than deleting and recreating
      // the listing, because a recreated block restarts its entrance animation, loses its identity, and
      // makes "the line I am on" flicker — which is the one thing the pointer exists to stop doing.
      if (!isId(v.id)) return null;
      const lines = intList(v.lines, 1, 40);
      if (!lines || lines.length === 0) return null;
      return withAnimation({ action: "set_code_pointer" as const, id: v.id, lines }, v);
    }
    case "create_icon": {
      if (!isId(v.id) || !isString(v.glyph) || v.glyph.trim().length === 0 || v.glyph.length > MAX_GLYPH_LENGTH) return null;
      if (v.size !== undefined && !isSize(v.size)) return null;
      return withAnimation({ action: "create_icon" as const, id: v.id, glyph: v.glyph, ...(isSize(v.size) ? { size: v.size } : {}), ...(placement ? { placement } : {}) }, v);
    }
    case "create_arrow": {
      if (!isId(v.id) || !isId(v.from) || !isId(v.to) || v.from === v.to) return null;
      if (v.label !== undefined && !isText(v.label)) return null;
      if (v.style !== undefined && !oneOf(ARROW_STYLES, v.style)) return null;
      if (v.offset !== undefined && !isOffset(v.offset)) return null;
      if (v.kind !== undefined && !oneOf(CONNECTOR_KINDS, v.kind)) return null;
      // WHAT the link MEANS. The engine draws from this and the layout reads it to decide which way the
      // two objects stand to each other, so the model states a relationship and never a pixel.
      if (v.relation !== undefined && !oneOf(SEMANTIC_RELATIONS, v.relation)) return null;
      return withAnimation({ action: "create_arrow" as const, id: v.id, from: v.from, to: v.to, ...(isText(v.label) ? { label: v.label } : {}), ...(v.style !== undefined ? { style: v.style as ArrowStyle } : {}), ...(v.kind !== undefined ? { kind: v.kind as ConnectorKind } : {}), ...(v.relation !== undefined ? { relation: v.relation as SemanticRelation } : {}), ...(isOffset(v.offset) ? { offset: v.offset } : {}) }, v);
    }
    case "create_connector": {
      if (!isId(v.id) || !isId(v.from) || !isId(v.to) || v.from === v.to) return null;
      if (v.label !== undefined && !isText(v.label)) return null;
      if (v.offset !== undefined && !isOffset(v.offset)) return null;
      if (v.kind !== undefined && !oneOf(CONNECTOR_KINDS, v.kind)) return null;
      if (v.relation !== undefined && !oneOf(SEMANTIC_RELATIONS, v.relation)) return null;
      return withAnimation({ action: "create_connector" as const, id: v.id, from: v.from, to: v.to, ...(isText(v.label) ? { label: v.label } : {}), ...(v.kind !== undefined ? { kind: v.kind as ConnectorKind } : {}), ...(v.relation !== undefined ? { relation: v.relation as SemanticRelation } : {}), ...(isOffset(v.offset) ? { offset: v.offset } : {}) }, v);
    }
    case "move": {
      if (!isId(v.id) || !placement) return null;
      return withAnimation({ action: "move" as const, id: v.id, placement }, v);
    }
    case "resize": {
      if (!isId(v.id) || !isSize(v.width) || !isSize(v.height)) return null;
      return withAnimation({ action: "resize" as const, id: v.id, width: v.width, height: v.height }, v);
    }
    case "rotate": {
      if (!isId(v.id) || !isDegrees(v.degrees)) return null;
      return withAnimation({ action: "rotate" as const, id: v.id, degrees: v.degrees }, v);
    }
    case "highlight": case "pulse": case "fade_in": case "fade_out": {
      if (!isId(v.id)) return null;
      const base = value.action === "highlight" ? { action: "highlight" as const, id: v.id }
        : value.action === "pulse" ? { action: "pulse" as const, id: v.id }
        : value.action === "fade_in" ? { action: "fade_in" as const, id: v.id }
        : { action: "fade_out" as const, id: v.id };
      return withAnimation(base, v);
    }
    case "highlight_many": {
      const ids = idList(v.ids);
      if (!ids || ids.length === 0) return null;
      return withAnimation({ action: "highlight_many" as const, ids }, v);
    }
    case "focus": {
      const ids = idList(v.ids);
      if (!ids || ids.length === 0) return null;
      return withAnimation({ action: "focus" as const, ids }, v);
    }
    case "dim": {
      const ids = idList(v.ids);
      return ids && ids.length > 0 ? { action: "dim", ids } : null;
    }
    case "restore": {
      if (v.ids === undefined) return { action: "restore" };
      const ids = idList(v.ids);
      return ids && ids.length > 0 ? { action: "restore", ids } : null;
    }
    case "flow": {
      if (!isId(v.id)) return null;
      if (v.durationMs !== undefined && !isDuration(v.durationMs)) return null;
      return { action: "flow", id: v.id, ...(isDuration(v.durationMs) ? { durationMs: v.durationMs } : {}) };
    }
    case "animate_path": {
      if (!isId(v.id) || !isId(v.to) || v.id === v.to) return null;
      if (v.label !== undefined && !isText(v.label)) return null;
      if (v.durationMs !== undefined && !isDuration(v.durationMs)) return null;
      return { action: "animate_path", id: v.id, to: v.to, ...(isText(v.label) ? { label: v.label } : {}), ...(isDuration(v.durationMs) ? { durationMs: v.durationMs } : {}) };
    }
    case "wait": {
      if (!isDuration(v.durationMs)) return null;
      return { action: "wait", durationMs: v.durationMs };
    }
    case "remove": case "camera_focus": {
      if (!isId(v.id)) return null;
      return value.action === "remove" ? { action: "remove", id: v.id } : { action: "camera_focus", id: v.id };
    }
    case "clear":
      return { action: "clear" };
    case "set_theme":
      return oneOf(VISUAL_THEMES, v.theme) ? { action: "set_theme", theme: v.theme as VisualTheme } : null;

    // ---- Semantic structures: structure only, never coordinates. ----
    case "create_array": case "update_array": {
      if (!isId(v.id) || !isStringList(v.values, 48, 40)) return null;
      if (v.indices !== undefined && typeof v.indices !== "boolean") return null;
      if (v.vertical !== undefined && typeof v.vertical !== "boolean") return null;
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      const shared = {
        id: v.id,
        values: v.values.map((entry) => entry.trim()),
        ...(v.indices !== undefined ? { indices: v.indices } : {}),
        ...(v.vertical !== undefined ? { vertical: v.vertical } : {}),
      };
      const title = isText(v.title, 80) ? { title: v.title.trim() } : {};
      return value.action === "update_array"
        ? withAnimation({ action: "update_array" as const, ...shared }, v)
        : withAnimation({ action: "create_array" as const, ...shared, ...title }, v);
    }
    case "create_linked_list": {
      if (!isId(v.id) || !isNodeList(v.nodes)) return null;
      if (v.head !== undefined && !isId(v.head)) return null;
      if (v.tail !== undefined && typeof v.tail !== "boolean") return null;
      if (v.doubly !== undefined && typeof v.doubly !== "boolean") return null;
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      const seen = new Set<string>();
      for (const node of v.nodes) {
        if (seen.has(node.id)) return null; // duplicate node ids would make every edge ambiguous
        seen.add(node.id);
      }
      if (v.head !== undefined && !seen.has(v.head)) return null;
      return withAnimation({
        action: "create_linked_list" as const, id: v.id,
        nodes: v.nodes.map((node) => ({ id: node.id, value: node.value.trim(), ...(node.sub ? { sub: node.sub.trim() } : {}) })),
        ...(v.head !== undefined ? { head: v.head } : {}),
        ...(v.tail !== undefined ? { tail: v.tail } : {}),
        ...(v.doubly !== undefined ? { doubly: v.doubly } : {}),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_stack": case "create_queue": {
      if (!isId(v.id) || !isStringList(v.values, 24, 40)) return null;
      if (v.topLabel !== undefined && !isText(v.topLabel, 40)) return null;
      if (v.frontLabel !== undefined && !isText(v.frontLabel, 40)) return null;
      if (v.rearLabel !== undefined && !isText(v.rearLabel, 40)) return null;
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      const shared = { id: v.id, values: v.values.map((entry) => entry.trim()) };
      const title = isText(v.title, 80) ? { title: v.title.trim() } : {};
      return value.action === "create_stack"
        ? withAnimation({ action: "create_stack" as const, ...shared, ...(isText(v.topLabel, 40) ? { topLabel: v.topLabel.trim() } : {}), ...title }, v)
        : withAnimation({ action: "create_queue" as const, ...shared, ...(isText(v.frontLabel, 40) ? { frontLabel: v.frontLabel.trim() } : {}), ...(isText(v.rearLabel, 40) ? { rearLabel: v.rearLabel.trim() } : {}), ...title }, v);
    }
    case "create_tree": case "create_graph": {
      if (!isId(v.id) || !isNodeList(v.nodes)) return null;
      if (v.edges === undefined) return null;
      // Every edge must name nodes that exist, or the tree is not a tree: it is a guess.
      const edges = edgeListOf(v.edges as RawEdge[]);
      const known = new Set(v.nodes.map((node) => node.id));
      for (const edge of edges) {
        if (!known.has(edge.from) || !known.has(edge.to) || edge.from === edge.to) return null;
      }
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      const shared = {
        id: v.id,
        nodes: v.nodes.map((node) => ({ id: node.id, value: node.value.trim() })),
        edges: edges.map((edge) => ({ from: edge.from, to: edge.to, ...(edge.label ? { label: edge.label.trim() } : {}), ...(edge.dashed ? { dashed: true } : {}) })),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      };
      if (value.action === "create_tree") return withAnimation({ action: "create_tree" as const, ...shared }, v);
      if (v.layout !== undefined && !oneOf(["grid", "circle", "layered"] as const, v.layout)) return null;
      return withAnimation({ action: "create_graph" as const, ...shared, ...(v.layout !== undefined ? { layout: v.layout as "grid" | "circle" | "layered" } : {}) }, v);
    }
    case "create_sequence": {
      if (!isId(v.id) || !isStringList(v.actors, 8, 40)) return null;
      if (v.messages === undefined) return null;
      const messages = (v.messages as RawMessage[]).map(edgeOf);
      const actors = v.actors.map((actor) => actor.trim());
      for (const message of messages) {
        if (!actors.includes(message.from) || !actors.includes(message.to) || message.from === message.to) return null;
      }
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      return withAnimation({
        action: "create_sequence" as const, id: v.id, actors,
        messages: messages.map((message) => ({ from: message.from, to: message.to, ...(message.label ? { label: message.label.trim() } : {}), ...(message.dashed ? { dashed: true } : {}) })),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_pipeline": {
      if (!isId(v.id) || !isStringList(v.stages, 12, 40)) return null;
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      return withAnimation({ action: "create_pipeline" as const, id: v.id, stages: v.stages.map((stage) => stage.trim()), ...(isText(v.title, 80) ? { title: v.title.trim() } : {}) }, v);
    }
    case "create_timeline": {
      if (!isId(v.id) || !Array.isArray(v.events) || v.events.length === 0 || v.events.length > 12) return null;
      const events: Array<{ label: string; text: string }> = [];
      for (const event of v.events) {
        if (!isRecord(event) || !isText(event.label, 30) || !isText(event.text, 80)) return null;
        events.push({ label: event.label.trim(), text: event.text.trim() });
      }
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      return withAnimation({ action: "create_timeline" as const, id: v.id, events, ...(isText(v.title, 80) ? { title: v.title.trim() } : {}) }, v);
    }
    case "create_compare": {
      if (!isId(v.id) || !isPanel(v.left) || !isPanel(v.right)) return null;
      if (v.title !== undefined && !isText(v.title, 80)) return null;
      return withAnimation({
        action: "create_compare" as const, id: v.id,
        left: { title: v.left.title.trim(), items: v.left.items.map((item) => item.trim()) },
        right: { title: v.right.title.trim(), items: v.right.items.map((item) => item.trim()) },
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_equation_block": {
      if (!isId(v.id) || !isText(v.formula, 300)) return null;
      const variables = formulaRows(v.variables);
      if (v.variables !== undefined && variables === null) return null;
      if (v.calculates !== undefined && !isText(v.calculates, 300)) return null;
      return withAnimation({
        action: "create_equation_block" as const, id: v.id, formula: v.formula.trim(),
        ...(variables && variables.length > 0 ? { variables } : {}),
        ...(isText(v.calculates, 300) ? { calculates: v.calculates.trim() } : {}),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_free_body_diagram": {
      if (!isId(v.id) || !isText(v.body, 60)) return null;
      const forces = forceVectors(v.forces);
      if (forces === null || forces.length === 0) return null;
      const motion = motionVector(v.motion);
      if (v.motion !== undefined && motion === null) return null;
      return withAnimation({
        action: "create_free_body_diagram" as const, id: v.id, body: v.body.trim(), forces,
        ...(motion ? { motion } : {}),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_circuit": {
      if (!isId(v.id)) return null;
      const elements = circuitElements(v.elements);
      if (elements === null || elements.length < 2) return null;
      return withAnimation({
        action: "create_circuit" as const, id: v.id, elements,
        ...(v.current === true ? { current: true } : {}),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    case "create_graph_plot": {
      if (!isId(v.id)) return null;
      const points = plotPoints(v.points);
      if (points === null || points.length < 2) return null;
      if (v.xLabel !== undefined && !isText(v.xLabel, 40)) return null;
      if (v.yLabel !== undefined && !isText(v.yLabel, 40)) return null;
      if (v.shape !== undefined && !isText(v.shape, 60)) return null;
      const guide = plotGuide(v.guide);
      if (v.guide !== undefined && guide === null) return null;
      return withAnimation({
        action: "create_graph_plot" as const, id: v.id, points,
        ...(isText(v.xLabel, 40) ? { xLabel: v.xLabel.trim() } : {}),
        ...(isText(v.yLabel, 40) ? { yLabel: v.yLabel.trim() } : {}),
        ...(isText(v.shape, 60) ? { shape: v.shape.trim() } : {}),
        ...(guide ? { guide } : {}),
        ...(isText(v.title, 80) ? { title: v.title.trim() } : {}),
      }, v);
    }
    default:
      return null;
  }
}

// ---- Domain-aware structure payload parsers -------------------------------------------------------
// Bounded on purpose. A formula's symbol table is teaching content, so it is capped at a number of rows
// that still fits the board rather than at "whatever arrived"; a nine-symbol table would otherwise be
// emitted as nine objects that collide with everything else.

const DIRECTIONS = ["up", "down", "left", "right"] as const;
type ForceDirection = typeof DIRECTIONS[number];

function asDirection(value: unknown): ForceDirection | "" {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value) ? value as ForceDirection : "";
}

function formulaRows(value: unknown): Array<{ symbol: string; meaning: string; unit?: string }> | null {
  if (!Array.isArray(value)) return null;
  const rows = value.filter(isRecord)
    .map((row) => ({
      symbol: isText(row.symbol, 24) ? row.symbol.trim() : "",
      meaning: isText(row.meaning, 200) ? row.meaning.trim() : "",
      ...(isText(row.unit, 40) ? { unit: row.unit.trim() } : {}),
    }))
    // A row with no symbol cannot be pointed at; a row with no meaning is the decoration this structure
    // exists to replace. Both are dropped rather than rendered.
    .filter((row) => row.symbol.length > 0 && row.meaning.length > 0);
  return rows.slice(0, 8);
}

function forceVectors(value: unknown): Array<{ name: string; direction: ForceDirection; magnitude?: string; acts?: "centre" | "surface" }> | null {
  if (!Array.isArray(value)) return null;
  const forces = value.filter(isRecord)
    .map((entry) => ({
      name: isText(entry.name, 40) ? entry.name.trim() : "",
      direction: asDirection(entry.direction),
      ...(isText(entry.magnitude, 40) ? { magnitude: entry.magnitude.trim() } : {}),
      ...(entry.acts === "surface" ? { acts: "surface" as const } : {}),
    }))
    .filter((entry): entry is { name: string; direction: ForceDirection; magnitude?: string; acts?: "surface" } => entry.name.length > 0 && entry.direction.length > 0);
  return forces.slice(0, 8);
}

function motionVector(value: unknown): { label: string; direction: ForceDirection } | null {
  if (!isRecord(value)) return null;
  const direction = asDirection(value.direction);
  if (!isText(value.label, 40) || direction.length === 0) return null;
  return { label: value.label.trim(), direction: direction as ForceDirection };
}

const CIRCUIT_KINDS = ["resistor", "capacitor", "inductor", "source", "battery", "switch", "diode", "opamp", "ground"] as const;

function circuitElements(value: unknown): Array<{ label: string; kind: typeof CIRCUIT_KINDS[number]; value?: string }> | null {
  if (!Array.isArray(value)) return null;
  const elements = value.filter(isRecord)
    .map((entry) => ({
      label: isText(entry.label, 40) ? entry.label.trim() : "",
      kind: typeof entry.kind === "string" && (CIRCUIT_KINDS as readonly string[]).includes(entry.kind) ? entry.kind as typeof CIRCUIT_KINDS[number] : "",
      ...(isText(entry.value, 40) ? { value: entry.value.trim() } : {}),
    }))
    .filter((entry): entry is { label: string; kind: typeof CIRCUIT_KINDS[number]; value?: string } => entry.label.length > 0 && entry.kind.length > 0);
  return elements.slice(0, 10);
}

function plotPoints(value: unknown): Array<{ x: number; y: number; label?: string }> | null {
  if (!Array.isArray(value)) return null;
  const points = value.filter(isRecord)
    .map((point) => ({
      x: typeof point.x === "number" && Number.isFinite(point.x) ? point.x : Number.NaN,
      y: typeof point.y === "number" && Number.isFinite(point.y) ? point.y : Number.NaN,
      ...(isText(point.label, 40) ? { label: point.label.trim() } : {}),
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return points.slice(0, 24);
}

function plotGuide(value: unknown): { y: number; label: string } | null {
  if (!isRecord(value)) return null;
  if (typeof value.y !== "number" || !Number.isFinite(value.y)) return null;
  if (!isText(value.label, 40)) return null;
  return { y: value.y, label: value.label.trim() };
}

/** A bounded list of object ids, so `focus`/`dim` can never be used as a vector. */
const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= 64 && value.every(isId) ? (value as string[]) : null;

/** A bounded list of 1-based LINE NUMBERS, for the code lines a teacher is talking about. */
const intList = (value: unknown, min: number, maxLength: number): number[] | null =>
  Array.isArray(value)
  && value.length <= maxLength
  && value.every((entry) => isFiniteNumber(entry) && Number.isInteger(entry) && entry >= min && entry <= 999)
    ? (value as number[])
    : null;

// Explicit point coordinates for `move` are expressed via placement, but the model may also
// send { placement: { kind: "point", x, y } }. This guards the rare direct x/y form.
function hasPoint(value: Record<string, unknown>): boolean {
  return isCoord(value.x) && isCoord(value.y);
}


// Parses a step's visual_actions. `undefined` means "no visual actions" (=> []), while a present
// but malformed array returns null so the caller can reject/fall back instead of rendering junk.
export function parseVisualActions(value: unknown): VisualAction[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_VISUAL_ACTIONS_PER_STEP) return null;
  const parsed = value.map(parseVisualAction);
  if (parsed.some((action) => action === null)) return null;
  return parsed as VisualAction[];
}

/**
 * PARSES A STEP WITH PER-ACTION REPAIR.
 *
 * The contract this exists for: a teaching step must never be thrown away because one decorative
 * visual action is malformed. Each action is judged on its own; anything unusable is dropped with a
 * reason, and the surviving actions still teach. Two classes of repair are applied before giving up:
 *
 *   * a bad `animate` block is removed (the action still creates its object, it just does not animate)
 *   * a semantic structure with one bad node/edge is rebuilt from the parts that ARE valid
 *
 * `sceneObjects` is 0 here because the scene is not known at validation time; the engine fills in the
 * real count on the diagnostics it produces while applying the step.
 */
export function repairVisualActions(
  value: unknown,
  options: { maxActions?: number } = {},
): { actions: VisualAction[]; diagnostics: VisualActionDiagnostic[] } {
  const diagnostics: VisualActionDiagnostic[] = [];
  if (value === undefined || value === null) return { actions: [], diagnostics };
  if (!Array.isArray(value)) {
    diagnostics.push({ action: "unknown", reason: "visual_actions must be an array", outcome: "dropped", sceneObjects: 0, index: 0 });
    return { actions: [], diagnostics };
  }
  const maxActions = options.maxActions ?? MAX_VISUAL_ACTIONS_PER_STEP;
  const actions: VisualAction[] = [];
  // Ids already claimed in this batch. A derived id can collide when the teacher writes two objects with
  // the same opening words; a collision would silently overwrite one with the other, so it is numbered.
  const claimed = new Set<string>();
  value.forEach((raw, index) => {
    if (index >= maxActions) {
      diagnostics.push({ action: describeActionName(raw), reason: `beyond the ${maxActions}-action budget for one step`, outcome: "dropped", sceneObjects: 0, index });
      return;
    }
    const direct = parseVisualAction(raw);
    if (direct !== null) {
      claimed.add(targetOf(direct) ?? "");
      actions.push(direct);
      return;
    }
    const repaired = repairVisualAction(raw);
    if (repaired.action !== null) {
      const action = repaired.action;
      const unique = deDuplicate(targetOf(action), claimed);
      actions.push(unique && unique !== targetOf(action) ? ({ ...action, id: unique } as VisualAction) : action);
      claimed.add(unique ?? "");
      diagnostics.push({ action: action.action, target: unique, reason: repaired.reason, outcome: "repaired", sceneObjects: 0, index });
      return;
    }
    diagnostics.push({ action: describeActionName(raw), target: rawId(raw), reason: repaired.reason, outcome: "dropped", sceneObjects: 0, index });
  });
  return { actions, diagnostics };
}

/** Keeps a repaired id unique within one batch without renaming the objects that are already distinct. */
function deDuplicate(id: string | undefined, claimed: Set<string>): string | undefined {
  if (!id || !claimed.has(id)) return id;
  for (let suffix = 2; suffix < 20; suffix += 1) {
    const candidate = `${id}-${suffix}`;
    if (!claimed.has(candidate)) return candidate;
  }
  return id;
}

const describeActionName = (raw: unknown): string => (isRecord(raw) && isString(raw.action) ? raw.action : "unknown");
const rawId = (raw: unknown): string | undefined => (isRecord(raw) && isId(raw.id) ? raw.id : undefined);
const targetOf = (action: VisualAction): string | undefined => ("id" in action && typeof action.id === "string" ? action.id : undefined);

/**
 * Second attempt at one action, with only the faults a teacher would not notice being corrected.
 * Anything that would change WHAT is taught (a missing id, a dangling endpoint, an unknown action)
 * is left to the caller to drop.
 */
function repairVisualAction(raw: unknown): { action: VisualAction | null; reason: string } {
  if (!isRecord(raw) || !isString(raw.action)) return { action: null, reason: "action is not a recognised visual action" };
  const v = { ...raw };
  delete v.animate;
  const withoutAnimation = parseVisualAction(v);
  if (withoutAnimation !== null) return { action: withoutAnimation, reason: "the animation block was invalid; the action was applied without it" };

  // ---- TEACHING-INTENT REPAIRS -----------------------------------------------------------------
  // Code that arrives as a formula. `write_formula` is the only "show this text verbatim" action the
  // model was given, so a lesson explaining a swap routine puts `class Node { int val; ... }` into it
  // and the whole routine is thrown away as a malformed formula. Recognising source structurally and
  // re-routing it to the code block keeps the listing the teacher actually wrote.
  //
  // This is checked BEFORE the field-alias repair below, because the alias would otherwise rescue the
  // text into a perfectly valid formula and the listing would survive as centred maths.
  if (v.action === "write_formula") {
    const source = isString(v.formula) ? v.formula : isString(v.text) ? v.text : Array.isArray(v.values) ? v.values.filter(isString).join("\n") : "";
    if (source.length > 0 && looksLikeCode(source)) {
      const asCode = parseVisualAction({ ...v, action: "create_code_block", code: source });
      if (asCode !== null) return { action: asCode, reason: "the text was source code, so it was drawn as a code block" };
    }
  }

  // ---- FIELD-ALIAS REPAIRS -------------------------------------------------------------------
  // These are the shapes real providers actually produce when they are being helpful, and each one was
  // costing the student a whole visual. `target` and `id` name the same object; `text` and `formula`
  // are the same string. A highlight that says `{"action":"highlight","target":"arr1-c0"}` is a
  // perfectly clear instruction to light up cell 0 — dropping it because the key is spelled `target`
  // removes the one thing the teacher was pointing at.
  for (const [alias, canonical] of [["target", "id"], ["text", "formula"], ["label", "text"]] as const) {
    if (v[canonical] === undefined && v[alias] !== undefined) v[canonical] = v[alias];
  }
  const aliased = parseVisualAction(v);
  if (aliased !== null) return { action: aliased, reason: "a field name was normalised so the action could be applied" };

  // A connector/arrow that names both ends does not need the model to invent a handle for itself.
  if (v.id === undefined && isString(v.from) && isString(v.to) && v.from !== v.to) {
    v.id = `${v.from}-${v.to}-${typeof v.label === "string" && v.label ? slug(v.label) : "link"}`;
    const derived = parseVisualAction(v);
    if (derived !== null) return { action: derived, reason: "an id was derived from the two objects it joins" };
  }
  // A label points at its target, so the target's own id is a stable, collision-free handle.
  if (v.id === undefined && isString(v.target)) {
    v.id = `${v.target}-label`;
    const derived = parseVisualAction(v);
    if (derived !== null) return { action: derived, reason: "an id was derived from the object the label names" };
  }

  // An object that carries its own content does not need an invented handle either. This is the single
  // most expensive omission in real provider output: `{"action":"create_code_block","code":"…","title":
  // "Core Logic"}` with no id passes every structural check and is then thrown away, so the student is
  // told "here is the code" and sees nothing. The id is derived from the content the teacher wrote, which
  // makes it stable across steps — the listing can then be re-pointed instead of redrawn.
  if (v.id === undefined) {
    const contentId = derivedId(v);
    if (contentId) {
      v.id = contentId;
      const derived = parseVisualAction(v);
      if (derived !== null) return { action: derived, reason: "an id was derived from the content the teacher wrote" };
      delete v.id;
    }
  }

  // A message exchange between named participants is real teaching content even before any message is
  // drawn, so the participants alone are enough to keep the step.
  if (v.action === "create_sequence" && v.messages === undefined && isStringList(v.actors, 8, 40)) {
    const withEmptyMessages = parseVisualAction({ ...v, messages: [] });
    if (withEmptyMessages !== null) return { action: withEmptyMessages, reason: "the participants were kept and the message list left to be filled in" };
  }

  // ---- TEACHING-INTENT REPAIRS -----------------------------------------------------------------
  // Code that arrives as a formula. `write_formula` is the only "show this text verbatim" action the
  // model was given, so a lesson explaining a swap routine puts `class Node { int val; ... }` into it
  // and the whole routine is thrown away as a malformed formula. Recognising source structurally and
  // re-routing it to the code block keeps the listing the teacher actually wrote.
  if (v.action === "write_formula" && isString(v.formula) && looksLikeCode(v.formula)) {
    const asCode = parseVisualAction({ ...v, action: "create_code_block", code: v.formula });
    if (asCode !== null) return { action: asCode, reason: "the text was source code, so it was drawn as a code block" };
  }
  // A formula sent as an array of lines is a listing, not a formula.
  if (v.action === "write_formula" && Array.isArray(v.values)) {
    const lines = v.values.filter((entry): entry is string => isString(entry));
    if (lines.length > 0) {
      const asCode = parseVisualAction({ ...v, action: "create_code_block", code: lines.join("\n") });
      if (asCode !== null) return { action: asCode, reason: "the formula arrived as a list of lines, so it was drawn as a code block" };
    }
  }

  // A structure with one bad member is worth rebuilding: the surviving members still teach the idea.
  if (Array.isArray(v.nodes)) {
    const nodes = v.nodes.filter(isRawNode);
    const ids = new Set(nodes.map((node) => node.id));
    const edges = (Array.isArray(v.edges) ? v.edges : []).map(edgeOf).filter((edge) => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to);
    if (nodes.length > 0) {
      const rebuilt = parseVisualAction({ ...v, nodes, edges });
      if (rebuilt !== null) return { action: rebuilt, reason: "invalid nodes/edges were dropped; the rest of the structure was kept" };
    }
  }
  if (Array.isArray(v.values)) {
    const values = v.values.filter((entry): entry is string => isString(entry) && entry.trim().length > 0);
    if (values.length > 0) {
      const rebuilt = parseVisualAction({ ...v, values });
      if (rebuilt !== null) return { action: rebuilt, reason: "invalid values were dropped; the rest were kept" };
    }
  }
  if (Array.isArray(v.messages)) {
    const messages = v.messages.map(edgeOf).filter((message) => isId(message.from) && isId(message.to) && message.from !== message.to);
    const rebuilt = parseVisualAction({ ...v, messages });
    if (rebuilt !== null) return { action: rebuilt, reason: "messages that did not name two different participants were dropped" };
  }
  if (Array.isArray(v.events)) {
    const events = v.events.filter((event) => isRecord(event) && isText(event.label, 30) && isText(event.text, 80));
    if (events.length > 0) {
      const rebuilt = parseVisualAction({ ...v, events });
      if (rebuilt !== null) return { action: rebuilt, reason: "events that named no label and text were dropped; the rest were kept" };
    }
  }
  if (isRecord(v.left) && isRecord(v.right)) {
    const panel = (value: Record<string, unknown>) => (isRecord(value) && isString(value.title) && Array.isArray(value.items)
      ? { title: value.title, items: value.items.filter((item): item is string => isString(item) && item.trim().length > 0) }
      : null);
    const left = panel(v.left);
    const right = panel(v.right);
    if (left && right && left.items.length > 0 && right.items.length > 0) {
      const rebuilt = parseVisualAction({ ...v, left, right });
      if (rebuilt !== null) return { action: rebuilt, reason: "the comparison panels were rebuilt from their titles and items" };
    }
    // Two named sides with nothing under them still teach the contrast that is being set up; the title
    // is real content, so it becomes the first line of that side.
    if (left && right) {
      const withTitles = {
        ...v,
        left: { title: left.title, items: [left.title] },
        right: { title: right.title, items: [right.title] },
      };
      const rebuilt = parseVisualAction(withTitles);
      if (rebuilt !== null) return { action: rebuilt, reason: "each side of the comparison kept its title as its only point" };
    }
  }
  return { action: null, reason: "action is malformed and could not be repaired" };
}

/**
 * A readable, id-safe handle derived from what the teacher wrote.
 *
 * Only content that is itself teaching material is used — a title, a heading, the opening words of a
 * listing — so the handle stays meaningful and stable, which is what lets a later step re-point the
 * object (`set_code_pointer`, `highlight`) instead of drawing it again.
 */
function derivedId(value: Record<string, unknown>): string | undefined {
  const candidates: string[] = [];
  if (isString(value.title)) candidates.push(value.title);
  if (isString(value.text)) candidates.push(value.text);
  if (isString(value.formula)) candidates.push(value.formula);
  if (isString(value.code)) {
    // The first line with real content in it is the name a teacher would give the listing.
    const firstLine = value.code.split("\n").map((line) => line.trim()).find((line) => line.length > 0 && !/^[/*#\-=]{1,3}\s*$/.test(line));
    if (firstLine) candidates.push(firstLine);
  }
  if (Array.isArray(value.stages)) for (const stage of value.stages) if (isString(stage)) candidates.push(stage);
  if (Array.isArray(value.actors)) for (const actor of value.actors) if (isString(actor)) candidates.push(actor);
  if (Array.isArray(value.values)) for (const entry of value.values) if (isString(entry) && entry.trim().length > 0) candidates.push(entry);
  for (const candidate of candidates) {
    const text = candidate.split(/[\n.:;!?()]/)[0] ?? "";
    const id = slug(text);
    if (id.length >= 2 && id.length <= 40) return id;
  }
  return undefined;
}

/** A short, id-safe form of a label, so a derived id stays readable and unique. */
function slug(text: string): string {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned.slice(0, 24) || "link";
}

// Round-trips the scene the client sends back so the model can extend an existing diagram.
// Invalid objects are dropped (capped at MAX_OBJECTS) rather than failing the whole request.
export function parseVisualScene(value: unknown): VisualScene | null {
  if (value === undefined || value === null) return { objects: [], tick: 0 };
  if (!isRecord(value) || !Array.isArray(value.objects)) return null;
  const objects: VisualObject[] = [];
  for (const candidate of value.objects.slice(0, MAX_OBJECTS)) {
    if (!isRecord(candidate) || !isId(candidate.id) || !isString(candidate.kind)) return null;
    if (!isCoord(candidate.x) || !isCoord(candidate.y)) return null;
    if (!isSize(candidate.width) || !isSize(candidate.height)) return null;
    objects.push(candidate as unknown as VisualObject);
  }
  const tick = isInteger(value.tick) && value.tick >= 0 ? value.tick : 0;
  const theme = oneOf(VISUAL_THEMES, value.theme) ? (value.theme as VisualTheme) : undefined;
  const focusIds = idList(value.focusIds);
  return { objects, tick, ...(theme ? { theme } : {}), ...(focusIds && focusIds.length > 0 ? { focusIds } : {}) };
}

// First human-readable reason a visual action batch is invalid (development diagnostics only).
export function describeVisualActionError(value: unknown): string {
  if (value === undefined) return "No visual actions provided.";
  if (!Array.isArray(value)) return "visual_actions must be an array.";
  if (value.length > MAX_VISUAL_ACTIONS_PER_STEP) return `visual_actions exceeds the maximum of ${MAX_VISUAL_ACTIONS_PER_STEP} actions per step.`;
  for (let index = 0; index < value.length; index += 1) {
    const action = value[index];
    if (!isRecord(action) || !isString(action.action)) return `visual_actions[${index}] is missing a valid action name.`;
    if (parseVisualAction(action) === null) return `visual_actions[${index}] ("${action.action}") is malformed.`;
  }
  return "visual_actions could not be parsed.";
}

