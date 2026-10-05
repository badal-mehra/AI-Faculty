// TEACHER-DIRECTED CAMERA (pure logic, no Three.js).
//
// Camera movement is part of teaching: "let's look at the nucleus", "now compare it with the cell
// membrane", "zoom inside the mitochondrion". These actions are generic — they never know what an
// object represents — and they are resolved against MEASURED bounds, so focusing a water molecule
// and focusing a skeleton both work.
import { clamp } from "../visual/geometry";
import {
  CameraState, DEFAULT_CAMERA, MAX_FOV, MIN_FOV, SceneBounds, Vec3, Visual3DAction, Visual3DObject,
} from "./types";
import {
  CameraFit, autoDirection, distance3D, fitCameraToBounds, lerp3D, midpoint3D, normalize3D,
} from "./framing";

export const CAMERA_MOVE_SPEED = 2.6;

export { distance3D, lerp3D, midpoint3D };

export function clampVec3(v: Vec3, min: number, max: number): Vec3 {
  return { x: clamp(v.x, min, max), y: clamp(v.y, min, max), z: clamp(v.z, min, max) };
}

export function defaultCamera(): CameraState {
  return {
    ...DEFAULT_CAMERA,
    position: { ...DEFAULT_CAMERA.position },
    target: { ...DEFAULT_CAMERA.target },
  };
}

export type CameraActionResult = { camera: CameraState; animated: boolean };

/** A resolved focusable: where it is and how big it is. */
export type CameraBoundsResolver = (id: string, part?: string) => { radius: number; position: Vec3 } | undefined;

/** Everything the camera must not end up inside of, with the radius it has to clear. */
export type CameraOccluder = { id: string; position: Vec3; radius: number };

/**
 * How much of the CONTAINING object must stay on screen when a camera zooms into one of its parts.
 *
 * "Now the left ventricle" should tighten the view, not teleport inside a wall of red. Framing a small
 * part on its own is what left a heart filling four screens with the vena cava off the top edge: the
 * student can no longer see WHICH chamber of WHICH organ, which is the only reason the part mattered.
 * Half the parent still visible keeps the location, and the part still reads as the subject.
 */
const CONTEXT_FILL = 0.5;

/** Extra clearance so the camera sits outside an enclosing surface rather than grazing its skin. */
const OCCLUDER_CLEARANCE = 0.55;

/**
 * How far back the camera has to sit so a focus target is legible in the SURROUNDING scene, not just
 * outside it.
 *
 * "Look at the nucleus" means framing a 1.6-unit sphere that sits inside a 3.4-unit electron shell.
 * Two constraints apply, and satisfying only the first is what produced a 552%-of-viewport close-up:
 *
 *  1. COLLISION — the camera must be outside the shell, or it ends up between the shell's surface and
 *     its far side and the whole viewport fills with the inside of a sphere.
 *  2. FRAMING — and the shell must actually FIT in the frame. A 3.4-unit shell closer than
 *     radius / sin(halfFov) ≈ 8.9 units overflows the viewport on every side, so even drawn as glass it
 *     is a wall rather than a container, and the nucleus is a speck behind it.
 *
 * Both are the same instinct a teacher has: step back far enough to see the nucleus *inside* its
 * shell, and far enough that the shell is recognisably a shell.
 */
export function enclosingOccluderRadius(
  target: { position: Vec3; radius: number },
  occluders: CameraOccluder[],
  halfFovTan = Math.tan(Math.PI / 8),
): number {
  let distance = 0;
  // sin(halfFov) from the tangent, without a second trig call: tan is already the fov's slope, and
  // sin = tan / sqrt(1 + tan^2).
  const sinHalfFov = halfFovTan / Math.sqrt(1 + halfFovTan * halfFovTan);
  for (const occluder of occluders) {
    if (!Number.isFinite(occluder.radius) || occluder.radius <= target.radius * 1.05) continue;
    const gap = distance3D(occluder.position, target.position);
    // Only surfaces that actually surround the target constrain the camera.
    if (gap + target.radius > occluder.radius) continue;
    distance = Math.max(distance, occluder.radius + OCCLUDER_CLEARANCE);
    // And the enclosure has to be inside the frame, not wrapped around the camera.
    if (sinHalfFov > 1e-6) distance = Math.max(distance, occluder.radius / sinHalfFov + OCCLUDER_CLEARANCE);
  }
  return distance;
}

/**
 * A fit for `bounds` that still respects a minimum viewing distance from the target, keeping the same
 * direction and field of view.
 */
export function fitOutsideOf(fit: CameraFit, minimumDistance: number): CameraFit {
  if (!(minimumDistance > fit.distance)) return fit;
  const direction = normalize3D({
    x: fit.position.x - fit.target.x,
    y: fit.position.y - fit.target.y,
    z: fit.position.z - fit.target.z,
  });
  const position = {
    x: fit.target.x + direction.x * minimumDistance,
    y: fit.target.y + direction.y * minimumDistance,
    z: fit.target.z + direction.z * minimumDistance,
  };
  // Pulling back widens what is visible, so near/far must grow with it or geometry gets clipped.
  const near = Math.max(0.01, minimumDistance - fit.distance);
  const far = fit.far + (minimumDistance - fit.distance);
  return { ...fit, position, distance: minimumDistance, near, far };
}

export function sphereBounds(position: Vec3, radius: number) {
  const r = Math.max(radius, 0.05);
  return {
    min: { x: position.x - r, y: position.y - r, z: position.z - r },
    max: { x: position.x + r, y: position.y + r, z: position.z + r },
    center: { ...position },
    size: { x: r * 2, y: r * 2, z: r * 2 },
    radius: r,
  };
}

/**
 * How much of the parent object a part close-up keeps in frame. A part anchor can be tiny (a
 * nucleolus inside a cell), and framing that radius alone puts the camera INSIDE the model — the view
 * fills with the inside of the geometry and the part being taught is unreadable. The part decides
 * WHERE to look; this floor keeps the camera outside the object so the part is seen in context.
 */
const PART_FOCUS_MIN_OBJECT_FRACTION = 0.45;

/** World bounds of a model part (from the generated asset anchors), scaled with the object. */
export function partBounds(
  object: Visual3DObject,
  part: string,
  anchors: Record<string, { center: Vec3; radius: number }> | undefined,
) {
  const anchor = anchors?.[part];
  const scale = object.scale.x;
  if (!anchor) return sphereBounds(object.position, object.radius);
  return sphereBounds(
    {
      x: object.position.x + anchor.center.x * scale,
      y: object.position.y + anchor.center.y * scale,
      z: object.position.z + anchor.center.z * scale,
    },
    Math.max(anchor.radius * scale, object.radius * PART_FOCUS_MIN_OBJECT_FRACTION, 0.04),
  );
}

function toCameraState(fit: CameraFit, mode: CameraState["mode"], focusedObjectId?: string): CameraState {
  return {
    position: { ...fit.position },
    target: { ...fit.target },
    fov: fit.fov,
    near: fit.near,
    far: fit.far,
    mode,
    ...(focusedObjectId ? { focusedObjectId } : {}),
  };
}

export function applyCameraAction(
  camera: CameraState,
  action:
    | Extract<Visual3DAction, { action: "focus_camera" | "move_camera" | "zoom_camera" | "frame_camera" }>
    | { action: "reset_camera" },
  resolve: CameraBoundsResolver,
  options: { objectCount?: number; sceneBounds?: SceneBounds; occluders?: CameraOccluder[]; contextBounds?: { radius: number; position: Vec3 } | null } = {},
): CameraActionResult {
  const objectCount = options.objectCount ?? 0;
  const sceneBounds = options.sceneBounds;
  const occluders = options.occluders ?? [];
  const context = options.contextBounds ?? null;

  /** Frames a focusable, keeping the camera outside anything that encloses it and the parent in view. */
  const focusFit = (resolved: { radius: number; position: Vec3 }) => {
    const direction = directionFrom(camera, resolved.position);
    const fit = fitCameraToBounds(sphereBounds(resolved.position, resolved.radius), {
      fov: camera.fov,
      fill: 0.66,
      direction,
    });
    let minimum = enclosingOccluderRadius(resolved, occluders, Math.tan((camera.fov * Math.PI) / 360));
    if (context) {
      // How far back the whole containing object needs in order to stay half on screen.
      const contextFit = fitCameraToBounds(sphereBounds(context.position, context.radius), {
        fov: camera.fov,
        fill: CONTEXT_FILL,
        direction,
      });
      minimum = Math.max(minimum, contextFit.distance);
    }
    return fitOutsideOf(fit, minimum);
  };

  switch (action.action) {
    case "reset_camera": {
      // "Reset" means "show me the whole scene again" — never a hard-coded pose.
      const bounds = sceneBounds ?? defaultBounds();
      const fit = fitCameraToBounds(bounds, { fov: camera.fov, direction: autoDirection(objectCount) });
      return { camera: toCameraState(fit, "default"), animated: true };
    }

    case "frame_camera": {
      if (action.target) {
        const resolved = resolve(action.target);
        if (!resolved) return { camera, animated: false };
        return { camera: toCameraState(focusFit(resolved), "focused", action.target), animated: true };
      }
      const bounds = sceneBounds ?? defaultBounds();
      const fit = fitCameraToBounds(bounds, { fov: camera.fov, fill: 0.7, direction: autoDirection(objectCount) });
      return { camera: toCameraState(fit, "default"), animated: true };
    }

    case "focus_camera": {
      const resolved = resolve(action.target, action.part);
      if (!resolved) return { camera, animated: false };
      return { camera: toCameraState(focusFit(resolved), "focused", action.target), animated: true };
    }

    case "move_camera": {
      const position = { x: action.position.x, y: action.position.y, z: action.position.z };
      const target = action.target ?? camera.target;
      const distance = Math.max(distance3D(position, target), 0.1);
      return {
        camera: {
          position,
          target: { ...target },
          fov: camera.fov,
          near: Math.max(0.01, distance - 20),
          far: distance + 2000,
          mode: "manual",
        },
        animated: true,
      };
    }

    case "zoom_camera": {
      const fov = clamp(action.fov, MIN_FOV, MAX_FOV);
      const distance = Math.max(distance3D(camera.position, camera.target), 0.1);
      return {
        camera: {
          position: { ...camera.position },
          target: { ...camera.target },
          fov,
          near: Math.max(0.01, distance - 20),
          far: distance + 2000,
          mode: camera.mode,
          ...(camera.focusedObjectId ? { focusedObjectId: camera.focusedObjectId } : {}),
        },
        animated: true,
      };
    }

    default:
      return { camera, animated: false };
  }
}

function defaultBounds(): SceneBounds {
  return {
    min: { x: -1, y: -1, z: -1 },
    max: { x: 1, y: 1, z: 1 },
    center: { x: 0, y: 0, z: 0 },
    size: { x: 2, y: 2, z: 2 },
    radius: Math.SQRT2,
  };
}

function directionFrom(camera: CameraState, target: Vec3): Vec3 {
  const direction = { x: camera.position.x - target.x, y: camera.position.y - target.y, z: camera.position.z - target.z };
  if (Math.hypot(direction.x, direction.y, direction.z) < 1e-4) return normalize3D({ x: 0.62, y: 0.42, z: 0.86 });
  return normalize3D(direction);
}