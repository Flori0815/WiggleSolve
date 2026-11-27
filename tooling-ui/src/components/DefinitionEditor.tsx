import { useState, useCallback } from 'react';
import { Node, RigidBody } from '@wigglesolve/core';
import type { Mechanism } from '@wigglesolve/core';
import { InlineIdInput } from './InlineIdInput';
import type { InlineInputState } from './InlineIdInput';
import { NodeEditor } from './NodeEditor';

type Props = {
  mechanism: Mechanism;
  /** Call after mutating the mechanism. */
  onChange: () => void;
};

export const DefinitionEditor = ({ mechanism, onChange: tick }: Props) => {
  const { system } = mechanism;
  const [collapsedItems, setCollapsedItems] = useState<Set<string>>(new Set());
  const [globalNodeInput, setGlobalNodeInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });
  const [bodyInput, setBodyInput] = useState<InlineInputState>({ isOpen: false, value: '', error: '' });
  const [bodyNodeInput, setBodyNodeInput] = useState<InlineInputState & { bodyId?: string }>({
    isOpen: false, value: '', error: '', bodyId: undefined,
  });

  const allNodeIds = [...system.nodes.keys()];
  const allBodyIds = [...system.bodies.keys()];

  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const addGlobalNode = useCallback((id: string) => {
    const error = mechanism.validateNewId('node', id);
    if (error) { setGlobalNodeInput(s => ({ ...s, error })); return; }
    system.addNode(new Node(id));
    setGlobalNodeInput({ isOpen: false, value: '', error: '' });
    tick();
  }, [mechanism, system, tick]);

  const addBody = useCallback((id: string) => {
    const error = mechanism.validateNewId('body', id);
    if (error) { setBodyInput(s => ({ ...s, error })); return; }
    system.addBody(new RigidBody(id));
    setBodyInput({ isOpen: false, value: '', error: '' });
    tick();
  }, [mechanism, system, tick]);

  const addBodyNode = useCallback((bodyId: string, id: string) => {
    const error = mechanism.validateNewId('node', id);
    if (error) { setBodyNodeInput(s => ({ ...s, error })); return; }
    system.addNode(new Node(id), bodyId);
    setBodyNodeInput({ isOpen: false, value: '', error: '', bodyId: undefined });
    tick();
  }, [mechanism, system, tick]);

  const globalNodeIds = allNodeIds.filter(id => !system.findBodyOfNode(id));

  return (
    <div className="elements-tab">
      <section>
        <div className="section-header">
          {globalNodeInput.isOpen ? (
            <InlineIdInput
              isOpen={globalNodeInput.isOpen}
              value={globalNodeInput.value}
              error={globalNodeInput.error}
              onChange={v => setGlobalNodeInput(s => ({ ...s, value: v, error: '' }))}
              onSubmit={() => addGlobalNode(globalNodeInput.value)}
              onCancel={() => setGlobalNodeInput({ isOpen: false, value: '', error: '' })}
              placeholder="Node ID…"
            />
          ) : (
            <>
              <h3>Global Nodes</h3>
              <button className="add-btn" aria-label="Add global node" onClick={() => setGlobalNodeInput({ isOpen: true, value: '', error: '' })}>+</button>
            </>
          )}
        </div>
        {globalNodeIds.length === 0 && (
          <p className="empty-state">Add a node to place a standalone coordinate frame — useful for targets and world anchors.</p>
        )}
        {globalNodeIds.map(id => (
          <NodeEditor
            key={id}
            node={system.nodes.get(id)!}
            isGlobal
            collapsed={collapsedItems.has(id)}
            onToggleCollapse={() => toggleCollapsed(id)}
            onDelete={() => { system.removeNode(id); tick(); }}
            onUpdate={tick}
            allNodes={allNodeIds}
          />
        ))}
      </section>

      <section>
        <div className="section-header">
          {bodyInput.isOpen ? (
            <InlineIdInput
              isOpen={bodyInput.isOpen}
              value={bodyInput.value}
              error={bodyInput.error}
              onChange={v => setBodyInput(s => ({ ...s, value: v, error: '' }))}
              onSubmit={() => addBody(bodyInput.value)}
              onCancel={() => setBodyInput({ isOpen: false, value: '', error: '' })}
              placeholder="Body ID…"
            />
          ) : (
            <>
              <h3>Rigid Bodies</h3>
              <button className="add-btn" aria-label="Add rigid body" onClick={() => setBodyInput({ isOpen: true, value: '', error: '' })}>+</button>
            </>
          )}
        </div>
        {allBodyIds.length === 0 && (
          <p className="empty-state">Add a body to group nodes that move together as a rigid unit.</p>
        )}
        {allBodyIds.map(id => {
          const b = system.bodies.get(id)!;
          return (
            <div key={id} className="item">
              <div className="item-row clickable" onClick={() => toggleCollapsed(id)}>
                <span className="bold">{collapsedItems.has(id) ? '▶' : '▼'} {id}</span>
                <button className="del-btn" aria-label={`Delete body ${id}`} onClick={e => { e.stopPropagation(); system.removeBody(id); tick(); }}>×</button>
              </div>
              {!collapsedItems.has(id) && (
                <div className="item-details">
                  {['x', 'y', 'z'].map((axis, i) => (
                    <div key={axis} className="slider-row">
                      <span className="tiny">World {axis.toUpperCase()}</span>
                      <input
                        type="range" min={-2} max={2} step={0.01}
                        value={b.transform.getTranslation()[i]}
                        onChange={e => {
                          const transform = b.transform.clone();
                          const p = transform.getTranslation();
                          p[i] = parseFloat(e.target.value);
                          b.transform = transform.setTranslation(p[0], p[1], p[2]);
                          tick();
                        }}
                      />
                    </div>
                  ))}
                  <div className="nested-nodes">
                    <div className="section-header small">
                      {bodyNodeInput.isOpen && bodyNodeInput.bodyId === id ? (
                        <InlineIdInput
                          isOpen={bodyNodeInput.isOpen}
                          value={bodyNodeInput.value}
                          error={bodyNodeInput.error}
                          onChange={v => setBodyNodeInput(s => ({ ...s, value: v, error: '' }))}
                          onSubmit={() => addBodyNode(id, bodyNodeInput.value)}
                          onCancel={() => setBodyNodeInput({ isOpen: false, value: '', error: '', bodyId: undefined })}
                          placeholder="Node ID…"
                        />
                      ) : (
                        <>
                          <span>Attached Nodes</span>
                          <button className="add-btn tiny" aria-label={`Add node to ${id}`} onClick={() => setBodyNodeInput({ isOpen: true, value: '', error: '', bodyId: id })}>+</button>
                        </>
                      )}
                    </div>
                    {Array.from(b.nodes.values()).map(n => (
                      <NodeEditor
                        key={n.id}
                        node={n}
                        collapsed={collapsedItems.has(n.id)}
                        onToggleCollapse={() => toggleCollapsed(n.id)}
                        onDelete={() => { system.removeNode(n.id); tick(); }}
                        onUpdate={tick}
                        allNodes={allNodeIds}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
};
