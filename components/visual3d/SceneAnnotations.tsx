"use client";

// GENERIC EDUCATIONAL OVERLAYS.
//
// Three primitives, no topic-specific code:
//   vector      -> a directed arrow (force, velocity, acceleration, field direction)
//   measurement -> a dimension line with end ticks between two things (radius, height, amplitude)
//   trajectory  -> the path something travels along, with a marker that moves along it
//
// A blood-flow arrow, a gravitational force arrow, a lens focal distance and a projectile arc are
// the same three primitives with different endpoints. The text is NOT drawn here: like the object
// labels it goes through the screen-space DOM overlay, so it stays readable at any camera distance.
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Visual3DAnnotation, Vec3 } from "@/lib/visual3d/types";

const UP = new THREE.Vector3(0, 1, 0);

/** Midpoint of a glyph: the middle of an arrow, of a dimension line, or of a path. */
export function annotationAnchor(annotation: Visual3DAnnotation): Vec3 {
  return {
    x: (annotation.from.x + annotation.to.x) / 2,
    y: (annotation.from.y + annotation.to.y) / 2,
    z: (annotation.from.z + annotation.to.z) / 2,
  };
}

function VectorGlyph({ annotation }: { annotation: Visual3DAnnotation }) {
  const shaft = useRef<THREE.Mesh>(null);
  const head = useRef<THREE.Mesh>(null);
  const transform = useMemo(() => {
    const from = new THREE.Vector3(annotation.from.x, annotation.from.y, annotation.from.z);
    const to = new THREE.Vector3(annotation.to.x, annotation.to.y, annotation.to.z);
    const length = from.distanceTo(to);
    const headLength = Math.min(annotation.headSize, length * 0.45);
    const shaftLength = Math.max(length - headLength, 1e-4);
    const midpoint = from.clone().lerp(to, 0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    const headCenter = to.clone().add(to.clone().sub(from).normalize().multiplyScalar(-headLength / 2));
    return { length, headLength, shaftLength, midpoint, quaternion, headCenter, headRadius: Math.max(annotation.width * 2.4, annotation.headSize * 0.35) };
  }, [annotation.from.x, annotation.from.y, annotation.from.z, annotation.to.x, annotation.to.y, annotation.to.z, annotation.headSize, annotation.width]);

  return (
    <group>
      <mesh ref={shaft} position={transform.midpoint} quaternion={transform.quaternion} renderOrder={4}>
        <cylinderGeometry args={[annotation.width, annotation.width, transform.shaftLength, 12]} />
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.35} roughness={0.35} toneMapped={false} />
      </mesh>
      <mesh ref={head} position={transform.headCenter} quaternion={transform.quaternion} renderOrder={4}>
        <coneGeometry args={[transform.headRadius, transform.headLength, 16]} />
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.45} roughness={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function MeasurementGlyph({ annotation }: { annotation: Visual3DAnnotation }) {
  const transform = useMemo(() => {
    const from = new THREE.Vector3(annotation.from.x, annotation.from.y, annotation.from.z);
    const to = new THREE.Vector3(annotation.to.x, annotation.to.y, annotation.to.z);
    const length = from.distanceTo(to);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(UP, to.clone().sub(from).normalize());
    // End ticks are perpendicular to the dimension line, so the ends read as real measurement marks.
    const tickAxis = new THREE.Vector3().crossVectors(UP, to.clone().sub(from).normalize()).normalize();
    if (tickAxis.lengthSq() < 1e-6) tickAxis.set(1, 0, 0);
    const tick = Math.max(annotation.width * 5, 0.06);
    return {
      length,
      midpoint: from.clone().lerp(to, 0.5),
      quaternion,
      fromTick: from.clone().add(tickAxis.clone().multiplyScalar(tick / 2)),
      fromTickQuaternion: new THREE.Quaternion().setFromUnitVectors(UP, tickAxis),
      toTick: to.clone().sub(tickAxis.clone().multiplyScalar(tick / 2)),
      tick,
    };
  }, [annotation.from.x, annotation.from.y, annotation.from.z, annotation.to.x, annotation.to.y, annotation.to.z, annotation.width]);

  return (
    <group>
      <mesh position={transform.midpoint} quaternion={transform.quaternion} renderOrder={4}>
        <cylinderGeometry args={[annotation.width, annotation.width, Math.max(transform.length, 1e-4), 10]} />
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.22} roughness={0.4} toneMapped={false} />
      </mesh>
      <mesh position={transform.fromTick} quaternion={transform.fromTickQuaternion} renderOrder={4}>
        <cylinderGeometry args={[annotation.width * 1.4, annotation.width * 1.4, transform.tick, 8]} />
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
      <mesh position={transform.toTick} quaternion={transform.fromTickQuaternion} renderOrder={4}>
        <cylinderGeometry args={[annotation.width * 1.4, annotation.width * 1.4, transform.tick, 8]} />
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function TrajectoryGlyph({ annotation }: { annotation: Visual3DAnnotation }) {
  const marker = useRef<THREE.Mesh>(null);
  const curve = useMemo(() => {
    const points = (annotation.points.length >= 2 ? annotation.points : [annotation.from, annotation.to])
      .map((point) => new THREE.Vector3(point.x, point.y, point.z));
    return points.length >= 2 ? new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.25) : null;
  }, [annotation.points, annotation.from, annotation.to]);

  const tube = useMemo(() => {
    if (!curve) return null;
    return new THREE.TubeGeometry(curve, Math.max(24, curve.getLength() * 12), annotation.width * 1.6, 8, false);
  }, [curve, annotation.width]);

  useFrame(({ clock }) => {
    const node = marker.current;
    if (!node || !curve) return;
    const duration = annotation.durationMs ? Math.max(0.35, annotation.durationMs / 1000) : Math.max(0.8, 3 / Math.max(0.05, annotation.speed));
    const t = (clock.elapsedTime * annotation.speed % duration) / duration;
    node.position.copy(curve.getPointAt(Math.min(0.999, t)));
  });

  if (!curve || !tube) return null;
  return (
    <group>
      <mesh geometry={tube} renderOrder={3}>
        <meshStandardMaterial color={annotation.color} emissive={annotation.color} emissiveIntensity={0.28} roughness={0.4} toneMapped={false} />
      </mesh>
      {annotation.animate ? (
        <mesh ref={marker} renderOrder={5}>
          <sphereGeometry args={[Math.max(annotation.width * 3.2, 0.045), 12, 10]} />
          <meshBasicMaterial color={annotation.color} toneMapped={false} />
        </mesh>
      ) : null}
    </group>
  );
}

export function SceneAnnotations({ annotations }: { annotations: Visual3DAnnotation[] }) {
  const visible = annotations.filter((annotation) => annotation.visible);
  return (
    <group name="annotations">
      {visible.map((annotation) => {
        if (annotation.kind === "vector") return <VectorGlyph key={annotation.id} annotation={annotation} />;
        if (annotation.kind === "measurement") return <MeasurementGlyph key={annotation.id} annotation={annotation} />;
        return <TrajectoryGlyph key={annotation.id} annotation={annotation} />;
      })}
    </group>
  );
}
