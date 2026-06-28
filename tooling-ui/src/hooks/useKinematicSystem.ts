import { useState, useMemo, useCallback, useRef } from 'react';
import { KinematicSystem, Node, RigidBody, Matrix4x4 } from 'core-js/src/index';
import { cloneSystemState, restoreSystemState } from '../utils/kinematicHelpers';

export function useKinematicSystem() {
  const [version, setVersion] = useState(0);
  const [appMode, setAppMode] = useState<'definition' | 'solved'>('definition');
  const [solverStatus, setSolverStatus] = useState<'idle' | 'converged' | 'timeout'>('idle');
  const definitionStateRef = useRef<ReturnType<typeof cloneSystemState> | null>(null);
  const lastActuatorValues = useRef<Record<string, number>>({});

  const system = useMemo(() => {
    const s = new KinematicSystem();
    const target = new Node('target');
    target.absoluteTransform = new Matrix4x4().translate(1, 1, 0);
    s.addNode(target);
    const base = new RigidBody('base_body');
    const pivot = new Node('pivot');
    pivot.alignment = { primaryAxis: 'x', primaryTarget: 'target', secondaryAxis: null, secondaryTarget: null };
    base.addNode(pivot);
    const arm = new RigidBody('arm_body');
    const tip = new Node('arm_end');
    tip.localTransform = new Matrix4x4().translate(0.5, 0, 0);
    arm.addNode(tip);
    s.addBody(base);
    s.addBody(arm);
    s.updateForwardKinematics();
    return s;
  }, []);

  const tick = useCallback(() => {
    if (appMode === 'definition') {
      system.nodes.forEach(n => system.solveNodeAlignment(n.id));
    }
    system.updateForwardKinematics();
    setVersion(v => v + 1);
  }, [system, appMode]);

  const toggleMode = useCallback(() => {
    if (appMode === 'definition') {
      definitionStateRef.current = cloneSystemState(system);
      setAppMode('solved');
    } else {
      if (definitionStateRef.current) restoreSystemState(system, definitionStateRef.current);
      lastActuatorValues.current = {};
      setSolverStatus('idle');
      setAppMode('definition');
    }
    setVersion(v => v + 1);
  }, [appMode, system]);

  return {
    system,
    version,
    setVersion,
    appMode,
    setAppMode,
    solverStatus,
    setSolverStatus,
    tick,
    toggleMode,
    definitionStateRef,
    lastActuatorValues,
  };
}
