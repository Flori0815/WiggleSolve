WiggleSolve Architecture (Kinematics Solver Platform)

1. Core Concept & Philosophy

The foundational principle of WiggleSolve is Iterative Geometric Alignment.

Unlike traditional kinematics solvers that rely on formulating and solving systems of algebraic or differential equations (e.g., using inverse Jacobian matrices), WiggleSolve uses a purely iterative, step-by-step approach.

Core Principles

4x4 Matrices Everywhere: Every element (nodes, links, joints) is ultimately represented and manipulated using 4x4 Transformation Matrices ($SE(3)$) to capture both translation and rotation uniformly.

Sequences over Equations: Users define a "Sequence" of alignment operations (loops, conditions, alignments) rather than mathematical constraints.

Parent-Child Hierarchy: The geometry is maintained through a strict mathematical chain: Child Node (4x4) = Parent Node (4x4) * Joint Variable (4x4) * Link Offset (4x4). This guarantees rigid body mechanics aren't broken during iterations.

No Singularities: Avoids the mathematical singularities (like division by zero) that plague equation-based solvers at kinematic boundaries.

2. Dimensionality Agnosticism (2D & 3D Unification)

A major feature of WiggleSolve is handling both 2D and 3D mechanisms seamlessly using the exact same core engine.

The "Everything is 3D" Approach

Under the hood, the solver only knows 3D space. There is no separate 2D math engine. 2D kinematics ($SE(2)$) is simply treated as a strictly constrained subset of 3D kinematics ($SE(3)$).

2D mode as a constraint layer: When a system is flagged as "dimensions": "2D" in the JSON definition, the solver engine and the UI enforce strict constraints:

All translation is locked to the XY plane (Z offset = 0).

All rotation is locked around the Z-axis (Rx = 0, Ry = 0).

Standard joints become exclusively Revolute (around Z) or Prismatic (along X/Y).

2D to 3D Transformation: Promoting a 2D definition to 3D is trivial. The JSON is imported, and the constraints locking the Z, Rx, and Ry axes are simply removed or exposed to the user to adjust.

3D to 2D Projection: Projecting a 3D system into 2D involves an orthographic projection. The system flattens the Z-coordinates of all Nodes to a defined plane (e.g., $Z=0$) and maps the 3D rotational frames to pure Z-axis rotations relative to the viewer's normal plane.

3. Data Representation (The Kinematic Chain)

The problem definition is captured in a standardized JSON format split into system (geometry) and sequence (instructions).

The system Object

nodes: The coordinate frames (Position + Orientation).

joints: The dynamic variables. Defines the permitted DOFs (e.g., "revolute", "prismatic") and axes of rotation/translation relative to the parent.

links: Static, rigid 4x4 transformations between a joint and the child node.

Higher-Order Elements:

linear_track: A specialized joint allowing nodes to slide along a defined vector path.

actuator: A logical element wrapping a joint, assigning specific limits, target speeds, or dependencies to it.

The sequence Object (Iterative Logic)

The sequence is an array of instructions the solver executes. It supports nesting and conditional logic.

"sequence": [
  {
    "type": "loop",
    "condition": { "type": "distance_less_than", "node_a": "end_effector", "node_b": "target", "value": 0.01 },
    "max_iterations": 50,
    "steps": [
      {
        "type": "align_node",
        "target": "target",
        "node_to_move": "end_effector",
        "adjust_variables": ["theta1", "theta2"]
      }
    ]
  }
]


4. Rigid Coupling in Iteration Loops

To accommodate complex alignments—where moving one element must rigidly drag another disconnected element along with it during the iteration step—we use Virtual Groups (Rigid Linking).

How it works:

Normally, aligning Link B to Link A only calculates the $\Delta T$ (Transformation Delta) required for B, and applies it to B's parent joints.

If we need Link C to maintain its exact relative position to Link B during this alignment step (even if C is not a direct child of B in the node tree), the sequence step allows for grouping:

{
  "type": "align_group",
  "target": "Link A",
  "primary_node_to_move": "Link B",
  "rigidly_linked_nodes": ["Link C"], 
  "adjust_variables": ["joint_base"]
}


Execution:

The solver calculates the required $\Delta T$ to align Link B to Link A.

The solver applies that same exact spatial $\Delta T$ to Link C.

Inverse Kinematics are then executed backwards from both B and C to adjust the allowed joint variables, keeping the relative 4x4 offset between B and C identical before and after the iteration step.

5. Dual-Language Monorepo Structure

WiggleSolve uses a monorepo approach, guaranteeing parity across environments. The project is distributed under the MIT License.

wigglesolve/
├── core-js/                 # JavaScript/TypeScript core math & solver engine
├── core-py/                 # Python port of the core engine
├── tooling-ui/              # Web-based visual authoring & debugging tool
├── definitions/             # Shared JSON schemas
├── test-suite/              # UI-generated JSON test cases for CI/CD
└── LICENSE                  # MIT License


6. Execution Flow

Parsing: Parse JSON, build Node hierarchy tree.

Forward Kinematics (FK) Update: Cascade down the tree multiplying matrices: Parent * Joint * Link = Child.

Solving (Sequence Execution):

Read sequence instructions, evaluating loops and nesting.

Execute align operations: calculate desired 4x4 matrix changes.

Apply changes via Inverse Kinematics to specific variables, respecting constraints and Virtual Groups.

Trigger an FK Update to refresh the spatial tree.

Iteration: Repeat until loop conditions are met or max_iterations trigger a fallback.

7. Development Strategy & UI Tooling

Phase 1 relies heavily on coupling the JS engine to a web-based UI. Visualizing iterative kinematics is crucial for debugging local minima and convergence issues. For now, 3D visualization remains abstract (e.g., rendering lines for links and abstract markers for nodes/frames) rather than loading complex meshes.

UI Core Capabilities & Test Generation

Visual System Builder & Sequence Editor: Drag-and-drop hierarchy and tree-view loop construction.

Live Visualization: Abstract 2D/3D rendering of the solver executing its loops in real-time.

Deployment (GitHub Pages): Because the solver runs entirely client-side using core-js, the tooling-ui React application will be compiled into static files and hosted directly and freely via GitHub Pages.

The Validation Pipeline (Source of Truth):

Developers build a working system visually.

They click "Export Test Case".

The UI packages the system JSON, the sequence JSON, and the exact numerical output matrices.

Both core-js and core-py CI pipelines use these identical test cases to guarantee 100% mathematical parity.
