// SEMANTIC LAYOUT ENGINE.
//
// The AI never computes world coordinates for relationships. It says "heart is left_of lungs",
// "router is between client and server", "nucleus is inside cell", "electron orbits nucleus" and
// this module resolves actual 3D positions deterministically.
//
// Every relation resolves against object WORLD RADII (not unit scales), so a 2-unit skeleton and a
// 0.2-unit packet get sensible gaps, and every result feeds the camera framing in framing.ts.
import { ORBIT_RELATIONS_3D, PAIR_RELATIONS_3D, Vec3, Visual3DObject } from "./types";

export const RELATION_GAP = 0.65; // world units of clear space between two surfaces
export const NEAR_FACTOR = 1.15; // "near" sits close but does not overlap

function objectOf(objects: Visual3DObject[], id: string): Visual3DObject | undefined {
  return objects.find((object) => object.id === id);
}

function axisVector(axis: "x" | "y" | "z"): Vec3 {
  return axis === "x" ? { x: 1, y: 0, z: 0 } : axis === "y" ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
}

const DEFAULT_AXIS: Record<string, "x" | "y" | "z"> = {
  left_of: "x",
  right_of: "x",
  in_front_of: "z",
  behind: "z",
  above: "y",
  below: "y",
  attached_to: "y",
  connected_to: "x",
  near: "x",
  between: "x",
  inside: "y",
  around: "x",
  orbiting: "x",
  along_path: "x",
};

export type RelationResolution = { x: number; y: number; z: number } | null;

/**
 * Resolves the world position of `target` given its semantic relation.
 * `orbitRadius` is returned separately so the engine can attach continuous orbital motion.
 */
export function resolveRelation(
  target: Visual3DObject,
  objects: Visual3DObject[],
  gapMultiplier = 1,
): { position: Vec3; orbitRadius?: number } | null {
  const relation = target.relation;
  if (!relation || relation.objects.length === 0) return null;

  const references = relation.objects
    .map((id) => objectOf(objects, id))
    .filter((object): object is Visual3DObject => Boolean(object));
  if (references.length === 0) return null;

  const axis = relation.axis ?? DEFAULT_AXIS[relation.type] ?? "x";
  const gap = RELATION_GAP * gapMultiplier * (relation.gap ?? 1);
  const offset = relation.offset ?? 0;
  const targetRadius = target.radius;
  const referenced = references[0];
  // A part-anchored relation ("inside the cell wall") is measured from the real part bounds, so an
  // object attached to a small structure does not sit at the centre of a large model.
  const anchor = target.relationAnchor;
  const first = anchor && referenced
    ? {
      position: {
        x: referenced.position.x + anchor.offset.x,
        y: referenced.position.y + anchor.offset.y,
        z: referenced.position.z + anchor.offset.z,
      },
      radius: Math.max(anchor.radius, 0.04),
    }
    : referenced;
  if (!first) return null;
  const second = references[1];

  const along = (base: Vec3, radius: number, direction: 1 | -1): Vec3 => {
    const value = axis === "x" ? base.x : axis === "y" ? base.y : base.z;
    // BOTH radii matter. Offsetting only by the referenced object's radius ignores how big the moving
    // object is, so two radius-1 models ended up 1.65 units apart — 0.35 units INSIDE each other —
    // which is why a client, a router and a server rendered as one illegible pile.
    const next = value + direction * (radius + targetRadius + gap);
    return axis === "x"
      ? { x: next, y: base.y, z: base.z }
      : axis === "y"
        ? { x: base.x, y: next, z: base.z }
        : { x: base.x, y: base.y, z: next };
  };

  const perpendicularOffset = (base: Vec3): Vec3 => {
    // Offset the relation along the axis perpendicular to its own direction so parallel objects
    // (two lungs around a trachea, several plates along a boundary) never collide.
    if (offset === 0) return base;
    if (axis === "x") return { x: base.x, y: base.y + offset, z: base.z };
    if (axis === "y") return { x: base.x, y: base.y, z: base.z + offset };
    return { x: base.x + offset, y: base.y, z: base.z };
  };

  switch (relation.type) {
    case "left_of":
      return { position: perpendicularOffset(along(first.position, first.radius, -1)) };
    case "right_of":
      return { position: perpendicularOffset(along(first.position, first.radius, 1)) };
    case "in_front_of":
      return { position: perpendicularOffset(along(first.position, first.radius, -1)) };
    case "behind":
      return { position: perpendicularOffset(along(first.position, first.radius, 1)) };
    case "above":
      return { position: perpendicularOffset(along(first.position, first.radius, 1)) };
    case "below":
      return { position: perpendicularOffset(along(first.position, first.radius, -1)) };

    case "near": {
      const distance = (first.radius + targetRadius) * NEAR_FACTOR + gap;
      const dir = normalize(first.position);
      return { position: { x: first.position.x + dir.x * distance, y: first.position.y + dir.y * distance, z: first.position.z + dir.z * distance } };
    }

    case "attached_to":
      return { position: { x: first.position.x, y: first.position.y + first.radius + targetRadius + gap * 0.25, z: first.position.z } };

    case "connected_to": {
      const midpoint = {
        x: (first.position.x + (second?.position.x ?? first.position.x)) / 2,
        y: (first.position.y + (second?.position.y ?? first.position.y)) / 2,
        z: (first.position.z + (second?.position.z ?? first.position.z)) / 2,
      };
      return { position: perpendicularOffset(midpoint) };
    }

    case "between": {
      if (!second) return null;
      const midpoint = {
        x: (first.position.x + second.position.x) / 2,
        y: (first.position.y + second.position.y) / 2,
        z: (first.position.z + second.position.z) / 2,
      };
      return { position: perpendicularOffset(midpoint) };
    }

    case "along_path": {
      if (!second) return null;
      const t = Math.min(1, Math.max(0, (relation.gap ?? 1)));
      return {
        position: {
          x: first.position.x + (second.position.x - first.position.x) * t,
          y: first.position.y + (second.position.y - first.position.y) * t,
          z: first.position.z + (second.position.z - first.position.z) * t,
        },
      };
    }

    case "inside":
      return { position: { ...first.position } };

    case "around":
    case "orbiting": {
      const orbitRadius = Math.max(first.radius * 1.9 + targetRadius * 0.6, targetRadius * 2.4) + gap;
      return { position: { x: first.position.x + orbitRadius, y: first.position.y, z: first.position.z }, orbitRadius };
    }

    default:
      return null;
  }
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length < 1e-6) return { x: 1, y: 0, z: 0 };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/**
 * Automatic placement for objects the AI created without any relation: a deterministic golden-angle
 * spiral around the existing scene so a scene never stacks two objects on the same point and never
 * needs the AI to invent coordinates.
 */
/**
 * Where a newly created object goes when the teacher gave no placement.
 *
 * Two rules, in order:
 *
 * 1. A CONTAINER joins what it contains. A shell around a nucleus, a membrane around organelles, a
 *    bounding surface around a particle — these are concentric by definition, and there is no way to
 *    say so without coordinates. Falling through to the ring made every concentric composition
 *    impossible to write: an atom's shells were scattered 3-7 units apart, so "look at the nucleus"
 *    had nothing enclosing it to hold it in context, and the camera had no reason to pull back.
 *    The test is strict on size, so two equal peers (a client and a server) still separate.
 * 2. Everything else takes the next slot on a golden-angle ring, which keeps unrelated objects apart
 *    and is what "I made another thing and said nothing about where" should mean.
 */
export function autoPlacement(objects: Visual3DObject[], radius: number): Vec3 {
  const placed = objects.filter((object) => object.objectKind === "primitive" || object.objectKind === "model");
  if (placed.length === 0) return { x: 0, y: 0, z: 0 };
  for (const object of placed) {
    // Only a clearly LARGER object is a container. Equal-sized neighbours — a client and a server —
    // must still be pushed apart, and `distance + object.radius <= radius` is satisfied by two equal
    // spheres sharing a centre, so the size test has to come first and has to be strict.
    if (!Number.isFinite(radius) || radius < object.radius * 1.15) continue;
    const distance = Math.hypot(object.position.x, object.position.y, object.position.z);
    if (distance + object.radius <= radius) return { ...object.position };
  }
  const index = placed.length;
  const angle = index * 2.399963229728653; // golden angle
  const ring = 1.7 * radius + 0.9;
  const distance = ring * Math.sqrt(index / Math.max(1, placed.length) + 0.25);
  return {
    x: Math.cos(angle) * distance,
    y: (index % 3) * radius * 0.55,
    z: Math.sin(angle) * distance,
  };
}

/** Objects whose real position is driven by animation, so the relaxation must not place them. */
function isAnimated(object: Visual3DObject): boolean {
  return Boolean(object.orbit || object.oscillation || object.motion);
}

/**
 * Relations that PIN an object to a position defined by other objects. A router "between" a client and
 * a server IS the midpoint; if separation is allowed to move it, "between" silently becomes "beside"
 * and the lesson contradicts the words. When such an object needs more room, the room comes from
 * moving its references, which is exactly what a teacher rearranging a diagram would do.
 */
const PINNED_RELATIONS = new Set(["between", "connected_to", "inside", "around", "orbiting", "along_path"]);

function isPinned(object: Visual3DObject): boolean {
  return isAnimated(object) || PINNED_RELATIONS.has(object.relation?.type ?? "");
}

/** Deliberate co-location: one object inside another is a composition, not a collision. */
function intentionallyCoLocated(a: Visual3DObject, b: Visual3DObject): boolean {
  if (a.relation?.type === "inside" && a.relation.objects.includes(b.id)) return true;
  if (b.relation?.type === "inside" && b.relation.objects.includes(a.id)) return true;
  const distance = Math.hypot(a.position.x - b.position.x, a.position.y - b.position.y, a.position.z - b.position.z);
  // Whichever is larger encloses the smaller: concentric shells around one nucleus are intentional.
  const [big, small] = a.radius >= b.radius ? [a, b] : [b, a];
  return distance + small.radius <= big.radius;
}

function separationPartners(objects: Visual3DObject[]): Visual3DObject[] {
  // Only objects the AI placed with their own position participate. An orbiting electron or a moving
  // packet is drawn wherever its animation says, so pushing it would be undone on the next frame and
  // would drag the things around it out of place for nothing. Nor is anything whose position is
  // DEFINED by a relation to others: a router's job is to stay between the client and the server.
  return objects.filter((object) => !isPinned(object));
}

/**
 * MINIMUM-TRANSLATION SEPARATION.
 *
 * Semantic relations say what is NEXT to what; they do not promise there is room for it. "A router
 * between a client and a server" is only meaningful if the client and server are far enough apart to
 * admit a router, and nothing in the contract can know that in advance — the router's radius arrives
 * after its endpoints are already placed.
 *
 * So after relations resolve, genuinely overlapping objects are relaxed apart. The correction goes
 * along the axis of LEAST PENETRATION (the minimum translation vector): three objects in a row on the
 * x axis separate along x, while two objects sharing an x but differing in y separate along y.
 * Separating on every axis independently was wrong — it split a clean row of three in mid-air along
 * y and z, which had nothing to do with the collision it was supposed to fix.
 */
export function separateOverlappingObjects(objects: Visual3DObject[], sweeps = 4): Visual3DObject[] {
  const next = objects.map((object) => ({ ...object, position: { ...object.position } }));
  const movable = new Set(separationPartners(next).map((object) => object.id));
  if (movable.size < 2) return next;

  for (let sweep = 0; sweep < sweeps; sweep += 1) {
    let changed = false;
    const centreBefore = centroidOf(next);
    for (let i = 0; i < next.length; i += 1) {
      for (let j = i + 1; j < next.length; j += 1) {
        const a = next[i];
        const b = next[j];
        if (!relatedPair(a, b)) continue;
        if (!movable.has(a.id) && !movable.has(b.id)) continue;
        const deltas = {
          x: b.position.x - a.position.x,
          y: b.position.y - a.position.y,
          z: b.position.z - a.position.z,
        };
        const needed = a.radius + b.radius + RELATION_GAP;
        if (Math.hypot(deltas.x, deltas.y, deltas.z) >= needed) continue;
        // Least penetration: the axis that needs the smallest push to clear the gap.
        const axis = (["x", "y", "z"] as const).reduce((best, candidate) => (
          needed - Math.abs(deltas[candidate]) < needed - Math.abs(deltas[best]) ? candidate : best
        ), "x" as const);
        const correction = needed - Math.abs(deltas[axis]);
        const sign = deltas[axis] === 0 ? 1 : Math.sign(deltas[axis]);
        if (movable.has(b.id)) {
          b.position[axis] += correction * sign;
        } else {
          a.position[axis] -= correction * sign;
        }
        changed = true;
      }
    }
    if (!changed) break;
    // Relaxing a chain left to right drifts it sideways, so the group is re-centred on where it was.
    const centreAfter = centroidOf(next);
    for (const axis of ["x", "y", "z"] as const) {
      const shift = centreBefore[axis] - centreAfter[axis];
      if (Math.abs(shift) <= 1e-9) continue;
      for (const object of next) {
        if (movable.has(object.id)) object.position[axis] += shift;
      }
    }
  }
  return next;
}

/** True when two objects are meant to be neighbours, so an overlap is not worth fighting over. */
function relatedPair(a: Visual3DObject, b: Visual3DObject): boolean {
  if (intentionallyCoLocated(a, b)) return false;
  if (isAnimated(a) || isAnimated(b)) return false;
  return true;
}

function centroidOf(objects: Visual3DObject[]): Vec3 {
  if (objects.length === 0) return { x: 0, y: 0, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const object of objects) {
    x += object.position.x;
    y += object.position.y;
    z += object.position.z;
  }
  return { x: x / objects.length, y: y / objects.length, z: z / objects.length };
}

/** Resolves every relation in the scene; called after each batch of actions. */
export function resolveSceneLayout(scene: { objects: Visual3DObject[] }): Visual3DObject[] {
  let changed = true;
  let passes = 0;
  let objects = scene.objects.map((object) => ({ ...object }));
  while (changed && passes < 3) {
    changed = false;
    passes += 1;
    for (const object of objects) {
      if (!object.relation) continue;
      const resolved = resolveRelation(object, objects);
      if (!resolved) continue;
      if (
        Math.abs(resolved.position.x - object.position.x) > 1e-6 ||
        Math.abs(resolved.position.y - object.position.y) > 1e-6 ||
        Math.abs(resolved.position.z - object.position.z) > 1e-6
      ) {
        object.position = resolved.position;
        changed = true;
      }
    }
  }
  objects = separateOverlappingObjects(objects);
  return objects;
}

export const RELATION_HELP: Record<string, string> = {
  left_of: "place to the left of the referenced object(s)",
  right_of: "place to the right of the referenced object(s)",
  above: "place directly above the referenced object",
  below: "place directly below the referenced object",
  in_front_of: "place closer to the viewer than the referenced object",
  behind: "place further from the viewer than the referenced object",
  inside: "place at the centre of the referenced object (organelles inside a cell)",
  around: "place on a ring around the referenced object",
  between: "place at the midpoint of two referenced objects (router between client and server)",
  near: "place just beside the referenced object",
  connected_to: "place at the midpoint of the connection between the referenced objects",
  orbiting: "place on an orbit around the referenced object and keep orbiting it",
  attached_to: "place on top of the referenced object, touching it",
  along_path: "place at a fractional position along the line between two referenced objects",
};

export { PAIR_RELATIONS_3D, ORBIT_RELATIONS_3D };