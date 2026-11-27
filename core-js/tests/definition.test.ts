import * as fs from 'fs';
import * as path from 'path';
import {
  assembleKinematicChain,
  buildSequence,
  buildSystem,
  DefinitionError,
  parseDefinition,
  safeParseDefinition,
  serializeDefinition,
} from '../src/definition';
import { axisName, axisVector } from '../src/math/axis';
import { Joint } from '../src/elements/Joint';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { KinematicSystem } from '../src/system/KinematicSystem';
import { captureSnapshot, restoreSnapshot } from '../src/system/snapshot';

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const readDemo = (file: string): unknown => JSON.parse(fs.readFileSync(path.join(DEMOS_DIR, file), 'utf8'));

describe('axis helpers', () => {
  test('axisVector returns fresh unit vectors', () => {
    const v = axisVector('y');
    expect(v).toEqual([0, 1, 0]);
    v[0] = 9;
    expect(axisVector('y')).toEqual([0, 1, 0]);
  });

  test('axisName picks the dominant component', () => {
    expect(axisName([1, 0, 0])).toBe('x');
    expect(axisName([0, -1, 0])).toBe('y');
    expect(axisName([0.1, 0.2, -0.9])).toBe('z');
  });
});

describe('parseDefinition', () => {
  test('accepts every bundled demo', () => {
    for (const file of fs.readdirSync(DEMOS_DIR).filter(f => f.endsWith('.json'))) {
      expect(() => parseDefinition(readDemo(file))).not.toThrow();
    }
  });

  test('defaults globalNodes to []', () => {
    const def = parseDefinition({
      name: 'n', description: '', system: { bodies: [], joints: [] }, actuators: [], sequence: [],
    });
    expect(def.system.globalNodes).toEqual([]);
  });

  test('reports issues with their path', () => {
    const result = safeParseDefinition({ name: 'n' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.issues.some(i => i.startsWith('[description]'))).toBe(true);
    expect(safeParseDefinition(null).success).toBe(false);
  });

  test('throws DefinitionError listing the issues', () => {
    expect(() => parseDefinition({})).toThrow(DefinitionError);
    try {
      parseDefinition(42);
    } catch (e) {
      expect((e as DefinitionError).issues[0]).toContain('[<root>]');
    }
  });
});

describe('buildSystem', () => {
  test('builds bodies, global nodes and joints and assembles actuated bodies at their pivots', () => {
    const def = parseDefinition(readDemo('three_link_arm.json'));
    const system = buildSystem(def);
    expect(system.bodies.size).toBe(4);
    expect(system.joints.get('j1')?.limits).toEqual([-3.14159, 3.14159]);
    expect(system.nodes.get('target')?.absoluteTransform.getTranslation()).toEqual([2.5, 1.5, 0]);
    // link2 is placed at link1_end (1.5, 0, 0), so its tip sits at 1.5 + 1.2
    expect(system.nodes.get('link2_end')!.absoluteTransform.getTranslation()[0]).toBeCloseTo(2.7);
  });

  test('an explicit body transform overrides assembly', () => {
    const def = parseDefinition(readDemo('three_link_arm.json'));
    def.system.bodies[1].transform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 5, 0, 1];
    const system = buildSystem(def);
    expect(system.nodes.get('link1_end')!.absoluteTransform.getTranslation()).toEqual([1.5, 5, 0]);
  });

  test('clears a reused system', () => {
    const system = new KinematicSystem();
    system.addNode(new Node('stale'));
    buildSystem(parseDefinition(readDemo('three_link_arm.json')), system);
    expect(system.nodes.has('stale')).toBe(false);
  });

  test('buildSequence deep-copies the loops', () => {
    const def = parseDefinition(readDemo('three_link_arm.json'));
    const seq = buildSequence(def.sequence);
    const first = seq[0];
    if (first.type !== 'loop' || first.steps[0].type !== 'operation') throw new Error('unexpected shape');
    first.steps[0].operation.movingBodies.push('x');
    expect(def.sequence[0].steps[0].operation.movingBodies).not.toContain('x');
  });
});

describe('serializeDefinition', () => {
  test('round-trips a demo to the same world pose', () => {
    const def = parseDefinition(readDemo('hydraulic_crane.json'));
    const system = buildSystem(def);
    const out = serializeDefinition(def, system, def.actuators, buildSequence(def.sequence));
    const reloaded = buildSystem(parseDefinition(JSON.parse(JSON.stringify(out))));
    for (const [id, node] of system.nodes) {
      const a = node.absoluteTransform.getTranslation();
      const b = reloaded.nodes.get(id)!.absoluteTransform.getTranslation();
      a.forEach((v, i) => expect(b[i]).toBeCloseTo(v, 5));
    }
  });

  test('writes infinite limits as ±1e6 and drops fixed joints', () => {
    const system = new KinematicSystem();
    system.addJoint(new Joint('free'));
    system.addJoint(new Joint('weld', 'fixed'));
    const out = serializeDefinition({ name: 'n', description: '' }, system, [], []);
    expect(out.system.joints).toEqual([{ id: 'free', type: 'revolute', axis: [0, 0, 1], limits: [-1e6, 1e6] }]);
  });

  test('rejects sequences the format cannot express', () => {
    const system = new KinematicSystem();
    const op = {
      type: 'operation' as const,
      operation: { type: 'align_node' as const, effectorNode: 'a', targetNode: 'b', pivotNode: 'c', jointId: 'j', movingBodies: [] },
    };
    const cond = { type: 'distance_less_than' as const, nodeA: 'a', nodeB: 'b', threshold: 0.1 };
    expect(() => serializeDefinition({ name: '', description: '' }, system, [], [op])).toThrow(DefinitionError);
    expect(() => serializeDefinition({ name: '', description: '' }, system, [], [
      { type: 'loop', max_iterations: 1, condition: cond, steps: [{ type: 'loop', max_iterations: 1, condition: cond, steps: [] }] },
    ])).toThrow(DefinitionError);
  });
});

describe('snapshot', () => {
  test('restores joints, bodies, node locals and global nodes', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    const node = new Node('n');
    body.addNode(node);
    system.addBody(body);
    const global = new Node('g');
    system.addNode(global);
    const joint = new Joint('j');
    system.addJoint(joint);

    const snap = captureSnapshot(system);
    joint.value = 1;
    body.transform = body.transform.translate(1, 0, 0);
    node.localTransform = node.localTransform.translate(0, 1, 0);
    global.absoluteTransform = global.absoluteTransform.translate(0, 0, 1);
    system.addJoint(new Joint('added-later'));

    restoreSnapshot(system, snap);
    expect(joint.value).toBe(0);
    expect(body.transform.getTranslation()).toEqual([0, 0, 0]);
    expect(node.absoluteTransform.getTranslation()).toEqual([0, 0, 0]);
    expect(global.absoluteTransform.getTranslation()).toEqual([0, 0, 0]);
  });
});

describe('KinematicSystem removal', () => {
  test('removeBody also removes its nodes', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    body.addNode(new Node('n'));
    system.addBody(body);
    system.removeBody('b');
    system.removeBody('missing');
    expect(system.bodies.size).toBe(0);
    expect(system.nodes.size).toBe(0);
  });

  test('removeNode detaches from the owning body', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    body.addNode(new Node('n'));
    system.addBody(body);
    system.addNode(new Node('g'));
    system.removeNode('n');
    system.removeNode('g');
    expect(body.nodes.size).toBe(0);
    expect(system.nodes.size).toBe(0);
  });
});

describe('assembleKinematicChain', () => {
  test('uses the most specific actuator and skips actuators with unknown pivots', () => {
    const system = new KinematicSystem();
    const base = new RigidBody('base');
    const pivotA = new Node('pa');
    pivotA.localTransform = pivotA.localTransform.translate(1, 0, 0);
    const pivotB = new Node('pb');
    pivotB.localTransform = pivotB.localTransform.translate(2, 0, 0);
    base.addNode(pivotA);
    base.addNode(pivotB);
    system.addBody(base);
    system.addBody(new RigidBody('arm'));
    system.addBody(new RigidBody('orphan'));
    system.addBody(new RigidBody('stranded'));

    assembleKinematicChain(system, [
      { id: 'broad', type: 'revolute', axis: 'z', pivotNode: 'pa', movingBodies: ['arm', 'orphan'] },
      { id: 'narrow', type: 'revolute', axis: 'z', pivotNode: 'pb', movingBodies: ['arm'] },
      { id: 'ghost', type: 'revolute', axis: 'z', pivotNode: 'missing', movingBodies: ['arm', 'stranded'] },
    ]);

    expect(system.bodies.get('arm')!.transform.getTranslation()).toEqual([2, 0, 0]);
    expect(system.bodies.get('orphan')!.transform.getTranslation()).toEqual([1, 0, 0]);
    expect(system.bodies.get('stranded')!.transform.getTranslation()).toEqual([0, 0, 0]);
  });
});
