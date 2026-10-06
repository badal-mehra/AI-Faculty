"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateVisualQuality = evaluateVisualQuality;
exports.visualQualityScoreOf = visualQualityScoreOf;
exports.geometricMean = geometricMean;
exports.summariseQuality = summariseQuality;
// THE VISUAL QUALITY GATE.
//
// PHASE 21 AND 22.
//
// The board used to be measured on six numbers: focus, currency, identity, readability, density and
// connectivity. Every one of them can be 100 on a board a student would not look at twice. A board can
// have no overlaps, full semantic coverage, perfect focus and a complete array — and still be a mess,
// because none of those six asks whether the ARRAY is where the student is looking, whether the caption
// names the cell it is under, or whether the arrow points at the thing it means.
//
// So there are SIXTEEN metrics here, and the rule that makes them mean anything is this:
//
//   NO METRIC MAY HIDE ANOTHER.
//
// The overall score is a GEOMETRIC MEAN, not an average. That is the whole design decision: an arithmetic
// mean lets a scene buy permission to be terrible. Overlap 100, alignment 20, labels attached 20, text
// overlapping shapes 20 -> average 65, which reads as "acceptable". The geometric mean of the same numbers
// is 38, because a zero anywhere pulls the whole thing down. A scene is only as good as its worst aspect,
// which is what a student's experience of it actually is.
//
// The hard-fail conditions are separate and not negotiable. They are the cases where a scene is not
// "imperfect" but WRONG, and where no amount of compensating excellence elsewhere makes it teach.
const geometry_1 = require("./geometry");
const anchors_1 = require("./anchors");
const align_1 = require("./align");
const balance_1 = require("./balance");
const spacing_1 = require("./spacing");
const viewport_1 = require("./viewport");
const compositionModel_1 = require("./compositionModel");
const semantics_1 = require("./semantics");
const types_1 = require("./types");
const clamp100 = (value) => Math.max(0, Math.min(100, Math.round(value)));
const byId = (objects) => new Map(objects.map((object) => [object.id, object]));
const isConnection = (object) => object.kind === "arrow" || object.kind === "connector";
const isTextLike = (object) => object.kind === "text" || object.kind === "formula" || object.kind === "label";
/**
 * Overlap, counted on the objects that are supposed to be peers.
 *
 * PRIMARY objects overlapping is a hard failure: two things that are both central to the composition and
 * sharing space means the student cannot see either. A caption grazing a cell is a score, not a failure.
 *
 * BUT SOME OVERLAPS ARE THE POINT, and counting them is how a gate starts crying wolf. A force vector in a
 * free-body diagram is SUPPOSED to touch the body it acts on — an arrow floating clear of the block is not
 * clearer, it is wrong. A row's index label sits inside the row's extent by design. A connector's
 * endpoints sit on their objects' borders. Each of those is a relationship expressed as adjacency, and the
 * only real question is whether the overlap is that one or an accident.
 */
function overlapScore(objects) {
    const solids = objects.filter((object) => object.kind === "shape" || object.kind === "code_block");
    let area = 0;
    const failures = [];
    const offenders = [];
    for (let i = 0; i < solids.length; i += 1) {
        for (let j = i + 1; j < solids.length; j += 1) {
            const a = solids[i];
            const b = solids[j];
            // A container frames its contents; that is its job.
            if (a.kind === "container" || b.kind === "container")
                continue;
            const shared = (0, geometry_1.overlapArea)((0, geometry_1.boxOfObject)(a), (0, geometry_1.boxOfObject)(b));
            if (shared <= 4)
                continue;
            // Adacency that MEANS something: a vector on the body it acts on, a caption inside the row it
            // belongs to, a stage on the pipeline it is a stage of.
            if (isIntentionalAdjacency(a, b))
                continue;
            area += shared;
            const aPrimary = a.role === "primary" || a.role === undefined;
            const bPrimary = b.role === "primary" || b.role === undefined;
            offenders.push(a.id, b.id);
            if (aPrimary && bPrimary) {
                failures.push({ condition: "primary objects overlap", detail: `${a.id} and ${b.id} share ${Math.round(shared)}px² and both are primary`, ids: [a.id, b.id] });
            }
        }
    }
    const total = solids.reduce((sum, object) => sum + Math.max(1, object.width * object.height), 0);
    return { score: total === 0 ? 100 : clamp100((1 - area / total) * 100), failures };
}
/**
 * Does this overlap MEAN something?
 *
 * The rule lives in `compositionModel.ts` and is shared with the repair engine, so the gate and the repair
 * cannot disagree about whether a force vector touching its body is an error. See the note there.
 */
const isIntentionalAdjacency = compositionModel_1.isIntentionalAdjacency;
/**
 * Text over something it is not part of.
 *
 * Scored by how much of each text block is covered, because a two-pixel graze and a caption printed
 * straight through a box are both "textCollisionScore" and only one of them is unreadable. Text on its
 * OWN shape's label area is not a collision; text on a label it is attached to is not a collision.
 */
function textCollisionScore(objects) {
    const texts = objects.filter(isTextLike);
    const solids = objects.filter((object) => object.kind === "shape" || object.kind === "code_block");
    const map = byId(objects);
    let worst = 100;
    const failures = [];
    const offenders = [];
    for (const text of texts) {
        const box = (0, geometry_1.boxOfObject)(text);
        // The shape whose OWN label this is, and the target this label names: text over either is correct.
        const own = text.kind === "label" && text.labelOf ? map.get(text.labelOf.id) : undefined;
        const hosts = solids.filter((solid) => solid.id !== own?.id && solid.text && solid.id !== text.id);
        let covered = 0;
        let area = 0;
        for (const host of hosts)
            area += Math.max(1, host.width * host.height);
        for (const host of hosts)
            covered += (0, geometry_1.overlapArea)(box, (0, geometry_1.boxOfObject)(host));
        const share = area === 0 ? 0 : covered / Math.max(1, box.right - box.left) / Math.max(1, box.bottom - box.top);
        if (share > 0.02) {
            offenders.push(text.id);
            worst = Math.min(worst, clamp100(100 - share * 140));
            if (share > 0.3) {
                failures.push({ condition: "text overlaps unrelated shapes", detail: `${text.id} is ${Math.round(share * 100)}% inside a shape that is not its own`, ids: [text.id] });
            }
        }
    }
    // Text over TEXT is always a failure: two pieces of writing on top of each other is unreadable by
    // definition, and no reading order can rescue it.
    for (let i = 0; i < texts.length; i += 1) {
        for (let j = i + 1; j < texts.length; j += 1) {
            const shared = (0, geometry_1.overlapArea)((0, geometry_1.boxOfObject)(texts[i]), (0, geometry_1.boxOfObject)(texts[j]));
            if (shared > 6) {
                offenders.push(texts[i].id, texts[j].id);
                worst = Math.min(worst, clamp100(100 - (shared / Math.max(1, texts[i].width * texts[i].height)) * 200));
                failures.push({ condition: "text overlaps unrelated shapes", detail: `${texts[i].id} and ${texts[j].id} are printed on top of each other`, ids: [texts[i].id, texts[j].id] });
            }
        }
    }
    return { score: texts.length === 0 ? 100 : worst === 100 ? 100 : worst, failures };
}
/** Text that cannot be read at the size and in the room it has been given. */
function textReadabilityScore(objects, viewport) {
    const floor = (0, spacing_1.minimumFontSizeFor)(viewport);
    const texts = objects.filter((object) => object.kind === "text" || object.kind === "formula" || object.kind === "label" || object.kind === "code_block");
    if (texts.length === 0)
        return { score: 100, failures: [] };
    let worst = 100;
    const failures = [];
    for (const object of texts) {
        const size = object.fontSize ?? 0;
        if (size === 0)
            continue;
        // A truncated label is unreadable content, however legible the type is.
        const truncated = (object.textLines ?? []).some((line) => line.endsWith("…"));
        const lines = object.textLines?.length ?? 1;
        // ANY text below the board's readable floor is a failure, whatever kind it is. It used to be checked
        // only for loose labels, so a shape whose own label had been squeezed to eight points scored 100 —
        // which is how a board full of unreadable captions passed the gate that was supposed to stop it.
        const below = size < floor - 0.5;
        const penalty = truncated ? 40 : below ? 50 : 0;
        if (penalty > 0) {
            worst = Math.min(worst, clamp100(100 - penalty));
            if (truncated || below) {
                failures.push({ condition: "text is unreadable", detail: `${object.id} is ${size}px${truncated ? " and truncated" : ""} on a board whose readable floor is ${floor}px`, ids: [object.id] });
            }
        }
        // More lines than the object reserved room for is the wrapping/measuring disagreement from PHASE 5.
        if (lines > 0 && object.height < lines * size * 1.2 - 2) {
            worst = Math.min(worst, 60);
            failures.push({ condition: "text is unreadable", detail: `${object.id} paints ${lines} lines into a box ${Math.round(object.height)}px tall`, ids: [object.id] });
        }
    }
    return { score: worst, failures };
}
/**
 * Connector clarity: does the line start where it should, end where it should, and point the right way?
 *
 * PHASE 9. An arrow that starts in the middle of its object, or enters the far side when the relation is
 * a left-to-right flow, is not a smaller version of a correct arrow — it teaches the wrong direction. A
 * `left_to_right` relation whose head is to the LEFT of its source is a hard failure, because the arrow
 * says the answer.
 */
function connectorClarity(objects) {
    const map = byId(objects);
    const connections = (0, compositionModel_1.connectionsOf)(objects);
    if (connections.length === 0)
        return { score: 100, failures: [] };
    const failures = [];
    let total = 0;
    for (const connection of connections) {
        const from = map.get(connection.from);
        const to = map.get(connection.to);
        if (!from || !to)
            continue;
        const { start, end } = connectionEndpointsOf(from, to);
        const problems = [];
        // The endpoints must be ON the borders, not inside: a line drawn across the middle of its source is
        // "arrows entering the wrong side". The tolerance is a real fraction of the object, because a
        // connector's endpoints are placed on the border and then pulled back by the arrowhead's own length —
        // a two-pixel tolerance reported every tree edge and every sequence message as a failure, which is a
        // gate that cries wolf.
        const fromBox = (0, geometry_1.boxOfObject)(from);
        const toBox = (0, geometry_1.boxOfObject)(to);
        const tolerance = Math.max(4, Math.min(10, Math.min(from.width, from.height) * 0.06));
        const toleranceTo = Math.max(4, Math.min(10, Math.min(to.width, to.height) * 0.06));
        const startInside = pointInBox(start, fromBox, tolerance);
        const endInside = pointInBox(end, toBox, toleranceTo);
        if (startInside)
            problems.push("starts inside its source");
        if (endInside)
            problems.push("ends inside its target");
        // Direction must agree with what the relation means.
        const layout = (0, semantics_1.relationLayout)(connection.relation);
        if (layout === "left_to_right" && end.x < start.x - 4)
            problems.push("a left-to-right relation points left");
        if (layout === "top_to_bottom" && end.y < start.y - 4)
            problems.push("a top-to-bottom relation points up");
        if (problems.length > 0) {
            failures.push({ condition: startInside || endInside ? "connector starts or ends inside its object" : "connector enters object incorrectly", detail: `${connection.id} ${problems.join(" and ")}`, ids: [connection.id, from.id, to.id] });
            total += 1;
        }
    }
    return { score: clamp100(100 - (total / connections.length) * 100), failures };
}
const pointInBox = (point, box, pad = 0) => point.x > box.left + pad && point.x < box.right - pad && point.y > box.top + pad && point.y < box.bottom - pad;
const connectionEndpointsOf = (from, to) => (0, geometry_1.connectionEndpoints)(from, to, 6, 0);
/**
 * Crossings, and crossings that matter.
 *
 * PHASE 10. Not all crossings are equal: two long flow lines crossing in open space is untidy; a line
 * crossing the equation the teacher is pointing at makes the equation unreadable. So crossings are
 * detected for every pair, and the ones that hit TEXT or an unrelated OBJECT are what the score is
 * mostly made of.
 */
function connectorCrossings(objects) {
    const map = byId(objects);
    const connections = (0, compositionModel_1.connectionsOf)(objects);
    const routes = [];
    for (const connection of connections) {
        const from = map.get(connection.from);
        const to = map.get(connection.to);
        if (!from || !to)
            continue;
        routes.push({ ...(0, geometry_1.routeConnection)(from, to, { offset: 0, obstacles: [] }), ...connection });
    }
    if (routes.length < 2)
        return { score: 100, failures: [], routes };
    const texts = objects.filter(isTextLike);
    const solids = objects.filter((object) => object.kind === "shape");
    const failures = [];
    let textHits = 0;
    let objectHits = 0;
    let plainCrossings = 0;
    for (let i = 0; i < routes.length; i += 1) {
        for (let j = i + 1; j < routes.length; j += 1) {
            const a = routes[i];
            const b = routes[j];
            if (!routesCross(a, b))
                continue;
            // Two lines between the SAME pair of objects are parallel lanes, not a crossing.
            if (a.from === b.from && a.to === b.to)
                continue;
            plainCrossings += 1;
            for (const text of texts) {
                if (routeHitsBox(a, (0, geometry_1.boxOfObject)(text)) || routeHitsBox(b, (0, geometry_1.boxOfObject)(text))) {
                    textHits += 1;
                    failures.push({ condition: "connector crosses important text", detail: `${a.id} or ${b.id} runs through ${text.text ?? text.id}`, ids: [a.id, b.id, text.id] });
                    break;
                }
            }
            for (const solid of solids) {
                if (a.from === solid.id || a.to === solid.id || b.from === solid.id || b.to === solid.id)
                    continue;
                if (routeHitsBox(a, (0, geometry_1.boxOfObject)(solid)) || routeHitsBox(b, (0, geometry_1.boxOfObject)(solid))) {
                    objectHits += 1;
                    failures.push({ condition: "connector crosses unrelated object", detail: `${a.id} or ${b.id} runs through ${solid.id}`, ids: [a.id, b.id, solid.id] });
                    break;
                }
            }
        }
    }
    const total = (routes.length * (routes.length - 1)) / 2;
    const severity = textHits * 3 + objectHits * 2 + plainCrossings;
    return { score: clamp100(100 - (severity / Math.max(1, total)) * 100), failures, routes };
}
const segmentsCross = (a, b, c, d) => {
    const orient = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = orient(a, b, c);
    const d2 = orient(a, b, d);
    const d3 = orient(c, d, a);
    const d4 = orient(c, d, b);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
};
const routesCross = (a, b) => {
    for (let i = 0; i + 1 < a.points.length; i += 1) {
        for (let j = 0; j + 1 < b.points.length; j += 1) {
            if (segmentsCross(a.points[i], a.points[i + 1], b.points[j], b.points[j + 1]))
                return true;
        }
    }
    return false;
};
const routeHitsBox = (route, box) => {
    if (route.points.length < 2)
        return false;
    for (let index = 0; index + 1 < route.points.length; index += 1) {
        // Sampled rather than solved: the router produces L, Z and straight shapes, and a bounded sample is
        // both sufficient and cheap enough to run over every pair of connectors in a 250-object scene.
        const steps = 6;
        for (let step = 0; step <= steps; step += 1) {
            const point = (0, geometry_1.pointAlongRoute)(route, (index + step / steps) / (route.points.length - 1));
            if (point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom)
                return true;
        }
    }
    return false;
};
/**
 * Spacing, judged against the SCALE rather than against a constant.
 *
 * PHASE 8. A board is well spaced when the gaps between related things are visibly smaller than the gaps
 * between unrelated things. Every near pair is measured against the tier their relationship implies, so
 * "a label 4px from its object" and "two structures 6px apart" are both wrong, and for the same reason.
 */
function spacingScore(objects, viewport) {
    const scale = spacingFor(viewport);
    const solids = objects.filter((object) => object.kind === "shape");
    if (solids.length < 2)
        return 100;
    const map = byId(objects);
    const scores = [];
    for (let i = 0; i < solids.length; i += 1) {
        for (let j = i + 1; j < solids.length; j += 1) {
            const a = solids[i];
            const b = solids[j];
            const gap = boxGapOf((0, geometry_1.boxOfObject)(a), (0, geometry_1.boxOfObject)(b));
            // Two cells that SHARE a border (an array) are meant to touch, so the tier is `xs`; two unrelated
            // structures are meant to be clearly apart, so the tier is `xl`. The right answer depends entirely
            // on whether they are related, which is why this cannot be a single threshold.
            const sameGroup = a.group !== undefined && a.group === b.group;
            const related = sameGroup || sharesRelation(objects, a.id, b.id);
            const expected = related ? scale.xs : scale.xl;
            // Touching is allowed for peers; anything else has to leave at least the tier.
            if (related) {
                if (a.group === b.group && sameStructureLine(objects, a, b) && gap < scale.xs)
                    scores.push(100);
                else
                    scores.push(clamp100(100 - Math.max(0, expected - gap) * (100 / Math.max(1, expected))));
            }
            else {
                scores.push(clamp100(gap >= expected ? 100 : 100 - ((expected - gap) / expected) * 60));
            }
        }
    }
    void map;
    return scores.length === 0 ? 100 : clamp100(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}
const spacingFor = (viewport) => ({ xs: 6, sm: 12, md: 20, lg: 32, xl: 48 });
const boxGapOf = (a, b) => {
    const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right));
    const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom));
    return Math.hypot(dx, dy);
};
const sharesRelation = (objects, a, b) => objects.some((object) => isConnection(object) && object.refs && ((object.refs.from === a && object.refs.to === b) || (object.refs.from === b && object.refs.to === a)));
/** Two cells in the same row or column of one structure, which is a case where touching is correct. */
const sameStructureLine = (objects, a, b) => {
    if (a.group === undefined || a.group !== b.group)
        return false;
    if (a.group === "")
        return false;
    return Math.abs(a.y - b.y) < 2 || Math.abs(a.x - b.x) < 2;
};
/** Everything inside the safe margins, with the drawing's own bounds as the frame. */
function viewportContainment(objects, viewport) {
    const area = (0, viewport_1.contentBox)(viewport);
    const frame = { left: area.left, top: area.top, right: area.right, bottom: area.bottom };
    const failures = [];
    let clipped = 0;
    for (const object of objects) {
        const box = (0, geometry_1.boxOfObject)(object);
        const outside = Math.max(0, frame.left - box.left) + Math.max(0, frame.top - box.top) + Math.max(0, box.right - frame.right) + Math.max(0, box.bottom - frame.bottom);
        if (outside <= 1)
            continue;
        clipped += 1;
        failures.push({ condition: "objects clip viewport", detail: `${object.id} is ${Math.round(outside)}px outside the board`, ids: [object.id] });
    }
    return { score: objects.length === 0 ? 100 : clamp100(100 - (clipped / objects.length) * 100), failures };
}
/**
 * Reading order: can the student be told what to read first?
 *
 * PHASE 11/14. Order is a function of the composition, and a composition knows its own direction. So a
 * row whose reading direction is left-to-right must have its objects in that order, and two compositions
 * must be arranged so the root is where the eye lands first. A board where the eye has no idea is a board
 * where the student learns nothing about priority.
 *
 * ORDER IS JUDGED PER LAYER, which is the detail that makes it correct. A composition is primary objects,
 * then secondary, then annotations — three different layers, each with its own extent. Checking the
 * CONCATENATION against one direction fails every composition that has a title, because a title sits above
 * the row and is therefore "out of order" within it, and a board with a title on it was reported as
 * ambiguous. Reading order is a question about each layer, never about the layers together.
 */
function readingOrderScore(compositions, viewport, focusIds) {
    if (compositions.length === 0)
        return { score: 100, failures: [] };
    const area = (0, viewport_1.contentBox)(viewport);
    const failures = [];
    let total = 0;
    for (const composition of compositions) {
        const direction = composition.readingDirection;
        if (direction === "none" || direction === "radial") {
            total += 100;
            continue;
        }
        let judged = 0;
        let inOrder = 0;
        for (const layer of [composition.primary, composition.secondary, composition.annotations]) {
            if (layer.length < 2)
                continue;
            judged += 1;
            const ordered = direction === "left_to_right"
                ? [...layer].sort((a, b) => a.x - b.x)
                : [...layer].sort((a, b) => a.y - b.y || a.x - b.x);
            const ok = direction === "left_to_right"
                // A row may share positions: two panels of a comparison are at the same x, and that is correct.
                ? ordered.every((object, index) => index === 0 || object.x >= ordered[index - 1].x - 2)
                : ordered.every((object, index) => index === 0 || object.y >= ordered[index - 1].y - 2);
            if (ok)
                inOrder += 1;
        }
        if (judged === 0) {
            total += 100;
            continue;
        }
        if (inOrder === judged) {
            total += 100;
            continue;
        }
        total += Math.round(100 * (inOrder / judged));
        failures.push({ condition: "reading order is ambiguous", detail: `${composition.kind} is meant to read ${direction}, and ${judged - inOrder} of its layers are not in that order`, ids: composition.primary.slice(0, 6).map((object) => object.id) });
    }
    // With several compositions, the whole SET must be centred — not any one of them. A board holding two
    // matrices and a result has no single composition in the middle, and demanding one is demanding a
    // layout that does not exist: the check used to require the ROOT to be central, which reported every
    // multi-structure board as having an unclear focus even when the pair was perfectly arranged.
    if (compositions.length > 1) {
        const roots = compositions.filter((composition) => composition.role === "root");
        if (roots.length > 1) {
            total -= 20;
            failures.push({ condition: "current teaching focus is unclear", detail: `${roots.length} compositions are all marked as the root`, ids: roots.map((composition) => composition.groupId) });
        }
        else {
            const centre = { x: area.left + area.width / 2, y: area.top + area.height / 2 };
            let left = Infinity;
            let top = Infinity;
            let right = -Infinity;
            let bottom = -Infinity;
            for (const composition of compositions) {
                const bounds = (0, align_1.groupBounds)(composition.objects);
                if (!bounds)
                    continue;
                left = Math.min(left, bounds.left);
                top = Math.min(top, bounds.top);
                right = Math.max(right, bounds.right);
                bottom = Math.max(bottom, bounds.bottom);
            }
            if (Number.isFinite(left)) {
                const distance = Math.hypot((left + right) / 2 - centre.x, (top + bottom) / 2 - centre.y);
                const limit = Math.min(area.width, area.height) * 0.2;
                if (distance > limit) {
                    failures.push({ condition: "current teaching focus is unclear", detail: `the composition as a whole is ${Math.round(distance)}px from the middle of the board`, ids: compositions.map((composition) => composition.groupId) });
                    total -= 25;
                }
            }
        }
    }
    void focusIds;
    return { score: clamp100(total / compositions.length), failures };
}
/**
 * Focus: the thing the teacher is talking about must be visible, and visible FIRST.
 *
 * This is deliberately not the "focus score" the lifecycle already computes. That one asks whether the
 * board is mostly about the current step; this one asks whether the student can FIND the current step,
 * which is a different question and fails in different ways.
 */
function focusScore(objects, focusIds, expected) {
    if (expected.length === 0 && focusIds.length === 0)
        return { score: 100, failures: [] };
    const map = byId(objects);
    const failures = [];
    const wanted = [...focusIds, ...expected];
    const missing = wanted.filter((id) => !map.has(id));
    if (missing.length > 0) {
        failures.push({ condition: "animation references nonexistent objects", detail: `the step names ${missing.join(", ")} and the board does not show it`, ids: missing });
    }
    if (wanted.length === 0)
        return { score: missing.length > 0 ? 0 : 100, failures };
    const present = wanted.filter((id) => map.has(id));
    if (present.length === 0)
        return { score: 0, failures };
    // The focus must also be VISUALLY prominent: a focus object that is 4% of the board while three
    // others are 30% each is not focused, it is merely mentioned.
    const focused = present.map((id) => map.get(id));
    const area = Math.max(1, ...focused.map((object) => object.width * object.height));
    const totalArea = Math.max(1, objects.reduce((sum, object) => sum + object.width * object.height, 0));
    const share = area / totalArea;
    return { score: clamp100(100 - Math.max(0, 0.12 - share) * 300), failures };
}
/**
 * Semantic coverage: is every relationship the model asked for actually visible?
 *
 * A relation declared and not drawn is a promise the board does not keep, and it is invisible to a student
 * who cannot see the model's intent — so the board is judged on what it shows, not on what it recorded.
 */
function semanticCoverageScore(objects, allowed) {
    const map = byId(objects);
    const connections = (0, compositionModel_1.connectionsOf)(objects);
    const declared = new Map();
    for (const connection of connections)
        declared.set(connection.relation, (declared.get(connection.relation) ?? 0) + 1);
    const failures = [];
    // Every declared relation must have at least one drawn arrow whose endpoints both exist.
    for (const [relation, count] of declared) {
        const drawn = connections.filter((connection) => connection.relation === relation && map.has(connection.from) && map.has(connection.to)).length;
        if (drawn < count) {
            failures.push({ condition: "semantic relationship has no visible representation", detail: `${count} ${relation} relationship(s) declared, ${drawn} drawn`, ids: connections.filter((connection) => connection.relation === relation).map((connection) => connection.id) });
        }
    }
    void allowed;
    return { score: clamp100(100 - failures.length * 18), failures };
}
/**
 * Stale and unrelated content (PHASE 15).
 *
 * Lesson memory is not the active board. An object from three steps ago that has nothing to do with what
 * is being taught now is not history the student asked for, it is clutter the student has to read past.
 * "Stale" means its step is behind the current one; "unrelated" means it is on the board, is not the
 * focus, and belongs to no composition the current step is part of.
 */
/**
 * Stale and unrelated content (PHASE 15).
 *
 * Lesson memory is not the active board — but NEITHER IS AGE. The test here used to be "born more than a
 * step ago AND classified supporting", which is a test of the CLOCK, not of relevance, and it reported
 * `staleVisibleObjectScore: 0` on a board where nothing was wrong: a six-step array lesson ends with its
 * cells and its title born at step 1 and still being taught at step 6, which is the whole point of the
 * lesson. The lifecycle keeps an object precisely when it is still relevant, so re-litigating that
 * decision by age reports the lifecycle's correctness as its failure.
 *
 * Relevance is observable: the current step either named the object (a focus, a highlight) or acted on the
 * structure it belongs to (a group). An object from an earlier step that the current step did not touch,
 * and that belongs to no group the step acted on, is genuinely left over. That is what is measured here.
 */
function stalenessScore(objects, step, focusIds, stepGroupIds) {
    const failures = [];
    if (step === undefined)
        return { stale: 100, unrelated: 100, failures };
    const visible = objects.filter((object) => !isDerivedHidden(object));
    if (visible.length === 0)
        return { stale: 100, unrelated: 100, failures };
    const touched = new Set(focusIds);
    // WHAT THIS STEP ACTUALLY DID, read from the engine's own record rather than from a list the caller has
    // to remember to pass. The engine stamps `lessonId/stepId/objectId` on the motion of every object a step
    // creates or modifies (PHASE 18), so "what is this step about" is already on the scene and does not need
    // to be reconstructed by the gate — which is what left the metric with no way to tell an array's own
    // cells from a leftover.
    for (const object of visible) {
        if (object.motion?.stepId !== undefined && object.motion.stepId === String(step)) {
            touched.add(object.id);
            if (object.group !== undefined && object.group !== "")
                touched.add(`group:${object.group}`);
        }
    }
    for (const group of stepGroupIds)
        touched.add(`group:${group}`);
    const isCurrent = (object) => {
        if (touched.has(object.id))
            return true;
        if (object.group !== undefined && object.group !== "" && touched.has(`group:${object.group}`))
            return true;
        if (object.bornStep === undefined || object.bornStep >= step - 1)
            return true;
        // An ungrouped title or caption belongs to the whole board rather than to a structure, so it stays
        // current for as long as the board does. A title is not "left over from an earlier step"; it is the
        // thing that names every step.
        if ((object.group === undefined || object.group === "") && isTitleOrCaption(object))
            return true;
        return false;
    };
    const stale = visible.filter((object) => !isCurrent(object));
    const unrelated = visible.filter((object) => object.lifecycle === "context"
        && focusIds.length > 0
        && !focusIds.includes(object.id)
        && !isTitleOrCaption(object));
    const staleShare = stale.length / visible.length;
    const unrelatedShare = unrelated.length / visible.length;
    if (staleShare > 0.6) {
        failures.push({ condition: "unrelated old objects dominate", detail: `${Math.round(staleShare * 100)}% of the board is left over from steps the current step never touched`, ids: stale.slice(0, 8).map((object) => object.id) });
    }
    if (unrelatedShare > 0.6) {
        failures.push({ condition: "unrelated old objects dominate", detail: `${Math.round(unrelatedShare * 100)}% of the board is context from earlier steps`, ids: unrelated.slice(0, 8).map((object) => object.id) });
    }
    return { stale: clamp100(100 - staleShare * 130), unrelated: clamp100(100 - unrelatedShare * 130), failures };
}
const isDerivedHidden = (object) => false;
const isTitleOrCaption = (object) => object.role === "title" || object.role === "subtitle" || object.role === "caption";
/**
 * Animation quality (PHASE 17).
 *
 * An animation has to be ABOUT something. A fade is not teaching; "the search boundary moves to the right
 * half" is. So the score rewards steps that animate a CHANGE, and it hard-fails any animation that points
 * at an object which is not on the board — which is how a lesson ends up talking about a step the board has
 * already retired.
 */
function animationQualityScore(scene, step) {
    const failures = [];
    const map = byId(scene.objects);
    const moving = scene.objects.filter((object) => object.motion);
    // Stale animations: motion left over from an earlier step whose target is gone or which describes a
    // change the board has already settled.
    // A motion is STALE only when it still describes something that has changed under it: a reference to an
    // object that is gone, or a CHANGE animation from a step that has been replaced.
    //
    // It is NOT stale merely because its step is older. A `fade_in` from three steps ago has finished — the
    // browser ran it, the object is on the board, and there is nothing left to invalidate. The gate used to
    // call every one of those stale, so a normal lesson that had applied six steps reported six stale
    // animations and a quality score of 15 on a board that was perfectly fine. A gate that fails healthy
    // scenes is worse than no gate, because it teaches everyone to ignore it.
    const stale = moving.filter((object) => {
        const motion = object.motion;
        if (!motion)
            return false;
        if (motion.refObjectId !== undefined && !map.has(motion.refObjectId))
            return true;
        if (step === undefined || motion.stepId === undefined)
            return false;
        if (motion.stepId === String(step))
            return false;
        return (0, types_1.teachesWith)(motion.kind);
    });
    for (const object of stale) {
        failures.push({ condition: "animation references stale objects", detail: `${object.id} is still animating a change from step ${object.motion?.stepId} at step ${step}`, ids: [object.id] });
    }
    for (const object of moving) {
        if (!object.motion?.refObjectId)
            continue;
        if (!map.has(object.motion.refObjectId)) {
            failures.push({ condition: "animation references nonexistent objects", detail: `${object.id} animates against ${object.motion.refObjectId}, which is not on the board`, ids: [object.id, object.motion.refObjectId] });
        }
    }
    // "Teaching" animation: something moved or changed, as opposed to something merely appeared.
    const teaching = moving.filter((object) => {
        const motion = object.motion;
        if (!motion)
            return false;
        return motion.kind === "move" || motion.kind === "replace" || motion.kind === "remove" || motion.kind === "reorder" || motion.kind === "transform" || (motion.fromX !== undefined && motion.fromY !== undefined && Math.hypot((motion.toX ?? object.x) - motion.fromX, (motion.toY ?? object.y) - motion.fromY) > 4);
    }).length;
    const pending = moving.length;
    // A step with nothing to animate is not a bad step; a step that animates only fades is.
    const score = pending === 0 ? 100 : clamp100(55 + (teaching / pending) * 45 - stale.length * 12);
    return { score, failures, teaching };
}
/** The whole gate. */
function evaluateVisualQuality(input) {
    const { scene, viewport } = input;
    const objects = scene.objects;
    const area = (0, viewport_1.contentBox)(viewport);
    const hardFailures = [];
    const problems = [];
    const compositions = buildCompositions(input);
    const overlap = overlapScore(objects);
    const textCollision = textCollisionScore(objects);
    const labels = (0, anchors_1.labelAttachmentScore)(objects);
    const clarity = connectorClarity(objects);
    const crossings = connectorCrossings(objects);
    const alignment = input.alignment ?? compositions.flatMap((composition) => composition.alignment);
    const occupancy = (0, balance_1.occupancyOf)(objects, viewport);
    const balance = (0, balance_1.balanceScore)(occupancy);
    const spacing = spacingScore(objects, viewport);
    const containment = viewportContainment(objects, viewport);
    const readability = textReadabilityScore(objects, viewport);
    const order = readingOrderScore(compositions, viewport, input.focusIds ?? scene.focusIds ?? []);
    const focus = focusScore(objects, input.focusIds ?? scene.focusIds ?? [], input.expectedObjectIds ?? []);
    const coverage = semanticCoverageScore(objects, input.allowedRelations ?? []);
    const staleness = stalenessScore(objects, input.step, input.focusIds ?? scene.focusIds ?? [], input.stepGroupIds ?? []);
    const animation = animationQualityScore(scene, input.step);
    hardFailures.push(...overlap.failures, ...textCollision.failures, ...readability.failures, ...clarity.failures, ...crossings.failures, ...containment.failures, ...order.failures, ...focus.failures, ...coverage.failures, ...staleness.failures, ...animation.failures);
    // Labels with no target, or adrift from the thing they name, are hard failures because a label with no
    // owner is not a label — it is a sentence somewhere near a diagram.
    for (const id of labels.detached) {
        hardFailures.push({ condition: "labels have no clear target", detail: `${id} has no target it belongs to`, ids: [id] });
    }
    for (const id of labels.tooFar) {
        hardFailures.push({ condition: "label is too far from target", detail: `${id} has drifted away from the object it names`, ids: [id] });
    }
    // Severe unbalance is a hard failure; mild unbalance is only a score.
    if (balance < 35) {
        hardFailures.push({ condition: "composition is severely unbalanced", detail: `balance score ${balance}: the drawing does not sit well on this board`, ids: [] });
    }
    // A diagram that occupies almost none of the board is microscopic, which is a failure and not a taste.
    // The measure is the drawing's EXTENT, not its ink: a function graph is a few hundred pixels of line
    // inside a frame a fifth of the board wide, and calling that microscopic because the ink is thin would
    // fail every correct plot.
    if (occupancy.extentUtilization < 0.012 && objects.length > 1) {
        hardFailures.push({ condition: "diagram is microscopic", detail: `the drawing occupies ${(occupancy.extentUtilization * 100).toFixed(1)}% of the board`, ids: [] });
    }
    // Stale, unused declarations left in the alignment report are a diagnosis, not a failure.
    for (const violation of (0, align_1.findAlignmentViolations)(alignment, objects)) {
        problems.push(`alignment: ${violation.constraint.kind} drifts by ${Math.round(violation.drift)}px on ${violation.offenders.join(", ")}`);
    }
    const metrics = {
        overlapScore: overlap.score,
        textCollisionScore: textCollision.score,
        labelAttachmentScore: labels.score,
        connectorClarityScore: clarity.score,
        connectorCrossingScore: crossings.score,
        spacingScore: spacing,
        alignmentScore: (0, align_1.alignmentScore)(alignment, objects),
        balanceScore: balance,
        viewportContainmentScore: containment.score,
        readingOrderScore: order.score,
        focusScore: focus.score,
        semanticCoverageScore: coverage.score,
        staleVisibleObjectScore: staleness.stale,
        unrelatedVisibleObjectScore: staleness.unrelated,
        animationQualityScore: animation.score,
        textReadabilityScore: readability.score,
    };
    for (const failure of hardFailures)
        problems.push(`${failure.condition}: ${failure.detail}`);
    for (const [metric, value] of Object.entries(metrics)) {
        if (value < 80)
            problems.push(`${metric} is ${value}`);
    }
    void area;
    return {
        metrics,
        visualQualityScore: visualQualityScoreOf(Object.values(metrics)),
        hardFailures,
        compositions: compositions.map((composition) => ({
            groupId: composition.groupId,
            kind: composition.kind,
            description: (0, compositionModel_1.describeComposition)(composition),
            primary: composition.primary.length,
            secondary: composition.secondary.length,
            annotations: composition.annotations.length,
            readingDirection: composition.readingDirection,
        })),
        occupancy,
        viewport,
        passed: hardFailures.length === 0,
        problems,
    };
}
const WORST_WEIGHT = 10;
/**
 * THE SCORE, AND WHY IT IS NOT A PLAIN GEOMETRIC MEAN.
 *
 * A geometric mean is the right SHAPE — it punishes a zero where an average does not — but on its own it is
 * too forgiving once there are sixteen metrics. A scene that is perfect on fifteen of them and hopeless on
 * one still scores 78 out of a plain geometric mean, which is precisely the failure the mission names:
 * `overlapScore = 100, textAlignmentScore = 20` must not read as a good board.
 *
 * So the worst metric is OVER-WEIGHTED — counted as though it appeared ten times. That is a weight, not a
 * hack, and it behaves the way a reader would describe the board:
 *
 *   all metrics 80        -> 80   a good board, and it scores as one
 *   15 perfect, one at 20 -> 53   one terrible aspect is a bad board
 *   15 perfect, one at 0  -> 16   a zero is not hidden by fifteen hundreds
 *
 * The alternative — capping the score when any metric is low — gives the same shape with a discontinuity in
 * it, and a discontinuity in a score is a cliff someone will find and exploit.
 */
function visualQualityScoreOf(metrics) {
    if (metrics.length === 0)
        return 100;
    const values = metrics.map((value) => Math.max(0, Math.min(100, value)));
    // The index of the worst metric, not its value: on a uniformly good scene EVERY value equals the worst,
    // and filtering by value would then drop every metric and score the board on one of them.
    let worstIndex = 0;
    for (let index = 1; index < values.length; index += 1) {
        if (values[index] < values[worstIndex])
            worstIndex = index;
    }
    const worst = values[worstIndex];
    // A zero would make the product zero and collapse the score to nothing, which loses the information that
    // the other fifteen aspects were fine. A floor of a single point keeps the worst metric dominant without
    // pretending it did not happen.
    let log = WORST_WEIGHT * Math.log(Math.max(1, worst));
    for (let index = 0; index < values.length; index += 1) {
        if (index === worstIndex)
            continue;
        log += Math.log(Math.max(1, values[index]));
    }
    return clamp100(Math.exp(log / (metrics.length + WORST_WEIGHT - 1)));
}
/** The plain geometric mean, exposed because it is the right shape and worth asserting on its own. */
function geometricMean(values) {
    if (values.length === 0)
        return 100;
    const product = values.reduce((running, value) => running * Math.max(1, Math.min(100, value)), 1);
    return clamp100(Math.pow(product, 1 / values.length));
}
function buildCompositions(input) {
    const groups = (0, compositionModel_1.groupScene)(input.scene.objects);
    const compositions = [];
    for (const [groupId, objects] of groups) {
        if (objects.length === 0)
            continue;
        const composition = (0, compositionModel_1.buildComposition)({ groupId, objects, viewport: input.viewport });
        // One group is the root when there is one, or when it is the largest; several roots is itself a
        // diagnosis, reported by the reading-order metric.
        compositions.push(composition);
    }
    if (compositions.length === 1)
        compositions[0].role = "root";
    else {
        const stepGroups = new Set(input.stepGroupIds ?? []);
        const roots = compositions.filter((composition) => stepGroups.has(composition.groupId));
        const target = roots.length > 0
            ? roots
            : [...compositions].sort((a, b) => b.primary.length - a.primary.length).slice(0, 1);
        for (const composition of compositions) {
            composition.role = target.includes(composition) ? "root" : "secondary";
        }
    }
    return compositions;
}
/** A one-line summary for a log, with the failures named first because they is what needs fixing. */
function summariseQuality(report) {
    const worst = Object.entries(report.metrics).sort((a, b) => a[1] - b[1]).slice(0, 3);
    return `${report.visualQualityScore}/100 ${report.passed ? "pass" : `FAIL (${report.hardFailures.length} hard)`} · weakest: ${worst.map(([metric, value]) => `${metric} ${value}`).join(", ")}`;
}
