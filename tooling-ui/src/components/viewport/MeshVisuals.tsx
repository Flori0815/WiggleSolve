import * as THREE from 'three';
import type { MeshVisual, RigidBody } from '@wigglesolve/core';

// Geometry is built once per visual object, not on every render.
const geometryCache = new WeakMap<MeshVisual, THREE.BufferGeometry>();

function geometryOf(visual: MeshVisual): THREE.BufferGeometry {
  let geometry = geometryCache.get(visual);
  if (!geometry) {
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(visual.vertices, 3));
    geometry.setIndex(visual.indices);
    geometry.computeVertexNormals();
    geometryCache.set(visual, geometry);
  }
  return geometry;
}

type Props = { body: RigidBody; color: string };

/** Renders a body's representation meshes in its current pose. */
export const MeshVisuals = ({ body, color }: Props) => {
  const matrix = new THREE.Matrix4().fromArray(Array.from(body.transform.elements));
  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      {body.visuals.map((visual, i) => {
        const opacity = visual.opacity ?? 1;
        return (
          <mesh key={i} geometry={geometryOf(visual)}>
            <meshStandardMaterial
              color={visual.color ?? color}
              transparent={opacity < 1}
              opacity={opacity}
              side={THREE.DoubleSide}
              metalness={0.2}
              roughness={0.6}
              flatShading
            />
          </mesh>
        );
      })}
    </group>
  );
};
