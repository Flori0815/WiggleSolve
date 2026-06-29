# MCP Tools Reference

The MCP server (`mcp-server/`) exposes WiggleSolve as an MCP server for use with Claude Desktop or any MCP-compatible AI agent. It maintains a mutable **session** (one definition at a time) and broadcasts changes to connected web UI clients via SSE.

**Default port:** 3001  
**SSE endpoint:** `GET /sse` — web UI connects here for live updates

---

## Session Lifecycle

```
session_new (name, description)
    │
    ├── add_body / add_global_node / add_joint   (build system)
    ├── add_actuator                              (bind joints to bodies)
    ├── add_solve_loop                            (define IK sequence)
    │
    ├── validate_definition                       (check schema)
    ├── test_solve [target_position?]             (run solver, get results)
    ├── list_node_positions                       (inspect geometry)
    │
    ├── update_value (jsonPointer, value)         (patch any field)
    ├── remove_element (type, id)                 (delete body/joint/actuator/globalNode)
    │
    └── session_get                               (dump current definition JSON)
```

---

## Tool Reference

### Session Management

| Tool | Key Inputs | Returns |
|------|-----------|---------|
| `session_new` | `name?`, `description?` | Confirmation text |
| `session_get` | — | Full definition JSON (pretty-printed) |
| `explain_session` | — | Human-readable summary of all bodies, joints, actuators, sequence |

---

### Build Tools (`mcp-server/src/tools/build.ts`)

#### `add_body`
```ts
{ id: string; nodes: Array<{ id: string; localTransform: number[16] }> }
```
Adds a rigid body with one or more nodes. `localTransform` is a 16-element column-major matrix. Use identity `[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]` for node at body origin, or translation matrix for offset nodes.

#### `add_global_node`
```ts
{ id: string; absoluteTransform: number[16] }
```
Adds a node not attached to any body (e.g. `target`). Transform is set in world space directly.

#### `add_joint`
```ts
{ id: string; type: 'revolute'|'prismatic'; axis: [x,y,z]; limits: [min, max] }
```
Adds a joint definition. `axis` is a unit vector — use `[1,0,0]`, `[0,1,0]`, or `[0,0,1]`. Limits in radians (revolute) or meters (prismatic).

#### `add_actuator`
```ts
{ id: string; type: 'revolute'|'prismatic'; axis: 'x'|'y'|'z'; pivotNode: string; movingBodies: string[] }
```
Binds a joint to bodies. `id` must match a joint id. `pivotNode` is the node whose world position/orientation defines the joint pivot. `movingBodies` lists all bodies that move when this joint changes.

#### `add_solve_loop`
```ts
{
  max_iterations: number;
  condition: { type: 'distance_less_than'; nodeA: string; nodeB: string; threshold: number };
  steps: Array<{
    type: 'operation';
    operation: {
      type: 'align_node';
      effectorNode: string; targetNode: string;
      pivotNode: string; jointId: string;
      movingBodies: string[];
    }
  }>
}
```
Appends a CCD loop to the sequence. Steps should be ordered innermost-joint first for fastest convergence.

#### `update_value`
```ts
{ jsonPointer: string; value: unknown }
```
Patches any field using RFC 6901 JSON Pointer. Examples:
- `/system/globalNodes/0/absoluteTransform` — move target node
- `/actuators/1/pivotNode` — change pivot
- `/sequence/0/max_iterations` — adjust solver iterations

#### `remove_element`
```ts
{ type: 'body'|'joint'|'actuator'|'globalNode'; id: string }
```
Removes element by id. Does not cascade (e.g. removing a body does not remove its joints).

---

### Validation & Solve Tools (`mcp-server/src/tools/validate.ts`)

#### `validate_definition`
No inputs. Runs `DemoDefinitionSchema.safeParse()` on current session. Returns `"Definition is valid."` or list of schema errors with field paths.

#### `test_solve`
```ts
{ target_position?: [x, y, z] }
```
Optionally overrides the `target` global node position, then runs the full solver. Returns:
```json
{
  "converged": true,
  "jointValues": { "j1": 0.523, "j2": -0.314 },
  "nodePositions": { "link2_end": [1.5, 0.5, 0], "target": [1.5, 0.5, 0] }
}
```

#### `list_node_positions`
No inputs. Returns world-space positions of all nodes without running the solver:
```json
{ "base_pivot": [0, 0, 0], "link1_end": [1, 0, 0], ... }
```

---

### Matrix Utility Tools (`mcp-server/src/tools/utils.ts`)

These generate the 16-element column-major arrays needed for `localTransform` / `absoluteTransform`.

| Tool | Inputs | Returns |
|------|--------|---------|
| `matrix_identity` | — | `[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]` |
| `matrix_translation` | `x, y, z` | Translation matrix as `number[16]` |
| `matrix_rotation` | `axis: 'x'|'y'|'z'`, `radians: number` | Rotation matrix as `number[16]` |

---

### Template Tools (`mcp-server/src/tools/templates.ts`)

Templates are parameterized definitions stored as JSON files in `templates/`. Parameters replace specific matrix values using JSON Pointer bindings.

| Tool | Inputs | Returns |
|------|--------|---------|
| `list_templates` | — | Array of `{ templateId, name, description, parameters[] }` |
| `get_template` | `templateId` | Full template JSON |
| `get_template_params` | `templateId` | Parameter specs only |
| `instantiate_template` | `templateId`, `params?` | Instantiated definition JSON (not loaded to session) |
| `load_template_to_session` | `templateId`, `params?` | Loads into session (replaces current) |
| `save_as_template` | `templateId`, `name?`, `description?`, `parameters`, `parameterBindings` | Saves current session as template |
| `delete_template` | `templateId` | Deletes template file |

**Parameter binding example:**
```json
{
  "parameters": {
    "link_length": { "type": "number", "default": 1.0, "description": "Length of each link" }
  },
  "parameterBindings": {
    "link_length": ["/system/bodies/1/nodes/0/localTransform/12"]
  }
}
```
Each binding maps a parameter name to an array of JSON Pointers within the definition where the value is substituted.

---

## Session State Architecture

```
mcp-server/src/session.ts
└── session: Session          ← singleton
    ├── def: DemoDefinition   ← mutable definition object
    ├── sseClients: Set       ← connected web UI EventSource connections
    ├── reset(name?, desc?)   ← clear to empty definition
    ├── getDefinition()       ← read current def
    ├── mutate(fn)            ← fn(def) + broadcast to SSE clients
    └── setByPointer(...)     ← RFC 6901 JSON Pointer patch
```

All build tools call `session.mutate()`, which:
1. Applies the mutation
2. Broadcasts `{ type: 'update', definition: ... }` to all SSE clients
3. The React UI (`LiveSession.tsx`) receives this and re-renders the 3D view

---

## Typical MCP Session Workflow (AI agent)

```
1. session_new "My Mechanism" "Description"
2. matrix_identity → use as base transforms
3. matrix_translation x y z → node offsets
4. add_body "base" [{ id: "pivot", localTransform: <identity> }]
5. add_body "arm" [{ id: "effector", localTransform: <translation_1_0_0> }]
6. add_global_node "target" <translation_1.5_0.5_0>
7. add_joint "j1" revolute [0,0,1] [-3.14159, 3.14159]
8. add_actuator "j1" revolute z "pivot" ["arm"]
9. add_solve_loop max=100 condition=distance_less_than(effector,target,0.01) steps=[align_node(...)]
10. validate_definition
11. test_solve [1.5, 0.5, 0]   → check convergence
12. session_get                 → export final JSON
```
