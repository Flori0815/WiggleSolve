import type { Mechanism } from '@wigglesolve/core';
import { useExpanded } from '../../hooks/useExpanded';
import { formatValue, fromDisplay, toDisplay, unitOf } from '../../utils/format';
import { Card } from '../common/Card';
import { Section } from '../common/Section';
import { AxisPicker, ChipSelect, JointTypePicker, NumberField, SelectField } from '../common/fields';

type Props = { mechanism: Mechanism; onChange: () => void };

export const ActuatorsEditor = ({ mechanism, onChange }: Props) => {
  const { isCollapsed, toggle, expand } = useExpanded();
  const nodeIds = [...mechanism.system.nodes.keys()];
  const bodyIds = [...mechanism.system.bodies.keys()];

  return (
    <Section
      title="Actuators"
      count={mechanism.actuators.length}
      addLabel="Add actuator"
      empty="An actuator is a manual drive: it rotates or slides bodies about a pivot node. Drive it in Simulate mode."
      onAdd={id => {
        const error = mechanism.validateNewId('actuator', id);
        if (error) return error;
        mechanism.addActuator(id);
        expand(id);
        onChange();
        return null;
      }}
    >
      {mechanism.actuators.map(a => {
        const [lo, hi] = mechanism.getActuatorLimits(a.id);
        const incomplete = !a.pivotNode || a.movingBodies.length === 0;
        return (
          <Card
            key={a.id}
            accent="actuator"
            title={a.id}
            subtitle={incomplete ? 'incomplete' : `${a.type === 'revolute' ? 'rotates' : 'slides'} ${a.axis.toUpperCase()} · ${formatValue(a.type, lo)} … ${formatValue(a.type, hi)}${a.outputs?.length ? ` · +${a.outputs.length} output${a.outputs.length > 1 ? 's' : ''}` : ''}`}
            collapsed={isCollapsed(a.id)}
            onToggle={() => toggle(a.id)}
            onDelete={() => { mechanism.removeActuator(a.id); onChange(); }}
            deleteLabel={`Delete actuator ${a.id}`}
          >
            <div className="row">
              <JointTypePicker value={a.type} onChange={t => { a.type = t; onChange(); }} />
              <AxisPicker value={a.axis} onChange={axis => { a.axis = axis; onChange(); }} />
            </div>
            <SelectField label="Pivot node" value={a.pivotNode} options={nodeIds} placeholder="Select pivot…"
              onChange={v => { a.pivotNode = v; onChange(); }} />
            <ChipSelect label="Moves bodies" options={bodyIds} selected={a.movingBodies}
              onChange={ids => { a.movingBodies = ids; onChange(); }} />
            {a.outputs?.map((o, k) => (
              <p key={k} className="field-hint">
                Also drives {o.movingBodies.join(', ')} about {o.pivotNode}{o.ratio !== undefined && o.ratio !== 1 ? ` (ratio ${o.ratio})` : ''}
              </p>
            ))}
            <div className="row">
              <NumberField label="Min" unit={unitOf(a.type)} decimals={a.type === 'revolute' ? 1 : 3} step={a.type === 'revolute' ? 1 : 0.01}
                value={toDisplay(a.type, lo)}
                onChange={v => { mechanism.setActuatorLimits(a.id, [fromDisplay(a.type, v), hi]); onChange(); }} />
              <NumberField label="Max" unit={unitOf(a.type)} decimals={a.type === 'revolute' ? 1 : 3} step={a.type === 'revolute' ? 1 : 0.01}
                value={toDisplay(a.type, hi)}
                onChange={v => { mechanism.setActuatorLimits(a.id, [lo, fromDisplay(a.type, v)]); onChange(); }} />
            </div>
          </Card>
        );
      })}
    </Section>
  );
};
