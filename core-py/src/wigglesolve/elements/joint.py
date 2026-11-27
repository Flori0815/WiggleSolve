from __future__ import annotations
import math
from typing import Literal, Optional, Tuple
from wigglesolve.math.matrix4x4 import Matrix4x4

JointType = Literal["revolute", "prismatic", "fixed"]


class Joint:
    def __init__(
        self,
        id: str,
        type: JointType = "revolute",
        axis: Tuple[float, float, float] = (0.0, 0.0, 1.0),
        value: float = 0.0,
        limits: Tuple[float, float] = (-math.inf, math.inf),
    ) -> None:
        self.id = id
        self.type = type
        self.axis = axis
        self.value = value
        self.limits = limits

    def clamp(self, value: float) -> float:
        """Clamps a candidate joint value into the joint's limits."""
        return max(self.limits[0], min(self.limits[1], value))

    def get_transform_matrix(self, amount: Optional[float] = None) -> Matrix4x4:
        """Local transform for moving this joint by ``amount`` (default: current value)."""
        amount = self.value if amount is None else amount
        m = Matrix4x4()
        ax, ay, az = self.axis
        if self.type == "revolute":
            return m.rotate_axis(self.axis, amount)
        if self.type == "prismatic":
            return m.translate(ax * amount, ay * amount, az * amount)
        return m
