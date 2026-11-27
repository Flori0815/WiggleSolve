import * as fs from 'fs';
import * as path from 'path';
import { parseDefinition } from '../src/definition/build';
import { Mechanism } from '../src/simulation/Mechanism';
import { applyJointDelta } from '../src/system/utils';
import {
  DROPPED_HINGE_FLAP_DEFAULTS as P,
  droppedHingeFlap,
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
  test('produces a valid definition with two actuators and three loops', () => {
    const def = parseDefinition(droppedHingeFlap());
    expect(def.actuators.map(a => a.id)).toEqual(['gra_1', 'gra_2']);
    expect(def.sequence).toHaveLength(3);
    expect(def.system.joints.find(j => j.id === 'support_2_slide')?.type).toBe('prismatic');
  });

  test('reference pose is closed', () => {
    const m = build();
    for (const i of [1, 2]) {
      const id = flapIds(i);
      expect(dist(pos(m, id.strutEnd), pos(m, id.lug))).toBeLessThan(1e-6);
    }
  });

  test.each([10, 30, 45, 60])('drive %i° matches the analytic four-bar solution', crankDeg => {
    const m = build();
    expect(m.drive('gra_1', crankDeg * DEG)).toEqual({ converged: true });
    expect(m.drive('gra_2', crankDeg * DEG)).toEqual({ converged: true });
    const expected = analyticFlapAngle(crankDeg * DEG) / DEG;
    expect(jointValue(m, 'flap_1_rot') / DEG).toBeCloseTo(expected, 1);
    expect(jointValue(m, 'flap_2_rot') / DEG).toBeCloseTo(expected, 1);
  });

  test('positive drive lowers the trailing edge', () => {
    const m = build();
    const before = pos(m, 'flap_1_te_in')[1];
    m.drive('gra_1', 40 * DEG);
    expect(pos(m, 'flap_1_te_in')[1]).toBeLessThan(before - 0.3);
  });

  test('panels follow their own actuator: unequal drives are not over-constrained', () => {
    const m = build();
    m.drive('gra_1', 40 * DEG);
    const result = m.drive('gra_2', 25 * DEG);
    expect(result.converged).toBe(true);
    expect(jointValue(m, 'flap_1_rot')).toBeCloseTo(analyticFlapAngle(40 * DEG), 3);
    expect(jointValue(m, 'flap_2_rot')).toBeCloseTo(analyticFlapAngle(25 * DEG), 3);
    // Struts stay rigid.
    const strutLength = (i: number) => dist(pos(m, flapIds(i).strutTop), pos(m, flapIds(i).strutEnd));
    expect(strutLength(1)).toBeCloseTo(strutLength(2), 5);
    // Halves stay coupled on the hinge axis at the split.
    expect(dist(pos(m, 'flap_1_axis_split'), pos(m, 'flap_2_axis_split'))).toBeLessThan(1e-6);
  });

  test('the free support absorbs a spanwise offset of its panel', () => {
    const m = build();
    const id = flapIds(2);
    const bodies = [id.panel, id.bracket, id.hingeLine].map(b => m.system.bodies.get(b)!);
    const shift = m.system.joints.get(id.slideJoint)!;
    applyJointDelta(shift, m.system.nodes.get(id.hinge)!, bodies, 0.02);
    expect(dist(pos(m, 'flap_1_axis_split'), pos(m, 'flap_2_axis_split'))).toBeCloseTo(0.02, 5);

    expect(m.solve().converged).toBe(true);
    expect(dist(pos(m, 'flap_1_axis_split'), pos(m, 'flap_2_axis_split'))).toBeLessThan(P.tolerance);
    expect(jointValue(m, id.slideJoint)).toBeCloseTo(-0.02, 3);
    expect(jointValue(m, 'flap_2_rot')).toBeCloseTo(0, 6);
    // The strut's rod ends take the spanwise offset back out of the support plane.
    expect(dist(pos(m, id.strutEnd), pos(m, id.lug))).toBeLessThan(P.tolerance);

    // Driving still closes every loop with the panel shifted.
    expect(m.drive('gra_2', 30 * DEG).converged).toBe(true);
    expect(jointValue(m, 'flap_2_rot')).toBeCloseTo(analyticFlapAngle(30 * DEG), 3);
    expect(m.system.joints.has('support_1_slide')).toBe(false);
  });

  test('spanwise wing strain at the free support is taken by the hinge slide and the strut rod ends', () => {
    const m = build();
    const id = flapIds(2);
    // Move the wing-side hardware of support 2 outboard (e.g. wing bending/thermal strain).
    const hardware = [id.support, id.crank, id.strut].map(b => m.system.bodies.get(b)!);
    const strain = m.system.joints.get(id.slideJoint)!;
    applyJointDelta(strain, m.system.nodes.get('spar_root')!, hardware, 0.02);

    expect(m.drive('gra_2', 30 * DEG).converged).toBe(true);
    // The panel keeps its spanwise position (coupled at the split) ...
    expect(dist(pos(m, 'flap_1_axis_split'), pos(m, 'flap_2_axis_split'))).toBeLessThan(P.tolerance);
    expect(pos(m, id.flapHinge)[2]).toBeCloseTo(P.supports[1].station, 5);
    // ... the strut closes by tilting on its rod ends ...
    expect(dist(pos(m, id.strutEnd), pos(m, id.lug))).toBeLessThan(P.tolerance);
    expect(Math.abs(jointValue(m, id.strutTiltJoint))).toBeGreaterThan(1 * DEG);
    // ... and the flap angle barely changes (strut projection shortens slightly).
    expect(Math.abs(jointValue(m, 'flap_2_rot') - analyticFlapAngle(30 * DEG))).toBeLessThan(0.5 * DEG);
  });

  test('either support can be the spanwise-free one', () => {
    const def = droppedHingeFlap({
      supports: [{ station: 0.75, spanwise: 'free' }, { station: 2.25, spanwise: 'fixed' }],
    });
    expect(def.system.joints.some(j => j.id === 'support_1_slide')).toBe(true);
    expect(def.sequence[0].steps[0].operation.effectorNode).toBe('flap_1_axis_split');
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
