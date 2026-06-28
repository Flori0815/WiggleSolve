import { KinematicSystem } from '../system/KinematicSystem';
import { Vector3 } from '../math/Vector3';

export interface Condition {
  type: 'distance_less_than';
  nodeA: string;
  nodeB: string;
  threshold: number;
}

export function evaluateCondition(system: KinematicSystem, condition: Condition): boolean {
  if (condition.type === 'distance_less_than') {
    const nodeA = system.nodes.get(condition.nodeA);
    const nodeB = system.nodes.get(condition.nodeB);

    if (!nodeA || !nodeB) {
      throw new Error(`Condition Error: Node ${condition.nodeA} or ${condition.nodeB} not found.`);
    }

    const posA = new Vector3(...nodeA.absoluteTransform.getTranslation());
    const posB = new Vector3(...nodeB.absoluteTransform.getTranslation());

    return posA.distanceTo(posB) < condition.threshold;
  }

  throw new Error(`Unsupported condition type: ${(condition as Condition).type}`);
}
