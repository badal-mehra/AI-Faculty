const { applyVisual3DActions, getVisual3DScene } = require("./.test-out/lib/visual3d/engine");
const { emptyVisual3DScene } = require("./.test-out/lib/visual3d/types");
const { sceneBounds, boundsFromSceneObjects } = require("./.test-out/lib/visual3d/framing");
const { parseVisual3DActions } = require("./.test-out/lib/visual3d/validate");

const actions = [
  { action: "clear_3d_scene" },
  { action: "create_3d_object", id: "sun", type: "model", asset: "astronomy/sun", placement: { kind: "anchor", anchor: "center" } },
  { action: "create_3d_object", id: "jupiter", type: "model", asset: "astronomy/jupiter", orbit: { center: "sun", radius: 12, speedDegPerSec: 6 } },
];
const parsed = parseVisual3DActions(actions) || actions;
let scene = applyVisual3DActions(emptyVisual3DScene(), parsed);
console.log("objects:", scene.objects.map((o) => `${o.id} pos=(${o.position.x},${o.position.y},${o.position.z}) r=${o.radius.toFixed(2)} orbit=${o.orbit ? o.orbit.centerId + "/" + o.orbit.radius : "none"}`));
const b = sceneBounds(scene);
console.log("sceneBounds radius:", b.radius.toFixed(3), "center:", b.center.x.toFixed(2), b.center.y.toFixed(2), b.center.z.toFixed(2));
console.log("scene.bounds radius:", scene.bounds.radius.toFixed(3), "center:", scene.bounds.center.x.toFixed(2), scene.bounds.center.y.toFixed(2), scene.bounds.center.z.toFixed(2));
console.log("camera distance:", Math.hypot(scene.camera.position.x - scene.camera.target.x, scene.camera.position.y - scene.camera.target.y, scene.camera.position.z - scene.camera.target.z).toFixed(3));

// Direct unit check of the new helper.
const objs = [
  { id: "sun", position: { x: 0, y: 0, z: 0 }, radius: 1 },
  { id: "j", position: { x: 12, y: 0, z: 0 }, radius: 1, orbit: { centerId: "sun", radius: 12 } },
];
const bb = boundsFromSceneObjects(objs);
console.log("helper radius:", bb.radius.toFixed(3), "expected ~", (13 * Math.sqrt(3)).toFixed(3));
