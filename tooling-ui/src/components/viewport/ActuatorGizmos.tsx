import * as THREE from 'three';
import type { AxisName, KinematicSystem } from '@wigglesolve/core';
import { formatValue } from '../../utils/format';
import { positionOf } from './scene';
import { Label } from './Label';

/** Render-ready actuator state (derived from the mechanism by the caller). */
export type ActuatorView = {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: AxisName;
  pivotNode: string;
  value: number;
  limits: [number, number];
};

type Props = { system: KinematicSystem; actuators: ActuatorView[]; size: number; showLabels: boolean };

const AXIS_DIR: Record<AxisName, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

const line = (points: THREE.Vector3[], color: string, key: string) => (
  <line key={key}>
    <primitive object={new THREE.BufferGeometry().setFromPoints(points)} attach="geometry" />
    <lineBasicMaterial color={color} />
  </line>
);

/** Range arcs / tracks with the current value for every actuator. */
export const ActuatorGizmos = ({ system, actuators, size, showLabels }: Props) => (
  <>
    {actuators.map(act => {
      const pivot = system.nodes.get(act.pivotNode);
      if (!pivot) return null;
      const [lo, hi] = act.limits;
      const label = showLabels && (
        <Label color="#f59e0b" offset="side">{act.id} · {formatValue(act.type, act.value)}</Label>
      );

      if (act.type === 'revolute') {
        const r = size * 0.09;
        const radial = (angle: number, len: number) => new THREE.Vector3(Math.cos(angle) * len, Math.sin(angle) * len, 0);
        const orientation = new THREE.Quaternion().setFromUnitVectors(AXIS_DIR.z, AXIS_DIR[act.axis]);
        return (
          <group key={act.id} position={positionOf(pivot.absoluteTransform)} quaternion={orientation}>
            <mesh>
              <ringGeometry args={[r * 0.9, r * 1.1, 64, 1, lo, hi - lo]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            {line([new THREE.Vector3(), radial(lo, r * 1.2)], '#f59e0b', 'min')}
            {line([new THREE.Vector3(), radial(hi, r * 1.2)], '#f59e0b', 'max')}
            {line([new THREE.Vector3(), radial(act.value, r * 1.35)], '#22c55e', 'value')}
            {label}
          </group>
        );
      }

      const dir = AXIS_DIR[act.axis];
      return (
        <group key={act.id} position={positionOf(pivot.absoluteTransform)}>
          {line([dir.clone().multiplyScalar(lo), dir.clone().multiplyScalar(hi)], '#f59e0b', 'track')}
          <mesh position={dir.clone().multiplyScalar(act.value)}>
            <sphereGeometry args={[size * 0.025, 10, 10]} />
            <meshStandardMaterial color="#22c55e" emissive="#166534" emissiveIntensity={0.7} />
          </mesh>
          {label}
        </group>
      );
    })}
  </>
);
