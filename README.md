# WiggleSolve

WiggleSolve is an iterative kinematics solver built on **rigid-body groups** and
explicit solving operations.

Instead of a fixed parent–child chain, a mechanism is a set of rigid bodies,
each carrying coordinate frames (nodes). Manual **actuators** move groups of
bodies about a pivot; a **solving sequence** of loops and `align_node` steps
then closes the remaining geometric constraints (e.g. a drive strut that must
meet its attachment lug). This makes closed loops and redundant drives easy to
express.

## Quick start

```bash
npm ci
npm run dev        # web app on http://localhost:5173
npm test           # core unit + integration tests
```

In the web app, pick a demo, switch to **Simulate** and move the actuator
sliders; the solver re-closes all loops on every change.

## Core concepts

| Concept | Meaning |
|---|---|
| Rigid body | A group of nodes that move together |
| Node | A coordinate frame (4×4 SE(3) matrix), local to its body or global |
| Joint | One degree of freedom (revolute / prismatic) with limits |
| Actuator | A manual drive moving bodies about a pivot node |
| Sequence | Loops of `align_node` steps that run until a distance condition holds |
| LookAt | Definition-time alignment of a node's axis toward another node |

## Repository

| Path | Content |
|---|---|
| `core-js/` | `@wigglesolve/core` — the TypeScript engine |
| `core-py/` | Python port of the engine |
| `tooling-ui/` | React + three.js web app |
| `mcp-server/` | MCP server for agent-driven modelling |
| `test-suite/` | Cross-language integration tests |
| `demos/`, `definitions/`, `templates/` | Mechanism definitions (JSON) |
| `docs/` | Documentation |

## Documentation

- [Web app guide](docs/user-guide.md)
- [Architecture](docs/architecture.md)
- [Definition format](docs/definition-format.md)
- [Development](docs/development.md)
- [MCP server & templates](docs/mcp-server.md)
