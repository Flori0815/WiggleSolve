from __future__ import annotations
from dataclasses import dataclass
from typing import Literal
from wigglesolve.math.vector3 import Vector3


@dataclass
class Condition:
    type: Literal["distance_less_than"]
    node_a: str
    node_b: str
    threshold: float


def evaluate_condition(system, condition: Condition) -> bool:
    if condition.type == "distance_less_than":
        node_a = system.nodes.get(condition.node_a)
        node_b = system.nodes.get(condition.node_b)

        if node_a is None or node_b is None:
            raise ValueError(
                f"Condition Error: Node {condition.node_a} or {condition.node_b} not found."
            )

        pos_a = Vector3(*node_a.absolute_transform.get_translation())
        pos_b = Vector3(*node_b.absolute_transform.get_translation())
        return pos_a.distance_to(pos_b) < condition.threshold

    raise ValueError(f"Unsupported condition type: {condition.type}")
