"use client";

import { BoardEdge as Edge, BoardNode } from "@/lib/board/types";
import { NODE_RADIUS } from "@/lib/board/geometry";

type Props = { edge: Edge; nodes: BoardNode[]; onErase: (id: string) => void };

export function BoardEdge({ edge, nodes, onErase }: Props) {
  const from = nodes.find((node) => node.id === edge.from);
  const to = nodes.find((node) => node.id === edge.to);
  if (!from || !to) return null;

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Use the actual NODE_RADIUS + a tiny gap so the line doesn't overlap the stroke
  const radius = NODE_RADIUS + 2;
  const x1 = from.x + (dx / length) * radius;
  const y1 = from.y + (dy / length) * radius;
  // Pull back a bit more at the target so the arrowhead doesn't overlap the circle
  const x2 = to.x - (dx / length) * (radius + 6);
  const y2 = to.y - (dy / length) * (radius + 6);

  // Don't render a zero-length edge (self-loop or identical positions)
  if (length < radius * 2) return null;

  return (
    <line
      className="board-edge"
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      markerEnd="url(#board-arrowhead)"
      onDoubleClick={() => onErase(edge.id)}
    />
  );
}
