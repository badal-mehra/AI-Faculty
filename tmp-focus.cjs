const { applyVisual3DActions } = require("./.test-out/lib/visual3d/engine");
const { emptyVisual3DScene } = require("./.test-out/lib/visual3d/types");
const { parseVisual3DActions } = require("./.test-out/lib/visual3d/validate");

const step1 = [
  { action: "clear_3d_scene" },
  { action: "create_3d_object", id: "sun", type: "model", asset: "astronomy/sun", placement: { kind: "anchor", anchor: "center" } },
  { action: "create_3d_object", id: "mercury", type: "model", asset: "astronomy/mercury", orbit: { center: "sun", radius: 3.4, speedDegPerSec: 22 } },
  { action: "create_3d_object", id: "jupiter", type: "model", asset: "astronomy/jupiter", orbit: { center: "sun", radius: 12, speedDegPerSec: 6 } },
  { action: "show_3d_label", id: "lbl-sun", target: "sun", text: "Sun", side: "above", leader: true },
  { action: "frame_camera" },
];
const step2 = [
  { action: "highlight_3d_object", id: "jupiter", color: "#ffd166" },
  { action: "show_3d_label", id: "lbl-jupiter", target: "jupiter", text: "Jupiter (gas giant)", side: "below", leader: true },
  { action: "focus_camera", target: "jupiter" },
];

const p1 = parseVisual3DActions(step1) || step1;
let s = applyVisual3DActions(emptyVisual3DScene(), p1);
const cam1 = s.camera;
console.log("after step1: mode=" + cam1.mode, "target=(" + cam1.target.x.toFixed(2) + "," + cam1.target.z.toFixed(2) + ")",
  "dist=" + Math.hypot(cam1.position.x - cam1.target.x, cam1.position.y - cam1.target.y, cam1.position.z - cam1.target.z).toFixed(2));

const p2 = parseVisual3DActions(step2) || step2;
console.log("step2 parsed ok:", Array.isArray(p2), p2 && p2.map((a) => a.action).join(","));
s = applyVisual3DActions(s, p2);
const cam2 = s.camera;
console.log("after step2: mode=" + cam2.mode, "target=(" + cam2.target.x.toFixed(2) + "," + cam2.target.z.toFixed(2) + ")",
  "dist=" + Math.hypot(cam2.position.x - cam2.target.x, cam2.position.y - cam2.target.y, cam2.position.z - cam2.target.z).toFixed(2));
console.log("focusTarget:", JSON.stringify(cam2.focusTarget));
console.log("jupiter pos:", JSON.stringify(s.objects.find((o) => o.id === "jupiter")?.position));
