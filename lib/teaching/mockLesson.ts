// DEVELOPMENT ONLY — Mock Teaching Mode lesson data.
//
// This module holds a deterministic, offline Binary Search Tree lesson used to test the
// full teaching pipeline when the real Gemini API is unavailable.
//
// IMPORTANT: each entry is a RAW teaching response (the same unvalidated shape Gemini
// returns). It is intentionally typed loosely and is ALWAYS pushed through
// `parseTeachingResponse()` before it is sent to the classroom, so the existing
// validation, board actions and SVG board renderer are exercised exactly like the
// real /api/teaching pipeline. Nothing here bypasses validation or the board engine.

export type MockTeachingStep = {
  speech: string;
  board_actions: Array<Record<string, unknown>>;
  lesson_step: number;
  next_step: number;
};

export const MOCK_TEACHING_STEPS: MockTeachingStep[] = [
  {
    speech: "Aaj hum Binary Search Tree samjhenge. Sabse pehle ek root node 50 banate hain.",
    board_actions: [
      { action: "clear" },
      { action: "draw_node", id: "node-50", value: "50" },
    ],
    lesson_step: 1,
    next_step: 2,
  },
  {
    speech: "Ab hum 30 insert karte hain. 30, 50 se chhota hai, isliye left side mein jayega.",
    board_actions: [
      { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
      { action: "connect", from: "node-50", to: "node-30" },
      { action: "highlight", target: "node-30" },
      { action: "write_text", id: "text-30-lt-50", text: "30 < 50", x: 120, y: 120 },
    ],
    lesson_step: 2,
    next_step: 3,
  },
  {
    speech: "Ab 70 ko insert karte hain. 70, 50 se bada hai, isliye right side mein jayega.",
    board_actions: [
      { action: "draw_node", id: "node-70", value: "70", parentId: "node-50", side: "right" },
      { action: "connect", from: "node-50", to: "node-70" },
      { action: "highlight", target: "node-70" },
      { action: "write_text", id: "text-70-gt-50", text: "70 > 50", x: 560, y: 120 },
    ],
    lesson_step: 3,
    next_step: 4,
  },
  {
    speech: "Ab 20 ko insert karte hain. Pehle 20 ko 50 se compare karenge, phir 30 se.",
    board_actions: [
      { action: "draw_node", id: "node-20", value: "20", parentId: "node-30", side: "left" },
      { action: "connect", from: "node-30", to: "node-20" },
      { action: "highlight", target: "node-20" },
    ],
    lesson_step: 4,
    next_step: 5,
  },
  {
    speech: "Finally 40 ko insert karte hain. 40, 50 se chhota hai lekin 30 se bada hai.",
    board_actions: [
      { action: "draw_node", id: "node-40", value: "40", parentId: "node-30", side: "right" },
      { action: "connect", from: "node-30", to: "node-40" },
      { action: "highlight", target: "node-40" },
    ],
    lesson_step: 5,
    next_step: 6,
  },
];

// Served once the deterministic lesson is finished so "Next Step" stays stable and idempotent.
export const MOCK_TEACHING_COMPLETE: MockTeachingStep = {
  speech: "Mock lesson complete. 50 root hai, 30 aur 70 uske children hain, aur 20 aur 40 leaves hain. Poore 5 steps same validation aur board engine se guzre.",
  board_actions: [],
  lesson_step: 6,
  next_step: 6,
};
