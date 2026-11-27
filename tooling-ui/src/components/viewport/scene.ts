import * as THREE from 'three';
import type { KinematicSystem, Matrix4x4 } from '@wigglesolve/core';

export const BODY_COLORS = ['#38bdf8', '#fb923c', '#4ade80', '#f472b6', '#a78bfa', '#facc15', '#34d399', '#f87171'];

export const positionOf = (m: Matrix4x4) => {
  const [x, y, z] = m.getTranslation();
  return new THREE.Vector3(x, y, z);
};

/** Bounding sphere of all nodes, used for camera framing and gizmo sizing. */
export function boundsOf(system: KinematicSystem): THREE.Sphere {
  const points = [...system.nodes.values()].map(n => positionOf(n.absoluteTransform));
  const sphere = new THREE.Sphere();
  if (points.length === 0) return new THREE.Sphere(new THREE.Vector3(), 1);
  sphere.setFromPoints(points);
  sphere.radius = Math.max(sphere.radius, 0.25);
  return sphere;
}
