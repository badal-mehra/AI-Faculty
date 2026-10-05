"use client";

// GENERIC FLOW PARTICLES.
//
// One instanced mesh per flow, with configurable direction, speed, count, colour, size, trail,
// looping and curve. Blood, packets, electrons, water droplets and air all use this component —
// the AI chooses the parameters, never the code.
//
//   blood    → round, dense, slow, red, many
//   packet   → small cubes, fast, bright, few, with a trail
//   electron  → tiny glowing points, very fast
//   water    → droplets, medium speed, looping
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { FlowShape, Visual3DFlow } from "@/lib/visual3d/types";

export function FlowParticles({ flow, scaleHint = 1 }: { flow: Visual3DFlow; scaleHint?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.max(1, Math.min(flow.particleCount, 400));
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const curve = useMemo(() => {
    const points = flow.pathPoints.map((p) => new THREE.Vector3(p.x, p.y, p.z));
    if (points.length < 2) return null;
    if (flow.curve === "loop" && points.length >= 3) {
      // Close the loop so a circulating flow never jumps back to its start.
      return new THREE.CatmullRomCurve3([...points, points[0]], true, "catmullrom", 0.4);
    }
    return new THREE.CatmullRomCurve3(points, false, "catmullrom", 0.4);
  }, [flow.pathPoints, flow.curve]);

  const size = Math.max(flow.size * scaleHint, 0.01);
  const color = useMemo(() => new THREE.Color(flow.color), [flow.color]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (!mesh || !curve) return;
    const duration = flow.durationMs ? Math.max(0.4, flow.durationMs / 1000) : Math.max(1, 3.4 / Math.max(0.05, flow.speed));
    const time = (clock.elapsedTime * flow.speed) % duration;
    const progress = time / duration;

    for (let i = 0; i < count; i += 1) {
      const stagger = i / count;
      const t = flow.loop ? (progress + stagger) % 1 : stagger <= progress ? stagger : -1;
      if (t < 0) {
        // Non-looping particles that have not started yet (or already finished) are hidden.
        dummy.position.set(0, -1e6, 0);
        dummy.scale.setScalar(0.0001);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }
      const point = curve.getPointAt(Math.min(0.999, t));
      dummy.position.copy(point);
      if (flow.shape === "arrow" || flow.shape === "cube" || flow.shape === "drop") {
        // Orient travelling shapes along the path so direction is readable.
        const tangent = curve.getTangentAt(Math.min(0.999, t));
        dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent.normalize());
      } else {
        dummy.quaternion.identity();
      }
      // Trail: particles stretch along their direction and fade in/out across their travel.
      const head = 0.35;
      const ramp = flow.trail ? Math.min(1, t / head) * Math.min(1, (1 - t) / head + 0.25) : 1;
      const stretch = flow.trail && (flow.shape === "arrow" || flow.shape === "drop") ? 2.1 : 1;
      dummy.scale.set(size * (0.7 + ramp * 0.5), size * stretch * (0.7 + ramp * 0.5), size * (0.7 + ramp * 0.5));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (!curve) return null;

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} frustumCulled={false} castShadow={false}>
      {shapeGeometry(flow.shape)}
      <meshStandardMaterial
        color={color}
        emissive={flow.shape === "glow" || flow.shape === "cube" ? color : "#000000"}
        emissiveIntensity={flow.shape === "glow" ? 1.2 : flow.shape === "cube" ? 0.45 : 0}
        roughness={0.35}
        metalness={0.1}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

function shapeGeometry(shape: FlowShape) {
  switch (shape) {
    case "cube":
      return <boxGeometry args={[1, 1, 1]} />;
    case "drop":
      return <coneGeometry args={[0.6, 1.4, 10]} />;
    case "arrow":
      return <coneGeometry args={[0.55, 1.5, 10]} />;
    case "glow":
      return <sphereGeometry args={[0.75, 10, 8]} />;
    default:
      return <sphereGeometry args={[0.8, 12, 10]} />;
  }
}