"use client";

import { BoardEdge } from "./BoardEdge";
import { BoardNode } from "./BoardNode";
import { BoardText } from "./BoardText";
import { BoardState } from "@/lib/board/types";

export function Board({ state, onErase }: { state: BoardState; onErase: (id: string) => void }) {
  return (
    <section className="board-shell" aria-label="Digital teaching board">
      <div className="board-heading">
        <span className="status-dot" />
        <span>Live teaching board</span>
        <span>Double-click any item to erase</span>
      </div>
      <svg
        className="board-canvas"
        viewBox="0 0 800 520"
        role="img"
        aria-label="Interactive SVG teaching board"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle chalk-grid texture */}
          <pattern id="chalk-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(226,232,240,.045)" strokeWidth="1" />
          </pattern>
          {/* Arrowhead marker for directed edges */}
          <marker
            id="board-arrowhead"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 1 L 9 5 L 0 9 L 2.5 5 Z" fill="#bce5c8" />
          </marker>
          {/* Glow filter for highlighted nodes */}
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background grid */}
        <rect width="800" height="520" fill="url(#chalk-grid)" />

        {/* Edges drawn first (under nodes) */}
        {state.edges.map((edge) => (
          <BoardEdge key={edge.id} edge={edge} nodes={state.nodes} onErase={onErase} />
        ))}

        {/* Nodes */}
        {state.nodes.map((node) => (
          <BoardNode
            key={node.id}
            node={node}
            highlighted={state.highlights.includes(node.id)}
            onErase={onErase}
          />
        ))}

        {/* Text labels — on top of everything */}
        {state.texts.map((item) => (
          <BoardText
            key={item.id}
            item={item}
            nodes={state.nodes}
            edges={state.edges}
            texts={state.texts}
            highlighted={state.highlights.includes(item.id)}
            onErase={onErase}
          />
        ))}

        {/* Empty state message */}
        {!state.nodes.length && !state.texts.length && (
          <text
            className="empty-board"
            x="400"
            y="260"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            Choose an action to begin the lesson
          </text>
        )}
      </svg>
    </section>
  );
}
