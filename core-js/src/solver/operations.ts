import { KinematicSystem } from '../system/KinematicSystem';
import { Vector3 } from '../math/Vector3';

export interface Operation {
  type: 'align_node';
  targetNode: string;
  effectorNode: string;
  adjustVariables: string[];
}

export function applyOperation(system: KinematicSystem, operation: Operation): void {
  if (operation.type === 'align_node') {
    const targetNode = system.nodes.get(operation.targetNode);
    const effectorNode = system.nodes.get(operation.effectorNode);

    if (!targetNode || !effectorNode) {
      throw new Error(`Operation Error: Node ${operation.targetNode} or ${operation.effectorNode} not found.`);
    }

    const targetPos = new Vector3(...targetNode.absoluteTransform.getTranslation());
    let effectorPos = new Vector3(...effectorNode.absoluteTransform.getTranslation());

    // Iterate through adjustVariables (joint IDs) in reverse order (from effector up to root)
    // for a more natural CCD-like convergence.
    for (const jointId of [...operation.adjustVariables].reverse()) {
      const joint = system.joints.get(jointId);
      if (!joint) continue;

      // Find the parent node of this joint
      const connection = system.connections.find(c => c.jointId === jointId);
      if (!connection) continue;
      const parentNode = system.nodes.get(connection.parentNodeId);
      if (!parentNode) continue;

      const jointPos = new Vector3(...parentNode.absoluteTransform.getTranslation());
      const worldAxis = parentNode.absoluteTransform.rotateVector(new Vector3(...joint.axis)).normalize();

      if (joint.type === 'revolute') {
        const jToE = effectorPos.sub(jointPos);
        const jToT = targetPos.sub(jointPos);

        if (jToE.length() < 1e-6 || jToT.length() < 1e-6) continue;

        const jToEn = jToE.normalize();
        const jToTn = jToT.normalize();

        // Calculate angle between vectors
        let dot = jToEn.dot(jToTn);
        dot = Math.max(-1, Math.min(1, dot));
        const angle = Math.acos(dot);

        if (angle < 1e-6) continue;

        // Calculate rotation axis
        const cross = jToEn.cross(jToTn).normalize();

        // Project rotation onto joint axis
        const projection = cross.dot(worldAxis);

        // Use the magnitude of the projection for better stability in 3D
        // The angle to rotate around the joint axis is roughly angle * projection
        const step = angle * projection * 0.5;

        joint.value += step;
        // Apply limits
        joint.value = Math.max(joint.limits[0], Math.min(joint.limits[1], joint.value));

      } else if (joint.type === 'prismatic') {
        const jToE = effectorPos.sub(jointPos);
        const jToT = targetPos.sub(jointPos);

        // Project desired movement onto world axis
        const desiredMove = jToT.sub(jToE);
        const step = desiredMove.dot(worldAxis) * 0.5;

        joint.value += step;
        // Apply limits
        joint.value = Math.max(joint.limits[0], Math.min(joint.limits[1], joint.value));
      }

      // Update FK after each joint adjustment for better convergence
      system.updateForwardKinematics();
      // Update effector position for next joint in the chain
      effectorPos = new Vector3(...effectorNode.absoluteTransform.getTranslation());
    }
    return;
  }

  throw new Error(`Unsupported operation type: ${(operation as any).type}`);
}
