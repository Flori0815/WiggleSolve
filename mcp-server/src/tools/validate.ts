import {
  DemoDefinitionSchema,
  KinematicSystem,
  Node,
  RigidBody,
  Joint,
  Matrix4x4,
  Executor,
  assembleKinematicChain,
} from 'core-js';
import type { Instruction } from 'core-js';
import type { Operation } from 'core-js';
import type { Condition } from 'core-js';
import { session } from '../session';

function ok(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}
function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

function matrixFromArray(arr: number[]): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = new Float32Array(arr);
  return m;
}

function parseInstruction(raw: Record<string, unknown>): Instruction {
  if (raw['type'] === 'operation') {
    const op = raw['operation'] as Record<string, unknown>;
    return {
      type: 'operation',
      operation: {
        type: op['type'],
        effectorNode: op['effectorNode'],
        targetNode: op['targetNode'],
        pivotNode: op['pivotNode'],
        jointId: op['jointId'],
        movingBodies: op['movingBodies'],
      } as Operation,
    };
  }
  if (raw['type'] === 'loop') {
    const cond = raw['condition'] as Record<string, unknown>;
    return {
      type: 'loop',
      max_iterations: raw['max_iterations'] as number,
      condition: {
        type: cond['type'],
        nodeA: cond['nodeA'],
        nodeB: cond['nodeB'],
        threshold: cond['threshold'],
      } as Condition,
      steps: (raw['steps'] as Record<string, unknown>[]).map(parseInstruction),
    };
  }
  throw new Error(`Unknown instruction type: ${raw['type']}`);
}

export function handleValidateDefinition() {
  const def = session.getDefinition();
  const result = DemoDefinitionSchema.safeParse(def);
  if (result.success) {
    return ok('Definition is valid.');
  }
  const issues = result.error.issues.map(i => `  [${i.path.join('.')}] ${i.message}`).join('\n');
  return err(`Validation errors:\n${issues}`);
}

export function handleTestSolve(args: { target_position?: [number, number, number] }) {
  const def = session.getDefinition();
  const parseResult = DemoDefinitionSchema.safeParse(def);
  if (!parseResult.success) {
    return err('Definition is not yet valid — run validate_definition first.');
  }

  const validated = parseResult.data;

  if (args.target_position) {
    const tgt = validated.system.globalNodes.find(n => n.id === 'target');
    if (tgt) {
      const [x, y, z] = args.target_position;
      tgt.absoluteTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    }
  }

  const system = new KinematicSystem();

  for (const bodyDef of validated.system.bodies) {
    const body = new RigidBody(bodyDef.id);
    for (const nodeDef of bodyDef.nodes) {
      const node = new Node(nodeDef.id);
      node.localTransform = matrixFromArray(nodeDef.localTransform);
      body.addNode(node);
    }
    system.addBody(body);
  }

  for (const nodeDef of validated.system.globalNodes) {
    const node = new Node(nodeDef.id);
    node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
    system.addNode(node);
  }

  for (const jointDef of validated.system.joints) {
    const joint = new Joint(
      jointDef.id,
      jointDef.type,
      jointDef.axis as [number, number, number],
      0,
      jointDef.limits as [number, number],
    );
    system.addJoint(joint);
  }

  assembleKinematicChain(system, validated.actuators);
  system.updateForwardKinematics();

  const sequence = (validated.sequence as unknown as Record<string, unknown>[]).map(parseInstruction);
  const executor = new Executor(system);
  const converged = executor.execute(sequence);

  const jointValues: Record<string, number> = {};
  for (const [id, joint] of system.joints.entries()) {
    jointValues[id] = joint.value;
  }

  const nodePositions: Record<string, [number, number, number]> = {};
  for (const [id, node] of system.nodes.entries()) {
    nodePositions[id] = node.absoluteTransform.getTranslation();
  }

  return ok(JSON.stringify({ converged, jointValues, nodePositions }, null, 2));
}

export function handleListNodePositions() {
  const def = session.getDefinition();
  const parseResult = DemoDefinitionSchema.safeParse(def);
  if (!parseResult.success) {
    return err('Definition is not yet valid.');
  }

  const validated = parseResult.data;
  const system = new KinematicSystem();

  for (const bodyDef of validated.system.bodies) {
    const body = new RigidBody(bodyDef.id);
    for (const nodeDef of bodyDef.nodes) {
      const node = new Node(nodeDef.id);
      node.localTransform = matrixFromArray(nodeDef.localTransform);
      body.addNode(node);
    }
    system.addBody(body);
  }

  for (const nodeDef of validated.system.globalNodes) {
    const node = new Node(nodeDef.id);
    node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
    system.addNode(node);
  }

  assembleKinematicChain(system, validated.actuators);
  system.updateForwardKinematics();

  const positions: Record<string, [number, number, number]> = {};
  for (const [id, node] of system.nodes.entries()) {
    positions[id] = node.absoluteTransform.getTranslation();
  }

  return ok(JSON.stringify(positions, null, 2));
}
