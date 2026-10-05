const { buildPrompt } = require("../.test-out/lib/teaching/prompt");
const { planRequest } = require("../.test-out/lib/teaching/requestPlan");
const { emptyVisual3DScene } = require("../.test-out/lib/visual3d/types");
const { geminiTeachingLessonSchema } = require("../.test-out/lib/teaching/providers/gemini");

const schema = JSON.stringify(geminiTeachingLessonSchema);
const questions = [
  "Teach me how blood flows through the human heart using a 3D model.",
  "Teach me photosynthesis using a 3D visualization.",
  "Teach me the TCP three-way handshake using a 3D network.",
  "Teach me how a pendulum works in 3D.",
  "Teach me the structure of an atom using a 3D visualization.",
  "Teach me the solar system in 3D.",
  "Teach me the volume of a cylinder using a 3D visualization.",
  "Explain binary search trees.",
  "Why does a rainbow form after rain? Show me what happens inside a raindrop.",
  "How does a car engine convert fuel into motion?",
  "How does an HTTP request travel from my browser to a server?",
  "Why does the Moon have phases?",
  "Explain how a lens focuses light.",
];
const mk = (q, s3d) => ({
  question: q,
  language: "English",
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  visualState: { objects: [], tick: 0 },
  visualState3d: s3d,
});
let worst = 0;
let total = 0;
for (const q of questions) {
  const p = planRequest(mk(q, emptyVisual3DScene()), "lesson", schema);
  const b = buildPrompt(mk(q, emptyVisual3DScene()));
  worst = Math.max(worst, p.size.totalTokens);
  total += p.size.totalTokens;
  console.log(
    q.slice(0, 40).padEnd(42) +
      " tokens=" + String(p.size.totalTokens).padStart(4) +
      " conf=" + b.assets.confidence.padEnd(6) +
      " rel=" + b.assets.relevant.slice(0, 5).map((a) => a.id).join(","),
  );
}
const sys = buildPrompt(mk("x", emptyVisual3DScene()));
console.log("system ~tokens", Math.ceil(sys.system.length / 3.5), "| user ~tokens", Math.ceil(sys.user.length / 3.5), "| schema", Math.ceil(schema.length / 3.5));
console.log("worst", worst, "mean", Math.round(total / questions.length));
