import { Matrix4x4 } from '../math/Matrix4x4';

export type JointType = 'revolute' | 'prismatic' | 'fixed';

export class Joint {
  public id: string;
  public type: JointType;
  /** Local axis of rotation or translation */
  public axis: [number, number, number];
  /** The dynamic value of the joint */
  public value: number;
  /** Lower and upper bounds [min, max] */
  public limits: [number, number];

  constructor(
    id: string,
    type: JointType = 'revolute',
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

  /**
   * Generates a 4x4 matrix representing the relative transformation 
   * caused by this joint's current value.
   */
  getTransformMatrix(): Matrix4x4 {
    const m = new Matrix4x4();
    const [ax, ay, az] = this.axis;

    if (this.type === 'revolute') {
      if (ax === 1) return m.rotateX(this.value);
      if (ay === 1) return m.rotateY(this.value);
      if (az === 1) return m.rotateZ(this.value);
      return m.rotateZ(this.value);
    } else if (this.type === 'prismatic') {
      return m.translate(ax * this.value, ay * this.value, az * this.value);
    }
    return m;
  }
}
