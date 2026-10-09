"use client";

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three-stdlib";
import * as THREE from "three";
import { Object3DType } from "@/lib/visual3d/types";
import { getAsset } from "@/lib/visual3d/assets";
import { validateObject3D } from "@/lib/visual3d/assetValidation";
import { reportAssetFailure } from "./diagnostics";

// ASSET LOADING IS IMPERATIVE, NOT SUSPENDED.
//
// `useGLTF` rejects its suspense promise when a GLB 404s, and react-three-fiber re-throws that
// rejection from inside the Canvas' own React root. A boundary in this parent tree cannot see it, so
// the failure escaped as an uncaught page error. Loading imperatively means the failure arrives in a
// normal promise callback, where it becomes an ordinary state change: the failure is reported and the
// documented fallback primitive renders, with nothing thrown.
type GltfState = { status: "loading" | "ready" | "error"; scene: THREE.Object3D | null; error: Error | null };

// Loaded scenes are shared by path. The GLTF is cloned per instance before anything mutates it, so a
// cached scene is never modified by tinting, isolation or exploding one object.
const gltfSceneCache = new Map<string, THREE.Object3D>();
const gltfInFlight = new Map<string, Promise<THREE.Object3D>>();

function loadGltfScene(path: string): Promise<THREE.Object3D> {
  const cached = gltfSceneCache.get(path);
  if (cached) return Promise.resolve(cached);
  const inFlight = gltfInFlight.get(path);
  if (inFlight) return inFlight;
  const request = new Promise<THREE.Object3D>((resolve, reject) => {
    new GLTFLoader().load(
      path,
      (gltf) => {
        gltfSceneCache.set(path, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (error) => reject(error instanceof Error ? error : new Error(String(error))),
    );
  });
  // A rejected load must not become an unhandled rejection, and must not be cached: a later attempt
  // at the same asset is allowed to succeed.
  request.catch(() => undefined).finally(() => gltfInFlight.delete(path));
  gltfInFlight.set(path, request);
  return request;
}

function useGltfScene(path: string): GltfState {
  const [state, setState] = useState<GltfState>(() =>
    gltfSceneCache.has(path) ? { status: "ready", scene: gltfSceneCache.get(path) ?? null, error: null } : { status: "loading", scene: null, error: null },
  );

  useEffect(() => {
    let cancelled = false;
    if (gltfSceneCache.has(path)) {
      setState({ status: "ready", scene: gltfSceneCache.get(path) ?? null, error: null });
      return;
    }
    setState({ status: "loading", scene: null, error: null });
    loadGltfScene(path).then(
      (scene) => { if (!cancelled) setState({ status: "ready", scene, error: null }); },
      (error) => { if (!cancelled) setState({ status: "error", scene: null, error }); },
    );
    return () => { cancelled = true; };
  }, [path]);

  return state;
}

// Loads a trusted GLB/glTF model by asset id. The registry owns the path; the model never supplies a
// URL. Models are normalized to the registry's bounding radius, so a heart and a water molecule are
// framed by the same camera maths.
//
// The GLB is authored as one named NODE PER SEMANTIC PART, which is what makes real inspection
// possible here: `isolatePart` hides every node except one, `hiddenParts` hides named nodes, and
// `explodeOffsets` pushes named nodes outward. All three are driven by data the engine measured from
// the actual mesh, never by a hardcoded topic rule. A model whose parts were not authored separately
// simply has no named nodes, and those actions become silent no-ops instead of a fake.
export function AssetModel({
  asset,
  scale,
  color,
  part,
  highlight,
  highlightColor,
  highlightPart,
  isolatePart,
  hiddenParts,
  explodeOffsets,
  opacity,
  onFailure,
  onReady,
}: {
  asset: string;
  scale: number;
  color?: string;
  part?: string;
  highlight?: boolean;
  highlightColor?: string;
  highlightPart?: string;
  isolatePart?: string;
  hiddenParts?: string[];
  explodeOffsets?: Record<string, { x: number; y: number; z: number }>;
  opacity?: number;
  onFailure?: (asset: string) => void;
  /** Called once the model has loaded AND passed structural validation (LOADED -> VALIDATED -> VISIBLE). */
  onReady?: (asset: string) => void;
}) {
  const descriptor = getAsset(asset);
  const [failed, setFailed] = useState(false);
  const gltf = useGltfScene(descriptor?.path ?? "");
  const loadError = gltf.status === "error" ? gltf.error : null;

  useEffect(() => { setFailed(false); }, [asset]);

  // A load failure is reported once (the diagnostics channel de-duplicates by reason) and then the
  // documented fallback primitive takes the model's place, so the classroom is never blank. The report
  // runs in an effect because `onFailure` updates state in the parent component.
  useEffect(() => {
    if (!descriptor?.path || !loadError) return;
    reportAssetFailure(asset, descriptor.path, loadError.message || "model could not be loaded");
    onFailure?.(asset);
  }, [asset, descriptor?.path, loadError, onFailure]);

  if (!descriptor) {
    reportAssetFailure(asset, null, "asset is not in the trusted registry");
    return <FallbackPrimitive type="sphere" scale={scale} color={color ?? "#94a3b8"} label="unknown asset" />;
  }

  const fallbackPrimitive = (
    <FallbackPrimitive type={descriptor.fallbackType} scale={scale} color={color ?? descriptor.fallbackColor} label={descriptor.name} />
  );

  if (failed || !descriptor.path) {
    if (!descriptor.path) reportAssetFailure(asset, null, "asset has no model path in the registry");
    return fallbackPrimitive;
  }

  if (gltf.status !== "ready" || !gltf.scene) return fallbackPrimitive;

  return (
    <TrustedGltf
      assetId={asset}
      scene={gltf.scene}
      boundingRadius={descriptor.boundingRadius}
      expectedBounds={descriptor.bounds}
      expectedMinMeshes={Math.max(1, Math.min(descriptor.meshCount, descriptor.partCount))}
      scale={scale}
      color={color}
      part={part}
      highlight={highlight}
      highlightColor={highlightColor}
      highlightPart={highlightPart}
      isolatePart={isolatePart}
      hiddenParts={hiddenParts}
      explodeOffsets={explodeOffsets}
      opacity={opacity}
      onReady={onReady}
      onInvalid={(issues) => {
        // "Loaded but invisible" is treated exactly like "failed to load": report it, then render
        // the documented fallback primitive so the classroom is never blank.
        reportAssetFailure(asset, descriptor.path, `model loaded but failed visibility validation: ${issues.slice(0, 3).join("; ")}`);
        onFailure?.(asset);
        setFailed(true);
      }}
    />
  );
}

// A pulse that fades itself out on its own, so "look here for a moment" needs no follow-up action.
type ActivePulse = { startMs: number; durationMs: number };

function TrustedGltf({
  assetId,
  scene,
  boundingRadius,
  expectedBounds,
  expectedMinMeshes,
  scale,
  color,
  part,
  highlight,
  highlightColor,
  highlightPart,
  isolatePart,
  hiddenParts,
  explodeOffsets,
  opacity,
  onReady,
  onInvalid,
}: {
  assetId: string;
  scene: THREE.Object3D;
  boundingRadius: number;
  expectedBounds?: { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; radius: number };
  expectedMinMeshes?: number;
  scale: number;
  color?: string;
  part?: string;
  highlight?: boolean;
  highlightColor?: string;
  highlightPart?: string;
  isolatePart?: string;
  hiddenParts?: string[];
  explodeOffsets?: Record<string, { x: number; y: number; z: number }>;
  opacity?: number;
  onReady?: (asset: string) => void;
  onInvalid?: (issues: string[]) => void;
}) {
  const gltf = { scene };
  const groupRef = useRef<THREE.Group>(null);
  const [normalized, setNormalized] = useState(false);

  // Clone the cached scene so tinting/highlighting one instance never mutates the shared asset, and
  // normalize it to the registry's bounding radius so camera framing is scale-independent.
  const content = useMemo(() => {
    const clone = gltf.scene.clone(true);
    clone.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      const material = mesh.material as THREE.Material | THREE.Material[];
      if (Array.isArray(material)) {
        mesh.material = material.map((entry) => cloneMaterial(entry));
      } else {
        mesh.material = cloneMaterial(material);
      }
    });
    const box = new THREE.Box3().setFromObject(clone);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDimension = Math.max(size.x, size.y, size.z);
    const normalization = maxDimension > 1e-6 ? (boundingRadius * 2) / maxDimension : 1;
    clone.scale.setScalar(normalization);
    clone.updateWorldMatrix(true, true);
    return clone;
  }, [gltf.scene, boundingRadius]);

  // LOADED -> VALIDATED: measure the real geometry and reject anything that would render invisibly.
  // A GLB that parses is not proof it renders; a zero-size box, non-finite vertices, an invisible
  // material or a microscopic/astronomical scale all become an explicit failure with a fallback.
  const validation = useMemo(
    () => validateObject3D(content, { expectedMinMeshes: expectedMinMeshes ?? 1 }),
    [content, expectedMinMeshes],
  );

  // Cross-check the delivered mesh against the bounds measured at build time, so an asset that is
  // silently replaced by something wildly differently sized is still caught.
  const boundsMismatch = useMemo(() => {
    if (!expectedBounds || validation.bounds.empty || !validation.bounds.finite) return false;
    // `content` is normalized so its measured radius should be ~`boundingRadius`; the authored radius
    // is also ~1, so a delivered mesh that measures many times larger or smaller is suspicious.
    const expected = Math.max(boundingRadius, 1e-3);
    return validation.bounds.radius < expected * 0.25 || validation.bounds.radius > expected * 8;
  }, [expectedBounds, validation.bounds, boundingRadius]);

  useEffect(() => {
    if (validation.ok && !boundsMismatch) {
      onReady?.(assetId);
      return;
    }
    onInvalid?.([
      ...validation.issues,
      ...(boundsMismatch ? ["measured bounds differ drastically from the authored model"] : []),
    ]);
  // Only re-run when the validation verdict itself changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validation.ok, boundsMismatch]);

  // Part isolation: a single named node from a multi-part model (a chamber, a nucleus, a shell).
  const partObject = useMemo(() => {
    if (!part) return null;
    const node = findNamedNode(content, part);
    if (!node) return null;
    const isolated = node.clone(true);
    const box = new THREE.Box3().setFromObject(isolated);
    const center = new THREE.Vector3();
    box.getCenter(center);
    isolated.position.sub(center);
    return isolated;
  }, [content, part]);

  // Original local positions, kept so exploding and assembling never mutates the loaded geometry and
  // always returns to exactly where a part started.
  const basePositions = useMemo(() => {
    const positions = new Map<string, THREE.Vector3>();
    content.traverse((child) => {
      positions.set(child.uuid, child.position.clone());
    });
    return positions;
  }, [content]);

  const explodeMemo = useMemo(() => explodeOffsets ?? null, [explodeOffsets]);

  // Exploded view is animated by the renderer rather than by the engine: each part eases towards
  // (original + offset), so explode and assemble are the same smooth motion in both directions.
  useFrame((_, delta) => {
    const root = partObject ?? content;
    if (!explodeMemo) return;
    const step = Math.min(delta, 0.1);
    for (const child of root.children) {
      const base = basePositions.get(child.uuid);
      const offset = explodeMemo[child.name];
      const targetX = (base?.x ?? child.position.x) + (offset?.x ?? 0);
      const targetY = (base?.y ?? child.position.y) + (offset?.y ?? 0);
      const targetZ = (base?.z ?? child.position.z) + (offset?.z ?? 0);
      const factor = 1 - Math.pow(0.004, step);
      child.position.set(
        THREE.MathUtils.lerp(child.position.x, targetX, factor),
        THREE.MathUtils.lerp(child.position.y, targetY, factor),
        THREE.MathUtils.lerp(child.position.z, targetZ, factor),
      );
    }
  });

  useLayoutEffect(() => { setNormalized(true); }, [content, partObject]);

  useEffect(() => {
    const target = partObject ?? content;
    const isolate = isolatePart;
    const hidden = hiddenParts && hiddenParts.length > 0 ? new Set(hiddenParts) : null;
    target.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      // Part-level visibility: isolated parts win, then explicitly hidden parts.
      const isHidden = Boolean(isolate) ? child.name !== isolate : Boolean(hidden?.has(child.name));
      mesh.visible = !isHidden;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const material of materials) {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard || !("color" in standard)) continue;
        // Highlighting ONE part must not light up the whole organ.
        const isHighlighted = Boolean(highlight)
          && (highlightPart ? child.name === highlightPart || child.name === part : true);
        if (color && !isHighlighted && standard.map === null) standard.color.set(color);
        if (isHighlighted) {
          standard.emissive.set(highlightColor ?? "#ffe66d");
          standard.emissiveIntensity = 0.5;
        } else if (standard.emissiveIntensity !== 0) {
          standard.emissiveIntensity = 0;
        }
        const alpha = opacity === undefined ? 1 : Math.max(0, Math.min(1, opacity));
        if (alpha < 1) {
          standard.transparent = true;
          standard.opacity = alpha;
          standard.depthWrite = alpha > 0.65;
        }
        standard.needsUpdate = true;
      }
    });
  }, [content, partObject, color, highlight, highlightColor, highlightPart, isolatePart, hiddenParts, part, opacity, normalized]);

  // A model that loaded but failed visibility validation renders nothing here; the parent swaps in
  // the documented fallback primitive, so the classroom is never blank.
  if (!validation.ok || boundsMismatch) return null;

  // A pulse is a temporary effect driven from SceneObject; the model loader only renders geometry.
  return <group ref={groupRef} scale={scale}><primitive object={partObject ?? content} /></group>;
}

function cloneMaterial(material: THREE.Material): THREE.Material {
  const clone = material.clone();
  const standard = clone as THREE.MeshStandardMaterial;
  if (standard && "color" in standard && standard.color) {
    // Educational clarity over photorealism: a little environment response keeps organic parts
    // readable without making them look like plastic.
    if (standard.roughness === 1) standard.roughness = 0.72;
    standard.envMapIntensity = standard.envMapIntensity > 0 ? standard.envMapIntensity : 0.6;
  }
  return clone;
}

function findNamedNode(root: THREE.Object3D, name: string): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  root.traverse((child) => {
    if (found) return;
    if (child.name === name) found = child;
  });
  return found;
}

export function FallbackPrimitive({
  type,
  scale,
  color,
  label,
}: {
  type: Object3DType;
  scale: number;
  color: string;
  label?: string;
}) {
  const c = new THREE.Color(color ?? "#94a3b8");
  // Slightly warmer emissive so fallbacks glow faintly and are visible even without strong lighting
  const emissive = c.clone().multiplyScalar(0.18);
  const s = Math.max(scale, type === "particle" ? 0.02 : 0.05);
  const mat = (roughness = 0.55, metalness = 0.05) => (
    <meshStandardMaterial color={c} roughness={roughness} metalness={metalness} emissive={emissive} emissiveIntensity={0.35} />
  );

  switch (type) {
    case "box":
      return <mesh><boxGeometry args={[s, s, s]} />{mat(0.55)}</mesh>;
    case "cylinder":
      return <mesh><cylinderGeometry args={[s * 0.5, s * 0.5, s, 32]} />{mat(0.5)}</mesh>;
    case "cone":
      return <mesh><coneGeometry args={[s * 0.5, s, 32]} />{mat(0.55)}</mesh>;
    case "torus":
      return <mesh><torusGeometry args={[s * 0.5, s * 0.18, 16, 48]} />{mat(0.5)}</mesh>;
    case "plane":
      return (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[s, s]} />
          <meshStandardMaterial color={c} roughness={0.7} emissive={emissive} emissiveIntensity={0.2} side={THREE.DoubleSide} />
        </mesh>
      );
    case "arrow":
      return (
        <group>
          <mesh position={[0, s / 2, 0]}><cylinderGeometry args={[s * 0.05, s * 0.05, s, 12]} />{mat(0.4)}</mesh>
          <mesh position={[0, s * 0.94, 0]}><coneGeometry args={[s * 0.16, s * 0.28, 12]} />{mat(0.4)}</mesh>
        </group>
      );
    case "line":
      return <mesh rotation={[-Math.PI / 2, 0, 0]}><cylinderGeometry args={[s * 0.02, s * 0.02, s, 8]} />{mat(0.6)}</mesh>;
    case "tube":
      return <mesh><torusGeometry args={[s * 0.5, s * 0.12, 16, 48]} />{mat(0.5)}</mesh>;
    case "molecule":
      return <mesh><icosahedronGeometry args={[s * 0.5, 1]} />{mat(0.4, 0.2)}</mesh>;
    case "crystal":
      return <mesh><octahedronGeometry args={[s * 0.6, 0]} /><meshStandardMaterial color={c} roughness={0.25} metalness={0.15} emissive={emissive} emissiveIntensity={0.4} /></mesh>;
    case "text":
      return <mesh><boxGeometry args={[s * 2.2, s * 0.9, s * 0.18]} />{mat(0.6)}</mesh>;
    case "sphere":
    default:
      return <mesh><sphereGeometry args={[s * 0.6, 32, 22]} />{mat(0.6)}</mesh>;
  }
}

export function preloadAsset(assetId: string): void {
  const descriptor = getAsset(assetId);
  if (!descriptor || !descriptor.path) return;
  // Preloading is best-effort. A failure is not reported here: `loadGltfScene` swallows it and
  // `AssetModel` reports it when the model actually renders, so one diagnostic per asset is emitted.
  void loadGltfScene(descriptor.path).catch(() => undefined);
}
