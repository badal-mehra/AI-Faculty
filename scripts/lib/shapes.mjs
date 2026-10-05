// Educational GLB model library.
//
// Every model is built from procedural geometry and serialized as a real binary glTF 2.0 file
// (see scripts/glb.mjs). Each model is made of NAMED parts; the part names become the asset's
// `semanticAnchors`, so the AI can talk about "left_ventricle" or "electron_shell_2" and the
// renderer can highlight, label or focus exactly that piece.
//
// Nothing here is topic-specific glue for one demo: this is a general-purpose catalogue of
// anatomical structures, apparatus, molecules, celestial bodies, network hardware and geometry,
// all built the same way and registered the same way.
import {
  box, cylinder, cone, torus, tube, sphere, ellipsoid, lathe, plane, wedge,
  merge, transform, displacedSphere, shell, samplePath, recomputeNormals,
} from "../glb.mjs";

const TAU = Math.PI * 2;

export function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const value = clean.length === 3
    ? clean.split("").map((c) => parseInt(c + c, 16))
    : [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)];
  return value.map((v) => Math.max(0, Math.min(255, Number.isFinite(v) ? v : 0)) / 255);
}

export const solid = (hex, options = {}) => ({
  color: [...hexToRgb(hex), options.alpha ?? 1],
  roughness: options.roughness ?? 0.62,
  metallic: options.metallic ?? 0,
  ...(options.emissive ? { emissive: hexToRgb(options.emissive).map((v) => v * (options.emissiveIntensity ?? 0.5)) } : {}),
});

// --- building blocks --------------------------------------------------------

// A soft, organic lump — used for organs, cells, organelles and other biology.
export const lump = (name, rx, ry, rz, color, options = {}) => {
  // The displacement has to be applied to the geometry that is actually shipped.
  //
  // `transformScale` used to build a FRESH ellipsoid and return it as `geom`, and because its result
  // was spread after `geom:` it silently overwrote the displaced sphere above. Every organic model in
  // the library — the heart, the lungs, the brain, the cell, the muscle, the kidney — was therefore a
  // smooth ellipsoid, and every `wobble` / `frequency` / `seed` option had no effect at all. That is the
  // single reason the anatomy reads as generic spheres rather than as organs.
  const displaced = displacedSphere(1, options.wobble ?? 0.09, options.frequency ?? 2.1, options.seed ?? 7, 34, 22);
  return {
    name,
    geom: transform(displaced, { scale: [rx, ry, rz], translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
    material: solid(color, options),
  };
};


// A hollow sphere shell (cell membrane, atom shell, atmospheric layer, Earth's core...).
export const shellSphere = (name, radius, thickness, color, options = {}) => ({
  name,
  geom: shell(radius, thickness, options.segments ?? 44),
  material: solid(color, { alpha: options.alpha ?? 1, roughness: options.roughness ?? 0.5, metallic: options.metallic ?? 0, emissive: options.emissive, emissiveIntensity: options.emissiveIntensity }),
});

export const partBox = (name, w, h, d, color, options = {}) => ({
  name,
  geom: transform(box(w, h, d), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partCylinder = (name, rTop, rBottom, h, color, options = {}) => ({
  name,
  geom: transform(cylinder(rTop, rBottom, h, options.segments ?? 28, options.capped ?? true), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partSphere = (name, r, color, options = {}) => ({
  name,
  geom: transform(sphere(r, options.segments ?? 32, options.heightSegments ?? 20), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partTorus = (name, radius, tube, color, options = {}) => ({
  name,
  geom: transform(torus(radius, tube, options.radialSegments ?? 34, options.tubularSegments ?? 20, options.arc ?? TAU), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partTube = (name, points, radius, color, options = {}) => ({
  name,
  geom: tube(points, radius, options.radialSegments ?? 12, options.capEnds ?? true),
  material: solid(color, options),
});

export const partCone = (name, r, h, color, options = {}) => ({
  name,
  geom: transform(cone(r, h, options.segments ?? 28), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partWedge = (name, w, h, d, color, options = {}) => ({
  name,
  geom: transform(wedge(w, h, d), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

export const partLathe = (name, profile, color, options = {}) => ({
  name,
  geom: transform(lathe(profile, options.segments ?? 32), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, options),
});

// A flat disc/plane, useful for cell membranes, ground plates, screen panels.
export const partPlane = (name, w, d, color, options = {}) => ({
  name,
  geom: transform(plane(w, d, options.segments ?? 1), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, { ...options, roughness: options.roughness ?? 0.8, alpha: options.alpha ?? 1 }),
});

// Smooth loop of points on a circle — used for orbits, waves, arrows around a body.
export function circlePath(radius, y = 0, segments = 48, phase = 0) {
  return Array.from({ length: segments }, (_, i) => {
    const a = phase + (i / segments) * TAU;
    return [Math.cos(a) * radius, y, Math.sin(a) * radius];
  });
}

export function helixPoints(turns, radius, height, perTurn = 24, phase = 0) {
  const total = Math.max(2, Math.round(turns * perTurn));
  return Array.from({ length: total + 1 }, (_, i) => {
    const t = i / total;
    const a = phase + t * turns * TAU;
    return [Math.cos(a) * radius, t * height - height / 2, Math.sin(a) * radius];
  });
}

export function wavePoints(width, amplitude, cycles, segments = 64, axis = "x") {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const t = i / segments;
    const along = (t - 0.5) * width;
    const value = Math.sin(t * TAU * cycles) * amplitude;
    return axis === "x" ? [along, value, 0] : [value, along, 0];
  });
}

// A generic arrow (shaft + head) pointing along +Y by default — used for force vectors,
// light rays, reaction arrows, coordinate axes and direction indicators.
export function arrowGeom(length, shaftRadius = 0.035, headLength = 0.28, headRadius = 0.1) {
  const shaft = cylinder(shaftRadius, shaftRadius, length - headLength, 12, true);
  const head = transform(cone(headRadius, headLength, 14), { translate: [0, length / 2 - headLength / 2, 0] });
  return merge([shaft, head]);
}

export const partArrow = (name, length, color, options = {}) => ({
  name,
  geom: transform(arrowGeom(length, options.shaftRadius ?? 0.035, options.headLength ?? Math.min(0.28, length * 0.3), options.headRadius ?? 0.1), { translate: options.at ?? [0, 0, 0], rotate: options.rotate ?? [0, 0, 0] }),
  material: solid(color, { emissive: options.emissive ?? color, emissiveIntensity: options.emissiveIntensity ?? 0.25, ...options }),
});

export { recomputeNormals, samplePath };