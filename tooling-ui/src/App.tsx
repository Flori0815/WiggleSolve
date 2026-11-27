import { useCallback, useEffect, useState } from 'react';
import { ActuatorsEditor } from './components/editor/ActuatorsEditor';
import { ElementsEditor } from './components/editor/ElementsEditor';
import { SequenceEditor } from './components/editor/SequenceEditor';
import { LiveSession } from './components/LiveSession';
import { MechanismPicker } from './components/MechanismPicker';
import { DrivePanel } from './components/simulation/DrivePanel';
import type { ActuatorView } from './components/viewport/ActuatorGizmos';
import { Visualizer } from './components/viewport/Visualizer';
import { DEFAULT_DEMO_ID, DEMOS } from './demos';
import { useMechanism } from './hooks/useMechanism';
import type { SolverStatus } from './hooks/useMechanism';
import './App.css';

type EditTab = 'elements' | 'actuators' | 'solver';

const EDIT_TABS: Array<{ id: EditTab; label: string }> = [
  { id: 'elements', label: 'Bodies & nodes' },
  { id: 'actuators', label: 'Actuators' },
  { id: 'solver', label: 'Solver' },
];

const StatusBanner = ({ status }: { status: SolverStatus }) => {
  if (status.state === 'idle') return null;
  let text = 'All loops closed';
  if (status.state === 'error') text = status.message;
  if (status.state === 'timeout') {
    text = status.jointsAtLimit.length > 0
      ? `Not converged — at joint limit: ${status.jointsAtLimit.join(', ')}`
      : 'Not converged — check the loop setup or raise max iterations';
  }
  return <div className={`status status-${status.state}`} role="status">{text}</div>;
};

function download(name: string, json: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [tab, setTab] = useState<EditTab>('elements');
  const [selectedDemo, setSelectedDemo] = useState(DEFAULT_DEMO_ID);
  const {
    mechanism, loadCount, mode, status, loadError,
    dismissLoadError, reportLoadError, onChange, load, switchMode, drive,
  } = useMechanism();

  const selectDemo = useCallback((id: string) => {
    const entry = DEMOS.find(d => d.id === id);
    if (entry && load(entry.definition)) setSelectedDemo(id);
  }, [load]);

  useEffect(() => { selectDemo(DEFAULT_DEMO_ID); }, [selectDemo]);

  const loadCustom = useCallback((json: unknown) => {
    if (load(json)) setSelectedDemo('');
  }, [load]);

  const actuatorViews: ActuatorView[] = mechanism.actuators.map(a => ({
    id: a.id,
    type: a.type,
    axis: a.axis,
    pivotNode: a.pivotNode,
    value: mechanism.getActuatorValue(a.id),
    limits: mechanism.getActuatorLimits(a.id),
  }));

  return (
    <div className={`app mode-${mode}`}>
      <aside className="sidebar">
        <header className="sidebar-header">
          <h1>WiggleSolve</h1>
          <MechanismPicker
            selectedId={selectedDemo}
            onSelect={selectDemo}
            onImport={(json, fileName) => (json === undefined ? reportLoadError(`${fileName} is not valid JSON.`) : loadCustom(json))}
            onExport={() => download(`${mechanism.name.replace(/[^\w-]+/g, '_') || 'mechanism'}.json`, mechanism.toDefinition())}
            canExport={mode === 'edit'}
          />
          {mechanism.description && <p className="description">{mechanism.description}</p>}
          {loadError && (
            <div className="status status-error" role="alert">
              <pre>{loadError}</pre>
              <button className="btn-link" onClick={dismissLoadError}>Dismiss</button>
            </div>
          )}

          <div className="segmented mode-switch" role="tablist" aria-label="Mode">
            <button role="tab" aria-selected={mode === 'edit'} className={mode === 'edit' ? 'active' : ''} onClick={() => switchMode('edit')}>
              Edit
            </button>
            <button role="tab" aria-selected={mode === 'simulate'} className={mode === 'simulate' ? 'active' : ''} onClick={() => switchMode('simulate')}>
              Simulate
            </button>
          </div>
          <p className="field-hint">
            {mode === 'edit'
              ? 'Build the mechanism in its reference pose.'
              : 'Move the drives; the solver closes all loops. Back to Edit restores the reference pose.'}
          </p>

          {mode === 'edit' && (
            <nav className="tabs" role="tablist" aria-label="Editor sections">
              {EDIT_TABS.map(t => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
                  {t.label}
                </button>
              ))}
            </nav>
          )}
        </header>

        <div className="sidebar-content">
          {mode === 'simulate' ? (
            <>
              <StatusBanner status={status} />
              <DrivePanel mechanism={mechanism} onDrive={drive} />
            </>
          ) : (
            <>
              {tab === 'elements' && <ElementsEditor mechanism={mechanism} onChange={onChange} />}
              {tab === 'actuators' && <ActuatorsEditor mechanism={mechanism} onChange={onChange} />}
              {tab === 'solver' && <SequenceEditor mechanism={mechanism} onChange={onChange} />}
            </>
          )}
        </div>

        <footer className="sidebar-footer">
          <LiveSession onDefinitionReceived={loadCustom} />
        </footer>
      </aside>

      <main className="main-view">
        <Visualizer system={mechanism.system} actuators={actuatorViews} frameKey={loadCount} />
      </main>
    </div>
  );
}

export default App;
