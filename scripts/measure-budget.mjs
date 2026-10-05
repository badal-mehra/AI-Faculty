// Measures the request budget for representative lessons at every context level.
//
// The pedagogical layer added a real contract to the schema, and the schema shares a 7000-token
// budget with a large action vocabulary. This is how that trade is checked instead of discovered: a
// lesson that silently drops to `minimal` loses the live scene it was supposed to extend.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const { buildPrompt } = require("../.test-out/lib/teaching/prompt.js");
const { measureRequest, TOKEN_BUDGET, TOKEN_HARD_LIMIT } = require("../.test-out/lib/teaching/budget.js");
const { jsonTeachingLessonSchemaFor } = require("../.test-out/lib/teaching/providers/jsonSchema.js");
const { emptyBoardState } = require("../.test-out/lib/board/types.js");

// Measured the way the router measures: against the schema the prompt's own families imply, which is
// what a real request is billed for. Measuring against the full three-renderer schema overstates every
// 2D lesson by about a thousand tokens.
const familiesOf = (prompt) => ({
  graph: prompt.system.includes("1) GRAPH"),
  diagram: prompt.system.includes("2) DIAGRAM"),
  scene3d: prompt.system.includes("3) 3D"),
});

console.log("full three-renderer schema tokens:", measureRequest("", "", JSON.stringify(jsonTeachingLessonSchemaFor({ graph: true, diagram: true, scene3d: true }))).schemaTokens);

const busy3d = {
  objects: Array.from({ length: 20 }, (_, index) => ({ id: `obj-${index}`, type: "model", asset: "biology/heart" })),
  flows: [], labels: [], annotations: [],
  camera: { position: { x: 6, y: 4, z: 8 }, target: { x: 0, y: 0, z: 0 }, fov: 45, near: 0.1, far: 400, mode: "default" },
  bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 }, radius: 0 },
  memory: { visibility: {}, hiddenParts: {}, isolatePart: {}, explodeOffsets: {}, pulse: {}, oscillation: {} },
  tick: 0,
};

const cases = [
  ["heart-3d", "Explain the human heart and how blood circulates through it.", busy3d],
  ["photosynthesis", "Explain photosynthesis and how a leaf makes sugar.", busy3d],
  ["integration", "Solve the integral of x squared times sine of x.", undefined],
  ["newton-2", "Explain Newton's second law of motion with a worked example.", undefined],
  ["bonding", "Explain chemical bonding between ions and covalent bonds.", undefined],
  ["rc-circuit", "Analyze an RC circuit and explain its transient response.", undefined],
  ["binary-search", "Explain binary search and trace it on an array.", undefined],
  ["tcp", "Explain the TCP three-way handshake and show each message.", undefined],
];

for (const [label, question, scene] of cases) {
  const levels = ["full", "compact", "minimal"].map((level) => {
    const prompt = buildPrompt({
      question, language: "English", lessonStep: 3,
      boardState: emptyBoardState(),
      visualState: { objects: [], tick: 0 },
      visualState3d: scene,
      previousTeaching: Array.from({ length: 8 }, () => "a fairly long previous sentence about the lesson in progress"),
    }, { level });
    return `${level}=${measureRequest(prompt.system, prompt.user, JSON.stringify(jsonTeachingLessonSchemaFor(familiesOf(prompt)))).totalTokens}`;
  });
  const fits = levels.filter((entry) => Number(entry.split("=")[1]) <= TOKEN_BUDGET)[0] ?? "NONE FITS";
  const level = fits.split("=")[0];
  const smallest = Math.min(...levels.map((entry) => Number(entry.split("=")[1])));
  // `minimal` throws away the live scene, so a 3D lesson that only fits there is a lesson that keeps
  // restarting its board. Above the hard limit the request is rejected outright.
  const verdict = smallest > TOKEN_HARD_LIMIT
    ? "REJECTED (over the hard limit)"
    : level === "NONE FITS" ? "TOO LARGE" : level === "minimal" ? "loses scene state" : "keeps scene state";
  console.log(label.padEnd(14), levels.join("  "), "| best:", level.padEnd(8), verdict);
}