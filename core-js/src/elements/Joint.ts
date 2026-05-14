import { Matrix4x4 } from '../math/Matrix4x4';

export type JointType = 'revolute' | 'prismatic' | 'fixed';

export class Joint {
  public id: string;
  public type: JointType;
  public axis: [number, number, number];
  public value: number;
  public limits: [number, number];

  constructor(
    id: string,
    type: JointType = 'fixed',
    axis: [number, number, number] = [0, 0, 1],
    value: number = 0,
    limits: [number, number] = [-Infinity, Infinity]
  ) {
    this.id = id;
    this.type = type;
    this.axis = axis;
    this.value = value;
    this.limits = limits;
  }

  getTransformMatrix(): Matrix4x4 {
    const m = new Matrix4x4();
    const [ax, ay, az] = this.axis;

    if (this.type === 'revolute') {
      // For simplicity in this initial version, we assume axis is one of standard X, Y, Z
      // If it's more complex, we would need a general rotation around an axis
      if (ax === 1) return m.rotateX(this.value);
      if (ay === 1) return m.rotateY(this.value);
      if (az === 1) return m.rotateZ(this.value);

      // Fallback for non-standard axes (simplified)
      // In a real scenario, this would use Rodrigues' rotation formula
      return m.rotateZ(this.value);
    } else if (this.type === 'prismatic') {
      return m.translate(ax * this.value, ay * this.value, az * this.value);
    }

    return m; // 'fixed' returns identity
  }
}
