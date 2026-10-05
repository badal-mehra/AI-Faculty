// Builds the educational 3D asset library.
//
//   node scripts/build-assets.mjs
//
// Writes one real binary glTF (.glb) per asset into public/models/<category>/<name>.glb and emits
// lib/visual3d/generatedAssets.ts, the machine-measured registry the runtime trusts (bounding
// radius, per-part anchors, triangle counts). Nothing is downloaded at build time and nothing is
// fetched at runtime, so every asset URL resolves locally and deterministically.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildGlb } from "./glb.mjs";
import { BIOLOGY_MODELS } from "./lib/models-biology.mjs";
import { PHYSICS_CHEMISTRY_EARTH_MODELS } from "./lib/models-world.mjs";
import { MATH_MODELS } from "./lib/models-math.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const modelsDir = join(repoRoot, "public", "models");

// Curated metadata per asset. `fallback` is the documented procedural primitive used only when the
// model cannot be loaded; `aliases` let the model write a natural id ("heart") and still resolve.
const CATALOG = {
  // ---- biology ------------------------------------------------------------
  "biology/heart": { name: "Human Heart", aliases: ["heart", "human heart"], fallback: "sphere", defaultColor: "#d64545" },
  "biology/lungs": { name: "Human Lungs", aliases: ["lung", "lungs"], fallback: "sphere", defaultColor: "#d98c8c" },
  "biology/brain": { name: "Human Brain", aliases: ["brain"], fallback: "sphere", defaultColor: "#e0a3b4" },
  "biology/cell": { name: "Animal Cell", aliases: ["cell", "animal cell"], fallback: "sphere", defaultColor: "#7fd4a8" },
  "biology/dna": { name: "DNA Double Helix", aliases: ["dna", "double helix"], fallback: "cylinder", defaultColor: "#6aa9e9" },
  "biology/skeleton": { name: "Human Skeleton", aliases: ["skeleton", "bones"], fallback: "box", defaultColor: "#ece5d4" },
  "biology/blood-cell": { name: "Red Blood Cell", aliases: ["red blood cell", "rbc", "erythrocyte"], fallback: "sphere", defaultColor: "#d64545" },
  "biology/white-blood-cell": { name: "White Blood Cell", aliases: ["white blood cell", "wbc", "leukocyte"], fallback: "sphere", defaultColor: "#f2e2c8" },
  "biology/blood-vessel": { name: "Blood Vessel", aliases: ["blood vessel", "vein", "artery"], fallback: "cylinder", defaultColor: "#c05a5a" },
  "biology/digestive-system": { name: "Digestive System", aliases: ["digestive system", "digestion", "stomach"], fallback: "sphere", defaultColor: "#e0a878" },
  "biology/leaf": { name: "Leaf", aliases: ["leaf", "leaves"], fallback: "plane", defaultColor: "#4f9e4a" },
  "biology/plant-cell": { name: "Plant Cell", aliases: ["plant cell"], fallback: "box", defaultColor: "#8fbf6a" },
  "biology/neuron": { name: "Neuron", aliases: ["neuron", "nerve cell"], fallback: "sphere", defaultColor: "#f0c98a" },
  "biology/muscle": { name: "Skeletal Muscle", aliases: ["muscle", "muscle fibre"], fallback: "cylinder", defaultColor: "#c25b6e" },
  "biology/kidney": { name: "Kidney", aliases: ["kidney", "nephron"], fallback: "sphere", defaultColor: "#b5563f" },
  "biology/skin": { name: "Skin Cross Section", aliases: ["skin", "epidermis"], fallback: "box", defaultColor: "#f2d9c0" },
  "biology/flower": { name: "Flower", aliases: ["flower"], fallback: "sphere", defaultColor: "#f28fb0" },
  "biology/chloroplast": { name: "Chloroplast", aliases: ["chloroplast"], fallback: "sphere", defaultColor: "#6fbf52" },
  "biology/enzyme": { name: "Enzyme", aliases: ["enzyme", "protein"], fallback: "sphere", defaultColor: "#6ab7e0" },

  // ---- physics ------------------------------------------------------------
  "physics/pulley": { name: "Pulley System", aliases: ["pulley"], fallback: "cylinder", defaultColor: "#8fa0ad" },
  "physics/pendulum": { name: "Pendulum", aliases: ["pendulum"], fallback: "sphere", defaultColor: "#d4a03c" },
  "physics/inclined-plane": { name: "Inclined Plane", aliases: ["inclined plane", "incline", "ramp"], fallback: "box", defaultColor: "#c9b28a" },
  "physics/spring": { name: "Spring", aliases: ["spring", "helical spring"], fallback: "cylinder", defaultColor: "#c0cad2" },
  "physics/lens": { name: "Convex Lens", aliases: ["lens", "convex lens"], fallback: "sphere", defaultColor: "#a8d8f0" },
  "physics/circuit-board": { name: "Circuit Board", aliases: ["circuit", "electric circuit", "circuit board"], fallback: "box", defaultColor: "#1f6f4a" },
  "physics/projectile-launcher": { name: "Projectile Launcher", aliases: ["projectile", "launcher", "cannon"], fallback: "box", defaultColor: "#7f8fa0" },
  "physics/wave-tank": { name: "Wave Tank", aliases: ["wave", "ripple tank", "waves"], fallback: "plane", defaultColor: "#4aa3d8" },
  "physics/gear": { name: "Gear", aliases: ["gear", "gears"], fallback: "cylinder", defaultColor: "#9aa8b4" },
  "physics/magnet": { name: "Bar Magnet", aliases: ["magnet", "magnetic field"], fallback: "box", defaultColor: "#d64545" },
  "physics/lever": { name: "Lever", aliases: ["lever"], fallback: "box", defaultColor: "#c9a86a" },
  "physics/piston-engine": { name: "Piston Engine", aliases: ["engine", "piston"], fallback: "cylinder", defaultColor: "#9aa8b4" },

  // ---- chemistry ----------------------------------------------------------
  "chemistry/atom": { name: "Atom", aliases: ["atom", "atomic structure"], fallback: "sphere", defaultColor: "#e05f5f" },
  "chemistry/water-molecule": { name: "Water Molecule", aliases: ["water molecule", "h2o"], fallback: "sphere", defaultColor: "#4aa3d8" },
  "chemistry/co2-molecule": { name: "Carbon Dioxide Molecule", aliases: ["co2", "carbon dioxide"], fallback: "sphere", defaultColor: "#e05f5f" },
  "chemistry/methane-molecule": { name: "Methane Molecule", aliases: ["methane", "ch4"], fallback: "sphere", defaultColor: "#5a5a5a" },
  "chemistry/benzene-ring": { name: "Benzene Ring", aliases: ["benzene", "aromatic ring"], fallback: "sphere", defaultColor: "#4a9ee8" },
  "chemistry/crystal-lattice": { name: "Crystal Lattice", aliases: ["crystal", "lattice", "ionic lattice"], fallback: "box", defaultColor: "#4a9ee8" },
  "chemistry/titration-setup": { name: "Titration Setup", aliases: ["titration", "burette"], fallback: "cylinder", defaultColor: "#d8e8f0" },
  "chemistry/periodic-tile": { name: "Periodic Table Tile", aliases: ["periodic table tile", "element tile"], fallback: "box", defaultColor: "#2f4f7f" },

  // ---- earth science -------------------------------------------------------
  "earth/globe": { name: "Earth Globe", aliases: ["earth", "globe", "world"], fallback: "sphere", defaultColor: "#2f6fbf" },
  "earth/earth-layers": { name: "Earth Internal Layers", aliases: ["earth layers", "crust", "mantle", "core"], fallback: "sphere", defaultColor: "#e05f5f" },
  "earth/atmosphere": { name: "Atmosphere", aliases: ["atmosphere", "air layer", "troposphere"], fallback: "sphere", defaultColor: "#4aa3d8" },
  "earth/tectonic-plates": { name: "Tectonic Plates", aliases: ["tectonic plate", "tectonic plates", "plates"], fallback: "box", defaultColor: "#c96a5a" },
  "earth/volcano": { name: "Volcano", aliases: ["volcano", "volcanic cone"], fallback: "cone", defaultColor: "#6a5a4a" },
  "earth/mountain": { name: "Mountain", aliases: ["mountain", "peak"], fallback: "cone", defaultColor: "#8a8a8a" },
  "earth/cloud": { name: "Cloud", aliases: ["cloud", "clouds"], fallback: "sphere", defaultColor: "#ffffff" },
  "earth/water-droplet": { name: "Water Droplet", aliases: ["water droplet", "droplet", "raindrop"], fallback: "sphere", defaultColor: "#4aa3d8" },

  // ---- astronomy -----------------------------------------------------------
  "astronomy/sun": { name: "Sun", aliases: ["sun", "star"], fallback: "sphere", defaultColor: "#ffcc33" },
  "astronomy/mercury": { name: "Mercury", aliases: ["mercury"], fallback: "sphere", defaultColor: "#9a8f86" },
  "astronomy/venus": { name: "Venus", aliases: ["venus"], fallback: "sphere", defaultColor: "#e0c070" },
  "astronomy/moon": { name: "Moon", aliases: ["moon", "luna"], fallback: "sphere", defaultColor: "#c9c9c9" },
  "astronomy/mars": { name: "Mars", aliases: ["mars"], fallback: "sphere", defaultColor: "#c1553a" },
  "astronomy/jupiter": { name: "Jupiter", aliases: ["jupiter"], fallback: "sphere", defaultColor: "#d9a878" },
  "astronomy/saturn": { name: "Saturn", aliases: ["saturn"], fallback: "sphere", defaultColor: "#e0d0a0" },
  "astronomy/neptune": { name: "Neptune", aliases: ["neptune"], fallback: "sphere", defaultColor: "#4a6ad9" },
  "astronomy/uranus": { name: "Uranus", aliases: ["uranus"], fallback: "sphere", defaultColor: "#8fd9e0" },
  "astronomy/comet": { name: "Comet", aliases: ["comet"], fallback: "sphere", defaultColor: "#a8e0ff" },
  "astronomy/galaxy": { name: "Galaxy", aliases: ["galaxy", "spiral galaxy", "milky way"], fallback: "sphere", defaultColor: "#9fc8ff" },

  // ---- networking ----------------------------------------------------------
  "network/router": { name: "Router", aliases: ["router", "wi-fi router"], fallback: "box", defaultColor: "#2f3a45" },
  "network/switch": { name: "Network Switch", aliases: ["switch", "network switch"], fallback: "box", defaultColor: "#1f2a33" },
  "network/server": { name: "Server Rack", aliases: ["server", "web server", "server rack"], fallback: "box", defaultColor: "#2f3a45" },
  "network/laptop": { name: "Laptop Computer", aliases: ["laptop", "client", "pc", "computer"], fallback: "box", defaultColor: "#8a929a" },
  "network/packet": { name: "Network Packet", aliases: ["packet", "data packet", "datagram"], fallback: "box", defaultColor: "#4aa3d8" },
  "network/firewall": { name: "Firewall", aliases: ["firewall"], fallback: "box", defaultColor: "#c0392b" },

  // ---- computer science ----------------------------------------------------
  "computer-science/cpu": { name: "CPU Chip", aliases: ["cpu", "processor", "chip"], fallback: "box", defaultColor: "#4a4a52" },
  "computer-science/memory": { name: "Memory Module", aliases: ["memory", "ram", "ram stick"], fallback: "box", defaultColor: "#1f6f4a" },
  "computer-science/linked-list-node": { name: "Linked List Node", aliases: ["linked list node", "node box"], fallback: "box", defaultColor: "#4aa3d8" },
  "computer-science/stack-block": { name: "Stack Block", aliases: ["stack block", "stack frame"], fallback: "box", defaultColor: "#4aa3d8" },
  "computer-science/data-structure": { name: "Data Structure Block", aliases: ["data structure", "heap block"], fallback: "box", defaultColor: "#7f6ad9" },

  // ---- mathematics ---------------------------------------------------------
  "mathematics/cube": { name: "Cube", aliases: ["cube", "hexahedron"], fallback: "box", defaultColor: "#4aa3d8" },
  "mathematics/rectangular-prism": { name: "Rectangular Prism", aliases: ["cuboid", "rectangular prism"], fallback: "box", defaultColor: "#7fbf8a" },
  "mathematics/sphere": { name: "Sphere", aliases: ["sphere"], fallback: "sphere", defaultColor: "#8a7ad9" },
  "mathematics/cone": { name: "Cone", aliases: ["cone"], fallback: "cone", defaultColor: "#e08a5c" },
  "mathematics/cylinder": { name: "Cylinder", aliases: ["cylinder"], fallback: "cylinder", defaultColor: "#4aa3d8" },
  "mathematics/torus": { name: "Torus", aliases: ["torus", "donut"], fallback: "sphere", defaultColor: "#c96ad9" },
  "mathematics/triangular-prism": { name: "Triangular Prism", aliases: ["triangular prism"], fallback: "box", defaultColor: "#7fbfd9" },
  "mathematics/polygon-prism": { name: "Polygon Prism", aliases: ["polygon prism", "prism"], fallback: "box", defaultColor: "#7f9ad9" },
  "mathematics/pyramid": { name: "Square Pyramid", aliases: ["pyramid"], fallback: "cone", defaultColor: "#d9a05c" },
  "mathematics/frustum": { name: "Frustum", aliases: ["frustum", "truncated cone"], fallback: "cone", defaultColor: "#c98a5c" },
  "mathematics/coordinate-system": { name: "Coordinate System", aliases: ["coordinate system", "axes", "xyz axes"], fallback: "sphere", defaultColor: "#e05f5f" },
  "mathematics/vector": { name: "Vector Arrow", aliases: ["vector", "vector arrow"], fallback: "arrow", defaultColor: "#e05f5f" },
  "mathematics/vector-sum": { name: "Vector Addition", aliases: ["vector sum", "vector addition", "resultant"], fallback: "arrow", defaultColor: "#4a9ee8" },
  "mathematics/parallelepiped": { name: "Parallelepiped", aliases: ["parallelepiped"], fallback: "box", defaultColor: "#9a7ad9" },
  "mathematics/unit-circle": { name: "Unit Circle", aliases: ["unit circle"], fallback: "sphere", defaultColor: "#4aa3d8" },
  "mathematics/grid-plane": { name: "Coordinate Grid", aliases: ["grid", "graph plane", "xy plane"], fallback: "plane", defaultColor: "#e8e8f0" },
  "mathematics/wave-surface": { name: "Wave Surface", aliases: ["wave surface", "transverse wave"], fallback: "plane", defaultColor: "#4aa3d8" },
};

const BUILDERS = { ...BIOLOGY_MODELS, ...PHYSICS_CHEMISTRY_EARTH_MODELS, ...MATH_MODELS };

// Assets whose natural framing distance is larger than a simple bounding-sphere fit (very spread-out
// scenes such as the solar system are built from separate objects, so this stays conservative).
const FRAMING_PADDING = 1.35;

function measureParts(parts) {
  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  const anchors = {};
  for (const part of parts) {
    const partMin = [Infinity, Infinity, Infinity];
    const partMax = [-Infinity, -Infinity, -Infinity];
    if (part.bounds) {
      for (let axis = 0; axis < 3; axis += 1) {
        partMin[axis] = part.bounds.min[axis];
        partMax[axis] = part.bounds.max[axis];
        min[axis] = Math.min(min[axis], partMin[axis]);
        max[axis] = Math.max(max[axis], partMax[axis]);
      }
    }
    anchors[part.name] = {
      center: partMin.map((value, axis) => Number.isFinite(value) ? (value + partMax[axis]) / 2 : 0),
      radius: Number.isFinite(partMin[0]) ? boundingRadiusOf(partMin, partMax) : 0,
    };
  }
  return { min, max, anchors };
}

function boundingRadiusOf(min, max) {
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return Math.sqrt(size[0] ** 2 + size[1] ** 2 + size[2] ** 2) / 2;
}

function round(value, digits = 5) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function main() {
  const ids = Object.keys(CATALOG);
  const manifest = {};
  let totalTriangles = 0;
  let totalBytes = 0;

  for (const id of ids) {
    const builder = BUILDERS[id];
    if (!builder) throw new Error(`No geometry builder registered for asset "${id}"`);
    const meta = CATALOG[id];
    const rawParts = builder().filter((part) => part && part.name && part.geom && part.geom.positions?.length);

    // Attach measured bounds per part before serializing.
    for (const part of rawParts) {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < part.geom.positions.length; i += 3) {
        for (let axis = 0; axis < 3; axis += 1) {
          const value = part.geom.positions[i + axis];
          if (value < min[axis]) min[axis] = value;
          if (value > max[axis]) max[axis] = value;
        }
      }
      part.bounds = { min, max };
    }

    // Normalize: centre the model on its own bounding box and scale it to a canonical radius of 1.
    // Every asset therefore has a comparable world size, which is what makes automatic camera
    // framing work for a molecule and a skeleton with one code path.
    const { min, max } = measureParts(rawParts);
    const center = min.map((value, axis) => Number.isFinite(value) ? (value + max[axis]) / 2 : 0);
    const rawRadius = boundingRadiusOf(
      Number.isFinite(min[0]) ? min : [0, 0, 0],
      Number.isFinite(max[0]) ? max : [0, 0, 0],
    );
    const normalization = rawRadius > 1e-6 ? 1 / rawRadius : 1;

    const parts = rawParts.map((part) => {
      const positions = [];
      for (let i = 0; i < part.geom.positions.length; i += 3) {
        positions.push(
          round((part.geom.positions[i] - center[0]) * normalization),
          round((part.geom.positions[i + 1] - center[1]) * normalization),
          round((part.geom.positions[i + 2] - center[2]) * normalization),
        );
      }
      const b = part.bounds;
      const bounds = {
        min: [0, 1, 2].map((axis) => round((b.min[axis] - center[axis]) * normalization)),
        max: [0, 1, 2].map((axis) => round((b.max[axis] - center[axis]) * normalization)),
      };
      return { name: part.name, geom: { positions, normals: part.geom.normals, indices: part.geom.indices }, material: part.material, bounds };
    });

    const { buffer, parts: written } = buildGlb(parts, { generator: "AI Faculty educational asset library" });
    const category = id.includes("/") ? id.slice(0, id.indexOf("/")) : "general";
    const name = id.slice(id.indexOf("/") + 1);
    const filePath = join("models", category, `${name}.glb`);
    const absolute = join(modelsDir, category, `${name}.glb`);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, buffer);

    const anchors = {};
    for (const part of parts) {
      anchors[part.name] = {
        center: [0, 1, 2].map((axis) => round((part.bounds.min[axis] + part.bounds.max[axis]) / 2)),
        radius: round(boundingRadiusOf(part.bounds.min, part.bounds.max)),
      };
    }
    // Overall normalized bounds of the shipped mesh, measured from the serialized parts. The runtime
    // validates every loaded GLB against this reference (a model whose measured box is empty, zero
    // sized or wildly different from what was built is rejected instead of rendering invisibly), and
    // it is the framing volume used when the renderer cannot measure the live mesh itself.
    const overallMin = [Infinity, Infinity, Infinity];
    const overallMax = [-Infinity, -Infinity, -Infinity];
    for (const part of parts) {
      for (let axis = 0; axis < 3; axis += 1) {
        overallMin[axis] = Math.min(overallMin[axis], part.bounds.min[axis]);
        overallMax[axis] = Math.max(overallMax[axis], part.bounds.max[axis]);
      }
    }
    const bounds = {
      min: overallMin.map((value) => round(value)),
      max: overallMax.map((value) => round(value)),
      size: [0, 1, 2].map((axis) => round(overallMax[axis] - overallMin[axis])),
      radius: round(boundingRadiusOf(overallMin, overallMax)),
    };
    const materialCount = new Set(parts.map((part) => JSON.stringify(part.material ?? null))).size;

    const triangles = written.reduce((total, part) => total + part.triangles, 0);
    totalTriangles += triangles;
    totalBytes += buffer.byteLength;

    manifest[id] = {
      id,
      category,
      name: meta.name,
      path: `/${filePath.split("\\").join("/")}`,
      fallbackType: meta.fallback,
      defaultColor: meta.defaultColor,
      aliases: meta.aliases,
      boundingRadius: 1,
      recommendedCameraDistance: round(3.1 * FRAMING_PADDING),
      partCount: parts.length,
      meshCount: written.length,
      materialCount,
      bounds,
      triangles,
      bytes: buffer.byteLength,
      semanticAnchors: Object.keys(anchors),
      anchors,
    };
    process.stdout.write(
      `  ${id.padEnd(38)} ${String(parts.length).padStart(3)} parts  ${String(triangles).padStart(6)} tris  ${(buffer.byteLength / 1024).toFixed(1).padStart(7)} KB\n`,
    );
  }

  const generated = `// GENERATED FILE — do not edit by hand.
// Produced by \`npm run assets:build\` (scripts/build-assets.mjs), which writes the matching .glb
// files into public/models/. Every number below is MEASURED from the generated geometry.
//
// This is the machine layer of the trusted asset registry: identity, local model path, normalized
// bounding radius, camera framing hint, triangle budget and the named semantic anchors that let the
// AI refer to a specific part of a model ("left_ventricle", "electron_shell_2", "nucleus").

export type GeneratedAssetPart = { center: [number, number, number]; radius: number };

/** Measured, normalized bounds of the whole shipped mesh (the model is normalized to radius 1). */
export type GeneratedAssetBounds = {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  radius: number;
};

export type GeneratedAsset = {
  id: string;
  category: string;
  name: string;
  path: string;
  fallbackType: string;
  defaultColor: string;
  aliases: string[];
  boundingRadius: number;
  recommendedCameraDistance: number;
  partCount: number;
  meshCount: number;
  materialCount: number;
  bounds: GeneratedAssetBounds;
  triangles: number;
  bytes: number;
  semanticAnchors: string[];
  anchors: Record<string, GeneratedAssetPart>;
};

export const GENERATED_ASSETS: GeneratedAsset[] = ${JSON.stringify(Object.values(manifest), null, 2)};

export const GENERATED_ASSETS_BY_ID: Record<string, GeneratedAsset> = Object.fromEntries(
  GENERATED_ASSETS.map((asset) => [asset.id, asset]),
);
`;

  const manifestPath = join(repoRoot, "lib", "visual3d", "generatedAssets.ts");
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, generated, "utf8");

  const index = {};
  for (const [id, asset] of Object.entries(manifest)) {
    index[id] = asset.path;
  }
  writeFileSync(join(modelsDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");

  console.log(`\nBuilt ${ids.length} GLB assets: ${(totalBytes / 1024 / 1024).toFixed(2)} MB, ${totalTriangles} triangles.`);
  console.log(`Manifest: lib/visual3d/generatedAssets.ts`);
}

main();