import { Matrix4x4 } from '../math/Matrix4x4';

export class Link {
  public id: string;
  /** Fixed static offset this link represents in the kinematic chain */
  public transform: Matrix4x4;

  constructor(id: string, transform?: Matrix4x4) {
    this.id = id;
    this.transform = transform ?? new Matrix4x4();
  }
}
