from __future__ import annotations
from wigglesolve.math.matrix4x4 import Matrix4x4
from wigglesolve.elements.node import Node


class RigidBody:
    def __init__(self, id: str) -> None:
        self.id = id
        self.transform = Matrix4x4()
        self.nodes: dict[str, Node] = {}

    def add_node(self, node: Node) -> None:
        self.nodes[node.id] = node

    def update_nodes(self) -> None:
        for node in self.nodes.values():
            node.absolute_transform = self.transform.multiply(node.local_transform)
