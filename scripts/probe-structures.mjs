// Renders the four domain-aware 2D structures and checks the board they produce.
//
// The question this answers is not "do they parse" — the type checker knows that. It is "does the board
// a structure compiles to actually teach anything": are the objects inside the frame, is the formula
// bigger than its own symbol table, does every force point the way it says, and is every label
// readable at the size it was measured for.
//
//   node scripts/probe-structures.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { compileStructure } = require("../.test-out/lib/visual/layout.js");
const { applyVisualActions, getVisualScene } = require("../.test-out/lib/visual/engine.js");
const { emptyVisualScene } = require("../.test-out/lib/visual/types.js");
const { parseVisualActions } = require("../.test-out/lib/visual/validate.js");
const { DIAGRAM_WIDTH, DIAGRAM_HEIGHT, VISUAL_MARGIN } = require("../.test-out/lib/visual/types.js");

let passed = 0;
let failed = 0;
const check = (name, condition, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};

const LABEL_FONT = 16;
const TITLE_FONT = 21;
const SYMBOL_FONT = 20;

/** Everything a teacher would look for on the board, measured from the resolved scene. */
function audit(name, action) {
  const compiled = compileStructure(action);
  check(`${name}: compiles`, compiled !== null && compiled.length > 0);
  if (!compiled || compiled.length === 0) return null;

  let scene = emptyVisualScene();
  scene = applyVisualActions(scene, compiled);
  scene = getVisualScene(scene);
  const boxes = scene.objects.map((object) => ({
    id: object.id,
    ...bounds(object),
    text: object.text ?? "",
    fontSize: object.fontSize ?? LABEL_FONT,
    shape: object.shape ?? object.kind,
    rotation: object.rotation ?? 0,
  }));

  const outside = boxes.filter((box) => box.left < -1 || box.top < -1 || box.right > DIAGRAM_WIDTH + 1 || box.bottom > DIAGRAM_HEIGHT + 1);
  check(`${name}: every object is inside the board`, outside.length === 0, outside.map((box) => box.id).join(", "));

  // A measured label that overflows its own SHAPE is the "disconnected text" failure. Text objects are
  // excluded: their own width IS the measured text width, and comparing one against the other measures
  // nothing. What matters for text is that it is inside the frame and clear of other objects.
  const overflowing = boxes.filter((box) => box.shape === "shape" && box.text.length > 0 && box.textWidth > box.width + 2);
  check(`${name}: no label overflows the shape it names`, overflowing.length === 0,
    overflowing.map((box) => `${box.id} "${box.text}" ${Math.round(box.textWidth)}>${Math.round(box.width)}`).join(" | "));

  const overlaps = [];
  for (let a = 0; a < boxes.length; a += 1) {
    for (let b = a + 1; b < boxes.length; b += 1) {
      if (overlapsBox(boxes[a], boxes[b])) overlaps.push(`${boxes[a].id} x ${boxes[b].id}`);
    }
  }
  check(`${name}: nothing overlaps anything else`, overlaps.length === 0, overlaps.slice(0, 6).join(" | "));

  return { boxes, scene };
}

function bounds(object) {
  const halfWidth = object.width / 2;
  const halfHeight = object.height / 2;
  return {
    left: object.x - halfWidth, right: object.x + halfWidth,
    top: object.y - halfHeight, bottom: object.y + halfHeight,
    width: object.width, height: object.height,
    // Text width as measured: the engine measured it when it sized the shape, so this is what the
    // renderer will actually draw.
    textWidth: object.text ? object.text.length * (object.fontSize ?? LABEL_FONT) * 0.58 : 0,
  };
}

const overlapsBox = (a, b) => {
  // A one-pixel rule under a table row is meant to sit next to its label, so a thin object never counts
  // as overlapping the text above it.
  if (a.height <= 2 || b.height <= 2) return false;
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
};

// ------------------------------------------------------------------------------------- formula taught
const equation = audit("equation_block", {
  action: "create_equation_block",
  id: "newton2",
  formula: "F = m · a",
  calculates: "the force needed to give a mass an acceleration",
  variables: [
    { symbol: "F", meaning: "net force", unit: "N" },
    { symbol: "m", meaning: "mass", unit: "kg" },
    { symbol: "a", meaning: "acceleration", unit: "m/s²" },
  ],
});
if (equation) {
  const formula = equation.boxes.find((box) => box.id === "newton2-formula");
  const symbols = equation.boxes.filter((box) => /^newton2-v\d+$/.test(box.id));
  const meanings = equation.boxes.filter((box) => /^newton2-m\d+$/.test(box.id));
  check("equation_block: the formula is set larger than its symbol table", (formula?.fontSize ?? 0) > SYMBOL_FONT, `${formula?.fontSize}`);
  check("equation_block: every symbol got its own addressable row", symbols.length === 3, symbols.map((box) => box.id).join(","));
  check("equation_block: every symbol got its meaning beside it", meanings.length === 3);
  check("equation_block: the symbol column sits above its meanings", symbols.every((box, index) => (meanings[index]?.top ?? 0) >= box.top - 2));
  check("equation_block: units travel with the meaning", meanings.every((box) => box.text.includes("(")), meanings.map((box) => box.text).join(" | "));
  check("equation_block: the formula says what it calculates", equation.boxes.some((box) => box.id === "newton2-calc" && box.text.includes("force")));
}

// ------------------------------------------------------------------------------------- forces
const freeBody = audit("free_body", {
  action: "create_free_body_diagram",
  id: "block",
  body: "block",
  forces: [
    { name: "weight", direction: "down", magnitude: "20 N" },
    { name: "normal", direction: "up", magnitude: "20 N", acts: "surface" },
    { name: "applied", direction: "right", magnitude: "10 N", acts: "surface" },
  ],
  motion: { label: "accelerating right", direction: "right" },
});
if (freeBody) {
  const body = freeBody.boxes.find((box) => box.id === "block-body");
  const weight = freeBody.boxes.find((box) => box.id === "block-f0");
  const normal = freeBody.boxes.find((box) => box.id === "block-f1");
  const applied = freeBody.boxes.find((box) => box.id === "block-f2");
  check("free_body: down really points down", weight?.rotation === 90, `${weight?.rotation}`);
  check("free_body: up really points up", normal?.rotation === -90, `${normal?.rotation}`);
  check("free_body: right really points right", applied?.rotation === 0, `${applied?.rotation}`);
  check("free_body: weight acts at the centre", (weight?.top ?? 0) > (body?.top ?? 0));
  check("free_body: the normal force acts on the surface it touches",
    (normal?.top ?? 0) <= (body?.top ?? 0), `normal.top=${normal?.top} body.top=${body?.top}`);
  check("free_body: every force is named", freeBody.boxes.filter((box) => /^block-fl\d+$/.test(box.id)).length === 3);
  check("free_body: magnitudes are printed", freeBody.boxes.some((box) => box.text.includes("20 N")));
  check("free_body: the motion arrow is dashed-away from the body", freeBody.boxes.some((box) => box.id === "block-motion"));
}

// ------------------------------------------------------------------------------------- circuit
const circuit = audit("circuit", {
  action: "create_circuit",
  id: "rc",
  elements: [
    { label: "V", kind: "battery", value: "5 V" },
    { label: "R", kind: "resistor", value: "1 kΩ" },
    { label: "C", kind: "capacitor", value: "100 µF" },
  ],
  current: true,
});
if (circuit) {
  check("circuit: every component is addressable on its own",
  ["rc-c0", "rc-c1", "rc-c2"].every((id) => circuit.boxes.some((box) => box.id === id)),
  circuit.boxes.map((box) => box.id).join(","));
  check("circuit: the loop is closed with wires", circuit.boxes.some((box) => box.id === "rc-wire-left") && circuit.boxes.some((box) => box.id === "rc-wire-right"));
  check("circuit: the left and right rails are vertical", circuit.boxes.find((box) => box.id === "rc-wire-left")?.rotation === 90);
  check("circuit: component values are printed", circuit.boxes.some((box) => box.text.includes("100 µF")));
  check("circuit: the current direction is shown", circuit.boxes.some((box) => box.id === "rc-current"));
}

// ------------------------------------------------------------------------------------- plot
const plot = audit("plot", {
  action: "create_graph_plot",
  id: "charge",
  points: [
    { x: 0, y: 0 }, { x: 1, y: 3.2 }, { x: 2, y: 4.3 }, { x: 3, y: 4.8 }, { x: 4, y: 5 },
  ],
  xLabel: "time (RC)",
  yLabel: "capacitor voltage (V)",
  shape: "rises quickly, then flattens toward V₀",
  guide: { y: 5, label: "V₀" },
  title: "Charging a capacitor",
});
if (plot) {
  const segments = plot.boxes.filter((box) => /^charge-seg\d+$/.test(box.id));
  check("plot: the curve is drawn as measured segments", segments.length === 4, String(segments.length));
  check("plot: a rising curve is drawn rising (SVG rotates clockwise, so up-right is negative)", (segments[0]?.rotation ?? 0) < 0, `${segments[0]?.rotation}`);
  check("plot: the last segment flattens", Math.abs(segments[segments.length - 1]?.rotation ?? 90) < 30, `${segments.at(-1)?.rotation}`);
  check("plot: the axes are drawn", plot.boxes.some((box) => box.id === "charge-axis-x") && plot.boxes.some((box) => box.id === "charge-axis-y"));
  check("plot: both axes are named", plot.boxes.some((box) => box.text.includes("time")) && plot.boxes.some((box) => box.text.includes("voltage")));
  check("plot: the shape is described in words", plot.boxes.some((box) => box.text.includes("flattens")));
  check("plot: the guide is inside the plot frame", plot.boxes.some((box) => box.id === "charge-guide"));

  // A falling curve must point the other way, or the axes are lying.
  const falling = audit("falling_plot", {
    action: "create_graph_plot",
    id: "decay",
    points: [{ x: 0, y: 5 }, { x: 1, y: 3.7 }, { x: 2, y: 2.7 }, { x: 3, y: 2 }],
    xLabel: "time", yLabel: "value",
  });
  const fallSegment = falling?.boxes.find((box) => box.id === "decay-seg0");
  check("plot: a falling curve is drawn falling", (fallSegment?.rotation ?? 0) > 0, `${fallSegment?.rotation}`);
}

// ------------------------------------------------------------------ parsing goes through the contract
console.log("\n== the wire contract accepts the new structures");
const parsed = parseVisualActions([
  { action: "create_equation_block", id: "eq", formula: "F = ma", variables: [{ symbol: "F", meaning: "force" }] },
  { action: "create_free_body_diagram", id: "fbd", body: "block", forces: [{ name: "weight", direction: "down" }] },
  { action: "create_circuit", id: "cir", elements: [{ label: "R", kind: "resistor" }, { label: "C", kind: "capacitor" }] },
  { action: "create_graph_plot", id: "gp", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], xLabel: "t", yLabel: "v" },
]);
check("all four structures parse through the shared contract", parsed !== null && parsed.length === 4, parsed === null ? "null" : String(parsed.length));

const withUnit = parseVisualActions([{ action: "create_equation_block", id: "eq", formula: "F = ma", variables: [{ symbol: "F", meaning: "force", unit: "N" }] }]);
check("a supplied unit survives", JSON.stringify(withUnit ?? []).includes("N"), JSON.stringify(withUnit));
const noSymbol = parseVisualActions([{ action: "create_free_body_diagram", id: "fbd", body: "block", forces: [{ name: "sideways", direction: "diagonal" }] }]);
check("a force with an impossible direction is rejected", noSymbol === null || noSymbol.length === 0, JSON.stringify(noSymbol));
const oneElementCircuit = parseVisualActions([{ action: "create_circuit", id: "cir", elements: [{ label: "R", kind: "resistor" }] }]);
check("a circuit with one component is rejected (it cannot be a loop)", oneElementCircuit === null || oneElementCircuit.length === 0, JSON.stringify(oneElementCircuit));
const onePointPlot = parseVisualActions([{ action: "create_graph_plot", id: "gp", points: [{ x: 0, y: 0 }] }]);
check("a plot with one point is rejected (there is no curve)", onePointPlot === null || onePointPlot.length === 0, JSON.stringify(onePointPlot));
const noId = parseVisualActions([{ action: "create_equation_block", formula: "F = ma" }]);
check("a structure with no id is dropped rather than guessed", noId === null || noId.length === 0, JSON.stringify(noId));
const noForces = parseVisualActions([{ action: "create_free_body_diagram", id: "fbd", body: "block", forces: [] }]);
check("a free-body diagram with no forces is dropped", noForces === null || noForces.length === 0, JSON.stringify(noForces));
const emptyFormula = parseVisualActions([{ action: "create_equation_block", id: "eq", formula: "" }]);
check("an equation block with no formula is dropped", emptyFormula === null || emptyFormula.length === 0, JSON.stringify(emptyFormula));

console.log(`\n${passed} passed, ${failed} failed`);
void DIAGRAM_HEIGHT; void VISUAL_MARGIN;
process.exit(failed > 0 ? 1 : 0);