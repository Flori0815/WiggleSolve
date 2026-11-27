import * as fs from 'fs';
import { Mechanism } from '@wigglesolve/core';

export interface SolveResult {
  converged: boolean;
  jointValues: Record<string, number>;
  nodePositions: Record<string, [number, number, number]>;
}

/** Loads a definition file, runs its sequence once and reports the result. */
export function loadAndRun(definitionPath: string): SolveResult {
  const mechanism = Mechanism.fromDefinition(JSON.parse(fs.readFileSync(definitionPath, 'utf8')));
  const { converged, error } = mechanism.solve();
  if (error) throw new Error(error);
  const { joints, nodes } = mechanism.system;
  return {
    converged,
    jointValues: Object.fromEntries([...joints].map(([id, j]) => [id, j.value])),
    nodePositions: Object.fromEntries([...nodes].map(([id, n]) => [id, n.absoluteTransform.getTranslation()])),
  };
}
