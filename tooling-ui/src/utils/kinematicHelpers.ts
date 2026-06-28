import { Matrix4x4, KinematicSystem } from 'core-js/src/index';
export { assembleKinematicChain } from 'core-js/src/system/assembly';

export function matrixFromArray(arr: number[]): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = new Float32Array(arr);
  return m;
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
