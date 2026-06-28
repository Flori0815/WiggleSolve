import { Vector3 } from '../src/math/Vector3';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { Joint } from '../src/elements/Joint';
import { Link } from '../src/elements/Link';

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
    let m = new Matrix4x4();
    expect(m.elements[0]).toBe(1);
    expect(m.elements[15]).toBe(1);

    m = m.translate(10, 20, 30);
    const [x, y, z] = m.getTranslation();
    expect(x).toBe(10);
    expect(y).toBe(20);
    expect(z).toBe(30);
  });

  test('Matrix4x4 rotation', () => {
    let m = new Matrix4x4();
    // Rotate 90 degrees (PI/2) around Z axis
    m = m.rotateZ(Math.PI / 2);

    // Identity * RotZ(90) * translate(1, 0, 0)
    m = m.translate(1, 0, 0);

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
    const ab = a.multiply(b);
    const [abx, aby, abz] = ab.getTranslation();
    expect(abx).toBeCloseTo(2);
    expect(aby).toBeCloseTo(3);
    expect(abz).toBeCloseTo(4);
    // X-axis is rotated to Y by the RotZ(90°) component
    const xCol = ab.rotateVector(new Vector3(1, 0, 0));
    expect(xCol.x).toBeCloseTo(0);
    expect(xCol.y).toBeCloseTo(1);

    // b*a: same rotation, but translation is rotated by RotZ(90°): (2,3,4) → (-3, 2, 4)
    const ba = b.multiply(a);
    const [bax, bay, baz] = ba.getTranslation();
    expect(bax).toBeCloseTo(-3);
    expect(bay).toBeCloseTo(2);
    expect(baz).toBeCloseTo(4);
  });

  test('Matrix4x4 transformVector', () => {
    // Translation: T(10, 20, 30) applied to P(1, 2, 3) -> (11, 22, 33)
    const m1 = new Matrix4x4().translate(10, 20, 30);
    const v1 = new Vector3(1, 2, 3);
    const res1 = m1.transformVector(v1);
    expect(res1.x).toBe(11);
    expect(res1.y).toBe(22);
    expect(res1.z).toBe(33);

    // Rotation: RotZ(90 deg) applied to (1, 0, 0) -> (0, 1, 0)
    const m2 = new Matrix4x4().rotateZ(Math.PI / 2);
    const v2 = new Vector3(1, 0, 0);
    const res2 = m2.transformVector(v2);
    expect(res2.x).toBeCloseTo(0);
    expect(res2.y).toBeCloseTo(1);
    expect(res2.z).toBeCloseTo(0);
  });

  test('Matrix4x4 invert', () => {
    // Round-trip: M * M.invert() ≈ identity
    const m = new Matrix4x4()
      .rotateX(Math.PI / 4)
      .rotateY(Math.PI / 4)
      .translate(1, 2, 3);

    const mInv = m.clone().invert();
    const identity = m.clone().multiply(mInv);

    for (let i = 0; i < 16; i++) {
      const expected = (i % 5 === 0) ? 1 : 0;
      expect(identity.elements[i]).toBeCloseTo(expected);
    }

    // Singular matrix: verify the method signals failure (null return or thrown error)
    const singular = new Matrix4x4();
    singular.elements.fill(0);
    expect(() => singular.invert()).toThrow();
  });
});

describe('Joint', () => {
  test('Joint fixed type returns identity', () => {
    const joint = new Joint('j-fixed', 'fixed');
    const identity = new Matrix4x4();

    // Default value (0)
    expect(joint.getTransformMatrix().elements).toEqual(identity.elements);

    // Non-zero value
    joint.value = 42;
    expect(joint.getTransformMatrix().elements).toEqual(identity.elements);
  });
});

describe('Vector3 additional methods', () => {
  test('length()', () => {
    expect(new Vector3(1, 0, 0).length()).toBe(1);
    expect(new Vector3(0, 0, 0).length()).toBe(0);
    expect(new Vector3(1, 1, 1).length()).toBeCloseTo(Math.sqrt(3));
  });

  test('normalize()', () => {
    const v = new Vector3(2, 0, 0);
    const normalized = v.normalize();
    expect(normalized.length()).toBeCloseTo(1);
    expect(normalized.x).toBeCloseTo(1);
    expect(normalized.y).toBeCloseTo(0);
    expect(normalized.z).toBeCloseTo(0);

    const zero = new Vector3(0, 0, 0);
    const normalizedZero = zero.normalize();
    expect(normalizedZero.length()).toBe(0);
    expect(normalizedZero.x).toBe(0);
    expect(normalizedZero.y).toBe(0);
    expect(normalizedZero.z).toBe(0);
  });

  test('add(), sub(), scale()', () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = new Vector3(4, 5, 6);

    const added = v1.add(v2);
    expect(added.x).toBe(5);
    expect(added.y).toBe(7);
    expect(added.z).toBe(9);

    const subbed = v1.sub(v2);
    expect(subbed.x).toBe(-3);
    expect(subbed.y).toBe(-3);
    expect(subbed.z).toBe(-3);

    const scaled = v1.scale(2);
    expect(scaled.x).toBe(2);
    expect(scaled.y).toBe(4);
    expect(scaled.z).toBe(6);
  });

  test('clone()', () => {
    const v1 = new Vector3(1, 2, 3);
    const v2 = v1.clone();
    expect(v2.x).toBe(v1.x);
    expect(v2.y).toBe(v1.y);
    expect(v2.z).toBe(v1.z);

    v2.x = 10;
    expect(v1.x).toBe(1);
    expect(v2.x).toBe(10);
  });

  test('static sub()', () => {
    const v1 = new Vector3(10, 10, 10);
    const v2 = new Vector3(1, 2, 3);
    const result = Vector3.sub(v1, v2);
    expect(result.x).toBe(9);
    expect(result.y).toBe(8);
    expect(result.z).toBe(7);
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

describe('Matrix4x4 additional methods', () => {
  test('transformVector handles w=0 with fallback to 1', () => {
    const m = new Matrix4x4();
    // Set te[15]=0 so that w = te[3]*0 + te[7]*0 + te[11]*0 + te[15]*1 = 0
    // The (w || 1) fallback uses 1 to avoid division by zero
    m.elements[15] = 0;
    const v = m.transformVector(new Vector3(0, 0, 0));
    expect(isFinite(v.x)).toBe(true);
    expect(isFinite(v.y)).toBe(true);
    expect(isFinite(v.z)).toBe(true);
  });

  test('setTranslation mutates translation components', () => {
    const m = new Matrix4x4().rotateZ(Math.PI / 4);
    m.setTranslation(7, 8, 9);
    const [x, y, z] = m.getTranslation();
    expect(x).toBe(7);
    expect(y).toBe(8);
    expect(z).toBe(9);
  });

  test('copy duplicates all elements', () => {
    const src = new Matrix4x4().rotateX(Math.PI / 3).translate(1, 2, 3);
    const dst = new Matrix4x4();
    dst.copy(src);
    for (let i = 0; i < 16; i++) {
      expect(dst.elements[i]).toBeCloseTo(src.elements[i]);
    }
  });

  test('Matrix4x4.fromTranslation static factory', () => {
    const m = Matrix4x4.fromTranslation(5, 6, 7);
    const [x, y, z] = m.getTranslation();
    expect(x).toBe(5);
    expect(y).toBe(6);
    expect(z).toBe(7);
    // Rotation part should be identity
    expect(m.elements[0]).toBe(1);
    expect(m.elements[5]).toBe(1);
    expect(m.elements[10]).toBe(1);
  });
});

describe('Joint constructor defaults', () => {
  test('all parameters default correctly when only id is provided', () => {
    const joint = new Joint('j-defaults-only');
    expect(joint.type).toBe('revolute');
    expect(joint.axis).toEqual([0, 0, 1]);
    expect(joint.value).toBe(0);
    expect(joint.limits[0]).toBe(-Infinity);
    expect(joint.limits[1]).toBe(Infinity);
  });
});

describe('Joint getTransformMatrix', () => {
  test('revolute around X axis rotates Y toward Z at 90°', () => {
    const joint = new Joint('j-rx', 'revolute', [1, 0, 0]);
    joint.value = Math.PI / 2;
    const m = joint.getTransformMatrix();
    const v = m.rotateVector(new Vector3(0, 1, 0));
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(1);
  });

  test('revolute around Y axis rotates X toward -Z at 90°', () => {
    const joint = new Joint('j-ry', 'revolute', [0, 1, 0]);
    joint.value = Math.PI / 2;
    const m = joint.getTransformMatrix();
    const v = m.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });

  test('revolute around Z axis (az=1) rotates X toward Y at 90°', () => {
    const joint = new Joint('j-rz', 'revolute', [0, 0, 1]);
    joint.value = Math.PI / 2;
    const m = joint.getTransformMatrix();
    const v = m.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  test('revolute fallback axis (no dominant component) uses rotateZ', () => {
    const joint = new Joint('j-rf', 'revolute', [0, 0, 0]);
    joint.value = Math.PI / 2;
    const m = joint.getTransformMatrix();
    const v = m.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
  });

  test('prismatic joint translates along axis', () => {
    const joint = new Joint('j-p', 'prismatic', [1, 0, 0]);
    joint.value = 3;
    const m = joint.getTransformMatrix();
    const [x, y, z] = m.getTranslation();
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });
});

describe('Vector3 default constructor', () => {
  test('no-arg constructor defaults to zero', () => {
    const v = new Vector3();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  test('partial constructor (1 arg)', () => {
    const v = new Vector3(5);
    expect(v.x).toBe(5);
    expect(v.y).toBe(0);
    expect(v.z).toBe(0);
  });

  test('partial constructor (2 args)', () => {
    const v = new Vector3(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
    expect(v.z).toBe(0);
  });
});

describe('Link', () => {
  test('constructor without transform defaults to identity', () => {
    const link = new Link('l1');
    expect(link.id).toBe('l1');
    const [x, y, z] = link.transform.getTranslation();
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(z).toBe(0);
    expect(link.transform.elements[0]).toBe(1);
  });

  test('constructor with explicit transform', () => {
    const t = new Matrix4x4().translate(2, 3, 4);
    const link = new Link('l2', t);
    const [x, y, z] = link.transform.getTranslation();
    expect(x).toBe(2);
    expect(y).toBe(3);
    expect(z).toBe(4);
  });
});
