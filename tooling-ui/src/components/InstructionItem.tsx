import { Joint, KinematicSystem } from 'core-js/src/index';
import type { Instruction, Operation } from 'core-js/src/index';
import { JointConfigEditor } from './JointConfigEditor';
import type { UIJointConfig } from '../types';

type OperationWithUIConfig = Operation & { config?: UIJointConfig };

type Props = {
  instr: Instruction;
  onUpdate: () => void;
  onDelete: () => void;
  allNodes: string[];
  allBodies: string[];
  system: KinematicSystem;
};

export const InstructionItem = ({ instr, onUpdate, onDelete, allNodes, allBodies, system }: Props) => {
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
            <span className="tiny">Target Node:</span>
            <select value={instr.condition.nodeB} onChange={e => { instr.condition.nodeB = e.target.value; onUpdate(); }}>
              <option value="">Select...</option>
              {allNodes.map(id => <option key={id} value={id}>{id}</option>)}
            </select>
          </div>
        </div>
        <div className="nested-steps">
          {instr.steps.map((s, i) => (
            <InstructionItem
              key={`step-${i}`}
              instr={s}
              onUpdate={onUpdate}
              onDelete={() => { instr.steps.splice(i, 1); onUpdate(); }}
              allNodes={allNodes}
              allBodies={allBodies}
              system={system}
            />
          ))}
          <div className="add-nested-row">
            <button className="add-nested-btn" onClick={() => {
              instr.steps.push({
                type: 'operation',
                operation: {
                  type: 'align_node',
                  effectorNode: '',
                  targetNode: '',
                  pivotNode: '',
                  jointId: `j${Math.random().toString(36).substr(2, 4)}`,
                  movingBodies: [],
                },
              });
              onUpdate();
            }}>+ Align</button>
          </div>
        </div>
      </div>
    );
  }

  const op = instr.operation;
  const opWithConfig = op as OperationWithUIConfig;
  let joint = system.joints.get(op.jointId);
  if (!joint) { joint = new Joint(op.jointId); system.addJoint(joint); }
  if (!opWithConfig.config) {
    const axisStr: 'x' | 'y' | 'z' = joint.axis[0] === 1 ? 'x' : (joint.axis[1] === 1 ? 'y' : 'z');
    opWithConfig.config = { type: joint.type, axis: axisStr };
  }
  const uiConfig = opWithConfig.config as UIJointConfig;

  return (
    <div className="sequence-item op">
      <div className="item-row">
        <span className="bold">ALIGN</span>
        <button className="del-btn" aria-label="Delete align instruction" onClick={onDelete}>×</button>
      </div>
      <div className="op-form">
        <JointConfigEditor
          config={uiConfig}
          onChange={update => {
            Object.assign(uiConfig, update);
            const coreAxis: [number, number, number] = uiConfig.axis === 'x' ? [1, 0, 0] : (uiConfig.axis === 'y' ? [0, 1, 0] : [0, 0, 1]);
            joint!.type = uiConfig.type;
            joint!.axis = coreAxis;
            onUpdate();
          }}
        />
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
                  if (e.target.checked) op.movingBodies.push(id);
                  else op.movingBodies = op.movingBodies.filter((v: string) => v !== id);
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
