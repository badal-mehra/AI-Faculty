"use client";

// CAMERA CONTROLLER — universal auto-framing with smooth teacher-directed transitions.
//
// Three responsibilities, in priority order:
//   1. TEACHER: when the lesson issues a camera action (focus / frame / move / zoom / reset), the
//      camera flies to that pose instead of teleporting.
//   2. AUTO-FRAMING: whenever the scene content changes, the camera re-frames itself by MEASURING a
//      real THREE.Box3 of everything that is on screen (so loaded .glb geometry is measured, not
//      guessed) and then calling fitCameraToBounds.
//   3. STUDENT: OrbitControls allow orbit / zoom / pan at any time; a teacher action always wins.
//
// There is no fixed camera distance anywhere: a water molecule, a skeleton and the solar system all
// get the same treatment.
import { useEffect, useMemo, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CameraState, DEFAULT_CAMERA, Visual3DScene } from "@/lib/visual3d/types";
import { fitCameraToBounds, fitCameraToScene } from "@/lib/visual3d/framing";
import { framingRadiusFromBounds, measureObjectBounds } from "@/lib/visual3d/assetValidation";
import { getAsset } from "@/lib/visual3d/assets";

const TEACHER_BLEND_PER_SECOND = 3.2;
const REFRAME_DEBOUNCE_SECONDS = 0.08;
const FOLLOW_BLEND_PER_SECOND = 4.5;

export function CameraController({
  scene,
  contentRef,
  contentRevision = 0,
}: {
  scene: Visual3DScene;
  contentRef: React.RefObject<THREE.Object3D | null>;
  /** Increments whenever a model finishes loading (or fails), because the REAL geometry only exists
   *  after a GLB resolves — a frame measured before that would frame a loading placeholder. */
  contentRevision?: number;
}) {
  const { camera, size, scene: threeScene } = useThree();
  const controls = useRef<any>(null);
  const teacherPos = useRef(new THREE.Vector3(scene.camera.position.x, scene.camera.position.y, scene.camera.position.z));
  const teacherTarget = useRef(new THREE.Vector3(scene.camera.target.x, scene.camera.target.y, scene.camera.target.z));
  const teacherFov = useRef(scene.camera.fov);
  const autoFrame = useRef(true);
  const lastSignature = useRef("");
  const pending = useRef(0);

  // Auto-framing must trigger when the CONTENT changes, not when anything moves. Orbiting planets,
  // spinning gears and oscillating bobs update every frame, so including the animation tick here
  // re-ran the measurement ~60 times a second: the camera constantly re-fitted itself to whatever
  // slice happened to be on screen, which made a whole system breathe in and out of frame and
  // overrode the teacher's focus_camera before it could settle. A frame is measured once per real
  // content change (a new object, a moved object, a GLB that finished loading) and then held.
  const signature = useMemo(
    () => `${contentRevision}:${scene.objects.map((object) => `${object.id}@${object.position.x.toFixed(3)},${object.position.y.toFixed(3)},${object.position.z.toFixed(3)},${object.scale.x.toFixed(3)},${object.visible ? 1 : 0}`).join("|")}`,
    [contentRevision, scene.objects],
  );

  // A teacher camera action always wins and disables auto-framing until the next content change.
  useEffect(() => {
    const cam = scene.camera;
    if (cam.mode === "manual") return;
    teacherPos.current.set(cam.position.x, cam.position.y, cam.position.z);
    teacherTarget.current.set(cam.target.x, cam.target.y, cam.target.z);
    teacherFov.current = cam.fov;
    autoFrame.current = false;
  }, [scene.camera.position.x, scene.camera.position.y, scene.camera.position.z, scene.camera.target.x, scene.camera.target.y, scene.camera.target.z, scene.camera.fov, scene.camera.mode]);

  useEffect(() => {
    const cam = scene.camera;
    if (cam.near) (camera as THREE.PerspectiveCamera).near = cam.near;
    if (cam.far) (camera as THREE.PerspectiveCamera).far = cam.far;
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
  }, [scene.camera.near, scene.camera.far, camera]);

  // A teacher close-up must not be re-framed away. focus_camera deliberately moves in on one object,
  // and auto-framing the whole scene would immediately undo it — which is what happened whenever a
  // GLB finished loading a moment after the lesson step that asked for the close-up. Auto-framing is
  // for scenes the teacher did NOT point at; a focused camera is already the teacher's decision.
  const teacherFocused = scene.camera.mode === "focused";

  // Content changed -> schedule an auto-frame measurement (debounced so a batch of created objects
  // is measured once, after the last GLB has been added).
  useEffect(() => {
    if (teacherFocused) return;
    if (lastSignature.current === signature) return;
    lastSignature.current = signature;
    pending.current = REFRAME_DEBOUNCE_SECONDS;
  }, [signature, teacherFocused]);

  useFrame((_, delta) => {
    const orbit = controls.current;
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = Math.max(size.width / Math.max(1, size.height), 0.2);
    if (teacherFocused) pending.current = 0;

    // FOLLOW: while the teacher is tracking an object, the camera keeps its current offset and slides
    // with the object, so a signal travelling down an axon or a packet crossing a router stays
    // readable instead of drifting off screen. Any other camera action clears `follow`.
    const follow = scene.camera.follow;
    if (follow) {
      const target = followTarget(follow.targetId, follow.part, threeScene, scene);
      if (target) {
        const factor = 1 - Math.exp(-FOLLOW_BLEND_PER_SECOND * Math.min(delta, 0.1));
        const desired = new THREE.Vector3(target.x, target.y, target.z);
        if (orbit) {
          const deltaVec = desired.clone().sub(orbit.target).multiplyScalar(factor);
          orbit.target.add(deltaVec);
          camera.position.add(deltaVec);
          orbit.update();
        } else {
          camera.position.lerp(desired, factor);
        }
        return;
      }
    }

    if (pending.current > 0) {
      pending.current -= delta;
      if (pending.current <= 0) {
        autoFrame.current = true;
        const content = contentRef.current;
        let fit;
        let measuredRadius: number | null = null;
        // Measure what is ACTUALLY on screen — loaded model geometry included, hidden (isolated)
        // parts excluded so isolation frames the part that remains visible. Bounds that are empty,
        // non-finite or degenerate fall back to the engine's own measured scene bounds instead of
        // producing a NaN camera pose.
        const measured = content ? measureObjectBounds(content, { visibleOnly: true }) : null;
        if (measured && !measured.empty && measured.finite && measured.radius > 1e-4) {
          // Frame from the measured box's largest half-extent, not its bounding sphere: a round object
          // is inscribed in its own box, so the diagonal overstated it by 1.73x and pushed the camera
          // far enough back to leave most of the viewport empty.
          const framingRadius = framingRadiusFromBounds(measured);
          measuredRadius = framingRadius;
          fit = fitCameraToBounds(
            {
              min: { x: measured.min.x, y: measured.min.y, z: measured.min.z },
              max: { x: measured.max.x, y: measured.max.y, z: measured.max.z },
              center: { ...measured.center },
              size: { ...measured.size },
              radius: framingRadius,
            },
            {
              fov: perspective.fov,
              aspect,
              fill: 0.7,
              direction: directionFrom(perspective.position, orbit ? orbit.target : new THREE.Vector3()),
            },
          );
        } else {
          fit = fitCameraToScene(scene, { aspect });
        }
        teacherPos.current.set(fit.position.x, fit.position.y, fit.position.z);
        teacherTarget.current.set(fit.target.x, fit.target.y, fit.target.z);
        teacherFov.current = fit.fov;
        perspective.near = fit.near;
        perspective.far = fit.far;
        perspective.updateProjectionMatrix();
        // Development diagnostics: the acceptance run reads this to assert that the measured scene
        // really occupies the intended 55-80% of the viewport on a real GPU.
        if (process.env.NODE_ENV !== "production" && typeof window !== "undefined") {
          (window as unknown as Record<string, unknown>).__visual3dFit = {
            ...fit,
            radius: measuredRadius ?? scene.bounds?.radius ?? 0,
            aspect,
            objectCount: scene.objects.length,
            tick: scene.tick,
          };
        }
      }
    }

    if (!orbit) return;
    // Frame-rate independent exponential damping: smooth, never a jump cut.
    const factor = 1 - Math.exp(-TEACHER_BLEND_PER_SECOND * Math.min(delta, 0.1));
    const active = autoFrame.current || camera.position.distanceTo(teacherPos.current) > 0.02;
    if (active) {
      camera.position.lerp(teacherPos.current, factor);
      orbit.target.lerp(teacherTarget.current, factor);
    }
    if (Math.abs(perspective.fov - teacherFov.current) > 0.01) {
      perspective.fov += (teacherFov.current - perspective.fov) * factor;
      perspective.updateProjectionMatrix();
    }
    orbit.update();
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={0.2}
      maxDistance={4000}
      maxPolarAngle={Math.PI * 0.98}
      onStart={() => {
        // The student grabbed the camera: stop fighting them until the lesson moves on.
        autoFrame.current = false;
      }}
    />
  );
}

function directionFrom(position: THREE.Vector3, target: THREE.Vector3): { x: number; y: number; z: number } {
  const direction = position.clone().sub(target);
  if (direction.lengthSq() < 1e-6) return { x: 0.62, y: 0.42, z: 0.86 };
  direction.normalize();
  return { x: direction.x, y: direction.y, z: direction.z };
}

/**
 * The world point a follow camera should look at: the object's live transform when the renderer has
 * it mounted (so orbiting / oscillating / pulsing motion is tracked exactly), otherwise the engine's
 * measured position, offset by the named part's measured centre.
 */
function followTarget(
  targetId: string,
  part: string | undefined,
  threeScene: THREE.Scene,
  scene: Visual3DScene,
): THREE.Vector3 | null {
  const object = scene.objects.find((entry) => entry.id === targetId);
  if (!object) return null;
  const node = threeScene.getObjectByName(targetId);
  if (node) {
    const world = new THREE.Vector3();
    node.getWorldPosition(world);
    const asset = object.asset ? getAsset(object.asset) : undefined;
    const anchor = part ? asset?.anchors[part] : undefined;
    if (anchor) world.add(new THREE.Vector3(anchor.center.x, anchor.center.y, anchor.center.z).multiplyScalar(object.scale.x));
    return world;
  }
  const asset = object.asset ? getAsset(object.asset) : undefined;
  const anchor = part ? asset?.anchors[part] : undefined;
  if (anchor) {
    return new THREE.Vector3(
      object.position.x + anchor.center.x * object.scale.x,
      object.position.y + anchor.center.y * object.scale.x,
      object.position.z + anchor.center.z * object.scale.x,
    );
  }
  return new THREE.Vector3(object.position.x, object.position.y, object.position.z);
}

export function resetCameraToDefault(): CameraState {
  return {
    ...DEFAULT_CAMERA,
    position: { ...DEFAULT_CAMERA.position },
    target: { ...DEFAULT_CAMERA.target },
  };
}