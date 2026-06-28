import type { Node } from 'core-js/src/index';
import { Matrix4x4 } from 'core-js/src/index';

type Props = {
  node: Node;
  isGlobal?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onUpdate: () => void;
  allNodes: string[];
};

export const NodeEditor = ({
  node,
  isGlobal,
  collapsed,
  onToggleCollapse,
  onDelete,
  onUpdate,
  allNodes,
}: Props) => (
  <div className="item">
    <div className="item-row clickable" onClick={onToggleCollapse}>
      <span className="bold">{collapsed ? '▶' : '▼'} {node.id} {isGlobal && '(Global)'}</span>
      <button className="del-btn" aria-label={`Delete node ${node.id}`} onClick={e => { e.stopPropagation(); onDelete(); }}>×</button>
    </div>
    {!collapsed && (
      <div className="item-details">
        <label className="tiny">
          <input type="checkbox" checked={node.isLocked} onChange={e => { node.isLocked = e.target.checked; onUpdate(); }} />
          {' '}Locked
        </label>
        {['x', 'y', 'z'].map((axis, i) => (
          <div key={axis} className="slider-row">
            <span className="tiny">
              {isGlobal ? 'Pos' : 'Local'} {axis.toUpperCase()}:{' '}
              {(isGlobal
                ? node.absoluteTransform.getTranslation()[i]
                : node.localTransform.getTranslation()[i]
              ).toFixed(2)}
            </span>
            <input
              type="range" min={-2} max={2} step={0.01}
              value={isGlobal ? node.absoluteTransform.getTranslation()[i] : node.localTransform.getTranslation()[i]}
              onChange={e => {
                const val = parseFloat(e.target.value);
                const transform = (isGlobal ? node.absoluteTransform : node.localTransform).clone();
                const pos = transform.getTranslation();
                pos[i] = val;
                transform.setTranslation(pos[0], pos[1], pos[2]);
                if (isGlobal) node.absoluteTransform = transform;
                else node.localTransform = transform;
                onUpdate();
              }}
            />
          </div>
        ))}
        <div className="alignment-section">
          <span className="tiny" style={{ color: '#c084fc', marginTop: '5px' }}>LookAt Align:</span>
          <div className="align-row">
            <select value={node.alignment.primaryAxis || ''} onChange={e => { node.alignment.primaryAxis = e.target.value as any; onUpdate(); }}>
              <option value="">Axis...</option>
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
            <select value={node.alignment.primaryTarget || ''} onChange={e => { node.alignment.primaryTarget = e.target.value; onUpdate(); }}>
              <option value="">Target...</option>
              {allNodes.filter(id => id !== node.id).map(id => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    )}
  </div>
);
