"""Simultaneous loop closure (mirrors core-js/src/solver/closeLoops.ts)."""
from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from wigglesolve.math.linalg import solve_linear
from wigglesolve.system.kinematic_system import apply_joint_delta

PROBE = 1e-4


@dataclass
class LoopJoint:
    joint_id: str
    pivot_node: str
    moving_bodies: List[str]


@dataclass
class CloseLoopsOperation:
    joints: List[LoopJoint]
    pairs: List[Tuple[str, str]]
    damping: Optional[float] = None
    type: str = field(default="close_loops")


def _residual(system, pairs):
    out = []
    for a, b in pairs:
        na, nb = system.nodes.get(a), system.nodes.get(b)
        if na is None or nb is None:
            raise ValueError(f"Operation Error: node {a if na is None else b} not found.")
        pa = na.absolute_transform.get_translation()
        pb = nb.absolute_transform.get_translation()
        out.extend(pa[i] - pb[i] for i in range(3))
    return out


def apply_close_loops(system, op: CloseLoopsOperation) -> None:
    """One damped Gauss-Newton step driving every pair in ``op.pairs`` together."""
    joints = []
    for lj in op.joints:
        joint = system.joints.get(lj.joint_id)
        if joint is None:
            raise ValueError(f"Operation Error: joint {lj.joint_id} not found.")
        if lj.pivot_node not in system.nodes:
            raise ValueError(f"Operation Error: node {lj.pivot_node} not found.")
        bodies = [system.bodies[b] for b in lj.moving_bodies if b in system.bodies]
        joints.append((joint, lj.pivot_node, bodies))

    all_bodies = list({id(b): b for _, _, bs in joints for b in bs}.values())

    def move(k, delta):
        joint, pivot_id, bodies = joints[k]
        apply_joint_delta(joint, system.nodes[pivot_id], bodies, delta)

    r0 = _residual(system, op.pairs)
    n = len(joints)
    saved = [b.transform.clone() for b in all_bodies]
    jac = [[0.0] * n for _ in r0]
    for k in range(n):
        move(k, PROBE)
        r = _residual(system, op.pairs)
        for i, v in enumerate(r):
            jac[i][k] = (v - r0[i]) / PROBE
        for b, t in zip(all_bodies, saved):
            b.transform = t.clone()
            b.update_nodes()

    lam = 1e-3 if op.damping is None else op.damping
    a = [[sum(row[p] * row[q] for row in jac) + (lam * lam if p == q else 0.0) for q in range(n)] for p in range(n)]
    g = [-sum(row[p] * r0[i] for i, row in enumerate(jac)) for p in range(n)]
    step = solve_linear(a, g)
    if step is None:
        return
    for k, delta in enumerate(step):
        joint = joints[k][0]
        nxt = joint.clamp(joint.value + delta)
        applied = nxt - joint.value
        if abs(applied) < 1e-12:
            continue
        joint.value = nxt
        move(k, applied)
