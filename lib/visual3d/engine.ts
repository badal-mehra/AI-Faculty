// 3D VISUALIZATION ENGINE — deterministic reducer for the generalized 3D action schema.
//
//   AI visual3d_actions -> applyVisual3DActions(scene, actions) -> Visual3DScene -> 3D renderer
//
// It is UI-agnostic (no React, like lib/visual/engine.ts) and TOPIC-AGNOSTIC: given the same ordered
// actions it always produces the same scene, and it never needs to know what the 3D scene depicts.
// Three things happen here and nowhere else:
//   1. semantic relations from the AI become concrete world positions (lib/visual3d/layout.ts),
//   2. every object gets a real WORLD RADIUS from asset metadata, so layout and camera framing work,
//   3. unless the teacher directed the camera this step, the camera is re-framed to the new content.
import { clamp } from "../visual/geometry";
import {
  DEFAULT_CAMERA,
  EMPTY_3D_MEMORY,
  FlowCurve,
  FlowShape,
  MAX_3D_ANNOTATIONS,
  MAX_3D_FLOWS,
  MAX_3D_LABELS,
  MAX_3D_OBJECTS,
  MAX_3D_PARTICLES_TOTAL,
  MAX_PARTICLE_COUNT,
  MAX_SCALE,
  MIN_PARTICLE_COUNT,
  MIN_SCALE,
  Object3DAnimationKind,
  Object3DPlacement,
  Object3DMotion,
  Object3DRelation,
  Object3DType,
  Visual3DAction,
  Visual3DAnnotation,
  Visual3DFlow,
  Visual3DLabel,
  Visual3DObject,
  Visual3DScene,
  Visual3DSceneMemory,
  Vec3,
} from "./types";
import { getAsset, resolveAssetId } from "./assets";
import { buildTimeline } from "./timeline";
import { CameraOccluder, applyCameraAction, enclosingOccluderRadius, fitOutsideOf, partBounds, sphereBounds } from "./camera";
import { autoPlacement, resolveSceneLayout } from "./layout";
import { boundsFromSceneObjects, finalizeBounds, fitCameraToBounds, sceneBounds } from "./framing";

const DEFAULT_ANIMATION_MS = 600;
const DEFAULT_FLOW_SPEED = 1;
const DEFAULT_PARTICLE_COUNT = 18;
const DEFAULT_FLOW_SIZE = 0.07;
const DEFAULT_COLOR = "#e2e8f0";
const DEFAULT_SPIN_DEG_PER_SEC = 45;
const DEFAULT_EXPLODE_STRENGTH = 0.55;
const DEFAULT_PULSE_PERIOD_MS = 900;
const DEFAULT_PULSE_DURATION_MS = 2600;
const DEFAULT_OSCILLATION_PERIOD_MS = 2000;
const DEFAULT_VECTOR_LENGTH = 1.5;

// Primitive bounding radius in world units at scale 1. Asset-backed objects use the normalized
// model radius from the registry instead, which is what keeps a heart and a packet in one framing.
const PRIMITIVE_RADIUS: Record<Object3DType, number> = {
  sphere: 1,
  box: 0.87,
  cylinder: 0.75,
  cone: 0.7,
  torus: 1.1,
  plane: 2.4,
  arrow: 0.6,
  particle: 0.1,
  tube: 0.5,
  line: 2,
  molecule: 0.7,
  crystal: 0.8,
  text: 0.4,
  model: 1,
};

function toUniformScale(scale: unknown): number {
  if (typeof scale === "number") return scale;
  if (scale && typeof scale === "object") {
    const s = scale as { x: number; y: number; z: number };
    return (s.x + s.y + s.z) / 3;
  }
  return 1;
}

function clampScale(value: number): number {
  return clamp(value, MIN_SCALE, MAX_SCALE);
}

function defaultScaleForType(type: Object3DType): number {
  switch (type) {
    case "sphere": return 1;
    case "box": return 1;
    case "cylinder": return 1;
    case "cone": return 1;
    case "torus": return 1;
    case "plane": return 1;
    case "arrow": return 1;
    case "particle": return 0.12;
    case "tube": return 1;
    case "line": return 1;
    case "molecule": return 1;
    case "crystal": return 1;
    case "text": return 0.4;
    case "model": return 1;
    default: return 1;
  }
}

function resolveScale(action: Extract<Visual3DAction, { action: "create_3d_object" }>): { uniform: number; vec: { x: number; y: number; z: number } } {
  if (action.scale === undefined) {
    const base = action.type === "model" ? (getAsset(action.asset ?? "")?.defaultScale ?? 1.2) : defaultScaleForType(action.type);
    return { uniform: base, vec: { x: base, y: base, z: base } };
  }
  const uniform = clampScale(toUniformScale(action.scale));
  if (typeof action.scale === "number") return { uniform, vec: { x: uniform, y: uniform, z: uniform } };
  const s = action.scale;
  return { uniform, vec: { x: clampScale(s.x), y: clampScale(s.y), z: clampScale(s.z) } };
}

function radiusFor(type: Object3DType, scale: number, assetId?: string): number {
  if (assetId) {
    const asset = getAsset(assetId);
    if (asset) return Math.max(asset.boundingRadius * scale, 0.01);
  }
  return Math.max((PRIMITIVE_RADIUS[type] ?? 1) * scale, 0.01);
}

function motionOf(
  animate: { durationMs: number; delayMs: number; kind: Object3DAnimationKind } | undefined,
  startAtMs: number,
  tick: number,
  explicitKind?: Object3DAnimationKind,
  extra?: Partial<Object3DMotion>,
): Object3DMotion | undefined {
  if (!animate && !extra) return undefined;
  return {
    kind: (explicitKind ?? animate?.kind ?? "appear") as Object3DAnimationKind,
    durationMs: animate?.durationMs ?? DEFAULT_ANIMATION_MS,
    delayMs: startAtMs,
    tick,
    ...(extra?.fromPosition ? { fromPosition: extra.fromPosition } : {}),
    ...(extra?.toPosition ? { toPosition: extra.toPosition } : {}),
    ...(extra?.fromRotation ? { fromRotation: extra.fromRotation } : {}),
    ...(extra?.toRotation ? { toRotation: extra.toRotation } : {}),
    ...(extra?.fromScale ? { fromScale: extra.fromScale } : {}),
    ...(extra?.toScale ? { toScale: extra.toScale } : {}),
  };
}

function withObject(scene: Visual3DScene, object: Visual3DObject): Visual3DScene {
  return { ...scene, objects: [...scene.objects, object] };
}

function patchObject(scene: Visual3DScene, id: string, tick: number, patch: (object: Visual3DObject) => Visual3DObject | null): Visual3DScene {
  let changed = false;
  const objects = scene.objects.map((object) => {
    if (object.id !== id) return object;
    const next = patch(object);
    if (!next) return object;
    changed = true;
    return next;
  });
  return changed ? { ...scene, objects, tick } : scene;
}

// Deep clone safe to serialize into a teaching request (mirrors getVisualScene / getBoardState).
export function getVisual3DScene(scene: Visual3DScene): Visual3DScene {
  return {
    tick: scene.tick,
    objects: scene.objects.map((object) => ({
      ...object,
      position: { ...object.position },
      rotation: { ...object.rotation },
      scale: { ...object.scale },
      relation: object.relation ? { ...object.relation, objects: [...object.relation.objects] } : undefined,
      orbit: object.orbit ? { ...object.orbit } : undefined,
      oscillation: object.oscillation ? { ...object.oscillation } : undefined,
      pulse: object.pulse ? { ...object.pulse } : undefined,
      hiddenParts: object.hiddenParts ? [...object.hiddenParts] : undefined,
      explodeOffsets: object.explodeOffsets
        ? Object.fromEntries(Object.entries(object.explodeOffsets).map(([part, offset]) => [part, { ...offset }]))
        : undefined,
      motion: object.motion
        ? {
            ...object.motion,
            fromPosition: object.motion.fromPosition ? { ...object.motion.fromPosition } : undefined,
            toPosition: object.motion.toPosition ? { ...object.motion.toPosition } : undefined,
            fromRotation: object.motion.fromRotation ? { ...object.motion.fromRotation } : undefined,
            toRotation: object.motion.toRotation ? { ...object.motion.toRotation } : undefined,
            fromScale: object.motion.fromScale ? { ...object.motion.fromScale } : undefined,
            toScale: object.motion.toScale ? { ...object.motion.toScale } : undefined,
          }
        : undefined,
    })),
    flows: scene.flows.map((flow) => ({
      ...flow,
      pathPoints: flow.pathPoints.map((point) => ({ ...point })),
    })),
    labels: scene.labels.map((label) => ({ ...label, position: { ...label.position } })),
    annotations: (scene.annotations ?? []).map((annotation) => ({
      ...annotation,
      from: { ...annotation.from },
      to: { ...annotation.to },
      points: annotation.points.map((point) => ({ ...point })),
    })),
    camera: {
      ...scene.camera,
      position: { ...scene.camera.position },
      target: { ...scene.camera.target },
      follow: scene.camera.follow ? { ...scene.camera.follow } : undefined,
    },
    memory: cloneMemory(scene.memory ?? emptyVisual3DMemory()),
    bounds: {
      min: { ...scene.bounds.min },
      max: { ...scene.bounds.max },
      center: { ...scene.bounds.center },
      size: { ...scene.bounds.size },
      radius: scene.bounds.radius,
    },
    ...(scene.lessonId ? { lessonId: scene.lessonId } : {}),
  };
}

export const scene3DHasObjects = (scene: Visual3DScene): boolean => scene.objects.length > 0;
export const scene3DIsEmpty = (scene: Visual3DScene): boolean => scene.objects.length === 0;

function findObject(objects: Visual3DObject[], id: string): Visual3DObject | undefined {
  return objects.find((object) => object.id === id);
}

function findFlow(flows: Visual3DFlow[], id: string): Visual3DFlow | undefined {
  return flows.find((flow) => flow.id === id);
}

function findAnnotation(scene: Visual3DScene, id: string): Visual3DAnnotation | undefined {
  return scene.annotations.find((annotation) => annotation.id === id);
}

// ---- inspection memory -----------------------------------------------------
// Every reversible action records what it replaced BEFORE changing it, and only the first time, so
// restore_parts always returns to the state the lesson started from rather than to an intermediate.

function cloneMemory(memory: Visual3DSceneMemory): Visual3DSceneMemory {
  return {
    visibility: { ...memory.visibility },
    hiddenParts: Object.fromEntries(Object.entries(memory.hiddenParts).map(([key, value]) => [key, [...value]])),
    isolatePart: { ...memory.isolatePart },
    explodeOffsets: Object.fromEntries(
      Object.entries(memory.explodeOffsets).map(([key, value]) => [key, Object.fromEntries(
        Object.entries(value).map(([part, offset]) => [part, { ...offset }]),
      )]),
    ),
    pulse: { ...memory.pulse },
    oscillation: Object.fromEntries(Object.entries(memory.oscillation).map(([key, value]) => [key, { ...value }])),
    ...(memory.camera ? { camera: { ...memory.camera, position: { ...memory.camera.position }, target: { ...memory.camera.target }, ...(memory.camera.follow ? { follow: { ...memory.camera.follow } } : {}) } } : {}),
  };
}

export const emptyVisual3DMemory = (): Visual3DSceneMemory => cloneMemory(EMPTY_3D_MEMORY);

/** World position of an object, or of one of its named parts. */
function anchorPointOf(object: Visual3DObject, part?: string): Vec3 {
  const asset = object.asset ? getAsset(object.asset) : undefined;
  if (part) {
    const anchor = asset?.anchors[part];
    if (anchor) {
      const scale = object.scale.x;
      return {
        x: object.position.x + anchor.center.x * scale,
        y: object.position.y + anchor.center.y * scale,
        z: object.position.z + anchor.center.z * scale,
      };
    }
  }
  return { x: object.position.x, y: object.position.y, z: object.position.z };
}

/** Resolves an annotation endpoint: either an object id (optionally a named part) or a literal point. */
function resolveEndpoint(scene: Visual3DScene, ref: string | Vec3, part?: string): Vec3 | undefined {
  if (typeof ref === "object") {
    if (!Number.isFinite(ref.x) || !Number.isFinite(ref.y) || !Number.isFinite(ref.z)) return undefined;
    return { x: ref.x, y: ref.y, z: ref.z };
  }
  const object = findObject(scene.objects, ref);
  if (!object) return undefined;
  return anchorPointOf(object, part);
}

/**
 * Deterministic exploded-view offsets, one per named part, in normalized model units so the object's
 * own scale still applies. The direction is the part's own offset from the model centre; a golden
 * angle keeps coincident parts from flying in the same direction. Original transforms are untouched.
 */
export function explodeOffsetsFor(
  object: Visual3DObject,
  parts: string[] | undefined,
  strength: number,
): Record<string, Vec3> | null {
  const asset = object.asset ? getAsset(object.asset) : undefined;
  if (!asset) return null;
  const anchors = asset.anchors;
  const names = (parts && parts.length > 0 ? parts.filter((part) => anchors[part]) : Object.keys(anchors));
  if (names.length < 2) return null;
  const offsets: Record<string, Vec3> = {};
  names.forEach((name, index) => {
    const center = anchors[name]?.center;
    if (!center) return;
    const length = Math.hypot(center.x, center.y, center.z);
    const fallbackAngle = (index * 2.399963229728653) % (Math.PI * 2);
    const dir = length > 1e-4
      ? { x: center.x / length, y: center.y / length, z: center.z / length }
      : { x: Math.cos(fallbackAngle), y: 0.35, z: Math.sin(fallbackAngle) };
    const distance = strength * (0.8 + (0.4 * index) / Math.max(1, names.length - 1));
    offsets[name] = {
      x: dir.x * distance,
      y: dir.y * distance + strength * 0.1,
      z: dir.z * distance,
    };
  });
  return Object.keys(offsets).length >= 2 ? offsets : null;
}

// Absolute (non-relative, non-relation) placements stay available for precise control; semantic
// relations are resolved in layout.ts after the whole step is known.
function resolvePlacement3D(
  placement: Object3DPlacement | undefined,
  scaleVec: { x: number; y: number; z: number },
  objects: Visual3DObject[],
  radius: number,
): { x: number; y: number; z: number } {
  if (!placement) return autoPlacement(objects, radius);

  switch (placement.kind) {
    case "point":
      return { x: placement.x, y: placement.y, z: placement.z };
    case "relation":
      return { x: 0, y: 0, z: 0 };
    case "anchor": {
      const anchor = placement.anchor;
      const existing = objects.filter((object) => object.objectKind === "primitive" || object.objectKind === "model");
      const index = existing.length;
      switch (anchor) {
        case "center": return { x: 0, y: 0, z: 0 };
        case "ground": return { x: 0, y: radius, z: 0 };
        case "left": return { x: -(3.4 + radius + index * 0.2), y: 0, z: 0 };
        case "right": return { x: 3.4 + radius + index * 0.2, y: 0, z: 0 };
        case "above": return { x: 0, y: 3 + radius + index * 0.4, z: 0 };
        case "below": return { x: 0, y: -(3 + radius + index * 0.4), z: 0 };
        case "front": return { x: 0, y: 0, z: 4 + radius + index * 0.2 };
        case "back": return { x: 0, y: 0, z: -(4 + radius + index * 0.2) };
        default: return { x: 0, y: 0, z: 0 };
      }
    }
    case "relative": {
      const target = findObject(objects, placement.relativeTo);
      if (!target) return { x: 0, y: 0, z: 0 };
      const gap = placement.gap ?? 0.6;
      switch (placement.side) {
        case "left": return { x: target.position.x - target.radius - gap - radius, y: target.position.y, z: target.position.z };
        case "right": return { x: target.position.x + target.radius + gap + radius, y: target.position.y, z: target.position.z };
        case "above": return { x: target.position.x, y: target.position.y + target.radius + gap + radius, z: target.position.z };
        case "below": return { x: target.position.x, y: target.position.y - target.radius - gap - radius, z: target.position.z };
        case "front": return { x: target.position.x, y: target.position.y, z: target.position.z - target.radius - gap - radius };
        case "back": return { x: target.position.x, y: target.position.y, z: target.position.z + target.radius + gap + radius };
        default: return { x: target.position.x, y: 0, z: target.position.z };
      }
    }
  }
  void scaleVec;
}

function flowPath(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, curve: FlowCurve): Array<{ x: number; y: number; z: number }> {
  if (curve === "straight") {
    return [
      { ...from },
      { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, z: (from.z + to.z) / 2 },
      { ...to },
    ];
  }
  // "arc" lifts the path so flows never cut straight through their own endpoints' geometry.
  const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
  const lift = Math.max(0.35, distance * 0.22);
  return [
    { ...from },
    {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2 + lift,
      z: (from.z + to.z) / 2,
    },
    { ...to },
  ];
}

// Applies ONE action at a step-relative start time. `tick` uniquely stamps animations so the
// renderer replays them exactly once (and re-runs when the same action is issued again).
export function applyVisual3DAction(
  scene: Visual3DScene,
  action: Visual3DAction,
  startAtMs = 0,
  tick = scene.tick + 1,
): Visual3DScene {
  if (scene.objects.length >= MAX_3D_OBJECTS && action.action === "create_3d_object") return scene;
  if (scene.flows.length >= MAX_3D_FLOWS && action.action === "animate_flow") return scene;
  if (scene.labels.length >= MAX_3D_LABELS && action.action === "show_3d_label") return scene;
  if (scene.annotations.length >= MAX_3D_ANNOTATIONS
    && (action.action === "show_vector" || action.action === "show_measurement" || action.action === "show_trajectory")
    && !findAnnotation(scene, action.id)) return scene;

  switch (action.action) {
    case "clear_3d_scene":
      return {
        objects: [],
        flows: [],
        labels: [],
        annotations: [],
        camera: {
          ...DEFAULT_CAMERA,
          position: { ...DEFAULT_CAMERA.position },
          target: { ...DEFAULT_CAMERA.target },
        },
        memory: emptyVisual3DMemory(),
        bounds: finalizeBounds({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }),
        tick,
      };

    case "remove_3d_object":
      if (!findObject(scene.objects, action.id)) return scene;
      return {
        ...scene,
        objects: scene.objects.filter((object) => object.id !== action.id).map((object) => object),
        // Flows and labels that referenced the removed object go with it, so nothing dangles.
        flows: scene.flows.filter((flow) => flow.fromId !== action.id && flow.toId !== action.id),
        labels: scene.labels.filter((label) => label.targetId !== action.id),
        tick,
      };

    case "create_3d_object": {
      if (findObject(scene.objects, action.id)) return scene;
      const assetId = action.asset ? resolveAssetId(action.asset) : undefined;
      if (action.type === "model" && !assetId) return scene;
      const asset = assetId ? getAsset(assetId) : undefined;
      const { uniform: scaleUniform, vec: scaleVec } = resolveScale({ ...action, asset: assetId } as Extract<Visual3DAction, { action: "create_3d_object" }>);
      const radius = radiusFor(action.type, scaleUniform, assetId);
      const position = action.position
        ? { x: action.position.x, y: action.position.y, z: action.position.z }
        : resolvePlacement3D(action.placement, scaleVec, scene.objects, radius);
      const objectKind: Visual3DObject["objectKind"] =
        action.type === "model" ? "model" :
        action.type === "text" ? "text" :
        action.type === "particle" ? "particle" :
        action.type === "line" || action.type === "tube" ? action.type :
        "primitive";
      const relation = action.placement?.kind === "relation" ? action.placement.relation : undefined;
      const part = action.part && asset && asset.semanticAnchors.includes(action.part) ? action.part : undefined;
      // A relation may name a PART of its first reference ("attached to the aorta"). Measure that
      // part now, from the asset's real geometry, and let the layout pass position against it.
      const relationAnchor = (() => {
        if (!relation?.anchorPart) return undefined;
        const host = findObject(scene.objects, relation.objects[0]);
        const hostAsset = host?.asset ? getAsset(host.asset) : undefined;
        const anchorPart = hostAsset?.anchors[relation.anchorPart];
        if (!host || !hostAsset || !anchorPart) return undefined;
        const hostScale = host.scale.x;
        return {
          offset: {
            x: anchorPart.center.x * hostScale,
            y: anchorPart.center.y * hostScale,
            z: anchorPart.center.z * hostScale,
          },
          radius: anchorPart.radius * hostScale,
        };
      })();
      const object: Visual3DObject = {
        id: action.id,
        objectKind,
        type: action.type,
        order: scene.objects.length,
        position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: scaleVec,
        radius,
        color: action.color ?? asset?.defaultColor ?? DEFAULT_COLOR,
        opacity: 1,
        visible: true,
        highlight: false,
        highlightColor: "#ffe66d",
        castShadow: true,
        receiveShadow: true,
        ...(action.type === "model" && assetId ? { asset: assetId } : {}),
        ...(part ? { part } : {}),
        ...(relation ? { relation: { ...relation, objects: [...relation.objects] } } : {}),
        ...(relationAnchor ? { relationAnchor } : {}),
        ...(asset && objectKind === "model" ? { anchors: asset.semanticAnchors } : {}),
        ...(action.text ? { text: action.text } : {}),
        ...(action.label ? { label: action.label } : {}),
        ...(action.animate ? { motion: motionOf(action.animate, startAtMs, tick, action.animate.kind) } : {}),
      };
      // "Create it already orbiting" is one atomic intent: the ring is placed and animated at once.
      if (action.orbit) {
        const center = findObject(scene.objects, action.orbit.center);
        if (center) {
          const orbitRadius = action.orbit.radius ?? Math.max(center.radius * 2.1, radius * 2.6);
          return patchObject(withObject(scene, object), object.id, tick, (placed) => ({
            ...placed,
            orbit: {
              centerId: center.id,
              radius: orbitRadius,
              speedDegPerSec: action.orbit?.speedDegPerSec ?? 12,
              phaseDeg: 0,
              tiltDeg: action.orbit?.tiltDeg ?? 0,
            },
            position: {
              x: center.position.x + orbitRadius,
              y: center.position.y,
              z: center.position.z,
            },
          }));
        }
      }
      return withObject(scene, object);
    }

    case "move_3d_object":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        position: { x: action.position.x, y: action.position.y, z: action.position.z },
        motion: motionOf(action.animate, startAtMs, tick, "move", {
          fromPosition: { ...object.position },
          toPosition: { x: action.position.x, y: action.position.y, z: action.position.z },
        }),
      }));

    case "rotate_3d_object":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        rotation: { x: action.rotation.x, y: action.rotation.y, z: action.rotation.z },
        motion: motionOf(action.animate, startAtMs, tick, "rotate", {
          fromRotation: { ...object.rotation },
          toRotation: { x: action.rotation.x, y: action.rotation.y, z: action.rotation.z },
        }),
      }));

    case "scale_3d_object": {
      const uniform = clampScale(toUniformScale(action.scale));
      const newScale = { x: uniform, y: uniform, z: uniform };
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        scale: newScale,
        radius: radiusFor(object.type, uniform, object.asset),
        motion: motionOf(action.animate, startAtMs, tick, "scale", {
          fromScale: { ...object.scale },
          toScale: newScale,
        }),
      }));
    }

    case "highlight_3d_object":
      return patchObject(scene, action.id, tick, (object) => ({
        ...object,
        highlight: true,
        highlightColor: action.color ?? object.color,
        ...(action.part ? { highlightPart: action.part } : {}),
        motion: motionOf(action.animate, startAtMs, tick, "highlight"),
      }));

    case "animate_orbit":
      return patchObject(scene, action.id, tick, (object) => {
        const center = findObject(scene.objects, action.center);
        if (!center) return object;
        const orbitRadius = action.radius ?? Math.max(center.radius * 2.1, object.radius * 2.6);
        return {
          ...object,
          orbit: {
            centerId: action.center,
            radius: orbitRadius,
            speedDegPerSec: action.speedDegPerSec ?? 12,
            phaseDeg: 0,
            tiltDeg: action.tiltDeg ?? 0,
          },
          // Orbit positions the object on its ring immediately so the first frame is already correct.
          position: {
            x: center.position.x + orbitRadius,
            y: center.position.y,
            z: center.position.z,
          },
        };
      });

    case "animate_spin":
      return patchObject(scene, action.id, tick, (object) => {
        const axis = action.axis ?? "y";
        const speed = action.speedDegPerSec ?? DEFAULT_SPIN_DEG_PER_SEC;
        // The motion carries the axis AND the signed speed, so the renderer spins exactly as fast as
        // the teacher asked (an rpm, a rotor, a slowly turning planet all differ).
        return {
          ...object,
          rotation: { ...object.rotation, [axis]: object.rotation[axis] + 360 },
          motion: {
            kind: "spin",
            durationMs: 0,
            delayMs: startAtMs,
            tick,
            spinAxis: axis,
            spinSpeedDegPerSec: speed,
          } as Object3DMotion,
        };
      });

    case "show_3d_label": {
      if (scene.labels.find((label) => label.id === action.id)) return scene;
      const targetObj = findObject(scene.objects, action.target);
      const asset = targetObj?.asset ? getAsset(targetObj.asset) : undefined;
      const anchor = action.part && asset?.anchors[action.part] && targetObj
        ? {
            x: targetObj.position.x + asset.anchors[action.part].center.x * targetObj.scale.x,
            y: targetObj.position.y + asset.anchors[action.part].center.y * targetObj.scale.x,
            z: targetObj.position.z + asset.anchors[action.part].center.z * targetObj.scale.x,
          }
        : targetObj
          ? { x: targetObj.position.x, y: targetObj.position.y + targetObj.radius * 0.9, z: targetObj.position.z }
          : { x: 0, y: 1, z: 0 };
      const label: Visual3DLabel = {
        id: action.id,
        targetId: action.target,
        text: action.text,
        ...(action.subtitle ? { subtitle: action.subtitle } : {}),
        ...(action.part ? { part: action.part } : {}),
        side: action.side ?? "right",
        leader: action.leader ?? true,
        position: action.position ?? anchor,
        color: action.color ?? "#f1f5f9",
        size: action.size ?? 1,
        visible: true,
      };
      return { ...scene, labels: [...scene.labels, label], tick };
    }

    case "hide_3d_label": {
      if (!scene.labels.find((label) => label.id === action.id)) return scene;
      return { ...scene, labels: scene.labels.filter((label) => label.id !== action.id), tick };
    }

    case "animate_flow": {
      if (findFlow(scene.flows, action.id)) return scene;
      const fromObj = findObject(scene.objects, action.from);
      const toObj = findObject(scene.objects, action.to);
      if (!fromObj || !toObj) return scene;
      const particleCount = clamp(action.particleCount ?? DEFAULT_PARTICLE_COUNT, MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT);
      if (scene.flows.reduce((sum, flow) => sum + flow.particleCount, 0) + particleCount > MAX_3D_PARTICLES_TOTAL) return scene;
      const curve: FlowCurve = action.curve ?? "arc";
      const flow: Visual3DFlow = {
        id: action.id,
        kind: "flow",
        fromId: action.from,
        toId: action.to,
        color: action.color ?? "#7fd4ff",
        particleCount,
        speed: action.speed ?? DEFAULT_FLOW_SPEED,
        loop: action.loop ?? true,
        size: clamp(action.size ?? Math.min(fromObj.radius, toObj.radius) * 0.28, 0.01, 1),
        trail: action.trail ?? true,
        shape: (action.shape ?? "sphere") as FlowShape,
        curve,
        durationMs: action.durationMs,
        pathPoints: flowPath(fromObj.position, toObj.position, curve),
        tick,
      };
      return { ...scene, flows: [...scene.flows, flow], tick };
    }

    case "animate_particle": {
      if (findFlow(scene.flows, action.id)) return scene;
      const particleCount = clamp(action.particleCount ?? DEFAULT_PARTICLE_COUNT, MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT);
      if (scene.flows.reduce((sum, flow) => sum + flow.particleCount, 0) + particleCount > MAX_3D_PARTICLES_TOTAL) return scene;
      const flow: Visual3DFlow = {
        id: action.id,
        kind: "particle",
        fromId: "",
        toId: "",
        color: action.color ?? "#7fd4ff",
        particleCount,
        speed: action.speed ?? DEFAULT_FLOW_SPEED,
        loop: action.loop ?? true,
        size: clamp(action.size ?? DEFAULT_FLOW_SIZE, 0.01, 1),
        trail: action.trail ?? true,
        shape: (action.shape ?? "sphere") as FlowShape,
        curve: (action.curve ?? "straight") as FlowCurve,
        durationMs: action.durationMs,
        pathPoints: action.path.map((point) => ({ ...point })),
        tick,
      };
      return { ...scene, flows: [...scene.flows, flow], tick };
    }

    case "animate_path": {
      if (findFlow(scene.flows, `${action.id}:travel`)) return scene;
      const mover = findObject(scene.objects, action.id);
      const target = findObject(scene.objects, action.to);
      if (!mover || !target) return scene;
      const particleCount = clamp(action.particleCount ?? 1, MIN_PARTICLE_COUNT, MAX_PARTICLE_COUNT);
      if (scene.flows.reduce((sum, flow) => sum + flow.particleCount, 0) + particleCount > MAX_3D_PARTICLES_TOTAL) return scene;
      const flow: Visual3DFlow = {
        id: `${action.id}:travel`,
        kind: "particle",
        fromId: action.id,
        toId: action.to,
        color: action.color ?? mover.color,
        particleCount,
        speed: action.speed ?? DEFAULT_FLOW_SPEED,
        loop: false,
        size: clamp(action.size ?? mover.radius * 0.35, 0.01, 1),
        trail: action.trail ?? true,
        shape: (action.shape ?? "glow") as FlowShape,
        curve: (action.curve ?? "arc") as FlowCurve,
        durationMs: action.durationMs,
        pathPoints: flowPath(mover.position, target.position, action.curve ?? "arc"),
        tick,
      };
      return { ...scene, flows: [...scene.flows, flow], tick };
    }

    // ---- generic part inspection ------------------------------------------------
    // Everything here is reversible and deterministic, and every one of them silently does nothing
    // when the named part does not exist in the real model hierarchy: a semantic part is never
    // faked. (A merged single-mesh GLB has no parts, so isolation simply is not available there.)

    case "isolate_part": {
      const object = findObject(scene.objects, action.id);
      if (!object) return scene;
      const asset = object.asset ? getAsset(object.asset) : undefined;
      if (!asset || !asset.semanticAnchors.includes(action.part)) return scene;
      const memory = cloneMemory(scene.memory);
      if (memory.isolatePart[object.id] === undefined) memory.isolatePart[object.id] = object.isolatePart ?? "";
      if (memory.hiddenParts[object.id] === undefined) memory.hiddenParts[object.id] = object.hiddenParts ? [...object.hiddenParts] : [];
      return patchObject({ ...scene, memory }, object.id, tick, (current) => ({ ...current, isolatePart: action.part }));
    }

    case "set_visibility": {
      const ids = action.ids ?? [];
      const part = action.part;
      if (ids.length === 0) return scene;
      let changed = false;
      const memory = cloneMemory(scene.memory);
      const objects = scene.objects.map((object) => {
        if (!ids.includes(object.id)) return object;
        let next = object;
        if (memory.visibility[object.id] === undefined) memory.visibility[object.id] = object.visible;
        if (object.visible !== action.visible) {
          changed = true;
          next = { ...next, visible: action.visible };
        }
        if (part) {
          // Only parts the model really has are hidden: an invented name teaches nothing.
          const asset = object.asset ? getAsset(object.asset) : undefined;
          if (asset && asset.semanticAnchors.includes(part)) {
            if (memory.hiddenParts[object.id] === undefined) memory.hiddenParts[object.id] = object.hiddenParts ? [...object.hiddenParts] : [];
            const current = new Set(object.hiddenParts ?? []);
            const nextHidden = action.visible
              ? [...current].filter((entry) => entry !== part)
              : [...new Set([...current, part])];
            if (nextHidden.length !== current.size) changed = true;
            next = { ...next, hiddenParts: nextHidden };
          }
        }
        return next;
      });
      if (!changed) return scene;
      return { ...scene, objects, memory, tick };
    }

    case "explode_group": {
      const object = findObject(scene.objects, action.id);
      if (!object) return scene;
      const strength = clamp(action.strength ?? DEFAULT_EXPLODE_STRENGTH, 0.05, 3);
      const offsets = explodeOffsetsFor(object, action.parts, strength);
      if (!offsets) return scene;
      const memory = cloneMemory(scene.memory);
      if (memory.explodeOffsets[object.id] === undefined) {
        memory.explodeOffsets[object.id] = Object.fromEntries(
          Object.entries(object.explodeOffsets ?? {}).map(([part, offset]) => [part, { ...offset }]),
        );
      }
      return patchObject({ ...scene, memory }, object.id, tick, (current) => ({
        ...current,
        explodeOffsets: offsets,
        motion: motionOf(action.animate, startAtMs, tick, "move"),
      }));
    }

    case "assemble_group": {
      const object = findObject(scene.objects, action.id);
      if (!object || !object.explodeOffsets) return scene;
      const memory = cloneMemory(scene.memory);
      const previous = memory.explodeOffsets[object.id];
      delete memory.explodeOffsets[object.id];
      return patchObject({ ...scene, memory }, object.id, tick, (current) => ({
        ...current,
        explodeOffsets: previous && Object.keys(previous).length > 0 ? previous : undefined,
        motion: motionOf(action.animate, startAtMs, tick, "move"),
      }));
    }

    case "restore_parts": {
      const targetIds = action.id ? [action.id] : scene.objects.map((object) => object.id);
      if (targetIds.length === 0) return scene;
      const memory = cloneMemory(scene.memory);
      const objects = scene.objects.map((object) => {
        if (!targetIds.includes(object.id)) return object;
        let next = object;
        const visible = memory.visibility[object.id];
        if (visible !== undefined) {
          next = { ...next, visible };
          delete memory.visibility[object.id];
        }
        const hidden = memory.hiddenParts[object.id];
        if (hidden !== undefined) {
          next = { ...next, hiddenParts: hidden.length > 0 ? [...hidden] : undefined };
          delete memory.hiddenParts[object.id];
        }
        const isolated = memory.isolatePart[object.id];
        if (isolated !== undefined) {
          next = { ...next, isolatePart: isolated.length > 0 ? isolated : undefined };
          delete memory.isolatePart[object.id];
        }
        const explode = memory.explodeOffsets[object.id];
        if (explode !== undefined) {
          next = { ...next, explodeOffsets: Object.keys(explode).length > 0 ? explode : undefined };
          delete memory.explodeOffsets[object.id];
        }
        const pulse = memory.pulse[object.id];
        if (pulse !== undefined) {
          next = { ...next, pulse };
          delete memory.pulse[object.id];
        }
        const oscillation = memory.oscillation[object.id];
        if (oscillation !== undefined) {
          next = { ...next, oscillation };
          delete memory.oscillation[object.id];
        }
        return next;
      });
      return { ...scene, objects, memory, tick };
    }

    case "pulse_3d_object": {
      const object = findObject(scene.objects, action.id);
      if (!object) return scene;
      const memory = cloneMemory(scene.memory);
      if (memory.pulse[object.id] === undefined && object.pulse) memory.pulse[object.id] = object.pulse;
      return patchObject({ ...scene, memory }, object.id, tick, (current) => ({
        ...current,
        pulse: {
          color: action.color ?? current.highlightColor ?? "#ffe66d",
          amplitude: clamp(action.amplitude ?? 0.18, 0.01, 1),
          periodMs: clamp(action.periodMs ?? DEFAULT_PULSE_PERIOD_MS, 120, 8000),
          durationMs: action.durationMs === undefined ? DEFAULT_PULSE_DURATION_MS : clamp(action.durationMs, 0, 30000),
        },
      }));
    }

    case "animate_oscillate": {
      const object = findObject(scene.objects, action.id);
      const pivot = findObject(scene.objects, action.pivot);
      if (!object || !pivot) return scene;
      const memory = cloneMemory(scene.memory);
      if (memory.oscillation[object.id] === undefined && object.oscillation) memory.oscillation[object.id] = object.oscillation;
      const amplitude = clamp(action.amplitudeDeg ?? 32, 1, 180);
      const periodMs = clamp(action.periodMs ?? DEFAULT_OSCILLATION_PERIOD_MS, 200, 20000);
      return patchObject({ ...scene, memory }, object.id, tick, (current) => ({
        ...current,
        oscillation: {
          pivotId: pivot.id,
          axis: action.axis ?? "z",
          amplitudeDeg: amplitude,
          periodMs,
        },
        motion: undefined,
      }));
    }

    // ---- generic educational overlays ------------------------------------------

    case "show_vector": {
      const base = resolveEndpoint(scene, action.from);
      if (!base) return scene;
      const directionLength = Math.hypot(action.direction.x, action.direction.y, action.direction.z);
      if (directionLength < 1e-6) return scene;
      const unit = { x: action.direction.x / directionLength, y: action.direction.y / directionLength, z: action.direction.z / directionLength };
      const length = clamp(action.length ?? DEFAULT_VECTOR_LENGTH, 0.01, 5000);
      const anchorObject = typeof action.from === "string" ? findObject(scene.objects, action.from) : undefined;
      const annotation: Visual3DAnnotation = {
        id: action.id,
        kind: "vector",
        from: base,
        to: { x: base.x + unit.x * length, y: base.y + unit.y * length, z: base.z + unit.z * length },
        points: [],
        color: action.color ?? "#ff9f1c",
        ...(action.text ? { text: action.text } : {}),
        ...(action.vectorKind ? { vectorKind: action.vectorKind } : {}),
        headSize: clamp(Math.min(length * 0.28, Math.max(anchorObject?.radius ?? 0.3, 0.12)), 0.04, 1.2),
        width: 0.035,
        visible: true,
        animate: false,
        speed: 1,
        tick,
      };
      return { ...scene, annotations: replaceAnnotation(scene.annotations, annotation), tick };
    }

    case "show_measurement": {
      const from = resolveEndpoint(scene, action.from);
      const to = resolveEndpoint(scene, action.to);
      if (!from || !to) return scene;
      if (Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z) < 1e-4) return scene;
      const annotation: Visual3DAnnotation = {
        id: action.id,
        kind: "measurement",
        from,
        to,
        points: [],
        color: action.color ?? "#4cc9f0",
        ...(action.text ? { text: action.text } : {}),
        headSize: 0.1,
        width: 0.022,
        visible: true,
        animate: false,
        speed: 1,
        tick,
      };
      return { ...scene, annotations: replaceAnnotation(scene.annotations, annotation), tick };
    }

    case "show_trajectory": {
      const points: Vec3[] = [];
      if (action.path && action.path.length > 0) {
        for (const point of action.path) points.push({ x: point.x, y: point.y, z: point.z });
      }
      if (action.through) {
        for (const id of action.through) {
          const resolved = resolveEndpoint(scene, id);
          if (resolved) points.push(resolved);
        }
      }
      if (points.length < 2) return scene;
      const annotation: Visual3DAnnotation = {
        id: action.id,
        kind: "trajectory",
        from: points[0],
        to: points[points.length - 1],
        points,
        color: action.color ?? "#ffd166",
        headSize: 0.14,
        width: 0.018,
        visible: true,
        animate: true,
        speed: clamp(action.speed ?? 1, 0.05, 20),
        ...(action.durationMs === undefined ? {} : { durationMs: clamp(action.durationMs, 200, 30000) }),
        tick,
      };
      return { ...scene, annotations: replaceAnnotation(scene.annotations, annotation), tick };
    }

    case "hide_annotation": {
      if (!findAnnotation(scene, action.id)) return scene;
      return { ...scene, annotations: scene.annotations.filter((annotation) => annotation.id !== action.id), tick };
    }

    case "follow_object": {
      const object = findObject(scene.objects, action.target);
      if (!object) return scene;
      const asset = object.asset ? getAsset(object.asset) : undefined;
      if (action.part && (!asset || !asset.semanticAnchors.includes(action.part))) return scene;
      const bounds = action.part
        ? partBounds(object, action.part, asset?.anchors)
        : sphereBounds(object.position, object.radius);
      // Following a part means framing it without ending up inside whatever encloses it (an organelle
      // inside a cell, a nucleus inside an atom): the camera is held outside the containing surface.
      const fit = fitOutsideOf(
        fitCameraToBounds(bounds, {
          fov: scene.camera.fov,
          fill: 0.6,
          direction: cameraDirection(scene.camera),
        }),
        enclosingOccluderRadius({ position: bounds.center, radius: bounds.radius }, cameraOccluders(scene.objects), Math.tan((scene.camera.fov * Math.PI) / 360)),
      );
      const memory = cloneMemory(scene.memory);
      // Remember the pose from BEFORE the first focus/follow, so return_camera has somewhere to go.
      if (!memory.camera) {
        memory.camera = {
          ...scene.camera,
          position: { ...scene.camera.position },
          target: { ...scene.camera.target },
          ...(scene.camera.follow ? { follow: { ...scene.camera.follow } } : {}),
        };
      }
      return {
        ...scene,
        memory,
        camera: {
          position: fit.position,
          target: fit.target,
          fov: scene.camera.fov,
          near: fit.near,
          far: fit.far,
          mode: "focused",
          focusedObjectId: object.id,
          follow: { targetId: object.id, ...(action.part ? { part: action.part } : {}) },
        },
        tick,
      };
    }

    case "return_camera": {
      const memory = cloneMemory(scene.memory);
      const previous = memory.camera;
      delete memory.camera;
      if (previous) {
        return {
          ...scene,
          memory,
          camera: { ...previous, position: { ...previous.position }, target: { ...previous.target }, follow: undefined },
          tick,
        };
      }
      // Nothing was focused yet: "return" simply means "show me the whole model again".
      const result = applyCameraAction(scene.camera, { action: "frame_camera" }, () => undefined, {
        objectCount: scene.objects.length,
        sceneBounds: sceneBounds(scene),
      });
      return { ...scene, camera: { ...result.camera, follow: undefined }, tick };
    }

    case "focus_camera":
    case "move_camera":
    case "zoom_camera":
    case "reset_camera":
    case "frame_camera": {
      // Every explicit camera move ends any tracking, and the first one is remembered so
      // return_camera can undo it.
      const memory = cloneMemory(scene.memory);
      if (!memory.camera) {
        memory.camera = {
          ...scene.camera,
          position: { ...scene.camera.position },
          target: { ...scene.camera.target },
          ...(scene.camera.follow ? { follow: { ...scene.camera.follow } } : {}),
        };
      }
      const result = applyCameraAction(
        scene.camera,
        action,
        (id: string, part?: string) => {
          const object = findObject(scene.objects, id);
          if (!object) return undefined;
          if (part) {
            const asset = object.asset ? getAsset(object.asset) : undefined;
            const bounds = partBounds(object, part, asset?.anchors);
            return { radius: bounds.radius, position: bounds.center };
          }
          return { radius: object.radius, position: { ...object.position } };
        },
        { objectCount: scene.objects.length, sceneBounds: sceneBounds(scene), occluders: cameraOccluders(scene.objects), contextBounds: partContextBounds(scene.objects, action) },
      );
      if (!result.animated) return scene;
      return { ...scene, memory, camera: { ...result.camera, follow: undefined }, tick };
    }

    case "wait":
      return scene;
  }
}

/** Re-issuing an annotation id replaces it in place, so a step can retune an arrow it already drew. */
function replaceAnnotation(annotations: Visual3DAnnotation[], annotation: Visual3DAnnotation): Visual3DAnnotation[] {
  const index = annotations.findIndex((entry) => entry.id === annotation.id);
  if (index < 0) return [...annotations, annotation];
  const next = [...annotations];
  next[index] = annotation;
  return next;
}

export function applyVisual3DActions(scene: Visual3DScene, actions: Visual3DAction[]): Visual3DScene {
  if (actions.length === 0) return scene;
  const timeline = buildTimeline(actions);
  const cameraDriven = Boolean(scene.camera.follow) || timeline.some((entry) =>
    ["focus_camera", "move_camera", "zoom_camera", "reset_camera", "frame_camera", "follow_object", "return_camera"].includes(entry.action.action),
  );

  let next = timeline.reduce(
    (current, entry) => applyVisual3DAction(current, entry.action, entry.startAtMs),
    scene,
  );

  // Resolve semantic relations once every object in the step exists, then keep radii consistent.
  next = { ...next, objects: resolveSceneLayout(next) };

  // Hidden objects must not stretch the frame: a hidden part is not part of what is being taught.
  // Orbiting objects are bounded by their whole reachable ring, not their position at this tick.
  const bounds = boundsFromSceneObjects(next.objects.filter((object) => object.visible));
  next = { ...next, bounds };

  // Universal auto-framing: when the teacher did not direct the camera this step, the camera is
  // re-framed around whatever the step made visible.
  if (!cameraDriven && next.objects.length > 0) {
    const fit = fitCameraToBounds(bounds, {
      fov: next.camera.fov,
      direction: cameraDirection(next.camera),
      fill: next.camera.mode === "focused" ? 0.62 : 0.7,
    });
    next = {
      ...next,
      camera: {
        ...next.camera,
        position: fit.position,
        target: fit.target,
        near: fit.near,
        far: fit.far,
        mode: next.camera.mode === "focused" ? "focused" : "default",
      },
    };
  }
  return next;
}

function cameraDirection(camera: { position: { x: number; y: number; z: number }; target: { x: number; y: number; z: number } }) {
  const direction = {
    x: camera.position.x - camera.target.x,
    y: camera.position.y - camera.target.y,
    z: camera.position.z - camera.target.z,
  };
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (length < 1e-4) return { x: 0.62, y: 0.42, z: 0.86 };
  return { x: direction.x / length, y: direction.y / length, z: direction.z / length };
}

/**
 * The solid surfaces a camera move must stay outside of. Only sizeable, visible primitives qualify:
 * a shell, a membrane, a container. This is what stops "look at the nucleus" from parking the camera
 * inside an atom's electron shell and filling the viewport with the inside of a sphere.
 */
function cameraOccluders(objects: Visual3DObject[]): CameraOccluder[] {
  return objects
    .filter((object) => object.visible !== false && Number.isFinite(object.radius) && object.radius > 0.05)
    .map((object) => ({ id: object.id, position: { ...object.position }, radius: object.radius }));
}

/**
 * The WHOLE object that owns the part being focused, so the camera can keep it in view.
 *
 * Only meaningful for a part: zooming into a model's own part while the model itself is gone from the
 * screen teaches "this shape" instead of "this part of this organ".
 */
function partContextBounds(
  objects: Visual3DObject[],
  action: object,
): { radius: number; position: Vec3 } | null {
  const target = (action as { target?: unknown }).target;
  const part = (action as { part?: unknown }).part;
  if (typeof part !== "string" || typeof target !== "string") return null;
  const owner = objects.find((object) => object.id === target);
  if (!owner || !Number.isFinite(owner.radius) || owner.radius <= 0) return null;
  return { radius: owner.radius, position: { ...owner.position } };
}

export { sphereBounds };
export type { Object3DRelation };