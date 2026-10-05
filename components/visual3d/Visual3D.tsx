"use client";

// VISUAL3D — the public 3D entry point used by the classroom board.
//
// Responsibilities: mount the scene, expose loading / diagnostics HUD, report asset failures and
// WebGL failure to the caller (which degrades Auto mode to the 2D diagram), and clean up GPU
// resources on unmount. It contains no topic-specific logic.

import { useCallback, useEffect, useRef, useState } from "react";
import { Visual3DScene } from "@/lib/visual3d/types";
import { Scene3D, Scene3DErrorBoundary } from "./Scene3D";
import { clearAssetFailures, getAssetFailures, onAssetFailure } from "./diagnostics";

export function Visual3D({
  scene,
  className,
  onFallback,
  showDiagnostics = false,
}: {
  scene: Visual3DScene;
  className?: string;
  /** Called when the 3D path is unavailable so Auto mode can fall back to 2D. */
  onFallback?: (reason: string) => void;
  showDiagnostics?: boolean;
}) {
  const [failures, setFailures] = useState<string[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleAssetFailure = useCallback((asset: string) => {
    if (mounted.current) setFailures((current) => (current.includes(asset) ? current : [...current, asset]));
  }, []);

  const handleWebglError = useCallback((available: boolean) => {
    // Scene3D reports its probe result, not just failures: only an UNAVAILABLE context degrades.
    if (!available) onFallback?.("webgl-unavailable");
  }, [onFallback]);

  // The scene itself reported that it cannot produce a visible result (no model loaded and no
  // visible geometry with real bounds). Degrading to the 2D diagram beats an empty black stage.
  const handleUnusable = useCallback((reason: string) => {
    onFallback?.(reason);
  }, [onFallback]);

  // Live diagnostics subscription (dev HUD + automated tests) and cleanup of the failure log.
  useEffect(() => {
    setFailures(getAssetFailures().map((failure) => failure.assetId));
    const unsubscribe = onAssetFailure((failure) => handleAssetFailure(failure.assetId));
    return () => {
      unsubscribe();
      clearAssetFailures();
    };
  }, [handleAssetFailure, scene.lessonId]);

  return (
    <div className={`scene3d-wrap ${className ?? ""}`} data-testid="visual3d">
      <Scene3DErrorBoundary onError={() => onFallback?.("renderer-crash")}>
        <Scene3D scene={scene} onError={handleWebglError} onAssetFailure={handleAssetFailure} onUnusable={handleUnusable} />
      </Scene3DErrorBoundary>
      {showDiagnostics && (failures.length > 0 || scene.bounds) ? (
        <div className="scene3d-hud" data-testid="visual3d-hud">
          <span>{scene.objects.length} objects</span>
          <span>{scene.flows.length} flows</span>
          <span>{scene.labels.length} labels</span>
          {scene.bounds ? <span>radius {scene.bounds.radius.toFixed(2)}</span> : null}
          {failures.map((asset) => (
            <span key={asset} className="is-warn" title="Model failed to load; primitive fallback is being used">
              fallback: {asset}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default Visual3D;
