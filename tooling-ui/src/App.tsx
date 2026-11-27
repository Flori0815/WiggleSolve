import { useEffect, useState } from 'react';
import { Visualizer } from './components/Visualizer';
import type { ActuatorView } from './components/Visualizer';
import { DefinitionEditor } from './components/DefinitionEditor';
import { SolverPanel } from './components/SolverPanel';
import { LiveSession } from './components/LiveSession';
import { useMechanism } from './hooks/useMechanism';
import { DEFAULT_DEMO_ID, DEMOS } from './demos';
import './App.css';

function App() {
  const [activeTab, setActiveTab] = useState<'elements' | 'sequence'>('elements');
  const [selectedDemo, setSelectedDemo] = useState(DEFAULT_DEMO_ID);
  const { mechanism, mode, status, loadError, dismissLoadError, onChange, load, switchMode, drive } = useMechanism();

  useEffect(() => {
    const entry = DEMOS.find(d => d.id === DEFAULT_DEMO_ID);
    if (entry) load(entry.definition);
  }, [load]);

  const actuatorViews: ActuatorView[] = mechanism.actuators.map(a => ({
    id: a.id,
    type: a.type,
    axis: a.axis,
    pivotNode: a.pivotNode,
    value: mechanism.getActuatorValue(a.id),
    limits: mechanism.getActuatorLimits(a.id),
  }));
  const uiMode = mode === 'simulation' ? 'solved' : 'definition';

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className={`sidebar-header mode-${uiMode}`}>
          <h1>WiggleSolve</h1>
          <div className="demo-selector">
            <select
              value={selectedDemo}
              onChange={e => {
                const entry = DEMOS.find(d => d.id === e.target.value);
                setSelectedDemo(e.target.value);
                if (entry) load(entry.definition);
              }}
            >
              <option value="">Load Demo…</option>
              {DEMOS.map(d => (
                <option key={d.id} value={d.id}>{d.definition.name}</option>
              ))}
            </select>
            {mechanism.description && <p className="demo-description">{mechanism.description}</p>}
          </div>
          {loadError && (
            <div className="solver-status timeout" role="alert" onClick={dismissLoadError}>
              Invalid definition: {loadError}
            </div>
          )}
          <div className={`mode-toggle mode-${uiMode}`}>
            <button className={mode === 'definition' ? 'active' : ''} onClick={() => switchMode('definition')}>Definition</button>
            <button className={mode === 'simulation' ? 'active' : ''} onClick={() => switchMode('simulation')}>Solved</button>
          </div>
          {mode === 'simulation' && status.state !== 'idle' && (
            <div className={`solver-status ${status.state === 'converged' ? 'converged' : 'timeout'}`}>
              <span className="solver-status-dot">●</span>
              {status.state === 'converged' && 'Converged'}
              {status.state === 'timeout' && 'Timeout — increase iterations'}
              {status.state === 'error' && status.message}
            </div>
          )}
          <LiveSession onDefinitionReceived={def => { setSelectedDemo(''); load(def); }} />
          <p className="mode-hint">Switching to Solved mode snapshots the current definition.</p>
          <div className="tabs">
            <button className={activeTab === 'elements' ? 'active' : ''} onClick={() => setActiveTab('elements')}>Elements</button>
            <button className={activeTab === 'sequence' ? 'active' : ''} onClick={() => setActiveTab('sequence')}>Sequence</button>
          </div>
        </div>
        <div className="sidebar-content">
          {activeTab === 'elements' && (
            <DefinitionEditor mechanism={mechanism} onChange={onChange} />
          )}
          {activeTab === 'sequence' && (
            <SolverPanel mechanism={mechanism} onChange={onChange} onDrive={drive} />
          )}
        </div>
      </div>
      <div className="main-view">
        <Visualizer system={mechanism.system} actuators={actuatorViews} />
      </div>
    </div>
  );
}

export default App;
