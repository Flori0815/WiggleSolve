from __future__ import annotations
import math


class Vector3:
    def __init__(self, x: float = 0.0, y: float = 0.0, z: float = 0.0) -> None:
        self.x = x
        self.y = y
        self.z = z

    def dot(self, v: Vector3) -> float:
        return self.x * v.x + self.y * v.y + self.z * v.z

    def cross(self, v: Vector3) -> Vector3:
        return Vector3(
            self.y * v.z - self.z * v.y,
            self.z * v.x - self.x * v.z,
            self.x * v.y - self.y * v.x,
        )

    def length(self) -> float:
        return math.sqrt(self.x * self.x + self.y * self.y + self.z * self.z)

    def normalize(self) -> Vector3:
        length = self.length()
        if length == 0:
            return Vector3(0.0, 0.0, 0.0)
        return Vector3(self.x / length, self.y / length, self.z / length)

    def sub(self, v: Vector3) -> Vector3:
        return Vector3(self.x - v.x, self.y - v.y, self.z - v.z)

    def add(self, v: Vector3) -> Vector3:
        return Vector3(self.x + v.x, self.y + v.y, self.z + v.z)

    def scale(self, s: float) -> Vector3:
        return Vector3(self.x * s, self.y * s, self.z * s)

    def distance_to(self, v: Vector3) -> float:
        dx = self.x - v.x
        dy = self.y - v.y
        dz = self.z - v.z
        return math.sqrt(dx * dx + dy * dy + dz * dz)

    def clone(self) -> Vector3:
        return Vector3(self.x, self.y, self.z)

    def __repr__(self) -> str:
        return f"Vector3({self.x}, {self.y}, {self.z})"

    @staticmethod
    def static_sub(a: Vector3, b: Vector3) -> Vector3:
        return Vector3(a.x - b.x, a.y - b.y, a.z - b.z)
