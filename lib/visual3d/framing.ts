// UNIVERSAL AUTO-FRAMING (pure logic, no Three.js).
//
// Nothing in this project uses a fixed camera distance. Every scene is measured (Box3-style bounds
// from world radii, or a real THREE.Box3 measured by the renderer for loaded models) and the camera
// is placed so the meaningful content occupies a target share of the viewport.
//
// The same maths works for a 0.2-unit water molecule and a 60-unit solar system, and it is unit
// tested without WebGL.
import { CameraState, MAX_CAMERA_DISTANCE, MIN_CAMERA_DISTANCE, MAX_FOV, MIN_FOV, SceneBounds, Vec3, Visual3DScene } from "./types";
import { clamp } from "../visual/geometry";

/** Share of the viewport the framed content should fill (the brief asks for 55–80%). */
export const TARGET_FILL = 0.7;
export const MIN_FILL = 0.55;
export const MAX_FILL = 0.8;

export const DEFAULT_VIEW_DIRECTION: Vec3 = { x: 0.62, y: 0.42, z: 0.86 };

export function emptyBounds(): SceneBounds {
  return {
    min: { x: 0, y: 0, z: 0 },
    max: { x: 0, y: 0, z: 0 },
    center: { x: 0, y: 0, z: 0 },
    size: { x: 0, y: 0, z: 0 },
    radius: 0,
  };
}

export function boundsFromObjects(
  objects: Array<{ position: Vec3; radius: number }>,
): SceneBounds {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  let count = 0;
  for (const object of objects) {
    if (!object || !Number.isFinite(object.radius) || object.radius <= 0) continue;
    count += 1;
    for (const axis of ["x", "y", "z"] as const) {
      const value = object.position[axis];
      min[axis] = Math.min(min[axis], value - object.radius);
      max[axis] = Math.max(max[axis], value + object.radius);
    }
  }
  if (count === 0) return emptyBounds();
  return finalizeBounds(min, max, objects);
}

/**
 * The sphere that actually encloses the content, centred on the bounding-box centre.
 *
 * Framing from the box DIAGONAL is safe but badly wasteful for round things: an atom, a cell or a
 * planet inscribed in its own bounding box needs a sphere 1.73x larger than the object, so the camera
 * pulled back by that much and the lesson ended up occupying ~58% of a 70% target — a 6.8-unit atom
 * rendered as a 39%-wide speck in the middle of a mostly empty stage. Measuring the real extent of
 * every object instead of its corners is both still a guaranteed enclosing sphere and a tight one.
 */
function enclosingRadius(center: Vec3, spheres: Array<{ position: Vec3; radius: number }>): number {
  let radius = 0;
  for (const sphere of spheres) {
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) continue;
    const offset = Math.hypot(
      sphere.position.x - center.x,
      sphere.position.y - center.y,
      sphere.position.z - center.z,
    );
    radius = Math.max(radius, offset + sphere.radius);
  }
  return radius;
}

export function finalizeBounds(
  min: Vec3,
  max: Vec3,
  spheres?: Array<{ position: Vec3; radius: number }>,
): SceneBounds {
  const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
  const size = { x: max.x - min.x, y: max.y - min.y, z: max.z - min.z };
  const measured = spheres ? enclosingRadius(center, spheres) : 0;
  const radius = measured > 0
    ? measured
    : Math.max(Math.hypot(size.x, size.y, size.z) / 2, Math.max(size.x, size.y, size.z) / 2, 0.0001);
  return { min, max, center, size, radius };
}

export function objectBounds(object: { position: Vec3; radius: number }): SceneBounds {
  const { position: p, radius } = object;
  return finalizeBounds(
    { x: p.x - radius, y: p.y - radius, z: p.z - radius },
    { x: p.x + radius, y: p.y + radius, z: p.z + radius },
  );
}

export function unionBounds(a: SceneBounds, b: SceneBounds): SceneBounds {
  if (a.radius <= 0) return b;
  if (b.radius <= 0) return a;
  return finalizeBounds(
    { x: Math.min(a.min.x, b.min.x), y: Math.min(a.min.y, b.min.y), z: Math.min(a.min.z, b.min.z) },
    { x: Math.max(a.max.x, b.max.x), y: Math.max(a.max.y, b.max.y), z: Math.max(a.max.z, b.max.z) },
  );
}

/**
 * Bounds for a set of objects, accounting for orbital motion.
 *
 * An orbiting object (a planet, an electron, a packet circling a router) sweeps an entire circle, but
 * its stored `position` is only the single point it occupies at the current tick. Framing that point
 * makes the orbit swing in and out of view and leaves the rest of the system off-camera, so an orbit
 * is bounded by the whole reachable ring: the orbit centre, widened by the orbit radius plus the
 * object's own size. This is what lets a solar system be framed as a system rather than as whatever
 * slice of it happened to be on screen.
 */
export function boundsFromSceneObjects(
  objects: Array<{
    id: string;
    position: Vec3;
    radius: number;
    orbit?: { centerId: string; radius: number };
    explodeOffsets?: Record<string, Vec3> | null;
    scale?: number | { x: number; y: number; z: number };
  }>,
): SceneBounds {
  const byId = new Map(objects.map((object) => [object.id, object]));
  return boundsFromObjects(
    objects.map((object) => {
      const orbit = object.orbit;
      // An EXPLODED model is much bigger than its own radius: the parts have been pushed out along
      // their offsets. Framing the unexploded radius is how "take the heart apart" left chambers
      // outside the viewport with their labels pointing at empty space — the camera has to be asked
      // about the extent the student can actually see, not the extent the object would have intact.
      const exploded = object.explodeOffsets
        ? explodedSpread(object.explodeOffsets) * uniformScale(object.scale)
        : 0;
      if (!orbit) return { position: object.position, radius: object.radius + exploded };
      // A missing centre falls back to the object's own position rather than dropping it from the frame.
      const center = byId.get(orbit.centerId)?.position;
      return { position: center ?? object.position, radius: Math.max(orbit.radius, 0) + object.radius + exploded };
    }),
  );
}

/** How far the furthest exploded part has been pushed, in normalized model units. */
function explodedSpread(offsets: Record<string, Vec3>): number {
  let spread = 0;
  for (const offset of Object.values(offsets)) {
    if (!offset) continue;
    spread = Math.max(spread, Math.hypot(offset.x, offset.y, offset.z));
  }
  return spread;
}

/** Exploded offsets are in normalized model units, so the object's own uniform scale still applies. */
function uniformScale(scale: number | { x: number; y: number; z: number } | undefined): number {
  if (typeof scale === "number") return Math.abs(scale);
  if (!scale) return 1;
  return Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
}

export function sceneBounds(scene: Pick<Visual3DScene, "objects">): SceneBounds {
  return boundsFromSceneObjects(scene.objects);
}

export function normalize3D(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length < 1e-6) return { ...DEFAULT_VIEW_DIRECTION };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

export function distance3D(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function lerp3D(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
}

export function midpoint3D(a: Vec3, b: Vec3): Vec3 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export type CameraFit = {
  position: Vec3;
  target: Vec3;
  fov: number;
  near: number;
  far: number;
  distance: number;
  fill: number;
};

/**
 * Fits a camera to bounds. The camera sits on a sphere around the bounds centre at the distance
 * where the bounds fill `fill` of the smaller viewport axis, then near/far are derived from the
 * scene depth so nothing is ever clipped and nothing wastes depth precision.
 *
 * The distance is the CLOSER of two conservative solutions, because neither alone is right:
 *
 *  - the bounding SPHERE of the box is exact for a round object (an atom, a cell, a planet — most of
 *    what this board teaches) but is 1.73x too far for anything elongated;
 *  - the box's eight CORNERS are exact for a box but 1.73x too far for anything round, because a
 *    sphere's corners are its axis points.
 *
 * Both guarantee nothing is clipped, so the smaller of the two is still guaranteed safe, and every
 * scene gets the tighter of the two. Solving only for corners pulled "look at the nucleus" so far back
 * that the nucleus became a speck; solving only for the sphere left a client/router/server row using a
 * fifth of the viewport.
 */
export function fitCameraToBounds(
  bounds: SceneBounds,
  options: {
    fov?: number;
    aspect?: number;
    fill?: number;
    direction?: Vec3;
    minRadius?: number;
  } = {},
): CameraFit {
  const fov = clamp(options.fov ?? 45, MIN_FOV, MAX_FOV);
  const aspect = Number.isFinite(options.aspect ?? 1) && (options.aspect ?? 1) > 0 ? options.aspect ?? 1 : 1;
  const fill = clamp(options.fill ?? TARGET_FILL, MIN_FILL, MAX_FILL);
  const radius = Math.max(bounds.radius, options.minRadius ?? 0.05);
  const halfFov = (fov * Math.PI) / 360;
  const horizontalFov = 2 * Math.atan(Math.tan(halfFov) * aspect);
  const tanV = Math.tan(halfFov) * fill;
  const tanH = Math.tan(horizontalFov / 2) * fill;
  const direction = normalize3D(options.direction ?? DEFAULT_VIEW_DIRECTION);
  // Camera basis: `direction` points from the target towards the camera, so a point `c` relative to
  // the target sits at depth (distance - c.direction) and lateral offsets c.right / c.up.
  const right = normalize3D({ x: direction.z, y: 0, z: -direction.x });
  const up = {
    x: direction.y * right.z - direction.z * right.y,
    y: direction.z * right.x - direction.x * right.z,
    z: direction.x * right.y - direction.y * right.x,
  };
  const halfX = Math.max(bounds.size.x, 0) / 2;
  const halfY = Math.max(bounds.size.y, 0) / 2;
  const halfZ = Math.max(bounds.size.z, 0) / 2;
  let required = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const cx = sx * halfX;
        const cy = sy * halfY;
        const cz = sz * halfZ;
        const depth = cx * direction.x + cy * direction.y + cz * direction.z;
        const lateral = Math.abs(cx * right.x + cy * right.y + cz * right.z);
        const vertical = Math.abs(cx * up.x + cy * up.y + cz * up.z);
        // Never behind the camera, and the corner must sit inside both halves of the frustum.
        const nearest = -depth + Math.max(lateral / tanH, vertical / tanV);
        required = Math.max(required, nearest);
      }
    }
  }
  const fitted = required > 1e-4 ? required : radius / (fill * Math.tan(halfFov));
  const sphereFit = radius / (fill * Math.tan(halfFov));
  const distance = clamp(Math.min(fitted, sphereFit), MIN_CAMERA_DISTANCE, MAX_CAMERA_DISTANCE);
  const position = {
    x: bounds.center.x + direction.x * distance,
    y: bounds.center.y + direction.y * distance,
    z: bounds.center.z + direction.z * distance,
  };
  const near = Math.max(0.01, distance - radius * 2.2);
  const far = distance + radius * 3 + Math.max(radius * 4, 50);
  return { position, target: { ...bounds.center }, fov, near, far, distance, fill };
}

/** Frames a whole scene. */
export function fitCameraToScene(
  scene: Pick<Visual3DScene, "objects" | "camera">,
  options: { aspect?: number; fill?: number; direction?: Vec3 } = {},
): CameraFit {
  const bounds = sceneBounds(scene);
  const direction = options.direction ?? directionFromCamera(scene.camera.position, scene.camera.target);
  return fitCameraToBounds(bounds, {
    fov: scene.camera.fov,
    aspect: options.aspect,
    fill: options.fill,
    direction,
  });
}

/** Frames a single object (or one named part of a model). */
export function fitCameraToObject(
  bounds: SceneBounds,
  camera: CameraState,
  options: { aspect?: number; fill?: number; direction?: Vec3; minRadius?: number } = {},
): CameraFit {
  const direction = options.direction ?? directionFromCamera(camera.position, camera.target);
  return fitCameraToBounds(bounds, {
    fov: camera.fov,
    aspect: options.aspect,
    fill: options.fill ?? 0.68,
    direction,
    minRadius: options.minRadius,
  });
}

function directionFromCamera(position: Vec3, target: Vec3): Vec3 {
  const direction = { x: position.x - target.x, y: position.y - target.y, z: position.z - target.z };
  if (Math.hypot(direction.x, direction.y, direction.z) < 1e-4) return { ...DEFAULT_VIEW_DIRECTION };
  return normalize3D(direction);
}

/** A pleasing 3/4 view that keeps objects of equal size from overlapping in screen space. */
export function autoDirection(count: number): Vec3 {
  const angle = count * 0.9;
  return normalize3D({
    x: Math.cos(angle) * 0.8 + 0.35,
    y: 0.42,
    z: Math.sin(angle) * 0.8 + 0.9,
  });
}

/**
 * Smoothly interpolates a camera towards a target pose. Teacher camera actions and automatic
 * framing both go through this, so the camera never teleports between objects.
 */
export function blendCamera(from: CameraState, to: CameraState, t: number): CameraState {
  const clamped = clamp(t, 0, 1);
  // Smoothstep keeps the start and end gentle so a long flight still reads as one motion.
  const eased = clamped * clamped * (3 - 2 * clamped);
  return {
    position: lerp3D(from.position, to.position, eased),
    target: lerp3D(from.target, to.target, eased),
    fov: from.fov + (to.fov - from.fov) * eased,
    near: to.near,
    far: to.far,
    mode: to.mode,
    ...(to.focusedObjectId ? { focusedObjectId: to.focusedObjectId } : {}),
  };
}