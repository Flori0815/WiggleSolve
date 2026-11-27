import { parseDefinition } from '../src/definition';
import { hingedSurface, SURFACE_IDS, widebodyWing, WIDEBODY_WING_DEFAULTS as W } from '../src/mechanisms';
import { Mechanism } from '../src/simulation/Mechanism';

const DEG = Math.PI / 180;
type V = [number, number, number];
const dist = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

describe('hingedSurface', () => {
  const spoiler = (overrides = {}) => hingedSurface({
    hingeRoot: [5, 0.3, 4], hingeTip: [6, 0.3, 6.5], chordRoot: 1.4, chordTip: 1.2,
    profile: [[0, 0], [0.05, -0.08], [1, -0.07], [1, -0.04]],
    drive: { type: 'linear', mount: [-0.25, -0.35], lug: [0.12, -0.06], station: 0.5 },
    deflectionRange: [0, 60 * DEG],
    ...overrides,
  });

  test('linear drive: full stroke gives exactly the maximum deflection', () => {
    const m = new Mechanism();
    m.load(parseDefinition(spoiler({ actuatorGroup: 'Spoilers' })));
    m.startSimulation();
    expect(m.driveGroup('Spoilers', 1)).toEqual({ converged: true });
    expect(m.system.joints.get(SURFACE_IDS.hingeJoint)!.value).toBeCloseTo(60 * DEG, 2);
    expect(m.driveGroup('Spoilers', 0)).toEqual({ converged: true });
    expect(m.system.joints.get(SURFACE_IDS.hingeJoint)!.value).toBeCloseTo(0, 2);
  });

  test('deployDown reverses the positive sense; rotary drive moves the surface directly', () => {
    const m = new Mechanism();
    m.load(parseDefinition(hingedSurface({
      hingeRoot: [1, 0, 4], hingeTip: [3, 0, 9], chordRoot: 1, chordTip: 0.8,
      profile: [[0, 0], [0.5, 0], [0.5, -0.02], [0, -0.02]],
      drive: { type: 'rotary' }, deflectionRange: [0, 90 * DEG], deployDown: true,
    })));
    expect(m.sequence).toHaveLength(0);
    const before = m.system.bodies.get(SURFACE_IDS.surface)!.visuals[0].vertices.slice(3, 6);
    m.startSimulation();
    m.drive(SURFACE_IDS.actuator, 90 * DEG);
    const t = m.system.bodies.get(SURFACE_IDS.surface)!.transform;
    const p = t.transformVector({ x: before[0], y: before[1], z: before[2] } as never);
    expect(p.y).toBeLessThan(before[1] - 0.3);
  });

  test('rejects a zero-length hinge and toggle positions', () => {
    expect(() => spoiler({ hingeTip: [5, 0.3, 4] })).toThrow('zero length');
    expect(() => spoiler({ deflectionRange: [-120 * DEG, 60 * DEG] })).toThrow('toggle');
  });
});

describe('widebodyWing', () => {
  const def = parseDefinition(widebodyWing());

  test('has every surface of the wing with its drive group', () => {
    const groups = new Map<string, number>();
    def.actuators.forEach(a => groups.set(a.group!, (groups.get(a.group!) ?? 0) + 1));
    expect(Object.fromEntries(groups)).toEqual({ 'Leading edge': 7, Flaps: 4, Flaperon: 1, Aileron: 1, Spoilers: 7 });
    expect(def.system.bodies.filter(b => b.id.endsWith('_surface')).length).toBe(1 + 6 + 2 + 7);
  });

  test('planform follows the parameters', () => {
    const m = Mechanism.fromDefinition(def);
    // Slat track centres sit at 28 % of the local chord behind the leading edge.
    const { root, kink } = W.stations;
    const le = (z: number) => (z - root) * Math.tan(W.leadingEdgeSweep);
    const teKink = W.rootChord + (kink - root) * Math.tan(W.trailingEdgeSweep.inboard);
    const te = (z: number) => teKink + (z - kink) * Math.tan(W.trailingEdgeSweep.outboard);
    for (const i of [1, 6]) {
      const [x, , z] = m.system.nodes.get(`slat${i}_hinge`)!.absoluteTransform.getTranslation();
      expect(x).toBeCloseTo(le(z) + 0.28 * (te(z) - le(z)), 2);
    }
    // Trailing-edge devices end at the wing trailing edge.
    const flapTe = m.system.bodies.get('obflap_flap_2')!.visuals[0].vertices;
    expect(flapTe[3 * 3]).toBeCloseTo(te(flapTe[3 * 3 + 2]), 1);
  });

  test('every group deploys and retracts with all loops closed', () => {
    const m = Mechanism.fromDefinition(def);
    expect(m.startSimulation().converged).toBe(true);
    for (const { group } of m.actuatorGroups()) {
      for (const f of [0.5, 1, 0]) expect(m.driveGroup(group, f).converged).toBe(true);
    }
    // Flaps fully down: both actuators at 60°, each flap's split at 0°.
    m.driveGroup('Flaps', 1);
    expect(Math.abs(m.system.joints.get('ibflap_flap_split_rot')!.value)).toBeLessThan(0.05 * DEG);
    expect(dist(m.system.nodes.get('obflap_lever_2_end')!.absoluteTransform.getTranslation(), m.system.nodes.get('obflap_hinge_2')!.absoluteTransform.getTranslation())).toBeLessThan(1e-4);
  });

  test('parameters can be overridden', () => {
    const narrow = parseDefinition(widebodyWing({ rootChord: 9 }));
    expect(narrow.system.bodies.length).toBe(def.system.bodies.length);
  });
});
