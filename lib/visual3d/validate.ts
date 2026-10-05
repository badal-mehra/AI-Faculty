// STRICT validation for 3D visual actions.
//
// This is the single gate between model output and the 3D renderer: malformed output is rejected
// (never coerced), exactly like lib/visual/validate.ts. Nothing executes model-provided code —
// only known action shapes and trusted asset IDs survive.
import {
  ANNOTATION_KINDS,
  CAMERA_MODES,
  FLOW_CURVES,
  FLOW_KINDS,
  FLOW_SHAPES,
  LABEL_SIDES,
  MAX_3D_ACTIONS_PER_STEP,
  MAX_3D_ANNOTATIONS,
  MAX_3D_FLOWS,
  MAX_3D_LABELS,
  MAX_3D_OBJECTS,
  MAX_3D_PARTICLES_TOTAL,
  MAX_ANIMATION_MS,
  MAX_FOV,
  MAX_LABEL_LENGTH,
  MAX_3D_OBJECT_TEXT,
  MAX_PARTICLE_COUNT,
  MAX_SCALE,
  MIN_ANIMATION_MS,
  MIN_FOV,
  MIN_PARTICLE_COUNT,
  MIN_SCALE,
  OBJECT3D_ANIMATION_KINDS,
  OBJECT3D_TYPES,
  OSCILLATION_AXES,
  PLACEMENT_ANCHORS_3D,
  RELATION_TYPES_3D,
  RELATIVE_SIDES_3D,
  VISUAL3D_ACTION_TYPES,
  VECTOR_KINDS,
  Object3DAnimation,
  Object3DAnimationKind,
  Object3DPlacement,
  Object3DRelation,
  Object3DType,
  Visual3DAction,
  Visual3DAnnotation,
  Visual3DLabel,
  Visual3DFlow,
  Visual3DObject,
  Visual3DScene,
  Vec3,
} from "./types";
import { resolveAsset, resolveAssetId } from "./assets";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isFiniteNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isInteger = (value: unknown): value is number => isFiniteNumber(value) && Number.isInteger(value);

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/;
const isId = (value: unknown): value is string => isString(value) && ID_PATTERN.test(value);
const isAssetId = (value: unknown): value is string => isString(value) && value.trim().length > 0 && value.length <= 128 && resolveAssetId(value) !== undefined;
const isText = (value: unknown, max = MAX_3D_OBJECT_TEXT): value is string => isString(value) && value.trim().length > 0 && value.length <= max;
const isColor = (value: unknown): value is string => isString(value) && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

/**
 * Colours are hex everywhere in the renderer, but a model writes "red" the way a person does, and one
 * named colour used to cost the whole teaching step. Names are translated; anything else is refused.
 */
const NAMED_COLORS: Record<string, string> = {
  red: "#ff0000", green: "#00ff00", blue: "#0000ff", yellow: "#ffff00", orange: "#ff8800",
  purple: "#8844ff", magenta: "#ff00ff", pink: "#ff88cc", cyan: "#00ffff", teal: "#008888",
  lime: "#88ff00", amber: "#ffaa00", gold: "#ffd700", brown: "#8b4513", grey: "#808080", gray: "#808080",
  white: "#ffffff", black: "#000000", silver: "#c0c0c0", violet: "#8a2be2", navy: "#000080",
};
const parseColor = (value: unknown): string | null => {
  if (isColor(value)) return value.length === 4 ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}` : value;
  if (!isString(value)) return null;
  return NAMED_COLORS[value.trim().toLowerCase()] ?? null;
};

const COORD_LIMIT_3D = 10000;
const isCoord3D = (value: unknown): value is number => isFiniteNumber(value) && Math.abs(value) <= COORD_LIMIT_3D;
const isVec3Coord = (value: unknown): value is Vec3 =>
  isRecord(value) && isCoord3D(value.x) && isCoord3D(value.y) && isCoord3D(value.z);

const isScaleValue = (value: unknown): boolean => {
  if (isFiniteNumber(value)) return value >= MIN_SCALE && value <= MAX_SCALE;
  if (isRecord(value)) return isCoord3D(value.x) && isCoord3D(value.y) && isCoord3D(value.z);
  return false;
};

const isDuration = (value: unknown): value is number => isFiniteNumber(value) && value >= MIN_ANIMATION_MS && value <= MAX_ANIMATION_MS;
const isDegrees3D = (v: unknown): boolean => isFiniteNumber(v) && Math.abs(v) <= 3600;
const isFov = (value: unknown): value is number => isFiniteNumber(value) && value >= MIN_FOV && value <= MAX_FOV;
const isSpeed = (value: unknown): value is number => isFiniteNumber(value) && value >= 0.01 && value <= 100;
const isAngularSpeed = (value: unknown): value is number => isFiniteNumber(value) && Math.abs(value) <= 720;
const isParticleCount = (value: unknown): value is number => isInteger(value) && value >= MIN_PARTICLE_COUNT && value <= MAX_PARTICLE_COUNT;
const isSize3D = (value: unknown): value is number => isFiniteNumber(value) && value >= 0.001 && value <= MAX_SCALE;
const isLabelText = (value: unknown): value is string => isString(value) && value.length <= MAX_LABEL_LENGTH;
const isSubtitle = (value: unknown): value is string => isString(value) && value.length > 0 && value.length <= MAX_LABEL_LENGTH;

const oneOf = <T extends readonly string[]>(list: T, value: unknown): value is T[number] => isString(value) && (list as readonly string[]).includes(value);

export function parse3DAnimation(value: unknown): Object3DAnimation | null {
  if (value === undefined) return null;
  if (!isRecord(value) || !oneOf(OBJECT3D_ANIMATION_KINDS, value.kind)) return null;
  const durationMs = value.durationMs === undefined ? 600 : value.durationMs;
  if (!isDuration(durationMs)) return null;
  const delayMs = value.delayMs === undefined ? 0 : value.delayMs;
  if (!isDuration(delayMs)) return null;
  return { kind: value.kind as Object3DAnimationKind, durationMs, delayMs };
}

export function parseVisual3DRelation(value: unknown): Object3DRelation | null {
  if (!isRecord(value)) return null;
  if (!oneOf(RELATION_TYPES_3D, value.type)) return null;
  if (!Array.isArray(value.objects) || value.objects.length === 0 || value.objects.length > 2) return null;
  const objects: string[] = [];
  for (const entry of value.objects) {
    if (!isId(entry)) return null;
    objects.push(entry);
  }
  const relation: Object3DRelation = { type: value.type, objects };
  if (value.gap !== undefined) {
    if (!isFiniteNumber(value.gap) || value.gap <= 0 || value.gap > 20) return null;
    relation.gap = value.gap;
  }
  if (value.offset !== undefined) {
    if (!isFiniteNumber(value.offset) || Math.abs(value.offset) > 500) return null;
    relation.offset = value.offset;
  }
  if (value.axis !== undefined) {
    if (value.axis !== "x" && value.axis !== "y" && value.axis !== "z") return null;
    relation.axis = value.axis;
  }
  if (value.anchorPart !== undefined) {
    if (!isId(value.anchorPart)) return null;
    relation.anchorPart = value.anchorPart;
  }
  return relation;
}

export function parseVisual3DPlacement(value: unknown): Object3DPlacement | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case "anchor":
      return oneOf(PLACEMENT_ANCHORS_3D, value.anchor) ? { kind: "anchor", anchor: value.anchor } : null;
    case "point":
      if (!isCoord3D(value.x) || !isCoord3D(value.y) || !isCoord3D(value.z)) return null;
      return { kind: "point", x: value.x, y: value.y, z: value.z };
    case "relative": {
      if (!isId(value.relativeTo) || !oneOf(RELATIVE_SIDES_3D, value.side)) return null;
      const gap = value.gap === undefined ? 0.6 : value.gap;
      if (!isFiniteNumber(gap) || gap < 0 || gap > 500) return null;
      return { kind: "relative", relativeTo: value.relativeTo, side: value.side, gap };
    }
    case "relation": {
      const relation = parseVisual3DRelation(value.relation);
      return relation ? { kind: "relation", relation } : null;
    }
    default:
      return null;
  }
}

export function parseVec3(value: unknown): Vec3 | null {
  if (!isVec3Coord(value)) return null;
  return { x: value.x, y: value.y, z: value.z };
}

function withAnimation<T extends object>(base: T, value: Record<string, unknown>): (T & { animate?: Object3DAnimation }) | null {
  if (value.animate === undefined) return base;
  const animate = parse3DAnimation(value.animate);
  return animate ? { ...base, animate } : null;
}

function withFlowAnimation<T extends object>(base: T, value: Record<string, unknown>): (T & { animate?: { kind: string; durationMs: number; delayMs: number } }) | null {
  if (value.animate === undefined) return base;
  if (!isRecord(value.animate) || !isString(value.animate.kind)) return null;
  const durationMs = value.animate.durationMs === undefined ? 600 : value.animate.durationMs;
  if (!isDuration(durationMs)) return null;
  const delayMs = value.animate.delayMs === undefined ? 0 : value.animate.delayMs;
  if (!isDuration(delayMs)) return null;
  return { ...base, animate: { kind: value.animate.kind, durationMs, delayMs } };
}

function parseAssetScale(value: unknown): number | Vec3 | null {
  if (typeof value === "number") {
    return isFiniteNumber(value) && value >= MIN_SCALE && value <= MAX_SCALE ? value : null;
  }
  if (isRecord(value) && isCoord3D(value.x) && isCoord3D(value.y) && isCoord3D(value.z)) {
    return { x: value.x, y: value.y, z: value.z };
  }
  return null;
}

/** An overlay endpoint: either the id of an object on screen, or a literal world point. */
function parseEndpointRef(value: unknown): string | Vec3 | null {
  if (typeof value === "string") return isId(value) ? value : null;
  return parseVec3(value);
}

export function parseVisual3DAction(value: unknown): Visual3DAction | null {
  if (!isRecord(value) || !isString(value.action)) return null;
  const v = value;

  switch (v.action) {
    case "create_3d_object": {
      if (!isId(v.id) || !oneOf(OBJECT3D_TYPES, v.type)) return null;
      // A "model" with no catalog asset cannot be drawn, and the provider often writes one anyway. A
      // model is only worth what it looks like, so it is downgraded to a primitive and the step is
      // kept: the alternative is discarding a whole teaching step, and with it part of the lesson,
      // because one optional field was left out.
      const asset = isAssetId(v.asset) ? resolveAssetId(v.asset) : undefined;
      const type = v.type === "model" && !asset ? "box" : (v.type as Object3DType);
      const parsed: Record<string, unknown> = { action: "create_3d_object", id: v.id, type };
      if (v.placement !== undefined) {
        const placement = parseVisual3DPlacement(v.placement);
        if (!placement) return null;
        parsed.placement = placement;
      }
      if (v.position !== undefined) {
        const position = parseVec3(v.position);
        if (!position) return null;
        parsed.position = position;
      }
      if (asset !== undefined) parsed.asset = asset;
      if (v.scale !== undefined) {
        const scale = parseAssetScale(v.scale);
        if (scale === null) return null;
        parsed.scale = scale;
      }
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; parsed.color = color; }
      if (v.part !== undefined) {
        if (!isId(v.part)) return null;
        // A named part must exist on the asset, otherwise the anchor silently teaches nothing. With
        // no usable asset there are no parts, so the part is dropped rather than the whole object.
        const model = asset === undefined ? undefined : resolveAsset(asset);
        if (model && !model.semanticAnchors.includes(v.part)) return null;
        if (model) parsed.part = v.part;
      }
      if (v.text !== undefined) { if (!isText(v.text)) return null; parsed.text = v.text; }
      if (v.label !== undefined) { if (!isLabelText(v.label)) return null; parsed.label = v.label; }
      if (v.orbit !== undefined) {
        if (!isRecord(v.orbit) || !isId(v.orbit.center)) return null;
        if (v.orbit.radius !== undefined && (!isFiniteNumber(v.orbit.radius) || v.orbit.radius <= 0 || v.orbit.radius > 5000)) return null;
        if (v.orbit.speedDegPerSec !== undefined && (!isFiniteNumber(v.orbit.speedDegPerSec) || Math.abs(v.orbit.speedDegPerSec) > 720)) return null;
        if (v.orbit.tiltDeg !== undefined && (!isFiniteNumber(v.orbit.tiltDeg) || Math.abs(v.orbit.tiltDeg) > 180)) return null;
        parsed.orbit = {
          center: v.orbit.center,
          ...(v.orbit.radius !== undefined ? { radius: v.orbit.radius } : {}),
          ...(v.orbit.speedDegPerSec !== undefined ? { speedDegPerSec: v.orbit.speedDegPerSec } : {}),
          ...(v.orbit.tiltDeg !== undefined ? { tiltDeg: v.orbit.tiltDeg } : {}),
        };
      }
      return withAnimation(parsed, v) as unknown as Visual3DAction;
    }

    case "remove_3d_object":
      if (!isId(v.id)) return null;
      return { action: "remove_3d_object", id: v.id };

    case "move_3d_object": {
      if (!isId(v.id)) return null;
      const position = parseVec3(v.position);
      if (!position) return null;
      return withAnimation({ action: "move_3d_object", id: v.id, position }, v) as unknown as Visual3DAction;
    }

    case "rotate_3d_object": {
      if (!isId(v.id)) return null;
      const rotation = parseVec3(v.rotation);
      if (!rotation) return null;
      if (!isDegrees3D(rotation.x) || !isDegrees3D(rotation.y) || !isDegrees3D(rotation.z)) return null;
      return withAnimation({ action: "rotate_3d_object", id: v.id, rotation }, v) as unknown as Visual3DAction;
    }

    case "scale_3d_object": {
      if (!isId(v.id)) return null;
      const scale = parseAssetScale(v.scale);
      if (scale === null) return null;
      return withAnimation({ action: "scale_3d_object", id: v.id, scale }, v) as unknown as Visual3DAction;
    }

    case "highlight_3d_object": {
      if (!isId(v.id)) return null;
      const base: Record<string, unknown> = { action: "highlight_3d_object", id: v.id };
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; base.color = color; }
      if (v.part !== undefined) { if (!isId(v.part)) return null; base.part = v.part; }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "animate_orbit": {
      if (!isId(v.id) || !isId(v.center) || v.id === v.center) return null;
      const base: Record<string, unknown> = { action: "animate_orbit", id: v.id, center: v.center };
      if (v.radius !== undefined) { if (!isSize3D(v.radius) || v.radius > 5000) return null; base.radius = v.radius; }
      if (v.speedDegPerSec !== undefined) { if (!isAngularSpeed(v.speedDegPerSec)) return null; base.speedDegPerSec = v.speedDegPerSec; }
      if (v.tiltDeg !== undefined) { if (!isDegrees3D(v.tiltDeg)) return null; base.tiltDeg = v.tiltDeg; }
      return base as unknown as Visual3DAction;
    }

    case "animate_spin": {
      if (!isId(v.id)) return null;
      const base: Record<string, unknown> = { action: "animate_spin", id: v.id };
      if (v.axis !== undefined) { if (v.axis !== "x" && v.axis !== "y" && v.axis !== "z") return null; base.axis = v.axis; }
      if (v.speedDegPerSec !== undefined) { if (!isAngularSpeed(v.speedDegPerSec)) return null; base.speedDegPerSec = v.speedDegPerSec; }
      return base as unknown as Visual3DAction;
    }

    case "focus_camera": {
      if (!isId(v.target)) return null;
      const base: Record<string, unknown> = { action: "focus_camera", target: v.target };
      if (v.part !== undefined) { if (!isId(v.part)) return null; base.part = v.part; }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "frame_camera": {
      const base: Record<string, unknown> = { action: "frame_camera" };
      if (v.target !== undefined) { if (!isId(v.target)) return null; base.target = v.target; }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "move_camera": {
      const position = parseVec3(v.position);
      if (!position) return null;
      const base: Record<string, unknown> = { action: "move_camera", position };
      if (v.target !== undefined) {
        const target = parseVec3(v.target);
        if (!target) return null;
        base.target = target;
      }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "zoom_camera":
      if (!isFov(v.fov)) return null;
      return withAnimation({ action: "zoom_camera", fov: v.fov }, v) as unknown as Visual3DAction;

    case "reset_camera":
      return withAnimation({ action: "reset_camera" }, v) as unknown as Visual3DAction;

    case "animate_flow": {
      if (!isId(v.id) || !isId(v.from) || !isId(v.to) || v.from === v.to) return null;
      const parsed: Record<string, unknown> = { action: "animate_flow", id: v.id, from: v.from, to: v.to };
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; parsed.color = color; }
      if (v.particleCount !== undefined) { if (!isParticleCount(v.particleCount)) return null; parsed.particleCount = v.particleCount; }
      if (v.speed !== undefined) { if (!isSpeed(v.speed)) return null; parsed.speed = v.speed; }
      if (v.loop !== undefined) { if (typeof v.loop !== "boolean") return null; parsed.loop = v.loop; }
      if (v.durationMs !== undefined) { if (!isDuration(v.durationMs)) return null; parsed.durationMs = v.durationMs; }
      if (v.size !== undefined) { if (!isSize3D(v.size)) return null; parsed.size = v.size; }
      if (v.trail !== undefined) { if (typeof v.trail !== "boolean") return null; parsed.trail = v.trail; }
      if (v.shape !== undefined) { if (!oneOf(FLOW_SHAPES, v.shape)) return null; parsed.shape = v.shape; }
      if (v.curve !== undefined) { if (!oneOf(FLOW_CURVES, v.curve)) return null; parsed.curve = v.curve; }
      return withFlowAnimation(parsed, v) as unknown as Visual3DAction;
    }

    case "animate_particle": {
      if (!isId(v.id) || !Array.isArray(v.path) || v.path.length < 2) return null;
      const path: Vec3[] = [];
      for (const point of v.path) {
        const parsed = parseVec3(point);
        if (!parsed) return null;
        path.push(parsed);
      }
      const parsed: Record<string, unknown> = { action: "animate_particle", id: v.id, path };
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; parsed.color = color; }
      if (v.particleCount !== undefined) { if (!isParticleCount(v.particleCount)) return null; parsed.particleCount = v.particleCount; }
      if (v.speed !== undefined) { if (!isSpeed(v.speed)) return null; parsed.speed = v.speed; }
      if (v.loop !== undefined) { if (typeof v.loop !== "boolean") return null; parsed.loop = v.loop; }
      if (v.durationMs !== undefined) { if (!isDuration(v.durationMs)) return null; parsed.durationMs = v.durationMs; }
      if (v.size !== undefined) { if (!isSize3D(v.size)) return null; parsed.size = v.size; }
      if (v.trail !== undefined) { if (typeof v.trail !== "boolean") return null; parsed.trail = v.trail; }
      if (v.shape !== undefined) { if (!oneOf(FLOW_SHAPES, v.shape)) return null; parsed.shape = v.shape; }
      if (v.curve !== undefined) { if (!oneOf(FLOW_CURVES, v.curve)) return null; parsed.curve = v.curve; }
      return withFlowAnimation(parsed, v) as unknown as Visual3DAction;
    }

    case "animate_path": {
      if (!isId(v.id) || !isId(v.to) || v.id === v.to) return null;
      const parsed: Record<string, unknown> = { action: "animate_path", id: v.id, to: v.to };
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; parsed.color = color; }
      if (v.particleCount !== undefined) { if (!isParticleCount(v.particleCount)) return null; parsed.particleCount = v.particleCount; }
      if (v.speed !== undefined) { if (!isSpeed(v.speed)) return null; parsed.speed = v.speed; }
      if (v.durationMs !== undefined) { if (!isDuration(v.durationMs)) return null; parsed.durationMs = v.durationMs; }
      if (v.size !== undefined) { if (!isSize3D(v.size)) return null; parsed.size = v.size; }
      if (v.trail !== undefined) { if (typeof v.trail !== "boolean") return null; parsed.trail = v.trail; }
      if (v.shape !== undefined) { if (!oneOf(FLOW_SHAPES, v.shape)) return null; parsed.shape = v.shape; }
      if (v.curve !== undefined) { if (!oneOf(FLOW_CURVES, v.curve)) return null; parsed.curve = v.curve; }
      return withAnimation(parsed, v) as unknown as Visual3DAction;
    }

    case "show_3d_label": {
      if (!isId(v.id) || !isId(v.target) || !isLabelText(v.text)) return null;
      const parsed: Record<string, unknown> = { action: "show_3d_label", id: v.id, target: v.target, text: v.text };
      if (v.subtitle !== undefined) { if (!isSubtitle(v.subtitle)) return null; parsed.subtitle = v.subtitle; }
      if (v.side !== undefined) { if (!oneOf(LABEL_SIDES, v.side)) return null; parsed.side = v.side; }
      if (v.leader !== undefined) { if (typeof v.leader !== "boolean") return null; parsed.leader = v.leader; }
      if (v.part !== undefined) { if (!isId(v.part)) return null; parsed.part = v.part; }
      if (v.position !== undefined) {
        const position = parseVec3(v.position);
        if (!position) return null;
        parsed.position = position;
      }
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; parsed.color = color; }
      if (v.size !== undefined) { if (!isSize3D(v.size)) return null; parsed.size = v.size; }
      return parsed as unknown as Visual3DAction;
    }

    case "hide_3d_label":
      if (!isId(v.id)) return null;
      return { action: "hide_3d_label", id: v.id };

    // ---- generic inspection ------------------------------------------------
    // A named part is checked against the LIVE scene here only when it is known statically (create);
    // for these actions the engine re-checks against the actual asset so an invented part name is a
    // silent no-op instead of a broken lesson.

    case "isolate_part":
      if (!isId(v.id) || !isId(v.part)) return null;
      return { action: "isolate_part", id: v.id, part: v.part };

    case "restore_parts":
      if (v.id === undefined) return { action: "restore_parts" };
      if (!isId(v.id)) return null;
      return { action: "restore_parts", id: v.id };

    case "explode_group": {
      if (!isId(v.id)) return null;
      const base: Record<string, unknown> = { action: "explode_group", id: v.id };
      if (v.parts !== undefined) {
        if (!Array.isArray(v.parts) || v.parts.length > 24 || !v.parts.every(isId)) return null;
        base.parts = v.parts;
      }
      if (v.strength !== undefined) {
        if (!isFiniteNumber(v.strength) || v.strength <= 0 || v.strength > 3) return null;
        base.strength = v.strength;
      }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "assemble_group": {
      if (!isId(v.id)) return null;
      return withAnimation({ action: "assemble_group", id: v.id }, v) as unknown as Visual3DAction;
    }

    case "set_visibility": {
      if (typeof v.visible !== "boolean") return null;
      const ids: string[] = [];
      if (v.id !== undefined) { if (!isId(v.id)) return null; ids.push(v.id); }
      if (v.ids !== undefined) {
        if (!Array.isArray(v.ids) || v.ids.length > MAX_3D_OBJECTS || !v.ids.every(isId)) return null;
        ids.push(...v.ids);
      }
      if (v.part !== undefined && !isId(v.part)) return null;
      // A named part belongs to a model, so a target object is required whenever a part is named.
      if (ids.length === 0) return null;
      return {
        action: "set_visibility",
        visible: v.visible,
        ids: Array.from(new Set(ids)),
        ...(v.part !== undefined ? { part: v.part as string } : {}),
      } as unknown as Visual3DAction;
    }

    case "pulse_3d_object": {
      if (!isId(v.id)) return null;
      const base: Record<string, unknown> = { action: "pulse_3d_object", id: v.id };
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; base.color = color; }
      if (v.amplitude !== undefined) { if (!isFiniteNumber(v.amplitude) || v.amplitude <= 0 || v.amplitude > 1) return null; base.amplitude = v.amplitude; }
      if (v.periodMs !== undefined) { if (!isDuration(v.periodMs) || v.periodMs < 120) return null; base.periodMs = v.periodMs; }
      if (v.durationMs !== undefined) { if (!isFiniteNumber(v.durationMs) || v.durationMs < 0 || v.durationMs > 30000) return null; base.durationMs = v.durationMs; }
      return base as unknown as Visual3DAction;
    }

    case "animate_oscillate": {
      if (!isId(v.id) || !isId(v.pivot) || v.id === v.pivot) return null;
      const base: Record<string, unknown> = { action: "animate_oscillate", id: v.id, pivot: v.pivot };
      if (v.axis !== undefined) { if (!oneOf(OSCILLATION_AXES, v.axis)) return null; base.axis = v.axis; }
      if (v.amplitudeDeg !== undefined) { if (!isFiniteNumber(v.amplitudeDeg) || v.amplitudeDeg <= 0 || v.amplitudeDeg > 180) return null; base.amplitudeDeg = v.amplitudeDeg; }
      if (v.periodMs !== undefined) { if (!isFiniteNumber(v.periodMs) || v.periodMs < 200 || v.periodMs > 20000) return null; base.periodMs = v.periodMs; }
      return base as unknown as Visual3DAction;
    }

    case "follow_object": {
      if (!isId(v.target)) return null;
      const base: Record<string, unknown> = { action: "follow_object", target: v.target };
      if (v.part !== undefined) { if (!isId(v.part)) return null; base.part = v.part; }
      return withAnimation(base, v) as unknown as Visual3DAction;
    }

    case "return_camera":
      return withAnimation({ action: "return_camera" }, v) as unknown as Visual3DAction;

    // ---- generic educational overlays ---------------------------------------

    case "show_vector": {
      if (!isId(v.id)) return null;
      const from = parseEndpointRef(v.from);
      if (!from) return null;
      const direction = parseVec3(v.direction);
      if (!direction) return null;
      const base: Record<string, unknown> = { action: "show_vector", id: v.id, from, direction };
      if (v.length !== undefined) { if (!isFiniteNumber(v.length) || v.length <= 0 || v.length > 5000) return null; base.length = v.length; }
      if (v.vectorKind !== undefined) { if (!oneOf(VECTOR_KINDS, v.vectorKind)) return null; base.vectorKind = v.vectorKind; }
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; base.color = color; }
      if (v.text !== undefined) { if (!isLabelText(v.text)) return null; base.text = v.text; }
      return base as unknown as Visual3DAction;
    }

    case "show_measurement": {
      if (!isId(v.id)) return null;
      const from = parseEndpointRef(v.from);
      const to = parseEndpointRef(v.to);
      if (!from || !to) return null;
      if (typeof from === "string" && from === to) return null;
      const base: Record<string, unknown> = { action: "show_measurement", id: v.id, from, to };
      if (v.text !== undefined) { if (!isLabelText(v.text)) return null; base.text = v.text; }
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; base.color = color; }
      return base as unknown as Visual3DAction;
    }

    case "show_trajectory": {
      if (!isId(v.id)) return null;
      const base: Record<string, unknown> = { action: "show_trajectory", id: v.id };
      if (v.path !== undefined) {
        if (!Array.isArray(v.path) || v.path.length < 2 || v.path.length > 64) return null;
        const path: Vec3[] = [];
        for (const point of v.path) {
          const parsed = parseVec3(point);
          if (!parsed) return null;
          path.push(parsed);
        }
        base.path = path;
      }
      if (v.through !== undefined) {
        if (!Array.isArray(v.through) || v.through.length < 2 || v.through.length > 24 || !v.through.every(isId)) return null;
        base.through = v.through;
      }
      if (base.path === undefined && base.through === undefined) return null;
      if (v.color !== undefined) { const color = parseColor(v.color); if (!color) return null; base.color = color; }
      if (v.speed !== undefined) { if (!isSpeed(v.speed) || v.speed > 20) return null; base.speed = v.speed; }
      if (v.durationMs !== undefined) { if (!isDuration(v.durationMs)) return null; base.durationMs = v.durationMs; }
      return base as unknown as Visual3DAction;
    }

    case "hide_annotation":
      if (!isId(v.id)) return null;
      return { action: "hide_annotation", id: v.id };

    case "wait":
      if (!isDuration(v.durationMs)) return null;
      return { action: "wait", durationMs: v.durationMs };

    case "clear_3d_scene":
      return { action: "clear_3d_scene" } as unknown as Visual3DAction;

    default:
      return null;
  }
}

export function parseVisual3DActions(value: unknown): Visual3DAction[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > MAX_3D_ACTIONS_PER_STEP) return null;
  // One unusable action must cost only that action. A step carries the teaching as well as the
  // visuals, so throwing the step away over a single bad colour or a flow with identical endpoints
  // deletes a piece of the lesson the student would otherwise have heard.
  const parsed = value.map(parseVisual3DAction).filter((action): action is Visual3DAction => action !== null);
  return parsed;
}

function isVisual3DObjectLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isId(value.id)
    && isString(value.objectKind)
    && isString(value.type)
    && isVec3Coord(value.position)
    && isVec3Coord(value.rotation)
    && isRecord(value.scale)
    && isCoord3D((value.scale as Record<string, unknown>).x)
    && isCoord3D((value.scale as Record<string, unknown>).y)
    && isCoord3D((value.scale as Record<string, unknown>).z)
    && isFiniteNumber(value.radius)
    && value.radius >= 0
    && isFiniteNumber(value.opacity)
    && typeof value.visible === "boolean"
    && typeof value.highlight === "boolean"
    && typeof value.castShadow === "boolean"
    && typeof value.receiveShadow === "boolean";
}

function isFlowLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isId(value.id)
    && oneOf(FLOW_KINDS, value.kind)
    && isId(value.fromId)
    && isId(value.toId)
    && isColor(value.color)
    && isParticleCount(value.particleCount)
    && isSpeed(value.speed)
    && typeof value.loop === "boolean"
    && Array.isArray(value.pathPoints);
}

function isLabelLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isId(value.id)
    && isId(value.targetId)
    && isText(value.text, MAX_LABEL_LENGTH)
    && isVec3Coord(value.position)
    && isColor(value.color)
    && isSize3D(value.size)
    && typeof value.visible === "boolean";
}

function isCameraLike(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (!isVec3Coord(value.position) || !isVec3Coord(value.target)) return false;
  if (!isFov(value.fov) || !oneOf(CAMERA_MODES, value.mode)) return false;
  if (value.focusedObjectId !== undefined && !isId(value.focusedObjectId)) return false;
  if (value.follow !== undefined && value.follow !== null) {
    if (!isRecord(value.follow) || !isId(value.follow.targetId)) return false;
    if (value.follow.part !== undefined && !isId(value.follow.part)) return false;
  }
  if (value.near !== undefined && (!isFiniteNumber(value.near) || value.near <= 0)) return false;
  if (value.far !== undefined && (!isFiniteNumber(value.far) || value.far <= 0)) return false;
  return true;
}

function isAnnotationLike(value: unknown): value is Record<string, unknown> {
  return isRecord(value)
    && isId(value.id)
    && oneOf(ANNOTATION_KINDS, value.kind)
    && isVec3Coord(value.from)
    && isVec3Coord(value.to)
    && Array.isArray(value.points)
    && value.points.every(isVec3Coord)
    && isColor(value.color)
    && isFiniteNumber(value.headSize)
    && isFiniteNumber(value.width)
    && typeof value.visible === "boolean";
}

/**
 * Inspection memory travels with the scene. It is plain JSON, only ever written by the reversible
 * actions, and only ever read back by restore_parts / return_camera, so it is checked for shape
 * rather than for meaning.
 */
function isMemoryLike(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (!isRecord(value)) return false;
  const idMaps = ["visibility", "hiddenParts", "isolatePart", "explodeOffsets", "pulse", "oscillation"];
  for (const key of idMaps) {
    const entry = value[key];
    if (entry === undefined) continue;
    if (!isRecord(entry)) return false;
    if (key === "visibility" && !Object.values(entry).every((item) => typeof item === "boolean")) return false;
    if (key === "hiddenParts" && !Object.values(entry).every((item) => Array.isArray(item) && item.every(isId))) return false;
    if (key === "isolatePart" && !Object.values(entry).every((item) => typeof item === "string")) return false;
    if (key === "explodeOffsets" && !Object.values(entry).every((item) => isRecord(item) && Object.values(item as Record<string, unknown>).every(isVec3Coord))) return false;
    if ((key === "pulse" || key === "oscillation") && !Object.values(entry).every((item) => isRecord(item))) return false;
  }
  if (value.camera !== undefined && value.camera !== null && !isCameraLike(value.camera)) return false;
  return true;
}

function isBoundsLike(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  return isRecord(value) && isVec3Coord(value.min) && isVec3Coord(value.max) && isVec3Coord(value.center) && isVec3Coord(value.size) && isFiniteNumber(value.radius);
}

// Round-trips the 3D scene the client sends back with every teaching request (lesson batches and Ask).
// Invalid objects are dropped (capped at limits) rather than failing the whole request.
export function parseVisual3DScene(value: unknown): Visual3DScene | null {
  if (value === undefined || value === null) return emptyVisual3DSceneParsed();
  if (!isRecord(value) || !Array.isArray(value.objects)) return null;
  if (!Array.isArray(value.flows) || !Array.isArray(value.labels)) return null;
  if (!isCameraLike(value.camera)) return null;
  if (!isBoundsLike(value.bounds)) return null;
  if (!isMemoryLike(value.memory)) return null;

  const objects: Visual3DObject[] = [];
  for (const candidate of value.objects.slice(0, MAX_3D_OBJECTS)) {
    if (!isVisual3DObjectLike(candidate)) return null;
    objects.push(candidate as unknown as Visual3DObject);
  }

  const flows: Visual3DFlow[] = [];
  for (const candidate of value.flows.slice(0, MAX_3D_FLOWS)) {
    if (!isFlowLike(candidate)) return null;
    flows.push(candidate as unknown as Visual3DFlow);
  }

  const labels: Visual3DLabel[] = [];
  for (const candidate of value.labels.slice(0, MAX_3D_LABELS)) {
    if (!isLabelLike(candidate)) return null;
    labels.push(candidate as unknown as Visual3DLabel);
  }

  // Annotations and memory were added after the first release; a client that predates them still
  // round-trips, they simply default to empty.
  const annotations: Visual3DAnnotation[] = [];
  if (Array.isArray(value.annotations)) {
    for (const candidate of value.annotations.slice(0, MAX_3D_ANNOTATIONS)) {
      if (!isAnnotationLike(candidate)) return null;
      annotations.push(candidate as unknown as Visual3DAnnotation);
    }
  }

  const tick = isInteger(value.tick) && value.tick >= 0 ? value.tick : 0;
  return {
    objects,
    flows,
    labels,
    annotations,
    camera: value.camera as unknown as Visual3DScene["camera"],
    bounds: (value.bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 }, radius: 0 }) as Visual3DScene["bounds"],
    memory: isRecord(value.memory) ? value.memory as Visual3DScene["memory"] : emptyVisual3DSceneParsed().memory,
    tick,
    ...(isString(value.lessonId) ? { lessonId: value.lessonId.slice(0, 64) } : {}),
  };
}

function emptyVisual3DSceneParsed(): Visual3DScene {
  return {
    objects: [],
    flows: [],
    labels: [],
    annotations: [],
    camera: { position: { x: 6, y: 4, z: 8 }, target: { x: 0, y: 0, z: 0 }, fov: 45, near: 0.1, far: 400, mode: "default" },
    bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 }, radius: 0 },
    memory: { visibility: {}, hiddenParts: {}, isolatePart: {}, explodeOffsets: {}, pulse: {}, oscillation: {} },
    tick: 0,
  };
}

// First human-readable reason a 3D action batch is invalid (development diagnostics only).
export function describeVisual3DActionError(value: unknown): string {
  if (value === undefined) return "No 3D visual actions provided.";
  if (!Array.isArray(value)) return "visual3d_actions must be an array.";
  if (value.length > MAX_3D_ACTIONS_PER_STEP) return `visual3d_actions exceeds the maximum of ${MAX_3D_ACTIONS_PER_STEP} actions per step.`;
  for (let index = 0; index < value.length; index += 1) {
    const action = value[index];
    if (!isRecord(action) || !isString(action.action)) return `visual3d_actions[${index}] is missing a valid action name.`;
    if (parseVisual3DAction(action) === null) return `visual3d_actions[${index}] ("${action.action}") is malformed.`;
  }
  return "visual3d_actions could not be parsed.";
}