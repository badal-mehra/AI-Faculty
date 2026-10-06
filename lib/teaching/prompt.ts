import { TeachingRequest } from "./types";
import { detectRepresentationIntent } from "./representation";
import { getAsset } from "../visual3d/assets";
import { AssetSelection, AssetSelectionOptions, assetCatalogText, libraryIndexText, selectAssetsForLesson } from "./assetSelection";
import { ContextLevel, compactState, recentSpeech, sceneAssetIds, spokenAssetIds } from "./context";
import {
  LessonObjective,
  LessonProgress,
  buildLessonObjective,
  currentStage,
  resumeLessonProgress,
} from "./objective";
import { TeachingLevel, levelGuidance } from "./pedagogy";
import { SEMANTIC_RELATIONS } from "../visual/types";

/**
 * The relation vocabulary, by context level.
 *
 * The full list is reference material; on a busy request the model needs the relations that actually
 * change a layout, not the twenty that do not. Both come from the same declaration the schema uses, so a
 * relation can never be taught here and rejected there.
 */
const RELATION_HINT: Record<ContextLevel, string> = {
  full: ` The relations are: ${SEMANTIC_RELATIONS.join(" | ")}.`,
  compact: " The relations that change a layout most: derives_from | transforms_into | causes | produces | flows_to | input_to | depends_on | part_of | compares_with | related_to.",
  minimal: " The relations that change a layout most: derives_from | transforms_into | causes | produces | flows_to | input_to | part_of | related_to.",
};
import { stageIntent } from "./objective";
import type { TeachingSubject } from "./intent";
import { classifyDomain } from "./taxonomy";
import { visualPolicyFor } from "./visualPolicy";

// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// ---------------------------------------------------------------------------------------------
// A. COMPACT TEACHING INSTRUCTIONS
//
// Written to be short on purpose: everything here is something the model cannot infer for itself
// (the action contract, the rules, the family choice). Renderer internals, geometry notes and
// worked examples live in the repository, not in the prompt.
// ---------------------------------------------------------------------------------------------
//
// TOPIC-SCOPED VISUAL VOCABULARY.
//
// The three families are documented separately and only the ones that can apply to THIS lesson are
// sent. The full guide is 7200 characters: a lesson about Newton's third law was paying for the whole
// binary-search-tree vocabulary and all 920 tokens of 3D camera/isolate vocabulary in every single
// request. Those are not only wasted tokens — they are words the model CAN use wrongly, inventing a
// camera move in a step that should have been a diagram.
//
// Scoping is DETERMINISTIC, from facts already in hand: the subject the objective classified, the
// representation the student named, and whether the asset catalogue found anything 3D for this
// topic. No extra model call. Nothing is scoped away while it could still apply — a topic with a 3D
// asset, or an explicit "in 3D", always keeps the 3D section.
// ---------------------------------------------------------------------------------------------
const FAMILY_INTRO = `You teach any subject by choosing ONE of three visualization families per step. Never force a topic into a family that does not fit it.`;

/** Rigid parent/child structures: trees, BSTs, lists, stacks, graphs, algorithms. */
const GRAPH_VOCABULARY = `1) GRAPH -> board_actions. Rigid structures with parent/child links: trees, BSTs, lists, stacks, graphs, algorithms.
draw_node{id,value,x?,y?,parentId?,side?:"left"|"right"} | connect{from,to} | write_text{id,text,anchor} | highlight{target} | erase{target} | move_node{id,x,y} | clear
"value" is REQUIRED on draw_node. write_text anchor: {type:"object",id,position:"inside"|"above"|"below"|"left"|"right"} to label a node, or {type:"point",x,y} for free text.`;

const RELATION3D_TYPES = `"left_of","right_of","above","below","in_front_of","behind","inside","around","between","near","connected_to","orbiting","attached_to","along_path"`;

/**
 * The 2D action contract, in two sizes.
 *
 * Action NAMES and required fields are ALWAYS sent — the structured-output schema is fixed and
 * providers only return what it declares, so a compact vocabulary never removes a capability. What the
 * compact form drops is the optional-parameter enumeration and the worked examples: the model then
 * uses fewer optional fields, which still produces a valid diagram. That is the difference between
 * "this lesson loses its board" and "this lesson's arrows are plainer", and it is what keeps a busy
 * lesson inside the request budget while still letting the teacher see the scene it must extend.
 */
function diagramVocabulary(level: ContextLevel): string {
  if (level !== "full") {
    return `2) DIAGRAM -> visual_actions. Flows, sequences, comparisons, setups, message exchanges, structures.
STRUCTURES FIRST: give the STRUCTURE, never coordinates. Cells are addressable afterwards as "<id>-c0","<id>-c1" and boxes as "<id>-<nodeId>".
create_array{id,values,indices?,title?} | update_array{id,values} | create_linked_list{id,nodes:[{id,value}],doubly?} | create_stack{id,values,topLabel?} | create_queue{id,values,frontLabel?,rearLabel?} | create_tree{id,nodes,edges:[{from,to}]} | create_graph{id,nodes,edges,layout?:"grid"|"circle"|"layered"} | create_sequence{id,actors:[name],messages:[{from:ActorName,to:ActorName,label}]} | create_pipeline{id,stages:[name]} | create_timeline{id,items:[{id?,label,text?}],orientation?} | create_compare{id,left:{title,items},right:{title,items}}
NEVER fake a structure with hand-placed boxes. Reveal it across steps, then highlight one part per sentence.
create_shape{id,shape,semantic?,text?} | create_container | create_icon{id,glyph} | create_text{id,text,size?,role?} | create_label{id,target,text,side?} | write_formula{id,formula} | create_code_block{id,code,language?,title?,highlightLines?} | set_code_pointer{id,lines}
create_arrow{id,from,to,label?,style?,kind?} | create_connector{id,from,to,label?,kind?} | move | resize | rotate | highlight | highlight_many{ids} | focus{ids} | dim{ids} | restore | pulse | fade_in | fade_out | flow{id} | animate_path{id,to} | remove | clear | wait{durationMs} | set_theme{theme}
Placement2D is ONE of {"kind":"anchor","anchor":(...)}, {"kind":"relative","relativeTo":id,"side":(...)}, {"kind":"between","between":[id,id]}, {"kind":"point","x":y":number}. Any diagram action may add "animate":{"kind":("appear"|"disappear"|"move"|"highlight"|"draw"|"draw_connector"|"flow"|"travel"|"insert"|"remove"|"reorder"|"compare"|"substitute"|"eliminate"|"trace"|"transform"),"durationMs":number<=8000}. Animate the CHANGE: "eliminate", "substitute", "move", "insert", "remove".`;
  }
  return `2) DIAGRAM -> visual_actions. Flows, sequences, comparisons, setups, message exchanges, structures.
STRUCTURES FIRST. When the idea IS a structure, name it and let the board place everything — you give the STRUCTURE, never the coordinates. Cells are addressable afterwards by their deterministic ids (array cells "<id>-c0","<id>-c1"; boxes "<id>-<nodeId>"; edges "<id>-edge0"), so you can point at one in a later step:
create_array{id,values,indices?,title?} | update_array{id,values} — insertion, deletion and swapping, animated
create_linked_list{id,nodes:[{id,value}],head?,tail?,doubly?} | create_stack{id,values,topLabel?} | create_queue{id,values,frontLabel?,rearLabel?}
create_tree{id,nodes,edges:[{from,to}]} | create_graph{id,nodes,edges,layout?:"grid"|"circle"|"layered"}
create_sequence{id,actors:[name],messages:[{from:ActorName,to:ActorName,label}]} — TCP handshake, HTTP, protocols, lifecycles
create_pipeline{id,stages:[name]} | create_timeline{id,items:[{id?,label,text?}],orientation?:"horizontal"|"vertical",title?} | create_compare{id,left:{title,items},right:{title,items}}
A timeline mark is NAMED: "label" is the phase name, "text" is what happens in it (optional — five framework phases usually want the five names alone), and "id" is what makes that phase addressable later by "highlight".
NEVER fake a structure with hand-placed boxes: an array is create_array, a stack is create_stack, a tree is create_tree. Reveal it across steps (build it, then highlight/focus one part per sentence), never dump the whole diagram at once.
Primitives when no structure fits: create_shape{id,shape,semantic?,text?,width?,height?} | create_container | create_icon{id,glyph} | create_text{id,text,size?,role?:"title"|"subtitle"|"primary"|"secondary"|"annotation"|"caption"|"callout"|"step"} | create_label{id,target,text,side?} | write_formula{id,formula}
create_code_block{id,code,language?,title?,highlightLines?} — ACTUAL SOURCE as a numbered, syntax-coloured listing with the explained line lit. Use it for every code or pseudo-code stage; write_formula is for MATHS ("F = ma", "mean = 25.5"), never for code. Keep code to about 12 short lines (about 40 characters each) with its real indentation, and set highlightLines to the 1-based lines you are explaining.
set_code_pointer{id,lines} — MOVE the execution pointer on an existing code block, so "now line three" moves the highlight instead of redrawing the listing.
create_arrow{id,from,to,label?,style?:"solid"|"dashed"|"dotted",kind?:"straight"|"curved"|"elbow"|"bidirectional"|"parent_child"|"next_pointer"|"dependency"|"flow"|"pointer"} | create_connector{id,from,to,label?,kind?}
move{id,placement} | resize | rotate | highlight | highlight_many{ids} | focus{ids} — point at what you are saying and subdue the rest | dim{ids} / restore — an eliminated half, an already-visited node | pulse | fade_in | fade_out | flow{id} — a packet travelling along a connector | animate_path{id,to} | remove | clear | wait{durationMs} | set_theme{theme:"computer-science"|"mathematics"|"physics"|"biology"|"chemistry"|"history"|"general"}
Placement2D is ONE of {"kind":"anchor","anchor":("center"|"top"|"bottom"|"left"|"right"|"top_left"|"top_right"|"bottom_left"|"bottom_right")}, {"kind":"relative","relativeTo":string,"side":("left"|"right"|"above"|"below"),"gap"?:number}, {"kind":"between","between":[string,string]}, {"kind":"point","x":number,"y":number}. Any diagram action may add "animate":{"kind":("appear"|"disappear"|"move"|"highlight"|"draw"|"draw_connector"|"flow"|"travel"|"insert"|"remove"|"reorder"|"compare"|"substitute"|"eliminate"|"trace"|"transform"),"durationMs":number<=8000,"delayMs"?:number}. Animate the CHANGE, not the arrival: "eliminate" for the half a search discards, "substitute" for the term a derivation replaces, "move" for a boundary or pointer that shifts, "insert"/"remove" for a value entering or leaving a structure.`;
}

/** The 3D action contract, in two sizes — same rule as the 2D one. */
/**
 * The 3D action contract, in two sizes â€” same rule as the 2D one.
 *
 * `animate` is written once per level rather than on every action: the schema declares the field for
 * the whole object, and a sentence saying so is worth forty repetitions of "animate?" removed. The
 * difference here is roughly 150 tokens, which is the difference between a busy 3D lesson keeping its
 * live scene state and being compacted down to nothing.
 */
function scene3dVocabulary(level: ContextLevel): string {
  const header = `3) 3D -> visual3d_actions. Anything whose meaning depends on depth, containment, rotation, circulation or a real object's shape: organs, cells, molecules, atoms, circuits, Earth layers, the solar system, solids, machines, network hardware.`;
  const common = `Vec3 = {"x":number,"y":number,"z":number}. Placement3D is ONE of {"kind":"relation","relation":{"type":Relation3D,"objects":[id,id?],"anchorPart"?,"gap"?:number,"offset"?:number,"axis"?}}, {"kind":"anchor","anchor":("center"|"ground"|"left"|"right"|"above"|"below"|"front"|"back")}, {"kind":"relative","relativeTo":id,"side":("left"|"right"|"above"|"below"|"front"|"back"),"gap"?:number}, {"kind":"point","x":number,"y":number,"z":number}.`;
  const relations = `Relation3D: ${RELATION3D_TYPES}. Prefer relations over coordinates: "inside", "around", "between", "attached_to" (with "anchorPart"), "left_of"/"right_of", "orbiting".`;
  if (level !== "full") {
    return `${header}
create_3d_object{id,type,placement?,position?,scale?,color?,asset?,part?,text?,label?,orbit?} | remove_3d_object | move_3d_object{id,position} | rotate_3d_object{id,rotation} | scale_3d_object{id,scale} | highlight_3d_object{id,part?,color?} | pulse_3d_object{id,color?,amplitude?,periodMs?}
show_3d_label{id,target,text,subtitle?,part?,side?,leader?} | hide_3d_label | hide_annotation
animate_flow{id,from,to} | animate_path{id,to} | animate_particle{id,path:[Vec3,...]}
animate_orbit{id,center} | animate_spin{id} | animate_oscillate{id,pivot}
focus_camera{target,part?} | frame_camera{target?} | follow_object{target,part?} | show_vector{id,from,direction} | show_measurement{id,from,to,text?} | wait{durationMs} | clear_3d_scene
"type" is one of sphere/box/cylinder/cone/torus/plane/arrow/particle/tube/line/molecule/crystal/text/model. Any action may add "animate":{"kind":("move"|"rotate"|"scale"|"highlight"|"appear"|"disappear"),"durationMs":number<=8000,"delayMs"?:number}.
${common}
${relations} The camera and part-inspection actions omitted above are documented at the full context level.`;
  }
  return `${header}
create_3d_object{id,type:"sphere"|"box"|"cylinder"|"cone"|"torus"|"plane"|"arrow"|"particle"|"tube"|"line"|"molecule"|"crystal"|"text"|"model",placement?,position?,scale?,color?,asset?,part?,text?,label?,orbit?} | remove_3d_object{id} | move_3d_object{id,position} | rotate_3d_object{id,rotation} | scale_3d_object{id,scale} | highlight_3d_object{id,part?,color?} | pulse_3d_object{id,color?,amplitude?,periodMs?,durationMs?}
show_3d_label{id,target,text,subtitle?,part?,side?:"left"|"right"|"above"|"below",leader?,color?,size?} | hide_3d_label{id} | hide_annotation{id}
animate_flow{id,from,to,color?,shape?:"sphere"|"cube"|"arrow"|"drop"|"glow",size?,particleCount?,speed?,loop?,trail?,durationMs?} | animate_path{id,to,color?,shape?,particleCount?,speed?,loop?,durationMs?} | animate_particle{id,path:[Vec3,...],color?,particleCount?,speed?,loop?,durationMs?}
animate_orbit{id,center,radius?,speedDegPerSec?,tiltDeg?} | animate_spin{id,axis?:"x"|"y"|"z",speedDegPerSec?} | animate_oscillate{id,pivot,axis?,amplitudeDeg?,periodMs?}
focus_camera{target,part?} | frame_camera{target?} | move_camera{position,target?} | zoom_camera{fov} | reset_camera | return_camera | follow_object{target,part?} | isolate_part{id,part} | restore_parts{id?} | set_visibility{ids,part?,visible} | explode_group{id,parts?,strength?} | assemble_group{id}
show_vector{id,from,direction,length?,vectorKind?:"force"|"velocity"|"acceleration"|"field",color?,text?} | show_measurement{id,from,to,text?,color?} | show_trajectory{id,path?,through?,color?,speed?} | wait{durationMs} | clear_3d_scene
Any action may add "animate":{"kind":("move"|"rotate"|"scale"|"highlight"|"appear"|"disappear"),"durationMs":number<=8000,"delayMs"?:number}.
${common}
${relations}
"objects" lists the referenced ids (two for "between"/"along_path"); "anchorPart" targets a named part of the first object. Worked examples: chloroplast {"type":"inside","objects":["leaf"]}; vessel {"type":"attached_to","objects":["heart"],"anchorPart":"aorta"}; planet {"type":"around","objects":["sun"]}; router {"type":"between","objects":["client","server"]}.`;
}

/** Which families could apply to this lesson. Every one sent is documented in full. */
export type VisualFamilies = { graph: boolean; diagram: boolean; scene3d: boolean };

export function visualFamiliesFor(input: {
  /** The subject the objective classified. */
  subject?: string;
  /** "2d" when the student named their own representation, "3d" when they asked for 3D. */
representationIntent?: "2d" | "3d" | null;
  /**
   * True when the lesson will include code.
   *
   * A code listing is a 2D representation and cannot be drawn in 3D, so a lesson that will teach code is
   * taught on the board. Without this, "Explain a linked list in C++ and show how an insertion works"
   * matched a linked-list NODE model, went to the 3D stage, and lost every `create_code_block` the code
   * stages wrote — a C++ lesson with no C++ in it. An explicit "in 3D" still wins.
   */
  codeRelevant?: boolean;
  /**
   * The student pressed the 2D button. This is stronger than a representation phrase in the question:
   * it means the 3D vocabulary is not sent at all, so a model can neither be tempted into it nor leave
   * the gate holding actions for a stage the student will never look at. The renderer still degrades
   * upward if content arrives that only exists in 3D, which is the honest fallback for an impossible
   * request — but "impossible" must be established, not assumed because a model happens to exist.
   */
  explicitTwoDimensional?: boolean;
  /** Assets the catalogue matched for this topic. Zero means 3D has nothing real to show. */
  relevant3dAssets: number;
}): VisualFamilies {
  const asked3d = input.representationIntent === "3d";
  // The GRAPH family is the smallest of the three, but its structures genuinely do not arise in these
  // subjects, and keeping it invited trees where a force diagram belonged. Biology and astronomy join
  // them here: a parent/child node graph describes a taxonomy or an orbital hierarchy, which is at best
  // a distraction from an organ's anatomy or a star's structure, and it costs real request budget that a
  // formula explanation needs more.
  const nonStructural = input.subject === "mathematics" || input.subject === "physics"
    || input.subject === "chemistry" || input.subject === "humanities"
    || input.subject === "biology" || input.subject === "astronomy";
return {
    graph: !nonStructural,
    diagram: true,
    // 3D needs something to show or an explicit request. With neither, sending the vocabulary invites
    // the model to build a generic primitive for a topic that has no spatial shape. An explicit 2D
    // choice removes it entirely — see `explicitTwoDimensional` — and so does a lesson that will teach
    // code, which can only be drawn on the board.
    scene3d: input.explicitTwoDimensional || (input.codeRelevant === true && !asked3d)
      ? false
      : asked3d || input.relevant3dAssets > 0,
  };
}

/**
 * Whether a matched asset is a reason to teach this topic in 3D.
 *
 * Two conditions, both necessary:
 *
 *  1. Its category is not `mathematics` or `humanities`. A grid plane or a cylinder is a PROP for drawing
 *     something flat; the third dimension is not what teaches a matrix or a volume.
 *  2. THE QUESTION NAMES IT. Most of the asset vocabulary is a set of things a lesson mentions rather
 *     than a lesson about — "circuit" finds a circuit board while the student is analysing a circuit, a
 *     recursion lesson is not about a stack block. Only when the request actually names the object is its
 *     spatial relationship the thing that teaches the idea.
 *
 * Both are derived from the registry and the request, so this is the same judgement for every topic.
 */
export function assetJustifies3D(assetId: string, question: string): boolean {
  const asset = getAsset(assetId);
  if (!asset) return false;
  if (NON_SPATIAL_ASSET_CATEGORIES.has(asset.category)) return false;
  return assetIsNamedBy(question, assetId);
}

/** Categories whose models are visual aids, not objects whose 3D shape carries the meaning. */
const NON_SPATIAL_ASSET_CATEGORIES: ReadonlySet<string> = new Set(["mathematics", "humanities"]);

/**
 * How much of an asset's own name the request actually says.
 *
 * A threshold, not a lookup: "Human Heart" against "Explain the human heart and how blood circulates
 * through it" is 100%, and "Circuit Board" against "Analyse an RC circuit" is one word in three. Both are
 * handled by the same rule, and neither has a topic named in it.
 */
const NAMED_BY_THRESHOLD = 0.6;

export function assetIsNamedBy(question: string, assetId: string): boolean {
  const asset = getAsset(assetId);
  if (!asset) return false;
  const slug = (asset.id.split("/")[1] ?? "").replace(/[_-]+/g, " ");
  const words = Array.from(new Set(`${slug} ${asset.name}`.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 3)));
  if (words.length === 0) return false;
  const said = question.toLowerCase();
  const named = words.filter((word) => said.includes(word)).length;
  return named / words.length >= NAMED_BY_THRESHOLD;
}

/** How many matched assets actually justify teaching this topic in 3D. */
export function spatialAssetCount(question: string): number {
  return selectAssetsForLesson(question, { limit: 10, maxParts: 3, sceneAssets: [], recentSpeech: [] })
    .relevant.filter((asset) => assetJustifies3D(asset.id, question)).length;
}

/** Rules that hold whatever the family. */
const CORE_RULES = `Rules:
- Output ONLY the requested JSON object. Never invent action names or fields; never write code, HTML, CSS, JSON schema or markdown.
- Never supply external URLs, file paths, model data or camera distances. Model assets are auto-scaled and auto-framed; only "asset" ids from the catalog below are valid.
- Colors are hex strings such as "#ff5500", never names like "red". A flow must run between two DIFFERENT ids.
- Every deep step MUST change the board, and every action must point at an id that already exists in the state above or that you create earlier in this batch. If your speech says "let's visualise this", "on the board" or "imagine", draw the thing you just described; an action aimed at a missing id, or a step that only talks, achieves nothing.
- Keep each step small (about 12 actions max) and advance ONE sub-idea. Inspect the supplied state: never redraw what exists; add only what the next idea needs, reusing stable ids.
- Never repeat yourself: a point, stage or sentence already taught must not be taught again. If you must revisit an idea, add something genuinely new and say that you are.
- Never spend a step on the lesson itself. These openers are BANNED: "Before we dive into…", "Before we look at…", "As we move forward…", "Before we begin…", "To understand this properly, we first need to…", "Keep in mind…", "You are now ready…", "Let's get started…". Open with the CONTENT — the first sentence must teach something the student did not know ten seconds ago.
- Use exactly one visualization family per step. 3D-capable topics use visual3d_actions alone; never duplicate the same idea in 2D.
- Never invent a rotation. If something must point a particular way, build it with the structure that already points that way (a free-body diagram, a circuit, a plot), or say which relation it expresses.
- Honour a requested representation. A request that names its OWN shape — boxes, cells, a table, rows, "one on top of the other", "next to each other" — is a 2D request: build exactly that with board or diagram actions, even when the catalog has a 3D model for the topic, and keep labels short enough to sit inside the shape they name. A catalog model wins only when the student is asking about the real object itself.
- Numbering: "next_step" is always "lesson_step"+1. You never decide that a lesson is over — the app checks the lesson objective and closes the lesson itself, so never write "lesson complete", "that's all", or a closing summary before the recap stage.

Teaching style — this is a TUTOR, not a summarizer:
- Teach the whole idea from the very basics, assuming the student knows NOTHING about this topic yet.
- Order inside a step: intuition or everyday analogy FIRST, then the correct technical term, then the concrete detail. "Imagine a chain of boxes, each holding one value and the address of the next box" teaches a linked list; "a linked list is a linear data structure of nodes joined by pointers" does not, because it gives the student nothing to hold on to.
- Answer "why does this exist?" before "how do I implement it". Explain any prerequisite term (a pointer, memory, a call stack, energy) inside the step that needs it, briefly and simply.
- Progressive difficulty, never a flat list of facts: basics -> intuition -> concept and terms -> visual -> small example -> code -> walkthrough -> execution trace -> mistakes -> real use -> recap.
- Write for note-taking: open by naming the sub-point, then state the specifics (names, numbers, steps, order) explicitly, and repeat an important idea in a second form.
- The last stage is a SUMMARY the student could write down: name each thing they can now do, recall or compute, one line each, in order, with no new material introduced. "To wrap up" with nothing summarisable is not a conclusion.
- speech: 4-8 sentences (about 70-150 words) for a deep lesson — a real teacher paragraph, not "Ab node banate hain." For an explicitly short request, one or two sentences.
- Board text stays short (a heading, a label, or one code line under about 40 characters); never put your speech or a paragraph on the board.`;

/**
 * THE REPRESENTATION LADDER — what to show, in order, when the ideal representation is not available.
 *
 * It replaces the old rule that told the model "no asset means no model: use a primitive instead",
 * which is exactly how a lesson about the human heart ended up showing one large white cube. It is
 * scoped to what THIS lesson can actually show, so it costs a few lines rather than the whole ladder:
 * a lesson with catalog models is told to use them, and a lesson without is told to draw the real
 * structure instead of inventing a picture.
 */
function representationLadderRules(catalogModels: number): string {
  if (catalogModels > 0) {
    return `Representation — use the REAL thing:
- "type":"model" REQUIRES an "asset" id from the catalog, and you MUST use it whenever the catalog lists a model for what you are teaching. A sphere/box/cylinder standing in for something the catalog can model is the worst thing you can do: it looks like a lesson and teaches nothing. Primitives are ONLY for something with no model: an abstract node, a counter, a stage marker, a flow particle.
- Name what you point at, and highlight the same part you name.`;
  }
  return `Representation — this topic has no catalog model, so build the real STRUCTURE:
- Structures first, never hand-placed boxes pretending to be one: create_array, create_tree, create_graph, create_sequence, create_pipeline, create_compare, create_code_block. If no diagram would help, explain in words — never invent a picture to fill the screen.`;
}

/**
 * 3D modelling and camera ADVICE, sent only at the full context level.
 *
 * Nothing lost here is a guarantee. The alignment gate labels any model whose parts the speech names,
 * appends a frame of everything when a step would otherwise end on a narrow one, and drops a wipe that is
 * not rebuilt. So the compact levels keep the guarantees and lose only the coaching, which is the right
 * way round when the two cannot both fit.
 */
const SCENE3D_RULES = `3D habits:
- Step 1 builds the whole scene with stable ids, then "frame_camera".
- Animate the idea, not the camera: flows for what moves, animate_orbit/animate_spin for what keeps moving, animate_oscillate for what swings around a pivot, focus_camera only to read one detail.
- Inspect only when it helps: isolate_part + focus_camera + label for ONE part, then restore_parts; explode_group to separate a complex model, assemble_group to put it back.`;

const DIAGRAM_RULES = `Diagram habits: anchor main entities once and keep them; labels stay short; travelling objects are transient.`;

/**
 * THE PEDAGOGICAL CONTRACT â€” what the model is asked to think in.
 *
 * Before this, the only thing the model could describe was a picture, so it described pictures: a lesson
 * about integrating x²·sin(x) came back with the answer, a formula box, and nothing about what the symbols
 * meant or why integration by parts was the right choice. The board looked generated because the model had
 * nothing else it was able to say.
 *
 * So the model is now asked for the act of teaching (`teaching_intent`) and the reasoning behind it
 * (`pedagogy.why`, `pedagogy.formula`), and the deterministic layer decides what that means for the board.
 * The LLM never writes coordinates, and the renderers never decide what to teach.
 *
 * The intent list is sent compactly, grouped by what the step is doing, because the model's real failure
 * was not knowing the labels â€” it was not being asked.
 */
function pedagogyRules(input: {
  level: TeachingLevel;
  objective: LessonObjective;
  families: VisualFamilies;
  context: ContextLevel;
  progress: LessonProgress;
}): string {
  const { level, objective, families, context, progress } = input;  // The FULL intent list is reference material. At compact and minimal the model only needs the act it
  // is performing right now plus the handful it is most likely to need, because sending all twenty-six
  // names on a busy request is how the request stops fitting at all â€” and a model that cannot see the
  // state it is extending cannot extend it.
  const intents = context === "full"
    ? "prerequisite | introduce_concept | define | intuition | explain_formula | explain_variable | explain_units | explain_relationship | explain_why | choose_method | derive | identify_given | identify_unknown | substitute | calculate | simplify | interpret | demonstrate | worked_example | verify | compare | application | common_mistake | check_understanding | recap"
    : "explain_why | explain_formula | explain_variable | calculate | verify | interpret | worked_example | introduce_concept | recap";
  const stage = currentStage(progress);
  const expected = stage ? ` The stage being taught is "${stage.kind}", so the next step's intent is usually "${stageIntent(stage)}".` : "";
  return `TEACHING, NOT ANSWERING. The answer is not the lesson; a student who can repeat the answer and still cannot solve the next problem has been given nothing.
Set "teaching_intent" on every step to the act you are performing: ${intents}.${expected}
Fill "pedagogy" only where it applies: "why" for the reason a choice was made, "formula" for a formula this step teaches, "example" for a worked value, "interpretation" for what the result MEANS, "verification" for how you checked it.
- A formula is never decoration. Put it in pedagogy.formula with every symbol, its meaning and its unit, plus what it calculates. Writing a formula into a box and moving on teaches nothing.
- "why" is the most valuable field. "Then we differentiate x²" is a procedure; "we differentiate x² rather than sin(x) because the product rule makes this integral worse" is a reason. A student can only copy the first, and can choose after the second.
- For a calculation, never jump to the result: what is given, what is wanted, why the method applies, what each step does and why it is valid, then what the result means.
- Verify where it means something: differentiate an integral result back, substitute an algebraic result in, check units after physics, keep a probability inside 0 to 1. Never fake a check that would be meaningless.
${levelGuidance(level)}
- SAY WHAT A CONNECTION MEANS, not how to draw it. On create_arrow and create_connector put "relation" so the layout can decide which way the two objects sit and which way the line points.${RELATION_HINT[context]}
${subjectDomainRules(objective.subject, families, objective, context)}`;
}

/**
 * Which of the domain-aware structures to reach for, per subject.
 *
 * Deliberately phrased as "when the step is about X, use Y" rather than as a catalogue: a model offered a
 * list of every structure it can draw will pick one by default, which is how a force diagram turned into a
 * flow chart. Each line below is tied to a teaching act, so the structure is only chosen when that act is
 * what the step is doing.
 */
/**
 * The domain's representation policy, stated to the model as a rule rather than left to be caught.
 *
 * This line is the difference between a design lesson being TOLD it gets diagrams and personas, and a
 * design lesson arriving with a call stack on the board because nothing said no. It is generated from the
 * same `visualPolicy` the alignment gate enforces, so the instruction and the check cannot drift apart.
 */
function representationPolicyLine(objective: LessonObjective, context: ContextLevel): string {
  const domain = classifyDomain(objective.topic).primary;
  const policy = visualPolicyFor(domain.domain, objective.subject);
  const allowed = policy.families.filter((family) => family !== "diagram").join(", ") || "diagram only";
  const noCode = policy.allowCode ? "" : " No create_code_block.";
  // At `minimal` there is no room for prose: the domain, the structures it may use, and whether code is
  // allowed are the three facts that change what the model draws, and they fit in one line.
  return context === "minimal"
    ? `REPRESENTATION POLICY (domain=${policy.domain}): ${allowed}.${noCode}`
    : `REPRESENTATION POLICY (domain=${policy.domain}, subject=${policy.coarse}): ${policy.guidance} Available: ${allowed}.${noCode}`;
}

/**
 * The DOMAIN'S OWN VISUAL VOCABULARY, stated with the payload each structure actually reads.
 *
 * PHASE 13, and this function used to name four structures whose payloads it either omitted or got wrong.
 * That is worse than not mentioning them: a model told to send `create_free_body_diagram{name, direction}`
 * sends exactly that, the validator looks for `forces`, finds nothing, and the lesson produces an empty
 * diagram that is logged as "malformed". The shapes below are copied from what `parseVisualAction` reads,
 * so the model is told the truth and the truth is what the engine accepts.
 *
 * The names are domain-specific on purpose. "Continuity of a function" is mathematics because the SUBJECT
 * says so, and mathematics gets equations, curves and derivations — never a linked list, whatever words
 * appear in the question.
 */
function subjectDomainRules(subject: TeachingSubject, families: VisualFamilies, objective: LessonObjective, context: ContextLevel): string {
  const terse = context === "minimal";
  const lines: string[] = [];

  if (subject === "mathematics" || subject === "physics" || subject === "chemistry" || subject === "engineering" || subject === "general") {
    lines.push(terse
      ? "a formula and its symbols -> create_equation_block{id,variables:[{symbol,meaning,unit?}],calculates?}"
      : "a formula or its symbols -> create_equation_block{id,variables:[{symbol,meaning,unit?}],calculates?} — ONE action holding the formula AND every symbol, so the board shows them together and the student can see which term is which. `calculates` is the result it evaluates to.");
  }
  if (subject === "physics" || subject === "mathematics" || subject === "general") {
    lines.push(terse
      ? "forces on a body -> create_free_body_diagram{id,body?,forces:[{name,direction,magnitude?,acts?}]}"
      : "the forces acting on a body -> create_free_body_diagram{id,body?,forces:[{name,direction:\"up\"|\"down\"|\"left\"|\"right\",magnitude?,acts?:\"centre\"|\"surface\"}],motion?:{label,direction}} — ONE force per entry in `forces`, NOT at the top level; `motion` is the velocity/acceleration arrow if the body is moving");
  }
  // Engineering gets the circuit, and it gets the curve: "the capacitor voltage rises exponentially" is
  // the whole point of a transient-response lesson and it is a graph, not a paragraph.
  if (subject === "engineering" || subject === "general" || subject === "physics" || subject === "chemistry") {
    lines.push(terse
      ? "a curve of anything over time -> create_graph_plot{id,points:[{x,y,label?}],xLabel,yLabel}"
      : "a curve of anything over time -> create_graph_plot{id,points:[{x,y,label?}],xLabel?,yLabel?,shape?} — `shape` is the NAME of the curve (\"sin(x)\", \"v = u\"), and `guide:{y,label}` adds a reference line such as an asymptote. A worked sequence of values -> create_array; an ordered process -> create_pipeline");
  }
  if (lines.length === 0) return `Use the structure whose shape matches what this step teaches; never assemble a structure out of loose boxes.\n${representationPolicyLine(objective, context)}`;
  const circuit = subject === "engineering" || subject === "physics" || subject === "chemistry" || subject === "general"
    ? terse
      ? " a circuit -> create_circuit{id,elements:[{label,kind,value}]}"
      : " A circuit, with the components in the order current passes them -> create_circuit{id,elements:[{label,kind,value}],current?}. `kind` is one of resistor, capacitor, inductor, source, battery, switch, diode, opamp, ground."
    : "";
  return `STRUCTURES: ${lines.join("; ")}.${circuit}`
    + (families.scene3d && !terse ? " A circuit drawn in 3D is a free-body-style spatial arrangement, not a schematic; prefer the 2D structure." : "")
    + `\n${representationPolicyLine(objective, context)}`;
}

// Prompt assembly
// ---------------------------------------------------------------------------------------------
export type PromptOptions = {
  level?: ContextLevel;
  assetLimit?: number;
  assetMaxParts?: number;
  /** Pre-built objective. Deterministically derived from the request when omitted. */
  objective?: LessonObjective;
  progress?: LessonProgress;
};

function assetIdsFrom(text: string): string[] {
  return Array.from(text.matchAll(/\b[a-z]+\/[a-z0-9-]+\b/g)).map((match) => match[0]);
}

/**
 * Section F: the teaching objective the whole lesson is planned against.
 *
 * This is what turns one request into a lesson. The planner has already decided what the student must
 * understand before "I taught this topic" is true, so the model is told which stage to teach NOW and
 * which stages are still ahead — instead of being asked for "the next step" with no idea how many are
 * left, which is exactly how a whole topic used to finish after one paragraph.
 */
function objectiveSection(objective: LessonObjective, progress: LessonProgress, level: ContextLevel, startingLessonStep: number): string {
  const brief = objective.depth === "brief";
  const covered = new Set(progress.coveredStageIds);

  const header = brief
    ? "F. THIS REQUEST ASKED FOR A SHORT ANSWER. Give the direct answer in one or two clear sentences. No lesson plan, no recap, no ceremony."
    : `F. LESSON OBJECTIVE — you are teaching ONE complete lesson about "${objective.topic}" (${objective.subject}${objective.codeLanguage ? `, ${objective.codeLanguage}` : ""}).
The student is a beginner. The lesson is only finished when every stage below has been taught; the app checks that for you and requests the next part automatically.`;

  if (brief) return header;

  // Only the stages that still have to be taught are listed in full. A stage that is already taught is
  // summarised as done, so the model cannot mistake the plan for a list of things to repeat.
  const remaining = objective.stages.filter((stage) => !covered.has(stage.id));
  const active = currentStage(progress);
  const done = objective.stages.filter((stage) => covered.has(stage.id));
  const visible = level === "full"
    ? remaining
    : level === "compact"
      ? remaining.slice(0, 5)
      : active ? [active] : [];
  const hidden = remaining.length - visible.length;
  const lines = visible.map((stage) => `[todo] ${stage.id} ${stage.title} — ${stage.goal}`);
  const now = active
    ? `TEACH NOW: ${active.id} ${active.title} — ${active.goal}`
    : "TEACH NOW: the recap stage. Name each thing the student can now DO or recall, in order, one line each, with no new material. A recap that just says the lesson was interesting is not a summary.";
  const coverage = done.length === 0
    ? "Already taught: nothing yet."
    : `Already taught (do NOT teach these again): ${done.map((stage) => `${stage.id} ${stage.title}`).join("; ")}.`;

  return [
    header,
    "",
    "Stages of this lesson that still have to be taught, in order:",
    ...lines,
    ...(hidden > 0 ? [`... and ${hidden} more stage(s) after these.`] : []),
    "",
    now,
    coverage,
    `Set "stage_id" on every step to the stage it teaches, and move that stage forward with real teaching speech. Never repeat a taught stage or a sentence you have already said: if you return to an idea, add something new to it.`,
    `This batch: write ${objective.batchSize} consecutive steps numbered ${startingLessonStep}, ${startingLessonStep + 1}, ... with no gaps and no repeats, each with "next_step" = its own "lesson_step"+1. Keep the same ids so the scene grows instead of restarting. Do not recap until the recap stage.`,
  ].join("\n");
}

export type BuiltPrompt = {
  system: string;
  user: string;
  assets: AssetSelection;
  state: Record<string, unknown>;
  recentSpeech: string[];
  level: ContextLevel;
  /**
   * Which stage this lesson shows, decided ONCE and from the same judgement the renderer will make.
   * A step that draws into the other family produces content the student can never see, so the
   * educational gate reads this rather than re-deriving it.
   */
  representation: "2d" | "3d";
  /**
   * The action families this prompt actually documented.
   *
   * Published because the wire schema has to be scoped to the SAME set. A schema that declares an array
   * the prompt never described is not free headroom — it is a contradiction the model resolves by guessing,
   * and with `additionalProperties: false` the guess is a rejection rather than a stray field.
   */
  families: VisualFamilies;
  stateChars: number;
  speechChars: number;
};

/**
 * Builds sections A-F of the prompt:
 *   A+B compact instructions + action schema, C relevant asset catalog (+ a one-line library index so
 *   the model never invents an asset id), D current lesson state, E student question,
 *   F the lesson objective: the stages, and which one to teach now.
 * `level` controls how much of D and F survives; the asset catalog shrinks first.
 */
export function buildPrompt(request: TeachingRequest, options: PromptOptions = {}): BuiltPrompt {
  const level = options.level ?? "full";
  const objective = options.objective ?? buildLessonObjective(request);
  const progress = options.progress ?? resumeLessonProgress(objective, request.lessonProgress);
  const speech = recentSpeech(request, level);
  const sceneAssets = sceneAssetIds(request);
  const spoken = assetIdsFrom([request.question, request.studentQuestion ?? "", ...speech].join(" "));
  // The student's explicit choice of stage outranks whatever the question wording happens to suggest.
  // It arrives as a request field because the 2D/3D buttons are a decision made AFTER the question was
  // typed, and re-reading the text cannot recover it.
  const representationIntent = request.representationIntent ?? detectRepresentationIntent(request.question);

  const selectionOptions: AssetSelectionOptions & { recentSpeech?: string[] } = {
    limit: options.assetLimit ?? (level === "full" ? 10 : level === "compact" ? 6 : 3),
    maxParts: options.assetMaxParts ?? (level === "full" ? 6 : 3),
    sceneAssets,
    recentSpeech: speech,
  };
  const selection = selectAssetsForLesson(`${request.question} ${spoken.join(" ")}`, selectionOptions);

  // Assets already on screen must always be described in detail, even if this step's wording did
  // not match them: a lesson must be able to keep using the models it already placed.
  const relevant = [...selection.relevant];
  const listed = new Set(relevant.map((asset) => asset.id));
  for (const id of [...sceneAssets, ...spokenAssetIds(request)]) {
    if (listed.has(id)) continue;
    const extra = selectAssetsForLesson(id, { ...selectionOptions, limit: 1, recentSpeech: [] });
    const found = extra.relevant.find((asset) => asset.id === id);
    if (found) {
      relevant.push(found);
      listed.add(id);
    }
  }

  const detail = assetCatalogText(
    relevant,
    `C1. MOST RELEVANT MODELS (${relevant.length}, with semantic parts):`,
  );
  const catalog = [detail, libraryIndexText()].filter(Boolean).join("\n\n");

  const state = compactState(request, level);

// TOPIC-SCOPED VOCABULARY. Only the families that can apply to THIS lesson are sent. The 3D section
  // alone is ~920 tokens, and a lesson about Newton's third law was paying for it — and for the whole
  // binary-search-tree vocabulary — in every request. Nothing is scoped away that could still apply: a
  // topic with a 3D asset in the catalogue, or an explicit "in 3D", keeps 3D.
  const families = visualFamiliesFor({
    subject: objective.subject,
    representationIntent,
    explicitTwoDimensional: representationIntent === "2d",
    codeRelevant: objective.codeRelevant,
    // The stage is decided from the QUESTION ALONE, never from what is already on screen or from what
    // the teacher has said so far. Those grow with every batch, so deciding from them made the stage flip
    // mid-lesson: a TCP lesson taught on the board for six steps, was taught in 3D for the next four,
    // and showed the student whichever one the classroom had locked while the other half of the lesson
    // stayed invisible behind it.
    relevant3dAssets: assetsForQuestionOnly(request),
  });
  const familySections = [
    families.graph ? GRAPH_VOCABULARY : null,
    families.diagram ? diagramVocabulary(level) : null,
    families.scene3d ? scene3dVocabulary(level) : null,
  ].filter(Boolean).join("\n\n");
  const familyGuide = `${FAMILY_INTRO}\n\n${familySections}`;
  // Rules are composed too: the 3D habits only make sense next to the 3D vocabulary, and the diagram
  // habits only when a diagram is being drawn (which is always, but stated per-family rather than
  // assuming the reader knows which family the lesson picked).
  const ruleSections = [
    CORE_RULES,
    representationLadderRules(families.scene3d ? relevant.length : 0),
    families.scene3d ? (level === "full" ? SCENE3D_RULES : null) : null,
    DIAGRAM_RULES,
    // The student's inferred register, not the context level: "how much detail to write" and "how much of the
  // scene to send" are different dials and they are read from different places.
  pedagogyRules({ level: objective.level, objective, families, context: level, progress }),
  ].filter(Boolean).join("\n\n");

  // WHICH STAGE IS ON SCREEN. The app shows one stage for a whole lesson and DROPS the other family's
  // actions, so this is not a preference: an action written into the hidden family is deleted before the
  // student sees it. Saying the decision out loud is worth more than dropping the mistake afterwards.
  const stageLine = families.scene3d
    ? `THIS LESSON IS SHOWN ON THE 3D STAGE. Put every visual in "visual3d_actions" and leave "board_actions" and "visual_actions" empty â€” anything written into them will be deleted and never seen.`
    : `THIS LESSON IS SHOWN ON THE 2D BOARD. Put every visual in "visual_actions" (or "board_actions" for a rigid parent/child graph) and leave "visual3d_actions" empty â€” anything written there will be deleted and never seen.`;
  // The last thing the model reads before it writes. Announcing the lesson and closing without a summary
  // are the two most common teaching failures here, and a concrete before/after is what actually removes
  // them â€” a rule alone, stated earlier in the prompt, did not.
  const system = `${stageLine}\n\n${ruleSections}\n\nBEFORE YOU WRITE, CHECK TWO THINGS.\n1. The first sentence must TEACH something. Instead of "Before we dive into how the human heart works, we must first understand what blood is", write "Blood is the fluid that carries oxygen around the body, and the heart is the pump that keeps it moving." The second version is the lesson; the first is an announcement.\n2. The last stage is a SUMMARY the student could write down: name each thing they can now DO, RECALL or COMPUTE, one line each. Instead of "That is the interesting part of it, and there is more to look at", write "You can now name the four chambers, say which two push blood out, and explain why the left ventricle has the thickest wall."`;

  const stateJson = JSON.stringify(state);
  const speechJson = JSON.stringify(speech);

const user = `D. CURRENT STATE (what already exists — extend it, do not restart it):
${stateJson}

Recently said: ${speechJson}

C. ${catalog}

E. Teach "${request.question}" in ${request.language} starting at lesson step ${request.lessonStep}.${request.studentQuestion ? `\nThe student interrupted with: "${request.studentQuestion}" — answer it directly, and only change the scene if it genuinely helps.` : ""}

${objectiveSection(objective, progress, level, request.lessonStep)}`;

  return {
    system: `${familyGuide}\n\n${system}`,
    user,
    assets: { ...selection, relevant },
    state,
    recentSpeech: speech,
    level,
    representation: families.scene3d ? "3d" : "2d",
    // The families the prompt documented, so the batch instruction and the wire schema can be scoped to
    // exactly the same set. A prompt that names an array the schema omits is a contradiction the model has
    // to resolve, and it resolves it by sending something the gate then deletes.
    families,
    stateChars: stateJson.length,
    speechChars: speechJson.length,
  };
}

/**
 * How many catalog models the STUDENT'S QUESTION alone matches.
 *
 * Deliberately blind to the live scene and to the speech so far. Those two grow every batch, so a count
 * that included them changed the representation decision partway through a lesson, which is how a lesson
 * ended up teaching half its stages on a board the other half was drawn behind.
 */
export function assetsForQuestionOnly(request: TeachingRequest): number {
  return spatialAssetCount(request.question);
}

/**
 * The representation a lesson uses, for callers that need it without building a whole prompt.
 *
 * It exists so exactly one function decides the question. The classroom, the prompt and the
 * educational gate all have to agree, and three independent derivations of the same judgement is how
 * a lesson ends up drawing array cells onto a stage nobody is looking at.
 */
export function lessonRepresentation(input: { subject: string; question: string; relevant3dAssets: number; representationIntent?: "2d" | "3d" | null; codeRelevant?: boolean }): "2d" | "3d" {
  const intent = input.representationIntent ?? detectRepresentationIntent(input.question);
  return visualFamiliesFor({
    subject: input.subject,
    representationIntent: intent,
    explicitTwoDimensional: intent === "2d",
    codeRelevant: input.codeRelevant,
    relevant3dAssets: input.relevant3dAssets,
  }).scene3d ? "3d" : "2d";
}

/** The representation for a whole lesson: a stable function of the question and the student's choice. */
export function representationForRequest(request: TeachingRequest, subject: string, codeRelevant?: boolean): "2d" | "3d" {
  return lessonRepresentation({
    subject,
    question: request.question,
    relevant3dAssets: assetsForQuestionOnly(request),
    representationIntent: request.representationIntent ?? null,
    codeRelevant,
  });
}

/**
 * The batch instruction, naming ONLY the action arrays this lesson actually has.
 *
 * PHASE 13/12. It used to name all three unconditionally, which contradicted a family-scoped schema: the
 * model was told to fill a `visual3d_actions` array the schema did not contain, and the app then had to
 * delete whatever arrived in it. Naming what exists also saves tokens, which is the same budget the schema
 * just freed up.
 */
const lessonInstructionsFor = (families: VisualFamilies): string => {
  const arrays = [
    families.graph ? '"board_actions": []' : null,
    families.diagram ? '"visual_actions": []' : null,
    families.scene3d ? '"visual3d_actions": []' : null,
  ].filter(Boolean).join(", ");
  return `Generate the consecutive steps requested in section F, starting at "startingLessonStep". Each step is one JSON object: {"speech": string, ${arrays}, "lesson_step": number, "next_step": number, "stage_id": string}. Preserve the supplied state across the sequence and keep ids stable so the scene builds up instead of restarting. Set "next_step" = "lesson_step"+1 on every step, including the last one of this batch: the batch is not the lesson, and the app requests the next part itself until the objective is covered.`;
};

// Kept for callers that only need the user-visible instructions (diagnostics tooling, tests).
export const TEACHING_SYSTEM_PROMPT = buildPrompt({
  question: "",
  language: "English",
  lessonStep: 1,
  boardState: { nodes: [], edges: [], texts: [], highlights: [] },
}).system;

export function teachingPrompt(request: TeachingRequest, options: PromptOptions = {}): string {
  return buildPrompt(request, options).user;
}

export function teachingLessonPrompt(request: TeachingRequest, options: PromptOptions = {}): string {
  const built = buildPrompt(request, options);
  return `${built.user}\n\n${lessonInstructionsFor(built.families)}`;
}

export function teachingSystemPrompt(options: PromptOptions = {}): string {
  return buildPrompt({
    question: "",
    language: "English",
    lessonStep: 1,
    boardState: { nodes: [], edges: [], texts: [], highlights: [] },
  }, options).system;
}