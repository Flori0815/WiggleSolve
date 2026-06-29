import { translationMat16, IDENTITY_MAT16, rotationZMat16, rotationXMat16, rotationYMat16 } from 'core-js';
import { session } from '../session';

function ok(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}

export function handleMatrixTranslation(args: { x: number; y: number; z: number }) {
  return ok(JSON.stringify(translationMat16(args.x, args.y, args.z)));
}

export function handleMatrixIdentity() {
  return ok(JSON.stringify([...IDENTITY_MAT16]));
}

export function handleMatrixRotation(args: { axis: 'x' | 'y' | 'z'; radians: number }) {
  let mat;
  switch (args.axis) {
    case 'x': mat = rotationXMat16(args.radians); break;
    case 'y': mat = rotationYMat16(args.radians); break;
    case 'z': mat = rotationZMat16(args.radians); break;
  }
  return ok(JSON.stringify(mat));
}

export function handleExplainSession() {
  const def = session.getDefinition();
  const lines: string[] = [
    `Name: ${def.name}`,
    `Description: ${def.description || '(none)'}`,
    '',
    `Bodies (${def.system.bodies.length}):`,
    ...def.system.bodies.map(b =>
      `  ${b.id}: nodes [${b.nodes.map(n => n.id).join(', ')}]`
    ),
    '',
    `Global nodes (${def.system.globalNodes.length}):`,
    ...def.system.globalNodes.map(n => {
      const t = n.absoluteTransform;
      const x = t[12]?.toFixed(3) ?? '?';
      const y = t[13]?.toFixed(3) ?? '?';
      const z = t[14]?.toFixed(3) ?? '?';
      return `  ${n.id}: position (${x}, ${y}, ${z})`;
    }),
    '',
    `Joints (${def.system.joints.length}):`,
    ...def.system.joints.map(j =>
      `  ${j.id}: ${j.type} axis=[${j.axis}] limits=[${j.limits}]`
    ),
    '',
    `Actuators (${def.actuators.length}):`,
    ...def.actuators.map(a =>
      `  ${a.id}: pivot="${a.pivotNode}" moves=[${a.movingBodies.join(', ')}]`
    ),
    '',
    `Sequence loops: ${def.sequence.length}`,
    ...def.sequence.map((loop, i) =>
      `  Loop ${i + 1}: ${loop.steps.length} step(s), max ${loop.max_iterations} iterations, converge when ${loop.condition.nodeA} within ${loop.condition.threshold} of ${loop.condition.nodeB}`
    ),
  ];
  return ok(lines.join('\n'));
}
