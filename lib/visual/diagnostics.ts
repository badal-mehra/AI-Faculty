"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DIAGNOSTICS_FLAG = void 0;
exports.isDiagnosticsEnabled = isDiagnosticsEnabled;
exports.diagnoseScene = diagnoseScene;
exports.summariseDiagnostics = summariseDiagnostics;
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
const geometry_1 = require("./geometry");
const viewport_1 = require("./viewport");
const spacing_1 = require("./spacing");
const align_1 = require("./align");
const balance_1 = require("./balance");
const anchors_1 = require("./anchors");
const compositionModel_1 = require("./compositionModel");
const semantics_1 = require("./semantics");
const quality_1 = require("./quality");
const animation_1 = require("./animation");
/**
 * Whether the overlay may run at all.
 *
 * The flag is a build-time constant, not a runtime setting, and the check is `===` against a literal the
 * bundler can fold. `process.env.NODE_ENV === "development"` would also be false in production, but it is
 * not a constant the compiler is told about, so this states the intent directly: a shipped build does not
 * contain the overlay.
 */
exports.DIAGNOSTICS_FLAG = "AI_FACULTY_VISUAL_DIAGNOSTICS";
function isDiagnosticsEnabled(env = process.env) {
    return env.NODE_ENV !== "production" && (env[exports.DIAGNOSTICS_FLAG] === "1" || env[exports.DIAGNOSTICS_FLAG] === "true");
}
/**
 * Everything the overlay shows, for the EXACT scene Classroom is about to render.
 *
 * It takes the scene and nothing else, so it cannot describe a different scene from the one on screen —
 * which was the whole reason the old reporting path was untrustworthy.
 */
function diagnoseScene(scene, viewport, options = {}) {
    const objects = scene.objects;
    const focusIds = new Set(options.focusIds ?? scene.focusIds ?? []);
    const groups = (0, compositionModel_1.groupScene)(objects);
    const debug = objects.map((object) => {
        const refs = object.refs;
        const relation = (refs ? (0, compositionModel_1.connectionsOf)(objects).find((connection) => connection.id === object.id)?.relation : undefined) ?? "";
        return {
            id: object.id,
            kind: object.kind,
            // The identity the lifecycle derives, so a duplicate or a collision of meaning is visible by eye.
            // Recomputed with the SAME function the engine uses, so this is not a second opinion.
            semanticKey: (0, semantics_1.semanticKey)(object),
            group: object.group ?? "",
            lifecycle: object.lifecycle ?? "",
            role: object.role ?? "",
            box: (0, geometry_1.boxOfObject)(object),
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
    const routes = (0, compositionModel_1.connectionsOf)(objects).map((connection) => {
        const from = byId.get(connection.from);
        const to = byId.get(connection.to);
        if (!from || !to)
            return { id: connection.id, from: connection.from, to: connection.to, relation: connection.relation, points: [], rerouted: false, label: "" };
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
        const composition = (0, compositionModel_1.buildComposition)({ groupId, objects: members, viewport });
        const bounds = (0, align_1.groupBounds)(members);
        return {
            groupId,
            kind: composition.kind,
            description: (0, compositionModel_1.describeComposition)(composition),
            role: composition.role,
            readingDirection: composition.readingDirection,
            bounds,
            attention: members.map((member) => ({ id: member.id, state: member.lifecycle ?? "current" })),
            alignment: composition.alignment,
            alignmentDrift: maxDrift(composition.alignment, members),
        };
    });
    const quality = (0, quality_1.evaluateVisualQuality)({
        scene,
        viewport,
        ...(options.step === undefined ? {} : { step: options.step }),
        ...(options.focusIds === undefined ? {} : { focusIds: options.focusIds }),
    });
    const labels = (0, anchors_1.labelAttachmentScore)(objects);
    const spacing = (0, spacing_1.spacingScale)(viewport);
    const area = (0, viewport_1.contentBox)(viewport);
    return {
        viewport,
        sceneViewport: scene.viewport ?? null,
        viewportMatchesStage: Boolean(scene.viewport) && scene.viewport.width === viewport.width && scene.viewport.height === viewport.height,
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
        occupancy: (0, balance_1.occupancyOf)(objects, viewport),
        spacing,
        teachingRatio: (0, animation_1.teachingRatio)(objects),
        problems: [...quality.problems].sort((a, b) => a.length - b.length).slice(0, 12),
    };
}
// Imported at the bottom so the module's own header comment reads first; both are pure functions.
const geometry_2 = require("./geometry");
const routeFor = (from, to, offset, obstacles) => (0, geometry_2.routeConnection)(from, to, { offset, obstacles });
const obstaclesFor = (objects, from, to) => objects.filter((object) => object.id !== from.id && object.id !== to.id && object.kind === "shape").map((object) => {
    const box = (0, geometry_1.boxOfObject)(object);
    return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
});
const maxDrift = (constraints, objects) => {
    const byId = new Map(objects.map((object) => [object.id, object]));
    let worst = 0;
    for (const constraint of constraints) {
        const members = constraint.ids.map((id) => byId.get(id)).filter((object) => Boolean(object));
        if (members.length < 2)
            continue;
        const values = members.map((object) => {
            const box = (0, geometry_1.boxOfObject)(object);
            switch (constraint.kind) {
                case "equalWidth": return object.width;
                case "equalHeight": return object.height;
                case "sameRow":
                case "centerY": return object.y;
                case "sameColumn":
                case "centerX": return object.x;
                case "leftEdge": return box.left;
                case "rightEdge": return box.right;
                case "topEdge": return box.top;
                case "bottomEdge": return box.bottom;
                default: return 0;
            }
        });
        const spread = Math.max(...values) - Math.min(...values);
        if (spread > worst)
            worst = spread;
    }
    return Math.round(worst);
};
/** A compact, printable summary. A pasted console line is often all a visual bug needs. */
function summariseDiagnostics(report) {
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
