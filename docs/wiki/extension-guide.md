# Extension Guide

How to add new features to WiggleSolve. Each section lists exactly which files to touch and in what order.

---

## Add a New Joint Type

**Example:** adding a `spherical` joint.

1. **`core-js/src/elements/Joint.ts`** — extend `JointType`:
   ```ts
   export type JointType = 'revolute' | 'prismatic' | 'fixed' | 'spherical';
   ```
   Add joint value semantics (e.g. quaternion) and update `getTransformMatrix()`.

2. **`core-js/src/schema.ts`** — update enum:
   ```ts
   type: z.enum(['revolute', 'prismatic', 'spherical']),
   ```

3. **`core-js/src/system/utils.ts`** — `applyJointDelta()`: handle the new type's transform.

4. **`core-js/src/solver/operations.ts`** — `applyOperation()`: add computation of `step` for the new type.

5. **`core-py/src/wigglesolve/elements/joint.py`** — mirror all TS changes in Python.

6. **`core-py/src/wigglesolve/system/utils.py`**, **`solver/operations.py`** — mirror solver changes.

7. **Add tests:** `core-js/tests/solver.test.ts` — verify a mechanism using the new type converges.

---

## Add a New Operation Type

**Example:** adding `align_orientation` (orient effector to match target frame).

1. **`core-js/src/solver/operations.ts`** — extend `Operation` union:
   ```ts
   export interface AlignOrientationOp {
     type: 'align_orientation';
     effectorNode: string;
     targetNode: string;
     pivotNode: string;
     jointId: string;
     movingBodies: string[];
     damping?: number;
   }
   export type Operation = AlignNodeOp | AlignOrientationOp;
   ```
   Add the computation branch inside `applyOperation()`.

2. **`core-js/src/schema.ts`** — add step schema:
   ```ts
   export const DemoAlignOrientationStepDefSchema = z.object({
     type: z.literal('operation'),
     operation: z.object({
       type: z.literal('align_orientation'),
       // ... fields
     }),
   });
   export const DemoStepDefSchema = z.union([DemoAlignNodeStepDefSchema, DemoAlignOrientationStepDefSchema]);
   ```

3. **`core-js/src/solver/Executor.ts`** — no changes needed if `applyOperation` handles the dispatch.

4. **`core-py/src/wigglesolve/solver/operations.py`** — mirror the new operation.

5. **`mcp-server/src/tools/build.ts`** — update `handleAddSolveLoop` type signature if adding new step fields.

6. **Add tests:** new test case in `core-js/tests/solver.test.ts`.

---

## Add a New Convergence Condition

**Example:** adding `angle_less_than`.

1. **`core-js/src/solver/conditions.ts`** — extend `Condition` interface:
   ```ts
   export interface Condition {
     type: 'distance_less_than' | 'angle_less_than';
     // ... add fields for new type
   }
   ```
   Add branch in `evaluateCondition()`.

2. **`core-js/src/schema.ts`** — extend `DemoLoopDefSchema.condition`:
   ```ts
   condition: z.union([
     z.object({ type: z.literal('distance_less_than'), nodeA: z.string(), nodeB: z.string(), threshold: z.number() }),
     z.object({ type: z.literal('angle_less_than'), ... }),
   ]),
   ```

3. **`core-py/src/wigglesolve/solver/conditions.py`** — mirror.

4. **`mcp-server/src/tools/build.ts`** — update `handleAddSolveLoop` condition type.

5. **Add tests.**

---

## Add a New Demo

Demos are JSON files in `demos/` loaded by the UI demo picker. They do **not** run integration tests (only smoke tests).

1. Create `demos/my_mechanism.json` following the definition format (see [domain-model.md](domain-model.md)).
2. The file is automatically discovered by `tooling-ui/src/hooks/useDemoLoader.ts` — no registration needed.
3. To add a smoke test: add the filename to the list in `test-suite/js/demos.test.ts` (or it may auto-discover).

**Naming convention:** `snake_case` describing the mechanism (e.g. `hydraulic_crane.json`).

---

## Add a Definition (Integration Test Target)

Definitions in `definitions/` are used for integration tests. They must be complete, valid, and solver-convergent.

1. Create `definitions/my_definition.json` — same format as demos but must converge reliably.
2. Add an integration test in `test-suite/js/integration.test.ts`:
   ```ts
   describe('my_definition', () => {
     it('solver converges', async () => {
       const { converged, jointValues, nodePositions } = await loadAndRun('definitions/my_definition.json');
       expect(converged).toBe(true);
       // assert specific node positions and joint limit compliance
     });
   });
   ```
3. Run `npm run test:integration` from root to verify.

---

## Add an MCP Tool

1. **`mcp-server/src/tools/<category>.ts`** — add handler function:
   ```ts
   export function handleMyTool(args: { param: string }): { content: [{ type: 'text'; text: string }] } {
     const def = session.getDefinition();
     // ... logic ...
     return { content: [{ type: 'text' as const, text: result }] };
   }
   ```
   Use `ok(text)` / `err(text)` helper pattern from existing tools.

2. **`mcp-server/src/index.ts`** — register the tool:
   - Add to the `server.setRequestHandler(ListToolsRequestSchema, ...)` tools array with `name`, `description`, `inputSchema` (JSON Schema object).
   - Add `case 'my_tool':` to the `CallToolRequestSchema` handler switch.

3. **No schema changes needed** unless the tool exposes new JSON definition features.

---

## Add a Template

Templates are parameterized definitions stored in `templates/`. The template system substitutes parameter values into definition fields via JSON Pointer bindings.

1. Build the base definition using the MCP session tools.
2. Call `save_as_template` with:
   ```json
   {
     "templateId": "my_template",
     "name": "My Template",
     "parameters": {
       "arm_length": { "type": "number", "default": 1.0, "description": "Length of arm link" }
     },
     "parameterBindings": {
       "arm_length": [
         "/system/bodies/1/nodes/0/localTransform/12"
       ]
     }
   }
   ```
3. The template is saved to `templates/my_template.json` and immediately available via `list_templates`.

---

## Python Parity Checklist

When making changes to `core-js/src/`, mirror them in `core-py/src/wigglesolve/`:

| JS file | Python file |
|---------|-------------|
| `elements/RigidBody.ts` | `elements/rigid_body.py` |
| `elements/Node.ts` | `elements/node.py` |
| `elements/Joint.ts` | `elements/joint.py` |
| `elements/Link.ts` | `elements/link.py` |
| `math/Matrix4x4.ts` | `math/matrix4x4.py` |
| `math/Vector3.ts` | `math/vector3.py` |
| `system/KinematicSystem.ts` | `system/kinematic_system.py` |
| `system/utils.ts` | `system/utils.py` |
| `system/assembly.ts` | `system/assembly.py` |
| `solver/Executor.ts` | `solver/executor.py` |
| `solver/operations.ts` | `solver/operations.py` |
| `solver/conditions.ts` | `solver/conditions.py` |

**Parity tolerance:** Python results must match JavaScript within `0.05` units (tested in `test-suite/py/`).

**Naming:** TS `camelCase` → Python `snake_case` for methods and properties; classes remain `PascalCase` in both.

---

## Adding Tests

### Unit test (core-js math or solver)
File: `core-js/tests/math.test.ts` or `core-js/tests/solver.test.ts`

```ts
describe('MyFeature', () => {
  it('does the expected thing', () => {
    // arrange
    const system = new KinematicSystem();
    // ...
    // act
    const result = /* ... */;
    // assert
    expect(result).toBeCloseTo(expected, 2);
  });
});
```
Run: `npm test` in `core-js/`.

### Integration test
File: `test-suite/js/integration.test.ts`

```ts
describe('my_mechanism', () => {
  it('solver converges', async () => {
    const { converged, jointValues, nodePositions } = await loadAndRun('definitions/my_mechanism.json');
    expect(converged).toBe(true);
    expect(nodePositions['effector'][0]).toBeCloseTo(1.5, 1);
    for (const [id, val] of Object.entries(jointValues)) {
      // verify joint values stayed within limits
    }
  });
});
```
Run: `npm run test:integration` from root.
