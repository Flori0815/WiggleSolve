import { axisName, axisVector, conditionFromPairs, conditionPairs } from '@wigglesolve/core';
import type { AlignNodeOperation, CloseLoopsOperation, Instruction, Mechanism } from '@wigglesolve/core';
import { useExpanded } from '../../hooks/useExpanded';
import { Card } from '../common/Card';
import { Section } from '../common/Section';
import { AxisPicker, ChipSelect, JointTypePicker, NumberField, SelectField } from '../common/fields';

type Props = { mechanism: Mechanism; onChange: () => void };
type Loop = Extract<Instruction, { type: 'loop' }>;
type Step = Extract<Instruction, { type: 'operation' }>;
type AlignStep = Step & { operation: AlignNodeOperation };

type StepCardProps = {
  mechanism: Mechanism;
  step: AlignStep;
  loop: Loop;
  index: number;
  collapsed: boolean;
  onToggle: () => void;
  nodeIds: string[];
  bodyIds: string[];
  onChange: () => void;
};

const StepCard = ({ mechanism, step, loop, index, collapsed, onToggle, nodeIds, bodyIds, onChange }: StepCardProps) => {
  const op = step.operation;
  const joint = mechanism.system.joints.get(op.jointId);
  return (
    <Card
      accent="step"
      title={`Align ${op.effectorNode || '…'} → ${op.targetNode || '…'}`}
      subtitle={`via ${op.jointId}`}
      collapsed={collapsed}
      onToggle={onToggle}
      onDelete={() => { loop.steps.splice(index, 1); onChange(); }}
      deleteLabel="Delete align step"
    >
      <div className="row">
        <SelectField label="Move" value={op.effectorNode} options={nodeIds} placeholder="Effector…"
          onChange={v => { op.effectorNode = v; onChange(); }} />
        <SelectField label="towards" value={op.targetNode} options={nodeIds} placeholder="Target…"
          onChange={v => { op.targetNode = v; onChange(); }} />
      </div>
      <SelectField label="Pivot node" value={op.pivotNode} options={nodeIds} placeholder="Pivot…"
        onChange={v => { op.pivotNode = v; onChange(); }} />
      {joint && joint.type !== 'fixed' ? (
        <div className="row">
          <JointTypePicker value={joint.type} onChange={t => { joint.type = t; onChange(); }} />
          <AxisPicker value={axisName(joint.axis)} onChange={a => { joint.axis = axisVector(a); onChange(); }} />
        </div>
      ) : (
        <p className="field-error">Joint “{op.jointId}” does not exist.</p>
      )}
      <ChipSelect label="Moves bodies" options={bodyIds} selected={op.movingBodies}
        onChange={ids => { op.movingBodies = ids; onChange(); }} />
      <NumberField label="Damping" min={0.05} max={1} step={0.05} decimals={2} value={op.damping ?? 0.5}
        onChange={v => { op.damping = Math.min(1, Math.max(0.05, v)); onChange(); }} />
    </Card>
  );
};

type CloseLoopsCardProps = {
  op: CloseLoopsOperation;
  collapsed: boolean;
  onToggle: () => void;
  onDelete: () => void;
};

/** Simultaneous closure step: shown as a summary (edited in the definition JSON or by a generator). */
const CloseLoopsCard = ({ op, collapsed, onToggle, onDelete }: CloseLoopsCardProps) => (
  <Card
    accent="step"
    title="Close loops simultaneously"
    subtitle={`${op.joints.length} joints · ${op.pairs.length} closures`}
    collapsed={collapsed}
    onToggle={onToggle}
    onDelete={onDelete}
    deleteLabel="Delete close-loops step"
  >
    <p className="field-hint">One Gauss-Newton step per iteration over all listed joints; use it for strongly coupled loops.</p>
    <span className="field-label">Closures</span>
    <ul className="plain-list">
      {op.pairs.map(([a, b]) => <li key={`${a}-${b}`}>{a} ↔ {b}</li>)}
    </ul>
    <span className="field-label">Joints</span>
    <ul className="plain-list">
      {op.joints.map(j => <li key={j.jointId}>{j.jointId} <span className="muted">about {j.pivotNode}</span></li>)}
    </ul>
  </Card>
);

export const SequenceEditor = ({ mechanism, onChange }: Props) => {
  const { isCollapsed, toggle, expand } = useExpanded();
  const nodeIds = [...mechanism.system.nodes.keys()];
  const bodyIds = [...mechanism.system.bodies.keys()];
  const loops = mechanism.sequence.filter((i): i is Loop => i.type === 'loop');

  return (
    <Section
      title="Solver loops"
      count={loops.length}
      addLabel="Add loop"
      empty="A loop repeats its align steps until two nodes meet. Use it to close constraints such as a strut reaching its lug."
      onAddDirect={() => { mechanism.addLoop(); expand(`loop:${mechanism.sequence.length - 1}`); onChange(); }}
    >
      {mechanism.sequence.map((instr, i) => {
        if (instr.type !== 'loop') return null;
        const { condition } = instr;
        const pairs = conditionPairs(condition);
        const setPairs = (next: Array<[string, string]>) => { instr.condition = conditionFromPairs(next, condition.threshold); onChange(); };
        return (
          <Card
            key={`loop-${i}`}
            accent="loop"
            title={`Loop ${i + 1}`}
            subtitle={pairs.length === 1
              ? `until ${pairs[0][0] || '…'} meets ${pairs[0][1] || '…'}`
              : `until ${pairs.length} node pairs meet`}
            collapsed={isCollapsed(`loop:${i}`)}
            onToggle={() => toggle(`loop:${i}`)}
            onDelete={() => { mechanism.sequence.splice(i, 1); onChange(); }}
            deleteLabel={`Delete loop ${i + 1}`}
          >
            {pairs.map(([a, b], k) => (
              <div className="row" key={k}>
                <SelectField label={k === 0 ? 'Until' : 'and'} value={a} options={nodeIds} placeholder="Node…"
                  onChange={v => setPairs(pairs.map((p, n) => (n === k ? [v, p[1]] : p)))} />
                <SelectField label="meets" value={b} options={nodeIds} placeholder="Node…"
                  onChange={v => setPairs(pairs.map((p, n) => (n === k ? [p[0], v] : p)))} />
                {pairs.length > 1 && (
                  <button className="btn-icon btn-delete" aria-label={`Remove pair ${k + 1}`}
                    onClick={() => setPairs(pairs.filter((_, n) => n !== k))}>×</button>
                )}
              </div>
            ))}
            <button className="btn-link" onClick={() => setPairs([...pairs, ['', '']])}>+ Add node pair</button>
            <div className="row">
              <NumberField label="Tolerance" unit="m" min={0} step={0.001} decimals={4} value={condition.threshold}
                onChange={v => { if (v > 0) { condition.threshold = v; onChange(); } }} />
              <NumberField label="Max iterations" min={1} step={10} decimals={0} value={instr.max_iterations}
                onChange={v => { instr.max_iterations = Math.max(1, Math.round(v)); onChange(); }} />
            </div>
            <div className="subsection-header">
              <span className="field-label">Steps (run in order)</span>
              <button className="btn-link" onClick={() => {
                mechanism.addAlignStep(instr);
                expand(`step:${i}:${instr.steps.length - 1}`);
                onChange();
              }}>+ Add align step</button>
            </div>
            {instr.steps.length === 0 && <p className="empty-state">No steps yet.</p>}
            {instr.steps.map((step, j) => step.type === 'operation' && (step.operation.type === 'close_loops' ? (
              <CloseLoopsCard
                key={`step-${i}-${j}`}
                op={step.operation}
                collapsed={isCollapsed(`step:${i}:${j}`)}
                onToggle={() => toggle(`step:${i}:${j}`)}
                onDelete={() => { instr.steps.splice(j, 1); onChange(); }}
              />
            ) : (
              <StepCard
                key={`step-${i}-${j}`}
                mechanism={mechanism}
                step={step as AlignStep}
                loop={instr}
                index={j}
                collapsed={isCollapsed(`step:${i}:${j}`)}
                onToggle={() => toggle(`step:${i}:${j}`)}
                nodeIds={nodeIds}
                bodyIds={bodyIds}
                onChange={onChange}
              />
            )))}
          </Card>
        );
      })}
    </Section>
  );
};
