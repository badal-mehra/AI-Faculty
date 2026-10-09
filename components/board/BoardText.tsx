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

const LINE_HEIGHT_RATIO = 1.45;

export function BoardText({ item, nodes, edges, texts, highlighted, onErase }: Props) {
  // Resolve the semantic anchor to actual SVG coordinates at render time.
  // This ensures text always follows its host object — no stale absolute positions.
  const { x, y } = resolveTextPosition(item, nodes, edges, texts);
  const className = `board-text${highlighted ? " is-highlighted" : ""}`;
  const fontSize = item.fontSize ?? 23;
  const lineHeight = fontSize * LINE_HEIGHT_RATIO;

  // Support multi-line text separated by newlines or pipe characters
  const lines = item.text.split(/\n|\|/).map((line) => line.trim()).filter(Boolean);

  if (lines.length <= 1) {
    return (
      <text
        className={className}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        onDoubleClick={() => onErase(item.id)}
      >
        {item.text}
      </text>
    );
  }

  // Multi-line: vertically center the text block
  const totalHeight = (lines.length - 1) * lineHeight;
  const startY = y - totalHeight / 2;

  return (
    <text
      className={className}
      x={x}
      textAnchor="middle"
      fontSize={fontSize}
      onDoubleClick={() => onErase(item.id)}
    >
      {lines.map((line, i) => (
        <tspan
          key={i}
          x={x}
          y={startY + i * lineHeight}
          dominantBaseline="middle"
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}
