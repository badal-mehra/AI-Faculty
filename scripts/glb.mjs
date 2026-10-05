// Minimal binary glTF 2.0 (.glb) writer + geometry toolkit.
//
// Written from the glTF 2.0 specification (Buffer/BufferView/Accessor/Mesh/Node/Material).
// A "geom" here is a plain triple of JS arrays: { positions:[x,y,z,...], normals:[x,y,z,...], indices:[...] }.
// Everything is unitless and metric; callers compose geoms with transform/merge.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const CHUNK_BIN = 0x004e4942; // 'BIN\0'

export function geom() {
  return { positions: [], normals: [], indices: [] };
}

export function emptyBounds() {
  return {
    min: [Infinity, Infinity, Infinity],
    max: [-Infinity, -Infinity, -Infinity],
  };
}

export function extendBounds(bounds, positions) {
  for (let i = 0; i < positions.length; i += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[i + axis];
      if (value < bounds.min[axis]) bounds.min[axis] = value;
      if (value > bounds.max[axis]) bounds.max[axis] = value;
    }
  }
  return bounds;
}

export function boundsSize(bounds) {
  return [bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]];
}

export function boundsCenter(bounds) {
  return [
    (bounds.min[0] + bounds.max[0]) / 2,
    (bounds.min[1] + bounds.max[1]) / 2,
    (bounds.min[2] + bounds.max[2]) / 2,
  ];
}

export function boundsRadius(bounds) {
  const size = boundsSize(bounds);
  return Math.sqrt(size[0] * size[0] + size[1] * size[1] + size[2] * size[2]) / 2;
}

export function transform(source, { translate = [0, 0, 0], rotate = [0, 0, 0], scale = [1, 1, 1] } = {}) {
  const [rx, ry, rz] = rotate;
  const cosX = Math.cos(rx);
  const sinX = Math.sin(rx);
  const cosY = Math.cos(ry);
  const sinY = Math.sin(ry);
  const cosZ = Math.cos(rz);
  const sinZ = Math.sin(rz);
  const out = geom();
  for (let i = 0; i < source.positions.length; i += 3) {
    let x = source.positions[i] * scale[0];
    let y = source.positions[i + 1] * scale[1];
    let z = source.positions[i + 2] * scale[2];
    // X
    let ny = y * cosX - z * sinX;
    let nz = y * sinX + z * cosX;
    y = ny; z = nz;
    // Y
    let nx = x * cosY + z * sinY;
    nz = -x * sinY + z * cosY;
    x = nx; z = nz;
    // Z
    nx = x * cosZ - y * sinZ;
    ny = x * sinZ + y * cosZ;
    x = nx; y = ny;
    out.positions.push(x + translate[0], y + translate[1], z + translate[2]);
  }
  for (let i = 0; i < source.normals.length; i += 3) {
    let nx = source.normals[i] / scale[0];
    let ny = source.normals[i + 1] / scale[1];
    let nz = source.normals[i + 2] / scale[2];
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len; ny /= len; nz /= len;
    let ty = ny * cosX - nz * sinX;
    let tz = ny * sinX + nz * cosX;
    ny = ty; nz = tz;
    let tx = nx * cosY + nz * sinY;
    tz = -nx * sinY + nz * cosY;
    nx = tx; nz = tz;
    tx = nx * cosZ - ny * sinZ;
    ty = nx * sinZ + ny * cosZ;
    nx = tx; ny = ty;
    out.normals.push(nx, ny, nz);
  }
  out.indices = source.indices.slice();
  return out;
}

export function merge(parts) {
  const out = geom();
  for (const part of parts) {
    if (!part) continue;
    const offset = out.positions.length / 3;
    for (let i = 0; i < part.positions.length; i += 1) out.positions.push(part.positions[i]);
    for (let i = 0; i < part.normals.length; i += 1) out.normals.push(part.normals[i]);
    for (let i = 0; i < part.indices.length; i += 1) out.indices.push(part.indices[i] + offset);
  }
  return out;
}

export function recomputeNormals(source) {
  const out = geom();
  out.positions = source.positions.slice();
  out.indices = source.indices.slice();
  const normals = new Array(source.positions.length).fill(0);
  for (let i = 0; i < source.indices.length; i += 3) {
    const a = source.indices[i] * 3;
    const b = source.indices[i + 1] * 3;
    const c = source.indices[i + 2] * 3;
    const ax = source.positions[a], ay = source.positions[a + 1], az = source.positions[a + 2];
    const bx = source.positions[b], by = source.positions[b + 1], bz = source.positions[b + 2];
    const cx = source.positions[c], cy = source.positions[c + 1], cz = source.positions[c + 2];
    const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
    const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
    const fx = e1y * e2z - e1z * e2y;
    const fy = e1z * e2x - e1x * e2z;
    const fz = e1x * e2y - e1y * e2x;
    for (const base of [a, b, c]) {
      normals[base] += fx; normals[base + 1] += fy; normals[base + 2] += fz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const len = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
    out.normals.push(normals[i] / len, normals[i + 1] / len, normals[i + 2] / len);
  }
  return out;
}

export function box(width, height, depth) {
  const g = geom();
  const hx = width / 2, hy = height / 2, hz = depth / 2;
  const faces = [
    { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
    { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
    { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
    { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
    { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
    { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
  ];
  for (const face of faces) {
    const base = g.positions.length / 3;
    for (const v of face.v) {
      g.positions.push(v[0], v[1], v[2]);
      g.normals.push(face.n[0], face.n[1], face.n[2]);
    }
    g.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }
  return g;
}

export function sphere(radius, widthSegments = 32, heightSegments = 20) {
  const g = geom();
  for (let iy = 0; iy <= heightSegments; iy += 1) {
    const v = iy / heightSegments;
    const phi = v * Math.PI;
    for (let ix = 0; ix <= widthSegments; ix += 1) {
      const u = ix / widthSegments;
      const theta = u * Math.PI * 2;
      const x = -Math.cos(theta) * Math.sin(phi);
      const y = Math.cos(phi);
      const z = Math.sin(theta) * Math.sin(phi);
      g.positions.push(x * radius, y * radius, z * radius);
      g.normals.push(x, y, z);
    }
  }
  const grid = widthSegments + 1;
  for (let iy = 0; iy < heightSegments; iy += 1) {
    for (let ix = 0; ix < widthSegments; ix += 1) {
      const a = iy * grid + ix;
      const b = iy * grid + ix + 1;
      const c = (iy + 1) * grid + ix;
      const d = (iy + 1) * grid + ix + 1;
      if (iy !== 0) g.indices.push(a, c, b);
      if (iy !== heightSegments - 1) g.indices.push(b, c, d);
    }
  }
  return g;
}

export function cylinder(radiusTop, radiusBottom, height, radialSegments = 28, capped = true) {
  const g = geom();
  const halfHeight = height / 2;
  for (let y = 0; y <= 1; y += 1) {
    const radius = y === 0 ? radiusBottom : radiusTop;
    const py = y === 0 ? -halfHeight : halfHeight;
    for (let i = 0; i <= radialSegments; i += 1) {
      const theta = (i / radialSegments) * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      g.positions.push(radius * sin, py, radius * cos);
      g.normals.push(sin, 0, cos);
    }
  }
  for (let i = 0; i < radialSegments; i += 1) {
    const a = i;
    const b = i + 1;
    const c = radialSegments + 1 + i;
    const d = radialSegments + 1 + i + 1;
    g.indices.push(a, c, b, b, c, d);
  }
  if (capped) {
    if (radiusTop > 0) {
      const centerIndex = g.positions.length / 3;
      g.positions.push(0, halfHeight, 0);
      g.normals.push(0, 1, 0);
      const ringStart = g.positions.length / 3;
      for (let i = 0; i <= radialSegments; i += 1) {
        const theta = (i / radialSegments) * Math.PI * 2;
        g.positions.push(radiusTop * Math.sin(theta), halfHeight, radiusTop * Math.cos(theta));
        g.normals.push(0, 1, 0);
      }
      for (let i = 0; i < radialSegments; i += 1) {
        g.indices.push(centerIndex, ringStart + i, ringStart + i + 1);
      }
    }
    if (radiusBottom > 0) {
      const centerIndex = g.positions.length / 3;
      g.positions.push(0, -halfHeight, 0);
      g.normals.push(0, -1, 0);
      const ringStart = g.positions.length / 3;
      for (let i = 0; i <= radialSegments; i += 1) {
        const theta = (i / radialSegments) * Math.PI * 2;
        g.positions.push(radiusBottom * Math.sin(theta), -halfHeight, radiusBottom * Math.cos(theta));
        g.normals.push(0, -1, 0);
      }
      for (let i = 0; i < radialSegments; i += 1) {
        g.indices.push(centerIndex, ringStart + i + 1, ringStart + i);
      }
    }
  }
  return g;
}

export function cone(radius, height, radialSegments = 28) {
  return cylinder(0, radius, height, radialSegments, true);
}

export function torus(radius, tube, radialSegments = 32, tubularSegments = 18, arc = Math.PI * 2) {
  const g = geom();
  for (let j = 0; j <= radialSegments; j += 1) {
    for (let i = 0; i <= tubularSegments; i += 1) {
      const u = (i / tubularSegments) * arc;
      const v = (j / radialSegments) * Math.PI * 2;
      const cx = radius * Math.cos(u);
      const cz = radius * Math.sin(u);
      const x = (radius + tube * Math.cos(v)) * Math.cos(u);
      const z = (radius + tube * Math.cos(v)) * Math.sin(u);
      const y = tube * Math.sin(v);
      g.positions.push(x, y, z);
      g.normals.push(Math.cos(u) * Math.cos(v), Math.sin(v), Math.sin(u) * Math.cos(v));
      void cx; void cz;
    }
  }
  const grid = tubularSegments + 1;
  for (let j = 0; j < radialSegments; j += 1) {
    for (let i = 0; i < tubularSegments; i += 1) {
      const a = j * grid + i;
      const b = j * grid + i + 1;
      const c = (j + 1) * grid + i;
      const d = (j + 1) * grid + i + 1;
      g.indices.push(a, c, b, b, c, d);
    }
  }
  return g;
}

// Catmull-Rom interpolation through the control points, resampled to `samples` positions.
export function samplePath(points, samples) {
  const pts = points.map((p) => [p[0], p[1], p[2]]);
  if (pts.length === 2) {
    const out = [];
    for (let i = 0; i < samples; i += 1) {
      const t = i / (samples - 1);
      out.push([
        pts[0][0] + (pts[1][0] - pts[0][0]) * t,
        pts[0][1] + (pts[1][1] - pts[0][1]) * t,
        pts[0][2] + (pts[1][2] - pts[0][2]) * t,
      ]);
    }
    return out;
  }
  const get = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
  const out = [];
  const segments = pts.length - 1;
  for (let s = 0; s < samples; s += 1) {
    const u = (s / (samples - 1)) * segments;
    const i = Math.min(segments - 1, Math.floor(u));
    const t = u - i;
    const p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    const t2 = t * t;
    const t3 = t2 * t;
    const out3 = [];
    for (let axis = 0; axis < 3; axis += 1) {
      const a = -0.5 * p0[axis] + 1.5 * p1[axis] - 1.5 * p2[axis] + 0.5 * p3[axis];
      const b = p0[axis] - 2.5 * p1[axis] + 2 * p2[axis] - 0.5 * p3[axis];
      const c = -0.5 * p0[axis] + 0.5 * p2[axis];
      out3.push(a * t3 + b * t2 + c * t + p1[axis]);
    }
    out.push(out3);
  }
  return out;
}

function frames(points) {
  const tangents = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const t = [next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]];
    const len = Math.hypot(t[0], t[1], t[2]) || 1;
    tangents.push([t[0] / len, t[1] / len, t[2] / len]);
  }
  let normal = Math.abs(tangents[0][1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const framesOut = [];
  for (const tangent of tangents) {
    const dot = normal[0] * tangent[0] + normal[1] * tangent[1] + normal[2] * tangent[2];
    let n = [normal[0] - tangent[0] * dot, normal[1] - tangent[1] * dot, normal[2] - tangent[2] * dot];
    let len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-6) { n = [1, 0, 0]; len = 1; }
    n = [n[0] / len, n[1] / len, n[2] / len];
    const binormal = [
      tangent[1] * n[2] - tangent[2] * n[1],
      tangent[2] * n[0] - tangent[0] * n[2],
      tangent[0] * n[1] - tangent[1] * n[0],
    ];
    framesOut.push({ normal: n, binormal });
    normal = n;
  }
  return framesOut;
}

export function tube(points, radius, radialSegments = 12, capEnds = false) {
  const sampled = samplePath(points, Math.max(12, Math.min(160, points.length * 12)));
  const frameList = frames(sampled);
  const g = geom();
  for (let i = 0; i < sampled.length; i += 1) {
    const p = sampled[i];
    const { normal, binormal } = frameList[i];
    for (let j = 0; j <= radialSegments; j += 1) {
      const theta = (j / radialSegments) * Math.PI * 2;
      const cos = Math.cos(theta);
      const sin = Math.sin(theta);
      const nx = normal[0] * cos + binormal[0] * sin;
      const ny = normal[1] * cos + binormal[1] * sin;
      const nz = normal[2] * cos + binormal[2] * sin;
      g.positions.push(p[0] + nx * radius, p[1] + ny * radius, p[2] + nz * radius);
      g.normals.push(nx, ny, nz);
    }
  }
  const grid = radialSegments + 1;
  for (let i = 0; i < sampled.length - 1; i += 1) {
    for (let j = 0; j < radialSegments; j += 1) {
      const a = i * grid + j;
      const b = i * grid + j + 1;
      const c = (i + 1) * grid + j;
      const d = (i + 1) * grid + j + 1;
      g.indices.push(a, c, b, b, c, d);
    }
  }
  if (capEnds) {
    for (const [index, sign] of [[0, -1], [sampled.length - 1, 1]]) {
      const p = sampled[index];
      const { normal, binormal } = frameList[index];
      const tangentGuess = index === 0
        ? [sampled[1][0] - p[0], sampled[1][1] - p[1], sampled[1][2] - p[2]]
        : [p[0] - sampled[index - 1][0], p[1] - sampled[index - 1][1], p[2] - sampled[index - 1][2]];
      const tl = Math.hypot(tangentGuess[0], tangentGuess[1], tangentGuess[2]) || 1;
      const tangent = [tangentGuess[0] / tl, tangentGuess[1] / tl, tangentGuess[2] / tl];
      const centerIndex = g.positions.length / 3;
      g.positions.push(p[0], p[1], p[2]);
      g.normals.push(tangent[0] * sign, tangent[1] * sign, tangent[2] * sign);
      const ringStart = g.positions.length / 3;
      for (let j = 0; j <= radialSegments; j += 1) {
        const theta = (j / radialSegments) * Math.PI * 2;
        const cos = Math.cos(theta);
        const sin = Math.sin(theta);
        const nx = normal[0] * cos + binormal[0] * sin;
        const ny = normal[1] * cos + binormal[1] * sin;
        const nz = normal[2] * cos + binormal[2] * sin;
        g.positions.push(p[0] + nx * radius, p[1] + ny * radius, p[2] + nz * radius);
        g.normals.push(tangent[0] * sign, tangent[1] * sign, tangent[2] * sign);
      }
      for (let j = 0; j < radialSegments; j += 1) {
        if (sign > 0) g.indices.push(centerIndex, ringStart + j, ringStart + j + 1);
        else g.indices.push(centerIndex, ringStart + j + 1, ringStart + j);
      }
    }
  }
  return g;
}

// Revolve a 2D profile ([[radius, y], ...]) around the Y axis.
export function lathe(profile, segments = 32, arc = Math.PI * 2) {
  const g = geom();
  for (let i = 0; i <= segments; i += 1) {
    const theta = (i / segments) * arc;
    const sin = Math.sin(theta);
    const cos = Math.cos(theta);
    for (let j = 0; j < profile.length; j += 1) {
      const [r, y] = profile[j];
      const prev = profile[Math.max(0, j - 1)];
      const next = profile[Math.min(profile.length - 1, j + 1)];
      const dr = next[0] - prev[0];
      const dy = next[1] - prev[1];
      const len = Math.hypot(dr, dy) || 1;
      const nr = dy / len;
      const ny = -dr / len;
      g.positions.push(r * sin, y, r * cos);
      g.normals.push(nr * sin, ny, nr * cos);
    }
  }
  for (let i = 0; i < segments; i += 1) {
    for (let j = 0; j < profile.length - 1; j += 1) {
      const a = i * profile.length + j;
      const b = i * profile.length + j + 1;
      const c = (i + 1) * profile.length + j;
      const d = (i + 1) * profile.length + j + 1;
      g.indices.push(a, c, b, b, c, d);
    }
  }
  return g;
}

export function plane(width, depth, segments = 1) {
  const g = geom();
  for (let iz = 0; iz <= segments; iz += 1) {
    for (let ix = 0; ix <= segments; ix += 1) {
      g.positions.push((ix / segments - 0.5) * width, 0, (iz / segments - 0.5) * depth);
      g.normals.push(0, 1, 0);
    }
  }
  const grid = segments + 1;
  for (let iz = 0; iz < segments; iz += 1) {
    for (let ix = 0; ix < segments; ix += 1) {
      const a = iz * grid + ix;
      const b = a + 1;
      const c = (iz + 1) * grid + ix;
      const d = c + 1;
      g.indices.push(a, c, b, b, c, d);
    }
  }
  return g;
}

export function ellipsoid(rx, ry, rz, widthSegments = 28, heightSegments = 18) {
  return transform(sphere(1, widthSegments, heightSegments), { scale: [rx, ry, rz] });
}

export function roundedBox(width, height, depth, radius, segments = 4) {
  const inner = box(width - radius * 2, height - radius * 2, depth - radius * 2);
  const parts = [inner];
  const hx = width / 2 - radius;
  const hy = height / 2 - radius;
  const hz = depth / 2 - radius;
  const corners = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) corners.push([sx, sy, sz]);
  const sphereGeom = sphere(radius, 16, 12);
  for (const [sx, sy, sz] of corners) {
    parts.push(transform(sphereGeom, { translate: [sx * hx, sy * hy, sz * hz] }));
  }
  const faceCount = 6;
  const faceParts = [];
  void faceCount;
  void faceParts;
  return merge(parts);
}

export function shell(radius, thickness, segments = 40) {
  return lathe([
    [radius, -thickness / 2],
    [radius + thickness, -thickness / 2],
    [radius + thickness, thickness / 2],
    [radius, thickness / 2],
    [radius, -thickness / 2],
  ], segments);
}

// Deterministic value noise, so every build produces byte-identical geometry.
function hash3(x, y, z, seed) {
  let h = Math.imul(Math.floor(x * 1000) ^ Math.imul(Math.floor(y * 1000), 73856093) ^ Math.imul(Math.floor(z * 1000), 19349663) ^ seed, 2246822519);
  h = Math.imul(h ^ (h >>> 15), 3266489917);
  h = Math.imul(h ^ (h >>> 13), 668265263);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export function displace(positions, amount, frequency, seed = 1) {
  const out = positions.slice();
  for (let i = 0; i < out.length; i += 3) {
    const n = hash3(out[i] * frequency, out[i + 1] * frequency, out[i + 2] * frequency, seed) * 2 - 1;
    out[i] += n * amount;
    out[i + 1] += n * amount;
    out[i + 2] += n * amount;
  }
  return out;
}

export function displacedSphere(radius, amount, frequency, seed, widthSegments = 40, heightSegments = 24) {
  const g = sphere(radius, widthSegments, heightSegments);
  g.positions = displace(g.positions, amount, frequency, seed);
  return recomputeNormals(g);
}

// A cone/wedge ramp used for inclined planes.
export function wedge(width, height, depth) {
  const g = geom();
  const hx = width / 2, hz = depth / 2;
  const v = [
    [-hx, 0, hz], [hx, 0, hz], [hx, 0, -hz], [-hx, 0, -hz],
    [-hx, height, -hz], [hx, height, -hz],
  ];
  const faces = [
    { idx: [0, 1, 2, 3] },
    { idx: [3, 2, 5, 4] },
    { idx: [0, 4, 5, 1] },
    { idx: [0, 3, 4] },
    { idx: [1, 5, 2] },
  ];
  for (const face of faces) {
    const base = g.positions.length / 3;
    for (const index of face.idx) g.positions.push(v[index][0], v[index][1], v[index][2]);
    for (let i = 1; i < face.idx.length - 1; i += 1) g.indices.push(base, base + i, base + i + 1);
  }
  return recomputeNormals(g);
}

// Builds the .glb ArrayBuffer from named parts.
// part: { name, geom, material: { color:[r,g,b,a?], roughness?, metallic?, emissive? } }
export function buildGlb(parts, { generator = "AI Faculty educational model generator" } = {}) {
  const buffers = [];
  let byteLength = 0;
  const push = (typedArray) => {
    const bytes = new Uint8Array(typedArray.buffer, typedArray.byteOffset, typedArray.byteLength);
    const padding = (4 - (byteLength % 4)) % 4;
    if (padding > 0) { buffers.push(new Uint8Array(padding)); byteLength += padding; }
    buffers.push(bytes);
    const view = { buffer: 0, byteOffset: byteLength, byteLength: bytes.byteLength };
    byteLength += bytes.byteLength;
    return view;
  };

  const materials = [];
  const materialIndex = new Map();
  const addMaterial = (material) => {
    const key = JSON.stringify(material);
    if (materialIndex.has(key)) return materialIndex.get(key);
    const [r, g, b, a = 1] = material.color ?? [0.8, 0.8, 0.8, 1];
    const index = materials.length;
    materials.push({
      name: `mat_${index}`,
      doubleSided: false,
      pbrMetallicRoughness: {
        baseColorFactor: [r, g, b, a],
        metallicFactor: material.metallic ?? 0,
        roughnessFactor: material.roughness ?? 0.6,
        ...((material.emissive ?? [0, 0, 0]).some((v) => v > 0)
          ? { emissiveFactor: material.emissive }
          : {}),
      },
      ...(a < 1 ? { alphaMode: "BLEND" } : {}),
    });
    materialIndex.set(key, index);
    return index;
  };

  const accessors = [];
  const bufferViews = [];
  const meshes = [];
  const nodes = [];
  const partMeta = [];

  for (const part of parts) {
    let source = part.geom;
    if (part.recompute) source = recomputeNormals(source);
    const vertexCount = source.positions.length / 3;
    if (vertexCount === 0 || source.indices.length === 0) continue;
    const positions = new Float32Array(source.positions);
    const normals = new Float32Array(source.normals);
    const IndexArray = vertexCount > 65535 ? Uint32Array : Uint16Array;
    const indices = new IndexArray(source.indices);

    const positionView = push(positions);
    const normalView = push(normals);
    const indexView = push(indices);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < positions.length; i += 3) {
      for (let axis = 0; axis < 3; axis += 1) {
        min[axis] = Math.min(min[axis], positions[i + axis]);
        max[axis] = Math.max(max[axis], positions[i + axis]);
      }
    }

    const positionAccessor = accessors.length;
    accessors.push({ bufferView: bufferViews.length, componentType: 5126, count: vertexCount, type: "VEC3", min, max });
    bufferViews.push(positionView);
    const normalAccessor = accessors.length;
    accessors.push({ bufferView: bufferViews.length, componentType: 5126, count: vertexCount, type: "VEC3" });
    bufferViews.push(normalView);
    const indexAccessor = accessors.length;
    accessors.push({ bufferView: bufferViews.length, componentType: vertexCount > 65535 ? 5125 : 5123, count: indices.length, type: "SCALAR" });
    bufferViews.push(indexView);

    const material = addMaterial(part.material ?? { color: [0.8, 0.8, 0.8, 1] });
    const meshIndex = meshes.length;
    meshes.push({
      name: `${part.name}_mesh`,
      primitives: [{ attributes: { POSITION: positionAccessor, NORMAL: normalAccessor }, indices: indexAccessor, material }],
    });
    const nodeIndex = nodes.length;
    nodes.push({ name: part.name, mesh: meshIndex });
    partMeta.push({ name: part.name, triangles: indices.length / 3, min, max });
  }

  const binaryLength = byteLength;
  const padding = (4 - (binaryLength % 4)) % 4;
  const binChunks = padding > 0 ? [...buffers, new Uint8Array(padding)] : buffers;
  const binSize = binChunks.reduce((total, chunk) => total + chunk.byteLength, 0);
  const binary = new Uint8Array(binSize);
  let offset = 0;
  for (const chunk of binChunks) { binary.set(chunk, offset); offset += chunk.byteLength; }

  const gltf = {
    asset: { version: "2.0", generator },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, index) => index) }],
    nodes,
    meshes,
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binSize }],
  };

  const jsonText = JSON.stringify(gltf);
  const jsonBytes = new TextEncoder().encode(jsonText);
  const jsonPadding = (4 - (jsonBytes.byteLength % 4)) % 4;
  const jsonLength = jsonBytes.byteLength + jsonPadding;
  const binLength = binSize;

  const total = 12 + 8 + jsonLength + 8 + binLength;
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, GLB_MAGIC, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, CHUNK_JSON, true);
  out.set(jsonBytes, 20);
  for (let i = 0; i < jsonPadding; i += 1) out[20 + jsonBytes.byteLength + i] = 0x20;
  let cursor = 20 + jsonLength;
  view.setUint32(cursor, binLength, true);
  view.setUint32(cursor + 4, CHUNK_BIN, true);
  out.set(binary, cursor + 8);

  return { buffer: out, parts: partMeta };
}