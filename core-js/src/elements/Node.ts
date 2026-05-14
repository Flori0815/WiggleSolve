import { Matrix4x4 } from '../math/Matrix4x4';

export class Node {
  public id: string;
  public absoluteTransform: Matrix4x4;

  constructor(id: string) {
    this.id = id;
    this.absoluteTransform = new Matrix4x4();
  }
}
