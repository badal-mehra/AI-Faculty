"use client";

import { BoardEdge, BoardNode, BoardText as TextItem } from "@/lib/board/types";
import { resolveTextPosition } from "@/lib/board/geometry";

type Props = {
  item: TextItem;
  nodes: BoardNode[];
  edges: BoardEdge[];
  // Every label on the board, so two labels attached to the same object can be kept apart.
  texts: TextItem[];
  highlighted: boolean;
  onErase: (id: string) => void;
};

export function BoardText({ item, nodes, edges, texts, highlighted, onErase }: Props) {
  // Resolve the semantic anchor to actual SVG coordinates at render time.
  // This ensures text always follows its host object — no stale absolute positions.
  const { x, y } = resolveTextPosition(item, nodes, edges, texts);
  const className = `board-text${highlighted ? " is-highlighted" : ""}`;
  return (
    <text
      className={className}
      x={x}
      y={y}
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={item.fontSize}
      onDoubleClick={() => onErase(item.id)}
    >
      {item.text}
    </text>
  );
}
