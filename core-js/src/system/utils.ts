import { Joint } from '../elements/Joint';
import { Node } from '../elements/Node';
import { RigidBody } from '../elements/RigidBody';
import { Matrix4x4 } from '../math/Matrix4x4';

/**
 * Computes a joint delta transform and applies it to a group of rigid bodies.
 * @param joint The joint whose value is being changed
 * @param pivot The node acting as the pivot for the transformation
 * @param movingBodies The list of rigid bodies to be transformed
 * @param deltaValue The change in the joint's value
 */
export function applyJointDelta(
  joint: Joint,
  pivot: Node,
  movingBodies: RigidBody[],
  deltaValue: number
): void {
  if (Math.abs(deltaValue) < 1e-8) return;

  let localStepMat = new Matrix4x4();
  const [ax, ay, az] = joint.axis;

  if (joint.type === 'revolute') {
    if (ax === 1) localStepMat = localStepMat.rotateX(deltaValue);
    else if (ay === 1) localStepMat = localStepMat.rotateY(deltaValue);
    else localStepMat = localStepMat.rotateZ(deltaValue);
  } else if (joint.type === 'prismatic') {
    localStepMat = localStepMat.translate(ax * deltaValue, ay * deltaValue, az * deltaValue);
  }

  const pivotInv = pivot.absoluteTransform.invert();
  const deltaT = pivot.absoluteTransform.multiply(localStepMat).multiply(pivotInv);

  for (const body of movingBodies) {
    body.transform = deltaT.multiply(body.transform);
    body.updateNodes();
  }
}
