"""Thin test helper: load a definition file, run its sequence, report the result."""
from wigglesolve.definition import build_sequence, build_system, load_definition_file
from wigglesolve.solver.executor import Executor


def load_and_run(definition_path):
    definition = load_definition_file(definition_path)
    system = build_system(definition)
    converged = Executor(system).execute(build_sequence(definition))
    return {
        'converged': converged,
        'joint_values': {jid: j.value for jid, j in system.joints.items()},
        'node_positions': {nid: n.absolute_transform.get_translation() for nid, n in system.nodes.items()},
    }
