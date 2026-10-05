// CONTAINMENT SHELLS.
//
// A 3D lesson that draws a containing surface — an atom's electron shell, a cell membrane, an orbit
// envelope, a container volume — must draw it so the student can still SEE what is inside. Drawn
// opaque, a single large sphere covers the entire stage and hides the nucleus, the organelles or the
// planet it was supposed to explain.
//
// Nothing in the AI contract says "this sphere is a shell", and it should not: whether a primitive
// encloses other things is a fact about the SCENE, so it is measured here deterministically from the
// positions and radii the engine already computed. The renderer then draws an enclosing surface as
// translucent glass instead of an opaque ball.
//
// Deliberately conservative — a shell is only reported when it genuinely encloses OTHER objects
// strictly inside its own volume, so an ordinary sphere, a planet or a molecule is never made
// see-through.

import { Visual3DObject } from "./types";

/** Solid primitives that can enclose a volume. Flat things (planes, lines, arrows) never can. */
const ENCLOSING_TYPES = new Set<string>(["sphere", "box", "cylinder"]);

/** Minimum enclosed objects before an enclosing surface is treated as a shell rather than a solid. */
const MIN_ENCLOSED = 1;

/**
 * Ids of primitives that enclose at least one other object.
 *
 * Containment is tested against the candidate's own bounding radius, so it uses exactly the radius
 * the camera framing and layout already trust. A self-match never counts, nested shells are allowed
 * (an atom's outer shell legitimately contains its inner shell as well as its nucleus), and the
 * enclosed object must fit ENTIRELY inside — never merely share a centre.
 */
export function shellObjectIds(objects: Visual3DObject[]): Set<string> {
  const shells = new Set<string>();
  if (objects.length < 2) return shells;

  for (const candidate of objects) {
    if (!ENCLOSING_TYPES.has(candidate.type)) continue;
    if (candidate.visible === false) continue;
    const radius = candidate.radius;
    if (!Number.isFinite(radius) || radius <= 0.05) continue;

    let enclosed = 0;
    for (const other of objects) {
      if (other.id === candidate.id) continue;
      if (other.visible === false) continue;
      // Only substantial objects count: a stray particle orbiting far outside is not "inside".
      if (!(other.radius > radius * 0.08)) continue;
      const dx = other.position.x - candidate.position.x;
      const dy = other.position.y - candidate.position.y;
      const dz = other.position.z - candidate.position.z;
      // Containment is tested on the enclosed object's own SIZE, not just its centre. Two spheres that
      // share a centre are not inside one another: the bigger one contains the smaller one, and the
      // smaller must never be made transparent because something larger happens to share its centre.
      if (Math.hypot(dx, dy, dz) + other.radius <= radius) enclosed += 1;
      if (enclosed >= MIN_ENCLOSED) break;
    }
    if (enclosed >= MIN_ENCLOSED) shells.add(candidate.id);
  }
  return shells;
}