import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { KinematicSystem } from 'core-js/src/system/KinematicSystem';

interface VisualizerProps {
  system: KinematicSystem;
}

const KinematicRenderer: React.FC<{ system: KinematicSystem }> = ({ system }) => {
  // Use useFrame to update matrices every frame instead of recreating elements
  const elements = useMemo(() => {
    const nodes: any[] = [];
    const links: any[] = [];

    // Render nodes
    system.nodes.forEach((node) => {
      const matrix = new THREE.Matrix4().fromArray(Array.from(node.absoluteTransform.elements));

      nodes.push(
        <mesh key={`node-${node.id}`} matrix={matrix} matrixAutoUpdate={false}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshStandardMaterial color="red" />
        </mesh>
      );

      // Add coordinate axes for each node
      nodes.push(
        <primitive
          key={`axes-${node.id}`}
          object={new THREE.AxesHelper(0.2)}
          matrix={matrix}
          matrixAutoUpdate={false}
        />
      );
    });

    // Render links as lines between parent and child nodes
    system.connections.forEach((conn, index) => {
      const parentNode = system.nodes.get(conn.parentNodeId);
      const childNode = system.nodes.get(conn.childNodeId);

      if (parentNode && childNode) {
        const pPos = new THREE.Vector3().setFromMatrixPosition(
          new THREE.Matrix4().fromArray(Array.from(parentNode.absoluteTransform.elements))
        );
        const cPos = new THREE.Vector3().setFromMatrixPosition(
          new THREE.Matrix4().fromArray(Array.from(childNode.absoluteTransform.elements))
        );

        const points = [pPos, cPos];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        links.push(
          <line key={`link-${index}`}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial color="gray" linewidth={2} />
          </line>
        );
      }
    });

    return [...links, ...nodes];
  }, [system]);

  return <>{elements}</>;
};

export const Visualizer: React.FC<VisualizerProps> = ({ system }) => {
  return (
    <div style={{ width: '100%', height: '100%', background: '#111' }}>
      <Canvas camera={{ position: [2, 2, 2], fov: 50 }}>
        <color attach="background" args={['#111']} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <KinematicRenderer system={system} />
        <Grid infiniteGrid fadeDistance={10} cellColor="#444" sectionColor="#666" />
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};
