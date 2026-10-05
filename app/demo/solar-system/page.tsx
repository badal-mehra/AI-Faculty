"use client";

import { useEffect, useState } from "react";
import { Visual3DScene, emptyVisual3DScene } from "@/lib/visual3d/types";
import { applyVisual3DActions } from "@/lib/visual3d/engine";
import { parseVisual3DActions } from "@/lib/visual3d/validate";
import { Scene3D } from "@/components/visual3d/Scene3D";

function buildSolarSystemScene(): Visual3DScene {
  const actions = parseVisual3DActions([
    { action: "create_3d_object", id: "sun", type: "model", asset: "physics/solar_system", position: { x: 0, y: 1, z: 0 }, scale: 2.2, color: "#f5a623" },
    { action: "create_3d_object", id: "earth", type: "model", asset: "geography/earth", position: { x: 7, y: 1, z: 0 }, scale: 0.9, color: "#4a90d9" },
    { action: "create_3d_object", id: "mars", type: "sphere", position: { x: 12, y: 1, z: 1 }, scale: 0.5, color: "#a0522d" },
    { action: "create_3d_object", id: "venus", type: "sphere", position: { x: 4, y: 1, z: -1 }, scale: 0.45, color: "#d2a679" },
    { action: "animate_flow", id: "orbit-earth", from: "sun", to: "earth", color: "#4a90d9", particleCount: 20, speed: 0.3, loop: true },
    { action: "animate_flow", id: "orbit-mars", from: "sun", to: "mars", color: "#a0522d", particleCount: 15, speed: 0.2, loop: true },
    { action: "animate_flow", id: "orbit-venus", from: "sun", to: "venus", color: "#d2a679", particleCount: 12, speed: 0.4, loop: true },
    { action: "show_3d_label", id: "sunLbl", target: "sun", text: "Sun" },
    { action: "show_3d_label", id: "earthLbl", target: "earth", text: "Earth" },
    { action: "show_3d_label", id: "marsLbl", target: "mars", text: "Mars" },
    { action: "show_3d_label", id: "venusLbl", target: "venus", text: "Venus" },
    { action: "highlight_3d_object", id: "earth", color: "#60c5f1" },
    { action: "move_camera", position: { x: 5, y: 6, z: 14 }, target: { x: 0, y: 1, z: 0 }, fov: 60 },
  ]);
  if (!actions) return emptyVisual3DScene();
  return applyVisual3DActions(emptyVisual3DScene(), actions);
}

export default function SolarSystemDemo() {
  const [scene, setScene] = useState<Visual3DScene>(emptyVisual3DScene);
  const [webglAvailable, setWebglAvailable] = useState(true);

  useEffect(() => {
    setScene(buildSolarSystemScene());
  }, []);

  if (!webglAvailable) {
    return (
      <main style={{ padding: 32, color: "#94a3b8" }}>
        <h1>Solar System Demo</h1>
        <p>WebGL is not available in this browser. The 3D scene cannot be rendered.</p>
      </main>
    );
  }

  return (
    <main style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ padding: "12px 24px", background: "#1e293b", borderBottom: "1px solid #334155" }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>3D Visualization Demo — Solar System</h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#94a3b8" }}>
          Procedural planets with orbital particle flows, showing the asset registry (physics/solar_system, geography/earth).
        </p>
      </header>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Scene3D scene={scene} onError={setWebglAvailable} />
      </div>
    </main>
  );
}
