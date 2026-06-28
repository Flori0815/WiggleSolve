import type { UIJointConfig } from '../types';

type Props = {
  config: UIJointConfig;
  onChange: (update: Partial<UIJointConfig>) => void;
};

export const JointConfigEditor = ({ config, onChange }: Props) => (
  <div className="joint-config-box">
    <div className="item-row small">
      <span>Type:</span>
      <select value={config.type} onChange={e => onChange({ type: e.target.value as UIJointConfig['type'] })}>
        <option value="revolute">Revolute</option>
        <option value="prismatic">Prismatic</option>
      </select>
    </div>
    <div className="item-row small">
      <span>Axis:</span>
      <div className="axis-radios">
        {(['x', 'y', 'z'] as const).map(a => (
          <label key={a} className={`radio-chip ${config.axis === a ? 'active' : ''}`}>
            <input type="radio" checked={config.axis === a} onChange={() => onChange({ axis: a })} />
            {a.toUpperCase()}
          </label>
        ))}
      </div>
    </div>
  </div>
);
