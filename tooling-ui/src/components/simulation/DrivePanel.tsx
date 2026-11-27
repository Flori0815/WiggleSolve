import type { Mechanism } from '@wigglesolve/core';
import { formatValue, fromDisplay, toDisplay, unitOf } from '../../utils/format';
import { NumberField } from '../common/fields';

type Props = {
  mechanism: Mechanism;
  onDrive: (actuatorId: string, value: number) => void;
};

/** Sliders for every actuator; shown in Simulate mode. */
export const DrivePanel = ({ mechanism, onDrive }: Props) => {
  const { actuators } = mechanism;
  if (actuators.length === 0) {
    return <p className="empty-state">This mechanism has no actuators. Add one in Edit mode to drive it.</p>;
  }

  return (
    <section className="section">
      <header className="section-header">
        <h3>Drives<span className="count">{actuators.length}</span></h3>
        <button className="btn-link" onClick={() => actuators.forEach(a => onDrive(a.id, 0))}>Reset all</button>
      </header>
      {actuators.map(a => {
        const [lo, hi] = mechanism.getActuatorLimits(a.id);
        const value = mechanism.getActuatorValue(a.id);
        const ready = a.pivotNode && mechanism.system.nodes.has(a.pivotNode) && a.movingBodies.length > 0;
        return (
          <div key={a.id} className="drive">
            <div className="drive-header">
              <span className="drive-name">{a.id}</span>
              <NumberField
                label={`${a.id} value`}
                unit={unitOf(a.type)}
                decimals={a.type === 'revolute' ? 1 : 3}
                step={a.type === 'revolute' ? 1 : 0.01}
                value={toDisplay(a.type, value)}
                onChange={v => onDrive(a.id, fromDisplay(a.type, v))}
              />
            </div>
            <input
              type="range"
              aria-label={`Drive ${a.id}`}
              min={lo}
              max={hi}
              step="any"
              value={value}
              disabled={!ready}
              onChange={e => onDrive(a.id, parseFloat(e.target.value))}
            />
            <div className="drive-scale">
              <span>{formatValue(a.type, lo)}</span>
              {!ready && <span className="field-error">needs a pivot and moving bodies</span>}
              <span>{formatValue(a.type, hi)}</span>
            </div>
          </div>
        );
      })}
    </section>
  );
};
