import { KinematicSystem } from '../system/KinematicSystem';
import { Vector3 } from '../math/Vector3';
import { Matrix4x4 } from '../math/Matrix4x4';

export interface Operation {
  type: 'align_node';
  effectorNode: string;
  targetNode: string;
  pivotNode: string;
  jointId: string;
  movingBodies: string[];
}

export function applyOperation(system: KinematicSystem, operation: Operation): void {
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
      step = angle * projection * 0.5;

    } else if (joint.type === 'prismatic') {
      const eToT = tPos.sub(ePos);
      step = eToT.dot(worldAxis) * 0.5;
    }

    if (Math.abs(step) < 1e-8) return;

    // Apply limits
    const newValue = Math.max(joint.limits[0], Math.min(joint.limits[1], joint.value + step));
    const actualStep = newValue - joint.value;
    if (Math.abs(actualStep) < 1e-8) return;

    joint.value = newValue;

    // Calculate Delta Transform Matrix at Pivot
    // DeltaT = M_pivot * R_local_step * M_pivot_inv
    const localStepMat = new Matrix4x4();
    const [ax, ay, az] = joint.axis;
    if (joint.type === 'revolute') {
      if (ax === 1) localStepMat.rotateX(actualStep);
      else if (ay === 1) localStepMat.rotateY(actualStep);
      else localStepMat.rotateZ(actualStep);
    } else {
      localStepMat.translate(ax * actualStep, ay * actualStep, az * actualStep);
    }

    const pivotInv = pivot.absoluteTransform.clone().invert();
    const deltaT = pivot.absoluteTransform.clone().multiply(localStepMat).multiply(pivotInv);

    // Apply DeltaT to all moving bodies
    for (const bodyId of operation.movingBodies) {
      const body = system.bodies.get(bodyId);
      if (body) {
        body.transform = deltaT.clone().multiply(body.transform);
        body.updateNodes();
      }
    }

    return;
  }

  throw new Error(`Unsupported operation type: ${(operation as any).type}`);
}
