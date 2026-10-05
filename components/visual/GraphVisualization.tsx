"use client";

// GRAPH VISUALIZATION — the existing node/line board, now named as ONE visualization type of the
// visualization engine instead of being treated as the universal board. Behaviour is unchanged:
// it simply delegates to the existing, untouched <Board> component and board engine.
import { Board } from "../board/Board";
import type { BoardState } from "@/lib/board/types";

export function GraphVisualization({ state, onErase }: { state: BoardState; onErase: (id: string) => void }) {
  return <Board state={state} onErase={onErase} />;
}
