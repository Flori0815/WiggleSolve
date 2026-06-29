# WiggleSolve — LLM Quick Reference

WiggleSolve is a non-linear iterative inverse kinematics (IK) solver built on **Rigid Body Groups** rather than kinematic chains. It uses Cyclic Coordinate Descent (CCD) with explicit SE(3) matrix math. Packaged as a TypeScript monorepo with a Python port, a React 3D visualizer, and an MCP server for AI agent use.

> **Deeper docs:** [Domain Model](docs/wiki/domain-model.md) · [Algorithms](docs/wiki/algorithms.md) · [MCP Tools](docs/wiki/mcp-tools.md) · [Extension Guide](docs/wiki/extension-guide.md)

---

## Package Map

| Package | Purpose | Entry Point | Key Deps |
|---------|---------|-------------|----------|
| `core-js/` | Pure kinematics engine (math + solver) | `src/index.ts` | `zod` |
| `core-py/` | Python port of core-js | `src/wigglesolve/__init__.py` | none |
| `tooling-ui/` | React 3D visualizer | `src/App.tsx` | `react`, `three`, `@react-three/fiber` |
| `mcp-server/` | MCP server for AI agents | `src/index.ts` | `@modelcontextprotocol/sdk`, `core-js` |
| `test-suite/js/` | Integration tests | `integration.test.ts` | `jest`, `core-js` |
| `definitions/` | 4 canonical test definitions (JSON) | — | — |
| `demos/` | 18 example mechanisms (JSON) | — | — |
| `templates/` | Parameterized reusable definitions | — | — |

### core-js Internal Layout

```
core-js/src/
├── index.ts              ← barrel export (import everything from here)
├── schema.ts             ← Zod schemas + inferred TypeScript types
├── elements/
│   ├── RigidBody.ts      ← body with attached nodes
│   ├── Node.ts           ← coordinate frame (local + absolute transform)
│   ├── Joint.ts          ← revolute/prismatic actuator state
│   └── Link.ts           ← fixed static offset
├── math/
│   ├── Matrix4x4.ts      ← SE(3) 4×4 column-major matrix (immutable ops)
│   ├── Vector3.ts        ← 3D vector (immutable ops)
│   └── matrixHelpers.ts  ← IDENTITY_MAT16, translationMat16(), rotationXYZMat16()
├── system/
│   ├── KinematicSystem.ts ← central registry; FK, LookAt, actuator delta
│   ├── assembly.ts        ← assembleKinematicChain(): greedy body placement
│   └── utils.ts           ← applyJointDelta(): CCD delta transform
└── solver/
    ├── Executor.ts        ← recursive instruction runner
    ├── operations.ts      ← applyOperation(): align_node CCD step
    └── conditions.ts      ← evaluateCondition(): distance_less_than
```

---

## Commands

| Task | Command | Where |
|------|---------|-------|
| Build core-js | `npm run build` | `core-js/` |
| Unit tests (core-js) | `npm test` | `core-js/` |
| Integration tests | `npm run test:integration` | root |
| Lint all | `npm run lint` | root |
| UI dev server | `npm run dev` | `tooling-ui/` |
| UI production build | `npm run build` | `tooling-ui/` |
| Typecheck UI | `npm run typecheck` | `tooling-ui/` |
| MCP server dev | `npm run dev` | `mcp-server/` |
| MCP server start | `npm start` | `mcp-server/` (requires core-js built) |
| Python install | `pip install -e .[dev]` | `core-py/` |
| Python tests | `pytest` | `core-py/` |

---

## Core Domain Model (3-line summary)

A **KinematicSystem** holds bodies, nodes, and joints. **RigidBodies** contain **Nodes** (coordinate frames); moving a body recomputes its nodes' `absoluteTransform = body.transform × node.localTransform`. **Joints** store current `value` + `limits`; **Actuators** (in JSON) bind a joint to a pivot node and a list of moving bodies.

→ Full type details: [docs/wiki/domain-model.md](docs/wiki/domain-model.md)

---

## Naming Conventions

| Context | TypeScript | Python |
|---------|-----------|--------|
| Classes | `PascalCase` (`RigidBody`, `Matrix4x4`) | `PascalCase` |
| Class files | `PascalCase.ts` | `snake_case.py` |
| Utility files | `camelCase.ts` (`matrixHelpers.ts`) | `snake_case.py` |
| Methods/functions | `camelCase` (`applyJointDelta`) | `snake_case` |
| Properties | `camelCase` (`absoluteTransform`) | `snake_case` (`absolute_transform`) |
| Booleans | `isLocked`, `hasAlignment` | `is_locked` |
| Constants | `UPPER_SNAKE` (`IDENTITY_MAT16`) | `UPPER_SNAKE` |
| Test files | `*.test.ts` / `*.spec.ts` | `test_*.py` |
| JSON ids | `snake_case` (`base_pivot`, `link1_end`) | — |

---

## Key Patterns

**Immutable math** — All `Matrix4x4` and `Vector3` operations return new instances. Never mutate `.elements` directly unless constructing from raw data.

```ts
// Correct
const result = matA.multiply(matB);

// Wrong — don't mutate in place
matA.elements[0] = 5;
```

**Functional solver** — `applyOperation`, `evaluateCondition`, `applyJointDelta` are pure functions; side effects only on `joint.value` and `body.transform`.

**Error handling** — throw descriptive errors on missing elements; no silent fallbacks in core logic.

```ts
if (!effector || !target || !pivot || !joint) {
  throw new Error(`Operation Error: Required elements not found.`);
}
```

**Epsilon guards** — use `1e-6` for length/distance checks, `1e-8` for delta application.

**Zod validation** — all external JSON must pass `DemoDefinitionSchema.safeParse()` before use.

**Column-major matrices** — `Float32Array(16)` in column-major order (OpenGL/GPU convention). Index mapping: `elements[col*4 + row]`. Translation is at indices `[12, 13, 14]`.

---

## Common Task Templates

### Add a node to a body (programmatic)
```ts
import { Node, RigidBody, Matrix4x4 } from 'core-js';

const node = new Node('my_node');
node.localTransform = new Matrix4x4().translate(1, 0, 0); // offset 1 unit on X
body.addNode(node);
system.addBody(body); // also registers all body nodes in system.nodes
```

### Add a revolute joint
```ts
import { Joint } from 'core-js';

const joint = new Joint(
  'j1',           // id
  'revolute',     // type
  [0, 0, 1],      // axis (z-axis rotation)
  0,              // initial value (radians)
  [-Math.PI, Math.PI] // limits [min, max]
);
system.addJoint(joint);
```

### Instantiate and run the solver
```ts
import { KinematicSystem, RigidBody, Node, Joint, Matrix4x4, Executor, assembleKinematicChain } from 'core-js';
import type { Instruction } from 'core-js';

const system = new KinematicSystem();
// ... add bodies, nodes, joints ...
assembleKinematicChain(system, actuatorDefs);
system.updateForwardKinematics();

const sequence: Instruction[] = [ /* from JSON */ ];
const executor = new Executor(system);
const converged = executor.execute(sequence); // true if all loops converged
```

### Write an integration test
```ts
// test-suite/js/integration.test.ts pattern
describe('my_mechanism', () => {
  it('solver converges', async () => {
    const { converged, jointValues, nodePositions } = await loadAndRun('definitions/my_mechanism.json');
    expect(converged).toBe(true);
    expect(nodePositions['effector'][0]).toBeCloseTo(targetX, 1);
    for (const [id, val] of Object.entries(jointValues)) {
      const joint = getJointDef(id);
      expect(val).toBeGreaterThanOrEqual(joint.limits[0]);
      expect(val).toBeLessThanOrEqual(joint.limits[1]);
    }
  });
});
```

### Add an MCP tool handler
```ts
// mcp-server/src/tools/mytools.ts
export function handleMyTool(args: { param: string }) {
  const def = session.getDefinition();
  // ... logic ...
  return { content: [{ type: 'text' as const, text: 'result' }] };
}
// Register in mcp-server/src/index.ts switch statement
```

### JSON definition identity matrix
```json
[1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  0, 0, 0, 1]
```
Translation to (x, y, z):
```json
[1, 0, 0, 0,  0, 1, 0, 0,  0, 0, 1, 0,  x, y, z, 1]
```

---

## File Locations Quick Reference

| What | Where |
|------|-------|
| Zod schemas + TS types | `core-js/src/schema.ts` |
| Forward kinematics | `core-js/src/elements/RigidBody.ts:updateNodes()` |
| CCD step | `core-js/src/solver/operations.ts:applyOperation()` |
| Joint delta transform | `core-js/src/system/utils.ts:applyJointDelta()` |
| Solver loop runner | `core-js/src/solver/Executor.ts` |
| LookAt alignment | `core-js/src/system/KinematicSystem.ts:solveNodeAlignment()` |
| Chain assembly | `core-js/src/system/assembly.ts:assembleKinematicChain()` |
| MCP build tools | `mcp-server/src/tools/build.ts` |
| MCP validate tools | `mcp-server/src/tools/validate.ts` |
| MCP template tools | `mcp-server/src/tools/templates.ts` |
| MCP matrix utils | `mcp-server/src/tools/utils.ts` |
| Integration test loader | `test-suite/js/loader.ts` |
| Canonical simple demo | `definitions/planar_2_link_arm.json` |
