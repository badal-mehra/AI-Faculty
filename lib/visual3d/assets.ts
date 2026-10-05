// TRUSTED 3D ASSET REGISTRY.
//
// The teaching model NEVER supplies a URL, a file path or WebGL code — it supplies an asset ID from
// this registry (or one of its aliases). The registry is a thin, typed layer over the generated
// model catalogue (lib/visual3d/generatedAssets.ts), which is produced from real binary glTF files in
// public/models/** by `npm run assets:build`.
//
// Adding an asset therefore means: build/extend its .glb, re-run the generator, and the runtime
// picks it up. The AI contract never changes, and the renderer learns nothing about the subject.

import { GENERATED_ASSETS, GeneratedAsset } from "./generatedAssets";
import { Object3DType, Vec3 } from "./types";

export type AssetAnchor = { center: Vec3; radius: number };

/** Measured, normalized bounds of the whole shipped model (models are normalized to radius 1). */
export type AssetBounds = { min: Vec3; max: Vec3; size: Vec3; radius: number };

export type AssetDescriptor = {
  id: string;
  category: string;
  name: string;
  /** Local, trusted path to the real .glb/.gltf model. Never model-supplied. */
  path: string;
  /** Documented procedural primitive used ONLY when the model cannot be loaded. */
  fallbackType: Object3DType;
  fallbackColor: string;
  defaultColor: string;
  /** Canonical world radius the model is normalized to (the generator normalizes every model to 1). */
  boundingRadius: number;
  /** Measured bounds of the shipped mesh, used to validate a load and to frame it without measurement. */
  bounds: AssetBounds;
  /** Number of authored meshes and materials (used by the asset-quality audit). */
  meshCount: number;
  materialCount: number;
  /** Camera distance that frames this asset at a comfortable size. */
  recommendedCameraDistance: number;
  defaultScale: number;
  /** Named parts inside the model the AI may highlight, label, focus or isolate. */
  semanticAnchors: string[];
  anchors: Record<string, AssetAnchor>;
  aliases: string[];
  triangles: number;
  partCount: number;
};

export type AssetCategory = "biology" | "physics" | "chemistry" | "earth" | "astronomy" | "network" | "computer-science" | "mathematics";

export const ASSET_CATEGORIES: AssetCategory[] = [
  "biology", "physics", "chemistry", "earth", "astronomy", "network", "computer-science", "mathematics",
];

// Human-readable category names used in the AI prompt and in diagnostics.
export const ASSET_CATEGORY_LABELS: Record<string, string> = {
  biology: "Biology & anatomy",
  physics: "Physics apparatus",
  chemistry: "Chemistry & molecules",
  earth: "Earth science",
  astronomy: "Astronomy",
  network: "Networking hardware",
  "computer-science": "Computer science hardware",
  mathematics: "Mathematics & geometry",
};

// Every asset is normalized to a bounding radius of 1 by the generator, so a single default scale
// works for a water molecule and for a skeleton. Bigger things get a slightly larger presence.
const DEFAULT_SCALE: Record<string, number> = {
  physics: 1.5,
  earth: 1.8,
  astronomy: 1.4,
  network: 1.1,
  "computer-science": 1.0,
  mathematics: 1.3,
  biology: 1.5,
  chemistry: 1.3,
};

const FALLBACK_TYPES = new Set<string>([
  "sphere", "box", "cylinder", "plane", "arrow", "particle", "tube", "line", "molecule", "text",
]);

function toDescriptor(asset: GeneratedAsset): AssetDescriptor {
  const anchors: Record<string, AssetAnchor> = {};
  for (const [name, part] of Object.entries(asset.anchors)) {
    anchors[name] = {
      center: { x: part.center[0], y: part.center[1], z: part.center[2] },
      radius: part.radius,
    };
  }
  return {
    id: asset.id,
    category: asset.category,
    name: asset.name,
    path: asset.path,
    fallbackType: (FALLBACK_TYPES.has(asset.fallbackType) ? asset.fallbackType : "sphere") as Object3DType,
    fallbackColor: asset.defaultColor,
    defaultColor: asset.defaultColor,
    boundingRadius: asset.boundingRadius,
    bounds: asset.bounds
      ? {
        min: { x: asset.bounds.min[0], y: asset.bounds.min[1], z: asset.bounds.min[2] },
        max: { x: asset.bounds.max[0], y: asset.bounds.max[1], z: asset.bounds.max[2] },
        size: { x: asset.bounds.size[0], y: asset.bounds.size[1], z: asset.bounds.size[2] },
        radius: asset.bounds.radius,
      }
      : { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 }, size: { x: 2, y: 2, z: 2 }, radius: 1 },
    meshCount: asset.meshCount ?? asset.partCount,
    materialCount: asset.materialCount ?? 0,
    recommendedCameraDistance: asset.recommendedCameraDistance,
    defaultScale: DEFAULT_SCALE[asset.category] ?? 1.2,
    semanticAnchors: asset.semanticAnchors,
    anchors,
    aliases: asset.aliases,
    triangles: asset.triangles,
    partCount: asset.partCount,
  };
}

const REGISTRY: Record<string, AssetDescriptor> = {};
const ALIASES: Record<string, string> = {};

for (const asset of GENERATED_ASSETS) {
  REGISTRY[asset.id] = toDescriptor(asset);
}

// Alias table: "heart" -> "biology/heart", "3-way handshake" style prose never reaches this layer,
// but a model that writes a natural id instead of a category id still resolves.
for (const asset of Object.values(REGISTRY)) {
  ALIASES[normalizeKey(asset.id)] = asset.id;
  for (const alias of asset.aliases) ALIASES[normalizeKey(alias)] = asset.id;
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function getAsset(id: string): AssetDescriptor | undefined {
  const canonical = resolveAssetId(id);
  return canonical ? REGISTRY[canonical] : undefined;
}

/** Resolves an id or alias to a canonical asset id, or undefined. */
export function resolveAssetId(id: string | undefined | null): string | undefined {
  if (typeof id !== "string") return undefined;
  const direct = REGISTRY[id];
  if (direct) return direct.id;
  return ALIASES[normalizeKey(id)];
}

export function resolveAsset(id: string | undefined | null): AssetDescriptor | undefined {
  const canonical = resolveAssetId(id);
  return canonical ? REGISTRY[canonical] : undefined;
}

export function isAssetKnown(id: string): boolean {
  return resolveAssetId(id) !== undefined;
}

/** True when the asset has a real model file (every generated asset does). */
export function hasModelFile(id: string): boolean {
  const asset = resolveAsset(id);
  return Boolean(asset && typeof asset.path === "string" && asset.path.startsWith("/models/") && asset.path.endsWith(".glb"));
}

export function listAssets(): AssetDescriptor[] {
  return Object.values(REGISTRY);
}

export function listAssetIds(): string[] {
  return Object.keys(REGISTRY);
}

export function getAssetsByCategory(category: string): AssetDescriptor[] {
  return listAssets().filter((asset) => asset.category === category);
}

/** Compact catalog used by the AI prompt: category -> "id (aliases) — name". */
export function assetCatalogText(): string {
  const lines: string[] = [];
  for (const category of ASSET_CATEGORIES) {
    const assets = getAssetsByCategory(category);
    if (assets.length === 0) continue;
    lines.push(`${ASSET_CATEGORY_LABELS[category] ?? category}:`);
    for (const asset of assets) {
      const parts = asset.semanticAnchors.length > 0
        ? `  [parts: ${asset.semanticAnchors.slice(0, 10).join(", ")}${asset.semanticAnchors.length > 10 ? ", …" : ""}]`
        : "";
      lines.push(`  ${asset.id}  (also: ${asset.aliases.join(", ") || asset.id})  — ${asset.name}${parts}`);
    }
  }
  return lines.join("\n");
}

/** Allows an additional trusted descriptor (for example a remote model) to be registered at runtime. */
export function registerAsset(descriptor: AssetDescriptor): void {
  REGISTRY[descriptor.id] = descriptor;
  ALIASES[normalizeKey(descriptor.id)] = descriptor.id;
  for (const alias of descriptor.aliases) ALIASES[normalizeKey(alias)] = descriptor.id;
}

export function getAssetRegistry(): Record<string, AssetDescriptor> {
  return { ...REGISTRY };
}