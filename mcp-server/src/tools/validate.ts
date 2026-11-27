import { buildSystem, Mechanism, safeParseDefinition } from '@wigglesolve/core';
import type { KinematicSystem } from '@wigglesolve/core';
import { session } from '../session';
import { err, ok } from './result';

function nodePositions(system: KinematicSystem): Record<string, [number, number, number]> {
  return Object.fromEntries([...system.nodes].map(([id, n]) => [id, n.absoluteTransform.getTranslation()]));
}

export function handleValidateDefinition() {
  const result = safeParseDefinition(session.getDefinition());
  if (result.success) return ok('Definition is valid.');
  return err(`Validation errors:\n${result.issues.map(i => `  ${i}`).join('\n')}`);
}

export function handleTestSolve(args: { target_position?: [number, number, number] }) {
  const result = safeParseDefinition(session.getDefinition());
  if (!result.success) return err('Definition is not yet valid — run validate_definition first.');

  const definition = result.definition;
  if (args.target_position) {
    const target = definition.system.globalNodes.find(n => n.id === 'target');
    if (target) {
      const [x, y, z] = args.target_position;
      target.absoluteTransform = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
    }
  }

  const mechanism = new Mechanism();
  mechanism.load(definition);
  const { converged, error } = mechanism.solve();
  if (error) return err(`Solve failed: ${error}`);
  const jointValues = Object.fromEntries([...mechanism.system.joints].map(([id, j]) => [id, j.value]));

  return ok(JSON.stringify({ converged, jointValues, nodePositions: nodePositions(mechanism.system) }, null, 2));
}

export function handleListNodePositions() {
  const result = safeParseDefinition(session.getDefinition());
  if (!result.success) return err('Definition is not yet valid.');
  return ok(JSON.stringify(nodePositions(buildSystem(result.definition)), null, 2));
}
