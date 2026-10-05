// BIOLOGY model catalogue: anatomy, cells, molecules of life, circulation, botany.
// Each model is a list of named parts; names become the asset's semanticAnchors.
import {
  lump, shellSphere, partBox, partCylinder, partSphere, partTorus, partTube, partCone,
  partWedge, partLathe, partPlane, partArrow, circlePath, helixPoints, wavePoints, solid,
  recomputeNormals,
} from "./shapes.mjs";
import { box, cylinder, sphere, transform, lathe } from "../glb.mjs";

const D = Math.PI / 180;

// ============================================================ BIOLOGY: HEART
function heart() {
  const muscle = "#c0392b";
  const oxygenated = "#d64545";
  const deoxygenated = "#4a6fa5";
  return [
    // Chambers: two ventricles (below) and two atria (above), anatomically offset.
    lump("left_ventricle", 0.62, 0.78, 0.6, oxygenated, { at: [-0.38, -0.15, 0.05], wobble: 0.1, seed: 11, rotate: [0, 0, 18 * D] }),
    lump("right_ventricle", 0.56, 0.72, 0.55, deoxygenated, { at: [0.45, -0.2, 0.05], wobble: 0.1, seed: 13, rotate: [0, 0, -18 * D] }),
    lump("left_atrium", 0.36, 0.32, 0.34, oxygenated, { at: [-0.5, 0.62, -0.05], wobble: 0.09, seed: 17 }),
    lump("right_atrium", 0.34, 0.3, 0.32, deoxygenated, { at: [0.5, 0.6, -0.05], wobble: 0.09, seed: 19 }),
    // Interventricular septum between the two ventricles.
    partBox("septum", 0.1, 1.25, 0.62, "#8f2d22", { at: [0.03, -0.15, 0.02], rotate: [0, 0, 4 * D] }),
    // Great vessels leaving the heart.
    partTube("aorta", [[-0.2, 0.75, 0], [-0.35, 1.5, 0.1], [0.05, 2.05, 0.2], [0.5, 1.75, 0.2]], 0.17, oxygenated),
    partTube("pulmonary_artery", [[0.35, 0.6, 0.05], [0.8, 1.15, 0.15], [1.15, 0.85, 0.15]], 0.14, deoxygenated),
    partTube("vena_cava", [[0.62, 0.95, -0.2], [0.75, 0.5, -0.2], [0.5, 0.35, -0.1]], 0.13, deoxygenated),
    partTube("pulmonary_vein", [[-0.62, 0.8, -0.2], [-0.72, 0.55, -0.2], [-0.5, 0.5, -0.1]], 0.12, oxygenated),
    // Valves between atria and ventricles.
    partTorus("mitral_valve", 0.16, 0.05, "#f2d0c4", { at: [-0.42, 0.33, 0.02], rotate: [90 * D, 0, 0] }),
    partTorus("tricuspid_valve", 0.15, 0.05, "#f2d0c4", { at: [0.46, 0.3, 0.02], rotate: [90 * D, 0, 0] }),
  ];
}

// =========================================================== BIOLOGY: LUNGS
function lungs() {
  const tissue = "#d98c8c";
  const branch = "#c9b3a0";
  return [
    lump("left_lung", 0.62, 1.05, 0.55, tissue, { at: [-0.78, -0.05, 0], wobble: 0.1, seed: 23 }),
    lump("right_lung", 0.62, 1.05, 0.55, tissue, { at: [0.78, -0.05, 0], wobble: 0.1, seed: 29 }),
    lump("left_upper_lobe", 0.55, 0.52, 0.48, "#e3a3a3", { at: [-0.78, 0.45, 0], wobble: 0.08, seed: 31 }),
    lump("right_upper_lobe", 0.55, 0.5, 0.48, "#e3a3a3", { at: [0.78, 0.42, 0], wobble: 0.08, seed: 37 }),
    // The heart sits against the left lung: an anatomical landmark students must recognise.
    partSphere("heart_position", 0.3, "#b8566a", { at: [-0.72, -0.2, 0.42], alpha: 0.55 }),
    partCylinder("trachea", 0.16, 0.16, 1.5, branch, { at: [0, 1.35, 0] }),
    // Cartilage rings make the windpipe recognisable instead of a plain tube.
    ...Array.from({ length: 7 }, (_, i) => partTorus(`tracheal_ring_${i + 1}`, 0.17, 0.026, "#d8cbb8", {
      at: [0, 0.7 + i * 0.21, 0], radialSegments: 18, tubularSegments: 10,
    })),
    partTube("left_bronchus", [[0, 0.72, 0], [-0.3, 0.5, 0.05], [-0.62, 0.15, 0]], 0.1, branch),
    partTube("right_bronchus", [[0, 0.72, 0], [0.3, 0.5, 0.05], [0.62, 0.15, 0]], 0.1, branch),
    // Bronchioles branching inside each lung — the conducting airway tree.
    ...[-1, 1].flatMap((side) => Array.from({ length: 3 }, (_, i) => partTube(
      `bronchiole_${side < 0 ? "l" : "r"}_${i + 1}`,
      [[side * 0.62, 0.15, 0], [side * (0.5 + i * 0.08), -0.1 - i * 0.12, 0.06], [side * (0.4 - i * 0.08), -0.3 - i * 0.2, 0.1]],
      0.04, "#d8cbb8", { radialSegments: 8 },
    ))),
    // Alveoli and an alveolar sac — the gas-exchange surface.
    ...Array.from({ length: 8 }, (_, i) => partSphere(`alveolus_${i + 1}`, 0.1, "#f6b9b9", {
      at: [-0.8 + (i % 4) * 0.16, -0.35 - Math.floor(i / 4) * 0.22, 0.42], segments: 12, heightSegments: 10,
    })),
    partSphere("alveolar_sac", 0.2, "#f2a8a8", { at: [0.8, -0.42, 0.42], segments: 16, heightSegments: 12 }),
    partTube("pulmonary_capillary", [[0.68, -0.52, 0.5], [0.86, -0.32, 0.5], [0.76, -0.16, 0.45], [0.9, -0.04, 0.42]], 0.03, "#4a6fa5", { radialSegments: 8 }),
    partPlane("diaphragm", 2.3, 1.5, "#c98a8a", { at: [0, -1.3, 0], rotate: [-90 * D, 0, 0], alpha: 0.85 }),
    partSphere("pleural_membrane", 0.74, "#f0c8c8", { at: [-0.78, -0.05, 0], alpha: 0.22, segments: 20, heightSegments: 14 }),
    partSphere("pleural_membrane_right", 0.74, "#f0c8c8", { at: [0.78, -0.05, 0], alpha: 0.22, segments: 20, heightSegments: 14 }),
  ];
}

// ========================================================== BIOLOGY: BRAIN
function brain() {
  const cortex = "#e0a3b4";
  const fold = "#cf8c9d";
  return [
    lump("left_hemisphere", 0.64, 0.6, 0.74, cortex, { at: [-0.34, 0.14, 0], wobble: 0.15, frequency: 3.6, seed: 41 }),
    lump("right_hemisphere", 0.64, 0.6, 0.74, cortex, { at: [0.34, 0.14, 0], wobble: 0.15, frequency: 3.2, seed: 43 }),
    // Gyri / sulci ridges so the cortex reads as FOLDED, not as a smooth blob.
    ...[-1, 1].flatMap((side) => Array.from({ length: 5 }, (_, i) => partTorus(`gyrus_${side < 0 ? "l" : "r"}_${i + 1}`, 0.2 - i * 0.02, 0.035, fold, {
      at: [side * 0.36, 0.42 - i * 0.16, -0.2 + i * 0.12], rotate: [40 * D, 0, 60 * D], radialSegments: 18, tubularSegments: 10,
    }))),
    partBox("longitudinal_fissure", 0.055, 0.44, 0.92, "#b8728a", { at: [0, 0.44, -0.05] }),
    partBox("corpus_callosum", 0.12, 0.4, 0.74, "#f0d3dc", { at: [0, 0.2, 0] }),
    lump("cerebellum", 0.48, 0.32, 0.42, "#c98a9c", { at: [0, -0.42, -0.64], wobble: 0.12, frequency: 4.4, seed: 47 }),
    // Cerebellar folia: the fine parallel ridges unique to the cerebellum.
    ...Array.from({ length: 6 }, (_, i) => partCylinder(`cerebellar_folium_${i + 1}`, 0.44 - i * 0.02, 0.44 - i * 0.02, 0.03, "#b8728a", {
      at: [0, -0.28 - i * 0.06, -0.62], rotate: [86 * D, 0, 0], segments: 24,
    })),
    partCylinder("brain_stem", 0.17, 0.2, 0.85, "#d59aa8", { at: [0, -0.55, -0.28], rotate: [24 * D, 0, 0] }),
    partCylinder("spinal_cord", 0.13, 0.16, 0.6, "#c98a9c", { at: [0, -1.02, -0.16], rotate: [24 * D, 0, 0] }),
    partSphere("frontal_lobe", 0.32, "#eec0cb", { at: [0, 0.26, 0.64] }),
    partSphere("parietal_lobe", 0.28, "#e8b3c2", { at: [0, 0.5, 0.02] }),
    partSphere("temporal_lobe", 0.24, "#d990a4", { at: [0.5, -0.1, 0.2] }),
    partSphere("temporal_lobe_left", 0.24, "#d990a4", { at: [-0.5, -0.1, 0.2] }),
    partSphere("occipital_lobe", 0.3, "#d990a4", { at: [0, 0.22, -0.74] }),
  ];
}

// ============================================================ BIOLOGY: CELL
// An animal cell as it is actually drawn in a textbook: a phospholipid membrane, cytoplasm, a
// membrane-bound nucleus with chromatin and a nucleolus, mitochondria with cristae, rough and smooth
// endoplasmic reticulum, a stacked Golgi, lysosomes, peroxisomes, a centriole pair, vesicles,
// ribosomes and the cytoskeleton — each an addressable part.
function cell() {
  const membrane = "#7fd4a8";
  const organelle = "#e08a5c";
  const cristae = "#c05f2f";
  const nucleusColor = "#8e6fd8";
  const mitochondria = [[-0.62, 0.3, 0.42, 40, 18], [0.66, -0.32, 0.3, -30, -25], [-0.1, -0.7, 0.42, 10, 40]];
  return [
    shellSphere("cell_membrane", 1.5, 0.07, membrane, { alpha: 0.4, roughness: 0.25 }),
    shellSphere("cytoplasm", 1.42, 0.03, "#cdeede", { alpha: 0.16, roughness: 0.2 }),
    // Nucleus: envelope, nucleoplasm, chromatin threads and the nucleolus.
    partSphere("nucleus", 0.52, nucleusColor, { at: [0, 0.06, 0], alpha: 0.55 }),
    partSphere("nucleoplasm", 0.46, "#7a5ac0", { at: [0, 0.06, 0] }),
    ...Array.from({ length: 5 }, (_, i) => partTorus(`chromatin_${i + 1}`, 0.2 - i * 0.03, 0.03, "#b8a0e8", {
      at: [0.02, 0.06, 0], rotate: [i * 33 * D, i * 47 * D, i * 21 * D], radialSegments: 20, tubularSegments: 10,
    })),
    partSphere("nucleolus", 0.2, "#4a2f90", { at: [0.08, 0.08, 0.06] }),
    ...Array.from({ length: 6 }, (_, i) => partSphere(`nuclear_pore_${i + 1}`, 0.05, "#e8dcff", {
      at: [Math.cos(i * 1.05) * 0.5, 0.06 + Math.sin(i * 1.6) * 0.3, Math.sin(i * 1.05) * 0.5], segments: 8, heightSegments: 6,
    })),
    // Mitochondria with cristae folds and a matrix.
    ...mitochondria.flatMap(([x, y, z, ry, rz], i) => [
      lump(`mitochondrion_${i + 1}`, 0.32, 0.15, 0.17, organelle, { at: [x, y, z], wobble: 0.05, seed: 53 + i * 6, rotate: [0, ry * D, rz * D] }),
      partTorus(`crista_${i + 1}a`, 0.12, 0.022, cristae, { at: [x, y, z], rotate: [0, (ry + 90) * D, rz * D], radialSegments: 16, tubularSegments: 8 }),
      partTorus(`crista_${i + 1}b`, 0.1, 0.02, cristae, { at: [x + 0.12, y, z], rotate: [0, (ry + 90) * D, rz * D], radialSegments: 16, tubularSegments: 8 }),
    ]),
    // Rough ER (studded) and smooth ER (tubular).
    partTorus("rough_endoplasmic_reticulum", 0.42, 0.05, "#f0c86a", { at: [0.5, 0.16, -0.12], rotate: [78 * D, 0, 0], radialSegments: 26, tubularSegments: 14 }),
    partTorus("rough_endoplasmic_reticulum_2", 0.5, 0.045, "#f0c86a", { at: [0.5, 0.06, -0.12], rotate: [78 * D, 0, 0], radialSegments: 26, tubularSegments: 14 }),
    partTube("smooth_endoplasmic_reticulum", [[0.7, -0.05, -0.35], [0.95, -0.2, -0.1], [0.8, -0.4, 0.15], [0.55, -0.5, 0.2]], 0.045, "#e0b050", { radialSegments: 8 }),
    // Golgi: a stack of flattened cisternae with vesicles budding off.
    ...Array.from({ length: 4 }, (_, i) => partTorus(`golgi_cisterna_${i + 1}`, 0.3 - i * 0.03, 0.055, "#f59fb0", {
      at: [-0.55, -0.42 + i * 0.06, -0.3], rotate: [30 * D, 40 * D, 0], radialSegments: 22, tubularSegments: 12,
    })),
    partSphere("golgi_vesicle_1", 0.07, "#f7c0cc", { at: [-0.8, -0.3, -0.1] }),
    partSphere("golgi_vesicle_2", 0.06, "#f7c0cc", { at: [-0.86, -0.5, -0.2] }),
    partSphere("lysosome", 0.2, "#9a5fd8", { at: [0.2, -0.75, -0.3], segments: 16, heightSegments: 12 }),
    partSphere("peroxisome", 0.15, "#5fd0c0", { at: [-0.9, 0.55, 0.1], segments: 16, heightSegments: 12 }),
    partSphere("vesicle", 0.11, "#a8e0c8", { at: [0.95, 0.4, 0.35], alpha: 0.85, segments: 16, heightSegments: 12 }),
    // Centriole pair: two perpendicular cylinders of nine microtubules.
    partCylinder("centriole_1", 0.1, 0.1, 0.26, "#d0d0e0", { at: [-0.3, 0.72, -0.4], rotate: [70 * D, 0, 0], segments: 16 }),
    partCylinder("centriole_2", 0.1, 0.1, 0.26, "#d0d0e0", { at: [-0.3, 0.72, -0.15], rotate: [70 * D, 0, 90 * D], segments: 16 }),
    // Cytoskeleton filaments anchoring the organelles.
    ...[[0.2, 0.9], [-0.9, -0.1], [0.6, 0.5], [-0.5, 0.8], [0.9, -0.6]].map((at, i) => partTube(`cytoskeleton_filament_${i + 1}`, [
      [at[0], at[1], 0.4], [at[0] * 0.5, at[1] * 0.5, 0.1], [-at[0] * 0.3, -at[1] * 0.1, -0.4],
    ], 0.022, "#9fdcbb", { radialSegments: 6 })),
    // Ribosomes.
    ...Array.from({ length: 14 }, (_, i) => partSphere(`ribosome_${i + 1}`, 0.045, "#9be0bd", {
      at: [Math.cos(i * 1.1) * 1.15, Math.sin(i * 0.9) * 0.85 + 0.1, Math.sin(i * 1.7) * 1.0], segments: 8, heightSegments: 6,
    })),
  ];
}

// ========================================================== BIOLOGY: DNA
// A real double helix: two sugar-phosphate backbones, base pairs that visibly join them, and the
// individual base/backbone chemistry as addressable parts (so "show me a base pair" works).
function dna() {
  const strandA = "#6aa9e9";
  const strandB = "#4a7fd9";
  const purine = "#5fd38d";
  const pyrimidine = "#e88f6a";
  const phosphate = "#f2d24a";
  const sugar = "#c9d8f0";
  const R = 0.62;          // helix radius
  const turns = 2.4;
  const height = 3.5;
  const rungs = 12;
  const parts = [
    partTube("backbone_1", helixPoints(turns, R, height, 26), 0.07, strandA),
    partTube("backbone_2", helixPoints(turns, R, height, 26, Math.PI), 0.07, strandB),
  ];

  for (let i = 0; i < rungs; i += 1) {
    const t = (i + 0.5) / rungs;
    const theta = t * turns * Math.PI * 2;
    const y = t * height - height / 2;
    const dx = Math.cos(theta);
    const dz = Math.sin(theta);
    // A cylinder is built along +Y; rotate it onto the rung direction (dx, 0, dz) with rotate = [90, 90-theta].
    const rot = [Math.PI / 2, Math.PI / 2 - theta, 0];
    parts.push(partCylinder(`purine_${i + 1}`, 0.062, 0.062, R, purine, { rotate: rot, at: [dx * R * 0.5, y, dz * R * 0.5], segments: 8 }));
    parts.push(partCylinder(`pyrimidine_${i + 1}`, 0.05, 0.05, R, pyrimidine, { rotate: rot, at: [-dx * R * 0.5, y, -dz * R * 0.5], segments: 8 }));
  }

  // Phosphate groups and deoxyribose sugars stud both backbones.
  for (let i = 0; i < 8; i += 1) {
    const t = (i + 0.5) / 8;
    const theta = t * turns * Math.PI * 2;
    const y = t * height - height / 2;
    parts.push(partSphere(`phosphate_${i + 1}`, 0.075, phosphate, { at: [Math.cos(theta) * R, y, Math.sin(theta) * R], segments: 10, heightSegments: 8 }));
    parts.push(partSphere(`deoxyribose_${i + 1}`, 0.085, sugar, { at: [Math.cos(theta + Math.PI) * R, y, Math.sin(theta + Math.PI) * R], segments: 10, heightSegments: 8 }));
  }
  return parts;
}

function barAlong(length) {
  // Unit bar along +X centred at origin.
  return rotTo(box(length, 0.07, 0.07, 0.04), [0, 0, 0], [Math.PI / 2, 0, 0]);
}

function rotTo(g, translate, rotate) {
  return transform(g, { translate, rotate });
}

function rotFromTo(a, b) {
  // Quaternion [x,y,z,w] rotating unit vector a onto unit vector b.
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (dot < -0.999999) return [0, 1, 0, 0];
  if (dot > 0.999999) return [0, 0, 0, 1];
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  return [c[0], c[1], c[2], 1 + dot];
}

function applyQuat(g, q, translate) {
  const [x, y, z, w] = q;
  const { box: b, cylinder: cyl, sphere: sph, transform: tf } = { box, cylinder, sphere, transform };
  const positions = g.positions ?? [];
  const indices = g.indices ?? [];
  void b; void cyl; void sph; void tf;
  // g is already a geom-like object with arrays; rotate positions/normals then translate.
  const rotateVec = (v) => {
    const ix = w * v[0] + y * v[2] - z * v[1];
    const iy = w * v[1] + z * v[0] - x * v[2];
    const iz = w * v[2] + x * v[1] - y * v[0];
    const iw = -x * v[0] - y * v[1] - z * v[2];
    return [
      ix * w + iw * -x + iy * -z - iz * -y,
      iy * w + iw * -y + iz * -x - ix * -z,
      iz * w + iw * -z + ix * -y - iy * -x,
    ];
  };
  const outPositions = [];
  for (let i = 0; i < positions.length; i += 3) {
    const rotated = rotateVec([positions[i], positions[i + 1], positions[i + 2]]);
    outPositions.push(rotated[0] + translate[0], rotated[1] + translate[1], rotated[2] + translate[2]);
  }
  const outNormals = [];
  for (let i = 0; i < (g.normals?.length ?? 0); i += 3) {
    const rotated = rotateVec([g.normals[i], g.normals[i + 1], g.normals[i + 2]]);
    outNormals.push(rotated[0], rotated[1], rotated[2]);
  }
  return { positions: outPositions, normals: outNormals, indices: indices.slice() };
}

// ======================================================= BIOLOGY: SKELETON
function skeleton() {
  const bone = "#ece5d4";
  const joint = "#d8cdb6";
  const parts = [
    partSphere("skull", 0.42, bone, { at: [0, 2.5, 0] }),
    partBox("jaw", 0.34, 0.16, 0.3, bone, { at: [0, 2.26, 0.06] }),
  ];
  // Spine: stacked vertebrae.
  for (let i = 0; i < 12; i += 1) {
    const y = 2.0 - i * 0.16;
    parts.push(partCylinder(`vertebra_${i + 1}`, 0.1 - i * 0.002, 0.11 - i * 0.002, 0.1, joint, { at: [0, y, -0.05 - i * 0.012] }));
  }
  // Rib cage: curved tubes from the spine around to the sternum.
  for (let i = 0; i < 8; i += 1) {
    const t = i / 7;
    const spread = 0.5 + t * 0.42;
    const y = 1.72 - t * 0.62;
    const drop = 0.42 + t * 0.3;
    for (const side of [-1, 1]) {
      parts.push(partTube(`rib_${side < 0 ? "l" : "r"}_${i + 1}`, [
        [side * 0.08, y, -0.2 - t * 0.1],
        [side * spread, y - drop * 0.45, -0.05],
        [side * spread * 0.85, y - drop, 0.16],
        [side * 0.06, y - drop * 0.9, 0.26],
      ], 0.045, bone, { radialSegments: 8 }));
    }
  }
  parts.push(partBox("sternum", 0.12, 0.72, 0.06, bone, { at: [0, 1.32, 0.28] }));
  parts.push(partBox("pelvis", 0.86, 0.34, 0.42, bone, { at: [0, 0.72, 0] }));
  // Limbs.
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "left" : "right";
    parts.push(partSphere(`${tag}_shoulder`, 0.16, joint, { at: [side * 0.5, 1.86, 0] }));
    parts.push(partCylinder(`${tag}_humerus`, 0.09, 0.09, 0.72, bone, { at: [side * 0.62, 1.44, 0.02], rotate: [0, 0, side * 6 * D] }));
    parts.push(partSphere(`${tag}_elbow`, 0.11, joint, { at: [side * 0.68, 1.06, 0.02] }));
    parts.push(partCylinder(`${tag}_radius`, 0.08, 0.08, 0.66, bone, { at: [side * 0.72, 0.72, 0.04], rotate: [0, 0, side * 3 * D] }));
    parts.push(partSphere(`${tag}_hip`, 0.17, joint, { at: [side * 0.28, 0.68, 0] }));
    parts.push(partCylinder(`${tag}_femur`, 0.11, 0.1, 0.86, bone, { at: [side * 0.26, 0.24, 0] }));
    parts.push(partSphere(`${tag}_knee`, 0.12, joint, { at: [side * 0.25, -0.18, 0.01] }));
    parts.push(partCylinder(`${tag}_tibia`, 0.09, 0.08, 0.82, bone, { at: [side * 0.25, -0.6, 0.02] }));
    parts.push(partBox(`${tag}_foot`, 0.14, 0.08, 0.3, bone, { at: [side * 0.25, -1.03, 0.08] }));
  }
  return parts;
}

// ==================================================== BIOLOGY: CIRCULATION
// A real red blood cell is a BICONCAVE DISC: thick at the rim, dimpled on both faces so it can fold
// through a capillary. Built as a lathe profile (r, y) so the silhouette is correct rather than a
// sphere with a doughnut.
function biconcaveDisc(radius, thickness, segments = 44) {
  const steps = 22;
  const half = (t) => {
    const rim = 0.3 + 0.7 * Math.pow(t, 0.55);          // thickest at the rim
    const dent = 0.5 * Math.max(0, Math.cos(Math.PI * t)); // deep dimple at the centre
    return Math.max(thickness * (rim - dent), thickness * 0.08);
  };
  const profile = [];
  for (let i = 0; i <= steps; i += 1) profile.push([radius * (i / steps), half(i / steps)]);
  for (let i = steps; i >= 0; i -= 1) profile.push([radius * (i / steps), -half(i / steps)]);
  return lathe(profile, segments);
}

function bloodCell() {
  return [
    { name: "red_blood_cell", geom: biconcaveDisc(0.66, 0.44), material: solid("#d64545", { roughness: 0.56 }) },
    // The haemoglobin-rich rim and the pale central pallor that makes the shape recognisable.
    { name: "haemoglobin_region", geom: transform(biconcaveDisc(0.4, 0.3), { translate: [0, 0.06, 0] }), material: solid("#a81f1f", { roughness: 0.6 }) },
    partSphere("central_pallor", 0.17, "#f2b0b0", { at: [0, 0.2, 0], alpha: 0.75, segments: 16, heightSegments: 12 }),
    // A rouleau: the way red cells stack face-to-face inside a vessel.
    { name: "rouleau_disc_1", geom: transform(biconcaveDisc(0.52, 0.36), { translate: [1.55, 0, 0] }), material: solid("#c93a3a", { roughness: 0.6 }) },
    { name: "rouleau_disc_2", geom: transform(biconcaveDisc(0.52, 0.36), { translate: [2.55, 0, 0] }), material: solid("#bf3232", { roughness: 0.6 }) },
    { name: "rouleau_disc_3", geom: transform(biconcaveDisc(0.52, 0.36), { translate: [3.55, 0, 0] }), material: solid("#b52f2f", { roughness: 0.6 }) },
  ];
}

function whiteBloodCell() {
  return [
    partSphere("cell_membrane", 0.5, "#f2e2c8", { alpha: 0.85 }),
    partSphere("nucleus", 0.3, "#8e6fd8", { segments: 26, heightSegments: 18 }),
    ...Array.from({ length: 7 }, (_, i) => partSphere(`granule_${i + 1}`, 0.05, "#c9a86a", {
      at: [Math.cos(i * 0.9) * 0.38, Math.sin(i * 1.2) * 0.3, Math.sin(i * 0.7) * 0.3], segments: 10, heightSegments: 8,
    })),
    partTorus("lobed_nucleus_lobe_1", 0.2, 0.12, "#7a5ac0", { at: [0.22, -0.12, 0.1], rotate: [40 * D, 0, 0], radialSegments: 20, tubularSegments: 14 }),
    partTorus("lobed_nucleus_lobe_2", 0.18, 0.11, "#7a5ac0", { at: [-0.2, 0.14, -0.12], rotate: [30 * D, 40 * D, 0], radialSegments: 20, tubularSegments: 14 }),
    ...Array.from({ length: 3 }, (_, i) => partSphere(`pseudopod_${i + 1}`, 0.15, "#f6ecd8", {
      at: [Math.cos(i * 2.1 + 0.6) * 0.5, 0.1 + Math.sin(i * 1.3) * 0.3, Math.sin(i * 2.1 + 0.6) * 0.5],
    })),
  ];
}

// An artery shown as a longitudinal cut-away: each concentric wall layer is its own named part, so the
// teacher can isolate the endothelium, the muscular media or the lumen, and show a narrowing plaque.
function bloodVessel() {
  const adventitia = "#9c4a4a";
  const muscle = "#c05a5a";
  const elastic = "#e0a0a0";
  const endothelium = "#f2c8c8";
  const lumen = "#8e2b2b";
  return [
    partCylinder("adventitia", 0.66, 0.66, 2.7, adventitia, { rotate: [0, 0, 90 * D], segments: 34 }),
    partCylinder("smooth_muscle_layer", 0.54, 0.54, 2.7, muscle, { rotate: [0, 0, 90 * D], segments: 32 }),
    partCylinder("elastic_layer", 0.44, 0.44, 2.7, elastic, { rotate: [0, 0, 90 * D], segments: 30 }),
    partCylinder("endothelium", 0.38, 0.38, 2.7, endothelium, { rotate: [0, 0, 90 * D], segments: 28 }),
    partCylinder("lumen", 0.33, 0.33, 2.72, lumen, { rotate: [0, 0, 90 * D], segments: 26 }),
    // Blood travelling through the lumen.
    ...Array.from({ length: 4 }, (_, i) => partSphere(`erythrocyte_${i + 1}`, 0.12, "#d64545", { at: [-0.9 + i * 0.6, 0, 0] })),
    // A branch vessel, and an atherosclerotic plaque narrowing the lumen.
    partCylinder("branch_vessel", 0.24, 0.24, 1.0, "#b5514f", { at: [1.0, 0.55, 0], rotate: [90 * D, 0, 0], segments: 22 }),
    partSphere("plaque", 0.16, "#f0e0a0", { at: [-0.55, 0.3, 0], alpha: 0.95 }),
    partCylinder("vasa_vasorum", 0.05, 0.05, 1.6, "#7f2f2f", { at: [0.6, -0.55, 0], rotate: [0, 0, 90 * D], segments: 10 }),
  ];
}

// ============================================== BIOLOGY: DIGESTIVE SYSTEM
function digestiveSystem() {
  const gut = "#e0a878";
  return [
    partTube("esophagus", [[0, 1.5, 0], [0.05, 1.0, 0.05], [0, 0.55, 0]], 0.11, "#e8b98f"),
    lump("stomach", 0.55, 0.44, 0.42, "#e88f7a", { at: [0.05, 0.28, 0], wobble: 0.12, seed: 61 }),
    partTube("duodenum", [[0.3, 0.05, 0], [0.7, -0.15, 0.15], [0.5, -0.45, 0.1]], 0.13, gut),
    // Small intestine: a coiled tube.
    partTube("small_intestine", [
      ...Array.from({ length: 13 }, (_, i) => {
        const t = i / 12;
        const a = t * Math.PI * 5;
        return [0.35 + Math.cos(a) * 0.32, -0.7 - t * 0.55, Math.sin(a) * 0.28];
      }),
    ], 0.13, gut, { radialSegments: 14 }),
    partTube("large_intestine", [
      [-0.05, 0.25, 0.42], [-0.45, -0.2, 0.42], [-0.5, -1.0, 0.4], [-0.2, -1.5, 0.36],
      [0.2, -1.55, 0.34], [0.45, -1.2, 0.32], [0.42, -0.7, 0.3],
    ], 0.16, "#d99560", { radialSegments: 14 }),
    partTorus("sigmoid_colon", 0.28, 0.15, "#d99560", { at: [0.3, -1.72, 0.3], rotate: [90 * D, 0, 0] }),
    lump("liver", 0.62, 0.34, 0.44, "#a0524b", { at: [0.35, 1.05, 0.05], wobble: 0.1, seed: 67 }),
    lump("pancreas", 0.45, 0.14, 0.16, "#e8c06a", { at: [0.05, 0.05, -0.4], wobble: 0.06, seed: 71, rotate: [0, 20 * D, 0] }),
  ];
}

// =========================================================== BIOLOGY: PLANT
function leaf() {
  const green = "#4f9e4a";
  return [
    // Leaf blade built from two mirrored halves so it has a real midrib and curl.
    {
      name: "leaf_blade",
      geom: transform(leafBlade(1.5, 0.72), { rotate: [0, 0, 0] }),
      material: solid(green, { roughness: 0.72 }),
    },
    partCylinder("petiole", 0.05, 0.06, 0.7, "#6aa84f", { at: [0, -0.55, 0] }),
    partTube("midrib", [[0, -0.2, 0], [0, 0.1, 0.02], [0, 0.42, 0.03]], 0.022, "#8fd07a"),
    ...[-1, 1].flatMap((side) => [-0.28, -0.05, 0.18, 0.38].map((y, i) => partTube(`vein_${side < 0 ? "l" : "r"}_${i + 1}`, [
      [0, y, 0.01], [side * 0.16, y + 0.09, 0.005], [side * 0.32, y + 0.16, 0],
    ], 0.012, "#9fdc88", { radialSegments: 6 }))),
    partSphere("chloroplast_1", 0.07, "#7ed957", { at: [-0.18, 0.05, 0.05] }),
    partSphere("chloroplast_2", 0.07, "#7ed957", { at: [0.2, -0.1, 0.04] }),
    partSphere("chloroplast_3", 0.07, "#7ed957", { at: [0.02, 0.26, 0.05] }),
  ];
}

function leafBlade(length, width) {
  const segments = 20;
  const g = { positions: [], normals: [], indices: [] };
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const y = -0.2 + t * length;
    const halfWidth = width * Math.sin(Math.PI * Math.pow(t, 0.75)) * (1 - t * 0.15);
    const cup = 0.12 * Math.cos((t - 0.5) * Math.PI) * halfWidth;
    for (const side of [-1, 0, 1]) {
      g.positions.push(side * halfWidth, y, cup);
      g.normals.push(0, 0, 1);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 3;
    g.indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
  }
  return recomputeNormals(g);
}

function plantCell() {
  return [
    // Rigid rectangular wall + membrane + organelles (a plant cell differs from an animal cell).
    partBox("cell_wall", 2.3, 2.3, 2.3, "#8fbf6a", { alpha: 0.55, roughness: 0.85 }),
    partBox("cell_membrane", 2.15, 2.15, 2.15, "#cdeede", { alpha: 0.2, roughness: 0.3 }),
    partSphere("nucleus", 0.4, "#8e6fd8", { at: [-0.35, 0.15, 0.1] }),
    // Chloroplasts with grana stacks.
    ...[[0.55, 0.35, 0.3], [0.6, -0.45, -0.35], [-0.1, 0.75, -0.5]].flatMap((at, i) => [
      partSphere(`chloroplast_${i + 1}`, 0.3, "#6fbf52", { at, alpha: 0.95 }),
      partCylinder(`grana_${i + 1}a`, 0.16, 0.16, 0.06, "#3f8f3a", { at: [at[0], at[1] + 0.1, at[2]] }),
      partCylinder(`grana_${i + 1}b`, 0.16, 0.16, 0.06, "#3f8f3a", { at: [at[0], at[1] - 0.1, at[2]] }),
    ]),
    partSphere("vacuole", 0.55, "#9fd8f5", { at: [0.25, -0.35, 0.45], alpha: 0.55 }),
    partBox("cell_wall_nucleus", 0.1, 0.1, 0.1, "#8fbf6a", { at: [0, 0, 0] }),
  ].filter((p) => p.name !== "cell_wall_nucleus");
}

function neuron() {
  return [
    partSphere("cell_body", 0.42, "#f0c98a", { at: [0, 0, 0] }),
    partSphere("nucleus", 0.2, "#8e6fd8", { at: [0, 0, 0] }),
    partTube("axon", [[0, 0, 0], [0, 0.1, 1.1], [0.05, 0.2, 2.2]], 0.07, "#f0c98a", { radialSegments: 10 }),
    ...[0.5, 1.0, 1.5, 2.0].map((z, i) => partSphere(`myelin_sheath_${i + 1}`, 0.16, "#a8d8f0", { at: [0, 0.05 + z * 0.045, z] })),
    ...[-1, 1].map((side) => partTube(`dendrite_${side < 0 ? "a" : "b"}`, [
      [side * 0.15, 0, 0], [side * 0.5, 0.12, -0.15], [side * 0.8, 0.05, -0.4],
    ], 0.05, "#f0c98a", { radialSegments: 8 })),
    partTube("axon_terminal", [[0.05, 0.2, 2.2], [0.2, 0.3, 2.5], [-0.1, 0.35, 2.7]], 0.05, "#f0c98a", { radialSegments: 8 }),
    partSphere("synapse", 0.1, "#8ef0a0", { at: [-0.1, 0.35, 2.75] }),
  ];
}

function muscle() {
  const fibers = "#c25b6e";
  return [
    partCylinder("muscle_belly", 0.5, 0.42, 2.0, fibers, { rotate: [0, 0, 90 * D] }),
    ...Array.from({ length: 6 }, (_, i) => partTorus(`fascicle_${i + 1}`, 0.52 - i * 0.06, 0.045, "#a8455a", { at: [-0.8 + i * 0.32, 0, 0], rotate: [0, 90 * D, 0] })),
    partCylinder("tendon_start", 0.1, 0.12, 0.7, "#efe6d2", { at: [-1.35, 0, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("tendon_end", 0.1, 0.12, 0.7, "#efe6d2", { at: [1.35, 0, 0], rotate: [0, 0, 90 * D] }),
  ];
}

function kidney() {
  return [
    lump("kidney", 0.62, 0.85, 0.55, "#b5563f", { at: [0, 0, 0], wobble: 0.08, seed: 73 }),
    partLathe("renal_pelvis", [[0, 0.55], [0.16, 0.4], [0.2, 0.1], [0.14, -0.2], [0, -0.35]], "#e0c07a", { at: [-0.05, 0.05, 0.5] }),
    partCylinder("ureter", 0.09, 0.09, 1.5, "#e0c07a", { at: [-0.1, -1.0, 0.42] }),
    ...[[0.3, 0.5], [-0.1, 0.55], [0.25, -0.2], [-0.3, -0.1]].flatMap((at, i) => [
      partCylinder(`renal_artery_${i + 1}`, 0.06, 0.06, 0.7, "#c0392b", { at: [at[0] * 0.5, at[1] * 0.5, -0.7], rotate: [90 * D, 0, 0] }),
    ]),
    partCylinder("renal_vein", 0.07, 0.07, 0.7, "#4a6fa5", { at: [0.1, 0.1, -0.7], rotate: [90 * D, 0, 0] }),
  ];
}

function skin() {
  return [
    partBox("epidermis", 2.4, 0.16, 1.8, "#f2d9c0", { at: [0, 0.5, 0] }),
    partBox("dermis", 2.4, 0.5, 1.8, "#e8b896", { at: [0, 0.15, 0] }),
    partBox("hypodermis", 2.4, 0.6, 1.8, "#f0dcc0", { at: [0, -0.2, 0], alpha: 0.7 }),
    partCylinder("hair_shaft", 0.035, 0.045, 1.1, "#5a4632", { at: [-0.6, 1.0, 0.2], rotate: [0, 0, 12 * D] }),
    partSphere("sebaceous_gland", 0.13, "#e8c07a", { at: [-0.55, 0.62, 0.2] }),
    partSphere("sweat_gland", 0.1, "#a8d8f0", { at: [0.4, 0.5, -0.3] }),
    partTorus("sweat_duct", 0.07, 0.025, "#a8d8f0", { at: [0.4, 0.75, -0.3], rotate: [Math.PI / 2, 0, 0] }),
    partSphere("receptor_1", 0.09, "#8ed8f0", { at: [-0.1, 0.3, 0.5] }),
    partSphere("receptor_2", 0.09, "#f0a0c8", { at: [0.2, 0.3, 0.55] }),
  ];
}

function flower() {
  return [
    partCylinder("stem", 0.07, 0.09, 2.2, "#4f9e4a", { at: [0, -1.1, 0] }),
    partCylinder("receptacle", 0.28, 0.2, 0.3, "#4f8f3a", { at: [0, 0.1, 0] }),
    ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return {
        name: `petal_${i + 1}`,
        geom: transform(ellipsoidLike(0.55, 0.1, 0.28), { rotate: [0, -a, 26 * D], translate: [Math.cos(a) * 0.5, 0.28, Math.sin(a) * 0.5] }),
        material: solid("#f28fb0", { roughness: 0.7 }),
      };
    }),
    ...Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return partSphere(`stamen_${i + 1}`, 0.06, "#f2d24a", { at: [Math.cos(a) * 0.2, 0.4, Math.sin(a) * 0.2] });
    }),
    partSphere("pistil", 0.1, "#8ed86a", { at: [0, 0.42, 0] }),
  ];
}

function ellipsoidLike(rx, ry, rz) {
  // Thin petal shape.
  const segments = 14;
  const g = { positions: [], normals: [], indices: [] };
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const w = rz * Math.sin(Math.PI * t);
    const x = (t - 0.5) * 2 * rx;
    g.positions.push(x, 0, 0, x, w, 0, x, 0, -w);
    g.normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < segments; i += 1) {
    const a = i * 3;
    g.indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a + 1, a + 4, a + 2, a + 2, a + 4, a + 5);
  }
  return recomputeNormals(g);
}

function chloroplast() {
  return [
    partSphere("chloroplast", 0.5, "#6fbf52", { alpha: 0.95 }),
    partCylinder("granum_1a", 0.3, 0.3, 0.08, "#3f8f3a", { at: [0, 0.12, 0] }),
    partCylinder("granum_1b", 0.3, 0.3, 0.08, "#3f8f3a", { at: [0, 0.0, 0] }),
    partCylinder("granum_2a", 0.26, 0.26, 0.08, "#3f8f3a", { at: [0.05, -0.14, 0.04], rotate: [0, 0, 40 * D] }),
    partCylinder("granum_2b", 0.22, 0.22, 0.08, "#3f8f3a", { at: [0.05, -0.26, 0.04], rotate: [0, 0, 40 * D] }),
    partTorus("thylakoid", 0.42, 0.04, "#8fd07a", { at: [0, -0.05, 0] }),
  ];
}

function enzyme() {
  return [
    // A cleft-shaped protein: two lobes with an active site between them.
    lump("protein_backbone", 0.7, 0.6, 0.5, "#6ab7e0", { at: [0, 0.2, 0], wobble: 0.16, frequency: 3.2, seed: 79 }),
    lump("active_site_lobe", 0.34, 0.3, 0.3, "#8ed0f0", { at: [-0.4, -0.2, 0.2], wobble: 0.1, seed: 83 }),
    lump("substrate_binding", 0.3, 0.28, 0.28, "#4f9ec0", { at: [0.4, -0.2, -0.2], wobble: 0.1, seed: 89 }),
    partSphere("substrate", 0.22, "#f2a04a", { at: [0, -0.28, 0], alpha: 0.95 }),
    partSphere("active_site", 0.14, "#f7e08a", { at: [0, -0.28, 0] }),
  ];
}

export const BIOLOGY_MODELS = {
  "biology/heart": heart,
  "biology/lungs": lungs,
  "biology/brain": brain,
  "biology/cell": cell,
  "biology/dna": dna,
  "biology/skeleton": skeleton,
  "biology/blood-cell": bloodCell,
  "biology/white-blood-cell": whiteBloodCell,
  "biology/blood-vessel": bloodVessel,
  "biology/digestive-system": digestiveSystem,
  "biology/leaf": leaf,
  "biology/plant-cell": plantCell,
  "biology/neuron": neuron,
  "biology/muscle": muscle,
  "biology/kidney": kidney,
  "biology/skin": skin,
  "biology/flower": flower,
  "biology/chloroplast": chloroplast,
  "biology/enzyme": enzyme,
};