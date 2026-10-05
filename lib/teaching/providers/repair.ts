// SCHEMA REPAIR.
// Real provider responses fail validation for a small, recurring set of reasons (a `model` object with
// no `asset`, orbit parameters stuffed into `placement.relation`, an action name outside the allowed
// list). Rejecting the whole lesson for one field is wasteful, so the request is re-sent ONCE with a
// short, precise correction appended. The retry is bounded: one attempt, no extra tokens budget, and
// the corrected answer still has to pass parseTeachingResponse().
import { VISUAL3D_ACTION_TYPES, OBJECT3D_TYPES, RELATION_TYPES_3D } from "../../visual3d/types";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const RELATION_KEYS = new Set(["type", "objects", "anchorPart", "gap", "offset", "axis"]);
const OBJECT_TYPES = new Set<string>(OBJECT3D_TYPES);
const ACTION_NAMES = new Set<string>(VISUAL3D_ACTION_TYPES);
const RELATION_NAMES = new Set<string>(RELATION_TYPES_3D);

function defectsOfAction(action: unknown): string[] {
  if (!isRecord(action)) return ["an action was not a JSON object"];
  const defects: string[] = [];
  const name = typeof action.action === "string" ? action.action : "";
  if (!name) defects.push("an action is missing the required \"action\" field");
  else if (!ACTION_NAMES.has(name)) defects.push(`"${name}" is not an allowed 3D action name`);
  if (name === "create_3d_object") {
    const type = typeof action.type === "string" ? action.type : "";
    if (!type) defects.push("create_3d_object is missing \"type\"");
    else if (!OBJECT_TYPES.has(type)) defects.push(`"${type}" is not a valid object type`);
    if ((type === "model" || type === "default") && typeof action.asset !== "string") {
      defects.push("a model object must include \"asset\" (an id from the catalog), or use a primitive type such as sphere/cylinder/cone/plane/text");
    }
  }
  const placement = action.placement;
  if (isRecord(placement)) {
    if (placement.kind === "relation" && isRecord(placement.relation)) {
      const relation = placement.relation;
      if (typeof relation.type !== "string" || !RELATION_NAMES.has(relation.type as never)) defects.push(`placement.relation.type is missing or invalid`);
      if (!Array.isArray(relation.objects) || relation.objects.length === 0) defects.push("placement.relation.objects must list the referenced object ids");
      const extra = Object.keys(relation).filter((key) => !RELATION_KEYS.has(key));
      if (extra.length > 0) defects.push(`placement.relation only accepts ${[...RELATION_KEYS].join(", ")} — put "${extra.join('", "')}" on the top-level orbit object instead`);
    } else if (placement.kind !== "relation" && !["anchor", "relative", "point"].includes(String(placement.kind))) {
      defects.push(`"${String(placement.kind)}" is not a valid placement kind`);
    }
  } else if (placement !== undefined && !Array.isArray(placement)) {
    defects.push("placement must be a JSON object");
  }
  if (name !== "create_3d_object" && typeof action.target !== "string" && typeof action.id !== "string") {
    defects.push(`"${name}" needs a "target" object id`);
  }
  return defects;
}

/**
 * Returns short correction bullets for a rejected response. Deliberately narrow: it reports what the
 * validator rejected, and never echoes the prompt or credentials.
 */
export function describeResponseDefects(raw: unknown): string[] {
  if (!isRecord(raw)) return ["the response was not a JSON object"];
  const actions = raw.visual3d_actions;
  if (actions !== undefined && actions !== null && !Array.isArray(actions)) return ["visual3d_actions must be an array"];
  if (Array.isArray(actions)) {
    const defects: string[] = [];
    for (const action of actions) defects.push(...defectsOfAction(action));
    if (defects.length > 0) return defects.slice(0, 6);
  }
  const board = raw.board_actions;
  if (board !== undefined && board !== null && !Array.isArray(board)) return ["board_actions must be an array"];
  const visual = raw.visual_actions;
  if (visual !== undefined && visual !== null && !Array.isArray(visual)) return ["visual_actions must be an array"];
  return ["speech, lesson_step and next_step are required, and every action must use only allowed action names and fields"];
}

/** The corrective turn appended to the original request for the single repair attempt. */
export function repairTurn(raw: unknown): string {
  const defects = describeResponseDefects(raw);
  return [
    "Your previous JSON was rejected by the validator. Fix ONLY these problems and return the complete corrected JSON object:",
    ...defects.map((defect) => `- ${defect}`),
  ].join("\n");
}
