// GENERAL-PURPOSE 3D VISUAL ACTION SCHEMA.
//
// This is the 3D counterpart to lib/visual/types.ts. The teaching model NEVER emits React/JSX/WebGL/
// shader code — it emits these semantic actions only. A validated action stream is reduced by a pure
// engine (lib/visual3d/engine.ts) into a deterministic Visual3DScene, which a React Three Fiber
// renderer (components/visual3d/) draws. Topics are NOT special-cased: a human heart, a DNA helix, a
// solar system, a water molecule, a pendulum, a TCP handshake and a cylinder of revolution all use
// the SAME object types, relations, animations and validation.

export const IS_PROCEDURAL_FALLBACK = "__procedural__";

// ---- Bounded numeric limits (validation rejects anything outside these) ----
export const MIN_SCALE = 0.001;
export const MAX_SCALE = 1000;
export const MIN_PARTICLE_COUNT = 1;
export const MAX_PARTICLE_COUNT = 400;
export const MAX_3D_PARTICLES_TOTAL = 1600;
export const MIN_ANIMATION_MS = 0;
export const MAX_ANIMATION_MS = 8000;
export const MAX_3D_ACTIONS_PER_STEP = 40;
export const MAX_3D_OBJECTS = 60;
export const MAX_3D_FLOWS = 24;
export const MAX_3D_LABELS = 36;
export const MAX_3D_ANNOTATIONS = 24;
export const MAX_3D_OBJECT_TEXT = 240;
export const MAX_LABEL_LENGTH = 120;
export const MIN_FOV = 10;
export const MAX_FOV = 120;
export const MIN_CAMERA_DISTANCE = 0.5;
export const MAX_CAMERA_DISTANCE = 5000;

export const OBJECT3D_TYPES = [
  "sphere", "box", "cylinder", "cone", "torus", "plane", "arrow", "particle", "tube", "line",
  "molecule", "crystal", "text", "model",
] as const;
export type Object3DType = typeof OBJECT3D_TYPES[number];

export const ASSET_BACKED_TYPES = ["model"] as const;
export type AssetBackedType = typeof ASSET_BACKED_TYPES[number];

export const CAMERA_ANCHORS = ["default", "center", "left", "right", "above", "below", "front", "back"] as const;
export type CameraAnchor = typeof CAMERA_ANCHORS[number];

export const PLACEMENT_ANCHORS_3D = ["center", "ground", "left", "right", "above", "below", "front", "back"] as const;
export type PlacementAnchor3D = (typeof PLACEMENT_ANCHORS_3D)[number];

export const RELATIVE_SIDES_3D = ["left", "right", "above", "below", "front", "back"] as const;
export type RelativeSide3D = (typeof RELATIVE_SIDES_3D)[number];

// Semantic spatial relations. The AI says HOW two things relate; the layout engine resolves the
// coordinates. There is no topic-specific branch anywhere in this list.
export const RELATION_TYPES_3D = [
  "left_of", "right_of", "above", "below", "in_front_of", "behind",
  "inside", "around", "between", "near", "connected_to", "orbiting", "attached_to", "along_path",
] as const;
export type Object3DRelationType = (typeof RELATION_TYPES_3D)[number];

// Relations that take two reference objects.
export const PAIR_RELATIONS_3D: ReadonlySet<string> = new Set(["between", "along_path"]);
// Relations that orbit / surround a reference object.
export const ORBIT_RELATIONS_3D: ReadonlySet<string> = new Set(["orbiting", "around"]);

export const OBJECT3D_ANIMATION_KINDS = ["move", "rotate", "scale", "highlight", "appear", "disappear"] as const;
export type Object3DAnimationKind = (typeof OBJECT3D_ANIMATION_KINDS)[number];

export const CAMERA_ANIMATION_KINDS = ["focus", "move", "zoom", "reset"] as const;
export type CameraAnimationKind = (typeof CAMERA_ANIMATION_KINDS)[number];

export const FLOW_KINDS = ["flow", "particle"] as const;
export type FlowKind = (typeof FLOW_KINDS)[number];

export const FLOW_SHAPES = ["sphere", "cube", "drop", "arrow", "glow"] as const;
export type FlowShape = (typeof FLOW_SHAPES)[number];

export const FLOW_CURVES = ["straight", "arc", "loop"] as const;
export type FlowCurve = (typeof FLOW_CURVES)[number];

export const CAMERA_MODES = ["default", "focused", "manual"] as const;
export type CameraMode = (typeof CAMERA_MODES)[number];

export const LABEL_SIDES = ["left", "right", "above", "below"] as const;
export type LabelSide = (typeof LABEL_SIDES)[number];

// Educational overlays that are not objects: a direction with a magnitude, a dimension between two
// things, or the path something travels along. All three are generic — a force arrow, a pendulum
// amplitude and a projectile arc are the same three primitives with different endpoints.
export const ANNOTATION_KINDS = ["vector", "measurement", "trajectory"] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

// What a vector MEANS educationally. It only changes the wording on the label, never the maths.
export const VECTOR_KINDS = ["force", "velocity", "acceleration", "field"] as const;
export type VectorKind = (typeof VECTOR_KINDS)[number];

export const OSCILLATION_AXES = ["x", "y", "z"] as const;
export type OscillationAxis = (typeof OSCILLATION_AXES)[number];

// ---- 3D primitives ----

export type Vec3 = { x: number; y: number; z: number };

export type Vec3Scale = number | Vec3;

export type Vec3Rotation = Vec3;

// A semantic spatial relationship to one or two existing objects.
export type Object3DRelation = {
  type: Object3DRelationType;
  objects: string[];
  /** Multiplier on the automatic gap (0.4 … 4). Keep unset unless the relation needs room. */
  gap?: number;
  /** Extra world-space offset applied along the relation's perpendicular axis. */
  offset?: number;
  /** Restricts a relation to one axis (left_of is X by default, above is Y, in_front_of is Z). */
  axis?: "x" | "y" | "z";
  /**
   * Named part of the FIRST referenced object the relation is resolved against
   * ("inside the cell wall", "attached to the aorta"). The engine measures the part from the asset
   * anchors and the layout pass positions the object relative to that part, not the object centre.
   */
  anchorPart?: string;
};

export type Object3DPlacement =
  | { kind: "anchor"; anchor: PlacementAnchor3D }
  | { kind: "relative"; relativeTo: string; side: RelativeSide3D; gap?: number }
  | { kind: "relation"; relation: Object3DRelation }
  | { kind: "point"; x: number; y: number; z: number };

export type Object3DAnimation = {
  kind: Object3DAnimationKind;
  durationMs: number;
  delayMs: number;
};

export type Object3DFlowAnimation = {
  kind: "flow" | "pulse" | "travel";
  durationMs: number;
  delayMs: number;
};

// A trusted asset reference (e.g. "biology/heart", "earth/globe").
// The AI provides ONLY the asset ID (or an alias); the local registry resolves it to a model path,
// a documented fallback primitive and framing metadata.
export type AssetRef = string;

// ---- Resolved 3D scene (renderer input; fully deterministic for a given action sequence) ----

export type Visual3DObjectKind = "primitive" | "model" | "text" | "particle" | "line" | "tube";

export type Visual3DObject = {
  id: string;
  objectKind: "primitive" | "model" | "text" | "particle" | "line" | "tube";
  type: Object3DType;
  order: number;
  position: Vec3;
  rotation: Vec3Rotation;
  scale: Vec3;
  /** World-space bounding radius, derived from the asset metadata or the primitive geometry. */
  radius: number;
  color: string;
  opacity: number;
  visible: boolean;
  asset?: AssetRef;
  /** Optional named part inside a model asset ("left_ventricle", "nucleus", "electron_shell_2"). */
  part?: string;
  /** Semantic relation kept on the object so layout can be re-resolved when its anchors move. */
  relation?: Object3DRelation;
  /** World offset + radius of the named part this object's relation is resolved against. */
  relationAnchor?: { offset: Vec3; radius: number };
  /** Named parts available on this model asset (used by validation and diagnostics). */
  anchors?: string[];
  /** Orbital motion (planets, electrons, packets circling an object). */
  orbit?: Object3DOrbit;
  text?: string;
  label?: string;
  highlight: boolean;
  highlightColor: string;
  /** Optional named part currently highlighted (part-level highlighting inside a model). */
  highlightPart?: string;
  castShadow: boolean;
  receiveShadow: boolean;
  motion?: Object3DMotion;
  /** Swing around a pivot object instead of revolving around it. */
  oscillation?: Object3DOscillation;
  /** Temporary pulse + glow (the generic "look here" effect). */
  pulse?: Object3DPulse;
  /** Only this named part of the model renders; every other part is hidden (isolate_part). */
  isolatePart?: string;
  /** Named parts of the model that are hidden right now (set_visibility). */
  hiddenParts?: string[];
  /**
   * Deterministic per-part outward offsets in normalized model units, used for an exploded view.
   * The original transforms are never mutated: assembling simply drops this map.
   */
  explodeOffsets?: Record<string, Vec3>;
};

export type Object3DOrbit = {
  centerId: string;
  radius: number;
  speedDegPerSec: number;
  phaseDeg: number;
  /** Tilt of the orbital plane in degrees, so inclined orbits read correctly. */
  tiltDeg: number;
};

/**
 * Swing back and forth around a pivot object (a pendulum bob, a swinging rod, a recoiling part).
 * The generic alternative to a full orbit when the motion oscillates instead of revolving.
 */
export type Object3DOscillation = {
  pivotId: string;
  axis: OscillationAxis;
  amplitudeDeg: number;
  periodMs: number;
};

/** A temporary attention effect: the part pulses in scale and glows for a while. */
export type Object3DPulse = {
  color: string;
  /** Peak extra scale, e.g. 0.18 = 18% larger at the peak of the pulse. */
  amplitude: number;
  periodMs: number;
  /** 0 keeps pulsing until another action replaces or restores it. */
  durationMs: number;
};

export type Object3DMotion = {
  kind: Object3DAnimationKind | "orbit" | "spin";
  durationMs: number;
  delayMs: number;
  tick: number;
  fromPosition?: Vec3;
  toPosition?: Vec3;
  fromRotation?: Vec3Rotation;
  toRotation?: Vec3Rotation;
  fromScale?: Vec3;
  toScale?: Vec3;
  /** Axis the object spins around (animate_spin). Defaults to "y". */
  spinAxis?: OscillationAxis;
  /** Signed angular speed of animate_spin, in degrees per second. */
  spinSpeedDegPerSec?: number;
};

export type Visual3DFlow = {
  id: string;
  kind: FlowKind;
  fromId: string;
  toId: string;
  color: string;
  particleCount: number;
  speed: number;
  loop: boolean;
  size: number;
  trail: boolean;
  shape: FlowShape;
  curve: FlowCurve;
  durationMs?: number;
  pathPoints: Vec3[];
  tick: number;
};

export type Visual3DLabel = {
  id: string;
  targetId: string;
  text: string;
  /** Optional second line (a short explanation in the teaching language). */
  subtitle?: string;
  /** Named part of the target model the label points at ("nucleus", "left_ventricle"). */
  part?: string;
  /** Which side of the object the label prefers; overlap resolution may still move it. */
  side: LabelSide;
  leader: boolean;
  position: Vec3;
  color: string;
  size: number;
  visible: boolean;
};

export type CameraState = {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
  mode: CameraMode;
  focusedObjectId?: string;
  /** When set, the camera tracks this object (or one of its parts) every frame. */
  follow?: { targetId: string; part?: string };
};

/**
 * Everything an inspection action changed, so it can be undone exactly.
 *
 * `isolate_part`, `set_visibility`, `explode_group` and `pulse_3d_object` all record the previous
 * state here first, which is what makes `restore_parts` a single deterministic inverse. It is plain
 * JSON because the whole scene (memory included) round-trips through the Ask request.
 */
export type Visual3DSceneMemory = {
  /** objectId -> visible flag before the last hide. */
  visibility: Record<string, boolean>;
  /** objectId -> named parts that were hidden. */
  hiddenParts: Record<string, string[]>;
  /** objectId -> the part that was isolated (isolated parts are recorded in hiddenParts too). */
  isolatePart: Record<string, string>;
  /** objectId -> per-part offsets before exploding. */
  explodeOffsets: Record<string, Record<string, Vec3>>;
  /** objectId -> pulse parameters that were replaced. */
  pulse: Record<string, Object3DPulse>;
  /** objectId -> swing-around-a-pivot parameters that were replaced. */
  oscillation: Record<string, Object3DOscillation>;
  /** The camera pose from before the first focus/follow, restored by return_camera. */
  camera?: CameraState;
};

export const EMPTY_3D_MEMORY: Visual3DSceneMemory = {
  visibility: {},
  hiddenParts: {},
  isolatePart: {},
  explodeOffsets: {},
  pulse: {},
  oscillation: {},
};

/**
 * An educational overlay drawn in the 3D scene rather than the DOM: a vector arrow (force,
 * velocity, acceleration, field line), a dimension between two things (radius, height, amplitude)
 * or the trajectory something follows (projectile arc, signal path, orbit trace).
 */
export type Visual3DAnnotation = {
  id: string;
  kind: AnnotationKind;
  /** Start point: the arrow's tail / the measurement's first end / the trajectory's first point. */
  from: Vec3;
  /** End point: the arrow's head / the measurement's second end / the trajectory's last point. */
  to: Vec3;
  /** Intermediate trajectory points (empty for vectors and measurements). */
  points: Vec3[];
  color: string;
  /** Short teaching text drawn with the overlay (e.g. "mg = 20 N", "60 km/h", "amplitude"). */
  text?: string;
  /** What a vector represents, used only for wording. */
  vectorKind?: VectorKind;
  /** Arrow head size relative to the drawn length. */
  headSize: number;
  /** Shaft thickness in world units. */
  width: number;
  visible: boolean;
  /** Travels along its own path (a moving marker on a trajectory). */
  animate: boolean;
  speed: number;
  durationMs?: number;
  tick: number;
};

export type SceneBounds = {
  min: Vec3;
  max: Vec3;
  center: Vec3;
  size: Vec3;
  radius: number;
};

export type Visual3DScene = {
  objects: Visual3DObject[];
  flows: Visual3DFlow[];
  labels: Visual3DLabel[];
  /** Force / velocity / measurement / trajectory overlays. */
  annotations: Visual3DAnnotation[];
  camera: CameraState;
  /** Measured scene bounds used for automatic framing and label placement. */
  bounds: SceneBounds;
  /** Undo state for part isolation, visibility, explode and pulse actions. */
  memory: Visual3DSceneMemory;
  tick: number;
  /** Identifies the lesson the scene belongs to (used to reset renderer state between lessons). */
  lessonId?: string;
};

export const DEFAULT_CAMERA: CameraState = {
  position: { x: 6, y: 4, z: 8 },
  target: { x: 0, y: 0, z: 0 },
  fov: 45,
  near: 0.1,
  far: 400,
  mode: "default",
};

export const EMPTY_BOUNDS: SceneBounds = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  center: { x: 0, y: 0, z: 0 },
  size: { x: 0, y: 0, z: 0 },
  radius: 0,
};

export const emptyVisual3DScene = (): Visual3DScene => ({
  objects: [],
  flows: [],
  labels: [],
  annotations: [],
  camera: {
    ...DEFAULT_CAMERA,
    position: { ...DEFAULT_CAMERA.position },
    target: { ...DEFAULT_CAMERA.target },
  },
  bounds: {
    min: { ...EMPTY_BOUNDS.min },
    max: { ...EMPTY_BOUNDS.max },
    center: { ...EMPTY_BOUNDS.center },
    size: { ...EMPTY_BOUNDS.size },
    radius: 0,
  },
  memory: {
    visibility: {},
    hiddenParts: {},
    isolatePart: {},
    explodeOffsets: {},
    pulse: {},
    oscillation: {},
  },
  tick: 0,
});

export type Visual3DApplyResult = {
  scene: Visual3DScene;
  applied: number;
  skipped: number;
};

// Result of running the 3D timeline: actions with resolved start times.
export type TimedVisual3DAction = {
  action: Visual3DAction;
  startAtMs: number;
};

export type Visual3DAction =
  | {
    action: "create_3d_object";
    id: string;
    type: Object3DType;
    placement?: Object3DPlacement;
    position?: Vec3;
    scale?: Vec3Scale;
    color?: string;
    asset?: AssetRef;
    /** Named part of the asset to isolate ("left_ventricle"). */
    part?: string;
    text?: string;
    label?: string;
    /**
     * Create the object already orbiting an existing one (planets, electrons, satellites). The
     * radius is derived from the asset/center when omitted, so the ring is always sensible.
     */
    orbit?: { center: string; radius?: number; speedDegPerSec?: number; tiltDeg?: number };
    animate?: Object3DAnimation;
  }
  | { action: "remove_3d_object"; id: string }
  | { action: "move_3d_object"; id: string; position: Vec3; animate?: Object3DAnimation }
  | { action: "rotate_3d_object"; id: string; rotation: Vec3Rotation; animate?: Object3DAnimation }
  | { action: "scale_3d_object"; id: string; scale: Vec3Scale; animate?: Object3DAnimation }
  | { action: "highlight_3d_object"; id: string; color?: string; part?: string; animate?: Object3DAnimation }
  | { action: "focus_camera"; target: string; part?: string; animate?: Object3DAnimation }
  | { action: "move_camera"; position: Vec3; target?: Vec3; animate?: Object3DAnimation }
  | { action: "zoom_camera"; fov: number; animate?: Object3DAnimation }
  | { action: "reset_camera"; animate?: Object3DAnimation }
  | { action: "frame_camera"; target?: string; animate?: Object3DAnimation }
  | {
    action: "animate_flow";
    id: string;
    from: string;
    to: string;
    color?: string;
    particleCount?: number;
    speed?: number;
    loop?: boolean;
    durationMs?: number;
    size?: number;
    trail?: boolean;
    shape?: FlowShape;
    curve?: FlowCurve;
    animate?: Object3DFlowAnimation;
  }
  | {
    action: "animate_particle";
    id: string;
    path: Vec3[];
    color?: string;
    particleCount?: number;
    speed?: number;
    loop?: boolean;
    durationMs?: number;
    size?: number;
    trail?: boolean;
    shape?: FlowShape;
    curve?: FlowCurve;
    animate?: Object3DFlowAnimation;
  }
  | {
    action: "animate_path";
    id: string;
    to: string;
    color?: string;
    particleCount?: number;
    speed?: number;
    durationMs?: number;
    size?: number;
    trail?: boolean;
    shape?: FlowShape;
    curve?: FlowCurve;
    animate?: Object3DAnimation;
  }
  | {
    action: "show_3d_label";
    id: string;
    target: string;
    text: string;
    subtitle?: string;
    side?: LabelSide;
    leader?: boolean;
    part?: string;
    position?: Vec3;
    color?: string;
    size?: number;
  }
  | { action: "hide_3d_label"; id: string }
  | { action: "animate_orbit"; id: string; center: string; radius?: number; speedDegPerSec?: number; tiltDeg?: number }
  | { action: "animate_spin"; id: string; axis?: "x" | "y" | "z"; speedDegPerSec?: number }
  // ---- generic inspection actions (no topic-specific behaviour anywhere) ----
  // Shows one named semantic part of a model and hides the model's other parts. Reversible.
  | { action: "isolate_part"; id: string; part: string }
  // Undoes isolate_part / set_visibility / explode_group / pulse for one object, or for all of them.
  | { action: "restore_parts"; id?: string }
  // Pushes named parts outward from the model centre by deterministic amounts. Reversible.
  | { action: "explode_group"; id: string; parts?: string[]; strength?: number; animate?: Object3DAnimation }
  | { action: "assemble_group"; id: string; animate?: Object3DAnimation }
  // Shows/hides whole objects and/or one named part of a model.
  | { action: "set_visibility"; id?: string; ids?: string[]; part?: string; visible: boolean }
  // Temporary pulse + glow so the eye lands on the right part.
  | { action: "pulse_3d_object"; id: string; color?: string; amplitude?: number; periodMs?: number; durationMs?: number }
  // Swing around a pivot object (a pendulum, a rocker, a swinging rod).
  | { action: "animate_oscillate"; id: string; pivot: string; axis?: "x" | "y" | "z"; amplitudeDeg?: number; periodMs?: number }
  // Camera tracks a moving object or one of its named parts.
  | { action: "follow_object"; target: string; part?: string; animate?: Object3DAnimation }
  // Returns to the camera pose from before the first focus/follow of this lesson.
  | { action: "return_camera"; animate?: Object3DAnimation }
  // A directed arrow: force, velocity, acceleration or field direction.
  | { action: "show_vector"; id: string; from: string | Vec3; direction: Vec3; length?: number; vectorKind?: VectorKind; color?: string; text?: string }
  // A dimension between two objects or points (radius, height, amplitude, distance).
  | { action: "show_measurement"; id: string; from: string | Vec3; to: string | Vec3; text?: string; color?: string }
  // The path something travels along: a projectile arc, a signal path, an orbit trace.
  | { action: "show_trajectory"; id: string; path?: Vec3[]; through?: string[]; color?: string; speed?: number; durationMs?: number }
  | { action: "hide_annotation"; id: string }
  | { action: "wait"; durationMs: number }
  | { action: "clear_3d_scene" };

export const VISUAL3D_ACTION_TYPES = [
  "create_3d_object", "remove_3d_object", "move_3d_object", "rotate_3d_object", "scale_3d_object",
  "highlight_3d_object", "focus_camera", "move_camera", "zoom_camera", "reset_camera", "frame_camera",
  "animate_flow", "animate_particle", "animate_path",
  "show_3d_label", "hide_3d_label",
  "animate_orbit", "animate_spin",
  "isolate_part", "restore_parts", "explode_group", "assemble_group", "set_visibility",
  "pulse_3d_object", "animate_oscillate",
  "follow_object", "return_camera",
  "show_vector", "show_measurement", "show_trajectory", "hide_annotation",
  "wait", "clear_3d_scene",
] as const;
export type Visual3DActionType = (typeof VISUAL3D_ACTION_TYPES)[number];