export type Mat16 = [
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
  number, number, number, number,
];

export const IDENTITY_MAT16: Mat16 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
];

// Column-major SE(3) matrix: translation is at indices 12, 13, 14
export function translationMat16(x: number, y: number, z: number): Mat16 {
  return [
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1,
  ];
}

// Rotation around Z axis (column-major)
export function rotationZMat16(radians: number): Mat16 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    c,  s, 0, 0,
    -s, c, 0, 0,
    0,  0, 1, 0,
    0,  0, 0, 1,
  ];
}

// Rotation around X axis (column-major)
export function rotationXMat16(radians: number): Mat16 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    1, 0,  0, 0,
    0, c,  s, 0,
    0, -s, c, 0,
    0, 0,  0, 1,
  ];
}

// Rotation around Y axis (column-major)
export function rotationYMat16(radians: number): Mat16 {
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  return [
    c,  0, -s, 0,
    0,  1,  0, 0,
    s,  0,  c, 0,
    0,  0,  0, 1,
  ];
}
