import { useState, useMemo, useCallback } from 'react';
import { 
  KinematicSystem, 
  Node, 
  Joint, 
  Link, 
  Matrix4x4, 
  Executor 
} from 'core-js/src/index';
import type { JointType, Instruction } from 'core-js/src/index';
import { Visualizer } from './components/Visualizer';
import './App.css';

function App() {
  const [version, setVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'elements' | 'sequence'>('elements');
  
  const system = useMemo(() => {
    const s = new KinematicSystem();
    const base = new Node('base');
    const node1 = new Node('node1');
    const target = new Node('target');
    target.absoluteTransform = new Matrix4x4().translate(1, 1, 0);

    const joint1 = new Joint('joint1', 'revolute', [0, 0, 1]);
    const link1 = new Link('link1', new Matrix4x4().translate(0.5, 0, 0));
    
    s.addNode(base);
    s.addNode(node1);
    s.addNode(target);
    s.addJoint(joint1);
    s.addLink(link1);
    s.connect('base', 'joint1', 'link1', 'node1');
    
    s.updateForwardKinematics();
    return s;
  }, []);

  const [sequence] = useState<Instruction[]>([
    {
      type: 'loop',
      max_iterations: 100,
      condition: { type: 'distance_less_than', nodeA: 'node1', nodeB: 'target', threshold: 0.01 },
      steps: [
        {
          type: 'operation',
          operation: {
            type: 'align_node',
            effectorNode: 'node1',
            targetNode: 'target',
            adjustVariables: ['joint1']
          }
        }
      ]
    }
  ]);

  const incrementVersion = useCallback(() => {
    system.updateForwardKinematics();
    setVersion(v => v + 1);
  }, [system]);

  const addNode = () => {
    const id = prompt('Node ID:', `node${system.nodes.size}`);
    if (id) {
      system.addNode(new Node(id));
      incrementVersion();
    }
  };

  const removeNode = (id: string) => {
    system.nodes.delete(id);
    system.connections = system.connections.filter(c => c.parentNodeId !== id && c.childNodeId !== id);
    incrementVersion();
  };

  const addJoint = () => {
    const id = prompt('Joint ID:', `joint${system.joints.size + 1}`);
    if (id) {
      system.addJoint(new Joint(id, 'revolute', [0, 0, 1]));
      incrementVersion();
    }
  };

  const removeJoint = (id: string) => {
    system.joints.delete(id);
    system.connections = system.connections.filter(c => c.jointId !== id);
    incrementVersion();
  };

  const addLink = () => {
    const id = prompt('Link ID:', `link${system.links.size + 1}`);
    if (id) {
      system.addLink(new Link(id, new Matrix4x4().translate(0.5, 0, 0)));
      incrementVersion();
    }
  };

  const removeLink = (id: string) => {
    system.links.delete(id);
    system.connections = system.connections.filter(c => c.linkId !== id);
    incrementVersion();
  };

  const [connParent, setConnParent] = useState('');
  const [connJoint, setConnJoint] = useState('');
  const [connLink, setConnLink] = useState('');
  const [connChild, setConnChild] = useState('');

  const addConnection = () => {
    if (connParent && connJoint && connLink && connChild) {
      system.connect(connParent, connJoint, connLink, connChild);
      incrementVersion();
    }
  };

  const removeConnection = (index: number) => {
    system.connections.splice(index, 1);
    incrementVersion();
  };

  const runSolver = () => {
    const executor = new Executor(system);
    const success = executor.execute(sequence);
    console.log('Solver result:', success);
    setVersion(v => v + 1);
  };

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h1>WiggleSolve</h1>
          <div className="tabs">
            <button className={activeTab === 'elements' ? 'active' : ''} onClick={() => setActiveTab('elements')}>Elements</button>
            <button className={activeTab === 'sequence' ? 'active' : ''} onClick={() => setActiveTab('sequence')}>Sequence</button>
          </div>
        </div>

        <div className="sidebar-content">
          {activeTab === 'elements' && (
            <div className="elements-tab">
              <section>
                <div className="section-header">
                  <h3>Nodes</h3>
                  <button className="add-btn" onClick={addNode}>+</button>
                </div>
                <div className="item-list">
                  {Array.from(system.nodes.keys()).map(id => (
                    <div key={id} className="item">
                      <span>{id}</span>
                      <button className="del-btn" onClick={() => removeNode(id)}>×</button>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="section-header">
                  <h3>Joints</h3>
                  <button className="add-btn" onClick={addJoint}>+</button>
                </div>
                <div className="item-list">
                  {Array.from(system.joints.values()).map(joint => (
                    <div key={joint.id} className="item">
                      <div className="item-row">
                        <span className="bold">{joint.id}</span>
                        <button className="del-btn" onClick={() => removeJoint(joint.id)}>×</button>
                      </div>
                      <div className="item-row small">
                        <span>Type:</span>
                        <select value={joint.type} onChange={e => { joint.type = e.target.value as JointType; incrementVersion(); }}>
                          <option value="revolute">revolute</option>
                          <option value="prismatic">prismatic</option>
                          <option value="fixed">fixed</option>
                        </select>
                      </div>
                      <div className="item-row small">
                        <span>Axis:</span>
                        <input type="text" value={joint.axis.join(',')} onChange={e => { 
                          const vals = e.target.value.split(',').map(v => parseFloat(v));
                          if (vals.length === 3) { joint.axis = vals as [number, number, number]; incrementVersion(); }
                        }} />
                      </div>
                      <div className="item-row">
                        <span>Value: {joint.value.toFixed(2)}</span>
                      </div>
                      <input 
                        type="range" 
                        min={joint.type === 'prismatic' ? -2 : -Math.PI} 
                        max={joint.type === 'prismatic' ? 2 : Math.PI} 
                        step={0.01} 
                        value={joint.value} 
                        onChange={(e) => {
                          joint.value = parseFloat(e.target.value);
                          incrementVersion();
                        }} 
                      />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="section-header">
                  <h3>Links</h3>
                  <button className="add-btn" onClick={addLink}>+</button>
                </div>
                <div className="item-list">
                  {Array.from(system.links.values()).map(link => (
                    <div key={link.id} className="item">
                      <div className="item-row">
                        <span className="bold">{link.id}</span>
                        <button className="del-btn" onClick={() => removeLink(link.id)}>×</button>
                      </div>
                      <div className="item-row small">
                        <span>Offset (X,Y,Z):</span>
                        <input type="text" value={link.transform.getTranslation().join(',')} onChange={e => {
                          const vals = e.target.value.split(',').map(v => parseFloat(v));
                          if (vals.length === 3) { 
                            link.transform = new Matrix4x4().translate(vals[0], vals[1], vals[2]);
                            incrementVersion();
                          }
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3>Connections</h3>
                <div className="item-list">
                  {system.connections.map((c, i) => (
                    <div key={i} className="item small">
                      <div className="item-row">
                        <span>{c.parentNodeId} → {c.jointId} → {c.linkId} → {c.childNodeId}</span>
                        <button className="del-btn" onClick={() => removeConnection(i)}>×</button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="conn-form">
                  <select value={connParent} onChange={e => setConnParent(e.target.value)}>
                    <option value="">Parent...</option>
                    {Array.from(system.nodes.keys()).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <select value={connJoint} onChange={e => setConnJoint(e.target.value)}>
                    <option value="">Joint...</option>
                    {Array.from(system.joints.keys()).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <select value={connLink} onChange={e => setConnLink(e.target.value)}>
                    <option value="">Link...</option>
                    {Array.from(system.links.keys()).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <select value={connChild} onChange={e => setConnChild(e.target.value)}>
                    <option value="">Child...</option>
                    {Array.from(system.nodes.keys()).map(id => <option key={id} value={id}>{id}</option>)}
                  </select>
                  <button className="add-conn-btn" onClick={addConnection}>Connect</button>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'sequence' && (
            <div className="sequence-tab">
              <section>
                <h3>Solver Sequence</h3>
                <div className="sequence-preview">
                  <pre>{JSON.stringify(sequence, null, 2)}</pre>
                </div>
                <button className="run-btn" onClick={runSolver}>Run Solver</button>
              </section>
              <p className="note">
                Note: Sequence editing is currently view-only in this prototype.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="main-view">
        <Visualizer system={system} version={version} />
      </div>
    </div>
  );
}

export default App;