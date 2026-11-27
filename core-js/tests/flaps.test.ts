import * as fs from 'fs';
import * as path from 'path';
import { parseDefinition } from '../src/definition/build';
import { Mechanism } from '../src/simulation/Mechanism';
import {
  DROPPED_HINGE_FLAP_DEFAULTS as P,
  droppedHingeFlap,
  FLAP_SPLIT_JOINT,
  FLAP_SPLIT_NODE,
  flapIds,
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

const build = () => {
  const m = new Mechanism();
  m.load(droppedHingeFlap());
  m.startSimulation();
  return m;
};
const pos = (m: Mechanism, id: string) => m.system.nodes.get(id)!.absoluteTransform.getTranslation();
const jointValue = (m: Mechanism, id: string) => m.system.joints.get(id)!.value;

describe('droppedHingeFlap', () => {
  test('uses only the kinematically required bodies; representation is meshes', () => {
    const def = parseDefinition(droppedHingeFlap());
    expect(def.system.bodies.map(b => b.id)).toEqual(['wing', 'crank_1', 'strut_1', 'flap_1', 'crank_2', 'strut_2', 'flap_2', 'lever_2']);
    expect(def.system.bodies.every(b => (b.visuals ?? []).length > 0)).toBe(true);
    expect(def.actuators.map(a => a.id)).toEqual(['gra_1', 'gra_2']);
    expect(def.sequence).toHaveLength(1);
    expect(def.sequence[0].condition).toMatchObject({ type: 'all_distances_less_than', pairs: [
      ['strut_1_end', 'flap_1_lug'], ['strut_2_end', 'flap_2_lug'], ['lever_2_end', 'hinge_2'],
    ] });
  });

  test('reference pose is closed', () => {
    const m = build();
    expect(m.solve()).toEqual({ converged: true });
    expect(dist(pos(m, 'lever_2_end'), pos(m, 'hinge_2'))).toBeLessThan(1e-6);
  });

  test.each([10, 30, 45, 60])('equal drives %i°: flap angle matches the analytic four-bar, split stays aligned', crankDeg => {
    const m = build();
    m.drive('gra_1', crankDeg * DEG);
    expect(m.drive('gra_2', crankDeg * DEG)).toEqual({ converged: true });
    expect(jointValue(m, 'hinge_1_z') / DEG).toBeCloseTo(analyticFlapAngle(crankDeg * DEG) / DEG, 1);
    expect(Math.abs(jointValue(m, FLAP_SPLIT_JOINT))).toBeLessThan(0.02 * DEG);
  });

  test('positive drive lowers the trailing edge', () => {
    const m = build();
    const before = pos(m, 'flap_1_lug')[0];
    m.drive('gra_1', 40 * DEG);
    m.drive('gra_2', 40 * DEG);
    // The lug sits above the hinge, so trailing edge down moves it aft.
    expect(pos(m, 'flap_1_lug')[0]).toBeGreaterThan(before + 0.05);
  });

  test('unequal drives: the panels differ only by the split rotation; everything else stays connected', () => {
    const m = build();
    m.drive('gra_1', 40 * DEG);
    expect(m.drive('gra_2', 25 * DEG).converged).toBe(true);
    const inner = analyticFlapAngle(40 * DEG);
    const outer = analyticFlapAngle(25 * DEG);
    expect(jointValue(m, 'hinge_1_z')).toBeCloseTo(inner, 3);
    expect(jointValue(m, FLAP_SPLIT_JOINT)).toBeCloseTo(outer - inner, 3);
    // Struts stay rigid; the free lever stays on its spherical hinge.
    const strutLength = (i: number) => dist(pos(m, flapIds(i).strutTop), pos(m, flapIds(i).strutEnd));
    expect(strutLength(1)).toBeCloseTo(strutLength(2), 5);
    expect(dist(pos(m, 'lever_2_end'), pos(m, 'hinge_2'))).toBeLessThan(P.tolerance);
    // The split point is shared: both panels keep it on the hinge axis.
    const split = m.system.nodes.get(FLAP_SPLIT_NODE)!.absoluteTransform.getTranslation();
    expect(split[0]).toBeCloseTo(P.hinge[0], 4);
    expect(split[1]).toBeCloseTo(P.hinge[1], 4);
  });

  test('spanwise offset of the free hinge is taken by the lever swivel', () => {
    const def = droppedHingeFlap();
    const wing = def.system.bodies.find(b => b.id === 'wing')!;
    wing.nodes.find(n => n.id === 'hinge_2')!.localTransform[14] += 0.02;
    const m = new Mechanism();
    m.load(def);
    expect(m.startSimulation().converged).toBe(true);
    m.drive('gra_1', 30 * DEG);
    expect(m.drive('gra_2', 30 * DEG).converged).toBe(true);
    const leverLength = Math.hypot(P.leverPivot[0] - P.hinge[0], P.leverPivot[1] - P.hinge[1]);
    expect(Math.abs(jointValue(m, 'lever_2_swivel'))).toBeCloseTo(Math.asin(0.02 / leverLength), 3);
    expect(jointValue(m, 'hinge_1_z')).toBeCloseTo(analyticFlapAngle(30 * DEG), 3);
    expect(dist(pos(m, 'lever_2_end'), pos(m, 'hinge_2'))).toBeLessThan(P.tolerance);
  });

  test('asymmetry beyond the split range jams and reports the limiting joint', () => {
    const m = build();
    const result = m.drive('gra_1', 45 * DEG);
    expect(result.converged).toBe(false);
    expect(result.jointsAtLimit).toEqual([FLAP_SPLIT_JOINT]);
    expect(m.drive('gra_2', 40 * DEG)).toEqual({ converged: true });
  });

  test('either support can be the spanwise-free one', () => {
    const def = droppedHingeFlap({
      supports: [{ station: 0.75, spanwise: 'free' }, { station: 2.25, spanwise: 'fixed' }],
    });
    expect(def.system.bodies.some(b => b.id === 'lever_1')).toBe(true);
    expect(def.system.joints.some(j => j.id === 'hinge_2_z')).toBe(true);
    const m = new Mechanism();
    m.load(def);
    m.startSimulation();
    m.drive('gra_1', 20 * DEG);
    expect(m.drive('gra_2', 35 * DEG).converged).toBe(true);
    expect(jointValue(m, 'hinge_2_z')).toBeCloseTo(analyticFlapAngle(35 * DEG), 3);
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
  });
});

describe('generated demos', () => {
  test.each(Object.entries(GENERATED_DEMOS))('demos/%s is up to date (npm run generate:demos -w @wigglesolve/core)', (file, def) => {
    const onDisk = fs.readFileSync(path.resolve(__dirname, '../../demos', file), 'utf8');
    expect(onDisk).toBe(formatDefinition(def));
  });
});
