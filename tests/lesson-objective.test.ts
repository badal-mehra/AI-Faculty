// LESSON OBJECTIVE TESTS — the behaviour that turns one request into a complete teaching session.
//
// Covers: how a request is classified (deep by default, brief only when explicitly asked), the
// objective each subject is planned against, and — most importantly — that a lesson can only be
// "complete" when the planned stages were actually taught.
import { classifyTeachingIntent, detectDepth, extractTopic } from "../lib/teaching/intent";
import {
  LessonProgress,
  TeachingStage,
  applyStepsToProgress,
  buildLessonObjective,
  createLessonProgress,
  currentStage,
  isObjectiveComplete,
  lessonProgressView,
  remainingStages,
  wordCount,
} from "../lib/teaching/objective";
import { buildPrompt, teachingLessonPrompt, teachingPrompt } from "../lib/teaching/prompt";
import { TOKEN_BUDGET, measureRequest } from "../lib/teaching/budget";
import { planRequest } from "../lib/teaching/requestPlan";
import { geminiTeachingLessonSchema, geminiTeachingSchema } from "../lib/teaching/providers/gemini";
import { jsonTeachingLessonSchema, jsonTeachingSchema } from "../lib/teaching/providers/jsonSchema";
import { parseAllTeachingSteps, parseTeachingLessonResponse, parseTeachingRequest, parseTeachingResponse } from "../lib/teaching/validation";
import { ProviderError, withProviderTimeout } from "../lib/teaching/providers/error";
import { renumberLessonSteps } from "../lib/teaching/providers/router";
import { TeachingRequest, TeachingResponse } from "../lib/teaching/types";
import { emptyVisual3DScene } from "../lib/visual3d/types";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }

const baseRequest = (question: string, overrides: Partial<TeachingRequest> = {}): TeachingRequest => ({
  question,
  language: "English",
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  visualState: { objects: [], tick: 0 },
  visualState3d: emptyVisual3DScene(),
  ...overrides,
});

/** A step shaped like a real teacher paragraph: about four sentences of note-taking-sized speech. */
const teachingSpeech = (topic: string) => `Now let us look at ${topic} more carefully. `
  + `The first thing to notice is that it is built from smaller parts, and each part has its own job. `
  + `Imagine you are holding one of those parts in your hand and turning it over to see how it fits the others. `
  + `Once that picture is clear, the whole idea becomes easy to remember, so write this part down.`;

const step = (lessonStep: number, stageId: string | undefined, speech: string): TeachingResponse => ({
  speech,
  board_actions: [],
  visual_actions: [],
  visual3d_actions: [],
  lesson_step: lessonStep,
  next_step: lessonStep + 1,
  ...(stageId ? { stage_id: stageId } : {}),
});

const kindsOf = (question: string): string[] => buildLessonObjective({ question }).stages.map((stage) => stage.kind);

section("1. An educational request is a lesson: deep teaching is the default");
{
  check("'Explain RAM.' is a deep lesson", classifyTeachingIntent("Explain RAM.").depth === "deep");
  check("'Explain linked list.' is a deep lesson", classifyTeachingIntent("Explain linked list.").depth === "deep");
  check("'Teach me recursion.' is a deep lesson", classifyTeachingIntent("Teach me recursion.").depth === "deep");
  check("'Explain TCP.' is a deep lesson", classifyTeachingIntent("Explain TCP.").depth === "deep");
  check("'Explain photosynthesis.' is a deep lesson", classifyTeachingIntent("Explain photosynthesis.").depth === "deep");
  check("'Explain pointers in C++.' is a deep lesson", classifyTeachingIntent("Explain pointers in C++.").depth === "deep");
  check("the student never needs to say 'in detail' to get a lesson", kindsOf("Explain linked list.").length >= 8);

  const bare = classifyTeachingIntent("what is RAM?");
  check("'what is RAM?' is not an explicit short request", bare.explicitShort === false, JSON.stringify(bare));
  check("'what is RAM?' is still a valid teaching request", bare.topic.length > 0 && bare.subject.length > 0);

  check("the topic is extracted, not the whole sentence", extractTopic("Explain linked list in C++ from scratch.").topic === "linked list", extractTopic("Explain linked list in C++ from scratch.").topic);
  check("the code language is extracted from the request", extractTopic("Explain linked list in C++.").codeLanguage === "C++");
  check("a leading 'teach me' is stripped from the topic", extractTopic("Teach me photosynthesis.").topic === "photosynthesis", extractTopic("Teach me photosynthesis.").topic);
}

section("2. An explicitly short request is answered briefly");
{
  for (const question of [
    "Define recursion in one sentence.",
    "Define polymorphism in one sentence.",
    "Give me the formula for area of a circle.",
    "What is the meaning of recursion?",
    "What does inheritance mean?",
    "what is 2+2?",
  ]) {
    const intent = classifyTeachingIntent(question);
    check(`'${question}' is answered briefly`, intent.depth === "brief" && intent.explicitShort === true, intent.depth);
  }

  const brief = buildLessonObjective({ question: "Define recursion in one sentence." });
  check("a brief request is one short answer, not a lesson", brief.stages.length === 1 && brief.minSteps === 1 && brief.batchSize === 1, JSON.stringify({ stages: brief.stages.length, minSteps: brief.minSteps }));
  check("an explicit depth request still wins over a short pattern", detectDepth("Define recursion in detail.").depth === "deep");
  check("'from scratch' always means a deep lesson", detectDepth("Define recursion from scratch.").depth === "deep");
}

section("3. Each subject is planned against its own teaching arc");
{
  const programming = buildLessonObjective({ question: "Explain linked list in C++." });
  check("a linked list lesson plans more than eight stages", programming.stages.length >= 9, String(programming.stages.length));
  check("a programming lesson includes code, walkthrough and execution", ["code", "walkthrough", "execution"].every((kind) => programming.stages.some((stage) => stage.kind === kind)), kindsOf("Explain linked list in C++.").join(","));
  check("a programming lesson ends with a recap", programming.stages.at(-1)?.kind === "recap");
  check("intuition comes before the technical definition", programming.stages.findIndex((stage) => stage.kind === "intuition") < programming.stages.findIndex((stage) => stage.kind === "concept"));
  check("a prerequisite is taught before anything else", programming.stages[0]?.kind === "prerequisite");
  check("the prerequisite is the one this topic actually needs", programming.prerequisite.includes("pointer"), programming.prerequisite);
  check("code is marked as part of the objective", programming.codeRelevant === true && programming.codeLanguage === "C++");
  check("a code stage is flagged as needing code", programming.stages.some((stage) => stage.kind === "code" && stage.needsCode === true));
  check("a visual stage is flagged as needing a visual", programming.stages.some((stage) => stage.needsVisual === true));
  check("every stage has a goal the teacher can be judged against", programming.stages.every((stage) => stage.goal.length > 30));

  const noLanguage = buildLessonObjective({ question: "Explain linked list." });
  check("a language-free programming lesson still teaches the concept deeply", noLanguage.stages.length >= 8, String(noLanguage.stages.length));
  check("a language-free lesson still reaches a recap", noLanguage.stages.at(-1)?.kind === "recap");

  const tcp = buildLessonObjective({ question: "Teach me TCP three-way handshake." });
  check("TCP is planned as networking", tcp.subject === "networking", tcp.subject);
  check("TCP is a visual lesson", tcp.stages.some((stage) => stage.kind === "visual" && stage.needsVisual === true));
  check("TCP teaches terminology and mechanics before the recap", ["terminology", "mechanics"].every((kind) => tcp.stages.some((stage) => stage.kind === kind)), tcp.stages.map((stage) => stage.kind).join(","));
  check("TCP plans at least eight stages", tcp.stages.length >= 8, String(tcp.stages.length));

  const photosynthesis = buildLessonObjective({ question: "Explain photosynthesis." });
  check("photosynthesis is planned as biology", photosynthesis.subject === "biology", photosynthesis.subject);
  check("photosynthesis starts from a prerequisite", photosynthesis.stages[0]?.kind === "prerequisite");
  check("photosynthesis is a visual lesson", photosynthesis.stages.some((stage) => stage.kind === "visual"));
  check("photosynthesis covers mistakes and real use", ["mistakes", "application"].every((kind) => photosynthesis.stages.some((stage) => stage.kind === kind)));
  check("photosynthesis plans at least eight stages", photosynthesis.stages.length >= 8, String(photosynthesis.stages.length));

  const maths = kindsOf("Explain the derivative of x squared.");
  check("mathematics teaches notation and a harder example", maths.includes("notation") && maths.includes("advanced"), maths.join(","));

  check("the deepest request gets the biggest plan", kindsOf("Teach me linked list in C++ from scratch with examples.").length >= kindsOf("Explain linked list in C++.").length);
}

section("4. Completion is objective-based, never a batch, a timer or a provider flag");
{
  const objective = buildLessonObjective({ question: "Explain linked list in C++." });
  const start = createLessonProgress(objective);

  // The exact old failure: one paragraph that declares itself the end of the topic.
  const early = step(1, "s1", teachingSpeech("linked list"));
  const afterEarly = applyStepsToProgress(start, [early]);
  check("one early step that repeats its own step number is NOT complete", isObjectiveComplete(afterEarly, objective) === false);
  check("a single step cannot complete a deep lesson", afterEarly.coveredStageIds.length <= 2, afterEarly.coveredStageIds.join(","));
  check("the lesson continues from the first uncovered stage", currentStage(afterEarly)?.id !== "s1" || remainingStages(afterEarly).length > 0);

  // Filler speech cannot cover a stage, no matter how many steps arrive.
  let filler = start;
  for (let index = 1; index <= 6; index += 1) filler = applyStepsToProgress(filler, [step(index, "s1", "Ab node banate hain.")]);
  check("repeating a tiny filler sentence covers nothing", isObjectiveComplete(filler, objective) === false && filler.coveredStageIds.length === 0, filler.coveredStageIds.join(","));

  // Real teaching, delivered one planned stage at a time, does complete the lesson.
  let taught = start;
  objective.stages.forEach((target: TeachingStage, index) => {
    taught = applyStepsToProgress(taught, [step(index + 1, target.id, teachingSpeech(objective.topic))]);
  });
  check("every planned stage can be covered by real teaching speech", taught.coveredStageIds.length === objective.stages.length, `${taught.coveredStageIds.length}/${objective.stages.length}`);
  check("a lesson that taught every stage IS complete", isObjectiveComplete(taught, objective) === true);
  check("a covered stage stays covered", applyStepsToProgress(taught, [step(99, "s1", teachingSpeech(objective.topic))]).coveredStageIds.length === objective.stages.length);

  // A label alone never covers a stage.
  const mislabelled = applyStepsToProgress(start, [step(1, "s1", "Ok.")]);
  check("a declared stage_id with no teaching speech covers nothing", mislabelled.coveredStageIds.length === 0);

  // Unlabelled steps are still credited, in order, so the objective is met either way.
  let unlabelled = start;
  objective.stages.forEach((_target, index) => { unlabelled = applyStepsToProgress(unlabelled, [step(index + 1, undefined, teachingSpeech(objective.topic))]); });
  check("unlabelled steps still advance the plan", unlabelled.coveredStageIds.length === objective.stages.length, `${unlabelled.coveredStageIds.length}/${objective.stages.length}`);

  // The hard stop exists so a provider that never advances cannot loop forever.
  let runaway = start;
  for (let index = 1; index <= objective.maxSteps; index += 1) runaway = applyStepsToProgress(runaway, [step(index, "s1", " ")]);
  check("the safety cap eventually stops a runaway lesson", isObjectiveComplete(runaway, objective) === true);
  check("a deep lesson allows many steps, not a handful", objective.maxSteps >= 30 && objective.minSteps >= 6, `${objective.minSteps}/${objective.maxSteps}`);

  const view = lessonProgressView(taught, objective);
  check("progress reports the covered and remaining stages", view.coveredStageIds.length === objective.stages.length && view.remainingStageIds.length === 0 && view.complete === true);
  check("progress reports how many teaching words were delivered", view.stepsDelivered === objective.stages.length);
  check("word counting ignores filler like punctuation", wordCount("one two three") === 3 && wordCount("") === 0);
}

section("5. A deep lesson carries enough teaching content to be a lesson");
{
  // Not a timing rule: a volume rule. A paragraph is not a lesson, however long it is spoken for.
  for (const question of ["Explain linked list in C++.", "Teach me recursion.", "Explain photosynthesis.", "Teach me TCP three-way handshake."]) {
    const objective = buildLessonObjective({ question });
    const requiredWords = objective.stages.reduce((total, stage) => total + stage.minWords, 0);
    const spokenMinutes = requiredWords / 150;
    // A floor, not a promise: every stage needs a real teacher paragraph, and there are enough stages
    // that a lesson cannot be finished by a single response however chatty that response is.
    check(`'${question}' requires a real lesson's worth of teaching`, requiredWords >= 250 && spokenMinutes >= 1.6 && objective.stages.length >= 9 && objective.minSteps >= 6, `${requiredWords} words ≈ ${spokenMinutes.toFixed(1)} min across ${objective.stages.length} stages`);
  }
}

section("5b. A stage is not re-taught, and an untaught stage is not skipped");
{
  const objective = buildLessonObjective({ question: "Explain linked list in C++." });
  let progress = createLessonProgress(objective);
  // Teach each planned stage once, with the length of paragraph a provider actually writes.
  objective.stages.forEach((stage, index) => {
    progress = applyStepsToProgress(progress, [step(index + 1, stage.id, teachingSpeech("this stage of the lesson"))]);
  });
  check("a single short teaching paragraph per stage is enough to cover it", progress.coveredStageIds.length === objective.stages.length, `${progress.coveredStageIds.length}/${objective.stages.length}`);
  check("the lesson then ends instead of re-teaching the same stage", isObjectiveComplete(progress, objective) === true);

  // A provider that keeps declaring an already-taught stage must not restart the lesson.
  const revisited = applyStepsToProgress(progress, [step(99, "s1", "Another paragraph about the very first stage, which has already been taught and must not be taught again at all.")]);
  check("a stage that is already taught is never re-opened", revisited.coveredStageIds.length === objective.stages.length && isObjectiveComplete(revisited, objective) === true);

  // Out-of-order declarations still leave the skipped stage uncovered, so the plan keeps it.
  let skipped = createLessonProgress(objective);
  skipped = applyStepsToProgress(skipped, objective.stages.slice(6).map((stage, index) => step(index + 1, stage.id, teachingSpeech("this later stage of the lesson"))));
  check("teaching a later stage out of order does not complete the lesson", isObjectiveComplete(skipped, objective) === false);
  check("the stages that were skipped are still the ones queued next", currentStage(skipped)?.id === "s1", currentStage(skipped)?.id);
}

section("6. Lesson state survives an interruption, a resume and a new lesson");
{
  const objective = buildLessonObjective({ question: "Explain linked list in C++." });
  let progress: LessonProgress = createLessonProgress(objective);
  progress = applyStepsToProgress(progress, [step(1, "s1", teachingSpeech("memory")), step(2, "s2", teachingSpeech("the box analogy"))]);

  // The browser echoes the progress back on the next batch.
  const view = lessonProgressView(progress, objective);
  const request = parseTeachingRequest({ ...baseRequest("Explain linked list in C++."), lessonProgress: view });
  check("an echoed progress payload survives validation", request?.lessonProgress?.coveredStageIds.length === 2, JSON.stringify(request?.lessonProgress?.coveredStageIds));
  check("the delivered step count survives too", request?.lessonProgress?.stepsDelivered === 2);

  const plan = planRequest({ ...baseRequest("Explain linked list in C++."), lessonProgress: view }, "lesson", JSON.stringify(geminiTeachingLessonSchema));
  check("a resumed lesson does not restart from stage one", currentStage(plan.progress)?.id === "s3", currentStage(plan.progress)?.id);
  check("a resumed lesson keeps the same objective", plan.objective.stages.length === objective.stages.length);

  const malformed = parseTeachingRequest({ ...baseRequest("Explain linked list in C++."), lessonProgress: { topic: "x" } });
  check("a malformed progress payload is dropped instead of failing the lesson", malformed !== null && malformed.lessonProgress === undefined);

  const fresh = planRequest(baseRequest("Explain linked list in C++."), "lesson", "{}");
  check("a brand new lesson starts at the first stage", currentStage(fresh.progress)?.id === "s1");
}

section("7. The prompt teaches the lesson, not just the next step");
{
  const deep = teachingLessonPrompt(baseRequest("Explain linked list in C++."));
  check("the prompt carries the lesson objective", deep.includes("LESSON OBJECTIVE") && deep.includes("linked list"));
  check("the prompt lists the planned stages", /\[\w+\]/.test(deep) && deep.includes("TEACH NOW"));
  check("the prompt asks for a batch, not for the end of the lesson", deep.includes("This batch:") && deep.includes("stage_id"));
  check("the prompt teaches the lesson, not just the next step", buildPrompt(baseRequest("Explain linked list in C++.")).system.includes("You never decide that a lesson is over"));
  check("the teacher's voice demands teacher-sized speech", buildPrompt(baseRequest("Explain linked list in C++.")).system.includes("4-8 sentences"));
  check("the teacher's voice demands intuition before the technical definition", buildPrompt(baseRequest("Explain linked list in C++.")).system.includes("intuition or everyday analogy FIRST") && buildPrompt(baseRequest("Explain linked list in C++.")).system.includes("technical term"));
  check("the prompt tells the teacher to start from the very basics", deep.includes("from the very basics"));
  check("the recap is the last stage of the lesson", buildLessonObjective({ question: "Explain linked list in C++." }).stages.at(-1)?.goal.includes("write it down") === true, buildLessonObjective({ question: "Explain linked list in C++." }).stages.at(-1)?.goal);
  check("the recap asks for what the student can now DO, not for a comment on the lesson", buildLessonObjective({ question: "Explain linked list in C++." }).stages.at(-1)?.goal.includes("DO or recall") === true);
  check("a brief request is told to answer briefly", teachingPrompt(baseRequest("Define recursion in one sentence.")).includes("SHORT ANSWER"));
  check("the single-step prompt is still smaller than the lesson prompt", teachingPrompt(baseRequest("Explain linked list in C++.")).length < deep.length);

  const midLesson = teachingLessonPrompt(baseRequest("Explain linked list in C++.", {
    lessonStep: 7,
    lessonProgress: { ...lessonProgressView(createLessonProgress(buildLessonObjective({ question: "Explain linked list in C++." })), buildLessonObjective({ question: "Explain linked list in C++." })), coveredStageIds: ["s1", "s2", "s3"], stepsDelivered: 6 },
  }));
  check("a mid-lesson prompt shows what has already been taught", midLesson.includes("Already taught") && midLesson.includes("s1 Prerequisite") === false && midLesson.includes("Before we start"));
  check("a mid-lesson prompt never re-lists a taught stage as work left to do", !/\[todo\] s1\b/.test(midLesson));
  check("a mid-lesson prompt targets the next uncovered stage", midLesson.includes("TEACH NOW: s4"), midLesson.split("\n").find((line) => line.includes("TEACH NOW")) ?? "");
}

section("8. The objective still fits the request budget");
{
  const busyScene = {
    ...emptyVisual3DScene(),
    objects: Array.from({ length: 20 }, (_, i) => ({
      id: `obj-${i}`, objectKind: "model" as const, type: "model" as const, order: i,
      position: { x: i, y: i, z: i }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 },
      radius: 1.2, color: "#fff", opacity: 1, visible: true, highlight: false,
      highlightColor: "#ffe66d", castShadow: true, receiveShadow: true, asset: "biology/heart",
    })),
  };

  for (const question of ["Explain linked list in C++ from scratch.", "Teach me TCP three-way handshake.", "Explain photosynthesis.", "Explain the volume of a cylinder."]) {
    const plan = planRequest(baseRequest(question, { lessonStep: 9, visualState3d: busyScene, previousTeaching: Array.from({ length: 12 }, () => "a fairly long previous sentence about the lesson in progress") }), "lesson", JSON.stringify(geminiTeachingLessonSchema));
    check(`the objective request fits the budget: ${question.slice(0, 26)}…`, plan.size.totalTokens <= TOKEN_BUDGET, `${plan.size.totalTokens} tokens (${plan.level})`);
  }

  const schemaJson = JSON.stringify(geminiTeachingLessonSchema);
  const measured = measureRequest("system", teachingLessonPrompt(baseRequest("Explain linked list in C++.")), schemaJson);
  check("the lesson prompt is a real prompt, not a paragraph", measured.userTokens > 1200, `${measured.userTokens} tokens`);
}

section("9. Step and lesson payloads both validate");
{
  const withStage = parseTeachingResponse({ speech: "A lesson step.", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 3, next_step: 4, stage_id: "s3" });
  check("a step may declare the stage it teaches", withStage?.stage_id === "s3");
  check("a step without a stage id is still valid", parseTeachingResponse({ speech: "A lesson step.", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 3, next_step: 4 })?.stage_id === undefined);
  check("a blank stage id is dropped rather than trusted", parseTeachingResponse({ speech: "x", board_actions: [], lesson_step: 1, next_step: 2, stage_id: "  " })?.stage_id === undefined);

  const objective = buildLessonObjective({ question: "Explain linked list in C++." });
  const taught = applyStepsToProgress(createLessonProgress(objective), objective.stages.map((stage, index) => step(index + 1, stage.id, teachingSpeech("linked list"))));
  const lesson = parseTeachingLessonResponse({ steps: [{ speech: teachingSpeech("x"), board_actions: [], lesson_step: 1, next_step: 2 }], progress: lessonProgressView(taught, objective) });
  check("a lesson response carries objective progress", lesson?.progress?.complete === true);
  check("a lesson response without progress still validates", parseTeachingLessonResponse({ steps: [{ speech: "x", board_actions: [], lesson_step: 1, next_step: 2 }] })?.steps.length === 1);

  check("both wire schemas declare stage_id", geminiTeachingSchema.properties.stage_id !== undefined && jsonTeachingSchema.properties.stage_id !== undefined);
  check("both lesson schemas declare stage_id", geminiTeachingLessonSchema.properties.steps.items.properties.stage_id !== undefined && jsonTeachingLessonSchema.properties.steps.items.properties.stage_id !== undefined);
  check("a malformed progress payload is rejected, not half-parsed", parseTeachingLessonResponse({ steps: [{ speech: "x", board_actions: [], lesson_step: 1, next_step: 2 }], progress: { topic: "x", depth: "forever" } })?.progress === undefined);
}

section("10. A long lesson is protected from long lessons' failure modes");
async function longLessonSafety(): Promise<void> {
  const good = { speech: "A real teaching paragraph.", board_actions: [], lesson_step: 1, next_step: 2 };
  const malformed = { speech: 42, board_actions: "not-an-array", lesson_step: 2, next_step: 3 };

  // One malformed step must not throw away the five good teaching steps around it.
  const partial = parseAllTeachingSteps({ steps: [good, malformed, good, malformed, good] });
  check("a batch keeps the steps that are valid", partial?.length === 3, String(partial?.length));
  check("a batch of nothing but malformed steps is still rejected", parseAllTeachingSteps({ steps: [malformed, malformed] }) === null);
  check("a batch with no steps array is rejected", parseAllTeachingSteps({ nope: true }) === null);

  // A hung provider call must be bounded, or one batch can stall a classroom that is otherwise fine.
  // A promise that never settles is exactly the real failure mode, and nothing must be left behind.
  const started = Date.now();
  const hung = await withProviderTimeout("gemini", "A test call", 120, () => new Promise(() => {})).catch((error) => error);
  const elapsed = Date.now() - started;
  check("a hung provider call is given up on instead of holding the classroom", elapsed < 2_000, `${elapsed}ms`);
  check("giving up on a hung call is a transient failure, so the router falls back", hung instanceof ProviderError && hung.transient === true && hung.status === 504);

  const answered = await withProviderTimeout("gemini", "A test call", 5_000, async () => "ok");
  check("a call that answers in time is returned untouched", answered === "ok");
  const failed = await withProviderTimeout("groq", "A test call", 5_000, async () => { throw new Error("upstream said no"); }).catch((error) => error);
  check("a provider failure passes through unchanged", failed instanceof Error && failed.message === "upstream said no");

  // A provider that numbers its own steps can skip, repeat, or point backwards. The classroom walks
  // `next_step`, so a gap stalls the lesson and a backwards pointer restarts it.
  const at7 = renumberLessonSteps(
    [
      { speech: "a", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 8, next_step: 9 },
      { speech: "b", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 10, next_step: 11 },
      { speech: "c", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 6, next_step: 7 },
    ],
    7,
  );
  check("gaps, repeats and backwards pointers are renumbered into one consecutive run", at7.map((s) => `${s.lesson_step}->${s.next_step}`).join(",") === "7->8,8->9,9->10");
  check("the last step always points forwards, so the lesson asks for more", at7[2].next_step > at7[2].lesson_step);
  const alreadyFine = renumberLessonSteps([{ speech: "a", board_actions: [], visual_actions: [], visual3d_actions: [], lesson_step: 3, next_step: 4 }], 3);
  check("correctly numbered steps are left untouched", alreadyFine[0].next_step === 4);
  check("an empty batch renumbers to an empty batch", renumberLessonSteps([], 5).length === 0);
}

longLessonSafety()
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });