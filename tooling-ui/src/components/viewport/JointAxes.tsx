import * as THREE from 'three';
import type { JointFrame, KinematicSystem } from '@wigglesolve/core';
import { Label } from './Label';

type Props = { system: KinematicSystem; frames: JointFrame[]; size: number; showLabels: boolean };

const COLOR = { revolute: '#f59e0b', prismatic: '#22d3ee' } as const;

/**
 * A small triad (x red, y green, z blue) at every joint pivot plus an arrow
 * along each joint axis (revolute orange, prismatic cyan).
 */
export const JointAxes = ({ system, frames, size, showLabels }: Props) => {
  const byPivot = new Map<string, JointFrame[]>();
  frames.forEach(f => byPivot.set(f.pivotNode, [...(byPivot.get(f.pivotNode) ?? []), f]));
  const triad = size * 0.07;

  return (
    <>
      {[...byPivot].map(([pivotId, list]) => {
        const pivot = system.nodes.get(pivotId);
        if (!pivot) return null;
        const matrix = new THREE.Matrix4().fromArray(Array.from(pivot.absoluteTransform.elements));
        return (
          <group key={pivotId} matrix={matrix} matrixAutoUpdate={false}>
            <primitive object={new THREE.AxesHelper(triad)} />
            {list.map(f => (
              <primitive
                key={f.jointId}
                object={new THREE.ArrowHelper(new THREE.Vector3(...f.axis), new THREE.Vector3(), triad * 2, COLOR[f.type], triad * 0.5, triad * 0.3)}
              />
            ))}
            {showLabels && <Label color={COLOR[list[0].type]} offset="above">{list.map(f => f.jointId).join(' · ')}</Label>}
          </group>
        );
      })}
    </>
  );
};
