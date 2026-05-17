import { useState, useMemo, useEffect } from 'react';
import { KinematicSystem } from 'core-js/src/system/KinematicSystem';
import { Node } from 'core-js/src/elements/Node';
import { Joint } from 'core-js/src/elements/Joint';
import { Link } from 'core-js/src/elements/Link';
import { Matrix4x4 } from 'core-js/src/math/Matrix4x4';
import { Visualizer } from './components/Visualizer';
import './App.css';

function App() {
  // Initialize the kinematic system
  const system = useMemo(() => {
    const s = new KinematicSystem();

    const baseNode = new Node('base');
    const node1 = new Node('node1');
    const node2 = new Node('node2');
    const eeNode = new Node('ee');

    const joint1 = new Joint('joint1', 'revolute', [0, 0, 1]); // Rotate around Z
    const joint2 = new Joint('joint2', 'revolute', [0, 1, 0]); // Rotate around Y
    const joint3 = new Joint('joint3', 'revolute', [0, 1, 0]); // Rotate around Y

    const link1 = new Link('link1', new Matrix4x4().translate(0, 0, 0.5));
    const link2 = new Link('link2', new Matrix4x4().translate(0.5, 0, 0));
    const link3 = new Link('link3', new Matrix4x4().translate(0.5, 0, 0));

    s.addNode(baseNode);
    s.addNode(node1);
    s.addNode(node2);
    s.addNode(eeNode);

    s.addJoint(joint1);
    s.addJoint(joint2);
    s.addJoint(joint3);

    s.addLink(link1);
    s.addLink(link2);
    s.addLink(link3);

    s.connect('base', 'joint1', 'link1', 'node1');
    s.connect('node1', 'joint2', 'link2', 'node2');
    s.connect('node2', 'joint3', 'link3', 'ee');

    s.updateForwardKinematics();
    return s;
  }, []);

  const [jointValues, setJointValues] = useState({
    joint1: 0,
    joint2: 0,
    joint3: 0,
  });

  // Re-calculate FK when joint values change
  const [, setTick] = useState(0);
  useEffect(() => {
    const j1 = system.joints.get('joint1');
    const j2 = system.joints.get('joint2');
    const j3 = system.joints.get('joint3');

    if (j1) j1.value = jointValues.joint1;
    if (j2) j2.value = jointValues.joint2;
    if (j3) j3.value = jointValues.joint3;

    system.updateForwardKinematics();
    setTick(t => t + 1); // Trigger re-render of visualizer
  }, [jointValues, system]);

  const handleSliderChange = (id: string, val: string) => {
    setJointValues(prev => ({
      ...prev,
      [id]: parseFloat(val)
    }));
  };

  return (
    <div className="app-container" style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      <div className="sidebar" style={{ width: '300px', padding: '20px', background: '#222', color: '#fff', zIndex: 10 }}>
        <h1>WiggleSolve</h1>
        <p>Kinematics Visualizer</p>

        <div className="controls">
          <div className="control-group">
            <label>Joint 1 (Base Rotation - Z): {jointValues.joint1.toFixed(2)}</label>
            <input
              type="range"
              min={-Math.PI}
              max={Math.PI}
              step={0.01}
              value={jointValues.joint1}
              onChange={(e) => handleSliderChange('joint1', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Joint 2 (Shoulder - Y): {jointValues.joint2.toFixed(2)}</label>
            <input
              type="range"
              min={-Math.PI/2}
              max={Math.PI/2}
              step={0.01}
              value={jointValues.joint2}
              onChange={(e) => handleSliderChange('joint2', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Joint 3 (Elbow - Y): {jointValues.joint3.toFixed(2)}</label>
            <input
              type="range"
              min={-Math.PI/2}
              max={Math.PI/2}
              step={0.01}
              value={jointValues.joint3}
              onChange={(e) => handleSliderChange('joint3', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '0.8em', color: '#888' }}>
          Move the sliders to see the Forward Kinematics engine in action.
        </div>
      </div>

      <div className="main-view" style={{ flex: 1, position: 'relative' }}>
        <Visualizer system={system} />
      </div>
    </div>
  );
}

export default App;
