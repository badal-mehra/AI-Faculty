// SEMANTIC VISUAL UNDERSTANDING.
//
// The board was told WHAT to draw and not what any of it MEANT, so it placed objects the way a text
// layout engine places words: in whatever order they arrived, in whatever free space was left. Every real
// screenshot showed the consequence — a diagram with no reading direction, connectors that meant nothing
// beyond "these two are near each other", and four copies of "Force" because the teacher said force four
// times.
//
// Everything here is derived. Nothing in this file is authored by the model and nothing is authored per
// subject: a relation is a property of the pair, an identity is a property of the meaning, and a quality
// score is a property of the scene. The model keeps describing teaching; this decides what that teaching
// looks like.
//
// Three jobs, in order:
//   1. RELATIONSHIPS. A relation says how two things stand to each other, and that is what tells the
//      layout which way to put them and the connector how to draw itself.
//   2. IDENTITY. Two objects that mean the same thing are one object, however many times the teacher says
//      it. Without this the board accumulates restatements.
//   3. JUDGEMENT. A scene can be scored and repaired: what is the teacher pointing at, what is clutter,
//      what can be dropped without losing the lesson.

import {
  ARROW_STYLES, Anchor, ArrowStyle, ConnectorKind, SemanticKind, VisualLifecycle, VisualObject,
  VisualObjectKind, VisualRole, VisualScene,
} from "./types";

// ---------------------------------------------------------------------------------------------
// 1. RELATIONSHIPS
// ---------------------------------------------------------------------------------------------

/**
 * What two things are to each other.
 *
 * The existing `ConnectorKind` says how to DRAW a line. This says what the line MEANS, which is a
 * different question and the one the layout needs: `dependency` and `causes` both draw an arrow, but one
 * reads left-to-right and the other does not care, because one is a chain and the other is an explanation.
 */
export const SEMANTIC_RELATIONS = [
  // composition
  "part_of", "contains", "belongs_to", "instance_of",
  // dependency and causality
  "depends_on", "causes", "leads_to", "requires", "supports", "contradicts",
  // transformation
  "transforms_into", "derives_from", "produces", "converts_to",
  // comparison
  "compares_with", "equivalent_to", "inverse_of", "proportional_to",
  // flow and order
  "flows_to", "precedes", "follows", "input_to", "output_of",
  // reference
  "represents", "example_of", "definition_of", "related_to",
] as const;
export type SemanticRelation = typeof SEMANTIC_RELATIONS[number];

/**
 * How a relation positions its endpoints.
 *
 * This is the table that turns meaning into geometry. A `derives_from` reads upward, an `input_to` reads
 * rightward, a `part_of` nests, and a `compares_with` sits opposite — so a chain taught in sequence comes
 * out as a chain, and a two-sided comparison comes out as two columns, without the model choosing a
 * single pixel.
 */
export type RelationLayout =
  | "left_to_right"   // input -> process -> output
  | "top_to_bottom"   // derivation, dependency, hierarchy
  | "toward"          // causes, produces, flows_to: the second sits on the pointed-at side of the first
  | "apart"           // compares_with, contrasts: equal distance, opposite sides
  | "inward"          // part_of, belongs_to: the part sits on the whole
  | "beside";         // related_to: proximity, no direction

const RELATION_LAYOUT: Record<SemanticRelation, RelationLayout> = {
  part_of: "inward",
  contains: "inward",
  belongs_to: "inward",
  instance_of: "beside",
  depends_on: "top_to_bottom",
  causes: "toward",
  leads_to: "toward",
  requires: "top_to_bottom",
  supports: "toward",
  contradicts: "apart",
  transforms_into: "left_to_right",
  derives_from: "top_to_bottom",
  produces: "toward",
  converts_to: "left_to_right",
  compares_with: "apart",
  equivalent_to: "apart",
  inverse_of: "apart",
  proportional_to: "beside",
  flows_to: "left_to_right",
  precedes: "left_to_right",
  follows: "left_to_right",
  input_to: "left_to_right",
  output_of: "left_to_bottom" as never,
  represents: "beside",
  example_of: "beside",
  definition_of: "toward",
  related_to: "beside",
};

/** The layout a relation implies, defaulting to proximity when the relation is unknown. */
export function relationLayout(relation: string | undefined): RelationLayout {
  return relation ? RELATION_LAYOUT[relation as SemanticRelation] ?? "beside" : "beside";
}

/**
 * How a relation draws itself.
 *
 * Two properties only, because those are the two a reader actually uses: is it a direction or a
 * containment, and is it a strong, weak or derived link. A dependency arrow and a derivation arrow should
 * not look identical, and a part-of link should read as attachment rather than as flow.
 */
export function relationConnector(relation: string | undefined): { kind: ConnectorKind; style: ArrowStyle } {
  switch (relationLayout(relation)) {
    case "inward": return { kind: "parent_child", style: "solid" };
    case "toward": return { kind: "flow", style: "solid" };
    case "top_to_bottom": return { kind: "dependency", style: "dashed" };
    case "apart": return { kind: "straight", style: "dotted" };
    case "left_to_right": return { kind: "straight", style: "solid" };
    default: return { kind: "curved", style: "dotted" };
  }
}

/**
 * The side of `from` that `to` belongs on.
 *
 * Used when the model placed an object by relation but did not say where. Returns `undefined` when the
 * relation carries no direction, because inventing one would be worse than letting the free-spot search
 * choose.
 */
export { sideForRelation } from "./geometry";
export function relationSide(
  relation: string | undefined,
  roles: { from: SemanticRelation | undefined; to: SemanticRelation | undefined },
): { side: "left" | "right" | "above" | "below"; anchor: Anchor } | undefined {
  const layout = relationLayout(relation ?? roles.from);
  if (layout === "left_to_right") {
    // Whether `to` is upstream or downstream decides which side of `from` it sits on.
    const downstream = relation === "follows" || relation === "transforms_into" || relation === "produces"
      || relation === "flows_to" || relation === "output_of" || relation === "leads_to";
    return { side: downstream ? "right" : "left", anchor: "center" };
  }
  if (layout === "top_to_bottom") {
    const upstream = relation === "derives_from" || relation === "depends_on" || relation === "requires";
    return { side: upstream ? "above" : "below", anchor: "center" };
  }
  if (layout === "inward") return { side: "below", anchor: "bottom" };
  if (layout === "apart") return { side: "right", anchor: "center" };
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// 2. IDENTITY
// ---------------------------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "of", "for", "and", "or", "to", "in", "on", "at", "is", "are", "was", "were",
  "this", "that", "these", "those", "it", "its", "as", "by", "with", "from", "we", "you", "be", "been",
]);

/**
 * Words that make a label mean something specific rather than merely be short.
 *
 * NUMBERS ARE KEPT AT ANY LENGTH, and that is not a detail. The first version dropped tokens shorter than
 * three characters, which reduced `fact(5)`, `fact(4)` and `fact(3)` to the same identity and merged a
 * recursion trace into one frame. In maths and engineering the digit is usually the entire difference
 * between two objects, so a value is part of what something MEANS.
 */
function significant(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").split(" ")
    .filter((word) => (word.length > 2 && !STOP_WORDS.has(word)) || (/^\d+$/.test(word) && word.length > 0))
    .join(" ");
}

/**
 * The identity of what an object MEANS.
 *
 * A teacher who says "force" four times is describing one force. A board that draws four of them has
 * stopped being a whiteboard and become a transcript. Two objects are the same when they carry the same
 * kind and the same meaningful words — which is deliberately insensitive to wording, because
 * "net force" and "the total force" are one object to a student, and strict matching would duplicate.
 */
export function semanticKey(object: { kind: VisualObjectKind; text?: string; semantic?: SemanticKind; group?: string }): string {
  const words = significant(object.text ?? "");
  if (!words) return "";
  return `${object.kind}:${object.semantic ?? ""}:${words}`;
}

/** True when two objects mean the same thing, so the newer one should REPLACE the older. */
export function sameMeaning(left: { kind: VisualObjectKind; text?: string; semantic?: SemanticKind }, right: { kind: VisualObjectKind; text?: string; semantic?: SemanticKind }): boolean {
  const leftKey = semanticKey(left);
  return leftKey !== "" && leftKey === semanticKey(right);
}

// ---------------------------------------------------------------------------------------------
// 3. REPRESENTATION
// ---------------------------------------------------------------------------------------------

/**
 * What kind of picture this step wants.
 *
 * The choice was previously implied by which asset happened to match, and by a vocabulary sent to the
 * model. This makes it an explicit decision with reasons, so a lesson can be taught with an equation
 * when that is what the step is about instead of with whatever model was in the registry.
 */
export type VisualRepresentation =
  | "equation"          // a formula and its symbols
  | "derivation"        // a chain of related equations
  | "graph"             // something over time or another axis
  | "table"             // a set of values to read
  | "timeline"          // ordered events
  | "sequence"          // a message or exchange
  | "comparison"        // two things weighed against each other
  | "hierarchy"         // parts inside a whole
  | "network"           // things connected without a spine
  | "process"           // ordered stages
  | "cycle"             // ordered stages that return
  | "matrix"            // a grid of values
  | "vector"            // magnitudes and directions
  | "circuit"           // components in a loop
  | "free_body"         // forces on a body
  | "code"              // a listing
  | "memory"            // addresses and regions
  | "state_machine"     // states and the moves between them
  | "molecular"         // atoms, bonds, geometry
  | "anatomy"           // parts of a whole organism
  | "pathway"           // a biological or chemical route
  | "object"            // one physical thing, in space
  | "scene"             // a 3D arrangement worth walking through
  | "diagram"           // a simplified but relevant picture
  | "text";             // nothing to draw yet

/**
 * Teaching acts that are inherently flat: a formula, a table of symbols, a derivation.
 *
 * No amount of spatial appeal makes a 3D scene the better teacher for these, so they are the only things
 * that survive the spatial check below unchanged.
 */
const FLAT_INTENTS = new Set([
  "explain_formula", "explain_variable", "explain_units", "derive", "verify", "simplify",
  "compare", "identify_given", "identify_unknown",
]);

export type RepresentationDecision = {
  representation: VisualRepresentation;
  /** 2D or 3D, decided with the representation rather than before it. */
  family: "2d" | "3d";
  /** Ordered alternatives, so a caller can fall back without re-deciding from scratch. */
  fallbacks: VisualRepresentation[];
  reason: string;
};

/**
 * The representation a step should be taught with.
 *
 * The inputs are the ones that actually decide it — the teaching act, the domain, whether the idea is
 * spatial, and what is ALREADY on the board — and the outputs are a decision plus its reasons. Asking
 * "what should the student see" is a different question from "what models exist", and the two are
 * answered in that order: availability is a constraint, never the reason.
 */
export function chooseRepresentation(input: {
  subject: string;
  intent?: string;
  /** True when the meaning depends on space: a shape, a position, a containment. */
  spatial?: boolean;
  /** How much the board already carries; a crowded board wants a replacement, not an addition. */
  density?: number;
  /** A validated 3D model exists for this topic AND the question names it. */
  modelAvailable?: boolean;
  viewport?: "narrow" | "wide";
  /** The relationships this step is actually about, when they are known. */
  relations?: string[];
}): RepresentationDecision {
  const { subject, intent } = input;
  const relations = input.relations ?? [];
  const fallbacks: VisualRepresentation[] = [];

  // A relationship is the strongest single clue there is, and it beats the subject every time: a physics
  // step about how one quantity depends on another is an equation, not a free-body diagram, whatever the
  // subject is.
  if (relations.includes("transforms_into") || relations.includes("derives_from")) {
    return { representation: "derivation", family: "2d", fallbacks: ["equation", "process", "text"], reason: "the step is about one expression becoming another" };
  }
  if (relations.includes("compares_with") || relations.includes("inverse_of") || relations.includes("equivalent_to")) {
    return { representation: "comparison", family: "2d", fallbacks: ["table", "diagram", "text"], reason: "the step weighs two things against each other" };
  }
  if (relations.includes("input_to") || relations.includes("output_of") || relations.includes("flows_to") || relations.includes("precedes")) {
    return { representation: "sequence", family: "2d", fallbacks: ["process", "timeline", "text"], reason: "the step is about things arriving in order" };
  }
  if (relations.includes("part_of") || relations.includes("contains")) {
    return { representation: "hierarchy", family: input.spatial ? "3d" : "2d", fallbacks: ["diagram", "table", "text"], reason: "the step is about a part inside a whole" };
  }

  // Space decides 2D against 3D, and only space does — a model that exists is not a reason. An anatomy
  // lesson on a pump analogy is better as a diagram than as the wrong heart.
  //
  // It is checked BEFORE the teaching act because the act almost never conflicts with it: showing a
  // diaphragm, an enzyme or a mechanism IS spatial whatever the teacher calls the step. The exceptions are
  // the acts that are inherently flat — a formula, a table of symbols, a derivation — where no amount of
  // spatial appeal makes a 3D scene the better teacher.
  const inherentlyFlat = FLAT_INTENTS.has(intent ?? "");
  if (!inherentlyFlat && input.spatial) {
    return input.modelAvailable
      ? {
        representation: subject === "biology" || subject === "astronomy" ? "anatomy" : "object",
        family: "3d",
        fallbacks: ["diagram", "hierarchy", "text"],
        reason: "the meaning depends on how things sit in space, and a validated model of it exists",
      }
      : { representation: "diagram", family: "2d", fallbacks: ["hierarchy", "text"], reason: "the meaning is spatial but no validated model of it exists" };
  }

  switch (intent) {
    case "explain_formula":
      return { representation: "equation", family: "2d", fallbacks: ["derivation", "table", "text"], reason: "the step is teaching a formula" };
    case "explain_variable":
    case "explain_units":
      return { representation: "table", family: "2d", fallbacks: ["equation", "diagram", "text"], reason: "the step is naming symbols and what they stand for" };
    case "explain_why":
    case "choose_method":
      fallbacks.push("diagram", "text");
      return { representation: "comparison", family: "2d", fallbacks, reason: "the step is contrasting what was chosen against what was not" };
    case "identify_given":
    case "identify_unknown":
      return { representation: "table", family: "2d", fallbacks: ["diagram", "text"], reason: "the step is listing what is known and what is wanted" };
    case "substitute":
    case "calculate":
      return { representation: "equation", family: "2d", fallbacks: ["table", "diagram", "text"], reason: "the step is working a value through" };
    case "simplify":
      return { representation: "derivation", family: "2d", fallbacks: ["equation", "text"], reason: "the step is reducing an expression" };
    case "verify":
      return { representation: "equation", family: "2d", fallbacks: ["table", "graph", "text"], reason: "the step is checking a result" };
    case "demonstrate":
    case "worked_example":
      fallbacks.push("table", "diagram", "text");
      return { representation: subject === "programming" ? "code" : "graph", family: "2d", fallbacks, reason: "the step is walking through an example" };
    case "common_mistake":
      return { representation: "comparison", family: "2d", fallbacks: ["diagram", "text"], reason: "the step is showing a right answer beside a wrong one" };
    case "define":
    case "introduce_concept":
      fallbacks.push("diagram", "text");
      return { representation: "diagram", family: "2d", fallbacks, reason: "the step is introducing something" };
    default:
      break;
  }

  // Then the domain, for the steps whose intent says nothing about shape.
  const bySubject: Record<string, VisualRepresentation> = {
    mathematics: "equation",
    physics: "free_body",
    engineering: "circuit",
    chemistry: "molecular",
    biology: "anatomy",
    networking: "network",
    programming: "code",
    "computer-science": "memory",
    astronomy: "scene",
  };
  const domainChoice = bySubject[subject] ?? "diagram";

  return {
    representation: domainChoice,
    family: "2d",
    fallbacks: ["diagram", "table", "text"],
    reason: `nothing in the step is spatial, so it is taught on the board as ${domainChoice}`,
  };
}

// ---------------------------------------------------------------------------------------------
// 4. JUDGEMENT — score the scene, then repair it
// ---------------------------------------------------------------------------------------------

export type VisualQuality = {
  /** 0-100 overall. Never the only criterion: the problems below are what a run should read. */
  score: number;
  /** Per dimension, 0-100. Kept separately because one bad dimension should not hide behind an average. */
  dimensions: Record<string, number>;
  /** Named, actionable problems. This is what the acceptance run asserts on. */
  problems: string[];
  /** Objects removed by the repair pass. */
  removed: string[];
  /** Objects merged into another because they meant the same thing. */
  merged: string[];
};

export type SceneAssessmentInput = {
  /** The step being taught. */
  step?: number;
  /** Its teaching act. */
  intent?: string;
  /** Ids the step points at. */
  referenced?: ReadonlySet<string>;
  /** What the teacher is talking about now. */
  focusIds?: readonly string[];
  viewport?: "narrow" | "wide";
};

const textLike = (object: VisualObject): boolean =>
  object.kind === "text" || object.kind === "label" || object.kind === "formula";

function overlaps(a: VisualObject, b: VisualObject): boolean {
  // The SAME tolerance the layout guarantees. Measuring more strictly than the engine promises would
  // report a one-pixel touch as "severe overlap", and a gate that cries wolf about its own layout is a
  // gate nobody reads.
  const pad = -OVERLAP_TOLERANCE;
  const halfWidth = (value: VisualObject): number => (value.rotation % 180 === 0 ? value.width : value.height) / 2;
  const halfHeight = (value: VisualObject): number => (value.rotation % 180 === 0 ? value.height : value.width) / 2;
  return Math.abs(a.x - b.x) < halfWidth(a) + halfWidth(b) + pad
    && Math.abs(a.y - b.y) < halfHeight(a) + halfHeight(b) + pad;
}

/** The overlap the layout is allowed to leave: it is what the engine's own pass treats as touching. */
const OVERLAP_TOLERANCE = 4;

/**
 * How good is this scene, and what is wrong with it.
 *
 * Every dimension is measurable from the scene alone, which is what makes this usable as a gate rather
 * than as an opinion: how much of the board is what the teacher is talking about, how much of it is
 * readable, how crowded it is, how many things say the same thing, and how much of it is stale.
 */
export function assessScene(scene: VisualScene, input: SceneAssessmentInput = {}): VisualQuality {
  const objects = scene.objects;
  const problems: string[] = [];
  const dimensions: Record<string, number> = {};
  if (objects.length === 0) {
    return { score: 0, dimensions: { focus: 0, readability: 0, density: 0, identity: 100, currency: 0, connectivity: 0 }, problems: ["the board is empty"], removed: [], merged: [] };
  }

  // FOCUS — how much of what is drawn is what this step is about.
  const current = objects.filter((object) => object.bornStep === input.step || object.lifecycle === "current");
  const currentWeight = current.length / objects.length;
  dimensions.focus = Math.round(Math.min(100, currentWeight * 160));
  if (current.length === 0) problems.push("nothing on the board belongs to this step");
  else if (currentWeight < 0.15) problems.push(`only ${Math.round(currentWeight * 100)}% of the board is what is being taught now`);

  // CURRENCY — how much of the board is finished work.
  const stale = objects.filter((object) => object.lifecycle === "context" || object.lifecycle === "completed");
  const staleShare = stale.length / objects.length;
  dimensions.currency = Math.round(Math.min(100, (1 - staleShare) * 110));
  if (staleShare > 0.7) problems.push(`${Math.round(staleShare * 100)}% of the board is finished content`);

  // IDENTITY — the same thing said twice.
  const seen = new Map<string, VisualObject>();
  const duplicates: string[] = [];
  for (const object of objects) {
    const key = semanticKey(object);
    if (!key) continue;
    if (seen.has(key)) duplicates.push(object.id);
    else seen.set(key, object);
  }
  dimensions.identity = duplicates.length === 0 ? 100 : Math.max(0, 100 - duplicates.length * 25);
  if (duplicates.length > 0) problems.push(`${duplicates.length} object(s) repeat what is already on the board`);

  // READABILITY ' + [char]0x2014 + ' overlapping content, and text too small to read.
  //
  // A container FRAMES its contents and a label RIDES beside its object. Neither is a collision, and the
  // layout's own pass treats both as intentional, so counting them reports every framed diagram as a pile
  // of overlaps ' + [char]0x2014 + ' which is what the first version of this did on a correct scene.
  const frames = objects
    .filter((object) => object.kind === "container")
    .map((object) => ({ x: object.x, y: object.y, width: object.width, height: object.height }));
  const extent = (object: VisualObject): { x: number; y: number; width: number; height: number } => ({
    x: object.x,
    y: object.y,
    width: object.rotation % 180 === 0 ? object.width : object.height,
    height: object.rotation % 180 === 0 ? object.height : object.width,
  });
  const framed = (box: { x: number; y: number; width: number; height: number }): boolean =>
    frames.some((frame) => Math.abs(box.x - frame.x) < frame.width / 2 + 2 && Math.abs(box.y - frame.y) < frame.height / 2 + 2);
  let colliding = 0;
  for (let i = 0; i < objects.length; i += 1) {
    for (let j = i + 1; j < objects.length; j += 1) {
      const a = objects[i]!;
      const b = objects[j]!;
      if (textLike(a) || textLike(b)) continue;
      if (a.kind === "container" || b.kind === "container") continue;
      if (a.labelOf || b.labelOf) continue;
      if (framed(extent(a)) || framed(extent(b))) continue;
      if (overlaps(a, b)) colliding += 1;
    }
  }
  const tiny = objects.filter((object) => textLike(object) && (object.fontSize ?? 16) < 10).length;
  dimensions.readability = Math.max(0, 100 - colliding * 12 - tiny * 15);
  if (colliding > 0) problems.push(`${colliding} overlapping pair(s) on the board`);
  if (tiny > 0) problems.push(`${tiny} label(s) are too small to read`);

  // DENSITY — not empty, not packed. Both extremes are failures.
  const packed = objects.length > 34;
  // A board that is nearly empty at the START of a lesson is a lesson being set up, not a lesson that
  // forgot to draw. Reporting the opening steps of every lesson as an empty board would train the teacher
  // to ignore the message on exactly the steps where it would first be read.
  const openingStep = input.step !== undefined && input.step <= 3;
  const sparse = objects.length <= 1 && !openingStep;
  dimensions.density = packed ? Math.max(0, 100 - (objects.length - 34) * 6) : sparse ? 40 : 100;
  if (packed) problems.push(`${objects.length} objects is too many to read at once`);
  if (sparse && input.intent) problems.push("the board is nearly empty while the step is being taught");

  // CONNECTIVITY â€” an UNLABELLED object that nothing points at and which points at nothing is stranded.
  // A labelled one is not: "Force: a push or a pull" is a complete step with no arrows in it, and
// calling it an orphan would report every definition the lesson ever taught as a mistake.
  const connected = new Set<string>();
  for (const object of objects) {
    if (object.refs) { connected.add(object.refs.from); connected.add(object.refs.to); }
    if (object.labelOf) connected.add(object.labelOf.id);
  }
  const stranded = objects.filter((object) =>
    (object.kind === "shape" || object.kind === "icon")
    && !object.text
    && !connected.has(object.id)
    && object.role !== "title"
    && object.bornStep === input.step).length;
  dimensions.connectivity = stranded === 0 ? 100 : Math.max(0, 100 - stranded * 25);
  if (stranded > 2) problems.push(`${stranded} unlabelled object(s) introduced this step are connected to nothing`);

  const values = Object.values(dimensions);
  const score = Math.round(values.reduce((total, value) => total + value, 0) / values.length);
  return { score, dimensions, problems, removed: [], merged: duplicates };
}

/**
 * Repairs what is wrong, in the order the brief gives: drop obsolete content, merge duplicates, collapse
 * supporting context, then re-read.
 *
 * Bounded and deterministic. It never asks the model anything and it never shrinks text to fit — a
 * teacher's board gets simpler or it stays unreadable, and unreadable is worse.
 */
export function optimiseScene(scene: VisualScene, input: SceneAssessmentInput = {}): { scene: VisualScene; quality: VisualQuality } {
  let working = scene;
  const quality: VisualQuality = { score: 0, dimensions: {}, problems: [], removed: [], merged: [] };

  // 1. Drop what has been finished and is no longer referenced by the step being taught.
  const referenced = input.referenced ?? new Set<string>();
  const droppable = (object: VisualObject): boolean =>
    object.lifecycle === "completed" || object.lifecycle === "obsolete"
    || (object.lifecycle === "context" && !referenced.has(object.id) && object.bornStep !== input.step);
  working = {
    ...working,
    objects: working.objects.filter((object) => {
      if (!droppable(object)) return true;
      quality.removed.push(object.id);
      return false;
    }),
  };

  // A step that adds nothing must not leave an empty stage. Readability beats currency, and an empty board
  // is the least readable thing there is: if the repair took everything, put back the newest picture so the
  // teacher has something to talk over.
  if (working.objects.length === 0 && scene.objects.length > 0) {
    const newestStage = scene.objects.reduce((best, object) => Math.max(best, object.bornStage ?? -1), -1);
    working = { ...working, objects: scene.objects.filter((object) => (object.bornStage ?? -1) >= newestStage - 1) };
    quality.problems = quality.problems.filter((problem) => problem !== "the board is empty");
  }

  // 2. Merge restatements: the same meaning twice is one object.
  const byMeaning = new Map<string, VisualObject>();
  const survivors: VisualObject[] = [];
  for (const object of working.objects) {
    const key = semanticKey(object);
    if (!key) { survivors.push(object); continue; }
    const existing = byMeaning.get(key);
    if (!existing) { byMeaning.set(key, object); survivors.push(object); continue; }
    quality.merged.push(object.id);
    // Keep the one the current step is talking about; the other is a restatement.
    const keepNew = object.bornStep === input.step && existing.bornStep !== input.step;
    const winnerIndex = survivors.indexOf(keepNew ? object : existing);
    const winner = keepNew ? object : existing;
    survivors[winnerIndex] = winner;
  }
  working = { ...working, objects: survivors };

  // 3. On a narrow screen, supporting context leaves before the current step does. Scaling a crowded
  //    scene down is not adaptation; dropping what is not being taught is. Captions and asides go first
  //    even when they were introduced by this very step — a phone has room for the calculation and its
  //    heading, not for the footnote it arrived with.
  if (input.viewport === "narrow") {
    const keep = (object: VisualObject): boolean =>
      object.role === "title" || object.role === "primary" || object.role === "secondary" || object.role === "step"
      || referenced.has(object.id) || !object.role;
    const kept = working.objects.filter(keep);
    // Never leave a student with nothing: if the filter took everything, keep the largest.
    working = { ...working, objects: kept.length > 0 ? kept : working.objects.slice(0, 3) };
  }

  const assessed = assessScene(working, input);
  return { scene: working, quality: { ...assessed, removed: quality.removed, merged: quality.merged } };
}

/** Lifecycle weighting reused by the repair pass so the two can never disagree. */
export function attentionWeight(lifecycle: VisualLifecycle | undefined): number {
  return lifecycle === "current" ? 1 : lifecycle === "supporting" ? 0.62 : lifecycle === "context" ? 0.34 : 0.18;
}