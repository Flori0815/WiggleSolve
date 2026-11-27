import { useEffect, useState } from 'react';
import type { AxisName } from '@wigglesolve/core';

type NumberFieldProps = {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  decimals?: number;
};

/** Numeric input that only commits valid numbers (on change and on blur). */
export const NumberField = ({ label, value, onChange, step = 0.01, min, max, unit, decimals = 3 }: NumberFieldProps) => {
  const [text, setText] = useState(value.toFixed(decimals));
  useEffect(() => { setText(value.toFixed(decimals)); }, [value, decimals]);

  return (
    <label className="number-field">
      <span className="field-label">{label}</span>
      <input
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        value={text}
        onChange={e => {
          setText(e.target.value);
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChange(v);
        }}
        onBlur={() => setText(value.toFixed(decimals))}
      />
      {unit && <span className="field-unit">{unit}</span>}
    </label>
  );
};

type Vec3FieldProps = {
  label: string;
  value: [number, number, number];
  onChange: (v: [number, number, number]) => void;
};

export const Vec3Field = ({ label, value, onChange }: Vec3FieldProps) => (
  <fieldset className="vec3-field">
    <legend className="field-label">{label}</legend>
    {(['X', 'Y', 'Z'] as const).map((axis, i) => (
      <NumberField
        key={axis}
        label={axis}
        value={value[i]}
        onChange={v => {
          const next: [number, number, number] = [...value];
          next[i] = v;
          onChange(next);
        }}
      />
    ))}
  </fieldset>
);

type SelectProps = {
  label: string;
  value: string;
  options: string[];
  placeholder: string;
  onChange: (v: string) => void;
};

/** Labeled select; flags a value that no longer exists in `options`. */
export const SelectField = ({ label, value, options, placeholder, onChange }: SelectProps) => {
  const missing = value !== '' && !options.includes(value);
  return (
    <label className="select-field">
      <span className="field-label">{label}</span>
      <select value={value} aria-invalid={missing || value === ''} onChange={e => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {missing && <option value={value}>{value} (missing)</option>}
        {options.map(id => <option key={id} value={id}>{id}</option>)}
      </select>
    </label>
  );
};

type AxisPickerProps = { value: AxisName; onChange: (a: AxisName) => void; label?: string };

export const AxisPicker = ({ value, onChange, label = 'Axis' }: AxisPickerProps) => (
  <div className="segmented-field" role="radiogroup" aria-label={label}>
    <span className="field-label">{label}</span>
    <div className="segmented small">
      {(['x', 'y', 'z'] as const).map(a => (
        <button key={a} role="radio" aria-checked={value === a} className={value === a ? 'active' : ''} onClick={() => onChange(a)}>
          {a.toUpperCase()}
        </button>
      ))}
    </div>
  </div>
);

type TypePickerProps = { value: 'revolute' | 'prismatic'; onChange: (t: 'revolute' | 'prismatic') => void };

export const JointTypePicker = ({ value, onChange }: TypePickerProps) => (
  <div className="segmented-field" role="radiogroup" aria-label="Joint type">
    <span className="field-label">Type</span>
    <div className="segmented small">
      {(['revolute', 'prismatic'] as const).map(t => (
        <button key={t} role="radio" aria-checked={value === t} className={value === t ? 'active' : ''} onClick={() => onChange(t)}>
          {t === 'revolute' ? 'Rotate' : 'Slide'}
        </button>
      ))}
    </div>
  </div>
);

type ChipsProps = { label: string; options: string[]; selected: string[]; onChange: (ids: string[]) => void };

/** Multi-select as toggle chips. */
export const ChipSelect = ({ label, options, selected, onChange }: ChipsProps) => (
  <div className="chip-field">
    <span className="field-label">{label}</span>
    <div className="chips">
      {options.length === 0 && <span className="muted">No bodies yet</span>}
      {options.map(id => {
        const on = selected.includes(id);
        return (
          <button
            key={id}
            className={`chip ${on ? 'active' : ''}`}
            aria-pressed={on}
            onClick={() => onChange(on ? selected.filter(s => s !== id) : [...selected, id])}
          >{id}</button>
        );
      })}
    </div>
  </div>
);
