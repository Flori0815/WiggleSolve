import React, { useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';
import { KinematicSystem } from 'core-js/src/system/KinematicSystem';

interface VisualizerProps {
  system: KinematicSystem;
}

const KinematicRenderer: React.FC<{ system: KinematicSystem, version: number }> = ({ system, version }) => {
  // We use the version to recreate the geometry/mesh structure when the system structure changes
  const { nodes, links } = useMemo(() => {
    const nodeMeshes: React.ReactNode[] = [];
    const linkLines: React.ReactNode[] = [];

    // Render nodes
    system.nodes.forEach((node) => {
      nodeMeshes.push(
        <group key={`node-group-${node.id}`} name={`node-${node.id}`}>
          <mesh name={`mesh-${node.id}`}>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshStandardMaterial color="#aa3bff" />
          </mesh>
          <primitive object={new THREE.AxesHelper(0.15)} />
        </group>
      );
    });

    // Render links as lines between parent and child nodes
    system.connections.forEach((conn, index) => {
      const parentNode = system.nodes.get(conn.parentNodeId);
      const childNode = system.nodes.get(conn.childNodeId);

      if (parentNode && childNode) {
        const points = [new THREE.Vector3(), new THREE.Vector3()];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        linkLines.push(
          <line key={`link-${index}`} name={`link-${index}`}>
            <primitive object={geometry} attach="geometry" />
            <lineBasicMaterial color="#666" linewidth={1} />
          </line>
        );
      }
    });

    return { nodes: nodeMeshes, links: linkLines };
  }, [system, version]);

  const nodeGroupRef = React.useRef<THREE.Group>(null);
  const linkGroupRef = React.useRef<THREE.Group>(null);

  // Use useFrame to update matrices every frame
  useFrame(() => {
    if (nodeGroupRef.current) {
      system.nodes.forEach((node) => {
        const group = nodeGroupRef.current?.getObjectByName(`node-${node.id}`);
        if (group) {
          group.matrix.fromArray(Array.from(node.absoluteTransform.elements));
          group.matrixAutoUpdate = false;
        }
      });
    }

    if (linkGroupRef.current) {
      system.connections.forEach((conn, index) => {
        const line = linkGroupRef.current?.getObjectByName(`link-${index}`) as THREE.Line;
        if (line) {
          const parentNode = system.nodes.get(conn.parentNodeId);
          const childNode = system.nodes.get(conn.childNodeId);
          if (parentNode && childNode) {
            const pPos = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(parentNode.absoluteTransform.elements))
            );
            const cPos = new THREE.Vector3().setFromMatrixPosition(
              new THREE.Matrix4().fromArray(Array.from(childNode.absoluteTransform.elements))
            );
            
            const positions = line.geometry.attributes.position.array as Float32Array;
            positions[0] = pPos.x;
            positions[1] = pPos.y;
            positions[2] = pPos.z;
            positions[3] = cPos.x;
            positions[4] = cPos.y;
            positions[5] = cPos.z;
            line.geometry.attributes.position.needsUpdate = true;
          }
        }
      });
    }
  });

  return (
    <>
      <group ref={nodeGroupRef}>{nodes}</group>
      <group ref={linkGroupRef}>{links}</group>
    </>
  );
};

export const Visualizer: React.FC<VisualizerProps & { version: number }> = ({ system, version }) => {
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
