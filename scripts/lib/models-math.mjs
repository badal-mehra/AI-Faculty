// MATHEMATICS model catalogue: solid geometry, solids of revolution, coordinate systems,
// vectors and surfaces — the 3D geometry objects a maths lesson actually needs.
import {
  partBox, partCylinder, partSphere, partTorus, partTube, partCone, partLathe, partPlane,
  partArrow, circlePath, wavePoints, solid, shellSphere,
} from "./shapes.mjs";
import { box, cylinder, sphere, torus, tube, transform, merge, plane, recomputeNormals } from "../glb.mjs";

const D = Math.PI / 180;

function cube() {
  return [
    partBox("cube", 1.4, 1.4, 1.4, "#4aa3d8", { roughness: 0.5 }),
    partBox("edge_highlight", 1.44, 0.06, 1.44, "#f2d24a", { at: [0, 0.71, 0] }),
  ];
}

function rectangularPrism() {
  return [
    partBox("prism", 1.8, 0.9, 1.1, "#7fbf8a", {}),
    partBox("width_axis", 1.85, 0.03, 0.03, "#f2d24a", { at: [0, 0.47, 0] }),
  ];
}

function sphereSolid() {
  return [
    partSphere("sphere", 0.8, "#8a7ad9", { segments: 40, heightSegments: 26 }),
    partTorus("sphere_equator", 0.81, 0.015, "#ffffff", { rotate: [Math.PI / 2, 0, 0], alpha: 0.5 }),
    partTorus("sphere_meridian", 0.81, 0.015, "#ffffff", { alpha: 0.5 }),
    partCylinder("radius_axis", 0.015, 0.015, 0.85, "#f2d24a", { at: [0.4, 0, 0], rotate: [0, 0, 90 * D] }),
    partSphere("radius_end", 0.05, "#f2d24a", { at: [0.8, 0, 0] }),
    partSphere("center", 0.05, "#ffffff", { at: [0, 0, 0] }),
  ];
}

function coneSolid() {
  return [
    partCone("cone", 0.8, 1.6, "#e08a5c", { at: [0, 0, 0], segments: 40 }),
    partCylinder("height_axis", 0.015, 0.015, 1.6, "#f2d24a", { at: [0, 0, 0] }),
    partSphere("apex", 0.05, "#f2d24a", { at: [0, 0.8, 0] }),
    partArrow("radius_arrow", 0.8, "#4a9ee8", { at: [0, -0.8, 0], rotate: [0, 0, 90 * D] }),
    partTorus("base_circle", 0.81, 0.015, "#ffffff", { at: [0, -0.8, 0], alpha: 0.6 }),
  ];
}

function cylinderSolid() {
  return [
    partCylinder("cylinder", 0.7, 0.7, 1.6, "#4aa3d8", { segments: 40 }),
    partArrow("radius_arrow", 0.7, "#f2d24a", { at: [0, -0.8, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("height_axis", 0.015, 0.015, 1.6, "#4ae07a", { at: [0.75, 0, 0] }),
    partSphere("center_top", 0.04, "#4ae07a", { at: [0, 0.8, 0] }),
    partSphere("center_bottom", 0.04, "#4ae07a", { at: [0, -0.8, 0] }),
    partTorus("top_circle", 0.71, 0.015, "#ffffff", { at: [0, 0.8, 0], alpha: 0.6 }),
    partTorus("bottom_circle", 0.71, 0.015, "#ffffff", { at: [0, -0.8, 0], alpha: 0.6 }),
  ];
}

function torusSolid() {
  return [
    partTorus("torus", 0.8, 0.34, "#c96ad9", { radialSegments: 40, tubularSegments: 24 }),
    partArrow("major_radius", 0.8, "#f2d24a", { at: [0, 0.5, 0], rotate: [0, 0, -90 * D] }),
    partArrow("minor_radius", 0.34, "#4a9ee8", { at: [0.8, 0.5, 0], rotate: [0, 0, 90 * D] }),
    partTorus("center_circle", 0.81, 0.012, "#ffffff", { at: [0, 0.5, 0], rotate: [Math.PI / 2, 0, 0], alpha: 0.5 }),
  ];
}

function triangularPrism() {
  return [
    { name: "triangular_prism", geom: prismGeometry(0.75, 1.5, 36), material: solid("#7fbfd9") },
    partBox("base_edge", 0.75, 0.03, 0.03, "#f2d24a", { at: [0, -0.75, 0.75] }),
  ];
}

function prismGeometry(radius, length, segments = 3) {
  const ring = circlePath(radius, 0, segments, Math.PI / 2).slice(0, segments);
  return prismSolidGeometry(ring, length);
}

function prismSolidGeometry(ring, length) {
  const g = { positions: [], normals: [], indices: [] };
  const half = length / 2;
  const n = ring.length;
  for (const z of [-half, half]) {
    for (const p of ring) {
      g.positions.push(p[0], p[1], z);
      g.normals.push(p[0], p[1], 0);
    }
  }
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    // Side wall.
    g.indices.push(i, j, n + i, j, n + j, n + i);
    // Bottom cap (reversed winding) and top cap.
    g.indices.push(0, j, i);
    g.indices.push(n, n + i, n + j);
  }
  return recomputeNormals(g);
}

function pyramid() {
  const g = { positions: [], normals: [], indices: [] };
  const base = 0.8;
  const height = 1.5;
  const corners = [[-base, -base], [base, -base], [base, base], [-base, base]];
  corners.forEach(([x, y]) => { g.positions.push(x, -height / 2, 0); g.normals.push(0, 0, 0); });
  g.positions.push(0, height / 2, 0);
  g.normals.push(0, 0, 0);
  for (let i = 0; i < 4; i += 1) {
    const a = i;
    const b = (i + 1) % 4;
    g.indices.push(a, b, 4);
    g.indices.push(b, a, 4);
  }
  g.indices.push(0, 2, 1, 0, 3, 2);
  return [{ name: "pyramid", geom: recomputeNormals(g), material: solid("#d9a05c") },
    partArrow("pyramid_height", 1.5, "#4ae07a", { at: [0, 0, 0.8] })];
}

function coordinateSystem() {
  return [
    partArrow("x_axis", 1.6, "#e05f5f", { at: [0, 0, 0], rotate: [0, 0, -90 * D] }),
    partArrow("y_axis", 1.6, "#4ae07a", { at: [0, 0, 0] }),
    partArrow("z_axis", 1.6, "#4a9ee8", { at: [0, 0, 0], rotate: [90 * D, 0, 0] }),
    partBox("xy_plane", 1.1, 0.01, 1.1, "#e05f5f", { at: [0, 0.001, 0.55], alpha: 0.15 }),
    partBox("yz_plane", 0.01, 1.1, 1.1, "#4ae07a", { at: [0.55, 0, 0], alpha: 0.15 }),
    partBox("xz_plane", 1.1, 1.1, 0.01, "#4a9ee8", { at: [0, 0.55, 0], alpha: 0.15 }),
    partSphere("origin", 0.06, "#ffffff", { at: [0, 0, 0] }),
  ];
}

function vectorArrow() {
  return [
    partArrow("vector", 2.0, "#e05f5f", { at: [-1, -0.6, 0], rotate: [0, 0, -26.5 * D], emissive: "#e05f5f", emissiveIntensity: 0.3, headLength: 0.4, headRadius: 0.14 }),
    partBox("vector_tail", 0.1, 0.1, 0.1, "#ffffff", { at: [-1, -0.6, 0] }),
  ];
}

function vectorSum() {
  return [
    partArrow("vector_a", 1.6, "#4a9ee8", { at: [0, 0, 0], rotate: [0, 0, -90 * D] }),
    partArrow("vector_b", 1.4, "#4ae07a", { at: [1.6, 0, 0], rotate: [0, 0, 26.5 * D] }),
    partArrow("resultant", 2.1, "#e05f5f", { at: [0, 0, 0.2], rotate: [0, 0, -37 * D] }),
    { name: "parallelogram", geom: parallelogram([[0, 0, 0.2], [1.6, 0, 0.2], [2.7, 0.75, 0.2], [1.1, 0.75, 0.2]]), material: solid("#4a9ee8", { alpha: 0.3 }) },
  ];
}

function parallelogram(points) {
  const g = { positions: [], normals: [], indices: [] };
  points.forEach((p) => { g.positions.push(p[0], p[1], p[2]); g.normals.push(0, 0, 1); });
  g.indices.push(0, 1, 2, 0, 2, 3);
  return recomputeNormals(g);
}

function unitCircle() {
  const parts = [
    partTorus("unit_circle", 1.0, 0.03, "#4aa3d8", { rotate: [Math.PI / 2, 0, 0], radialSegments: 48 }),
  ];
  for (let i = 1; i <= 4; i += 1) {
    parts.push(partSphere(`quadrant_marker_${i}`, 0.06, "#f2d24a", { at: [Math.cos(i * Math.PI / 2), 0.04, Math.sin(i * Math.PI / 2)] }));
  }
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    parts.push(partSphere(`unit_point_${i + 1}`, 0.05, "#f2d24a", { at: [Math.cos(a), 0, Math.sin(a)] }));
  }
  return parts;
}

function gridPlane() {
  const parts = [partPlane("xy_plane", 4, 4, "#e8e8f0", { segments: 16 })];
  for (let i = -8; i <= 8; i += 1) {
    const t = i / 8 * 2;
    parts.push({ name: `grid_line_x_${i + 8}`, geom: tube([[t, 0.005, -2], [t, 0.005, 2]], 0.006, 5, false), material: solid("#8a8aa0", { alpha: 0.7 }) });
    parts.push({ name: `grid_line_z_${i + 8}`, geom: tube([[-2, 0.005, t], [2, 0.005, t]], 0.006, 5, false), material: solid("#8a8aa0", { alpha: 0.7 }) });
  }
  parts.push(partArrow("grid_x_arrow", 2.1, "#e05f5f", { at: [0, 0.01, 0], rotate: [0, 0, -90 * D], shaftRadius: 0.02, headRadius: 0.07, headLength: 0.2 }));
  parts.push(partArrow("grid_z_arrow", 2.1, "#4a9ee8", { at: [0, 0.01, 0], rotate: [90 * D, 0, 0], shaftRadius: 0.02, headRadius: 0.07, headLength: 0.2 }));
  return parts;
}

function waveSurfaceModel() {
  const g = { positions: [], normals: [], indices: [] };
  const sx = 48, sz = 24;
  const width = 4, depth = 2, amplitude = 0.35, cycles = 2;
  for (let j = 0; j <= sz; j += 1) {
    for (let i = 0; i <= sx; i += 1) {
      const u = i / sx, v = j / sz;
      const x = (u - 0.5) * width;
      const z = (v - 0.5) * depth;
      const y = Math.sin(u * Math.PI * 2 * cycles) * amplitude * Math.sin(Math.PI * v);
      g.positions.push(x, y, z);
      g.normals.push(0, 1, 0);
    }
  }
  const grid = sx + 1;
  for (let j = 0; j < sz; j += 1) {
    for (let i = 0; i < sx; i += 1) {
      const a = j * grid + i;
      g.indices.push(a, a + grid, a + 1, a + 1, a + grid, a + grid + 1);
    }
  }
  return [
    { name: "wave_surface", geom: recomputeNormals(g), material: solid("#4aa3d8", { roughness: 0.25, alpha: 0.9 }) },
    { name: "equilibrium_plane", geom: plane(width, depth, 12), material: solid("#c9c9d9", { alpha: 0.25 }) },
    partArrow("amplitude_arrow", amplitude, "#e05f5f", { at: [-1.6, -amplitude, 0.6], rotate: [0, 0, -90 * D], shaftRadius: 0.02, headRadius: 0.06, headLength: 0.15 }),
    partArrow("wavelength_span", 2.0, "#4ae07a", { at: [0, -0.9, 0.6], rotate: [0, 0, -90 * D], shaftRadius: 0.02, headRadius: 0.06, headLength: 0.15 }),
    partArrow("wave_direction", 1.2, "#f2d24a", { at: [0, -0.2, -1.2], rotate: [90 * D, 0, 0], shaftRadius: 0.02, headRadius: 0.06, headLength: 0.15 }),
  ];
}

function frustum() {
  return [
    partLathe("frustum", [[0.9, -0.8], [0.5, 0.8], [0.46, 0.8], [0.86, -0.8], [0.9, -0.8]], "#c98a5c", { segments: 40 }),
    partArrow("frustum_height", 1.6, "#4ae07a", { at: [1.0, 0, 0] }),
    partArrow("frustum_r1", 0.9, "#f2d24a", { at: [0, -0.8, 0], rotate: [0, 0, 90 * D] }),
    partArrow("frustum_r2", 0.5, "#4a9ee8", { at: [0, 0.8, 0], rotate: [0, 0, 90 * D] }),
  ];
}

function parallelepiped() {
  return [
    partBox("parallelepiped", 1.6, 0.8, 1.0, "#9a7ad9", { rotate: [0, 0, 12 * D] }),
    partBox("a_edge", 1.65, 0.04, 0.04, "#f2d24a", { at: [0, 0.4, 0.5], rotate: [0, 0, 12 * D] }),
    partBox("b_edge", 0.04, 0.84, 0.04, "#4ae07a", { at: [0.8, 0, 0.5], rotate: [0, 0, 12 * D] }),
  ];
}

function polygonPrism() {
  return [
    { name: "polygon_prism", geom: prismGeometry(0.8, 1.6, 6), material: solid("#7f9ad9") },
    { name: "polygon_base", geom: prismGeometry(0.8, 0.02, 6), material: solid("#f2d24a", { alpha: 0.6 }) },
  ];
}

export const MATH_MODELS = {
  "mathematics/cube": cube,
  "mathematics/rectangular-prism": rectangularPrism,
  "mathematics/sphere": sphereSolid,
  "mathematics/cone": coneSolid,
  "mathematics/cylinder": cylinderSolid,
  "mathematics/torus": torusSolid,
  "mathematics/triangular-prism": triangularPrism,
  "mathematics/polygon-prism": polygonPrism,
  "mathematics/pyramid": pyramid,
  "mathematics/frustum": frustum,
  "mathematics/coordinate-system": coordinateSystem,
  "mathematics/vector": vectorArrow,
  "mathematics/vector-sum": vectorSum,
  "mathematics/parallelepiped": parallelepiped,
  "mathematics/unit-circle": unitCircle,
  "mathematics/grid-plane": gridPlane,
  "mathematics/wave-surface": waveSurfaceModel,
};

export { shellSphere, recomputeNormals };