export type BoardNode = { id: string; value: string; x: number; y: number };
export type BoardEdge = { id: string; from: string; to: string };

export type TextAnchor =
  | { type: "object"; id: string; position: "inside" | "above" | "below" | "left" | "right" | "center" }
  | { type: "edge"; id: string; position: "midpoint" | "start" | "end" | "offset"; offset?: number }
  | { type: "point"; x: number; y: number };

export type BoardText = {
  id: string;
  text: string;
  anchor: TextAnchor;
  x: number;
  y: number;
  fontSize?: number;
  maxWidth?: number;
};

export type BoardState = {
  nodes: BoardNode[];
  edges: BoardEdge[];
  texts: BoardText[];
  highlights: string[];
};

export type BoardAction =
  | { action: "draw_node"; id: string; value: string; x?: number; y?: number; parentId?: string; side?: "left" | "right" }
  | { action: "connect"; from: string; to: string; id?: string }
  | { action: "write_text"; id: string; text: string; anchor: TextAnchor; fontSize?: number; maxWidth?: number }
  | { action: "highlight"; target: string }
  | { action: "erase"; target: string }
  | { action: "move_node"; id: string; x: number; y: number }
  | { action: "clear" };

export const emptyBoardState = (): BoardState => ({
  nodes: [],
  edges: [],
  texts: [],
  highlights: [],
});
