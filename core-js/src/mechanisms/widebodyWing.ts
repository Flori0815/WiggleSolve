import { IDENTITY_MAT16 } from '../math/matrixHelpers';
import { beamMesh, loftMesh } from '../visual/mesh';
import type { MeshVisual, Point2, Point3 } from '../visual/mesh';
import { mergeDefinitions, prefixDefinition } from '../definition/compose';
import type { MechanismDefinition } from '../definition/schema';
import { DROPPED_HINGE_FLAP_DEFAULTS, droppedHingeFlap } from './droppedHingeFlap';
import { lineSweep, sweptFrame } from './geometry';
import { hingedSurface } from './hingedSurface';

const DEG = Math.PI / 180;

/**
 * Right wing of a long-range twin-aisle airliner in the class of the
 * Boeing 787-8, with its complete set of moving surfaces.
 *
 * The planform is an approximation from publicly quoted figures (semi-span,
 * leading-edge sweep, trailing-edge kink behind the engine); it is not
 * manufacturer data. World axes: x aft, y up, z outboard; z = 0 is the
 * aircraft centreline, the wing root sits at the side of body.
 */
export interface WidebodyWingParams {
  name: string;
  description: string;
  /** Spanwise stations: side of body, trailing-edge kink, tip. */
  stations: { root: number; kink: number; tip: number };
  /** Leading-edge sweep. */
  leadingEdgeSweep: number;
  /** Trailing-edge sweep inboard and outboard of the kink. */
  trailingEdgeSweep: { inboard: number; outboard: number };
  /** Chord at the side of body. */
  rootChord: number;
  /** Thickness-to-chord ratio at root and tip. */
  thickness: { root: number; tip: number };
  /** Engine centreline station. */
  engineStation: number;
}

export const WIDEBODY_WING_DEFAULTS: WidebodyWingParams = {
  name: 'Widebody Wing (787-class)',
  description:
    'Right wing of a 787-class twin-aisle airliner (approximate public planform) with all moving surfaces: '
    + 'inboard Krueger flap and six slats on the leading edge; dropped-hinge inboard and outboard flaps (two '
    + 'supports each, split panels, driven rotary actuators), flaperon behind the engine and outboard aileron on '
    + 'the trailing edge; seven spoilers. Drive groups move each kind of surface together.',
  stations: { root: 3, kink: 10, tip: 30 },
  leadingEdgeSweep: 32.2 * DEG,
  trailingEdgeSweep: { inboard: 5 * DEG, outboard: 21 * DEG },
  rootChord: 10.5,
  thickness: { root: 0.13, tip: 0.09 },
  engineStation: 9.6,
};

/** Normalised airfoil (x/c, y/c per unit thickness ratio), convex, counter-clockwise from the trailing edge. */
const AIRFOIL: Point2[] = [
  [1, 0], [0.95, 0.09], [0.5, 0.46], [0.15, 0.5], [0.02, 0.23], [0, 0],
  [0.02, -0.15], [0.15, -0.35], [0.5, -0.31], [0.95, -0.04],
];

const COLORS = { wing: '#64748b', engine: '#475569', slat: '#a5b4fc', krueger: '#a5b4fc', spoiler: '#e2e8f0', aileron: '#bae6fd', flap: '#94a3b8' };

/** Wing planform and section helpers. */
function planform(p: WidebodyWingParams) {
  const { root, kink, tip } = p.stations;
  const le = (z: number) => (z - root) * Math.tan(p.leadingEdgeSweep);
  const teKink = p.rootChord + (kink - root) * Math.tan(p.trailingEdgeSweep.inboard);
  const te = (z: number) => (z <= kink
    ? p.rootChord + (z - root) * Math.tan(p.trailingEdgeSweep.inboard)
    : teKink + (z - kink) * Math.tan(p.trailingEdgeSweep.outboard));
  const chord = (z: number) => te(z) - le(z);
  const tc = (z: number) => p.thickness.root + (p.thickness.tip - p.thickness.root) * (z - root) / (tip - root);
  /** Upper (side 1) or lower (side −1) surface height at chord fraction f (0–1), linearly interpolated. */
  const surface = (f: number, z: number, side: 1 | -1) => {
    const pts = AIRFOIL.filter(([, y]) => (side === 1 ? y >= 0 : y <= 0)).sort((a, b) => a[0] - b[0]);
    const i = Math.max(1, pts.findIndex(([x]) => x >= f));
    const [[x0, y0], [x1, y1]] = [pts[i - 1], pts[i]];
    return (y0 + (y1 - y0) * (f - x0) / (x1 - x0)) * tc(z) * chord(z);
  };
  /** World point at chord fraction f and height y on station z. */
  const at = (f: number, y: number, z: number): Point3 => [le(z) + f * chord(z), y, z];
  /** Streamwise section of the fixed wing between chord fractions f0 and f1. */
  const section = (z: number, f0: number, f1: number): Point3[] =>
    AIRFOIL.map(([x, y]): Point3 => [le(z) + (f0 + x * (f1 - f0)) * chord(z), y * tc(z) * chord(z), z]);
  return { le, te, chord, tc, surface, at, section };
}

/** Fixed structure: wing box, engine nacelle and pylon (representation only). */
function wingStructure(p: WidebodyWingParams, w: ReturnType<typeof planform>): MechanismDefinition {
  const { root, kink, tip } = p.stations;
  const box = (z0: number, z1: number) => loftMesh(w.section(z0, 0.12, 0.7), w.section(z1, 0.12, 0.7), { color: COLORS.wing });
  const ze = p.engineStation;
  const nacelleTop = w.surface(0.2, ze, -1) - 1.4;
  const visuals: MeshVisual[] = [
    box(root, kink),
    box(kink, tip),
    beamMesh([w.le(ze) - 4.2, nacelleTop - 1.4, ze], [w.le(ze) + 1.2, nacelleTop - 1.4, ze], 2.8, 2.8, { color: COLORS.engine }),
    beamMesh([w.le(ze) - 2.5, nacelleTop, ze], [w.le(ze) + 1.5, w.surface(0.3, ze, -1), ze], 0.5, 0.9, { color: COLORS.engine }),
  ];
  return {
    name: 'structure',
    description: '',
    system: { bodies: [{ id: 'wing', transform: [...IDENTITY_MAT16], nodes: [], visuals }], globalNodes: [], joints: [] },
    actuators: [],
    sequence: [],
  };
}

/**
 * Places a dropped-hinge flap between stations z0 and z1 so that its trailing
 * edge lies on the wing trailing edge and its chord is `chordFraction` of the
 * local wing chord.
 */
function placeFlap(w: ReturnType<typeof planform>, z0: number, z1: number, chordFraction: number, name: string): MechanismDefinition {
  const d = DROPPED_HINGE_FLAP_DEFAULTS;
  const te = d.profile.reduce((a, b) => (b[0] > a[0] ? b : a));
  const le = d.profile[0];
  const profileChord = te[0] - le[0];
  const cr = chordFraction * w.chord(z0) / profileChord;
  const ct = chordFraction * w.chord(z1) / profileChord;
  // Hinge points: trailing edge minus the (scaled) hinge→TE offset, normal to the hinge line.
  const teOffset: Point2 = [te[0] - d.hinge[0], te[1] - d.hinge[1]];
  let sweep = Math.atan2(w.te(z1) - w.te(z0), z1 - z0);
  let h0: Point3 = [0, 0, 0];
  let h1: Point3 = [0, 0, 0];
  for (let i = 0; i < 5; i++) {
    const r = sweptFrame(sweep).rotate;
    const o0 = r([teOffset[0] * cr, teOffset[1] * cr, 0]);
    const o1 = r([teOffset[0] * ct, teOffset[1] * ct, 0]);
    h0 = [w.te(z0) - o0[0], -o0[1], z0 - o0[2]];
    h1 = [w.te(z1) - o1[0], -o1[1], z1 - o1[2]];
    sweep = lineSweep(h0, h1).sweep;
  }
  const length = lineSweep(h0, h1).length;
  return droppedHingeFlap({
    name,
    description: '',
    origin: h0,
    hingeSweep: sweep,
    span: [0, length],
    splitStation: length / 2,
    supports: [{ station: length / 4, spanwise: 'fixed' }, { station: 3 * length / 4, spanwise: 'free' }],
    chordScale: cr,
    taper: ct / cr,
    wingStructure: false,
    actuatorGroup: 'Flaps',
    // 0.1 mm: matrices are single precision, so at ~25 m from the origin
    // positions carry ~1e-5 m of rounding noise.
    tolerance: 1e-4,
  });
}

type SurfaceSpec = Omit<Parameters<typeof hingedSurface>[0], 'hingeRoot' | 'hingeTip' | 'chordRoot' | 'chordTip'>;

/** Hinged surface whose hinge lies at chord fraction `f` and height `y(z)` between stations z0 and z1. */
function placeSurface(
  w: ReturnType<typeof planform>,
  z0: number, z1: number,
  f: number, height: (z: number) => number,
  chordFraction: number,
  spec: SurfaceSpec,
): MechanismDefinition {
  return hingedSurface({
    ...spec,
    hingeRoot: w.at(f, height(z0), z0),
    hingeTip: w.at(f, height(z1), z1),
    chordRoot: chordFraction * w.chord(z0),
    chordTip: chordFraction * w.chord(z1),
  });
}

/** Generates the complete right wing as one mechanism definition. */
export function widebodyWing(overrides: Partial<WidebodyWingParams> = {}): MechanismDefinition {
  const p: WidebodyWingParams = { ...WIDEBODY_WING_DEFAULTS, ...overrides };
  const w = planform(p);
  const { kink, tip } = p.stations;
  const parts: MechanismDefinition[] = [wingStructure(p, w)];

  // ── Leading edge ──────────────────────────────────────────────────────────
  // Krueger flap inboard of the engine: stowed in the lower surface, rotates down and forward.
  parts.push(prefixDefinition(placeSurface(w, 4.2, 8.2, 0.1, z => w.surface(0.1, z, -1), 1, {
    name: 'Krueger', description: '',
    profile: [[0, 0], [0.13, -0.002], [0.13, -0.012], [0, -0.012]],
    drive: { type: 'rotary' }, deflectionRange: [0, 115 * DEG], deployDown: true,
    actuatorGroup: 'Leading edge', color: COLORS.krueger,
  }), 'krueger_'));

  // Six slats outboard of the engine on circular tracks: rotation about the track centre.
  const slatStations = Array.from({ length: 7 }, (_, i) => 11 + i * (tip - 0.5 - 11) / 6);
  const trackCentre: Point2 = [0.28, -0.3];
  const slatProfile: Point2[] = [[0, 0], [0.015, -0.03], [0.04, -0.035], [0.14, 0.05], [0.14, 0.066], [0.03, 0.045]]
    .map(([x, y]) => [x - trackCentre[0], y - trackCentre[1]]);
  for (let i = 0; i < 6; i++) {
    const [z0, z1] = [slatStations[i] + 0.05, slatStations[i + 1] - 0.05];
    parts.push(prefixDefinition(hingedSurface({
      name: `Slat ${i + 1}`, description: '',
      hingeRoot: w.at(trackCentre[0], trackCentre[1] * w.chord(z0), z0),
      hingeTip: w.at(trackCentre[0], trackCentre[1] * w.chord(z1), z1),
      chordRoot: w.chord(z0), chordTip: w.chord(z1),
      profile: slatProfile,
      drive: {
        type: 'rotary',
        fittings: [[0.2 - trackCentre[0], -trackCentre[1]]],
        tracks: { from: [0.12 - trackCentre[0], 0.02 - trackCentre[1]], arc: 30 * DEG, stations: [0.2, 0.8] },
      },
      deflectionRange: [0, 24 * DEG],
      actuatorGroup: 'Leading edge', color: COLORS.slat,
    }), `slat${i + 1}_`));
  }

  // ── Trailing edge ─────────────────────────────────────────────────────────
  parts.push(prefixDefinition(placeFlap(w, 3.4, kink - 0.1, 0.27, 'Inboard flap'), 'ibflap_'));
  parts.push(prefixDefinition(placeFlap(w, 12.6, 21.0, 0.27, 'Outboard flap'), 'obflap_'));

  const controlProfile: Point2[] = [[-0.06, 0], [0.02, -0.05], [0.95, -0.01], [1, 0], [0.95, 0.012], [0.02, 0.05]];
  const linearHorn = { mount: [-0.75, 0] as Point2, lug: [0.05, -0.16] as Point2, station: 0.5 };
  const midHeight = (f: number) => (z: number) => (w.surface(f, z, 1) + w.surface(f, z, -1)) / 2;
  parts.push(prefixDefinition(placeSurface(w, kink + 0.1, 12.5, 0.75, midHeight(0.75), 0.25, {
    name: 'Flaperon', description: '', profile: controlProfile,
    drive: { type: 'linear', ...linearHorn }, deflectionRange: [-10 * DEG, 30 * DEG], deployDown: true,
    actuatorGroup: 'Flaperon', color: COLORS.aileron,
  }), 'flaperon_'));
  parts.push(prefixDefinition(placeSurface(w, 21.2, 27.6, 0.75, midHeight(0.75), 0.25, {
    name: 'Aileron', description: '', profile: controlProfile,
    drive: { type: 'linear', ...linearHorn }, deflectionRange: [-25 * DEG, 25 * DEG], deployDown: true,
    actuatorGroup: 'Aileron', color: COLORS.aileron,
  }), 'aileron_'));

  // ── Spoilers: hinged on the upper surface ahead of the flaps ──────────────
  const spoilerSpans: Array<[number, number]> = [[3.6, 6.3], [6.4, 9.1], [12.8, 14.4], [14.5, 16.1], [16.2, 17.8], [17.9, 19.5], [19.6, 21.0]];
  spoilerSpans.forEach(([z0, z1], i) => {
    parts.push(prefixDefinition(placeSurface(w, z0, z1, 0.66, z => w.surface(0.66, z, 1), 0.17, {
      name: `Spoiler ${i + 1}`, description: '',
      profile: [[0, 0], [0.04, -0.06], [1, -0.035], [1, -0.01]],
      drive: { type: 'linear', mount: [-0.3, -0.5], lug: [0.12, -0.08], station: 0.5 },
      deflectionRange: [0, 60 * DEG],
      actuatorGroup: 'Spoilers', color: COLORS.spoiler,
    }), `spoiler${i + 1}_`));
  });

  return mergeDefinitions(p.name, p.description, parts);
}
