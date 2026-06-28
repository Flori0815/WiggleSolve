import { Vector3 } from './Vector3';

export class Matrix4x4 {
  // Elements are stored in column-major order to match standard OpenGL/graphics conventions
  // [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33]
  public elements: Float32Array;

  constructor() {
    this.elements = new Float32Array(16);
    this.identity();
  }

  identity(): Matrix4x4 {
    const te = this.elements;
    te[0] = 1; te[4] = 0; te[8] = 0; te[12] = 0;
    te[1] = 0; te[5] = 1; te[9] = 0; te[13] = 0;
    te[2] = 0; te[6] = 0; te[10] = 1; te[14] = 0;
    te[3] = 0; te[7] = 0; te[11] = 0; te[15] = 1;
    return this;
  }

  multiply(m: Matrix4x4): Matrix4x4 {
    const ae = this.elements;
    const be = m.elements;
    const te = new Float32Array(16);

    const a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12];
    const a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13];
    const a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14];
    const a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15];

    const b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12];
    const b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13];
    const b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14];
    const b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];

    te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41;
    te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42;
    te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43;
    te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44;

    te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41;
    te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42;
    te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43;
    te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44;

    te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41;
    te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42;
    te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43;
    te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44;

    te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41;
    te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42;
    te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43;
    te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44;

    const result = new Matrix4x4();
    result.elements = te;
    return result;
  }

  translate(x: number, y: number, z: number): Matrix4x4 {
    const result = this.clone();
    const te = result.elements;
    te[12] += te[0] * x + te[4] * y + te[8] * z;
    te[13] += te[1] * x + te[5] * y + te[9] * z;
    te[14] += te[2] * x + te[6] * y + te[10] * z;
    te[15] += te[3] * x + te[7] * y + te[11] * z;
    return result;
  }

  rotateX(theta: number): Matrix4x4 {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const m = new Matrix4x4();
    const te = m.elements;

    te[5] = c; te[9] = -s;
    te[6] = s; te[10] = c;

    return this.multiply(m);
  }

  rotateY(theta: number): Matrix4x4 {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const m = new Matrix4x4();
    const te = m.elements;

    te[0] = c; te[8] = s;
    te[2] = -s; te[10] = c;

    return this.multiply(m);
  }

  rotateZ(theta: number): Matrix4x4 {
    const c = Math.cos(theta);
    const s = Math.sin(theta);
    const m = new Matrix4x4();
    const te = m.elements;

    te[0] = c; te[4] = -s;
    te[1] = s; te[5] = c;

    return this.multiply(m);
  }

  getTranslation(): [number, number, number] {
    const te = this.elements;
    return [te[12], te[13], te[14]];
  }

  transformVector(v: Vector3): Vector3 {
    const te = this.elements;
    const x = v.x, y = v.y, z = v.z;
    const w = te[3] * x + te[7] * y + te[11] * z + te[15];
    const invW = 1 / (w || 1);

    return new Vector3(
      (te[0] * x + te[4] * y + te[8] * z + te[12]) * invW,
      (te[1] * x + te[5] * y + te[9] * z + te[13]) * invW,
      (te[2] * x + te[6] * y + te[10] * z + te[14]) * invW
    );
  }

  rotateVector(v: Vector3): Vector3 {
    const te = this.elements;
    const x = v.x, y = v.y, z = v.z;

    return new Vector3(
      te[0] * x + te[4] * y + te[8] * z,
      te[1] * x + te[5] * y + te[9] * z,
      te[2] * x + te[6] * y + te[10] * z
    );
  }

  clone(): Matrix4x4 {
    const m = new Matrix4x4();
    m.elements.set(this.elements);
    return m;
  }

  copy(m: Matrix4x4): Matrix4x4 {
    this.elements.set(m.elements);
    return this;
  }

  invert(): Matrix4x4 {
    const te = this.elements;
    const n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3];
    const n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7];
    const n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11];
    const n14 = te[12], n24 = te[13], n34 = te[14], n45 = te[15];

    const t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 + n22 * n33 * n45 - n23 * n32 * n45;
    const t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 - n12 * n33 * n45 + n13 * n32 * n45;
    const t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 + n12 * n23 * n45 - n13 * n22 * n45;
    const t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 - n12 * n23 * n34 + n13 * n22 * n34;

    const det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;

    if (det === 0) return new Matrix4x4();

    const invDet = 1 / det;

    const res = new Float32Array(16);
    res[0] = t11 * invDet;
    res[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n45 - n21 * n33 * n45) * invDet;
    res[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n45 + n21 * n32 * n45) * invDet;
    res[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * invDet;

    res[4] = t12 * invDet;
    res[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n45 + n11 * n33 * n45) * invDet;
    res[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n45 - n11 * n32 * n45) * invDet;
    res[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * invDet;

    res[8] = t13 * invDet;
    res[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n45 - n11 * n23 * n45) * invDet;
    res[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n45 + n11 * n22 * n45) * invDet;
    res[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * invDet;

    res[12] = t14 * invDet;
    res[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * invDet;
    res[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * invDet;
    res[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * invDet;

    const result = new Matrix4x4();
    result.elements = res;
    return result;
  }

  static fromTranslation(x: number, y: number, z: number): Matrix4x4 {
    const m = new Matrix4x4();
    const te = m.elements;
    te[12] = x;
    te[13] = y;
    te[14] = z;
    return m;
  }
}
