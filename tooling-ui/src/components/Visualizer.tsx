import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { KinematicSystem } from 'core-js/src/index';

interface VisualizerProps {
  system: KinematicSystem;
  version: number;
}

const KinematicRenderer: React.FC<{ system: KinematicSystem, version: number }> = ({ system, version }) => {
  const elements = useMemo(() => {
    const meshes: React.ReactNode[] = [];

    // 1. Render all Nodes in the system (Body-attached and Global)
    system.nodes.forEach(node => {
      const matrix = new THREE.Matrix4().fromArray(Array.from(node.absoluteTransform.elements));
      meshes.push(
        <group key={`node-${node.id}`} matrix={matrix} matrixAutoUpdate={false}>
          <mesh>
            <sphereGeometry args={[0.05]} />
            {node.isLocked
              ? <meshStandardMaterial color="#f59e0b" emissive="#78350f" emissiveIntensity={0.5} />
              : <meshStandardMaterial color="#aa3bff" emissive="#3b1a6b" emissiveIntensity={0.5} />
            }
          </mesh>
          <primitive object={new THREE.AxesHelper(0.15)} />
        </group>
      );
    });

    // 2. Render rigid structure for each body
    system.bodies.forEach(body => {
      const nodes = Array.from(body.nodes.values());
      if (nodes.length > 1) {
        for (let i = 0; i < nodes.length - 1; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const p1 = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(nodes[i].absoluteTransform.elements))
            );
            const p2 = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(nodes[j].absoluteTransform.elements))
            );
            const points = [p1, p2];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            meshes.push(
              <line key={`body-wire-${body.id}-${i}-${j}`}>
                <primitive object={geometry} attach="geometry" />
                <lineBasicMaterial color="#888" linewidth={1} transparent opacity={0.5} />
              </line>
            );
          }
        }
      }
    });

    return meshes;
  }, [system, version]);

  return <>{elements}</>;
};

export const Visualizer: React.FC<VisualizerProps> = ({ system, version }) => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [1.5, 1.5, 1.5], fov: 50 }}>
        <color attach="background" args={['#08060d']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <KinematicRenderer system={system} version={version} />
        <Grid infiniteGrid fadeDistance={20} cellColor="#222" sectionColor="#333" />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};
