import type { KinematicSystem } from './KinematicSystem';

/** Mutable state of a system: joint values, body placements and node frames. */
export interface SystemSnapshot {
  jointValues: Map<string, number>;
  bodyTransforms: Map<string, Float32Array>;
  nodeLocals: Map<string, Float32Array>;
  globalNodeTransforms: Map<string, Float32Array>;
}

export function captureSnapshot(system: KinematicSystem): SystemSnapshot {
  const snapshot: SystemSnapshot = {
    jointValues: new Map(),
    bodyTransforms: new Map(),
    nodeLocals: new Map(),
    globalNodeTransforms: new Map(),
  };
  system.joints.forEach((j, id) => snapshot.jointValues.set(id, j.value));
  system.bodies.forEach((b, id) => snapshot.bodyTransforms.set(id, Float32Array.from(b.transform.elements)));
  system.nodes.forEach((n, id) => {
    snapshot.nodeLocals.set(id, Float32Array.from(n.localTransform.elements));
    if (!system.findBodyOfNode(id)) {
      snapshot.globalNodeTransforms.set(id, Float32Array.from(n.absoluteTransform.elements));
    }
  });
  return snapshot;
}

/** Restores a snapshot onto the elements that still exist in the system. */
export function restoreSnapshot(system: KinematicSystem, snapshot: SystemSnapshot): void {
  system.joints.forEach((j, id) => {
    const v = snapshot.jointValues.get(id);
    if (v !== undefined) j.value = v;
  });
  system.bodies.forEach((b, id) => {
    const t = snapshot.bodyTransforms.get(id);
    if (t) b.transform.elements.set(t);
  });
  system.nodes.forEach((n, id) => {
    const local = snapshot.nodeLocals.get(id);
    if (local) n.localTransform.elements.set(local);
    const global = snapshot.globalNodeTransforms.get(id);
    if (global) n.absoluteTransform.elements.set(global);
  });
  system.updateForwardKinematics();
}
