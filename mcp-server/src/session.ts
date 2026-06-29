import type { ServerResponse } from 'node:http';
import type { DemoBodyDef, DemoGlobalNodeDef, DemoJointDef, DemoActuatorDef, DemoLoopDef, DemoDefinition } from 'core-js';

export interface PartialDefinition {
  name: string;
  description: string;
  system: {
    bodies: DemoBodyDef[];
    globalNodes: DemoGlobalNodeDef[];
    joints: DemoJointDef[];
  };
  actuators: DemoActuatorDef[];
  sequence: DemoLoopDef[];
}

function emptyDefinition(): PartialDefinition {
  return {
    name: 'Untitled',
    description: '',
    system: { bodies: [], globalNodes: [], joints: [] },
    actuators: [],
    sequence: [],
  };
}

class Session {
  private def: PartialDefinition = emptyDefinition();
  private sseClients = new Set<ServerResponse>();

  reset(name?: string, description?: string): void {
    this.def = emptyDefinition();
    if (name) this.def.name = name;
    if (description) this.def.description = description;
    this.broadcast();
  }

  getDefinition(): PartialDefinition {
    return this.def;
  }

  mutate(updater: (def: PartialDefinition) => void): void {
    updater(this.def);
    this.broadcast();
  }

  addSseClient(res: ServerResponse): void {
    this.sseClients.add(res);
  }

  removeSseClient(res: ServerResponse): void {
    this.sseClients.delete(res);
  }

  private broadcast(): void {
    const data = `data: ${JSON.stringify(this.def)}\n\n`;
    for (const client of this.sseClients) {
      try { client.write(data); } catch { this.sseClients.delete(client); }
    }
  }
}

export const session = new Session();

export function getByPointer(obj: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') return obj;
  const parts = pointer.replace(/^\//, '').split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

export function setByPointer(obj: unknown, pointer: string, value: unknown): void {
  const parts = pointer.replace(/^\//, '').split('/').map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let cur: Record<string, unknown> = obj as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

export function isCompleteDefinition(def: PartialDefinition): def is DemoDefinition {
  return (
    def.system.bodies.length > 0 &&
    def.system.joints.length > 0 &&
    def.actuators.length > 0 &&
    def.sequence.length > 0
  );
}
