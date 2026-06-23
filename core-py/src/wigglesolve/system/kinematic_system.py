from __future__ import annotations
import math
from typing import List, Optional
from wigglesolve.math.vector3 import Vector3
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.elements.node import Node
from wigglesolve.elements.joint import Joint
from wigglesolve.elements.rigid_body import RigidBody


class KinematicSystem:
    def __init__(self) -> None:
        self.bodies: dict[str, RigidBody] = {}
        self.nodes: dict[str, Node] = {}
        self.joints: dict[str, Joint] = {}

    def add_body(self, body: RigidBody) -> None:
        self.bodies[body.id] = body
        for node in body.nodes.values():
            self.nodes[node.id] = node

    def add_node(self, node: Node, body_id: Optional[str] = None) -> None:
        self.nodes[node.id] = node
        if body_id:
            body = self.bodies.get(body_id)
            if body:
                body.add_node(node)

    def add_joint(self, joint: Joint) -> None:
        self.joints[joint.id] = joint

    def update_forward_kinematics(self) -> None:
        for body in self.bodies.values():
            body.update_nodes()

    def solve_node_alignment(self, node_id: str) -> None:
        node = self.nodes.get(node_id)
        if not node or not node.alignment.primary_target:
            return

        target_node = self.nodes.get(node.alignment.primary_target)
        if not target_node:
            return

        parent_transform = Matrix4x4()
        for body in self.bodies.values():
            if node.id in body.nodes:
                parent_transform = body.transform.clone()
                break

        my_pos = Vector3(*node.absolute_transform.get_translation())
        target_pos = Vector3(*target_node.absolute_transform.get_translation())
        world_dir = target_pos.sub(my_pos).normalize()
        if world_dir.length() < 1e-6:
            return

        parent_inv = parent_transform.clone().invert()
        desired_local_dir = parent_inv.rotate_vector(world_dir).normalize()

        z = desired_local_dir.clone()
        x = Vector3(1.0, 0.0, 0.0)
        if abs(z.dot(x)) > 0.99:
            x = Vector3(0.0, 1.0, 0.0)
        y = z.cross(x).normalize()
        x = y.cross(z).normalize()

        look_at_mat = Matrix4x4()
        te = look_at_mat.elements
        axis = node.alignment.primary_axis or "z"

        if axis == "z":
            te[0] = x.x; te[1] = x.y; te[2] = x.z
            te[4] = y.x; te[5] = y.y; te[6] = y.z
            te[8] = z.x; te[9] = z.y; te[10] = z.z
        elif axis == "x":
            te[0] = z.x; te[1] = z.y; te[2] = z.z
            te[4] = x.x; te[5] = x.y; te[6] = x.z
            te[8] = y.x; te[9] = y.y; te[10] = y.z
        else:
            te[0] = y.x; te[1] = y.y; te[2] = y.z
            te[4] = z.x; te[5] = z.y; te[6] = z.z
            te[8] = x.x; te[9] = x.y; te[10] = x.z

        local_pos = node.local_transform.get_translation()
        node.local_transform = look_at_mat.translate(local_pos[0], local_pos[1], local_pos[2])

    def apply_actuator_delta(
        self,
        joint_id: str,
        pivot_node_id: str,
        moving_body_ids: List[str],
        delta_value: float,
    ) -> None:
        joint = self.joints.get(joint_id)
        pivot = self.nodes.get(pivot_node_id)
        if not joint or not pivot or abs(delta_value) < 1e-8:
            return

        local_step_mat = Matrix4x4()
        axis = joint.axis
        if joint.type == "revolute":
            if axis[0] == 1:
                local_step_mat.rotate_x(delta_value)
            elif axis[1] == 1:
                local_step_mat.rotate_y(delta_value)
            else:
                local_step_mat.rotate_z(delta_value)
        else:
            local_step_mat.translate(axis[0] * delta_value, axis[1] * delta_value, axis[2] * delta_value)

        pivot_inv = pivot.absolute_transform.clone().invert()
        delta_t = pivot.absolute_transform.clone().multiply(local_step_mat).multiply(pivot_inv)

        for body_id in moving_body_ids:
            body = self.bodies.get(body_id)
            if body:
                body.transform = delta_t.clone().multiply(body.transform)
                body.update_nodes()
