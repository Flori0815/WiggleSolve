import { IDENTITY_MAT16 } from '../math/matrixHelpers';
import { beamMesh, loftMesh } from '../visual/mesh';
import type { MeshVisual, Point2 } from '../visual/mesh';
import type {
  ActuatorDef,
  BodyDef,
  JointDef,
  LoopDef,
  MechanismDefinition,
} from '../definition/schema';

/**
 * Dropped-hinge trailing-edge flap with two supports on a swept wing.
 *
 * World: x = aft, y = up, z = outboard. The hinge line is swept by
 * `hingeSweep`; sections are defined in the plane normal to it (x' aft, y up)
 * and scaled about the hinge point by the local taper factor, so the trailing
 * edge has its own (smaller) sweep.
 *
 * Topology (only what the kinematics needs; everything else is a mesh):
 * - The flap is split at `splitStation` into two panels joined by a revolute
 *   joint parallel to the hinge line, located inside the flap section at
 *   `splitChordFraction` of the chord — the only relative freedom between them.
 * - Spanwise-fixed support: the hinge lever is part of its panel and meets the
 *   wing in a spherical joint.
 * - Spanwise-free support: a separate lever swivels on a flap-fixed axis
 *   (normal to the hinge line) and meets the wing in a spherical joint.
 * - Each support: rotary actuator → crank → drive strut (rod ends) → lug.
 *   Both rotary actuators are driven by one power drive unit through the
 *   torque shaft (`flap_drive`); `gra_2_rigging` adds a rigging offset at the
 *   outboard actuator.
 *
 * Mobility: 2 panels + 1 lever (18) − split revolute (5) − fixed spherical (3)
 * − swivel revolute (5) − free spherical (3) − 2 struts (2) = 0. Because the
 * split axis is offset from the hinge line, the closures are strongly coupled
 * and are solved simultaneously (`close_loops`).
 */
export interface DroppedHingeFlapParams {
  name: string;
  description: string;
  /** Extent of the flap along the hinge line [root, tip]. */
  span: [number, number];
  /** Station of the split between the two panels (along the hinge line). */
  splitStation: number;
  /** Position of the split axis inside the flap section, as fraction of the local chord from the leading edge. */
  splitChordFraction: number;
  /** One support per panel; exactly one spanwise fixed. Stations along the hinge line. */
  supports: [SupportSpec, SupportSpec];
  /** Sweep of the hinge line (rad, positive = tip aft). */
  hingeSweep: number;
  /** Tip-to-root chord ratio of the flap; the section scales linearly about the hinge point. */
  taper: number;
  /** Section geometry at the root, in the plane normal to the hinge line (x aft, y up). */
  hinge: Point2;
  /** Drive-strut attachment lug on the flap. */
  lug: Point2;
  /** Swivel point of the free-support lever on the flap (axis: flap-fixed, normal to the hinge line). */
  leverPivot: Point2;
  /** Flap section (convex polygon, counter-clockwise); index 0 is the leading edge. */
  profile: Point2[];
  /** Rotary actuator output axis. */
  actuatorAxis: Point2;
  /** Crank length and reference direction (rad, 0 = pointing down, positive about the hinge axis). */
  crankLength: number;
  crankAngle: number;
  /** Actuator travel [min, max] in rad relative to the reference pose (both actuators, torque shaft). */
  driveRange: [number, number];
  /** Rigging / backlash offset of the outboard actuator relative to the shaft [min, max] in rad. */
  riggingRange: [number, number];
  /** Flap rotation about the hinge axis [min, max] in rad (negative = trailing edge down). */
  flapRange: [number, number];
  /** Relative rotation of the panels at the split [min, max] in rad. */
  splitRange: [number, number];
  /** Swivel of the free-support lever [min, max] in rad. */
  swivelRange: [number, number];
  /** Rotation of the fixed spherical hinge about the two axes normal to the hinge line [min, max] in rad. */
  sphericalRange: [number, number];
  /** Out-of-plane tilt of the drive struts on their rod ends [min, max] in rad. */
  strutTilt: [number, number];
  /** Loop convergence tolerance (length units). */
  tolerance: number;
  /** Levenberg-Marquardt damping λ of the simultaneous loop closure. */
  damping: number;
}

export interface SupportSpec {
  station: number;
  spanwise: 'fixed' | 'free';
}

const DEG = Math.PI / 180;

export const DROPPED_HINGE_FLAP_DEFAULTS: DroppedHingeFlapParams = {
  name: 'Dropped-Hinge Flap (swept, tapered)',
  description:
    'Two-panel tapered trailing-edge flap on the swept dropped hinge line of a swept wing. The panels are joined '
    + 'by a single revolute joint whose axis lies inside the flap section at one third of the chord. Inboard '
    + 'support: hinge lever fixed to the flap, spherical joint to the wing (spanwise fixed). Outboard support: '
    + 'lever swivelling on a flap-fixed axis, spherical joint to the wing (spanwise free). Each support has a '
    + 'rotary actuator driving the flap through a crank and drive strut.',
  span: [0, 3],
  splitStation: 1.5,
  splitChordFraction: 1 / 3,
  supports: [
    { station: 0.75, spanwise: 'fixed' },
    { station: 2.25, spanwise: 'free' },
  ],
  hingeSweep: 25 * DEG,
  taper: 0.6,
  hinge: [0.6, -0.3],
  lug: [0.55, -0.15],
  leverPivot: [0.6, -0.09],
  profile: [[0.45, -0.06], [0.52, -0.1], [0.75, -0.08], [1.45, -0.11], [0.75, 0], [0.52, -0.01]],
  actuatorAxis: [0.15, -0.05],
  crankLength: 0.15,
  crankAngle: 0,
  driveRange: [0, 60 * DEG],
  riggingRange: [-2 * DEG, 2 * DEG],
  flapRange: [-70 * DEG, 10 * DEG],
  splitRange: [-15 * DEG, 15 * DEG],
  swivelRange: [-15 * DEG, 15 * DEG],
  sphericalRange: [-30 * DEG, 30 * DEG],
  strutTilt: [-10 * DEG, 10 * DEG],
  tolerance: 1e-5,
  damping: 1e-3,
};

/** Ids of the elements generated for support / panel `i` (1-based). */
export const flapIds = (i: number) => ({
  hinge: `hinge_${i}`,
  actuatorAxis: `gra_${i}_axis`,
  crank: `crank_${i}`,
  crankTip: `crank_${i}_tip`,
  strut: `strut_${i}`,
  strutTop: `strut_${i}_top`,
  strutEnd: `strut_${i}_end`,
  strutJoint: `strut_${i}_rot`,
  strutTiltJoint: `strut_${i}_tilt`,
  panel: `flap_${i}`,
  lug: `flap_${i}_lug`,
  lever: `lever_${i}`,
  leverPivot: `lever_${i}_pivot`,
  leverEnd: `lever_${i}_end`,
  swivelJoint: `lever_${i}_swivel`,
  sphericalJoints: [`hinge_${i}_x`, `hinge_${i}_y`, `hinge_${i}_z`] as const,
});

export const FLAP_SPLIT_NODE = 'flap_split';
export const FLAP_SPLIT_JOINT = 'flap_split_rot';
/** Torque-shaft drive (both rotary actuators) and outboard rigging offset. */
export const FLAP_DRIVE = 'flap_drive';
export const FLAP_RIGGING = 'gra_2_rigging';

const COLORS = { wing: '#64748b', flap: '#94a3b8', drive: '#f59e0b', lever: '#38bdf8' };

type Point3 = [number, number, number];

/**
 * Geometry helper: sections live in the plane normal to the hinge line
 * (x aft, y up) at a station `z` along it. A section point is scaled about the
 * hinge point by the local taper factor, then the hinge frame is swept about
 * the world y axis.
 */
function hingeFrame(p: DroppedHingeFlapParams) {
  const [root, tip] = p.span;
  const c = Math.cos(p.hingeSweep);
  const s = Math.sin(p.hingeSweep);
  const scale = (z: number) => 1 + (p.taper - 1) * (z - root) / (tip - root);
  const toWorld = ([x, y, z]: Point3): Point3 => [c * x + s * z, y, -s * x + c * z];
  const point = ([x, y]: Point2, z: number): Point3 => {
    const k = scale(z);
    return toWorld([p.hinge[0] + k * (x - p.hinge[0]), p.hinge[1] + k * (y - p.hinge[1]), z]);
  };
  /** Frame at a section point; its x axis is rotated by `angle` about the hinge axis. */
  const frame = (q: Point2, z: number, angle = 0): number[] => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const [x, y, zz] = point(q, z);
    const r = (v: number) => Math.round(v * 1e12) / 1e12 || 0;
    return [c * ca, sa, -s * ca, 0, -c * sa, ca, s * sa, 0, s, 0, c, 0, x, y, zz, 1].map(r);
  };
  return { scale, point, frame, section: (pts: Point2[], z: number) => pts.map(q => point(q, z)) };
}

const body = (id: string, nodes: BodyDef['nodes'], visuals: MeshVisual[]): BodyDef =>
  ({ id, transform: [...IDENTITY_MAT16], nodes, visuals });

function validate(p: DroppedHingeFlapParams): void {
  const [root, tip] = p.span;
  const errors: string[] = [];
  if (!(root < p.splitStation && p.splitStation < tip)) errors.push('splitStation must lie inside span');
  if (!(p.supports[0].station > root && p.supports[0].station < p.splitStation)) errors.push('support 1 must lie on the inboard panel');
  if (!(p.supports[1].station > p.splitStation && p.supports[1].station < tip)) errors.push('support 2 must lie on the outboard panel');
  if (p.supports.filter(s => s.spanwise === 'fixed').length !== 1) errors.push('exactly one support must be spanwise fixed');
  if (p.crankLength <= 0) errors.push('crankLength must be positive');
  if (!(p.taper > 0)) errors.push('taper must be positive');
  if (!(p.splitChordFraction > 0 && p.splitChordFraction < 1)) errors.push('splitChordFraction must lie between 0 and 1');
  if (errors.length) throw new Error(`Invalid dropped-hinge flap parameters: ${errors.join('; ')}`);
}

/** Split axis point: at `splitChordFraction` of the chord, midway between upper and lower surface. */
function splitPoint(p: DroppedHingeFlapParams): Point2 {
  const le = p.profile[0];
  const te = p.profile.reduce((a, b) => (b[0] > a[0] ? b : a));
  const x = le[0] + p.splitChordFraction * (te[0] - le[0]);
  const ys: number[] = [];
  p.profile.forEach((a, i) => {
    const b = p.profile[(i + 1) % p.profile.length];
    if ((a[0] - x) * (b[0] - x) <= 0 && a[0] !== b[0]) ys.push(a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]));
  });
  return [x, (Math.min(...ys) + Math.max(...ys)) / 2];
}

/** Generates a complete mechanism definition for a dropped-hinge flap. */
export function droppedHingeFlap(overrides: Partial<DroppedHingeFlapParams> = {}): MechanismDefinition {
  const p: DroppedHingeFlapParams = { ...DROPPED_HINGE_FLAP_DEFAULTS, ...overrides };
  validate(p);

  const [root, tip] = p.span;
  const g = hingeFrame(p);
  const node = (id: string, q: Point2, z: number, angle = 0) => ({ id, localTransform: g.frame(q, z, angle) });
  const gap = 0.005;
  const panelSpans: Array<[number, number]> = [[root, p.splitStation - gap], [p.splitStation + gap, tip]];
  const fixed = p.supports.findIndex(s => s.spanwise === 'fixed') + 1;
  const free = 3 - fixed;
  const F = flapIds(fixed);
  const G = flapIds(free);
  const crankTip: Point2 = [
    p.actuatorAxis[0] + p.crankLength * Math.sin(p.crankAngle),
    p.actuatorAxis[1] - p.crankLength * Math.cos(p.crankAngle),
  ];
  const strutAngle = Math.atan2(p.lug[1] - crankTip[1], p.lug[0] - crankTip[0]);
  const station = (i: number) => p.supports[i - 1].station;
  const beam = (a: Point2, b: Point2, z: number, w: number, color: string) => beamMesh(g.point(a, z), g.point(b, z), w * g.scale(z), w * g.scale(z), { color });

  // ── Bodies ────────────────────────────────────────────────────────────────
  const ribProfile: Point2[] = [[0, -0.06], [p.hinge[0] + 0.04, p.hinge[1] - 0.02], [p.hinge[0] + 0.04, p.hinge[1] + 0.04], [0, 0.06]];
  const wingVisuals: MeshVisual[] = [
    loftMesh(g.section([[-0.03, -0.06], [0.03, -0.06], [0.03, 0.06], [-0.03, 0.06]], root), g.section([[-0.03, -0.06], [0.03, -0.06], [0.03, 0.06], [-0.03, 0.06]], tip), { color: COLORS.wing }),
  ];
  const wingNodes: BodyDef['nodes'] = [];
  for (const i of [1, 2]) {
    const id = flapIds(i);
    const z = station(i);
    wingNodes.push(node(id.hinge, p.hinge, z), node(id.actuatorAxis, p.actuatorAxis, z));
    wingVisuals.push(loftMesh(g.section(ribProfile, z - 0.06), g.section(ribProfile, z - 0.04), { color: COLORS.wing }));
  }
  const bodies: BodyDef[] = [body('wing', wingNodes, wingVisuals)];

  for (const i of [1, 2]) {
    const id = flapIds(i);
    const z = station(i);
    const [zIn, zOut] = panelSpans[i - 1];
    const bracketBottom: Point2 = i === fixed ? p.hinge : p.leverPivot;
    const bracketProfile: Point2[] = [[p.lug[0] - 0.03, p.lug[1] - 0.02], [bracketBottom[0], bracketBottom[1] - 0.02], [bracketBottom[0] + 0.03, bracketBottom[1]], p.profile[2], [p.lug[0] - 0.03, p.profile[1][1]]];
    const flapNodes = [node(id.lug, p.lug, z)];
    if (i === fixed) flapNodes.push(node(FLAP_SPLIT_NODE, splitPoint(p), p.splitStation));
    if (i === free) flapNodes.push(node(id.leverPivot, p.leverPivot, z));

    bodies.push(
      body(id.crank, [node(id.crankTip, crankTip, z)], [beam(p.actuatorAxis, crankTip, z, 0.03, COLORS.drive)]),
      body(id.strut, [node(id.strutTop, crankTip, z, strutAngle), node(id.strutEnd, p.lug, z)], [beam(crankTip, p.lug, z, 0.02, COLORS.drive)]),
      body(id.panel, flapNodes, [
        loftMesh(g.section(p.profile, zIn), g.section(p.profile, zOut), { color: COLORS.flap, opacity: 0.6 }),
        loftMesh(g.section(bracketProfile, z - 0.01), g.section(bracketProfile, z + 0.01), { color: COLORS.flap }),
      ]),
    );
    if (i === free) {
      bodies.push(body(id.lever, [node(id.leverEnd, p.hinge, z)], [beam(p.leverPivot, p.hinge, z, 0.03, COLORS.lever)]));
    }
  }
  // ── Joints and actuators ─────────────────────────────────────────────────
  const joints: JointDef[] = [];
  for (const i of [1, 2]) {
    const id = flapIds(i);
    joints.push(
      { id: id.strutJoint, type: 'revolute', axis: [0, 0, 1], limits: [-Math.PI, Math.PI] },
      { id: id.strutTiltJoint, type: 'revolute', axis: [0, 1, 0], limits: [...p.strutTilt] },
    );
  }
  // One power drive unit turns both rotary actuators through the torque shaft;
  // a small rigging offset on the outboard actuator shows how the split
  // absorbs the resulting over-determination.
  const drive = (i: number) => ({ pivotNode: flapIds(i).actuatorAxis, movingBodies: [flapIds(i).crank, flapIds(i).strut] });
  joints.push(
    { id: FLAP_DRIVE, type: 'revolute', axis: [0, 0, 1], limits: [...p.driveRange] },
    { id: FLAP_RIGGING, type: 'revolute', axis: [0, 0, 1], limits: [...p.riggingRange] },
  );
  const actuators: ActuatorDef[] = [
    { id: FLAP_DRIVE, type: 'revolute', axis: 'z', ...drive(1), outputs: [drive(2)] },
    { id: FLAP_RIGGING, type: 'revolute', axis: 'z', ...drive(2) },
  ];
  const [sphX, sphY, sphZ] = F.sphericalJoints;
  joints.push(
    { id: sphX, type: 'revolute', axis: [1, 0, 0], limits: [...p.sphericalRange] },
    { id: sphY, type: 'revolute', axis: [0, 1, 0], limits: [...p.sphericalRange] },
    { id: sphZ, type: 'revolute', axis: [0, 0, 1], limits: [...p.flapRange] },
    { id: FLAP_SPLIT_JOINT, type: 'revolute', axis: [0, 0, 1], limits: [...p.splitRange] },
    { id: G.swivelJoint, type: 'revolute', axis: [1, 0, 0], limits: [...p.swivelRange] },
  );

  // ── Solving sequence ─────────────────────────────────────────────────────
  // The three closures (strut 1 ↔ lug 1, strut 2 ↔ lug 2, lever ↔ hinge 2) are
  // strongly coupled because the split axis is offset from the hinge line, so
  // they are closed simultaneously by one Gauss-Newton step per iteration.
  const whole = [F.panel, G.panel, G.lever];
  const pairs: Array<[string, string]> = [[F.strutEnd, F.lug], [G.strutEnd, G.lug], [G.leverEnd, G.hinge]];
  const loopJoints = [
    ...[F, G].flatMap(id => [
      { jointId: id.strutJoint, pivotNode: id.strutTop, movingBodies: [id.strut] },
      { jointId: id.strutTiltJoint, pivotNode: id.strutTop, movingBodies: [id.strut] },
    ]),
    ...F.sphericalJoints.map(jointId => ({ jointId, pivotNode: F.hinge, movingBodies: whole })),
    { jointId: FLAP_SPLIT_JOINT, pivotNode: FLAP_SPLIT_NODE, movingBodies: [G.panel, G.lever] },
    { jointId: G.swivelJoint, pivotNode: G.leverPivot, movingBodies: [G.lever] },
  ];
  const sequence: LoopDef[] = [{
    type: 'loop',
    max_iterations: 50,
    condition: { type: 'all_distances_less_than', pairs, threshold: p.tolerance },
    steps: [{ type: 'operation', operation: { type: 'close_loops', joints: loopJoints, pairs, damping: p.damping } }],
  }];

  return {
    name: p.name,
    description: p.description,
    system: { bodies, globalNodes: [], joints },
    actuators,
    sequence,
  };
}
