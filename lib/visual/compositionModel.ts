// THE COMPOSITION: A DIAGRAM IS ONE THING, NOT A BAG OF RECTANGLES.
//
// PHASE 2 AND 3.
//
// The engine used to hold a flat list of objects and let collision resolution make them look acceptable.
// That is the wrong way round, and it is why a physics lesson produced a free-body diagram, a heading and
// a formula as three unrelated rectangles that happened not to overlap. Collision resolution answers
// "do these two things clash?"; it cannot answer "do these four things form a free-body diagram?", and the
// second question is the one a student is asking.
//
// So a composition is assembled FIRST and laid out as a unit:
//
//   ROOT              the one thing being taught now.
//     PRIMARY         the objects the root is made of. These are the diagram.
//     SECONDARY       the context that makes the primary legible (an axis, a frame, a ghost row).
//     ANNOTATIONS     titles, captions, labels — they are placed AGAINST the composition, never
//                     independently, which is what stops a caption drifting into the middle of a diagram.
//
//   RELATIONSHIPS     what connects to what, and therefore what must be geometrically adjacent.
//   ALIGNMENT         the constraints the shape implies (PHASE 7).
//   SPACING           the tiers every gap in this composition is drawn from (PHASE 8).
//   VIEWPORT PRIORITY what this composition yields when the board is too small for everything.
//   TEACHING INTENT   why it is on the board, which decides its FORM (PHASE 14), not just its content.
//   SEMANTICS         the domain vocabulary it is allowed to use (PHASE 13).
//
// Laying the composition out as a unit is what makes the difference between "several SVG objects that
// happened to fit" and a diagram. A free-body diagram is a body with forces on it; an array is a row of
// equal cells with indices; a derivation is a sequence of equivalent expressions. None of those are
// expressible as "place twenty rectangles and hope".
import { boxOfObject, boxesOverlap, type Box, sideForRelation } from "./geometry";
import { constraintsForStructure, type AlignmentConstraint } from "./align";
import { spacingScale, space } from "./spacing";
import type { VisualObject } from "./types";

/** The teaching intents, named as the classroom names them. */
const INTENT_FORMS: Record<string, string> = {
    define: "concept_map",
    compare: "comparison",
    derive: "equation_derivation",
    calculate: "worked_example",
    verify: "worked_example",
    worked_example: "worked_example",
    explain_why: "flow",
    introduce_concept: "concept_map",
    demonstrate: "flow",
    recap: "timeline",
};

/** Which reading direction each kind is read in. */
const READING: Record<string, string> = {
    array: "left_to_right",
    linked_list: "left_to_right",
    tree: "top_to_bottom",
    graph: "top_to_bottom",
    stack: "top_to_bottom",
    queue: "left_to_right",
    timeline: "left_to_right",
    comparison: "paired",
    equation_derivation: "top_to_bottom",
    free_body_diagram: "radial",
    circuit: "left_to_right",
    pipeline: "left_to_right",
    sequence: "left_to_right",
    flow: "left_to_right",
    matrix: "left_to_right",
    worked_example: "top_to_bottom",
    anatomical_diagram: "none",
    coordinate_plane: "none",
    concept_map: "radial",
    annotation_only: "none",
    unknown: "none",
};

const byId = (objects: readonly VisualObject[]): Map<string, VisualObject> =>
    new Map(objects.map((object) => [object.id, object]));

/**
 * The connections among a set of objects, WITH the semantic relation each one encodes.
 *
 * The relation is read from the connection object's own `semantic` field, which is where the action's
 * `relation` ends up. Reading it from anywhere else — a map, a parallel array — is how a diagram ends up
 * drawn with the wrong arrows for the relationships the model asked for, which is invisible to a student
 * who cannot see the model.
 */
export function connectionsOf(objects: readonly VisualObject[]): Array<{ id: string; from: string; to: string; relation: string }> {
    const known = byId(objects);
    const connections: Array<{ id: string; from: string; to: string; relation: string }> = [];
    for (const object of objects) {
        if (object.kind !== "arrow" && object.kind !== "connector")
            continue;
        if (!object.refs)
            continue;
        if (!known.has(object.refs.from) || !known.has(object.refs.to))
            continue;
        connections.push({ id: object.id, from: object.refs.from, to: object.refs.to, relation: (object.semantic ?? "references") });
    }
    return connections;
}

/**
 * What KIND of structure a group's objects came from.
 *
 * Recovered from the ids and semantics the compilers already stamp on every object — an array's cells are
 * `<id>-c<n>`, a stack's rows are `<id>-r<n>`, an equation block is a single `formula` inside a
 * `container`. Reading it from what is there rather than from a flag is what lets a composition be
 * classified for a board that was assembled over twenty steps rather than one.
 */
export function detectCompositionKind(objects: readonly VisualObject[]): string {
    if (objects.length === 0)
        return "annotation_only";
    const map = byId(objects);
    const relations = new Set(connectionsOf(objects).map((connection) => connection.relation));
    const semantics = new Set(objects.map((object) => object.semantic).filter(Boolean));
    const ids = objects.map((object) => object.id);
    const cellCount = ids.filter((id) => /-c\d+$/.test(id)).length;
    const rowCount = ids.filter((id) => /-r\d+$/.test(id)).length;
    const nodeIds = new Set(objects.filter((object) => object.semantic === "node" || object.semantic === "data").map((object) => object.id));
    if (semantics.has("component") && relations.has("part_of"))
        return "circuit";
    if (objects.some((object) => object.kind === "formula") && relations.has("derives_from"))
        return "equation_derivation";
    if (relations.has("causes"))
        return "free_body_diagram";
    // A FREE-BODY DIAGRAM IS A BODY WITH VECTORS ON IT. Recognising it by that shape rather than only by a
    // declared `causes` relation matters because the relation is optional: a model that names the forces
    // without naming a cause between them still drew a free-body diagram, and classifying it as "unknown"
    // meant the repair engine did not know to leave its arrangement alone.
    const body = objects.find((object) => object.kind === "shape" && object.semantic === "component" && (object.role === "primary" || object.text !== undefined));
    const vectors = objects.filter((object) => object.shape === "arrow" && object.semantic === "data");
    if (body && vectors.length >= 2)
        return "free_body_diagram";
    // A CIRCUIT IS RECOGNISED BY ITS RAILS, not by a relation the model happened to declare. A schematic is
    // the one composition made of components joined by thin lines, and that shape is what distinguishes
    // "a circuit" from "a row of labelled boxes" — the difference the mission means when it says an RC
    // circuit must look like an electrical engineering teacher teaching a circuit.
    const components = objects.filter((object) => object.semantic === "component");
    const rails = objects.filter((object) => object.kind === "shape" && object.shape === "line" && (object.height ?? 0) <= 6);
    if (components.length >= 2 && rails.length >= 2)
        return "circuit";
    // A COMPARISON is recognised before any other row-like structure. Both its panels are rows of items
    // named `<id>-l-r0` / `<id>-r-r0`, which is also the shape a queue's rows have, so a comparison used to
    // be classified as a queue — and the composition then read the wrong way, which is a diagram that
    // teaches the wrong thing rather than merely a mislabelled one.
    if (objects.some((object) => /-l-head$/.test(object.id)) && objects.some((object) => /-r-head$/.test(object.id)))
        return "comparison";
    if (map.size > 0 && [...map.values()].some((object) => object.kind === "shape" && object.shape === "line" && object.width > 200))
        return "timeline";
    // A COORDINATE PLANE IS AN AXIS PAIR WITH POINTS ON IT.
    //
    // A graph plot used to be classified as `unknown`, and the alignment gate then held it to "everything on
    // one row" — a requirement the shape of a curve cannot satisfy, because the y positions of the points
    // ARE the curve. The signature below is the one thing a plot always has and nothing else does: two long
    // thin rectangles crossing, with markers plotted on them.
    if (isCoordinatePlane(objects))
        return "coordinate_plane";
    if (cellCount >= 2)
        return "array";
    if (rowCount >= 2)
        return "queue";
    if (nodeIds.size >= 3 && relations.has("follows"))
        return "linked_list";
    if (nodeIds.size >= 3 && (relations.has("contains") || relations.has("part_of") || relations.has("derives_from")))
        return "tree";
    if (nodeIds.size >= 3)
        return "graph";
    if (relations.has("compares_with"))
        return "comparison";
    if (objects.filter((object) => object.semantic === "process").length >= 2)
        return "pipeline";
    if (objects.filter((object) => object.semantic === "actor").length >= 2)
        return "sequence";
    if (map.size > 0 && [...map.values()].every((object) => object.kind === "text" || object.kind === "formula"))
        return "equation_derivation";
    return "unknown";
}

interface CompositionKindOptions {
    objects: readonly VisualObject[];
    explicitKind?: string;
    teachingIntent?: string;
    domain?: string;
}

/**
 * THE TEACHING INTENT DECIDES THE FORM (PHASE 14).
 *
 * A definition, a comparison, a derivation, a worked example, a verification and a recap all end up on a
 * board made of shapes and arrows, and drawing them all the same way is precisely the "generic diagram
 * for every lesson" failure. So the intent selects a FORM, and the form selects what is primary, which
 * direction it reads, and what the student is meant to take away.
 *
 * The mapping is only applied when it is unambiguous: an explicit structure action (an array, a circuit, a
 * free-body diagram) always wins, because the model asked for that specific structure and overriding it
 * would be the system second-guessing a correct decision.
 */
export function compositionKindFor(options: CompositionKindOptions): string {
    const detected = detectCompositionKind(options.objects);
    if (options.explicitKind)
        return options.explicitKind;
    if (detected !== "unknown" && detected !== "annotation_only")
        return detected;
    const intent = options.teachingIntent?.trim().toLowerCase();
    if (intent && INTENT_FORMS[intent])
        return INTENT_FORMS[intent];
    return detected;
}

/**
 * Which objects are PRIMARY, SECONDARY and ANNOTATION within one composition.
 *
 * This is the decision that makes a diagram look designed. Title, caption and a stray annotation are
 * ANNOTATIONS — placed against the composition, allowed to overlap nothing, and the first things dropped
 * on a small board. The rest is PRIMARY. SECONDARY is the context that makes the primary legible without
 * being the subject: an array's index row, a plot's axes, a circuit's grid. Everything else is a leaf in
 * some group rather than a peer of everything.
 */
export function classifyRoles(objects: readonly VisualObject[]): { primary: VisualObject[]; secondary: VisualObject[]; annotations: VisualObject[] } {
    const primary: VisualObject[] = [];
    const secondary: VisualObject[] = [];
    const annotations: VisualObject[] = [];
    for (const object of objects) {
        if (isAnnotation(object)) {
            annotations.push(object);
            continue;
        }
        if (isSecondary(object)) {
            secondary.push(object);
            continue;
        }
        primary.push(object);
    }
    return { primary, secondary, annotations };
}

const isAnnotation = (object: VisualObject): boolean =>
    object.role === "title" || object.role === "subtitle"
    || ((object.kind === "text" || object.kind === "formula" || object.kind === "label") && object.role !== "primary" && object.role !== "secondary" && object.role !== "callout")
    || object.kind === "icon";

/**
 * Context, not subject.
 *
 * An axis, a frame, a grid, a baseline: the things that make a structure readable but that the student is
 * not being taught. They are protected from being dropped on a small board — unlike annotations, which
 * are decoration — because a plot without its axes is not a plot.
 */
const isSecondary = (object: VisualObject): boolean =>
    (object.kind === "shape" && (object.semantic === "state" || object.semantic === "note") && (object.role === "secondary" || object.role === "caption" || object.role === undefined))
    || (object.kind === "shape" && object.shape === "line" && object.width > 200)
    || (object.kind === "container" && !object.text)
    || (object.kind === "code_block" && object.role !== "primary");

/** Sorts a composition's objects into the order the student is meant to read them. */
export function readingOrder(composition: { kind: string; primary: VisualObject[]; secondary: VisualObject[]; annotations: VisualObject[] }): VisualObject[] {
    const direction = READING[composition.kind];
    const sortOn = (objects: VisualObject[]): VisualObject[] => {
        switch (direction) {
            case "left_to_right": return [...objects].sort((a, b) => a.x - b.x || a.y - b.y);
            case "top_to_bottom": return [...objects].sort((a, b) => a.y - b.y || a.x - b.x);
            case "paired": return [...objects].sort((a, b) => a.y - b.y || a.x - b.x);
            case "radial": return [...objects];
            case "none":
            default: return [...objects].sort((a, b) => a.order - b.order);
        }
    };
    return [...sortOn(composition.primary), ...sortOn(composition.secondary), ...sortOn(composition.annotations)];
}

/**
 * What this composition yields first when the board cannot hold it all.
 *
 * PHASE 12, and the order is a teaching decision. The ROOT concept survives; the objects that make it
 * specific go next; the connective detail goes; the annotations go LAST. Dropping a caption before a cell
 * produces a diagram the student cannot read; dropping a cell before a caption produces a bare but honest
 * diagram, which is the right trade.
 */
export function viewportPriority(composition: { primary: VisualObject[]; secondary: VisualObject[]; annotations: VisualObject[]; relationships: Array<{ id: string; from: string; to: string }> }): string[] {
    const priority: string[] = [];
    // The primary objects, in reading order, so what the student reads first is what survives first.
    for (const object of readingOrder(composition as any))
        if (composition.primary.includes(object))
            priority.push(object.id);
    // The relationships between surviving objects, so the arrows stay while the decoration goes.
    for (const relationship of composition.relationships) {
        if (priority.includes(relationship.from) && priority.includes(relationship.to))
            priority.push(relationship.id);
    }
    for (const object of composition.secondary)
        priority.push(object.id);
    for (const object of composition.annotations)
        priority.push(object.id);
    return priority;
}

interface BuildCompositionOptions {
    groupId: string;
    objects: readonly VisualObject[];
    viewport: { width: number; height: number; margin: number };
    explicitKind?: string;
    teachingIntent?: string;
    domain?: string;
    parentId?: string | null;
    role?: string;
}

/** Builds a composition from the objects of one structure group. */
export function buildComposition(options: BuildCompositionOptions): any {
    const kind = compositionKindFor({ objects: options.objects, ...(options.explicitKind ? { explicitKind: options.explicitKind } : {}), ...(options.teachingIntent ? { teachingIntent: options.teachingIntent } : {}), ...(options.domain ? { domain: options.domain } : {}) });
    const roles = classifyRoles(options.objects);
    const relationships = relationshipsOf(options.objects);
    const composition = {
        kind,
        parentId: options.parentId ?? null,
        groupId: options.groupId,
        role: options.role ?? "root",
        objects: [...options.objects],
        primary: roles.primary,
        secondary: roles.secondary,
        annotations: roles.annotations,
        relationships,
        readingDirection: READING[kind],
        // A tree is aligned LEVEL BY LEVEL, not as one row, so its own depth lines are the constraint.
        alignment: constraintsForStructure(kind, structureIdList(options.objects, kind)),
        spacing: spacingScale(options.viewport),
        viewportPriority: [],
        ...(options.teachingIntent ? { teachingIntent: options.teachingIntent } : {}),
        ...(options.domain ? { subject: options.domain } : {}),
    };
    composition.viewportPriority = viewportPriority(composition);
    composition.objects = readingOrder(composition);
    return composition;
}

const structureIdList = (objects: readonly VisualObject[], kind: string): string[] => {
    if (kind === "comparison")
        return objects.filter((object) => /-(l|r)-r\d+$/.test(object.id)).map((object) => object.id);
    return objects.filter((object) => object.kind === "shape" && object.role === "primary" && object.semantic !== "note")
        .map((object) => object.id);
};

/** The relationships a set of objects encodes, read from the connections among them. */
export function relationshipsOf(objects: readonly VisualObject[]): Array<{ id: string; from: string; to: string; relation: string }> {
    return connectionsOf(objects);
}

/**
 * The gap between two compositions when they sit side by side.
 *
 * Not a constant, because the space between two STRUCTURES is not the space between two CELLS. Two things
 * that are not related need the room to look unrelated; two cells in one array need almost none. Getting
 * this wrong is why a comparison and a worked example left standing next to each other read as one
 * confused diagram.
 */
export function gapBetweenCompositions(a: any, b: any, viewport: { width: number; height: number; margin: number }, tier = "xl"): number {
    const relation = relatedGroups(a, b);
    if (relation)
        return space(viewport, "lg");
    return space(viewport, tier);
}

/** Whether one group explicitly points at another, which is what makes them one diagram. */
const relatedGroups = (a: any, b: any): boolean => {
    const aIds = new Set(a.objects.map((object: VisualObject) => object.id));
    const bIds = new Set(b.objects.map((object: VisualObject) => object.id));
    return a.relationships.some((relationship: any) => bIds.has(relationship.from) || bIds.has(relationship.to))
        || b.relationships.some((relationship: any) => aIds.has(relationship.from) || aIds.has(relationship.to));
};

/** Groups a scene's objects into compositions by the `group` the compilers stamped on them. */
export function groupScene(sceneObjects: readonly VisualObject[]): Map<string, VisualObject[]> {
    const groups = new Map<string, VisualObject[]>();
    for (const object of sceneObjects) {
        const key = object.group ?? "";
        const bucket = groups.get(key);
        if (bucket)
            bucket.push(object);
        else
            groups.set(key, [object]);
    }
    return groups;
}

/**
 * Is this object one of the thin elements a schematic or a curve is drawn from?
 *
 * A wire, a rail, a plot segment, a zig-zag limb, an axis. Their HEIGHT is what makes them thin, and a thin
 * object overlapping a thin object in the same group is a joint rather than a collision.
 */
const isThin = (object: VisualObject): boolean => object.kind === "shape" && (object.height <= 12 || object.width <= 12);

/**
 * Is this a coordinate plane?
 *
 * A plot is identified by GEOMETRY, not by name. The two rules the plot compiler always follows, and which
 * nothing else in the vocabulary happens to, are that there is a horizontal axis and a vertical axis of
 * genuinely different aspect, and that points or segments are plotted between them. A circuit's rails are
 * a loop rather than a crossing pair, a timeline's axis is a single horizontal line, and a free-body
 * diagram's body is a filled box, so none of them match.
 */
function isCoordinatePlane(objects: readonly VisualObject[]): boolean {
    const thin = objects.filter((object) => object.kind === "shape" && (object.height <= 12 || object.width <= 12));
    const horizontal = thin.some((object) => object.height <= 12 && object.width > object.height * 3);
    const vertical = thin.some((object) => object.width <= 12 && object.height > object.width * 3);
    if (!horizontal || !vertical)
        return false;
    const plotted = objects.filter((object) => (object.shape === "circle" || object.shape === "ellipse" || object.id.endsWith("-dot0") || /-seg\d+$/.test(object.id)));
    return plotted.length >= 2;
}

/** The kinds that are ONE object rather than a set, and so have no internal alignment to assert. */
export const isAtomicComposition = (kind: string): boolean =>
    kind === "free_body_diagram" || kind === "circuit" || kind === "coordinate_plane" || kind === "anatomical_diagram" || kind === "equation_derivation";

/**
 * Does this overlap MEAN something?
 *
 * THREE CASES, and each is a teaching relationship rather than a layout accident:
 *
 *   a VECTOR on the body it acts on — the arrow in a free-body diagram, the ray in an optics diagram. The
 *   arrow's tail is ON the body by construction, and separating them would make the diagram LESS correct:
 *   a force that does not touch the thing it acts on is not a force.
 *   a CAPTION inside its own structure's extent — an array's index row, a stage number. By design.
 *   a PLATE or a wire inside its own component's box — a capacitor's two plates, a circuit's zigzag.
 *
 * This predicate is shared by the quality gate and the repair engine, and sharing it is the point: a gate
 * that calls an adjacency a failure while the repair then "fixes" it produces a scene that fails forever,
 * and a repair that separates a force from its body produces a diagram that teaches the wrong thing. Both
 * halves must agree that some overlaps are the POINT.
 */
export function isIntentionalAdjacency(a: VisualObject, b: VisualObject): boolean {
    // 0. A SCHEMATIC JOINT.
    //
    // A circuit is drawn from thin elements that TOUCH: the two rails meet at the corner of the loop, a
    // resistor is a zigzag whose segments join end to end, and a curve's point sits on its axis where it
    // crosses zero. Every one of those is a small, deliberate overlap of thin things in the same group, and
    // counting them is how a correct schematic gets reported as a mess of overlapping shapes. The rule is
    // deliberately narrow — both objects thin, the same group, and a small shared area — so it cannot excuse
    // two boxes on top of each other.
    if (a.group !== undefined && a.group !== "" && a.group === b.group && isThin(a) && isThin(b)) {
        const boxA = boxOfObject(a);
        const boxB = boxOfObject(b);
        const shared = Math.max(0, Math.min(boxA.right, boxB.right) - Math.max(boxA.left, boxB.left))
            * Math.max(0, Math.min(boxA.bottom, boxB.bottom) - Math.max(boxA.top, boxB.top));
        if (shared <= 0 || shared / Math.max(1, a.width * a.height) <= 0.6)
            return true;
    }
    // 1. A force vector (an arrow SHAPE, rotated) acting on the body it belongs to.
    const isVector = (object: VisualObject): boolean => object.shape === "arrow" && object.semantic === "data";
    if (isVector(a) !== isVector(b)) {
        const body = isVector(a) ? b : a;
        const vector = isVector(a) ? a : b;
        if (body.kind === "shape" && (body.role === "primary" || body.semantic === "component")
            && vector.group !== undefined && vector.group !== "" && vector.group === body.group)
            return true;
    }
    // 2. A caption that is inside the footprint of the structure it captions.
    const textish = (object: VisualObject): boolean => object.kind === "text" || object.kind === "formula" || object.kind === "label";
    if (textish(a) !== textish(b)) {
        const caption = textish(a) ? a : b;
        const other = textish(a) ? b : a;
        if ((caption.role === "caption" || caption.role === "annotation" || caption.role === undefined)
            && caption.group !== undefined && caption.group !== "" && caption.group === other.group)
            return true;
    }
    // 3. A plate, a wire or a limb that is a PART of a named component, by id.
    if (a.group !== undefined && a.group !== "" && a.group === b.group) {
        const longer = a.id.length >= b.id.length ? a : b;
        const shorter = longer === a ? b : a;
        if (longer.id.startsWith(`${shorter.id}-`))
            return true;
    }
    return false;
}

/** How much room a composition wants, used to decide what the board can hold. */
export function compositionFootprint(composition: { primary: VisualObject[]; secondary: VisualObject[]; annotations: VisualObject[] }): number {
    return Math.max(1, composition.primary.length * 0.6 + composition.secondary.length * 0.25 + composition.annotations.length * 0.15);
}

/** A one-line description of what a composition is FOR, for the diagnostics overlay. */
export function describeComposition(composition: { kind: string; primary: VisualObject[]; secondary: VisualObject[]; annotations: VisualObject[]; relationships: Array<{ relation: string }>; objects: VisualObject[] }): string {
    const map = byId(composition.objects);
    const title = composition.annotations.find((object) => object.role === "title" || object.role === "subtitle")?.text;
    const relation = composition.relationships[0]?.relation;
    const side = relation ? sideForRelation(relation) : undefined;
    return [
        kindName(composition.kind),
        `${composition.primary.length} primary`,
        composition.secondary.length > 0 ? `${composition.secondary.length} secondary` : null,
        composition.annotations.length > 0 ? `${composition.annotations.length} annotated` : null,
        side ? `${side} reading` : null,
        title ? `“${title}”` : null,
        map.size === composition.objects.length ? null : "broken refs",
    ].filter(Boolean).join(" · ");
}

const kindName = (kind: string): string => kind.replace(/_/g, " ");