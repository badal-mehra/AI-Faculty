"use client";

import { useEffect, useState } from "react";
import { Visual3DScene, emptyVisual3DScene } from "@/lib/visual3d/types";
import { applyVisual3DActions } from "@/lib/visual3d/engine";
import { parseVisual3DActions } from "@/lib/visual3d/validate";
import { Scene3D } from "@/components/visual3d/Scene3D";
import Link from "next/link";

function buildGenericScene(): Visual3DScene {
  const actions = parseVisual3DActions([
    { action: "create_3d_object", id: "center", type: "sphere", position: { x: 0, y: 1, z: 0 }, scale: 1.5, color: "#f5a623", label: "Core" },
    { action: "create_3d_object", id: "cube", type: "box", position: { x: -3, y: 1, z: -2 }, scale: 1.2, color: "#4a90d9" },
    { action: "create_3d_object", id: "pillar", type: "cylinder", position: { x: 3, y: 1, z: 0 }, scale: 1, color: "#57c7e3" },
    { action: "create_3d_object", id: "molecule", type: "model", asset: "chemistry/molecule", position: { x: 0, y: 2.5, z: 2 }, scale: 1 },
    { action: "create_3d_object", id: "arrow", type: "arrow", position: { x: -1.5, y: 1.5, z: 1 }, scale: 1, color: "#e25858" },
    { action: "animate_flow", id: "energy", from: "center", to: "cube", color: "#ffd43b", particleCount: 25, speed: 2, loop: true },
    { action: "animate_flow", id: "data", from: "cube", to: "pillar", color: "#82c9a7", particleCount: 18, speed: 1, loop: true },
    { action: "show_3d_label", id: "coreLbl", target: "center", text: "Energy Core" },
    { action: "show_3d_label", id: "cubeLbl", target: "cube", text: "Processing Unit" },
    { action: "show_3d_label", id: "pillarLbl", target: "pillar", text: "Output Tower" },
    { action: "highlight_3d_object", id: "center", color: "#ffd43b" },
    { action: "focus_camera", target: "center" },
  ]);
  if (!actions) return emptyVisual3DScene();
  return applyVisual3DActions(emptyVisual3DScene(), actions);
}

export default function Generic3DDemo() {
  const [scene, setScene] = useState<Visual3DScene>(emptyVisual3DScene);
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    setScene(buildGenericScene());
  }, []);

  if (!webglAvailable) {
    return (
      <main style={{ padding: 32, color: "#94a3b8" }}>
        <h1>3D Visualization Demo</h1>
        <p>WebGL is not available in this browser. The 3D scene cannot be rendered.</p>
      </main>
    );
  }

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "12px 24px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>3D Visualization Demo — Generic Scene</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Primitive objects, particle flows, labels, and camera focus — all driven by the pure-logic engine.
        </p>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Scene3D scene={scene} onError={setWebglAvailable} />
      </div>
    </main>
  );
}
