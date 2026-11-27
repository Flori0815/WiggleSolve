import { DefinitionError } from './build';
import type { LoopDef, MechanismDefinition, StepDef } from './schema';

/**
 * Prefixes every id (bodies, nodes, joints, actuators) and every reference to
 * them, so several generated mechanisms can be merged into one.
 */
export function prefixDefinition(def: MechanismDefinition, prefix: string): MechanismDefinition {
  const id = (s: string) => (s ? `${prefix}${s}` : s);
  const ids = (list: string[]) => list.map(id);
  const pair = ([a, b]: [string, string]): [string, string] => [id(a), id(b)];

  const step = ({ operation: op }: StepDef): StepDef => ({
    type: 'operation',
    operation: op.type === 'align_node'
      ? { ...op, effectorNode: id(op.effectorNode), targetNode: id(op.targetNode), pivotNode: id(op.pivotNode), jointId: id(op.jointId), movingBodies: ids(op.movingBodies) }
      : { ...op, joints: op.joints.map(j => ({ jointId: id(j.jointId), pivotNode: id(j.pivotNode), movingBodies: ids(j.movingBodies) })), pairs: op.pairs.map(pair) },
  });

  const loop = (l: LoopDef): LoopDef => ({
    ...l,
    condition: l.condition.type === 'distance_less_than'
      ? { ...l.condition, nodeA: id(l.condition.nodeA), nodeB: id(l.condition.nodeB) }
      : { ...l.condition, pairs: l.condition.pairs.map(pair) },
    steps: l.steps.map(step),
  });

  return {
    ...def,
    system: {
      bodies: def.system.bodies.map(b => ({
        ...b,
        id: id(b.id),
        nodes: b.nodes.map(n => ({ ...n, id: id(n.id) })),
      })),
      globalNodes: def.system.globalNodes.map(n => ({ ...n, id: id(n.id) })),
      joints: def.system.joints.map(j => ({ ...j, id: id(j.id) })),
    },
    actuators: def.actuators.map(a => ({
      ...a,
      id: id(a.id),
      pivotNode: id(a.pivotNode),
      movingBodies: ids(a.movingBodies),
      ...(a.outputs ? { outputs: a.outputs.map(o => ({ ...o, pivotNode: id(o.pivotNode), movingBodies: ids(o.movingBodies) })) } : {}),
    })),
    sequence: def.sequence.map(loop),
  };
}

/** Combines several definitions into one; ids must be unique across all parts. */
export function mergeDefinitions(name: string, description: string, parts: MechanismDefinition[]): MechanismDefinition {
  const merged: MechanismDefinition = {
    name,
    description,
    system: {
      bodies: parts.flatMap(p => p.system.bodies),
      globalNodes: parts.flatMap(p => p.system.globalNodes),
      joints: parts.flatMap(p => p.system.joints),
    },
    actuators: parts.flatMap(p => p.actuators),
    sequence: parts.flatMap(p => p.sequence),
  };
  const duplicates = (kind: string, list: string[]) =>
    [...new Set(list.filter((x, i) => list.indexOf(x) !== i))].map(x => `duplicate ${kind} id "${x}"`);
  const issues = [
    ...duplicates('body', merged.system.bodies.map(b => b.id)),
    ...duplicates('node', [...merged.system.bodies.flatMap(b => b.nodes.map(n => n.id)), ...merged.system.globalNodes.map(n => n.id)]),
    ...duplicates('joint', merged.system.joints.map(j => j.id)),
    ...duplicates('actuator', merged.actuators.map(a => a.id)),
  ];
  if (issues.length) throw new DefinitionError(issues);
  return merged;
}
