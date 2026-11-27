import { axisName, axisVector } from '@wigglesolve/core';
import type { Instruction, Mechanism } from '@wigglesolve/core';
import { JointConfigEditor } from './JointConfigEditor';

type Props = {
  instr: Instruction;
  mechanism: Mechanism;
  onUpdate: () => void;
  onDelete: () => void;
  allNodes: string[];
  allBodies: string[];
};

export const InstructionItem = ({ instr, mechanism, onUpdate, onDelete, allNodes, allBodies }: Props) => {
  if (instr.type === 'loop') {
    return (
      <div className="sequence-item loop">
        <div className="item-row">
          <span className="bold">LOOP</span>
          <button className="del-btn" aria-label="Delete loop instruction" onClick={onDelete}>×</button>
        </div>
        <div className="item-details">
          <div className="slider-row">
            <span className="tiny">Iterations: {instr.max_iterations}</span>
            <input
              type="range" min={1} max={500}
              value={instr.max_iterations}
              onChange={e => { instr.max_iterations = parseInt(e.target.value); onUpdate(); }}
            />
          </div>
          <div className="condition-box">
            <span className="tiny">Until</span>
            <select value={instr.condition.nodeA} onChange={e => { instr.condition.nodeA = e.target.value; onUpdate(); }}>
              <option value="">Node A...</option>
              {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
            <span className="tiny">reaches</span>
            <select value={instr.condition.nodeB} onChange={e => { instr.condition.nodeB = e.target.value; onUpdate(); }}>
              <option value="">Node B...</option>
              {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
        <div className="nested-steps">
          {instr.steps.map((s, i) => (
            <InstructionItem
              key={`step-${i}`}
              instr={s}
              mechanism={mechanism}
              onUpdate={onUpdate}
              onDelete={() => { instr.steps.splice(i, 1); onUpdate(); }}
              allNodes={allNodes}
              allBodies={allBodies}
            />
          ))}
          <div className="add-nested-row">
            <button className="add-nested-btn" onClick={() => { mechanism.addAlignStep(instr); onUpdate(); }}>+ Align</button>
          </div>
        </div>
      </div>
    );
  }

  const op = instr.operation;
  const joint = mechanism.system.joints.get(op.jointId);

  return (
    <div className="sequence-item op">
      <div className="item-row">
        <span className="bold">ALIGN · {op.jointId}</span>
        <button className="del-btn" aria-label="Delete align instruction" onClick={onDelete}>×</button>
      </div>
      <div className="op-form">
        {joint && joint.type !== 'fixed' ? (
          <JointConfigEditor
            config={{ type: joint.type, axis: axisName(joint.axis) }}
            onChange={update => {
              if (update.type) joint.type = update.type;
              if (update.axis) joint.axis = axisVector(update.axis);
              onUpdate();
            }}
          />
        ) : (
          <p className="empty-state">Joint '{op.jointId}' is not defined.</p>
        )}
        <div className="align-row">
          <select value={op.effectorNode} onChange={e => { op.effectorNode = e.target.value; onUpdate(); }}>
            <option value="">Effector...</option>
            {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
          <select value={op.targetNode} onChange={e => { op.targetNode = e.target.value; onUpdate(); }}>
            <option value="">Target...</option>
            {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        <div className="align-row">
          <select value={op.pivotNode} onChange={e => { op.pivotNode = e.target.value; onUpdate(); }}>
            <option value="">Pivot...</option>
            {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </div>
        <div className="joint-chips">
          {allBodies.map(id => (
            <label key={id} className={`chip ${op.movingBodies.includes(id) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={op.movingBodies.includes(id)}
                onChange={e => {
                  op.movingBodies = e.target.checked ? [...op.movingBodies, id] : op.movingBodies.filter(v => v !== id);
                  onUpdate();
                }}
              />
              {id}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
