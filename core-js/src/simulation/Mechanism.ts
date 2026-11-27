import { buildSequence, buildSystem, copyActuator, parseDefinition } from '../definition/build';
import { axisVector } from '../math/axis';
import { serializeDefinition } from '../definition/serialize';
import type { ActuatorDef, MechanismDefinition } from '../definition/schema';
import { Joint } from '../elements/Joint';
import { Executor } from '../solver/Executor';
import { operationJointIds } from '../solver/operations';
import type { Instruction } from '../solver/Executor';
import { KinematicSystem } from '../system/KinematicSystem';
import { captureSnapshot, restoreSnapshot } from '../system/snapshot';
import type { SystemSnapshot } from '../system/snapshot';
import { applyJointDelta } from '../system/utils';

/** Outcome of running the solving sequence. */
export interface SolveResult {
  converged: boolean;
  /** Set when the sequence could not run (e.g. it references a missing node). */
  error?: string;
  /** When not converged: solver joints that ended at one of their limits (likely cause). */
  jointsAtLimit?: string[];
}

export type ElementKind = 'node' | 'body' | 'actuator';

type LoopInstruction = Extract<Instruction, { type: 'loop' }>;

/** Slider range used when an actuator has no (finite) joint limits. */
export const DEFAULT_DRIVE_RANGE = {
  revolute: [-Math.PI, Math.PI] as [number, number],
  prismatic: [-1, 1] as [number, number],
};

/**
 * A complete, runnable mechanism: the kinematic system plus its actuators
 * (manual drives) and solving sequence.
 *
 * Lifecycle: edit the definition freely, call {@link startSimulation} to
 * freeze it, then {@link drive} actuators; {@link stopSimulation} returns to
 * the exact definition pose.
 */
export class Mechanism {
  readonly system: KinematicSystem;
  name = 'Untitled';
  description = '';
  actuators: ActuatorDef[] = [];
  sequence: Instruction[] = [];

  private driveValues = new Map<string, number>();
  private definitionSnapshot: SystemSnapshot | null = null;

  constructor(system = new KinematicSystem()) {
    this.system = system;
  }

  /** Validates raw JSON and builds a new mechanism from it. */
  static fromDefinition(input: unknown): Mechanism {
    const mechanism = new Mechanism();
    mechanism.load(parseDefinition(input));
    return mechanism;
  }

  /** Replaces the whole mechanism in place with a validated definition. */
  load(def: MechanismDefinition): void {
    buildSystem(def, this.system);
    this.name = def.name;
    this.description = def.description;
    this.actuators = def.actuators.map(copyActuator);
    this.sequence = buildSequence(def.sequence);
    this.driveValues.clear();
    this.definitionSnapshot = null;
  }

  toDefinition(): MechanismDefinition {
    return serializeDefinition(this, this.system, this.actuators, this.sequence);
  }

  // ── Actuators ──────────────────────────────────────────────────────────────

  getActuator(id: string): ActuatorDef | undefined {
    return this.actuators.find(a => a.id === id);
  }

  /** Drive range: the limits of the joint sharing the actuator's id, if finite. */
  getActuatorLimits(id: string): [number, number] {
    const actuator = this.getActuator(id);
    const fallback = DEFAULT_DRIVE_RANGE[actuator?.type ?? 'revolute'];
    const limits = this.system.joints.get(id)?.limits;
    if (!limits) return [...fallback];
    return [
      Number.isFinite(limits[0]) ? limits[0] : fallback[0],
      Number.isFinite(limits[1]) ? limits[1] : fallback[1],
    ];
  }

  /**
   * Sets the drive range of an actuator by writing the limits of the joint that
   * shares its id (creating that joint if needed).
   */
  setActuatorLimits(id: string, limits: [number, number]): void {
    const actuator = this.getActuator(id);
    if (!actuator) throw new Error(`Unknown actuator "${id}"`);
    const ordered: [number, number] = [Math.min(...limits), Math.max(...limits)];
    const joint = this.system.joints.get(id);
    if (joint) joint.limits = ordered;
    else this.system.addJoint(new Joint(id, actuator.type, axisVector(actuator.axis), 0, ordered));
  }

  getActuatorValue(id: string): number {
    return this.driveValues.get(id) ?? 0;
  }

  /**
   * Moves an actuator to an absolute value (clamped to its limits) by rigidly
   * transforming its moving bodies about its pivot, and every additional output
   * about its own pivot (scaled by its ratio). Returns the applied value.
   */
  setActuatorValue(id: string, value: number): number {
    const actuator = this.getActuator(id);
    if (!actuator) throw new Error(`Unknown actuator "${id}"`);
    const pivot = this.system.nodes.get(actuator.pivotNode);
    const [lo, hi] = this.getActuatorLimits(id);
    const target = Math.max(lo, Math.min(hi, value));
    if (!pivot) return this.getActuatorValue(id);

    const driveJoint = new Joint(id, actuator.type, axisVector(actuator.axis));
    const delta = target - this.getActuatorValue(id);
    const bodiesOf = (ids: string[]) => ids.map(bodyId => this.system.bodies.get(bodyId)).filter(b => b !== undefined);
    applyJointDelta(driveJoint, pivot, bodiesOf(actuator.movingBodies), delta);
    for (const output of actuator.outputs ?? []) {
      const outputPivot = this.system.nodes.get(output.pivotNode);
      if (outputPivot) applyJointDelta(driveJoint, outputPivot, bodiesOf(output.movingBodies), delta * (output.ratio ?? 1));
    }
    this.driveValues.set(id, target);
    return target;
  }

  /** Runs the solving sequence. Never throws: errors are reported in the result. */
  solve(): SolveResult {
    try {
      if (new Executor(this.system).execute(this.sequence)) return { converged: true };
      return { converged: false, jointsAtLimit: this.solverJointsAtLimit() };
    } catch (e) {
      return { converged: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  private solverJointsAtLimit(): string[] {
    const ids = new Set<string>();
    const collect = (list: Instruction[]) => list.forEach(i => {
      if (i.type === 'loop') collect(i.steps); else operationJointIds(i.operation).forEach(id => ids.add(id));
    });
    collect(this.sequence);
    return [...ids].filter(id => {
      const joint = this.system.joints.get(id);
      return joint !== undefined && joint.limits.some(limit => Math.abs(joint.value - limit) < 1e-9);
    });
  }

  /** Sets an actuator and re-solves the dependent constraints. */
  drive(id: string, value: number): SolveResult {
    this.setActuatorValue(id, value);
    return this.solve();
  }

  // ── Definition ↔ simulation ──────────────────────────────────────────────

  get isSimulating(): boolean {
    return this.definitionSnapshot !== null;
  }

  /** Freezes the current definition pose so it can be restored later. */
  startSimulation(): SolveResult {
    this.definitionSnapshot = captureSnapshot(this.system);
    this.driveValues.clear();
    return this.solve();
  }

  /** Returns to the pose captured by {@link startSimulation}. */
  stopSimulation(): void {
    if (this.definitionSnapshot) restoreSnapshot(this.system, this.definitionSnapshot);
    this.definitionSnapshot = null;
    this.driveValues.clear();
  }

  // ── Editing ────────────────────────────────────────────────────────────────

  /** Returns why `id` cannot name a new element of `kind`, or null if it can. */
  validateNewId(kind: ElementKind, id: string): string | null {
    const trimmed = id.trim();
    if (!trimmed) return 'ID cannot be empty';
    if (trimmed !== id) return 'ID cannot start or end with whitespace';
    const taken =
      kind === 'node' ? this.system.nodes.has(id)
      : kind === 'body' ? this.system.bodies.has(id)
      : this.getActuator(id) !== undefined;
    return taken ? `${kind[0].toUpperCase()}${kind.slice(1)} '${id}' already exists` : null;
  }

  addActuator(id: string): ActuatorDef {
    const actuator: ActuatorDef = { id, type: 'revolute', axis: 'z', pivotNode: '', movingBodies: [] };
    this.actuators.push(actuator);
    return actuator;
  }

  removeActuator(id: string): void {
    this.actuators = this.actuators.filter(a => a.id !== id);
    this.driveValues.delete(id);
  }

  /** Appends an empty convergence loop to the sequence. */
  addLoop(): LoopInstruction {
    const loop: LoopInstruction = {
      type: 'loop',
      max_iterations: 100,
      condition: { type: 'distance_less_than', nodeA: '', nodeB: '', threshold: 0.01 },
      steps: [],
    };
    this.sequence.push(loop);
    return loop;
  }

  /** Appends an align step to a loop, backed by a new revolute joint. */
  addAlignStep(loop: LoopInstruction): Joint {
    let n = this.system.joints.size + 1;
    while (this.system.joints.has(`joint_${n}`)) n++;
    const joint = new Joint(`joint_${n}`, 'revolute', [0, 0, 1], 0, [...DEFAULT_DRIVE_RANGE.revolute]);
    this.system.addJoint(joint);
    loop.steps.push({
      type: 'operation',
      operation: { type: 'align_node', effectorNode: '', targetNode: '', pivotNode: '', jointId: joint.id, movingBodies: [] },
    });
    return joint;
  }

  /** Re-applies LookAt alignments (definition phase) and forward kinematics. */
  refresh(): void {
    if (!this.isSimulating) {
      for (const id of this.system.nodes.keys()) this.system.solveNodeAlignment(id);
    }
    this.system.updateForwardKinematics();
  }
}
