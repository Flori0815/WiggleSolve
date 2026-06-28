import { Matrix4x4, KinematicSystem } from 'core-js/src/index';
import type { DemoActuatorDef } from '../demos/index';

export function matrixFromArray(arr: number[]): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = new Float32Array(arr);
  return m;
}

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

export function cloneSystemState(system: KinematicSystem) {
  const jointValues: Record<string, number> = {};
  system.joints.forEach((j, id) => { jointValues[id] = j.value; });
  const bodyTransforms: Record<string, Float32Array> = {};
  system.bodies.forEach((b, id) => { bodyTransforms[id] = new Float32Array(b.transform.elements); });
  const nodeLocals: Record<string, Float32Array> = {};
  system.nodes.forEach((n, id) => { nodeLocals[id] = new Float32Array(n.localTransform.elements); });
  return { jointValues, bodyTransforms, nodeLocals };
}

export function restoreSystemState(system: KinematicSystem, state: ReturnType<typeof cloneSystemState>) {
  system.joints.forEach((j, id) => { if (state.jointValues[id] !== undefined) j.value = state.jointValues[id]; });
  system.bodies.forEach((b, id) => { if (state.bodyTransforms[id]) b.transform.elements.set(state.bodyTransforms[id]); });
  system.nodes.forEach((n, id) => { if (state.nodeLocals[id]) n.localTransform.elements.set(state.nodeLocals[id]); });
  system.updateForwardKinematics();
}
