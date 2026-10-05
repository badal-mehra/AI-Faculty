const { buildPrompt } = require("./.test-out/lib/teaching/prompt");
const { measureRequest } = require("./.test-out/lib/teaching/budget");
const { buildLessonObjective, resumeLessonProgress } = require("./.test-out/lib/teaching/objective");
const { emptyVisual3DScene } = require("./.test-out/lib/visual3d/types");
const { geminiTeachingLessonSchema } = require("./.test-out/lib/teaching/providers/gemini");
const schema = JSON.stringify(geminiTeachingLessonSchema);
const base = (question, o={}) => ({ question, language: "English", lessonStep: 1, boardState: { nodes: [], edges: [], texts: [], highlights: [] }, visualState: { objects: [], tick: 0 }, visualState3d: emptyVisual3DScene(), ...o });
for (const q of ["Explain photosynthesis.", "Teach me the solar system in 3D.", "Explain binary search trees.", "Explain linked list in C++."]) {
  const req = base(q, { lessonStep: 22 });
  const obj = buildLessonObjective(req);
  const prog = resumeLessonProgress(obj, undefined);
  const row = ["full","compact","minimal"].map(l => { const p = buildPrompt(req, { level: l, objective: obj, progress: prog }); return l + "=" + measureRequest(p.system, p.user, schema).totalTokens; });
  console.log(q, "|", row.join(" "));
}
