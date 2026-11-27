import type { ActuatorDef, Mechanism } from '@wigglesolve/core';
import { formatValue, fromDisplay, toDisplay, unitOf } from '../../utils/format';
import { NumberField } from '../common/fields';

type Props = {
  mechanism: Mechanism;
  onDrive: (actuatorId: string, value: number) => void;
  onDriveGroup: (group: string, fraction: number) => void;
};

/** Slider + numeric entry for one actuator. */
const Drive = ({ mechanism, actuator: a, onDrive }: { mechanism: Mechanism; actuator: ActuatorDef; onDrive: Props['onDrive'] }) => {
  const [lo, hi] = mechanism.getActuatorLimits(a.id);
  const value = mechanism.getActuatorValue(a.id);
  const ready = a.pivotNode && mechanism.system.nodes.has(a.pivotNode) && a.movingBodies.length > 0;
  return (
    <div className="drive">
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
};

/**
 * Drive controls for Simulate mode. Grouped actuators get one master slider
 * (fraction of each member's travel) with the individual drives folded below.
 */
export const DrivePanel = ({ mechanism, onDrive, onDriveGroup }: Props) => {
  const { actuators } = mechanism;
  if (actuators.length === 0) {
    return <p className="empty-state">This mechanism has no actuators. Add one in Edit mode to drive it.</p>;
  }
  const groups = mechanism.actuatorGroups();
  const ungrouped = actuators.filter(a => !a.group);

  return (
    <section className="section">
      <header className="section-header">
        <h3>Drives<span className="count">{actuators.length}</span></h3>
        <button className="btn-link" onClick={() => actuators.forEach(a => onDrive(a.id, 0))}>Reset all</button>
      </header>
      {groups.map(({ group, actuators: members }) => {
        const percent = Math.round(mechanism.getGroupFraction(group) * 100);
        return (
          <div key={group} className="drive-group">
            <div className="drive-header">
              <span className="drive-name">{group}</span>
              <span className="muted">{percent} % · {members.length} drive{members.length > 1 ? 's' : ''}</span>
            </div>
            <input
              type="range"
              aria-label={`Drive group ${group}`}
              min={0}
              max={1}
              step="any"
              value={mechanism.getGroupFraction(group)}
              onChange={e => onDriveGroup(group, parseFloat(e.target.value))}
            />
            <details>
              <summary className="field-label">Individual drives</summary>
              {actuators.filter(a => a.group === group).map(a => (
                <Drive key={a.id} mechanism={mechanism} actuator={a} onDrive={onDrive} />
              ))}
            </details>
          </div>
        );
      })}
      {ungrouped.map(a => <Drive key={a.id} mechanism={mechanism} actuator={a} onDrive={onDrive} />)}
    </section>
  );
};
