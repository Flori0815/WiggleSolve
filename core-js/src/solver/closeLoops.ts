import type { RigidBody } from '../elements/RigidBody';
import { solveLinear } from '../math/linalg';
import type { KinematicSystem } from '../system/KinematicSystem';
import { applyJointDelta } from '../system/utils';

/** A joint taking part in a simultaneous closure, with how it moves the system. */
export interface LoopJoint {
  jointId: string;
  pivotNode: string;
  movingBodies: string[];
}

/**
 * Closes several kinematic loops at once: one damped Gauss-Newton
 * (Levenberg-Marquardt) step over `joints` that drives every node pair in
 * `pairs` together. Use it where loops are coupled so strongly that
 * one-joint-at-a-time `align_node` steps oscillate. The Jacobian is measured
 * numerically by moving each joint, so any joint arrangement works.
 */
export interface CloseLoopsOperation {
  type: 'close_loops';
  joints: LoopJoint[];
  pairs: Array<[string, string]>;
  /** Levenberg-Marquardt damping λ (default 1e-3); larger is slower but more robust. */
  damping?: number;
}

const PROBE = 1e-4;

function residual(system: KinematicSystem, pairs: Array<[string, string]>): number[] {
  return pairs.flatMap(([a, b]) => {
    const na = system.nodes.get(a);
    const nb = system.nodes.get(b);
    if (!na || !nb) throw new Error(`Operation Error: node ${!na ? a : b} not found.`);
    const pa = na.absoluteTransform.getTranslation();
    const pb = nb.absoluteTransform.getTranslation();
    return [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]];
  });
}

export function applyCloseLoops(system: KinematicSystem, op: CloseLoopsOperation): void {
  const joints = op.joints.map(j => {
    const joint = system.joints.get(j.jointId);
    if (!joint) throw new Error(`Operation Error: joint ${j.jointId} not found.`);
    if (!system.nodes.has(j.pivotNode)) throw new Error(`Operation Error: node ${j.pivotNode} not found.`);
    const bodies = j.movingBodies.map(id => system.bodies.get(id)).filter((b): b is RigidBody => b !== undefined);
    return { joint, pivotId: j.pivotNode, bodies };
  });
  const allBodies = [...new Set(joints.flatMap(j => j.bodies))];
  const move = (k: number, delta: number) =>
    applyJointDelta(joints[k].joint, system.nodes.get(joints[k].pivotId)!, joints[k].bodies, delta);

  const r0 = residual(system, op.pairs);
  const n = joints.length;

  // Numerical Jacobian: probe every joint and restore the exact state afterwards.
  const saved = allBodies.map(b => b.transform.clone());
  const restore = () => allBodies.forEach((b, i) => { b.transform = saved[i].clone(); b.updateNodes(); });
  const J: number[][] = r0.map(() => new Array<number>(n).fill(0));
  for (let k = 0; k < n; k++) {
    move(k, PROBE);
    const r = residual(system, op.pairs);
    r.forEach((v, i) => { J[i][k] = (v - r0[i]) / PROBE; });
    restore();
  }

  // (JᵀJ + λ²I) Δq = −Jᵀ r
  const lambda = op.damping ?? 1e-3;
  const A = Array.from({ length: n }, (_, a) => Array.from({ length: n }, (_, b) =>
    J.reduce((sum, row) => sum + row[a] * row[b], 0) + (a === b ? lambda * lambda : 0)));
  const g = Array.from({ length: n }, (_, a) => -J.reduce((sum, row, i) => sum + row[a] * r0[i], 0));
  const step = solveLinear(A, g);
  if (!step) return;

  step.forEach((delta, k) => {
    const { joint } = joints[k];
    const next = joint.clamp(joint.value + delta);
    const applied = next - joint.value;
    if (Math.abs(applied) < 1e-12) return;
    joint.value = next;
    move(k, applied);
  });
}
