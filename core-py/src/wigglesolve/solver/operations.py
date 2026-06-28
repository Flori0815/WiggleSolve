from __future__ import annotations
import math
from dataclasses import dataclass, field
from typing import List, Literal
from wigglesolve.math.vector3 import Vector3
from wigglesolve.math.matrix4x4 import Matrix4x4


@dataclass
class Operation:
    type: Literal["align_node"]
    effector_node: str
    target_node: str
    pivot_node: str
    joint_id: str
    moving_bodies: List[str]


def apply_operation(system, operation: Operation) -> None:
    if operation.type == "align_node":
        effector = system.nodes.get(operation.effector_node)
        target = system.nodes.get(operation.target_node)
        pivot = system.nodes.get(operation.pivot_node)
        joint = system.joints.get(operation.joint_id)

        if not effector or not target or not pivot or not joint:
            raise ValueError("Operation Error: Required elements not found.")

        p_pos = Vector3(*pivot.absolute_transform.get_translation())
        e_pos = Vector3(*effector.absolute_transform.get_translation())
        t_pos = Vector3(*target.absolute_transform.get_translation())

        world_axis = pivot.absolute_transform.rotate_vector(
            Vector3(*joint.axis)
        ).normalize()

        step = 0.0

        if joint.type == "revolute":
            p_to_e = e_pos.sub(p_pos)
            p_to_t = t_pos.sub(p_pos)

            if p_to_e.length() < 1e-6 or p_to_t.length() < 1e-6:
                return

            p_to_en = p_to_e.normalize()
            p_to_tn = p_to_t.normalize()

            dot = max(-1.0, min(1.0, p_to_en.dot(p_to_tn)))
            angle = math.acos(dot)

            if angle < 1e-6:
                return

            cross = p_to_en.cross(p_to_tn).normalize()
            projection = cross.dot(world_axis)
            step = angle * projection * 0.5

        elif joint.type == "prismatic":
            e_to_t = t_pos.sub(e_pos)
            step = e_to_t.dot(world_axis) * 0.5

        if abs(step) < 1e-8:
            return

        new_value = max(joint.limits[0], min(joint.limits[1], joint.value + step))
        actual_step = new_value - joint.value
        if abs(actual_step) < 1e-8:
            return

        joint.value = new_value

        local_step_mat = Matrix4x4()
        ax, ay, az = joint.axis
        if joint.type == "revolute":
            if ax == 1:
                local_step_mat = local_step_mat.rotate_x(actual_step)
            elif ay == 1:
                local_step_mat = local_step_mat.rotate_y(actual_step)
            else:
                local_step_mat = local_step_mat.rotate_z(actual_step)
        else:
            local_step_mat = local_step_mat.translate(ax * actual_step, ay * actual_step, az * actual_step)

        pivot_inv = pivot.absolute_transform.invert()
        delta_t = pivot.absolute_transform.multiply(local_step_mat).multiply(pivot_inv)

        for body_id in operation.moving_bodies:
            body = system.bodies.get(body_id)
            if body:
                body.transform = delta_t.multiply(body.transform)
                body.update_nodes()

        return

    raise ValueError(f"Unsupported operation type: {operation.type}")
