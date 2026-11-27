import { Joint } from '../src/elements/Joint';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { solveLinear } from '../src/math/linalg';
import { applyCloseLoops } from '../src/solver/closeLoops';
import type { CloseLoopsOperation } from '../src/solver/closeLoops';
import { applyOperation, copyOperation, operationJointIds } from '../src/solver/operations';
import { KinematicSystem } from '../src/system/KinematicSystem';

/** Planar two-link arm (unit links) whose tip must reach `target`. */
function arm(target: [number, number]) {
  const s = new KinematicSystem();
  const base = new RigidBody('base');
  base.addNode(new Node('p0'));
  const l1 = new RigidBody('l1');
  const p1 = new Node('p1');
  p1.localTransform = new Matrix4x4().translate(1, 0, 0);
  l1.addNode(p1);
  const l2 = new RigidBody('l2');
  const tip = new Node('tip');
  tip.localTransform = new Matrix4x4().translate(2, 0, 0);
  l2.addNode(tip);
  [base, l1, l2].forEach(b => s.addBody(b));
  const t = new Node('target');
  t.absoluteTransform = new Matrix4x4().translate(target[0], target[1], 0);
  s.addNode(t);
  s.addJoint(new Joint('j1'));
  s.addJoint(new Joint('j2', 'revolute', [0, 0, 1], 0, [-0.1, 0.1]));
  s.updateForwardKinematics();
  const op: CloseLoopsOperation = {
    type: 'close_loops',
    joints: [
      { jointId: 'j1', pivotNode: 'p0', movingBodies: ['l1', 'l2'] },
      { jointId: 'j2', pivotNode: 'p1', movingBodies: ['l2'] },
    ],
    pairs: [['tip', 'target']],
  };
  return { s, op };
}

const gap = (s: KinematicSystem) => {
  const a = s.nodes.get('tip')!.absoluteTransform.getTranslation();
  const b = s.nodes.get('target')!.absoluteTransform.getTranslation();
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
};

describe('close_loops', () => {
  test('converges on a reachable target', () => {
    const { s, op } = arm([1.9, 0.3]);
    s.joints.get('j2')!.limits = [-Math.PI, Math.PI];
    for (let i = 0; i < 8; i++) applyOperation(s, op);
    expect(gap(s)).toBeLessThan(1e-5);
  });

  test('respects joint limits', () => {
    const { s, op } = arm([0, 1.5]);
    for (let i = 0; i < 10; i++) applyCloseLoops(s, op);
    expect(Math.abs(s.joints.get('j2')!.value)).toBeLessThanOrEqual(0.1 + 1e-12);
  });

  test('does nothing when already closed or singular', () => {
    const { s, op } = arm([2, 0]);
    applyCloseLoops(s, op);
    expect(s.joints.get('j1')!.value).toBe(0);
    // Zero damping and a rank-deficient Jacobian (stretched arm, radial target) → no step.
    const { s: s2, op: op2 } = arm([3, 0]);
    applyCloseLoops(s2, { ...op2, damping: 0 });
    expect(s2.joints.get('j1')!.value).toBe(0);
  });

  test('reports missing elements', () => {
    const { s, op } = arm([1, 1]);
    expect(() => applyCloseLoops(s, { ...op, joints: [{ ...op.joints[0], jointId: 'nope' }] })).toThrow('joint nope');
    expect(() => applyCloseLoops(s, { ...op, joints: [{ ...op.joints[0], pivotNode: 'nope' }] })).toThrow('node nope');
    expect(() => applyCloseLoops(s, { ...op, pairs: [['tip', 'nope']] })).toThrow('node nope');
    expect(() => applyCloseLoops(s, { ...op, pairs: [['nope', 'tip']] })).toThrow('node nope');
    applyCloseLoops(s, { ...op, joints: [{ ...op.joints[0], movingBodies: ['ghost', 'l1', 'l2'] }] });
  });

  test('copy and joint ids', () => {
    const { op } = arm([1, 1]);
    const copy = copyOperation(op);
    copy.joints[0].movingBodies.push('x');
    copy.pairs[0][0] = 'y';
    expect(op.joints[0].movingBodies).toEqual(['l1', 'l2']);
    expect(op.pairs[0][0]).toBe('tip');
    expect(operationJointIds(op)).toEqual(['j1', 'j2']);
    expect(operationJointIds({ type: 'align_node', effectorNode: '', targetNode: '', pivotNode: '', jointId: 'a', movingBodies: [] })).toEqual(['a']);
  });
});

describe('solveLinear', () => {
  test('solves with pivoting and detects singular systems', () => {
    expect(solveLinear([[0, 1], [2, 0]], [3, 4])).toEqual([2, 3]);
    expect(solveLinear([[1, 2], [2, 4]], [1, 2])).toBeNull();
  });
});
