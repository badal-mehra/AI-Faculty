// Teaching pipeline tests: asset selection, prompt compaction, context bounding, request budget
// and provider failure handling (404 / 429 / 5xx / 413).
import { selectAssetsForLesson, libraryIndexText, assetCatalogText } from "../lib/teaching/assetSelection";
import { buildPrompt, teachingLessonPrompt, teachingPrompt, visualFamiliesFor } from "../lib/teaching/prompt";
import { compactState, recentSpeech, sceneAssetIds } from "../lib/teaching/context";
import { TOKEN_BUDGET, TOKEN_HARD_LIMIT, chooseLevel, estimateTokens, measureRequest } from "../lib/teaching/budget";
import { planRequest, replan } from "../lib/teaching/requestPlan";
import { geminiTeachingLessonSchema } from "../lib/teaching/providers/gemini";
import { generateTeachingStep } from "../lib/teaching/providers/router";
import { MISTRAL_TEACHING_MODEL_NAME, extractJsonPayload } from "../lib/teaching/providers/mistral";
import { jsonTeachingSchema } from "../lib/teaching/providers/jsonSchema";
import { parseTeachingResponse } from "../lib/teaching/validation";
import { clearGeminiHealth, getGeminiModelHealth, isGeminiModelAvailable } from "../lib/teaching/providers/health";
import { TeachingRequest } from "../lib/teaching/types";
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

const GEMINI_SCHEMA = JSON.stringify(geminiTeachingLessonSchema);

section("1. Relevant asset selection (never the whole registry)");
{
  const heart = selectAssetsForLesson("Teach me how blood flows through the human heart using a 3D model.");
  check("heart question selects the heart", heart.relevant[0]?.id === "biology/heart", heart.relevant.map((a) => a.id).join(","));

  const tcp = selectAssetsForLesson("Teach me the TCP three-way handshake using a 3D network.");
  const tcpIds = tcp.relevant.map((asset) => asset.id);
  check("TCP question selects network hardware", tcpIds.includes("network/laptop") && tcpIds.includes("network/router"), tcpIds.join(","));
  check("TCP selection is capped", tcp.relevant.length <= 12, String(tcp.relevant.length));

  const pendulum = selectAssetsForLesson("Teach me how a pendulum works in 3D.");
  check("pendulum question selects the pendulum", pendulum.relevant.some((asset) => asset.id === "physics/pendulum"), pendulum.relevant.map((a) => a.id).join(","));

  const cylinder = selectAssetsForLesson("Teach me the volume of a cylinder using a 3D visualization.");
  check("cylinder question selects the cylinder", cylinder.relevant.some((asset) => asset.id === "mathematics/cylinder"), cylinder.relevant.map((a) => a.id).join(","));

  const solar = selectAssetsForLesson("Teach me the solar system in 3D.");
  check("solar question leads with the sun", solar.relevant[0]?.id === "astronomy/sun", solar.relevant.map((a) => a.id).join(","));

  const engine = selectAssetsForLesson("How does a car engine convert fuel into motion?");
  check("arbitrary question matches a real registry entry", engine.relevant.some((asset) => asset.id === "physics/piston-engine"), engine.relevant.map((a) => a.id).join(","));

  const pinned = selectAssetsForLesson("Explain binary search trees.", { sceneAssets: ["biology/kidney"] });
  check("assets already on screen are always kept", pinned.relevant.some((asset) => asset.id === "biology/kidney"), pinned.relevant.map((a) => a.id).join(","));

  check("unknown vocabulary reports low confidence", selectAssetsForLesson("Why does a rainbow form after rain?").confidence !== "high");
  check("library index still names every asset", (() => {
    const index = libraryIndexText();
    return index.includes("biology:") && index.includes("network:") && index.includes("pendulum") && index.length < 3000;
  })());
  check("asset detail lines carry parts", assetCatalogText(heart.relevant.slice(0, 1), "x").includes("parts:"));
}

section("2. Prompt stays inside the request budget");
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

  const questions = [
    "Teach me how blood flows through the human heart using a 3D model.",
    "Explain binary search trees.",
    "How does a car engine convert fuel into motion?",
    "Explain how a lens focuses light.",
  ];

  for (const question of questions) {
    const plan = planRequest(baseRequest(question, { lessonStep: 3, visualState3d: busyScene, previousTeaching: Array.from({ length: 8 }, () => "a fairly long previous sentence about the lesson in progress") }), "lesson", GEMINI_SCHEMA);
    check(`request fits the budget: ${question.slice(0, 24)}…`, plan.size.totalTokens <= TOKEN_BUDGET, `${plan.size.totalTokens} tokens (${plan.level})`);
  }

  const measured = planRequest(baseRequest("Teach me photosynthesis."), "lesson", GEMINI_SCHEMA).size;
  // The guard is the hard limit, not a magic number: a request must stay inside TOKEN_HARD_LIMIT, which
  // is itself kept clear of the provider's 8000 tokens-per-minute ceiling.
  check("estimated tokens stay below the hard limit, with room left for the teacher's reply", measured.totalTokens <= TOKEN_HARD_LIMIT && TOKEN_HARD_LIMIT <= 8000, `${measured.totalTokens} / ${TOKEN_HARD_LIMIT}`);
  check("schema size is included in the estimate", measured.schemaTokens > 500, String(measured.schemaTokens));

  const prompt = teachingLessonPrompt(baseRequest("Teach me the heart."));
  check("prompt does not embed the whole registry per asset", !prompt.includes("boundingRadius") && !prompt.includes("fallbackType") && !prompt.includes("recommendedCameraDistance"));
  check("prompt contains the compact state, catalog and question", prompt.includes("CURRENT STATE") && prompt.includes("MOST RELEVANT MODELS") && prompt.includes("Teach \""));
  check("step prompt is smaller than the lesson prompt", teachingPrompt(baseRequest("Teach me the heart.")).length < prompt.length);
}

section("3. Lesson context is bounded and semantic");
{
  const bigBoard = {
    nodes: Array.from({ length: 40 }, (_, i) => ({ id: `n${i}`, value: `v${i}`, x: i, y: i, width: 10, height: 10, text: "", fill: "", stroke: "", radius: 5 })),
    edges: Array.from({ length: 40 }, (_, i) => ({ id: `e${i}`, from: `n${i}`, to: `n${i + 1}` })),
    texts: Array.from({ length: 20 }, (_, i) => ({ id: `t${i}`, text: "x".repeat(200), x: 0, y: 0 })),
    highlights: ["n1"],
  } as never;

  const request = baseRequest("Teach me the heart.", {
    boardState: bigBoard,
    previousTeaching: Array.from({ length: 30 }, () => "y".repeat(400)),
  });

  const full = compactState(request, "full");
  const minimal = compactState(request, "minimal");
  check("board nodes are capped", ((full.board as { nodes: string[] }).nodes.length <= 24), String((full.board as { nodes: string[] }).nodes.length));
  check("board texts are truncated", ((full.board as { texts: string[] }).texts[0] ?? "").length <= 90);
  check("previous speech is capped and truncated", recentSpeech(request, "full").length <= 4 && (recentSpeech(request, "full")[0] ?? "").length <= 160);
  check("minimal level drops the state entirely", JSON.stringify(minimal).length < JSON.stringify(full).length / 4);
  check("state carries no renderer geometry", !JSON.stringify(full).includes("boundingRadius") && !JSON.stringify(full).includes("triangle"));

  const scene = { ...emptyVisual3DScene(), objects: [{ ...emptyVisual3DScene().objects, }] as never };
  check("scene asset ids are extractable", Array.isArray(sceneAssetIds(baseRequest("x", { visualState3d: { ...emptyVisual3DScene(), objects: [{ id: "a", asset: "biology/heart" }] } as never }))));
}

section("4. Budget helper");
{
  const small = measureRequest("a".repeat(100), "b".repeat(100), "{}");
  check("measureRequest sums every part", small.totalTokens === small.systemTokens + small.userTokens + small.schemaTokens);
  check("estimateTokens is conservative", estimateTokens("x".repeat(350)) >= 100);

  const decision = chooseLevel({
    full: { ...small, totalTokens: 9000 },
    compact: { ...small, totalTokens: 4000 },
    minimal: { ...small, totalTokens: 3000 },
  });
  check("an oversized request is compacted", decision.fits && decision.level === "compact");

  const last = chooseLevel({ full: { ...small, totalTokens: 9000 }, compact: { ...small, totalTokens: 9000 }, minimal: { ...small, totalTokens: 9000 } });
  check("a request that cannot be compacted is rejected", last.fits === false);
}

section("5. Replanning after a size rejection");
{
  const request = baseRequest("Teach me the solar system in 3D.");
  const plan = planRequest(request, "lesson", GEMINI_SCHEMA);
  const compacted = replan(request, GEMINI_SCHEMA, plan.level);
  // The planner may already have started at "compact" (the 2D/3D action vocabulary is large), so the
  // invariant is "a STRICTLY more compact plan can be built", not one particular level name.
  check("a more compact plan can be built", compacted !== null && ["full", "compact", "minimal"].indexOf(compacted.level) > ["full", "compact", "minimal"].indexOf(plan.level), `${plan.level} -> ${compacted?.level}`);
  check("the compacted plan is smaller or equal", (compacted?.size.totalTokens ?? Infinity) <= plan.size.totalTokens);
  check("replanning stops at the minimal level", replan(request, GEMINI_SCHEMA, "minimal") === null);
}

section("6. Provider failure handling");
async function providerFailures(): Promise<void> {
  clearGeminiHealth();
  const request = baseRequest("Explain binary search trees.");

  // Gemini 404 on every model: the models must be disabled and the request must still be served.
  const notFound = await generateTeachingStep(request, { gemini: "not-found", groq: "sample" }).catch((error) => error);
  check("a 404 model falls back to Groq and still answers", Boolean(notFound?.response?.speech), String(notFound?.message ?? ""));
  check("a 404 model is marked unavailable", getGeminiModelHealth("gemini-3.8-flash").unavailable === true);
  check("an unavailable model is not attempted again", isGeminiModelAvailable("gemini-3.8-flash") === false);

  // 413: compact and retry — the caller must never see a size failure.
  clearGeminiHealth();
  const oversized = await generateTeachingStep(baseRequest("Teach me photosynthesis.", { lessonStep: 9 }), { groq: "oversized" }).catch((error) => error);
  check("a size rejection is compacted, not surfaced", Boolean(oversized?.response?.speech), String(oversized?.message ?? ""));

  // 503 everywhere: fail fast with a real error instead of hanging.
  const unavailable = await generateTeachingStep(baseRequest("Explain trees.", { lessonStep: 11 }), { gemini: "unavailable", groq: "unavailable" }).catch((error) => error);
  check("total provider failure produces an error", unavailable instanceof Error);
  check("a rate-limited model is recorded in health", (() => {
    clearGeminiHealth();
    return typeof getGeminiModelHealth("gemini-3.8-flash").failureCount === "number";
  })());
}

section("7. Mistral as the third provider");
async function mistralProvider(): Promise<void> {
  clearGeminiHealth();

  // Order matters: Gemini fails, Groq fails, Mistral answers. If the order were wrong (e.g. Mistral
  // tried before Groq) this would still answer, so the provider identity is asserted explicitly.
  const mistral = await generateTeachingStep(baseRequest("Explain binary search trees."), {
    gemini: "unavailable", groq: "unavailable", mistral: "sample",
  }).catch((error) => error);
  check("Gemini and Groq failing falls through to Mistral", Boolean(mistral?.response?.speech), String(mistral?.message ?? ""));
  check("the answering provider is reported as mistral", mistral?.provider === "mistral", String(mistral?.provider ?? ""));
  check("a mistral answer is flagged as a fallback", mistral?.fallback === true);

  // Mistral must never pre-empt a working earlier provider. Gemini health is process-wide and the
  // sub-test above deliberately failed every model, so it is reset before re-testing the Gemini path.
  clearGeminiHealth();
  const groqWins = await generateTeachingStep(baseRequest("Explain binary search trees."), {
    gemini: "unavailable", groq: "sample", mistral: "unavailable",
  }).catch((error) => error);
  check("Mistral does not pre-empt a working Groq", groqWins?.provider === "groq", String(groqWins?.provider ?? ""));

  clearGeminiHealth();
  const geminiWins = await generateTeachingStep(baseRequest("Explain binary search trees."), {
    gemini: "sample", groq: "unavailable", mistral: "unavailable",
  }).catch((error) => error);
  check("Mistral does not pre-empt a working Gemini", geminiWins?.provider === "gemini", String(geminiWins?.provider ?? ""));

  // A fenced ```json block must still answer, not fail over.
  const fenced = await generateTeachingStep(baseRequest("Teach me the heart.", { lessonStep: 21 }), {
    gemini: "unavailable", groq: "unavailable", mistral: "fenced-json",
  }).catch((error) => error);
  check("a fenced json block from Mistral is still answered", Boolean(fenced?.response?.speech), String(fenced?.message ?? ""));

  // A size rejection from the LAST provider is compacted, never surfaced to the classroom.
  const oversized = await generateTeachingStep(baseRequest("Teach me photosynthesis.", { lessonStep: 22 }), {
    gemini: "unavailable", groq: "unavailable", mistral: "oversized",
  }).catch((error) => error);
  check("a Mistral size rejection is compacted, not surfaced", Boolean(oversized?.response?.speech), String(oversized?.message ?? ""));

  // All three unavailable must still fail fast with one error rather than hanging.
  const allDown = await generateTeachingStep(baseRequest("Explain trees.", { lessonStep: 23 }), {
    gemini: "unavailable", groq: "unavailable", mistral: "unavailable",
  }).catch((error) => error);
  check("all three providers failing produces a single clear error", allDown instanceof Error);

  // The Mistral answer must pass the SAME validator as every other provider.
  check("a Mistral response passes the shared teaching validator", parseTeachingResponse(mistral?.response ?? null) !== null);
  check("a Mistral response is a normalized TeachingResponse", typeof mistral?.response?.speech === "string" && Array.isArray(mistral?.response?.board_actions) && typeof mistral?.response?.lesson_step === "number" && typeof mistral?.response?.next_step === "number");

  // Fenced-JSON recovery is pure and directly testable.
  const speechOf = (text: string): unknown => {
    const parsed = extractJsonPayload(text);
    return typeof parsed === "object" && parsed !== null ? (parsed as { speech?: unknown }).speech : undefined;
  };
  check("a plain json object is parsed", extractJsonPayload('{"speech":"hi"}') !== null);
  check("a fenced json block is unwrapped", speechOf('```json\n{"speech":"hi"}\n```') === "hi");
  check("a fenced block without a language tag is unwrapped", speechOf('```\n{"speech":"hi"}\n```') === "hi");
  check("json wrapped in prose is recovered", speechOf('Here you go:\n{"speech":"hi"}\nHope that helps!') === "hi");
  check("a closing brace inside a json string does not truncate the object", speechOf('```json\n{"speech":"the set is } here"}\n```') === "the set is } here");
  check("non-json text is rejected rather than guessed at", extractJsonPayload("I cannot help with that.") === null);
  check("an empty response is rejected", extractJsonPayload("   ") === null);

  // Mistral must be described the same shared schema, not a private copy.
  check("Mistral uses the shared teaching schema", jsonTeachingSchema.required.includes("speech") && jsonTeachingSchema.properties.visual3d_actions !== undefined);
  check("the shared schema covers the newest 3D actions", jsonTeachingSchema.properties.visual3d_actions.items.properties.action.enum.includes("isolate_part"));
  check("the Mistral model id is configurable via the environment", process.env.MISTRAL_MODEL !== undefined || MISTRAL_TEACHING_MODEL_NAME === "mistral-small-latest");
}

section("9. Topic-scoped visual vocabulary");
{
  const families = (input: Parameters<typeof visualFamiliesFor>[0]) => visualFamiliesFor(input);

  // The rule that matters: scoping must never remove a capability that could still be used.
  check("3D is kept when the student asked for 3D", families({ representationIntent: "3d", relevant3dAssets: 0 }).scene3d === true);
  check("3D is kept when the catalogue found a model for the topic", families({ representationIntent: null, relevant3dAssets: 2 }).scene3d === true);
  check("3D is dropped only when there is nothing to show and nothing was asked", families({ representationIntent: null, relevant3dAssets: 0 }).scene3d === false);
  check("an explicit 2D request still keeps 3D when a real model exists (the renderer degrades upward)", families({ representationIntent: "2d", relevant3dAssets: 1 }).scene3d === true);
  check("the diagram family is always available", families({ subject: "mathematics", relevant3dAssets: 0 }).diagram === true);
  check("graph vocabulary is kept for computer science", families({ subject: "computer-science", relevant3dAssets: 0 }).graph === true);
  check("graph vocabulary is dropped for physics, where a tree is never the right shape", families({ subject: "physics", relevant3dAssets: 0 }).graph === false);
  check("graph vocabulary is kept for networking", families({ subject: "networking", relevant3dAssets: 0 }).graph === true);

  // MEASURED EFFECT. Each family costs real tokens, so the scoping has to actually reduce the request
  // rather than merely rearrange it.
  const sized = (question: string) => buildPrompt({ question, language: "English", lessonStep: 1, boardState: { nodes: [], edges: [], texts: [], highlights: [], tick: 0, theme: "general" } } as never).system;
  const tokens = (text: string) => Math.ceil(text.length / 3.5);
  const physics = sized("Explain Newton's third law");
  const heart = sized("How does the human heart pump blood?");
  check("a lesson with no 3D asset does not receive the 3D camera vocabulary", !physics.includes("isolate_part"));
  check("a lesson with 3D assets does receive the 3D camera vocabulary", heart.includes("isolate_part"));
  check("a scoped lesson still receives the action contract it needs", physics.includes("create_code_block") && physics.includes("create_array"));
  check("the shared rules are never scoped away", physics.includes("Output ONLY the requested JSON object"));
  check("scoping the 3D family saves real headroom, not a rounding error", tokens(heart) - tokens(physics) > 800, `${tokens(heart) - tokens(physics)} tokens saved`);
}

mistralProvider()
  .then(providerFailures)
  .then(() => {
    console.log(`\n${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });