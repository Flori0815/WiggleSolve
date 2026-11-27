import { Node } from '../src/elements/Node';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { conditionFromPairs, conditionPairs, copyCondition, evaluateCondition } from '../src/solver/conditions';
import type { AllDistancesCondition, Condition } from '../src/solver/conditions';
import { KinematicSystem } from '../src/system/KinematicSystem';
import { parseDefinition } from '../src/definition';

const system = () => {
  const s = new KinematicSystem();
  [['a', 0], ['b', 0.05], ['c', 1]].forEach(([id, x]) => {
    const n = new Node(id as string);
    n.absoluteTransform = new Matrix4x4().translate(x as number, 0, 0);
    s.addNode(n);
  });
  return s;
};

describe('all_distances_less_than', () => {
  const cond: AllDistancesCondition = { type: 'all_distances_less_than', pairs: [['a', 'b'], ['a', 'c']], threshold: 0.1 };

  test('holds only when every pair is within the threshold', () => {
    expect(evaluateCondition(system(), cond)).toBe(false);
    expect(evaluateCondition(system(), { ...cond, pairs: [['a', 'b']] })).toBe(true);
    expect(() => evaluateCondition(system(), { ...cond, pairs: [['a', 'zz']] })).toThrow('not found');
  });

  test('pairs and deep copies', () => {
    expect(conditionPairs({ type: 'distance_less_than', nodeA: 'a', nodeB: 'b', threshold: 1 })).toEqual([['a', 'b']]);
    const copy = copyCondition(cond);
    copy.pairs[0][0] = 'x';
    expect(cond.pairs[0][0]).toBe('a');
  });

  test('conditionFromPairs picks the simplest form', () => {
    expect(conditionFromPairs([['a', 'b']], 0.1)).toEqual({ type: 'distance_less_than', nodeA: 'a', nodeB: 'b', threshold: 0.1 });
    expect(conditionFromPairs([['a', 'b'], ['c', 'd']], 0.1)).toEqual({ type: 'all_distances_less_than', pairs: [['a', 'b'], ['c', 'd']], threshold: 0.1 });
  });

  test('rejects unknown types', () => {
    expect(() => evaluateCondition(system(), { type: 'nope' } as unknown as Condition)).toThrow('Unsupported');
  });

  test('is accepted by the schema and needs at least one pair', () => {
    const def = (pairs: unknown) => ({
      name: 'n', description: '', system: { bodies: [], joints: [] }, actuators: [],
      sequence: [{ type: 'loop', max_iterations: 1, condition: { type: 'all_distances_less_than', pairs, threshold: 0.1 }, steps: [] }],
    });
    expect(parseDefinition(def([['a', 'b']])).sequence[0].condition).toMatchObject({ pairs: [['a', 'b']] });
    expect(() => parseDefinition(def([]))).toThrow();
  });
});
