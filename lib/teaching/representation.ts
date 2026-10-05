// EXPLICIT REPRESENTATION INTENT.
//
// A student who says "draw", "on the board", "2D diagram", "whiteboard", "flowchart" or "diagram" has
// told us how they want the idea shown. That decision is made BEFORE any provider is called and
// BEFORE assets are scored, so a catalogue model can never quietly overrule it: "draw an array of four
// cells" must not be illustrated with a biological cell, and "show me the pipeline" must not turn into
// a 3D machine.
//
// The rules are deliberately narrow. Silence means "the teacher decides", so an ordinary question
// ("explain TCP") still gets whatever representation actually teaches the topic best.
import { AssetSelection, selectAssetsForLesson, subjectOfVocabulary } from "./assetSelection";
import { TeachingSubject, classifyTeachingIntent } from "./intent";

export type RepresentationIntent = "2d" | "3d" | null;

// Wording that names a flat, schematic drawing. Each phrase is about REPRESENTATION, never about topic.
const EXPLICIT_2D: RegExp[] = [
  /\b2\s?d\b/i,
  /\btwo[- ]dimensional\b/i,
  /\bwhiteboard\b/i,
  /\bwhite[- ]board\b/i,
  /\bblackboard\b/i,
  /\bchalkboard\b/i,
  /\bdiagram(s)?\b/i,
  /\bflow ?chart\b/i,
  /\bflow ?diagram\b/i,
  /\bhand[- ]?drawn?\b/i,
  /\bsketch\b/i,
  /\bschema(tic)?\b/i,
  /\bnotation\b/i,
  /\bpseudo[- ]?code\b/i,
  /\bscreen\b/i,
  /\blayout\b/i,
  /\bchart\b/i,
  /\btable\b/i,
];

// Wording that asks for a real object in space.
const EXPLICIT_3D: RegExp[] = [
  /\b3\s?d\b/i,
  /\bthree[- ]dimensional\b/i,
  /\bin space\b/i,
  /\brealistic\b/i,
  /\brotate (?:it|the|this)\b/i,
  /\bspin (?:it|the|this)\b/i,
  /\bfrom all (?:sides|angles)\b/i,
];

// Phrases that ask for something drawn on the board without naming a representation. "draw" is only
// an instruction to DRAW, and drawing is the 2D board — so it counts, as long as nothing asks for 3D.
const DRAW_REQUEST: RegExp[] = [
  /^\s*draw\b/i,
  /\b(?:please\s+)?draw\s+(?:me|an?|the|it|this|these|those)\b/i,
  /\bon the board\b/i,
  /\bwrite (?:it|this|them) on the board\b/i,
  /\bshow (?:it|this|me) on the board\b/i,
  /\bsketch (?:it|this|out)\b/i,
];

/**
 * What the student's own wording says about representation.
 * An explicit 3D request always wins; otherwise any flat-drawing wording — including a plain request
 * to draw something — is a 2D request.
 */
export function detectRepresentationIntent(question: string): RepresentationIntent {
  const text = question.trim();
  if (!text) return null;
  if (EXPLICIT_3D.some((pattern) => pattern.test(text))) return "3d";
  if (EXPLICIT_2D.some((pattern) => pattern.test(text))) return "2d";
  if (DRAW_REQUEST.some((pattern) => pattern.test(text))) return "2d";
  return null;
}

/**
 * Data structures and protocols are SCHEMATIC ideas. A 3D model of them is decoration, not teaching,
 * so the classroom keeps them on the 2D board even when the student did not say "2D" — this is the same
 * vocabulary rule assetSelection already uses, reused here as a routing decision.
 */
const SCHEMATIC_SUBJECTS = new Set<TeachingSubject>(["programming", "computer-science", "networking"]);
const SCHEMATIC_WORDS: RegExp[] = [
  /\b(?:linked list|doubly linked|circular linked|binary search tree|\btrees?\b|graphs?|arrays?|stacks?|queues?|hash ?tables?|heaps?|tries?|graphs?|adjacency|matrix|matrices)\b/i,
  /\bhandshake|three[- ]way|\bsyn[- ]?ack\b|sequence diagram|protocol|packet|lifecycle|state (?:machine|transition)|automaton|flow ?chart|pipeline|recursion|stack frame/i,
  /\bdata structure|algorithm|pointer|traversal|breadth[- ]first|depth[- ]first/i,
];

function looksSchematic(question: string): boolean {
  if (SCHEMATIC_WORDS.some((pattern) => pattern.test(question))) return true;
  // Subject-only vocabulary is already a strong signal: "cells" in a computing question is an array.
  return subjectOfVocabulary(question) === "computer-science" && /\b(?:cells?|nodes?|values?|indices?|elements?)\b/i.test(question);
}

/**
 * The one decision the classroom needs before it does anything else: is this a 2D board lesson?
 *
 * Used to (a) pin the classroom's view mode and (b) tell the provider that the student named a
 * representation, so it builds a schematic instead of reaching for a model.
 */
export function prefersTwoDimensionalBoard(question: string): boolean {
  const intent = detectRepresentationIntent(question);
  if (intent === "3d") return false;
  if (intent === "2d") return true;
  const classified = classifyTeachingIntent(question);
  return SCHEMATIC_SUBJECTS.has(classified.subject) && looksSchematic(question);
}

/**
 * Asset selection with representation intent applied. A student who asked for a flat drawing gets NO
 * 3D models at all, which is the only reliable way to guarantee "an array of four cells" cannot be
 * illustrated with a biological cell.
 */
export function selectAssetsRespectingIntent(
  question: string,
  options: Parameters<typeof selectAssetsForLesson>[1] = {},
): AssetSelection & { representation: RepresentationIntent } {
  const representation = detectRepresentationIntent(question);
  const selection = selectAssetsForLesson(question, options);
  if (representation !== "2d") return { ...selection, representation };
  return { ...selection, relevant: [], representation };
}

/** One line for the prompt: tells the teacher which representation the student asked for. */
export function representationInstruction(question: string): string | null {
  const intent = detectRepresentationIntent(question);
  if (intent === "2d") {
    return "The student asked for a flat drawing. Build it with board_actions or visual_actions only: send visual3d_actions as an empty array and do not describe a 3D model as the answer.";
  }
  if (intent === "3d") {
    return "The student asked for a 3D view. Use visual3d_actions for this lesson.";
  }
  if (prefersTwoDimensionalBoard(question)) {
    return "This idea is a SCHEMATIC (a structure, a trace, a protocol). Draw it with board_actions or visual_actions: boxes, cells, nodes and arrows teach it, a 3D model would only decorate it.";
  }
  return null;
}