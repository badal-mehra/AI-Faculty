"use client";

// ASSET GALLERY — a contact sheet of every shipped model, each framed on its own.
//
// This exists so asset quality can be judged by LOOKING rather than by file size or triangle count. A
// 220KB heart and a 4KB periodic tile can both pass every automated check while one of them teaches
// nothing; the only way to tell is to see the model the student will actually be shown. It is also the
// regression surface: after changing a generator, re-run the gallery and compare the same sheet.
//
//   /demo/assets?from=0&to=12     a page of models
//   /demo/assets?asset=biology/heart   one model, full size

import { useEffect, useMemo, useState, Suspense } from "react";
import { GENERATED_ASSETS } from "@/lib/visual3d/generatedAssets";
import { Visual3DScene, emptyVisual3DScene } from "@/lib/visual3d/types";
import { applyVisual3DActions } from "@/lib/visual3d/engine";
import { Scene3D } from "@/components/visual3d/Scene3D";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

const PER_PAGE = 12;

/** One framed model. Anchors are labelled so a broken or missing anchor is visible, not inferred. */
function buildScene(assetId: string, withAnchors: boolean): Visual3DScene {
  const asset = GENERATED_ASSETS.find((entry) => entry.id === assetId);
  const actions: unknown[] = [
    { action: "create_3d_object", id: "asset", type: "model", asset: assetId, scale: 1 },
    { action: "frame_camera" },
  ];
  // Two or three anchors only: labelling all eleven of a heart's parts at thumbnail size produces an
  // unreadable matting of text that hides the very geometry it is meant to describe.
  const names = asset ? asset.semanticAnchors.slice(0, 3) : [];
  if (withAnchors) {
    names.forEach((part, index) => {
      actions.push({ action: "show_3d_label", id: `lbl${index}`, target: "asset", part, text: part });
    });
  }
  const parsed = actions as never;
  return applyVisual3DActions(emptyVisual3DScene(), parsed);
}

// `useSearchParams` opts a route out of static prerendering unless it sits under a Suspense boundary.
// Without this the page builds and runs in dev but fails the production build outright.
export default function AssetGallery() {
  return (
    <Suspense fallback={<p style={{ padding: 20, color: "#8aa2b2" }}>Loading the asset gallery…</p>}>
      <AssetGalleryInner />
    </Suspense>
  );
}

function AssetGalleryInner() {
  const params = useSearchParams();
  const single = params.get("asset");
  const from = Number(params.get("from") ?? 0);
  const to = Number(params.get("to") ?? from + PER_PAGE);

  const [scenes, setScenes] = useState<Record<string, Visual3DScene>>({});
  const [ready, setReady] = useState(false);

  const ids = useMemo(() => {
    if (single) return [single];
    return GENERATED_ASSETS.map((entry) => entry.id).slice(from, to);
  }, [from, single, to]);

  useEffect(() => {
    const next: Record<string, Visual3DScene> = {};
    for (const id of ids) next[id] = buildScene(id, Boolean(single));
    setScenes(next);
    setReady(true);
  }, [ids, single]);

  const total = GENERATED_ASSETS.length;
  const page = ids.map((id) => GENERATED_ASSETS.find((entry) => entry.id === id)).filter(Boolean);

  return (
    <main style={{ minHeight: "100vh", background: "#0d1218", color: "#d7e5ee", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ padding: "14px 20px", borderBottom: "1px solid #24333d", display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
        <h1 style={{ margin: 0, fontSize: 17 }}>Asset gallery</h1>
        <span style={{ color: "#8aa2b2", fontSize: 12 }}>
          {total} shipped models · showing {from + 1}–{Math.min(to, total)}
        </span>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 10, fontSize: 12 }}>
          <Link href={`/demo/assets?from=${Math.max(0, from - PER_PAGE)}&to=${Math.max(0, from - PER_PAGE) + PER_PAGE}`} style={{ color: "#9fe0b5" }}>← prev</Link>
          <Link href={`/demo/assets?from=${from + PER_PAGE}&to=${from + PER_PAGE * 2}`} style={{ color: "#9fe0b5" }}>next →</Link>
        </nav>
      </header>

      {!ready ? <p style={{ padding: 20 }}>Loading…</p> : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12, padding: 12 }}>
        {page.map((asset) => asset ? (
          <section key={asset.id} style={{ border: "1px solid #24333d", borderRadius: 12, overflow: "hidden", background: "#111a22" }}>
            <div style={{ height: single ? 520 : 240, position: "relative" }}>
              <Scene3D scene={scenes[asset.id] ?? emptyVisual3DScene()} onError={() => {}} />
            </div>
            <div style={{ padding: "8px 10px", borderTop: "1px solid #24333d" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700 }}>{asset.name}</div>
              <div style={{ fontSize: 11, color: "#7f97a6" }}>{asset.id}</div>
              <div style={{ fontSize: 10.5, color: "#6d8494", marginTop: 3 }}>
                {asset.triangles} tris · {asset.meshCount} meshes · {asset.partCount} anchors ·{" "}
                {(asset.bounds.size[0]).toFixed(2)}×{(asset.bounds.size[1]).toFixed(2)}×{(asset.bounds.size[2]).toFixed(2)}
              </div>
            </div>
          </section>
        ) : null)}
      </div>
    </main>
  );
}