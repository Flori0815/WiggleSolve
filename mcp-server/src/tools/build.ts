import { session, setByPointer } from '../session';
import type { DemoBodyDef, DemoGlobalNodeDef, DemoJointDef, DemoActuatorDef, DemoLoopDef } from 'core-js';

function ok(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}
function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function handleSessionNew(args: { name?: string; description?: string }) {
  session.reset(args.name, args.description);
  return ok(`Session reset. Name: "${args.name ?? 'Untitled'}"`);
}

export function handleSessionGet() {
  return ok(JSON.stringify(session.getDefinition(), null, 2));
}

export function handleAddBody(args: { id: string; nodes: Array<{ id: string; localTransform: number[] }> }) {
  const def = session.getDefinition();
  if (def.system.bodies.find(b => b.id === args.id)) {
    return err(`Body "${args.id}" already exists.`);
  }
  const body: DemoBodyDef = { id: args.id, nodes: args.nodes };
  session.mutate(d => d.system.bodies.push(body));
  return ok(`Added body "${args.id}" with ${args.nodes.length} node(s).`);
}

export function handleAddGlobalNode(args: { id: string; absoluteTransform: number[] }) {
  const def = session.getDefinition();
  if (def.system.globalNodes.find(n => n.id === args.id)) {
    return err(`Global node "${args.id}" already exists.`);
  }
  const node: DemoGlobalNodeDef = { id: args.id, absoluteTransform: args.absoluteTransform };
  session.mutate(d => d.system.globalNodes.push(node));
  return ok(`Added global node "${args.id}".`);
}

export function handleAddJoint(args: {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: [number, number, number];
  limits: [number, number];
}) {
  const def = session.getDefinition();
  if (def.system.joints.find(j => j.id === args.id)) {
    return err(`Joint "${args.id}" already exists.`);
  }
  const joint: DemoJointDef = { id: args.id, type: args.type, axis: args.axis, limits: args.limits };
  session.mutate(d => d.system.joints.push(joint));
  return ok(`Added ${args.type} joint "${args.id}" on axis [${args.axis}], limits [${args.limits}].`);
}

export function handleAddActuator(args: {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: 'x' | 'y' | 'z';
  pivotNode: string;
  movingBodies: string[];
}) {
  const def = session.getDefinition();
  if (def.actuators.find(a => a.id === args.id)) {
    return err(`Actuator "${args.id}" already exists.`);
  }
  const actuator: DemoActuatorDef = {
    id: args.id,
    type: args.type,
    axis: args.axis,
    pivotNode: args.pivotNode,
    movingBodies: args.movingBodies,
  };
  session.mutate(d => d.actuators.push(actuator));
  return ok(`Added actuator "${args.id}" pivoting on "${args.pivotNode}", moving: [${args.movingBodies.join(', ')}].`);
}

export function handleAddSolveLoop(args: {
  max_iterations: number;
  condition: { type: 'distance_less_than'; nodeA: string; nodeB: string; threshold: number };
  steps: Array<{
    type: 'operation';
    operation: {
      type: 'align_node';
      effectorNode: string;
      targetNode: string;
      pivotNode: string;
      jointId: string;
      movingBodies: string[];
    };
  }>;
}) {
  const loop: DemoLoopDef = {
    type: 'loop',
    max_iterations: args.max_iterations,
    condition: args.condition,
    steps: args.steps,
  };
  session.mutate(d => d.sequence.push(loop));
  return ok(`Added solve loop with ${args.steps.length} step(s), max ${args.max_iterations} iterations.`);
}

export function handleUpdateValue(args: { jsonPointer: string; value: unknown }) {
  try {
    session.mutate(d => setByPointer(d, args.jsonPointer, args.value));
    return ok(`Updated ${args.jsonPointer}.`);
  } catch (e) {
    return err(`Failed to update: ${String(e)}`);
  }
}

export function handleRemoveElement(args: { type: 'body' | 'joint' | 'actuator' | 'globalNode'; id: string }) {
  session.mutate(d => {
    switch (args.type) {
      case 'body':       d.system.bodies = d.system.bodies.filter(b => b.id !== args.id); break;
      case 'joint':      d.system.joints = d.system.joints.filter(j => j.id !== args.id); break;
      case 'actuator':   d.actuators = d.actuators.filter(a => a.id !== args.id); break;
      case 'globalNode': d.system.globalNodes = d.system.globalNodes.filter(n => n.id !== args.id); break;
    }
  });
  return ok(`Removed ${args.type} "${args.id}".`);
}
