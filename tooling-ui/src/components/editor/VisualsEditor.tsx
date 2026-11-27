import { useRef, useState } from 'react';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { meshFromWorldTriangles } from '@wigglesolve/core';
import type { RigidBody } from '@wigglesolve/core';

type Props = { body: RigidBody; onChange: () => void };

const UNITS = { m: 1, mm: 0.001 } as const;

/** Attach representation meshes (STL in world coordinates of the reference pose). */
export const VisualsEditor = ({ body, onChange }: Props) => {
  const fileInput = useRef<HTMLInputElement>(null);
  const [unit, setUnit] = useState<keyof typeof UNITS>('m');
  const [error, setError] = useState<string | null>(null);
  const triangles = body.visuals.reduce((n, v) => n + v.indices.length / 3, 0);

  return (
    <div className="group">
      <div className="subsection-header">
        <span className="field-label">Representation</span>
        <span className="muted">
          {body.visuals.length === 0 ? 'rods between nodes' : `${body.visuals.length} mesh${body.visuals.length > 1 ? 'es' : ''} · ${triangles} triangles`}
        </span>
      </div>
      <div className="row">
        <button className="btn" onClick={() => fileInput.current?.click()}>Attach STL…</button>
        <select aria-label="STL units" value={unit} onChange={e => setUnit(e.target.value as keyof typeof UNITS)}>
          <option value="m">in m</option>
          <option value="mm">in mm</option>
        </select>
        {body.visuals.length > 0 && (
          <button className="btn" onClick={() => { body.visuals = []; onChange(); }}>Remove</button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
      <p className="field-hint">Exported in world coordinates of the reference pose; the mesh follows the body.</p>
      <input
        ref={fileInput}
        type="file"
        accept=".stl"
        hidden
        onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          try {
            const geometry = new STLLoader().parse(await file.arrayBuffer());
            const positions = geometry.getAttribute('position').array;
            body.visuals = [...body.visuals, meshFromWorldTriangles(body, positions, { scale: UNITS[unit] })];
            setError(null);
            onChange();
          } catch {
            setError(`${file.name} is not a readable STL file.`);
          }
        }}
      />
    </div>
  );
};
