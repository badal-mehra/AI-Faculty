// Board semantic anchoring regression tests.
//
// Validates the new TextAnchor-based 2D board text placement system:
//   A. BST — values inside nodes, labels near nodes, no text overlapping nodes
//   B. Array — values inside cells
//   C. Stack — values inside stack boxes
//   D. External label — label stays near its target
//   E. Multiple labels — labels do not overlap
//   F. Small object — text remains readable and does not escape
//   G. Delete — erase object → anchored text disappears
//   H. Move — move node → anchored text follows (resolved at render time)
//   I. Boundary — object near board edge → label remains visible
//   J. Connection — edge-anchored label resolves midpoint
//   K. Legacy {x,y} write_text still works (backward compatibility)
//   L. Anchor-based write_text renders at node position
//   M. Orphan safety — text with missing anchor target falls back gracefully
//   N. Multiple labels on same node do not stack on same point

import { executeBoardActions, getBoardState } from "../lib/board/engine";
import { emptyBoardState, BoardText } from "../lib/board/types";
import { resolveTextPosition, NODE_RADIUS } from "../lib/board/geometry";
import { parseBoardAction } from "../lib/teaching/validation";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` — ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BOARD_W = 800;
const BOARD_H = 520;
const MARGIN = 16;

function inBoard(x: number, y: number): boolean {
  return x >= MARGIN && x <= BOARD_W - MARGIN && y >= MARGIN && y <= BOARD_H - MARGIN;
}

function resolveItem(state: ReturnType<typeof executeBoardActions>, id: string) {
  const item = state.texts.find((t) => t.id === id);
  if (!item) return null;
  return resolveTextPosition(item as BoardText, state.nodes, state.edges);
}

// ─── A. BST ──────────────────────────────────────────────────────────────────

section("A. BST — values inside nodes, labels anchored correctly");
{
  const bst = executeBoardActions(emptyBoardState(), [
    { action: "clear" },
    { action: "draw_node", id: "node-50", value: "50" },
    { action: "draw_node", id: "node-30", value: "30", parentId: "node-50", side: "left" },
    { action: "connect", from: "node-50", to: "node-30" },
    { action: "draw_node", id: "node-70", value: "70", parentId: "node-50", side: "right" },
    { action: "connect", from: "node-50", to: "node-70" },
    { action: "draw_node", id: "node-20", value: "20", parentId: "node-30", side: "left" },
    { action: "connect", from: "node-30", to: "node-20" },
    { action: "draw_node", id: "node-40", value: "40", parentId: "node-30", side: "right" },
    { action: "connect", from: "node-30", to: "node-40" },
    { action: "draw_node", id: "node-60", value: "60", parentId: "node-70", side: "left" },
    { action: "connect", from: "node-70", to: "node-60" },
    { action: "draw_node", id: "node-80", value: "80", parentId: "node-70", side: "right" },
    { action: "connect", from: "node-70", to: "node-80" },
    // Labels anchored to their nodes
    { action: "write_text", id: "lbl-50", text: "50", anchor: { type: "object", id: "node-50", position: "inside" } },
    { action: "write_text", id: "lbl-30", text: "30", anchor: { type: "object", id: "node-30", position: "inside" } },
    { action: "write_text", id: "lbl-70", text: "70", anchor: { type: "object", id: "node-70", position: "inside" } },
    { action: "write_text", id: "lbl-60", text: "60", anchor: { type: "object", id: "node-60", position: "inside" } },
    // Annotation above a node
    { action: "write_text", id: "ann-60", text: "Target found", anchor: { type: "object", id: "node-60", position: "above" } },
  ]);

  const node50 = bst.nodes.find((n) => n.id === "node-50")!;
  const node60 = bst.nodes.find((n) => n.id === "node-60")!;

  const lbl50 = resolveItem(bst, "lbl-50");
  const lbl60 = resolveItem(bst, "lbl-60");
  const ann60 = resolveItem(bst, "ann-60");

  check("BST: 7 nodes created", bst.nodes.length === 7);
  check("BST: 6 edges created", bst.edges.length === 6);
  check("BST: 5 text items created", bst.texts.length === 5);

  check("BST: label-50 resolves to node-50 centre", lbl50 !== null && Math.abs(lbl50.x - node50.x) < 1 && Math.abs(lbl50.y - node50.y) < 1);
  check("BST: label-60 resolves to node-60 centre", lbl60 !== null && Math.abs(lbl60.x - node60.x) < 1 && Math.abs(lbl60.y - node60.y) < 1);

  check("BST: annotation-60 is ABOVE node-60 (y < node.y)", ann60 !== null && ann60.y < node60.y, ann60 ? `ann60.y=${ann60.y}, node60.y=${node60.y}` : "null");
  check("BST: annotation-60 stays in board viewport", ann60 !== null && inBoard(ann60.x, ann60.y));

  // Inside labels must be within node radius of the node centre.
  const allInsideLabels = ["lbl-50", "lbl-30", "lbl-70", "lbl-60"].map((id) => resolveItem(bst, id));
  const nodeMap = new Map(bst.nodes.map((n) => [n.id, n]));
  const labelIds = ["lbl-50", "lbl-30", "lbl-70", "lbl-60"];
  const nodeIds = ["node-50", "node-30", "node-70", "node-60"];
  const allInsideCorrect = labelIds.every((lblId, i) => {
    const pos = resolveItem(bst, lblId);
    const node = nodeMap.get(nodeIds[i])!;
    return pos !== null && Math.hypot(pos.x - node.x, pos.y - node.y) < 2;
  });
  check("BST: all inside labels are at their node centres", allInsideCorrect);
}

// ─── B. Array ─────────────────────────────────────────────────────────────────

section("B. Array — values stay inside cells");
{
  const arr = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "cell-0", value: "10", x: 200, y: 260 },
    { action: "draw_node", id: "cell-1", value: "20", x: 350, y: 260 },
    { action: "draw_node", id: "cell-2", value: "30", x: 500, y: 260 },
    { action: "write_text", id: "lbl-0", text: "10", anchor: { type: "object", id: "cell-0", position: "inside" } },
    { action: "write_text", id: "lbl-1", text: "20", anchor: { type: "object", id: "cell-1", position: "inside" } },
    { action: "write_text", id: "lbl-2", text: "30", anchor: { type: "object", id: "cell-2", position: "inside" } },
  ]);

  for (let i = 0; i <= 2; i++) {
    const cell = arr.nodes.find((n) => n.id === `cell-${i}`)!;
    const pos = resolveItem(arr, `lbl-${i}`);
    check(`Array: cell-${i} label resolves to its node`, pos !== null && Math.abs(pos.x - cell.x) < 2 && Math.abs(pos.y - cell.y) < 2);
    check(`Array: cell-${i} label stays in board`, pos !== null && inBoard(pos.x, pos.y));
  }
}

// ─── C. Stack ─────────────────────────────────────────────────────────────────

section("C. Stack — values stay inside stack boxes");
{
  const stack = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "stk-0", value: "A", x: 400, y: 400 },
    { action: "draw_node", id: "stk-1", value: "B", x: 400, y: 320 },
    { action: "draw_node", id: "stk-2", value: "C", x: 400, y: 240 },
    { action: "write_text", id: "slbl-0", text: "A", anchor: { type: "object", id: "stk-0", position: "inside" } },
    { action: "write_text", id: "slbl-1", text: "B", anchor: { type: "object", id: "stk-1", position: "inside" } },
    { action: "write_text", id: "slbl-2", text: "C", anchor: { type: "object", id: "stk-2", position: "inside" } },
  ]);

  for (let i = 0; i <= 2; i++) {
    const node = stack.nodes.find((n) => n.id === `stk-${i}`)!;
    const pos = resolveItem(stack, `slbl-${i}`);
    check(`Stack: slot-${i} label resolves inside its node`, pos !== null && Math.abs(pos.x - node.x) < 2 && Math.abs(pos.y - node.y) < 2);
  }
}

// ─── D. External label ────────────────────────────────────────────────────────

section("D. External label — stays near target");
{
  const ext = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "n1", value: "X", x: 400, y: 260 },
    { action: "write_text", id: "ext-above", text: "above label", anchor: { type: "object", id: "n1", position: "above" } },
    { action: "write_text", id: "ext-below", text: "below label", anchor: { type: "object", id: "n1", position: "below" } },
    { action: "write_text", id: "ext-left",  text: "left label",  anchor: { type: "object", id: "n1", position: "left" } },
    { action: "write_text", id: "ext-right", text: "right label", anchor: { type: "object", id: "n1", position: "right" } },
  ]);

  const node = ext.nodes[0];
  const above = resolveItem(ext, "ext-above");
  const below = resolveItem(ext, "ext-below");
  const left  = resolveItem(ext, "ext-left");
  const right = resolveItem(ext, "ext-right");

  check("External: above label is above the node", above !== null && above.y < node.y, `above.y=${above?.y}, node.y=${node.y}`);
  check("External: below label is below the node", below !== null && below.y > node.y);
  check("External: left label is left of the node",  left  !== null && left.x  < node.x);
  check("External: right label is right of the node", right !== null && right.x > node.x);
  check("External: labels are not at node centre",
    [above, below, left, right].every((p) => p !== null && Math.hypot(p!.x - node.x, p!.y - node.y) > NODE_RADIUS));
  check("External: all labels stay in board", [above, below, left, right].every((p) => p !== null && inBoard(p!.x, p!.y)));
}

// ─── E. Multiple labels ───────────────────────────────────────────────────────

section("E. Multiple labels on same node use distinct positions");
{
  const ml = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "hub", value: "hub", x: 400, y: 260 },
    { action: "write_text", id: "ml-a", text: "A", anchor: { type: "object", id: "hub", position: "above" } },
    { action: "write_text", id: "ml-b", text: "B", anchor: { type: "object", id: "hub", position: "below" } },
    { action: "write_text", id: "ml-l", text: "L", anchor: { type: "object", id: "hub", position: "left" } },
    { action: "write_text", id: "ml-r", text: "R", anchor: { type: "object", id: "hub", position: "right" } },
  ]);

  const positions = ["ml-a", "ml-b", "ml-l", "ml-r"].map((id) => resolveItem(ml, id));
  const keys = positions.map((p) => p !== null ? `${Math.round(p.x)},${Math.round(p.y)}` : "null");
  check("Multiple labels occupy 4 distinct positions", new Set(keys).size === 4, keys.join(" | "));
}

// ─── F. Small object (board minimum) ─────────────────────────────────────────

section("F. Small object — text resolves without escaping");
{
  const small = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "tiny", value: "T", x: 400, y: 260 },
    { action: "write_text", id: "tiny-lbl", text: "tiny", anchor: { type: "object", id: "tiny", position: "inside" } },
    { action: "write_text", id: "tiny-ann", text: "annotation", anchor: { type: "object", id: "tiny", position: "above" } },
  ]);

  const lbl = resolveItem(small, "tiny-lbl");
  const ann = resolveItem(small, "tiny-ann");
  check("Small: label resolves inside board", lbl !== null && inBoard(lbl.x, lbl.y));
  check("Small: annotation resolves inside board", ann !== null && inBoard(ann.x, ann.y));
}

// ─── G. Delete — anchored text disappears ────────────────────────────────────

section("G. Delete — erasing object removes its anchored texts");
{
  const del = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "target", value: "T", x: 400, y: 260 },
    { action: "write_text", id: "lbl-target", text: "value", anchor: { type: "object", id: "target", position: "inside" } },
    { action: "write_text", id: "ann-target", text: "annotation", anchor: { type: "object", id: "target", position: "above" } },
    { action: "write_text", id: "standalone", text: "standalone", anchor: { type: "point", x: 200, y: 100 } },
    { action: "erase", target: "target" },
  ]);

  check("Delete: erased node is removed", del.nodes.length === 0);
  check("Delete: lbl anchored to erased node is removed", !del.texts.some((t) => t.id === "lbl-target"));
  check("Delete: ann anchored to erased node is removed", !del.texts.some((t) => t.id === "ann-target"));
  check("Delete: standalone point-anchored text survives", del.texts.some((t) => t.id === "standalone"));
}

// ─── H. Move — anchored text follows its host ─────────────────────────────────

section("H. Move — anchored text position follows the moved node");
{
  // Board engine move_node updates node.x/y. The renderer resolves anchor at draw time
  // so the text always reflects the new node position.
  const before = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "mover", value: "M", x: 200, y: 200 },
    { action: "write_text", id: "move-lbl", text: "M", anchor: { type: "object", id: "mover", position: "inside" } },
  ]);
  const after = executeBoardActions(before, [
    { action: "move_node", id: "mover", x: 600, y: 350 },
  ]);

  const posBefore = resolveTextPosition(before.texts[0] as BoardText, before.nodes, before.edges);
  const posAfter  = resolveTextPosition(after.texts[0]  as BoardText, after.nodes,  after.edges);

  check("Move: label was at original node position", Math.abs(posBefore.x - 200) < 2 && Math.abs(posBefore.y - 200) < 2, `was ${posBefore.x},${posBefore.y}`);
  check("Move: label resolves to new node position after move", Math.abs(posAfter.x - 600) < 2 && Math.abs(posAfter.y - 350) < 2, `got ${posAfter.x},${posAfter.y}`);
}

// ─── I. Boundary — near-edge placement stays visible ─────────────────────────

section("I. Boundary — text near board edge stays visible");
{
  const edge = executeBoardActions(emptyBoardState(), [
    // Node very close to the top-left corner.
    { action: "draw_node", id: "corner", value: "C", x: 80, y: 80 },
    { action: "write_text", id: "corner-above", text: "up", anchor: { type: "object", id: "corner", position: "above" } },
    { action: "write_text", id: "corner-left",  text: "lf", anchor: { type: "object", id: "corner", position: "left" } },
  ]);

  const above = resolveItem(edge, "corner-above");
  const left  = resolveItem(edge, "corner-left");
  check("Boundary: above label is clamped inside board", above !== null && inBoard(above.x, above.y));
  check("Boundary: left  label is clamped inside board", left  !== null && inBoard(left.x,  left.y));
}

// ─── J. Connection label ──────────────────────────────────────────────────────

section("J. Connection label — edge anchor resolves to midpoint");
{
  const conn = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "from", value: "F", x: 200, y: 260 },
    { action: "draw_node", id: "to",   value: "T", x: 600, y: 260 },
    { action: "connect", from: "from", to: "to", id: "edge-ft" },
    { action: "write_text", id: "edge-lbl", text: "label", anchor: { type: "edge", id: "edge-ft", position: "midpoint" } },
  ]);

  const pos = resolveItem(conn, "edge-lbl");
  // Midpoint of the two nodes = x:400, y:260 (plus perpendicular nudge)
  check("Connection: edge label resolves near midpoint (x ≈ 400)", pos !== null && Math.abs(pos.x - 400) < 30, pos ? `x=${pos.x}` : "null");
  check("Connection: edge label stays in board", pos !== null && inBoard(pos.x, pos.y));
}

// ─── K. Legacy {x,y} write_text still works ──────────────────────────────────

section("K. Legacy {x,y} write_text backward compatibility");
{
  // The validator should accept old format and convert to a point anchor.
  const legacyAction = parseBoardAction({ action: "write_text", id: "legacy", text: "old", x: 300, y: 200 });
  check("Legacy: {x,y} write_text parses successfully", legacyAction !== null);
  check("Legacy: parsed action has anchor field", legacyAction !== null && "anchor" in legacyAction);
  if (legacyAction && "anchor" in legacyAction) {
    const anchor = (legacyAction as { anchor: { type: string; x?: number; y?: number } }).anchor;
    check("Legacy: anchor type is 'point'", anchor.type === "point");
    check("Legacy: anchor preserves original x", anchor.x === 300);
    check("Legacy: anchor preserves original y", anchor.y === 200);
  }

  // Full round-trip through the engine.
  const legacy = executeBoardActions(emptyBoardState(), [
    { action: "write_text", id: "legxy", text: "hello", anchor: { type: "point", x: 300, y: 200 } },
  ]);
  const pos = resolveItem(legacy, "legxy");
  check("Legacy: point anchor resolves to stored coordinates", pos !== null && Math.abs(pos.x - 300) < 2 && Math.abs(pos.y - 200) < 2);
}

// ─── L. Anchor-based write_text renders at node position ─────────────────────

section("L. Anchor-based write_text is placed at the node, not at 0,0");
{
  const anc = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "anc-node", value: "42", x: 550, y: 330 },
    { action: "write_text", id: "anc-txt", text: "42", anchor: { type: "object", id: "anc-node", position: "inside" } },
  ]);
  const pos = resolveItem(anc, "anc-txt");
  check("Anchor: text resolves to node position, not origin", pos !== null && Math.abs(pos.x - 550) < 2 && Math.abs(pos.y - 330) < 2, pos ? `${pos.x},${pos.y}` : "null");
  check("Anchor: text stored x/y are within board", anc.texts[0].x > 0 && anc.texts[0].y > 0);
}

// ─── M. Orphan safety ─────────────────────────────────────────────────────────

section("M. Orphan safety — text with missing anchor target falls back gracefully");
{
  // Text anchored to a node that does not (yet) exist — engine accepts it,
  // renderer falls back to the stored x/y so the text at least appears somewhere.
  const orphan = executeBoardActions(emptyBoardState(), [
    { action: "write_text", id: "orphan", text: "orphan", anchor: { type: "object", id: "nonexistent-node", position: "inside" } },
  ]);
  check("Orphan: text is stored even when anchor target does not exist", orphan.texts.length === 1);

  const pos = resolveTextPosition(orphan.texts[0] as BoardText, orphan.nodes, orphan.edges);
  check("Orphan: resolve returns a valid in-board position (fallback)", inBoard(pos.x, pos.y));
}

// ─── N. Multiple labels same node don't share exact position ──────────────────

section("N. Multiple labels on same node — distinct semantic positions");
{
  const positions = ["inside", "above", "below", "left", "right"] as const;
  const actions: Parameters<typeof executeBoardActions>[1] = [
    { action: "draw_node", id: "multi-hub", value: "H", x: 400, y: 260 },
    ...positions.map((pos, i) => ({
      action: "write_text" as const,
      id: `multi-${pos}`,
      text: pos,
      anchor: { type: "object" as const, id: "multi-hub", position: pos },
    })),
  ];
  const multi = executeBoardActions(emptyBoardState(), actions);
  const resolvedPoints = positions.map((pos) => {
    const item = multi.texts.find((t) => t.id === `multi-${pos}`)!;
    return resolveTextPosition(item as BoardText, multi.nodes, multi.edges);
  });
  const keys = resolvedPoints.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`);
  check("Multiple: 5 semantic positions yield 5 distinct resolved points", new Set(keys).size === 5, keys.join(" | "));

  // All points must be in board bounds.
  check("Multiple: all resolved points are inside board", resolvedPoints.every((p) => inBoard(p.x, p.y)));
}

// ─── O. getBoardState serialises anchors correctly ───────────────────────────

section("O. getBoardState — anchor is preserved through serialisation");
{
  const src = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "sn", value: "S", x: 300, y: 200 },
    { action: "write_text", id: "sa", text: "S", anchor: { type: "object", id: "sn", position: "inside" } },
  ]);
  const clone = getBoardState(src);
  check("Serialise: anchor type preserved", clone.texts[0].anchor.type === "object");
  check("Serialise: anchor id preserved", (clone.texts[0].anchor as { type: "object"; id: string }).id === "sn");
  check("Serialise: clone is independent (deep copy)", clone.texts !== src.texts);
}

// ─── P. Edge deletion removes edge-anchored text ─────────────────────────────

section("P. Edge deletion — edge-anchored text is also removed");
{
  const edgeDel = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "p1", value: "P1", x: 200, y: 260 },
    { action: "draw_node", id: "p2", value: "P2", x: 600, y: 260 },
    { action: "connect", from: "p1", to: "p2", id: "edge-p" },
    { action: "write_text", id: "edge-ann", text: "edge text", anchor: { type: "edge", id: "edge-p", position: "midpoint" } },
    { action: "write_text", id: "node-ann", text: "node text", anchor: { type: "object", id: "p1", position: "above" } },
    { action: "erase", target: "edge-p" },
  ]);

  check("Edge delete: edge is removed", edgeDel.edges.length === 0);
  check("Edge delete: edge-anchored text is removed", !edgeDel.texts.some((t) => t.id === "edge-ann"));
  check("Edge delete: node-anchored text survives", edgeDel.texts.some((t) => t.id === "node-ann"));
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
