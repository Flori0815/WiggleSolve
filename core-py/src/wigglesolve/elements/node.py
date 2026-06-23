from __future__ import annotations
from dataclasses import dataclass, field
from typing import Literal, Optional
from wigglesolve.math.matrix4x4 import Matrix4x4


@dataclass
class NodeAlignment:
    primary_axis: Optional[Literal["x", "y", "z"]] = None
    primary_target: Optional[str] = None
    secondary_axis: Optional[Literal["x", "y", "z"]] = None
    secondary_target: Optional[str] = None


class Node:
    def __init__(self, id: str) -> None:
        self.id = id
        self.local_transform = Matrix4x4()
        self.absolute_transform = Matrix4x4()
        self.is_locked = False
        self.alignment = NodeAlignment()
