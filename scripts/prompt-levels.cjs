const { buildPrompt } = require("../.test-out/lib/teaching/prompt");
const { planRequest, replan } = require("../.test-out/lib/teaching/requestPlan");
const { measureRequest } = require("../.test-out/lib/teaching/budget");
const { emptyVisual3DScene } = require("../.test-out/lib/visual3d/types");
const { geminiTeachingLessonSchema } = require("../.test-out/lib/teaching/providers/gemini");

const GEMINI_SCHEMA = JSON.stringify(geminiTeachingLessonSchema);
const base = (question, overrides = {}) => ({
  question,
  language: "English",
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  visualState: { objects: [], tick: 0 },
  visualState3d: emptyVisual3DScene(),
  ...overrides,
});

const req = base("Teach me the solar system in 3D.");
for (const level of ["full", "compact", "minimal"]) {
  const p = buildPrompt(req, { level });
  const size = measureRequest(p.system, p.user, GEMINI_SCHEMA);
  console.log(level.padEnd(9), "sys", size.systemTokens, "user", size.userTokens, "schema", size.schemaTokens, "total", size.totalTokens, "assets", p.assets.relevant.length);
}
const plan = planRequest(req, "lesson", GEMINI_SCHEMA);
console.log("plan level", plan.level, plan.size.totalTokens);
const compacted = replan(req, GEMINI_SCHEMA, plan.level);
console.log("compacted", compacted?.level, compacted?.size.totalTokens);
