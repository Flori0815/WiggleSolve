import type { ReactNode } from 'react';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  accent?: 'body' | 'node' | 'actuator' | 'loop' | 'step';
  collapsed: boolean;
  onToggle: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  children?: ReactNode;
};

/** Collapsible item card with an optional delete action. */
export const Card = ({ title, subtitle, accent, collapsed, onToggle, onDelete, deleteLabel, children }: Props) => (
  <div className={`card ${accent ? `card--${accent}` : ''}`}>
    <div className="card-header">
      <button className="card-toggle" aria-expanded={!collapsed} onClick={onToggle}>
        <span className="chevron" aria-hidden>{collapsed ? '▸' : '▾'}</span>
        <span className="card-title">{title}</span>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </button>
      {onDelete && (
        <button className="btn-icon btn-delete" aria-label={deleteLabel} title={deleteLabel} onClick={onDelete}>×</button>
      )}
    </div>
    {!collapsed && <div className="card-body">{children}</div>}
  </div>
);
