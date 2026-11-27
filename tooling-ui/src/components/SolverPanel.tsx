import { useState, useCallback } from 'react';
import type { Mechanism } from '@wigglesolve/core';
import { InlineIdInput } from './InlineIdInput';
import type { InlineInputState } from './InlineIdInput';
import { JointConfigEditor } from './JointConfigEditor';
import { InstructionItem } from './InstructionItem';

type Props = {
  mechanism: Mechanism;
  /** Call after mutating the mechanism. */
  onChange: () => void;
  onDrive: (actuatorId: string, value: number) => void;
};

const CLOSED: InlineInputState = { isOpen: false, value: '', error: '' };

export const SolverPanel = ({ mechanism, onChange, onDrive }: Props) => {
  const [actuatorInput, setActuatorInput] = useState<InlineInputState>(CLOSED);
  const { system, actuators, sequence } = mechanism;
  const allNodeIds = [...system.nodes.keys()];
  const allBodyIds = [...system.bodies.keys()];

  const addActuator = useCallback((id: string) => {
    const error = mechanism.validateNewId('actuator', id);
    if (error) { setActuatorInput(s => ({ ...s, error })); return; }
    mechanism.addActuator(id);
    setActuatorInput(CLOSED);
    onChange();
  }, [mechanism, onChange]);

  return (
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
              onCancel={() => setActuatorInput(CLOSED)}
              placeholder="Actuator ID…"
            />
          ) : (
            <>
              <h3>Actuators</h3>
              <button className="add-btn" aria-label="Add actuator" onClick={() => setActuatorInput({ ...CLOSED, isOpen: true })}>+</button>
            </>
          )}
        </div>
        {actuators.length === 0 && (
          <p className="empty-state">Add an actuator to drive a joint manually with the slider in Solved mode.</p>
        )}
        {actuators.map(a => {
          const [lo, hi] = mechanism.getActuatorLimits(a.id);
          const value = mechanism.getActuatorValue(a.id);
          return (
            <div key={a.id} className="item">
              <div className="item-row">
                <span className="bold tiny">{a.id}</span>
                <button className="del-btn" aria-label={`Delete actuator ${a.id}`} onClick={() => { mechanism.removeActuator(a.id); onChange(); }}>×</button>
              </div>
              <JointConfigEditor config={a} onChange={update => { Object.assign(a, update); onChange(); }} />
              <div className="op-form">
                <select value={a.pivotNode} onChange={e => { a.pivotNode = e.target.value; onChange(); }}>
                  <option value="">Select Pivot...</option>
                  {allNodeIds.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
                <div className="joint-chips">
                  {allBodyIds.map(id => (
                    <label key={id} className={`chip ${a.movingBodies.includes(id) ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={a.movingBodies.includes(id)}
                        onChange={e => {
                          a.movingBodies = e.target.checked ? [...a.movingBodies, id] : a.movingBodies.filter(v => v !== id);
                          onChange();
                        }}
                      />
                      {id}
                    </label>
                  ))}
                </div>
              </div>
              <div className="slider-row" style={{ marginTop: '10px' }}>
                <span className="tiny">Drive: {value.toFixed(2)}</span>
                <input
                  type="range"
                  min={lo} max={hi} step={0.01}
                  value={value}
                  disabled={!mechanism.isSimulating}
                  onChange={e => onDrive(a.id, parseFloat(e.target.value))}
                />
              </div>
            </div>
          );
        })}
      </section>

      <section>
        <div className="section-header">
          <h3>Loop Logic</h3>
          <button className="add-btn" aria-label="Add loop" onClick={() => { mechanism.addLoop(); onChange(); }}>+</button>
        </div>
        <div className="sequence-tree">
          {sequence.length === 0 && (
            <p className="empty-state">Add a loop to define the iterative constraint-solving sequence.</p>
          )}
          {sequence.map((instr, i) => (
            <InstructionItem
              key={`root-${i}`}
              instr={instr}
              mechanism={mechanism}
              onUpdate={onChange}
              onDelete={() => { sequence.splice(i, 1); onChange(); }}
              allNodes={allNodeIds}
              allBodies={allBodyIds}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
