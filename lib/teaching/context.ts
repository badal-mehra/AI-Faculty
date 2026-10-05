// COMPACT LESSON CONTEXT.
//
// The classroom used to hand the model the full serialized board, diagram and 3D scene on every
// request. Those objects carry renderer-level detail (bounds, camera matrices, motion history,
// particle counts) that the teacher has no use for, and they grow with the lesson.
//
// This module reduces the state to what a teacher actually needs to continue a lesson:
//   what exists, what it is called, how it is related, what is highlighted, and what was said.
// Nothing here is renderer state, and every list is bounded.
import { BoardState } from "../board/types";
import { VisualScene } from "../visual/types";
import { Visual3DScene } from "../visual3d/types";
import { TeachingRequest } from "./types";

export type ContextLevel = "full" | "compact" | "minimal";

export type CompactLessonContext = {
  question: string;
  language: string;
  lessonStep: number;
  studentQuestion?: string;
  /** Compact summary of the live board / diagram / 3D scene. */
  state: Record<string, unknown>;
  /** Most recent speeches, newest last. */
  recentSpeech: string[];
  /** Asset ids currently used by the 3D scene (kept so the model does not lose its models). */
  sceneAssets: string[];
  /** Human-readable asset ids mentioned in recent speech. */
  spokenAssets: string[];
};

const MAX_TEXT = 90;
const MAX_NODES = 24;
const MAX_OBJECTS = 24;
const MAX_FLOWS = 10;
const MAX_LABELS = 12;
const MAX_SPEECH = 4;
const MAX_SPEECH_CHARS = 160;

const clamp = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

function relationSummary(object: {
  id: string;
  relation?: { type: string; objects: string[] };
}): string | undefined {
  if (!object.relation) return undefined;
  const targets = object.relation.objects.join("+");
  const part = "anchorPart" in object.relation ? String((object.relation as { anchorPart?: string }).anchorPart ?? "") : "";
  return `${object.relation.type}:${targets}${part ? `@${part}` : ""}`;
}

/** Reduces the board, diagram and 3D scene to a compact, bounded summary. */
export function compactState(request: TeachingRequest, level: ContextLevel): Record<string, unknown> {
  if (level === "minimal") {
    return { note: "state omitted to fit the token budget; create fresh objects with new ids" };
  }

  const board: BoardState = request.boardState;
  const nodeLimit = level === "full" ? MAX_NODES : 12;
  const boardSummary = {
    nodes: board.nodes.slice(0, nodeLimit).map((node) => `${node.id}=${node.value}`),
    edges: board.edges.slice(0, nodeLimit).map((edge) => `${edge.from}->${edge.to}`),
    texts: board.texts.slice(0, 6).map((text) => clamp(text.text, MAX_TEXT)),
    highlights: board.highlights.slice(0, 8),
  };

  const visual: VisualScene | undefined = request.visualState;
  const visualSummary = visual
    ? {
      objects: visual.objects.slice(0, level === "full" ? MAX_OBJECTS : 10).map((object) => ({
        id: object.id,
        kind: object.shape ?? object.kind,
        text: object.text ? clamp(object.text, MAX_TEXT) : undefined,
      })),
      tick: visual.tick,
    }
    : { objects: [], tick: 0 };

  const scene: Visual3DScene | undefined = request.visualState3d;
  const objectLimit = level === "full" ? MAX_OBJECTS : 12;
  const sceneSummary = scene
    ? {
      objects: scene.objects.slice(0, objectLimit).map((object) => ({
        id: object.id,
        ...(object.asset ? { asset: object.asset } : { type: object.type }),
        ...(object.part ? { part: object.part } : {}),
        ...(relationSummary(object) ? { rel: relationSummary(object) } : {}),
        ...(object.orbit ? { orbit: object.orbit.centerId } : {}),
        ...(object.highlight ? { highlighted: true } : {}),
      })),
      flows: scene.flows.slice(0, MAX_FLOWS).map((flow) => `${flow.id}:${flow.fromId}->${flow.toId}`),
      labels: scene.labels.slice(0, MAX_LABELS).map((label) => `${label.targetId}${label.part ? `@${label.part}` : ""}:${clamp(label.text, 40)}`),
      camera: { mode: scene.camera.mode, fov: Math.round(scene.camera.fov) },
      tick: scene.tick,
    }
    : { objects: [], flows: [], labels: [], camera: { mode: "default", fov: 45 }, tick: 0 };

  return { board: boardSummary, diagram: visualSummary, scene3d: sceneSummary };
}

/** Extracts the asset ids already on screen so selection can pin them. */
export function sceneAssetIds(request: TeachingRequest): string[] {
  const scene = request.visualState3d;
  if (!scene) return [];
  return Array.from(new Set(scene.objects.map((object) => object.asset).filter((id): id is string => Boolean(id))));
}

/** The most recent speeches, bounded. */
export function recentSpeech(request: TeachingRequest, level: ContextLevel): string[] {
  const all = request.previousTeaching ?? [];
  if (level === "minimal") return all.slice(-1).map((text) => clamp(text, MAX_SPEECH_CHARS));
  const limit = level === "full" ? MAX_SPEECH : 2;
  return all.slice(-limit).map((text) => clamp(text, MAX_SPEECH_CHARS));
}

/** Asset ids mentioned in what has already been said, so later steps stay on the same models. */
export function spokenAssetIds(request: TeachingRequest): string[] {
  const text = (request.previousTeaching ?? []).join(" ").toLowerCase();
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(/\b([a-z0-9]+)\/([a-z0-9-]+)\b/g)) found.add(`${match[1]}/${match[2]}`);
  return Array.from(found);
}