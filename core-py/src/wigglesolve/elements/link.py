from __future__ import annotations
from typing import Optional
from wigglesolve.math.matrix4x4 import Matrix4x4


class Link:
    def __init__(self, id: str, transform: Optional[Matrix4x4] = None) -> None:
        self.id = id
        self.transform = transform if transform is not None else Matrix4x4()
