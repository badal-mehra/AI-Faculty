// Validation of every generated .glb: chunk framing, accessor alignment, index bounds, that each
// mesh primitive's vertex range matches the declared accessors, and that every semantic anchor the
// AI is allowed to reference really resolves to a named node in the shipped model. Run after
// `npm run assets:build` to catch a malformed or semantically mislabelled model before a browser
// ever requests it.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const MODELS_DIR = join(process.cwd(), "public", "models");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith(".glb")) out.push(full);
  }
  return out;
}

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const TYPE_COUNT = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

function validate(file) {
  const errors = [];
  const nodeNames = new Set();
  const buffer = readFileSync(file);
  if (buffer.byteLength < 20) return { errors: [`${file}: too small`], nodeNames };
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) errors.push("bad magic");
  if (view.getUint32(4, true) !== 2) errors.push("bad version");
  if (view.getUint32(8, true) !== buffer.byteLength) errors.push("declared length != file length");

  let cursor = 12;
  let gltf = null;
  let bin = null;
  while (cursor < buffer.byteLength) {
    const length = view.getUint32(cursor, true);
    const type = view.getUint32(cursor + 4, true);
    const start = cursor + 8;
    if (start + length > buffer.byteLength) { errors.push("chunk overruns file"); break; }
    if (type === 0x4e4f534a) gltf = JSON.parse(buffer.toString("utf8", start, start + length).trim());
    if (type === 0x004e4942) bin = buffer.subarray(start, start + length);
    cursor = start + length;
  }
  if (!gltf) return { errors: [...errors, "missing JSON chunk"], nodeNames };
  if (!bin) errors.push("missing BIN chunk");
  if (!gltf.meshes?.length) errors.push("no meshes");
  if (!gltf.nodes?.length) errors.push("no nodes");
  if (!gltf.buffers?.length) errors.push("no buffers");

  const accessorRange = (accessorIndex) => {
    const accessor = gltf.accessors[accessorIndex];
    const bufferView = gltf.bufferViews[accessor.bufferView];
    const stride = bufferView.byteStride ?? COMPONENT_BYTES[accessor.componentType] * TYPE_COUNT[accessor.type];
    const start = bufferView.byteOffset ?? 0;
    return { accessor, start, end: start + accessor.count * stride, bufferView };
  };

  for (const [index, accessor] of gltf.accessors.entries()) {
    if ((accessor.bufferView ?? -1) < 0) continue;
    const range = accessorRange(index);
    if ((gltf.bufferViews[accessor.bufferView].byteOffset ?? 0) % 4 !== 0) errors.push(`accessor ${index} bufferView misaligned`);
    if (range.end > (bin?.byteLength ?? 0)) errors.push(`accessor ${index} exceeds BIN chunk`);
    if (accessor.min && accessor.max) {
      for (let axis = 0; axis < 3; axis += 1) {
        if (!Number.isFinite(accessor.min[axis]) || !Number.isFinite(accessor.max[axis])) errors.push(`accessor ${index} has non-finite bounds`);
      }
    }
  }

  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const position = primitive.attributes?.POSITION;
      if (position === undefined) { errors.push(`mesh ${meshIndex}/${primitiveIndex} has no POSITION`); continue; }
      const positionRange = accessorRange(position);
      if (primitive.indices !== undefined) {
        const indexRange = accessorRange(primitive.indices);
        if (indexRange.end > bin.byteLength) errors.push(`mesh ${meshIndex}/${primitiveIndex} indices exceed BIN`);
        const componentSize = COMPONENT_BYTES[indexRange.accessor.componentType];
        const base = indexRange.start;
        let maxIndex = -1;
        for (let i = 0; i < indexRange.accessor.count; i += 1) {
          const at = base + i * componentSize;
          const value = indexRange.accessor.componentType === 5125
            ? bin.readUInt32LE(at)
            : componentSize === 2 ? bin.readUInt16LE(at) : bin.readUInt8(at);
          if (value > maxIndex) maxIndex = value;
        }
        if (maxIndex >= positionRange.accessor.count) errors.push(`mesh ${meshIndex}/${primitiveIndex} index ${maxIndex} >= vertex count ${positionRange.accessor.count}`);
        if (positionRange.accessor.count < 3) errors.push(`mesh ${meshIndex}/${primitiveIndex} has fewer than 3 vertices`);
      }
      if (primitive.material === undefined || !gltf.materials?.[primitive.material]) errors.push(`mesh ${meshIndex}/${primitiveIndex} has no material`);
    }
  }

  // The runtime resolves every semantic part by node name, so the shipped node names are exactly
  // the set of parts the renderer can isolate, highlight, follow, explode and label.
  const names = new Set();
  for (const node of gltf.nodes ?? []) {
    if (!node.name) { errors.push("unnamed node"); continue; }
    if (names.has(node.name)) errors.push(`duplicate node name ${node.name}`);
    names.add(node.name);
    nodeNames.add(node.name);
  }
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    for (const primitive of mesh.primitives ?? []) {
      if (primitive.material !== undefined) continue;
      errors.push(`mesh ${meshIndex} primitive without a material index`);
    }
  }
  // --- STRUCTURAL VISIBILITY VALIDATION (beyond "the file parses") -------------------------
  // A GLB that parses can still render invisibly: zero-area geometry, a degenerate or non-finite
  // bounding box, a microscopic or astronomical scale, or a fully transparent material. Measure the
  // real POSITION accessor bounds and the real material factors, exactly what THREE.Box3 would see.
  const overallMin = [Infinity, Infinity, Infinity];
  const overallMax = [-Infinity, -Infinity, -Infinity];
  let visibleMeshes = 0;
  let totalTriangles = 0;
  for (const [meshIndex, mesh] of (gltf.meshes ?? []).entries()) {
    let meshHasGeometry = false;
    for (const [primitiveIndex, primitive] of (mesh.primitives ?? []).entries()) {
      const positionIndex = primitive.attributes?.POSITION;
      if (positionIndex === undefined) continue;
      const accessor = gltf.accessors[positionIndex];
      if (!accessor?.min || !accessor?.max) { errors.push(`mesh ${meshIndex}/${primitiveIndex} POSITION lacks min/max bounds`); continue; }
      const finite = [...accessor.min, ...accessor.max].every((value) => Number.isFinite(value));
      if (!finite) { errors.push(`mesh ${meshIndex}/${primitiveIndex} POSITION bounds are not finite`); continue; }
      const size = [0, 1, 2].map((axis) => accessor.max[axis] - accessor.min[axis]);
      if (Math.max(...size) < 1e-4) { errors.push(`mesh ${meshIndex}/${primitiveIndex} is zero/near-zero sized`); continue; }
      meshHasGeometry = true;
      if (primitive.indices !== undefined) totalTriangles += Math.floor(gltf.accessors[primitive.indices].count / 3);
      else totalTriangles += Math.floor(accessor.count / 3);
      for (let axis = 0; axis < 3; axis += 1) {
        overallMin[axis] = Math.min(overallMin[axis], accessor.min[axis]);
        overallMax[axis] = Math.max(overallMax[axis], accessor.max[axis]);
      }
    }
    if (meshHasGeometry) visibleMeshes += 1;
    else errors.push(`mesh ${meshIndex} ("${mesh.name ?? ""}") has no renderable geometry`);
  }
  if (visibleMeshes === 0) errors.push("no visibly renderable mesh");
  if (totalTriangles === 0) errors.push("no triangles");

  const overallSize = [0, 1, 2].map((axis) => overallMax[axis] - overallMin[axis]);
  const overallRadius = Math.sqrt(overallSize[0] ** 2 + overallSize[1] ** 2 + overallSize[2] ** 2) / 2;
  if (!Number.isFinite(overallRadius)) errors.push("overall bounds are not finite");
  else if (Math.max(...overallSize) < 1e-4) errors.push("overall bounding box is zero/near-zero sized");
  else if (overallRadius < 0.02) errors.push(`asset is microscopic (radius ${overallRadius.toFixed(4)})`);
  else if (overallRadius > 200) errors.push(`asset is astronomically large (radius ${overallRadius.toFixed(2)})`);

  for (const [materialIndex, material] of (gltf.materials ?? []).entries()) {
    const factor = material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1];
    if (!factor.every((value) => Number.isFinite(value))) errors.push(`material ${materialIndex} has a non-finite base colour`);
    if (factor[3] !== undefined && factor[3] <= 0.02) errors.push(`material ${materialIndex} is fully transparent`);
    const metallic = material.pbrMetallicRoughness?.metallicFactor ?? 1;
    const roughness = material.pbrMetallicRoughness?.roughnessFactor ?? 1;
    if (!Number.isFinite(metallic) || !Number.isFinite(roughness)) errors.push(`material ${materialIndex} has non-finite PBR factors`);
  }

  return {
    errors,
    nodeNames,
    metrics: {
      meshCount: gltf.meshes?.length ?? 0,
      visibleMeshes,
      materialCount: gltf.materials?.length ?? 0,
      triangles: totalTriangles,
      radius: overallRadius,
      size: overallSize,
    },
  };
}

// --- manifest <-> GLB semantic cross-check -------------------------------------------------
// The manifest is the only list the AI prompt and the validator see, so an anchor that does not
// resolve to a real node is a silent no-op at runtime: the model loads, nothing appears, and the
// lesson looks broken. Compare every anchor against the node names actually shipped in the .glb.
function readManifestAnchors() {
  const source = readFileSync(join(process.cwd(), "lib", "visual3d", "generatedAssets.ts"), "utf8");
  const byPath = new Map();
  for (const block of source.matchAll(/\{\s*"id":\s*"([^"]+)"[\s\S]*?\n {2}\},?\n/g)) {
    const chunk = block[0];
    const path = chunk.match(/"path":\s*"([^"]+)"/)?.[1];
    const partCount = Number(chunk.match(/"partCount":\s*(\d+)/)?.[1] ?? 0);
    const anchorsBlock = chunk.match(/"semanticAnchors":\s*\[([\s\S]*?)\]/)?.[1] ?? "";
    const anchors = [...anchorsBlock.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    if (path) byPath.set(path, { anchors, partCount });
  }
  return byPath;
}

const manifest = readManifestAnchors();
const files = walk(MODELS_DIR).sort();
let failures = 0;
let totalBytes = 0;
let totalAnchors = 0;
const verbose = process.argv.includes("--report") || process.env.ASSET_REPORT === "1";
for (const file of files) {
  totalBytes += statSync(file).size;
  const { errors, nodeNames, metrics } = validate(file);
  const name = file.slice(MODELS_DIR.length + 1);
  const urlPath = `/models/${name.split("\\").join("/")}`;
  const entry = manifest.get(urlPath);
  if (!entry) {
    errors.push("model has no manifest entry");
  } else {
    totalAnchors += entry.anchors.length;
    if (entry.anchors.length !== entry.partCount) {
      errors.push(`manifest lists ${entry.anchors.length} anchors but declares partCount ${entry.partCount}`);
    }
    const duplicates = entry.anchors.filter((a, i) => entry.anchors.indexOf(a) !== i);
    if (duplicates.length > 0) errors.push(`duplicate manifest anchors: ${[...new Set(duplicates)].join(", ")}`);
    for (const anchor of entry.anchors) {
      if (!nodeNames.has(anchor)) errors.push(`anchor "${anchor}" has no matching node in the GLB`);
    }
    const unnamed = nodeNames.size - entry.anchors.length;
    if (unnamed > 0) errors.push(`${unnamed} node(s) in the GLB are not exposed as semantic anchors`);
  }
  const status = errors.length > 0 ? "FAIL" : "PASS";
  if (errors.length > 0) {
    failures += 1;
    console.error(`${name.padEnd(38)} ${status}: ${errors.join("; ")}`);
  } else if (verbose) {
    console.log(
      `${name.padEnd(38)} ${status}  meshes=${metrics.visibleMeshes}/${metrics.meshCount} ` +
      `materials=${metrics.materialCount} tris=${metrics.triangles} radius=${metrics.radius.toFixed(3)}`,
    );
  }
}
for (const urlPath of manifest.keys()) {
  if (!files.some((file) => `/models/${file.slice(MODELS_DIR.length + 1).split("\\").join("/")}` === urlPath)) {
    failures += 1;
    console.error(`FAIL ${urlPath}: manifest entry has no generated .glb`);
  }
}
console.log(
  `${files.length} GLB models validated, ${failures} invalid, ${(totalBytes / 1024 / 1024).toFixed(2)} MB total, ` +
  `${totalAnchors} semantic anchors cross-checked against shipped node names`,
);
process.exit(failures > 0 ? 1 : 0);