"use client";

import React, { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Visual3DObject } from "@/lib/visual3d/types";
import { AssetModel, FallbackPrimitive } from "./AssetModel";

// Renders a single 3D object: procedural geometry or a trusted model asset.
//
// All motion is generic and driven by fields the engine measured:
//   orbit        -> revolve around another object (planet, electron)
//   oscillation  -> swing around a pivot (pendulum bob, rocker)
//   spin         -> continuous rotation at the requested axis AND angular speed
//   pulse        -> a temporary scale-and-glow beat that expires on its own
//   motion       -> a one-off move / rotate / scale transition
//
// The component is memoized so a step that only moves the camera re-renders nothing.
function SceneObjectImpl({
  object,
  orbitCenter,
  oscillationPivot,
  shell,
  onAssetFailure,
  onAssetReady,
  onAssetFailed,
}: {
  object: Visual3DObject;
  orbitCenter?: { x: number; y: number; z: number };
  oscillationPivot?: { x: number; y: number; z: number };
  /** True when this primitive geometrically contains other objects, so it is drawn as a glass shell. */
  shell?: boolean;
  onAssetFailure?: (asset: string) => void;
  /** Reports that THIS object's model reached VISIBLE (object id, one report per object). */
  onAssetReady?: (objectId: string) => void;
  /** Reports that THIS object's model failed and fell back (object id). */
  onAssetFailed?: (objectId: string) => void;
}) {
  const ref = useRef<THREE.Group>(null);
  const pulseRef = useRef({ key: "", elapsed: 0, strength: 0 });

  const targetPos = useMemo(
    () => new THREE.Vector3(object.position.x, object.position.y, object.position.z),
    [object.position.x, object.position.y, object.position.z],
  );
  const targetScale = useMemo(
    () => new THREE.Vector3(object.scale.x, object.scale.y, object.scale.z),
    [object.scale.x, object.scale.y, object.scale.z],
  );

  const rotX = object.rotation.x;
  const rotY = object.rotation.y;
  const rotZ = object.rotation.z;
  const orbit = object.orbit;
  const oscillation = object.oscillation;
  const orbitCenterVec = useMemo(
    () => (orbit && orbitCenter ? new THREE.Vector3(orbitCenter.x, orbitCenter.y, orbitCenter.z) : null),
    [orbit, orbitCenter?.x, orbitCenter?.y, orbitCenter?.z],
  );
  const oscillationPivotVec = useMemo(
    () => (oscillation && oscillationPivot ? new THREE.Vector3(oscillationPivot.x, oscillationPivot.y, oscillationPivot.z) : null),
    [oscillation, oscillationPivot?.x, oscillationPivot?.y, oscillationPivot?.z],
  );
  const orbitAxis = useMemo(() => (orbit ? new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), (orbit.tiltDeg * Math.PI) / 180) : null), [orbit]);
  const spin = object.motion?.kind === "spin";
  const spinAxis = object.motion?.spinAxis ?? "y";
  const spinSpeedDegPerSec = object.motion?.spinSpeedDegPerSec ?? 45;
  const highlight = object.highlight;
  const pulse = object.pulse;
  const pulseKey = pulse ? `${pulse.color}:${pulse.amplitude}:${pulse.periodMs}:${pulse.durationMs}` : "";
  const ghost = object.opacity < 1;

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;
    // Frame-rate independent damping: identical feel at 30fps and 144fps.
    const factor = 1 - Math.pow(0.0008, Math.min(delta, 0.1));
    const step = Math.min(delta, 0.1);

    if (orbit && orbitCenterVec) {
      // Continuous orbital motion (planets, electrons, packets circling a router).
      const angle = (state.clock.elapsedTime * orbit.speedDegPerSec * Math.PI) / 180;
      const local = new THREE.Vector3(Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius);
      if (orbitAxis) local.applyAxisAngle(orbitAxis, (orbit.tiltDeg * Math.PI) / 180);
      local.add(orbitCenterVec);
      group.position.lerp(local, 1 - Math.pow(0.02, step));
    } else if (oscillation && oscillationPivotVec) {
      // Swing around a pivot: the object keeps its distance from the pivot and rotates about the
      // requested axis, which is exactly a pendulum bob, a rocker or a swinging rod.
      const arm = targetPos.clone().sub(oscillationPivotVec);
      const period = Math.max(0.05, oscillation.periodMs / 1000);
      const angle = Math.sin((state.clock.elapsedTime / period) * Math.PI * 2) * (oscillation.amplitudeDeg * Math.PI) / 180;
      const axis = oscillation.axis;
      const axisVector = new THREE.Vector3(axis === "x" ? 1 : 0, axis === "y" ? 1 : 0, axis === "z" ? 1 : 0);
      arm.applyAxisAngle(axisVector, angle);
      group.position.lerp(oscillationPivotVec.clone().add(arm), 1 - Math.pow(0.02, step));
      group.rotation.set(rotX, rotY, rotZ);
      if (axis === "z") group.rotation.z = rotZ + angle;
      else if (axis === "x") group.rotation.x = rotX + angle;
      else group.rotation.y = rotY + angle;
      group.scale.lerp(targetScale, factor);
      applyPulse(group, pulseRef, pulseKey, pulse, step, factor, targetScale);
      return;
    } else {
      group.position.lerp(targetPos, factor);
    }

    if (spin) {
      // animate_spin honours the requested axis and angular speed.
      const radians = (spinSpeedDegPerSec * Math.PI) / 180 * step;
      if (spinAxis === "x") group.rotation.x += radians;
      else if (spinAxis === "z") group.rotation.z += radians;
      else group.rotation.y += radians;
    } else {
      group.rotation.set(
        THREE.MathUtils.lerp(group.rotation.x, rotX, factor),
        THREE.MathUtils.lerp(group.rotation.y, rotY, factor),
        THREE.MathUtils.lerp(group.rotation.z, rotZ, factor),
      );
    }
    applyPulse(group, pulseRef, pulseKey, pulse, step, factor, targetScale);
  });

  if (!object.visible) return null;

  const content = (() => {
    if (object.type === "model") {
      return (
        <AssetModel
          asset={object.asset ?? ""}
          scale={1}
          color={highlight ? undefined : object.color}
          part={object.part}
          highlight={highlight}
          highlightColor={object.highlightColor}
          highlightPart={object.highlightPart}
          isolatePart={object.isolatePart}
          hiddenParts={object.hiddenParts}
          explodeOffsets={object.explodeOffsets}
          opacity={object.opacity}
          onReady={onAssetReady ? () => onAssetReady(object.id) : undefined}
          onFailure={(asset) => { onAssetFailure?.(asset); onAssetFailed?.(object.id); }}
        />
      );
    }
    return (
      <>
        {renderGeometry(object, shell === true)}
        {highlight && <HighlightHalo object={object} />}
      </>
    );
  })();

  return (
    <group ref={ref} name={object.id} position={targetPos} rotation={[rotX, rotY, rotZ]} scale={targetScale}>
      {content}
    </group>
  );
}

export const SceneObject = React.memo(SceneObjectImpl);

/**
 * The generic pulse: a temporary beat that grows the object slightly and then fades itself out, so
 * "look at this for a moment" costs one action instead of three.
 */
function applyPulse(
  group: THREE.Group,
  ref: React.MutableRefObject<{ key: string; elapsed: number; strength: number }>,
  key: string,
  pulse: Visual3DObject["pulse"],
  step: number,
  factor: number,
  targetScale: THREE.Vector3,
): void {
  if (ref.current.key !== key) {
    ref.current = { key, elapsed: 0, strength: pulse ? 1 : 0 };
  }
  const durationMs = pulse ? pulse.durationMs : 0;
  if (pulse) {
    ref.current.elapsed += step * 1000;
    if (durationMs > 0 && ref.current.elapsed >= durationMs) {
      ref.current.key = "";
      ref.current.strength = 0;
    }
  }
  const beat = ref.current.strength > 0
    ? 0.5 + 0.5 * Math.sin(((ref.current.elapsed % Math.max(120, pulse?.periodMs ?? 900)) / Math.max(120, pulse?.periodMs ?? 900)) * Math.PI * 2)
    : 0;
  const amount = beat * (pulse?.amplitude ?? 0);
  if (amount > 0.0005) {
    group.scale.set(
      targetScale.x * (1 + amount),
      targetScale.y * (1 + amount),
      targetScale.z * (1 + amount),
    );
  } else if (!pulse) {
    group.scale.lerp(targetScale, factor);
  }
}

// Opacity of a containing surface drawn as glass. Low enough that two or three nested shells
// (an atom's shells, a cell and its nucleus) never fog the viewport into a flat wash.
const SHELL_OPACITY = 0.3;

// A soft glow shell + pulse so any object can be highlighted without knowing what it represents.
function HighlightHalo({ object }: { object: Visual3DObject }) {
  const ref = useRef<THREE.Mesh>(null);
  const color = useMemo(() => new THREE.Color(object.highlightColor), [object.highlightColor]);
  const radius = Math.max(object.radius, 0.1);
  useFrame((state) => {
    if (!ref.current) return;
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3.2) * 0.06;
    ref.current.scale.setScalar(pulse);
    const material = ref.current.material as THREE.MeshBasicMaterial;
    material.opacity = 0.18 + Math.sin(state.clock.elapsedTime * 3.2) * 0.05;
  });
  return (
    <mesh ref={ref} scale={radius * 2.1} renderOrder={2}>
      <sphereGeometry args={[0.5, 20, 16]} />
      <meshBasicMaterial color={color} transparent opacity={0.2} depthWrite={false} side={THREE.BackSide} />
    </mesh>
  );
}

/**
 * CANONICAL PROCEDURAL GEOMETRY.
 *
 * Every primitive is authored at its SCALE-1 SIZE and sized entirely by the group's `scale` prop.
 * Sizing the geometry from `object.scale` as well made every primitive scale twice (a sphere asked
 * for at scale 2.5 rendered with radius 6.25, not 2.5), so the geometry on screen disagreed with the
 * radius the engine used for camera framing, orbit radii and explode offsets. The engine's radius is
 * the single source of truth, and the renderer now honours it exactly.
 *
 * THE MATERIAL IS A SIBLING OF THE GEOMETRY, never its child. react-three-fiber attaches a material
 * to its IMMEDIATE parent, so `<sphereGeometry><meshStandardMaterial/></sphereGeometry>` silently set
 * `geometry.material` and left the mesh on Three.js's default — an unlit, pure-white basic material.
 * Every procedural primitive in the whole 3D system was therefore rendering as a white blob: an
 * atom's coloured shells, a stack's cells, a pendulum's rod, a cylinder's base. Asking for red and
 * getting white was not a palette problem, the colour never reached the mesh.
 *
 * `shell` marks a primitive that geometrically CONTAINS other objects (an atom's electron shell, a
 * cell membrane, an orbit envelope). A containing surface is drawn translucent with `depthWrite`
 * off so the student sees the thing inside it — an opaque shell hides the entire lesson.
 */
function renderGeometry(object: Visual3DObject, shell = false): React.ReactNode {
  const color = object.color ?? "#94a3b8";
  // `object.scale` is applied by the wrapping <group>; geometry below is authored at scale 1.
  //
  // A shell is drawn as glass: only its FAR hemisphere, so the near surface never veils the contents,
  // and the bright silhouette of the far side reads unmistakably as a sphere. Double-sided glass at
  // low opacity stacks two tinted layers per shell, so two nested shells fogged the whole viewport —
  // the atom lost its nucleus behind its own electron shells.
  const material = (roughness: number, metalness = 0.05) => (
    <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} transparent={shell} opacity={shell ? SHELL_OPACITY : 1} depthWrite={!shell} side={shell ? THREE.BackSide : THREE.FrontSide} />
  );
  const mesh = (geometry: React.ReactNode, roughness: number, metalness = 0.05, extra?: Record<string, unknown>) => (
    <mesh castShadow={!shell} receiveShadow={!shell} {...extra}>
      {geometry}
      {material(roughness, metalness)}
    </mesh>
  );

  switch (object.type) {
    case "sphere":
      return mesh(<sphereGeometry args={[1, 40, 28]} />, 0.5);
    case "box":
      return mesh(<boxGeometry args={[1, 1, 1]} />, 0.55);
    case "cylinder":
      return mesh(<cylinderGeometry args={[0.5, 0.5, 1, 40]} />, 0.5);
    case "cone":
      return mesh(<coneGeometry args={[0.5, 1, 40]} />, 0.55);
    case "torus":
      return mesh(<torusGeometry args={[0.5, 0.18, 20, 48]} />, 0.45, 0.1);
    case "plane":
      return (
        <mesh castShadow={!shell} receiveShadow={!shell} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color={color} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      );
    case "arrow":
      return <ArrowGeometry color={color} />;
    case "particle":
      return mesh(<sphereGeometry args={[1, 12, 10]} />, 0.6, 0);
    case "tube":
      // A ring (orbit path, loop, track). Tube thickness is a fraction of the ring radius so it stays
      // a RING at every size instead of collapsing to an invisible hairline.
      return mesh(<torusGeometry args={[0.5, 0.5, 16, 60]} />, 0.5);
    case "line":
      return mesh(<cylinderGeometry args={[0.02, 0.02, 1, 8]} />, 0.6, 0, { rotation: [-Math.PI / 2, 0, 0] as [number, number, number] });
    case "molecule":
      return <MoleculeGeometry count={5} color={color} radius={0.5} />;
    case "crystal":
      return (
        <mesh castShadow={!shell} receiveShadow={!shell}>
          <octahedronGeometry args={[0.6, 0]} />
          <meshStandardMaterial color={color} roughness={0.25} metalness={0.15} flatShading transparent={shell} opacity={shell ? 0.25 : 1} depthWrite={!shell} />
        </mesh>
      );
    case "text":
      return <FallbackPrimitive type="text" scale={1} color={color} />;
    default:
      return mesh(<sphereGeometry args={[0.5, 20, 16]} />, 0.6);
  }
}

function ArrowGeometry({ color }: { color: string }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45, emissive: new THREE.Color(color), emissiveIntensity: 0.12 }), [color]);
  // Canonical arrow: a unit-length shaft with a proportionate head, sized entirely by the parent
  // group's scale (the object radius).
  const headLength = 0.35;
  const shaftRadius = 0.05;
  const headRadius = shaftRadius * 3;
  return (
    <group>
      <mesh position={[0, (1 - headLength) / 2, 0]} material={material} castShadow>
        <cylinderGeometry args={[shaftRadius, shaftRadius, 1 - headLength, 16]} />
      </mesh>
      <mesh position={[0, 1 - headLength / 2, 0]} material={material} castShadow>
        <coneGeometry args={[headRadius, headLength, 18]} />
      </mesh>
    </group>
  );
}

function MoleculeGeometry({ count, color, radius }: { count: number; color: string; radius: number }) {
  const atomMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4, metalness: 0.25 }),
    [color],
  );
  const nodes = useMemo(() => {
    const out: Array<[number, number, number]> = [[0, 0, 0]];
    for (let i = 1; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      out.push([Math.cos(angle) * radius, Math.sin(angle * 1.7) * radius * 0.5, Math.sin(angle) * radius]);
    }
    return out;
  }, [count, radius]);

  return (
    <group>
      {nodes.map((node, index) => (
        <mesh key={`atom-${index}`} position={node} material={atomMaterial} castShadow>
          <sphereGeometry args={[index === 0 ? radius * 0.42 : radius * 0.3, 18, 14]} />
        </mesh>
      ))}
      {nodes.map((node, index) => {
        const next = nodes[(index + 1) % nodes.length];
        const start = new THREE.Vector3(...node);
        const end = new THREE.Vector3(...next);
        const direction = end.clone().sub(start);
        const length = direction.length();
        if (length < 1e-4) return null;
        const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
        return (
          <mesh key={`bond-${index}`} position={start.clone().add(end).multiplyScalar(0.5)} quaternion={quaternion} material={atomMaterial} castShadow>
            <cylinderGeometry args={[radius * 0.06, radius * 0.06, length, 8]} />
          </mesh>
        );
      })}
    </group>
  );
}
