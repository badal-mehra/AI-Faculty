const { teachingLessonPrompt } = require("./.test-out/lib/teaching/prompt");
const { buildLessonObjective, createLessonProgress, lessonProgressView } = require("./.test-out/lib/teaching/objective");
const { emptyVisual3DScene } = require("./.test-out/lib/visual3d/types");
const baseRequest = (question, o = {}) => ({ question, language: "English", lessonStep: 1, boardState: { nodes: [], edges: [], texts: [], highlights: [] }, visualState: { objects: [], tick: 0 }, visualState3d: emptyVisual3DScene(), ...o });
const objective = buildLessonObjective({ question: "Explain linked list in C++." });
const out = teachingLessonPrompt(baseRequest("Explain linked list in C++.", { lessonStep: 7, lessonProgress: { ...lessonProgressView(createLessonProgress(buildLessonObjective({ question: "Explain linked list in C++." })), buildLessonObjective({ question: "Explain linked list in C++." })), coveredStageIds: ["s1", "s2", "s3"], stepsDelivered: 6 } }));
console.log(out.split("\n").filter(l => l.includes("[todo] s1 ") || l.includes("Already") || l.includes("TEACH NOW")).join("\n"));
console.log("has [todo] s1 ->", out.includes("[todo] s1"));
