# Domain Model

## Class Hierarchy

```
KinematicSystem
├── bodies: Map<id, RigidBody>
│   └── nodes: Map<id, Node>        ← rigidly attached coordinate frames
├── nodes: Map<id, Node>            ← global lookup (includes all body nodes + global nodes)
└── joints: Map<id, Joint>

Math primitives (immutable):
  Matrix4x4   ← SE(3) 4×4 column-major
  Vector3     ← 3D vector
```

---

## Element Classes

### `RigidBody` (`core-js/src/elements/RigidBody.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `transform` | `Matrix4x4` | Body pose in world space |
| `nodes` | `Map<string, Node>` | Attached coordinate frames |

Key methods:
- `addNode(node)` — attach node to body
- `updateNodes()` — recomputes `node.absoluteTransform = body.transform × node.localTransform` for all nodes

**Invariant:** After any change to `body.transform`, call `updateNodes()` or `system.updateForwardKinematics()`.

---

### `Node` (`core-js/src/elements/Node.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier (global across system) |
| `localTransform` | `Matrix4x4` | Offset relative to parent body's frame |
| `absoluteTransform` | `Matrix4x4` | World-space pose (computed, do not set directly) |
| `isLocked` | `boolean` | Static anchor hint for UI |
| `alignment` | `NodeAlignment` | LookAt constraints for definition phase |

**`NodeAlignment` type:**
```ts
type NodeAlignment = {
  primaryAxis: 'x' | 'y' | 'z' | null;
  primaryTarget: string | null;    // node id to point primaryAxis toward
  secondaryAxis: 'x' | 'y' | 'z' | null;
  secondaryTarget: string | null;  // node id to align secondaryAxis toward
};
```

**Global nodes** — nodes not attached to any body. Their `absoluteTransform` is set directly (e.g. `target` node). Added via `system.addNode(node)` without a bodyId.

---

### `Joint` (`core-js/src/elements/Joint.ts`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique identifier |
| `type` | `'revolute' \| 'prismatic' \| 'fixed'` | Joint kinematics |
| `axis` | `[number, number, number]` | Local rotation/translation axis (unit vector) |
| `value` | `number` | Current joint position (radians or meters) |
| `limits` | `[number, number]` | `[min, max]` — use `[-Infinity, Infinity]` for unlimited |

**Note:** `axis` uses aligned-axis shorthand: `[1,0,0]` = X, `[0,1,0]` = Y, `[0,0,1]` = Z. Arbitrary axes are supported but only aligned axes generate correct rotation matrices in `getTransformMatrix()`.

Key method: `getTransformMatrix()` → `Matrix4x4` based on current `value`.

---

### `Matrix4x4` (`core-js/src/math/Matrix4x4.ts`)

Column-major `Float32Array(16)`. Index layout:
```
col:  0   1   2   3
    [ 0   4   8  12 ]   row 0
    [ 1   5   9  13 ]   row 1
    [ 2   6  10  14 ]   row 2
    [ 3   7  11  15 ]   row 3
```
Translation is at `elements[12, 13, 14]`. `new Matrix4x4()` = identity.

All operations return new instances:

| Method | Returns | Notes |
|--------|---------|-------|
| `multiply(m)` | `Matrix4x4` | `this × m` |
| `translate(x, y, z)` | `Matrix4x4` | post-multiply translation |
| `rotateX(r)` / `rotateY(r)` / `rotateZ(r)` | `Matrix4x4` | radians |
| `invert()` | `Matrix4x4` | throws if singular |
| `getTranslation()` | `[number, number, number]` | extracts `[12, 13, 14]` |
| `setTranslation(x, y, z)` | `Matrix4x4` | new matrix with translation set |
| `transformVector(v)` | `Vector3` | full 4×4 transform (w-divide) |
| `rotateVector(v)` | `Vector3` | rotation only (no translation) |
| `clone()` | `Matrix4x4` | deep copy |

**Helper functions** (`core-js/src/math/matrixHelpers.ts`):
```ts
IDENTITY_MAT16                        // Float32Array(16) identity
translationMat16(x, y, z)            // → number[] column-major
rotationXMat16(r) / rotationYMat16(r) / rotationZMat16(r) // → number[]
```

---

### `Vector3` (`core-js/src/math/Vector3.ts`)

Immutable 3D vector. Constructor: `new Vector3(x, y, z)` or spread: `new Vector3(...array)`.

| Method | Returns |
|--------|---------|
| `add(v)` / `sub(v)` | `Vector3` |
| `scale(s)` | `Vector3` |
| `dot(v)` | `number` |
| `cross(v)` | `Vector3` |
| `length()` | `number` |
| `normalize()` | `Vector3` |
| `distanceTo(v)` | `number` |
| `clone()` | `Vector3` |

---

## KinematicSystem API (`core-js/src/system/KinematicSystem.ts`)

```ts
system.addBody(body)                              // registers body + all its nodes
system.addNode(node, bodyId?)                     // register standalone node (global) or attach to body
system.addJoint(joint)                            // register joint
system.updateForwardKinematics()                  // updateNodes() on all bodies
system.solveNodeAlignment(nodeId)                 // LookAt: recompute localTransform based on alignment
system.applyActuatorDelta(jointId, pivotNodeId, movingBodyIds[], deltaValue)  // interactive control
```

---

## JSON Definition Format

Full annotated example (2-link planar arm):

```json
{
  "name": "Planar 2-Link Arm",
  "description": "Two revolute joints in a plane",
  "system": {
    "bodies": [
      {
        "id": "base_body",
        "nodes": [
          {
            "id": "base_pivot",
            "localTransform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
          }
        ]
      },
      {
        "id": "link1_body",
        "nodes": [
          {
            "id": "link1_end",
            "localTransform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 1,0,0,1]
          }
        ]
      },
      {
        "id": "link2_body",
        "nodes": [
          {
            "id": "link2_end",
            "localTransform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 1,0,0,1]
          }
        ]
      }
    ],
    "globalNodes": [
      {
        "id": "target",
        "absoluteTransform": [1,0,0,0, 0,1,0,0, 0,0,1,0, 1.5,0.5,0,1]
      }
    ],
    "joints": [
      { "id": "j1", "type": "revolute", "axis": [0,0,1], "limits": [-3.14159, 3.14159] },
      { "id": "j2", "type": "revolute", "axis": [0,0,1], "limits": [-3.14159, 3.14159] }
    ]
  },
  "actuators": [
    {
      "id": "j1",
      "type": "revolute",
      "axis": "z",
      "pivotNode": "base_pivot",
      "movingBodies": ["link1_body", "link2_body"]
    },
    {
      "id": "j2",
      "type": "revolute",
      "axis": "z",
      "pivotNode": "link1_end",
      "movingBodies": ["link2_body"]
    }
  ],
  "sequence": [
    {
      "type": "loop",
      "max_iterations": 100,
      "condition": {
        "type": "distance_less_than",
        "nodeA": "link2_end",
        "nodeB": "target",
        "threshold": 0.01
      },
      "steps": [
        {
          "type": "operation",
          "operation": {
            "type": "align_node",
            "effectorNode": "link2_end",
            "targetNode": "target",
            "pivotNode": "link1_end",
            "jointId": "j2",
            "movingBodies": ["link2_body"]
          }
        },
        {
          "type": "operation",
          "operation": {
            "type": "align_node",
            "effectorNode": "link2_end",
            "targetNode": "target",
            "pivotNode": "base_pivot",
            "jointId": "j1",
            "movingBodies": ["link1_body", "link2_body"]
          }
        }
      ]
    }
  ]
}
```

### Definition Field Reference

| Field | Type | Notes |
|-------|------|-------|
| `system.bodies[].id` | `string` | Unique body id |
| `system.bodies[].nodes[].id` | `string` | Globally unique node id |
| `system.bodies[].nodes[].localTransform` | `number[16]` | Column-major 4×4; identity = `[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]` |
| `system.globalNodes[].id` | `string` | Unique node id (not attached to any body) |
| `system.globalNodes[].absoluteTransform` | `number[16]` | World-space transform set directly |
| `system.joints[].type` | `'revolute' \| 'prismatic'` | — |
| `system.joints[].axis` | `[x,y,z]` | Unit vector; typically `[1,0,0]`, `[0,1,0]`, or `[0,0,1]` |
| `system.joints[].limits` | `[min, max]` | Radians for revolute, meters for prismatic |
| `actuators[].id` | `string` | Must match a joint id |
| `actuators[].axis` | `'x' \| 'y' \| 'z'` | Simplified axis for UI slider |
| `actuators[].pivotNode` | `string` | Node id that serves as rotation/translation pivot |
| `actuators[].movingBodies` | `string[]` | Bodies transformed by this actuator |
| `sequence[].type` | `'loop'` | Only type currently supported |
| `sequence[].max_iterations` | `number` | Hard limit; 50–200 typical |
| `sequence[].condition.type` | `'distance_less_than'` | Only condition currently supported |
| `sequence[].steps[].operation.type` | `'align_node'` | Only operation currently supported |

### Zod Schemas (`core-js/src/schema.ts`)

| Schema | TypeScript Type | Validates |
|--------|-----------------|-----------|
| `DemoDefinitionSchema` | `DemoDefinition` | Full definition object |
| `DemoBodyDefSchema` | `DemoBodyDef` | Single body |
| `DemoNodeDefSchema` | `DemoNodeDef` | Single node |
| `DemoGlobalNodeDefSchema` | `DemoGlobalNodeDef` | Global node |
| `DemoJointDefSchema` | `DemoJointDef` | Single joint |
| `DemoActuatorDefSchema` | `DemoActuatorDef` | Single actuator |
| `DemoLoopDefSchema` | `DemoLoopDef` | Sequence loop |
| `DemoStepDefSchema` | `DemoStepDef` | Single step (operation) |

Usage:
```ts
const result = DemoDefinitionSchema.safeParse(rawJson);
if (!result.success) { /* result.error.issues */ }
const def: DemoDefinition = result.data;
```

---

## State Flow Diagram

```
JSON definition
     │
     ▼ DemoDefinitionSchema.safeParse()
Validated definition
     │
     ▼ assembleKinematicChain(system, actuators)
Bodies placed at pivot positions (greedy)
     │
     ▼ system.updateForwardKinematics()
All node.absoluteTransform computed
     │
     ├──[User drags slider]──▶ system.applyActuatorDelta(...)
     │                              └──▶ applyJointDelta() ──▶ body.transform updated ──▶ updateNodes()
     │
     └──[Solver runs]──▶ executor.execute(sequence)
                              └──▶ loop: evaluateCondition? → applyOperation() → applyJointDelta()
```
