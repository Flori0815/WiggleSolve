from __future__ import annotations
import math
from typing import Literal, Tuple
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

    def get_transform_matrix(self) -> Matrix4x4:
        m = Matrix4x4()
        ax, ay, az = self.axis

        if self.type == "revolute":
            if ax == 1:
                return m.rotate_x(self.value)
            if ay == 1:
                return m.rotate_y(self.value)
            if az == 1:
                return m.rotate_z(self.value)
            return m.rotate_z(self.value)
        elif self.type == "prismatic":
            return m.translate(ax * self.value, ay * self.value, az * self.value)
        return m
