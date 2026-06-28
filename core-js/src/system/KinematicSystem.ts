import { Node } from '../elements/Node';
import { Joint } from '../elements/Joint';
import { RigidBody } from '../elements/RigidBody';
import { Vector3 } from '../math/Vector3';
import { Matrix4x4 } from '../math/Matrix4x4';
import { applyJointDelta } from './utils';

export class KinematicSystem {
  public bodies: Map<string, RigidBody> = new Map();
  public nodes: Map<string, Node> = new Map();
  public joints: Map<string, Joint> = new Map();

  addBody(body: RigidBody): void {
    this.bodies.set(body.id, body);
    for (const node of body.nodes.values()) {
      this.nodes.set(node.id, node);
    }
  }

  addNode(node: Node, bodyId?: string): void {
    this.nodes.set(node.id, node);
    if (bodyId) {
      const body = this.bodies.get(bodyId);
      if (body) body.addNode(node);
    }
  }

  addJoint(joint: Joint): void {
    this.joints.set(joint.id, joint);
  }

  updateForwardKinematics(): void {
    for (const body of this.bodies.values()) {
      body.updateNodes();
    }
  }

  /**
   * Applies a LookAt alignment to a node, modifying its localTransform.
   * This is typically used during the definition phase.
   */
  solveNodeAlignment(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node || !node.alignment.primaryTarget) return;

    const targetNode = this.nodes.get(node.alignment.primaryTarget);
    if (!targetNode) return;

    // Find parent body transform
    let parentTransform = new Matrix4x4();
    for (const body of this.bodies.values()) {
      if (body.nodes.has(node.id)) {
        parentTransform = body.transform.clone();
        break;
      }
    }

    const myPos = new Vector3(...node.absoluteTransform.getTranslation());
    const targetPos = new Vector3(...targetNode.absoluteTransform.getTranslation());
    const worldDir = targetPos.sub(myPos).normalize();
    if (worldDir.length() < 1e-6) return;

    const parentInv = parentTransform.invert();
    const desiredLocalDir = parentInv.rotateVector(worldDir).normalize();

    // Create basis
    const z = desiredLocalDir.clone();
    let x = new Vector3(1, 0, 0);
    if (Math.abs(z.dot(x)) > 0.99) x = new Vector3(0, 1, 0);
    const y = z.cross(x).normalize();
    x = y.cross(z).normalize();

    const lookAtMat = new Matrix4x4();
    const te = lookAtMat.elements;
    const axis = node.alignment.primaryAxis || 'z';

    if (axis === 'z') {
      te[0] = x.x; te[1] = x.y; te[2] = x.z;
      te[4] = y.x; te[5] = y.y; te[6] = y.z;
      te[8] = z.x; te[9] = z.y; te[10] = z.z;
    } else if (axis === 'x') {
      te[0] = z.x; te[1] = z.y; te[2] = z.z;
      te[4] = x.x; te[5] = x.y; te[6] = x.z;
      te[8] = y.x; te[9] = y.y; te[10] = y.z;
    } else {
      te[0] = y.x; te[1] = y.y; te[2] = y.z;
      te[4] = z.x; te[5] = z.y; te[6] = z.z;
      te[8] = x.x; te[9] = x.y; te[10] = x.z;
    }

    const localPos = node.localTransform.getTranslation();
    node.localTransform = lookAtMat.translate(localPos[0], localPos[1], localPos[2]);
  }

  /**
   * Applies an explicit transformation to a set of bodies based on a joint value delta.
   */
  applyActuatorDelta(jointId: string, pivotNodeId: string, movingBodyIds: string[], deltaValue: number): void {
    const joint = this.joints.get(jointId);
    const pivot = this.nodes.get(pivotNodeId);
    if (!joint || !pivot) return;

    const movingBodies = movingBodyIds
      .map((id) => this.bodies.get(id))
      .filter((body): body is RigidBody => body !== undefined);

    applyJointDelta(joint, pivot, movingBodies, deltaValue);
  }
}
