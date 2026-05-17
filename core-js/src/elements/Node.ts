import { Matrix4x4 } from '../math/Matrix4x4';

export type NodeAlignment = {
  primaryAxis: 'x' | 'y' | 'z' | null;
  primaryTarget: string | null;
  secondaryAxis: 'x' | 'y' | 'z' | null;
  secondaryTarget: string | null;
};

export class Node {
  public id: string;
  /** Relative transformation to the parent RigidBody's coordinate frame */
  public localTransform: Matrix4x4;
  /** Computed global coordinate frame (updated by RigidBody) */
  public absoluteTransform: Matrix4x4;
  /** Metadata to indicate if this node should be treated as a static anchor */
  public isLocked: boolean;
  /** Optional alignment constraints used during the definition phase */
  public alignment: NodeAlignment;

  constructor(id: string) {
    this.id = id;
    this.localTransform = new Matrix4x4();
    this.absoluteTransform = new Matrix4x4();
    this.isLocked = false;
    this.alignment = {
        primaryAxis: null,
        primaryTarget: null,
        secondaryAxis: null,
        secondaryTarget: null
    };
  }
}
