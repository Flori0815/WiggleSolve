import json
from pathlib import Path

from wigglesolve.system.kinematic_system import KinematicSystem
from wigglesolve.elements.node import Node
from wigglesolve.elements.rigid_body import RigidBody
from wigglesolve.elements.joint import Joint
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.solver.executor import Executor, OperationInstruction, LoopInstruction
from wigglesolve.solver.operations import Operation
from wigglesolve.solver.conditions import Condition


def _matrix_from_array(arr):
    m = Matrix4x4()
    m.elements = list(arr)
    return m


def _assemble_kinematic_chain(system, actuators):
    """Position moving bodies along the kinematic chain defined by the actuators.

    Without this step every body starts at the world origin, which causes revolute
    joints to degenerate when the effector node coincides with the pivot node.
    Each body's origin is placed at its most-specific parent actuator's pivot
    position so the arm is in a fully-extended, non-degenerate start pose.
    """
    all_moving = set(bid for act in actuators for bid in act['movingBodies'])

    # Root bodies are already at identity; compute their nodes.
    positioned = set(bid for bid in system.bodies if bid not in all_moving)
    for bid in positioned:
        system.bodies[bid].update_nodes()

    progress = True
    while progress:
        progress = False
        for body_id, body in system.bodies.items():
            if body_id in positioned:
                continue

            # Find the most specific actuator whose pivot is in a positioned body.
            best = None
            for act in actuators:
                if body_id not in act['movingBodies']:
                    continue
                pivot_body_positioned = any(
                    act['pivotNode'] in b.nodes and bid in positioned
                    for bid, b in system.bodies.items()
                )
                if not pivot_body_positioned:
                    continue
                if best is None or len(act['movingBodies']) < len(best['movingBodies']):
                    best = act

            if best is None:
                continue

            pivot = system.nodes[best['pivotNode']]
            px, py, pz = pivot.absolute_transform.get_translation()
            body.transform = Matrix4x4().translate(px, py, pz)
            body.update_nodes()
            positioned.add(body_id)
            progress = True


def _parse_instruction(raw):
    if raw['type'] == 'operation':
        op = raw['operation']
        return OperationInstruction(Operation(
            type=op['type'],
            effector_node=op['effectorNode'],
            target_node=op['targetNode'],
            pivot_node=op['pivotNode'],
            joint_id=op['jointId'],
            moving_bodies=op['movingBodies'],
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
            steps=[_parse_instruction(s) for s in raw['steps']],
        )
    raise ValueError(f"Unknown instruction type: {raw['type']}")


def load_and_run(definition_path):
    """Load a JSON kinematic definition, execute its solving sequence, and return results."""
    with open(definition_path) as f:
        raw = json.load(f)

    system = KinematicSystem()

    for body_def in raw['system']['bodies']:
        body = RigidBody(body_def['id'])
        for node_def in body_def['nodes']:
            node = Node(node_def['id'])
            node.local_transform = _matrix_from_array(node_def['localTransform'])
            body.add_node(node)
        system.add_body(body)

    for node_def in raw['system'].get('globalNodes', []):
        node = Node(node_def['id'])
        node.absolute_transform = _matrix_from_array(node_def['absoluteTransform'])
        system.add_node(node)

    for joint_def in raw['system']['joints']:
        joint = Joint(
            id=joint_def['id'],
            type=joint_def['type'],
            axis=tuple(joint_def['axis']),
            value=0.0,
            limits=tuple(joint_def['limits']),
        )
        system.add_joint(joint)

    _assemble_kinematic_chain(system, raw.get('actuators', []))
    system.update_forward_kinematics()

    sequence = [_parse_instruction(s) for s in raw['sequence']]
    executor = Executor(system)
    converged = executor.execute(sequence)

    return {
        'converged': converged,
        'joint_values': {jid: j.value for jid, j in system.joints.items()},
        'node_positions': {nid: n.absolute_transform.get_translation() for nid, n in system.nodes.items()},
    }
