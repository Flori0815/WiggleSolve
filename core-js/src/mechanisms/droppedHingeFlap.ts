import { IDENTITY_MAT16, rotationZMat16, translationMat16 } from '../math/matrixHelpers';
import { beamMesh, prismMesh } from '../visual/mesh';
import type { MeshVisual, Point2 } from '../visual/mesh';
import type {
  ActuatorDef,
  BodyDef,
  JointDef,
  MechanismDefinition,
  StepDef,
} from '../definition/schema';

/**
 * Dropped-hinge trailing-edge flap with two supports.
 *
 * Coordinates: x = chordwise aft, y = up, z = spanwise outboard. Profile
 * points are given in the support plane (x, y) and are the same at every
 * station.
 *
 * Topology (only what the kinematics needs; everything else is a mesh):
 * - The flap is split at `splitStation` into two panels joined by a revolute
 *   joint about the spanwise hinge axis — the only relative freedom between
 *   them.
 * - Spanwise-fixed support: the hinge lever is part of its panel and meets the
 *   wing in a spherical joint.
 * - Spanwise-free support: a separate lever swivels on a flap-fixed chordwise
 *   axis and meets the wing in a spherical joint, so the support can follow
 *   spanwise motion.
 * - Each support: rotary actuator → crank → drive strut (rod ends at both
 *   ends) → lug on its panel.
 *
 * Mobility: 2 panels + 1 lever (18) − split revolute (5) − fixed spherical (3)
 * − swivel revolute (5) − free spherical (3) − 2 struts (2) = 0, i.e. the two
 * actuators determine the flap completely without over-constraint.
 */
export interface DroppedHingeFlapParams {
  name: string;
  description: string;
  /** Spanwise extent of the flap [root, tip]. */
  span: [number, number];
  /** Station of the split between the two panels. */
  splitStation: number;
  /** One support per panel; exactly one spanwise fixed. */
  supports: [SupportSpec, SupportSpec];
  /** Hinge point (centre of the spherical joints) in the support plane. */
  hinge: Point2;
  /** Drive-strut attachment lug on the flap. */
  lug: Point2;
  /** Swivel point of the free-support lever on the flap (axis: chordwise, flap-fixed). */
  leverPivot: Point2;
  /** Flap section (convex polygon, counter-clockwise) in the support plane. */
  profile: Point2[];
  /** Rotary actuator output axis in the support plane. */
  actuatorAxis: Point2;
  /** Crank length and reference direction (rad, 0 = pointing down, positive about +z). */
  crankLength: number;
  crankAngle: number;
  /** Actuator travel [min, max] in rad relative to the reference pose. */
  driveRange: [number, number];
  /** Flap rotation about the hinge axis [min, max] in rad (negative = trailing edge down). */
  flapRange: [number, number];
  /** Relative rotation of the panels at the split [min, max] in rad. */
  splitRange: [number, number];
  /** Swivel of the free-support lever [min, max] in rad. */
  swivelRange: [number, number];
  /** Rotation of the fixed spherical hinge about x and y [min, max] in rad. */
  sphericalRange: [number, number];
  /** Out-of-plane tilt of the drive struts on their rod ends [min, max] in rad. */
  strutTilt: [number, number];
  /** Loop convergence tolerance (length units). */
  tolerance: number;
  /** Step damping of the solving loop (0–1]. */
  damping: number;
}

export interface SupportSpec {
  station: number;
  spanwise: 'fixed' | 'free';
}

const DEG = Math.PI / 180;

export const DROPPED_HINGE_FLAP_DEFAULTS: DroppedHingeFlapParams = {
  name: 'Dropped-Hinge Flap',
  description:
    'Two-panel trailing-edge flap on a dropped hinge. The panels are joined at the split by a single spanwise '
    + 'revolute joint. Inboard support: hinge lever fixed to the flap, spherical joint to the wing (spanwise '
    + 'fixed). Outboard support: lever swivelling on a flap-fixed axis, spherical joint to the wing (spanwise '
    + 'free). Each support has a rotary actuator driving the flap through a crank and drive strut.',
  span: [0, 3],
  splitStation: 1.5,
  supports: [
    { station: 0.75, spanwise: 'fixed' },
    { station: 2.25, spanwise: 'free' },
  ],
  hinge: [0.6, -0.3],
  lug: [0.55, -0.15],
  leverPivot: [0.6, -0.09],
  profile: [[0.45, -0.06], [0.52, -0.1], [0.75, -0.08], [1.45, -0.11], [0.75, 0], [0.52, -0.01]],
  actuatorAxis: [0.15, -0.05],
  crankLength: 0.15,
  crankAngle: 0,
  driveRange: [0, 60 * DEG],
  flapRange: [-70 * DEG, 10 * DEG],
  splitRange: [-15 * DEG, 15 * DEG],
  swivelRange: [-15 * DEG, 15 * DEG],
  sphericalRange: [-5 * DEG, 5 * DEG],
  strutTilt: [-10 * DEG, 10 * DEG],
  tolerance: 1e-5,
  damping: 0.8,
};

/** Ids of the elements generated for support / panel `i` (1-based). */
export const flapIds = (i: number) => ({
  hinge: `hinge_${i}`,
  actuator: `gra_${i}`,
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

const COLORS = { wing: '#64748b', flap: '#94a3b8', drive: '#f59e0b', lever: '#38bdf8' };

const at = ([x, y]: Point2, z: number) => translationMat16(x, y, z);
const node = (id: string, p: Point2, z: number) => ({ id, localTransform: at(p, z) });
const p3 = ([x, y]: Point2, z: number): [number, number, number] => [x, y, z];
const body = (id: string, nodes: BodyDef['nodes'], visuals: MeshVisual[]): BodyDef =>
  ({ id, transform: [...IDENTITY_MAT16], nodes, visuals });

/** Frame at `p` whose x axis points along `dir` (y is then the rod-end tilt axis). */
function frameAlong(id: string, p: Point2, z: number, dir: Point2) {
  const m = rotationZMat16(Math.atan2(dir[1], dir[0]));
  [m[12], m[13], m[14]] = [p[0], p[1], z];
  return { id, localTransform: m };
}

function validate(p: DroppedHingeFlapParams): void {
  const [root, tip] = p.span;
  const errors: string[] = [];
  if (!(root < p.splitStation && p.splitStation < tip)) errors.push('splitStation must lie inside span');
  if (!(p.supports[0].station > root && p.supports[0].station < p.splitStation)) errors.push('support 1 must lie on the inboard panel');
  if (!(p.supports[1].station > p.splitStation && p.supports[1].station < tip)) errors.push('support 2 must lie on the outboard panel');
  if (p.supports.filter(s => s.spanwise === 'fixed').length !== 1) errors.push('exactly one support must be spanwise fixed');
  if (p.crankLength <= 0) errors.push('crankLength must be positive');
  if (errors.length) throw new Error(`Invalid dropped-hinge flap parameters: ${errors.join('; ')}`);
}

/** Generates a complete mechanism definition for a dropped-hinge flap. */
export function droppedHingeFlap(overrides: Partial<DroppedHingeFlapParams> = {}): MechanismDefinition {
  const p: DroppedHingeFlapParams = { ...DROPPED_HINGE_FLAP_DEFAULTS, ...overrides };
  validate(p);

  const [root, tip] = p.span;
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
  const strutDir: Point2 = [p.lug[0] - crankTip[0], p.lug[1] - crankTip[1]];
  const station = (i: number) => p.supports[i - 1].station;

  // ── Bodies ────────────────────────────────────────────────────────────────
  const wingVisuals: MeshVisual[] = [beamMesh([0, 0, root], [0, 0, tip], 0.06, 0.12, { color: COLORS.wing })];
  const wingNodes: BodyDef['nodes'] = [];
  for (const i of [1, 2]) {
    const id = flapIds(i);
    const z = station(i);
    wingNodes.push(node(id.hinge, p.hinge, z), node(id.actuatorAxis, p.actuatorAxis, z));
    wingVisuals.push(prismMesh(
      [[0, -0.06], [p.hinge[0] + 0.04, p.hinge[1] - 0.02], [p.hinge[0] + 0.04, p.hinge[1] + 0.04], [0, 0.06]],
      z - 0.06, z - 0.04, { color: COLORS.wing },
    ));
  }
  const bodies: BodyDef[] = [body('wing', wingNodes, wingVisuals)];

  for (const i of [1, 2]) {
    const id = flapIds(i);
    const z = station(i);
    const [zIn, zOut] = panelSpans[i - 1];
    // Lever (or bracket) region on the flap at the support.
    const bracketBottom: Point2 = i === fixed ? p.hinge : p.leverPivot;
    const bracket = prismMesh(
      [[p.lug[0] - 0.03, p.lug[1] - 0.02], [bracketBottom[0], bracketBottom[1] - 0.02], [bracketBottom[0] + 0.03, bracketBottom[1]], [p.profile[2][0], p.profile[2][1]], [p.lug[0] - 0.03, p.profile[1][1]]],
      z - 0.01, z + 0.01, { color: COLORS.flap },
    );
    const flapNodes = [node(id.lug, p.lug, z)];
    if (i === fixed) flapNodes.push(node(FLAP_SPLIT_NODE, p.hinge, p.splitStation));
    if (i === free) flapNodes.push(node(id.leverPivot, p.leverPivot, z));

    bodies.push(
      body(id.crank, [node(id.crankTip, crankTip, z)], [beamMesh(p3(p.actuatorAxis, z), p3(crankTip, z), 0.03, 0.03, { color: COLORS.drive })]),
      body(id.strut, [frameAlong(id.strutTop, crankTip, z, strutDir), node(id.strutEnd, p.lug, z)],
        [beamMesh(p3(crankTip, z), p3(p.lug, z), 0.02, 0.02, { color: COLORS.drive })]),
      body(id.panel, flapNodes, [prismMesh(p.profile, zIn, zOut, { color: COLORS.flap, opacity: 0.6 }), bracket]),
    );
    if (i === free) {
      bodies.push(body(id.lever, [node(id.leverEnd, p.hinge, z)],
        [beamMesh(p3(p.leverPivot, z), p3(p.hinge, z), 0.03, 0.03, { color: COLORS.lever })]));
    }
  }

  // ── Joints and actuators ─────────────────────────────────────────────────
  const joints: JointDef[] = [];
  const actuators: ActuatorDef[] = [];
  for (const i of [1, 2]) {
    const id = flapIds(i);
    joints.push(
      { id: id.actuator, type: 'revolute', axis: [0, 0, 1], limits: [...p.driveRange] },
      { id: id.strutJoint, type: 'revolute', axis: [0, 0, 1], limits: [-Math.PI, Math.PI] },
      { id: id.strutTiltJoint, type: 'revolute', axis: [0, 1, 0], limits: [...p.strutTilt] },
    );
    actuators.push({ id: id.actuator, type: 'revolute', axis: 'z', pivotNode: id.actuatorAxis, movingBodies: [id.crank, id.strut] });
  }
  const [sphX, sphY, sphZ] = F.sphericalJoints;
  joints.push(
    { id: sphX, type: 'revolute', axis: [1, 0, 0], limits: [...p.sphericalRange] },
    { id: sphY, type: 'revolute', axis: [0, 1, 0], limits: [...p.sphericalRange] },
    { id: sphZ, type: 'revolute', axis: [0, 0, 1], limits: [...p.flapRange] },
    { id: FLAP_SPLIT_JOINT, type: 'revolute', axis: [0, 0, 1], limits: [...p.splitRange] },
    { id: G.swivelJoint, type: 'revolute', axis: [1, 0, 0], limits: [...p.swivelRange] },
  );

  // ── Solving sequence ─────────────────────────────────────────────────────
  const whole = [F.panel, G.panel, G.lever];
  const outer = [G.panel, G.lever];
  const align = (effectorNode: string, targetNode: string, pivotNode: string, jointId: string, movingBodies: string[]): StepDef =>
    ({ type: 'operation', operation: { type: 'align_node', effectorNode, targetNode, pivotNode, jointId, movingBodies, damping: p.damping } });
  const strutSteps = (id: ReturnType<typeof flapIds>) => [
    align(id.strutEnd, id.lug, id.strutTop, id.strutJoint, [id.strut]),
    align(id.strutEnd, id.lug, id.strutTop, id.strutTiltJoint, [id.strut]),
  ];

  return {
    name: p.name,
    description: p.description,
    system: { bodies, globalNodes: [], joints },
    actuators,
    sequence: [{
      type: 'loop',
      max_iterations: 2000,
      condition: {
        type: 'all_distances_less_than',
        pairs: [[F.strutEnd, F.lug], [G.strutEnd, G.lug], [G.leverEnd, G.hinge]],
        threshold: p.tolerance,
      },
      steps: [
        // Fixed support: strut onto lug, then the whole flap about the spherical hinge (span axis).
        ...strutSteps(F),
        align(F.lug, F.strutEnd, F.hinge, sphZ, whole),
        // Free support: strut onto lug, then the outer panel about the split axis.
        ...strutSteps(G),
        align(G.lug, G.strutEnd, FLAP_SPLIT_NODE, FLAP_SPLIT_JOINT, outer),
        // Free lever onto its spherical hinge: swivel (spanwise), then the whole flap about x / y.
        align(G.leverEnd, G.hinge, G.leverPivot, G.swivelJoint, [G.lever]),
        align(G.leverEnd, G.hinge, F.hinge, sphX, whole),
        align(G.leverEnd, G.hinge, F.hinge, sphY, whole),
      ],
    }],
  };
}
