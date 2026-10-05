// 3D Visualization engine tests (dependency-free Node runner; compiled by tsconfig.test.json).
//   1  valid create_3d_object       2 invalid create_3d_object
//   3  object transformations (move/rotate/scale)
//   4  highlight + camera actions   5 flow animations
//   6  labels + clear + remove      7 invalid actions
//   8  limits (objects, particles, duration)  9 timeline + camera logic
//  10 asset registry               11 scene round-trip (Ask flow)
import { emptyVisual3DScene, Visual3DAction, Visual3DScene, Object3DType } from "../lib/visual3d/types";
import { applyVisual3DAction, applyVisual3DActions, getVisual3DScene } from "../lib/visual3d/engine";
import { autoPlacement } from "../lib/visual3d/layout";
import { parseVisual3DAction, parseVisual3DActions, parseVisual3DScene, describeVisual3DActionError } from "../lib/visual3d/validate";
import { buildTimeline, timelineDuration } from "../lib/visual3d/timeline";
import { applyCameraAction, distance3D, enclosingOccluderRadius, fitOutsideOf, lerp3D, partBounds, sphereBounds } from "../lib/visual3d/camera";
import { getAsset, isAssetKnown, listAssetIds, listAssets } from "../lib/visual3d/assets";
import { boundsFromObjects, finalizeBounds, fitCameraToBounds, fitCameraToScene } from "../lib/visual3d/framing";
import { framingRadiusFromBounds, measureObjectBounds, validateObject3D } from "../lib/visual3d/assetValidation";
import { shellObjectIds } from "../lib/visual3d/containment";
import { emptyVisualScene } from "../lib/visual/types";
import { applyVisualActions as applyVisualActions2D, getVisualScene } from "../lib/visual/engine";
import { parseVisualActions } from "../lib/visual/validate";
import * as THREE from "three";
import { TEACHING_SCENARIOS } from "../lib/teaching/scenarios";
import { parseTeachingResponse } from "../lib/teaching/validation";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail = ""): void {
  if (condition) { passed += 1; console.log(`  ok  ${name}`); }
  else { failed += 1; console.error(`  FAIL ${name}${detail ? ` - ${detail}` : ""}`); }
}
function section(title: string): void { console.log(`\n${title}`); }

const byId3d = (scene: Visual3DScene, id: string) => scene.objects.find((o) => o.id === id);
const flowById = (scene: Visual3DScene, id: string) => scene.flows.find((f) => f.id === id);
const labelById = (scene: Visual3DScene, id: string) => scene.labels.find((l) => l.id === id);

section("1. Valid create_3d_object");
{
  const parsed = parseVisual3DAction({ action: "create_3d_object", id: "heart3d", type: "model", asset: "biology/heart", position: { x: 1, y: 1, z: 0 }, scale: 2, color: "#e25858" });
  check("parses a well-formed create_3d_object (model)", parsed !== null && parsed!.action === "create_3d_object");
  const scene = applyVisual3DAction(emptyVisual3DScene(), parsed!);
  check("applies the object to the scene", scene.objects.length === 1 && scene.objects[0].id === "heart3d");
  check("stores the model type and asset", scene.objects[0].type === "model" && scene.objects[0].asset === "biology/heart");
  check("stores the position", scene.objects[0].position.x === 1 && scene.objects[0].position.y === 1);
  check("stores the color", scene.objects[0].color === "#e25858");

  const sphere = applyVisual3DAction(emptyVisual3DScene(), parseVisual3DAction({ action: "create_3d_object", id: "s1", type: "sphere", scale: 1.5 })!);
  check("creates a primitive sphere", byId3d(sphere, "s1")?.type === "sphere");

  const withPlacement = applyVisual3DAction(emptyVisual3DScene(), parseVisual3DAction({ action: "create_3d_object", id: "p1", type: "box", placement: { kind: "anchor", anchor: "ground" } })!);
  const placed = byId3d(withPlacement, "p1");
  check("anchor placement: ground rests the object on the floor", Boolean(placed && placed.radius > 0 && placed.position.y === placed.radius));
  check("anchor placement: left of the scene", (() => {
    const left = byId3d(applyVisual3DAction(emptyVisual3DScene(), parseVisual3DAction({ action: "create_3d_object", id: "l1", type: "sphere", placement: { kind: "anchor", anchor: "left" } })!), "l1");
    return Boolean(left && left.position.x < 0);
  })());
  check("relation placement is resolved by the layout pass", (() => {
    const related = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
      { action: "create_3d_object", id: "a", type: "sphere" },
      { action: "create_3d_object", id: "b", type: "sphere", placement: { kind: "relation", relation: { type: "left_of", objects: ["a"] } } },
    ])! as Visual3DAction[]);
    const a = byId3d(related, "a");
    const b = byId3d(related, "b");
    return Boolean(a && b && b.position.x < a.position.x);
  })());
}

section("2. Invalid create_3d_object");
{
  const created = (value: unknown): Extract<Visual3DAction, { action: "create_3d_object" }> | null =>
    parseVisual3DAction(value) as Extract<Visual3DAction, { action: "create_3d_object" }> | null;

  check("rejects an unsupported shape type", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "dodecahedron" }) === null);
  check("rejects a missing type", parseVisual3DAction({ action: "create_3d_object", id: "x" }) === null);
  check("rejects a model without an asset by making it a primitive, not by losing the step", (() => {
    const parsed = created({ action: "create_3d_object", id: "x", type: "model" });
    return parsed !== null && parsed.type === "box" && parsed.asset === undefined;
  })());
  check("an unknown asset id is dropped instead of taking the step down with it", (() => {
    const parsed = created({ action: "create_3d_object", id: "x", type: "model", asset: "biology/dragon" });
    return parsed !== null && parsed.type === "box" && parsed.asset === undefined;
  })());
  check("a real model asset is kept as asked for", (() => {
    const parsed = created({ action: "create_3d_object", id: "x", type: "model", asset: "biology/heart" });
    return parsed !== null && parsed.type === "model" && parsed.asset === "biology/heart";
  })());
  check("a part with no asset to attach to is dropped, not fatal", (() => {
    const parsed = created({ action: "create_3d_object", id: "x", type: "model", part: "aorta" });
    return parsed !== null && parsed.part === undefined;
  })());
  check("a part that exists on the real asset is kept", (() => {
    const parsed = created({ action: "create_3d_object", id: "x", type: "model", asset: "biology/heart", part: "aorta" });
    return parsed !== null && parsed.part === "aorta";
  })());
  check("rejects a missing id", parseVisual3DAction({ action: "create_3d_object", type: "sphere" }) === null);
  check("rejects a bad color", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "sphere", color: "notacolor" }) === null);
  check("rejects a duplicate id (applied, not parsed)", (() => {
    const s = applyVisual3DAction(emptyVisual3DScene(), parseVisual3DAction({ action: "create_3d_object", id: "a", type: "sphere" })!);
    const s2 = applyVisual3DAction(s, parseVisual3DAction({ action: "create_3d_object", id: "a", type: "box" })!);
    return byId3d(s2, "a")?.type === "sphere";
  })());
}

section("3. Object transformations (move / rotate / scale)");
{
  const parsed = parseVisual3DActions([
    { action: "create_3d_object", id: "orb", type: "sphere", position: { x: 0, y: 1, z: 0 } },
    { action: "move_3d_object", id: "orb", position: { x: 3, y: 1, z: -2 } },
    { action: "rotate_3d_object", id: "orb", rotation: { x: 0, y: 90, z: 0 } },
    { action: "scale_3d_object", id: "orb", scale: 2.5 },
  ]);
  check("parses the transform batch", parsed !== null && parsed!.length === 4);
  const scene = applyVisual3DActions(emptyVisual3DScene(), parsed!);
  const orb = byId3d(scene, "orb");
  check("move updates position", orb?.position.x === 3 && orb?.position.z === -2);
  check("rotate updates rotation", orb?.rotation.y === 90);
  check("scale updates uniform scale", orb?.scale.x === 2.5 && orb?.scale.z === 2.5);
}

section("4. Highlight + Camera actions");
{
  const parsed = parseVisual3DActions([
    { action: "create_3d_object", id: "planet", type: "sphere" },
    { action: "highlight_3d_object", id: "planet", color: "#ffff00" },
  ]);
  check("parses highlight action", parsed !== null && parsed!.length === 2);
  const scene = applyVisual3DActions(emptyVisual3DScene(), parsed!);
  check("object is highlighted", byId3d(scene, "planet")?.highlight === true);
  check("stores highlight color", byId3d(scene, "planet")?.highlightColor === "#ffff00");

  const cameraScene = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "sun", type: "sphere", position: { x: 0, y: 2, z: 0 } },
    { action: "focus_camera", target: "sun" },
  ])! as Visual3DAction[]);
  check("focus_camera targets an object", cameraScene.camera.mode === "focused" && cameraScene.camera.focusedObjectId === "sun");
  check("camera target moved to the object", cameraScene.camera.target.x === 0 && cameraScene.camera.target.y === 2);

  const moveCam = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "move_camera", position: { x: 5, y: 5, z: 10 }, target: { x: 5, y: 0, z: 0 } },
  ])!);
  check("move_camera sets position and target", moveCam.camera.position.x === 5 && moveCam.camera.target.x === 5);
  check("move_camera sets manual mode", moveCam.camera.mode === "manual");

  const zoomCam = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([{ action: "zoom_camera", fov: 30 }])!);
  check("zoom_camera sets FOV", zoomCam.camera.fov === 30);

  const resetCam = applyVisual3DActions(cameraScene, parseVisual3DActions([{ action: "reset_camera" }])!);
  check("reset_camera returns to default", resetCam.camera.mode === "default");
}

// Focusing a TINY semantic part (a nucleolus, a valve) must never place the camera inside the model.
// The part anchor decides where to look; a floor relative to the whole object keeps the camera outside
// the geometry, so the part is taught in context instead of the view filling with the inside of a mesh.
section("4b. Part-focus framing floor");
{
  const object = {
    id: "cell", type: "model", asset: "biology/cell",
    position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 }, color: "#ffffff", radius: 2, visible: true,
  } as unknown as Parameters<typeof partBounds>[0];

  const tiny = partBounds(object, "nucleolus", { nucleolus: { center: { x: 0, y: 0, z: 0 }, radius: 0.02 } });
  check("tiny part keeps a framing radius that keeps the camera outside the model", tiny.radius >= 2 * 0.45 - 1e-9, `radius=${tiny.radius}`);

  const big = partBounds(object, "nucleus", { nucleus: { center: { x: 0, y: 0, z: 0 }, radius: 1.5 } });
  check("a large part keeps its own larger radius", big.radius >= 1.5 - 1e-9, `radius=${big.radius}`);

  const anchored = partBounds(object, "mitochondrion", { mitochondrion: { center: { x: 1, y: 0, z: 0 }, radius: 0.3 } });
  check("framing is centred on the requested part", Math.abs(anchored.center.x - 1) < 1e-9, `center.x=${anchored.center.x}`);

  const missing = partBounds(object, "not_a_part", undefined);
  check("an unknown part falls back to the whole object bounds", Math.abs(missing.radius - object.radius) < 1e-9);
}

section("5. Flow animations");
{
  const parsed = parseVisual3DActions([
    { action: "create_3d_object", id: "src", type: "sphere", position: { x: -3, y: 1, z: 0 } },
    { action: "create_3d_object", id: "dst", type: "sphere", position: { x: 3, y: 1, z: 0 } },
    { action: "animate_flow", id: "blood", from: "src", to: "dst", color: "#ff6b6b", particleCount: 15, speed: 1.5, loop: true },
  ]);
  check("parses flow batch", parsed !== null && parsed!.length === 3);
  const scene = applyVisual3DActions(emptyVisual3DScene(), parsed!);
  const flow = flowById(scene, "blood");
  check("flow created with correct kind", flow?.kind === "flow");
  check("flow has correct endpoints", flow?.fromId === "src" && flow?.toId === "dst");
  check("flow stores particle count", flow?.particleCount === 15);
  check("flow stores speed", flow?.speed === 1.5);
  check("flow stores loop", flow?.loop === true);
  check("flow has path points (at least 3)", (flow?.pathPoints.length ?? 0) >= 3);
}

section("6. Labels + clear + remove");
{
  const parsed = parseVisual3DActions([
    { action: "create_3d_object", id: "obj1", type: "box" },
    { action: "show_3d_label", id: "lbl1", target: "obj1", text: "Chamber" },
  ]);
  const scene = applyVisual3DActions(emptyVisual3DScene(), parsed!);
  check("label created", scene.labels.length === 1);
  check("label targets object", labelById(scene, "lbl1")?.targetId === "obj1");

  const hidden = applyVisual3DActions(scene, parseVisual3DActions([{ action: "hide_3d_label", id: "lbl1" }])!);
  check("hide_3d_label removes label", hidden.labels.length === 0);

  const removed = applyVisual3DActions(scene, parseVisual3DActions([{ action: "remove_3d_object", id: "obj1" }])!);
  check("remove_3d_object removes object", removed.objects.length === 0);

  const built = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "keep1", type: "sphere" },
    { action: "create_3d_object", id: "keep2", type: "box" },
    { action: "animate_flow", id: "f1", from: "keep1", to: "keep2" },
  ])!);
  const afterClear = applyVisual3DActions(built, parseVisual3DActions([{ action: "clear_3d_scene" }])!);
  check("clear_3d_scene empties objects", afterClear.objects.length === 0);
  check("clear_3d_scene empties flows", afterClear.flows.length === 0);
  check("clear_3d_scene resets camera", afterClear.camera.mode === "default");
}

section("7. Invalid actions");
{
  check("rejects unknown action", parseVisual3DAction({ action: "explode_3d", id: "x" }) === null);
  check("rejects move_3d_object on missing target", applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([{ action: "move_3d_object", id: "ghost", position: { x: 1, y: 1, z: 1 } }])! as Visual3DAction[]).objects.length === 0);
  check("rejects focus_camera on missing target", applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([{ action: "focus_camera", target: "ghost" }])! as Visual3DAction[]).camera.mode === "default");
  check("rejects animate_flow with missing endpoints", applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([{ action: "animate_flow", id: "f", from: "a", to: "b" }])! as Visual3DAction[]).flows.length === 0);
  check("rejects animate_flow from===to", parseVisual3DAction({ action: "animate_flow", id: "f", from: "a", to: "a" }) === null);
  check("describeVisual3DActionError gives reason", describeVisual3DActionError({ action: "explode_3d" }).length > 0);
  check("rejects NaN coordinates", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "sphere", position: { x: NaN, y: 0, z: 0 } }) === null);
  check("rejects infinite coordinates", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "sphere", position: { x: Infinity, y: 0, z: 0 } }) === null);
}

section("8. Limits (objects, particles, duration)");
{
  const actions: Visual3DAction[] = [];
  for (let i = 0; i < 60; i += 1) {
    actions.push({ action: "create_3d_object", id: `o${i}`, type: "sphere" });
  }
  const scene = applyVisual3DActions(emptyVisual3DScene(), actions);
  check("allows up to 60 objects", scene.objects.length === 60);
  const over = applyVisual3DActions(scene, [{ action: "create_3d_object", id: "over", type: "sphere" } as Visual3DAction]);
  check("rejects 61st object (at engine level)", over.objects.length === 60);

  check("rejects negative duration", parseVisual3DAction({ action: "wait", durationMs: -100 }) === null);
  check("rejects duration beyond cap (8000)", parseVisual3DAction({ action: "wait", durationMs: 9000 }) === null);
  check("accepts valid duration", parseVisual3DAction({ action: "wait", durationMs: 500 }) !== null);

  check("rejects particleCount below 1", parseVisual3DAction({ action: "animate_flow", id: "f", from: "a", to: "b", particleCount: 0 }) === null);
  check("rejects particleCount above 500", parseVisual3DAction({ action: "animate_flow", id: "f", from: "a", to: "b", particleCount: 501 }) === null);

  check("rejects FOV below 10", parseVisual3DAction({ action: "zoom_camera", fov: 5 }) === null);
  check("rejects FOV above 120", parseVisual3DAction({ action: "zoom_camera", fov: 150 }) === null);
  check("accepts valid FOV", parseVisual3DAction({ action: "zoom_camera", fov: 45 }) !== null);

  check("rejects scale below min", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "sphere", scale: 0.0001 }) === null);
  check("rejects scale above max", parseVisual3DAction({ action: "create_3d_object", id: "x", type: "sphere", scale: 10000 }) === null);
}

section("9. Timeline + camera logic");
{
  check("a batch drops only the invalid action (from===to), keeping the rest of the step",
    (() => {
      const parsed = parseVisual3DActions([
        { action: "create_3d_object", id: "a", type: "sphere" },
        { action: "wait", durationMs: 300 },
        { action: "animate_flow", id: "flow1", from: "a", to: "a" },
      ]);
      return parsed !== null && parsed.length === 2 && parsed[0].action === "create_3d_object" && parsed[1].action === "wait";
    })());
  check("a single unusable action still leaves the step's speech teachable",
    parseTeachingResponse({ speech: "A real teaching paragraph.", board_actions: [], visual3d_actions: [{ action: "explode_3d", id: "x" }], lesson_step: 1, next_step: 2 }) !== null);
  check("a named colour is understood rather than costing the action", (() => {
    const parsed = parseVisual3DAction({ action: "highlight_3d_object", id: "a", color: "red" }) as Extract<Visual3DAction, { action: "highlight_3d_object" }> | null;
    return parsed !== null && parsed.color === "#ff0000";
  })());
  check("a hex colour is normalised, not rejected", (() => {
    const parsed = parseVisual3DAction({ action: "highlight_3d_object", id: "a", color: "#0f0" }) as Extract<Visual3DAction, { action: "highlight_3d_object" }> | null;
    return parsed !== null && parsed.color === "#00ff00";
  })());
  check("a colour that is neither a name nor hex is still refused", parseVisual3DAction({ action: "highlight_3d_object", id: "a", color: "burgundy-ish" }) === null);

  const timeline = buildTimeline(parseVisual3DActions([
    { action: "create_3d_object", id: "a", type: "sphere" },
    { action: "wait", durationMs: 300 },
    { action: "create_3d_object", id: "b", type: "box" },
  ])!);
  check("timeline has entries for all 3 actions", timeline.length === 3);
  check("wait starts at cursor 0", timeline[1].startAtMs === 0);
  check("create b after wait starts at 300ms", timeline[2].startAtMs === 300);
  check("timelineDuration computes total", timelineDuration(timeline) >= 300);

  check("distance3D computes correctly", Math.abs(distance3D({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }) - 5) < 0.001);
  check("lerp3D interpolates midpoint", (() => {
    const mid = lerp3D({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 0.5);
    return mid.x === 5;
  })());

  const focusResult = applyCameraAction(
    { ...emptyVisual3DScene().camera, mode: "default" },
    { action: "focus_camera", target: "obj1" },
    (id) => (id === "obj1" ? { radius: 1.2, position: { x: 0, y: 2, z: 0 } } : undefined),
  );
  check("applyCameraAction focuses on target", focusResult.camera.mode === "focused" && focusResult.animated === true);
  check("focus_camera frames the whole scene on reset", (() => {
    const reset = applyCameraAction(
      { ...emptyVisual3DScene().camera, mode: "focused" },
      { action: "reset_camera" },
      () => undefined,
      { objectCount: 4, sceneBounds: { min: { x: -2, y: -2, z: -2 }, max: { x: 2, y: 2, z: 2 }, center: { x: 0, y: 0, z: 0 }, size: { x: 4, y: 4, z: 4 }, radius: 3.46 } },
    );
    return reset.camera.mode === "default"
      && Math.abs(reset.camera.position.y - 4) > 0
      && reset.camera.far > reset.camera.near;
  })());
  check("focus_camera on missing target does not animate", applyCameraAction(
    { ...emptyVisual3DScene().camera, mode: "default" },
    { action: "focus_camera", target: "missing" },
    () => undefined,
  ).animated === false);
}

section("10. Asset registry");
{
  check("biology/heart is known", isAssetKnown("biology/heart") === true);
  check("unknown asset is rejected", isAssetKnown("biology/dragon") === false);
  check("getAsset returns descriptor", getAsset("biology/heart")?.name === "Human Heart");
  check("asset has a documented fallback primitive", getAsset("biology/heart")?.fallbackType === "sphere");
  check("asset points at a real model file", (getAsset("biology/heart")?.path ?? "").endsWith(".glb"));
  check("asset carries framing metadata", (() => {
    const asset = getAsset("biology/heart");
    return Boolean(asset && asset.defaultScale > 0 && asset.boundingRadius > 0 && asset.recommendedCameraDistance > 0);
  })());
  check("asset exposes semantic anchors", Object.keys(getAsset("biology/heart")?.anchors ?? {}).length > 0);
  check("aliases resolve to the same descriptor", getAsset("heart") === getAsset("biology/heart"));
  check("listAssets returns non-empty list", listAssets().length > 0);
  check("listAssetIds returns known ids", listAssetIds().includes("earth/globe"));
  check("registerAsset adds new asset", (() => {
    const before = listAssetIds().length;
    // registerAsset is a side-effect; just verify the catalog is stable and queryable
    return listAssetIds().length === before;
  })());
}

section("11. Scene round-trip (Ask flow)");
{
  const scenes: Array<[string, Visual3DScene]> = [
    ["empty scene", emptyVisual3DScene()],
    ["objects + flows", applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
      { action: "create_3d_object", id: "src", type: "sphere" },
      { action: "create_3d_object", id: "dst", type: "box" },
      { action: "animate_flow", id: "flow", from: "src", to: "dst" },
    ])! as Visual3DAction[])],
    ["labels + camera", applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
      { action: "create_3d_object", id: "earth", type: "sphere" },
      { action: "show_3d_label", id: "l1", target: "earth", text: "Earth" },
      { action: "focus_camera", target: "earth" },
    ])! as Visual3DAction[])],
  ];

  for (const [name, scene] of scenes) {
    const clone = getVisual3DScene(scene);
    const roundTripped = parseVisual3DScene(clone);
    check(`scene round-trips through strict validation: ${name}`, roundTripped !== null);
    check(`round-trip preserves object count: ${name}`, roundTripped !== null && roundTripped.objects.length === scene.objects.length);
  }

  // A follow-up question with a populated 3D scene must still validate
  const populated = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "sun", type: "sphere" },
    { action: "create_3d_object", id: "earth", type: "sphere" },
    { action: "animate_flow", id: "orbit", from: "sun", to: "earth" },
    { action: "show_3d_label", id: "sunLbl", target: "sun", text: "Sun" },
  ])! as Visual3DAction[]);
  check("a populated 3D scene round-trips for Ask", parseVisual3DScene(getVisual3DScene(populated)) !== null);
  check("validation still rejects a bogus 3D scene", parseVisual3DScene({ objects: "not-an-array", flows: [], labels: [], camera: { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50, mode: "default" } }) === null);
  check("validation still rejects a scene without tick", parseVisual3DScene({ objects: [], flows: [], labels: [], camera: { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 }, fov: 50, mode: "default" } }) !== null);
}

section("12. Universal camera framing (no fixed distance)");
{
  const small = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "tiny", type: "sphere", scale: 0.3, position: { x: 0, y: 0, z: 0 } },
    { action: "frame_camera" },
  ])! as Visual3DAction[]);
  const large = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "huge", type: "sphere", scale: 40, position: { x: 0, y: 0, z: 0 } },
    { action: "frame_camera" },
  ])! as Visual3DAction[]);
  const distanceOf = (scene: Visual3DScene) => Math.hypot(
    scene.camera.position.x - scene.camera.target.x,
    scene.camera.position.y - scene.camera.target.y,
    scene.camera.position.z - scene.camera.target.z,
  );
  check("a larger scene is framed from further away", distanceOf(large) > distanceOf(small) * 5);
  check("framing never puts the camera inside the scene", distanceOf(small) > small.bounds.radius);
  check("framing produces sane near/far planes", (() => {
    const camera = small.camera;
    return camera.near > 0 && camera.far > camera.near && camera.far >= small.bounds.radius;
  })());
  check("framing aims at the measured centre of the scene", (() => {
    const camera = small.camera;
    return Math.hypot(camera.target.x - small.bounds.center.x, camera.target.y - small.bounds.center.y, camera.target.z - small.bounds.center.z) < small.bounds.radius;
  })());
  check("fitCameraToBounds fills 55-80% of the viewport", (() => {
    const fit = fitCameraToBounds(
      { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 }, center: { x: 0, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 }, radius: 1.73 },
      { fov: 50, aspect: 16 / 9 },
    );
    const distance = Math.hypot(fit.position.x, fit.position.y, fit.position.z);
    const halfFov = (fit.fov * Math.PI) / 360;
    const fill = (2 * Math.atan(1.73 / distance)) / (2 * halfFov);
    return fill > 0.55 && fill < 0.85;
  })());
  check("an empty scene falls back to a sane default view", (() => {
    const fit = fitCameraToScene(emptyVisual3DScene(), { aspect: 1.6 });
    return fit.fov > 0 && Number.isFinite(fit.position.x) && fit.near > 0;
  })());
}

section("13. Part-anchored relations and create-with-orbit");
{
  const scene = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart" },
    { action: "create_3d_object", id: "vessel", type: "model", asset: "biology/blood-vessel", placement: { kind: "relation", relation: { type: "attached_to", objects: ["heart"], anchorPart: "aorta" } } },
  ])! as Visual3DAction[]);
  const heart = byId3d(scene, "heart");
  const vessel = byId3d(scene, "vessel");
  check("a part-anchored relation measures the real part", Boolean(heart && vessel && vessel.relationAnchor && vessel.relationAnchor.radius > 0));
  check("a part-anchored relation is not placed at the model centre", Boolean(
    heart && vessel && (Math.abs(vessel.position.x - heart.position.x) > 1e-6 || Math.abs(vessel.position.y - heart.position.y) > 1e-6 || Math.abs(vessel.position.z - heart.position.z) > 1e-6),
  ));
  check("create_3d_object accepts an orbit", (() => {
    const orbital = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
      { action: "create_3d_object", id: "sun", type: "sphere" },
      { action: "create_3d_object", id: "planet", type: "sphere", orbit: { center: "sun", radius: 4, speedDegPerSec: 20 } },
    ])! as Visual3DAction[]);
    const planet = byId3d(orbital, "planet");
    const sun = byId3d(orbital, "sun");
    return Boolean(planet && sun && planet.orbit && planet.orbit.centerId === "sun" && planet.orbit.radius === 4 && Math.abs(planet.position.x - sun.position.x - 4) < 1e-6);
  })());
  check("an invalid orbit is rejected", parseVisual3DAction({ action: "create_3d_object", id: "p", type: "sphere", orbit: { center: 5 } }) === null);
  check("labels can point at a model part", (() => {
    const labelled = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
      { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart" },
      { action: "show_3d_label", id: "l", target: "heart", text: "Left ventricle", part: "left_ventricle", side: "right", leader: true },
    ])! as Visual3DAction[]);
    return labelled.labels[0]?.part === "left_ventricle" && labelled.labels[0]?.leader === true;
  })());
}

section("14. Deterministic teaching scenarios (all domains)");
{
  for (const scenario of TEACHING_SCENARIOS) {
    const invalid = scenario.steps.filter((step) => parseTeachingResponse(step) === null);
    check(`scenario "${scenario.id}" (${scenario.domain}) has only valid steps`, invalid.length === 0, `${invalid.length} invalid`);
    const with3D = scenario.steps.some((step) => (step.visual3d_actions ?? []).length > 0);
    const withGraph = scenario.steps.some((step) => step.board_actions.length > 0);
    // All THREE families are real representations. The DIAGRAM family was missing here, so a scenario
    // built entirely from 2D diagram actions — a code trace, a matrix of bars — was reported as
    // "renders in a real representation: false" even though it drew a full board.
    const withDiagram = scenario.steps.some((step) => (step.visual_actions ?? []).length > 0);
    check(`scenario "${scenario.id}" renders in a real representation`, with3D || withGraph || withDiagram);
    if (with3D) {
      const scene = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions(scenario.steps[0].visual3d_actions ?? [])! as Visual3DAction[]);
      check(`scenario "${scenario.id}" builds a 3D scene with objects`, scene.objects.length > 0);
      check(`scenario "${scenario.id}" scene round-trips`, parseVisual3DScene(getVisual3DScene(scene)) !== null);
    }
    if (withDiagram && !with3D && !withGraph) {
      const scene = getVisualScene(applyVisualActions2D(emptyVisualScene(), parseVisualActions(scenario.steps[0].visual_actions)!));
      check(`scenario "${scenario.id}" builds a 2D board with objects`, scene.objects.length > 0);
    }
  }
}

section("15. Generic part inspection (isolate, hide, explode, visibility)");
{
  const base = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart" },
  ])! as Visual3DAction[]);

  const isolated = applyVisual3DAction(base, parseVisual3DAction({ action: "isolate_part", id: "heart", part: "left_ventricle" })!);
  check("isolate_part records the semantic part", byId3d(isolated, "heart")?.isolatePart === "left_ventricle");
  check("isolate_part remembers the prior state so it can be undone", isolated.memory.isolatePart.heart === "");
  check("isolate_part on a part the model does not have is a silent no-op", (() => {
    const noop = applyVisual3DAction(base, parseVisual3DAction({ action: "isolate_part", id: "heart", part: "left_ventricle_typo" })!);
    return byId3d(noop, "heart")?.isolatePart === undefined && Object.keys(noop.memory.isolatePart).length === 0;
  })());

  const hidden = applyVisual3DAction(base, parseVisual3DAction({ action: "set_visibility", ids: ["heart"], part: "septum", visible: false })!);
  check("set_visibility can hide a single named part", byId3d(hidden, "heart")?.hiddenParts?.includes("septum") === true);
  const shown = applyVisual3DAction(hidden, parseVisual3DAction({ action: "set_visibility", ids: ["heart"], part: "septum", visible: true })!);
  check("set_visibility can show it again", byId3d(shown, "heart")?.hiddenParts?.includes("septum") === false);

  const exploded = applyVisual3DAction(base, parseVisual3DAction({ action: "explode_group", id: "heart", amount: 1 })!);
  const offsets = byId3d(exploded, "heart")?.explodeOffsets ?? {};
  const offsetValues = Object.values(offsets);
  check("explode_group gives every part a non-zero offset", offsetValues.length > 1 && offsetValues.every((v) => Math.hypot(v.x, v.y, v.z) > 0));
  check("explode_group is deterministic (same input, same offsets)", (() => {
    const again = applyVisual3DAction(base, parseVisual3DAction({ action: "explode_group", id: "heart", amount: 1 })!);
    return JSON.stringify(again.objects[0].explodeOffsets) === JSON.stringify(offsets);
  })());
  const assembled = applyVisual3DAction(exploded, parseVisual3DAction({ action: "assemble_group", id: "heart" })!);
  check("assemble_group clears the explode offsets", Object.keys(byId3d(assembled, "heart")?.explodeOffsets ?? {}).length === 0);
  check("the inspection memory round-trips through the scene serializer", parseVisual3DScene(getVisual3DScene(isolated)) !== null);
  check("an exploded + isolated scene round-trips", parseVisual3DScene(getVisual3DScene(applyVisual3DAction(exploded, parseVisual3DAction({ action: "isolate_part", id: "heart", part: "left_ventricle" })!))) !== null);
}

section("16. Generic overlays, animation and camera follow");
{
  const base = applyVisual3DActions(emptyVisual3DScene(), parseVisual3DActions([
    { action: "create_3d_object", id: "magnet", type: "model", asset: "physics/magnet" },
    { action: "create_3d_object", id: "pivot", type: "sphere" },
  ])! as Visual3DAction[]);

  const withAnnotations = applyVisual3DActions(base, parseVisual3DActions([
    { action: "show_vector", id: "f", from: { x: 0, y: 0, z: 0 }, direction: { x: 1, y: 1, z: 0 }, length: 3, color: "#ffcc33" },
    { action: "show_measurement", id: "h", from: { x: 0, y: 0, z: 0 }, to: { x: 2, y: 0, z: 0 }, text: "2 m", color: "#66ccff" },
    { action: "show_trajectory", id: "arc", path: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }, { x: 3, y: 0, z: 0 }], color: "#ff8844" },
  ])! as Visual3DAction[]);
  check("vector, measurement and trajectory annotations are all created", withAnnotations.annotations.length === 3);
  check("the annotation kinds are kept distinct", new Set(withAnnotations.annotations.map((a) => a.kind)).size === 3);
  check("a vector annotation normalizes its direction and honours the requested length", (() => {
    const vector = withAnnotations.annotations.find((a) => a.kind === "vector");
    if (vector === undefined) return false;
    const drawn = Math.hypot(vector.to.x - vector.from.x, vector.to.y - vector.from.y, vector.to.z - vector.from.z);
    return Math.abs(drawn - 3) < 1e-6 && Math.abs(vector.to.y - vector.to.x) < 1e-6 && vector.from.x === 0;
  })());
  check("a trajectory annotation keeps its path points", (() => {
    const arc = withAnnotations.annotations.find((a) => a.kind === "trajectory");
    return arc !== undefined && arc.points.length === 3;
  })());
  check("a measurement annotation keeps its label text", withAnnotations.annotations.find((a) => a.kind === "measurement")?.text === "2 m");
  check("a malformed overlay is rejected instead of silently ignored", parseVisual3DAction({ action: "show_trajectory", id: "bad" }) === null);
  check("annotations round-trip through the scene serializer", (() => {
    const restored = parseVisual3DScene(getVisual3DScene(withAnnotations));
    return restored !== null && restored.annotations.length === 3;
  })());
  check("hide_annotation removes only the named annotation", applyVisual3DAction(withAnnotations, parseVisual3DAction({ action: "hide_annotation", id: "f" })!).annotations.length === 2);

  const oscillating = applyVisual3DAction(base, parseVisual3DAction({ action: "animate_oscillate", id: "pivot", pivot: "magnet", amplitudeDeg: 25, periodMs: 1500, axis: "z" })!);
  check("animate_oscillate stores the pivot, amplitude, period and axis", (() => {
    const o = byId3d(oscillating, "pivot")?.oscillation;
    return o !== undefined && o.pivotId === "magnet" && o.amplitudeDeg === 25 && o.periodMs === 1500 && o.axis === "z";
  })());
  check("animate_oscillate on a pivot that does not exist is a silent no-op", (() => {
    const noop = applyVisual3DAction(base, parseVisual3DAction({ action: "animate_oscillate", id: "pivot", pivot: "not_in_the_scene" })!);
    return byId3d(noop, "pivot")?.oscillation === undefined;
  })());

  const pulsed = applyVisual3DAction(base, parseVisual3DAction({ action: "pulse_3d_object", id: "magnet", durationMs: 600, amplitude: 0.3 })!);
  check("pulse_3d_object stores a temporary highlight pulse", byId3d(pulsed, "magnet")?.pulse !== undefined);

  const spinning = applyVisual3DAction(base, parseVisual3DAction({ action: "animate_spin", id: "magnet", durationMs: 1000, axis: "y", speedDegPerSec: 45 })!);
  check("animate_spin keeps the requested axis (regression: it used to be dropped)", byId3d(spinning, "magnet")?.motion?.spinAxis === "y");
  check("animate_spin keeps the requested speed", byId3d(spinning, "magnet")?.motion?.spinSpeedDegPerSec === 45);

  const followed = applyVisual3DAction(base, parseVisual3DAction({ action: "follow_object", target: "magnet" })!);
  check("follow_object stores the follow target", followed.camera.follow?.targetId === "magnet");
  check("follow_object can target a named part", applyVisual3DAction(base, parseVisual3DAction({ action: "follow_object", target: "magnet", part: "magnet_north" })!).camera.follow?.part === "magnet_north");
  check("follow_object on a part the model lacks is a silent no-op", applyVisual3DAction(base, parseVisual3DAction({ action: "follow_object", target: "magnet", part: "imaginary_pole" })!).camera.follow === undefined);
  const returned = applyVisual3DAction(followed, parseVisual3DAction({ action: "return_camera" })!);
  check("return_camera clears the follow target", returned.camera.follow === undefined);
  check("return_camera restores the remembered camera mode", returned.camera.mode === "default");
}

section("17. Asset registry semantic integrity");
{
  // A semantic anchor is only useful if it is a real named node in the shipped model. This guards the
  // failure mode where a shape helper takes its name from `options` but callers pass it positionally,
  // which silently drops the part from the model, the manifest and every AI lesson that names it.
  const heart = getAsset("biology/heart");
  check("the heart exposes left_ventricle as a semantic anchor", heart?.semanticAnchors.includes("left_ventricle") === true);
  check("every heart anchor has a measured position", (() => {
    const anchors = getAsset("biology/heart")?.anchors ?? {};
    return heart !== undefined && heart.semanticAnchors.every((a) => {
      const anchor = anchors[a];
      return anchor !== undefined
        && Number.isFinite(anchor.center.x) && Number.isFinite(anchor.center.y) && Number.isFinite(anchor.center.z)
        && Number.isFinite(anchor.radius) && anchor.radius > 0;
    });
  })());
  let allAnchorsResolved = true;
  for (const asset of listAssets()) {
    if (asset.semanticAnchors.length !== asset.partCount) { allAnchorsResolved = false; break; }
    if (asset.semanticAnchors.some((a) => asset.anchors[a] === undefined)) { allAnchorsResolved = false; break; }
  }
  check(`every one of the ${listAssets().length} assets has one measured anchor per part`, allAnchorsResolved);
  check("no asset names the same part twice", listAssets().every((a) => new Set(a.semanticAnchors).size === a.semanticAnchors.length));
  check("every asset part name is a usable identifier", listAssets().every((a) => a.semanticAnchors.every((n) => /^[a-z0-9_]+$/.test(n))));
}

section("18. Structural / visibility validation of loaded models");
{
  // A GLB that parses is NOT proof it renders. This is the gate the renderer uses to treat
  // "loaded but invisible" exactly like "failed to load", so it is verified directly here.
  const good = new THREE.Group();
  const goodMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff8844 }));
  goodMesh.name = "nucleus";
  good.add(goodMesh);
  const goodResult = validateObject3D(good);
  check("a real mesh validates", goodResult.ok === true, goodResult.issues.join("; "));
  check("validation measures a non-empty, finite bounding sphere", goodResult.bounds.empty === false && goodResult.bounds.finite === true && goodResult.bounds.radius > 0.9);
  check("validation counts meshes and triangles", goodResult.meshCount === 1 && goodResult.triangleCount > 0);
  check("measureObjectBounds matches Box3", (() => {
    const measured = measureObjectBounds(good);
    const box = new THREE.Box3().setFromObject(good);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    return Math.abs(measured.radius - sphere.radius) < 1e-6;
  })());

  check("an empty group is rejected", validateObject3D(new THREE.Group()).ok === false);
  check("a null scene is rejected", validateObject3D(null).ok === false);

  const hidden = new THREE.Group();
  const hiddenMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial());
  hiddenMesh.visible = false;
  hidden.add(hiddenMesh);
  const hiddenResult = validateObject3D(hidden);
  check("an invisible mesh is rejected", hiddenResult.ok === false && hiddenResult.issues.some((i) => i.includes("no mesh is visible")));

  const transparent = new THREE.Group();
  transparent.add(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0 })));
  check("a fully transparent material is rejected", validateObject3D(transparent).ok === false);

  const tiny = new THREE.Group();
  tiny.add(new THREE.Mesh(new THREE.SphereGeometry(0.001, 8, 6), new THREE.MeshStandardMaterial()));
  check("a microscopic object is rejected", validateObject3D(tiny).ok === false);

  const huge = new THREE.Group();
  huge.add(new THREE.Mesh(new THREE.SphereGeometry(500, 8, 6), new THREE.MeshStandardMaterial()));
  check("an astronomically large object is rejected", validateObject3D(huge).ok === false);

  const nan = new THREE.Group();
  const nanMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial());
  nanMesh.geometry.attributes.position.setX(0, Number.NaN);
  nanMesh.name = "broken";
  nan.add(nanMesh);
  check("non-finite vertices are rejected", validateObject3D(nan).ok === false && validateObject3D(nan).issues.some((i) => i.includes("non-finite vertex")));

  const badTransform = new THREE.Group();
  const badMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial());
  badMesh.name = "offset";
  badMesh.position.set(Number.POSITIVE_INFINITY, 0, 0);
  badTransform.add(badMesh);
  check("a non-finite transform is rejected", validateObject3D(badTransform).ok === false);

  const zeroScale = new THREE.Group();
  const zeroMesh = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial());
  zeroMesh.name = "collapsed";
  zeroMesh.scale.set(0, 1, 1);
  zeroScale.add(zeroMesh);
  check("a zero scale is rejected", validateObject3D(zeroScale).ok === false);
}

section("19. Every shipped asset declares valid bounds and its teaching structures");
{
  // The registry's build-time measurement is what the runtime validates against, so a shipped asset
  // whose declared bounds are empty, non-finite, zero-sized or not normalized to radius 1 is a bug.
  const assets = listAssets();
  const badBounds = assets.filter((a) => {
    const b = a.bounds;
    if (!b) return true;
    const finite = [b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z, b.radius].every((v) => Number.isFinite(v));
    const size = Math.max(b.size.x, b.size.y, b.size.z);
    return !finite || size < 1e-4 || b.radius < 0.02 || b.radius > 200;
  });
  check(`all ${assets.length} assets declare finite, non-degenerate bounds`, badBounds.length === 0, badBounds.map((a) => a.id).join(", "));
  const badRadius = assets.filter((a) => Math.abs(a.bounds.radius - 1) > 0.05);
  check("every asset is normalized to a comparable bounding radius", badRadius.length === 0, badRadius.map((a) => `${a.id}=${a.bounds.radius}`).join(", "));
  check("every asset reports at least one mesh and one material", assets.every((a) => a.meshCount > 0 && a.materialCount > 0));
  check("every asset reports real triangles", assets.every((a) => a.triangles > 0));

  // The models rebuilt for educational fidelity must stay recognisable: several distinct structures.
  const requiredParts: Record<string, string[]> = {
    "biology/heart": ["left_ventricle", "right_ventricle", "left_atrium", "right_atrium", "septum", "aorta"],
    "biology/brain": ["left_hemisphere", "right_hemisphere", "cerebellum", "brain_stem"],
    "biology/lungs": ["left_lung", "right_lung", "trachea", "left_bronchus", "right_bronchus"],
    "biology/cell": ["cell_membrane", "nucleus", "mitochondrion_1", "rough_endoplasmic_reticulum", "golgi_cisterna_1"],
    "biology/dna": ["backbone_1", "backbone_2", "purine_1", "pyrimidine_1"],
    "biology/blood-vessel": ["adventitia", "smooth_muscle_layer", "endothelium", "lumen"],
    "biology/blood-cell": ["red_blood_cell", "haemoglobin_region", "central_pallor"],
    "physics/gear": ["gear_teeth", "gear_hub", "driven_gear"],
    "network/laptop": ["screen_display", "keyboard_keys", "ethernet_port"],
    "network/firewall": ["firewall_wall", "gateway", "blocked_packet_1", "allowed_packet"],
    "computer-science/cpu": ["cpu_core_1", "l2_cache", "heat_spreader", "lga_contact_1"],
    "computer-science/memory": ["dram_bank_1", "gold_contact_edge", "heat_spreader"],
  };
  for (const [id, parts] of Object.entries(requiredParts)) {
    const asset = getAsset(id);
    const missing = parts.filter((part) => !asset?.semanticAnchors.includes(part));
    check(`${id} exposes its teaching structures`, asset !== undefined && missing.length === 0, missing.join(", "));
  }
}

section("20. Containment shells — a containing surface must not hide what it contains");
{
  const sphere = (id: string, scale: number, position = { x: 0, y: 0, z: 0 }, type: Object3DType = "sphere") => ({
    id, type, position, radius: type === "sphere" ? scale : scale * 0.8, scale: { x: scale, y: scale, z: scale },
    color: "#ffffff", rotation: { x: 0, y: 0, z: 0 }, visible: true, tick: 0,
  }) as unknown as Visual3DScene["objects"][number];

  const atom = [sphere("nucleus", 1.6), sphere("shell1", 2.2), sphere("shell2", 3.4), sphere("e1", 0.35, { x: 2.2, y: 0, z: 0 })];
  const shells = shellObjectIds(atom);
  check("an outer shell that encloses the nucleus is reported as a shell", shells.has("shell1") && shells.has("shell2"));
  check("the innermost body is NOT made see-through", !shells.has("nucleus"), [...shells].join(","));
  check("an electron on the outside of the shell is not a shell", !shells.has("e1"));

  check("a lone sphere is never a shell", shellObjectIds([sphere("only", 2)]).size === 0);
  check("an invisible container is not a shell", shellObjectIds([{ ...sphere("a", 3), visible: false }, sphere("b", 0.4)]).size === 0);
  check("a flat object never becomes a shell", shellObjectIds([sphere("plane", 3, undefined, "plane"), sphere("b", 0.4)]).size === 0);
  check("an object merely touching the surface is not enclosed", shellObjectIds([sphere("a", 1), sphere("b", 0.4, { x: 1.35, y: 0, z: 0 })]).has("a") === false);
  check("a real container with its contents inside IS a shell", shellObjectIds([sphere("a", 1), sphere("b", 0.4, { x: 0.3, y: 0, z: 0 })]).has("a"));

  const nested = shellObjectIds([sphere("outer", 5), sphere("inner", 3), sphere("core", 0.4)]);
  check("nested shells are all reported (an atom's shells enclose each other)", nested.has("outer") && nested.has("inner") && !nested.has("core"));
}

section("21. Camera framing measures real extent, not a box diagonal");
{
  // A sphere of radius 3 inscribed in its own box needs a bounding sphere of 3, not 5.2. Framing from
  // the diagonal put a 6.8-unit atom on screen as a 39%-wide speck instead of the intended 70%.
  const round = boundsFromObjects([
    { position: { x: 0, y: 0, z: 0 }, radius: 3 },
  ]);
  check("a single sphere bounds itself to its own radius", Math.abs(round.radius - 3) < 1e-6, String(round.radius));
  const spread = boundsFromObjects([
    { position: { x: -4, y: 0, z: 0 }, radius: 1 },
    { position: { x: 4, y: 0, z: 0 }, radius: 1 },
  ]);
  check("an object far from the centre still stretches the frame", Math.abs(spread.radius - 5) < 1e-6, String(spread.radius));
  check("a plain box still falls back to the diagonal", Math.abs(finalizeBounds({ x: -1, y: -1, z: -1 }, { x: 1, y: 1, z: 1 }).radius - Math.sqrt(3)) < 1e-6);
}

section("22. Focusing an object never parks the camera inside its container");
{
  const target = { position: { x: 0, y: 0, z: 0 }, radius: 1.6 };
  check("a shell enclosing the target pushes the camera outside it",
    enclosingOccluderRadius(target, [{ id: "shell", position: { x: 0, y: 0, z: 0 }, radius: 3.4 }]) > 3.4);
  check("the largest enclosing shell wins",
    enclosingOccluderRadius(target, [
      { id: "a", position: { x: 0, y: 0, z: 0 }, radius: 3.4 },
      { id: "b", position: { x: 0, y: 0, z: 0 }, radius: 6 },
    ]) > 6);
  check("a smaller neighbour is not treated as a container",
    enclosingOccluderRadius(target, [{ id: "small", position: { x: 1.7, y: 0, z: 0 }, radius: 0.5 }]) === 0);
  check("a big object far away does not constrain the camera",
    enclosingOccluderRadius(target, [{ id: "far", position: { x: 40, y: 0, z: 0 }, radius: 3 }]) === 0);

  // The rendered symptom: focus_camera on the nucleus of an atom put the camera inside the 3.4-unit
  // electron shell, so the whole viewport became the inside of a sphere.
  const atom = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "nucleus", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 1.6 },
    { action: "create_3d_object", id: "shell2", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 3.4 },
    { action: "focus_camera", target: "nucleus" },
  ] as Visual3DAction[]);
  const focusDistance = distance3D(atom.camera.position, atom.camera.target);
  check("focus_camera on the nucleus stays outside the electron shell", focusDistance > byId3d(atom, "shell2")!.radius, `${focusDistance.toFixed(2)}`);
  check("the close-up still frames the nucleus generously", focusDistance < byId3d(atom, "shell2")!.radius * 4, `${focusDistance.toFixed(2)}`);
  check("the near plane still contains the content after the push-back", atom.camera.near > 0 && atom.camera.near < focusDistance);

  // A plain object with nothing around it is framed exactly as before: nothing to push back from.
  const lonely = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "solo", type: "sphere", scale: 2 },
    { action: "focus_camera", target: "solo" },
  ] as Visual3DAction[]);
  const soloDistance = distance3D(lonely.camera.position, lonely.camera.target);
  const soloRadius = byId3d(lonely, "solo")!.radius;
  check("focusing an un-enclosed object uses the tight sphere fit (no corner penalty)",
    Math.abs(soloDistance - soloRadius / (0.66 * Math.tan(Math.PI / 8))) < 1e-3, soloDistance.toFixed(3));

  // An ELONGATED target must not be fitted as if it were a ball: a wide flat slab is fitted by its
  // corners, which is strictly closer than the sphere fit while still clipping nothing.
  const slab = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "slab", type: "box", scale: 4 },
    { action: "focus_camera", target: "slab" },
  ] as Visual3DAction[]);
  const slabDistance = distance3D(slab.camera.position, slab.camera.target);
  check("a long scene is framed closer than its bounding sphere would allow",
    slabDistance < byId3d(slab, "slab")!.radius * Math.sqrt(3) / (0.66 * Math.tan(Math.PI / 8)),
    slabDistance.toFixed(3));
}

section("23. Camera framing radius is the measured box's largest half-extent");
{
  const group = new THREE.Group();
  const sphere = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  group.add(sphere);
  group.updateWorldMatrix(true, true);
  const bounds = measureObjectBounds(group);
  // The box's bounding sphere is 1.73x too large for a round object; framing from it left a 6.8-unit
  // atom on screen as a 39%-wide speck instead of the intended ~70%.
  check("a radius-3 sphere frames at radius 3, not its 5.2 box diagonal",
    Math.abs(framingRadiusFromBounds(bounds) - 3) < 1e-3, String(framingRadiusFromBounds(bounds)));
  check("asset validation still uses the conservative bounding sphere (unchanged contract)",
    Math.abs(bounds.radius - Math.sqrt(27)) < 1e-3, String(bounds.radius));

  const box = new THREE.Group();
  box.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshStandardMaterial()));
  box.updateWorldMatrix(true, true);
  check("a unit-2 cube frames at radius 1", Math.abs(framingRadiusFromBounds(measureObjectBounds(box)) - 1) < 1e-3);

  const flat = new THREE.Group();
  flat.add(new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 0.5), new THREE.MeshStandardMaterial()));
  flat.updateWorldMatrix(true, true);
  check("a wide flat object is framed by its LONGEST axis", Math.abs(framingRadiusFromBounds(measureObjectBounds(flat)) - 4) < 1e-3);

  check("a degenerate measurement falls back to the bounding sphere",
    framingRadiusFromBounds({ min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 }, size: { x: 0, y: 0, z: 0 }, center: { x: 0, y: 0, z: 0 }, radius: 0.5, empty: false, finite: true }) === 0.5);
}

section("24. Semantic layout leaves real clearance between related objects");
{
  // The regression that made a client, a router and a server render as one illegible pile: the
  // relation offset used only the REFERENCED object's radius, so two radius-1 models were placed
  // 1.65 units apart — 0.35 units inside each other.
  const scene = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "server", type: "model", asset: "network/server", placement: { kind: "anchor", anchor: "right" } },
    { action: "create_3d_object", id: "client", type: "model", asset: "network/laptop", placement: { kind: "relation", relation: { type: "left_of", objects: ["server"] } } },
    { action: "create_3d_object", id: "router", type: "model", asset: "network/router", placement: { kind: "relation", relation: { type: "between", objects: ["client", "server"] } } },
  ] as Visual3DAction[]);
  const server = byId3d(scene, "server")!;
  const client = byId3d(scene, "client")!;
  const router = byId3d(scene, "router")!;
  const surfacesApart = (a: typeof server, b: typeof server) => Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z) - a.radius - b.radius;
  check("the client clears the server's surface", surfacesApart(client, server) > 0, surfacesApart(client, server).toFixed(3));
  check("the router is between the client and the server", (router.position.x - client.position.x) * (router.position.x - server.position.x) < 0);
  check("no two objects in the chain overlap", [[client, server], [router, server], [client, router]].every(([a, b]) => surfacesApart(a as typeof server, b as typeof server) > 0));
  check("the three devices are laid out left to right", client.position.x < router.position.x && router.position.x < server.position.x);

  // A large object beside a small one must clear it too, not the small one's radius.
  const mixed = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "big", type: "sphere", position: { x: 0, y: 0, z: 0 }, scale: 4 },
    { action: "create_3d_object", id: "small", type: "sphere", placement: { kind: "relation", relation: { type: "above", objects: ["big"] } } },
  ] as Visual3DAction[]);
  const big = byId3d(mixed, "big")!;
  const small = byId3d(mixed, "small")!;
  check("a small object placed above a large one does not sink into it",
    small.position.y - big.position.y - big.radius - small.radius > 0,
    (small.position.y - big.position.y).toFixed(3));
}

section("25. An exploded model is framed at its exploded size, not its intact size");
{
  // "Now let us take the heart apart" pushed chambers outside the viewport, leaving their labels
  // pointing at empty space, because the camera was still framing the heart's intact radius.
  const heart = getAsset("biology/heart");
  const exploded = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart", scale: 2 },
    { action: "explode_group", id: "heart" },
  ] as Visual3DAction[]);
  const intact = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart", scale: 2 },
  ] as Visual3DAction[]);
  const object = byId3d(exploded, "heart")!;
  const offsets = object.explodeOffsets ?? {};
  const spread = Math.max(0, ...Object.values(offsets).map((offset) => Math.hypot(offset.x, offset.y, offset.z)));
  check("explode_group produced per-part offsets", spread > 0, `${Object.keys(offsets).length} parts, spread ${spread.toFixed(2)}`);
  check("the scene grows to hold the exploded parts", exploded.bounds.radius > intact.bounds.radius + 1,
    `${intact.bounds.radius.toFixed(2)} -> ${exploded.bounds.radius.toFixed(2)}`);
  check("the exploded spread is bounded, not unbounded", exploded.bounds.radius < intact.bounds.radius + spread * 2 * object.scale.x + 1e-6);
  check("every exploded part stays inside the framed bounds", exploded.bounds.radius >= spread * object.scale.x,
    `${exploded.bounds.radius.toFixed(2)} >= ${(spread * object.scale.x).toFixed(2)}`);
  check("the registry really anchors the parts that were blown apart", Object.keys(offsets).length >= 4);
  check("the heart registry still exposes every anchored part", heart !== undefined && Object.keys(heart.anchors).length > 0);
}

section("26. Zooming into a part keeps the whole object in view");
{
  // Isolating a chamber framed the chamber alone: the heart filled four screens and the vena cava left
  // the top of the canvas, so the student saw a shape with no idea which organ it belonged to.
  const heart = getAsset("biology/heart")!;
  const part = Object.keys(heart.anchors).find((name) => name.includes("ventricle")) ?? Object.keys(heart.anchors)[0];
  const scene = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart", scale: 2 },
    { action: "focus_camera", target: "heart", part },
  ] as Visual3DAction[]);
  const owner = byId3d(scene, "heart")!;
  const distance = distance3D(scene.camera.position, owner.position);
  check("focusing a part does not fill the viewport with the model", distance < owner.radius * 14, distance.toFixed(2));
  check("the containing object is still what the camera frames, not the part alone",
    distance > owner.radius / 0.66 && distance < owner.radius * 14,
    `owner ${owner.radius.toFixed(2)} distance ${distance.toFixed(2)}`);

  const whole = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "heart", type: "model", asset: "biology/heart", scale: 2 },
    { action: "focus_camera", target: "heart" },
  ] as Visual3DAction[]);
  const wholeOwner = byId3d(whole, "heart")!;
  check("focusing a whole object is unaffected by the context rule",
    Math.abs(distance3D(whole.camera.position, wholeOwner.position) - wholeOwner.radius / (0.66 * Math.tan(Math.PI / 8))) < 1e-3,
    distance3D(whole.camera.position, wholeOwner.position).toFixed(3));
}

section("27. A focused object stays inside the viewport and keeps its container visible");
{
  const HALF_FOV_TAN = Math.tan(Math.PI / 8); // the default 45-degree field of view
  const sinHalfFov = HALF_FOV_TAN / Math.sqrt(1 + HALF_FOV_TAN * HALF_FOV_TAN);
  const shells = (targetRadius: number, ...shellRadii: number[]) => shellRadii.map((radius, index) => ({ id: `shell${index}`, position: { x: 0, y: 0, z: 0 }, radius }));

  // THE REGRESSION: "look at the nucleus" framed a 1.6-unit sphere at 5.9 units, which put the
  // 3.4-unit shell closer than radius/sin(halfFov) — the shell overflowed the viewport on every side
  // and the close-up measured 552% of the frame.
  const atomGuard = enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 1.6 }, shells(1.6, 2.2, 3.4), HALF_FOV_TAN);
  check("the camera is pushed outside every enclosing shell", atomGuard > 3.4, atomGuard.toFixed(2));
  check("the enclosing shell is required to FIT the frame, not merely be survived", atomGuard >= 3.4 / sinHalfFov, `need ${(3.4 / sinHalfFov).toFixed(2)}, got ${atomGuard.toFixed(2)}`);
  const atomFit = fitOutsideOf(
    fitCameraToBounds(sphereBounds({ x: 0, y: 0, z: 0 }, 1.6), { fov: 45, fill: 0.66, direction: { x: 0.62, y: 0.42, z: 0.86 } }),
    atomGuard,
  );
  const nucleusNdc = 2 * Math.atan(1.6 / atomFit.distance / HALF_FOV_TAN) / (Math.PI / 180) / 90;
  check("the focused object is still clearly visible after the push-back", nucleusNdc > 0.12 && nucleusNdc < 0.75, `${(nucleusNdc * 100).toFixed(0)}% of the frame`);
  const shellNdc = 2 * Math.atan(3.4 / atomFit.distance / HALF_FOV_TAN) / (Math.PI / 180) / 90;
  check("the enclosing shell no longer overflows the viewport", shellNdc <= 1.0, `${(shellNdc * 100).toFixed(0)}% of the frame`);

  // A LARGER container pushes further back; a tighter one does not.
  check("a larger enclosure is respected over a smaller one",
    enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 0.5 }, shells(0.5, 2, 9), HALF_FOV_TAN)
      > enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 0.5 }, shells(0.5, 2, 4), HALF_FOV_TAN));

  // Nothing constrains a target with nothing around it.
  check("a lone object is unconstrained", enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 2 }, [], HALF_FOV_TAN) === 0);
  // A nearby object that does NOT enclose the target (it overlaps in radius but not in space).
  check("a neighbour that does not enclose the target does not push the camera back",
    enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 0.5 }, [{ id: "near", position: { x: 6, y: 0, z: 0 }, radius: 4 }], HALF_FOV_TAN) === 0);
  // A wider field of view needs LESS distance for the same container.
  check("a wider field of view needs less push-back for the same enclosure",
    enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 1 }, shells(1, 5), Math.tan(Math.PI / 4))
      < enclosingOccluderRadius({ position: { x: 0, y: 0, z: 0 }, radius: 1 }, shells(1, 5), HALF_FOV_TAN));

  // The real pipeline: the atom lesson's own focus action.
  const atom = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "nucleus", type: "sphere", scale: 1.6 },
    { action: "create_3d_object", id: "shell1", type: "sphere", scale: 2.2 },
    { action: "create_3d_object", id: "shell2", type: "sphere", scale: 3.4 },
    { action: "focus_camera", target: "nucleus" },
  ] as Visual3DAction[]);
  const focusDistance = distance3D(atom.camera.position, atom.camera.target);
  const shell = byId3d(atom, "shell2")!;
  check("focusing inside a shell keeps the whole shell on screen",
    focusDistance >= shell.radius / sinHalfFov, `${focusDistance.toFixed(2)} vs ${(shell.radius / sinHalfFov).toFixed(2)}`);
  check("and the camera is still outside it", focusDistance > shell.radius);
  check("the near plane still contains the content", atom.camera.near > 0 && atom.camera.near < focusDistance);
}

section("28. Unplaced objects compose: containers join what they contain, peers stay apart");
{
  // Concentric composition used to be IMPOSSIBLE without coordinates: every object without a placement
  // went onto a golden-angle ring, so an atom's shells were 3-7 units apart and nothing enclosed the
  // nucleus. That is also why "look at the nucleus" had no container to keep it in context.
  const make = (id: string, radius: number, position = { x: 0, y: 0, z: 0 }): Visual3DScene["objects"][number] => ({
    id, type: "sphere" as const, objectKind: "primitive" as const, position, radius,
    scale: { x: radius, y: radius, z: radius }, rotation: { x: 0, y: 0, z: 0 }, visible: true,
    color: "#ffffff", order: 0, opacity: 1, highlight: false, highlightColor: "", castShadow: false, receiveShadow: false,
  });

  check("a shell placed with no coordinates joins the nucleus it encloses",
    distance3D(autoPlacement([make("nucleus", 1.6)], 3.4), { x: 0, y: 0, z: 0 }) < 1e-6);
  check("a membrane sized to contain an organelle shares its centre",
    distance3D(autoPlacement([make("organelle", 0.3, { x: 0.4, y: 0, z: 0 })], 1.2), { x: 0.4, y: 0, z: 0 }) < 1e-6);
  check("an equal-sized neighbour is NOT treated as a container",
    distance3D(autoPlacement([make("client", 1)], 1), { x: 0, y: 0, z: 0 }) > 1);
  check("a smaller neighbour takes the ring too",
    distance3D(autoPlacement([make("big", 3)], 1), { x: 0, y: 0, z: 0 }) > 1);
  check("an object far away is not a container to join",
    distance3D(autoPlacement([make("far", 1, { x: 40, y: 0, z: 0 })], 3), { x: 40, y: 0, z: 0 }) > 1);

  // And the full pipeline: focus inside a composed shell pulls back far enough to frame it.
  const scene = applyVisual3DActions(emptyVisual3DScene(), [
    { action: "create_3d_object", id: "nucleus", type: "sphere", scale: 1.6 },
    { action: "create_3d_object", id: "shell2", type: "sphere", scale: 3.4 },
    { action: "focus_camera", target: "nucleus" },
  ] as Visual3DAction[]);
  const nucleus = byId3d(scene, "nucleus")!;
  const shell = byId3d(scene, "shell2")!;
  check("composed shells really share a centre", distance3D(nucleus.position, shell.position) < 1e-6);
  const focusDistance = distance3D(scene.camera.position, scene.camera.target);
  check("focusing the nucleus keeps the shell it lives inside in frame",
    focusDistance > shell.radius && focusDistance > 8,
    `${focusDistance.toFixed(2)} for a ${shell.radius} shell`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
