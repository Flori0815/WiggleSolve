# Web app guide

The web app has two modes, shown by the colour bar at the top of the sidebar.

| Mode | Purpose |
|---|---|
| **Edit** (purple) | Build or change the mechanism in its reference pose. |
| **Simulate** (green) | Move the drives; after every change the solver re-closes all loops. Switching back to Edit restores the reference pose exactly. |

Editing is not possible in Simulate mode, so a simulated pose can never leak
into the definition.

## Loading and saving

- **Mechanism picker** — bundled examples, grouped by domain.
- **Open…** — load a definition `.json` from disk. Invalid files are rejected
  with the exact schema issues.
- **Save** — download the current definition (Edit mode only). Saved files
  contain explicit body placements and reload in exactly the same pose.
- **Live MCP session** (sidebar footer) — follow an agent that builds a
  mechanism through the MCP server ([mcp-server.md](mcp-server.md)).

## Edit mode

| Tab | Contents |
|---|---|
| Bodies & nodes | Rigid bodies with their representation (attach an STL in m or mm, exported in world coordinates of the reference pose), their nodes (positions in the body frame, optional look-at orientation) and fixed points in world space. |
| Actuators | Manual drives: rotate/slide, axis, pivot node, moved bodies and drive range (° or m). |
| Solver | Loops that run their align steps until two nodes meet, with tolerance, iteration limit and per-step damping. |

Cards are collapsed by default; their subtitle summarises the content and
flags incomplete items. Selects that reference a deleted element are
highlighted.

## Simulate mode

Each actuator has a slider and a numeric field (degrees for rotary, metres for
linear drives) limited to its range. **Reset all** returns every drive to 0.
The status banner reports whether all loops closed, did not converge, or
could not run (e.g. a loop references a missing node).

## Viewport

Drag to orbit, right-drag to pan, scroll to zoom. The toolbar toggles body/actuator names, node names,
node frames, **joint axes** (a small triad at every joint pivot plus an arrow
along each joint axis: revolute orange, prismatic cyan) and the legend; **Fit view** re-frames the mechanism (this also
happens automatically on load).
