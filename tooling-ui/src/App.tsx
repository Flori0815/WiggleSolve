import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  KinematicSystem,
  Node,
  Joint,
  RigidBody,
  Matrix4x4,
  Executor
} from 'core-js/src/index';
import type { Instruction } from 'core-js/src/index';
import { Visualizer } from './components/Visualizer';
import { DEMOS } from './demos/index';
import type { DemoDefinition, DemoActuatorDef } from './demos/index';
import { DemoDefinitionSchema } from './schema';
import './App.css';

// --- Types ---

type UIJointConfig = {
  type: 'revolute' | 'prismatic';
  axis: 'x' | 'y' | 'z';
};

type UIActuator = UIJointConfig & {
  id: string;
  pivotNode: string;
  movingBodies: string[];
  value: number;
};

type InlineInputState = {
  isOpen: boolean;
  value: string;
  error: string;
};

// --- Components ---

const InlineIdInput = ({
  isOpen,
  value,
  error,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Enter ID…'
}: {
  isOpen: boolean;
  value: string;
  error: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  placeholder?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      onSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="inline-input-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="inline-id-input"
      />
      {error && <div className="inline-error">{error}</div>}
    </div>
  );
};

// --- Demo Loading Helpers ---

function matrixFromArray(arr: number[]): Matrix4x4 {
  const m = new Matrix4x4();
  m.elements = new Float32Array(arr);
  return m;
}

function assembleKinematicChain(system: KinematicSystem, actuators: DemoActuatorDef[]): void {
  const allMovingBodyIds = new Set<string>(actuators.flatMap(a => a.movingBodies));
  const positioned = new Set<string>(
    [...system.bodies.keys()].filter(id => !allMovingBodyIds.has(id)),
  );
  for (const id of positioned) system.bodies.get(id)!.updateNodes();

  let progress = true;
  while (progress) {
    progress = false;
    for (const [bodyId, body] of system.bodies) {
      if (positioned.has(bodyId)) continue;
      let best: DemoActuatorDef | null = null;
      for (const act of actuators) {
        if (!act.movingBodies.includes(bodyId)) continue;
        let pivotBodyPositioned = false;
        for (const [bid, b] of system.bodies) {
          if (b.nodes.has(act.pivotNode) && positioned.has(bid)) { pivotBodyPositioned = true; break; }
        }
        if (!pivotBodyPositioned) continue;
        if (!best || act.movingBodies.length < best.movingBodies.length) best = act;
      }
      if (!best) continue;
      const pivot = system.nodes.get(best.pivotNode)!;
      const [px, py, pz] = pivot.absoluteTransform.getTranslation();
      body.transform = new Matrix4x4().translate(px, py, pz);
      body.updateNodes();
      positioned.add(bodyId);
      progress = true;
    }
  }
}

// --- Helper Functions ---

function cloneSystemState(system: KinematicSystem) {
  const jointValues: Record<string, number> = {};
  system.joints.forEach((j, id) => { jointValues[id] = j.value; });
  const bodyTransforms: Record<string, Float32Array> = {};
  system.bodies.forEach((b, id) => { bodyTransforms[id] = new Float32Array(b.transform.elements); });
  const nodeLocals: Record<string, Float32Array> = {};
  system.nodes.forEach((n, id) => { nodeLocals[id] = new Float32Array(n.localTransform.elements); });
  return { jointValues, bodyTransforms, nodeLocals };
}

function restoreSystemState(system: KinematicSystem, state: ReturnType<typeof cloneSystemState>) {
  system.joints.forEach((j, id) => { if (state.jointValues[id] !== undefined) j.value = state.jointValues[id]; });
  system.bodies.forEach((b, id) => { if (state.bodyTransforms[id]) b.transform.elements.set(state.bodyTransforms[id]); });
  system.nodes.forEach((n, id) => { if (state.nodeLocals[id]) n.localTransform.elements.set(state.nodeLocals[id]); });
  system.updateForwardKinematics();
}

const JointConfigEditor = ({ config, onUpdate }: { config: UIJointConfig, onUpdate: () => void }) => (
  <div className="joint-config-box">
    <div className="item-row small">
      <span>Type:</span>
      <select value={config.type} onChange={e => { config.type = e.target.value as any; onUpdate(); }}>
        <option value="revolute">Revolute</option>
        <option value="prismatic">Prismatic</option>
      </select>
    </div>
    <div className="item-row small">
      <span>Axis:</span>
      <div className="axis-radios">
        {(['x', 'y', 'z'] as const).map(a => (
          <label key={a} className={`radio-chip ${config.axis === a ? 'active' : ''}`}>
            <input type="radio" checked={config.axis === a} onChange={() => { config.axis = a; onUpdate(); }} />
            {a.toUpperCase()}
          </label>
        ))}
      </div>
    </div>
  </div>
);

const NodeEditor = ({ node, isGlobal, collapsed, onToggleCollapse, onDelete, onUpdate, allNodes }: any) => (
  <div className="item">
    <div className="item-row clickable" onClick={onToggleCollapse}>
      <span className="bold">{collapsed ? '▶' : '▼'} {node.id} {isGlobal && '(Global)'}</span>
      <button className="del-btn" aria-label={`Delete node ${node.id}`} onClick={(e) => { e.stopPropagation(); onDelete(); }}>×</button>
    </div>
    {!collapsed && (
      <div className="item-details">
         <label className="tiny"><input type="checkbox" checked={node.isLocked} onChange={e => { node.isLocked = e.target.checked; onUpdate(); }}/> Locked</label>
         {['x','y','z'].map((axis, i) => (
            <div key={axis} className="slider-row">
              <span className="tiny">{isGlobal ? 'Pos' : 'Local'} {axis.toUpperCase()}: {(isGlobal ? node.absoluteTransform.getTranslation()[i] : node.localTransform.getTranslation()[i]).toFixed(2)}</span>
              <input type="range" min={-2} max={2} step={0.01} 
                value={isGlobal ? node.absoluteTransform.getTranslation()[i] : node.localTransform.getTranslation()[i]} 
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  const pos = (isGlobal ? node.absoluteTransform : node.localTransform).getTranslation();
                  pos[i] = val;
                  if (isGlobal) node.absoluteTransform = new Matrix4x4().translate(pos[0], pos[1], pos[2]);
                  else node.localTransform = new Matrix4x4().translate(pos[0], pos[1], pos[2]);
                  onUpdate();
                }} 
              />
            </div>
         ))}
         <div className="alignment-section">
            <span className="tiny" style={{color: '#c084fc', marginTop: '5px'}}>LookAt Align:</span>
            <div className="align-row">
               <select value={node.alignment.primaryAxis || ''} onChange={e => { node.alignment.primaryAxis = e.target.value as any; onUpdate(); }}>
                  <option value="">Axis...</option><option value="x">X</option><option value="y">Y</option><option value="z">Z</option>
               </select>
               <select value={node.alignment.primaryTarget || ''} onChange={e => { node.alignment.primaryTarget = e.target.value; onUpdate(); }}>
                  <option value="">Target...</option>
                  {allNodes.filter((id: string) => id !== node.id).map((id: string) => <option key={id} value={id}>{id}</option>)}
               </select>
            </div>
         </div>
      </div>
    )}
  </div>
);

const InstructionItem = ({ instr, onUpdate, onDelete, allNodes, allBodies, system }: any) => {
  if (instr.type === 'loop') {
    return (
      <div className="sequence-item loop">
        <div className="item-row"><span className="bold">LOOP</span><button className="del-btn" aria-label="Delete loop instruction" onClick={onDelete}>×</button></div>
        <div className="item-details">
           <div className="slider-row"><span className="tiny">Iterations: {instr.max_iterations}</span>
           <input type="range" min={1} max={500} value={instr.max_iterations} onChange={e => { instr.max_iterations = parseInt(e.target.value); onUpdate(); }} /></div>
           <div className="condition-box">
             <span className="tiny">Target Node:</span>
             <select value={instr.condition.nodeB} onChange={e => { instr.condition.nodeB = e.target.value; onUpdate(); }}><option value="">Select...</option>{allNodes.map((id: string) => <option key={id} value={id}>{id}</option>)}</select>
           </div>
        </div>
        <div className="nested-steps">
          {instr.steps.map((s: any, i: number) => (
            <InstructionItem key={`step-${i}`} instr={s} onUpdate={onUpdate} onDelete={() => { instr.steps.splice(i, 1); onUpdate(); }} allNodes={allNodes} allBodies={allBodies} system={system} />
          ))}
          <div className="add-nested-row">
            <button className="add-nested-btn" onClick={() => { instr.steps.push({ type: 'operation', operation: { type: 'align_node', effectorNode: '', targetNode: '', pivotNode: '', jointId: `j${Math.random().toString(36).substr(2,4)}`, movingBodies: [] } }); onUpdate(); }}>+ Align</button>
          </div>
        </div>
      </div>
    );
  } else {
    const op = instr.operation;
    let joint = system.joints.get(op.jointId);
    if (!joint) { joint = new Joint(op.jointId); system.addJoint(joint); }
    if (!(op as any).config) {
      const axisStr: 'x' | 'y' | 'z' = joint.axis[0] === 1 ? 'x' : (joint.axis[1] === 1 ? 'y' : 'z');
      (op as any).config = { type: joint.type, axis: axisStr };
    }
    return (
      <div className="sequence-item op">
        <div className="item-row"><span className="bold">ALIGN</span><button className="del-btn" aria-label="Delete align instruction" onClick={onDelete}>×</button></div>
        <div className="op-form">
          <JointConfigEditor config={(op as any).config} onUpdate={() => {
              const coreAxis: [number, number, number] = (op as any).config.axis === 'x' ? [1,0,0] : ((op as any).config.axis === 'y' ? [0,1,0] : [0,0,1]);
              joint!.type = (op as any).config.type; joint!.axis = coreAxis; onUpdate();
          }} />
          <div className="align-row">
            <select value={op.effectorNode} onChange={e => { op.effectorNode = e.target.value; onUpdate(); }}><option value="">Effector...</option>{allNodes.map((id: string) => <option key={id} value={id}>{id}</option>)}</select>
            <select value={op.targetNode} onChange={e => { op.targetNode = e.target.value; onUpdate(); }}><option value="">Target...</option>{allNodes.map((id: string) => <option key={id} value={id}>{id}</option>)}</select>
          </div>
          <div className="align-row">
            <select value={op.pivotNode} onChange={e => { op.pivotNode = e.target.value; onUpdate(); }}><option value="">Pivot...</option>{allNodes.map((id: string) => <option key={id} value={id}>{id}</option>)}</select>
          </div>
          <div className="joint-chips">
            {allBodies.map((id: string) => (
              <label key={id} className={`chip ${op.movingBodies.includes(id) ? 'active' : ''}`}>
                <input type="checkbox" checked={op.movingBodies.includes(id)} onChange={e => { if (e.target.checked) op.movingBodies.push(id); else op.movingBodies = op.movingBodies.filter((v: any) => v !== id); onUpdate(); }} />
                {id}
              </label>
            ))}
          </div>
        </div>
      </div>
    );
  }
};

// --- Main App ---

function App() {
  const [version, setVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<'elements' | 'sequence'>('elements');
  const [appMode, setAppMode] = useState<'definition' | 'solved'>('definition');
  const [solverStatus, setSolverStatus] = useState<'idle' | 'converged' | 'timeout'>('idle');
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
  const [actuators, setActuators] = useState<Record<string, UIActuator>>({});
  const [globalNodeInput, setGlobalNodeInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });
  const [bodyInput, setBodyInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });
  const [bodyNodeInput, setBodyNodeInput] = useState<InlineInputState & { bodyId?: string }>({ isOpen: false, value: '', error: '', bodyId: undefined });
  const [actuatorInput, setActuatorInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });
  const [selectedDemo, setSelectedDemo] = useState<string>('');
  const definitionStateRef = useRef<ReturnType<typeof cloneSystemState> | null>(null);
  const lastActuatorValues = useRef<Record<string, number>>({});

  const system = useMemo(() => {
    const s = new KinematicSystem();
    const target = new Node('target');
    target.absoluteTransform = new Matrix4x4().translate(1, 1, 0);
    s.addNode(target);
    const base = new RigidBody('base_body');
    const pivot = new Node('pivot');
    pivot.alignment = { primaryAxis: 'x', primaryTarget: 'target', secondaryAxis: null, secondaryTarget: null };
    base.addNode(pivot);
    const arm = new RigidBody('arm_body');
    const tip = new Node('arm_end');
    tip.localTransform = new Matrix4x4().translate(0.5, 0, 0);
    arm.addNode(tip);
    s.addBody(base); s.addBody(arm);
    s.updateForwardKinematics();
    return s;
  }, []);

  const [sequence] = useState<Instruction[]>([{
    type: 'loop', max_iterations: 100,
    condition: { type: 'distance_less_than', nodeA: 'arm_end', nodeB: 'target', threshold: 0.01 },
    steps: [{ type: 'operation', operation: { type: 'align_node', effectorNode: 'arm_end', targetNode: 'target', pivotNode: 'pivot', jointId: 'auto_j1', movingBodies: ['arm_body'] } }]
  }]);

  const loadDemo = useCallback((def: DemoDefinition) => {
    const result = DemoDefinitionSchema.safeParse(def);
    if (!result.success) {
      console.error('Invalid Demo Definition:', result.error.format());
      alert(`Failed to load demo: ${result.error.issues[0].path.join('.')} - ${result.error.issues[0].message}`);
      return;
    }

    const validatedDef = result.data;

    setAppMode('definition');
    setSolverStatus('idle');
    lastActuatorValues.current = {};
    definitionStateRef.current = null;

    system.bodies.clear();
    system.nodes.clear();
    system.joints.clear();

    for (const bodyDef of validatedDef.system.bodies) {
      const body = new RigidBody(bodyDef.id);
      for (const nodeDef of bodyDef.nodes) {
        const node = new Node(nodeDef.id);
        node.localTransform = matrixFromArray(nodeDef.localTransform);
        body.addNode(node);
      }
      system.addBody(body);
    }

    for (const nodeDef of validatedDef.system.globalNodes) {
      const node = new Node(nodeDef.id);
      node.absoluteTransform = matrixFromArray(nodeDef.absoluteTransform);
      system.addNode(node);
    }

    for (const jointDef of validatedDef.system.joints) {
      system.addJoint(new Joint(jointDef.id, jointDef.type, jointDef.axis as [number, number, number], 0, jointDef.limits as [number, number]));
    }

    assembleKinematicChain(system, validatedDef.actuators);
    system.updateForwardKinematics();

    const newActuators: Record<string, UIActuator> = {};
    for (const a of validatedDef.actuators) {
      newActuators[a.id] = { id: a.id, type: a.type, axis: a.axis, pivotNode: a.pivotNode, movingBodies: [...a.movingBodies], value: 0 };
    }
    setActuators(newActuators);

    sequence.splice(0, sequence.length, ...validatedDef.sequence.map(raw => {
      const instr: Instruction = {
        type: 'loop',
        max_iterations: raw.max_iterations,
        condition: raw.condition as any,
        steps: raw.steps.map(step => ({
          type: 'operation' as const,
          operation: step.operation as any,
        })),
      };
      return instr;
    }));

    setCollapsedItems(new Set());
    setVersion(v => v + 1);
  }, [system, sequence]);

  const incrementVersion = useCallback(() => {
    if (appMode === 'definition') {
        system.nodes.forEach(n => system.solveNodeAlignment(n.id));
    }
    system.updateForwardKinematics();
    setVersion(v => v + 1);
  }, [system, appMode]);

  const addGlobalNode = useCallback((id: string) => {
    if (!id.trim()) {
      setGlobalNodeInput(s => ({ ...s, error: 'ID cannot be empty' }));
      return;
    }
    if (system.nodes.has(id)) {
      setGlobalNodeInput(s => ({ ...s, error: `Node '${id}' already exists` }));
      return;
    }
    system.addNode(new Node(id));
    setGlobalNodeInput({ isOpen: false, value: '', error: '' });
    incrementVersion();
  }, [system, incrementVersion]);

  const addBody = useCallback((id: string) => {
    if (!id.trim()) {
      setBodyInput(s => ({ ...s, error: 'ID cannot be empty' }));
      return;
    }
    if (system.bodies.has(id)) {
      setBodyInput(s => ({ ...s, error: `Body '${id}' already exists` }));
      return;
    }
    system.addBody(new RigidBody(id));
    setBodyInput({ isOpen: false, value: '', error: '' });
    incrementVersion();
  }, [system, incrementVersion]);

  const addBodyNode = useCallback((bodyId: string, id: string) => {
    if (!id.trim()) {
      setBodyNodeInput(s => ({ ...s, error: 'ID cannot be empty' }));
      return;
    }
    if (system.nodes.has(id)) {
      setBodyNodeInput(s => ({ ...s, error: `Node '${id}' already exists` }));
      return;
    }
    const n = new Node(id);
    system.addNode(n, bodyId);
    setBodyNodeInput({ isOpen: false, value: '', error: '', bodyId: undefined });
    incrementVersion();
  }, [system, incrementVersion]);

  const addActuator = useCallback((id: string) => {
    if (!id.trim()) {
      setActuatorInput(s => ({ ...s, error: 'ID cannot be empty' }));
      return;
    }
    if (actuators[id]) {
      setActuatorInput(s => ({ ...s, error: `Actuator '${id}' already exists` }));
      return;
    }
    setActuators({...actuators, [id]: {id, type:'revolute', axis:'z', pivotNode:'', movingBodies:[], value:0}});
    setActuatorInput({ isOpen: false, value: '', error: '' });
  }, [actuators]);

  useEffect(() => {
    if (appMode === 'solved') {
      Object.values(actuators).forEach(a => {
        const lastVal = lastActuatorValues.current[a.id] || 0;
        const delta = a.value - lastVal;
        if (Math.abs(delta) > 1e-8) {
            if (!system.joints.has(a.id)) {
                const coreAxis: [number, number, number] = a.axis === 'x' ? [1,0,0] : (a.axis === 'y' ? [0,1,0] : [0,0,1]);
                system.addJoint(new Joint(a.id, a.type, coreAxis));
            }
            system.applyActuatorDelta(a.id, a.pivotNode, a.movingBodies, delta);
            lastActuatorValues.current[a.id] = a.value;
        }
      });
      const result = new Executor(system).execute(sequence);
      setSolverStatus(result ? 'converged' : 'timeout');
      setVersion(v => v + 1);
    }
  }, [actuators, appMode, system, sequence]);

  const toggleMode = () => {
    if (appMode === 'definition') {
      definitionStateRef.current = cloneSystemState(system);
      setAppMode('solved');
    } else {
      if (definitionStateRef.current) restoreSystemState(system, definitionStateRef.current);
      lastActuatorValues.current = {};
      setSolverStatus('idle');
      setAppMode('definition');
    }
    setVersion(v => v + 1);
  };

  const allNodeIds = useMemo(() => Array.from(system.nodes.keys()), [system.nodes.size, version]);
  const allBodyIds = useMemo(() => Array.from(system.bodies.keys()), [system.bodies.size, version]);

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
                  const entry = DEMOS.find(d => d.id === id);
                  if (entry) loadDemo(entry.definition);
                }
              }}
            >
              <option value="">Load Demo…</option>
              {DEMOS.map(d => (
                <option key={d.id} value={d.id}>{d.definition.name}</option>
              ))}
            </select>
            {selectedDemo && (
              <p className="demo-description">
                {DEMOS.find(d => d.id === selectedDemo)?.definition.description}
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
          <p className="mode-hint">Switching to Solved mode snapshots the current definition.</p>
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
                  {globalNodeInput.isOpen ? (
                    <InlineIdInput
                      isOpen={globalNodeInput.isOpen}
                      value={globalNodeInput.value}
                      error={globalNodeInput.error}
                      onChange={v => setGlobalNodeInput(s => ({ ...s, value: v, error: '' }))}
                      onSubmit={() => addGlobalNode(globalNodeInput.value)}
                      onCancel={() => setGlobalNodeInput({ isOpen: false, value: '', error: '' })}
                      placeholder="Node ID…"
                    />
                  ) : (
                    <>
                      <h3>Global Nodes</h3>
                      <button className="add-btn" aria-label="Add global node" onClick={() => setGlobalNodeInput({ isOpen: true, value: '', error: '' })}>+</button>
                    </>
                  )}
                </div>
                {allNodeIds.filter(id => !allBodyIds.some(bid => system.bodies.get(bid)!.nodes.has(id))).length === 0 && (
                  <p className="empty-state">Add a node to place a standalone coordinate frame — useful for targets and world anchors.</p>
                )}
                {allNodeIds.filter(id => !allBodyIds.some(bid => system.bodies.get(bid)!.nodes.has(id))).map(id => (
                  <NodeEditor key={id} node={system.nodes.get(id)} isGlobal collapsed={collapsedItems.has(id)} onToggleCollapse={() => setCollapsedItems(prev => {const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })} onDelete={() => { system.nodes.delete(id); incrementVersion(); }} onUpdate={incrementVersion} allNodes={allNodeIds} />
                ))}
              </section>
              <section>
                <div className="section-header">
                  {bodyInput.isOpen ? (
                    <InlineIdInput
                      isOpen={bodyInput.isOpen}
                      value={bodyInput.value}
                      error={bodyInput.error}
                      onChange={v => setBodyInput(s => ({ ...s, value: v, error: '' }))}
                      onSubmit={() => addBody(bodyInput.value)}
                      onCancel={() => setBodyInput({ isOpen: false, value: '', error: '' })}
                      placeholder="Body ID…"
                    />
                  ) : (
                    <>
                      <h3>Rigid Bodies</h3>
                      <button className="add-btn" aria-label="Add rigid body" onClick={() => setBodyInput({ isOpen: true, value: '', error: '' })}>+</button>
                    </>
                  )}
                </div>
                {allBodyIds.length === 0 && (
                  <p className="empty-state">Add a body to group nodes that move together as a rigid unit.</p>
                )}
                {allBodyIds.map(id => { const b = system.bodies.get(id)!; return (
                  <div key={id} className="item"><div className="item-row clickable" onClick={() => setCollapsedItems(prev => {const n = new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; })}><span className="bold">{collapsedItems.has(id) ? '▶' : '▼'} {id}</span><button className="del-btn" aria-label={`Delete body ${id}`} onClick={() => { system.bodies.delete(id); incrementVersion(); }}>×</button></div>
                  {!collapsedItems.has(id) && <div className="item-details">
                    {['x','y','z'].map((axis, i) => (
                      <div key={axis} className="slider-row"><span className="tiny">World {axis.toUpperCase()}</span><input type="range" min={-2} max={2} step={0.01} value={b.transform.getTranslation()[i]} onChange={e => { const p = b.transform.getTranslation(); p[i] = parseFloat(e.target.value); b.transform = new Matrix4x4().translate(p[0],p[1],p[2]); incrementVersion(); }} /></div>
                    ))}
                    <div className="nested-nodes"><div className="section-header small">
                      {bodyNodeInput.isOpen && bodyNodeInput.bodyId === id ? (
                        <InlineIdInput
                          isOpen={bodyNodeInput.isOpen}
                          value={bodyNodeInput.value}
                          error={bodyNodeInput.error}
                          onChange={v => setBodyNodeInput(s => ({ ...s, value: v, error: '' }))}
                          onSubmit={() => addBodyNode(id, bodyNodeInput.value)}
                          onCancel={() => setBodyNodeInput({ isOpen: false, value: '', error: '', bodyId: undefined })}
                          placeholder="Node ID…"
                        />
                      ) : (
                        <>
                          <span>Attached Nodes</span>
                          <button className="add-btn tiny" aria-label={`Add node to ${id}`} onClick={() => setBodyNodeInput({ isOpen: true, value: '', error: '', bodyId: id })}>+</button>
                        </>
                      )}
                    </div>
                    {Array.from(b.nodes.values()).map(n => <NodeEditor key={n.id} node={n} collapsed={collapsedItems.has(n.id)} onToggleCollapse={() => setCollapsedItems(prev => {const n2 = new Set(prev); if(n2.has(n.id)) n2.delete(n.id); else n2.add(n.id); return n2; })} onDelete={() => { b.nodes.delete(n.id); system.nodes.delete(n.id); incrementVersion(); }} onUpdate={incrementVersion} allNodes={allNodeIds} />)}</div>
                  </div>}</div>
                );})}
              </section>
            </div>
          )}
          {activeTab === 'sequence' && (
            <div className="sequence-tab">
               <section>
                 <div className="section-header">
                   {actuatorInput.isOpen ? (
                     <InlineIdInput
                       isOpen={actuatorInput.isOpen}
                       value={actuatorInput.value}
                       error={actuatorInput.error}
                       onChange={v => setActuatorInput(s => ({ ...s, value: v, error: '' }))}
                       onSubmit={() => addActuator(actuatorInput.value)}
                       onCancel={() => setActuatorInput({ isOpen: false, value: '', error: '' })}
                       placeholder="Actuator ID…"
                     />
                   ) : (
                     <>
                       <h3>Actuators</h3>
                       <button className="add-btn" aria-label="Add actuator" onClick={() => setActuatorInput({ isOpen: true, value: '', error: '' })}>+</button>
                     </>
                   )}
                 </div>
                 {Object.keys(actuators).length === 0 && (
                   <p className="empty-state">Add an actuator to drive a joint manually with the slider in Solved mode.</p>
                 )}
                 {Object.values(actuators).map(a => (
                   <div key={a.id} className="item"><div className="item-row"><span className="bold tiny">{a.id}</span><button className="del-btn" aria-label={`Delete actuator ${a.id}`} onClick={() => { const n = {...actuators}; delete n[a.id]; setActuators(n); }}>×</button></div>
                   <JointConfigEditor config={a} onUpdate={() => setVersion(v => v + 1)} />
                   <div className="op-form">
                     <select value={a.pivotNode} onChange={e => { a.pivotNode = e.target.value; setVersion(v => v + 1); }}><option value="">Select Pivot...</option>{allNodeIds.map(id => <option key={id} value={id}>{id}</option>)}</select>
                     <div className="joint-chips">{allBodyIds.map(id => <label key={id} className={`chip ${a.movingBodies.includes(id)?'active':''}`}><input type="checkbox" checked={a.movingBodies.includes(id)} onChange={e => { if(e.target.checked) a.movingBodies.push(id); else a.movingBodies = a.movingBodies.filter(v => v!==id); setVersion(v=>v+1); }} />{id}</label>)}</div>
                   </div>
                   <div className="slider-row" style={{marginTop:'10px'}}><span className="tiny">Drive: {a.value.toFixed(2)}</span><input type="range" min={-Math.PI} max={Math.PI} step={0.01} value={a.value} onChange={e => setActuators({...actuators, [a.id]:{...a, value:parseFloat(e.target.value)}})} /></div>
                   </div>
                 ))}
               </section>
               <section>
                 <div className="section-header"><h3>Loop Logic</h3></div>
                 <div className="sequence-tree">
                   {sequence.length === 0 && (
                     <p className="empty-state">Add a loop to define the iterative constraint-solving sequence.</p>
                   )}
                   {sequence.map((instr, i) => <InstructionItem key={`root-${i}`} instr={instr} onUpdate={() => setVersion(v => v + 1)} onDelete={() => { sequence.splice(i, 1); setVersion(v => v + 1); }} allNodes={allNodeIds} allBodies={allBodyIds} system={system} />)}
                 </div>
               </section>
            </div>
          )}
        </div>
      </div>
      <div className="main-view"><Visualizer system={system} version={version} actuators={actuators} /></div>
    </div>
  );
}

export default App;