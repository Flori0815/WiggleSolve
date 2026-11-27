from __future__ import annotations
from dataclasses import dataclass, field
from typing import List, Literal, Tuple
from wigglesolve.math.vector3 import Vector3


@dataclass
class Condition:
    """Loop exit condition.

    ``distance_less_than``: ``node_a``/``node_b`` closer than ``threshold``.
    ``all_distances_less_than``: every pair in ``pairs`` closer than ``threshold``.
    """
    type: Literal["distance_less_than", "all_distances_less_than"]
    node_a: str = ""
    node_b: str = ""
    threshold: float = 0.0
    pairs: List[Tuple[str, str]] = field(default_factory=list)


def condition_pairs(condition: Condition) -> List[Tuple[str, str]]:
    if condition.type == "distance_less_than":
        return [(condition.node_a, condition.node_b)]
    return list(condition.pairs)


def _distance(system, a: str, b: str) -> float:
    node_a = system.nodes.get(a)
    node_b = system.nodes.get(b)
    if node_a is None or node_b is None:
        raise ValueError(f"Condition Error: Node {a} or {b} not found.")
    pos_a = Vector3(*node_a.absolute_transform.get_translation())
    pos_b = Vector3(*node_b.absolute_transform.get_translation())
    return pos_a.distance_to(pos_b)


def evaluate_condition(system, condition: Condition) -> bool:
    if condition.type not in ("distance_less_than", "all_distances_less_than"):
        raise ValueError(f"Unsupported condition type: {condition.type}")
    return all(_distance(system, a, b) < condition.threshold for a, b in condition_pairs(condition))
