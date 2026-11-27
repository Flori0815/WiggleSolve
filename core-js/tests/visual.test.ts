import { RigidBody } from '../src/elements/RigidBody';
import { Matrix4x4 } from '../src/math/Matrix4x4';
import { buildSystem, parseDefinition, serializeDefinition, safeParseDefinition } from '../src/definition';
import { beamMesh, boxMesh, loftMesh, meshFromWorldTriangles, prismMesh } from '../src/visual/mesh';
import type { MeshVisual } from '../src/visual/mesh';

const points = (m: MeshVisual) => Array.from({ length: m.vertices.length / 3 }, (_, i) => m.vertices.slice(i * 3, i * 3 + 3));

describe('mesh helpers', () => {
  test('prismMesh extrudes a polygon with caps and sides', () => {
    const m = prismMesh([[0, 0], [1, 0], [0, 1]], 0, 2, { color: '#fff' });
    expect(m.vertices).toHaveLength(18);
    expect(m.indices).toHaveLength((2 * 1 + 2 * 3) * 3);
    expect(m.color).toBe('#fff');
    expect(Math.max(...m.indices)).toBe(5);
  });

  test('loftMesh skins two different sections and rejects mismatched ones', () => {
    const m = loftMesh([[0, 0, 0], [2, 0, 0], [0, 1, 0]], [[1, 0, 3], [2, 0, 3], [1, 0.5, 3]]);
    expect(points(m)).toContainEqual([2, 0, 3]);
    expect(m.indices).toHaveLength(24);
    expect(() => loftMesh([[0, 0, 0], [1, 0, 0]], [[0, 0, 1], [1, 0, 1]])).toThrow('same number');
    expect(() => loftMesh([[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 1]])).toThrow('same number');
  });

  test('boxMesh spans min to max', () => {
    const m = boxMesh([0, 0, 0], [1, 2, 3]);
    const p = points(m);
    expect(p).toContainEqual([1, 2, 3]);
    expect(p).toContainEqual([0, 0, 0]);
    expect(m.indices).toHaveLength(36);
  });

  test('beamMesh has the requested length and cross-section, for any direction', () => {
    for (const b of [[2, 0, 0], [0, 0, 2]] as const) {
      const m = beamMesh([0, 0, 0], [...b], 0.2, 0.1, { opacity: 0.5 });
      const p = points(m);
      const along = (q: number[]) => q[0] * b[0] / 2 + q[1] * b[1] / 2 + q[2] * b[2] / 2;
      expect(Math.min(...p.map(along))).toBeCloseTo(0);
      expect(Math.max(...p.map(along))).toBeCloseTo(2);
      const d = Math.hypot(p[0][0] - p[2][0], p[0][1] - p[2][1], p[0][2] - p[2][2]);
      expect(d).toBeCloseTo(Math.hypot(0.2, 0.1));
      expect(m.indices).toHaveLength(36);
      expect(m.opacity).toBe(0.5);
    }
  });

  test('meshFromWorldTriangles converts to the body frame and scales units', () => {
    const body = new RigidBody('b');
    body.transform = new Matrix4x4().translate(1, 0, 0);
    const m = meshFromWorldTriangles(body, [1000, 0, 0, 2000, 0, 0, 1000, 1000, 0, 5], { scale: 0.001, color: 'red' });
    expect(points(m)).toEqual([[0, 0, 0], [1, 0, 0], [0, 1, 0]]);
    expect(m.indices).toEqual([0, 1, 2]);
    expect(m.color).toBe('red');
    expect(meshFromWorldTriangles(body, []).indices).toEqual([]);
  });
});

describe('visuals in definitions', () => {
  const def = (visuals: unknown) => ({
    name: 'v', description: '',
    system: { bodies: [{ id: 'b', nodes: [], visuals }], joints: [] },
    actuators: [], sequence: [],
  });

  test('are validated', () => {
    expect(safeParseDefinition(def([{ type: 'mesh', vertices: [0, 0], indices: [] }])).success).toBe(false);
    expect(safeParseDefinition(def([{ type: 'mesh', vertices: [0, 0, 0], indices: [0, 0] }])).success).toBe(false);
    expect(safeParseDefinition(def([{ type: 'mesh', vertices: [0, 0, 0], indices: [0, 0, 1] }])).success).toBe(false);
  });

  test('round-trip through build and serialize', () => {
    const mesh = boxMesh([0, 0, 0], [1, 1, 1], { color: '#abc' });
    const system = buildSystem(parseDefinition(def([mesh])));
    expect(system.bodies.get('b')!.visuals).toEqual([mesh]);
    const out = serializeDefinition({ name: 'v', description: '' }, system, [], []);
    expect(out.system.bodies[0].visuals).toEqual([mesh]);
    system.bodies.get('b')!.visuals = [];
    expect(serializeDefinition({ name: 'v', description: '' }, system, [], []).system.bodies[0]).not.toHaveProperty('visuals');
  });
});
