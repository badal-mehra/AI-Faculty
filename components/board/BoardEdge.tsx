"use client";

import { BoardEdge as Edge, BoardNode } from "@/lib/board/types";

type Props = { edge: Edge; nodes: BoardNode[]; onErase: (id: string) => void };

export function BoardEdge({ edge, nodes, onErase }: Props) {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const radius = 33;
  const x1 = from.x + (dx / length) * radius;
  const y1 = from.y + (dy / length) * radius;
  const x2 = to.x - (dx / length) * radius;
  const y2 = to.y - (dy / length) * radius;

  return <line className="board-edge" x1={x1} y1={y1} x2={x2} y2={y2} onDoubleClick={() => onErase(edge.id)} />;
}
