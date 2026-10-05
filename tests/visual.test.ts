// Visualization-engine tests (dependency-free Node runner; compiled by tsconfig.test.json).
//   1 valid create_shape   2 invalid create_shape   3 valid create_arrow   4 invalid coordinates
//   5 invalid animation duration   6 sequential visual actions   7 move animation
//   8 highlight animation   9 clear/remove  10 general semantic layout guarantees
//   11 existing Graph actions still work   12 existing BST lesson still works
//   15 layout safety: anchor slots, free-spot search, automatic connection lanes
//   16 scene round-trip contract (the Ask flow)
import { emptyVisualScene, VisualAction, VisualObject, VisualScene } from "../lib/visual/types";
import { applyVisualAction, applyVisualActions, applyVisualActionsDetailed, getVisualScene, settleVisualScene } from "../lib/visual/engine";
import { parseVisualAction, parseVisualActions, parseVisualScene, repairVisualActions } from "../lib/visual/validate";
import { executeBoardActions } from "../lib/board/engine";
import { emptyBoardState } from "../lib/board/types";
import { parseBoardAction, parseTeachingLessonResponse, parseTeachingRequest, parseTeachingResponse } from "../lib/teaching/validation";
import { MOCK_TEACHING_COMPLETE, MOCK_TEACHING_STEPS } from "../lib/teaching/mockLesson";
import { connectionEndpoints, connectionLabelPoint, routeConnection } from "../lib/visual/geometry";
import { fitLabelInBox } from "../lib/visual/labelFit";
import { compileArray, compileCodeBlock, compileSequence, compileStack, layoutTree } from "../lib/visual/layout";
import { highlightCode, highlightCodeLine, looksLikeCode } from "../lib/visual/code";
import { detectRepresentationIntent } from "../lib/teaching/representation";
import { selectAssetsForLesson } from "../lib/teaching/assetSelection";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }
const byId = (scene: VisualScene, id: string): VisualObject | undefined => scene.objects.find((object) => object.id === id);
const inViewport = (object: VisualObject): boolean => object.x >= 28 && object.x <= 772 && object.y >= 28 && object.y <= 492;
const actions = (raw: unknown[]) => parseVisualActions(raw);
const replay = (scene: VisualScene, steps: unknown[][]): VisualScene =>
  steps.reduce((current, raw) => {
    const parsed = parseVisualActions(raw);
    return parsed === null ? current : applyVisualActions(current, parsed);
  }, scene);
const boxesOverlapPx = (a: VisualObject, b: VisualObject, pad = 0): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 + pad && Math.abs(a.y - b.y) < (a.height + b.height) / 2 + pad;
// Objects that actually occupy the board (connections are derived geometry, not blockers).
const solids = (scene: VisualScene): VisualObject[] => scene.objects.filter((object) => object.kind !== "arrow" && object.kind !== "connector");
// A container is a FRAME: something sitting inside it is intentional, not an overlap.
const overlapsPair = (a: VisualObject, b: VisualObject, pad = -4): boolean => {
  if (!boxesOverlapPx(a, b, pad)) return false;
  const frame = a.kind === "container" ? a : b.kind === "container" ? b : null;
  if (!frame) return true;
  const other = frame === a ? b : a;
  return Math.abs(other.x - frame.x) > frame.width / 2 + 2 || Math.abs(other.y - frame.y) > frame.height / 2 + 2;
};
const overlappingPairs = (scene: VisualScene): string[] => {
  const list = solids(scene);
  const pairs: string[] = [];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    if (overlapsPair(list[i], list[j])) pairs.push(`${list[i].id}<->${list[j].id}`);
  }
  return pairs;
};

section("1. Valid create_shape");
{
  const parsed = parseVisualAction({ action: "create_shape", id: "client", shape: "rectangle", text: "CLIENT", width: 200, height: 100, placement: { kind: "anchor", anchor: "left" } });
  check("parses a well-formed create_shape", parsed !== null && parsed.action === "create_shape");
  const scene = applyVisualAction(emptyVisualScene(), parsed!);
  check("applies the shape to the scene", scene.objects.length === 1 && scene.objects[0].id === "client");
  check("stores the shape label", scene.objects[0].text === "CLIENT" && scene.objects[0].shape === "rectangle");
  check("clamps the shape inside the viewport", inViewport(scene.objects[0]));
  const clamped = applyVisualAction(emptyVisualScene(), { action: "create_shape", id: "far", shape: "circle", placement: { kind: "point", x: 5000, y: 5000 } });
  check("clamps explicit coordinates", clamped.objects.length === 1 && inViewport(clamped.objects[0]));
}

section("2. Invalid create_shape");
{
  check("rejects a missing shape", parseVisualAction({ action: "create_shape", id: "x" }) === null);
  check("rejects an unknown shape", parseVisualAction({ action: "create_shape", id: "x", shape: "blob" }) === null);
  check("accepts every shape the renderer can actually draw", ["square", "capsule", "triangle", "pentagon", "polygon", "point", "marker"].every((shape) => parseVisualAction({ action: "create_shape", id: "x", shape }) !== null));
  check("rejects a missing id", parseVisualAction({ action: "create_shape", shape: "circle" }) === null);
  check("rejects an oversized shape", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", width: 5000 }) === null);
  check("rejects a negative shape size", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", width: -20 }) === null);
}

section("3. Valid create_arrow");
{
  const parsed = actions([
    { action: "create_container", id: "client", text: "CLIENT", placement: { kind: "anchor", anchor: "left" } },
    { action: "create_container", id: "server", text: "SERVER", placement: { kind: "anchor", anchor: "right" } },
    { action: "create_arrow", id: "a1", from: "client", to: "server", label: "SYN" },
  ]);
  check("parses the action batch", parsed !== null && parsed.length === 3);
  const scene = applyVisualActions(emptyVisualScene(), parsed!);
  const arrow = byId(scene, "a1");
  check("creates the arrow object", arrow !== undefined && arrow.kind === "arrow");
  check("arrow keeps live endpoint references", arrow?.refs?.from === "client" && arrow?.refs?.to === "server" && arrow?.text === "SYN");
  const dangling = applyVisualActions(scene, [{ action: "create_arrow", id: "a2", from: "ghost", to: "server" }]);
  check("skips an arrow with a missing endpoint", byId(dangling, "a2") === undefined);
  check("rejects an arrow from an object to itself", parseVisualAction({ action: "create_arrow", id: "a3", from: "client", to: "client" }) === null);
}

section("4. Invalid coordinates");
{
  check("rejects NaN coordinates", parseVisualAction({ action: "move", id: "x", placement: { kind: "point", x: Number.NaN, y: 0 } }) === null);
  check("rejects infinite coordinates", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", placement: { kind: "point", x: Number.POSITIVE_INFINITY, y: 0 } }) === null);
  check("rejects absurd coordinates", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", placement: { kind: "point", x: 1e9, y: 0 } }) === null);
  check("rejects non-numeric coordinates", parseVisualAction({ action: "move", id: "x", placement: { kind: "point", x: "10", y: 0 } }) === null);
  check("rejects a negative relative gap", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", placement: { kind: "relative", relativeTo: "a", side: "right", gap: -5 } }) === null);
}

section("5. Invalid animation duration");
{
  check("rejects a negative duration", parseVisualAction({ action: "pulse", id: "x", animate: { kind: "pulse", durationMs: -1 } }) === null);
  check("rejects a duration beyond the cap", parseVisualAction({ action: "pulse", id: "x", animate: { kind: "pulse", durationMs: 9000 } }) === null);
  check("rejects a non-numeric duration", parseVisualAction({ action: "wait", durationMs: "soon" }) === null);
  check("rejects an unknown animation kind", parseVisualAction({ action: "pulse", id: "x", animate: { kind: "explode", durationMs: 100 } }) === null);
  check("accepts a valid duration", parseVisualAction({ action: "wait", durationMs: 500 }) !== null);
}


section("6. Sequential visual actions (timeline)");
{
  const parsed = actions([
    { action: "create_container", id: "svr", text: "SERVER", placement: { kind: "anchor", anchor: "right" } },
    { action: "create_shape", id: "pkt", shape: "rounded_rectangle", semantic: "packet", text: "SYN", placement: { kind: "point", x: 200, y: 200 } },
    { action: "wait", durationMs: 500 },
    { action: "animate_path", id: "pkt", to: "svr", durationMs: 1200 },
  ]);
  check("parses the sequence", parsed !== null && parsed.length === 4);
  const scene = applyVisualActions(emptyVisualScene(), parsed!);
  const pkt = byId(scene, "pkt");
  check("target object exists", pkt !== undefined);
  check("wait offsets the following animation", pkt?.motion?.kind === "travel" && pkt?.motion?.delayMs === 500);
  check("travel records a from/to delta", pkt?.motion === undefined ? false : pkt.motion.fromX !== pkt.motion.toX);
  check("travel duration is bounded", (pkt?.motion?.durationMs ?? 0) === 1200);
  check("scene holds both objects", scene.objects.length === 2);
}

section("7. Move animation");
{
  const parsed = actions([
    { action: "create_shape", id: "a", shape: "circle", placement: { kind: "point", x: 200, y: 200 } },
    { action: "move", id: "a", placement: { kind: "point", x: 500, y: 300 }, animate: { kind: "move", durationMs: 400 } },
  ]);
  const scene = applyVisualActions(emptyVisualScene(), parsed!);
  const moved = byId(scene, "a");
  check("move updates the position", moved?.x === 500 && moved?.y === 300);
  check("move records motion from the previous position", moved?.motion?.kind === "move" && moved?.motion?.fromX === 200 && moved?.motion?.fromY === 200);
  check("move records the destination", moved?.motion?.toX === 500 && moved?.motion?.toY === 300);
}

section("8. Highlight animation");
{
  const parsed = actions([
    { action: "create_container", id: "c", text: "CLIENT" },
    { action: "highlight", id: "c" },
  ]);
  const scene = applyVisualActions(emptyVisualScene(), parsed!);
  const object = byId(scene, "c");
  check("highlight marks emphasis", object?.emphasis === true);
  check("highlight records a highlight motion", object?.motion?.kind === "highlight");
  const missing = applyVisualActions(emptyVisualScene(), [{ action: "highlight", id: "ghost" }]);
  check("highlight skips a missing target", missing.objects.length === 0);
}

section("9. Clear / remove");
{
  const parsed = actions([
    { action: "create_shape", id: "a", shape: "circle" },
    { action: "create_shape", id: "b", shape: "circle", placement: { kind: "anchor", anchor: "right" } },
    { action: "remove", id: "a" },
  ]);
  const scene = applyVisualActions(emptyVisualScene(), parsed!);
  check("remove deletes only the target", scene.objects.length === 1 && scene.objects[0].id === "b");
  const cleared = applyVisualAction(scene, { action: "clear" });
  check("clear empties the scene", cleared.objects.length === 0);
  check("scene still validates after clear", applyVisualActions(cleared, [{ action: "create_text", id: "t", text: "hello" }]).objects.length === 1);
}


section("10. General semantic layout guarantees (two actors, three messages)");
{
  // TCP-shaped, but expressed ONLY through the general schema: the model never supplies a lane
  // offset and never supplies coordinates for the messages. Layout is the engine's job.
  const scene = replay(emptyVisualScene(), [
    [
      { action: "create_text", id: "title", text: "Handshake", size: 24, placement: { kind: "anchor", anchor: "top" } },
      { action: "create_container", id: "a-side", text: "CLIENT", placement: { kind: "anchor", anchor: "left" } },
      { action: "create_container", id: "b-side", text: "SERVER", placement: { kind: "anchor", anchor: "right" } },
    ],
    [
      { action: "create_arrow", id: "m1", from: "a-side", to: "b-side", label: "SYN" },
      { action: "create_shape", id: "p1", shape: "rounded_rectangle", semantic: "packet", text: "SYN", width: 120, height: 44, placement: { kind: "between", between: ["a-side", "b-side"] } },
      { action: "wait", durationMs: 300 },
      { action: "animate_path", id: "p1", to: "b-side", durationMs: 900 },
    ],
    [
      { action: "remove", id: "p1" },
      { action: "create_arrow", id: "m2", from: "b-side", to: "a-side", label: "SYN + ACK" },
      { action: "create_shape", id: "p2", shape: "rounded_rectangle", semantic: "packet", text: "SYN + ACK", width: 150, height: 44, placement: { kind: "between", between: ["a-side", "b-side"] } },
      { action: "wait", durationMs: 300 },
      { action: "animate_path", id: "p2", to: "a-side", durationMs: 900 },
    ],
    [
      { action: "remove", id: "p2" },
      { action: "create_arrow", id: "m3", from: "a-side", to: "b-side", label: "ACK" },
      { action: "create_shape", id: "p3", shape: "rounded_rectangle", semantic: "packet", text: "ACK", width: 120, height: 44, placement: { kind: "between", between: ["a-side", "b-side"] } },
      { action: "wait", durationMs: 300 },
      { action: "animate_path", id: "p3", to: "b-side", durationMs: 900 },
    ],
    [{ action: "remove", id: "p3" }, { action: "highlight", id: "m1" }, { action: "highlight", id: "m2" }, { action: "highlight", id: "m3" }],
  ]);

  const client = byId(scene, "a-side");
  const server = byId(scene, "b-side");
  check("the two actors land on opposite sides", client !== undefined && server !== undefined && client.x < 300 && server.x > 500);
  check("the actors are clearly separated (no centre collapse)", client !== undefined && server !== undefined && Math.abs(server.x - client.x) > 300);
  check("the actors share a stable horizon", client?.y === server?.y);
  check("every object stays inside the viewport", scene.objects.every(inViewport));

  const lanes = ["m1", "m2", "m3"].map((id) => Math.round(byId(scene, id)?.y ?? -1));
  check("three messages between one pair get three AUTOMATIC lanes (no model offsets)", new Set(lanes).size === 3);
  check("the message arrows stay inside the viewport", lanes.every((y) => y > 28 && y < 492));

  // Labels ride their own lane, so they cannot overlap.
  const labelPoints = ["m1", "m2", "m3"].map((id) => {
    const arrow = byId(scene, id)!;
    return connectionLabelPoint(byId(scene, arrow.refs!.from)!, byId(scene, arrow.refs!.to)!, arrow.offset ?? 0);
  });
  check("message labels sit on three different points", new Set(labelPoints.map((point) => `${Math.round(point.x)},${Math.round(point.y)}`)).size === 3);

  check("travelling packets never survive into the final scene", ["p1", "p2", "p3"].every((id) => byId(scene, id) === undefined));
  check("no two solid objects overlap at any point of the scene", overlappingPairs(scene).length === 0);
  check("the final scene keeps both actors and all three messages", ["a-side", "b-side", "m1", "m2", "m3"].every((id) => byId(scene, id) !== undefined));
}

section("10b. Other topics lay out with the SAME engine (no per-topic special casing)");
{
  const binarySearch = replay(emptyVisualScene(), [
    [
      { action: "create_container", id: "arr", text: "arr", width: 620, height: 90, placement: { kind: "anchor", anchor: "top" } },
      { action: "create_shape", id: "i0", shape: "rectangle", text: "4", width: 52, height: 52, placement: { kind: "relative", relativeTo: "arr", side: "below", gap: 16 } },
      { action: "create_shape", id: "i1", shape: "rectangle", text: "8", width: 52, height: 52, placement: { kind: "relative", relativeTo: "i0", side: "right", gap: 16 } },
      { action: "create_shape", id: "i2", shape: "rectangle", text: "15", width: 52, height: 52, placement: { kind: "relative", relativeTo: "i1", side: "right", gap: 16 } },
      { action: "create_shape", id: "i3", shape: "rectangle", text: "16", width: 52, height: 52, placement: { kind: "relative", relativeTo: "i2", side: "right", gap: 16 } },
      { action: "highlight", id: "i2" },
    ],
  ]);
  check("an array of cells lays out left to right", ["i0", "i1", "i2", "i3"].map((id) => byId(binarySearch, id)!.x).every((x, index, all) => index === 0 || x > all[index - 1]));
  check("array cells never overlap", overlappingPairs(binarySearch).length === 0);
  check("array cells stay inside the viewport", binarySearch.objects.every(inViewport));

  const recursion = replay(emptyVisualScene(), [
    [{ action: "create_shape", id: "f0", shape: "rectangle", text: "fact(5)", placement: { kind: "anchor", anchor: "top" } }],
    [{ action: "create_shape", id: "f1", shape: "rectangle", text: "fact(4)", placement: { kind: "relative", relativeTo: "f0", side: "below", gap: 14 } }],
    [{ action: "create_shape", id: "f2", shape: "rectangle", text: "fact(3)", placement: { kind: "relative", relativeTo: "f1", side: "below", gap: 14 } }],
    [{ action: "create_arrow", id: "c1", from: "f0", to: "f1" }, { action: "create_arrow", id: "c2", from: "f1", to: "f2" }],
  ]);
  check("recursion frames stack downwards in call order", byId(recursion, "f0")!.y < byId(recursion, "f1")!.y && byId(recursion, "f1")!.y < byId(recursion, "f2")!.y);
  check("recursion call edges connect the frames", byId(recursion, "c1")?.refs?.from === "f0" && byId(recursion, "c2")?.refs?.to === "f2");
  check("recursion frames never overlap", overlappingPairs(recursion).length === 0);
}

section("11. Existing Graph actions still work");
{
  const board = executeBoardActions(emptyBoardState(), [
    { action: "draw_node", id: "n1", value: "50", x: 400, y: 150 },
    { action: "draw_node", id: "n2", value: "30", x: 260, y: 280 },
    { action: "connect", from: "n1", to: "n2" },
    { action: "highlight", target: "n2" },
    { action: "write_text", id: "t1", text: "30 < 50", anchor: { type: "point", x: 120, y: 120 } },
  ]);
  check("nodes, edge, highlight and text still apply", board.nodes.length === 2 && board.edges.length === 1 && board.highlights.includes("n2") && board.texts.length === 1);
  check("move_node and erase still apply", executeBoardActions(board, [{ action: "move_node", id: "n2", x: 300, y: 300 }]).nodes.find((node) => node.id === "n2")?.x === 300);
  check("graph validation unchanged", parseBoardAction({ action: "draw_node", id: "x", value: "1" }) !== null && parseBoardAction({ action: "draw_node", id: "x" }) === null);
}


section("12. Existing BST lesson still works");
{
  const parsed = MOCK_TEACHING_STEPS.map(parseTeachingResponse);
  check("all mock BST steps validate", parsed.length === 5 && parsed.every((step) => step !== null));
  check("BST steps keep board_actions and use no diagram actions", parsed[1]!.board_actions.length > 0 && parsed[1]!.visual_actions.length === 0);
  check("mock complete step validates", parseTeachingResponse(MOCK_TEACHING_COMPLETE) !== null);
  const lesson = parseTeachingLessonResponse({ steps: MOCK_TEACHING_STEPS });
  check("mock BST lesson parses as a batch", lesson !== null && lesson.steps.length === 5);
}

section("13. Extended request/response contract");
{
  const base = { nodes: [], edges: [], texts: [], highlights: [] };
  check("request accepts visualState", parseTeachingRequest({ question: "Explain TCP 3-way handshake", language: "English", lessonStep: 1, boardState: base, visualState: { objects: [], tick: 0 } }) !== null);
  check("response accepts visual_actions without board_actions", parseTeachingResponse({ speech: "hi", visual_actions: [{ action: "clear" }], lesson_step: 1, next_step: 2 }) !== null);
  check("response still accepts board_actions only", parseTeachingResponse({ speech: "hi", board_actions: [{ action: "clear" }], lesson_step: 1, next_step: 2 }) !== null);
  check("response rejects unknown visual actions", parseTeachingResponse({ speech: "hi", visual_actions: [{ action: "explode" }], lesson_step: 1, next_step: 2 })?.visual_actions.length === 0);
  check("response keeps a step whose ONLY visual action is malformed (teaching is not thrown away)", parseTeachingResponse({ speech: "hi", visual_actions: [{ action: "explode" }], lesson_step: 1, next_step: 2 })?.speech === "hi");
  check("response defaults both action families to empty", parseTeachingResponse({ speech: "hi", lesson_step: 1, next_step: 2 })?.visual_actions.length === 0);
}

section("14. Scene round-trip contract (the Ask flow)");
{
  // REGRESSION: the client sends the current visual scene back with EVERY teaching request (lesson
  // batches and Ask). If the engine ever emits a scene the server's strict scene validation
  // rejects, parseTeachingRequest() returns null, the API answers 400 INVALID_REQUEST and the
  // student silently cannot ask a question. Every kind of object must round-trip.
  const scenes: Array<[string, VisualScene]> = [
    ["empty scene", emptyVisualScene()],
    ["shapes + anchors", replay(emptyVisualScene(), [[{ action: "create_container", id: "a", text: "A", placement: { kind: "anchor", anchor: "left" } }]])],
    ["arrows and packets", replay(emptyVisualScene(), [
      [{ action: "create_container", id: "a", text: "A", placement: { kind: "anchor", anchor: "left" } }],
      [{ action: "create_container", id: "b", text: "B", placement: { kind: "anchor", anchor: "right" } }],
      [{ action: "create_arrow", id: "m", from: "a", to: "b", label: "SYN" }],
      [{ action: "create_connector", id: "k", from: "b", to: "a" }],
      [{ action: "create_shape", id: "p", shape: "rounded_rectangle", semantic: "packet", text: "SYN", placement: { kind: "between", between: ["a", "b"] } }, { action: "animate_path", id: "p", to: "b" }],
    ])],
    ["text, labels, icons, formulas", replay(emptyVisualScene(), [[
      { action: "create_shape", id: "box", shape: "rectangle", text: "leaf", width: 200, height: 120, placement: { kind: "point", x: 300, y: 260 } },
      { action: "create_text", id: "t", text: "photosynthesis", placement: { kind: "anchor", anchor: "top" } },
      { action: "write_formula", id: "f", formula: "6CO2 + 6H2O", placement: { kind: "anchor", anchor: "bottom" } },
      { action: "create_label", id: "l", target: "box", text: "O2 out" },
      { action: "create_icon", id: "i", glyph: "sun", placement: { kind: "relative", relativeTo: "box", side: "above", gap: 20 } },
      { action: "highlight", id: "box" }, { action: "pulse", id: "box" }, { action: "rotate", id: "box", degrees: 10 },
    ]])],
  ];
  for (const [name, scene] of scenes) {
    const roundTripped = parseVisualScene(getVisualScene(scene));
    check(`scene round-trips through strict validation: ${name}`, roundTripped !== null);
    check(`round-trip preserves every object: ${name}`, roundTripped !== null && roundTripped.objects.length === scene.objects.length);
  }

  const withArrows = scenes[2][1];
  const base = { nodes: [], edges: [], texts: [], highlights: [] };
  check("a follow-up question with a populated scene is accepted", parseTeachingRequest({
    question: "Explain TCP 3-way handshake", language: "English", lessonStep: 3, boardState: base,
    visualState: getVisualScene(withArrows), previousTeaching: ["step one"], studentQuestion: "SYN kya hota hai?",
  }) !== null);
  check("a follow-up question with an empty scene is accepted", parseTeachingRequest({
    question: "Explain TCP 3-way handshake", language: "English", lessonStep: 1, boardState: base,
    visualState: getVisualScene(emptyVisualScene()), previousTeaching: ["step one"], studentQuestion: "SYN kya hota hai?",
  }) !== null);
  check("validation is still strict for a hand-written bogus scene", parseVisualScene({ objects: [{ id: "x", kind: "shape", x: 0, y: 0, width: 0.5, height: 0.5 }], tick: 0 }) === null);
  check("validation still rejects a scene with a NaN coordinate", parseVisualScene({ objects: [{ id: "x", kind: "shape", x: Number.NaN, y: 0, width: 40, height: 40 }], tick: 0 }) === null);
  check("validation still rejects a scene without objects", parseVisualScene({ tick: 3 }) === null);
}

section("15. Layout safety: anchor slots, free-spot search, automatic connection lanes");
{
  // Objects WITHOUT any placement (or with an unresolvable reference) must not all land on the
  // viewport centre — that collapse was the root cause of the unreadable "SY ACK K" stack.
  const bare = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "a", shape: "rectangle", text: "A" },
    { action: "create_shape", id: "b", shape: "rectangle", text: "B" },
    { action: "create_shape", id: "c", shape: "rectangle", text: "C" },
  ]);
  check("unplaced objects do not collapse onto one point", new Set(bare.objects.map((o) => `${Math.round(o.x)},${Math.round(o.y)}`)).size === 3);
  check("unplaced objects stay inside the viewport", bare.objects.every(inViewport));
  check("unplaced objects do not overlap", overlappingPairs(bare).length === 0);

  const dangling = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "p", shape: "circle" },
    { action: "create_shape", id: "q", shape: "circle", placement: { kind: "relative", relativeTo: "missing", side: "right", gap: 24 } },
  ]);
  check("relative placement with a missing anchor does not collapse to centre", new Set(dangling.objects.map((o) => `${Math.round(o.x)},${Math.round(o.y)}`)).size === 2);

  // Anchor SLOTS: several objects anchored to the same edge spread along it.
  const slots = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "s1", shape: "circle", text: "1", placement: { kind: "anchor", anchor: "left" } },
    { action: "create_shape", id: "s2", shape: "circle", text: "2", placement: { kind: "anchor", anchor: "left" } },
    { action: "create_shape", id: "s3", shape: "circle", text: "3", placement: { kind: "anchor", anchor: "left" } },
  ]);
  check("objects on the SAME anchor take separate slots", new Set(slots.objects.map((o) => Math.round(o.y))).size === 3);
  check("anchor slots stay on that edge and inside the viewport", slots.objects.every((o) => o.x < 200 && inViewport(o)));
  check("anchor slots do not overlap", overlappingPairs(slots).length === 0);

  // Explicit points that would collide are rescued to the nearest free spot.
  const collided = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "e1", shape: "rectangle", width: 260, height: 140, placement: { kind: "point", x: 400, y: 260 } },
    { action: "create_shape", id: "e2", shape: "rectangle", width: 260, height: 140, placement: { kind: "point", x: 400, y: 260 } },
  ]);
  check("two objects given the SAME point do not overlap", overlappingPairs(collided).length === 0);
  check("both rescued objects stay inside the viewport", collided.objects.every(inViewport));

  // Automatic lanes: the same two objects carry three parallel messages WITHOUT the model
  // supplying any offset, which is what produced the collapsed "SY ACK K" line before.
  const lanes = applyVisualActions(emptyVisualScene(), [
    { action: "create_container", id: "l", text: "L", placement: { kind: "point", x: 140, y: 250 } },
    { action: "create_container", id: "r", text: "R", placement: { kind: "point", x: 660, y: 250 } },
    { action: "create_arrow", id: "m1", from: "l", to: "r", label: "SYN" },
    { action: "create_arrow", id: "m2", from: "r", to: "l", label: "SYN + ACK" },
    { action: "create_arrow", id: "m3", from: "l", to: "r", label: "ACK" },
  ]);
  const laneY = ["m1", "m2", "m3"].map((id) => Math.round(byId(lanes, id)?.y ?? -1));
  check("three un-offset arrows between one pair get three distinct lanes", new Set(laneY).size === 3);
  check("auto lanes keep live endpoint references", byId(lanes, "m2")?.refs?.from === "r" && byId(lanes, "m2")?.refs?.to === "l");

  // An explicit offset from the model still wins (the prompt may ask for a specific lane).
  const manual = applyVisualActions(emptyVisualScene(), [
    { action: "create_container", id: "l", text: "L", placement: { kind: "point", x: 140, y: 250 } },
    { action: "create_container", id: "r", text: "R", placement: { kind: "point", x: 660, y: 250 } },
    { action: "create_arrow", id: "m1", from: "l", to: "r", label: "SYN", offset: -80 },
    { action: "create_arrow", id: "m2", from: "r", to: "l", label: "SYN + ACK", offset: 0 },
    { action: "create_arrow", id: "m3", from: "l", to: "r", label: "ACK", offset: 80 },
  ]);
  const manualY = ["m1", "m2", "m3"].map((id) => Math.round(byId(manual, id)?.y ?? -1));
  check("offset arrows occupy three distinct lanes (170 / 250 / 330)", new Set(manualY).size === 3 && manualY[0] === 170 && manualY[1] === 250 && manualY[2] === 330);
  check("offset arrows keep their live endpoint references", byId(manual, "m2")?.refs?.from === "r" && byId(manual, "m2")?.refs?.to === "l");

  // Validation stays strict: an out-of-range offset is rejected, a sane one accepted.
  check("rejects an out-of-range arrow offset", parseVisualAction({ action: "create_arrow", id: "x", from: "l", to: "r", offset: 5000 }) === null);
  check("accepts an in-range arrow offset", parseVisualAction({ action: "create_arrow", id: "x", from: "l", to: "r", offset: 120 }) !== null);

  // Labels attached to objects spread around their target instead of all sitting on the right.
  const labels = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "n", shape: "rectangle", width: 200, height: 120, text: "node", placement: { kind: "point", x: 400, y: 260 } },
    { action: "create_label", id: "l1", target: "n", text: "one" },
    { action: "create_label", id: "l2", target: "n", text: "two" },
    { action: "create_label", id: "l3", target: "n", text: "three" },
  ]);
  check("labels on the same target take free space around it", new Set(labels.objects.filter((o) => o.kind === "label").map((o) => `${Math.round(o.x)},${Math.round(o.y)}`)).size === 3);
  check("labels do not overlap their target or each other", overlappingPairs(labels).length === 0);
}

section("17. A shape's own label always fits inside its shape");
{
  const CHAR = 0.56;
  const fits = (fitted: { fontSize: number; lines: string[] }, width: number, height: number): boolean => {
    const padding = fitted.fontSize;
    const widest = Math.max(...fitted.lines.map((line) => line.length)) * fitted.fontSize * CHAR;
    const tallest = fitted.lines.length * fitted.fontSize * 1.18;
    return widest <= width - padding && tallest <= height - padding;
  };

  const short = fitLabelInBox("10", 140, 90, 24);
  check("a short label keeps the size the shape asked for", short.lines.length === 1 && short.fontSize === 24 && short.truncated === false);

  const long = fitLabelInBox("Station 1: Prize '10' -> Go to Station 2", 150, 80, 24);
  check("a long label is wrapped instead of overflowing", long.lines.length > 1, JSON.stringify(long.lines));
  check("a wrapped label fits inside the shape it belongs to", fits(long, 150, 80), JSON.stringify(long));

  const narrow = fitLabelInBox("Last-In-First-Out ordering", 60, 70, 24);
  check("a label too long for a narrow shape is broken up", narrow.lines.length > 1);
  check("even a very narrow shape gets a fitted label", fits(narrow, 60, 70), JSON.stringify(narrow));

  const impossible = fitLabelInBox("Enormous label text that cannot ever fit inside this shape", 70, 30, 24);
  check("text that cannot fit is shortened rather than left to overflow", impossible.truncated === true);
  check("a shortened label still shows its beginning", (impossible.lines[0] ?? "").startsWith("Enormous"));

  check("an empty label produces nothing to draw", fitLabelInBox("   ", 200, 100, 24).lines.length === 0);

  const tiny = fitLabelInBox("Enormous", 20, 20, 24);
  check("even a tiny shape gets a label that fits its width", tiny.lines.every((line) => line.length <= 2), JSON.stringify(tiny.lines));
}

// =============================================================================================
// 18. ARRAY MUST BE A REAL ARRAY  (regression for "draw an array of four cells")
//     The exact student request below must produce four equal, aligned 2D cells on this board —
//     never a biological cell and never a 3D asset. This is the test that failed before.
// =============================================================================================
section("18. REGRESSION: 'draw an array of four cells' is a real 2D array");
{
  const request = "Draw an array of four cells holding 10, 20, 30 and 40, with each index written next to its cell.";

  // (a) Representation intent: an explicit drawing request stays 2D, so no 3D model may be used.
  check("the request is recognised as an explicit 2D drawing request", detectRepresentationIntent(request) === "2d", String(detectRepresentationIntent(request)));
  const selection = selectAssetsForLesson(request);
  check("no biological cell model is offered for an array question", selection.relevant.every((asset) => asset.category !== "biology"), JSON.stringify(selection.relevant.map((a) => a.id)));

  // (b) The array compiles to four real cells, in order, of equal size, with indices.
  const scene = applyVisualActions(emptyVisualScene(), [{ action: "create_array", id: "arr", values: ["10", "20", "30", "40"], indices: true }]);
  const cells = ["arr-c0", "arr-c1", "arr-c2", "arr-c3"].map((id) => byId(scene, id));
  check("four array cells are created", cells.every(Boolean));
  check("each cell holds its value", cells.map((cell) => cell?.text).join(",") === "10,20,30,40");
  check("all four cells are the same size (a real array)", new Set(cells.map((cell) => `${cell?.width}x${cell?.height}`)).size === 1);
  check("the cells are laid out left to right in order", cells.every((cell, index, all) => index === 0 || (cell!.x > all[index - 1]!.x)));
  check("the cells share one baseline", new Set(cells.map((cell) => Math.round(cell!.y))).size === 1);
  check("indices are written next to the cells", ["arr-i0", "arr-i1", "arr-i2", "arr-i3"].every((id) => byId(scene, id)?.text === String(Number(id.slice(-1)))));
  check("every index sits clear of the cell it names", cells.every((cell, index) => Math.abs((byId(scene, `arr-i${index}`)?.y ?? 0) - (cell!.y + cell!.height / 2 + 19)) < 1));
  check("array cells never overlap each other or their indices", overlappingPairs(scene).length === 0, JSON.stringify(overlappingPairs(scene)));
  check("the whole array stays inside the board", scene.objects.every(inViewport));

  // (c) Nothing biological or 3D entered the 2D scene.
  check("no 3D-ish asset entered the 2D scene", scene.objects.every((object) => object.semantic !== "actor" && object.shape !== "cylinder"));

  // (d) Insertion, deletion and swapping animate as change, not as a redraw.
  const inserted = applyVisualActions(scene, [{ action: "update_array", id: "arr", values: ["10", "20", "30", "40", "50"] }]);
  check("inserting 50 creates a fifth cell", byId(inserted, "arr-c4")?.text === "50");
  check("the array stays in order after an append", ["arr-c0", "arr-c1", "arr-c2", "arr-c3", "arr-c4"].map((id) => byId(inserted, id)?.text).join(",") === "10,20,30,40,50");
  check("the cells that moved record a move animation (the array re-flowed on screen)", ["arr-c0", "arr-c1"].some((id) => byId(inserted, id)?.motion?.kind === "move"));
  check("the new index caption exists", byId(inserted, "arr-i4") !== undefined);
  check("an appended array is still free of overlaps", overlappingPairs(inserted).length === 0, JSON.stringify(overlappingPairs(inserted)));

  const insertedAtFront = applyVisualActions(scene, [{ action: "update_array", id: "arr", values: ["5", "10", "20", "30", "40"] }]);
  check("inserting at the front slides the tail along by one cell", ["5", "10", "20", "30", "40"].join(",") === ["arr-c0", "arr-c1", "arr-c2", "arr-c3", "arr-c4"].map((id) => byId(insertedAtFront, id)?.text).join(","));
  check("the cells that slid record a move animation", byId(insertedAtFront, "arr-c1")?.motion?.kind === "move" && byId(insertedAtFront, "arr-c1")?.motion?.fromX !== undefined);
  check("the new leading cell appears", byId(insertedAtFront, "arr-c0")?.text === "5" && byId(insertedAtFront, "arr-c0")?.motion?.kind === "appear");

  const swapped = applyVisualActions(scene, [{ action: "update_array", id: "arr", values: ["10", "20", "40", "30"] }]);
  check("swapping the last two cells moves both towards each other", byId(swapped, "arr-c2")?.motion?.kind === "move" && byId(swapped, "arr-c3")?.motion?.kind === "move");
  check("a swap actually swaps the values on screen", [byId(swapped, "arr-c2")?.text, byId(swapped, "arr-c3")?.text].join(",") === "40,30");
  check("a swap leaves the board free of overlaps", overlappingPairs(swapped).length === 0);

  const shortened = applyVisualActions(inserted, [{ action: "update_array", id: "arr", values: ["10", "20"] }]);
  check("deleting values removes the cells and their indices", byId(shortened, "arr-c2") === undefined && byId(shortened, "arr-i3") === undefined && byId(shortened, "arr-c1")?.text === "20");

  // (e) Highlighting an individual cell is possible and visually obvious.
  const focused = applyVisualActions(scene, [{ action: "focus", ids: ["arr-c2"] }]);
  check("one array cell can hold the teacher's attention", focused.focusIds?.[0] === "arr-c2" && byId(focused, "arr-c2")?.emphasis !== true);
  check("focus is cleared by the next step so the board never stays permanently subdued", applyVisualActions(focused, [{ action: "highlight", id: "arr-c0" }]).focusIds === undefined);

  // (f) Determinism: the same request twice produces byte-identical geometry.
  const again = applyVisualActions(emptyVisualScene(), [{ action: "create_array", id: "arr", values: ["10", "20", "30", "40"], indices: true }]);
  check("the same array request always produces the same layout", JSON.stringify(again.objects.map((o) => [o.id, o.x, o.y, o.width, o.height])) === JSON.stringify(scene.objects.map((o) => [o.id, o.x, o.y, o.width, o.height])));
}

// =============================================================================================
// 19. SEMANTIC STRUCTURES — the model states WHAT, layout decides WHERE
// =============================================================================================
section("19. Semantic structures lay out deterministically from structure alone");
{
  // Each structure gets its own board: they are separate diagrams, and putting three centred
  // structures on one board would (correctly) be reported as overlapping.
  const listScene = applyVisualActions(emptyVisualScene(), [
    { action: "create_linked_list", id: "ll", nodes: [{ id: "a", value: "10" }, { id: "b", value: "20" }, { id: "c", value: "30" }], title: "Linked list" },
  ]);
  const stackScene = applyVisualActions(emptyVisualScene(), [{ action: "create_stack", id: "st", values: ["10", "20", "30"], topLabel: "TOP" }]);
  const queueScene = applyVisualActions(emptyVisualScene(), [{ action: "create_queue", id: "q", values: ["1", "2", "3"] }]);

  const parsed = parseVisualActions([
    { action: "create_linked_list", id: "ll", nodes: [{ id: "a", value: "10" }, { id: "b", value: "20" }] },
    { action: "create_stack", id: "st", values: ["10", "20"] },
    { action: "create_queue", id: "q", values: ["1", "2"] },
  ]);
  check("the structures parse without a single coordinate", parsed !== null && parsed.length === 3);

  // Linked list: three nodes in a row, next-pointer arrows, HEAD above, NULL after the last.
  const nodes = ["ll-a", "ll-b", "ll-c"].map((id) => byId(listScene, id));
  check("linked-list nodes are three real boxes holding their values", nodes.every(Boolean) && nodes.map((node) => node?.text).join(",") === "10,20,30");
  check("linked-list nodes are laid out in order, left to right", nodes.every((node, index, all) => index === 0 || node!.x > all[index - 1]!.x));
  check("next pointers are drawn between consecutive nodes", ["ll-e0", "ll-e1"].every((id) => byId(listScene, id)?.connector === "next_pointer"));
  check("HEAD is marked above the first node", byId(listScene, "ll-head")?.text === "HEAD" && byId(listScene, "ll-head")!.y < nodes[0]!.y);
  check("the last next pointer terminates in NULL", byId(listScene, "ll-null")?.text === "NULL" && byId(listScene, "ll-null-link") !== undefined);
  const fromNode = nodes[0]!;
  const start = routeConnection(fromNode, nodes[1]!, { kind: "next_pointer" }).start;
  check("a next pointer leaves the node's POINTER compartment, not its centre", start.x > fromNode.x + fromNode.width * 0.1 && Math.abs(start.y - fromNode.y) < 1, JSON.stringify({ start, node: { x: fromNode.x, y: fromNode.y, w: fromNode.width } }));
  check("linked-list layout has no overlaps", overlappingPairs(listScene).length === 0, JSON.stringify(overlappingPairs(listScene)));

  // Stack: TOP hangs over the live end and the rows read top-down.
  const stack = ["st-s0", "st-s1", "st-s2"].map((id) => byId(stackScene, id));
  check("stack rows exist with equal widths", stack.every(Boolean) && new Set(stack.map((row) => row?.width)).size === 1);
  check("stack rows go top to bottom in push order", stack.every((row, index, all) => index === 0 || row!.y > all[index - 1]!.y));
  check("TOP is marked above the top row", byId(stackScene, "st-top-label")?.text === "TOP" && byId(stackScene, "st-top-label")!.y < stack[0]!.y);
  const frame = byId(stackScene, "st-frame")!;
  check("the stack's cells sit inside its frame (a frame does not evict its own contents)",
    stack.every((row) => Math.abs(row!.x - frame.x) <= 1 && Math.abs(row!.y - frame.y) <= frame.height / 2),
    JSON.stringify({ frame: { x: frame.x, y: frame.y, w: frame.width, h: frame.height }, cells: stack.map((row) => ({ x: row?.x, y: row?.y })) }));
  check("stack layout has no overlaps", overlappingPairs(stackScene).length === 0, JSON.stringify(overlappingPairs(stackScene)));

  // Queue: FRONT on the left, REAR on the right.
  const queue = ["q-q0", "q-q1", "q-q2"].map((id) => byId(queueScene, id));
  check("queue cells are laid out left to right", queue.every((cell, index, all) => index === 0 || cell!.x > all[index - 1]!.x));
  check("FRONT is above the leftmost cell and REAR above the rightmost", byId(queueScene, "q-front")!.x < byId(queueScene, "q-rear")!.x);
  check("queue layout has no overlaps", overlappingPairs(queueScene).length === 0, JSON.stringify(overlappingPairs(queueScene)));

  check("every structure object stays inside the board", [...listScene.objects, ...stackScene.objects, ...queueScene.objects].every(inViewport));

  // Sequence diagram: actors on one row, one message per row.
  const sequence = applyVisualActions(emptyVisualScene(), [{ action: "create_sequence", id: "tcp", actors: ["Client", "Server"], messages: [{ from: "Client", to: "Server", label: "SYN" }, { from: "Server", to: "Client", label: "SYN-ACK" }, { from: "Client", to: "Server", label: "ACK" }] }]);
  check("sequence actors are placed on one horizon", byId(sequence, "tcp-a0")!.y === byId(sequence, "tcp-a1")!.y);
  check("each message occupies its own row", new Set(["tcp-m0", "tcp-m1", "tcp-m2"].map((id) => Math.round(byId(sequence, id)!.y))).size === 3);
  check("messages run between the actors' LIFELINES, so every arrow is attached to something", byId(sequence, "tcp-m1")?.refs?.from === "tcp-life1" && byId(sequence, "tcp-m1")?.refs?.to === "tcp-life0");
  check("the lifelines stand under their actors", Math.round(byId(sequence, "tcp-life0")!.x) === Math.round(byId(sequence, "tcp-a0")!.x) && Math.round(byId(sequence, "tcp-life1")!.x) === Math.round(byId(sequence, "tcp-a1")!.x));
  check("message rows are in send order, top to bottom, whichever way they point", (() => {
    const rows = ["tcp-m0", "tcp-m1", "tcp-m2"].map((id) => byId(sequence, id)!.y);
    return rows[0] < rows[1] && rows[1] < rows[2] && new Set(rows.map((row) => Math.round(row))).size === 3;
  })(), JSON.stringify(["tcp-m0", "tcp-m1", "tcp-m2"].map((id) => byId(sequence, id)!.y)));
  check("sequence messages are labelled", ["tcp-m0", "tcp-m1", "tcp-m2"].map((id) => byId(sequence, id)?.text).join(",") === "SYN,SYN-ACK,ACK");

  // Pipeline: Fetch -> Decode -> ... in one wrapped row with arrows between neighbours.
  const pipeline = applyVisualActions(emptyVisualScene(), [{ action: "create_pipeline", id: "cpu", stages: ["Fetch", "Decode", "Execute", "Memory", "Write Back"] }]);
  check("every pipeline stage is created", ["cpu-p0", "cpu-p1", "cpu-p2", "cpu-p3", "cpu-p4"].every((id) => byId(pipeline, id) !== undefined));
  check("pipeline stages are in one row with an arrow between each neighbour", new Set(["cpu-p0", "cpu-p4"].map((id) => Math.round(byId(pipeline, id)!.y))).size === 1 && ["cpu-pa0", "cpu-pa1", "cpu-pa2", "cpu-pa3"].every((id) => byId(pipeline, id) !== undefined));

  // Tree: every parent centred over its children, children on one level.
  const treeNodes = [{ id: "n50", value: "50" }, { id: "n30", value: "30" }, { id: "n70", value: "70" }, { id: "n20", value: "20" }, { id: "n40", value: "40" }];
  const treeEdges = [{ from: "n50", to: "n30" }, { from: "n50", to: "n70" }, { from: "n30", to: "n20" }, { from: "n30", to: "n40" }];
  const tree = applyVisualActions(emptyVisualScene(), [{ action: "create_tree", id: "t", nodes: treeNodes, edges: treeEdges }]);
  const box = (id: string) => byId(tree, `t-${id}`)!;
  check("a BST renders every node", treeNodes.every((node) => box(node.id) !== undefined));
  check("the root is above its children", box("n50").y < box("n30").y && box("n50").y < box("n70").y);
  check("children of the same parent share a level", box("n30").y === box("n70").y && box("n20").y === box("n40").y);
  check("a parent is centred over its children", Math.abs((box("n20").x + box("n40").x) / 2 - box("n30").x) < 2);
  check("the root is centred over ITS children", Math.abs((box("n30").x + box("n70").x) / 2 - box("n50").x) < 2);
  check("siblings on one level are ordered and never touch", box("n20").x < box("n40").x && box("n40").x - box("n20").x > box("n20").width && box("n30").x < box("n70").x);
  check("smaller values really are on the left", box("n20").x < box("n50").x && box("n70").x > box("n50").x);
  check("parent-child edges are attached, not floating", treeEdges.every((_, index) => byId(tree, `t-edge${index}`)?.refs?.from === `t-${treeEdges[index].from}`));
  check("tree nodes never overlap", overlappingPairs(tree).length === 0, JSON.stringify(overlappingPairs(tree)));

  // Timeline and comparison are structural too.
  const timeline = applyVisualActions(emptyVisualScene(), [{ action: "create_timeline", id: "tl", events: [{ label: "1939", text: "WWII begins" }, { label: "1945", text: "War ends" }, { label: "1991", text: "Soviet Union ends" }] }]);
  check("timeline events sit on a shared axis in order", new Set(["tl-e0", "tl-e1", "tl-e2"].map((id) => Math.round(byId(timeline, id)!.x))).size === 3 && byId(timeline, "tl-e0")!.x < byId(timeline, "tl-e2")!.x);
  check("timeline events alternate above and below the axis", byId(timeline, "tl-e0")!.y < byId(timeline, "tl-e1")!.y);
  const compare = applyVisualActions(emptyVisualScene(), [{ action: "create_compare", id: "cmp", left: { title: "Array", items: ["O(1) access", "contiguous"] }, right: { title: "Linked list", items: ["O(n) access", "scattered"] } }]);
  check("a comparison puts two measured columns side by side", byId(compare, "cmp-l-head")!.x < byId(compare, "cmp-r-head")!.x && Math.abs(byId(compare, "cmp-l-head")!.y - byId(compare, "cmp-r-head")!.y) < 1);
  check("comparison items line up row by row", Math.abs(byId(compare, "cmp-l-r0")!.y - byId(compare, "cmp-r-r0")!.y) < 1);

  // Determinism across repeated compiles.
  const a = JSON.stringify(compileArray("arr", ["10", "20", "30", "40"], { indices: true }));
  const b = JSON.stringify(compileArray("arr", ["10", "20", "30", "40"], { indices: true }));
  check("layout is deterministic: the same structure compiles identically", a === b);
  const treeOnce = layoutTree(treeNodes.map((node) => ({ ...node, id: `t-${node.id}` })), treeEdges.map((edge) => ({ from: `t-${edge.from}`, to: `t-${edge.to}` })));
  const treeTwice = layoutTree(treeNodes.map((node) => ({ ...node, id: `t-${node.id}` })), treeEdges.map((edge) => ({ from: `t-${edge.from}`, to: `t-${edge.to}` })));
  check("tree layout is deterministic", JSON.stringify(treeOnce) === JSON.stringify(treeTwice));

  // Structures validate strictly: an edge to a node that does not exist is not a tree.
  check("a tree edge to a missing node is rejected", parseVisualAction({ action: "create_tree", id: "t", nodes: [{ id: "a", value: "1" }], edges: [{ from: "a", to: "ghost" }] }) === null);
  check("a sequence message between unknown actors is rejected", parseVisualAction({ action: "create_sequence", id: "s", actors: ["A"], messages: [{ from: "A", to: "B" }] }) === null);
  check("an empty array is rejected rather than silently drawn as nothing", parseVisualAction({ action: "create_array", id: "a", values: [] }) === null);
  check("a linked list with duplicate node ids is rejected", parseVisualAction({ action: "create_linked_list", id: "l", nodes: [{ id: "a", value: "1" }, { id: "a", value: "2" }] }) === null);
}

// =============================================================================================
// 20. TEXT IS MEASURED, NOT ASSUMED — labels stay inside the shapes that own them
// =============================================================================================
section("20. Every text element has measured bounds");
{
  // A box too small for its label must GROW, not squeeze the label to nothing.
  const grown = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "tight", shape: "rounded_rectangle", text: "Write Back Stage", width: 70, height: 36 },
    { action: "create_shape", id: "roomy", shape: "rounded_rectangle", text: "Write Back Stage", width: 260, height: 90 },
  ]);
  const tight = byId(grown, "tight")!;
  const roomy = byId(grown, "roomy")!;
  check("a box too small for its label grows instead of shrinking the text", tight.width > 70 || tight.height > 36, `${tight.width}x${tight.height}`);
  check("a single long word widens the box (a word cannot be wrapped away)", (() => {
    const word = byId(applyVisualActions(emptyVisualScene(), [{ action: "create_shape", id: "w", shape: "rounded_rectangle", text: "photosynthesis", width: 60, height: 60 }]), "w")!;
    return word.width > 60;
  })());
  check("a roomy box is left exactly as asked", roomy.width === 260 && roomy.height === 90, `${roomy.width}x${roomy.height}`);
  check("the grown shape holds the label WHOLE at a readable size", fitLabelInBox("Write Back Stage", tight.width, tight.height, 23).truncated === false && fitLabelInBox("Write Back Stage", tight.width, tight.height, 23).fontSize >= 13, JSON.stringify(fitLabelInBox("Write Back Stage", tight.width, tight.height, 23)));
  check("the grown shape still fits on the board", inViewport(tight));

  const captionText = byId(applyVisualActions(emptyVisualScene(), [{ action: "create_text", id: "t", text: "This caption is deliberately long enough that it can never fit on one line of the board without being broken into several", role: "annotation" }]), "t")!;
  check("a caption longer than the board wraps into several measured lines", (captionText.textLines?.length ?? 0) > 1, JSON.stringify(captionText.textLines));
  check("free text reserves the width of its widest line", captionText.width > 120);
  check("a wrapped caption never exceeds the board width", captionText.width <= 800 - 56);

  const roles = applyVisualActions(emptyVisualScene(), [{ action: "create_text", id: "a", text: "x", role: "title", size: 21 }, { action: "create_text", id: "b", text: "x", role: "annotation", size: 13 }]);
  check("a title is visibly bigger than an annotation", (byId(roles, "a")?.fontSize ?? 0) > (byId(roles, "b")?.fontSize ?? 0));
  check("a role is recorded so the renderer can style it", byId(roles, "a")?.role === "title" && byId(roles, "b")?.role === "annotation");

  const container = applyVisualActions(emptyVisualScene(), [
    { action: "create_container", id: "frame", width: 300, height: 200, placement: { kind: "point", x: 400, y: 260 } },
    { action: "create_shape", id: "inside", shape: "rectangle", text: "cell", width: 90, height: 60, placement: { kind: "point", x: 400, y: 260 } },
  ]);
  check("a shape may legitimately sit inside a container (a frame does not evict its contents)", Math.abs(byId(container, "inside")!.x - 400) < 1 && Math.abs(byId(container, "inside")!.y - 260) < 1);
}

// =============================================================================================
// 21. CONNECTOR ROUTING — boundaries, arrowheads, obstacles, bidirectional, lane rerouting
// =============================================================================================
section("21. Connectors start and end on boundaries and route around obstacles");
{
  const scene = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "l", shape: "rectangle", text: "L", width: 140, height: 80, placement: { kind: "point", x: 160, y: 260 } },
    { action: "create_shape", id: "r", shape: "rectangle", text: "R", width: 140, height: 80, placement: { kind: "point", x: 640, y: 260 } },
    { action: "create_shape", id: "blocker", shape: "rectangle", text: "X", width: 120, height: 120, placement: { kind: "point", x: 400, y: 260 } },
    { action: "create_connector", id: "c", from: "l", to: "r" },
  ]);
  const left = byId(scene, "l")!;
  const right = byId(scene, "r")!;
  const blocker = byId(scene, "blocker")!;
  const direct = routeConnection(left, right, {});
  const detoured = routeConnection(left, right, { obstacles: [{ left: blocker.x - blocker.width / 2, top: blocker.y - blocker.height / 2, right: blocker.x + blocker.width / 2, bottom: blocker.y + blocker.height / 2 }] });
  check("a connection starts on the border of its source, not inside it", direct.start.x >= left.x + left.width / 2 - 1, JSON.stringify(direct.start));
  check("a connection ends on the border of its target, not inside it", direct.end.x <= right.x - right.width / 2 + 1, JSON.stringify(direct.end));
  check("an obstacle in the way makes the router take a detour", detoured.rerouted === true);
  check("the detour still starts and ends at the same places", Math.abs(detoured.start.x - direct.start.x) < 1 && Math.abs(detoured.end.x - direct.end.x) < 1);
  check("an unobstructed connection stays straight", routeConnection(left, right, {}).rerouted === false);

  const curved = routeConnection(left, right, { kind: "curved" });
  check("a curved connector uses a curve, not a line", curved.d.includes("C"));
  check("every routed connection is a drawable path", [direct.d, detoured.d, curved.d].every((d) => d.startsWith("M ")));

  // Bidirectional and styled connectors are declared, not implied.
  const styles = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "a", shape: "circle", text: "A", placement: { kind: "point", x: 240, y: 200 } },
    { action: "create_shape", id: "b", shape: "circle", text: "B", placement: { kind: "point", x: 560, y: 200 } },
    { action: "create_arrow", id: "bi", from: "a", to: "b", kind: "bidirectional" },
    { action: "create_arrow", id: "dot", from: "b", to: "a", kind: "dotted" },
    { action: "create_arrow", id: "dep", from: "a", to: "b", kind: "dependency", offset: 120 },
  ]);
  check("a bidirectional connection is recorded as such", byId(styles, "bi")?.connector === "bidirectional");
  check("a dotted connection is recorded as such", byId(styles, "dot")?.connector === "dotted");
  check("a dependency connection is recorded as such", byId(styles, "dep")?.connector === "dependency");
  check("every connection is drawn (draw-in) rather than appearing fully formed", byId(styles, "bi")?.motion?.kind === "draw");

  // Removing an object removes the arrows that only existed to reach it.
  const pruned = applyVisualActions(styles, [{ action: "remove", id: "a" }]);
  check("removing an object removes its dangling connections (no orphans)", pruned.objects.every((object) => !object.refs || (byId(pruned, object.refs.from) !== undefined && byId(pruned, object.refs.to) !== undefined)));
}

// =============================================================================================
// 22. VALIDATION REPAIRS ONE ACTION INSTEAD OF DISCARDING THE STEP
// =============================================================================================
section("22. A malformed visual action never costs the student the step");
{
  const batch = [
    { action: "create_shape", id: "ok1", shape: "rectangle", text: "First" },
    { action: "create_shape", id: "bad", shape: "hexapod" },
    { action: "create_shape", id: "ok2", shape: "circle", text: "Second" },
    { action: "create_arrow", id: "arrow", from: "ok1", to: "ok2", animate: { kind: "explode", durationMs: 100 } },
    { action: "explode" },
    { action: "wait", durationMs: 200 },
  ];
  const repaired = repairVisualActions(batch);
  check("the valid actions survive a batch with two bad actions", repaired.actions.length >= 4, JSON.stringify(repaired.actions.map((a) => a.action)));
  check("every unusable action is reported, not silently dropped", repaired.diagnostics.length === 3, JSON.stringify(repaired.diagnostics.map((d) => `${d.action}:${d.outcome}`)));
  check("a diagnostic names the action, the target and the reason", repaired.diagnostics.every((d) => d.action.length > 0 && d.reason.length > 0 && d.sceneObjects === 0));
  check("an unrecognised action is dropped, not repaired", repaired.diagnostics.some((d) => d.action === "explode" && d.outcome === "dropped"));
  check("an invalid animation block is repaired by dropping the animation", repaired.diagnostics.some((d) => d.outcome === "repaired" && /animation/i.test(d.reason)));

  const scene = applyVisualActions(emptyVisualScene(), repaired.actions);
  check("the repaired step still draws what it was teaching", byId(scene, "ok1") !== undefined && byId(scene, "ok2") !== undefined && byId(scene, "arrow") !== undefined);

  // Diagnostics from the ENGINE name duplicates and missing references too.
  const detailed = applyVisualActionsDetailed(emptyVisualScene(), [
    { action: "create_shape", id: "a", shape: "circle", text: "A" },
    { action: "create_shape", id: "a", shape: "circle", text: "A again" },
    { action: "create_arrow", id: "x", from: "a", to: "ghost" },
    { action: "move", id: "nobody", placement: { kind: "point", x: 10, y: 10 } },
  ]);
  check("a duplicate object id is reported by name", detailed.diagnostics.some((d) => d.reason.includes("duplicate object id") && d.target === "a"), JSON.stringify(detailed.diagnostics));
  check("a missing endpoint is reported by name", detailed.diagnostics.some((d) => d.reason.includes("ghost")), JSON.stringify(detailed.diagnostics.map((d) => d.reason)));
  check("an action on a missing target is reported", detailed.diagnostics.some((d) => d.reason.includes("nobody")));
  check("every diagnostic reports the resulting scene size", detailed.diagnostics.every((d) => d.sceneObjects >= 1));

  // Strictness is not weakened where it matters.
  check("a NaN coordinate is still rejected outright", parseVisualAction({ action: "move", id: "x", placement: { kind: "point", x: Number.NaN, y: 0 } }) === null);
  check("a zero-size object is still rejected", parseVisualAction({ action: "create_shape", id: "x", shape: "circle", width: 0, height: 0 }) === null);
  check("an invalid duration is still rejected", parseVisualAction({ action: "wait", durationMs: 99999 }) === null);
  check("a connector to itself is still rejected", parseVisualAction({ action: "create_arrow", id: "x", from: "a", to: "a" }) === null);
  check("an unknown connector kind is still rejected", parseVisualAction({ action: "create_arrow", id: "x", from: "a", to: "b", kind: "teleport" }) === null);
}

// =============================================================================================
// 23. ANIMATION — teaching motion, interruption safety, and no stale state
// =============================================================================================
section("23. Animations teach, and an interruption leaves nothing stale");
{
  const created = applyVisualActions(emptyVisualScene(), [
    { action: "create_array", id: "arr", values: ["10", "20"], indices: true, animate: { kind: "appear", durationMs: 400 } },
  ]);
  check("a created cell records an appear animation", byId(created, "arr-c0")?.motion?.kind === "appear" && byId(created, "arr-c0")?.motion?.durationMs === 400);

  const drawn = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "a", shape: "circle", text: "A", placement: { kind: "point", x: 200, y: 200 } },
    { action: "create_shape", id: "b", shape: "circle", text: "B", placement: { kind: "point", x: 600, y: 200 } },
    { action: "create_connector", id: "c", from: "a", to: "b", animate: { kind: "draw", durationMs: 700 } },
  ]);
  check("a connection is drawn, not faded in", byId(drawn, "c")?.motion?.kind === "draw" && byId(drawn, "c")?.motion?.durationMs === 700);

  const flowing = applyVisualActions(drawn, [{ action: "flow", id: "c", durationMs: 900 }]);
  check("flow records a packet run along the connection", byId(flowing, "c")?.motion?.kind === "flow" && byId(flowing, "c")?.motion?.flowProgress === 0);

  const highlighted = applyVisualActions(drawn, [{ action: "highlight_many", ids: ["a", "b"] }]);
  check("highlight_many marks every named object", byId(highlighted, "a")?.emphasis === true && byId(highlighted, "b")?.emphasis === true);
  check("highlighting lifts a dimmed object back into view", byId(applyVisualActions(applyVisualActions(highlighted, [{ action: "dim", ids: ["a"] }]), [{ action: "highlight", id: "a" }]), "a")?.dimmed === false);
  const dimmed = applyVisualActions(highlighted, [{ action: "dim", ids: ["a", "b"] }]);
  check("restore clears dimming", applyVisualActions(dimmed, [{ action: "restore" }]).objects.every((object) => object.dimmed === false));
  check("an unknown id in focus is simply ignored, never a crash", applyVisualActions(highlighted, [{ action: "focus", ids: ["ghost"] }]).focusIds?.[0] === "ghost");

  // Interruption: settle() finishes every in-flight animation and leaves no timer behind.
  const busy = applyVisualActions(emptyVisualScene(), [
    { action: "create_shape", id: "a", shape: "circle", text: "A", placement: { kind: "point", x: 200, y: 200 } },
    { action: "wait", durationMs: 900 },
    { action: "create_shape", id: "b", shape: "circle", text: "B", placement: { kind: "point", x: 600, y: 200 }, animate: { kind: "appear", durationMs: 800 } },
    { action: "create_arrow", id: "c", from: "a", to: "b", animate: { kind: "draw", durationMs: 900 } },
  ]);
  check("the step really does schedule delayed animation", (byId(busy, "b")?.motion?.delayMs ?? 0) > 0 && (byId(busy, "c")?.motion?.delayMs ?? 0) > 0);
  const settled = settleVisualScene(busy);
  check("interrupting clears every delay", settled.objects.every((object) => (object.motion?.delayMs ?? 0) === 0));
  check("interrupting finishes a flow packet at its destination", settled.objects.every((object) => object.motion?.flowProgress !== 0 || object.motion?.kind !== "flow"));
  check("interrupting preserves the scene exactly (nothing is lost)", settled.objects.length === busy.objects.length && settled.objects.every((object, index) => object.id === busy.objects[index].id && object.x === busy.objects[index].x));
  check("settling twice is a no-op (idempotent, so a double interrupt cannot corrupt state)", JSON.stringify(settleVisualScene(settled).objects.map((o) => [o.id, o.x, o.y])) === JSON.stringify(settled.objects.map((o) => [o.id, o.x, o.y])));

  // Re-applying a step does not duplicate animation loops: objects keep one motion each.
  const again = applyVisualActions(busy, [{ action: "wait", durationMs: 100 }]);
  check("re-running a step does not multiply objects", again.objects.length === busy.objects.length);
  check("each object still carries exactly one motion", again.objects.every((object) => !object.motion || typeof object.motion.tick === "number"));
}

section("30. Code blocks — teaching code as code, not as a formula");
{
  const code = [
    "int swap(int a[], int i, int j) {",
    "  int t = a[i];",
    "  a[i] = a[j];",
    "  a[j] = t;",
    "}",
  ].join("\n");

  const parsed = parseVisualAction({ action: "create_code_block", id: "cb", code, language: "c", title: "swap", highlightLines: [3] });
  check("a well-formed code block is accepted", parsed !== null);
  check("the block keeps the language, title and highlighted line",
    parsed?.action === "create_code_block" && parsed.language === "c" && parsed.title === "swap" && parsed.highlightLines?.[0] === 3);
  check("an empty listing is refused", parseVisualAction({ action: "create_code_block", id: "cb", code: "   " }) === null);
  check("a listing with no id is refused", parseVisualAction({ action: "create_code_block", code }) === null);
  check("a non-integer highlight line is refused",
    parseVisualAction({ action: "create_code_block", id: "cb", code, highlightLines: [1.5] }) === null);
  check("a highlight line below 1 is refused",
    parseVisualAction({ action: "create_code_block", id: "cb", code, highlightLines: [0] }) === null);

  const measured = compileCodeBlock(code, { title: "swap", highlightLines: [3, 99] });
  check("indentation survives measurement exactly", measured.lines[1] === "  int t = a[i];", JSON.stringify(measured.lines[1]));
  check("a trailing newline is not counted as a line of code", measured.lines.length === 5, String(measured.lines.length));
  check("an out-of-range highlight line is ignored rather than crashing", measured.highlightLines.length === 1 && measured.highlightLines[0] === 3);
  check("the panel is sized to the widest line, not a guess", measured.width > 300 && measured.height >= measured.lines.length * 19);

  const long = compileCodeBlock(Array.from({ length: 60 }, (_, index) => `line ${index}`).join("\n"));
  check("an over-long listing is bounded to a readable number of lines", long.lines.length === 22, String(long.lines.length));

  const scene = getVisualScene(applyVisualActions(emptyVisualScene(), [{ action: "create_code_block", id: "cb", code, title: "swap", highlightLines: [3] } as VisualAction]));
  const block = scene.objects.find((object) => object.id === "cb")!;
  check("the engine builds a code_block object", block !== undefined && block.kind === "code_block");
  check("the object carries the source and its measured lines", block.code === code && block.codeLines?.length === 5);
  check("the block is placed fully on the board", block.x - block.width / 2 >= 0 && block.y - block.height / 2 >= 0);
  check("the block is wide enough to read", block.width > 250 && block.fontSize === undefined || block.width > 250);

  // ---- the repair that rescues code the model sent as a formula.
  const asFormula = repairVisualActions([{ action: "write_formula", id: "f1", text: "if (a[j] > a[j+1]) { swap(a[j], a[j+1]); }" }]);
  check("source code sent as a formula is drawn as a code block",
    asFormula.actions[0]?.action === "create_code_block", JSON.stringify(asFormula.actions[0]?.action));
  check("the repair says what it did", /code/i.test(asFormula.diagnostics[0]?.reason ?? ""), asFormula.diagnostics[0]?.reason ?? "");

  const asLines = repairVisualActions([{ action: "write_formula", id: "f2", values: ["temp = a", "a = b", "b = temp"] }]);
  check("a formula sent as a list of lines is drawn as a code block", asLines.actions[0]?.action === "create_code_block");

  const realFormula = repairVisualActions([{ action: "write_formula", id: "f3", formula: "mean = (12 + 19 + 29) / 3 = 20" }]);
  check("a genuine maths formula is left alone", realFormula.actions[0]?.action === "write_formula", JSON.stringify(realFormula.actions[0]?.action));
  const quadratic = repairVisualActions([{ action: "write_formula", id: "f4", formula: "x^2 + y^2 = z^2" }]);
  check("a maths identity is not mistaken for code", quadratic.actions[0]?.action === "write_formula", JSON.stringify(quadratic.actions[0]?.action));
}

section("31. Syntax highlighting is structural, not decorative");
{
  check("a keyword is recognised", highlightCodeLine("return x;").tokens.some((token) => token.kind === "keyword" && token.text === "return"));
  check("a call is recognised", highlightCodeLine("print(value);").tokens.some((token) => token.kind === "function" && token.text === "print"));
  check("a string is one token", highlightCodeLine('name = "hello world"').tokens.some((token) => token.kind === "string" && token.text === '"hello world"'));
  check("a # inside a string is not a comment", highlightCodeLine('url = "http://x"').tokens.some((token) => token.kind === "string"));
  check("a // comment runs to end of line", highlightCodeLine("// note").tokens.every((token) => token.kind === "comment"));
  check("a # comment is a comment", highlightCodeLine("# note").tokens.every((token) => token.kind === "comment"));
  check("a number is one token", highlightCodeLine("n = 42;").tokens.some((token) => token.kind === "number" && token.text === "42"));
  check("a /* ... */ comment colours only its first line",
    highlightCodeLine("/* doc").tokens.every((token) => token.kind === "comment"));
  check("block comment state carries to the next line",
    highlightCode(["/* doc", "still doc", "done */ x = 1;"])[2].some((token) => token.kind === "comment"));
  check("indentation is preserved token for token",
    highlightCodeLine("    if (x) {").tokens[0]?.text.startsWith("    ") === true);
  check("every token's text concatenates back to the original line",
    highlightCodeLine("  int t = a[i];").tokens.map((token) => token.text).join("") === "  int t = a[i];");
  check("an empty line produces no tokens", highlightCodeLine("").tokens.length === 0);

  check("a C function is code", looksLikeCode("int swap(int a[], int i) {\n  int t = a[i];\n}"));
  check("a Python def is code", looksLikeCode("def fact(n):\n    if n <= 1:\n        return 1\n    return n * fact(n - 1)"));
  check("pseudocode with keywords and colons is code", looksLikeCode("for each element in list:\n    swap(left, right)\n    advance pointer"));
  check("a maths formula is not code", !looksLikeCode("F = ma"));
  check("a Pythagorean identity is not code", !looksLikeCode("x^2 + y^2 = z^2"));
  check("a fraction is not code", !looksLikeCode("\\frac{a}{b} = \\frac{c}{d}"));
  check("an empty string is not code", !looksLikeCode("   "));
  check("a single prose sentence is not code", !looksLikeCode("push the value onto the top of the stack"));
}

section("32. The execution pointer MOVES — a code trace must not highlight a random line");
{
  const code = ["int t = a[i];", "a[i] = a[j];", "a[j] = t;"].join("\n");

  const parsed = parseVisualAction({ action: "set_code_pointer", id: "cb", lines: [2] });
  check("a well-formed pointer move is accepted", parsed !== null);
  check("it carries the target and the 1-based lines", parsed?.action === "set_code_pointer" && parsed.lines[0] === 2);
  check("a pointer move with no lines is refused", parseVisualAction({ action: "set_code_pointer", id: "cb", lines: [] }) === null);
  check("a pointer move with a zero line is refused", parseVisualAction({ action: "set_code_pointer", id: "cb", lines: [0] }) === null);
  check("a pointer move with a fractional line is refused", parseVisualAction({ action: "set_code_pointer", id: "cb", lines: [1.5] }) === null);
  check("a pointer move with no id is refused", parseVisualAction({ action: "set_code_pointer", lines: [1] }) === null);

  const scene = getVisualScene(applyVisualActions(emptyVisualScene(), [
    { action: "create_code_block", id: "cb", code, highlightLines: [1] },
  ] as VisualAction[]));
  check("the block starts with its first line lit", scene.objects.find((object) => object.id === "cb")?.highlightLines?.[0] === 1);

  const moved = getVisualScene(applyVisualActions(scene, [{ action: "set_code_pointer", id: "cb", lines: [3] }] as VisualAction[]));
  const after = moved.objects.find((object) => object.id === "cb");
  check("the pointer moves to the line asked for", after?.highlightLines?.[0] === 3, JSON.stringify(after?.highlightLines));
  check("moving the pointer does not recreate the block", moved.objects.length === scene.objects.length && after?.code === code);

  // A line past the end of the listing must not leave a pointer pointing at nothing.
  const past = getVisualScene(applyVisualActions(scene, [{ action: "set_code_pointer", id: "cb", lines: [99] }] as VisualAction[]));
  check("a pointer past the last line is dropped, not drawn off the listing",
    (past.objects.find((object) => object.id === "cb")?.highlightLines ?? []).length === 0);

  // Pointing at something that is not a code block must be a no-op rather than a broken board.
  const notCode = getVisualScene(applyVisualActions(scene, [{ action: "set_code_pointer", id: "missing", lines: [1] }] as VisualAction[]));
  check("pointing at an object that is not a listing changes nothing", notCode.objects.length === scene.objects.length);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

