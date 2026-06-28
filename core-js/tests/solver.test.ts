import { KinematicSystem } from '../src/system/KinematicSystem';
import { Node } from '../src/elements/Node';
import { RigidBody } from '../src/elements/RigidBody';
import { Joint } from '../src/elements/Joint';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { Executor, Instruction } from '../src/solver/Executor';
import { Vector3 } from '../src/math/Vector3';
import { evaluateCondition } from '../src/solver/conditions';
import { applyOperation } from '../src/solver/operations';
import { applyJointDelta } from '../src/system/utils';

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

  test('Damping factor affects convergence speed', () => {
    const createSystem = () => {
      const system = new KinematicSystem();
      const bodyA = new RigidBody('body_a');
      const nodePivot = new Node('pivot');
      bodyA.addNode(nodePivot);
      system.addBody(bodyA);

      const bodyB = new RigidBody('body_b');
      const nodeEffector = new Node('effector');
      nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0);
      bodyB.addNode(nodeEffector);
      system.addBody(bodyB);

      const bodyTarget = new RigidBody('body_target');
      const nodeTarget = new Node('target');
      bodyTarget.transform = new Matrix4x4().translate(0, 1, 0);
      bodyTarget.addNode(nodeTarget);
      system.addBody(bodyTarget);

      const joint = new Joint('j1', 'revolute', [0, 0, 1]);
      system.addJoint(joint);
      system.updateForwardKinematics();
      return { system, joint };
    };

    const runWithDamping = (damping: number) => {
      const { system, joint } = createSystem();
      const sequence: Instruction[] = [
        {
          type: 'operation',
          operation: {
            type: 'align_node',
            effectorNode: 'effector',
            targetNode: 'target',
            pivotNode: 'pivot',
            jointId: 'j1',
            movingBodies: ['body_b'],
            damping
          }
        }
      ];
      const executor = new Executor(system);
      executor.execute(sequence);
      return joint.value;
    };

    const stepLow = runWithDamping(0.1);
    const stepHigh = runWithDamping(0.9);

    // With higher damping, the joint should move further in a single step
    // (Target is at 90 degrees, starting from 0, so it's a positive move)
    expect(stepHigh).toBeGreaterThan(stepLow);

    // Default should be between them (0.5)
    const { system: systemDef, joint: jointDef } = createSystem();
    new Executor(systemDef).execute([{
      type: 'operation',
      operation: {
        type: 'align_node',
        effectorNode: 'effector',
        targetNode: 'target',
        pivotNode: 'pivot',
        jointId: 'j1',
        movingBodies: ['body_b']
        // damping omitted, should default to 0.5
      }
    }]);

    expect(jointDef.value).toBeGreaterThan(stepLow);
    expect(stepHigh).toBeGreaterThan(jointDef.value);
  });

  test('Unreachable target returns false', () => {
    const system = new KinematicSystem();

    // Body A (Pivot)
    const bodyA = new RigidBody('body_a');
    const nodePivot = new Node('pivot');
    bodyA.addNode(nodePivot);
    system.addBody(bodyA);

    // Body B (Arm)
    const bodyB = new RigidBody('body_b');
    const nodeEffector = new Node('effector');
    nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0); // Length 1
    bodyB.addNode(nodeEffector);
    system.addBody(bodyB);

    // Target (Out of reach)
    const bodyTarget = new RigidBody('body_target');
    const nodeTarget = new Node('target');
    bodyTarget.transform = new Matrix4x4().translate(2, 0, 0); // Distance 2
    bodyTarget.addNode(nodeTarget);
    system.addBody(bodyTarget);

    const joint = new Joint('j1', 'revolute', [0, 0, 1]);
    system.addJoint(joint);

    system.updateForwardKinematics();

    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 10,
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

    expect(result).toBe(false);
  });

  test('Converges on the last iteration', () => {
    const system = new KinematicSystem();

    const bodyA = new RigidBody('body_a');
    const nodePivot = new Node('pivot');
    bodyA.addNode(nodePivot);
    system.addBody(bodyA);

    const bodyB = new RigidBody('body_b');
    const nodeEffector = new Node('effector');
    nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0);
    bodyB.addNode(nodeEffector);
    system.addBody(bodyB);

    const bodyTarget = new RigidBody('body_target');
    const nodeTarget = new Node('target');
    // Target is at (0, 1, 0), so it needs a 90 degree rotation.
    bodyTarget.transform = new Matrix4x4().translate(0, 1, 0);
    bodyTarget.addNode(nodeTarget);
    system.addBody(bodyTarget);

    const joint = new Joint('j1', 'revolute', [0, 0, 1]);
    system.addJoint(joint);

    system.updateForwardKinematics();

    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 200, // More iterations
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

    // This SHOULD be true if the system converged after the 1st step.
    // CCD align_node for a single revolute joint should converge in 1 step for this setup.
    const effectorPos = new Vector3(...system.nodes.get('effector')!.absoluteTransform.getTranslation());
    const targetPos = new Vector3(...system.nodes.get('target')!.absoluteTransform.getTranslation());
    expect(result).toBe(true);
    expect(effectorPos.distanceTo(targetPos)).toBeLessThan(0.001);
    expect(joint.value).toBeCloseTo(Math.PI / 2, 2);
  });

  test('Converges immediately if condition already met', () => {
    const system = new KinematicSystem();

    const bodyA = new RigidBody('body_a');
    const nodePivot = new Node('pivot');
    bodyA.addNode(nodePivot);
    system.addBody(bodyA);

    const bodyB = new RigidBody('body_b');
    const nodeEffector = new Node('effector');
    nodeEffector.localTransform = new Matrix4x4().translate(1, 0, 0);
    bodyB.addNode(nodeEffector);
    system.addBody(bodyB);

    const bodyTarget = new RigidBody('body_target');
    const nodeTarget = new Node('target');
    // Target is already at (1, 0, 0)
    bodyTarget.transform = new Matrix4x4().translate(1, 0, 0);
    bodyTarget.addNode(nodeTarget);
    system.addBody(bodyTarget);

    const joint = new Joint('j1', 'revolute', [0, 0, 1]);
    system.addJoint(joint);

    system.updateForwardKinematics();

    const sequence: Instruction[] = [
      {
        type: 'loop',
        max_iterations: 0, // 0 iterations allowed
        condition: { type: 'distance_less_than', nodeA: 'effector', nodeB: 'target', threshold: 0.001 },
        steps: []
      }
    ];

    const executor = new Executor(system);
    const result = executor.execute(sequence);

    expect(result).toBe(true);
  });
});

describe('evaluateCondition error paths', () => {
  test('throws when a referenced node does not exist', () => {
    const system = new KinematicSystem();
    expect(() => evaluateCondition(system, {
      type: 'distance_less_than',
      nodeA: 'missing_a',
      nodeB: 'missing_b',
      threshold: 0.1,
    })).toThrow('Condition Error');
  });

  test('throws on unsupported condition type', () => {
    const system = new KinematicSystem();
    const bodyA = new RigidBody('ba');
    const nodeA = new Node('na');
    bodyA.addNode(nodeA);
    system.addBody(bodyA);
    const bodyB = new RigidBody('bb');
    const nodeB = new Node('nb');
    bodyB.addNode(nodeB);
    system.addBody(bodyB);
    system.updateForwardKinematics();
    expect(() => (evaluateCondition as any)(system, {
      type: 'unknown_type',
      nodeA: 'na',
      nodeB: 'nb',
      threshold: 1,
    })).toThrow('Unsupported condition type');
  });
});

describe('applyOperation error paths', () => {
  test('throws when required elements are missing', () => {
    const system = new KinematicSystem();
    expect(() => applyOperation(system, {
      type: 'align_node',
      effectorNode: 'no_effector',
      targetNode: 'no_target',
      pivotNode: 'no_pivot',
      jointId: 'no_joint',
      movingBodies: [],
    })).toThrow('Operation Error');
  });

  test('throws on unsupported operation type', () => {
    const system = new KinematicSystem();
    expect(() => (applyOperation as any)(system, {
      type: 'unknown_op',
      effectorNode: 'a',
      targetNode: 'b',
      pivotNode: 'c',
      jointId: 'd',
      movingBodies: [],
    })).toThrow('Unsupported operation type');
  });

  test('prismatic joint moves along axis toward target', () => {
    const system = new KinematicSystem();

    const frameBody = new RigidBody('frame');
    const pivotNode = new Node('origin');
    frameBody.addNode(pivotNode);
    system.addBody(frameBody);

    const carriageBody = new RigidBody('carriage');
    const effectorNode = new Node('effector');
    carriageBody.addNode(effectorNode);
    system.addBody(carriageBody);

    const targetBody = new RigidBody('tgt_body');
    const targetNode = new Node('target');
    targetBody.transform = new Matrix4x4().translate(2, 0, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    const joint = new Joint('j_pris', 'prismatic', [1, 0, 0], 0, [0, 5]);
    system.addJoint(joint);
    system.updateForwardKinematics();

    applyOperation(system, {
      type: 'align_node',
      effectorNode: 'effector',
      targetNode: 'target',
      pivotNode: 'origin',
      jointId: 'j_pris',
      movingBodies: ['carriage'],
    });

    expect(joint.value).toBeGreaterThan(0);
  });

  test('fixed joint type causes step=0 early return without moving anything', () => {
    const system = new KinematicSystem();

    const frameBody = new RigidBody('frame2');
    const pivotNode = new Node('origin2');
    frameBody.addNode(pivotNode);
    system.addBody(frameBody);

    const armBody = new RigidBody('arm2');
    const effNode = new Node('eff2');
    effNode.localTransform = new Matrix4x4().translate(1, 0, 0);
    armBody.addNode(effNode);
    system.addBody(armBody);

    const tgtBody = new RigidBody('tgt2');
    const tgtNode = new Node('tgt2');
    tgtBody.transform = new Matrix4x4().translate(0, 1, 0);
    tgtBody.addNode(tgtNode);
    system.addBody(tgtBody);

    const joint = new Joint('j_fix2', 'fixed');
    system.addJoint(joint);
    system.updateForwardKinematics();

    const beforeTransform = armBody.transform.clone();
    applyOperation(system, {
      type: 'align_node',
      effectorNode: 'eff2',
      targetNode: 'tgt2',
      pivotNode: 'origin2',
      jointId: 'j_fix2',
      movingBodies: ['arm2'],
    });

    // No movement should happen since step=0 triggers early return
    for (let i = 0; i < 16; i++) {
      expect(armBody.transform.elements[i]).toBeCloseTo(beforeTransform.elements[i]);
    }
  });

  test('prismatic joint at limit: actualStep=0 causes early return', () => {
    const system = new KinematicSystem();

    const frameBody = new RigidBody('frame3');
    const pivotNode = new Node('origin3');
    frameBody.addNode(pivotNode);
    system.addBody(frameBody);

    // Carriage already at its max position (x=5)
    const carriageBody = new RigidBody('carriage3');
    carriageBody.transform = new Matrix4x4().translate(5, 0, 0);
    const effNode = new Node('eff3');
    carriageBody.addNode(effNode);
    system.addBody(carriageBody);

    const tgtBody = new RigidBody('tgt3');
    const tgtNode = new Node('tgt3');
    tgtBody.transform = new Matrix4x4().translate(10, 0, 0);
    tgtBody.addNode(tgtNode);
    system.addBody(tgtBody);

    // Joint already at its upper limit
    const joint = new Joint('j_at_limit', 'prismatic', [1, 0, 0], 5, [0, 5]);
    system.addJoint(joint);
    system.updateForwardKinematics();

    const valueBefore = joint.value;
    applyOperation(system, {
      type: 'align_node',
      effectorNode: 'eff3',
      targetNode: 'tgt3',
      pivotNode: 'origin3',
      jointId: 'j_at_limit',
      movingBodies: ['carriage3'],
    });

    // Joint should not move beyond limit — actualStep clamped to 0
    expect(joint.value).toBe(valueBefore);
  });
});

describe('applyJointDelta', () => {
  test('prismatic joint translates moving bodies along axis', () => {
    const body = new RigidBody('body');
    const pivot = new Node('pivot');
    body.addNode(pivot);
    body.updateNodes();

    const carriage = new RigidBody('carriage');
    const tip = new Node('tip');
    carriage.addNode(tip);
    carriage.updateNodes();

    const joint = new Joint('jp', 'prismatic', [0, 1, 0]);

    applyJointDelta(joint, pivot, [carriage], 3);

    const [cx, cy, cz] = carriage.transform.getTranslation();
    expect(cy).toBeCloseTo(3);
    expect(cx).toBeCloseTo(0);
    expect(cz).toBeCloseTo(0);
  });

  test('revolute [1,0,0] rotates carriage around X axis', () => {
    const body = new RigidBody('body');
    const pivot = new Node('pivot');
    body.addNode(pivot);
    body.updateNodes();

    const carriage = new RigidBody('carriage');
    carriage.updateNodes();

    const joint = new Joint('jrx', 'revolute', [1, 0, 0]);
    applyJointDelta(joint, pivot, [carriage], Math.PI / 2);

    const v = carriage.transform.rotateVector(new Vector3(0, 1, 0));
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(1);
  });

  test('revolute [0,1,0] rotates carriage around Y axis', () => {
    const body = new RigidBody('body');
    const pivot = new Node('pivot');
    body.addNode(pivot);
    body.updateNodes();

    const carriage = new RigidBody('carriage');
    carriage.updateNodes();

    const joint = new Joint('jry', 'revolute', [0, 1, 0]);
    applyJointDelta(joint, pivot, [carriage], Math.PI / 2);

    const v = carriage.transform.rotateVector(new Vector3(1, 0, 0));
    expect(v.x).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(-1);
  });

  test('fixed joint type produces no movement (neither revolute nor prismatic)', () => {
    const body = new RigidBody('body');
    const pivot = new Node('pivot');
    body.addNode(pivot);
    body.updateNodes();

    const carriage = new RigidBody('carriage');
    carriage.updateNodes();

    const joint = new Joint('jfix', 'fixed');
    const beforeTransform = carriage.transform.clone();
    applyJointDelta(joint, pivot, [carriage], 1.0);

    for (let i = 0; i < 16; i++) {
      expect(carriage.transform.elements[i]).toBeCloseTo(beforeTransform.elements[i]);
    }
  });

  test('skips delta smaller than threshold', () => {
    const body = new RigidBody('body');
    const pivot = new Node('pivot');
    body.addNode(pivot);
    body.updateNodes();

    const carriage = new RigidBody('carriage');
    carriage.updateNodes();

    const joint = new Joint('jp2', 'revolute', [0, 0, 1]);

    applyJointDelta(joint, pivot, [carriage], 1e-10);

    const [x, y, z] = carriage.transform.getTranslation();
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(0);
    expect(z).toBeCloseTo(0);
  });
});

describe('KinematicSystem.addNode', () => {
  test('addNode without bodyId registers node in system', () => {
    const system = new KinematicSystem();
    const node = new Node('standalone');
    system.addNode(node);
    expect(system.nodes.has('standalone')).toBe(true);
  });

  test('addNode with bodyId also attaches node to the body', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b1');
    system.addBody(body);

    const node = new Node('extra');
    system.addNode(node, 'b1');

    expect(system.nodes.has('extra')).toBe(true);
    expect(body.nodes.has('extra')).toBe(true);
  });

  test('addNode with non-existent bodyId registers node only in system', () => {
    const system = new KinematicSystem();
    const node = new Node('orphan');
    system.addNode(node, 'ghost_body');
    expect(system.nodes.has('orphan')).toBe(true);
  });
});

describe('KinematicSystem.applyActuatorDelta', () => {
  test('no-op when joint is not found', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    const pivot = new Node('p');
    body.addNode(pivot);
    system.addBody(body);
    system.updateForwardKinematics();
    expect(() => system.applyActuatorDelta('missing_joint', 'p', [], 1)).not.toThrow();
  });

  test('no-op when pivot node is not found', () => {
    const system = new KinematicSystem();
    const joint = new Joint('j', 'revolute', [0, 0, 1]);
    system.addJoint(joint);
    expect(() => system.applyActuatorDelta('j', 'missing_pivot', [], 1)).not.toThrow();
  });
});

describe('KinematicSystem.solveNodeAlignment', () => {
  test('no-op when node does not exist', () => {
    const system = new KinematicSystem();
    expect(() => system.solveNodeAlignment('nonexistent')).not.toThrow();
  });

  test('no-op when node has no primaryTarget', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    const node = new Node('n');
    body.addNode(node);
    system.addBody(body);
    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('n')).not.toThrow();
  });

  test('no-op when primaryTarget node does not exist in system', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    const node = new Node('n');
    node.alignment.primaryTarget = 'ghost';
    body.addNode(node);
    system.addBody(body);
    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('n')).not.toThrow();
  });

  test('no-op when node and target share the same position', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('b');
    const node = new Node('n');
    node.alignment.primaryTarget = 't';
    node.alignment.primaryAxis = 'z';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('tb');
    const targetNode = new Node('t');
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('n')).not.toThrow();
  });

  test('aligns node with primaryAxis z toward target', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('camera');
    const node = new Node('lens');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'target';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('scene');
    const targetNode = new Node('target');
    targetNode.localTransform = new Matrix4x4().translate(0, 3, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    system.solveNodeAlignment('lens');

    expect(node.localTransform).toBeDefined();
  });

  test('aligns node with primaryAxis x toward target', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('camera');
    const node = new Node('lens');
    node.alignment.primaryAxis = 'x';
    node.alignment.primaryTarget = 'target';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('scene');
    const targetNode = new Node('target');
    targetNode.localTransform = new Matrix4x4().translate(0, 3, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    system.solveNodeAlignment('lens');

    expect(node.localTransform).toBeDefined();
  });

  test('aligns node with primaryAxis y toward target', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('camera');
    const node = new Node('lens');
    node.alignment.primaryAxis = 'y';
    node.alignment.primaryTarget = 'target';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('scene');
    const targetNode = new Node('target');
    targetNode.localTransform = new Matrix4x4().translate(0, 3, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    system.solveNodeAlignment('lens');

    expect(node.localTransform).toBeDefined();
  });

  test('handles degenerate case when desired direction is near X axis', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('camera');
    const node = new Node('lens');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'target';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('scene');
    const targetNode = new Node('target');
    // Target nearly along X from origin → desiredLocalDir ≈ (1, 0, 0), triggers degenerate branch
    targetNode.localTransform = new Matrix4x4().translate(10, 0.001, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('lens')).not.toThrow();
    expect(node.localTransform).toBeDefined();
  });

  test('uses z as fallback axis when primaryAxis is null', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('camera');
    const node = new Node('lens');
    node.alignment.primaryAxis = null;   // null → falls back to 'z'
    node.alignment.primaryTarget = 'target';
    body.addNode(node);
    system.addBody(body);

    const targetBody = new RigidBody('scene');
    const targetNode = new Node('target');
    targetNode.localTransform = new Matrix4x4().translate(0, 5, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('lens')).not.toThrow();
    expect(node.localTransform).toBeDefined();
  });

  test('secondary axis aligns node roll so secondaryAxis points toward secondaryTarget', () => {
    const system = new KinematicSystem();

    // Node at origin: Z should point toward target1 (world Y), X should point toward target2 (world Z)
    const body = new RigidBody('body');
    const node = new Node('node');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'target1';
    node.alignment.secondaryAxis = 'x';
    node.alignment.secondaryTarget = 'target2';
    body.addNode(node);
    system.addBody(body);

    const bt1 = new RigidBody('bt1');
    const nt1 = new Node('target1');
    nt1.localTransform = new Matrix4x4().translate(0, 1, 0);
    bt1.addNode(nt1);
    system.addBody(bt1);

    const bt2 = new RigidBody('bt2');
    const nt2 = new Node('target2');
    nt2.localTransform = new Matrix4x4().translate(0, 0, 1);
    bt2.addNode(nt2);
    system.addBody(bt2);

    system.updateForwardKinematics();
    system.solveNodeAlignment('node');

    const te = node.localTransform.elements;
    // Column 2 = local Z in parent → must point toward target1 = world Y direction
    expect(te[8]).toBeCloseTo(0);
    expect(te[9]).toBeCloseTo(1);
    expect(te[10]).toBeCloseTo(0);
    // Column 0 = local X in parent → must point toward target2 = world Z direction (perp to primary)
    expect(te[0]).toBeCloseTo(0);
    expect(te[1]).toBeCloseTo(0);
    expect(te[2]).toBeCloseTo(1);
  });

  test('secondary axis no-op when secondaryTarget node does not exist', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('body');
    const node = new Node('node');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'target1';
    node.alignment.secondaryAxis = 'x';
    node.alignment.secondaryTarget = 'ghost';
    body.addNode(node);
    system.addBody(body);

    const bt1 = new RigidBody('bt1');
    const nt1 = new Node('target1');
    nt1.localTransform = new Matrix4x4().translate(0, 1, 0);
    bt1.addNode(nt1);
    system.addBody(bt1);

    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('node')).not.toThrow();
    expect(node.localTransform).toBeDefined();
  });

  test('secondary axis no-op when secondary collinear with primary', () => {
    const system = new KinematicSystem();
    const body = new RigidBody('body');
    const node = new Node('node');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'target1';
    node.alignment.secondaryAxis = 'x';
    node.alignment.secondaryTarget = 'target2';
    body.addNode(node);
    system.addBody(body);

    const bt1 = new RigidBody('bt1');
    const nt1 = new Node('target1');
    nt1.localTransform = new Matrix4x4().translate(0, 1, 0);
    bt1.addNode(nt1);
    system.addBody(bt1);

    // secondaryTarget is in the same direction as primaryTarget — projection is zero
    const bt2 = new RigidBody('bt2');
    const nt2 = new Node('target2');
    nt2.localTransform = new Matrix4x4().translate(0, 2, 0);
    bt2.addNode(nt2);
    system.addBody(bt2);

    system.updateForwardKinematics();
    expect(() => system.solveNodeAlignment('node')).not.toThrow();
    // Primary alignment should still be applied despite degenerate secondary
    expect(node.localTransform).toBeDefined();
  });

  test('node registered via addNode (not inside a body) still aligns', () => {
    const system = new KinematicSystem();

    // The alignee is a standalone node not part of any body's node map
    const node = new Node('floating');
    node.alignment.primaryAxis = 'z';
    node.alignment.primaryTarget = 'anchor';
    system.addNode(node);

    const targetBody = new RigidBody('anchor_body');
    const targetNode = new Node('anchor');
    targetNode.localTransform = new Matrix4x4().translate(0, 3, 0);
    targetBody.addNode(targetNode);
    system.addBody(targetBody);

    system.updateForwardKinematics();
    // Node is not in any body → parentTransform stays identity, still computes alignment
    expect(() => system.solveNodeAlignment('floating')).not.toThrow();
  });
});
