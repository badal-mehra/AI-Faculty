// SHARED WIRE SCHEMA for the OpenAI-compatible teaching providers.
//
// Gemini declares its schema with the @google/genai `Type` enum (uppercase "OBJECT"/"STRING"), while
// Groq and Mistral take plain JSON Schema (lowercase "object"/"string"). The two wire formats describe
// exactly the same teaching contract, so the lowercase JSON Schema lives here ONCE and is shared by
// every provider that speaks it. That keeps the action vocabularies in sync automatically: a new
// 3D action or field is picked up by Mistral the moment it is added to the shared action-type arrays.
//
// This schema is still only a REQUEST-SHAPE hint. The authoritative contract is parseTeachingResponse()
// in ../validation, which every provider's output must pass before it can reach the classroom.
import { ANIMATION_KINDS, ARROW_STYLES, CONNECTOR_KINDS, RELATIVE_SIDES, SEMANTIC_KINDS, SEMANTIC_RELATIONS, SHAPE_KINDS, VISUAL_ACTION_TYPES, VISUAL_ROLES, VISUAL_THEMES } from "../../visual/types";
import { OBJECT3D_ANIMATION_KINDS, OBJECT3D_TYPES, RELATION_TYPES_3D, RELATIVE_SIDES_3D, PLACEMENT_ANCHORS_3D, VISUAL3D_ACTION_TYPES, FLOW_SHAPES, FLOW_CURVES, LABEL_SIDES, VECTOR_KINDS } from "../../visual3d/types";
import { TEACHING_INTENTS } from "../pedagogy";

export const jsonVisualActionSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: [...VISUAL_ACTION_TYPES] },
    id: { type: "string" }, target: { type: "string" },
    shape: { type: "string", enum: [...SHAPE_KINDS] },
    semantic: { type: "string", enum: [...SEMANTIC_KINDS] },
    text: { type: "string" }, glyph: { type: "string" }, formula: { type: "string" }, label: { type: "string" }, code: { type: "string" },
    language: { type: "string" }, highlightLines: { type: "array", items: { type: "integer" } },
    width: { type: "number" }, height: { type: "number" }, durationMs: { type: "number" }, degrees: { type: "number" },
    // A shape can point somewhere — an arrow rotated to the direction a force acts, a bar at the angle
    // a derivative has — so rotation has to be declarable, not only readable by the engine.
    rotation: { type: "number" },
    size: { type: "number" },
    from: { type: "string" }, to: { type: "string" },
    style: { type: "string", enum: [...ARROW_STYLES] },
    kind: { type: "string", enum: [...CONNECTOR_KINDS] },
    // WHAT a connection means. The engine draws from this and the layout reads it to decide which way the
    // two objects stand, so the model states a relationship and never a pixel.
    relation: { type: "string", enum: [...SEMANTIC_RELATIONS] },
    side: { type: "string", enum: [...RELATIVE_SIDES] },
    role: { type: "string", enum: [...VISUAL_ROLES] },
    theme: { type: "string", enum: [...VISUAL_THEMES] },
    ids: { type: "array", items: { type: "string" } },
    // Semantic structure payloads.
    //
    // THESE NESTED SHAPES MUST BE EXPANDED. A structured-output provider decides what it may return
    // from the schema alone: asked for `nodes: array of object` with no declared properties, it can
    // only return objects with NO properties, so every tree arrived as `nodes: [{}]` and every
    // sequence as `left: {}` / `events: [{}, {}, {}]` — silently empty. That is not a model failure:
    // the model had written the tree, and the schema deleted it before validation ever saw it. A
    // "loose" nested schema does not cost prompt budget and buy flexibility; it costs the whole
    // structure. parseVisualAction() still validates every field afterwards.
    values: { type: "array", items: { type: "string" } },
    stages: { type: "array", items: { type: "string" } },
    actors: { type: "array", items: { type: "string" } },
    nodes: { type: "array", items: { type: "object", properties: { id: { type: "string" }, value: { type: "string" } }, required: ["id", "value"] } },
    edges: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } }, required: ["from", "to"] } },
    messages: { type: "array", items: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, label: { type: "string" } }, required: ["from", "to"] } },
    events: { type: "array", items: { type: "object", properties: { label: { type: "string" }, text: { type: "string" } }, required: ["label", "text"] } },
    left: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["title", "items"] },
    right: { type: "object", properties: { title: { type: "string" }, items: { type: "array", items: { type: "string" } } }, required: ["title", "items"] },
    layout: { type: "string" }, title: { type: "string" },
    head: { type: "string" }, topLabel: { type: "string" }, frontLabel: { type: "string" }, rearLabel: { type: "string" },
    indices: { type: "boolean" }, vertical: { type: "boolean" }, tail: { type: "boolean" }, doubly: { type: "boolean" },
    placement: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["anchor", "relative", "between", "point"] },
        anchor: { type: "string" }, relativeTo: { type: "string" }, side: { type: "string" },
        gap: { type: "number" }, between: { type: "array", items: { type: "string" } }, x: { type: "number" }, y: { type: "number" },
      },
      required: ["kind"],
      additionalProperties: false,
    },
    animate: {
      type: "object",
      properties: { kind: { type: "string", enum: [...ANIMATION_KINDS] }, durationMs: { type: "number" }, delayMs: { type: "number" } },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  required: ["action"],
  additionalProperties: false,
};

export const jsonVisual3DActionSchema = {
  type: "object",
  properties: {
    action: { type: "string", enum: [...VISUAL3D_ACTION_TYPES] },
    id: { type: "string" }, target: { type: "string" },
    type: { type: "string", enum: [...OBJECT3D_TYPES] },
    placement: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["relation", "anchor", "relative", "point"] },
        relation: {
          type: "object",
          properties: {
            type: { type: "string", enum: [...RELATION_TYPES_3D] },
            objects: { type: "array", items: { type: "string" } },
            anchorPart: { type: "string" }, gap: { type: "number" }, offset: { type: "number" },
            axis: { type: "string", enum: ["x", "y", "z"] },
          },
          required: ["type", "objects"],
          additionalProperties: false,
        },
        anchor: { type: "string", enum: [...PLACEMENT_ANCHORS_3D] },
        relativeTo: { type: "string" }, side: { type: "string", enum: [...RELATIVE_SIDES_3D] },
        gap: { type: "number" },
        x: { type: "number" }, y: { type: "number" }, z: { type: "number" },
      },
      required: ["kind"],
      additionalProperties: false,
    },
    orbit: {
      type: "object",
      properties: {
        center: { type: "string" }, radius: { type: "number" },
        speedDegPerSec: { type: "number" }, tiltDeg: { type: "number" },
      },
      required: ["center"],
      additionalProperties: false,
    },
    position: { type: "object" }, scale: { type: "number" }, rotation: { type: "object" },
    scale_vec: { type: "object" }, rotation_vec: { type: "object" },
    fov: { type: "number" },
    color: { type: "string" }, text: { type: "string" }, label: { type: "string" }, subtitle: { type: "string" },
    asset: { type: "string" }, part: { type: "string" },
    side: { type: "string", enum: [...LABEL_SIDES] },
    leader: { type: "boolean" },
    axis: { type: "string", enum: ["x", "y", "z"] }, speedDegPerSec: { type: "number" }, radius: { type: "number" },
    center: { type: "string" },
    from: { type: "string" }, to: { type: "string" },
    particleCount: { type: "number" }, speed: { type: "number" }, loop: { type: "boolean" },
    trail: { type: "boolean" },
    shape: { type: "string", enum: [...FLOW_SHAPES] },
    curve: { type: "string", enum: [...FLOW_CURVES] },
    size: { type: "number" },
    durationMs: { type: "number" },
    animate: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...OBJECT3D_ANIMATION_KINDS] },
        durationMs: { type: "number" }, delayMs: { type: "number" },
      },
      required: ["kind"],
      additionalProperties: false,
    },
    path: { type: "array", items: { type: "object" } },
    // Generic inspection + overlays (see lib/visual3d/types.ts for the full contract).
    pivot: { type: "string" },
    amplitudeDeg: { type: "number" }, amplitude: { type: "number" },
    periodMs: { type: "number" },
    // explode_group narrows the separation to specific part names.
    parts: { type: "array", items: { type: "string" } },
    strength: { type: "number" },
    ids: { type: "array", items: { type: "string" } },
    visible: { type: "boolean" },
    direction: { type: "object" },
    vectorKind: { type: "string", enum: [...VECTOR_KINDS] },
    length: { type: "number" },
    through: { type: "array", items: { type: "string" } },
  },
  required: ["action"],
  additionalProperties: false,
};

export const jsonTeachingSchema = {
  type: "object",
  properties: {
    speech: { type: "string" },
    board_actions: jsonBoardActionsSchema(),
    visual_actions: { type: "array", items: jsonVisualActionSchema },
    visual3d_actions: { type: "array", items: jsonVisual3DActionSchema },
    lesson_step: { type: "integer" },
    next_step: { type: "integer" },
    // Which objective stage this step teaches. Optional: coverage is measured from the speech itself.
    stage_id: { type: "string" },
    // ---- The pedagogical layer -------------------------------------------------------------------
    // What this step TEACHES, kept separate from what it draws. `teaching_intent` is the one field worth
    // filling in every step; `pedagogy` carries the rest, and only where it applies.
    teaching_intent: { type: "string", enum: [...TEACHING_INTENTS] },
    pedagogy: jsonPedagogySchema(),
  },
  required: ["speech", "lesson_step", "next_step"],
  additionalProperties: false,
};

export const jsonTeachingLessonSchema = {
  type: "object",
  properties: { steps: { type: "array", items: jsonTeachingSchema } },
  required: ["steps"],
  additionalProperties: false,
};

/**
 * The wire schema for a lesson that only uses SOME of the action families.
 *
 * This exists because the shared schema used to declare all three renderers on every request, so a lesson
 * taught on a 2D board was still paying for the entire 3D action vocabulary — about a thousand tokens a
 * request, on every batch, for actions the prompt had deliberately withheld the documentation of. That is
 * not merely wasteful: an action the model can see in the schema but was never told about is an action it
 * will guess at.
 *
 * The families come from `visualFamiliesFor`, which is the same decision the renderer and the educational
 * gate use, so what is declared, what is documented and what is displayed cannot disagree.
 *
 * The omitted property is `additionalProperties: false`, so an action the model invents for a withheld
 * family is REJECTED by the provider rather than silently accepted and then deleted by the gate.
 */
export function jsonTeachingSchemaFor(families: { graph: boolean; diagram: boolean; scene3d: boolean }) {
  const properties: Record<string, unknown> = {
    speech: { type: "string" },
  };
  if (families.graph) properties.board_actions = jsonBoardActionsSchema();
  if (families.diagram) properties.visual_actions = { type: "array", items: jsonVisualActionSchema };
  if (families.scene3d) properties.visual3d_actions = { type: "array", items: jsonVisual3DActionSchema };
  return {
    ...jsonTeachingSchema,
    properties: {
      ...properties,
      lesson_step: { type: "integer" },
      next_step: { type: "integer" },
      stage_id: { type: "string" },
      teaching_intent: { type: "string", enum: [...TEACHING_INTENTS] },
      pedagogy: jsonPedagogySchema(),
    },
  };
}

export function jsonTeachingLessonSchemaFor(families: { graph: boolean; diagram: boolean; scene3d: boolean }) {
  return {
    type: "object",
    properties: { steps: { type: "array", items: jsonTeachingSchemaFor(families) } },
    required: ["steps"],
    additionalProperties: false,
  };
}

/**
 * The graph-board action array, factored out so the family-scoped schema can include or omit it.
 */
export function jsonBoardActionsSchema() {
  return {
    type: "array",
    items: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["draw_node", "connect", "write_text", "highlight", "erase", "clear", "move_node"] },
        id: { type: "string" }, value: { type: "string" }, x: { type: "number" }, y: { type: "number" },
        from: { type: "string" }, to: { type: "string" }, text: { type: "string" }, target: { type: "string" },
        parentId: { type: "string" }, side: { type: "string", enum: ["left", "right"] },
        // write_text semantic anchor (preferred over x/y)
        anchor: {
          type: "object",
          properties: {
            type: { type: "string", enum: ["object", "point", "edge"] },
            id: { type: "string" },
            position: { type: "string", enum: ["inside", "above", "below", "left", "right", "center", "midpoint", "start", "end", "offset"] },
          },
          required: ["type"],
        },
      },
      required: ["action"],
      additionalProperties: false,
    },
  };
}

/**
 * The pedagogical payload, factored out and shared by the full and family-scoped schemas.
 *
 * The nested `formula.variables` and `formula.derivation` shapes MUST be expanded for the same reason the
 * action payloads must be: a structured-output provider decides what it may return from the schema alone,
 * so an undeclared nested object arrives as `{}`. A formula whose variables silently vanished is worse than
 * no formula at all, because the lesson then looks like it explains one while explaining none.
 */
export function jsonPedagogySchema() {
  return {
    type: "object",
    properties: {
      concept: { type: "string" },
      prerequisite: { type: "string" },
      why: { type: "string" },
      example: { type: "string" },
      interpretation: { type: "string" },
      verification: { type: "string" },
      formula: {
        type: "object",
        properties: {
          formula: { type: "string" },
          calculates: { type: "string" },
          why: { type: "string" },
          assumptions: { type: "array", items: { type: "string" } },
          variables: {
            type: "array",
            items: { type: "object", properties: { symbol: { type: "string" }, meaning: { type: "string" }, unit: { type: "string" } }, required: ["symbol", "meaning"] },
          },
          derivation: { type: "array", items: { type: "string" } },
        },
        required: ["formula"],
      },
    },
  };
}

/**
 * Instruction appended to the system prompt for providers whose JSON mode must be requested in prose.
 * Kept here (not per provider) so Mistral and Groq describe the identical teaching contract.
 */
export const JSON_MODE_INSTRUCTIONS = [
  "Respond with a single valid JSON object only, using exactly this shape:",
  '{"speech": string, "board_actions": BoardAction[], "visual_actions": VisualAction[], "visual3d_actions": Visual3DAction[], "lesson_step": number, "next_step": number}',
  "board_actions drive the GRAPH renderer, visual_actions drive the 2D DIAGRAM renderer, and visual3d_actions drive the 3D renderer; use whichever fits the topic.",
  "Every action must use only the allowed action names and fields from the instructions above.",
  "Return raw JSON with no markdown code fences and no commentary before or after it.",
].join(" ");
