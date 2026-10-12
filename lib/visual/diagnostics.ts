// THE VISUAL DIAGNOSTICS OVERLAY (PHASE 29).
//
// Every visual bug in this system has the same shape: the code says the board is fine, the screenshot
// says it is not, and there is no way to tell which layer is lying. That is why the board went through
// several rounds of "fixes" that moved the problem rather than removing it — the failure was in a
// coordinate that no log line printed.
//
// So the overlay shows the SCENE AS THE LAYOUT ENGINE UNDERSTANDS IT, next to the board the browser
// paints. When the two disagree, the disagreement is visible immediately, which turns a two-hour search
// into a thirty-second read.
//
// It is a DEVELOPMENT TOOL and is compiled out of production. `isDiagnosticsEnabled()` reads a build-time
// flag, so a prop cannot turn it on in a shipped build, and the overlay's own data gathering is not even
// executed there.

import { boxOf, boxOfObject, overlapArea, type Box, type Point, routeConnection, type ConnectionRoute } from "./geometry";
import { contentBox, type VisualViewport } from "./viewport";
import { spacingScale } from "./spacing";
import { maxDrift, groupBounds } from "./align";
import { occupancyOf } from "./balance";
import { labelAttachmentScore } from "./anchors";
import { groupScene, buildComposition, connectionsOf, describeComposition, type Composition } from "./compositionModel";
import { semanticKey } from "./semantics";
import { evaluateVisualQuality, type VisualQualityReport } from "./quality";
import { teachingRatio } from "./animation";
import type { VisualObject, VisualScene } from "./types";

export const DIAGNOSTICS_FLAG = "AI_FACULTY_VISUAL_DIAGNOSTICS";

export function isDiagnosticsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && (env[DIAGNOSTICS_FLAG] === "1" || env[DIAGNOSTICS_FLAG] === "true");
}

/**
 * Everything the overlay shows, for the EXACT scene Classroom is about to render.
 *
 * It takes the scene and nothing else, so it cannot describe a different scene from the one on screen —
 * which was the whole reason the old reporting path was untrustworthy.
 */
export function diagnoseScene(scene: VisualScene, viewport: VisualViewport, options: { focusIds?: string[]; step?: number } = {}): DiagnosticsReport {
  const objects = scene.objects;
  const focusIds = new Set(options.focusIds ?? scene.focusIds ?? []);
  const groups = groupScene(objects);
  const debug = objects.map((object) => {
    const refs = object.refs;
    const relation = (refs ? connectionsOf(objects).find((connection) => connection.id === object.id)?.relation : undefined) ?? "";
    return {
      id: object.id,
      kind: object.kind,
      // The identity the lifecycle derives, so a duplicate or a collision of meaning is visible by eye.
      // Recomputed with the SAME function the engine uses, so this is not a second opinion.
      semanticKey: semanticKey(object),
      group: object.group ?? "",
      lifecycle: object.lifecycle ?? "",
      role: object.role ?? "",
      box: boxOfObject(object),
      centre: { x: object.x, y: object.y },
      anchor: object.anchor ?? "",
      fontSize: object.fontSize,
      labelOf: object.labelOf?.id ?? "",
      labelSide: object.labelOf?.side ?? "",
      text: object.text ?? "",
      textLines: object.textLines ?? [],
      motion: object.motion ? `${object.motion.kind}${object.motion.fromX !== undefined ? " (moving)" : ""}` : "",
      focused: focusIds.has(object.id),
      relation,
    };
  });
  // Routes are read from the SAME router the renderer uses, so a route the overlay draws is a route the
  // browser draws. Recomputing them here with different options would reintroduce exactly the phantom-
  // scene problem this tool exists to eliminate.
  const byId = new Map(objects.map((object) => [object.id, object]));
  const routes = connectionsOf(objects).map((connection) => {
    const from = byId.get(connection.from);
    const to = byId.get(connection.to);
    if (!from || !to) return { id: connection.id, from: connection.from, to: connection.to, relation: connection.relation, points: [], rerouted: false, label: "" };
    const target = objects.find((object) => object.id === connection.id);
    const route = routeFor(from, to, target?.offset ?? 0, obstaclesFor(objects, from, to));
    return {
      id: connection.id,
      from: connection.from,
      to: connection.to,
      relation: connection.relation,
      points: route.points,
      rerouted: route.rerouted,
      label: target?.text ?? "",
    };
  });
  const compositions = [...groups.entries()]
    .filter(([, members]) => members.length > 0)
    .map(([groupId, members]) => {
    const composition = buildComposition({ groupId, objects: members, viewport });
    const bounds = groupBounds(members);
    return {
      groupId,
      kind: composition.kind,
      description: describeComposition(composition),
      role: composition.role,
      readingDirection: composition.readingDirection,
      bounds,
      attention: members.map((member) => ({ id: member.id, state: member.lifecycle ?? "current" })),
      alignment: composition.alignment,
      alignmentDrift: maxDrift(composition.alignment, members),
    };
  });
  const quality = evaluateVisualQuality({
    scene,
    viewport,
    ...(options.step === undefined ? {} : { step: options.step }),
    ...(options.focusIds === undefined ? {} : { focusIds: options.focusIds }),
  });
  const labels = labelAttachmentScore(objects);
  const spacing = spacingScale(viewport);
  const area = contentBox(viewport);
  return {
    viewport,
    sceneViewport: scene.viewport ?? null,
    viewportMatchesStage: Boolean(scene.viewport) && scene.viewport !== undefined && scene.viewport.width === viewport.width && scene.viewport.height === viewport.height,
    tick: scene.tick,
    objects: debug,
    routes,
    compositions,
    margins: {
      safe: { left: 0, top: 0, right: viewport.width, bottom: viewport.height },
      content: { left: area.left, top: area.top, right: area.right, bottom: area.bottom },
    },
    quality,
    labels,
    occupancy: occupancyOf(objects, viewport),
    spacing,
    teachingRatio: teachingRatio(objects),
    problems: [...quality.problems].sort((a, b) => a.length - b.length).slice(0, 12),
  };
}

function routeFor(from: VisualObject, to: VisualObject, offset: number, obstacles: Box[]): ConnectionRoute {
  return routeConnection(from, to, { offset, obstacles });
}

function obstaclesFor(objects: readonly VisualObject[], from: VisualObject, to: VisualObject): Box[] {
  return objects
    .filter((object) => object.id !== from.id && object.id !== to.id && object.kind === "shape")
    .map((object) => boxOfObject(object));
}

export type DiagnosticsReport = {
  viewport: VisualViewport;
  sceneViewport: VisualViewport | null;
  viewportMatchesStage: boolean;
  tick: number;
  objects: Array<{
    id: string;
    kind: string;
    semanticKey: string;
    group: string;
    lifecycle: string;
    role: string;
    box: Box;
    centre: { x: number; y: number };
    anchor: string;
    fontSize: number | undefined;
    labelOf: string;
    labelSide: string;
    text: string;
    textLines: string[];
    motion: string;
    focused: boolean;
    relation: string;
  }>;
  routes: Array<{
    id: string;
    from: string;
    to: string;
    relation: string;
    points: Array<{ x: number; y: number }>;
    rerouted: boolean;
    label: string;
  }>;
  compositions: Array<{
    groupId: string;
    kind: string;
    description: string;
    role: string;
    readingDirection: string;
    bounds: Box | null;
    attention: Array<{ id: string; state: string }>;
    alignment: any[];
    alignmentDrift: number;
  }>;
  margins: { safe: Box; content: Box };
  quality: ReturnType<typeof evaluateVisualQuality>;
  labels: ReturnType<typeof labelAttachmentScore>;
  occupancy: ReturnType<typeof occupancyOf>;
  spacing: Record<string, number>;
  teachingRatio: number;
  problems: string[];
};

/** A compact, printable summary. A pasted console line is often all a visual bug needs. */
export function summariseDiagnostics(report: DiagnosticsReport): string {
  return [
    `board ${report.viewport.width}x${report.viewport.height}`,
    report.viewportMatchesStage ? "" : ` (scene laid out for ${report.sceneViewport?.width}x${report.sceneViewport?.height})`,
    `tick ${report.tick}`,
    `${report.objects.length} objects in ${report.compositions.length} composition(s): ${report.compositions.map((c) => c.kind).join(", ") || "none"}`,
    `quality ${report.quality.visualQualityScore}/100 ${report.quality.passed ? "pass" : "FAIL"}`,
    `labels ${report.labels.score}`,
    `teaching motion ${Math.round(report.teachingRatio * 100)}%`,
    ...report.problems.slice(0, 4).map((problem) => `  - ${problem}`),
  ].filter(Boolean).join(" · ");
}