import { useRef, useState } from 'react';
import type * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import type { JointFrame, KinematicSystem } from '@wigglesolve/core';
import { ActuatorGizmos } from './ActuatorGizmos';
import type { ActuatorView } from './ActuatorGizmos';
import { CameraRig } from './CameraRig';
import { JointAxes } from './JointAxes';
import { MechanismRenderer } from './MechanismRenderer';
import { boundsOf } from './scene';

type Props = {
  system: KinematicSystem;
  actuators: ActuatorView[];
  joints: JointFrame[];
  /** Change to re-frame the camera (e.g. after loading a mechanism). */
  frameKey: number;
};

export const Visualizer = ({ system, actuators, joints, frameKey }: Props) => {
  const [showLabels, setShowLabels] = useState(true);
  const [showNodeLabels, setShowNodeLabels] = useState(false);
  const [showFrames, setShowFrames] = useState(false);
  const [showJoints, setShowJoints] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [refit, setRefit] = useState(0);
  // Bounds are measured only when (re)framing, so sizes stay stable while driving.
  const framing = useRef<{ key: string; bounds: THREE.Sphere } | null>(null);
  const key = `${frameKey}:${refit}`;
  if (framing.current?.key !== key) framing.current = { key, bounds: boundsOf(system) };
  const { bounds } = framing.current;
  const size = bounds.radius;

  return (
    <div className="viewport" role="img" aria-label="3D view of the mechanism">
      <Canvas camera={{ position: [1.5, 2, 5], fov: 50 }}>
        <color attach="background" args={['#08060d']} />
        <ambientLight intensity={1.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <MechanismRenderer system={system} size={size} showLabels={showLabels} showNodeLabels={showNodeLabels} showFrames={showFrames} />
        <ActuatorGizmos system={system} actuators={actuators} size={size} showLabels={showLabels} />
        {showJoints && <JointAxes system={system} frames={joints} size={size} showLabels={showLabels} />}
        <Grid infiniteGrid fadeDistance={size * 20} cellSize={size / 5} sectionSize={size} cellColor="#222" sectionColor="#333" />
        <OrbitControls makeDefault />
        <CameraRig bounds={bounds} />
      </Canvas>

      <div className="viewport-toolbar" role="toolbar" aria-label="View options">
        <button className={`btn ${showLabels ? 'active' : ''}`} aria-pressed={showLabels} onClick={() => setShowLabels(v => !v)}>Names</button>
        <button className={`btn ${showNodeLabels ? 'active' : ''}`} aria-pressed={showNodeLabels} onClick={() => setShowNodeLabels(v => !v)}>Node names</button>
        <button className={`btn ${showFrames ? 'active' : ''}`} aria-pressed={showFrames} onClick={() => setShowFrames(v => !v)}>Node frames</button>
        <button className={`btn ${showJoints ? 'active' : ''}`} aria-pressed={showJoints} onClick={() => setShowJoints(v => !v)}>Joint axes</button>
        <button className={`btn ${showLegend ? 'active' : ''}`} aria-pressed={showLegend} onClick={() => setShowLegend(v => !v)}>Legend</button>
        <button className="btn" onClick={() => setRefit(r => r + 1)}>Fit view</button>
      </div>

      {showLegend && (
        <dl className="legend">
          <dt><span className="swatch rod" /></dt><dd>Body (rigid part)</dd>
          <dt><span className="swatch node" /></dt><dd>Node (frame)</dd>
          <dt><span className="swatch anchor" /></dt><dd>Anchor node</dd>
          <dt><span className="swatch range" /></dt><dd>Actuator range</dd>
          <dt><span className="swatch value" /></dt><dd>Actuator value</dd>
          <dt><span className="swatch joint-revolute" /></dt><dd>Revolute joint axis</dd>
          <dt><span className="swatch joint-prismatic" /></dt><dd>Prismatic joint axis</dd>
        </dl>
      )}
    </div>
  );
};
