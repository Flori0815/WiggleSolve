import type { RigidBody } from '../elements/RigidBody';
import { Vector3 } from '../math/Vector3';

/**
 * Triangle mesh attached to a body for representation only. It never takes
 * part in solving. Coordinates are in the body frame.
 */
export interface MeshVisual {
  type: 'mesh';
  /** Flat xyz list: [x0, y0, z0, x1, y1, z1, ...]. */
  vertices: number[];
  /** Flat triangle list of vertex indices (counter-clockwise = outside). */
  indices: number[];
  /** CSS colour; defaults to the body colour. */
  color?: string;
  /** 0–1; defaults to 1. */
  opacity?: number;
}

export type Point3 = [number, number, number];
export type Point2 = [number, number];

type Style = Pick<MeshVisual, 'color' | 'opacity'>;

const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0;

/** Axis-aligned box from `min` to `max`. */
export function boxMesh(min: Point3, max: Point3, style: Style = {}): MeshVisual {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  return prismMesh([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], z0, z1, style);
}

/** Box of `width` × `height` cross-section from `a` to `b`. */
export function beamMesh(a: Point3, b: Point3, width: number, height = width, style: Style = {}): MeshVisual {
  const start = new Vector3(...a);
  const axis = new Vector3(...b).sub(start);
  const u = axis.normalize();
  const helper = Math.abs(u.z) < 0.9 ? new Vector3(0, 0, 1) : new Vector3(1, 0, 0);
  const v = u.cross(helper).normalize().scale(width / 2);
  const w = u.cross(v).normalize().scale(height / 2);
  const corners: Vector3[] = [];
  for (const end of [start, start.add(axis)]) {
    corners.push(end.sub(v).sub(w), end.add(v).sub(w), end.add(v).add(w), end.sub(v).add(w));
  }
  return {
    type: 'mesh',
    vertices: corners.flatMap(p => [p.x, p.y, p.z].map(round)),
    indices: BOX_INDICES.slice(),
    ...style,
  };
}

// Corner order: 0-3 at the start (ring), 4-7 at the end (same ring).
const BOX_INDICES = [
  0, 2, 1, 0, 3, 2, // start cap
  4, 5, 6, 4, 6, 7, // end cap
  0, 1, 5, 0, 5, 4,
  1, 2, 6, 1, 6, 5,
  2, 3, 7, 2, 7, 6,
  3, 0, 4, 3, 4, 7,
];

/**
 * Extrudes a convex polygon in the xy plane from `z0` to `z1`
 * (caps are fan-triangulated).
 */
export function prismMesh(profile: Point2[], z0: number, z1: number, style: Style = {}): MeshVisual {
  const n = profile.length;
  const vertices = [
    ...profile.flatMap(([x, y]) => [x, y, z0]),
    ...profile.flatMap(([x, y]) => [x, y, z1]),
  ].map(round);
  const indices: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    indices.push(0, i + 1, i);          // cap at z0 (faces -z)
    indices.push(n, n + i, n + i + 1);  // cap at z1 (faces +z)
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, j, n + j, i, n + j, n + i);
  }
  return { type: 'mesh', vertices, indices, ...style };
}

/**
 * Builds a visual from world-space triangle soup (e.g. a CAD/STL export of the
 * reference pose), converting it into the body frame. `scale` converts the
 * file's units to model units (0.001 for millimetres).
 */
export function meshFromWorldTriangles(
  body: RigidBody,
  positions: ArrayLike<number>,
  options: Style & { scale?: number } = {},
): MeshVisual {
  const { scale = 1, ...style } = options;
  const toLocal = body.transform.invert();
  const vertices: number[] = [];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const p = toLocal.transformVector(new Vector3(positions[i] * scale, positions[i + 1] * scale, positions[i + 2] * scale));
    vertices.push(round(p.x), round(p.y), round(p.z));
  }
  const triangles = Math.floor(vertices.length / 9);
  return { type: 'mesh', vertices, indices: Array.from({ length: triangles * 3 }, (_, i) => i), ...style };
}
