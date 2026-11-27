import { useCallback, useMemo, useState } from 'react';
import { Mechanism, safeParseDefinition } from '@wigglesolve/core';
import type { SolveResult } from '@wigglesolve/core';

export type AppMode = 'definition' | 'simulation';
export type SolverStatus =
  | { state: 'idle' }
  | { state: 'converged' }
  | { state: 'timeout' }
  | { state: 'error'; message: string };

const toStatus = (r: SolveResult): SolverStatus =>
  r.error ? { state: 'error', message: r.error } : { state: r.converged ? 'converged' : 'timeout' };

/**
 * Owns the single {@link Mechanism} instance of the app and exposes it to React.
 * Components mutate the mechanism through its API and then call `onChange`,
 * which bumps `version` so memoised views recompute.
 */
export function useMechanism() {
  const mechanism = useMemo(() => new Mechanism(), []);
  const [version, setVersion] = useState(0);
  const [mode, setMode] = useState<AppMode>('definition');
  const [status, setStatus] = useState<SolverStatus>({ state: 'idle' });
  const [loadError, setLoadError] = useState<string | null>(null);

  const bump = useCallback(() => setVersion(v => v + 1), []);

  /** Call after any edit to the mechanism. */
  const onChange = useCallback(() => {
    mechanism.refresh();
    if (mechanism.isSimulating) setStatus(toStatus(mechanism.solve()));
    bump();
  }, [mechanism, bump]);

  /** Validates and loads raw definition JSON; returns false on invalid input. */
  const load = useCallback((input: unknown): boolean => {
    const result = safeParseDefinition(input);
    if (!result.success) {
      setLoadError(result.issues.join('\n'));
      return false;
    }
    mechanism.load(result.definition);
    setLoadError(null);
    setMode('definition');
    setStatus({ state: 'idle' });
    bump();
    return true;
  }, [mechanism, bump]);

  const switchMode = useCallback((next: AppMode) => {
    if (next === mode) return;
    if (next === 'simulation') {
      setStatus(toStatus(mechanism.startSimulation()));
    } else {
      mechanism.stopSimulation();
      setStatus({ state: 'idle' });
    }
    setMode(next);
    bump();
  }, [mechanism, mode, bump]);

  /** Drives an actuator (simulation mode only) and re-solves. */
  const drive = useCallback((actuatorId: string, value: number) => {
    if (!mechanism.isSimulating) return;
    setStatus(toStatus(mechanism.drive(actuatorId, value)));
    bump();
  }, [mechanism, bump]);

  const dismissLoadError = useCallback(() => setLoadError(null), []);

  return { mechanism, version, mode, status, loadError, dismissLoadError, onChange, load, switchMode, drive };
}
