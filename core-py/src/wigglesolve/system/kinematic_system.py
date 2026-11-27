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

        parent_body = self.find_body_of_node(node.id)
        parent_transform = parent_body.transform.clone() if parent_body else Matrix4x4()

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

        sec_axis = node.alignment.secondary_axis
        sec_target_id = node.alignment.secondary_target
        sec_node = self.nodes.get(sec_target_id) if sec_target_id else None
        if sec_axis and sec_node and sec_axis != axis:
            look_at_mat = self._roll_towards(look_at_mat, z, parent_inv, my_pos, sec_node, sec_axis)

        local_pos = node.local_transform.get_translation()
        node.local_transform = look_at_mat.translate(local_pos[0], local_pos[1], local_pos[2])

    @staticmethod
    def _roll_towards(look_at_mat, z, parent_inv, my_pos, sec_node, sec_axis):
        """Rotates about the primary direction so ``sec_axis`` points at ``sec_node``."""
        sec_world_dir = Vector3(*sec_node.absolute_transform.get_translation()).sub(my_pos)
        if sec_world_dir.length() <= 1e-6:
            return look_at_mat
        sec_local_dir = parent_inv.rotate_vector(sec_world_dir.normalize()).normalize()
        sec_proj = sec_local_dir.sub(z.scale(sec_local_dir.dot(z)))
        if sec_proj.length() <= 1e-6:
            return look_at_mat
        sec_perp = sec_proj.normalize()
        unit = {'x': (1.0, 0.0, 0.0), 'y': (0.0, 1.0, 0.0), 'z': (0.0, 0.0, 1.0)}[sec_axis]
        cur_dir = look_at_mat.rotate_vector(Vector3(*unit))
        cur_proj = cur_dir.sub(z.scale(cur_dir.dot(z)))
        if cur_proj.length() <= 1e-6:
            return look_at_mat
        cur_perp = cur_proj.normalize()
        cos_t = max(-1.0, min(1.0, cur_perp.dot(sec_perp)))
        sin_t = cur_perp.cross(sec_perp).dot(z)
        theta = math.atan2(sin_t, cos_t)
        return Matrix4x4().rotate_axis((z.x, z.y, z.z), theta).multiply(look_at_mat)

    def remove_body(self, body_id: str) -> None:
        """Removes a body together with all nodes attached to it."""
        body = self.bodies.pop(body_id, None)
        if body:
            for node_id in body.nodes:
                self.nodes.pop(node_id, None)

    def remove_node(self, node_id: str) -> None:
        """Removes a node, detaching it from its owning body if it has one."""
        body = self.find_body_of_node(node_id)
        if body:
            body.nodes.pop(node_id, None)
        self.nodes.pop(node_id, None)

    def clear(self) -> None:
        self.bodies.clear()
        self.nodes.clear()
        self.joints.clear()

    def find_body_of_node(self, node_id: str) -> Optional[RigidBody]:
        for body in self.bodies.values():
            if node_id in body.nodes:
                return body
        return None

    def apply_actuator_delta(
        self,
        joint_id: str,
        pivot_node_id: str,
        moving_body_ids: List[str],
        delta_value: float,
    ) -> None:
        joint = self.joints.get(joint_id)
        pivot = self.nodes.get(pivot_node_id)
        if not joint or not pivot:
            return
        bodies = [self.bodies[b] for b in moving_body_ids if b in self.bodies]
        apply_joint_delta(joint, pivot, bodies, delta_value)


def apply_joint_delta(joint: Joint, pivot: Node, moving_bodies: List[RigidBody], delta_value: float) -> None:
    """Moves bodies by a joint increment in the pivot frame: T <- P * J(delta) * P^-1 * T."""
    if abs(delta_value) < 1e-8:
        return
    local_step = joint.get_transform_matrix(delta_value)
    delta_t = pivot.absolute_transform.multiply(local_step).multiply(pivot.absolute_transform.invert())
    for body in moving_bodies:
        body.transform = delta_t.multiply(body.transform)
        body.update_nodes()
