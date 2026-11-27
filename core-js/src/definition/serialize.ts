import type { Matrix4x4 } from '../math/Matrix4x4';
import type { Instruction } from '../solver/Executor';
import { copyCondition } from '../solver/conditions';
import { copyOperation } from '../solver/operations';
import type { KinematicSystem } from '../system/KinematicSystem';
import { copyActuator, DefinitionError } from './build';
import type { ActuatorDef, LoopDef, MechanismDefinition } from './schema';

const UNBOUNDED = 1e6;

const round = (v: number) => Math.round(v * 1e6) / 1e6 || 0;
const toArray = (m: Matrix4x4) => Array.from(m.elements, round);
const finite = (v: number) => (Number.isFinite(v) ? round(v) : Math.sign(v) * UNBOUNDED);

function serializeSequence(sequence: Instruction[]): LoopDef[] {
  return sequence.map((instr, i) => {
    if (instr.type !== 'loop') {
      throw new DefinitionError([`[sequence.${i}] top-level instructions must be loops`]);
    }
    return {
      type: 'loop',
      max_iterations: instr.max_iterations,
      condition: copyCondition(instr.condition),
      steps: instr.steps.map((step, j) => {
        if (step.type !== 'operation') {
          throw new DefinitionError([`[sequence.${i}.steps.${j}] nested loops are not serialisable`]);
        }
        return { type: 'operation', operation: copyOperation(step.operation) };
      }),
    };
  });
}

/**
 * Converts a live system back into the JSON interchange format. Body placements
 * are written explicitly so the definition reloads in exactly this pose.
 * Infinite joint limits are written as ±1e6 because JSON has no Infinity.
 */
export function serializeDefinition(
  meta: { name: string; description: string },
  system: KinematicSystem,
  actuators: ActuatorDef[],
  sequence: Instruction[],
): MechanismDefinition {
  const bodyNodeIds = new Set<string>();
  const bodies = [...system.bodies.values()].map(body => ({
    id: body.id,
    transform: toArray(body.transform),
    nodes: [...body.nodes.values()].map(node => {
      bodyNodeIds.add(node.id);
      return { id: node.id, localTransform: toArray(node.localTransform) };
    }),
    ...(body.visuals.length ? { visuals: body.visuals.map(v => ({ ...v })) } : {}),
  }));

  const globalNodes = [...system.nodes.values()]
    .filter(node => !bodyNodeIds.has(node.id))
    .map(node => ({ id: node.id, absoluteTransform: toArray(node.absoluteTransform) }));

  const joints = [...system.joints.values()]
    .filter((j): j is typeof j & { type: 'revolute' | 'prismatic' } => j.type !== 'fixed')
    .map(j => ({
      id: j.id,
      type: j.type,
      axis: j.axis.map(round) as [number, number, number],
      limits: [finite(j.limits[0]), finite(j.limits[1])] as [number, number],
    }));

  return {
    name: meta.name,
    description: meta.description,
    system: { bodies, globalNodes, joints },
    actuators: actuators.map(copyActuator),
    sequence: serializeSequence(sequence),
  };
}
