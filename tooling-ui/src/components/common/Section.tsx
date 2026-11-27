import { useState } from 'react';
import type { ReactNode } from 'react';
import { InlineIdInput } from './InlineIdInput';

type Props = {
  title: string;
  count?: number;
  /** When set, shows a "+" button that opens an id input. */
  onAdd?: (id: string) => string | null;
  addLabel?: string;
  /** Alternative to `onAdd` for elements that need no id. */
  onAddDirect?: () => void;
  empty?: string;
  children?: ReactNode;
};

export const Section = ({ title, count, onAdd, addLabel, onAddDirect, empty, children }: Props) => {
  const [adding, setAdding] = useState(false);
  const label = addLabel ?? `Add ${title.toLowerCase()}`;

  return (
    <section className="section">
      <header className="section-header">
        <h3>
          {title}
          {count !== undefined && <span className="count">{count}</span>}
        </h3>
        {(onAdd || onAddDirect) && (
          <button
            className="btn-icon btn-add"
            aria-label={label}
            title={label}
            onClick={() => (onAdd ? setAdding(true) : onAddDirect?.())}
          >+</button>
        )}
      </header>
      {adding && onAdd && (
        <InlineIdInput
          placeholder={`${label} — id`}
          onCancel={() => setAdding(false)}
          onSubmit={id => {
            const error = onAdd(id);
            if (!error) setAdding(false);
            return error;
          }}
        />
      )}
      {count === 0 && empty && !adding && <p className="empty-state">{empty}</p>}
      {children}
    </section>
  );
};
