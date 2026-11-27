import { useRef } from 'react';
import { DEMOS } from '../demos';

type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  onImport: (json: unknown, fileName: string) => void;
  onExport: () => void;
  canExport: boolean;
};

const categories = [...new Set(DEMOS.map(d => d.category))];

export const MechanismPicker = ({ selectedId, onSelect, onImport, onExport, canExport }: Props) => {
  const fileInput = useRef<HTMLInputElement>(null);

  return (
    <div className="picker">
      <select aria-label="Mechanism" value={selectedId} onChange={e => onSelect(e.target.value)}>
        {selectedId === '' && <option value="">Custom mechanism</option>}
        {categories.map(category => (
          <optgroup key={category} label={category}>
            {DEMOS.filter(d => d.category === category).map(d => (
              <option key={d.id} value={d.id}>{d.definition.name}</option>
            ))}
          </optgroup>
        ))}
      </select>
      <button className="btn" title="Open a definition (.json)" onClick={() => fileInput.current?.click()}>Open…</button>
      <button
        className="btn"
        title={canExport ? 'Save the current definition as JSON' : 'Switch to Edit mode to save the definition pose'}
        disabled={!canExport}
        onClick={onExport}
      >Save</button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            onImport(JSON.parse(await file.text()), file.name);
          } catch {
            onImport(undefined, file.name);
          }
        }}
      />
    </div>
  );
};
