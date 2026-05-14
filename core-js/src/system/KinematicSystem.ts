import { Node } from '../elements/Node';
import { Joint } from '../elements/Joint';
import { Link } from '../elements/Link';

export interface Connection {
  parentNodeId: string;
  jointId: string;
  linkId: string;
  childNodeId: string;
}

export class KinematicSystem {
  public nodes: Map<string, Node> = new Map();
  public joints: Map<string, Joint> = new Map();
  public links: Map<string, Link> = new Map();
  public connections: Connection[] = [];

  addNode(node: Node): void {
    this.nodes.set(node.id, node);
  }

  addJoint(joint: Joint): void {
    this.joints.set(joint.id, joint);
  }

  addLink(link: Link): void {
    this.links.set(link.id, link);
  }

  connect(parentNodeId: string, jointId: string, linkId: string, childNodeId: string): void {
    this.connections.push({ parentNodeId, jointId, linkId, childNodeId });
  }

  updateForwardKinematics(): void {
    // Find root nodes (nodes that are not children in any connection)
    const childNodeIds = new Set(this.connections.map(c => c.childNodeId));
    const rootNodes = Array.from(this.nodes.values()).filter(node => !childNodeIds.has(node.id));

    // For each root node, start traversal
    for (const root of rootNodes) {
      this.traverse(root);
    }
  }

  private traverse(parentNode: Node): void {
    // Find all connections where this node is the parent
    const childrenConnections = this.connections.filter(c => c.parentNodeId === parentNode.id);

    for (const conn of childrenConnections) {
      const joint = this.joints.get(conn.jointId);
      const link = this.links.get(conn.linkId);
      const childNode = this.nodes.get(conn.childNodeId);

      if (joint && link && childNode) {
        // Child Node (4x4) = Parent Node (4x4) * Joint Variable (4x4) * Link Offset (4x4)
        const parentTransform = parentNode.absoluteTransform.clone();
        const jointTransform = joint.getTransformMatrix();
        const linkTransform = link.transform;

        childNode.absoluteTransform = parentTransform
          .multiply(jointTransform)
          .multiply(linkTransform);

        // Recurse down
        this.traverse(childNode);
      }
    }
  }
}
