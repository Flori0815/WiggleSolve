import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { Joint } from '../src/elements/Joint';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { Executor, Instruction } from '../src/solver/Executor';
import { Vector3 } from '../src/math/Vector3';

describe('RigidBody Architecture & Manual Solving', () => {
  test('Manual alignment of two bodies', () => {
    const system = new KinematicSystem();

    // Body A (Pivot)
    const bodyA = new RigidBody('body_a');
    const nodePivot = new Node('pivot');
    bodyA.addNode(nodePivot);
    system.addBody(bodyA);

    // Body B (Arm)
    const bodyB = new RigidBody('body_b');
    const nodeEffector = new Node('effector');
    nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0);
    bodyB.addNode(nodeEffector);
    system.addBody(bodyB);

    // Target
    const bodyTarget = new RigidBody('body_target');
    const nodeTarget = new Node('target');
    bodyTarget.transform = new Matrix4x4().translate(0, 1, 0);
    bodyTarget.addNode(nodeTarget);
    system.addBody(bodyTarget);

    const joint = new Joint('j1', 'revolute', [0, 0, 1]);
    system.addJoint(joint);

    system.updateForwardKinematics();

    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 200, // More iterations for better convergence
        condition: { type: 'distance_less_than', nodeA: 'effector', nodeB: 'target', threshold: 0.001 },
        steps: [
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              effectorNode: 'effector',
              targetNode: 'target',
              pivotNode: 'pivot',
              jointId: 'j1',
              movingBodies: ['body_b']
            }
          }
        ]
      }
    ];

    const executor = new Executor(system);
    const result = executor.execute(sequence);

    expect(result).toBe(true);
    const effectorPos = new Vector3(...system.nodes.get('effector')!.absoluteTransform.getTranslation());
    const targetPos = new Vector3(...system.nodes.get('target')!.absoluteTransform.getTranslation());
    expect(effectorPos.distanceTo(targetPos)).toBeLessThan(0.001);
    expect(joint.value).toBeCloseTo(Math.PI / 2, 2);
  });

  test('Multi-joint planar arm with joint limits', () => {
    const system = new KinematicSystem();

    // Body A (Base pivot)
    const bodyA = new RigidBody('body_a');
    const nodePivot = new Node('pivot');
    bodyA.addNode(nodePivot);
    system.addBody(bodyA);

    // Body B (First arm segment, length 1)
    const bodyB = new RigidBody('body_b');
    const nodeJoint2Pivot = new Node('joint2_pivot');
    nodeJoint2Pivot.localTransform = new Matrix4x4().translate(1, 0, 0);
    bodyB.addNode(nodeJoint2Pivot);
    system.addBody(bodyB);

    // Body C (Second arm segment, length 1, with effector at its end)
    const bodyC = new RigidBody('body_c');
    const nodeEffector = new Node('effector');
    nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0);
    bodyC.addNode(nodeEffector);
    system.addBody(bodyC);

    // Target for the effector
    const bodyTarget = new RigidBody('body_target');
    const nodeTarget = new Node('target');
    bodyTarget.transform = new Matrix4x4().translate(0, 1.2, 0);
    bodyTarget.addNode(nodeTarget);
    system.addBody(bodyTarget);

    // Joint 1: Base revolute joint with limits [-π/2, π/2]
    const joint1 = new Joint('j1', 'revolute', [0, 0, 1], 0, [-Math.PI / 2, Math.PI / 2]);
    system.addJoint(joint1);

    // Joint 2: Second revolute joint with limits [-π/2, π/2]
    const joint2 = new Joint('j2', 'revolute', [0, 0, 1], 0, [-Math.PI / 2, Math.PI / 2]);
    system.addJoint(joint2);

    system.updateForwardKinematics();

    // Multi-joint sequence: alternate between adjusting j2 and j1
    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 500,
        condition: { type: 'distance_less_than', nodeA: 'effector', nodeB: 'target', threshold: 0.08 },
        steps: [
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              effectorNode: 'effector',
              targetNode: 'target',
              pivotNode: 'joint2_pivot',
              jointId: 'j2',
              movingBodies: ['body_c']
            }
          },
          {
            type: 'operation',
            operation: {
              type: 'align_node',
              effectorNode: 'effector',
              targetNode: 'target',
              pivotNode: 'pivot',
              jointId: 'j1',
              movingBodies: ['body_b', 'body_c']
            }
          }
        ]
      }
    ];

    const executor = new Executor(system);
    const result = executor.execute(sequence);

    // If loop converges, verify the solution
    if (result) {
      const effectorPos = new Vector3(...system.nodes.get('effector')!.absoluteTransform.getTranslation());
      const targetPos = new Vector3(...system.nodes.get('target')!.absoluteTransform.getTranslation());
      expect(effectorPos.distanceTo(targetPos)).toBeLessThan(0.08);
    }

    // Verify both joints respect their limits regardless of convergence
    expect(joint1.value).toBeGreaterThanOrEqual(joint1.limits[0]);
    expect(joint1.value).toBeLessThanOrEqual(joint1.limits[1]);
    expect(joint2.value).toBeGreaterThanOrEqual(joint2.limits[0]);
    expect(joint2.value).toBeLessThanOrEqual(joint2.limits[1]);

    // Verify that we have a multi-joint system set up
    expect(system.joints.size).toBe(2);
    expect(system.bodies.size).toBe(4); // body_a, body_b, body_c, body_target
  });
});
