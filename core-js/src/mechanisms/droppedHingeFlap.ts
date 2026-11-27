import { IDENTITY_MAT16, rotationZMat16, translationMat16 } from '../math/matrixHelpers';
import type {
  ActuatorDef,
  BodyDef,
  JointDef,
  LoopDef,
  MechanismDefinition,
  StepDef,
} from '../definition/schema';

/**
 * Dropped-hinge trailing-edge flap.
 *
 * Coordinate system: x = chordwise aft, y = up, z = spanwise outboard.
 * All profile points are given in the support plane (x, y) and are identical
 * at every support station.
 *
 * Kinematics per support: a rotary actuator (geared rotary actuator, GRA)
 * turns a crank about a spanwise axis; a drive strut connects the crank tip to
 * a lug on the flap; the flap rotates about the dropped hinge — a four-bar
 * linkage closed by a solver loop.
 *
 * The flap is split at `splitStation` into two panels, one per support. The
 * panels are coupled spanwise at the split but free to rotate relative to each
 * other about the hinge axis, so each actuator positions its own panel and two
 * actuators never fight over one rigid flap. One support is spanwise fixed,
 * the other spanwise free (a prismatic degree of freedom along the hinge axis);
 * the free panel takes its spanwise position from the split coupling.
 */
export interface DroppedHingeFlapParams {
  name: string;
  description: string;
  /** Spanwise extent of the flap [root, tip]. */
  span: [number, number];
  /** Spanwise station of the split between the two panels. */
  splitStation: number;
  /** Exactly two supports, one per panel; exactly one spanwise fixed. */
  supports: [SupportSpec, SupportSpec];
  /** Hinge point in the support plane. */
  hinge: Point2;
  /** Drive-strut attachment lug on the flap. */
  lug: Point2;
  /** Flap leading and trailing edge in the support plane. */
  leadingEdge: Point2;
  trailingEdge: Point2;
  /** Rotary actuator output axis in the support plane. */
  actuatorAxis: Point2;
  /** Crank length and its reference direction (rad, 0 = pointing down, positive about +z). */
  crankLength: number;
  crankAngle: number;
  /** Actuator travel [min, max] in rad relative to the reference pose. */
  driveRange: [number, number];
  /** Admissible flap rotation [min, max] in rad (negative = trailing edge down). */
  flapRange: [number, number];
  /** Spanwise travel of the free support [min, max]. */
  spanwiseTravel: [number, number];
  /** Out-of-plane tilt of the drive strut allowed by its rod ends [min, max] in rad. */
  strutTilt: [number, number];
  /** Loop convergence tolerance (length units). */
  tolerance: number;
}

export interface SupportSpec {
  station: number;
  spanwise: 'fixed' | 'free';
}

export type Point2 = [number, number];

const DEG = Math.PI / 180;

export const DROPPED_HINGE_FLAP_DEFAULTS: DroppedHingeFlapParams = {
  name: 'Dropped-Hinge Flap',
  description:
    'Split trailing-edge flap on a dropped hinge with two supports (inboard spanwise fixed, outboard spanwise free). '
    + 'Each support has a rotary actuator driving its panel through a crank and drive strut; the panels rotate '
    + 'independently about the hinge axis, so the two actuators never over-constrain the flap.',
  span: [0, 3],
  splitStation: 1.5,
  supports: [
    { station: 0.75, spanwise: 'fixed' },
    { station: 2.25, spanwise: 'free' },
  ],
  hinge: [0.6, -0.3],
  lug: [0.55, -0.15],
  leadingEdge: [0.45, -0.05],
  trailingEdge: [1.45, -0.12],
  actuatorAxis: [0.15, -0.05],
  crankLength: 0.15,
  crankAngle: 0,
  driveRange: [0, 60 * DEG],
  flapRange: [-70 * DEG, 10 * DEG],
  spanwiseTravel: [-0.05, 0.05],
  strutTilt: [-10 * DEG, 10 * DEG],
  tolerance: 1e-4,
};

/** Ids of the generated elements for support / panel `i` (1-based). */
export const flapIds = (i: number) => ({
  support: `support_${i}`,
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
  panel: `flap_${i}_panel`,
  bracket: `flap_${i}_bracket`,
  hingeLine: `flap_${i}_hingeline`,
  lug: `flap_${i}_lug`,
  flapHinge: `flap_${i}_hinge`,
  flapJoint: `flap_${i}_rot`,
  axisSplit: `flap_${i}_axis_split`,
  axisEnd: `flap_${i}_axis_end`,
  slideJoint: `support_${i}_slide`,
});

const at = ([x, y]: Point2, z: number) => translationMat16(x, y, z);
const node = (id: string, p: Point2, z: number) => ({ id, localTransform: at(p, z) });
/** Frame at `p` whose x axis points along `dir` in the support plane. */
const frameAlong = (id: string, p: Point2, z: number, dir: Point2) => {
  const m = rotationZMat16(Math.atan2(dir[1], dir[0]));
  m[12] = p[0];
  m[13] = p[1];
  m[14] = z;
  return { id, localTransform: m };
};
const body = (id: string, nodes: BodyDef['nodes']): BodyDef => ({ id, transform: [...IDENTITY_MAT16], nodes });

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
  const crankTip: Point2 = [
    p.actuatorAxis[0] + p.crankLength * Math.sin(p.crankAngle),
    p.actuatorAxis[1] - p.crankLength * Math.cos(p.crankAngle),
  ];
  const panels: Array<[number, number]> = [[root, p.splitStation], [p.splitStation, tip]];

  const bodies: BodyDef[] = [body('wing_spar', [node('spar_root', [0, 0], root), node('spar_tip', [0, 0], tip)])];
  const joints: JointDef[] = [];
  const actuators: ActuatorDef[] = [];
  const supportLoops: LoopDef[] = [];

  const align = (o: Omit<StepDef['operation'], 'type'>): StepDef => ({ type: 'operation', operation: { type: 'align_node', ...o } });

  p.supports.forEach((support, index) => {
    const i = index + 1;
    const id = flapIds(i);
    const z = support.station;
    const [zIn, zOut] = panels[index];
    const zSplit = p.splitStation;
    const zEnd = index === 0 ? zIn : zOut;
    const flapBodies = [id.panel, id.bracket, id.hingeLine];

    bodies.push(
      body(id.support, [node(`${id.support}_spar`, [0, 0], z), node(id.hinge, p.hinge, z), node(id.actuatorAxis, p.actuatorAxis, z)]),
      body(id.crank, [node(`${id.crank}_root`, p.actuatorAxis, z), node(id.crankTip, crankTip, z)]),
      // The strut-top frame is aligned with the strut so that its local y axis is
      // the rod-end tilt axis (perpendicular to the strut and the hinge axis).
      body(id.strut, [
        frameAlong(id.strutTop, crankTip, z, [p.lug[0] - crankTip[0], p.lug[1] - crankTip[1]]),
        node(id.strutEnd, p.lug, z),
      ]),
      body(id.panel, [
        node(`flap_${i}_le_in`, p.leadingEdge, zIn),
        node(`flap_${i}_te_in`, p.trailingEdge, zIn),
        node(`flap_${i}_te_out`, p.trailingEdge, zOut),
        node(`flap_${i}_le_out`, p.leadingEdge, zOut),
      ]),
      body(id.bracket, [node(id.flapHinge, p.hinge, z), node(id.lug, p.lug, z)]),
      body(id.hingeLine, [node(id.axisEnd, p.hinge, zEnd), node(id.axisSplit, p.hinge, zSplit)]),
    );

    joints.push(
      { id: id.actuator, type: 'revolute', axis: [0, 0, 1], limits: [...p.driveRange] },
      { id: id.strutJoint, type: 'revolute', axis: [0, 0, 1], limits: [-Math.PI, Math.PI] },
      { id: id.strutTiltJoint, type: 'revolute', axis: [0, 1, 0], limits: [...p.strutTilt] },
      { id: id.flapJoint, type: 'revolute', axis: [0, 0, 1], limits: [...p.flapRange] },
    );

    actuators.push({
      id: id.actuator,
      type: 'revolute',
      axis: 'z',
      pivotNode: id.actuatorAxis,
      movingBodies: [id.crank, id.strut],
    });

    // Close the four-bar: swing the strut onto the lug (in plane, then out of
    // plane via its rod ends), then the panel onto the strut.
    supportLoops.push({
      type: 'loop',
      max_iterations: 500,
      condition: { type: 'distance_less_than', nodeA: id.strutEnd, nodeB: id.lug, threshold: p.tolerance },
      steps: [
        align({ effectorNode: id.strutEnd, targetNode: id.lug, pivotNode: id.strutTop, jointId: id.strutJoint, movingBodies: [id.strut] }),
        align({ effectorNode: id.strutEnd, targetNode: id.lug, pivotNode: id.strutTop, jointId: id.strutTiltJoint, movingBodies: [id.strut] }),
        align({ effectorNode: id.lug, targetNode: id.strutEnd, pivotNode: id.hinge, jointId: id.flapJoint, movingBodies: flapBodies }),
      ],
    });
  });

  // Spanwise coupling at the split (solved first): the panel on the free
  // support slides along the hinge axis until its split point meets the fixed
  // panel's split point. Split points lie on the hinge axis, so panel rotation
  // never affects this loop.
  const free = p.supports.findIndex(s => s.spanwise === 'free') + 1;
  const fixed = 3 - free;
  const f = flapIds(free);
  joints.push({ id: f.slideJoint, type: 'prismatic', axis: [0, 0, 1], limits: [...p.spanwiseTravel] });
  const couplingLoop: LoopDef = {
    type: 'loop',
    max_iterations: 100,
    condition: { type: 'distance_less_than', nodeA: f.axisSplit, nodeB: flapIds(fixed).axisSplit, threshold: p.tolerance },
    steps: [
      align({ effectorNode: f.axisSplit, targetNode: flapIds(fixed).axisSplit, pivotNode: f.hinge, jointId: f.slideJoint, movingBodies: [f.panel, f.bracket, f.hingeLine] }),
    ],
  };

  return {
    name: p.name,
    description: p.description,
    system: { bodies, globalNodes: [], joints },
    actuators,
    sequence: [couplingLoop, ...supportLoops],
  };
}
