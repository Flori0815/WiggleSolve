import { DefinitionError, mergeDefinitions, parseDefinition, prefixDefinition } from '../src/definition';
import type { MechanismDefinition } from '../src/definition';

const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
const sample = (): MechanismDefinition => parseDefinition({
  name: 's', description: '',
  system: {
    bodies: [{ id: 'b', nodes: [{ id: 'n', localTransform: I }, { id: 'p', localTransform: I }] }],
    globalNodes: [{ id: 'g', absoluteTransform: I }],
    joints: [{ id: 'j', type: 'revolute', axis: [0, 0, 1], limits: [-1, 1] }],
  },
  actuators: [{ id: 'a', type: 'revolute', axis: 'z', pivotNode: 'p', movingBodies: ['b'], outputs: [{ pivotNode: 'g', movingBodies: ['b'] }] }],
  sequence: [
    { type: 'loop', max_iterations: 1, condition: { type: 'distance_less_than', nodeA: 'n', nodeB: 'g', threshold: 1 }, steps: [
      { type: 'operation', operation: { type: 'align_node', effectorNode: 'n', targetNode: 'g', pivotNode: 'p', jointId: 'j', movingBodies: ['b'] } },
    ] },
    { type: 'loop', max_iterations: 1, condition: { type: 'all_distances_less_than', pairs: [['n', 'g']], threshold: 1 }, steps: [
      { type: 'operation', operation: { type: 'close_loops', joints: [{ jointId: 'j', pivotNode: 'p', movingBodies: ['b'] }], pairs: [['n', '']] } },
    ] },
  ],
});

describe('prefixDefinition', () => {
  test('prefixes every id and reference (empty references stay empty)', () => {
    const def = prefixDefinition(sample(), 'x_');
    const json = JSON.stringify(def);
    for (const id of ['b', 'n', 'p', 'g', 'j', 'a']) {
      expect(json).not.toMatch(new RegExp(`"${id}"`));
      expect(json).toMatch(new RegExp(`"x_${id}"`));
    }
    expect(json).toContain('["x_n",""]');
    expect(() => parseDefinition(def)).not.toThrow();
    const { outputs, ...plain } = sample().actuators[0];
    expect(outputs).toBeDefined();
    expect(prefixDefinition({ ...sample(), actuators: [plain] }, 'y_').actuators[0]).not.toHaveProperty('outputs');
  });
});

describe('mergeDefinitions', () => {
  test('concatenates parts', () => {
    const merged = mergeDefinitions('m', 'd', [prefixDefinition(sample(), 'a_'), prefixDefinition(sample(), 'b_')]);
    expect(merged.name).toBe('m');
    expect(merged.system.bodies).toHaveLength(2);
    expect(merged.sequence).toHaveLength(4);
  });

  test('rejects duplicate ids', () => {
    expect(() => mergeDefinitions('m', '', [sample(), sample()])).toThrow(DefinitionError);
    try {
      mergeDefinitions('m', '', [sample(), sample()]);
    } catch (e) {
      expect((e as DefinitionError).issues).toEqual([
        'duplicate body id "b"', 'duplicate node id "n"', 'duplicate node id "p"', 'duplicate node id "g"',
        'duplicate joint id "j"', 'duplicate actuator id "a"',
      ]);
    }
  });
});
