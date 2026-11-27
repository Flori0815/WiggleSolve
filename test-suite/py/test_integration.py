import math
from pathlib import Path

import pytest

from loader import load_and_run

DEFINITIONS_DIR = Path(__file__).parent.parent.parent / 'definitions'
DEMOS_DIR = Path(__file__).parent.parent.parent / 'demos'
DEMO_FILES = sorted([f.name for f in DEMOS_DIR.glob('*.json')])


def _dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


class TestPlanar2LinkArm:
    def setup_method(self):
        self.result = load_and_run(DEFINITIONS_DIR / 'planar_2_link_arm.json')

    def test_solver_converges(self):
        assert self.result['converged'] is True

    def test_effector_reaches_target(self):
        effector = self.result['node_positions']['link2_end']
        target = self.result['node_positions']['target']
        assert _dist(effector, target) < 0.01

    def test_joint_values_within_limits(self):
        assert -math.pi <= self.result['joint_values']['j1'] <= math.pi
        assert -math.pi <= self.result['joint_values']['j2'] <= math.pi


class TestPrismaticSlider:
    def setup_method(self):
        self.result = load_and_run(DEFINITIONS_DIR / 'prismatic_slider.json')

    def test_solver_converges(self):
        assert self.result['converged'] is True

    def test_effector_reaches_target(self):
        effector = self.result['node_positions']['slider_effector']
        target = self.result['node_positions']['target']
        assert _dist(effector, target) < 0.01

    def test_joint_value_within_limits(self):
        assert 0 <= self.result['joint_values']['slider_joint'] <= 5

    def test_joint_value_converges_to_target_distance(self):
        # Target is at x=2, starting from x=0 — geometric series converges to 2.0
        assert abs(self.result['joint_values']['slider_joint'] - 2.0) < 0.05


class TestPanTiltCamera:
    def setup_method(self):
        self.result = load_and_run(DEFINITIONS_DIR / 'pan_tilt_camera.json')

    def test_solver_converges(self):
        assert self.result['converged'] is True

    def test_effector_reaches_target(self):
        effector = self.result['node_positions']['lens_tip']
        target = self.result['node_positions']['target']
        assert _dist(effector, target) < 0.01

    def test_joint_values_within_limits(self):
        assert -math.pi <= self.result['joint_values']['j_pan'] <= math.pi
        assert -math.pi / 2 <= self.result['joint_values']['j_tilt'] <= math.pi / 2


class TestXyzCncMachine:
    def setup_method(self):
        self.result = load_and_run(DEFINITIONS_DIR / 'xyz_cnc_machine.json')

    def test_solver_converges(self):
        assert self.result['converged'] is True

    def test_effector_reaches_target(self):
        effector = self.result['node_positions']['spindle_tip']
        target = self.result['node_positions']['target']
        assert _dist(effector, target) < 0.01

    def test_joint_values_within_limits(self):
        assert 0.0 <= self.result['joint_values']['x_joint'] <= 3.0
        assert 0.0 <= self.result['joint_values']['y_joint'] <= 3.0
        assert -2.0 <= self.result['joint_values']['z_joint'] <= 0.0

    def test_joint_values_converge_to_target_coordinates(self):
        assert abs(self.result['joint_values']['x_joint'] - 1.5) < 0.05
        assert abs(self.result['joint_values']['y_joint'] - 1.2) < 0.05
        assert abs(self.result['joint_values']['z_joint'] - (-0.8)) < 0.05


class TestParity:
    """Verify behavioural parity with core-js by asserting identical numerical bounds.

    Both test suites (JS and Python) assert these same values against the same
    definition files. Passing both suites confirms cross-implementation parity.
    """

    def test_planar_arm_target_position_matches_definition(self):
        result = load_and_run(DEFINITIONS_DIR / 'planar_2_link_arm.json')
        # Target is hardcoded at (1.5, 0.5, 0) in the definition
        target = result['node_positions']['target']
        assert abs(target[0] - 1.5) < 1e-4
        assert abs(target[1] - 0.5) < 1e-4
        assert abs(target[2] - 0.0) < 1e-4

    def test_planar_arm_effector_within_threshold_of_target(self):
        result = load_and_run(DEFINITIONS_DIR / 'planar_2_link_arm.json')
        effector = result['node_positions']['link2_end']
        assert _dist(effector, (1.5, 0.5, 0.0)) < 0.01

    def test_prismatic_slider_joint_converges_to_2(self):
        result = load_and_run(DEFINITIONS_DIR / 'prismatic_slider.json')
        # Both implementations converge to ~2.0 for this definition
        assert abs(result['joint_values']['slider_joint'] - 2.0) < 0.05

    def test_pan_tilt_effector_within_threshold_of_target(self):
        result = load_and_run(DEFINITIONS_DIR / 'pan_tilt_camera.json')
        effector = result['node_positions']['lens_tip']
        assert _dist(effector, (0.3, 0.3, 0.4243)) < 0.05

    def test_xyz_cnc_joint_values_match(self):
        result = load_and_run(DEFINITIONS_DIR / 'xyz_cnc_machine.json')
        assert abs(result['joint_values']['x_joint'] - 1.5) < 0.05
        assert abs(result['joint_values']['y_joint'] - 1.2) < 0.05
        assert abs(result['joint_values']['z_joint'] - (-0.8)) < 0.05


@pytest.mark.parametrize('filename', DEMO_FILES)
def test_demo_smoke(filename):
    """Smoke test: every demo JSON must load and run without throwing."""
    result = load_and_run(DEMOS_DIR / filename)
    # Demos may not converge (some are open-loop), but must not throw
    assert isinstance(result['converged'], bool)


class TestDroppedHingeFlap:
    """Cross-language check of the generated flap demo (see core-js tests/flaps.test.ts)."""

    def _run(self, drive_deg, rigging_deg=0.0):
        from wigglesolve.definition import build_sequence, build_system, drive_actuator, load_definition_file
        from wigglesolve.solver.executor import Executor

        definition = load_definition_file(DEMOS_DIR / 'dropped_hinge_flap.json')
        system = build_system(definition)
        actuators = {a['id']: a for a in definition['actuators']}
        drive_actuator(system, actuators['flap_drive'], math.radians(drive_deg))
        drive_actuator(system, actuators['gra_2_rigging'], math.radians(rigging_deg))
        converged = Executor(system).execute(build_sequence(definition))
        return converged, system

    def test_torque_shaft_drive_matches_four_bar(self):
        converged, system = self._run(30)
        assert converged
        assert math.degrees(system.joints['hinge_1_z'].value) == pytest.approx(-28.09, abs=0.05)
        assert math.degrees(system.joints['flap_split_rot'].value) == pytest.approx(0, abs=0.05)

    def test_rigging_offset_is_absorbed_at_the_split(self):
        converged, system = self._run(30, 2)
        assert converged
        assert math.degrees(system.joints['flap_split_rot'].value) == pytest.approx(-1.77, abs=0.05)
        lever_end = system.nodes['lever_2_end'].absolute_transform.get_translation()
        hinge = system.nodes['hinge_2'].absolute_transform.get_translation()
        assert _dist(lever_end, hinge) < 1e-4
