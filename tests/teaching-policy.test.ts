// VISUAL REPRESENTATION POLICY — the tests for "a design lesson may not be drawn as a call stack".
//
// The IDEO framework lesson was classified correctly and STILL arrived with a code listing on the board,
// because nothing in the pipeline connected the subject to a representation. Three gates had to agree before
// that lesson could be drawn as code, and all three were silent: the prompt never said "no code", the
// structure gate only knew eleven coarse subjects and design resolved to `humanities`, and the quality
// report counted drops without naming a representation as the reason.
//
// These tests assert the CONTRACT, not the implementation: the exact diagnostic text, the fact that the
// prompt carries the same rule the gate enforces, and that a real design step comes out of the real
// alignment path with its code block removed and the reason recorded.
import { alignAndJudge } from "../lib/teaching/quality";
import { buildLessonObjective, createLessonProgress } from "../lib/teaching/objective";
import { checkRepresentation, foreignRepresentations, visualPolicyFor } from "../lib/teaching/visualPolicy";
import { buildPrompt } from "../lib/teaching/prompt";
import { emptyBoardState } from "../lib/board/types";
import { emptyVisualScene } from "../lib/visual/types";
import { emptyVisual3DScene } from "../lib/visual3d/types";
import type { TeachingRequest, TeachingResponse } from "../lib/teaching/types";

let passed = 0;
let failed = 0;
const check = (name: string, condition: boolean, detail = "") => {
  if (condition) passed += 1;
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` -- ${detail}` : ""}`); }
};
const section = (title: string) => console.log(`\n== ${title}`);

const request = (question: string): TeachingRequest => ({
  question,
  language: "English",
  lessonStep: 1,
  boardState: emptyBoardState(),
  visualState: emptyVisualScene(),
  visualState3d: emptyVisual3DScene(),
  previousTeaching: [],
});

// ----------------------------------------------------------------------- The diagnostic is a contract

section("a foreign representation names itself");

{
  const design = visualPolicyFor("design", "humanities");
  const verdict = checkRepresentation(design, "create_code_block");
  check("design rejects a code block", verdict.allowed === false);
  check(
    "the diagnostic is the exact agreed wording",
    verdict.allowed === false && verdict.diagnostic === "Rejected code representation: subject=design, no programming intent.",
    verdict.allowed ? "allowed" : verdict.diagnostic,
  );
  check("design keeps the structures it should have", design.structures.has("create_timeline") && design.structures.has("create_pipeline"));
  check("design has no code structure at all", design.structures.has("create_code_block") === false);
}

{
  const mathematics = visualPolicyFor("mathematics", "mathematics");
  check("mathematics rejects code", checkRepresentation(mathematics, "create_code_block").allowed === false);
  check("mathematics keeps equations", checkRepresentation(mathematics, "create_equation_block").allowed === true);
  check("mathematics keeps plots", checkRepresentation(mathematics, "create_graph_plot").allowed === true);
}

{
  const programming = visualPolicyFor("computer-science", "programming");
  check("a programming lesson may show code", checkRepresentation(programming, "create_code_block").allowed === true);
  check("a programming lesson may show a stack", checkRepresentation(programming, "create_stack").allowed === true);
  const computerScience = visualPolicyFor("computer-science", "computer-science");
  check("computer-science may show code", checkRepresentation(computerScience, "create_code_block").allowed === true);
}

{
  const physics = visualPolicyFor("physics", "physics");
  check("physics rejects a circuit", checkRepresentation(physics, "create_circuit").allowed === false);
  check("physics keeps the free-body diagram", checkRepresentation(physics, "create_free_body_diagram").allowed === true);
}

{
  const biology = visualPolicyFor("biology", "biology");
  check("biology rejects code", checkRepresentation(biology, "create_code_block").allowed === false);
  check("biology keeps a pipeline", checkRepresentation(biology, "create_pipeline").allowed === true);
}

{
  // The diagnostic says "no programming intent", which is a claim about THIS lesson rather than about the
  // domain forever: a design lesson that explicitly asks for a code comparison may show one, and a design
  // lesson that merely mentions the word "code" may not.
  const design = visualPolicyFor("design", "humanities");
  check(
    "explicit programming intent legalises a code block",
    checkRepresentation(design, "create_code_block", { codeIntent: true }).allowed === true,
  );
  check("the design policy still says code is not its representation", design.allowCode === false);
}

{
  const counted = foreignRepresentations(visualPolicyFor("design", "humanities"), [
    { action: "create_code_block" },
    { action: "create_code_block" },
    { action: "create_pipeline" },
  ]);
  check("repeated foreign structures count once, with one diagnostic", counted.count === 1, JSON.stringify(counted));
}

// ------------------------------------------------------------------------ The prompt says the same thing

section("the prompt carries the same rule the gate enforces");

{
  const designPrompt = buildPrompt(request("Teach me the IDEO framework for design thinking."), { level: "full" }).system;
  check("a design prompt names the design domain", designPrompt.includes("domain=design"), "policy line missing");
  check("a design prompt forbids a code block", designPrompt.includes("No create_code_block"), "no-code rule missing");

  const mathsPrompt = buildPrompt(request("Solve ∫ x² sin(x) dx."), { level: "full" }).system;
  check("a mathematics prompt forbids a code block", mathsPrompt.includes("No create_code_block"), "no-code rule missing");
  check("a mathematics prompt still points at equations", mathsPrompt.includes("create_equation_block"));

  const programmingPrompt = buildPrompt(request("Explain linked lists in C++."), { level: "full" }).system;
  check("a programming prompt does not forbid code", !programmingPrompt.includes("No create_code_block"), "code was forbidden in a programming lesson");
}

// ------------------------------------------------------ The real pipeline actually removes it

section("the alignment pipeline removes a foreign representation and says why");

{
  const designQuestion = "Teach me the IDEO framework for design thinking.";
  const objective = buildLessonObjective({ question: designQuestion });
  const step: TeachingResponse = {
    speech: "The IDEO framework runs through four phases: Inspiration is what people need, Ideation is what we might build for them, and Implementation is where we test it with them.",
    board_actions: [],
    visual3d_actions: [],
    lesson_step: 1,
    next_step: 2,
    teaching_intent: "introduce_concept",
    visual_actions: [
      { action: "create_pipeline", id: "ideo", stages: ["Inspiration", "Ideation", "Implementation"] },
      { action: "create_code_block", id: "snippet", language: "python", code: "def ideo():\n    return ['inspiration', 'ideation']" },
    ],
  };

  const judged = alignAndJudge(request(designQuestion), [step], objective, createLessonProgress(objective), "2d");
  const emitted = judged.steps[0]?.visual_actions ?? [];
  check("the design pipeline survives", emitted.some((action) => action.action === "create_pipeline"), JSON.stringify(emitted.map((action) => action.action)));
  check("the code block is gone", emitted.every((action) => action.action !== "create_code_block"), JSON.stringify(emitted.map((action) => action.action)));

  const reasons = judged.steps[0] ? [] : [];
  void reasons;
  const report = judged.report as unknown as { steps?: Array<{ dropped?: Array<{ reason: string }> }> };
  void report;
  const diagnostics = JSON.stringify(judged).includes("Rejected code representation: subject=design, no programming intent.");
  check("the reason is recorded, not swallowed", diagnostics, JSON.stringify(judged.report.issues.map((issue) => `${issue.kind}:${issue.detail}`)));
}

{
  const programmingQuestion = "Explain how a linked list is implemented in C++.";
  const objective = buildLessonObjective({ question: programmingQuestion });
  const step: TeachingResponse = {
    speech: "Each node stores a value and a pointer to the next node, and the list is traversed by following those pointers until one is null.",
    board_actions: [],
    visual3d_actions: [],
    lesson_step: 1,
    next_step: 2,
    teaching_intent: "introduce_concept",
    visual_actions: [
      { action: "create_linked_list", id: "list", nodes: [{ id: "n0", value: "10" }, { id: "n1", value: "20" }, { id: "n2", value: "30" }], head: "n0" },
      { action: "create_code_block", id: "snippet", language: "cpp", code: "struct Node { int v; Node* next; };" },
    ],
  };
  const judged = alignAndJudge(request(programmingQuestion), [step], objective, createLessonProgress(objective), "2d");
  const emitted = judged.steps[0]?.visual_actions ?? [];
  check("a programming lesson keeps its linked list", emitted.some((action) => action.action === "create_linked_list"));
  check("a programming lesson keeps its code", emitted.some((action) => action.action === "create_code_block"), JSON.stringify(emitted.map((action) => action.action)));
}

console.log(`\nteaching-policy: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);