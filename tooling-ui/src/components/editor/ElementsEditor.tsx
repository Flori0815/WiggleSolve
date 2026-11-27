import { Node, RigidBody } from '@wigglesolve/core';
import type { Mechanism } from '@wigglesolve/core';
import { useState } from 'react';
import { useExpanded } from '../../hooks/useExpanded';
import { Card } from '../common/Card';
import { InlineIdInput } from '../common/InlineIdInput';
import { Section } from '../common/Section';
import { Vec3Field } from '../common/fields';
import { NodeEditor } from './NodeEditor';

type Props = { mechanism: Mechanism; onChange: () => void };

export const ElementsEditor = ({ mechanism, onChange }: Props) => {
  const { system } = mechanism;
  const { isCollapsed, toggle, expand } = useExpanded();
  const [addingNodeTo, setAddingNodeTo] = useState<string | null>(null);
  const nodeIds = [...system.nodes.keys()];
  const globalNodes = [...system.nodes.values()].filter(n => !system.findBodyOfNode(n.id));
  const bodies = [...system.bodies.values()];

  const addNode = (id: string, bodyId?: string) => {
    const error = mechanism.validateNewId('node', id);
    if (error) return error;
    system.addNode(new Node(id), bodyId);
    system.updateForwardKinematics();
    expand(id);
    onChange();
    return null;
  };

  return (
    <>
      <Section
        title="Bodies"
        count={bodies.length}
        addLabel="Add body"
        empty="A body groups nodes that move together as one rigid part."
        onAdd={id => {
          const error = mechanism.validateNewId('body', id);
          if (error) return error;
          system.addBody(new RigidBody(id));
          expand(`body:${id}`);
          onChange();
          return null;
        }}
      >
        {bodies.map(body => (
          <Card
            key={body.id}
            accent="body"
            title={body.id}
            subtitle={`${body.nodes.size} node${body.nodes.size === 1 ? '' : 's'}`}
            collapsed={isCollapsed(`body:${body.id}`)}
            onToggle={() => toggle(`body:${body.id}`)}
            onDelete={() => { system.removeBody(body.id); onChange(); }}
            deleteLabel={`Delete body ${body.id} and its nodes`}
          >
            <Vec3Field
              label="Body origin (world)"
              value={body.transform.getTranslation()}
              onChange={([x, y, z]) => { body.transform = body.transform.clone().setTranslation(x, y, z); onChange(); }}
            />
            <div className="subsection-header">
              <span className="field-label">Nodes</span>
              <button className="btn-link" onClick={() => setAddingNodeTo(body.id)}>+ Add node</button>
            </div>
            {addingNodeTo === body.id && (
              <InlineIdInput
                placeholder="Node id"
                onCancel={() => setAddingNodeTo(null)}
                onSubmit={id => {
                  const error = addNode(id, body.id);
                  if (!error) setAddingNodeTo(null);
                  return error;
                }}
              />
            )}
            {[...body.nodes.values()].map(node => (
              <Card
                key={node.id}
                accent="node"
                title={node.id}
                collapsed={isCollapsed(node.id)}
                onToggle={() => toggle(node.id)}
                onDelete={() => { system.removeNode(node.id); onChange(); }}
                deleteLabel={`Delete node ${node.id}`}
              >
                <NodeEditor node={node} isGlobal={false} otherNodes={nodeIds.filter(id => id !== node.id)} onChange={onChange} />
              </Card>
            ))}
          </Card>
        ))}
      </Section>

      <Section
        title="Fixed points"
        count={globalNodes.length}
        addLabel="Add fixed point"
        empty="Fixed points are world-space frames, e.g. targets or ground anchors."
        onAdd={id => addNode(id)}
      >
        {globalNodes.map(node => (
          <Card
            key={node.id}
            accent="node"
            title={node.id}
            collapsed={isCollapsed(node.id)}
            onToggle={() => toggle(node.id)}
            onDelete={() => { system.removeNode(node.id); onChange(); }}
            deleteLabel={`Delete fixed point ${node.id}`}
          >
            <NodeEditor node={node} isGlobal otherNodes={nodeIds.filter(id => id !== node.id)} onChange={onChange} />
          </Card>
        ))}
      </Section>
    </>
  );
};
