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

    this.elements = te;
    return this;
  }

  translate(x: number, y: number, z: number): Matrix4x4 {
    const te = this.elements;
    te[12] += te[0] * x + te[4] * y + te[8] * z;
    te[13] += te[1] * x + te[5] * y + te[9] * z;
    te[14] += te[2] * x + te[6] * y + te[10] * z;
    te[15] += te[3] * x + te[7] * y + te[11] * z;
    return this;
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

  static fromTranslation(x: number, y: number, z: number): Matrix4x4 {
    const m = new Matrix4x4();
    const te = m.elements;
    te[12] = x;
    te[13] = y;
    te[14] = z;
    return m;
  }
}
