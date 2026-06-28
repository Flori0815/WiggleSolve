# WiggleSolve Templates

This directory stores user-defined kinematic templates. Each template captures a **topology** (which bodies, joints, and solve sequence to use) and declares which geometric values are **user-configurable parameters**.

## What is a template?

A template lets you reuse a kinematic definition by only changing the geometric inputs — link lengths, joint limits, target positions — without touching the topology.

Instead of writing 200 lines of matrix math, you provide:

```json
{
  "templateId": "my_robot_arm",
  "params": {
    "link1_length": 0.35,
    "link2_length": 0.25,
    "target": [1.1, 0.4, 0.0]
  }
}
```

## File format

Templates are stored as `<id>.template.json` files. Each contains:

- `templateId` — unique identifier (used as filename)
- `name`, `description` — human-readable labels
- `parameters` — map of parameter name → `{ type, default, description }`
- `parameterBindings` — map of binding name → `{ formula, input }` describing how parameters produce matrix values
- `definition` — the kinematic definition JSON, with `{"$param": "binding_name"}` tokens where parameters should be substituted

### Supported formulas

| Formula | Input type | Produces |
|---|---|---|
| `translationX` | number | Translation matrix along X |
| `translationY` | number | Translation matrix along Y |
| `translationZ` | number | Translation matrix along Z |
| `translationXYZ` | [x, y, z] | Translation matrix to position |
| `rotationX` | radians | Rotation matrix around X |
| `rotationY` | radians | Rotation matrix around Y |
| `rotationZ` | radians | Rotation matrix around Z |
| `identity` | — | Identity matrix |
| `passthrough` | any | Value used as-is (for limits, axis arrays) |

## Creating templates with the MCP agent

1. Start the MCP server: `node mcp-server/dist/index.js`
2. Open the web app: `npm run dev -w tooling-ui`
3. Connect the web app to the live session (`http://localhost:3001`)
4. In Claude Desktop, describe your mechanism:
   > "I have a 3-link robot arm. The base rotates around the vertical axis, then two links pivot in the vertical plane..."
5. Claude calls `session_new`, `add_body`, `add_joint`, `add_actuator`, `add_solve_loop` — you see each step in the 3D view
6. Call `test_solve` to verify convergence
7. Call `save_as_template` to save the working system as a reusable template

## Using an existing template

```
Claude: "use my robot_arm_3dof template with link1=0.4, link2=0.3, target at [1.2, 0.5, 0.3]"
→ Agent calls instantiate_template + test_solve → done
```

Or load via the web app demo picker (templates appear under "My Templates").

## Claude Desktop config

```json
{
  "mcpServers": {
    "wigglesolve": {
      "command": "node",
      "args": ["/path/to/WiggleSolve/mcp-server/dist/index.js"],
      "env": {
        "WIGGLESOLVE_TEMPLATES_DIR": "/path/to/WiggleSolve/templates",
        "WIGGLESOLVE_PORT": "3001"
      }
    }
  }
}
```
