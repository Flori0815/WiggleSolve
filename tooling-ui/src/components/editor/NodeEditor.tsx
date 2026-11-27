import type { AxisName, Node } from '@wigglesolve/core';
import { SelectField, Vec3Field } from '../common/fields';

type Props = {
  node: Node;
  isGlobal: boolean;
  otherNodes: string[];
  onChange: () => void;
};

const AXES: Array<AxisName | ''> = ['', 'x', 'y', 'z'];

export const NodeEditor = ({ node, isGlobal, otherNodes, onChange }: Props) => {
  const frame = isGlobal ? node.absoluteTransform : node.localTransform;
  const { alignment } = node;

  return (
    <>
      <Vec3Field
        label={isGlobal ? 'World position' : 'Position in body'}
        value={frame.getTranslation()}
        onChange={([x, y, z]) => {
          const next = frame.clone().setTranslation(x, y, z);
          if (isGlobal) node.absoluteTransform = next; else node.localTransform = next;
          onChange();
        }}
      />
      <label className="checkbox-field">
        <input type="checkbox" checked={node.isLocked} onChange={e => { node.isLocked = e.target.checked; onChange(); }} />
        Show as anchor
      </label>
      {!isGlobal && (
        <fieldset className="group">
          <legend className="field-label">Look-at orientation</legend>
          <div className="row">
            <label className="select-field compact">
              <span className="field-label">Axis</span>
              <select value={alignment.primaryAxis ?? ''} onChange={e => { alignment.primaryAxis = (e.target.value || null) as AxisName | null; onChange(); }}>
                {AXES.map(a => <option key={a} value={a}>{a ? a.toUpperCase() : 'off'}</option>)}
              </select>
            </label>
            <SelectField label="points at" value={alignment.primaryTarget ?? ''} options={otherNodes} placeholder="—"
              onChange={v => { alignment.primaryTarget = v || null; onChange(); }} />
          </div>
          {alignment.primaryAxis && alignment.primaryTarget && (
            <div className="row">
              <label className="select-field compact">
                <span className="field-label">Roll axis</span>
                <select value={alignment.secondaryAxis ?? ''} onChange={e => { alignment.secondaryAxis = (e.target.value || null) as AxisName | null; onChange(); }}>
                  {AXES.filter(a => a !== alignment.primaryAxis).map(a => <option key={a} value={a}>{a ? a.toUpperCase() : 'off'}</option>)}
                </select>
              </label>
              <SelectField label="towards" value={alignment.secondaryTarget ?? ''} options={otherNodes} placeholder="—"
                onChange={v => { alignment.secondaryTarget = v || null; onChange(); }} />
            </div>
          )}
        </fieldset>
      )}
    </>
  );
};
