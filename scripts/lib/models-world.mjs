// PHYSICS + CHEMISTRY model catalogue: apparatus, mechanisms, molecules, atomic structure.
// Same conventions as models-biology.mjs: named parts become semantic anchors.
import {
  partBox, partCylinder, partSphere, partTorus, partTube, partCone, partWedge, partLathe,
  partPlane, partArrow, circlePath, wavePoints, helixPoints, lump, shellSphere, solid, arrowGeom,
} from "./shapes.mjs";
import {
  box, cylinder, sphere, torus, tube, transform, merge, ellipsoid, lathe, roundedBox, recomputeNormals,
} from "../glb.mjs";

const D = Math.PI / 180;

// ================================================================ PHYSICS
function pulley() {
  const metal = "#b9c3cc";
  const wheel = "#8fa0ad";
  return [
    partBox("support_frame", 0.12, 2.4, 0.12, metal, { at: [-0.9, 0.2, 0] }),
    partBox("support_crossbar", 2.0, 0.12, 0.12, metal, { at: [0, 1.3, 0] }),
    partTorus("pulley_wheel", 0.45, 0.11, wheel, { at: [0, 1.05, 0], rotate: [0, 90 * D, 0] }),
    partCylinder("pulley_axle", 0.07, 0.07, 0.5, metal, { at: [0, 1.05, 0], rotate: [90 * D, 0, 0] }),
    partBox("pulley_mount", 0.3, 0.16, 0.3, metal, { at: [0, 1.42, 0] }),
    partCylinder("rope", 0.035, 0.035, 1.05, "#e0d0a0", { at: [-0.45, 0.5, 0] }),
    partCylinder("rope_2", 0.035, 0.035, 1.0, "#e0d0a0", { at: [0.45, 0.55, 0] }),
    partBox("load", 0.5, 0.5, 0.5, "#6f7f8c", { at: [-0.45, -0.25, 0] }),
    partBox("effort_applied", 0.34, 0.34, 0.34, "#d0a24a", { at: [0.45, -0.15, 0] }),
    partArrow("load_force", 0.55, "#ff6b6b", { at: [-0.45, -0.5, 0], rotate: [0, 0, 180 * D] }),
  ];
}

function pendulum() {
  const metal = "#c0cad2";
  return [
    partBox("pendulum_stand_base", 1.1, 0.14, 0.6, metal, { at: [0, -1.5, 0] }),
    partCylinder("pendulum_pole", 0.06, 0.07, 3.0, metal, { at: [0, 0, 0] }),
    partBox("pendulum_pivot", 0.26, 0.18, 0.2, "#8fa0ad", { at: [0, 1.5, 0] }),
    partCylinder("pendulum_string", 0.014, 0.014, 2.4, "#d8d0c0", { at: [0, 0.3, 0] }),
    partSphere("pendulum_bob", 0.3, "#d4a03c", { at: [0, -0.95, 0] }),
    partSphere("pivot_point", 0.08, "#ff6b6b", { at: [0, 1.5, 0] }),
    partArrow("tension_force", 0.6, "#4a9ee8", { at: [0, -0.6, 0], rotate: [0, 0, 180 * D] }),
    partArrow("gravity_force", 0.6, "#ff6b6b", { at: [0, -1.1, 0], rotate: [0, 0, 180 * D] }),
    { name: "swing_arc", geom: tube(arcPath(0, 1.5, 2.5, -60 * D, 60 * D, 40), 0.02, 8, true), material: solid("#4a9ee8", { alpha: 0.6 }) },
  ];
}

function arcPath(cx, cy, radius, from, to, segments) {
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = from + (to - from) * (i / segments);
    return [cx + Math.sin(a) * radius, cy - Math.cos(a) * radius, 0];
  });
}

function inclinedPlane() {
  return [
    partWedge("inclined_plane", 2.2, 1.1, 1.4, "#c9b28a", { at: [0, -0.55, 0] }),
    partBox("plane_base", 2.4, 0.1, 1.6, "#8a7a5a", { at: [0, -1.1, 0] }),
    partBox("block", 0.5, 0.5, 0.5, "#e06b6b", { at: [-0.55, -0.35, 0], rotate: [0, 0, -26 * D] }),
    partArrow("gravity_force", 0.8, "#ff6b6b", { at: [-0.35, 0.6, 0.75], rotate: [0, 0, 180 * D] }),
    partArrow("normal_force", 0.6, "#4a9ee8", { at: [-0.35, 0.1, 0.75], rotate: [-90 * D, 0, 0] }),
    partArrow("friction_force", 0.6, "#f2a04a", { at: [-0.55, -0.1, 0.8], rotate: [0, 0, 90 * D] }),
    { name: "plane_surface", geom: tube([...Array.from({ length: 21 }, (_, i) => {
      const t = i / 20;
      return [-1.1 + t * 2.2, -0.55 + t * 1.1 + 0.01, 0];
    })], 0.03, 8, true), material: solid("#8a7a5a") },
  ];
}

function spring() {
  return [
    { name: "spring_coil", geom: tube(helixPoints(6, 0.35, 2.4, 22), 0.06, 10, true), material: solid("#c0cad2") },
    partBox("spring_top_plate", 0.7, 0.12, 0.7, "#8fa0ad", { at: [0, 1.25, 0] }),
    partBox("spring_bottom_plate", 0.7, 0.12, 0.7, "#8fa0ad", { at: [0, -1.25, 0] }),
    partArrow("spring_force", 0.7, "#4a9ee8", { at: [0.5, -0.3, 0], rotate: [0, 0, -90 * D] }),
  ];
}

function lens() {
  const glass = "#a8d8f0";
  return [
    partLathe("lens_glass", [
      [0, 0.55], [0.22, 0.48], [0.38, 0.3], [0.44, 0.05], [0.38, -0.2], [0.22, -0.38], [0, -0.45],
    ], glass, { alpha: 0.6, roughness: 0.08 }),
    partBox("lens_rim", 0.98, 1.2, 0.12, "#8fa0ad", { at: [0, 0, -0.02] }),
    partBox("lens_stand", 0.9, 0.12, 0.5, metal(), { at: [0, -0.68, 0] }),
    partCylinder("lens_post", 0.05, 0.05, 0.3, metal(), { at: [0, -0.5, 0] }),
    // Optical axis, focal point markers and a ray bundle.
    { name: "optical_axis", geom: tube([[-2.2, 0, 0], [2.2, 0, 0]], 0.015, 6, false), material: solid("#7f8fa0", { alpha: 0.8 }) },
    partSphere("focal_point", 0.07, "#ff6b6b", { at: [1.5, 0, 0] }),
    { name: "incident_ray", geom: tube([[-2.0, -0.75, 0.35], [-0.5, 0, 0.35]], 0.02, 6, false), material: solid("#f2d24a", { emissive: "#f2d24a" }) },
    { name: "refracted_ray", geom: tube([[-0.5, 0, 0.35], [1.5, 0, 0.35]], 0.02, 6, false), material: solid("#4ae07a", { emissive: "#4ae07a" }) },
  ];
}

function metal() {
  return solid("#b9c3cc");
}

function circuitBoard() {
  const board = "#1f6f4a";
  const copper = "#c9922f";
  return [
    partBox("pcb_board", 2.6, 0.08, 1.8, board, { at: [0, -0.04, 0] }),
    partBox("battery", 0.5, 0.34, 0.2, "#2f4f7f", { at: [-0.9, 0.2, 0.4] }),
    partCylinder("battery_positive", 0.05, 0.05, 0.12, "#d0d0d0", { at: [-0.68, 0.28, 0.4] }),
    partCylinder("battery_negative", 0.05, 0.05, 0.12, "#303030", { at: [-1.12, 0.28, 0.4] }),
    partCylinder("resistor", 0.08, 0.08, 0.5, "#d8c8a0", { at: [-0.1, 0.16, 0.4], rotate: [0, 0, 90 * D] }),
    partSphere("led", 0.14, "#ff5555", { at: [0.6, 0.2, 0.4], emissive: "#ff3333", emissiveIntensity: 0.9 }),
    partBox("switch_contact", 0.4, 0.08, 0.1, copper, { at: [0.6, 0.14, -0.35] }),
    partCylinder("switch_pivot", 0.05, 0.05, 0.16, copper, { at: [0.42, 0.16, -0.35] }),
    ...[
      [[-0.68, 0.1, 0.4], [-0.1, 0.1, 0.4]],
      [[0.68, 0.1, 0.4], [1.1, 0.1, 0.4]],
      [[1.1, 0.06, 0.4], [1.1, 0.06, -0.35]],
      [[1.1, 0.06, -0.35], [0.6, 0.06, -0.35]],
      [[0.6, 0.06, -0.35], [-0.3, 0.06, -0.35]],
      [[-0.3, 0.06, -0.35], [-0.3, 0.06, 0.4]],
    ].map((points, i) => ({ name: `wire_${i + 1}`, geom: tube(points, 0.03, 8, true), material: solid(copper) })),
    partSphere("current_node", 0.06, "#ffe08a", { at: [1.1, 0.06, 0.4], emissive: "#ffdd66" }),
  ];
}

function projectileLauncher() {
  return [
    partCylinder("launcher_barrel", 0.14, 0.2, 1.8, "#7f8fa0", { at: [0, 0.9, 0], rotate: [0, 0, 70 * D] }),
    partBox("launcher_base", 0.9, 0.16, 0.7, "#5f6f7f", { at: [0, -0.08, 0] }),
    partBox("launcher_support", 0.14, 1.0, 0.14, "#5f6f7f", { at: [0.4, 0.42, 0], rotate: [0, 0, -20 * D] }),
    partSphere("projectile", 0.16, "#e05f5f", { at: [-0.75, 0.16, 0] }),
    partArrow("launch_velocity", 0.8, "#4a9ee8", { at: [-0.55, 0.7, 0], rotate: [0, 0, 70 * D] }),
    partArrow("gravity_force", 0.6, "#ff6b6b", { at: [-0.75, -0.4, 0], rotate: [0, 0, 180 * D] }),
  ];
}

function waveTank() {
  return [
    partBox("tank_frame", 3.0, 0.14, 1.6, "#5f6f7f", { at: [0, -0.6, 0] }),
    partBox("tank_base", 3.0, 0.1, 1.6, "#8fa0ad", { at: [0, -0.52, 0] }),
    ...[-1, 1].map((side) => partBox(`tank_wall_${side < 0 ? "l" : "r"}`, 3.0, 0.9, 0.08, "#a8d8f0", { at: [0, -0.15, side * 0.8], alpha: 0.4 })),
    ...[-1, 1].map((side) => partBox(`tank_end_${side < 0 ? "l" : "r"}`, 0.08, 0.9, 1.6, "#a8d8f0", { at: [side * 1.46, -0.15, 0], alpha: 0.4 })),
    { name: "water_surface", geom: waterSurface(2.7, 1.4, 0.06, 2, 40, 24), material: solid("#4aa3d8", { alpha: 0.75, roughness: 0.15 }) },
    partSphere("wave_crest_marker", 0.08, "#f2d24a", { at: [0.6, 0.02, 0] }),
    partSphere("wave_trough_marker", 0.08, "#f27a4a", { at: [-0.6, -0.14, 0] }),
    partArrow("wavelength_span", 1.4, "#ffffff", { at: [0, 0.16, 0.6], rotate: [0, 0, -90 * D] }),
  ];
}

function waterSurface(width, depth, amplitude, cycles, sx, sz) {
  const g = { positions: [], normals: [], indices: [] };
  for (let j = 0; j <= sz; j += 1) {
    for (let i = 0; i <= sx; i += 1) {
      const u = i / sx;
      const v = j / sz;
      const x = (u - 0.5) * width;
      const z = (v - 0.5) * depth;
      const taper = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);
      const y = Math.sin(u * Math.PI * 2 * cycles) * amplitude * taper;
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
  return recomputeNormals(g);
}

// A reusable spur gear: a disc PLUS tapered teeth merged into one solid, so a second meshing gear can
// be built from the same geometry and the mechanism reads correctly.
function gearGeometry(radius, toothCount, thickness) {
  const parts = [transform(cylinder(radius, radius, thickness, 40, true), { rotate: [90 * D, 0, 0] })];
  for (let i = 0; i < toothCount; i += 1) {
    const a = (i / toothCount) * Math.PI * 2;
    const tooth = transform(
      merge([
        box(radius * 0.34, radius * 0.22, thickness),
        transform(box(radius * 0.2, radius * 0.2, thickness), { translate: [0, radius * 0.2, 0] }),
      ]),
      { rotate: [0, 0, a], translate: [-Math.sin(a) * radius, Math.cos(a) * radius, 0] },
    );
    parts.push(tooth);
  }
  return merge(parts);
}

function gear() {
  const body = "#9aa8b4";
  const dark = "#5f6f7f";
  const spokes = [];
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    spokes.push(transform(box(0.09, 0.44, 0.15), { rotate: [0, 0, a], translate: [-Math.sin(a) * 0.3, Math.cos(a) * 0.3, 0] }));
  }
  return [
    partCylinder("gear_rim", 0.68, 0.68, 0.19, body, { rotate: [90 * D, 0, 0], segments: 44 }),
    partCylinder("gear_body", 0.58, 0.58, 0.17, "#8fa0ad", { rotate: [90 * D, 0, 0], segments: 40 }),
    { name: "gear_spokes", geom: merge(spokes), material: solid(dark, { metallic: 0.4, roughness: 0.4 }) },
    partCylinder("gear_hub", 0.18, 0.18, 0.28, dark, { rotate: [90 * D, 0, 0], segments: 26 }),
    partBox("keyway", 0.06, 0.1, 0.3, "#3f4a55", { at: [0, 0.17, 0] }),
    { name: "gear_teeth", geom: gearGeometry(0.7, 18, 0.18), material: solid(body, { metallic: 0.35, roughness: 0.4 }) },
    partTorus("pitch_circle", 0.7, 0.012, "#f2d24a", { rotate: [90 * D, 0, 0], alpha: 0.85, radialSegments: 44, tubularSegments: 8 }),
    { name: "driven_gear", geom: transform(gearGeometry(0.5, 13, 0.16), { translate: [-1.14, 0.62, 0.02] }), material: solid("#8494a2", { metallic: 0.35, roughness: 0.42 }) },
    partCylinder("driven_gear_shaft", 0.12, 0.12, 0.4, dark, { at: [-1.14, 0.62, 0], rotate: [90 * D, 0, 0], segments: 20 }),
    partArrow("rotation_direction", 0.6, "#4aa3d8", { at: [-1.14, 1.35, 0.2], rotate: [0, 0, -110 * D] }),
  ];
}

function barMagnet() {
  return [
    partBox("magnet_north", 0.4, 0.4, 1.1, "#d64545", { at: [0, 0, -0.3] }),
    partBox("magnet_south", 0.4, 0.4, 1.1, "#4a6fa5", { at: [0, 0, 0.3] }),
    ...Array.from({ length: 5 }, (_, i) => {
      const z = -0.9 - i * 0.32;
      return {
        name: `field_line_${i + 1}`,
        geom: tube([[0.25, 0, -0.8], [0.95 + i * 0.06, 0.5, -1.3 - i * 0.15], [0.6, 0, -2.1 - i * 0.3]], 0.018, 6, false),
        material: solid("#8ec8f0", { alpha: 0.6, emissive: "#4a9ee8", emissiveIntensity: 0.3 }),
      };
    }),
    partArrow("field_direction_north", 0.7, "#d64545", { at: [0.2, 0.1, -1.0], rotate: [0, 0, -60 * D] }),
    partArrow("field_direction_south", 0.7, "#4a6fa5", { at: [0.2, 0.1, 1.0], rotate: [0, 0, -120 * D] }),
  ];
}

function lever() {
  return [
    partBox("lever_bar", 2.6, 0.1, 0.16, "#c9a86a", { at: [0, 0, 0] }),
    partBox("lever_pivot", 0.3, 0.3, 0.3, "#7f8fa0", { at: [0, -0.24, 0] }),
    partBox("fulcrum", 0.9, 0.14, 0.6, "#8a7a5a", { at: [0, -0.46, 0] }),
    partBox("load_block", 0.4, 0.4, 0.4, "#d0a24a", { at: [1.0, 0.28, 0] }),
    partSphere("effort_point", 0.12, "#4a9ee8", { at: [-1.0, 0.16, 0] }),
    partArrow("load_torque", 0.7, "#ff6b6b", { at: [1.0, 0.6, 0], rotate: [0, 0, 180 * D] }),
  ];
}

function enginePiston() {
  return [
    partCylinder("cylinder_block", 0.5, 0.5, 1.4, "#9aa8b4", { at: [0, -0.1, 0] }),
    partCylinder("piston", 0.42, 0.42, 0.4, "#c9d0d8", { at: [0, 0.4, 0] }),
    partCylinder("piston_rod", 0.09, 0.09, 1.2, "#d0d0d0", { at: [0, 1.2, 0] }),
    partBox("crank_weight", 0.3, 0.5, 0.3, "#7f8fa0", { at: [0, 1.95, 0] }),
    partCylinder("crankshaft", 0.1, 0.1, 1.0, "#5f6f7f", { at: [0, 2.0, 0], rotate: [90 * D, 0, 0] }),
    partCylinder("combustion_chamber", 0.3, 0.3, 0.3, "#f2a04a", { at: [0, 0.75, 0], emissive: "#f28a2a", emissiveIntensity: 0.7 }),
    partCylinder("intake_valve", 0.07, 0.07, 0.4, "#4a9ee8", { at: [-0.35, 0.5, 0] }),
    partCylinder("exhaust_valve", 0.07, 0.07, 0.4, "#8a8a8a", { at: [0.35, 0.5, 0] }),
  ];
}

// ============================================================== CHEMISTRY
function atom() {
  const nucleus = "#e05f5f";
  const shells = ["#4a9ee8", "#4ae07a", "#f2a04a"];
  const parts = [];
  // Nucleus: protons (+) and neutrons (0) packed in a sphere.
  const protons = 3;
  const neutrons = 4;
  for (let i = 0; i < protons; i += 1) {
    const a = (i / protons) * Math.PI * 2;
    parts.push(partSphere(`proton_${i + 1}`, 0.19, nucleus, { at: [Math.cos(a) * 0.13, Math.sin(a) * 0.13, ((i % 2) - 0.5) * 0.16] }));
  }
  for (let i = 0; i < neutrons; i += 1) {
    const a = (i / neutrons) * Math.PI * 2 + 0.5;
    parts.push(partSphere(`neutron_${i + 1}`, 0.19, "#8fa0ad", { at: [Math.cos(a) * 0.15, Math.sin(a) * 0.15, (((i % 3) - 1) * 0.13)] }));
  }
  parts.push(partSphere("nucleus", 0.42, nucleus, { alpha: 0.28, roughness: 0.3 }));
  // Electron shells with orbit planes at different inclinations.
  const radii = [0.95, 1.4, 1.85];
  const tilts = [0, 62 * D, -62 * D];
  const electronCounts = [2, 8, 3];
  radii.forEach((radius, shellIndex) => {
    parts.push(partTorus(`electron_shell_${shellIndex + 1}`, radius, 0.012, shells[shellIndex], {
      rotate: [Math.PI / 2 + tilts[shellIndex], shellIndex * 40 * D, 0],
      alpha: 0.85,
    }));
    for (let e = 0; e < electronCounts[shellIndex]; e += 1) {
      const a = (e / electronCounts[shellIndex]) * Math.PI * 2;
      parts.push(partSphere(`electron_${shellIndex + 1}_${e + 1}`, 0.085, "#4ae0e8", {
        at: rotateAboutX([Math.cos(a) * radius, Math.sin(a) * radius, 0], tilts[shellIndex]),
        emissive: "#4ae0e8", emissiveIntensity: 0.8,
      }));
    }
  });
  return parts;
}

function rotateAboutX([x, y, z], angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x, y * c - z * s, y * s + z * c];
}

function waterMolecule() {
  const oxygen = "#e05f5f";
  const hydrogen = "#e8e8e8";
  // Bent geometry: real water is ~104.5 degrees, not linear.
  const angle = 104.5 * D;
  const bond = 0.96;
  const hx = Math.sin(angle / 2) * bond;
  const hy = -Math.cos(angle / 2) * bond;
  return [
    partSphere("oxygen_atom", 0.34, oxygen, { at: [0, 0.1, 0] }),
    partSphere("hydrogen_1", 0.18, hydrogen, { at: [-hx, 0.1 + hy, 0] }),
    partSphere("hydrogen_2", 0.18, hydrogen, { at: [hx, 0.1 + hy, 0] }),
    partCylinder("bond_1", 0.05, 0.05, bond * 0.8, "#c9c9c9", { at: [-hx / 2, 0.1 + hy / 2, 0], rotate: [0, 0, angle / 2] }),
    partCylinder("bond_2", 0.05, 0.05, bond * 0.8, "#c9c9c9", { at: [hx / 2, 0.1 + hy / 2, 0], rotate: [0, 0, -angle / 2] }),
    partArrow("dipole_moment", 0.9, "#4a9ee8", { at: [0, 0.45, 0.2], rotate: [0, 0, 0] }),
    partTorus("partial_charge_ring", 0.4, 0.02, "#4a9ee8", { at: [0, 0.1, 0], rotate: [90 * D, 0, 0], alpha: 0.5 }),
  ];
}

function co2Molecule() {
  return [
    partSphere("carbon_atom", 0.24, "#5a5a5a", { at: [0, 0, 0] }),
    partSphere("oxygen_atom_left", 0.2, "#e05f5f", { at: [-1.16, 0, 0] }),
    partSphere("oxygen_atom_right", 0.2, "#e05f5f", { at: [1.16, 0, 0] }),
    partCylinder("double_bond_left", 0.045, 0.045, 0.9, "#c9c9c9", { at: [-0.5, 0.09, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("double_bond_left_2", 0.045, 0.045, 0.9, "#c9c9c9", { at: [-0.5, -0.09, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("double_bond_right", 0.045, 0.045, 0.9, "#c9c9c9", { at: [0.5, 0.09, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("double_bond_right_2", 0.045, 0.045, 0.9, "#c9c9c9", { at: [0.5, -0.09, 0], rotate: [0, 0, 90 * D] }),
  ];
}

function methaneMolecule() {
  const parts = [];
  const dirs = [
    [1, 1, 1], [-1, -1, 1], [-1, 1, -1], [1, -1, -1],
  ];
  parts.push(partSphere("carbon_atom", 0.22, "#5a5a5a", { at: [0, 0, 0] }));
  dirs.forEach((dir, i) => {
    const norm = Math.hypot(dir[0], dir[1], dir[2]);
    const at = [dir[0] / norm * 0.62, dir[1] / norm * 0.62, dir[2] / norm * 0.62];
    parts.push(partSphere(`hydrogen_${i + 1}`, 0.13, "#e8e8e8", { at }));
    parts.push(partCylinder(`bond_${i + 1}`, 0.04, 0.04, 0.62, "#c9c9c9", { at: [at[0] / 2, at[1] / 2, at[2] / 2], rotate: quatToEuler(normToDir(dir)) }));
  });
  return parts;
}

function normToDir(v) {
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
}

// Euler XYZ rotation that maps +Y onto `dir`.
function quatToEuler([dx, dy, dz]) {
  if (Math.abs(dy) > 0.99999) return [dx > 0 ? 0 : Math.PI, 0, 0];
  const yaw = Math.atan2(dx, dy);
  const pitch = Math.atan2(Math.sqrt(dx * dx + dz * dz), dy);
  return [-pitch, 0, yaw];
}

function benzeneRing() {
  const parts = [];
  parts.push(partTorus("benzene_ring", 1.0, 0.06, "#4a9ee8", { rotate: [90 * D, 0, 0], alpha: 0.6 }));
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const at = [Math.cos(a) * 1.0, 0, Math.sin(a) * 1.0];
    parts.push(partSphere(`carbon_${i + 1}`, 0.2, i % 2 === 0 ? "#3a3a3a" : "#5a5a5a", { at }));
    if (i % 2 === 0) {
      const a2 = ((i + 1) / 6) * Math.PI * 2;
      parts.push(partCylinder(`double_bond_${i / 2 + 1}`, 0.03, 0.03, 1.0, "#6a6a6a", {
        at: [Math.cos((a + a2) / 2) * 1.0, 0.1, Math.sin((a + a2) / 2) * 1.0],
        rotate: quatToEuler(normToDir([Math.cos(a2) - Math.cos(a), 0, Math.sin(a2) - Math.sin(a)])),
      }));
    }
    if (i === 0) parts.push(partSphere("hydrogen_attached", 0.11, "#e8e8e8", { at: [at[0] * 1.45, 0, at[2] * 1.45] }));
  }
  return parts;
}

function crystalLattice() {
  const parts = [];
  const positions = [];
  for (let x = -1; x <= 1; x += 1) for (let y = -1; y <= 1; y += 1) for (let z = -1; z <= 1; z += 1) positions.push([x, y, z]);
  positions.forEach((p, i) => {
    const isA = (p[0] + p[1] + p[2]) % 2 === 0;
    parts.push(partSphere(`ion_${i + 1}`, 0.24, isA ? "#4a9ee8" : "#e05f5f", { at: [p[0] * 0.62, p[1] * 0.62, p[2] * 0.62] }));
  });
  // Unit cell outline.
  const corners = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) corners.push([x, y, z]);
  const edges = [[0, 1], [0, 2], [0, 4], [1, 3], [1, 5], [2, 3], [2, 6], [3, 7], [4, 5], [4, 6], [5, 7], [6, 7]];
  edges.forEach(([a, b], i) => {
    const pa = corners[a];
    const pb = corners[b];
    parts.push({
      name: `unit_cell_edge_${i + 1}`,
      geom: tube([[pa[0] * 0.62, pa[1] * 0.62, pa[2] * 0.62], [pb[0] * 0.62, pb[1] * 0.62, pb[2] * 0.62]], 0.025, 6, false),
      material: solid("#c9c9c9", { alpha: 0.8 }),
    });
  });
  parts.push(partSphere("cation", 0.24, "#4a9ee8", { at: [0, 0, 0] }));
  return parts;
}

function titrationSetup() {
  return [
    partCylinder("burette_tube", 0.06, 0.06, 2.0, "#d8e8f0", { at: [0, 1.4, 0], alpha: 0.55 }),
    partCylinder("burette_tip", 0.04, 0.04, 0.3, "#d8e8f0", { at: [0, 0.3, 0], alpha: 0.7 }),
    partBox("burette_stand", 0.9, 0.1, 0.5, "#7f8fa0", { at: [0, -0.4, 0] }),
    partCylinder("burette_clamp", 0.05, 0.05, 0.4, "#7f8fa0", { at: [0.1, 1.4, 0], rotate: [0, 0, 90 * D] }),
    partCylinder("titrant", 0.045, 0.045, 1.0, "#4a9ee8", { at: [0, 1.7, 0], alpha: 0.8 }),
    partLathe("erlenmeyer_flask", [
      [0, -0.9], [0.55, -0.9], [0.56, -0.85], [0.3, -0.35], [0.16, -0.1], [0.15, 0.05], [0.2, 0.05],
    ], "#d8e8f0", { at: [0, -0.8, 0], alpha: 0.45 }),
    partCylinder("analyte_solution", 0.22, 0.36, 0.42, "#f2a04a", { at: [0, -0.95, 0], alpha: 0.85 }),
    partSphere("drop_1", 0.05, "#4a9ee8", { at: [0, 0.12, 0] }),
  ];
}

function periodicTableTile() {
  return [
    partBox("tile", 1.0, 1.0, 0.08, "#2f4f7f", {}),
    partBox("tile_border", 1.06, 0.06, 0.1, "#7fd4a8", { at: [0, 0.5, 0] }),
    partBox("tile_border_bottom", 1.06, 0.06, 0.1, "#7fd4a8", { at: [0, -0.5, 0] }),
  ];
}

function titrationBuretteDetail() {
  return periodicTableTile();
}

// ============================================================== EARTH SCIENCE
function earthGlobe() {
  const land = "#4f9e4a";
  const sea = "#2f6fbf";
  return [
    partSphere("ocean", 1.0, sea, { segments: 48, heightSegments: 32 }),
    // Continents as flattened lumps hugging the sphere surface.
    ...[
      [0.5, 0.3, 0.75], [-0.35, 0.55, -0.55], [0.85, -0.35, -0.2], [-0.7, -0.45, 0.35], [0.15, -0.8, 0.4], [-0.85, 0.05, 0.35],
    ].map((at, i) => lump(`continent_${i + 1}`, 0.45, 0.4, 0.16, land, { at: normalizeToSphere(at, 0.94), wobble: 0.16, frequency: 2.6, seed: 97 + i, rotate: [0, Math.atan2(at[0], at[2]), 0] })),
    partSphere("north_pole_ice", 0.28, "#e8f4ff", { at: [0, 0.96, 0], segments: 20, heightSegments: 12 }),
    partSphere("south_pole_ice", 0.24, "#e8f4ff", { at: [0, -0.96, 0], segments: 20, heightSegments: 12 }),
    // Axis and equator make rotation/orbit teaching readable.
    partCylinder("rotation_axis", 0.02, 0.02, 2.6, "#c9c9c9", { at: [0, 0, 0], rotate: [23.4 * D, 0, 0] }),
    partTorus("equator", 1.02, 0.012, "#ffffff", { at: [0, 0, 0], rotate: [Math.PI / 2, 0, 0], alpha: 0.4 }),
  ];
}

function normalizeToSphere(v, r) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [(v[0] / l) * r, (v[1] / l) * r, (v[2] / l) * r];
}

function earthLayers() {
  // A cutaway: concentric shells with one quadrant removed so every layer is visible.
  const parts = [];
  const layers = [
    ["inner_core", 0.32, "#f2d24a"],
    ["outer_core", 0.55, "#f28a4a"],
    ["lower_mantle", 0.78, "#e05f5f"],
    ["upper_mantle", 0.92, "#c96a5a"],
    ["crust", 1.0, "#4f9e4a"],
  ];
  layers.forEach(([name, radius, color]) => {
    parts.push({
      name,
      geom: quarterShell(radius, 0.06),
      material: solid(color, { alpha: 0.95, roughness: 0.75 }),
    });
  });
  return parts;
}

// Three-quarter torus wedge (270 degrees) so a cutaway shows all layers.
function quarterShell(radius, thickness) {
  const arc = Math.PI * 1.5;
  const profile = [
    [radius - thickness / 2, -thickness / 2],
    [radius + thickness / 2, -thickness / 2],
    [radius + thickness / 2, thickness / 2],
    [radius - thickness / 2, thickness / 2],
    [radius - thickness / 2, -thickness / 2],
  ];
  return lathe(profile, 40, arc);
}

function atmosphereLayer() {
  return [
    shellSphere("atmosphere", 1.12, 0.16, "#4aa3d8", { alpha: 0.25, roughness: 0.1 }),
    shellSphere("troposphere", 1.05, 0.1, "#7fd4e8", { alpha: 0.2, roughness: 0.1 }),
    partSphere("cloud_layer_1", 0.35, "#ffffff", { at: [0.4, 0.55, 0.6], alpha: 0.65 }),
    partSphere("cloud_layer_2", 0.28, "#ffffff", { at: [-0.6, -0.2, 0.5], alpha: 0.65 }),
    partSphere("cloud_layer_3", 0.3, "#ffffff", { at: [0.1, -0.7, -0.4], alpha: 0.65 }),
  ];
}

function tectonicPlates() {
  const parts = [];
  const colors = ["#c96a5a", "#5a9ec9", "#9ec95a", "#c9a05a", "#9a5ac9", "#5ac99e"];
  for (let i = 0; i < 6; i += 1) {
    const a = (i / 6) * Math.PI * 2;
    const at = [Math.cos(a) * 1.15, -0.1 + (i % 2) * 0.22, Math.sin(a) * 1.15];
    parts.push(partBox(`plate_${i + 1}`, 1.5, 0.14, 1.1, colors[i], { at, rotate: [0, -a, 0] }));
    parts.push(partTorus(`plate_boundary_${i + 1}`, 1.85, 0.03, "#f2d24a", { at: [0, at[1] + 0.08, 0], rotate: [Math.PI / 2, 0, 0], alpha: 0.5 }));
  }
  parts.push(partSphere("mantle_convection", 0.5, "#e05f5f", { at: [0, -0.6, 0], alpha: 0.5 }));
  parts.push(partCylinder("boundary_ridge", 0.5, 0.5, 0.1, "#f2d24a", { at: [0, 0.1, 0], alpha: 0.8 }));
  return parts;
}

function volcano() {
  return [
    partCone("volcano_cone", 1.2, 1.6, "#6a5a4a", { at: [0, -0.8, 0], segments: 36 }),
    partTorus("crater_rim", 0.34, 0.12, "#4a3a2a", { at: [0, 0, 0], rotate: [Math.PI / 2, 0, 0] }),
    partCylinder("crater_throat", 0.3, 0.3, 1.4, "#e05f3a", { at: [0, -0.4, 0], emissive: "#e05f3a", emissiveIntensity: 0.8 }),
    partCylinder("magma_chamber", 0.55, 0.6, 0.5, "#f28a2a", { at: [0, -1.6, 0], emissive: "#f28a2a", emissiveIntensity: 0.9 }),
    partTorus("lava_flow", 0.55, 0.09, "#f25f2a", { at: [0.7, -1.1, 0.2], rotate: [Math.PI / 2 - 0.5, 0, 0], emissive: "#f25f2a", emissiveIntensity: 0.9 }),
    ...[[0.1, 1.2, 0], [-0.2, 1.7, 0.1], [0.25, 2.2, -0.15], [0, 2.7, 0.1], [-0.1, 3.2, 0]].map((at, i) =>
      partSphere(`ash_plume_${i + 1}`, 0.22 + i * 0.06, "#8a8a8a", { at, alpha: 0.55 - i * 0.06 })),
    partPlane("ground", 5.0, 5.0, "#4a6a4a", { at: [0, -1.62, 0] }),
  ];
}

function mountain() {
  return [
    partCone("mountain_peak", 1.3, 2.2, "#8a8a8a", { at: [0, -1.1, 0], segments: 32 }),
    partCone("snow_cap", 0.5, 0.8, "#ffffff", { at: [0, 0.5, 0], segments: 28 }),
    partPlane("valley_ground", 5.0, 4.0, "#4a7a4a", { at: [0, -2.15, 0] }),
    ...Array.from({ length: 4 }, (_, i) => partSphere(`cloud_${i + 1}`, 0.3, "#ffffff", {
      at: [Math.cos(i * 1.6) * 1.1, 1.2 + (i % 2) * 0.4, Math.sin(i * 1.6) * 0.8], alpha: 0.7,
    })),
  ];
}

function cloud() {
  return [
    ...[[-0.5, 0, 0, 0.55], [0.15, 0.18, 0.1, 0.7], [0.75, 0.02, -0.05, 0.5], [0.1, -0.2, 0.2, 0.45], [-0.35, 0.12, -0.25, 0.4]]
      .map(([x, y, z, r], i) => partSphere(`cloud_puff_${i + 1}`, r, "#ffffff", { at: [x, y, z], alpha: 0.8 })),
  ];
}

function waterDroplet() {
  return [
    partSphere("droplet", 0.3, "#4aa3d8", { alpha: 0.75, roughness: 0.1 }),
    partCone("droplet_tip", 0.3, 0.5, "#4aa3d8", { at: [0, 0.3, 0], rotate: [180 * D, 0, 0], alpha: 0.75 }),
    partSphere("highlight", 0.08, "#ffffff", { at: [-0.1, 0.12, 0.2], alpha: 0.9 }),
  ];
}

// ============================================================== ASTRONOMY
function sun() {
  const parts = [
    partSphere("photosphere", 1.0, "#ffcc33", { emissive: "#ffaa22", emissiveIntensity: 0.9, roughness: 0.4, segments: 44, heightSegments: 30 }),
    shellSphere("chromosphere", 1.08, 0.1, "#ff8844", { alpha: 0.5, emissive: "#ff6633", emissiveIntensity: 0.6 }),
    partSphere("corona", 1.5, "#ffdd88", { alpha: 0.16, emissive: "#ffcc55", emissiveIntensity: 0.5 }),
  ];
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2;
    parts.push(partArrow(`solar_prominence_${i + 1}`, 0.7, "#ff7733", {
      at: [Math.cos(a) * 1.15, Math.sin(a) * 0.6, Math.sin(a) * 1.15],
      rotate: [0, 0, a * 180 / Math.PI], emissive: "#ff7733", emissiveIntensity: 0.7,
    }));
  }
  return parts;
}

function planet(options) {
  const { name, color, radius = 1, tilt = 0, rings = false, spots = [] } = options;
  const parts = [
    partSphere(name, radius, color, { segments: 40, heightSegments: 26 }),
  ];
  if (tilt) parts.push(partCylinder(`${name}_axis`, 0.012, 0.012, radius * 2.8, "#c9c9c9", { at: [0, 0, 0], rotate: [tilt, 0, 0] }));
  spots.forEach((spot, i) => parts.push(lump(`${name}_feature_${i + 1}`, spot[0], spot[1], spot[2], spot[3], {
    at: normalizeToSphere([spot[4], spot[5], spot[6]], radius * 0.98), wobble: 0.1, seed: 101 + i,
  })));
  if (rings) {
    parts.push(partTorus(`${name}_rings_inner`, radius * 1.5, radius * 0.16, "#d8c48a", { rotate: [Math.PI / 2 + tilt, 0, 0], alpha: 0.8 }));
    parts.push(partTorus(`${name}_rings_outer`, radius * 2.05, radius * 0.1, "#c8b48a", { rotate: [Math.PI / 2 + tilt, 0, 0], alpha: 0.6 }));
  }
  return parts;
}

function moon() {
  return [
    partSphere("moon", 0.45, "#c9c9c9", { segments: 30, heightSegments: 20 }),
    ...[[0.2, 0.2, 0.3], [-0.25, 0.1, -0.2], [0.1, -0.25, -0.25], [-0.15, -0.15, 0.35]].map((at, i) =>
      partSphere(`crater_${i + 1}`, 0.09, "#a8a8a8", { at: normalizeToSphere(at, 0.43) })),
  ];
}

function comet() {
  return [
    partSphere("comet_nucleus", 0.22, "#5a5a5a", {}),
    partCone("comet_tail", 0.55, 2.2, "#a8e0ff", { at: [1.2, 0, 0], rotate: [0, 0, -90 * D], alpha: 0.4 }),
    partCone("comet_ion_tail", 0.35, 3.0, "#8fb8ff", { at: [1.7, 0.4, 0], rotate: [0, 0, -90 * D + 0.2], alpha: 0.25 }),
    partArrow("solar_wind_pressure", 1.0, "#f2d24a", { at: [-0.5, 0.8, 0], rotate: [0, 0, 120 * D] }),
  ];
}

function galaxy() {
  const parts = [
    partSphere("galactic_core", 0.35, "#ffe8b0", { emissive: "#ffcc66", emissiveIntensity: 0.9 }),
    partTorus("galactic_disk", 1.5, 0.08, "#a8c8ff", { rotate: [12 * D, 0, 8 * D], alpha: 0.5 }),
    partTorus("galactic_disk_outer", 2.4, 0.05, "#8fb0ff", { rotate: [12 * D, 0, 8 * D], alpha: 0.35 }),
  ];
  for (let arm = 0; arm < 2; arm += 1) {
    const points = Array.from({ length: 40 }, (_, i) => {
      const t = i / 39;
      const a = t * Math.PI * 1.6 + arm * Math.PI;
      const r = 0.4 + t * 2.2;
      return [Math.cos(a) * r, Math.sin(t * 3) * 0.12, Math.sin(a) * r];
    });
    parts.push({ name: `spiral_arm_${arm + 1}`, geom: tube(points, 0.16, 8, false), material: solid("#9fc8ff", { alpha: 0.45 }) });
  }
  return parts;
}

// ===================================================== NETWORK / COMPUTER SCIENCE
function router() {
  return [
    partBox("router_body", 1.7, 0.36, 1.1, "#2f3a45", {}),
    partBox("router_top", 1.6, 0.1, 1.0, "#3d4a56", { at: [0, 0.22, 0] }),
    ...Array.from({ length: 4 }, (_, i) => partCylinder(`antenna_${i + 1}`, 0.02, 0.02, 0.8, "#1f272e", {
      at: [-0.6 + i * 0.4, 0.6, -0.4], rotate: [-25 * D, 0, (i - 1.5) * 8 * D],
    })),
    ...Array.from({ length: 4 }, (_, i) => partBox(`ethernet_port_${i + 1}`, 0.16, 0.1, 0.06, "#8a9aa8", { at: [-0.6 + i * 0.4, -0.02, 0.56] })),
    ...Array.from({ length: 3 }, (_, i) => partSphere(`status_led_${i + 1}`, 0.03, "#4ae07a", { at: [0.5 + i * 0.12, 0.1, 0.52], emissive: "#4ae07a", emissiveIntensity: 1 })),
    partBox("router_label_plate", 0.7, 0.02, 0.3, "#e8e8e8", { at: [-0.5, 0.28, 0.1] }),
  ];
}

function networkSwitch() {
  return [
    partBox("switch_body", 2.0, 0.28, 0.9, "#1f2a33", {}),
    ...Array.from({ length: 8 }, (_, i) => partBox(`switch_port_${i + 1}`, 0.14, 0.1, 0.05, "#8a9aa8", { at: [-0.7 + i * 0.2, 0.0, 0.46] })),
    ...Array.from({ length: 8 }, (_, i) => partSphere(`switch_led_${i + 1}`, 0.025, i % 3 === 0 ? "#f2a04a" : "#4ae07a", {
      at: [-0.7 + i * 0.2, 0.1, 0.46], emissive: i % 3 === 0 ? "#f2a04a" : "#4ae07a", emissiveIntensity: 0.9,
    })),
    partBox("switch_vent", 1.6, 0.02, 0.4, "#3d4a56", { at: [0, 0.15, -0.2] }),
  ];
}

function serverRack() {
  return [
    partBox("rack_frame", 1.1, 2.4, 0.9, "#1a2229", {}),
    ...Array.from({ length: 5 }, (_, i) => partBox(`server_unit_${i + 1}`, 0.95, 0.34, 0.78, "#2f3a45", { at: [0, 0.85 - i * 0.42, 0] })),
    ...Array.from({ length: 5 }, (_, i) => partSphere(`server_led_${i + 1}`, 0.025, "#4ae0e8", {
      at: [0.35, 0.85 - i * 0.42, 0.4], emissive: "#4ae0e8", emissiveIntensity: 1,
    })),
    ...Array.from({ length: 5 }, (_, i) => partBox(`server_vent_${i + 1}`, 0.7, 0.16, 0.02, "#4a5a66", { at: [0, 0.85 - i * 0.42, 0.4] })),
    partCylinder("rack_power", 0.1, 0.1, 0.6, "#8a9aa8", { at: [-0.4, 1.2, 0.3], rotate: [0, 0, 90 * D] }),
  ];
}

function laptop() {
  const shell = "#8a929a";
  const tilt = -14 * D;
  const keys = [];
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 11; col += 1) {
      keys.push(transform(box(0.085, 0.02, 0.085), { translate: [-0.46 + col * 0.092, 0.05, -0.3 + row * 0.1] }));
    }
  }
  const vents = [];
  for (let i = 0; i < 7; i += 1) {
    vents.push(transform(box(0.06, 0.02, 0.03), { translate: [-0.5 + i * 0.11, 0.05, -0.52] }));
  }
  return [
    partBox("laptop_base", 1.62, 0.07, 1.12, shell, {}),
    partBox("chassis_lower", 1.5, 0.04, 1.0, "#5f676f", { at: [0, -0.05, 0] }),
    partBox("palm_rest", 1.42, 0.02, 0.3, "#9aa2aa", { at: [0, 0.05, 0.36] }),
    partBox("keyboard_deck", 1.3, 0.03, 0.5, "#4a525a", { at: [0, 0.03, -0.1] }),
    { name: "keyboard_keys", geom: merge(keys), material: solid("#6a727a", { roughness: 0.55 }) },
    partBox("trackpad", 0.44, 0.015, 0.32, "#6a727a", { at: [0, 0.06, 0.3] }),
    partBox("fingerprint_reader", 0.07, 0.01, 0.07, "#c0c8d0", { at: [0.6, 0.06, -0.44] }),
    partBox("power_button", 0.06, 0.01, 0.06, "#c0c8d0", { at: [-0.7, 0.06, -0.46] }),
    partTorus("hinge", 0.07, 0.03, "#6a727a", { at: [-0.72, 0.06, -0.56], rotate: [0, 90 * D, 0], radialSegments: 16, tubularSegments: 10 }),
    partTorus("hinge_right", 0.07, 0.03, "#6a727a", { at: [0.72, 0.06, -0.56], rotate: [0, 90 * D, 0], radialSegments: 16, tubularSegments: 10 }),
    { name: "cooling_vents", geom: merge(vents), material: solid("#3f474f", { roughness: 0.8 }) },
    // Screen assembly, tilted back on its hinge.
    partBox("screen_bezel", 1.6, 1.06, 0.06, shell, { at: [0, 0.53, -0.55], rotate: [tilt, 0, 0] }),
    partBox("screen_display", 1.42, 0.9, 0.02, "#0f2a44", { at: [0, 0.54, -0.52], rotate: [tilt, 0, 0], emissive: "#1a5a8a", emissiveIntensity: 0.55 }),
    ...Array.from({ length: 3 }, (_, i) => partBox(`screen_window_${i + 1}`, 0.86 - i * 0.18, 0.13, 0.01, "#4aa3d8", {
      at: [-0.18 + i * 0.05, 0.72 - i * 0.19, -0.5 + i * 0.012], rotate: [tilt, 0, 0], emissive: "#4aa3d8", emissiveIntensity: 0.5,
    })),
    partSphere("webcam", 0.035, "#1a1a20", { at: [0, 1.0, -0.53] }),
    partBox("screen_chin", 1.5, 0.1, 0.04, "#7f878f", { at: [0, 0.08, -0.53], rotate: [tilt, 0, 0] }),
    // I/O and connectivity — the reason a laptop appears in a networking lesson.
    partBox("usb_port", 0.07, 0.05, 0.08, "#3f474f", { at: [0.78, 0, 0.28] }),
    partBox("hdmi_port", 0.12, 0.05, 0.08, "#3f474f", { at: [0.78, 0, 0.06] }),
    partBox("ethernet_port", 0.14, 0.07, 0.09, "#3f474f", { at: [-0.78, 0, 0.12] }),
    partBox("audio_jack", 0.05, 0.05, 0.06, "#3f474f", { at: [-0.78, 0, 0.3] }),
    partSphere("wifi_led", 0.025, "#4ae07a", { at: [0.62, 0.06, -0.5], emissive: "#4ae07a", emissiveIntensity: 1 }),
  ];
}

function packet() {
  return [
    partBox("packet_envelope", 0.5, 0.32, 0.06, "#4aa3d8", { emissive: "#4aa3d8", emissiveIntensity: 0.5 }),
    partBox("packet_header_strip", 0.5, 0.06, 0.07, "#2f6fbf", { at: [0, 0.13, 0] }),
    partBox("packet_payload", 0.34, 0.14, 0.07, "#a8d8f0", { at: [0, -0.05, 0] }),
  ];
}

// A firewall as what it actually is: a brick wall with a gated, barred doorway that inspected packets
// pass through and unfiltered traffic is stopped by.
function firewallShield() {
  const brick = "#b5432f";
  const mortar = "#8a2a1f";
  const bricks = [];
  const rows = 7;
  const perRow = 5;
  for (let row = 0; row < rows; row += 1) {
    const y = -0.85 + row * 0.28;
    const offset = row % 2 === 0 ? 0 : 0.12;
    for (let i = 0; i < perRow; i += 1) {
      const x = -0.66 + i * 0.33 + offset;
      if (Math.abs(x) < 0.26) continue; // leave the gateway open
      bricks.push(transform(box(0.3, 0.24, 0.22), { translate: [x, y, 0] }));
    }
  }
  return [
    { name: "firewall_wall", geom: merge(bricks), material: solid(brick, { roughness: 0.85 }) },
    partBox("gateway", 0.5, 1.9, 0.16, mortar, { at: [0, -0.05, 0] }),
    // Gate bars: the packet filter rules.
    ...Array.from({ length: 4 }, (_, i) => partBox(`gate_bar_${i + 1}`, 0.045, 1.8, 0.06, "#6f7f8f", { at: [-0.2 + i * 0.13, -0.05, 0.1] })),
    partBox("gate_lintel", 0.66, 0.16, 0.26, "#7f2f22", { at: [0, 0.98, 0.02] }),
    partBox("gate_threshold", 0.66, 0.14, 0.28, "#7f2f22", { at: [0, -1.02, 0.02] }),
    partBox("inspection_engine", 0.62, 0.5, 0.4, "#2f3a45", { at: [0, 1.42, 0] }),
    ...Array.from({ length: 3 }, (_, i) => partSphere(`rule_led_${i + 1}`, 0.04, i === 0 ? "#4ae07a" : i === 1 ? "#f2a04a" : "#d64545", {
      at: [-0.16 + i * 0.16, 1.52, 0.21], emissive: i === 0 ? "#4ae07a" : i === 1 ? "#f2a04a" : "#d64545", emissiveIntensity: 1,
    })),
    partCylinder("uplink_cable", 0.06, 0.06, 1.4, "#4aa3d8", { at: [0, 2.05, -0.2], segments: 12 }),
    // Unfiltered traffic hits the wall; inspected traffic passes through the gateway.
    partSphere("blocked_packet_1", 0.13, "#d64545", { at: [-0.55, 0.2, 0.35] }),
    partSphere("blocked_packet_2", 0.13, "#d64545", { at: [-0.75, -0.35, 0.35] }),
    partCone("blocked_marker", 0.16, 0.24, "#f2d24a", { at: [-0.65, -0.72, 0.35], rotate: [180 * D, 0, 0] }),
    partSphere("allowed_packet", 0.12, "#4ae07a", { at: [0, -0.1, 0.55], emissive: "#4ae07a", emissiveIntensity: 0.6 }),
    partArrow("traffic_direction", 0.7, "#4ae07a", { at: [0, -0.1, 0.95], rotate: [90 * D, 0, 0], emissive: "#4ae07a", emissiveIntensity: 0.4 }),
  ];
}

function cpuChip() {
  const substrate = "#2f8f5a";
  const dieColor = "#4a4a52";
  const coreColor = "#8a8a92";
  const cacheColor = "#a8b0b8";
  const fins = [];
  for (let i = 0; i < 9; i += 1) {
    fins.push(transform(box(1.42, 0.34, 0.035), { translate: [0, 0, -0.62 + i * 0.15] }));
  }
  return [
    partBox("cpu_package", 1.5, 1.5, 0.09, substrate, {}),
    partBox("package_substrate", 1.62, 1.62, 0.04, "#1f6f4a", { at: [0, 0, -0.05] }),
    partBox("silicon_die", 0.9, 0.9, 0.1, dieColor, { at: [0, 0, 0.08] }),
    // Four cores, visibly separated by the fabric running between them.
    ...[[-0.22, 0.22], [0.22, 0.22], [-0.22, -0.22], [0.22, -0.22]].map((at, i) => partBox(`cpu_core_${i + 1}`, 0.32, 0.32, 0.03, coreColor, { at: [at[0], at[1], 0.14] })),
    partBox("cpu_fabric", 0.06, 0.72, 0.02, "#f2b04a", { at: [0, 0, 0.14], emissive: "#f2b04a", emissiveIntensity: 0.4 }),
    partBox("cpu_fabric_cross", 0.72, 0.06, 0.02, "#f2b04a", { at: [0, 0, 0.14], emissive: "#f2b04a", emissiveIntensity: 0.4 }),
    partBox("l2_cache", 0.36, 0.36, 0.02, cacheColor, { at: [0.52, 0.52, 0.14] }),
    partBox("l3_cache", 0.42, 0.3, 0.02, "#9aa4ac", { at: [-0.5, 0.54, 0.14] }),
    partBox("memory_controller", 0.4, 0.24, 0.02, "#7f8f9a", { at: [0.5, -0.54, 0.14] }),
    partBox("io_controller", 0.3, 0.22, 0.02, "#7f8f9a", { at: [-0.52, -0.52, 0.14] }),
    // The integrated heat spreader and a fin stack: what you actually see on a real CPU.
    partBox("heat_spreader", 1.32, 1.32, 0.1, "#b8c2cc", { at: [0, 0, 0.34] }),
    partBox("thermal_interface", 1.36, 1.36, 0.02, "#e8e0c0", { at: [0, 0, 0.28] }),
    { name: "heatsink_fins", geom: merge(fins), material: solid("#9aa8b4", { metallic: 0.55, roughness: 0.35 }) },
    partBox("heatsink_base", 1.46, 1.46, 0.05, "#8a98a4", { at: [0, 0, -0.7] }),
    partBox("alignment_marker", 0.14, 0.14, 0.02, "#f2d24a", { at: [-0.66, -0.66, 0.44] }),
    partBox("mounting_notch_1", 0.1, 0.18, 0.1, "#1f6f4a", { at: [0, 0.78, 0] }),
    partBox("mounting_notch_2", 0.1, 0.18, 0.1, "#1f6f4a", { at: [0, -0.78, 0] }),
    // The Land Grid Array: a dense contact field underneath the package.
    ...Array.from({ length: 36 }, (_, i) => {
      const col = i % 6;
      const row = Math.floor(i / 6);
      return partBox(`lga_contact_${i + 1}`, 0.1, 0.1, 0.03, "#d8c070", {
        at: [-0.62 + col * 0.25, -0.62 + row * 0.25, -0.09],
      });
    }),
    ...Array.from({ length: 6 }, (_, i) => partBox(`bus_trace_${i + 1}`, 0.02, 1.2, 0.01, "#f2d24a", { at: [-0.7 + i * 0.28, 0.55, 0.16], emissive: "#f2d24a", emissiveIntensity: 0.4 })),
  ];
}

function memoryModule() {
  const heatsinks = [
    transform(box(1.5, 0.34, 0.05), { translate: [0, 0.06, 0.1] }),
    transform(box(1.5, 0.34, 0.05), { translate: [0, 0.06, -0.1] }),
  ];
  const banks = [];
  for (let i = 0; i < 4; i += 1) {
    banks.push(transform(box(0.32, 0.3, 0.06), { translate: [-0.66 + i * 0.44, 0.02, 0.08] }));
  }
  return [
    partBox("pcb", 1.72, 0.5, 0.06, "#1f6f4a", {}),
    { name: "dram_bank_1", geom: banks[0], material: solid("#2a2a32", { roughness: 0.5 }) },
    { name: "dram_bank_2", geom: banks[1], material: solid("#2a2a32", { roughness: 0.5 }) },
    { name: "dram_bank_3", geom: banks[2], material: solid("#2a2a32", { roughness: 0.5 }) },
    { name: "dram_bank_4", geom: banks[3], material: solid("#2a2a32", { roughness: 0.5 }) },
    ...Array.from({ length: 8 }, (_, i) => partBox(`memory_chip_${i + 1}`, 0.15, 0.27, 0.05, "#3a3a44", { at: [-0.7 + i * 0.2, 0.02, 0.11] })),
    ...Array.from({ length: 6 }, (_, i) => partBox(`memory_trace_${i + 1}`, 1.5, 0.012, 0.012, "#c9922f", { at: [0, -0.16 + i * 0.045, 0.04] })),
    partBox("spd_chip", 0.14, 0.1, 0.04, "#2a2a32", { at: [-0.78, 0.14, 0.11] }),
    partBox("gold_contact_edge", 1.6, 0.09, 0.03, "#d8b040", { at: [0, -0.25, 0.02] }),
    ...Array.from({ length: 22 }, (_, i) => partBox(`contact_pin_${i + 1}`, 0.03, 0.08, 0.035, "#f2d24a", { at: [-0.72 + i * 0.069, -0.25, 0.02] })),
    partBox("notch", 0.1, 0.11, 0.09, "#123a2a", { at: [0.22, -0.25, 0.02] }),
    { name: "heat_spreader", geom: merge(heatsinks), material: solid("#8a98a4", { metallic: 0.6, roughness: 0.3 }) },
    { name: "heat_spreader_fins", geom: merge(Array.from({ length: 7 }, (_, i) => transform(box(1.44, 0.03, 0.06), { translate: [0, -0.02 + i * 0.045, 0.16] }))), material: solid("#7f8f9a", { metallic: 0.5, roughness: 0.35 }) },
    partBox("memory_bank_label", 0.5, 0.08, 0.02, "#e8e8f0", { at: [-0.4, 0.2, 0.11] }),
    partBox("rgb_diffuser", 1.6, 0.05, 0.04, "#4ae0e8", { at: [0, 0.24, 0.1], emissive: "#4ae0e8", emissiveIntensity: 0.8 }),
    partBox("side_latch_1", 0.06, 0.36, 0.1, "#c9c9d0", { at: [-0.9, -0.02, 0] }),
    partBox("side_latch_2", 0.06, 0.36, 0.1, "#c9c9d0", { at: [0.9, -0.02, 0] }),
  ];
}

function linkedListNode() {
  return [
    partBox("node_data", 0.6, 0.6, 0.2, "#4aa3d8", { emissive: "#2f6fbf", emissiveIntensity: 0.3 }),
    partBox("node_pointer", 0.18, 0.6, 0.12, "#f2d24a", { at: [0.48, 0, 0] }),
    partBox("node_value", 0.28, 0.28, 0.06, "#e8f4ff", { at: [-0.1, 0, 0.12] }),
    partBox("node_next_slot", 0.28, 0.28, 0.06, "#c9e8ff", { at: [0.3, 0, 0.12] }),
  ];
}

function stackBlock() {
  return [
    partBox("stack_block", 1.0, 0.24, 1.0, "#4aa3d8", {}),
    partBox("stack_pointer_slot", 0.4, 0.05, 0.4, "#f2d24a", { at: [0, 0.14, 0] }),
  ];
}

function dataStructureBox() {
  return [
    partBox("ds_body", 1.2, 1.0, 1.0, "#7f6ad9", { alpha: 0.35, roughness: 0.2 }),
    partBox("ds_front", 1.2, 1.0, 0.04, "#9a8ae8", { at: [0, 0, 0.52], alpha: 0.5 }),
    partBox("ds_top", 1.2, 0.04, 1.0, "#9a8ae8", { at: [0, 0.52, 0], alpha: 0.5 }),
  ];
}

export const PHYSICS_CHEMISTRY_EARTH_MODELS = {
  // Physics apparatus and mechanisms
  "physics/pulley": pulley,
  "physics/pendulum": pendulum,
  "physics/inclined-plane": inclinedPlane,
  "physics/spring": spring,
  "physics/lens": lens,
  "physics/circuit-board": circuitBoard,
  "physics/projectile-launcher": projectileLauncher,
  "physics/wave-tank": waveTank,
  "physics/gear": gear,
  "physics/magnet": barMagnet,
  "physics/lever": lever,
  "physics/piston-engine": enginePiston,
  // Chemistry
  "chemistry/atom": atom,
  "chemistry/water-molecule": waterMolecule,
  "chemistry/co2-molecule": co2Molecule,
  "chemistry/methane-molecule": methaneMolecule,
  "chemistry/benzene-ring": benzeneRing,
  "chemistry/crystal-lattice": crystalLattice,
  "chemistry/titration-setup": titrationSetup,
  "chemistry/periodic-tile": titrationBuretteDetail,
  // Earth science
  "earth/globe": earthGlobe,
  "earth/earth-layers": earthLayers,
  "earth/atmosphere": atmosphereLayer,
  "earth/tectonic-plates": tectonicPlates,
  "earth/volcano": volcano,
  "earth/mountain": mountain,
  "earth/cloud": cloud,
  "earth/water-droplet": waterDroplet,
  // Astronomy
  "astronomy/sun": sun,
  "astronomy/mercury": () => planet({ name: "mercury", color: "#9a8f86", radius: 0.38 }),
  "astronomy/venus": () => planet({ name: "venus", color: "#e0c070", radius: 0.48, tilt: 3 * D }),
  "astronomy/moon": moon,
  "astronomy/mars": () => planet({ name: "mars", color: "#c1553a", radius: 0.53, tilt: 25 * D, spots: [[0.22, 0.16, 0.1, "#a03f2a", 0.2, 0.1, 0.9]] }),
  "astronomy/jupiter": () => planet({
    name: "jupiter", color: "#d9a878", radius: 1.1, tilt: 3 * D,
    spots: [[0.5, 0.16, 0.12, "#c05a3a", 0.3, -0.3, 0.9], [0.3, 0.1, 0.1, "#e8c9a0", -0.4, 0.2, 0.85]],
  }),
  "astronomy/saturn": () => planet({ name: "saturn", color: "#e0d0a0", radius: 0.95, tilt: 27 * D, rings: true }),
  "astronomy/neptune": () => planet({ name: "neptune", color: "#4a6ad9", radius: 0.9, tilt: 28 * D }),
  "astronomy/uranus": () => planet({ name: "uranus", color: "#8fd9e0", radius: 0.72, tilt: 98 * D, rings: true }),
  "astronomy/comet": comet,
  "astronomy/galaxy": galaxy,
  // Computer science / networking hardware
  "network/router": router,
  "network/switch": networkSwitch,
  "network/server": serverRack,
  "network/laptop": laptop,
  "network/packet": packet,
  "network/firewall": firewallShield,
  "computer-science/cpu": cpuChip,
  "computer-science/memory": memoryModule,
  "computer-science/linked-list-node": linkedListNode,
  "computer-science/stack-block": stackBlock,
  "computer-science/data-structure": dataStructureBox,
};

export { waterSurface };