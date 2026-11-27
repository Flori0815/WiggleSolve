# Architecture

WiggleSolve is a monorepo with one engine and several thin consumers.
The rule is simple: **all kinematics, validation, I/O and simulation state live
in the core; everything else only adapts it to a medium** (browser, MCP, tests).

```
            ┌─────────────────────────────────────────────┐
            │  @wigglesolve/core   (core-js/src)          │
            │                                             │
            │  math/        Matrix4x4, Vector3, axis      │
            │  elements/    Node, RigidBody, Joint        │
            │  system/      KinematicSystem, snapshot,    │
            │               applyJointDelta               │
            │  solver/      Executor, conditions, ops     │
            │  definition/  schema, build, serialize,     │
            │               assembly                      │
            │  visual/      representation meshes         │
            │  simulation/  Mechanism                     │
            │  mechanisms/  generators: flaps, surfaces,  │
            │               widebody wing                 │
            └───────▲──────────────▲──────────────▲───────┘
                    │              │              │
        tooling-ui (React)   mcp-server (MCP)   test-suite/js
                                                   │
            core-py (Python port) ◄── test-suite/py ┘  (same JSON fixtures)
```

## Layers inside the core

| Layer | Responsibility | Depends on |
|---|---|---|
| `math` | SE(3) matrices (column-major), vectors, axis helpers | – |
| `elements` | Nodes (frames), rigid bodies (node groups), joints (1-DOF) | math |
| `system` | `KinematicSystem` registry, forward kinematics, LookAt alignment, body moves (`applyJointDelta`), state snapshots | elements |
| `solver` | `Executor` runs loops of `align_node` operations until a distance condition holds | system |
| `definition` | JSON interchange: zod schema, `parseDefinition`, `buildSystem`, `serializeDefinition`, initial assembly | system, solver |
| `visual` | Representation meshes on bodies and mesh builders; never read by the solver | math, elements |
| `mechanisms` | Parametric generators that emit definitions for a family of mechanisms (see [high-lift-systems.md](high-lift-systems.md)) | definition, math |
| `simulation` | `Mechanism`: system + actuators + sequence; drive, solve, definition ↔ simulation lifecycle, editing helpers | all of the above |

Lower layers never import higher ones.

## The `Mechanism` facade

`Mechanism` is the only object a UI needs:

```ts
const m = Mechanism.fromDefinition(json);   // validate + build + assemble
m.startSimulation();                        // freeze the definition pose
m.drive('j1', 0.4);                         // move actuator, re-solve → SolveResult
m.stopSimulation();                         // back to the definition pose
const json2 = m.toDefinition();             // export (explicit body placements)
```

`solve()` never throws; it returns `{ converged, error? }` so a half-built
sequence cannot crash a front end.

## Consumers

- **tooling-ui** — React + three.js. `useMechanism` owns the single `Mechanism`
  and a `version` counter; components mutate the mechanism through its API and
  call `onChange`. The UI consumes the core as TypeScript source (Vite alias)
  for hot reload. Structure:

  | Folder | Content |
  |---|---|
  | `components/common` | Generic building blocks: `Section`, `Card`, fields, id input |
  | `components/editor` | Edit-mode panels: bodies & nodes, actuators, solver loops |
  | `components/simulation` | Simulate-mode drive panel |
  | `components/viewport` | three.js scene: renderer, actuator gizmos, camera framing |
  | `hooks`, `utils` | `useMechanism`, `useExpanded`, unit formatting |

  The viewport only receives the system and derived `ActuatorView`s; it never
  mutates the mechanism.
- **mcp-server** — MCP tools that edit a JSON session and validate/solve it via
  the core. Consumes the compiled core (`core-js/dist`, CommonJS).
- **test-suite/js** — integration tests over `definitions/` and `demos/`.
- **core-py** — Python port of the engine and the definition loader;
  **test-suite/py** runs the same JSON fixtures against it.

Feature parity between the cores:

| Feature | core-js | core-py |
|---|---|---|
| Math, elements, solver (`align_node`, `close_loops`, multi-pair conditions), LookAt | ✓ | ✓ |
| Definition loading (+ explicit body transforms) | ✓ | ✓ |
| Visual meshes | ✓ | ignored (not needed for solving) |
| Schema validation, serialisation, `Mechanism` | ✓ | – |

## Review findings and decisions

The architecture review that introduced this structure found:

| Finding | Resolution |
|---|---|
| Definition → system loading was implemented three times (UI hook, MCP tool, JS test loader) plus once in Python tests | One loader per core: `definition/build.ts`, `wigglesolve/definition.py` |
| Actuator driving, snapshot/restore and the definition/simulation lifecycle lived in React hooks and `useEffect`s | Moved into `Mechanism` and `system/snapshot.ts` |
| Actuator state duplicated in React state (`UIActuator`) next to the definition | Actuators are `ActuatorDef`s on the mechanism; drive values are owned by the mechanism |
| The UI created joints during render and stored UI config on core operations | Joints are created by `Mechanism.addAlignStep`; the UI derives its view from the joint |
| Deleting a body left its nodes in `system.nodes` | `KinematicSystem.removeBody/removeNode` |
| Joint axes other than `+x/+y/+z` silently rotated about `+z` | `Matrix4x4.rotateAxis` (Rodrigues) used by `Joint.getTransformMatrix` |
| Package named `core-js` (collides with the well-known npm polyfill) and marked `"type": "module"` while emitting CommonJS — the MCP server crashed on start | Renamed to `@wigglesolve/core`, CommonJS package |
| UI `typecheck` script checked nothing (`tsc --noEmit` on a solution tsconfig) and the UI was not `strict` | `tsc -p tsconfig.app.json`, `strict: true` |
| Core unit tests and Python unit tests were not run in CI | CI runs core coverage gate, both integration suites and both Python suites |
| Unused code and boilerplate (`Link`, Vite template README/assets, `zod` in UI/MCP deps) | Removed |
| Definitions could not be exported; body placement was implicit | `serializeDefinition` writes optional explicit `transform` per body |
