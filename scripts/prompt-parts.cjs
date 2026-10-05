const { buildPrompt } = require("../.test-out/lib/teaching/prompt");
const { emptyVisual3DScene } = require("../.test-out/lib/visual3d/types");
const mk = (q) => ({ question: q, language: "English", lessonStep: 1, boardState: { nodes: [], edges: [], texts: [], highlights: [] }, visualState: { objects: [], tick: 0 }, visualState3d: emptyVisual3DScene() });
const sys = buildPrompt(mk("x")).system;
const lines = sys.split("\n");
let group = "";
const out = [];
for (const line of lines) {
  if (/^\d\)/.test(line)) { if (group) out.push(group); group = line; }
  else if (/^[A-Z][a-z]+ [a-z]+:|^- /.test(line)) { out.push(group); out.push(line); group = ""; }
  else group += "\n" + line;
}
if (group) out.push(group);
for (const chunk of out) {
  if (!chunk.trim()) continue;
  console.log(String(Math.ceil(chunk.length / 3.5)).padStart(5), chunk.split("\n")[0].slice(0, 90));
}
console.log("TOTAL", Math.ceil(sys.length / 3.5), "chars", sys.length);
