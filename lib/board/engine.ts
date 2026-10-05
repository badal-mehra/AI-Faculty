import { BoardAction, BoardState, emptyBoardState } from "./types";
import { pointAnchor, resolveFreeTextPosition } from "./geometry";

const edgeId = (from: string, to: string) => `edge:${from}:${to}`;

const BOARD_BOUNDS = { minX: 48, maxX: 752, minY: 48, maxY: 472 };
const isCoordinate = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const inBounds = (x: number, y: number) => x >= BOARD_BOUNDS.minX && x <= BOARD_BOUNDS.maxX && y >= BOARD_BOUNDS.minY && y <= BOARD_BOUNDS.maxY;
const defaultPosition = (index: number) => index === 0
  ? { x: 400, y: 150 }
  : { x: 180 + ((index - 1) % 4) * 150, y: 290 + Math.floor((index - 1) / 4) * 130 };

export function resolveNodePosition(state: BoardState, action: Extract<BoardAction, { action: "draw_node" }>) {
  if (isCoordinate(action.x) && isCoordinate(action.y)) return inBounds(action.x, action.y) ? { x: action.x, y: action.y } : null;
  if (action.x !== undefined || action.y !== undefined) return null;
  const parent = action.parentId ? state.nodes.find((node) => node.id === action.parentId) : undefined;
  if (parent) {
    const position = { x: parent.x + (action.side === "right" ? 150 : -150), y: parent.y + 130 };
    return inBounds(position.x, position.y) ? position : null;
  }
  const fallback = defaultPosition(state.nodes.length);
  return inBounds(fallback.x, fallback.y) ? fallback : null;
}

// The engine is deliberately UI-agnostic: it receives serializable actions and returns state.
export function executeBoardAction(state: BoardState, action: BoardAction): BoardState {
  switch (action.action) {
    case "clear":
      return emptyBoardState();

    case "draw_node": {
      if (!action.id.trim() || !action.value.trim() || state.nodes.some((node) => node.id === action.id)) return state;
      const position = resolveNodePosition(state, action);
      if (!position) return state;
      return {
        ...state,
        nodes: [...state.nodes, {
          id: action.id,
          value: action.value,
          ...position,
        }],
      };
    }

    case "connect": {
      const id = action.id ?? edgeId(action.from, action.to);
      const hasEndpoints = state.nodes.some((n) => n.id === action.from) && state.nodes.some((n) => n.id === action.to);
      if (!hasEndpoints || action.from === action.to || state.edges.some((edge) => edge.id === id)) return state;
      return { ...state, edges: [...state.edges, { id, from: action.from, to: action.to }] };
    }

    case "write_text": {
      if (!action.id.trim() || !action.text.trim() || state.texts.some((text) => text.id === action.id)) return state;
      // The anchor field carries the semantic position. For "point" anchors we validate that
      // the coordinates are inside the board. For object/edge anchors we always accept them
      // since the target may not exist yet (e.g., the step draws the node and the label in the
      // same batch, and order is not guaranteed).
      const anchor = action.anchor;
      let fallbackX = 400;
      let fallbackY = 200;
      if (anchor.type === "point") {
        if (!inBounds(anchor.x, anchor.y)) return state;
        fallbackX = anchor.x;
        fallbackY = anchor.y;
      } else if (anchor.type === "object") {
        // Compute a reasonable stored position from the live nodes.
        const node = state.nodes.find((n) => n.id === anchor.id);
        if (node) { fallbackX = node.x; fallbackY = node.y; }
      }
      return {
        ...state,
        texts: [...state.texts, {
          id: action.id,
          text: action.text,
          anchor,
          x: fallbackX,
          y: fallbackY,
          ...(action.fontSize !== undefined ? { fontSize: action.fontSize } : {}),
          ...(action.maxWidth !== undefined ? { maxWidth: action.maxWidth } : {}),
        }],
      };
    }

    case "highlight":
      return [...state.nodes, ...state.edges, ...state.texts].some((item) => item.id === action.target)
        ? { ...state, highlights: state.highlights.includes(action.target) ? state.highlights : [...state.highlights, action.target] }
        : state;

    case "move_node":
      return inBounds(action.x, action.y) && state.nodes.some((node) => node.id === action.id)
        ? { ...state, nodes: state.nodes.map((node) => node.id === action.id ? { ...node, x: action.x, y: action.y } : node) }
        : state;

    case "erase":
      return {
        nodes: state.nodes.filter((node) => node.id !== action.target),
        edges: state.edges.filter((edge) => edge.id !== action.target && edge.from !== action.target && edge.to !== action.target),
        // Remove text if: its own id matches OR it is semantically anchored to the erased object.
        texts: state.texts.filter((text) => {
          if (text.id === action.target) return false;
          if (text.anchor.type === "object" && text.anchor.id === action.target) return false;
          if (text.anchor.type === "edge" && text.anchor.id === action.target) return false;
          return true;
        }),
        highlights: state.highlights.filter((id) => id !== action.target),
      };
  }
}

export function executeBoardActions(state: BoardState, actions: BoardAction[]): BoardState {
  return separateFreeText(actions.reduce(executeBoardAction, state));
}

// A free (point-anchored) annotation names nothing, so its stored position is a starting wish rather
// than a contract: after every batch each one is moved to the nearest spot where it overlaps neither
// a node nor another label. Object- and edge-anchored text keeps its resolved position, because those
// are recomputed from their target on every render. Deterministic: the same actions, same layout.
function separateFreeText(state: BoardState): BoardState {
  if (state.texts.length === 0) return state;
  const placed = [...state.texts];
  for (let index = 0; index < placed.length; index += 1) {
    const item = placed[index];
    const position = resolveFreeTextPosition(item, { nodes: state.nodes, texts: placed });
    if (position.x !== item.x || position.y !== item.y) {
      placed[index] = { ...item, x: position.x, y: position.y };
    }
  }
  return { ...state, texts: placed };
}

// Returns a clone safe to serialize/send to a teaching service without exposing React state.
export function getBoardState(state: BoardState): BoardState {
  return {
    nodes: state.nodes.map((node) => ({ ...node })),
    edges: state.edges.map((edge) => ({ ...edge })),
    texts: state.texts.map((text) => ({ ...text, anchor: { ...text.anchor } })),
    highlights: [...state.highlights],
  };
}

// Re-export for convenience — tests and callers can import pointAnchor from here.
export { pointAnchor };
