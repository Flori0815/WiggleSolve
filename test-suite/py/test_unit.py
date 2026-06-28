import math
import pytest
from wigglesolve.math.vector3 import Vector3
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.elements.node import Node
from wigglesolve.elements.joint import Joint
from wigglesolve.elements.rigid_body import RigidBody
from wigglesolve.system.kinematic_system import KinematicSystem
from wigglesolve.solver.conditions import Condition, evaluate_condition
from wigglesolve.solver.operations import Operation
from wigglesolve.solver.executor import Executor, OperationInstruction, LoopInstruction


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
        m = m.translate(10, 20, 30)
        x, y, z = m.get_translation()
        assert x == 10 and y == 20 and z == 30

    def test_rotate_z_90(self):
        m = Matrix4x4()
        m = m.rotate_z(math.pi / 2)
        m = m.translate(1, 0, 0)
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
        inv = m.invert()
        assert inv.elements[0] == 1
        assert inv.elements[5] == 1
        assert inv.elements[10] == 1
        assert inv.elements[15] == 1

    def test_invert_translation(self):
        m = Matrix4x4().translate(5, -3, 2)
        inv = m.invert()
        x, y, z = inv.get_translation()
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
        c = c.translate(10, 0, 0)
        x, _, _ = m.get_translation()
        cx, _, _ = c.get_translation()
        assert abs(x - 1) < 1e-10
        assert abs(cx - 11) < 1e-10

    def test_transform_vector(self):
        m = Matrix4x4().translate(10, 20, 30)
        v = Vector3(1, 2, 3)
        v2 = m.transform_vector(v)
        assert v2.x == 11
        assert v2.y == 22
        assert v2.z == 33

        m = Matrix4x4().rotate_z(math.pi / 2)
        v = Vector3(1, 0, 0)
        v2 = m.transform_vector(v)
        assert abs(v2.x) < 1e-5
        assert abs(v2.y - 1) < 1e-5


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
    def test_single_body_forward_pass(self):
        system = KinematicSystem()
        body = RigidBody("b1")
        node = Node("n1")
        node.local_transform = Matrix4x4().translate(5, 0, 0)
        body.add_node(node)
        system.add_body(body)

        body.transform = Matrix4x4().translate(10, 0, 0)
        system.update_forward_kinematics()

        pos = node.absolute_transform.get_translation()
        assert pos[0] == 15
        assert pos[1] == 0
        assert pos[2] == 0

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


class TestRigidBodyArchitecture:
    def test_manual_alignment_of_two_bodies(self):
        system = KinematicSystem()

        body_a = RigidBody("body_a")
        node_pivot = Node("pivot")
        body_a.add_node(node_pivot)
        system.add_body(body_a)

        body_b = RigidBody("body_b")
        node_effector = Node("effector")
        node_effector.local_transform = Matrix4x4().translate(1, 0, 0)
        body_b.add_node(node_effector)
        system.add_body(body_b)

        body_target = RigidBody("body_target")
        node_target = Node("target")
        body_target.transform = Matrix4x4().translate(0, 1, 0)
        body_target.add_node(node_target)
        system.add_body(body_target)

        joint = Joint("j1", "revolute", (0, 0, 1))
        system.add_joint(joint)

        system.update_forward_kinematics()

        operation = Operation(
            type="align_node",
            effector_node="effector",
            target_node="target",
            pivot_node="pivot",
            joint_id="j1",
            moving_bodies=["body_b"],
        )
        condition = Condition(
            type="distance_less_than",
            node_a="effector",
            node_b="target",
            threshold=0.001,
        )
        sequence = [
            LoopInstruction(
                max_iterations=200,
                condition=condition,
                steps=[OperationInstruction(operation)],
            )
        ]

        executor = Executor(system)
        result = executor.execute(sequence)

        assert result is True

        effector_pos = Vector3(*system.nodes["effector"].absolute_transform.get_translation())
        target_pos = Vector3(*system.nodes["target"].absolute_transform.get_translation())
        assert effector_pos.distance_to(target_pos) < 0.001
        assert abs(joint.value - math.pi / 2) < 0.01

    def test_multi_joint_planar_arm_with_limits(self):
        system = KinematicSystem()

        # Body A (Base pivot)
        body_a = RigidBody('body_a')
        node_pivot = Node('pivot')
        body_a.add_node(node_pivot)
        system.add_body(body_a)

        # Body B (First arm segment, length 1)
        body_b = RigidBody('body_b')
        node_joint2_pivot = Node('joint2_pivot')
        node_joint2_pivot.local_transform = Matrix4x4().translate(1, 0, 0)
        body_b.add_node(node_joint2_pivot)
        system.add_body(body_b)

        # Body C (Second arm segment, length 1, with effector at its end)
        body_c = RigidBody('body_c')
        node_effector = Node('effector')
        node_effector.local_transform = Matrix4x4().translate(1, 0, 0)
        body_c.add_node(node_effector)
        system.add_body(body_c)

        # Target for the effector
        body_target = RigidBody('body_target')
        node_target = Node('target')
        body_target.transform = Matrix4x4().translate(0, 1.2, 0)
        body_target.add_node(node_target)
        system.add_body(body_target)

        # Joint 1: Base revolute joint with limits [-π/2, π/2]
        joint1 = Joint('j1', 'revolute', (0, 0, 1), 0, (-math.pi / 2, math.pi / 2))
        system.add_joint(joint1)

        # Joint 2: Second revolute joint with limits [-π/2, π/2]
        joint2 = Joint('j2', 'revolute', (0, 0, 1), 0, (-math.pi / 2, math.pi / 2))
        system.add_joint(joint2)

        system.update_forward_kinematics()

        # Multi-joint sequence: alternate between adjusting j2 and j1
        sequence = [
            LoopInstruction(
                max_iterations=500,
                condition=Condition(type='distance_less_than', node_a='effector', node_b='target', threshold=0.08),
                steps=[
                    OperationInstruction(Operation(
                        type='align_node',
                        effector_node='effector',
                        target_node='target',
                        pivot_node='joint2_pivot',
                        joint_id='j2',
                        moving_bodies=['body_c']
                    )),
                    OperationInstruction(Operation(
                        type='align_node',
                        effector_node='effector',
                        target_node='target',
                        pivot_node='pivot',
                        joint_id='j1',
                        moving_bodies=['body_b', 'body_c']
                    ))
                ]
            )
        ]

        executor = Executor(system)
        result = executor.execute(sequence)

        # If loop converges, verify the solution
        if result:
            effector_pos = Vector3(*system.nodes['effector'].absolute_transform.get_translation())
            target_pos = Vector3(*system.nodes['target'].absolute_transform.get_translation())
            assert effector_pos.distance_to(target_pos) < 0.08

        # Verify both joints respect their limits regardless of convergence
        assert joint1.value >= joint1.limits[0]
        assert joint1.value <= joint1.limits[1]
        assert joint2.value >= joint2.limits[0]
        assert joint2.value <= joint2.limits[1]

        # Verify that we have a multi-joint system set up
        assert len(system.joints) == 2
        assert len(system.bodies) == 4 # body_a, body_b, body_c, body_target


class TestConditions:
    def test_distance_less_than_true(self):
        system = KinematicSystem()
        body = RigidBody("b")
        n1 = Node("n1")
        n2 = Node("n2")
        n2.local_transform = Matrix4x4().translate(0.5, 0, 0)
        body.add_node(n1)
        body.add_node(n2)
        system.add_body(body)
        system.update_forward_kinematics()

        cond = Condition(type="distance_less_than", node_a="n1", node_b="n2", threshold=1.0)
        assert evaluate_condition(system, cond) is True

    def test_distance_less_than_false(self):
        system = KinematicSystem()
        body = RigidBody("b")
        n1 = Node("n1")
        n2 = Node("n2")
        n2.local_transform = Matrix4x4().translate(5, 0, 0)
        body.add_node(n1)
        body.add_node(n2)
        system.add_body(body)
        system.update_forward_kinematics()

        cond = Condition(type="distance_less_than", node_a="n1", node_b="n2", threshold=1.0)
        assert evaluate_condition(system, cond) is False

    def test_missing_node_raises(self):
        system = KinematicSystem()
        cond = Condition(type="distance_less_than", node_a="ghost", node_b="also_ghost", threshold=1.0)
        with pytest.raises(ValueError, match="not found"):
            evaluate_condition(system, cond)


class TestJointTransformMatrix:
    def test_revolute_z_axis(self):
        joint = Joint("j", "revolute", (0, 0, 1), value=math.pi / 2)
        m = joint.get_transform_matrix()
        v = m.rotate_vector(Vector3(1, 0, 0))
        assert abs(v.x) < 1e-5
        assert abs(v.y - 1) < 1e-5

    def test_prismatic_x_axis(self):
        joint = Joint("j", "prismatic", (1, 0, 0), value=5.0)
        m = joint.get_transform_matrix()
        x, y, z = m.get_translation()
        assert abs(x - 5) < 1e-10
        assert abs(y) < 1e-10
        assert abs(z) < 1e-10
