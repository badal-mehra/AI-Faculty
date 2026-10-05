"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { Visual3DObject } from "@/lib/visual3d/types";

// Applies a highlight effect to a 3D object: when highlighted, the object's material becomes
// emissive and a subtle glow halo is added. The effect is purely visual and never changes the
// underlying scene state.
export function HighlightEffect({
  object,
  children,
}: {
  object: Visual3DObject;
  children: React.ReactNode;
}) {
  if (!object.highlight) return <>{children}</>;

  const glowColor = new THREE.Color(object.highlightColor ?? "#ffffff");
  const strength = 0.4;

  return (
    <group>
      {children}
      <pointLight
        position={[object.position.x, object.position.y, object.position.z]}
        color={glowColor}
        intensity={2 * strength}
        distance={5}
        decay={2}
      />
      <mesh position={[object.position.x, object.position.y, object.position.z]} scale={object.scale.x * 2.4}>
        <sphereGeometry args={[0.01, 16, 16]} />
        <meshBasicMaterial color={glowColor} transparent opacity={0.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

// Returns a standard material with emissive highlight applied when the object is highlighted.
export function useHighlightMaterial(baseColor: string, highlighted: boolean, highlightColor: string): THREE.MeshStandardMaterial {
  return useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(highlighted ? highlightColor : baseColor),
      emissive: highlighted ? new THREE.Color(highlightColor) : new THREE.Color(0),
      emissiveIntensity: highlighted ? 0.4 : 0,
      roughness: 0.55,
      metalness: 0.1,
    });
    return material;
  }, [baseColor, highlighted, highlightColor]);
}
