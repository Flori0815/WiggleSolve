"""JSON interchange format: build a runnable system from a mechanism definition.

Mirrors ``core-js/src/definition`` (schema validation is only done in the
TypeScript core; this module expects a well-formed definition).
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Set, Union

from wigglesolve.elements.joint import Joint
from wigglesolve.elements.node import Node
from wigglesolve.elements.rigid_body import RigidBody
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.solver.conditions import Condition
from wigglesolve.solver.executor import Instruction, LoopInstruction, OperationInstruction
from wigglesolve.solver.operations import Operation
from wigglesolve.system.kinematic_system import KinematicSystem

Definition = Dict[str, Any]


def matrix_from_array(arr: Iterable[float]) -> Matrix4x4:
    m = Matrix4x4()
    m.elements = [float(v) for v in arr]
    return m


def assemble_kinematic_chain(
    system: KinematicSystem,
    actuators: List[Dict[str, Any]],
    explicitly_placed: Optional[Set[str]] = None,
) -> None:
    """Places every actuated body at the pivot of its most specific actuator.

    Bodies that no actuator moves, and bodies in ``explicitly_placed``, keep their
    current transform and act as the roots of the placement.
    """
    explicitly_placed = explicitly_placed or set()
    all_moving = {bid for act in actuators for bid in act['movingBodies']}
    positioned = {bid for bid in system.bodies if bid not in all_moving or bid in explicitly_placed}
    for bid in positioned:
        system.bodies[bid].update_nodes()

    progress = True
    while progress:
        progress = False
        for body_id, body in system.bodies.items():
            if body_id in positioned:
                continue
            best = None
            for act in actuators:
                if body_id not in act['movingBodies']:
                    continue
                pivot_body = system.find_body_of_node(act['pivotNode'])
                if pivot_body is None or pivot_body.id not in positioned:
                    continue
                if best is None or len(act['movingBodies']) < len(best['movingBodies']):
                    best = act
            if best is None:
                continue
            px, py, pz = system.nodes[best['pivotNode']].absolute_transform.get_translation()
            body.transform = Matrix4x4().translate(px, py, pz)
            body.update_nodes()
            positioned.add(body_id)
            progress = True


def build_system(definition: Definition, system: Optional[KinematicSystem] = None) -> KinematicSystem:
    """Builds bodies, nodes and joints into ``system`` (cleared first) and assembles it."""
    system = system or KinematicSystem()
    system.clear()
    explicitly_placed: Set[str] = set()

    for body_def in definition['system']['bodies']:
        body = RigidBody(body_def['id'])
        if body_def.get('transform') is not None:
            body.transform = matrix_from_array(body_def['transform'])
            explicitly_placed.add(body_def['id'])
        for node_def in body_def['nodes']:
            node = Node(node_def['id'])
            node.local_transform = matrix_from_array(node_def['localTransform'])
            body.add_node(node)
        system.add_body(body)

    for node_def in definition['system'].get('globalNodes', []):
        node = Node(node_def['id'])
        node.absolute_transform = matrix_from_array(node_def['absoluteTransform'])
        system.add_node(node)

    for joint_def in definition['system']['joints']:
        system.add_joint(Joint(
            id=joint_def['id'],
            type=joint_def['type'],
            axis=tuple(joint_def['axis']),
            value=0.0,
            limits=tuple(joint_def['limits']),
        ))

    assemble_kinematic_chain(system, definition.get('actuators', []), explicitly_placed)
    system.update_forward_kinematics()
    return system


def parse_instruction(raw: Dict[str, Any]) -> Instruction:
    if raw['type'] == 'operation':
        op = raw['operation']
        return OperationInstruction(Operation(
            type=op['type'],
            effector_node=op['effectorNode'],
            target_node=op['targetNode'],
            pivot_node=op['pivotNode'],
            joint_id=op['jointId'],
            moving_bodies=list(op['movingBodies']),
            damping=op.get('damping'),
        ))
    if raw['type'] == 'loop':
        cond = raw['condition']
        return LoopInstruction(
            max_iterations=raw['max_iterations'],
            condition=Condition(
                type=cond['type'],
                node_a=cond['nodeA'],
                node_b=cond['nodeB'],
                threshold=cond['threshold'],
            ),
            steps=[parse_instruction(s) for s in raw['steps']],
        )
    raise ValueError(f"Unknown instruction type: {raw['type']}")


def build_sequence(definition: Definition) -> List[Instruction]:
    return [parse_instruction(s) for s in definition['sequence']]


def load_definition_file(path: Union[str, Path]) -> Definition:
    with open(path, encoding='utf8') as f:
        return json.load(f)
