import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';

type Controls = { target: THREE.Vector3; update: () => void };

/** Frames the camera on `bounds` whenever a new bounds object is passed. */
export const CameraRig = ({ bounds }: { bounds: THREE.Sphere }) => {
  const camera = useThree(s => s.camera);
  const controls = useThree(s => s.controls) as unknown as Controls | null;

  useEffect(() => {
    if (!controls) return;
    const { center, radius } = bounds;
    camera.position.set(center.x + radius * 0.9, center.y + radius * 1.1, center.z + radius * 2.6);
    camera.near = radius / 100;
    camera.far = radius * 100;
    camera.updateProjectionMatrix();
    controls.target.copy(center);
    controls.update();
  }, [bounds, controls, camera]);

  return null;
};
