import { KinematicSystem } from '../system/KinematicSystem';
import { Vector3 } from '../math/Vector3';

/** Holds when two nodes are closer than `threshold`. */
export interface DistanceCondition {
  type: 'distance_less_than';
  nodeA: string;
  nodeB: string;
  threshold: number;
}

/** Holds when every listed node pair is closer than `threshold` (closes several loops at once). */
export interface AllDistancesCondition {
  type: 'all_distances_less_than';
  pairs: Array<[string, string]>;
  threshold: number;
}

export type Condition = DistanceCondition | AllDistancesCondition;

/** Deep copy of a condition. */
export function copyCondition<C extends Condition>(condition: C): C {
  return condition.type === 'distance_less_than'
    ? { ...condition }
    : { ...condition, pairs: condition.pairs.map(([a, b]) => [a, b]) };
}

/** Simplest condition for a list of node pairs (single pair → `distance_less_than`). */
export function conditionFromPairs(pairs: Array<[string, string]>, threshold: number): Condition {
  if (pairs.length === 1) return { type: 'distance_less_than', nodeA: pairs[0][0], nodeB: pairs[0][1], threshold };
  return { type: 'all_distances_less_than', pairs: pairs.map(([a, b]) => [a, b]), threshold };
}

/** Node pairs a condition checks. */
export function conditionPairs(condition: Condition): Array<[string, string]> {
  return condition.type === 'distance_less_than' ? [[condition.nodeA, condition.nodeB]] : condition.pairs;
}

function distance(system: KinematicSystem, a: string, b: string): number {
  const nodeA = system.nodes.get(a);
  const nodeB = system.nodes.get(b);
  if (!nodeA || !nodeB) {
    throw new Error(`Condition Error: Node ${a} or ${b} not found.`);
  }
  return new Vector3(...nodeA.absoluteTransform.getTranslation())
    .distanceTo(new Vector3(...nodeB.absoluteTransform.getTranslation()));
}

export function evaluateCondition(system: KinematicSystem, condition: Condition): boolean {
  if (condition.type !== 'distance_less_than' && condition.type !== 'all_distances_less_than') {
    throw new Error(`Unsupported condition type: ${(condition as { type: string }).type}`);
  }
  return conditionPairs(condition).every(([a, b]) => distance(system, a, b) < condition.threshold);
}
