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
});
