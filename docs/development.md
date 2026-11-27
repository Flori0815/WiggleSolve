# Development

Requirements: Node 24, Python ≥ 3.10 with `pytest`.

```bash
npm ci              # installs all workspaces
npm run dev         # web app on http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run typecheck` | Type-checks every workspace |
| `npm run lint` | ESLint for core, UI and MCP server |
| `npm test` | Core unit tests + JS integration tests |
| `npm run test:coverage -w @wigglesolve/core` | Core unit tests with the 100 % coverage gate used by CI |
| `npm run test:py` | Python unit tests (`core-py/tests`) + Python integration tests (`test-suite/py`) |
| `npm run build` | Builds core, web app and MCP server |

## Repository layout

| Path | Content |
|---|---|
| `core-js/` | `@wigglesolve/core` — the engine (see [architecture.md](architecture.md)) |
| `core-py/` | Python port of the engine with its unit tests |
| `tooling-ui/` | React web app |
| `mcp-server/` | MCP server and live-session bridge ([mcp-server.md](mcp-server.md)) |
| `test-suite/` | Cross-language integration tests over the JSON fixtures |
| `demos/`, `definitions/`, `templates/` | Mechanism definitions ([definition-format.md](definition-format.md)) |
| `docs/` | Documentation |

## Conventions

- Kinematic logic goes into the core, never into a consumer.
- Every core change keeps 100 % statement/line/function coverage.
- New engine features that affect loading or solving are ported to `core-py`
  (see the parity table in [architecture.md](architecture.md)).
- Documentation lives in `docs/`; the repository root holds only `README.md`.

## Continuous integration

`.github/workflows/integration-tests.yml` runs on every pull request:
type-check, lint, core coverage gate, JS integration tests, Python tests.
`deploy.yml` runs the same checks on `main` and publishes the web app to
GitHub Pages.
