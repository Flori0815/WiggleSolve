import { Matrix4x4 } from '../math/Matrix4x4';
import { KinematicSystem } from './KinematicSystem';
import type { DemoActuatorDef } from '../schema';

export function assembleKinematicChain(system: KinematicSystem, actuators: DemoActuatorDef[]): void {
  const allMovingBodyIds = new Set<string>(actuators.flatMap(a => a.movingBodies));
  const positioned = new Set<string>(
    [...system.bodies.keys()].filter(id => !allMovingBodyIds.has(id)),
  );
  for (const id of positioned) system.bodies.get(id)!.updateNodes();

  let progress = true;
  while (progress) {
    progress = false;
    for (const [bodyId, body] of system.bodies) {
      if (positioned.has(bodyId)) continue;
      let best: DemoActuatorDef | null = null;
      for (const act of actuators) {
        if (!act.movingBodies.includes(bodyId)) continue;
        let pivotBodyPositioned = false;
        for (const [bid, b] of system.bodies) {
          if (b.nodes.has(act.pivotNode) && positioned.has(bid)) { pivotBodyPositioned = true; break; }
        }
        if (!pivotBodyPositioned) continue;
        if (!best || act.movingBodies.length < best.movingBodies.length) best = act;
      }
      if (!best) continue;
      const pivot = system.nodes.get(best.pivotNode)!;
      const [px, py, pz] = pivot.absoluteTransform.getTranslation();
      body.transform = new Matrix4x4().translate(px, py, pz);
      body.updateNodes();
      positioned.add(bodyId);
      progress = true;
    }
  }
}
