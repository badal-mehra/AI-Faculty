// DETERMINISTIC 2D BOARD SCENARIOS.
//
// Each scenario is a real LESSON, written as the visual actions a teacher would emit: structure first,
// then one idea per step, with the animation that makes the change visible. They are replayed through the
// production engine, so they double as browser-acceptance fixtures and as living examples of the
// vocabulary the teaching model is expected to produce.
//
// Nothing here is rendered specially. If a scenario looks wrong, the board is wrong.
import type { VisualAction } from "./types";

/** Structural checklist used while reviewing a scenario; the action list itself is raw on purpose. */
export type DemoScenarioStep = VisualAction[] | unknown[];

export type DemoScenario = {
  id: string;
  title: string;
  /** What this scenario proves about the board, shown next to the board in the harness. */
  expectation: string;
  /** One line per step: what the teacher is saying while that step plays. */
  narration: string[];
  /** What a correct board must show (used by the harness and read during review). */
  checks: string[];
  /**
   * Raw actions, NOT typed: one scenario deliberately sends a malformed action to prove the step is
   * repaired rather than discarded, and the type system must not be allowed to hide that.
   */
  steps: unknown[][];
};

/** A scenario's steps as validated actions — what the engine actually receives. */
export type CompiledDemoStep = VisualAction[];

const ARRAY: DemoScenario = {
  id: "array",
  title: "Array of four cells",
  expectation: "four equal cells, indices, a real 2D array — not a biological cell",
  narration: [
    "An array is a row of boxes that live next to each other in memory, and the boxes are all the same size.",
    "Each box holds one value, and the position of the box IS its index.",
    "Here is the array again with the search target highlighted — this is how we find a value.",
    "Now I append 50 at the end: the whole row re-flows, and the new cell appears.",
    "Now I swap the last two cells — watch both boxes travel towards each other.",
    "Now I delete from the front — the tail slides back by one cell.",
  ],
  checks: [
    "four cells of identical size, left to right",
    "indices 0-3 sit under their own cells",
    "one cell can be focused while the rest recede",
    "append / swap / delete animate as movement, not a redraw",
  ],
  steps: [
    [{ action: "set_theme", theme: "computer-science" }, { action: "create_text", id: "a-title", text: "An array is a row of equal boxes", role: "title", placement: { kind: "anchor", anchor: "top" } }],
    [{ action: "create_array", id: "arr", values: ["10", "20", "30", "40"], indices: true, animate: { kind: "appear", durationMs: 520 } }],
    [{ action: "focus", ids: ["arr-c2"] }, { action: "pulse", id: "arr-c2", animate: { kind: "pulse", durationMs: 700 } }],
    [{ action: "wait", durationMs: 400 }, { action: "update_array", id: "arr", values: ["10", "20", "30", "40", "50"] }],
    [{ action: "wait", durationMs: 300 }, { action: "update_array", id: "arr", values: ["10", "20", "50", "40"] }],
    [{ action: "wait", durationMs: 300 }, { action: "update_array", id: "arr", values: ["20", "50", "40"] }],
  ],
};

const LINKED_LIST: DemoScenario = {
  id: "linked-list",
  title: "Singly linked list",
  expectation: "value | next compartments, HEAD, NULL, traversal highlight",
  narration: [
    "A linked list is a chain of boxes. Each box holds one value AND the address of the next box.",
    "The first box is the head of the list.",
    "Now a second node, 20. The next pointer of 10 must point at it.",
    "Now a third node, 30, chained the same way.",
    "The last node's next pointer is NULL — that is how the list knows it has ended.",
    "Traversal: I will walk the list one node at a time, HEAD first.",
  ],
  checks: [
    "each node is a value | next compartment",
    "next pointers leave the pointer compartment",
    "HEAD above the first node, NULL after the last",
    "traversal highlights one node at a time",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "l-title", text: "Linked list: boxes joined by pointers", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "ll-a", shape: "rounded_rectangle", semantic: "node", text: "10", width: 132, height: 66, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 250, y: 240 } },
      { action: "create_text", id: "ll-head", text: "HEAD", role: "annotation", size: 13, placement: { kind: "point", x: 250, y: 174 } },
      { action: "create_arrow", id: "ll-hl", from: "ll-head", to: "ll-a", kind: "pointer", animate: { kind: "draw", durationMs: 420 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "ll-b", shape: "rounded_rectangle", semantic: "node", text: "20", width: 132, height: 66, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 450, y: 240 } },
      { action: "create_arrow", id: "ll-e0", from: "ll-a", to: "ll-b", kind: "next_pointer", animate: { kind: "draw", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "ll-c", shape: "rounded_rectangle", semantic: "node", text: "30", width: 132, height: 66, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 650, y: 240 } },
      { action: "create_arrow", id: "ll-e1", from: "ll-b", to: "ll-c", kind: "next_pointer", animate: { kind: "draw", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_text", id: "ll-null", text: "NULL", role: "annotation", size: 13, placement: { kind: "point", x: 748, y: 240 } },
      { action: "create_arrow", id: "ll-null-link", from: "ll-c", to: "ll-null", kind: "next_pointer", animate: { kind: "draw", durationMs: 420 } },
    ],
    [
      { action: "wait", durationMs: 400 }, { action: "focus", ids: ["ll-a"] }, { action: "pulse", id: "ll-a", animate: { kind: "pulse", durationMs: 600 } },
      { action: "wait", durationMs: 900 }, { action: "focus", ids: ["ll-b"] }, { action: "pulse", id: "ll-b", animate: { kind: "pulse", durationMs: 600 } },
      { action: "wait", durationMs: 900 }, { action: "focus", ids: ["ll-c"] }, { action: "pulse", id: "ll-c", animate: { kind: "pulse", durationMs: 600 } },
    ],
  ],
};

const STACK: DemoScenario = {
  id: "stack",
  title: "Stack: push and pop",
  expectation: "one column, TOP over the live end, push above and pop from the top",
  narration: [
    "A stack is a stack of plates: you can only touch the top one.",
    "We push 20, so it lands ON TOP of 10 — a push always goes on top, never at the bottom.",
    "Then 30 on top again. TOP now points at 30, the only value we are allowed to read.",
    "Pop: 30 comes off the top and TOP moves back down to 20.",
    "One more pop leaves 10 alone, and TOP is on 10.",
  ],
  checks: [
    "equal rows inside one frame, read bottom-up",
    "TOP over the live end with a leader line",
    "a push adds a row ABOVE, a pop removes the top row",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "s-title", text: "Stack: last in, first out", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_container", id: "st-frame", width: 190, height: 224, placement: { kind: "point", x: 400, y: 306 } },
      { action: "create_shape", id: "st-s0", shape: "rectangle", semantic: "data", text: "10", width: 166, height: 66, fontSize: 20, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 372 } },
      { action: "create_text", id: "st-top", text: "TOP", role: "annotation", size: 13, placement: { kind: "point", x: 400, y: 317 } },
      { action: "create_arrow", id: "st-top-link", from: "st-top", to: "st-s0", kind: "pointer", animate: { kind: "draw", durationMs: 420 } },
    ],
    [
      { action: "wait", durationMs: 450 },
      // TOP moves up FIRST, then the new row is drawn into the space it vacated — the same order a
      // teacher would use, and the only order in which the row does not have to be shoved aside.
      { action: "move", id: "st-top", placement: { kind: "point", x: 400, y: 251 }, animate: { kind: "move", durationMs: 520 } },
      { action: "create_shape", id: "st-s1", shape: "rectangle", semantic: "data", text: "20", width: 166, height: 66, fontSize: 20, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 306 } },
      { action: "move", id: "st-top-link", placement: { kind: "point", x: 400, y: 306 }, animate: { kind: "move", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "move", id: "st-top", placement: { kind: "point", x: 400, y: 185 }, animate: { kind: "move", durationMs: 520 } },
      { action: "create_shape", id: "st-s2", shape: "rectangle", semantic: "data", text: "30", width: 166, height: 66, fontSize: 20, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 240 } },
      { action: "move", id: "st-top-link", placement: { kind: "point", x: 400, y: 240 }, animate: { kind: "move", durationMs: 520 } },
      { action: "wait", durationMs: 250 },
      { action: "focus", ids: ["st-s2"] },
      { action: "pulse", id: "st-s2", animate: { kind: "pulse", durationMs: 600 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "fade_out", id: "st-s2", animate: { kind: "disappear", durationMs: 420 } },
      { action: "remove", id: "st-s2" },
      { action: "move", id: "st-top", placement: { kind: "point", x: 400, y: 251 }, animate: { kind: "move", durationMs: 520 } },
      { action: "move", id: "st-top-link", placement: { kind: "point", x: 400, y: 306 }, animate: { kind: "move", durationMs: 520 } },
      { action: "focus", ids: ["st-s1"] },
    ],
    [
      { action: "wait", durationMs: 300 },
      { action: "fade_out", id: "st-s1", animate: { kind: "disappear", durationMs: 420 } },
      { action: "remove", id: "st-s1" },
      { action: "move", id: "st-top", placement: { kind: "point", x: 400, y: 317 }, animate: { kind: "move", durationMs: 520 } },
      { action: "move", id: "st-top-link", placement: { kind: "point", x: 400, y: 372 }, animate: { kind: "move", durationMs: 520 } },
      { action: "restore" },
      { action: "focus", ids: ["st-s0"] },
    ],
  ],
};

const QUEUE: DemoScenario = {
  id: "queue",
  title: "Queue: front and rear",
  expectation: "FRONT on the left, REAR on the right, enqueue then dequeue",
  narration: [
    "A queue is a line: you join at the back and leave from the front.",
    "FRONT is the value that leaves first; REAR is where new values arrive.",
    "Enqueue 4 at the rear — the line grows at the back, never the front.",
    "Dequeue removes the front value, and FRONT moves one place along.",
  ],
  checks: [
    "one row of equal cells",
    "FRONT above the leftmost cell, REAR above the rightmost",
    "dequeue advances FRONT rather than shifting the drawing",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "q-title", text: "Queue: first in, first out", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_queue", id: "q", values: ["1", "2", "3"], frontLabel: "FRONT", rearLabel: "REAR", animate: { kind: "appear", durationMs: 520 } },
    ],
    [{ action: "wait", durationMs: 400 }, { action: "focus", ids: ["q-q0"] }, { action: "pulse", id: "q-q0", animate: { kind: "pulse", durationMs: 600 } }],
    [
      { action: "wait", durationMs: 400 },
      // Enqueue: the new cell is placed relative to the rear cell, so it joins the line exactly.
      { action: "create_shape", id: "q-q3", shape: "rectangle", semantic: "data", text: "4", width: 76, height: 64, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "relative", relativeTo: "q-q2", side: "right", gap: 6 } },
      { action: "move", id: "q-rear", placement: { kind: "relative", relativeTo: "q-q3", side: "above", gap: 22 }, animate: { kind: "move", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "fade_out", id: "q-q0", animate: { kind: "disappear", durationMs: 400 } },
      { action: "remove", id: "q-q0" },
      // Dequeue: FRONT slides to the next value instead of the whole row shifting under it.
      { action: "move", id: "q-front", placement: { kind: "relative", relativeTo: "q-q1", side: "above", gap: 22 }, animate: { kind: "move", durationMs: 560 } },
      { action: "focus", ids: ["q-q1"] },
    ],
  ],
};

const BST: DemoScenario = {
  id: "bst",
  title: "Binary search tree",
  expectation: "a real tree: parents centred over children, smaller values on the left",
  narration: [
    "A binary search tree keeps one rule: everything smaller goes left, everything larger goes right.",
    "50 becomes the root.",
    "30 is smaller, so it goes on the LEFT of 50.",
    "70 is larger, so it goes on the RIGHT of 50.",
    "20 and 40 are both smaller than 30, so they hang below 30.",
    "The whole tree now satisfies the rule at every node.",
  ],
  checks: [
    "every parent is centred over its children",
    "smaller values really are on the left",
    "edges stay attached to their nodes",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "b-title", text: "Binary search tree", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "b-50", shape: "circle", semantic: "node", text: "50", width: 84, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 150 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "b-30", shape: "circle", semantic: "node", text: "30", width: 84, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 280, y: 280 } },
      { action: "create_arrow", id: "b-e0", from: "b-50", to: "b-30", kind: "parent_child", animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "b-70", shape: "circle", semantic: "node", text: "70", width: 84, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 520, y: 280 } },
      { action: "create_arrow", id: "b-e1", from: "b-50", to: "b-70", kind: "parent_child", animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "b-20", shape: "circle", semantic: "node", text: "20", width: 84, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 210, y: 410 } },
      { action: "create_arrow", id: "b-e2", from: "b-30", to: "b-20", kind: "parent_child", animate: { kind: "draw", durationMs: 420 } },
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "b-40", shape: "circle", semantic: "node", text: "40", width: 84, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 350, y: 410 } },
      { action: "create_arrow", id: "b-e3", from: "b-30", to: "b-40", kind: "parent_child", animate: { kind: "draw", durationMs: 420 } },
    ],
    [{ action: "wait", durationMs: 400 }, { action: "focus", ids: ["b-30"] }, { action: "pulse", id: "b-30", animate: { kind: "pulse", durationMs: 700 } }],
  ],
};

const GRAPH: DemoScenario = {
  id: "graph",
  title: "Graph with vertices and edges",
  expectation: "nodes, edges and a traversal that lights each vertex in turn",
  narration: [
    "A graph is a set of vertices joined by edges. There is no root and no order.",
    "Vertices A, B and C, with A-B and B-C.",
    "Now D and E: D hangs off C, and E hangs off A.",
    "Traversal: we walk from A and light each vertex as we reach it.",
  ],
  checks: [
    "every edge is attached to real vertices",
    "an edge that would cross a vertex is routed around it",
    "traversal highlights one vertex at a time",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "g-title", text: "Graph: vertices and edges", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "g-A", shape: "circle", semantic: "node", text: "A", width: 76, height: 76, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 220, y: 200 } },
      { action: "create_shape", id: "g-B", shape: "circle", semantic: "node", text: "B", width: 76, height: 76, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 400, y: 200 } },
      { action: "create_shape", id: "g-C", shape: "circle", semantic: "node", text: "C", width: 76, height: 76, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 580, y: 200 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_arrow", id: "g-AB", from: "g-A", to: "g-B", animate: { kind: "draw", durationMs: 460 } },
      { action: "wait", durationMs: 300 },
      { action: "create_arrow", id: "g-BC", from: "g-B", to: "g-C", animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "g-D", shape: "circle", semantic: "node", text: "D", width: 76, height: 76, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 580, y: 370 } },
      { action: "create_arrow", id: "g-CD", from: "g-C", to: "g-D", animate: { kind: "draw", durationMs: 420 } },
      { action: "create_shape", id: "g-E", shape: "circle", semantic: "node", text: "E", width: 76, height: 76, animate: { kind: "appear", durationMs: 420 }, placement: { kind: "point", x: 220, y: 370 } },
      { action: "create_arrow", id: "g-AE", from: "g-A", to: "g-E", animate: { kind: "draw", durationMs: 420 } },
    ],
    [
      { action: "wait", durationMs: 350 }, { action: "focus", ids: ["g-A"] }, { action: "pulse", id: "g-A", animate: { kind: "pulse", durationMs: 520 } },
      { action: "wait", durationMs: 800 }, { action: "focus", ids: ["g-B"] }, { action: "pulse", id: "g-B", animate: { kind: "pulse", durationMs: 520 } },
      { action: "wait", durationMs: 800 }, { action: "focus", ids: ["g-C"] }, { action: "pulse", id: "g-C", animate: { kind: "pulse", durationMs: 520 } },
      { action: "wait", durationMs: 800 }, { action: "focus", ids: ["g-D"] }, { action: "pulse", id: "g-D", animate: { kind: "pulse", durationMs: 520 } },
    ],
  ],
};

const TCP: DemoScenario = {
  id: "tcp",
  title: "TCP three-way handshake",
  expectation: "a sequence diagram: two lifelines, three messages in send order",
  narration: [
    "A TCP connection is not open by magic: the two sides agree with three messages.",
    "The client and the server each stand on their own lifeline.",
    "Message 1: the client sends SYN — \"shall we talk?\"",
    "Message 2: the server replies SYN + ACK — \"yes, and I heard you\".",
    "Message 3: the client sends ACK — \"I heard you too\". Now the connection is established.",
  ],
  checks: [
    "actors on one horizon with lifelines",
    "one message per row, in send order",
    "each arrow points from the sender to the receiver",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "tcp-title", text: "TCP three-way handshake", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_sequence", id: "tcp", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "SYN" }], animate: { kind: "appear", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      // Re-issuing the sequence keeps the actors where they are and adds only the new message row.
      { action: "create_sequence", id: "tcp", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "SYN" }, { from: "Server", to: "Client", label: "SYN + ACK" }], animate: { kind: "draw", durationMs: 560 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_sequence", id: "tcp", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "SYN" }, { from: "Server", to: "Client", label: "SYN + ACK" }, { from: "Client", to: "Server", label: "ACK" }], animate: { kind: "draw", durationMs: 560 } },
    ],
    [{ action: "wait", durationMs: 400 }, { action: "highlight_many", ids: ["tcp-m0", "tcp-m1", "tcp-m2"] }],
  ],
};

const BINARY_SEARCH: DemoScenario = {
  id: "binary-search",
  title: "Binary search",
  expectation: "array + target, middle highlighted, wrong half dimmed, next middle",
  narration: [
    "Binary search needs a SORTED array. Ours is 4, 8, 15, 16, 23, 42.",
    "We are looking for 16. Start in the middle: index 2 holds 15.",
    "15 is smaller than 16, so the whole left half is ruled out — we dim it.",
    "The next middle is index 4, holding 23.",
    "23 is larger, so the right half goes. The answer is index 3.",
  ],
  checks: [
    "the searched-for value is visibly the subject of the search",
    "each comparison lights one cell and dims a half",
    "the array never gets rebuilt while the search runs",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "bs-title", text: "Find 16 in a sorted array", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_array", id: "bs", values: ["4", "8", "15", "16", "23", "42"], indices: true, animate: { kind: "appear", durationMs: 480 } },
    ],
    [{ action: "wait", durationMs: 400 }, { action: "focus", ids: ["bs-c2"] }, { action: "highlight", id: "bs-c2" }, { action: "pulse", id: "bs-c2", animate: { kind: "pulse", durationMs: 600 } }],
    [
      { action: "wait", durationMs: 500 },
      { action: "dim", ids: ["bs-c0", "bs-c1"] },
      { action: "focus", ids: ["bs-c2", "bs-c3", "bs-c4", "bs-c5"] },
    ],
    [
      { action: "wait", durationMs: 500 },
      { action: "restore" },
      { action: "focus", ids: ["bs-c4"] },
      { action: "highlight", id: "bs-c4" },
      { action: "pulse", id: "bs-c4", animate: { kind: "pulse", durationMs: 600 } },
    ],
    [
      { action: "wait", durationMs: 500 },
      { action: "dim", ids: ["bs-c5"] },
      { action: "focus", ids: ["bs-c3"] },
      { action: "highlight", id: "bs-c3" },
      { action: "create_text", id: "bs-found", text: "found at index 3", role: "callout", size: 15, placement: { kind: "anchor", anchor: "bottom" } },
    ],
  ],
};

const RECURSION: DemoScenario = {
  id: "recursion",
  title: "Recursion: smaller problem, base case",
  expectation: "a call chain downwards, the base case called out, returns back up",
  narration: [
    "A recursive function calls itself on a SMALLER problem.",
    "fact(5) calls fact(4), one step smaller.",
    "fact(4) calls fact(3)…",
    "fact(1) is the BASE CASE — it returns immediately, with no further call.",
    "Now the answers come back: each frame adds its own number as the stack unwinds.",
  ],
  checks: [
    "call frames stacked downwards in call order",
    "the base case is unmistakably marked",
    "the return direction is opposite to the call direction",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "r-title", text: "Recursion: solve a smaller version", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "r0", shape: "rounded_rectangle", semantic: "process", text: "fact(5)", width: 176, height: 62, animate: { kind: "appear", durationMs: 440 }, placement: { kind: "point", x: 400, y: 120 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "r1", shape: "rounded_rectangle", semantic: "process", text: "fact(4)", width: 176, height: 62, animate: { kind: "appear", durationMs: 440 }, placement: { kind: "point", x: 400, y: 230 } },
      { action: "create_arrow", id: "rc0", from: "r0", to: "r1", label: "call", offset: 92, animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "r2", shape: "rounded_rectangle", semantic: "process", text: "fact(3)", width: 176, height: 62, animate: { kind: "appear", durationMs: 440 }, placement: { kind: "point", x: 400, y: 340 } },
      { action: "create_arrow", id: "rc1", from: "r1", to: "r2", label: "call", offset: 92, animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "r3", shape: "rounded_rectangle", semantic: "terminal", text: "fact(1) = 1", width: 176, height: 62, animate: { kind: "appear", durationMs: 440 }, placement: { kind: "point", x: 400, y: 450 } },
      { action: "create_arrow", id: "rc2", from: "r2", to: "r3", label: "call", offset: 92, animate: { kind: "draw", durationMs: 460 } },
      { action: "wait", durationMs: 250 },
      { action: "create_label", id: "r-base", target: "r3", text: "BASE CASE", side: "right" },
    ],
    [
      { action: "wait", durationMs: 500 },
      { action: "focus", ids: ["r3"] },
      { action: "create_arrow", id: "rr0", from: "r3", to: "r2", kind: "curved", label: "return 1", offset: -120, animate: { kind: "draw", durationMs: 460 } },
    ],
  ],
};

const CPU_PIPELINE: DemoScenario = {
  id: "cpu-pipeline",
  title: "CPU pipeline stages",
  expectation: "five stages in one row with flow arrows, and a packet travelling through them",
  narration: [
    "A CPU pipeline splits the work of one instruction into five stages.",
    "Fetch: get the instruction. Decode: work out what it means.",
    "Execute: do it. Memory: read or write data.",
    "Write Back: put the result where the rest of the program can see it.",
    "A single instruction walks through the stages one after another.",
  ],
  checks: [
    "five equal stages on one row",
    "flow arrows between consecutive stages only",
    "a packet travels the stage it is in",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "p-title", text: "The five stages of a CPU pipeline", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_pipeline", id: "cpu", stages: ["Fetch", "Decode", "Execute", "Memory", "Write Back"], animate: { kind: "appear", durationMs: 460 } },
    ],
    [{ action: "wait", durationMs: 450 }, { action: "focus", ids: ["cpu-p0", "cpu-p1"] }, { action: "pulse", id: "cpu-p0", animate: { kind: "pulse", durationMs: 560 } }],
    [{ action: "wait", durationMs: 500 }, { action: "restore" }, { action: "focus", ids: ["cpu-p2", "cpu-p3"] }, { action: "pulse", id: "cpu-p2", animate: { kind: "pulse", durationMs: 560 } }],
    [
      { action: "wait", durationMs: 500 },
      { action: "restore" },
      { action: "focus", ids: ["cpu-p4"] },
      { action: "pulse", id: "cpu-p4", animate: { kind: "pulse", durationMs: 560 } },
    ],
    [
      { action: "wait", durationMs: 500 },
      { action: "restore" },
      { action: "flow", id: "cpu-pa0", durationMs: 900 },
    ],
  ],
};

const HTTP: DemoScenario = {
  id: "http",
  title: "HTTP request and response",
  expectation: "client -> request -> server -> response -> client, with the payload travelling",
  narration: [
    "One HTTP request is a journey: the client asks, the server answers.",
    "The client sends a REQUEST carrying the path it wants.",
    "The server replies with a RESPONSE, and the status code says how it went.",
    "The response travels back to the client, and the exchange is finished.",
  ],
  checks: [
    "each message on its own row",
    "the travelling payload follows the arrow's direction",
    "labels do not collide with each other",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      { action: "create_text", id: "h-title", text: "One HTTP request and response", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_sequence", id: "http", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "GET /index.html" }], animate: { kind: "appear", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_sequence", id: "http", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "GET /index.html" }, { from: "Server", to: "Client", label: "200 OK" }], animate: { kind: "draw", durationMs: 560 } },
    ],
    [{ action: "wait", durationMs: 400 }, { action: "flow", id: "http-m0", durationMs: 900 }, { action: "focus", ids: ["http-m0", "http-m1"] }],
  ],
};

const MATRIX: DemoScenario = {
  id: "math-matrix",
  title: "A bar chart and its mean",
  expectation: "a maths diagram: measured bars, value labels, and the formula as part of the board",
  narration: [
    "Here is a bar chart: one bar per value, and the height IS the value.",
    "Four bars, each labelled with the number it stands for.",
    "The tallest bar is the maximum — 42.",
    "The mean of the four values is their sum divided by how many there are.",
  ],
  checks: [
    "each bar's height is proportional to its value",
    "every bar carries a label, none of them overlapping",
    "the formula is part of the diagram, styled as an emphasis line",
  ],
  steps: [
    [
      { action: "set_theme", theme: "mathematics" },
      { action: "create_text", id: "m-title", text: "Marks of four students", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "m-axis", shape: "line", role: "annotation", width: 620, height: 4, placement: { kind: "point", x: 400, y: 430 } },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "m-b1", shape: "rectangle", semantic: "data", width: 84, height: 96, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 250, y: 378 } },
      { action: "create_label", id: "m-v1", target: "m-b1", text: "12", side: "above" },
      { action: "create_shape", id: "m-b2", shape: "rectangle", semantic: "data", width: 84, height: 152, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "relative", relativeTo: "m-b1", side: "right", gap: 48 } },
      { action: "create_label", id: "m-v2", target: "m-b2", text: "19", side: "above" },
    ],
    [
      { action: "wait", durationMs: 350 },
      { action: "create_shape", id: "m-b3", shape: "rectangle", semantic: "data", width: 84, height: 232, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "relative", relativeTo: "m-b2", side: "right", gap: 48 } },
      { action: "create_label", id: "m-v3", target: "m-b3", text: "29", side: "above" },
      { action: "create_shape", id: "m-b4", shape: "rectangle", semantic: "data", width: 84, height: 336, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "relative", relativeTo: "m-b3", side: "right", gap: 48 } },
      { action: "create_label", id: "m-v4", target: "m-b4", text: "42", side: "above" },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "focus", ids: ["m-b4", "m-v4"] },
      { action: "highlight", id: "m-b4" },
      { action: "write_formula", id: "m-mean", formula: "mean = (12 + 19 + 29 + 42) / 4 = 25.5", role: "callout", size: 15, placement: { kind: "anchor", anchor: "bottom" } },
    ],
  ],
};

const PHYSICS: DemoScenario = {
  id: "physics-forces",
  title: "Forces on a block",
  expectation: "force vectors drawn from the object outward, each labelled with its symbol",
  narration: [
    "A block on a table has forces acting on it, drawn as vectors from the block itself.",
    "Weight pulls it DOWN, and its size is W = m g.",
    "The table pushes UP with an equal force, which is why the block does not fall.",
    "A horizontal push F accelerates it: F = m a.",
  ],
  checks: [
    "each force vector starts on the block and points outward",
    "each force is labelled with its symbol",
    "the equation is part of the diagram, not an afterthought",
  ],
  steps: [
    [
      { action: "set_theme", theme: "physics" },
      { action: "create_text", id: "ph-title", text: "Forces on a block", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "ph-block", shape: "rectangle", semantic: "component", text: "block", width: 176, height: 116, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 260 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "ph-down", shape: "point", semantic: "packet", width: 14, height: 14, placement: { kind: "point", x: 400, y: 460 } },
      { action: "create_arrow", id: "ph-w", from: "ph-block", to: "ph-down", label: "W = m g", animate: { kind: "draw", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "ph-up", shape: "point", semantic: "packet", width: 14, height: 14, placement: { kind: "point", x: 400, y: 92 } },
      { action: "create_arrow", id: "ph-n", from: "ph-block", to: "ph-up", label: "N", animate: { kind: "draw", durationMs: 520 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "ph-right", shape: "point", semantic: "packet", width: 14, height: 14, placement: { kind: "point", x: 660, y: 260 } },
      { action: "create_arrow", id: "ph-f", from: "ph-block", to: "ph-right", label: "F", animate: { kind: "draw", durationMs: 520 } },
      { action: "write_formula", id: "ph-eq", formula: "N = mg,   F = m a", role: "callout", size: 15, placement: { kind: "anchor", anchor: "bottom" } },
      { action: "focus", ids: ["ph-block", "ph-f", "ph-right"] },
    ],
  ],
};

const PROCESS: DemoScenario = {
  id: "generic-process",
  title: "Input → process → output",
  expectation: "a generic 2D process diagram: the fallback for any topic",
  narration: [
    "Almost every process can be drawn the same way: input, then the work, then the result.",
    "The INPUT is what we are given.",
    "The PROCESS is the work itself.",
    "The OUTPUT is what comes out — and it is the thing we actually wanted.",
  ],
  checks: [
    "three stages joined by arrows",
    "each stage is a measured box, not a default",
    "the board reads left to right",
  ],
  steps: [
    [
      { action: "set_theme", theme: "general" },
      { action: "create_text", id: "gp-title", text: "How every process works", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "gp-in", shape: "rounded_rectangle", semantic: "component", text: "Input", width: 160, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 200, y: 250 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "gp-work", shape: "rounded_rectangle", semantic: "process", text: "Process", width: 160, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 400, y: 250 } },
      { action: "create_arrow", id: "gp-a1", from: "gp-in", to: "gp-work", animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_shape", id: "gp-out", shape: "rounded_rectangle", semantic: "packet", text: "Output", width: 160, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 600, y: 250 } },
      { action: "create_arrow", id: "gp-a2", from: "gp-work", to: "gp-out", animate: { kind: "draw", durationMs: 460 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "focus", ids: ["gp-out"] },
      { action: "flow", id: "gp-a2", durationMs: 900 },
      { action: "pulse", id: "gp-out", animate: { kind: "pulse", durationMs: 600 } },
    ],
  ],
};

const INTERRUPTION: DemoScenario = {
  id: "interruption",
  title: "Interruption during animation",
  expectation: "an interrupted step stops safely and the lesson resumes without duplicate loops",
  narration: [
    "The teacher starts building a list.",
    "A long, deliberately slow build begins.",
    "— the student interrupts here —",
    "…and the lesson resumes with a clean, settled board.",
  ],
  checks: [
    "interrupting leaves no half-drawn connector",
    "resuming does not double any object",
    "the scene is identical to the uninterrupted one",
  ],
  steps: [
    [{ action: "set_theme", theme: "computer-science" }, { action: "create_text", id: "i-title", text: "A step interrupted mid-animation", role: "title", placement: { kind: "anchor", anchor: "top" } }],
    [{ action: "wait", durationMs: 700 }, { action: "create_shape", id: "i-a", shape: "rounded_rectangle", semantic: "node", text: "10", width: 132, height: 66, animate: { kind: "appear", durationMs: 2600 }, placement: { kind: "point", x: 250, y: 240 } }],
    [
      { action: "wait", durationMs: 700 },
      { action: "create_shape", id: "i-b", shape: "rounded_rectangle", semantic: "node", text: "20", width: 132, height: 66, animate: { kind: "appear", durationMs: 2600 }, placement: { kind: "point", x: 450, y: 240 } },
      { action: "create_arrow", id: "i-e", from: "i-a", to: "i-b", kind: "next_pointer", animate: { kind: "draw", durationMs: 2600 } },
    ],
  ],
};

const MALFORMED: DemoScenario = {
  id: "diagnostics",
  title: "Malformed actions are repaired, not swallowed",
  expectation: "one bad action is dropped with a reason; the rest of the step still teaches",
  narration: [
    "This step sends four actions, one of which is nonsense.",
    "The three good ones are applied exactly as asked.",
    "The bad one is reported with its reason — it is never silently ignored.",
  ],
  checks: [
    "the valid objects exist",
    "a diagnostic names the action and the reason",
    "the step is not thrown away because of one bad action",
  ],
  steps: [
    [
      { action: "set_theme", theme: "general" },
      { action: "create_text", id: "d-title", text: "Repair, do not discard", role: "title", placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "d-a", shape: "rounded_rectangle", text: "kept", width: 170, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 240, y: 250 } },
      { action: "create_shape", id: "d-hexapod", shape: "hexapod", text: "dropped" },
      { action: "create_shape", id: "d-b", shape: "rounded_rectangle", text: "kept too", width: 170, height: 84, animate: { kind: "appear", durationMs: 460 }, placement: { kind: "point", x: 560, y: 250 } },
    ],
    [
      { action: "wait", durationMs: 400 },
      { action: "create_arrow", id: "d-arrow", from: "d-a", to: "d-b", label: "still connected", animate: { kind: "draw", durationMs: 520 } },
      { action: "create_arrow", id: "d-ghost", from: "d-a", to: "d-missing" },
    ],
    [{ action: "wait", durationMs: 450 }, { action: "focus", ids: ["d-a", "d-b"] }],
  ],
};

const CODE: DemoScenario = {
  id: "code-trace",
  title: "A listing and the line being explained",
  expectation: "a numbered, syntax-coloured listing with the current line lit, beside the data it changes",
  narration: [
    "Here is the swap routine we are tracing, written out so you can follow it line by line.",
    "The numbers on the left are line numbers, so I can point at exactly one line.",
    "Line two saves the old value before anything overwrites it.",
    "Then the array really changes: the five moves right and the two moves left.",
  ],
  checks: [
    "the listing is numbered and indented exactly as written",
    "the line being explained is the one that is lit",
    "the data the code changes is on the board beside the listing",
  ],
  steps: [
    [
      { action: "set_theme", theme: "computer-science" },
      {
        action: "create_code_block",
        id: "cb-swap",
        language: "c",
        title: "swap(a, i, j)",
        code: "void swap(int a[], int i, int j) {\n  int t = a[i];\n  a[i] = a[j];\n  a[j] = t;\n}",
        highlightLines: [2],
        placement: { kind: "point", x: 330, y: 210 },
      },
      { action: "create_array", id: "cb-row", values: ["5", "2", "4", "1"], indices: true, placement: { kind: "anchor", anchor: "bottom" } },
    ],
    [
      { action: "wait", durationMs: 450 },
      { action: "create_text", id: "cb-note", text: "line 2 saves a[i] into t before anything overwrites it", role: "annotation", placement: { kind: "point", x: 250, y: 345 } },
      { action: "focus", ids: ["cb-swap"] },
    ],
    [
      { action: "wait", durationMs: 450 },
      { action: "update_array", id: "cb-row", values: ["2", "5", "4", "1"] },
      { action: "remove", id: "cb-note" },
      { action: "create_text", id: "cb-note", text: "5 > 2, so the two positions are swapped", role: "annotation", placement: { kind: "point", x: 250, y: 345 } },
    ],
    [
      { action: "wait", durationMs: 450 },
      { action: "update_array", id: "cb-row", values: ["2", "4", "5", "1"] },
      { action: "remove", id: "cb-note" },
      { action: "create_text", id: "cb-note", text: "5 > 4, so it swaps again", role: "annotation", placement: { kind: "point", x: 250, y: 345 } },
      // Move the execution pointer: same listing, now lit on the line that does the overwriting.
      { action: "remove", id: "cb-swap" },
      {
        action: "create_code_block",
        id: "cb-swap",
        language: "c",
        title: "swap(a, i, j)",
        code: "void swap(int a[], int i, int j) {\n  int t = a[i];\n  a[i] = a[j];\n  a[j] = t;\n}",
        highlightLines: [3],
        placement: { kind: "point", x: 330, y: 210 },
      },
    ],
    [
      { action: "wait", durationMs: 450 },
      { action: "update_array", id: "cb-row", values: ["2", "4", "1", "5"] },
      { action: "remove", id: "cb-note" },
      { action: "create_text", id: "cb-note", text: "5 has bubbled to the end of the row", role: "callout", placement: { kind: "point", x: 250, y: 345 } },
    ],
  ],
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  ARRAY,
  LINKED_LIST,
  STACK,
  QUEUE,
  BST,
  GRAPH,
  TCP,
  BINARY_SEARCH,
  RECURSION,
  CPU_PIPELINE,
  HTTP,
  MATRIX,
  PHYSICS,
  PROCESS,
  INTERRUPTION,
  MALFORMED,
  CODE,
];