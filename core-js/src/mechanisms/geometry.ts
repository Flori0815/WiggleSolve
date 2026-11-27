import type { Point2, Point3 } from '../visual/mesh';

/**
 * Frame of a swept hinge line: x' normal to the hinge line (aft), y up,
 * z' along the hinge line (outboard), obtained by rotating the world frame
 * about y by `sweep`. Shared by the high-lift and control-surface generators.
 */
export function sweptFrame(sweep: number, origin: Point3 = [0, 0, 0]) {
  const c = Math.cos(sweep);
  const s = Math.sin(sweep);
  const rotate = ([x, y, z]: Point3): Point3 => [c * x + s * z, y, -s * x + c * z];
  const toWorld = (q: Point3): Point3 => {
    const [x, y, z] = rotate(q);
    return [x + origin[0], y + origin[1], z + origin[2]];
  };
  /**
   * Column-major 4×4 frame at world point `at`. Its x axis is rotated by
   * `angle` about the hinge axis; `flip` reverses the hinge axis (z) so that
   * positive rotations turn the other way.
   */
  const matrix = (at: Point3, angle = 0, flip = false): number[] => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const f = flip ? -1 : 1;
    const r = (v: number) => Math.round(v * 1e12) / 1e12 || 0;
    return [
      c * ca, sa, -s * ca, 0,
      -c * sa * f, ca * f, s * sa * f, 0,
      s * f, 0, c * f, 0,
      at[0], at[1], at[2], 1,
    ].map(r);
  };
  return { rotate, toWorld, matrix };
}

/** Sweep angle (about y) and length in the xz plane of the line a → b. */
export function lineSweep(a: Point3, b: Point3): { sweep: number; length: number } {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  return { sweep: Math.atan2(dx, dz), length: Math.hypot(dx, dz) };
}

/** Rotates a 2D point counter-clockwise by `angle`. */
export function rotate2(p: Point2, angle: number): Point2 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * p[0] - s * p[1], s * p[0] + c * p[1]];
}
