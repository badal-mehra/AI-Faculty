// General-purpose VISUAL ACTION SCHEMA.
//
// The teaching model NEVER emits React/HTML/CSS/JS. It emits these semantic actions only.
// The visualization engine turns them into a deterministic scene, and a renderer draws the
// scene. The existing Graph Board (draw_node/connect/...) stays a separate, supported action
// family — this schema is the generalized layer that sits alongside it.

// ---- Diagram viewport (same 800x520 surface the graph board uses) ----
export const DIAGRAM_WIDTH = 800;
export const DIAGRAM_HEIGHT = 520;
export const VISUAL_MARGIN = 28;

// ---- Bounded numeric limits (validation rejects anything outside these) ----
export const MIN_OBJECT_SIZE = 8;
export const MAX_OBJECT_SIZE = 720;
export const MAX_TEXT_LENGTH = 240;
export const MAX_GLYPH_LENGTH = 4;
export const MIN_ANIMATION_MS = 0;
export const MAX_ANIMATION_MS = 8000;
// Raised from 24/40: a real array (cells + index labels + a title) and a tree with edges are more
// than 24 actions, and a silently truncated structure is worse than a bigger prompt payload.
export const MAX_VISUAL_ACTIONS_PER_STEP = 72;
export const MAX_OBJECTS = 120;
export const MAX_ARROW_OFFSET = 320;

export const SHAPE_KINDS = [
  "rectangle", "rounded_rectangle", "square", "circle", "ellipse", "capsule", "diamond", "triangle",
  "hexagon", "pentagon", "cylinder", "arrow", "line", "container", "polygon", "point", "marker",
] as const;
export type ShapeKind = typeof SHAPE_KINDS[number];

export const SEMANTIC_KINDS = [
  "process", "state", "component", "packet", "note", "terminal", "decision", "service", "actor", "data",
  "node",
] as const;
export type SemanticKind = typeof SEMANTIC_KINDS[number];

// Visual hierarchy: a scene is not a set of equals. The role decides emphasis, type size and whether
// inactive siblings are subdued, and it is derived from meaning (a title reads as a title) rather
// than from whatever the model happened to call the object.
export const VISUAL_ROLES = ["title", "subtitle", "primary", "secondary", "annotation", "caption", "callout", "step"] as const;
export type VisualRole = typeof VISUAL_ROLES[number];

// Subject styling. Styling follows the DOMAIN, never randomness: the same lesson always looks the same.
export const VISUAL_THEMES = ["general", "computer-science", "mathematics", "physics", "biology", "chemistry", "history"] as const;
export type VisualTheme = typeof VISUAL_THEMES[number];

export const ANCHORS = ["center", "top", "bottom", "left", "right", "top_left", "top_right", "bottom_left", "bottom_right"] as const;
export type Anchor = typeof ANCHORS[number];

export const RELATIVE_SIDES = ["left", "right", "above", "below"] as const;
export type RelativeSide = typeof RELATIVE_SIDES[number];

// Teach with motion, not with opacity. `draw` extends a connector line, `flow` runs a packet along it,
// `spotlight`/`dim` create focus, `swap`/`insert`/`delete`/`visit`/`compare` drive algorithm traces.
export const ANIMATION_KINDS = [
  "appear", "disappear", "move", "pulse", "highlight", "travel", "fade",
  "draw", "flow", "dim", "spotlight", "expand", "collapse", "rotate",
] as const;
export type AnimationKind = typeof ANIMATION_KINDS[number];

export const ARROW_STYLES = ["solid", "dashed", "dotted"] as const;
export type ArrowStyle = typeof ARROW_STYLES[number];

// HOW a connection is drawn. The semantic kind drives routing, arrowheads and curvature, so "the next
// pointer of a linked-list node" never renders as the same straight line as a parent-child edge.
export const CONNECTOR_KINDS = [
  "straight", "curved", "elbow", "bidirectional", "dashed", "dotted", "dependency", "flow",
  "pointer", "parent_child", "next_pointer",
] as const;
export type ConnectorKind = typeof
  CONNECTOR_KINDS[number];

/**
 * WHAT a connection means.
 *
 * `CONNECTOR_KINDS` says how to draw the line; this says what the line is FOR, which is what tells the
 * layout which way the two objects stand to each other. They are separate fields because drawing and
 * meaning are independent: a derivation link and a flow link both draw an arrow, and reading them in
 * different directions is the whole point.
 *
 * Declared here rather than in `lib/visual/semantics.ts` because it is part of the action contract the
 * model writes, and the provider schemas mirror this list exactly.
 */
export const SEMANTIC_RELATIONS = [
  "part_of", "contains", "belongs_to", "instance_of",
  "depends_on", "causes", "leads_to", "requires", "supports", "contradicts",
  "transforms_into", "derives_from", "produces", "converts_to",
  "compares_with", "equivalent_to", "inverse_of", "proportional_to",
  "flows_to", "precedes", "follows", "input_to", "output_of",
  "represents", "example_of", "definition_of", "related_to",
] as const;
export type SemanticRelation = typeof SEMANTIC_RELATIONS[number];

export type Point = { x: number; y: number };

// ---- SEMANTIC STRUCTURES -----------------------------------------------------------------------
// The teaching model says WHAT has to be shown ("an array of four cells", "a doubly linked list",
// "a stack with these three values"), never WHERE. These payloads are structural, not positional:
// they contain values, order and relationships only. The deterministic layout module turns them into
// ordinary primitive actions with computed coordinates, so the scene model, the reducer and the
// renderer stay exactly what they were.
export type StructureNode = { id: string; value: string; sub?: string };
export type StructureEdge = { from: string; to: string; label?: string; dashed?: boolean };
export type StructureMessage = { from: string; to: string; label?: string; dashed?: boolean };

export type ArrayLayout = { id: string; values: string[]; indices?: boolean; title?: string; vertical?: boolean };
export type LinkedListLayout = {
  id: string;
  nodes: StructureNode[];
  head?: string;
  tail?: boolean;
  doubly?: boolean;
  title?: string;
};
export type StackLayout = { id: string; values: string[]; topLabel?: string; title?: string };
export type QueueLayout = { id: string; values: string[]; frontLabel?: string; rearLabel?: string; title?: string };
export type TreeLayout = { id: string; nodes: StructureNode[]; edges: StructureEdge[]; title?: string; side?: "left" | "right" };
export type GraphLayout = {
  id: string;
  nodes: StructureNode[];
  edges: StructureEdge[];
  layout?: "grid" | "circle" | "layered";
  title?: string;
};
export type SequenceLayout = { id: string; actors: string[]; messages: StructureMessage[]; title?: string };
export type PipelineLayout = { id: string; stages: string[]; title?: string };
export type TimelineLayout = { id: string; events: Array<{ label: string; text: string }>; title?: string };
export type ComparePanel = { title: string; items: string[] };
export type CompareLayout = { id: string; left: ComparePanel; right: ComparePanel; title?: string };

// ---------------------------------------------------------------------------------------------
// Domain-aware semantic structures
//
// Each of these is ONE action that compiles to existing primitives through lib/visual/layout.ts.
// They exist because the alternative was worse: a model asked to draw a force diagram with
// create_shape and create_arrow produced hand-placed rectangles with arrows at slightly wrong angles and
// no indication of which force was which — the generated-infographic failure. Asking for a
// free-body-diagram instead gets a body with its forces at their true directions, each one named.
//
// None of these is a new renderer. They are layout knowledge, which is exactly what lib/visual is for.
// ---------------------------------------------------------------------------------------------

/** One row of a formula's symbol table: what the symbol stands for, and its unit. */
export type FormulaRow = { symbol: string; meaning: string; unit?: string };

/**
 * A formula taught, not decorated: the formula set large, with its symbols named beneath it.
 *
 * A formula the student cannot read the symbols of is a picture of a formula. The symbol rows ARE the
 * teaching, and they are addressable afterwards (`${id}-v0`) so a later step can highlight the one symbol
 * it is now explaining.
 */
export type EquationBlockLayout = {
  id: string;
  formula: string;
  variables?: FormulaRow[];
  calculates?: string;
  title?: string;
};

/** One labelled force on a free-body diagram, with the direction it acts. */
export type ForceVector = {
  /** What this force is called on the diagram: "weight", "normal", "tension", "applied". */
  name: string;
  /** Which way it acts: which compass direction, or which way along the object. */
  direction: "up" | "down" | "left" | "right";
  /** Optional magnitude, printed after the name. */
  magnitude?: string;
  /** Where it acts on the body: "centre" or "surface". */
  acts?: "centre" | "surface";
};

/** A body with the forces acting on it — the diagram every mechanics explanation is built on. */
export type FreeBodyLayout = {
  id: string;
  /** What the body is called on the board: "block", "car", "projectile". */
  body: string;
  forces: ForceVector[];
  /** An acceleration or velocity arrow, when the lesson is about motion rather than balance. */
  motion?: { label: string; direction: "up" | "down" | "left" | "right" };
  title?: string;
};

/** One component in a circuit, and the wire order that connects it to the next. */
export type CircuitElement = {
  /** The component's name: "R", "C", "L", "V", "battery", "switch", "diode", "op-amp". */
  label: string;
  kind: "resistor" | "capacitor" | "inductor" | "source" | "battery" | "switch" | "diode" | "opamp" | "ground";
  /** Value printed beside it: "1 kΩ", "100 µF". */
  value?: string;
};

/** A circuit: components in a loop, in the order current passes through them. */
export type CircuitLayout = {
  id: string;
  elements: CircuitElement[];
  /** Whether to draw current flowing round the loop. */
  current?: boolean;
  title?: string;
};

/** One measured or computed point on a plot. */
export type PlotPoint = { x: number; y: number; label?: string };

/**
 * A plotted relationship.
 *
 * Used for a function graph, a motion graph, a charge curve, a velocity-time profile, an energy
 * diagram and a spectrum. Axis labels and units are part of the payload because "the curve rises
 * exponentially" is only true relative to an axis, and a curve on unlabelled axes teaches nothing.
 */
export type GraphPlotLayout = {
  id: string;
  points: PlotPoint[];
  xLabel?: string;
  yLabel?: string;
  /** What the curve does, drawn as a caption: "exponential decay". */
  shape?: string;
  /** A horizontal guide at y = value, for a threshold or a limit. */
  guide?: { y: number; label: string };
  title?: string;
};

// A bounded animation directive. Timing is validated; the timeline owns sequencing.
export type VisualAnimation = {
  kind: AnimationKind;
  durationMs: number;
  /** Optional on the wire: the parser defaults it to 0, so a model never has to write it. */
  delayMs?: number;
};

// Semantic placement — the model does NOT need pixel-perfect coordinates.
export type VisualPlacement =
  | { kind: "anchor"; anchor: Anchor }
  | { kind: "relative"; relativeTo: string; side: RelativeSide; gap: number }
  | { kind: "between"; between: [string, string] }
  | { kind: "point"; x: number; y: number };

/**
 * Fields every action may carry.
 *
 * `group` is what makes the visual lifecycle possible: a structure compiles into dozens of primitives
 * sharing a prefix, so without an explicit group the only way to retire "the previous diagram" would be
 * to guess at ids from strings — and a lesson that guesses cannot retire a twenty-object array.
 */
type Optional = { animate?: VisualAnimation; role?: VisualRole; group?: string };

export type VisualAction =
  | ({ action: "create_shape"; id: string; shape: ShapeKind; semantic?: SemanticKind; text?: string; width?: number; height?: number; fontSize?: number; placement?: VisualPlacement; rotation?: number } & Optional)
  | ({ action: "create_text"; id: string; text: string; placement?: VisualPlacement; size?: number } & Optional)
  | ({ action: "create_label"; id: string; target: string; text: string; side?: RelativeSide } & Optional)
  | ({ action: "create_icon"; id: string; glyph: string; placement?: VisualPlacement; size?: number } & Optional)
  | ({ action: "create_arrow"; id: string; from: string; to: string; label?: string; style?: ArrowStyle; kind?: ConnectorKind; relation?: SemanticRelation; offset?: number } & Optional)
  | ({ action: "create_connector"; id: string; from: string; to: string; label?: string; kind?: ConnectorKind; relation?: SemanticRelation; offset?: number } & Optional)
  | ({ action: "create_container"; id: string; text?: string; width?: number; height?: number; placement?: VisualPlacement } & Optional)
  | { action: "move"; id: string; placement?: VisualPlacement; animate?: VisualAnimation }
  | { action: "resize"; id: string; width: number; height: number; animate?: VisualAnimation }
  | { action: "rotate"; id: string; degrees: number; animate?: VisualAnimation }
  | { action: "highlight"; id: string; animate?: VisualAnimation }
  | { action: "highlight_many"; ids: string[]; animate?: VisualAnimation }
  /** Puts all the teacher's attention on `ids` and visibly subdues everything else. */
  | { action: "focus"; ids: string[]; animate?: VisualAnimation }
  /** Explicitly subdues objects without changing emphasis (used by elimination halves, visited nodes). */
  | { action: "dim"; ids: string[] }
  | { action: "restore"; ids?: string[] }
  | { action: "pulse"; id: string; animate?: VisualAnimation }
  | { action: "fade_in"; id: string; animate?: VisualAnimation }
  | { action: "fade_out"; id: string; animate?: VisualAnimation }
  /** Runs a packet along an existing connection (a value travelling, a request in flight). */
  | { action: "flow"; id: string; durationMs?: number }
  | { action: "animate_path"; id: string; to: string; label?: string; durationMs?: number }
  | ({ action: "write_formula"; id: string; formula: string; placement?: VisualPlacement; size?: number } & Optional)
  | ({ action: "create_code_block"; id: string; code: string; language?: string; title?: string; highlightLines?: number[]; placement?: VisualPlacement; size?: number } & Optional)
  | ({ action: "set_code_pointer"; id: string; lines: number[] } & Optional)
  | { action: "set_theme"; theme: VisualTheme }
  | { action: "wait"; durationMs: number }
  | { action: "remove"; id: string }
  | { action: "clear" }
  | { action: "camera_focus"; id: string }
  // ---- Semantic structures (compiled to primitives by lib/visual/layout.ts) ----
  | { action: "create_array"; id: string; values: string[]; indices?: boolean; title?: string; vertical?: boolean; animate?: VisualAnimation }
  | { action: "update_array"; id: string; values: string[]; indices?: boolean; vertical?: boolean; animate?: VisualAnimation }
  | { action: "create_linked_list"; id: string; nodes: StructureNode[]; head?: string; tail?: boolean; doubly?: boolean; title?: string; animate?: VisualAnimation }
  | { action: "create_stack"; id: string; values: string[]; topLabel?: string; title?: string; animate?: VisualAnimation }
  | { action: "create_queue"; id: string; values: string[]; frontLabel?: string; rearLabel?: string; title?: string; animate?: VisualAnimation }
  | { action: "create_tree"; id: string; nodes: StructureNode[]; edges: StructureEdge[]; title?: string; side?: "left" | "right"; animate?: VisualAnimation }
  | { action: "create_graph"; id: string; nodes: StructureNode[]; edges: StructureEdge[]; layout?: "grid" | "circle" | "layered"; title?: string; animate?: VisualAnimation }
  | { action: "create_sequence"; id: string; actors: string[]; messages: StructureMessage[]; title?: string; animate?: VisualAnimation }
  | { action: "create_pipeline"; id: string; stages: string[]; title?: string; animate?: VisualAnimation }
  | { action: "create_timeline"; id: string; events: Array<{ label: string; text: string }>; title?: string; animate?: VisualAnimation }
  | { action: "create_compare"; id: string; left: ComparePanel; right: ComparePanel; title?: string; animate?: VisualAnimation }
  // ---- Domain-aware semantic structures (compiled to primitives by lib/visual/layout.ts) ----
  | { action: "create_equation_block"; id: string; formula: string; variables?: FormulaRow[]; calculates?: string; title?: string; animate?: VisualAnimation }
  | { action: "create_free_body_diagram"; id: string; body: string; forces: ForceVector[]; motion?: { label: string; direction: ForceVector["direction"] }; title?: string; animate?: VisualAnimation }
  | { action: "create_circuit"; id: string; elements: CircuitElement[]; current?: boolean; title?: string; animate?: VisualAnimation }
  | { action: "create_graph_plot"; id: string; points: PlotPoint[]; xLabel?: string; yLabel?: string; shape?: string; guide?: { y: number; label: string }; title?: string; animate?: VisualAnimation };

// One of these enum entries satisfies TS's exhaustive switch while keeping the union extensible.
export const VISUAL_ACTION_TYPES = [
  "create_shape", "create_text", "create_label", "create_icon", "create_arrow", "create_connector",
  "create_container", "move", "resize", "rotate", "highlight", "highlight_many", "focus", "dim",
  "restore", "pulse", "fade_in", "fade_out", "flow", "animate_path", "write_formula", "set_theme",
  "wait", "remove", "clear", "camera_focus",
  "create_code_block", "set_code_pointer", "create_array", "update_array", "create_linked_list", "create_stack", "create_queue", "create_tree",
  "create_graph", "create_sequence", "create_pipeline", "create_timeline", "create_compare",
  "create_equation_block", "create_free_body_diagram", "create_circuit", "create_graph_plot",
] as const;
export type VisualActionType = typeof VISUAL_ACTION_TYPES[number];

/** Actions that build a semantic structure; they never reach the reducer uncompiled. */
export const SEMANTIC_STRUCTURE_ACTIONS = [
  "create_code_block", "set_code_pointer", "create_array", "update_array", "create_linked_list", "create_stack", "create_queue", "create_tree",
  "create_graph", "create_sequence", "create_pipeline", "create_timeline", "create_compare",
  "create_equation_block", "create_free_body_diagram", "create_circuit", "create_graph_plot",
  // Mutators act on a structure rather than creating one, so they follow whichever structure their target
  // is: `update_array` teaches whatever the array was for, and a subject that forbids `create_array`
  // would otherwise be forbidding the act of changing an array it already has.
  "update_array", "set_code_pointer",
] as const satisfies readonly VisualActionType[];
export type SemanticStructureActionType = typeof SEMANTIC_STRUCTURE_ACTIONS[number];

// ---- Resolved scene (renderer input; fully deterministic for a given action sequence) ----

export type VisualObjectKind = "shape" | "text" | "label" | "icon" | "arrow" | "connector" | "container" | "formula" | "code_block";

/**
 * How much of the student's attention a piece of the board deserves RIGHT NOW.
 *
 * The board shows one lesson's whole history by default, which is why a lesson about Newton's second
 * law ends with Force, Mass, Acceleration, Velocity, Given, Cause→Effect, old formulas, new labels and
 * a duplicated concept all competing. A student should be able to look at the board for two seconds and
 * say what is being explained. These six states are how that becomes true, and the priority numbers are
 * the attention model the renderer applies.
 *
 *   current     — what this step is about. Full attention, and it is what `focus` points at.
 *   temporary   — an interruption's answer. Visible while it is being explained, gone when the lesson
 *                 resumes. It must never become part of the lesson.
 *   supporting  — still needed to understand the current step. Present, quieter.
 *   context     — finished teaching, but cheap to keep and genuinely useful to look back at.
 *   completed   — finished and no longer needed on this board.
 *   obsolete    — actively misleading now, because it shows a value the lesson has since replaced.
 */
export const VISUAL_LIFECYCLES = ["current", "temporary", "supporting", "context", "completed", "obsolete"] as const;
export type VisualLifecycle = typeof VISUAL_LIFECYCLES[number];

/**
 * The attention model. A step's current content should dominate the board, which is what these numbers
 * encode: supporting context is worth about half a current object and a finished one is worth almost
 * nothing. The renderer multiplies an object's own opacity by this.
 */
export const VISUAL_PRIORITY: Record<VisualLifecycle, number> = {
  current: 1,
  temporary: 0.95,
  supporting: 0.62,
  context: 0.34,
  completed: 0.18,
  obsolete: 0,
};

/**
 * How many objective stages an object is allowed to outlive its usefulness.
 *
 * Two is a real teaching decision, not a tuning number: a notation stage must survive into `why` and
 * into `identify` — that is where the symbols are still being read — and must be gone by the time the
 * lesson is calculating. Keeping it one stage longer is what produces the pile-up, and clearing it
 * sooner is what produces a board that forgets what it just said.
 */
export const LIFECYCLE_GRACE_STAGES = 2;

/**
 * The smallest board that can still teach.
 *
 * Three is not an aesthetic choice: it is the fewest objects on which a shape, the label naming it and the
 * arrow joining two things can all exist. It lives here rather than in `composition.ts` because the lifecycle
 * retires before composition ever runs, and a floor the composition stage owns cannot protect a board that is
 * already hollow by the time it arrives. A real Newton's-law run retired a seventeen-object board in one step
 * down to a single box and then taught three more steps over it.
 */
export const MIN_BOARD_OBJECTS = 3;

// Transient animation recorded on an object. `tick` lets the renderer remount + replay exactly once.
export type VisualMotion = {
  kind: AnimationKind;
  durationMs: number;
  delayMs: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  tick: number;
  /** Once set, the renderer draws the packet at this progress instead of animating it. */
  flowProgress?: number;
};

export type VisualObject = {
  id: string;
  kind: VisualObjectKind;
  order: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  shape?: ShapeKind;
  semantic?: SemanticKind;
  /** Emphasis role: decides type size, stroke weight and whether siblings get subdued. */
  role?: VisualRole;
  // The anchor this object was placed against, so later objects on the SAME anchor can be spread
  // over separate slots instead of stacking on one point.
  anchor?: Anchor;
  text?: string;
  glyph?: string;
  fontSize?: number;
  /** Measured wrap of a free-standing text object, so the board reserves the space it really needs. */
  textLines?: string[];
  // ---- code block ---------------------------------------------------------------------------
  /** The source exactly as the teacher wrote it; `codeLines` is the measured, display-safe split. */
  code?: string;
  codeLines?: string[];
  /** A language hint for syntax colouring. Unknown languages fall back to plain monospace. */
  language?: string;
  /** 1-based line numbers the teacher is talking about right now. */
  highlightLines?: number[];
  /** Optional heading above a code block: a filename, a function name, or the language. */
  title?: string;
  arrowStyle?: ArrowStyle;
  /** How this connection is routed/drawn. Defaults to a straight line with an arrowhead. */
  connector?: ConnectorKind;
  /** What this connection MEANS. Kept so later passes can reason about the link, not its geometry. */
  relation?: SemanticRelation;
  // Perpendicular offset (px) applied to an arrow/connector so several messages between the SAME
  // two objects can occupy distinct parallel lanes instead of collapsing onto one line.
  offset?: number;
  /**
   * The lane was CHOSEN (by a layout module, or deliberately by the teacher) rather than auto-assigned.
   * A chosen lane is only re-chosen if its label would land on an object — never merely because another
   * label prefers a different lane, which would silently destroy a sequence diagram's row order.
   */
  explicitLane?: boolean;
  emphasis?: boolean;
  /** Subdued: the teacher has moved attention elsewhere (eliminated half, already-visited node). */
  dimmed?: boolean;
  // ---- Visual teaching-state lifecycle ---------------------------------------------------------------
  // THE BOARD IS NOT A HISTORY. These four fields are what stop it becoming one, and they are recorded
  // when the object is created because the objects a lesson leaves behind are the evidence.
  //
  // `bornStep` / `bornStage` say WHEN something arrived; `group` says what it belongs to, so a whole
  // structure can be retired as a unit; `lifecycle` says how much attention it deserves NOW. Nothing
  // here is authored by the model — the model describes teaching, and the lifecycle is derived.
  /** The lesson step that created this object. */
  bornStep?: number;
  /** Index of the objective stage that step was teaching, used to decide when the object is stale. */
  bornStage?: number;
  /** The structure this object belongs to (`<id>` or `<id>-…`), so a whole diagram retires together. */
  group?: string;
  /** How much of the student's attention this object deserves right now. */
  lifecycle?: VisualLifecycle;
  /**
   * True when this object was born answering an INTERRUPTION rather than as part of the lesson.
   *
   * `lifecycle === "temporary"` alone is not enough to identify one: an interruption used to reclassify the
   * whole board as temporary, which meant the lesson's own diagram was retired the moment the teacher
   * resumed — a two-second question about tau cost the student the diagram they were halfway through.
   * This flag says where the object came from instead of what it currently is.
   */
  bornTemporary?: boolean;
  // Arrows/connectors reference two live objects so they follow them when those move.
  refs?: { from: string; to: string };
  // A label records the object it names and the side it sits on, so the layout can keep it beside
  // that object (and clear of everything else) when the object moves during a lesson.
  labelOf?: { id: string; side: RelativeSide };
  motion?: VisualMotion;
};

export type VisualScene = {
  objects: VisualObject[];
  tick: number;
  /** Subject styling; set by `set_theme` so a domain keeps one consistent look across a lesson. */
  theme?: VisualTheme;
  /** The object the teacher is talking about right now; everything else is subdued while set. */
  focusIds?: string[];
};

export const emptyVisualScene = (): VisualScene => ({ objects: [], tick: 0 });

// Result of running the visual timeline: the resolved scene plus how many actions were applied.
export type VisualApplyResult = {
  scene: VisualScene;
  applied: number;
  skipped: number;
};

/**
 * ONE record per action the engine could not use. A bad decorative action is repaired or dropped
 * here and the rest of the step still teaches; nothing fails silently.
 */
export type VisualActionDiagnostic = {
  /** The action name, or "unknown" when the model did not send one. */
  action: string;
  /** The object/endpoint the action was about, when it named one. */
  target?: string;
  reason: string;
  outcome: "repaired" | "dropped" | "skipped";
  /** Objects in the scene after the step, so the state is always reported with the reason. */
  sceneObjects: number;
  /** 0-based index of the action inside the step's batch. */
  index: number;
};

