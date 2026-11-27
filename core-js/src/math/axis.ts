/** Principal axis of a coordinate frame. */
export type AxisName = 'x' | 'y' | 'z';

const AXES: Record<AxisName, [number, number, number]> = {
  x: [1, 0, 0],
  y: [0, 1, 0],
  z: [0, 0, 1],
};

/** Unit vector for a principal axis name. */
export function axisVector(axis: AxisName): [number, number, number] {
  return [...AXES[axis]];
}

/** Principal axis name closest to a vector (ties resolve x → y → z). */
export function axisName(vector: readonly [number, number, number]): AxisName {
  const [x, y, z] = vector.map(Math.abs);
  if (x >= y && x >= z) return 'x';
  if (y >= z) return 'y';
  return 'z';
}
