import { Joint } from '../elements/Joint';
import { Node } from '../elements/Node';
import { RigidBody } from '../elements/RigidBody';
import { Matrix4x4 } from '../math/Matrix4x4';
import type { Instruction } from '../solver/Executor';
import { copyCondition } from '../solver/conditions';
import { copyOperation } from '../solver/operations';
import { KinematicSystem } from '../system/KinematicSystem';
import { assembleKinematicChain } from './assembly';
import { MechanismDefinitionSchema } from './schema';
import type { ActuatorDef, MechanismDefinition, LoopDef } from './schema';

/** Raised when a definition does not match {@link MechanismDefinitionSchema}. */
export class DefinitionError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid mechanism definition:\n${issues.map(i => `  ${i}`).join('\n')}`);
    this.name = 'DefinitionError';
    this.issues = issues;
  }
}

export type ParseResult =
  | { success: true; definition: MechanismDefinition }
  | { success: false; issues: string[] };

/** Validates raw JSON against the schema without throwing. */
export function safeParseDefinition(input: unknown): ParseResult {
  const result = MechanismDefinitionSchema.safeParse(input);
  if (result.success) return { success: true, definition: result.data };
  return {
    success: false,
    issues: result.error.issues.map(i => `[${i.path.join('.') || '<root>'}] ${i.message}`),
  };
}

/** Validates raw JSON against the schema; throws {@link DefinitionError}. */
export function parseDefinition(input: unknown): MechanismDefinition {
  const result = safeParseDefinition(input);
  if (!result.success) throw new DefinitionError(result.issues);
  return result.definition;
}

export function matrixFromArray(arr: ArrayLike<number>): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = Float32Array.from(arr);
  return m;
}

/**
 * Builds the bodies, nodes and joints of a definition into `system`
 * (which is cleared first) and runs the initial assembly.
 */
export function buildSystem(def: MechanismDefinition, system = new KinematicSystem()): KinematicSystem {
  system.clear();
  const explicitlyPlaced = new Set<string>();

  for (const bodyDef of def.system.bodies) {
    const body = new RigidBody(bodyDef.id);
    if (bodyDef.transform) {
      body.transform = matrixFromArray(bodyDef.transform);
      explicitlyPlaced.add(bodyDef.id);
    }
    body.visuals = (bodyDef.visuals ?? []).map(v => ({ ...v, vertices: [...v.vertices], indices: [...v.indices] }));
    for (const nodeDef of bodyDef.nodes) {
      const node = new Node(nodeDef.id);
      node.localTransform = matrixFromArray(nodeDef.localTransform);
      body.addNode(node);
    }
    system.addBody(body);
  }

  for (const nodeDef of def.system.globalNodes) {
    const node = new Node(nodeDef.id);
    node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
    system.addNode(node);
  }

  for (const j of def.system.joints) {
    system.addJoint(new Joint(j.id, j.type, [...j.axis], 0, [...j.limits]));
  }

  assembleKinematicChain(system, def.actuators, explicitlyPlaced);
  system.updateForwardKinematics();
  return system;
}

/** Deep copy of an actuator definition. */
export function copyActuator(a: ActuatorDef): ActuatorDef {
  return {
    ...a,
    movingBodies: [...a.movingBodies],
    ...(a.outputs ? { outputs: a.outputs.map(o => ({ ...o, movingBodies: [...o.movingBodies] })) } : {}),
  };
}

/** Deep-copies a definition's sequence into executable instructions. */
export function buildSequence(loops: LoopDef[]): Instruction[] {
  return loops.map(loop => ({
    type: 'loop',
    max_iterations: loop.max_iterations,
    condition: copyCondition(loop.condition),
    steps: loop.steps.map(step => ({
      type: 'operation',
      operation: copyOperation(step.operation),
    })),
  }));
}
