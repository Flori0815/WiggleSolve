import { Vector3 } from '../src/math/Vector3';
import { Matrix4x4 } from '../src/math/Matrix4x4';

describe('Math Primitives', () => {
  test('Vector3 basic operations', () => {
    const v1 = new Vector3(1, 0, 0);
    const v2 = new Vector3(0, 1, 0);

    expect(v1.dot(v2)).toBe(0);

    const v3 = v1.cross(v2);
    expect(v3.x).toBe(0);
    expect(v3.y).toBe(0);
    expect(v3.z).toBe(1);

    expect(v1.distanceTo(v2)).toBeCloseTo(Math.sqrt(2));
  });

  test('Matrix4x4 identity and translation', () => {
    const m = new Matrix4x4();
    expect(m.elements[0]).toBe(1);
    expect(m.elements[15]).toBe(1);

    m.translate(10, 20, 30);
    const [x, y, z] = m.getTranslation();
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(z).toBe(30);
  });

  test('Matrix4x4 rotation', () => {
    const m = new Matrix4x4();
    // Rotate 90 degrees (PI/2) around Z axis
    m.rotateZ(Math.PI / 2);

    // Identity * RotZ(90) * translate(1, 0, 0)
    m.translate(1, 0, 0);

    const [x, y, z] = m.getTranslation();
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBe(0);
  });
});
