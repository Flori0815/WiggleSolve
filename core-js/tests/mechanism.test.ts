import * as fs from 'fs';
import * as path from 'path';
import { Joint } from '../src/elements/Joint';
import { DEFAULT_DRIVE_RANGE, Mechanism } from '../src/simulation/Mechanism';

const demo = (file: string): unknown =>
  JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../demos', file), 'utf8'));

const pos = (m: Mechanism, id: string) => m.system.nodes.get(id)!.absoluteTransform.getTranslation();

describe('Mechanism', () => {
  test('fromDefinition loads metadata, actuators and sequence', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    expect(m.name).toBe('3-Link Planar Arm');
    expect(m.actuators.map(a => a.id)).toEqual(['j1', 'j2', 'j3']);
    expect(m.sequence).toHaveLength(1);
    expect(m.getActuator('j1')?.pivotNode).toBe('base_pivot');
    expect(m.getActuator('nope')).toBeUndefined();
  });

  test('setActuatorValue rotates the moving bodies about the pivot and clamps to limits', () => {
    const m = Mechanism.fromDefinition(demo('knee_orthosis.json'));
    const id = m.actuators[0].id;
    const [lo, hi] = m.getActuatorLimits(id);
    expect(m.setActuatorValue(id, hi + 10)).toBe(hi);
    expect(m.getActuatorValue(id)).toBe(hi);
    expect(m.setActuatorValue(id, lo - 10)).toBe(lo);
  });

  test('drive is incremental: driving back to 0 restores the pose', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    m.sequence = [];
    const before = pos(m, 'link3_end');
    m.drive('j1', 0.5);
    expect(pos(m, 'link3_end')).not.toEqual(before);
    m.drive('j1', 0);
    pos(m, 'link3_end').forEach((v, i) => expect(v).toBeCloseTo(before[i], 5));
  });

  test('unknown actuator throws; missing pivot is a no-op', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    expect(() => m.setActuatorValue('nope', 1)).toThrow('Unknown actuator');
    m.actuators[0].pivotNode = 'missing';
    expect(m.setActuatorValue('j1', 1)).toBe(0);
  });

  test('limits fall back to the default drive range', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    m.system.joints.get('j1')!.limits = [-Infinity, Infinity];
    expect(m.getActuatorLimits('j1')).toEqual(DEFAULT_DRIVE_RANGE.revolute);
    m.system.joints.delete('j1');
    expect(m.getActuatorLimits('j1')).toEqual(DEFAULT_DRIVE_RANGE.revolute);
    m.actuators.push({ id: 'slide', type: 'prismatic', axis: 'x', pivotNode: 'base_pivot', movingBodies: [] });
    expect(m.getActuatorLimits('slide')).toEqual(DEFAULT_DRIVE_RANGE.prismatic);
    expect(m.getActuatorLimits('ghost')).toEqual(DEFAULT_DRIVE_RANGE.revolute);
  });

  test('simulation round trip restores the definition pose', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    const before = pos(m, 'link3_end');
    expect(m.isSimulating).toBe(false);
    expect(m.startSimulation()).toEqual({ converged: true });
    expect(m.isSimulating).toBe(true);
    m.drive('j2', 0.3);
    m.stopSimulation();
    expect(m.isSimulating).toBe(false);
    expect(m.getActuatorValue('j2')).toBe(0);
    pos(m, 'link3_end').forEach((v, i) => expect(v).toBeCloseTo(before[i], 5));
    m.stopSimulation();
  });

  test('refresh applies LookAt only outside simulation', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    const node = m.system.nodes.get('link1_end')!;
    node.alignment.primaryAxis = 'x';
    node.alignment.primaryTarget = 'target';
    m.startSimulation();
    const frozen = Float32Array.from(node.localTransform.elements);
    m.refresh();
    expect(node.localTransform.elements).toEqual(frozen);
    m.stopSimulation();
    m.refresh();
    expect(node.localTransform.elements).not.toEqual(frozen);
  });

  test('toDefinition reloads into an equivalent mechanism', () => {
    const m = Mechanism.fromDefinition(demo('scara_robot.json'));
    const copy = Mechanism.fromDefinition(JSON.parse(JSON.stringify(m.toDefinition())));
    expect(copy.name).toBe(m.name);
    expect(copy.actuators).toEqual(m.actuators);
    for (const id of m.system.nodes.keys()) {
      pos(copy, id).forEach((v, i) => expect(v).toBeCloseTo(pos(m, id)[i], 5));
    }
  });

  test('solve reports errors instead of throwing', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    m.addLoop();
    const result = m.solve();
    expect(result.converged).toBe(false);
    expect(result.error).toContain('not found');
    m.sequence = [{ type: 'operation', operation: null as never }];
    expect(m.solve().error).toBeDefined();
  });

  test('editing API validates ids and creates elements', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    expect(m.validateNewId('node', '')).toBe('ID cannot be empty');
    expect(m.validateNewId('node', ' a')).toMatch(/whitespace/);
    expect(m.validateNewId('node', 'target')).toBe("Node 'target' already exists");
    expect(m.validateNewId('body', 'base_body')).toBe("Body 'base_body' already exists");
    expect(m.validateNewId('actuator', 'j1')).toBe("Actuator 'j1' already exists");
    expect(m.validateNewId('actuator', 'fresh')).toBeNull();

    m.addActuator('fresh');
    expect(m.getActuator('fresh')).toMatchObject({ type: 'revolute', axis: 'z', pivotNode: '' });
    m.setActuatorValue('j1', 0.2);
    m.removeActuator('j1');
    expect(m.getActuator('j1')).toBeUndefined();
    expect(m.getActuatorValue('j1')).toBe(0);

    const loop = m.addLoop();
    m.system.addJoint(new Joint('joint_5'));
    const a = m.addAlignStep(loop);
    const b = m.addAlignStep(loop);
    expect(a.id).not.toBe(b.id);
    expect(loop.steps).toHaveLength(2);
    expect(m.system.joints.get(a.id)?.limits).toEqual(DEFAULT_DRIVE_RANGE.revolute);
  });

  test('setActuatorLimits writes or creates the joint sharing the actuator id', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    m.setActuatorLimits('j1', [1, -1]);
    expect(m.getActuatorLimits('j1')).toEqual([-1, 1]);
    m.addActuator('extra');
    m.setActuatorLimits('extra', [0, 2]);
    expect(m.system.joints.get('extra')).toMatchObject({ type: 'revolute', axis: [0, 0, 1], limits: [0, 2] });
    expect(() => m.setActuatorLimits('ghost', [0, 1])).toThrow('Unknown actuator');
  });
});

describe('actuator outputs', () => {
  test('one actuator drives every output about its own pivot', () => {
    const m = Mechanism.fromDefinition(demo('three_link_arm.json'));
    m.sequence = [];
    m.actuators = [{
      id: 'shaft', type: 'revolute', axis: 'z', pivotNode: 'base_pivot', movingBodies: ['link1_body'],
      outputs: [{ pivotNode: 'link2_end', movingBodies: ['link3_body'], ratio: 2 }, { pivotNode: 'ghost', movingBodies: ['link3_body'] }],
    }];
    const tip = () => m.system.nodes.get('link3_end')!.absoluteTransform.getTranslation();
    const before = tip();
    m.setActuatorValue('shaft', 0.1);
    // link3 rotated by 0.2 about link2_end; link2_end itself did not move.
    const [x, y] = tip();
    expect(Math.atan2(y - before[1], x - before[0] + 0.8)).toBeCloseTo(0.2 / 2 + Math.PI / 2 - Math.PI / 2 + 0.1, 1);
    expect(Math.hypot(x - 2.7, y)).toBeCloseTo(0.8, 5);
    const copy = Mechanism.fromDefinition(JSON.parse(JSON.stringify(m.toDefinition())));
    expect(copy.actuators[0].outputs).toHaveLength(2);
  });
});
