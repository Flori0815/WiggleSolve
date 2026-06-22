import { Vector3 } from '../src/math/Vector3';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { Joint } from '../src/elements/Joint';

describe('Math Primitives', () => {
  test('Vector3 basic operations', () => {
    const v1 = new Vector3(1, 0, 0);
    const v2 = new Vector3(0, 1, 0);

    expect(v1.dot(v2)).toBe(0);

    const v3 = v1.cross(v2);
    expect(v3.x).toBe(0);
    expect(v3.y).toBe(0);
    expect(v3.z).toBe(1);

    expect(v1.distanceTo(v2)).toBeCloseTo(Math.sqrt(2));
  });

  test('Matrix4x4 identity and translation', () => {
    const m = new Matrix4x4();
    expect(m.elements[0]).toBe(1);
    expect(m.elements[15]).toBe(1);

    m.translate(10, 20, 30);
    const [x, y, z] = m.getTranslation();
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(z).toBe(30);
  });

  test('Matrix4x4 rotation', () => {
    const m = new Matrix4x4();
    // Rotate 90 degrees (PI/2) around Z axis
    m.rotateZ(Math.PI / 2);

    // Identity * RotZ(90) * translate(1, 0, 0)
    m.translate(1, 0, 0);

    const [x, y, z] = m.getTranslation();
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
    expect(z).toBe(0);
  });

  test('Matrix4x4 multiplication is non-commutative', () => {
    // a = T(2, 3, 4), b = RotZ(90°)
    const a = new Matrix4x4().translate(2, 3, 4);
    const b = new Matrix4x4().rotateZ(Math.PI / 2);

    // a*b: rotation becomes RotZ(90°), translation stays (2, 3, 4)
    const ab = a.clone().multiply(b);
    const [abx, aby, abz] = ab.getTranslation();
    expect(abx).toBeCloseTo(2);
    expect(aby).toBeCloseTo(3);
    expect(abz).toBeCloseTo(4);
    // X-axis is rotated to Y by the RotZ(90°) component
    const xCol = ab.rotateVector(new Vector3(1, 0, 0));
    expect(xCol.x).toBeCloseTo(0);
    expect(xCol.y).toBeCloseTo(1);

    // b*a: same rotation, but translation is rotated by RotZ(90°): (2,3,4) → (-3, 2, 4)
    const ba = b.clone().multiply(a);
    const [bax, bay, baz] = ba.getTranslation();
    expect(bax).toBeCloseTo(-3);
    expect(bay).toBeCloseTo(2);
    expect(baz).toBeCloseTo(4);
  });
});

function buildTwoLinkArm(angleJ1: number, angleJ2: number): [number, number, number] {
  const system = new KinematicSystem();

  // Link 1 body: pivot at origin, tip node (joint 2 attachment) at local (10, 0, 0)
  const bodyLink1 = new RigidBody('link1');
  const pivot1 = new Node('pivot1');
  const pivot2 = new Node('pivot2');
  pivot2.localTransform = new Matrix4x4().translate(10, 0, 0);
  bodyLink1.addNode(pivot1);
  bodyLink1.addNode(pivot2);
  system.addBody(bodyLink1);

  // Link 2 body: initially positioned at link1's tip, end-effector at local (10, 0, 0)
  const bodyLink2 = new RigidBody('link2');
  bodyLink2.transform = new Matrix4x4().translate(10, 0, 0);
  const effector = new Node('effector');
  effector.localTransform = new Matrix4x4().translate(10, 0, 0);
  bodyLink2.addNode(effector);
  system.addBody(bodyLink2);

  system.addJoint(new Joint('j1', 'revolute', [0, 0, 1]));
  system.addJoint(new Joint('j2', 'revolute', [0, 0, 1]));

  system.updateForwardKinematics();

  if (angleJ1 !== 0) {
    system.applyActuatorDelta('j1', 'pivot1', ['link1', 'link2'], angleJ1);
  }
  if (angleJ2 !== 0) {
    system.applyActuatorDelta('j2', 'pivot2', ['link2'], angleJ2);
  }

  system.updateForwardKinematics();

  return system.nodes.get('effector')!.absoluteTransform.getTranslation();
}

describe('Forward Kinematics', () => {
  test('2-link arm: both joints at 90° around Z', () => {
    // Expected end-effector position from planar 2R kinematics:
    // x = L1*cos(90°) + L2*cos(180°) = 0 + (-10) = -10
    // y = L1*sin(90°) + L2*sin(180°) = 10 + 0    = 10
    const [x, y, z] = buildTwoLinkArm(Math.PI / 2, Math.PI / 2);
    expect(x).toBeCloseTo(-10);
    expect(y).toBeCloseTo(10);
    expect(z).toBeCloseTo(0);
  });

  test('2-link arm: both joints at 45° around Z', () => {
    // Expected end-effector position:
    // x = L1*cos(45°) + L2*cos(90°) = 5√2 + 0  = 5√2
    // y = L1*sin(45°) + L2*sin(90°) = 5√2 + 10
    const [x, y, z] = buildTwoLinkArm(Math.PI / 4, Math.PI / 4);
    expect(x).toBeCloseTo(5 * Math.SQRT2);
    expect(y).toBeCloseTo(5 * Math.SQRT2 + 10);
    expect(z).toBeCloseTo(0);
  });
});
