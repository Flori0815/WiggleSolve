import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { Joint } from '../src/elements/Joint';
import { Link } from '../src/elements/Link';
import { Matrix4x4 } from '../src/math/Matrix4x4';

describe('Forward Kinematics', () => {
  test('2-link robotic arm FK', () => {
    const system = new KinematicSystem();

    // Nodes
    const rootNode = new Node('root');
    const middleNode = new Node('middle');
    const endEffector = new Node('effector');
    system.addNode(rootNode);
    system.addNode(middleNode);
    system.addNode(endEffector);

    // Joints: Revolute around Z
    const joint1 = new Joint('j1', 'revolute', [0, 0, 1]);
    const joint2 = new Joint('j2', 'revolute', [0, 0, 1]);
    system.addJoint(joint1);
    system.addJoint(joint2);

    // Links: 10 units along X
    const link1 = new Link('l1', Matrix4x4.fromTranslation(10, 0, 0));
    const link2 = new Link('l2', Matrix4x4.fromTranslation(10, 0, 0));
    system.addLink(link1);
    system.addLink(link2);

    // Connections
    system.connect('root', 'j1', 'l1', 'middle');
    system.connect('middle', 'j2', 'l2', 'effector');

    // Scenario 1: Angles at 0
    joint1.value = 0;
    joint2.value = 0;
    system.updateForwardKinematics();

    let [x, y, z] = endEffector.absoluteTransform.getTranslation();
    expect(x).toBeCloseTo(20);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);

    // Scenario 2: Joint 1 at 90 degrees, Joint 2 at 0
    joint1.value = Math.PI / 2;
    joint2.value = 0;
    system.updateForwardKinematics();

    [x, y, z] = endEffector.absoluteTransform.getTranslation();
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(20);
    expect(z).toBeCloseTo(0);

    // Scenario 3: Joint 1 at 90 degrees, Joint 2 at 90 degrees
    joint1.value = Math.PI / 2;
    joint2.value = Math.PI / 2;
    system.updateForwardKinematics();

    [x, y, z] = endEffector.absoluteTransform.getTranslation();
    expect(x).toBeCloseTo(-10);
    expect(y).toBeCloseTo(10);
    expect(z).toBeCloseTo(0);
  });
});
