import { KinematicSystem } from '../system/KinematicSystem';
import { Vector3 } from '../math/Vector3';
import { applyJointDelta } from '../system/utils';
import { RigidBody } from '../elements/RigidBody';

import { applyCloseLoops } from './closeLoops';
import type { CloseLoopsOperation } from './closeLoops';

/** Moves one joint so that `effectorNode` approaches `targetNode` (one CCD step). */
export interface AlignNodeOperation {
  type: 'align_node';
  effectorNode: string;
  targetNode: string;
  pivotNode: string;
  jointId: string;
  movingBodies: string[];
  damping?: number;
}

export type Operation = AlignNodeOperation | CloseLoopsOperation;

/** Ids of the joints an operation moves. */
export function operationJointIds(operation: Operation): string[] {
  return operation.type === 'align_node' ? [operation.jointId] : operation.joints.map(j => j.jointId);
}

/** Deep copy of an operation. */
export function copyOperation<O extends Operation>(operation: O): O {
  if (operation.type === 'align_node') return { ...operation, movingBodies: [...operation.movingBodies] };
  return {
    ...operation,
    joints: operation.joints.map(j => ({ ...j, movingBodies: [...j.movingBodies] })),
    pairs: operation.pairs.map(([a, b]) => [a, b]),
  };
}

export function applyOperation(system: KinematicSystem, operation: Operation): void {
  if (operation.type === 'close_loops') {
    applyCloseLoops(system, operation);
    return;
  }
  if (operation.type === 'align_node') {
    const effector = system.nodes.get(operation.effectorNode);
    const target = system.nodes.get(operation.targetNode);
    const pivot = system.nodes.get(operation.pivotNode);
    const joint = system.joints.get(operation.jointId);

    if (!effector || !target || !pivot || !joint) {
      throw new Error(`Operation Error: Required elements not found.`);
    }

    const pPos = new Vector3(...pivot.absoluteTransform.getTranslation());
    const ePos = new Vector3(...effector.absoluteTransform.getTranslation());
    const tPos = new Vector3(...target.absoluteTransform.getTranslation());

    // Joint axis in world space
    const worldAxis = pivot.absoluteTransform.rotateVector(new Vector3(...joint.axis)).normalize();

    let step = 0;

    if (joint.type === 'revolute') {
      const pToE = ePos.sub(pPos);
      const pToT = tPos.sub(pPos);

      if (pToE.length() < 1e-6 || pToT.length() < 1e-6) return;

      const pToEn = pToE.normalize();
      const pToTn = pToT.normalize();

      const dot = Math.max(-1, Math.min(1, pToEn.dot(pToTn)));
      const angle = Math.acos(dot);

      if (angle < 1e-6) return;

      const cross = pToEn.cross(pToTn).normalize();
      const projection = cross.dot(worldAxis);
      
      // Step size (with some damping for stability)
      step = angle * projection * (operation.damping ?? 0.5);

    } else if (joint.type === 'prismatic') {
      const eToT = tPos.sub(ePos);
      step = eToT.dot(worldAxis) * (operation.damping ?? 0.5);
    }

    if (Math.abs(step) < 1e-8) return;

    // Apply limits
    const newValue = joint.clamp(joint.value + step);
    const actualStep = newValue - joint.value;
    if (Math.abs(actualStep) < 1e-8) return;

    joint.value = newValue;

    const movingBodies = operation.movingBodies
      .map((id) => system.bodies.get(id))
      .filter((body): body is RigidBody => body !== undefined);

    applyJointDelta(joint, pivot, movingBodies, actualStep);

    return;
  }

  throw new Error(`Unsupported operation type: ${(operation as { type: string }).type}`);
}
