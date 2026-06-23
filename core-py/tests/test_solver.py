import math
import pytest
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.math.vector3 import Vector3
from wigglesolve.elements.node import Node
from wigglesolve.elements.joint import Joint
from wigglesolve.elements.rigid_body import RigidBody
from wigglesolve.system.kinematic_system import KinematicSystem
from wigglesolve.solver.conditions import Condition
from wigglesolve.solver.operations import Operation
from wigglesolve.solver.executor import Executor, OperationInstruction, LoopInstruction


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


class TestConditions:
    def test_distance_less_than_true(self):
        from wigglesolve.solver.conditions import evaluate_condition

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
        from wigglesolve.solver.conditions import evaluate_condition

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
        from wigglesolve.solver.conditions import evaluate_condition

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
