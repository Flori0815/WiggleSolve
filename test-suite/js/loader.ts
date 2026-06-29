import * as fs from 'fs';
import { KinematicSystem } from '../../core-js/src/system/KinematicSystem';
import { Node } from '../../core-js/src/elements/Node';
import { RigidBody } from '../../core-js/src/elements/RigidBody';
import { Joint } from '../../core-js/src/elements/Joint';
import { Matrix4x4 } from '../../core-js/src/math/Matrix4x4';
import { Executor, Instruction } from '../../core-js/src/solver/Executor';
import type { Operation } from '../../core-js/src/solver/operations';
import type { Condition } from '../../core-js/src/solver/conditions';
import { assembleKinematicChain } from '../../core-js/src/system/assembly';

export interface SolveResult {
  converged: boolean;
  jointValues: Record<string, number>;
  nodePositions: Record<string, [number, number, number]>;
}

function matrixFromArray(arr: number[]): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = new Float32Array(arr);
  return m;
}


function parseInstruction(raw: Record<string, unknown>): Instruction {
  if (raw['type'] === 'operation') {
    const op = raw['operation'] as Record<string, unknown>;
    return {
      type: 'operation',
      operation: {
        type: op['type'],
        effectorNode: op['effectorNode'],
        targetNode: op['targetNode'],
        pivotNode: op['pivotNode'],
        jointId: op['jointId'],
        movingBodies: op['movingBodies'],
      } as Operation,
    };
  }
  if (raw['type'] === 'loop') {
    const cond = raw['condition'] as Record<string, unknown>;
    return {
      type: 'loop',
      max_iterations: raw['max_iterations'] as number,
      condition: {
        type: cond['type'],
        nodeA: cond['nodeA'],
        nodeB: cond['nodeB'],
        threshold: cond['threshold'],
      } as Condition,
      steps: (raw['steps'] as Record<string, unknown>[]).map(parseInstruction),
    };
  }
  throw new Error(`Unknown instruction type: ${raw['type']}`);
}

export function loadAndRun(definitionPath: string): SolveResult {
  const raw = JSON.parse(fs.readFileSync(definitionPath, 'utf8'));
  const system = new KinematicSystem();

  for (const bodyDef of raw.system.bodies) {
    const body = new RigidBody(bodyDef.id);
    for (const nodeDef of bodyDef.nodes) {
      const node = new Node(nodeDef.id);
      node.localTransform = matrixFromArray(nodeDef.localTransform);
      body.addNode(node);
    }
    system.addBody(body);
  }

  for (const nodeDef of raw.system.globalNodes ?? []) {
    const node = new Node(nodeDef.id);
    node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
    system.addNode(node);
  }

  for (const jointDef of raw.system.joints) {
    const joint = new Joint(
      jointDef.id,
      jointDef.type,
      jointDef.axis as [number, number, number],
      0,
      jointDef.limits as [number, number],
    );
    system.addJoint(joint);
  }

  assembleKinematicChain(system, raw.actuators ?? []);
  system.updateForwardKinematics();

  const sequence = (raw.sequence as Record<string, unknown>[]).map(parseInstruction);
  const executor = new Executor(system);
  const converged = executor.execute(sequence);

  const jointValues: Record<string, number> = {};
  for (const [id, joint] of system.joints.entries()) {
    jointValues[id] = joint.value;
  }

  const nodePositions: Record<string, [number, number, number]> = {};
  for (const [id, node] of system.nodes.entries()) {
    nodePositions[id] = node.absoluteTransform.getTranslation();
  }

  return { converged, jointValues, nodePositions };
}
