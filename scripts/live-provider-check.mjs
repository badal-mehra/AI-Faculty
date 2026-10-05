// LIVE PROVIDER PROBE — exercises the real Gemini/Groq pipeline exactly as the classroom does.
// It never prints API keys or prompt bodies; it prints provider, model, token estimate, latency and
// the shape of the response (family, objects, assets, labels, flows, camera actions).
//
// Usage: npx tsx scripts/live-provider-check.mjs           # topic coverage
//        npx tsx scripts/live-provider-check.mjs continue  # multi-step context bounding
//        npx tsx scripts/live-provider-check.mjs hindi     # Hindi + arbitrary questions
import fs from "node:fs";

// Load .env.local so the probe talks to the real providers with the project's keys.
for (const line of fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
  const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (match) process.env[match[1]] = match[2];
}

const { generateTeachingStep } = await import("../lib/teaching/providers/router.ts");
const { applyVisual3DActions } = await import("../lib/visual3d/engine.ts");
const { emptyVisual3DScene } = await import("../lib/visual3d/types.ts");

const EMPTY_BOARD = { nodes: [], edges: [], texts: [], highlights: [] };

const TOPICS = [
  "Teach me how blood flows through the human heart using a 3D model.",
  "Teach me photosynthesis using a 3D visualization.",
  "Teach me the TCP three-way handshake using a 3D network.",
  "Teach me how a pendulum works in 3D.",
  "Teach me the structure of an atom using a 3D visualization.",
  "Teach me the solar system in 3D.",
  "Teach me the volume of a cylinder using a 3D visualization.",
  "Explain binary search trees.",
];

const HINDI = ["हृदय में रक्त का प्रवाह 3D में समझाओ।", "प्रकाश संश्लेषण की प्रक्रिया 3D में समझाओ।"];

const ARBITRARY = [
  "Why does a rainbow form after rain? Show it as a diagram.",
  "How does a car engine convert fuel into motion?",
  "Why does the Moon have phases?",
  "Explain how a lens focuses light.",
  "Explain recursion in programming.",
];

async function ask(question, overrides = {}) {
  const startedAt = Date.now();
  try {
    const result = await generateTeachingStep({ question, language: "English", lessonStep: 1, boardState: EMPTY_BOARD, ...overrides });
    const actions = result.response.visual3d_actions;
    const scene = actions.length > 0 ? applyVisual3DActions(overrides.visualState3d ?? emptyVisual3DScene(), actions) : (overrides.visualState3d ?? emptyVisual3DScene());
    return {
      question: question.slice(0, 42),
      provider: result.provider,
      level: result.level,
      estTokens: result.estimatedTokens,
      latencyMs: Date.now() - startedAt,
      family: actions.length > 0 ? "3d" : result.response.visual_actions.length > 0 ? "2d" : "graph",
      board: result.response.board_actions.length,
      visual2d: result.response.visual_actions.length,
      visual3d: actions.length,
      objects: scene.objects.length,
      assets: scene.objects.map((object) => object.asset).filter(Boolean),
      labels: scene.labels.length,
      flows: scene.flows.length,
      camera: actions.filter((action) => action.action.endsWith("camera")).map((action) => action.action),
      speech: result.response.speech.slice(0, 70),
    };
  } catch (error) {
    return { question: question.slice(0, 42), error: String(error).slice(0, 200), latencyMs: Date.now() - startedAt };
  }
}

const mode = process.argv[2] ?? "topics";
const rows = [];

if (mode === "topics") {
  for (const question of TOPICS) rows.push(await ask(question));
} else if (mode === "hindi") {
  for (const question of [...HINDI, ...ARBITRARY]) {
    rows.push(await ask(question, { language: /[ऀ-ॿ]/.test(question) ? "Hindi" : "English" }));
  }
} else if (mode === "continue") {
  // A three-step lesson on one topic: the second and third steps carry the live 3D scene and the
  // spoken history, which is exactly what the request bounding has to keep small.
  const first = await ask("Teach me how blood flows through the human heart using a 3D model.");
  rows.push(first);
  if (!first.visual3d) {
    rows.push({ question: "continue", error: "step 1 produced no 3D scene" });
  } else {
    const request = { question: "Teach me how blood flows through the human heart using a 3D model.", language: "English", lessonStep: 1, boardState: EMPTY_BOARD };
    const step1 = await generateTeachingStep(request);
    const scene = applyVisual3DActions(emptyVisual3DScene(), step1.response.visual3d_actions);
    rows.push(await ask(request.question, { lessonStep: 2, visualState3d: scene, previousTeaching: [step1.response.speech], studentQuestion: "Explain what the pulmonary artery does." }));
    const step2Scene = applyVisual3DActions(scene, step1.response.visual3d_actions);
    rows.push(await ask(request.question, { lessonStep: 3, visualState3d: step2Scene, previousTeaching: [step1.response.speech, "the student asked about the pulmonary artery"], studentQuestion: "Explain what the pulmonary artery does." }));
  }
} else {
  throw new Error(`Unknown mode: ${mode}`);
}

for (const row of rows) console.log(JSON.stringify(row));