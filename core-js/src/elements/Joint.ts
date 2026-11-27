import { Matrix4x4 } from '../math/Matrix4x4';

export type JointType = 'revolute' | 'prismatic' | 'fixed';

export class Joint {
  public id: string;
  public type: JointType;
  /** Axis of rotation or translation, expressed in the pivot node's frame. */
  public axis: [number, number, number];
  /** The dynamic value of the joint (radians or length units). */
  public value: number;
  /** Lower and upper bounds [min, max]. */
  public limits: [number, number];

  constructor(
    id: string,
    type: JointType = 'revolute',
    axis: [number, number, number] = [0, 0, 1],
    value: number = 0,
    limits: [number, number] = [-Infinity, Infinity],
  ) {
    this.id = id;
    this.type = type;
    this.axis = axis;
    this.value = value;
    this.limits = limits;
  }

  /** Clamps a candidate joint value into the joint's limits. */
  clamp(value: number): number {
    return Math.max(this.limits[0], Math.min(this.limits[1], value));
  }

  /**
   * Local transform produced by moving this joint by `amount`
   * (defaults to the joint's current value).
   */
  getTransformMatrix(amount: number = this.value): Matrix4x4 {
    const m = new Matrix4x4();
    const [ax, ay, az] = this.axis;
    if (this.type === 'revolute') return m.rotateAxis(this.axis, amount);
    if (this.type === 'prismatic') return m.translate(ax * amount, ay * amount, az * amount);
    return m;
  }
}
