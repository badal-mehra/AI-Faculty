// Gemini is the PRIMARY teaching provider.
// The raw model response is always pushed through the shared parseTeachingResponse()
// validation so an unvalidated payload can never reach the board engine.
import { GoogleGenAI, Type } from "@google/genai";
import { TeachingLessonResponse, TeachingRequest, TeachingResponse } from "../types";
import { parseAllTeachingSteps, parseTeachingResponse, describeMalformedLessonSteps } from "../validation";
import { ANIMATION_KINDS, ANCHORS, ARROW_STYLES, CONNECTOR_KINDS, RELATIVE_SIDES, SEMANTIC_KINDS, SEMANTIC_RELATIONS, SHAPE_KINDS, VISUAL_ACTION_TYPES, VISUAL_ROLES, VISUAL_THEMES } from "../../visual/types";
import { OBJECT3D_ANIMATION_KINDS, OBJECT3D_TYPES, RELATION_TYPES_3D, RELATIVE_SIDES_3D, PLACEMENT_ANCHORS_3D, VISUAL3D_ACTION_TYPES, FLOW_SHAPES, FLOW_CURVES, LABEL_SIDES, VECTOR_KINDS } from "../../visual3d/types";
import { RequestPlan } from "../requestPlan";
import { TEACHING_INTENTS } from "../pedagogy";
import { ProviderError, asProviderError, withProviderTimeout } from "./error";
import { repairTurn } from "./repair";

// The pool is ORDERED BY MEASURED AVAILABILITY for this project's key, not by name: the flash-lite
// and flash-preview ids answer reliably, while the larger flash ids currently answer 429 and the 2.5
// ids answer 404. Nothing here is invented — every id is checked against the live models.list()
// result (see availableGeminiTeachingModels) and a 404 permanently disables it. Health tracking plus
// "last successful model first" re-orders this list at runtime, so a recovered id is picked up
// without a code change.
export const GEMINI_TEACHING_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
  "gemini-3-flash-preview",
  "gemini-3.5-flash",
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
] as const;

// A single model call must never hold the classroom hostage; the router moves on instead of waiting.
const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS ?? 20_000);

// A whole batch of six teacher-sized steps legitimately takes longer than one answer, but it must still
// be bounded: an unbounded call has been observed hanging for fifteen minutes.
const LESSON_REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_LESSON_TIMEOUT_MS ?? 90_000);

const stringEnum = (values: readonly string[]) => ({ type: Type.STRING, enum: [...values] });

const vec3Schema = {
  type: Type.OBJECT,
  properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER } },
};

const geminiPlacementSchema = {
  type: Type.OBJECT,
  properties: {
    kind: stringEnum(["anchor", "relative", "between", "point"]),
    anchor: stringEnum(ANCHORS),
    relativeTo: { type: Type.STRING },
    side: stringEnum(RELATIVE_SIDES),
    gap: { type: Type.NUMBER },
    between: { type: Type.ARRAY, items: { type: Type.STRING } },
    x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
  },
  required: ["kind"],
};

const geminiAnimationSchema = {
  type: Type.OBJECT,
  properties: { kind: stringEnum(ANIMATION_KINDS), durationMs: { type: Type.NUMBER }, delayMs: { type: Type.NUMBER } },
  required: ["kind"],
};

const geminiPlacement3DSchema = {
  type: Type.OBJECT,
  properties: {
    // Every placement kind the 3D engine accepts, including semantic relations.
    kind: stringEnum(["relation", "anchor", "relative", "point"]),
    relation: {
      type: Type.OBJECT,
      properties: {
        type: stringEnum(RELATION_TYPES_3D),
        objects: { type: Type.ARRAY, items: { type: Type.STRING } },
        anchorPart: { type: Type.STRING },
        gap: { type: Type.NUMBER },
        offset: { type: Type.NUMBER },
        axis: stringEnum(["x", "y", "z"]),
      },
      required: ["type", "objects"],
    },
    anchor: stringEnum(PLACEMENT_ANCHORS_3D),
    relativeTo: { type: Type.STRING },
    side: stringEnum(RELATIVE_SIDES_3D),
    gap: { type: Type.NUMBER },
    x: { type: Type.NUMBER }, y: { type: Type.NUMBER }, z: { type: Type.NUMBER },
  },
  required: ["kind"],
};

const geminiOrbit3DSchema = {
  type: Type.OBJECT,
  properties: {
    center: { type: Type.STRING },
    radius: { type: Type.NUMBER },
    speedDegPerSec: { type: Type.NUMBER },
    tiltDeg: { type: Type.NUMBER },
  },
  required: ["center"],
};

const geminiAnimation3DSchema = {
  type: Type.OBJECT,
  properties: { kind: stringEnum(OBJECT3D_ANIMATION_KINDS), durationMs: { type: Type.NUMBER }, delayMs: { type: Type.NUMBER } },
  required: ["kind"],
};

// Generalized 3D visual actions (3D Scene Renderer). Best-effort schema — parseVisual3DAction() is
// the gate, but the schema must still name every field the engine understands: structured-output
// providers DROP properties the schema does not declare.
export const geminiVisual3DActionSchema = {
  type: Type.OBJECT,
  properties: {
    action: stringEnum(VISUAL3D_ACTION_TYPES),
    id: { type: Type.STRING }, target: { type: Type.STRING },
    type: stringEnum(OBJECT3D_TYPES),
    placement: geminiPlacement3DSchema,
    position: vec3Schema, rotation: vec3Schema,
    scale: { type: Type.NUMBER, oneOf: [{ type: Type.NUMBER }, { type: Type.OBJECT }] },
    fov: { type: Type.NUMBER },
    color: { type: Type.STRING }, text: { type: Type.STRING }, label: { type: Type.STRING }, subtitle: { type: Type.STRING },
    asset: { type: Type.STRING }, part: { type: Type.STRING },
    side: stringEnum(LABEL_SIDES),
    leader: { type: Type.BOOLEAN },
    orbit: geminiOrbit3DSchema,
    axis: stringEnum(["x", "y", "z"]), speedDegPerSec: { type: Type.NUMBER }, radius: { type: Type.NUMBER },
    center: { type: Type.STRING },
    from: { type: Type.STRING }, to: { type: Type.STRING },
    particleCount: { type: Type.NUMBER }, speed: { type: Type.NUMBER }, loop: { type: Type.BOOLEAN },
    trail: { type: Type.BOOLEAN },
    shape: stringEnum(FLOW_SHAPES),
    curve: stringEnum(FLOW_CURVES),
    size: { type: Type.NUMBER },
    durationMs: { type: Type.NUMBER }, animate: geminiAnimation3DSchema,
    path: { type: Type.ARRAY, items: vec3Schema },
    // Generic inspection + overlays. The schema must name every field the engine understands:
    // structured-output providers DROP properties the schema does not declare.
    pivot: { type: Type.STRING },
    amplitudeDeg: { type: Type.NUMBER }, amplitude: { type: Type.NUMBER },
    periodMs: { type: Type.NUMBER },
    // explode_group narrows the separation to specific part names.
    parts: { type: Type.ARRAY, items: { type: Type.STRING } },
    strength: { type: Type.NUMBER },
    ids: { type: Type.ARRAY, items: { type: Type.STRING } },
    visible: { type: Type.BOOLEAN },
    direction: vec3Schema,
    vectorKind: stringEnum(VECTOR_KINDS),
    length: { type: Type.NUMBER },
    through: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ["action"],
};

// NESTED VISUAL STRUCTURES, fully expanded.
//
// A structured-output provider may only return what its schema declares, and an object schema with no
// declared `properties` can only come back empty. That is not hypothetical: with `nodes` declared as a
// bare array of objects, a real provider returned `nodes: [{}]`, `events: [{}, {}, {}]` and
// `left: {}, right: {}` — every binary search tree, TCP trace, timeline and comparison was erased
// before validation could see it, and each one was logged as "the model produced malformed output".
// Expanding these shapes costs a few hundred schema tokens and is the only reason those structures
// reach the board at all.
export const geminiVisualStructureSchema = {
  node: {
    type: Type.OBJECT,
    properties: { id: { type: Type.STRING }, value: { type: Type.STRING } },
    required: ["id", "value"],
  },
  edge: {
    type: Type.OBJECT,
    properties: { from: { type: Type.STRING }, to: { type: Type.STRING }, label: { type: Type.STRING } },
    required: ["from", "to"],
  },
  message: {
    type: Type.OBJECT,
    properties: { from: { type: Type.STRING }, to: { type: Type.STRING }, label: { type: Type.STRING } },
    required: ["from", "to"],
  },
  event: {
    type: Type.OBJECT,
    properties: { label: { type: Type.STRING }, text: { type: Type.STRING } },
    required: ["label", "text"],
  },
  panel: {
    type: Type.OBJECT,
    properties: { title: { type: Type.STRING }, items: { type: Type.ARRAY, items: { type: Type.STRING } } },
    required: ["title", "items"],
  },
};

// Generalized VISUAL actions (Diagram Renderer). Best-effort schema — parseVisualAction() is the gate.
export const geminiVisualActionSchema = {
  type: Type.OBJECT,
  properties: {
    action: stringEnum(VISUAL_ACTION_TYPES),
    id: { type: Type.STRING }, target: { type: Type.STRING },
    shape: stringEnum(SHAPE_KINDS), semantic: stringEnum(SEMANTIC_KINDS),
    text: { type: Type.STRING }, glyph: { type: Type.STRING }, formula: { type: Type.STRING }, label: { type: Type.STRING },
    code: { type: Type.STRING }, language: { type: Type.STRING }, highlightLines: { type: Type.ARRAY, items: { type: Type.INTEGER } },
    width: { type: Type.NUMBER }, height: { type: Type.NUMBER }, durationMs: { type: Type.NUMBER }, degrees: { type: Type.NUMBER },
    // A shape can point somewhere, so rotation must be declarable and not only readable by the engine.
    rotation: { type: Type.NUMBER },
    size: { type: Type.NUMBER },
    from: { type: Type.STRING }, to: { type: Type.STRING },
    style: stringEnum(ARROW_STYLES), kind: stringEnum(CONNECTOR_KINDS), side: stringEnum(RELATIVE_SIDES),
    // WHAT a connection means, so the layout can decide direction instead of the model choosing a pixel.
    relation: stringEnum(SEMANTIC_RELATIONS),
    role: stringEnum(VISUAL_ROLES), theme: stringEnum(VISUAL_THEMES),
    ids: { type: Type.ARRAY, items: { type: Type.STRING } },
    // Semantic structure payloads (structure only — never coordinates).
    //
    // The nested shapes are expanded on purpose. A structured-output provider decides what it may
    // return from the schema alone, so a bare `nodes: array of object` cannot return anything but
    // `nodes: [{}]`. Declared loosely did not save prompt tokens; it silently deleted every tree,
    // sequence, timeline and comparison the model wrote. `geminiVisualStructureSchema` below is
    // declared once and shared with the JSON-Schema providers so the three stay identical.
    values: { type: Type.ARRAY, items: { type: Type.STRING } },
    stages: { type: Type.ARRAY, items: { type: Type.STRING } },
    actors: { type: Type.ARRAY, items: { type: Type.STRING } },
    nodes: { type: Type.ARRAY, items: geminiVisualStructureSchema.node },
    edges: { type: Type.ARRAY, items: geminiVisualStructureSchema.edge },
    messages: { type: Type.ARRAY, items: geminiVisualStructureSchema.message },
    events: { type: Type.ARRAY, items: geminiVisualStructureSchema.event },
    left: geminiVisualStructureSchema.panel,
    right: geminiVisualStructureSchema.panel,
    layout: { type: Type.STRING }, title: { type: Type.STRING },
    head: { type: Type.STRING }, topLabel: { type: Type.STRING }, frontLabel: { type: Type.STRING }, rearLabel: { type: Type.STRING },
    indices: { type: Type.BOOLEAN }, vertical: { type: Type.BOOLEAN }, tail: { type: Type.BOOLEAN }, doubly: { type: Type.BOOLEAN },
    placement: geminiPlacementSchema,
    animate: geminiAnimationSchema,
  },
  required: ["action"],
};

// Structured-output schema. board_actions (Graph) and visual_actions (Diagram) are both optional;
// parseTeachingResponse() is the gate.
export const geminiTeachingSchema = {
  type: Type.OBJECT,
  properties: {
    speech: { type: Type.STRING },
    board_actions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, enum: ["draw_node", "connect", "write_text", "highlight", "erase", "clear", "move_node"] },
          id: { type: Type.STRING }, value: { type: Type.STRING }, x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
          from: { type: Type.STRING }, to: { type: Type.STRING }, text: { type: Type.STRING }, target: { type: Type.STRING }, parentId: { type: Type.STRING }, side: { type: Type.STRING, enum: ["left", "right"] },
        },
        required: ["action"],
      },
    },
    visual_actions: { type: Type.ARRAY, items: geminiVisualActionSchema },
    visual3d_actions: { type: Type.ARRAY, items: geminiVisual3DActionSchema },
    lesson_step: { type: Type.INTEGER },
    next_step: { type: Type.INTEGER },
    // Which objective stage this step teaches. Optional: coverage is measured from the speech itself.
    stage_id: { type: Type.STRING },
    // ---- The pedagogical layer -------------------------------------------------------------------
    // What this step TEACHES, kept separate from what it draws. See lib/teaching/pedagogy.ts. Gemini is
    // the primary provider, so this is where the contract is most complete; the shared JSON Schema in
    // jsonSchema.ts describes the identical shape for Groq and Mistral.
    teaching_intent: { type: Type.STRING, enum: [...TEACHING_INTENTS] },
    pedagogy: geminiPedagogySchema(),
  },
  required: ["speech", "lesson_step", "next_step"],
};

/**
 * The pedagogical payload, factored out so the full and family-scoped schemas cannot drift apart.
 *
 * The nested `formula.variables` shape MUST be expanded: a structured-output provider decides what it may
 * return from the schema alone, so an undeclared nested object arrives as `{}`. A formula whose symbols
 * silently vanished is worse than no formula, because the lesson then looks like it explains one while
 * explaining none.
 */
export function geminiPedagogySchema() {
  return {
    type: Type.OBJECT,
    properties: {
      concept: { type: Type.STRING },
      prerequisite: { type: Type.STRING },
      why: { type: Type.STRING },
      example: { type: Type.STRING },
      interpretation: { type: Type.STRING },
      verification: { type: Type.STRING },
      formula: {
        type: Type.OBJECT,
        properties: {
          formula: { type: Type.STRING },
          calculates: { type: Type.STRING },
          why: { type: Type.STRING },
          assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
          variables: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: { symbol: { type: Type.STRING }, meaning: { type: Type.STRING }, unit: { type: Type.STRING } },
              required: ["symbol", "meaning"],
            },
          },
          derivation: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["formula"],
      },
    },
  };
}

/** The graph-board action array, factored out so a family-scoped schema can include or omit it. */
export function geminiBoardActionSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      action: { type: Type.STRING, enum: ["draw_node", "connect", "write_text", "highlight", "erase", "clear", "move_node"] },
      id: { type: Type.STRING }, value: { type: Type.STRING }, x: { type: Type.NUMBER }, y: { type: Type.NUMBER },
      from: { type: Type.STRING }, to: { type: Type.STRING }, text: { type: Type.STRING }, target: { type: Type.STRING }, parentId: { type: Type.STRING }, side: { type: Type.STRING, enum: ["left", "right"] },
    },
    required: ["action"],
  };
}

export const geminiTeachingLessonSchema = {
  type: Type.OBJECT,
  properties: { steps: { type: Type.ARRAY, items: geminiTeachingSchema } },
  required: ["steps"],
};

/**
 * The lesson schema for a lesson that only uses SOME of the action families.
 *
 * See `jsonTeachingSchemaFor` for why: declaring all three renderers on every request cost about a
 * thousand tokens a batch for actions the prompt had deliberately withheld documentation of, and an action
 * the model can see but was never told about is one it will guess at. The families come from
 * `visualFamiliesFor`, the same decision the renderer and the educational gate use.
 */
export function geminiTeachingSchemaFor(families: { graph: boolean; diagram: boolean; scene3d: boolean }) {
  const properties: Record<string, unknown> = { speech: { type: Type.STRING } };
  if (families.graph) properties.board_actions = { type: Type.ARRAY, items: geminiBoardActionSchema() };
  if (families.diagram) properties.visual_actions = { type: Type.ARRAY, items: geminiVisualActionSchema };
  if (families.scene3d) properties.visual3d_actions = { type: Type.ARRAY, items: geminiVisual3DActionSchema };
  return {
    type: Type.OBJECT,
    properties: {
      ...properties,
      lesson_step: { type: Type.INTEGER },
      next_step: { type: Type.INTEGER },
      stage_id: { type: Type.STRING },
      teaching_intent: { type: Type.STRING, enum: [...TEACHING_INTENTS] },
      pedagogy: geminiPedagogySchema(),
    },
    required: ["speech", "lesson_step", "next_step"],
  };
}

export function geminiTeachingLessonSchemaFor(families: { graph: boolean; diagram: boolean; scene3d: boolean }) {
  return {
    type: Type.OBJECT,
    properties: { steps: { type: Type.ARRAY, items: geminiTeachingSchemaFor(families) } },
    required: ["steps"],
  };
}

// Gemini model availability. Model names change faster than this file, so instead of trusting the
// list we ASK the API which models this key can reach, cache the answer, and only ever call models
// the API confirmed. A 404 from a call is additionally treated as proof of unavailability.
const MODEL_PROBE_TTL_MS = 10 * 60_000;
let modelProbe: { at: number; available: Set<string> | null } | null = null;

/** The model listing is a convenience, so it gets a short hard cap of its own. */
const MODEL_PROBE_TIMEOUT_MS = Number(process.env.GEMINI_PROBE_TIMEOUT_MS ?? 10_000);

async function probeAvailableModels(): Promise<Set<string> | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  if (modelProbe && Date.now() - modelProbe.at < MODEL_PROBE_TTL_MS) return modelProbe.available;
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await withProviderTimeout("gemini", "The Gemini model listing", MODEL_PROBE_TIMEOUT_MS, () => ai.models.list());
    const ids = new Set<string>();
    for await (const model of response) {
      const name = (model as { name?: string }).name ?? "";
      // The API returns "models/gemini-x"; the SDK takes the bare id.
      ids.add(name.replace(/^models\//, ""));
    }
    modelProbe = { at: Date.now(), available: ids.size > 0 ? ids : null };
    return modelProbe.available;
  } catch {
    // Listing is a convenience, not a requirement: fall back to the configured pool.
    modelProbe = { at: Date.now(), available: null };
    return null;
  }
}

/** The configured models, filtered by what the API says this key can actually call. */
export async function availableGeminiTeachingModels(): Promise<string[]> {
  const configured = [...GEMINI_TEACHING_MODELS];
  const probe = await probeAvailableModels();
  if (!probe) return configured;
  // Keep pool order (best model first) but drop anything the API does not list.
  const usable = configured.filter((model) => probe.has(model));
  return usable.length > 0 ? usable : configured;
}

async function callGemini(
  lesson: TeachingRequest,
  plan: RequestPlan,
  model: string,
  path: "lesson" | "step",
  schema: unknown,
  correction?: string,
): Promise<unknown> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await withProviderTimeout(
    "gemini",
    path === "lesson" ? "A Gemini lesson batch" : "A Gemini teaching step",
    path === "lesson" ? LESSON_REQUEST_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
    () => ai.models.generateContent({
      model,
      contents: correction ? `${plan.user}\n\n${correction}` : plan.user,
      config: {
        systemInstruction: plan.system,
        responseMimeType: "application/json",
        responseSchema: schema,
        // A single model call must not hold the classroom hostage.
        httpOptions: { timeout: REQUEST_TIMEOUT_MS },
        // A step is a teacher-sized paragraph plus its board actions; a batch of six needs more room
        // than a single step, but still far less than the ceiling.
        ...(path === "step" ? { maxOutputTokens: 2048 } : { maxOutputTokens: 16384 }),
      },
    }),
  );
  const text = response.text;
  if (!text) throw new ProviderError("gemini", "Gemini returned an empty response.", { status: 502, transient: true });
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("gemini", "Gemini returned an invalid structured response.", { status: 502, transient: true });
  }
}

export async function generateTeachingStepWithGemini(lesson: TeachingRequest, model: string, plan: RequestPlan): Promise<TeachingResponse> {
  if (!process.env.GEMINI_API_KEY) {
    // Missing credentials are a configuration problem, never a transient outage.
    throw new ProviderError("gemini", "Gemini is not configured on this server.", { status: 503, transient: false, configuration: true });
  }
  try {
    // One bounded repair attempt: an invalid field costs a repair turn, not the whole lesson.
    let correction: string | undefined;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const raw = await callGemini(lesson, plan, model, "step", geminiTeachingSchema, correction);
      const teachingResponse = parseTeachingResponse(raw);
      if (teachingResponse) return teachingResponse;
      if (attempt === 2) throw new ProviderError("gemini", "Gemini returned unsupported board instructions.", { status: 502, transient: true });
      console.warn("[Gemini] step response rejected by validation; sending one corrected retry");
      correction = repairTurn(raw);
    }
    throw new ProviderError("gemini", "Gemini returned an unsupported teaching response.", { status: 502, transient: true });
  } catch (error) {
    throw asProviderError(error, "gemini");
  }
}

export async function generateTeachingLessonWithGemini(lesson: TeachingRequest, model: string, plan: RequestPlan): Promise<TeachingLessonResponse> {
  if (!process.env.GEMINI_API_KEY) throw new ProviderError("gemini", "Gemini is not configured on this server.", { status: 503, transient: false, configuration: true });

  try {
    const raw = await callGemini(lesson, plan, model, "lesson", geminiTeachingLessonSchema);
    // A malformed step is dropped, not the whole batch: six good teaching steps are worth far more
    // than a failover chain, and the classroom re-teaches the dropped stage in the next batch.
    const steps = parseAllTeachingSteps(raw);
    if (!steps) throw new ProviderError("gemini", "Gemini returned an invalid teaching lesson.", { status: 502, transient: true });
    const requested = Array.isArray((raw as { steps?: unknown }).steps) ? (raw as { steps: unknown[] }).steps.length : steps.length;
    if (process.env.NODE_ENV !== "production" && steps.length < requested) {
      console.warn(`[Gemini] ${requested - steps.length} malformed lesson step(s) dropped; keeping ${steps.length}: ${describeMalformedLessonSteps(raw).join("; ")}`);
    }
    return { steps };
  } catch (error) {
    throw asProviderError(error, "gemini");
  }
}