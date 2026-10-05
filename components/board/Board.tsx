"use client";

import { BoardEdge } from "./BoardEdge";
import { BoardNode } from "./BoardNode";
import { BoardText } from "./BoardText";
import { BoardState } from "@/lib/board/types";

export function Board({ state, onErase }: { state: BoardState; onErase: (id: string) => void }) {
  return (
    <section className="board-shell" aria-label="Digital teaching board">
      <div className="board-heading"><span className="status-dot" /> Live teaching board <span>Double-click any item to erase</span></div>
      <svg className="board-canvas" viewBox="0 0 800 520" role="img" aria-label="Interactive SVG teaching board">
        <defs>
          <pattern id="chalk-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(226,232,240,.045)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="800" height="520" fill="url(#chalk-grid)" />
        {state.edges.map((edge) => <BoardEdge key={edge.id} edge={edge} nodes={state.nodes} onErase={onErase} />)}
        {state.nodes.map((node) => <BoardNode key={node.id} node={node} highlighted={state.highlights.includes(node.id)} onErase={onErase} />)}
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
        {!state.nodes.length && !state.texts.length && <text className="empty-board" x="400" y="266" textAnchor="middle">Choose an action to begin the lesson</text>}
      </svg>
    </section>
  );
}
