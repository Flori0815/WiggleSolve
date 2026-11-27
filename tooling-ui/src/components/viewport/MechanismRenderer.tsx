import * as THREE from 'three';
import type { KinematicSystem } from '@wigglesolve/core';
import { BODY_COLORS, positionOf } from './scene';
import { Label } from './Label';
import { MeshVisuals } from './MeshVisuals';

type Props = { system: KinematicSystem; size: number; showLabels: boolean; showNodeLabels: boolean; showFrames: boolean };

const Y_UP = new THREE.Vector3(0, 1, 0);

/**
 * Bodies with meshes are drawn as their meshes; all others as rods between
 * their nodes. Nodes are spheres (anchors are cubes).
 */
export const MechanismRenderer = ({ system, size, showLabels, showNodeLabels, showFrames }: Props) => {
  const rod = size * 0.012;
  const items: React.ReactNode[] = [];

  [...system.bodies.values()].forEach((body, index) => {
    const color = BODY_COLORS[index % BODY_COLORS.length];
    if (body.visuals.length > 0) {
      items.push(<MeshVisuals key={`mesh-${body.id}`} body={body} color={color} />);
      if (showLabels) {
        const anchor = body.nodes.values().next().value;
        items.push(
          <group key={`label-${body.id}`} position={positionOf(anchor ? anchor.absoluteTransform : body.transform)}>
            <Label color={color} offset="above">{body.id}</Label>
          </group>,
        );
      }
      return;
    }
    const points = [...body.nodes.values()].map(n => positionOf(n.absoluteTransform));
    // Single-node bodies are drawn from the body origin (their pivot) to the node.
    if (points.length === 1) points.unshift(positionOf(body.transform));

    const segments: Array<[THREE.Vector3, THREE.Vector3]> = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (points[i].distanceTo(points[j]) > 1e-3) segments.push([points[i], points[j]]);
      }
    }

    segments.forEach(([a, b], k) => {
      const dir = b.clone().sub(a);
      items.push(
        <mesh
          key={`rod-${body.id}-${k}`}
          position={a.clone().add(b).multiplyScalar(0.5)}
          quaternion={new THREE.Quaternion().setFromUnitVectors(Y_UP, dir.clone().normalize())}
        >
          <cylinderGeometry args={[rod, rod, dir.length(), 10]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.18} metalness={0.3} roughness={0.55} />
        </mesh>,
      );
    });

    if (showLabels && segments.length > 0) {
      const [a, b] = segments[0];
      items.push(
        <group key={`label-${body.id}`} position={a.clone().add(b).multiplyScalar(0.5)}>
          <Label color={color} offset="above">{body.id}</Label>
        </group>,
      );
    }
  });

  system.nodes.forEach(node => {
    const matrix = new THREE.Matrix4().fromArray(Array.from(node.absoluteTransform.elements));
    const r = size * 0.02;
    items.push(
      <group key={`node-${node.id}`} matrix={matrix} matrixAutoUpdate={false}>
        <mesh>
          {node.isLocked ? <boxGeometry args={[r * 2, r * 2, r * 2]} /> : <sphereGeometry args={[r, 12, 12]} />}
          <meshStandardMaterial
            color={node.isLocked ? '#f59e0b' : '#aa3bff'}
            emissive={node.isLocked ? '#78350f' : '#3b1a6b'}
            emissiveIntensity={0.5}
          />
        </mesh>
        {showFrames && <primitive object={new THREE.AxesHelper(size * 0.08)} />}
        {showNodeLabels && <Label offset="below">{node.id}</Label>}
      </group>,
    );
  });

  return <>{items}</>;
};
