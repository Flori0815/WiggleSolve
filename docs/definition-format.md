# Definition format

A mechanism is exchanged as JSON validated by `MechanismDefinitionSchema`
(`core-js/src/definition/schema.ts`). All matrices are 16-element,
**column-major** SE(3) arrays (translation at indices 12, 13, 14).

```jsonc
{
  "name": "3-Link Planar Arm",
  "description": "…",
  "system": {
    "bodies": [
      {
        "id": "link1_body",
        "transform": [/* optional explicit world placement */],
        "nodes": [{ "id": "link1_end", "localTransform": [/* 16 numbers */] }]
      }
    ],
    "globalNodes": [{ "id": "target", "absoluteTransform": [/* 16 numbers */] }],
    "joints": [{ "id": "j1", "type": "revolute", "axis": [0, 0, 1], "limits": [-3.14, 3.14] }]
  },
  "actuators": [
    { "id": "j1", "type": "revolute", "axis": "z", "pivotNode": "base_pivot", "movingBodies": ["link1_body"] }
  ],
  "sequence": [
    {
      "type": "loop",
      "max_iterations": 200,
      "condition": { "type": "distance_less_than", "nodeA": "link1_end", "nodeB": "target", "threshold": 0.01 },
      "steps": [
        { "type": "operation", "operation": {
          "type": "align_node", "effectorNode": "link1_end", "targetNode": "target",
          "pivotNode": "base_pivot", "jointId": "j1", "movingBodies": ["link1_body"], "damping": 0.5 } }
      ]
    }
  ]
}
```

## Elements

| Element | Meaning |
|---|---|
| Body | Rigid group of nodes. `transform` places the body in the world. |
| Node | Coordinate frame. Body nodes use `localTransform`; global nodes use `absoluteTransform` and never move. |
| Joint | One degree of freedom (`revolute` in radians, `prismatic` in length units) with `limits`. `axis` is expressed in the frame of the pivot node it is used with; any direction is allowed. |
| Actuator | A manual drive. Rotates/translates `movingBodies` about `pivotNode` along a principal `axis`. Its slider range comes from the joint with the same `id`, if any. |
| Loop | Repeats its steps until its condition holds or `max_iterations` is reached. `distance_less_than` checks `nodeA`/`nodeB`; `all_distances_less_than` checks every pair in `pairs` (closes several loops at once). |
| `align_node` | Moves `jointId` so that `effectorNode` approaches `targetNode`, transforming `movingBodies` about `pivotNode`. `damping` (0–1, default 0.5) scales each step. |

## Visuals

Bodies may carry `visuals`: triangle meshes in the body frame that are drawn
in the viewport and ignored by the solver. This keeps the kinematic model
minimal — only nodes that joints, actuators or loops need — while the
representation can be arbitrarily detailed.

```jsonc
"visuals": [
  { "type": "mesh", "vertices": [x0, y0, z0, x1, y1, z1, …], "indices": [0, 1, 2, …],
    "color": "#94a3b8", "opacity": 0.9 }
]
```

Core helpers build meshes: `beamMesh(a, b, width, height?)`,
`prismMesh(profile, z0, z1)` (convex profile extruded along z),
`boxMesh(min, max)` and `meshFromWorldTriangles(body, positions, { scale })`
(e.g. an STL export of the reference pose). Bodies without visuals are drawn
as rods between their nodes.

## Body placement

If a body has no `transform`, the loader places it:

- bodies moved by an actuator → at the pivot of the most specific actuator
  (the one moving the fewest bodies), so their `localTransform`s are relative
  to that pivot;
- all other bodies → at the world origin, so `localTransform` = world pose.

`Mechanism.toDefinition()` always writes an explicit `transform`, so exported
definitions reload in exactly the exported pose. Infinite joint limits are
written as `±1e6` because JSON has no infinity.

## Where definitions live

| Directory | Purpose |
|---|---|
| `demos/` | Example mechanisms shown in the web app and smoke-tested in CI. |
| `definitions/` | Integration-test fixtures with asserted results (some also shown as demos). |
| `templates/` | Parameterised templates written by the MCP server (see [mcp-server.md](mcp-server.md)). |
