// STRUCTURAL / VISIBILITY VALIDATION FOR A LOADED 3D MODEL.
//
// Proving a GLB *parses* is not the same as proving it *renders*. A model can load successfully and
// still be useless on screen: zero visible meshes, an empty or zero-sized bounding box, NaN/Infinity
// transforms, a microscopic or astronomically scaled mesh, an invisible (fully transparent) material,
// or geometry whose vertices are all non-finite. This module measures the live `THREE.Object3D` with
// `Box3`/`Sphere` and returns the concrete reasons a model would be invisible, so the renderer can
// treat "loaded but invisible" exactly like "failed to load": show the documented fallback primitive
// instead of an empty black classroom.
//
// It is pure logic over Three.js objects (no WebGL, no React), so it unit tests in Node and runs the
// same way in the browser.
import * as THREE from "three";
import { Vec3 } from "./types";

export type AssetBoundsMeasurement = {
  min: Vec3;
  max: Vec3;
  size: Vec3;
  center: Vec3;
  radius: number;
  empty: boolean;
  finite: boolean;
};

export type AssetValidationResult = {
  ok: boolean;
  meshCount: number;
  visibleMeshCount: number;
  triangleCount: number;
  materialCount: number;
  bounds: AssetBoundsMeasurement;
  issues: string[];
};

// A normalized model has a bounding radius of ~1. Anything outside this window is, for teaching
// purposes, microscopic or astronomical and would frame badly.
export const MIN_VISIBLE_RADIUS = 0.02;
export const MAX_VISIBLE_RADIUS = 200;
// A bounding box thinner than this on every axis cannot produce a readable silhouette.
export const MIN_VISIBLE_SIZE = 1e-4;

const EMPTY_BOUNDS: AssetBoundsMeasurement = {
  min: { x: 0, y: 0, z: 0 },
  max: { x: 0, y: 0, z: 0 },
  size: { x: 0, y: 0, z: 0 },
  center: { x: 0, y: 0, z: 0 },
  radius: 0,
  empty: true,
  finite: false,
};

/** Measures bounds of everything under `root`. `visibleOnly` skips hidden subtrees (isolated parts). */
export function measureObjectBounds(root: THREE.Object3D | null, options: { visibleOnly?: boolean } = {}): AssetBoundsMeasurement {
  if (!root) return { ...EMPTY_BOUNDS };
  const box = new THREE.Box3();
  let counted = 0;
  root.updateWorldMatrix(true, true);
  root.traverse((node) => {
    if (options.visibleOnly && !node.visible) return;
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (!geometry.attributes || !geometry.attributes.position) return;
    box.expandByObject(mesh);
    counted += 1;
  });
  if (counted === 0 || box.isEmpty()) return { ...EMPTY_BOUNDS };

  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  const finite = [box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z, sphere.radius]
    .every((value) => Number.isFinite(value));
  return {
    min: { x: box.min.x, y: box.min.y, z: box.min.z },
    max: { x: box.max.x, y: box.max.y, z: box.max.z },
    size: { x: size.x, y: size.y, z: size.z },
    center: { x: center.x, y: center.y, z: center.z },
    radius: Number.isFinite(sphere.radius) ? sphere.radius : 0,
    empty: false,
    finite,
  };
}

/**
 * The radius the CAMERA should frame: the largest half-extent of the measured box.
 *
 * `measureObjectBounds` reports the bounding sphere of the box, which is 1.73x too large for a round
 * object — every sphere, cell and planet is inscribed in its own box — so framing from it left a
 * 6.8-unit atom on screen as a 39%-wide speck. It is also looser still if it is built from per-mesh
 * bounding spheres, because a GLB part's local bounding sphere can be far larger than the part. The
 * box itself is measured from real vertices, so its largest half-extent is both accurate and tight:
 * it is exactly the object's size, and being conservative in only one axis keeps every other axis on
 * screen. Used by the renderer for framing; asset VALIDATION keeps the conservative sphere.
 */
export function framingRadiusFromBounds(bounds: AssetBoundsMeasurement): number {
  const half = Math.max(bounds.size.x, bounds.size.y, bounds.size.z) / 2;
  return Number.isFinite(half) && half > 1e-4 ? half : bounds.radius;
}

function hasNonFiniteAttribute(geometry: THREE.BufferGeometry): boolean {
  const position = geometry.attributes?.position as THREE.BufferAttribute | undefined;
  if (!position) return true;
  const array = position.array as ArrayLike<number>;
  for (let i = 0; i < array.length; i += 1) {
    if (!Number.isFinite(array[i])) return true;
  }
  return false;
}

function hasNonFiniteTransform(object: THREE.Object3D): boolean {
  const values = [
    object.position.x, object.position.y, object.position.z,
    object.scale.x, object.scale.y, object.scale.z,
    object.quaternion.x, object.quaternion.y, object.quaternion.z, object.quaternion.w,
  ];
  return values.some((value) => !Number.isFinite(value));
}

function materialIsRenderable(material: THREE.Material | THREE.Material[] | undefined): { renderable: boolean; reason?: string } {
  if (!material) return { renderable: false, reason: "mesh has no material" };
  const list = Array.isArray(material) ? material : [material];
  if (list.length === 0) return { renderable: false, reason: "mesh has an empty material array" };
  for (const entry of list) {
    if (!entry) return { renderable: false, reason: "mesh has a null material" };
    // A fully transparent material is invisible in practice; that is a rendering failure, not a style.
    if (entry.transparent && entry.opacity <= 0.02) return { renderable: false, reason: "material is fully transparent" };
    const standard = entry as THREE.MeshStandardMaterial;
    if (standard.color && [standard.color.r, standard.color.g, standard.color.b].some((value) => !Number.isFinite(value))) {
      return { renderable: false, reason: "material colour is not finite" };
    }
  }
  return { renderable: true };
}

/**
 * Validates that a loaded object actually produces a visible, sanely scaled, readable mesh.
 * Returns every concrete reason it would fail rather than a single boolean, so a bad asset can be
 * reported explicitly (Phase 3 of the 3D reliability brief).
 */
export function validateObject3D(
  root: THREE.Object3D | null,
  options: { expectedMinMeshes?: number; minRadius?: number; maxRadius?: number } = {},
): AssetValidationResult {
  const issues: string[] = [];
  const result: AssetValidationResult = {
    ok: false,
    meshCount: 0,
    visibleMeshCount: 0,
    triangleCount: 0,
    materialCount: 0,
    bounds: { ...EMPTY_BOUNDS },
    issues,
  };
  if (!root) {
    issues.push("no scene graph was produced by the loader");
    return result;
  }

  const materials = new Set<THREE.Material>();
  root.traverse((node) => {
    if (!Number.isFinite(node.position.x + node.position.y + node.position.z)) issues.push(`node "${node.name || node.type}" has a non-finite position`);
    if (!Number.isFinite(node.scale.x + node.scale.y + node.scale.z)) issues.push(`node "${node.name || node.type}" has a non-finite scale`);
    if (node.scale.x === 0 || node.scale.y === 0 || node.scale.z === 0) issues.push(`node "${node.name || node.type}" has a zero scale`);
    if (hasNonFiniteTransform(node)) issues.push(`node "${node.name || node.type}" transform contains NaN/Infinity`);

    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    result.meshCount += 1;
    if (node.visible) result.visibleMeshCount += 1;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    if (hasNonFiniteAttribute(geometry)) issues.push(`mesh "${node.name || node.type}" has non-finite vertex positions`);
    const index = geometry.index;
    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute | undefined;
    if (index) result.triangleCount += Math.floor(index.count / 3);
    else if (positionAttribute) result.triangleCount += Math.floor(positionAttribute.count / 3);
    else issues.push(`mesh "${node.name || node.type}" has no vertices`);

    const materialCheck = materialIsRenderable(mesh.material as THREE.Material | THREE.Material[]);
    if (!materialCheck.renderable) issues.push(`mesh "${node.name || node.type}": ${materialCheck.reason}`);
    const list = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const entry of list) if (entry) materials.add(entry);
  });
  result.materialCount = materials.size;

  const minMeshes = options.expectedMinMeshes ?? 1;
  if (result.meshCount < minMeshes) issues.push(`scene contains ${result.meshCount} mesh(es), expected at least ${minMeshes}`);
  if (result.visibleMeshCount === 0) issues.push("no mesh is visible");

  const bounds = measureObjectBounds(root);
  result.bounds = bounds;
  if (bounds.empty) issues.push("visible mesh bounds are empty (Box3.setFromObject returned nothing)");
  else {
    if (!bounds.finite) issues.push("bounds contain NaN/Infinity");
    const maxSize = Math.max(bounds.size.x, bounds.size.y, bounds.size.z);
    if (maxSize < MIN_VISIBLE_SIZE) issues.push("bounding box is zero/near-zero sized");
    const minRadius = options.minRadius ?? MIN_VISIBLE_RADIUS;
    const maxRadius = options.maxRadius ?? MAX_VISIBLE_RADIUS;
    if (bounds.radius < minRadius) issues.push(`object is microscopic (radius ${bounds.radius.toFixed(4)} < ${minRadius})`);
    if (bounds.radius > maxRadius) issues.push(`object is astronomically large (radius ${bounds.radius.toFixed(2)} > ${maxRadius})`);
  }
  if (result.triangleCount === 0) issues.push("scene contains no triangles");

  result.ok = issues.length === 0;
  return result;
}

