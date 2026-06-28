import { Matrix4x4 } from '../math/Matrix4x4';
import { Node } from './Node';

export class RigidBody {
  public id: string;
  /** The absolute transformation of this rigid body in world space */
  public transform: Matrix4x4;
  /** Nodes that are rigidly attached to this body */
  public nodes: Map<string, Node> = new Map();

  constructor(id: string) {
    this.id = id;
    this.transform = new Matrix4x4();
  }

  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  /**
   * Recalculates absoluteTransform for all attached nodes
   * using the formula: NodeAbs = BodyTransform * NodeLocal
   */
  updateNodes(): void {
    for (const node of this.nodes.values()) {
      node.absoluteTransform = this.transform.multiply(node.localTransform);
    }
  }
}
