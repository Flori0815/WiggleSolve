import * as fs from 'fs';
import * as path from 'path';
import { parseDefinition } from '../src/definition/build';
import { Mechanism } from '../src/simulation/Mechanism';
import { Vector3 } from '../src/math/Vector3';
import {
  DROPPED_HINGE_FLAP_DEFAULTS as P,
  droppedHingeFlap,
  FLAP_SPLIT_JOINT,
  FLAP_SPLIT_NODE,
  formatDefinition,
  GENERATED_DEMOS,
} from '../src/mechanisms';

const DEG = Math.PI / 180;
type V = [number, number, number];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Analytic four-bar: flap rotation for a crank rotation, solved by bisection near the reference branch. */
function analyticFlapAngle(crank: number): number {
  const [ax, ay] = P.actuatorAxis;
  const tip = [ax + P.crankLength * Math.sin(crank), ay - P.crankLength * Math.cos(crank)];
  const tip0 = [ax, ay - P.crankLength];
  const strut = Math.hypot(P.lug[0] - tip0[0], P.lug[1] - tip0[1]);
  const [hx, hy] = P.hinge;
  const lever = Math.hypot(P.lug[0] - hx, P.lug[1] - hy);
  const a0 = Math.atan2(P.lug[1] - hy, P.lug[0] - hx);
  const f = (phi: number) =>
    Math.hypot(hx + lever * Math.cos(a0 + phi) - tip[0], hy + lever * Math.sin(a0 + phi) - tip[1]) - strut;
  let lo = -60 * DEG;
  let hi = 0.5 * DEG;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(f(mid)) === Math.sign(f(lo))) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

const build = (overrides = {}) => {
  const m = new Mechanism();
  m.load(droppedHingeFlap(overrides));
  m.startSimulation();
  return m;
};
const pos = (m: Mechanism, id: string) => m.system.nodes.get(id)!.absoluteTransform.getTranslation();
const jointValue = (m: Mechanism, id: string) => m.system.joints.get(id)!.value;

/** World point → hinge frame (x' normal to the hinge line, y up, z' along it). */
const toHinge = ([x, y, z]: V): V => {
  const c = Math.cos(P.hingeSweep);
  const s = Math.sin(P.hingeSweep);
  return [c * x - s * z, y, s * x + c * z];
};
const taperAt = (z: number) => 1 + (P.taper - 1) * (z - P.span[0]) / (P.span[1] - P.span[0]);

/** Flap deflection measured geometrically: rotation of the lug about the hinge line at support 1. */
function deflection(m: Mechanism): number {
  const hinge = toHinge(pos(m, 'hinge_1'));
  const lug = toHinge(pos(m, 'flap_1_lug'));
  const ref = [P.lug[0] - P.hinge[0], P.lug[1] - P.hinge[1]];
  const now = [lug[0] - hinge[0], lug[1] - hinge[1]];
  return Math.atan2(now[1], now[0]) - Math.atan2(ref[1], ref[0]);
}

describe('droppedHingeFlap', () => {
  test('uses only the kinematically required bodies; representation is meshes', () => {
    const def = parseDefinition(droppedHingeFlap());
    expect(def.system.bodies.map(b => b.id)).toEqual(['wing', 'crank_1', 'strut_1', 'flap_1', 'crank_2', 'strut_2', 'flap_2', 'lever_2']);
    expect(def.system.bodies.every(b => (b.visuals ?? []).length > 0)).toBe(true);
    expect(def.actuators.map(a => a.id)).toEqual(['gra_1', 'gra_2']);
    expect(def.actuators[1]).toMatchObject({ pivotNode: 'gra_2_axis', movingBodies: ['crank_2', 'strut_2'] });
    const step = def.sequence[0].steps[0].operation;
    expect(step.type).toBe('close_loops');
    expect(def.sequence[0].condition).toMatchObject({ type: 'all_distances_less_than', pairs: [
      ['strut_1_end', 'flap_1_lug'], ['strut_2_end', 'flap_2_lug'], ['lever_2_end', 'hinge_2'],
    ] });
  });

  test('hinge line is swept and the flap is tapered about it', () => {
    const def = parseDefinition(droppedHingeFlap());
    const m = build();
    const [h1, h2] = [pos(m, 'hinge_1'), pos(m, 'hinge_2')];
    expect(Math.atan2(h2[0] - h1[0], h2[2] - h1[2])).toBeCloseTo(P.hingeSweep, 6);
    // Lug offset from the hinge scales with the local chord.
    const offset = (i: number) => dist(pos(m, `hinge_${i}`), pos(m, `flap_${i}_lug`));
    expect(offset(2) / offset(1)).toBeCloseTo(taperAt(P.supports[1].station) / taperAt(P.supports[0].station), 6);
    // The trailing edge is swept as well; with taper about the hinge it is swept less than the hinge line.
    const panel = def.system.bodies.find(b => b.id === 'flap_1')!.visuals![0].vertices;
    const n = P.profile.length;
    const vertex = (i: number) => panel.slice(i * 3, i * 3 + 3);
    const [teRoot, teOut] = [vertex(3), vertex(n + 3)];
    const teSweep = Math.atan2(teOut[0] - teRoot[0], teOut[2] - teRoot[2]);
    expect(teSweep).toBeGreaterThan(15 * DEG);
    expect(teSweep).toBeLessThan(P.hingeSweep);
  });

  test('split axis lies inside the flap section at one third of the chord, parallel to the hinge line', () => {
    const m = build();
    const split = toHinge(pos(m, FLAP_SPLIT_NODE));
    const k = taperAt(P.splitStation);
    const le = P.hinge[0] + k * (P.profile[0][0] - P.hinge[0]);
    const te = P.hinge[0] + k * (P.profile[3][0] - P.hinge[0]);
    expect(split[2]).toBeCloseTo(P.splitStation, 6);
    expect((split[0] - le) / (te - le)).toBeCloseTo(1 / 3, 6);
    expect(split[1]).toBeGreaterThan(P.hinge[1] + k * (-0.1 - P.hinge[1]));
    expect(split[1]).toBeLessThan(P.hinge[1] + k * (0 - P.hinge[1]));
    const axis = m.system.nodes.get(FLAP_SPLIT_NODE)!.absoluteTransform.rotateVector(new Vector3(0, 0, 1));
    expect(axis.x).toBeCloseTo(Math.sin(P.hingeSweep), 6);
    expect(axis.z).toBeCloseTo(Math.cos(P.hingeSweep), 6);
  });

  const driveBoth = (m: Mechanism, a: number, b = a) => {
    m.drive('gra_1', a * DEG);
    return m.drive('gra_2', b * DEG);
  };

  test.each([10, 30, 45, 60])('equal drives %i°: deflection matches the analytic four-bar, no split rotation', crankDeg => {
    const m = build();
    // Move in small synchronous steps, as both actuators would.
    for (let a = 5; a < crankDeg; a += 5) driveBoth(m, a);
    expect(driveBoth(m, crankDeg)).toEqual({ converged: true });
    expect(deflection(m) / DEG).toBeCloseTo(analyticFlapAngle(crankDeg * DEG) / DEG, 2);
    expect(Math.abs(jointValue(m, FLAP_SPLIT_JOINT))).toBeLessThan(0.01 * DEG);
  });

  test('independent drives over the full travel: the split takes the difference, nothing is over-constrained', () => {
    const m = build();
    for (let a = 0; a <= 60; a += 5) {
      expect(m.drive('gra_1', a * DEG).converged).toBe(true);
    }
    expect(jointValue(m, FLAP_SPLIT_JOINT)).toBeGreaterThan(40 * DEG);
    for (const pair of [['strut_1_end', 'flap_1_lug'], ['strut_2_end', 'flap_2_lug'], ['lever_2_end', 'hinge_2']]) {
      expect(dist(pos(m, pair[0]), pos(m, pair[1]))).toBeLessThan(P.tolerance);
    }
    // Struts stay rigid.
    const strutLength = (i: number) => dist(pos(m, `strut_${i}_top`), pos(m, `strut_${i}_end`));
    expect(strutLength(1) / strutLength(2)).toBeCloseTo(taperAt(P.supports[0].station) / taperAt(P.supports[1].station), 5);
    // Catching up with the outboard actuator removes the split rotation again.
    for (let b = 10; b <= 60; b += 10) expect(m.drive('gra_2', b * DEG).converged).toBe(true);
    expect(Math.abs(jointValue(m, FLAP_SPLIT_JOINT))).toBeLessThan(0.01 * DEG);
  });

  test('round trip returns to the reference pose', () => {
    const m = build();
    const ref = new Map([...m.system.nodes].map(([id, n]) => [id, n.absoluteTransform.getTranslation()]));
    for (const [a, b] of [[30, 0], [60, 20], [30, 45], [0, 0]]) driveBoth(m, a, b);
    for (const [id, p] of ref) expect(dist(pos(m, id), p)).toBeLessThan(1e-4);
  });

  test('a difference beyond the split range jams and reports the limiting joint', () => {
    const m = build({ splitRange: [-10 * DEG, 10 * DEG] });
    const result = m.drive('gra_1', 20 * DEG);
    expect(result.converged).toBe(false);
    expect(result.jointsAtLimit).toEqual([FLAP_SPLIT_JOINT]);
  });

  test('spanwise offset of the free hinge is taken by the lever swivel', () => {
    const def = droppedHingeFlap();
    const hinge2 = def.system.bodies.find(b => b.id === 'wing')!.nodes.find(n => n.id === 'hinge_2')!.localTransform;
    hinge2[12] += 0.02 * Math.sin(P.hingeSweep);
    hinge2[14] += 0.02 * Math.cos(P.hingeSweep);
    const m = new Mechanism();
    m.load(def);
    expect(m.startSimulation().converged).toBe(true);
    expect(driveBoth(m, 30).converged).toBe(true);
    const z = P.supports[1].station;
    const lever = taperAt(z) * Math.hypot(P.leverPivot[0] - P.hinge[0], P.leverPivot[1] - P.hinge[1]);
    expect(Math.abs(jointValue(m, 'lever_2_swivel'))).toBeCloseTo(Math.asin(0.02 / lever), 2);
    expect(deflection(m)).toBeCloseTo(analyticFlapAngle(30 * DEG), 2);
  });

  test('either support can be the spanwise-free one', () => {
    const m = build({ supports: [{ station: 0.75, spanwise: 'free' }, { station: 2.25, spanwise: 'fixed' }] });
    expect(m.system.bodies.has('lever_1')).toBe(true);
    expect(m.system.joints.has('hinge_2_z')).toBe(true);
    expect(driveBoth(m, 35, 20).converged).toBe(true);
  });

  test('rejects inconsistent parameters', () => {
    expect(() => droppedHingeFlap({ splitStation: 5 })).toThrow('splitStation');
    expect(() => droppedHingeFlap({ supports: [{ station: 2, spanwise: 'fixed' }, { station: 2.25, spanwise: 'free' }] }))
      .toThrow('support 1');
    expect(() => droppedHingeFlap({ supports: [{ station: 0.75, spanwise: 'fixed' }, { station: 1, spanwise: 'free' }] }))
      .toThrow('support 2');
    expect(() => droppedHingeFlap({ supports: [{ station: 0.75, spanwise: 'fixed' }, { station: 2.25, spanwise: 'fixed' }] }))
      .toThrow('exactly one');
    expect(() => droppedHingeFlap({ crankLength: 0 })).toThrow('crankLength');
    expect(() => droppedHingeFlap({ taper: 0 })).toThrow('taper');
    expect(() => droppedHingeFlap({ splitChordFraction: 1 })).toThrow('splitChordFraction');
  });
});

describe('generated demos', () => {
  test.each(Object.entries(GENERATED_DEMOS))('demos/%s is up to date (npm run generate:demos -w @wigglesolve/core)', (file, def) => {
    const onDisk = fs.readFileSync(path.resolve(__dirname, '../../demos', file), 'utf8');
    expect(onDisk).toBe(formatDefinition(def));
  });
});
