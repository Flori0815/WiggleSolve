from __future__ import annotations
import math
from typing import Tuple


class Matrix4x4:
    # Elements stored in column-major order to match standard OpenGL/graphics conventions
    # [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33]

    def __init__(self) -> None:
        self.elements: list[float] = [0.0] * 16
        self.identity()

    def identity(self) -> Matrix4x4:
        te = self.elements
        te[0] = 1.0; te[4] = 0.0; te[8]  = 0.0; te[12] = 0.0
        te[1] = 0.0; te[5] = 1.0; te[9]  = 0.0; te[13] = 0.0
        te[2] = 0.0; te[6] = 0.0; te[10] = 1.0; te[14] = 0.0
        te[3] = 0.0; te[7] = 0.0; te[11] = 0.0; te[15] = 1.0
        return self

    def multiply(self, m: Matrix4x4) -> Matrix4x4:
        ae = self.elements
        be = m.elements
        te = [0.0] * 16

        a11 = ae[0];  a12 = ae[4];  a13 = ae[8];  a14 = ae[12]
        a21 = ae[1];  a22 = ae[5];  a23 = ae[9];  a24 = ae[13]
        a31 = ae[2];  a32 = ae[6];  a33 = ae[10]; a34 = ae[14]
        a41 = ae[3];  a42 = ae[7];  a43 = ae[11]; a44 = ae[15]

        b11 = be[0];  b12 = be[4];  b13 = be[8];  b14 = be[12]
        b21 = be[1];  b22 = be[5];  b23 = be[9];  b24 = be[13]
        b31 = be[2];  b32 = be[6];  b33 = be[10]; b34 = be[14]
        b41 = be[3];  b42 = be[7];  b43 = be[11]; b44 = be[15]

        te[0]  = a11*b11 + a12*b21 + a13*b31 + a14*b41
        te[4]  = a11*b12 + a12*b22 + a13*b32 + a14*b42
        te[8]  = a11*b13 + a12*b23 + a13*b33 + a14*b43
        te[12] = a11*b14 + a12*b24 + a13*b34 + a14*b44

        te[1]  = a21*b11 + a22*b21 + a23*b31 + a24*b41
        te[5]  = a21*b12 + a22*b22 + a23*b32 + a24*b42
        te[9]  = a21*b13 + a22*b23 + a23*b33 + a24*b43
        te[13] = a21*b14 + a22*b24 + a23*b34 + a24*b44

        te[2]  = a31*b11 + a32*b21 + a33*b31 + a34*b41
        te[6]  = a31*b12 + a32*b22 + a33*b32 + a34*b42
        te[10] = a31*b13 + a32*b23 + a33*b33 + a34*b43
        te[14] = a31*b14 + a32*b24 + a33*b34 + a34*b44

        te[3]  = a41*b11 + a42*b21 + a43*b31 + a44*b41
        te[7]  = a41*b12 + a42*b22 + a43*b32 + a44*b42
        te[11] = a41*b13 + a42*b23 + a43*b33 + a44*b43
        te[15] = a41*b14 + a42*b24 + a43*b34 + a44*b44

        result = Matrix4x4()
        result.elements = te
        return result

    def translate(self, x: float, y: float, z: float) -> Matrix4x4:
        result = self.clone()
        te = result.elements
        te[12] += te[0]*x + te[4]*y + te[8]*z
        te[13] += te[1]*x + te[5]*y + te[9]*z
        te[14] += te[2]*x + te[6]*y + te[10]*z
        te[15] += te[3]*x + te[7]*y + te[11]*z
        return result

    def rotate_x(self, theta: float) -> Matrix4x4:
        c = math.cos(theta)
        s = math.sin(theta)
        m = Matrix4x4()
        te = m.elements
        te[5] = c;  te[9]  = -s
        te[6] = s;  te[10] = c
        return self.multiply(m)

    def rotate_y(self, theta: float) -> Matrix4x4:
        c = math.cos(theta)
        s = math.sin(theta)
        m = Matrix4x4()
        te = m.elements
        te[0] = c;  te[8]  = s
        te[2] = -s; te[10] = c
        return self.multiply(m)

    def rotate_z(self, theta: float) -> Matrix4x4:
        c = math.cos(theta)
        s = math.sin(theta)
        m = Matrix4x4()
        te = m.elements
        te[0] = c;  te[4] = -s
        te[1] = s;  te[5] = c
        return self.multiply(m)

    def get_translation(self) -> Tuple[float, float, float]:
        te = self.elements
        return (te[12], te[13], te[14])

    def transform_vector(self, v) -> object:
        from wigglesolve.math.vector3 import Vector3
        te = self.elements
        x, y, z = v.x, v.y, v.z
        w = te[3]*x + te[7]*y + te[11]*z + te[15]
        inv_w = 1.0 / (w if w != 0 else 1.0)
        return Vector3(
            (te[0]*x + te[4]*y + te[8]*z  + te[12]) * inv_w,
            (te[1]*x + te[5]*y + te[9]*z  + te[13]) * inv_w,
            (te[2]*x + te[6]*y + te[10]*z + te[14]) * inv_w,
        )

    def rotate_vector(self, v) -> object:
        from wigglesolve.math.vector3 import Vector3
        te = self.elements
        x, y, z = v.x, v.y, v.z
        return Vector3(
            te[0]*x + te[4]*y + te[8]*z,
            te[1]*x + te[5]*y + te[9]*z,
            te[2]*x + te[6]*y + te[10]*z,
        )

    def clone(self) -> Matrix4x4:
        m = Matrix4x4()
        m.elements = list(self.elements)
        return m

    def copy(self, m: Matrix4x4) -> Matrix4x4:
        self.elements = list(m.elements)
        return self

    def invert(self) -> Matrix4x4:
        te = self.elements
        n11 = te[0];  n21 = te[1];  n31 = te[2];  n41 = te[3]
        n12 = te[4];  n22 = te[5];  n32 = te[6];  n42 = te[7]
        n13 = te[8];  n23 = te[9];  n33 = te[10]; n43 = te[11]
        n14 = te[12]; n24 = te[13]; n34 = te[14]; n45 = te[15]

        t11 = n23*n34*n42 - n24*n33*n42 + n24*n32*n43 - n22*n34*n43 + n22*n33*n45 - n23*n32*n45
        t12 = n14*n33*n42 - n13*n34*n42 - n14*n32*n43 + n12*n34*n43 - n12*n33*n45 + n13*n32*n45
        t13 = n13*n24*n42 - n14*n23*n42 + n14*n22*n43 - n12*n24*n43 + n12*n23*n45 - n13*n22*n45
        t14 = n14*n23*n32 - n13*n24*n32 - n14*n22*n33 + n12*n24*n33 - n12*n23*n34 + n13*n22*n34

        det = n11*t11 + n21*t12 + n31*t13 + n41*t14

        if det == 0:
            return Matrix4x4()

        inv_det = 1.0 / det
        res = [0.0] * 16

        res[0]  = t11 * inv_det
        res[1]  = (n24*n33*n41 - n23*n34*n41 - n24*n31*n43 + n21*n34*n43 + n23*n31*n45 - n21*n33*n45) * inv_det
        res[2]  = (n22*n34*n41 - n24*n32*n41 + n24*n31*n42 - n21*n34*n42 - n22*n31*n45 + n21*n32*n45) * inv_det
        res[3]  = (n23*n32*n41 - n22*n33*n41 - n23*n31*n42 + n21*n33*n42 + n22*n31*n43 - n21*n32*n43) * inv_det

        res[4]  = t12 * inv_det
        res[5]  = (n13*n34*n41 - n14*n33*n41 + n14*n31*n43 - n11*n34*n43 - n13*n31*n45 + n11*n33*n45) * inv_det
        res[6]  = (n14*n32*n41 - n12*n34*n41 - n14*n31*n42 + n11*n34*n42 + n12*n31*n45 - n11*n32*n45) * inv_det
        res[7]  = (n12*n33*n41 - n13*n32*n41 + n13*n31*n42 - n11*n33*n42 - n12*n31*n43 + n11*n32*n43) * inv_det

        res[8]  = t13 * inv_det
        res[9]  = (n14*n23*n41 - n13*n24*n41 - n14*n21*n43 + n11*n24*n43 + n13*n21*n45 - n11*n23*n45) * inv_det
        res[10] = (n12*n24*n41 - n14*n22*n41 + n14*n21*n42 - n11*n24*n42 - n12*n21*n45 + n11*n22*n45) * inv_det
        res[11] = (n13*n22*n41 - n12*n23*n41 - n13*n21*n42 + n11*n23*n42 + n12*n21*n43 - n11*n22*n43) * inv_det

        res[12] = t14 * inv_det
        res[13] = (n13*n24*n31 - n14*n23*n31 + n14*n21*n33 - n11*n24*n33 - n13*n21*n34 + n11*n23*n34) * inv_det
        res[14] = (n14*n22*n31 - n12*n24*n31 - n14*n21*n32 + n11*n24*n32 + n12*n21*n34 - n11*n22*n34) * inv_det
        res[15] = (n12*n23*n31 - n13*n22*n31 + n13*n21*n32 - n11*n23*n32 - n12*n21*n33 + n11*n22*n33) * inv_det

        result = Matrix4x4()
        result.elements = res
        return result

    @staticmethod
    def from_translation(x: float, y: float, z: float) -> Matrix4x4:
        m = Matrix4x4()
        te = m.elements
        te[12] = x
        te[13] = y
        te[14] = z
        return m
