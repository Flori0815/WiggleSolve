import { Joint } from '../elements/Joint';
import { Node } from '../elements/Node';
import { RigidBody } from '../elements/RigidBody';

/**
 * Moves a group of rigid bodies by a joint increment expressed in the pivot frame:
 * `T_body ← P · J(delta) · P⁻¹ · T_body`.
 */
export function applyJointDelta(
  joint: Joint,
  pivot: Node,
  movingBodies: RigidBody[],
  deltaValue: number,
): void {
  if (Math.abs(deltaValue) < 1e-8) return;

  const localStep = joint.getTransformMatrix(deltaValue);
  const pivotInv = pivot.absoluteTransform.invert();
  const deltaT = pivot.absoluteTransform.multiply(localStep).multiply(pivotInv);

  for (const body of movingBodies) {
    body.transform = deltaT.multiply(body.transform);
    body.updateNodes();
  }
}
