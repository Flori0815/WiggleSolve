import { useState, useMemo, useCallback } from 'react';
import type { KinematicSystem } from 'core-js/src/index';
import type { Instruction } from 'core-js/src/index';
import { InlineIdInput } from './InlineIdInput';
import { JointConfigEditor } from './JointConfigEditor';
import { InstructionItem } from './InstructionItem';
import type { UIActuator, UIJointConfig, InlineInputState } from '../types';

type Props = {
  system: KinematicSystem;
  sequence: Instruction[];
  actuators: Record<string, UIActuator>;
  setActuators: (a: Record<string, UIActuator>) => void;
  version: number;
  onSequenceUpdate: () => void;
};

export const SolverPanel = ({
  system,
  sequence,
  actuators,
  setActuators,
  version,
  onSequenceUpdate,
}: Props) => {
  const [actuatorInput, setActuatorInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });

  const allNodeIds = useMemo(() => Array.from(system.nodes.keys()), [system.nodes.size, version]);
  const allBodyIds = useMemo(() => Array.from(system.bodies.keys()), [system.bodies.size, version]);

  const addActuator = useCallback((id: string) => {
    if (!id.trim()) { setActuatorInput(s => ({ ...s, error: 'ID cannot be empty' })); return; }
    if (actuators[id]) { setActuatorInput(s => ({ ...s, error: `Actuator '${id}' already exists` })); return; }
    setActuators({ ...actuators, [id]: { id, type: 'revolute', axis: 'z', pivotNode: '', movingBodies: [], value: 0 } });
    setActuatorInput({ isOpen: false, value: '', error: '' });
  }, [actuators, setActuators]);

  const updateActuator = useCallback((id: string, patch: Partial<UIActuator>) => {
    setActuators({ ...actuators, [id]: { ...actuators[id], ...patch } });
  }, [actuators, setActuators]);

  const deleteActuator = useCallback((id: string) => {
    const next = { ...actuators };
    delete next[id];
    setActuators(next);
  }, [actuators, setActuators]);

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
          <div key={a.id} className="item">
            <div className="item-row">
              <span className="bold tiny">{a.id}</span>
              <button className="del-btn" aria-label={`Delete actuator ${a.id}`} onClick={() => deleteActuator(a.id)}>×</button>
            </div>
            <JointConfigEditor
              config={a}
              onChange={(update: Partial<UIJointConfig>) => updateActuator(a.id, update)}
            />
            <div className="op-form">
              <select
                value={a.pivotNode}
                onChange={e => updateActuator(a.id, { pivotNode: e.target.value })}
              >
                <option value="">Select Pivot...</option>
                {allNodeIds.map(id => <option key={id} value={id}>{id}</option>)}
              </select>
              <div className="joint-chips">
                {allBodyIds.map(id => (
                  <label key={id} className={`chip ${a.movingBodies.includes(id) ? 'active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={a.movingBodies.includes(id)}
                      onChange={e => updateActuator(a.id, {
                        movingBodies: e.target.checked
                          ? [...a.movingBodies, id]
                          : a.movingBodies.filter(v => v !== id),
                      })}
                    />
                    {id}
                  </label>
                ))}
              </div>
            </div>
            <div className="slider-row" style={{ marginTop: '10px' }}>
              <span className="tiny">Drive: {a.value.toFixed(2)}</span>
              <input
                type="range"
                min={-Math.PI} max={Math.PI} step={0.01}
                value={a.value}
                onChange={e => updateActuator(a.id, { value: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        ))}
      </section>

      <section>
        <div className="section-header"><h3>Loop Logic</h3></div>
        <div className="sequence-tree">
          {sequence.length === 0 && (
            <p className="empty-state">Add a loop to define the iterative constraint-solving sequence.</p>
          )}
          {sequence.map((instr, i) => (
            <InstructionItem
              key={`root-${i}`}
              instr={instr}
              onUpdate={onSequenceUpdate}
              onDelete={() => { sequence.splice(i, 1); onSequenceUpdate(); }}
              allNodes={allNodeIds}
              allBodies={allBodyIds}
              system={system}
            />
          ))}
        </div>
      </section>
    </div>
  );
};
