import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { Joint } from '../src/elements/Joint';
import { Link } from '../src/elements/Link';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { Executor, Instruction } from '../src/solver/Executor';
import { Vector3 } from '../src/math/Vector3';

describe('Iterative Solver Engine', () => {
  let system: KinematicSystem;

  beforeEach(() => {
    system = new KinematicSystem();
  });

  test('2D Planar Arm convergence to a target', () => {
    // Setup a 2-link planar arm
    // Root -> Joint1 (Revolute Z) -> Link1 (X=1) -> Node1 -> Joint2 (Revolute Z) -> Link2 (X=1) -> Effector

    const root = new Node('root');
    const node1 = new Node('node1');
    const effector = new Node('effector');
    const target = new Node('target');

    const joint1 = new Joint('joint1', 'revolute', [0, 0, 1]);
    const joint2 = new Joint('joint2', 'revolute', [0, 0, 1]);

    const link1 = new Link('link1', Matrix4x4.fromTranslation(1, 0, 0));
    const link2 = new Link('link2', Matrix4x4.fromTranslation(1, 0, 0));

    system.addNode(root);
    system.addNode(node1);
    system.addNode(effector);
    system.addNode(target);
    system.addJoint(joint1);
    system.addJoint(joint2);
    system.addLink(link1);
    system.addLink(link2);

    system.connect('root', 'joint1', 'link1', 'node1');
    system.connect('node1', 'joint2', 'link2', 'effector');

    // Set target position (e.g., at [1, 1, 0])
    target.absoluteTransform = Matrix4x4.fromTranslation(1, 1, 0);

    system.updateForwardKinematics();

    const executor = new Executor(system);
    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 200, // Increased iterations
        condition: {
          type: 'distance_less_than',
          nodeA: 'effector',
          nodeB: 'target',
          threshold: 0.01
        },
        steps: [
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              targetNode: 'target',
              effectorNode: 'effector',
              adjustVariables: ['joint1', 'joint2']
            }
          }
        ]
      }
    ];

    const result = executor.execute(sequence);
    expect(result).toBe(true);

    const effectorPos = new Vector3(...effector.absoluteTransform.getTranslation());
    const targetPos = new Vector3(...target.absoluteTransform.getTranslation());
    expect(effectorPos.distanceTo(targetPos)).toBeLessThan(0.01);
  });

  test('Verify joint limits are respected', () => {
    const root = new Node('root');
    const effector = new Node('effector');
    const target = new Node('target');

    // Joint with restricted limits [0, 0.5] radians
    const joint1 = new Joint('joint1', 'revolute', [0, 0, 1], 0, [0, 0.5]);
    const link1 = new Link('link1', Matrix4x4.fromTranslation(1, 0, 0));

    system.addNode(root);
    system.addNode(effector);
    system.addNode(target);
    system.addJoint(joint1);
    system.addLink(link1);

    system.connect('root', 'joint1', 'link1', 'effector');

    // Target requires ~1.57 radians (90 degrees) to reach
    target.absoluteTransform = Matrix4x4.fromTranslation(0, 1, 0);

    system.updateForwardKinematics();

    const executor = new Executor(system);
    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 50,
        condition: {
          type: 'distance_less_than',
          nodeA: 'effector',
          nodeB: 'target',
          threshold: 0.01
        },
        steps: [
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              targetNode: 'target',
              effectorNode: 'effector',
              adjustVariables: ['joint1']
            }
          }
        ]
      }
    ];

    const result = executor.execute(sequence);
    // Should NOT converge because of limits
    expect(result).toBe(false);
    expect(joint1.value).toBeLessThanOrEqual(0.5);
    expect(joint1.value).toBeGreaterThan(0.49);
  });

  test('Prismatic joint alignment', () => {
    const root = new Node('root');
    const effector = new Node('effector');
    const target = new Node('target');

    const joint1 = new Joint('joint1', 'prismatic', [1, 0, 0]); // X-axis
    const link1 = new Link('link1', new Matrix4x4());

    system.addNode(root);
    system.addNode(effector);
    system.addNode(target);
    system.addJoint(joint1);
    system.addLink(link1);

    system.connect('root', 'joint1', 'link1', 'effector');

    target.absoluteTransform = Matrix4x4.fromTranslation(5, 0, 0);

    system.updateForwardKinematics();

    const executor = new Executor(system);
    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 100,
        condition: {
          type: 'distance_less_than',
          nodeA: 'effector',
          nodeB: 'target',
          threshold: 0.01
        },
        steps: [
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              targetNode: 'target',
              effectorNode: 'effector',
              adjustVariables: ['joint1']
            }
          }
        ]
      }
    ];

    const result = executor.execute(sequence);
    expect(result).toBe(true);
    expect(joint1.value).toBeCloseTo(5, 1);
  });
});
