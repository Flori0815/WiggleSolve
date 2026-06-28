import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Html } from '@react-three/drei';
import * as THREE from 'three';
import { KinematicSystem } from 'core-js/src/index';

const BODY_COLORS = [
  '#38bdf8', '#fb923c', '#4ade80', '#f472b6',
  '#a78bfa', '#facc15', '#34d399', '#f87171',
];

export type VisualizerActuator = {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: 'x' | 'y' | 'z';
  pivotNode: string;
  value: number;
};

interface VisualizerProps {
  system: KinematicSystem;
  version: number;
  actuators?: Record<string, VisualizerActuator>;
}

function axisOrientation(axis: 'x' | 'y' | 'z'): THREE.Quaternion {
  // Rotate so the disc (default normal = Z) aligns with the given rotation axis
  const q = new THREE.Quaternion();
  if (axis === 'x') q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  else if (axis === 'y') q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  return q;
}

const MAX_ARC = 2 * Math.PI;

const ActuatorVisualizer: React.FC<{
  system: KinematicSystem;
  actuators: Record<string, VisualizerActuator>;
  version: number;
}> = ({ system, actuators, version }) => {
  const elements = useMemo(() => {
    const meshes: React.ReactNode[] = [];

    Object.values(actuators).forEach(act => {
      const pivotNode = system.nodes.get(act.pivotNode);
      if (!pivotNode) return;

      const joint = system.joints.get(act.id);
      const rawLimits: [number, number] = joint?.limits ?? [-Math.PI, Math.PI];
      const pivotPos = new THREE.Vector3().setFromMatrixPosition(
        new THREE.Matrix4().fromArray(Array.from(pivotNode.absoluteTransform.elements))
      );

      if (act.type === 'revolute') {
        const lo = Math.max(rawLimits[0], -MAX_ARC);
        const hi = Math.min(rawLimits[1], MAX_ARC);
        const arcR = 0.22;
        const axisQ = axisOrientation(act.axis);

        // radial lines for limits and current value
        const minPt = new THREE.Vector3(Math.cos(lo) * (arcR + 0.05), Math.sin(lo) * (arcR + 0.05), 0);
        const maxPt = new THREE.Vector3(Math.cos(hi) * (arcR + 0.05), Math.sin(hi) * (arcR + 0.05), 0);
        const valPt = new THREE.Vector3(Math.cos(act.value) * (arcR + 0.08), Math.sin(act.value) * (arcR + 0.08), 0);
        const origin = new THREE.Vector3(0, 0, 0);

        const limitLabel = rawLimits[0] === -Infinity
          ? 'unlimited'
          : `[${(lo * 180 / Math.PI).toFixed(0)}°, ${(hi * 180 / Math.PI).toFixed(0)}°]`;

        meshes.push(
          <group key={`act-${act.id}`} position={pivotPos} quaternion={axisQ}>
            {/* Full rotation plane hint */}
            <mesh>
              <ringGeometry args={[arcR - 0.004, arcR + 0.004, 64]} />
              <meshBasicMaterial color="#555" transparent opacity={0.5} side={THREE.DoubleSide} />
            </mesh>
            {/* Limit range arc (filled sector) */}
            <mesh>
              <ringGeometry args={[arcR - 0.022, arcR + 0.022, 64, 1, lo, hi - lo]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.3} side={THREE.DoubleSide} />
            </mesh>
            {/* Limit range arc border */}
            <mesh>
              <ringGeometry args={[arcR - 0.022, arcR + 0.022, 64, 1, lo, hi - lo]} />
              <meshBasicMaterial color="#f59e0b" transparent opacity={0.7} side={THREE.DoubleSide} wireframe />
            </mesh>
            {/* Min limit line */}
            <line key="l-min">
              <primitive object={new THREE.BufferGeometry().setFromPoints([origin.clone(), minPt])} attach="geometry" />
              <lineBasicMaterial color="#f59e0b" />
            </line>
            {/* Max limit line */}
            <line key="l-max">
              <primitive object={new THREE.BufferGeometry().setFromPoints([origin.clone(), maxPt])} attach="geometry" />
              <lineBasicMaterial color="#f59e0b" />
            </line>
            {/* Current value needle */}
            <line key="l-val">
              <primitive object={new THREE.BufferGeometry().setFromPoints([origin.clone(), valPt])} attach="geometry" />
              <lineBasicMaterial color="#22c55e" />
            </line>
            {/* Current value dot */}
            <mesh position={valPt}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color="#22c55e" emissive="#14532d" emissiveIntensity={0.8} />
            </mesh>
            {/* Pivot center */}
            <mesh>
              <sphereGeometry args={[0.045, 12, 12]} />
              <meshStandardMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.7} />
            </mesh>
            <Html occlude="blending" pointerEvents="none">
              <div style={{
                fontSize: '11px', fontWeight: 'bold', color: '#f59e0b',
                background: 'rgba(0,0,0,0.82)', padding: '2px 7px',
                borderRadius: '4px', whiteSpace: 'nowrap',
                transform: 'translate(-50%, 160%)', fontFamily: 'monospace',
                border: '1px solid rgba(245,158,11,0.4)',
              }}>
                ⟳ {act.id} · {act.axis.toUpperCase()} · {limitLabel}
              </div>
            </Html>
          </group>
        );
      } else {
        // Prismatic
        const axisDir = act.axis === 'x' ? new THREE.Vector3(1, 0, 0)
          : act.axis === 'y' ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(0, 0, 1);

        const lo = rawLimits[0] === -Infinity ? -1.0 : rawLimits[0];
        const hi = rawLimits[1] === Infinity ? 1.0 : rawLimits[1];
        const pMin = axisDir.clone().multiplyScalar(lo);
        const pMax = axisDir.clone().multiplyScalar(hi);
        const pVal = axisDir.clone().multiplyScalar(act.value);

        const slabX = act.axis === 'x' ? 0.01 : 0.08;
        const slabY = act.axis === 'y' ? 0.01 : 0.08;
        const slabZ = act.axis === 'z' ? 0.01 : 0.08;

        const limitLabel = rawLimits[0] === -Infinity
          ? 'unlimited'
          : `[${lo.toFixed(2)}, ${hi.toFixed(2)}] m`;

        meshes.push(
          <group key={`act-${act.id}`} position={pivotPos}>
            {/* Track line */}
            <line key="l-track">
              <primitive object={new THREE.BufferGeometry().setFromPoints([pMin, pMax])} attach="geometry" />
              <lineBasicMaterial color="#f59e0b" />
            </line>
            {/* Min stop */}
            <mesh position={pMin}>
              <boxGeometry args={[slabX, slabY, slabZ]} />
              <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.5} />
            </mesh>
            {/* Max stop */}
            <mesh position={pMax}>
              <boxGeometry args={[slabX, slabY, slabZ]} />
              <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.5} />
            </mesh>
            {/* Current value slider */}
            <mesh position={pVal}>
              <sphereGeometry args={[0.055, 10, 10]} />
              <meshStandardMaterial color="#22c55e" emissive="#166534" emissiveIntensity={0.7} />
            </mesh>
            {/* Pivot */}
            <mesh>
              <sphereGeometry args={[0.04, 10, 10]} />
              <meshStandardMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.7} />
            </mesh>
            <Html occlude="blending" pointerEvents="none">
              <div style={{
                fontSize: '11px', fontWeight: 'bold', color: '#f59e0b',
                background: 'rgba(0,0,0,0.82)', padding: '2px 7px',
                borderRadius: '4px', whiteSpace: 'nowrap',
                transform: 'translate(-50%, 160%)', fontFamily: 'monospace',
                border: '1px solid rgba(245,158,11,0.4)',
              }}>
                ↔ {act.id} · {act.axis.toUpperCase()} · {limitLabel}
              </div>
            </Html>
          </group>
        );
      }
    });

    return meshes;
  }, [system, actuators, version]);

  return <>{elements}</>;
};

const KinematicRenderer: React.FC<{
  system: KinematicSystem;
  version: number;
}> = ({ system, version }) => {
  const elements = useMemo(() => {
    const meshes: React.ReactNode[] = [];

    // 1. Render links — colored cylinders representing each rigid body segment
    const bodyList = Array.from(system.bodies.entries());
    bodyList.forEach(([bodyId, body], bodyIndex) => {
      const color = BODY_COLORS[bodyIndex % BODY_COLORS.length];
      const nodes = Array.from(body.nodes.values());
      if (nodes.length === 0) return;

      // Collect all (p1, p2) pairs to draw as cylinders.
      // For single-node bodies the body's world origin (= positioned pivot) is one end.
      const pairs: Array<[THREE.Vector3, THREE.Vector3]> = [];

      if (nodes.length === 1) {
        const [tx, ty, tz] = body.transform.getTranslation();
        const origin = new THREE.Vector3(tx, ty, tz);
        const nodePos = new THREE.Vector3().setFromMatrixPosition(
          new THREE.Matrix4().fromArray(Array.from(nodes[0].absoluteTransform.elements))
        );
        if (origin.distanceTo(nodePos) > 0.01) {
          pairs.push([origin, nodePos]);
        }
      } else {
        for (let i = 0; i < nodes.length - 1; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const p1 = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(nodes[i].absoluteTransform.elements))
            );
            const p2 = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(nodes[j].absoluteTransform.elements))
            );
            if (p1.distanceTo(p2) > 0.01) pairs.push([p1, p2]);
          }
        }
      }

      pairs.forEach(([p1, p2], pairIdx) => {
        const dir = new THREE.Vector3().subVectors(p2, p1);
        const length = dir.length();
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        const q = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          dir.clone().normalize()
        );
        meshes.push(
          <group key={`link-${bodyId}-${pairIdx}`} position={mid} quaternion={q}>
            <mesh>
              <cylinderGeometry args={[0.032, 0.032, length, 10]} />
              <meshStandardMaterial
                color={color} emissive={color}
                emissiveIntensity={0.18} metalness={0.3} roughness={0.55}
              />
            </mesh>
          </group>
        );
      });

      if (pairs.length > 0) {
        // Label at midpoint of first pair
        const [lp1, lp2] = pairs[0];
        const labelPos = new THREE.Vector3().addVectors(lp1, lp2).multiplyScalar(0.5);
        meshes.push(
          <group key={`body-label-${bodyId}`} position={labelPos}>
            <Html occlude="blending" pointerEvents="none">
              <div style={{
                fontSize: '10px', color, background: 'rgba(0,0,0,0.7)',
                padding: '1px 5px', borderRadius: '3px', whiteSpace: 'nowrap',
                transform: 'translate(-50%, -230%)', fontFamily: 'monospace',
                border: `1px solid ${color}55`,
              }}>
                {bodyId}
              </div>
            </Html>
          </group>
        );
      }
    });

    // 2. Render all nodes (joint connection points)
    system.nodes.forEach(node => {
      const matrix = new THREE.Matrix4().fromArray(Array.from(node.absoluteTransform.elements));
      meshes.push(
        <group key={`node-${node.id}`} matrix={matrix} matrixAutoUpdate={false}>
          <mesh>
            {node.isLocked
              ? <boxGeometry args={[0.1, 0.1, 0.1]} />
              : <sphereGeometry args={[0.05]} />
            }
            {node.isLocked
              ? <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.5} />
              : <meshStandardMaterial color="#aa3bff" emissive="#3b1a6b" emissiveIntensity={0.5} />
            }
          </mesh>
          <primitive object={new THREE.AxesHelper(0.15)} />
          <Html occlude="blending" pointerEvents="none">
            <div style={{
              fontSize: '12px', fontWeight: 'bold', color: '#fff',
              background: 'rgba(0, 0, 0, 0.7)', padding: '2px 6px',
              borderRadius: '4px', whiteSpace: 'nowrap',
              transform: 'translate(-50%, -120%)', fontFamily: 'monospace',
            }}>
              {node.id}
            </div>
          </Html>
        </group>
      );
    });

    return meshes;
  }, [system, version]);

  return <>{elements}</>;
};

const Legend: React.FC = () => (
  <div style={{
    position: 'absolute', bottom: '16px', left: '16px',
    background: 'rgba(0,0,0,0.75)', border: '1px solid #333',
    borderRadius: '8px', padding: '10px 14px',
    fontFamily: 'monospace', fontSize: '11px', color: '#ccc',
    pointerEvents: 'none', zIndex: 10000000, lineHeight: '1.8',
  }}>
    <div style={{ fontWeight: 'bold', color: '#fff', marginBottom: '4px' }}>Legend</div>
    <div><span style={{ color: '#38bdf8' }}>━━</span> Link (rigid body segment)</div>
    <div><span style={{ color: '#aa3bff' }}>●</span> Node (connection point)</div>
    <div><span style={{ color: '#f59e0b' }}>◻</span> Locked / target node</div>
    <div><span style={{ color: '#c084fc' }}>●</span> Actuator pivot</div>
    <div><span style={{ color: '#f59e0b' }}>◔</span> Joint limit range</div>
    <div><span style={{ color: '#22c55e' }}>→</span> Current joint value</div>
  </div>
);

export const Visualizer: React.FC<VisualizerProps> = ({ system, version, actuators = {} }) => {
  return (
    <div
      style={{ width: '100%', height: '100%', background: '#111', position: 'relative' }}
      tabIndex={0}
      role="img"
      aria-label="3D kinematic system viewport"
    >
      <Canvas camera={{ position: [1.5, 2, 5], fov: 55 }}>
        <color attach="background" args={['#08060d']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <KinematicRenderer system={system} version={version} />
        <ActuatorVisualizer system={system} actuators={actuators} version={version} />
        <Grid infiniteGrid fadeDistance={20} cellColor="#222" sectionColor="#333" />
        <OrbitControls makeDefault target={[1.5, 0, 0]} />
      </Canvas>
      <Legend />
    </div>
  );
};
