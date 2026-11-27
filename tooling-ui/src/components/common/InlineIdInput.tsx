import { useState } from 'react';

type Props = {
  placeholder: string;
  /** Returns an error message, or null when the id was accepted. */
  onSubmit: (id: string) => string | null;
  onCancel: () => void;
};

/** Single-line id entry: Enter submits, Escape or blur-on-empty cancels. */
export const InlineIdInput = ({ placeholder, onSubmit, onCancel }: Props) => {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="inline-input">
      <input
        autoFocus
        type="text"
        value={value}
        placeholder={placeholder}
        aria-label={placeholder}
        aria-invalid={error !== null}
        onChange={e => { setValue(e.target.value); setError(null); }}
        onBlur={() => { if (!value) onCancel(); }}
        onKeyDown={e => {
          if (e.key === 'Enter') setError(onSubmit(value));
          else if (e.key === 'Escape') onCancel();
        }}
      />
      {error ? <div className="field-error">{error}</div> : <div className="field-hint">Enter to add · Esc to cancel</div>}
    </div>
  );
};
