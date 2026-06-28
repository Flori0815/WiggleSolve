import { useState, useEffect } from 'react';
import { Joint, Executor } from 'core-js/src/index';
import type { Instruction } from 'core-js/src/index';
import { Visualizer } from './components/Visualizer';
import { DefinitionEditor } from './components/DefinitionEditor';
import { SolverPanel } from './components/SolverPanel';
import { LiveSession } from './components/LiveSession';
import { useKinematicSystem } from './hooks/useKinematicSystem';
import { useDemoLoader } from './hooks/useDemoLoader';
import type { UIActuator } from './types';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'elements' | 'sequence'>('elements');
  const [actuators, setActuators] = useState<Record<string, UIActuator>>({});
  const [sequence] = useState<Instruction[]>([{
    type: 'loop', max_iterations: 100,
    condition: { type: 'distance_less_than', nodeA: 'arm_end', nodeB: 'target', threshold: 0.01 },
    steps: [{ type: 'operation', operation: { type: 'align_node', effectorNode: 'arm_end', targetNode: 'target', pivotNode: 'pivot', jointId: 'auto_j1', movingBodies: ['arm_body'] } }],
  }]);

  const {
    system, version, setVersion,
    appMode, setAppMode,
    solverStatus, setSolverStatus,
    tick, toggleMode,
    definitionStateRef, lastActuatorValues,
  } = useKinematicSystem();

  const { demos, selectedDemo, setSelectedDemo, loadDemo } = useDemoLoader({
    system, sequence, setActuators, setAppMode, setSolverStatus, setVersion,
    lastActuatorValues, definitionStateRef,
  });

  useEffect(() => {
    if (appMode !== 'solved') return;
    Object.values(actuators).forEach(a => {
      const lastVal = lastActuatorValues.current[a.id] || 0;
      const delta = a.value - lastVal;
      if (Math.abs(delta) > 1e-8) {
        if (!system.joints.has(a.id)) {
          const coreAxis: [number, number, number] = a.axis === 'x' ? [1, 0, 0] : (a.axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
          system.addJoint(new Joint(a.id, a.type, coreAxis));
        }
        system.applyActuatorDelta(a.id, a.pivotNode, a.movingBodies, delta);
        lastActuatorValues.current[a.id] = a.value;
      }
    });
    const result = new Executor(system).execute(sequence);
    setSolverStatus(result ? 'converged' : 'timeout');
    setVersion(v => v + 1);
  }, [actuators, appMode, system, sequence]);

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className={`sidebar-header mode-${appMode}`}>
          <h1>WiggleSolve</h1>
          <div className="demo-selector">
            <select
              value={selectedDemo}
              onChange={e => {
                const id = e.target.value;
                setSelectedDemo(id);
                if (id) {
                  const entry = demos.find(d => d.id === id);
                  if (entry) loadDemo(entry.definition);
                }
              }}
            >
              <option value="">Load Demo…</option>
              {demos.map(d => (
                <option key={d.id} value={d.id}>{d.definition.name}</option>
              ))}
            </select>
            {selectedDemo && (
              <p className="demo-description">
                {demos.find(d => d.id === selectedDemo)?.definition.description}
              </p>
            )}
          </div>
          <div className={`mode-toggle mode-${appMode}`}>
            <button className={appMode === 'definition' ? 'active' : ''} onClick={() => appMode === 'solved' && toggleMode()}>Definition</button>
            <button className={appMode === 'solved' ? 'active' : ''} onClick={() => appMode === 'definition' && toggleMode()}>Solved</button>
          </div>
          {appMode === 'solved' && solverStatus !== 'idle' && (
            <div className={`solver-status ${solverStatus}`}>
              <span className="solver-status-dot">●</span>
              {solverStatus === 'converged' ? 'Converged' : 'Timeout — increase iterations'}
            </div>
          )}
          <LiveSession onDefinitionReceived={loadDemo} />
          <p className="mode-hint">Switching to Solved mode snapshots the current definition.</p>
          <div className="tabs">
            <button className={activeTab === 'elements' ? 'active' : ''} onClick={() => setActiveTab('elements')}>Elements</button>
            <button className={activeTab === 'sequence' ? 'active' : ''} onClick={() => setActiveTab('sequence')}>Sequence</button>
          </div>
        </div>
        <div className="sidebar-content">
          {activeTab === 'elements' && (
            <DefinitionEditor
              key={selectedDemo || 'default'}
              system={system}
              version={version}
              tick={tick}
            />
          )}
          {activeTab === 'sequence' && (
            <SolverPanel
              system={system}
              sequence={sequence}
              actuators={actuators}
              setActuators={setActuators}
              version={version}
              onSequenceUpdate={() => setVersion(v => v + 1)}
            />
          )}
        </div>
      </div>
      <div className="main-view">
        <Visualizer system={system} version={version} actuators={actuators} />
      </div>
    </div>
  );
}

export default App;
