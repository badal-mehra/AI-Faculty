"use client";

// 3D SCENE ROOT.
//
// Renders whatever the deterministic engine produced: model assets, procedural primitives, flows,
// labels, camera. Lighting, ground grid and shadow extents adapt to the measured scene size, and
// WebGL availability is reported to the parent so Auto mode can fall back to the 2D diagram.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import { Visual3DScene } from "@/lib/visual3d/types";
import { shellObjectIds } from "@/lib/visual3d/containment";
import { SceneObject } from "./SceneObject";
import { FlowParticles } from "./FlowParticles";
import { SceneAnnotations } from "./SceneAnnotations";
import { SceneLabelDriver, SceneLabelHost } from "./SceneLabel";
import { CameraController } from "./CameraController";

/**
 * A faint reference plane + grid so objects have a ground to sit on and depth reads clearly.
 *
 * Deliberately low contrast. A bright grid competes with the subject — it pulled the eye straight
 * across an atom that has no floor at all and read as the most important thing in the diagram — while
 * still doing its real job: showing where things sit in space and catching shadows.
 */
function GroundGrid({ radius }: { radius: number }) {
  const size = Math.max(8, Math.min(radius * 5, 240));
  const divisions = Math.max(8, Math.min(40, Math.round(size / 2)));
  return (
    <group position={[0, -Math.max(radius, 0.4) - 0.02, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[size, 64]} />
        <meshStandardMaterial color="#0a1512" roughness={0.95} />
      </mesh>
      <gridHelper args={[size, divisions, "#1b3b34", "#142d28"]}>
        <lineBasicMaterial attach="material" transparent opacity={0.35} depthWrite={false} />
      </gridHelper>
    </group>
  );
}

/**
 * Frame-rate probe. Cheap (one counter increment per frame) and always on: the automated browser
 * acceptance run reads this to report real FPS on real hardware instead of guessing.
 */
function FpsProbe() {
  const frames = useRef(0);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current >= 1) {
      const fps = Math.round(frames.current / elapsed.current);
      if (typeof window !== "undefined") {
        (window as unknown as Record<string, unknown>).__visual3dFps = fps;
      }
      frames.current = 0;
      elapsed.current = 0;
    }
  });
  return null;
}

/**
 * Rendered-scene probe. Development only: the automated browser acceptance run reads this to assert
 * that the new inspection features really reached the GPU-side scene graph (a part is actually hidden,
 * an exploded part actually moved, an annotation actually produced geometry) instead of only existing
 * in the engine state. Reported by NAME because semantic parts are the unit the AI reasons about.
 *
 * It also reports the ON-SCREEN occupancy of everything actually drawn: the projected screen bounding
 * box of all visible meshes, plus the count of drawable meshes. A scene can pass every state-based
 * assertion (objects exist, camera moved, labels present) while rendering a microscopic speck or an
 * off-camera model, so the real proof that a model is teachable is how much of the viewport its
 * geometry covers, measured on the GPU rather than assumed from the engine's numbers.
 */
function SceneGraphProbe({ contentRef }: { contentRef: React.RefObject<THREE.Group | null> }) {
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    if (process.env.NODE_ENV === "production" || typeof window === "undefined") return;
    const root = contentRef.current;
    if (!root) return;
    const parts: Array<{ name: string; visible: boolean; x: number; y: number; z: number }> = [];
    root.traverse((node) => {
      if (!node.name) return;
      const position = node.getWorldPosition(new THREE.Vector3());
      parts.push({
        name: node.name,
        visible: node.visible,
        x: Math.round(position.x * 1000) / 1000,
        y: Math.round(position.y * 1000) / 1000,
        z: Math.round(position.z * 1000) / 1000,
      });
    });

    // Project every visible mesh's world bounding box into normalized device coordinates and take the
    // union, which is the screen-space footprint of the drawn geometry. Meshes behind the camera are
    // excluded rather than producing a mirrored, meaningless box.
    const box = new THREE.Box3();
    const scratch = new THREE.Box3();
    const corner = new THREE.Vector3();
    let meshCount = 0;
    let offCamera = 0;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    root.updateWorldMatrix(true, true);
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible) return;
      let parentVisible = true;
      for (let p = mesh.parent; p; p = p.parent) if (!p.visible) { parentVisible = false; break; }
      if (!parentVisible) return;
      meshCount += 1;
      scratch.setFromObject(mesh);
      if (scratch.isEmpty()) return;
      for (let i = 0; i < 8; i += 1) {
        corner.set(
          i & 1 ? scratch.max.x : scratch.min.x,
          i & 2 ? scratch.max.y : scratch.min.y,
          i & 4 ? scratch.max.z : scratch.min.z,
        );
        corner.project(camera);
        // A point behind the camera projects mirrored; count it so a camera pointed away from the
        // model is reported as off-camera rather than as a full-screen box.
        const worldZ = corner.clone().applyMatrix4(camera.matrixWorldInverse).z;
        if (worldZ > -camera.near) { offCamera += 1; continue; }
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      }
      box.union(scratch);
    });

    // Material report: what colour, opacity and blending each visible mesh actually draws with. A
    // scene can be perfectly framed and still be unreadable because one surface is opaque white in
    // front of everything else, and only the real material state reveals that.
    const materials: Array<{ mesh: string; material: string; color: string; opacity: number; transparent: boolean; side: number }> = [];
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.material) return;
      const material = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.Material & {
        color?: THREE.Color; opacity?: number; transparent?: boolean; side?: number;
      };
      materials.push({
        mesh: node.name || (mesh as THREE.Mesh).geometry?.type || mesh.type,
        material: material.type,
        color: material.color?.getHexString?.() ?? "",
        opacity: material.opacity ?? 1,
        transparent: Boolean(material.transparent),
        side: material.side ?? 0,
      });
    });

    const size = new THREE.Vector3();
    box.getSize(size);
    // How far the camera actually sits from the content it is framing, as a multiple of the content's
    // own radius. A camera closer than one radius is INSIDE the lesson: it fills the viewport with the
    // inside of a surface, which is the failure this ratio makes measurable.
    const centre = box.getSize(new THREE.Vector3()).length() > 0 ? box.getCenter(new THREE.Vector3()) : new THREE.Vector3();
    const cameraPosition = camera.getWorldPosition(new THREE.Vector3());
    (window as unknown as Record<string, unknown>).__visual3dGraph = {
      parts,
      camera: {
        position: {
          x: Math.round(cameraPosition.x * 1000) / 1000,
          y: Math.round(cameraPosition.y * 1000) / 1000,
          z: Math.round(cameraPosition.z * 1000) / 1000,
        },
        fov: Math.round((camera as THREE.PerspectiveCamera).fov * 10) / 10,
        distanceToCentre: Math.round(cameraPosition.distanceTo(centre) * 1000) / 1000,
        contentRadius: Math.round(Math.max(size.x, size.y, size.z) / 2 * 1000) / 1000,
      },
      materials,
      geometry: {
        meshCount,
        offCameraCorners: offCamera,
        worldSize: { x: Math.round(size.x * 1000) / 1000, y: Math.round(size.y * 1000) / 1000, z: Math.round(size.z * 1000) / 1000 },
        // Normalized device coordinates: -1..1 spans the viewport.
        screenBox: minX === Infinity
          ? null
          : {
              x: Math.round(minX * 1000) / 1000,
              y: Math.round(minY * 1000) / 1000,
              width: Math.round((maxX - minX) * 1000) / 1000,
              height: Math.round((maxY - minY) * 1000) / 1000,
            },
      },
    };
  });
  return null;
}
/**
 * PROCEDURAL EDUCATIONAL ENVIRONMENT.
 *
 * Deliberately NOT a downloaded HDRI (`<Environment preset="city" />` fetched a cubemap from
 * raw.githack.com). Because that remote environment lived in the SAME <Suspense> as the scene, the
 * whole classroom was suspended behind it — blank while it loaded and permanently blank if it was
 * slow, blocked or the machine was offline. These Lightformers are generated locally, so the
 * environment can never delay or blank the scene, and materials still receive real reflections
 * (which matters for the metalness used by a few models).
 */
function ProceduralEnvironment({ radius }: { radius: number }) {
  const r = Math.max(radius, 0.6) * 12;
  return (
    <Environment resolution={128} frames={1}>
      <Lightformer form="rect" intensity={2.4} color="#f4fbff" position={[0, r, r * 0.2]} rotation={[-Math.PI / 2, 0, 0]} scale={[r, r, 1]} />
      <Lightformer form="rect" intensity={1.2} color="#bcd8ff" position={[-r, r * 0.5, r]} rotation={[0, -Math.PI / 4, 0]} scale={[r, r, 1]} />
      <Lightformer form="rect" intensity={0.9} color="#ffd9b0" position={[r, r * 0.25, -r]} rotation={[0, Math.PI * 0.75, 0]} scale={[r, r, 1]} />
      <Lightformer form="circle" intensity={0.8} color="#8fd9c4" position={[0, -r * 0.7, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[r, r, 1]} />
    </Environment>
  );
}

/** A boundary that renders nothing on error, so an optional visual (the environment) can never take
 *  the whole classroom down with it. */
class SilentBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * SCENE HEALTH PROBE — the "VALIDATED -> VISIBLE" gate for the whole scene.
 *
 * After the assets settle it measures the real content graph: how many models were requested, how
 * many loaded, and whether a visible mesh with finite, non-zero bounds actually exists. A scene that
 * contains models but has nothing visible is reported so Auto mode can degrade to 2D instead of
 * leaving an empty black stage. The verdict is published on `window.__visual3dHealth` for the
 * automated browser acceptance run.
 */
function SceneHealthProbe({
  contentRef,
  requested,
  ready,
  failed,
  onUnusable,
}: {
  contentRef: React.RefObject<THREE.Group | null>;
  requested: number;
  ready: number;
  failed: number;
  onUnusable?: (reason: string) => void;
}) {
  const frames = useRef(0);
  const reported = useRef(false);
  const settledAt = useRef<number | null>(null);
  useFrame((_, delta) => {
    frames.current += 1;
    if (frames.current % 15 !== 0) return;
    const root = contentRef.current;
    if (!root) return;
    let visibleMeshes = 0;
    const box = new THREE.Box3();
    root.traverse((node) => {
      const mesh = node as THREE.Mesh;
      if (!mesh.isMesh || !mesh.visible || !mesh.geometry) return;
      let parent: THREE.Object3D | null = mesh.parent;
      let hiddenAncestor = false;
      while (parent) {
        if (!parent.visible) { hiddenAncestor = true; break; }
        parent = parent.parent;
      }
      if (hiddenAncestor) return;
      visibleMeshes += 1;
      box.expandByObject(mesh);
    });
    const sphere = new THREE.Sphere();
    const hasBounds = !box.isEmpty() && box.getBoundingSphere(sphere).radius > 1e-4
      && Number.isFinite(sphere.radius);
    const pending = Math.max(0, requested - ready - failed);
    const settled = requested === 0 || pending === 0;
    if (settled && settledAt.current === null) settledAt.current = performance.now();
    if (typeof window !== "undefined") {
      (window as unknown as Record<string, unknown>).__visual3dHealth = {
        requested, ready, failed, pending, visibleMeshes, hasBounds,
        radius: hasBounds ? sphere.radius : 0,
      };
    }
    if (reported.current) return;
    // Degrade only when the scene is genuinely unusable: models were asked for, they settled, and
    // nothing visible with real bounds exists — or they never settled within a generous grace period.
    const graceElapsed = settledAt.current !== null ? performance.now() - settledAt.current : 0;
    const stuck = requested > 0 && pending > 0 && frames.current > 60 * 12;
    if (requested > 0 && (visibleMeshes === 0 || !hasBounds) && (settled ? graceElapsed > 1500 : stuck)) {
      reported.current = true;
      onUnusable?.("scene-rendered-no-visible-geometry");
    }
  });
  return null;
}



// Renders the full 3D scene: objects, flows, labels, camera control, lighting, and environment.
export function Scene3D({
  scene,
  onError,
  onAssetFailure,
  onUnusable,
}: {
  scene: Visual3DScene;
  onError: (available: boolean) => void;
  onAssetFailure?: (asset: string) => void;
  /** Called when the scene genuinely cannot produce a visible result, so Auto mode degrades to 2D. */
  onUnusable?: (reason: string) => void;
}) {
  const [webglAvailable, setWebglAvailable] = useState(true);
  const contentRef = useRef<THREE.Group>(null);
  const labelHostRef = useRef<HTMLDivElement | null>(null);

  // MODEL LOAD LIFECYCLE (per scene): which model-backed objects exist, and how many reached
  // LOADED -> VALIDATED -> VISIBLE or FAILED -> FALLBACK. This drives the loading indicator, the
  // camera re-frame (the real geometry only exists after the GLB resolves) and the "never blank"
  // health gate.
  const modelObjectIds = useMemo(
    () => scene.objects
      .filter((object) => object.type === "model" && Boolean(object.asset) && object.visible !== false)
      .map((object) => object.id),
    [scene.objects],
  );
  const modelKey = modelObjectIds.join("|");
  const requestedModels = modelObjectIds.length;
  const [assetStatus, setAssetStatus] = useState<{ ready: number; failed: number }>({ ready: 0, failed: 0 });
  const settledRef = useRef<{ ready: Set<string>; failed: Set<string> }>({ ready: new Set(), failed: new Set() });

  // A new lesson step that changes which models are on screen restarts the lifecycle counter.
  useEffect(() => {
    settledRef.current = { ready: new Set(), failed: new Set() };
    setAssetStatus({ ready: 0, failed: 0 });
  }, [modelKey]);

  const handleAssetReady = useCallback((objectId: string) => {
    const state = settledRef.current;
    if (state.ready.has(objectId)) return;
    state.ready.add(objectId);
    state.failed.delete(objectId);
    setAssetStatus({ ready: state.ready.size, failed: state.failed.size });
  }, []);

  const handleSceneAssetFailed = useCallback((objectId: string) => {
    const state = settledRef.current;
    if (state.failed.has(objectId)) return;
    state.failed.add(objectId);
    state.ready.delete(objectId);
    setAssetStatus({ ready: state.ready.size, failed: state.failed.size });
  }, []);

  const handleUnusable = useCallback((reason: string) => {
    onUnusable?.(reason);
  }, [onUnusable]);

  useEffect(() => {
    let cancelled = false;
    try {
      const canvas = document.createElement("canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const available = Boolean(gl);
      if (!cancelled) setWebglAvailable(available);
    } catch {
      if (!cancelled) setWebglAvailable(false);
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { onError(webglAvailable); }, [webglAvailable, onError]);

  // A primitive that geometrically encloses other objects is drawn as translucent glass, so an
  // electron shell or a cell membrane reveals what it contains instead of hiding the lesson.
  // Declared with the other hooks, above the WebGL early return: a hook below a conditional return
  // renders fewer hooks than expected and takes the whole scene down with it.
  const shells = useMemo(() => shellObjectIds(scene.objects), [scene.objects]);

  if (!webglAvailable) {
    return (
      <div style={{ padding: 24, color: "#e2e8f0", textAlign: "center" }}>
        <div style={{ fontSize: 14, color: "#94a3b8" }}>3D rendering is not available in this browser.</div>
      </div>
    );
  }

  const radius = Math.max(scene.bounds?.radius ?? 1, 0.5);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 380 }}>
      <Canvas
        shadows
        camera={{
          position: [scene.camera.position.x, scene.camera.position.y, scene.camera.position.z],
          fov: scene.camera.fov,
          near: scene.camera.near ?? 0.1,
          far: scene.camera.far ?? 400,
        }}
        gl={{ antialias: true, alpha: false, stencil: false, depth: true, preserveDrawingBuffer: true }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <color attach="background" args={["#08110f"]} />
        <fog attach="fog" args={["#08110f", radius * 6, radius * 22]} />
        {/* Educational lighting: a clear key light for shape reading, a cool fill so the shadow side
            is never black, and a soft rim that separates the model from the background. */}
        <ambientLight intensity={0.62} color="#a8c4bb" />
        <hemisphereLight groundColor="#0c1a18" intensity={0.4} />
        <directionalLight
          position={[radius * 2.4, radius * 4, radius * 3]}
          intensity={1.65}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-radius * 3}
          shadow-camera-right={radius * 3}
          shadow-camera-top={radius * 3}
          shadow-camera-bottom={-radius * 3}
          shadow-camera-near={0.01}
          shadow-camera-far={radius * 20 + 50}
        />
        <directionalLight position={[-radius * 2, radius * 2, -radius * 2]} intensity={0.5} color="#5a8a7d" />
        <directionalLight position={[-radius * 1.5, radius * 0.5, radius * 3]} intensity={0.3} color="#9fd4ff" />
        <pointLight position={[0, radius * 2, 0]} intensity={0.6} color="#cfe9ff" distance={radius * 12} />

        {/* The environment is procedural and lives in its own silent boundary: it is never in the
            same Suspense as the scene content, so it can neither delay nor blank the classroom. */}
        <SilentBoundary>
          <ProceduralEnvironment radius={radius} />
        </SilentBoundary>

        {/* Scene content is NOT wrapped in a suspense boundary: a slow or failed GLB must never blank
            the grid, the other objects, the flows or the annotations. Each model handles its own
            loading/fallback internally (AssetModel). */}
        <GroundGrid radius={radius} />
        <group ref={contentRef}>
          {scene.objects.map((object) => (
            <SceneObject
              key={object.id}
              object={object}
              orbitCenter={object.orbit ? scene.objects.find((candidate) => candidate.id === object.orbit?.centerId)?.position : undefined}
              oscillationPivot={object.oscillation ? scene.objects.find((candidate) => candidate.id === object.oscillation?.pivotId)?.position : undefined}
              shell={shells.has(object.id)}
              onAssetFailure={onAssetFailure}
              onAssetReady={handleAssetReady}
              onAssetFailed={handleSceneAssetFailed}
            />
          ))}
          {scene.flows.map((flow) => (
            <FlowParticles key={flow.id} flow={flow} />
          ))}
          <SceneAnnotations annotations={scene.annotations ?? []} />
        </group>

        <SceneLabelDriver labels={scene.labels} objects={scene.objects} annotations={scene.annotations ?? []} hostRef={labelHostRef} />
        <CameraController scene={scene} contentRef={contentRef} contentRevision={assetStatus.ready + assetStatus.failed} />
        <SceneGraphProbe contentRef={contentRef} />
        <SceneHealthProbe
          contentRef={contentRef}
          requested={requestedModels}
          ready={assetStatus.ready}
          failed={assetStatus.failed}
          onUnusable={handleUnusable}
        />
        <FpsProbe />
      </Canvas>
      <SceneLabelHost hostRef={labelHostRef} />
      {/* LOADING state: while models are still resolving, tell the student what is happening instead
          of leaving an unexplained empty stage. It disappears as soon as the geometry is visible. */}
      {requestedModels > 0 && assetStatus.ready + assetStatus.failed < requestedModels ? (
        <div className="scene3d-loading" data-testid="visual3d-loading">
          <span>Loading 3D models…</span>
        </div>
      ) : null}
    </div>
  );
}

// A crash inside the WebGL tree must degrade to the 2D fallback, never to a blank viewport.
export class Scene3DErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[3D scene] renderer error:", error);
    this.props.onError();
  }

  render() {
    return this.state.hasError ? null : this.props.children;
  }
}