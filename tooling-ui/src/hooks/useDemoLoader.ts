import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import { Node, RigidBody, Joint, KinematicSystem } from 'core-js/src/index';
import type { Instruction } from 'core-js/src/index';
import { DEMOS } from '../demos/index';
import type { DemoDefinition } from '../demos/index';
import { DemoDefinitionSchema } from '../schema';
import { matrixFromArray, assembleKinematicChain, cloneSystemState } from '../utils/kinematicHelpers';
import type { UIActuator } from '../types';

type DemoLoaderDeps = {
  system: KinematicSystem;
  sequence: Instruction[];
  setActuators: (a: Record<string, UIActuator>) => void;
  setAppMode: (m: 'definition' | 'solved') => void;
  setSolverStatus: (s: 'idle' | 'converged' | 'timeout') => void;
  setVersion: (fn: (v: number) => number) => void;
  lastActuatorValues: MutableRefObject<Record<string, number>>;
  definitionStateRef: MutableRefObject<ReturnType<typeof cloneSystemState> | null>;
  onLoad?: () => void;
};

export function useDemoLoader({
  system,
  sequence,
  setActuators,
  setAppMode,
  setSolverStatus,
  setVersion,
  lastActuatorValues,
  definitionStateRef,
  onLoad,
}: DemoLoaderDeps) {
  const [selectedDemo, setSelectedDemo] = useState('');

  const loadDemo = useCallback((def: DemoDefinition) => {
    const result = DemoDefinitionSchema.safeParse(def);
    if (!result.success) {
      console.error('Invalid Demo Definition:', result.error.format());
      alert(`Failed to load demo: ${result.error.issues[0].path.join('.')} - ${result.error.issues[0].message}`);
      return;
    }

    const validatedDef = result.data;

    setAppMode('definition');
    setSolverStatus('idle');
    lastActuatorValues.current = {};
    definitionStateRef.current = null;

    system.bodies.clear();
    system.nodes.clear();
    system.joints.clear();

    for (const bodyDef of validatedDef.system.bodies) {
      const body = new RigidBody(bodyDef.id);
      for (const nodeDef of bodyDef.nodes) {
        const node = new Node(nodeDef.id);
        node.localTransform = matrixFromArray(nodeDef.localTransform);
        body.addNode(node);
      }
      system.addBody(body);
    }

    for (const nodeDef of validatedDef.system.globalNodes) {
      const node = new Node(nodeDef.id);
      node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
      system.addNode(node);
    }

    for (const jointDef of validatedDef.system.joints) {
      system.addJoint(new Joint(
        jointDef.id,
        jointDef.type,
        jointDef.axis as [number, number, number],
        0,
        jointDef.limits as [number, number],
      ));
    }

    assembleKinematicChain(system, validatedDef.actuators);
    system.updateForwardKinematics();

    const newActuators: Record<string, UIActuator> = {};
    for (const a of validatedDef.actuators) {
      newActuators[a.id] = {
        id: a.id,
        type: a.type,
        axis: a.axis,
        pivotNode: a.pivotNode,
        movingBodies: [...a.movingBodies],
        value: 0,
      };
    }
    setActuators(newActuators);

    sequence.splice(0, sequence.length, ...validatedDef.sequence.map(raw => ({
      type: 'loop' as const,
      max_iterations: raw.max_iterations,
      condition: raw.condition,
      steps: raw.steps.map(step => ({
        type: 'operation' as const,
        operation: step.operation,
      })),
    })));

    onLoad?.();
    setVersion(v => v + 1);
  }, [system, sequence, setActuators, setAppMode, setSolverStatus, setVersion, lastActuatorValues, definitionStateRef, onLoad]);

  return {
    demos: DEMOS,
    selectedDemo,
    setSelectedDemo,
    loadDemo,
  };
}
