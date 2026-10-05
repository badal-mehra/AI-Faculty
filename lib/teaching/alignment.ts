/**
 * THE STRUCTURES EACH SUBJECT ACTUALLY TEACHES WITH.
 *
 * The action contract offers every structure to every subject, which means a model that has learnt the
 * whole vocabulary will reach for the wrong one: a real calculus lesson arrived with a code listing on the
 * board, because nothing had ever told it that a code listing is not how you teach a limit. The asset gate
 * stopped a heart being offered for an array; this stops its STRUCTURES leaking the same way.
 *
 * The per-subject lists now live in `visualPolicy.ts`, because "which structures may this subject teach
 * with" is the same question as "what may this domain be drawn with", and the two were drifting apart: the
 * structure gate knew eleven coarse subjects and the taxonomy knows forty-seven domains, so a design lesson
 * resolved to `humanities`, was passed through a list that says nothing about code, and reached the board
 * with a call stack on it.
 */


// EDUCATIONAL ALIGNMENT — the gate between "the provider answered" and "the student can learn".
//
// Schema validation only proves a response is well formed. Everything this file exists to catch was
// well formed: a `create_3d_object` with `type:"box"` for a lesson about the heart, a
// `highlight_3d_object` naming a ventricle on an object that has no parts, an `update_array` aimed at
// an id that is a stack, a step whose speech says "let's visualise this" and whose actions are empty.
//
// Each pass below implements one rung of the degradation ladder, in order, and each is derived only
// from what is already in hand — the asset registry's vocabulary and the teacher's own words:
//
//   1. A generic primitive that stands in for something the registry can actually model is PROMOTED to
//      that model. ("heart_model" as a box becomes `biology/heart`.)
//   2. An asset from an unrelated subject is dropped, because decoration is not teaching.
//   3. A part the model does not have is removed, so no action silently changes nothing.
//   4. An action that addresses an object which does not exist is dropped, so a step can never look
//      drawn when it was not.
//   5. A model gets a label for every part the teacher actually names, so the board names what the
//      speech names.
//   6. A step with no teaching-relevant visual gets a RELEVANT SIMPLIFIED representation built from the
//      items the teacher just enumerated — never an unrelated one.
//   7. Only when none of that applies is the step left text-only, and the report says so.
//
// Every drop is counted and reported, because a silent no-op action is indistinguishable from a good
// one and that is how a lesson that "drew 14 things and used 0" shipped as a pass.
import { SEMANTIC_STRUCTURE_ACTIONS, VisualAction } from "../visual/types";
import { Visual3DAction } from "../visual3d/types";
import { getAsset } from "../visual3d/assets";
import { BoardAction } from "../board/types";
import { StageKind } from "./objective";
import type { TeachingSubject } from "./intent";
import { TeachingResponse } from "./types";
import { assetForPhrase, assetIdsIn, bestAssetFor, calledSequence, enumeratedItems, exchangeParties, identifierPhrase, labelFromId, partLabel, partsMentioned, speechShape } from "./concepts";
import { phraseKey } from "./vocabulary";
import { checkRepresentation, NEUTRAL_STRUCTURE_ACTIONS, visualPolicyFor } from "./visualPolicy";
import { classifyDomain } from "./taxonomy";

/**
 * Teaching subject -> the asset category that may illustrate it.
 *
 * `computer-science` and `programming` share one category because the registry has a single group of
 * hardware and data-structure models, and splitting it would make a programming lesson unable to draw
 * a stack. `general` has no entry on purpose: an unrecognised subject is not allowed to reject anything,
 * because guessing wrong would delete the only visual a lesson has.
 */
const SUBJECT_CATEGORY: Partial<Record<TeachingSubject, string>> = {
  biology: "biology",
  chemistry: "chemistry",
  physics: "physics",
  networking: "network",
  astronomy: "astronomy",
  mathematics: "mathematics",
  "computer-science": "computer-science",
  programming: "computer-science",
};

/**
 * The representation family this lesson shows, decided ONCE.
 *
 * The stage shows either the board or the 3D viewport, so a step that draws into the other family
 * writes content the student can never see. That is not a cosmetic problem: it is how a lesson ended up
 * with twenty-five laid-out array cells and one stray globe on a hidden board, while the visible stage
 * showed an empty world. Mixing families is therefore corrected here rather than discovered later.
 */
export type RepresentationMode = "2d" | "3d";

export type AlignmentContext = {
  question: string;
  topic: string;
  subject: TeachingSubject;
  deep: boolean;
  /** The family the lesson shows for its whole duration. Steps in the other family are corrected. */
  representation: RepresentationMode;
  /** Objects already on screen. A placed model is never discarded. */
  live3dObjects: Array<{ id: string; asset?: string }>;
  /** Diagram objects already on screen, with the kind that makes each one addressable. */
  liveDiagramObjects: Array<{ id: string; kind: string }>;
  /** Board node ids already on screen. */
  liveBoardIds: string[];
  /** Stage this step teaches, when the provider declared one. */
  stageKind?: StageKind;
  /** True when the lesson is about programs, which is the ONLY thing that makes code legitimate here. */
  codeRelevant?: boolean;
};

export type AlignmentNote = {
  pass: "promote" | "category" | "part" | "target" | "label" | "representation";
  detail: string;
};

export type StepAlignmentReport = {
  lessonStep: number;
  promoted: Array<{ id: string; from: string; asset: string }>;
  dropped: Array<{ family: "3d" | "2d" | "board"; action: string; reason: string }>;
  repaired: number;
  labelsAdded: number;
  representationAdded: string | null;
  /** Real, registry-backed things this lesson is about, from what the student asked. */
  entitiesNamed: string[];
  /** Those same things that are actually on the board. */
  entitiesShown: string[];
  /** Further registry-backed things this step mentioned, of the lesson's own subject. */
  speechEntities: string[];
  visualChanged: boolean;
  /** The speech names real things and the board shows none of them. */
  unbackedSpeech: boolean;
  notes: AlignmentNote[];
};

export type AlignedStep = { step: TeachingResponse; report: StepAlignmentReport };

type Create3D = Extract<Visual3DAction, { action: "create_3d_object" }>;

const isCreate3D = (action: Visual3DAction): action is Create3D => action.action === "create_3d_object";

/**
 * The EXTRA ids a structure action creates beyond its own id: array cells, tree nodes, sequence actors.
 *
 * It deliberately does not include the action's own id. That id is what a LATER action must address, so
 * seeding "already exists" with it would make every action's target exist — which is how
 * `highlight{ id: <something that was never created> }` came to be treated as addressed.
 */
function structureIds(action: VisualAction): string[] {
  const ids: string[] = [];
  if (action.action === "create_array" || action.action === "update_array" || action.action === "create_stack" || action.action === "create_queue") {
    action.values.forEach((_, index) => ids.push(`${action.id}-c${index}`));
  }
  if (action.action === "create_tree" || action.action === "create_graph" || action.action === "create_linked_list") {
    for (const node of action.nodes) ids.push(`${action.id}-${node.id}`);
  }
  if (action.action === "create_tree" || action.action === "create_graph") {
    action.edges.forEach((_, index) => ids.push(`${action.id}-e${index}`));
  }
  if (action.action === "create_sequence") for (const actor of action.actors) ids.push(actor);
  // The layout compiler names each structure's parts deterministically, so a later step can point at one
  // of them. These names are duplicated from lib/visual/layout.ts on purpose: if the two ever drift, the
  // symptom is a dropped highlight with a clear reason rather than a wrong reference being followed.
  if (action.action === "create_pipeline") action.stages.forEach((_, index) => ids.push(`${action.id}-p${index}`));
  if (action.action === "create_timeline") action.events.forEach((_, index) => ids.push(`${action.id}-e${index}`));
  if (action.action === "create_compare") {
    for (const key of ["l", "r"]) {
      ids.push(`${action.id}-${key}-frame`, `${action.id}-${key}-head`);
      const items = key === "l" ? action.left.items : action.right.items;
      items.forEach((_, index) => ids.push(`${action.id}-${key}-r${index}`));
    }
  }
  if (action.action === "create_code_block") ids.push(`${action.id}-frame`);
  return ids;
}

/** True for actions that bring a new addressable object into existence. */
function createsObject(action: VisualAction): boolean {
  return action.action.startsWith("create_") && "id" in action && typeof action.id === "string" && action.id.length > 0;
}

/** 2D actions that only do anything visible against an object that already exists. */
function requiredIds2d(action: VisualAction): string[] {
  switch (action.action) {
    case "create_label": return [action.target];
    case "create_arrow": case "create_connector": return [action.from, action.to];
    case "animate_path": return [action.id, action.to];
    case "highlight_many": case "focus": case "dim": return action.ids;
    case "restore": return action.ids ?? [];
    case "highlight": case "pulse": case "fade_in": case "fade_out": case "move": case "resize":
    case "rotate": case "flow": case "remove": case "camera_focus":
    case "set_code_pointer": return [action.id];
    // A structure MUTATOR must be aimed at its own kind of structure. `update_array` addresses "the
    // array with this id" — pointing it at a stack, a queue or a tree is the action contract's version of
    // a white cube: it parses, it runs, and it changes nothing, so the student watches an empty stack and
    // hears about values being written into it.
    case "update_array": return [action.id];
    default: return [];
  }
}

/**
 * The kind of scene object a diagram action produces.
 *
 * Structures are compiled into primitives by `lib/visual/layout.ts`, so they are reported as
 * "structure" rather than pretending to be one primitive kind. It is what lets a structure MUTATOR be
 * aimed at the right structure.
 */
export function sceneKindOf(action: VisualAction): string {
  switch (action.action) {
    case "create_array": case "update_array": case "create_stack": case "create_queue":
    case "create_tree": case "create_graph": case "create_linked_list": case "create_sequence":
    case "create_pipeline": case "create_timeline": case "create_compare":
      return "structure";
    case "create_code_block": return "code_block";
    case "create_shape": return "shape";
    case "create_container": return "container";
    case "create_text": return "text";
    case "create_label": return "label";
    case "create_icon": return "icon";
    case "create_arrow": return "arrow";
    case "create_connector": return "connector";
    case "write_formula": return "formula";
    default: return "mutation";
  }
}

/**
 * The ids that really are arrays.
 *
 * An array is not a scene object kind: it is a SET of cells named `<id>-c0`, `<id>-c1`. That is exactly
 * why `update_array` aimed at a stack is so easy to miss — it looks addressed, it parses, and the
 * reducer simply finds no cells and returns the scene unchanged.
 */
function arrayIdsFrom(objects: Array<{ id: string }>): Set<string> {
  const ids = new Set<string>();
  for (const object of objects) {
    const match = /^(.*)-c\d+$/.exec(object.id);
    if (match) ids.add(match[1]!);
  }
  return ids;
}

/** 3D actions that only do anything visible against an object that already exists. */
function requiredIds3d(action: Visual3DAction): string[] {
  switch (action.action) {
    case "highlight_3d_object": case "pulse_3d_object": case "remove_3d_object":
    case "move_3d_object": case "rotate_3d_object": case "scale_3d_object":
    case "restore_parts": case "explode_group": case "assemble_group":
    case "animate_spin": case "animate_oscillate":
      return [action.id as string];
    case "follow_object": return [action.target];
    case "isolate_part": return [action.id];
    case "focus_camera": return [action.target];
    // `frame_camera` with no target frames everything, which is always valid; with one it needs that object.
    case "frame_camera": return action.target ? [action.target] : [];
    case "show_3d_label": return [action.target];
    case "animate_flow": return [action.from, action.to];
    case "animate_path": return [action.id, action.to];
    case "animate_orbit": return [action.id, action.center];
    case "set_visibility": return action.ids ?? [];
    default: return [];
  }
}

/** Board graph actions that only make sense against an existing node. */
function requiredBoardIds(action: BoardAction): string[] {
  switch (action.action) {
    case "connect": return [action.from, action.to];
    case "highlight": case "erase": return [action.target];
    case "move_node": return [action.id];
    default: return [];
  }
}

/** Does this 3D action change what the student sees, as opposed to only moving the camera? */
function isVisible3dChange(action: Visual3DAction): boolean {
  return ["highlight_3d_object", "show_3d_label", "animate_flow", "animate_path", "animate_orbit", "animate_spin",
    "pulse_3d_object", "move_3d_object", "rotate_3d_object", "scale_3d_object", "isolate_part", "explode_group",
    "show_vector", "show_measurement", "show_trajectory", "set_visibility"].includes(action.action);
}

/**
 * Why a mutator aimed at an existing object still does nothing, or undefined when it will work.
 *
 * Both checks are about the ADDRESS, not the name: the object is there, but it is not the sort of thing
 * this action changes. These are the actions that passed every schema check, ran without an error, and
 * left the board untouched.
 */
function wrongStructureKind(
  action: VisualAction,
  arrayIds: Set<string>,
  kindById: Map<string, string>,
): string | undefined {
  if (action.action === "update_array") {
    if (arrayIds.has(action.id)) return undefined;
    const kind = kindById.get(action.id) ?? "shape";
    return `${action.id} is not an array (it is a ${kind}), and update_array only writes into array cells`;
  }
  if (action.action === "set_code_pointer") {
    if (kindById.get(action.id) === "code_block") return undefined;
    return `${action.id} is not a code listing, so there are no lines to point at`;
  }
  return undefined;
}

function withoutPart(action: Visual3DAction): Visual3DAction {
  const { part: _part, ...rest } = action as Visual3DAction & { part?: string };
  return rest as Visual3DAction;
}

/** The phrase that best identifies what an object claims to be: its own words first, then its id. */
function objectPhrase(action: Create3D): string {
  const labelled = [action.label, action.text].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ");
  return labelled.length > 0 ? labelled : identifierPhrase(action.id);
}

/**
 * The one existing object an unknown id can only have meant.
 *
 * Two independent signals must agree before anything is retargeted: the words of the unknown id, and
 * the asset its name resolves to. Requiring a single survivor is what keeps this a repair rather than
 * a guess — "heart_main" resolves to the only heart on screen, and nothing else would.
 */
function resolveUnknownObject(unknownId: string, objects: Map<string, string>): string | undefined {
  const wanted = phraseKey(identifierPhrase(unknownId));
  if (!wanted) return undefined;
  const wantedAsset = assetForPhrase(wanted);
  const wantedWords = wanted.split(" ").filter((word) => word.length > 2);
  const candidates = Array.from(objects.entries()).filter(([id]) => {
    if (id === unknownId) return false;
    const phrase = phraseKey(identifierPhrase(id));
    const sharesWord = wantedWords.some((word) => phrase.includes(word));
    const sameAsset = Boolean(wantedAsset) && objects.get(id) === wantedAsset;
    return sameAsset || sharesWord;
  });
  if (candidates.length !== 1) return undefined;
  const [id, asset] = candidates[0]!;
  if (wantedAsset && asset && asset !== wantedAsset) return undefined;
  return id;
}

/** Rewrites every reference to `from` in a 3D action so it points at `to`. */
function retarget3d(action: Visual3DAction, from: string, to: string): Visual3DAction {
  const next = { ...action } as Record<string, unknown>;
  for (const key of ["id", "target", "center"]) if (next[key] === from) next[key] = to;
  if (Array.isArray(next.ids)) next.ids = next.ids.map((id: string) => (id === from ? to : id));
  return next as Visual3DAction;
}

/**
 * The one pass that decides what a lesson is allowed to show.
 *
 * Deterministic, registry-derived and identical for every subject: it asks what the text names, and
 * whether the registry can actually show it. No topic, asset or lesson is named anywhere below.
 */
export function alignTeachingStep(step: TeachingResponse, context: AlignmentContext): AlignedStep {
  const notes: AlignmentNote[] = [];
  const promoted: StepAlignmentReport["promoted"] = [];
  const dropped: StepAlignmentReport["dropped"] = [];
  let repaired = 0;
  let labelsAdded = 0;

  const domain = classifyDomain(context.topic, context.question).primary.domain;
  const policy = visualPolicyFor(domain, context.subject);
  const lessonCategory = SUBJECT_CATEGORY[context.subject];
  /**
   * The coarse subject's own category wins when it has one. The domain policy supplies one only for the
   * families the coarse gate has never covered (engineering, earth), because narrowing an asset is
   * irreversible: guessing wrong deletes the only visual a lesson has, so `undefined` stays "no restriction".
   */
  const allowedCategories: ReadonlySet<string> | undefined = lessonCategory
    ? new Set([lessonCategory])
    : policy.categories
      ? new Set(policy.categories)
      : undefined;
  const inLessonCategory = (assetId: string): boolean =>
    !allowedCategories || (getAsset(assetId)?.category !== undefined && allowedCategories.has(getAsset(assetId)!.category));
  /** objectId -> asset id, for every object this step knows about. */
  const assetByObject = new Map<string, string>();
  for (const object of context.live3dObjects) if (object.asset) assetByObject.set(object.id, object.asset);

  // ---- Pass 0: one lesson, one stage --------------------------------------------------------------
  // The student only ever sees one representation. A step that drew into the other family produced
  // content that was never on screen, so it is removed here and the reason is recorded; if that empties
  // the step, the ladder below rebuilds it in the family the student is actually looking at.
const hiddenFamily = context.representation === "3d" ? "2d" : "3d";
  const requested2d = step.visual_actions ?? [];
  const requested3d = step.visual3d_actions ?? [];
  const source2d = context.representation === "3d" ? [] : requested2d;
  const source3d = context.representation === "3d" ? requested3d : [];
  for (const action of context.representation === "3d" ? requested2d : requested3d) {
    const family = context.representation === "3d" ? "2d" : "3d";
    dropped.push({ family, action: action.action, reason: `this lesson is shown on the ${context.representation.toUpperCase()} stage, so ${family.toUpperCase()} content would never be seen` });
  }
  // The rigid parent/child graph board is a THIRD renderer the stage never shows while 3D is live, so its
  // actions are invisible in a 3D lesson exactly as a diagram's would be.
  const hiddenBoardActions: BoardAction[] = context.representation === "3d" ? step.board_actions ?? [] : [];
  for (const action of hiddenBoardActions) {
    dropped.push({ family: "board", action: action.action, reason: `this lesson is shown on the 3D stage, so graph-board content would never be seen` });
  }
  if (dropped.some((entry) => entry.reason.includes("never be seen"))) {
    notes.push({ pass: "representation", detail: `kept the ${context.representation.toUpperCase()} representation and dropped the other family` });
  }
  if (dropped.some((entry) => entry.reason.includes("would never be seen"))) {
    notes.push({ pass: "representation", detail: `kept the ${context.representation.toUpperCase()} representation and dropped the other family` });
  }

  // ---- Pass 0b: a representation from another subject is decoration, not teaching --------------------
  // A real calculus lesson arrived with a code listing on it: not because the model was asked for code,
  // but because the action contract offers every structure to every subject and nothing said no. A
  // vocabulary is not a script, and the asset gate already stops a heart being offered for an array — this
  // stops its STRUCTURES leaking the same way.
  //
  // The policy resolved above (`visualPolicyFor(domain, context.subject)`) decides, because the coarse
  // subject is what lost the IDEO lesson in the first place: design resolved to `humanities`, and no
  // humanities list in the codebase ever had to say "no code", so a design lesson arrived with a call stack
  // on the board. When the topic does place a domain, that domain's policy decides.
  const codeIntent = context.codeRelevant === true;
  const foreign = source2d.filter((action) =>
    (SEMANTIC_STRUCTURE_ACTIONS as readonly string[]).includes(action.action)
    && !NEUTRAL_STRUCTURE_ACTIONS.has(action.action)
    && !checkRepresentation(policy, action.action, { codeIntent }).allowed);
  if (foreign.length > 0) {
    for (const action of foreign) {
      const verdict = checkRepresentation(policy, action.action, { codeIntent });
      const diagnostic = verdict.allowed ? "" : verdict.diagnostic;
      dropped.push({ family: "2d", action: action.action, reason: diagnostic });
      notes.push({ pass: "representation", detail: diagnostic || `dropped ${action.action}` });
    }
  }
  const source2dInSubject = source2d.filter((action) => !foreign.includes(action));

  const promoted3d: Visual3DAction[] = [];
  for (const action of source3d) {
    if (!isCreate3D(action)) { promoted3d.push(action); continue; }
    const existing = action.asset ? getAsset(action.asset)?.id : undefined;
    if (existing) {
      assetByObject.set(action.id, existing);
      promoted3d.push(action);
      continue;
    }
    const assetId = assetForPhrase(objectPhrase(action), allowedCategories ? { requiredCategories: [...allowedCategories] } : {});
    if (assetId) {
      assetByObject.set(action.id, assetId);
      promoted.push({ id: action.id, from: action.type, asset: assetId });
      notes.push({ pass: "promote", detail: `${action.id}: ${action.type} -> ${assetId}` });
      const { color: _color, ...rest } = action;
      promoted3d.push({ ...rest, type: "model", asset: assetId });
      continue;
    }
    // A "model" with no usable asset is a dead action: the engine drops it, so the step looks drawn
    // and is not. Dropping it here is what makes the empty-board recovery below fire instead.
    if (action.type === "model") {
      dropped.push({ family: "3d", action: "create_3d_object", reason: `a model object needs a catalog asset, and "${objectPhrase(action)}" names none` });
      notes.push({ pass: "promote", detail: `${action.id}: dropped a model with no asset` });
      continue;
    }
    // Not promotable. It stays a primitive — legitimate for an abstract marker — but it must never
    // ship unlabelled, because an unlabelled cube teaches nothing about what it stands for. The label
    // comes from the object's own name when that name says something, and from what this step is
    // teaching when it does not.
    if (!action.label && !action.text) {
      const label = labelFromId(action.id, context.topic || labelFromId(action.id));
      promoted3d.push({ ...action, label });
      labelsAdded += 1;
      notes.push({ pass: "label", detail: `${action.id}: labelled "${label}"` });
      continue;
    }
    promoted3d.push(action);
  }

  // ---- Pass 2: a model from an unrelated subject is decoration, not teaching ------------------------
  // A clear that leaves nothing behind is a wipe, not a transition. Clearing a stage and rebuilding it
  // is a legitimate reset; clearing it and drawing nothing is how a lesson ends its recap by erasing
  // everything the student spent fifteen steps looking at.
  const drawsReplacement = promoted3d.some((action) => isCreate3D(action));
  let scoped = promoted3d;
  for (const action of promoted3d) {
    if (action.action !== "clear_3d_scene") continue;
    if (!drawsReplacement) {
      dropped.push({ family: "3d", action: action.action, reason: "clearing the stage and then drawing nothing erases the lesson instead of teaching it" });
      notes.push({ pass: "representation", detail: "dropped a stage wipe that was followed by nothing" });
      scoped = scoped.filter((candidate) => candidate !== action);
    }
  }

  if (allowedCategories) {
    const creations = promoted3d.filter(isCreate3D);
    const offTopic = creations.filter((action) => {
      const assetId = action.asset;
      if (!assetId) return false;
      if (assetByObject.get(action.id) === assetId && context.live3dObjects.some((object) => object.id === action.id)) return false;
      const asset = getAsset(assetId);
      return asset !== undefined && !allowedCategories.has(asset.category);
    });
    if (offTopic.length > 0) {
      const kept = promoted3d.filter((action) => !offTopic.some((entry) => entry === action));
      const stillShowsSomething = kept.some((action) => isVisible3dChange(action))
        || kept.some((action) => isCreate3D(action) || action.action === "show_3d_label");
      if (stillShowsSomething) {
        for (const action of offTopic) {
          dropped.push({ family: "3d", action: "create_3d_object", reason: `asset ${action.asset} belongs to another subject than this lesson` });
          notes.push({ pass: "category", detail: `${action.id}: dropped ${action.asset}` });
        }
        scoped = kept;
      } else {
        notes.push({ pass: "category", detail: `kept ${offTopic[0]!.asset} because dropping it would leave the step empty` });
      }
    }
  }

  // ---- Pass 3: a part the model does not have is a lie the board cannot show ------------------------
  const partOnlyActions = new Set<string>(["isolate_part"]);
  const withParts: Visual3DAction[] = [];
  for (const action of scoped) {
    const partial = action as Visual3DAction & { id?: string; target?: string; part?: string; parts?: string[] };
    const objectId = partial.id ?? partial.target;
    if (!partial.part) {
      // `explode_group.parts` narrows a separation to named parts; the same check applies to the list.
      const parts = partial.parts;
      const anchors = objectId ? assetByObject.get(objectId) : undefined;
      if (parts && parts.length > 0 && anchors) {
        const allowed = getAsset(anchors)?.semanticAnchors ?? [];
        const keptParts = parts.filter((part) => allowed.includes(part));
        if (keptParts.length !== parts.length) {
          repaired += 1;
          notes.push({ pass: "part", detail: `${objectId}: dropped ${parts.length - keptParts.length} unknown part name(s)` });
        }
        withParts.push(keptParts.length > 0 ? ({ ...action, parts: keptParts } as Visual3DAction) : action);
        continue;
      }
      withParts.push(action);
      continue;
    }
    const assetId = objectId ? assetByObject.get(objectId) : undefined;
    if (assetId && (getAsset(assetId)?.semanticAnchors ?? []).includes(partial.part)) {
      withParts.push(action);
      continue;
    }
    const reason = assetId
      ? `"${partial.part}" is not a part of ${assetId}`
      : `part "${partial.part}" needs a model, and ${objectId ?? "that object"} has none`;
    if (partOnlyActions.has(action.action)) {
      dropped.push({ family: "3d", action: action.action, reason });
      notes.push({ pass: "part", detail: `${objectId ?? "?"}: dropped ${action.action} (${reason})` });
      continue;
    }
    repaired += 1;
    notes.push({ pass: "part", detail: `${objectId ?? "?"}: removed ${partial.part} from ${action.action}` });
    withParts.push(withoutPart(action));
  }

  // ---- Pass 4: an action that addresses nothing is not a drawing -------------------------------------
  // A provider that refers to an object by a name it never created is a common, recoverable mistake:
  // "heart_main" when the object it created was called "heart_model". When exactly one existing object
  // is unambiguously the one meant, the action is retargeted instead of thrown away.
  const live3d = new Map<string, string>();
  for (const object of context.live3dObjects) live3d.set(object.id, object.asset ?? "");
  const known3d = new Set<string>(context.live3dObjects.map((object) => object.id));
  for (const action of withParts) if (isCreate3D(action)) { known3d.add(action.id); live3d.set(action.id, action.asset ?? ""); }
  const known2d = new Set<string>(context.liveDiagramObjects.map((object) => object.id));
  const kindById = new Map<string, string>();
  for (const object of context.liveDiagramObjects) kindById.set(object.id, object.kind);
  const arrayIds = arrayIdsFrom(context.liveDiagramObjects);
  for (const action of source2d) {
    // Only a CREATING action makes its own id exist. A mutation names something that must already be
    // there, which is the whole reason it can be checked.
    if (createsObject(action)) {
      known2d.add((action as { id: string }).id);
      kindById.set((action as { id: string }).id, sceneKindOf(action));
    }
    for (const id of structureIds(action)) known2d.add(id);
    if (action.action === "create_array") arrayIds.add(action.id);
  }
  const keptBoardActions = (step.board_actions ?? []).filter((action) => !hiddenBoardActions.includes(action));
  const knownBoard = new Set<string>(context.liveBoardIds);
  for (const action of keptBoardActions) if ("id" in action && typeof action.id === "string") knownBoard.add(action.id);

  const final3d: Visual3DAction[] = [];
  for (const action of withParts) {
    const missing = requiredIds3d(action).filter((id) => !known3d.has(id));
    if (missing.length === 0) { final3d.push(action); continue; }
    const resolved = missing.length === 1 ? resolveUnknownObject(missing[0]!, live3d) : undefined;
    if (resolved) {
      repaired += 1;
      notes.push({ pass: "target", detail: `${action.action}: retargeted ${missing[0]} -> ${resolved}` });
      final3d.push(retarget3d(action, missing[0]!, resolved));
      continue;
    }
    dropped.push({ family: "3d", action: action.action, reason: `${missing.join(", ")} ${missing.length === 1 ? "does" : "do"} not exist in this scene` });
    notes.push({ pass: "target", detail: `${action.action}: unknown target ${missing.join(",")}` });
  }
  const final2d: VisualAction[] = [];
  let wipesBoard = false;
  for (const action of source2dInSubject) {
    // The same rule as the 3D stage: clearing the board and drawing nothing is not a teaching action.
    if (action.action === "clear") { wipesBoard = true; continue; }
    const missing = requiredIds2d(action).filter((id) => !known2d.has(id));
    if (missing.length > 0) {
      dropped.push({ family: "2d", action: action.action, reason: `${missing.join(", ")} ${missing.length === 1 ? "does" : "do"} not exist on the board` });
      notes.push({ pass: "target", detail: `${action.action}: unknown target ${missing.join(",")}` });
      continue;
    }
    // The target exists, but a structure MUTATOR aimed at the wrong kind of structure does nothing.
    // `update_array` finds array CELLS named "<id>-c<n>"; pointing it at a stack, a queue or a tree
    // leaves the board exactly as it was while the teacher narrates values being written into it.
    const wrongKind = wrongStructureKind(action, arrayIds, kindById);
    if (wrongKind) {
      dropped.push({ family: "2d", action: action.action, reason: wrongKind });
      notes.push({ pass: "target", detail: wrongKind });
      continue;
    }
    final2d.push(action);
  }
  if (wipesBoard && !final2d.some((action) => action.action.startsWith("create_"))) {
    dropped.push({ family: "2d", action: "clear", reason: "clearing the board and then drawing nothing erases the lesson instead of teaching it" });
    notes.push({ pass: "representation", detail: "dropped a board wipe that was followed by nothing" });
  }
  const finalBoard: BoardAction[] = [];
  for (const action of keptBoardActions) {
    const missing = requiredBoardIds(action).filter((id) => !knownBoard.has(id));
    if (missing.length === 0) { finalBoard.push(action); continue; }
    dropped.push({ family: "board", action: action.action, reason: `${missing.join(", ")} ${missing.length === 1 ? "does" : "do"} not exist on the board` });
    notes.push({ pass: "target", detail: `${action.action}: unknown target ${missing.join(",")}` });
  }

  // ---- Pass 5: name on the board what the teacher is naming -----------------------------------------
  if (context.deep) {
    const spoken = `${context.question} ${step.speech}`;
    const additions: Visual3DAction[] = [];
    const alreadyLabelled = new Set(
      final3d.filter((action) => action.action === "show_3d_label")
        .map((action) => (action as Extract<Visual3DAction, { action: "show_3d_label" }>).part ?? ""),
    );
    for (const [objectId, assetId] of assetByObject) {
      for (const part of partsMentioned(assetId, spoken).filter((part) => !alreadyLabelled.has(part)).slice(0, 3)) {
        additions.push({ action: "show_3d_label", id: `auto-${objectId}-${part}`, target: objectId, text: partLabel(part), part });
        alreadyLabelled.add(part);
        labelsAdded += 1;
        notes.push({ pass: "label", detail: `labelled ${objectId}@${part} from the speech` });
      }
      if (labelsAdded >= 3) break;
    }
    if (additions.length > 0) final3d.push(...additions);
  }

  // ---- Pass 6: a formula the teacher is teaching goes on the board -----------------------------------
  let representationAdded: string | null = null;
  let result2d = final2d;
  let result3d = final3d;
  if (context.representation === "2d" && context.deep && !formulaIsDrawn(step, result2d)) {
    const block = equationBlockFor(step, "formula_block");
    if (block) {
      result2d = [...result2d, block];
      notes.push({ pass: "representation", detail: "drew the formula this step teaches, with its symbols, because the speech introduced it" });
      representationAdded = representationAdded ?? "the formula under discussion";
    }
  }
  // And the symbol the step is on is lit, so the board shows WHERE in the formula the teacher is.
  const formulaBlockId = (result2d.find((action) => action.action === "create_equation_block") as { id: string } | undefined)?.id;
  if (context.representation === "2d" && formulaBlockId && result2d.filter((action) => action.action === "highlight_many" || action.action === "focus").length === 0) {
    const highlight = variableRowHighlight(step, formulaBlockId);
    if (highlight) {
      result2d = [...result2d, highlight];
      notes.push({ pass: "representation", detail: "pointed at the symbol this step is explaining" });
    }
  }

// ---- Pass 7: no visual without a teaching reason -------------------------------------------------
  if (context.representation === "2d") {
    const liveText = context.liveDiagramObjects.map((object) => object.id).join(" ");
    // A step whose job is to INTRODUCE something is allowed to say what it is introducing. Removing
    // "Force — a push or a pull" from a step that exists to introduce force leaves the student with a
    // narration and an empty board for four steps, which is the failure the pass was meant to avoid.
    //
    // The pass therefore thins a PILE and never guts a step: it only removes a category-only heading
    // when the step already has other visual content, or when the step is doing something other than
    // introducing. That is the difference between "the board is a history" and "the board is empty".
    const introducing = step.teaching_intent !== undefined && INTRODUCING_INTENTS.includes(step.teaching_intent);
    const hasOtherContent = result2d.some((action) => {
      const verdict = visualTeachingReason(action, step.speech, liveText);
      return verdict === "keep" && !(typeof (action as { text?: string }).text === "string"
        && CATEGORY_ONLY_HEADINGS.test(((action as { text: string }).text ?? "").trim()));
    });
    const kept: VisualAction[] = [];
    for (const action of result2d) {
      const verdict = visualTeachingReason(action, step.speech, liveText);
      const isCategoryHeading = typeof (action as { text?: string }).text === "string"
        && CATEGORY_ONLY_HEADINGS.test(((action as { text: string }).text ?? "").trim())
        && (action as { role?: string }).role !== "title";
      // Keep it when this step is introducing the concept, or when nothing else on the board would
      // remain and the alternative is a teacher talking to an empty stage.
      if (verdict === "keep" || (introducing && isCategoryHeading) || (isCategoryHeading && !hasOtherContent)) {
        kept.push(action);
        continue;
      }
      dropped.push({ family: "2d", action: action.action, reason: "this element names no part of what the teacher is currently saying, so it would sit on the board without a reason" });
      const label = typeof (action as { text?: string }).text === "string" ? ` ("${((action as { text: string }).text).slice(0, 40)}")` : "";
      notes.push({ pass: "representation", detail: `dropped a decorative ${action.action}${label}` });
    }
    result2d = kept;
  }

  // ---- Pass 6: a step that teaches with an empty board -----------------------------------------------
  // Only when NOTHING teaching-relevant reached the board. A step that already drew a real model, or
  // any diagram at all, is left alone: adding a second representation on top of a working one is how a
  // lesson ends up showing three copies of the same heart.
  // The formula pass above may already have produced something worth reporting.
  const nothingAtAll = final2d.length === 0 && finalBoard.length === 0 && final3d.length === 0;
  const onlyBarePrimitives = final3d.length > 0
    && final3d.every((action) => isCreate3D(action) && !action.asset)
    && final2d.length === 0
    && finalBoard.length === 0;
  if (context.deep && (nothingAtAll || onlyBarePrimitives)) {
    const built = representationFromSpeech(step.speech, {
      topic: context.topic,
      subject: context.subject,
      representation: context.representation,
      modelAlreadyOnScreen: Array.from(assetByObject.values()).length > 0,
    });
    if (built) {
      result2d = [...final2d, ...built.actions2d];
      result3d = [...result3d, ...built.actions3d];
      representationAdded = built.kind;
      notes.push({ pass: "representation", detail: `added ${built.kind}` });
    }
  }

  // ---- Pass 7: the thing being taught this step gets put on the board ------------------------------
  // This is the ladder's first rung applied per entity rather than per step: when the teacher spends a
  // step naming a real, registry-backed thing of this lesson's own subject and that thing is not on the
  // board, the validated model for it goes on the board. Bounded to one addition, never a duplicate, and
  // only when the scene is still small enough for another object to be legible. Only meaningful when the
  // lesson is shown in 3D at all.
  if (context.deep && context.representation === "3d") {
    const onScreenAssets = new Set<string>([...Array.from(assetByObject.values()), ...final3d.flatMap((action) => (isCreate3D(action) && action.asset ? [action.asset] : []))]);
    // The lesson's own subject first, then anything else this step mentioned. A step that spends its
    // budget on an incidental object while never showing the thing the student asked about is backwards.
    const entitiesNamed = assetIdsIn(`${context.question} ${context.topic}`);
    const mentioned = assetIdsIn(step.speech).filter(inLessonCategory);
    const spokenEntities = Array.from(new Set([...entitiesNamed, ...mentioned]))
      .filter((assetId) => !onScreenAssets.has(assetId));
    // A framed 3D stage stays legible with a handful of distinct models, and auto-framing keeps them all
    // in view; the cap exists to stop a lesson adding one more object per step forever, not to keep the
    // scene at one object.
    const roomLeft = onScreenAssets.size < 6 && result3d.filter(isCreate3D).length < 8;
    const missing = roomLeft ? spokenEntities[0] : undefined;
    if (missing) {
      result3d = [...result3d, { action: "create_3d_object", id: `teaching-${missing.replace("/", "-")}`, type: "model", asset: missing }];
      notes.push({ pass: "representation", detail: `added ${missing}, which this step teaches about` });
      representationAdded = representationAdded ?? `the real model ${missing}`;
    }
  }

  // ---- Pass 8: a step must end on a board the student can see ----------------------------------------
  // A step can end perfectly validly with `frame_camera` narrowed onto one object — and still leave half
  // the lesson off screen. Framing is about the LAST thing on screen, so when a step both changes the
  // scene and deliberately focuses the camera, a final frame of everything is appended: the student
  // watches the close-up, then ends the step looking at the whole thing. Without this a lesson can reach
  // three quarters of the frame with the objects it just added outside it, which is exactly what a 372%
  // fill measurement is.
  if (context.deep && context.representation === "3d") {
    // Rearranging counts as changing: a step that only moves or scales what is already there can push it
    // out of frame just as surely as one that adds to it.
    const changesScene = result3d.some((action) => isCreate3D(action)
      || action.action === "move_3d_object" || action.action === "scale_3d_object"
      || action.action === "rotate_3d_object" || action.action === "explode_group" || action.action === "assemble_group"
      || action.action === "set_visibility" || action.action === "restore_parts");
    const focuses = result3d.some((action) => action.action === "frame_camera" && "target" in action && action.target);
    const alreadyFramesEverything = result3d.some((action) => action.action === "frame_camera" && !("target" in action && action.target));
    if (changesScene && focuses && !alreadyFramesEverything) {
      result3d = [...result3d, { action: "frame_camera" }];
      notes.push({ pass: "representation", detail: "framed everything at the end of the step so nothing the step changed is left off screen" });
    }
  }



// ---- The report: what the student is entitled to know -----------------------------------------------
  const shownAssets = new Set<string>();
  for (const action of result3d) if (isCreate3D(action) && action.asset) shownAssets.add(action.asset);
  const onScreen = new Set<string>([...shownAssets, ...assetByObject.values()]);
  // THE LESSON'S OWN SUBJECT MATTER. Only what the STUDENT ASKED ABOUT is a promise the board has to
  // keep. A passing mention of something else in the explanation — "the brain gets its oxygen too" —
  // is not a request to model the brain, and treating it as one makes the check cry wolf on every lesson
  // that ever mentions an organ it is not about.
  const entitiesNamed = assetIdsIn(`${context.question} ${context.topic}`);
  // What else the step happened to mention, for a human reading the report.
  const speechEntities = assetIdsIn(step.speech)
    .filter(inLessonCategory)
    .filter((assetId) => !entitiesNamed.includes(assetId));
  const shownWithLive = entitiesNamed.filter((assetId) => onScreen.has(assetId));

  const report: StepAlignmentReport = {
    lessonStep: step.lesson_step,
    promoted,
    dropped,
    repaired,
    labelsAdded,
    representationAdded,
    entitiesNamed,
    entitiesShown: shownWithLive,
    speechEntities,
    visualChanged: result2d.length > 0 || result3d.length > 0 || finalBoard.length > 0,
    unbackedSpeech: entitiesNamed.length > 0 && shownWithLive.length === 0,
    notes,
  };

  return {
    step: { ...step, board_actions: finalBoard, visual_actions: result2d, visual3d_actions: result3d },
    report,
  };
}

/**
 * A representation built ONLY from the teacher's own words.
 *
 * This is the "relevant simplified representation" rung, and it cannot contradict the speech because
 * every label on it came out of the speech. It is deliberately conservative: if the words do not
 * clearly describe a structure and the registry has no model for the topic, nothing is drawn and the
 * step stays text-only rather than being decorated with something unrelated.
 */
export function representationFromSpeech(
  speech: string,
  context: Pick<AlignmentContext, "topic" | "subject" | "representation"> & { modelAlreadyOnScreen?: boolean },
): { actions2d: VisualAction[]; actions3d: Visual3DAction[]; kind: string } | null {
  const shape = speechShape(speech);
  const items = enumeratedItems(speech);
  const title = context.topic.slice(0, 60).trim();
  const category = SUBJECT_CATEGORY[context.subject];
  // Whatever is built here has to be buildable in the family the student is looking at, so a 2D lesson
  // never gets told to draw a model and a 3D lesson never gets told to draw a diagram it cannot see.
  const threeD = context.representation === "3d";

  // Rung 1 — the real model, when the registry has one for this topic and the student is not already
  // looking at it. Putting the same organ on screen twice teaches nothing the first one did not.
  if (threeD && !context.modelAlreadyOnScreen) {
    const assetId = bestAssetFor(`${context.topic} ${speech}`, category ? { requiredCategory: category } : {});
    if (assetId) {
      return {
        actions2d: [],
        actions3d: [
          { action: "create_3d_object", id: "topic_model", type: "model", asset: assetId, ...(title ? { label: title } : {}) },
          { action: "frame_camera" },
        ],
        kind: `the real model ${assetId}`,
      };
    }
  }

  // Rung 2 — a structure taken from the teacher's own words. A generic diagram is never acceptable,
  // so this only fires when the words genuinely describe one.
  if (!threeD) {
    if (shape === "sequence") {
      const parties = exchangeParties(speech);
      // No named parties means no exchange to draw. "Sender" and "Receiver" boxes are the 2D equivalent
      // of the empty cube, so the ladder continues instead.
      if (parties && items.length >= 2) {
        const messages = items.slice(0, 6).map((label, index) => ({ from: parties[index % parties.length]!, to: parties[(index + 1) % parties.length]!, label: label.slice(0, 40) }));
        return {
          actions2d: [{ action: "create_sequence", id: "spoken_exchange", actors: [...parties], messages, ...(title ? { title } : {}) }],
          actions3d: [],
          kind: "a sequence diagram taken from the spoken exchange",
        };
      }
    }
    if (shape === "contrast" && items.length >= 2) {
      const half = Math.ceil(items.length / 2);
      const leftItems = items.slice(1, half).map((item) => item.slice(0, 40));
      const rightItems = items.slice(half + 1).map((item) => item.slice(0, 40));
      return {
        actions2d: [{
          action: "create_compare",
          id: "spoken_compare",
          left: { title: (items[0] ?? "One").slice(0, 40), items: leftItems.length > 0 ? leftItems : [items[0] ?? "One"] },
          right: { title: (items[half] ?? "The other").slice(0, 40), items: rightItems.length > 0 ? rightItems : [items[half] ?? "The other"] },
          ...(title ? { title } : {}),
        }],
        actions3d: [],
        kind: "a comparison taken from the spoken contrast",
      };
    }
    if ((shape === "process" || shape === "enumeration") && items.length >= 3) {
      return {
        actions2d: [{ action: "create_pipeline", id: "spoken_steps", stages: items.slice(0, 6).map((item) => item.slice(0, 48)), ...(title ? { title } : {}) }],
        actions3d: [],
        kind: "the ordered steps the teacher just enumerated",
      };
    }
    // A code stage where the teacher walked through a run of calls but the listing never arrived. The
    // calls themselves are the trace, so the board shows them: nothing is invented, and the student sees
    // the execution instead of being told to imagine it.
    const calls = calledSequence(speech);
    if (calls.length >= 2) {
      return {
        actions2d: [{ action: "create_pipeline", id: "spoken_calls", stages: calls, ...(title ? { title } : {}) }],
        actions3d: [],
        kind: "the run of calls the teacher just walked through",
      };
    }
    return null;
  }

  // Rung 3 — a 3D lesson whose words describe no structure gets a labelled marker instead of nothing, so
  // the stage still shows the step the teacher is on.
  if ((shape === "enumeration" || shape === "process") && items.length >= 3) {
    return {
      actions2d: [],
      actions3d: items.slice(0, 4).map((item, index) => ({
        action: "create_3d_object" as const,
        id: `stage_${index}`,
        type: "text" as const,
        text: item.slice(0, 40),
      })),
      kind: "the ordered steps the teacher just enumerated, as labelled markers",
    };
  }
  return null;
}

// ---- Pass 9: a formula the teacher is teaching must be on the board --------------------------------
//
// The most direct form of "the board must correspond to what the teacher is saying". A step that says
// "F = ma, where F is the net force" and draws nothing formula-shaped teaches a formula by talking about
// it, and a student who looks up misses it entirely. So when the step carries a formula it is teaching,
// the formula and its symbols are drawn — from the step's OWN payload, so the board cannot disagree with
// the sentence being spoken.
const MAX_SYNTHESISED_FORMULAS = 1;

function equationBlockFor(step: TeachingResponse, id: string): VisualAction | null {
  const formula = step.pedagogy?.formula;
  if (!formula?.formula) return null;
  return {
    action: "create_equation_block",
    id,
    formula: formula.formula.slice(0, 300),
    ...(formula.variables && formula.variables.length > 0 ? { variables: formula.variables.slice(0, 8) } : {}),
    ...(formula.calculates ? { calculates: formula.calculates.slice(0, 300) } : {}),
  };
}

/** True when the step already drew the formula it is teaching, as anything at all. */
function formulaIsDrawn(step: TeachingResponse, actions: VisualAction[]): boolean {
  const wanted = (step.pedagogy?.formula?.formula ?? "").replace(/\s+/g, "");
  if (wanted.length < 3) return true;
  return actions.some((action) => {
    if (action.action === "create_equation_block") return action.formula.replace(/\s+/g, "") === wanted;
    if (action.action === "write_formula") return action.formula.replace(/\s+/g, "") === wanted;
    return false;
  });
}

// ---- Pass 10: the variable being explained is the variable on the board ----------------------------
//
// An equation block's symbol rows are addressable, so "now let's look at F" is `highlight` on one row
// rather than a redraw. The index is found from the speech, which is why this is a highlight and not a
// guess: the teacher said which symbol they were on.
function variableRowHighlight(step: TeachingResponse, blockId: string): VisualAction | null {
  const variables = step.pedagogy?.formula?.variables;
  if (!variables || variables.length === 0) return null;
  const speech = step.speech.toLowerCase();
  for (const [index, variable] of variables.entries()) {
    const symbol = variable.symbol.toLowerCase();
    if (symbol.length < 1) continue;
    const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Both halves have to line up: the teacher said the symbol AND used its meaning somewhere. A step
    // that merely mentions "F" in passing is not the step about F.
    const symbolSpoken = new RegExp(`\\b${escaped}\\b`).test(speech);
    const meaning = variable.meaning.toLowerCase().split(/\s+/).filter((word) => word.length > 3);
    const meaningSpoken = meaning.length > 0 && meaning.some((word) => speech.includes(word));
    if (!symbolSpoken && !meaningSpoken) continue;
    return {
      action: "highlight_many",
      ids: [`${blockId}-v${index}`, `${blockId}-m${index}`],
      animate: { kind: "highlight", durationMs: 1200, delayMs: 0 },
    };
  }
  return null;
}

// ---- Pass 11: no visual without a teaching reason -------------------------------------------------
//
// The generated-infographic failure, measured rather than described. A board of "Plain English",
// "Technical Definition", "Key Term" cards is not a lesson; it is a template with the words swapped.
// Two things make it detectable without a topic list:
//
//   * a heading that names a CATEGORY rather than saying anything is filler by construction — "Plain
//     English" is not an explanation of anything, it is a label on one;
//   * a visual that mentions nothing the teacher is currently talking about has no reason to be on the
//     board, however well drawn it is.
//
// Both are checked against the step's own speech, so this works identically for a derivative, a
// handshake and a free-body diagram.
const CATEGORY_ONLY_HEADINGS = /^(?:plain english|simple version|technical definition|formal definition|key (?:term|terms|point|points|idea|ideas)|definition|analogy|intuition|note|notes|remember|remember this|important|tip|tips|summary|in short|other|example|examples|steps?|stage|part|parts|reason|reasons)[:.]?$/i;

/**
 * Intents whose job is to introduce a thing, so naming the thing IS the teaching.
 *
 * Kept separate from `CATEGORY_ONLY_HEADINGS` because the two pull in opposite directions on these
 * steps: "Force" on a `prerequisite` step is the lesson, and "Technical Definition" on the same step is
 * still a category label with nothing under it.
 */
const INTRODUCING_INTENTS: readonly string[] = ["prerequisite", "intuition", "define", "introduce_concept"];

type ReasonVerdict = "keep" | "drop";

/**
 * Whether a 2D action has a reason to be on the board RIGHT NOW.
 *
 * `speech` is the step's own words; `established` is what the lesson has already built. An action earns
 * its place by naming something the teacher said, by being part of a structure, or by attaching itself
 * to something that exists.
 */
function visualTeachingReason(
  action: VisualAction,
  speech: string,
  liveText: string,
): ReasonVerdict {
  // Structures are the lesson's structure. They are never decorative.
  if ((SEMANTIC_STRUCTURE_ACTIONS as readonly string[]).includes(action.action)) return "keep";
  if (["highlight", "highlight_many", "focus", "dim", "restore", "pulse", "fade_in", "fade_out", "animate_path", "move", "resize", "rotate", "camera_focus", "flow", "set_code_pointer", "set_theme", "wait", "remove", "clear", "update_array"].includes(action.action)) return "keep";

  const spoken = `${speech} ${liveText}`;
  const named = (text: string) => {
    const words = text.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
    return words.length > 0 && words.some((word) => spoken.includes(word));
  };

  // A label that names a category rather than saying anything is filler by construction.
  const own = action as { text?: string; role?: string; id: string };
  if ((action.action === "create_text" || action.action === "create_shape" || action.action === "create_container")
    && typeof own.text === "string" && CATEGORY_ONLY_HEADINGS.test(own.text.trim()) && own.role !== "title") return "drop";
  // An empty frame teaches nothing; a frame the lesson will fill next step has no reason to exist yet.
  if (action.action === "create_container" && !own.text) return "drop";
  // A caption attached to something that exists is a label, not decoration.
  if (action.action === "create_label") return named(own.text ?? own.id) ? "keep" : "drop";

  if (typeof own.text === "string" && own.text.trim().length > 0) {
    return named(own.text) ? "keep" : "drop";
  }
  if (action.action === "create_shape" || action.action === "create_icon" || action.action === "create_arrow" || action.action === "create_connector") {
    // An unlabelled primitive is allowed only when something in the speech gives it a name.
    return named(action.id) || named(liveText) ? "keep" : "drop";
  }
  return "keep";
}