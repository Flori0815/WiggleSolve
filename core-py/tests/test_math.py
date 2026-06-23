import math
import pytest
from wigglesolve.math.vector3 import Vector3
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.elements.node import Node
from wigglesolve.elements.joint import Joint
from wigglesolve.elements.rigid_body import RigidBody
from wigglesolve.system.kinematic_system import KinematicSystem


class TestVector3BasicOperations:
    def test_dot_product_perpendicular(self):
        v1 = Vector3(1, 0, 0)
        v2 = Vector3(0, 1, 0)
        assert v1.dot(v2) == 0

    def test_cross_product(self):
        v1 = Vector3(1, 0, 0)
        v2 = Vector3(0, 1, 0)
        v3 = v1.cross(v2)
        assert v3.x == 0
        assert v3.y == 0
        assert v3.z == 1

    def test_distance_to(self):
        v1 = Vector3(1, 0, 0)
        v2 = Vector3(0, 1, 0)
        assert abs(v1.distance_to(v2) - math.sqrt(2)) < 1e-10

    def test_length(self):
        v = Vector3(3, 4, 0)
        assert abs(v.length() - 5.0) < 1e-10

    def test_normalize(self):
        v = Vector3(3, 0, 0)
        n = v.normalize()
        assert abs(n.x - 1.0) < 1e-10
        assert abs(n.y) < 1e-10
        assert abs(n.z) < 1e-10

    def test_normalize_zero_vector(self):
        v = Vector3(0, 0, 0)
        n = v.normalize()
        assert n.x == 0 and n.y == 0 and n.z == 0

    def test_add(self):
        v1 = Vector3(1, 2, 3)
        v2 = Vector3(4, 5, 6)
        r = v1.add(v2)
        assert r.x == 5 and r.y == 7 and r.z == 9

    def test_sub(self):
        v1 = Vector3(5, 7, 9)
        v2 = Vector3(1, 2, 3)
        r = v1.sub(v2)
        assert r.x == 4 and r.y == 5 and r.z == 6

    def test_scale(self):
        v = Vector3(1, 2, 3)
        r = v.scale(3)
        assert r.x == 3 and r.y == 6 and r.z == 9

    def test_clone(self):
        v = Vector3(1, 2, 3)
        c = v.clone()
        c.x = 99
        assert v.x == 1


class TestMatrix4x4:
    def test_identity_diagonal(self):
        m = Matrix4x4()
        assert m.elements[0] == 1
        assert m.elements[5] == 1
        assert m.elements[10] == 1
        assert m.elements[15] == 1

    def test_identity_off_diagonal(self):
        m = Matrix4x4()
        assert m.elements[1] == 0
        assert m.elements[4] == 0

    def test_translation(self):
        m = Matrix4x4()
        m.translate(10, 20, 30)
        x, y, z = m.get_translation()
        assert x == 10 and y == 20 and z == 30

    def test_rotate_z_90(self):
        m = Matrix4x4()
        m.rotate_z(math.pi / 2)
        m.translate(1, 0, 0)
        x, y, z = m.get_translation()
        assert abs(x) < 1e-5
        assert abs(y - 1) < 1e-5
        assert abs(z) < 1e-10

    def test_multiply_non_commutative(self):
        a = Matrix4x4().translate(2, 3, 4)
        b = Matrix4x4().rotate_z(math.pi / 2)

        ab = a.clone().multiply(b)
        abx, aby, abz = ab.get_translation()
        assert abs(abx - 2) < 1e-5
        assert abs(aby - 3) < 1e-5
        assert abs(abz - 4) < 1e-5
        x_col = ab.rotate_vector(Vector3(1, 0, 0))
        assert abs(x_col.x) < 1e-5
        assert abs(x_col.y - 1) < 1e-5

        ba = b.clone().multiply(a)
        bax, bay, baz = ba.get_translation()
        assert abs(bax - (-3)) < 1e-5
        assert abs(bay - 2) < 1e-5
        assert abs(baz - 4) < 1e-5

    def test_invert_identity(self):
        m = Matrix4x4()
        m.invert()
        assert m.elements[0] == 1
        assert m.elements[5] == 1
        assert m.elements[10] == 1
        assert m.elements[15] == 1

    def test_invert_translation(self):
        m = Matrix4x4().translate(5, -3, 2)
        m.invert()
        x, y, z = m.get_translation()
        assert abs(x - (-5)) < 1e-5
        assert abs(y - 3) < 1e-5
        assert abs(z - (-2)) < 1e-5

    def test_from_translation_static(self):
        m = Matrix4x4.from_translation(1, 2, 3)
        x, y, z = m.get_translation()
        assert x == 1 and y == 2 and z == 3

    def test_clone_is_independent(self):
        m = Matrix4x4().translate(1, 2, 3)
        c = m.clone()
        c.translate(10, 0, 0)
        x, _, _ = m.get_translation()
        assert abs(x - 1) < 1e-10


def _build_two_link_arm(angle_j1: float, angle_j2: float):
    system = KinematicSystem()

    body_link1 = RigidBody("link1")
    pivot1 = Node("pivot1")
    pivot2 = Node("pivot2")
    pivot2.local_transform = Matrix4x4().translate(10, 0, 0)
    body_link1.add_node(pivot1)
    body_link1.add_node(pivot2)
    system.add_body(body_link1)

    body_link2 = RigidBody("link2")
    body_link2.transform = Matrix4x4().translate(10, 0, 0)
    effector = Node("effector")
    effector.local_transform = Matrix4x4().translate(10, 0, 0)
    body_link2.add_node(effector)
    system.add_body(body_link2)

    system.add_joint(Joint("j1", "revolute", (0, 0, 1)))
    system.add_joint(Joint("j2", "revolute", (0, 0, 1)))

    system.update_forward_kinematics()

    if angle_j1 != 0:
        system.apply_actuator_delta("j1", "pivot1", ["link1", "link2"], angle_j1)
    if angle_j2 != 0:
        system.apply_actuator_delta("j2", "pivot2", ["link2"], angle_j2)

    system.update_forward_kinematics()
    return system.nodes["effector"].absolute_transform.get_translation()


class TestForwardKinematics:
    def test_two_link_arm_both_90_degrees(self):
        x, y, z = _build_two_link_arm(math.pi / 2, math.pi / 2)
        assert abs(x - (-10)) < 1e-4
        assert abs(y - 10) < 1e-4
        assert abs(z) < 1e-10

    def test_two_link_arm_both_45_degrees(self):
        x, y, z = _build_two_link_arm(math.pi / 4, math.pi / 4)
        assert abs(x - 5 * math.sqrt(2)) < 1e-4
        assert abs(y - (5 * math.sqrt(2) + 10)) < 1e-4
        assert abs(z) < 1e-10
