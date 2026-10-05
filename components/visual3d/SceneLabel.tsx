"use client";

// LABEL LAYER.
//
// Labels are drawn in ONE screen-space overlay (never inside the <Canvas>, where React elements are
// interpreted as Three.js objects) and positioned imperatively each frame:
//
//   - constant readable pixel size regardless of camera distance (never microscopic, never absurd),
//   - the label tracks its object's REAL live world transform, so a label stays glued to a part that
//     is orbiting, oscillating, exploding or being followed,
//   - a simple declutter pass so simultaneous labels never sit on top of each other,
//   - an SVG leader line from the label back to the object when it has been nudged,
//   - overlay text for vectors / measurements / trajectories is drawn through the same overlay, so
//     physics annotations are as readable as anatomy labels.
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Visual3DLabel, Visual3DObject, Visual3DAnnotation } from "@/lib/visual3d/types";
import { getAsset } from "@/lib/visual3d/assets";

const MIN_FONT = 12;
const MAX_FONT = 19;

type Placement = {
  id: string;
  text: string;
  subtitle?: string;
  color: string;
  scale: number;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  width: number;
  height: number;
  fontSize: number;
  opacity: number;
};

/** Host for the label overlay. Rendered as a SIBLING of the Canvas, never inside it. */
export function SceneLabelHost({ hostRef }: { hostRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={hostRef}
      className="scene-label-layer"
      data-testid="scene-labels"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}
    />
  );
}

/** Runs INSIDE the Canvas: projects objects to screen space and drives the overlay DOM. */
export function SceneLabelDriver({
  labels,
  objects,
  annotations,
  hostRef,
}: {
  labels: Visual3DLabel[];
  objects: Visual3DObject[];
  annotations: Visual3DAnnotation[];
  hostRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { camera, size, scene: threeScene } = useThree();
  const nodes = useRef(new Map<string, { card: HTMLDivElement; line: SVGLineElement; dot: SVGCircleElement }>());
  const svgRef = useRef<SVGSVGElement | null>(null);
  const projected = useMemo(() => new THREE.Vector3(), []);
  const worldPoint = useMemo(() => new THREE.Vector3(), []);

  const byId = useMemo(() => {
    const map = new Map<string, Visual3DObject>();
    for (const object of objects) map.set(object.id, object);
    return map;
  }, [objects]);

  // Object labels and overlay text share one overlay, one declutter pass and one leader-line pass.
  const overlayItems = useMemo(() => {
    const items: Array<{ id: string; label?: Visual3DLabel; annotation?: Visual3DAnnotation }> = labels
      .filter((label) => label.visible)
      .map((label) => ({ id: `label:${label.id}`, label }));
    for (const annotation of annotations) {
      if (!annotation.visible || !annotation.text) continue;
      items.push({ id: `annotation:${annotation.id}`, annotation });
    }
    return items;
  }, [labels, annotations]);

  const visibleIds = useMemo(() => new Set(overlayItems.map((item) => item.id)), [overlayItems]);

  // Create/remove overlay nodes imperatively: one element per item, reused across steps.
  //
  // ALL leader lines share ONE <svg>. Each label used to own a viewport-sized <svg>, so a scene with
  // thirty anatomical labels stacked thirty full-screen compositing layers over the canvas — which
  // slowed every frame and, because each layer repainted when its line moved, kept the GPU busy for
  // lines that were mostly invisible.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!svgRef.current) {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("style", "position:absolute;inset:0;width:100%;height:100%");
      svg.setAttribute("data-testid", "scene-leader-lines");
      host.appendChild(svg);
      svgRef.current = svg;
    }
    const svg = svgRef.current;
    for (const [id, node] of nodes.current) {
      if (!visibleIds.has(id)) {
        node.card.remove();
        node.line.remove();
        node.dot.remove();
        nodes.current.delete(id);
      }
    }
    for (const item of overlayItems) {
      if (nodes.current.has(item.id)) continue;
      const text = item.label?.text ?? item.annotation?.text ?? "";
      const subtitle = item.label?.subtitle;
      const card = document.createElement("div");
      card.className = item.annotation ? "scene-label is-annotation" : "scene-label";
      const title = document.createElement("span");
      title.className = "scene-label-title";
      title.textContent = text;
      card.appendChild(title);
      if (subtitle) {
        const subtitleNode = document.createElement("span");
        subtitleNode.className = "scene-label-subtitle";
        subtitleNode.textContent = subtitle;
        card.appendChild(subtitleNode);
      }
      host.appendChild(card);

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("stroke", "rgba(148, 233, 199, 0.75)");
      line.setAttribute("stroke-width", "1.5");
      line.setAttribute("stroke-linecap", "round");
      const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      dot.setAttribute("r", "3");
      dot.setAttribute("fill", "#94e9c7");
      svg.appendChild(line);
      svg.appendChild(dot);

      nodes.current.set(item.id, { card, line, dot });
    }
  }, [overlayItems, visibleIds, hostRef]);

  // Text can change between steps (the same label id reused); keep the DOM in sync.
  useEffect(() => {
    for (const item of overlayItems) {
      const node = nodes.current.get(item.id);
      if (!node) continue;
      const title = node.card.querySelector(".scene-label-title");
      const text = item.label?.text ?? item.annotation?.text ?? "";
      if (title && title.textContent !== text) title.textContent = text;
    }
  }, [overlayItems]);

  useFrame(() => {
    const host = hostRef.current;
    if (!host) return;

    const next: Placement[] = [];
    for (const item of overlayItems) {
      const node = nodes.current.get(item.id);
      if (!node) continue;

      let anchor: THREE.Vector3 | null = null;
      let side: Visual3DLabel["side"] = "right";
      let color = "#f1f5f9";
      let scale = 1;
      let leader = true;

      if (item.annotation) {
        const annotation = item.annotation;
        const mid = {
          x: (annotation.from.x + annotation.to.x) / 2,
          y: (annotation.from.y + annotation.to.y) / 2,
          z: (annotation.from.z + annotation.to.z) / 2,
        };
        anchor = new THREE.Vector3(mid.x, mid.y, mid.z);
        side = "above";
        color = annotation.color;
        leader = false;
      } else {
        const label = item.label!;
        const target = byId.get(label.targetId);
        if (!target) continue;
        anchor = liveAnchor(threeScene, target, label, worldPoint);
        side = label.side ?? "right";
        color = label.color;
        scale = label.size || 1;
        leader = label.leader !== false;
      }
      if (!anchor) continue;

      projected.copy(anchor).project(camera);
      const behind = projected.z > 1;
      const anchorX = (projected.x * 0.5 + 0.5) * size.width;
      const anchorY = (-projected.y * 0.5 + 0.5) * size.height;
      const distance = camera.position.distanceTo(anchor);

      // Fade out when very far away; never render behind the camera.
      const opacity = behind ? 0 : THREE.MathUtils.clamp(1.25 - distance / 90, 0.25, 1);
      // Camera-aware font size: readable at a distance, capped so it never dominates the viewport.
      const fontSize = THREE.MathUtils.clamp(15 - distance * 0.04, MIN_FONT, MAX_FONT) * scale;

      // The clamp has to happen against the label's REAL width. On the first frames after a label is
      // created the browser has not laid it out yet, so `offsetWidth` is 0 and the clamp let the card
      // sit at the right edge of the viewport and run off it ("radius r" clipped in half). Measuring
      // from the text guarantees an upper bound even before layout, and the real width wins when known.
      const text = item.label?.text ?? item.annotation?.text ?? "";
      const subtitle = item.label?.subtitle ?? "";
      const estimatedWidth = Math.max(text.length * 7.8, subtitle.length * 7.4) + 26;
      const cardWidth = Math.max(node.card.offsetWidth, estimatedWidth, 40);
      const cardHeight = Math.max(node.card.offsetHeight, subtitle ? 42 : 24);
      const preferredX = side === "left"
        ? anchorX - cardWidth - 42
        : side === "above" || side === "below"
          ? anchorX - cardWidth / 2
          : anchorX + 42;
      const preferredY = side === "above"
        ? anchorY - cardHeight - 26
        : side === "below"
          ? anchorY + 26
          : anchorY - cardHeight / 2;

      next.push({
        id: item.id,
        text: item.label?.text ?? item.annotation?.text ?? "",
        ...(item.label?.subtitle ? { subtitle: item.label.subtitle } : {}),
        color,
        scale,
        x: THREE.MathUtils.clamp(preferredX, 8, Math.max(8, size.width - cardWidth - 8)),
        y: THREE.MathUtils.clamp(preferredY, 8, Math.max(8, size.height - cardHeight - 8)),
        anchorX,
        anchorY,
        width: cardWidth,
        height: cardHeight,
        fontSize,
        opacity,
      });
      // A leader line is only meaningful for labels that point at something.
      if (!leader) node.line.style.opacity = "0";
    }

    // DECLUTTER. Overlap is tested on the label's real CARD rectangle, not on its left edge: two
    // labels of different widths starting 40px apart were treated as non-overlapping and were painted
    // straight through each other ("Human heart" under "four chambers, one pump"). A label is pushed
    // away from whichever screen edge it is already closest to, so declutter never drains every
    // label off the bottom of the viewport, and a label that cannot be freed is left where it is
    // rather than thrown off screen.
    const GAP = 12;
    const placed: Placement[] = [];
    next.sort((a, b) => a.anchorY - b.anchorY);
    for (const placement of next) {
      const minY = 8;
      const maxY = Math.max(minY, size.height - placement.height - 8);
      placement.y = THREE.MathUtils.clamp(placement.y, minY, maxY);
      for (let guard = 0; guard < 16; guard += 1) {
        const blocker = placed.find((other) => (
          placement.x < other.x + other.width + GAP
          && placement.x + placement.width + GAP > other.x
          && placement.y < other.y + other.height + GAP
          && placement.y + placement.height + GAP > other.y
        ));
        if (!blocker) break;
        const downward = blocker.y + blocker.height + GAP - placement.y;
        const upward = placement.y - (blocker.y - blocker.height - GAP);
        const preferUp = placement.y + placement.height / 2 > size.height / 2;
        const candidate = preferUp ? placement.y - upward : placement.y + downward;
        if (candidate < minY || candidate > maxY) break;
        placement.y = candidate;
      }
      placed.push(placement);
    }

    for (const placement of next) {
      const node = nodes.current.get(placement.id);
      if (!node) continue;
      node.card.style.transform = `translate(${Math.round(placement.x)}px, ${Math.round(placement.y)}px)`;
      node.card.style.fontSize = `${Math.round(placement.fontSize)}px`;
      node.card.style.opacity = `${placement.opacity}`;
      node.card.style.color = placement.color;
      node.card.style.display = placement.opacity <= 0.01 ? "none" : "block";
      const moved = Math.hypot(placement.x - placement.anchorX, placement.y - placement.anchorY);
      const showLeader = !placement.id.startsWith("annotation:") && placement.opacity > 0.02;
      node.line.setAttribute("x1", `${placement.anchorX}`);
      node.line.setAttribute("y1", `${placement.anchorY}`);
      node.line.setAttribute("x2", `${placement.x + placement.width / 2}`);
      node.line.setAttribute("y2", `${placement.y + placement.height / 2}`);
      node.line.style.opacity = showLeader ? `${Math.min(0.8, moved / 140) * placement.opacity}` : "0";
      node.dot.setAttribute("cx", `${placement.anchorX}`);
      node.dot.setAttribute("cy", `${placement.anchorY}`);
      node.dot.style.opacity = showLeader ? `${placement.opacity * 0.9}` : "0";
    }
  });

  return null;
}

const anchorVector = new THREE.Vector3();

/**
 * The world point a label is pinned to.
 *
 * It prefers the object's LIVE transform in the Three.js scene (which already accounts for orbit,
 * oscillation, pulses, explode offsets and any in-flight camera move) and falls back to the engine's
 * measured position when the node is not mounted yet. A named part is resolved through the same
 * matrix, so it stays correct when the model is rotated or scaled.
 */
function liveAnchor(
  threeScene: THREE.Scene,
  object: Visual3DObject,
  label: Visual3DLabel,
  scratch: THREE.Vector3,
): THREE.Vector3 | null {
  const node = threeScene.getObjectByName(object.id);
  const asset = object.asset ? getAsset(object.asset) : undefined;
  const part = label.part ? asset?.anchors[label.part] : undefined;

  if (node) {
    node.getWorldPosition(scratch);
    if (part) {
      scratch.x += part.center.x * object.scale.x;
      scratch.y += part.center.y * object.scale.x;
      scratch.z += part.center.z * object.scale.x;
      return scratch.clone();
    }
    scratch.y += Math.max(object.radius, 0.05) * 0.85;
    return scratch.clone();
  }

  if (part) {
    return anchorVector.set(
      object.position.x + part.center.x * object.scale.x,
      object.position.y + part.center.y * object.scale.x,
      object.position.z + part.center.z * object.scale.x,
    ).clone();
  }
  return anchorVector.set(
    object.position.x,
    object.position.y + object.radius * 0.85,
    object.position.z,
  ).clone();
}
