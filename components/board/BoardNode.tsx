"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { BoardNode as Node } from "@/lib/board/types";
import { NODE_RADIUS } from "@/lib/board/geometry";

// Must match .node-label in app/globals.css; it is the size a value is drawn at when it fits.
const LABEL_FONT = 21;

// A node value can be longer than a two-digit number ("Index: 0", "node-42"). The label is centred
// in the circle, so it only has to fit the chord the circle offers at the top and bottom of the
// text. Anything wider is scaled down to that chord rather than spilling outside the node.
function fittedFontSize(label: SVGTextElement): number {
  const box = label.getBBox();
  if (!(box.width > 0) || !(box.height > 0)) return LABEL_FONT;
  const half = box.height / 2;
  const chord = 2 * Math.sqrt(Math.max(1, NODE_RADIUS * NODE_RADIUS - half * half));
  if (box.width <= chord) return LABEL_FONT;
  return Math.max(9, Math.floor(LABEL_FONT * (chord / box.width)));
}

type Props = { node: Node; highlighted: boolean; onErase: (id: string) => void };

export function BoardNode({ node, highlighted, onErase }: Props) {
  const labelRef = useRef<SVGTextElement | null>(null);
  const [fontSize, setFontSize] = useState(LABEL_FONT);

  // Measured after layout, so the real glyph width decides whether the value still fits its node.
  useLayoutEffect(() => {
    if (labelRef.current) setFontSize(fittedFontSize(labelRef.current));
  }, [node.value]);

  return (
    <g
      transform={`translate(${node.x} ${node.y})`}
      onDoubleClick={() => onErase(node.id)}
      role="img"
      aria-label={`Node: ${node.value}`}
    >
      <g className="board-node">
        {/* Halo ring for highlighted state */}
        {highlighted && <circle className="node-halo" r={NODE_RADIUS + 15} />}
        {/* Main node circle */}
        <circle
          className={`node-circle${highlighted ? " is-highlighted" : ""}`}
          r={NODE_RADIUS}
        />
        {/* Node label — centred both horizontally and vertically */}
        <text
          ref={labelRef}
          className="node-label"
          style={{ fontSize }}
          textAnchor="middle"
          dominantBaseline="middle"
          dy="0"
        >
          {node.value}
        </text>
      </g>
    </g>
  );
}