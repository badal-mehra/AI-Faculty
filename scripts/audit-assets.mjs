// ASSET QUALITY AUDIT — categorizes every shipped GLB for EDUCATIONAL VISUAL FIDELITY.
//
//   node scripts/audit-assets.mjs            # summary + the C/D list
//   node scripts/audit-assets.mjs --all      # every asset with its grade
//   node scripts/audit-assets.mjs --json     # machine-readable report
//
// "Valid" is not the same as "good". A model can parse, carry sensible anchors and still be a
// handful of generic primitives that teaches nothing. This audit measures, for every asset:
//
//   parts       distinct named structures the AI can isolate / label / focus
//   materials   distinct colours, i.e. how visually differentiated the structures are
//   meshes      authored meshes (one per part)
//   triangles   geometric richness
//   radius      normalized bounding radius (the model must be ~1)
//
// and grades them:
//
//   A  visually strong / educationally recognizable — several differentiated structures
//   B  acceptable but improvable
//   C  primitive / poor educational representation
//   D  broken / unusable
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "lib", "visual3d", "generatedAssets.ts"), "utf8");
const match = source.match(/export const GENERATED_ASSETS: GeneratedAsset\[\] = (\[[\s\S]*?\]);\n\nexport const GENERATED_ASSETS_BY_ID/);
if (!match) {
  console.error("Could not read GENERATED_ASSETS from lib/visual3d/generatedAssets.ts — run `npm run assets:build` first.");
  process.exit(2);
}
const assets = JSON.parse(match[1]);

// A part name is "semantic" when it is a real structure rather than a numbered decoration. Explicitly
// numbered sequences (alveolus_1, electron_2_3, ribosome_4, port_7) still count as points of interest,
// but an asset built ONLY from numbered variants of one concept is much weaker than one with several
// differently-named structures.
function distinctConcepts(anchors) {
  const concepts = new Set();
  for (const name of anchors) {
    concepts.add(name.replace(/[_-]?\d+[a-z]?$/i, "").replace(/_\d+_\d+$/, ""));
  }
  return concepts.size;
}

// Some subjects are intrinsically simple: a cube IS a cube, a planet IS a sphere. Those assets must
// not be graded "poor" for being faithful. Complexity is expected only where the subject is complex.
const INTRINSIC = {
  // A single clean solid with measurement annotations is the correct teaching representation.
  simple: new Set([
    "mathematics/cube", "mathematics/sphere", "mathematics/cone", "mathematics/cylinder",
    "mathematics/torus", "mathematics/pyramid", "mathematics/frustum", "mathematics/rectangular-prism",
    "mathematics/triangular-prism", "mathematics/polygon-prism", "mathematics/parallelepiped",
    "mathematics/vector", "mathematics/vector-sum", "mathematics/coordinate-system",
    "mathematics/unit-circle", "mathematics/grid-plane", "mathematics/wave-surface",
    "astronomy/mercury", "astronomy/venus", "astronomy/mars", "astronomy/jupiter", "astronomy/saturn",
    "astronomy/uranus", "astronomy/neptune", "astronomy/moon", "astronomy/comet",
    "earth/water-droplet", "earth/cloud", "chemistry/periodic-tile",
    "network/packet", "computer-science/stack-block", "computer-science/linked-list-node",
    "computer-science/data-structure",
  ]),
  // A complex subject sitting on a single uniform body: real internal structure is required.
  complex: new Set([
    "biology/heart", "biology/brain", "biology/lungs", "biology/cell", "biology/plant-cell",
    "biology/dna", "biology/neuron", "biology/digestive-system", "biology/kidney", "biology/skin",
    "biology/blood-cell", "biology/blood-vessel", "biology/white-blood-cell", "biology/muscle",
    "chemistry/atom", "chemistry/crystal-lattice", "chemistry/titration-setup",
    "network/router", "network/switch", "network/server", "network/laptop", "network/firewall",
    "computer-science/cpu", "computer-science/memory",
    "physics/circuit-board", "physics/piston-engine", "physics/gear", "physics/pulley",
  ]),
};

function grade(asset) {
  const parts = asset.partCount ?? (asset.semanticAnchors?.length ?? 0);
  const materials = asset.materialCount ?? 0;
  const triangles = asset.triangles ?? 0;
  const meshes = asset.meshCount ?? parts;
  const radius = asset.bounds?.radius ?? asset.boundingRadius ?? 0;
  const concepts = distinctConcepts(asset.semanticAnchors ?? []);
  const stats = { parts, materials, triangles, meshes, radius, concepts };

  if (meshes === 0) return { grade: "D", reasons: ["no authored meshes"], ...stats };

  if (INTRINSIC.simple.has(asset.id)) {
    // Faithful by construction: a clean solid/disc with at least one annotation or feature detail.
    if (parts >= 2 && triangles >= 24) return { grade: "A", reasons: ["intrinsically simple subject, cleanly modelled with annotations"], ...stats };
    return { grade: "B", reasons: ["intrinsically simple subject, minimal detail"], ...stats };
  }

  const strong = parts >= 6 && concepts >= 4 && materials >= 3 && triangles >= 2000;
  const solid = parts >= 4 && concepts >= 3 && triangles >= 600;
  if (strong) return { grade: "A", reasons: [`${concepts} distinct structures, ${materials} materials, ${triangles} tris`], ...stats };
  if (solid) return { grade: "B", reasons: [`${concepts} distinct structures, ${materials} materials, ${triangles} tris`], ...stats };
  const expected = INTRINSIC.complex.has(asset.id);
  return {
    grade: "C",
    reasons: [
      `${parts} parts (${concepts} distinct structure${concepts === 1 ? "" : "s"}), ${materials} materials, ${triangles} tris` +
      (expected ? " — a complex subject represented too simply" : ""),
    ],
    ...stats,
  };
}

const report = assets.map((asset) => {
  const verdict = grade(asset);
  return {
    id: asset.id,
    category: asset.category,
    name: asset.name,
    path: asset.path,
    partCount: verdict.parts,
    concepts: verdict.concepts,
    materialCount: verdict.materials,
    meshCount: verdict.meshes,
    triangles: verdict.triangles,
    radius: Number((verdict.radius ?? 0).toFixed(4)),
    anchors: asset.semanticAnchors ?? [],
    grade: verdict.grade,
    reasons: verdict.reasons,
  };
});

const counts = { A: 0, B: 0, C: 0, D: 0 };
for (const entry of report) counts[entry.grade] += 1;

const showAll = process.argv.includes("--all");
const asJson = process.argv.includes("--json");

if (asJson) {
  console.log(JSON.stringify({ counts, total: report.length, assets: report }, null, 2));
} else {
  console.log("ASSET QUALITY REPORT");
  console.log(`  audited: ${report.length} GLB assets`);
  console.log(`  A: ${counts.A}   B: ${counts.B}   C: ${counts.C}   D: ${counts.D}`);
  const byCategory = {};
  for (const entry of report) {
    byCategory[entry.category] = byCategory[entry.category] ?? { A: 0, B: 0, C: 0, D: 0 };
    byCategory[entry.category][entry.grade] += 1;
  }
  console.log("\n  by category:");
  for (const [category, tally] of Object.entries(byCategory).sort()) {
    console.log(`    ${category.padEnd(18)} A:${tally.A} B:${tally.B} C:${tally.C} D:${tally.D}`);
  }
  const weak = report.filter((entry) => entry.grade === "C" || entry.grade === "D");
  console.log(`\n  needs work (C/D) — ${weak.length}:`);
  for (const entry of weak.sort((a, b) => a.grade.localeCompare(b.grade) || a.triangles - b.triangles)) {
    console.log(`    ${entry.grade}  ${entry.id.padEnd(34)} ${String(entry.triangles).padStart(6)} tris  ${entry.reasons[0]}`);
  }
  if (showAll) {
    console.log("\n  every asset:");
    for (const entry of report.sort((a, b) => a.grade.localeCompare(b.grade) || a.id.localeCompare(b.id))) {
      console.log(`    ${entry.grade}  ${entry.id.padEnd(34)} ${String(entry.triangles).padStart(6)} tris  parts=${entry.partCount} mats=${entry.materialCount}`);
    }
  }
}
process.exit(counts.D > 0 ? 1 : 0);