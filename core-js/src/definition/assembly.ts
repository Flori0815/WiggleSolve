import { Matrix4x4 } from '../math/Matrix4x4';
import type { KinematicSystem } from '../system/KinematicSystem';
import type { ActuatorDef } from './schema';

/**
 * Places every actuated body at the pivot of its most specific actuator so that
 * node `localTransform`s in a definition are relative to that pivot.
 *
 * Bodies that no actuator moves, and bodies listed in `explicitlyPlaced`, keep
 * their current transform and act as the roots of the placement.
 */
export function assembleKinematicChain(
  system: KinematicSystem,
  actuators: ActuatorDef[],
  explicitlyPlaced?: ReadonlySet<string>,
): void {
  const allMovingBodyIds = new Set<string>(actuators.flatMap(a => a.movingBodies));
  const positioned = new Set<string>(
    [...system.bodies.keys()].filter(id => !allMovingBodyIds.has(id) || explicitlyPlaced?.has(id)),
  );
  for (const id of positioned) system.bodies.get(id)!.updateNodes();

  let progress = true;
  while (progress) {
    progress = false;
    for (const [bodyId, body] of system.bodies) {
      if (positioned.has(bodyId)) continue;
      let best: ActuatorDef | null = null;
      for (const act of actuators) {
        if (!act.movingBodies.includes(bodyId)) continue;
        const pivotBody = system.findBodyOfNode(act.pivotNode);
        if (!pivotBody || !positioned.has(pivotBody.id)) continue;
        if (!best || act.movingBodies.length < best.movingBodies.length) best = act;
      }
      if (!best) continue;
      const [px, py, pz] = system.nodes.get(best.pivotNode)!.absoluteTransform.getTranslation();
      body.transform = new Matrix4x4().translate(px, py, pz);
      body.updateNodes();
      positioned.add(bodyId);
      progress = true;
    }
  }
}
