"use client";

// Lazy-loading bridge between the generic Visualizer and the Three.js renderer.
//
// This is the single import boundary: React Three Fiber is loaded ONLY when 3D mode is active
// (next/dynamic with ssr:false), and it owns the degrade path. If WebGL is missing, the renderer
// crashes, or the 3D scene turns out to be unusable, `onFallback` fires and the Visualizer swaps in
// the next representation: 2D diagram -> graph -> text.
import dynamic from "next/dynamic";
import type { Visual3DScene } from "@/lib/visual3d/types";

const Visual3D = dynamic(() => import("../visual3d/Visual3D").then((mod) => mod.Visual3D), {
  ssr: false,
  loading: () => <LoadingFallback />,
});

function LoadingFallback() {
  return (
    <section
      style={{
        height: "100%",
        minHeight: "430px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        color: "#94a3b8",
        fontSize: 13,
        background: "radial-gradient(ellipse 100% 70% at 50% 15%, #14251f, #07100e)",
      }}
    >
      {/* Spinning ring loader */}
      <div
        style={{
          width: 36,
          height: 36,
          border: "3px solid #1e3a30",
          borderTopColor: "#72df9b",
          borderRadius: "50%",
          animation: "scene3d-spin .9s linear infinite",
        }}
      />
      <span style={{ color: "#7f9990", letterSpacing: ".05em", fontWeight: 600 }}>
        Initialising 3D renderer…
      </span>
    </section>
  );
}

export function Visual3DWrapper({
  scene,
  onFallback,
}: {
  scene: Visual3DScene;
  onFallback: (reason: string) => void;
}) {
  return <Visual3D scene={scene} onFallback={onFallback} showDiagnostics />;
}
