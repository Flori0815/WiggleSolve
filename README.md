# WiggleSolve (Group-Based Kinematics)

WiggleSolve is a non-linear, iterative kinematics solver based on **Rigid Body Groups** and explicit solving operations.

Unlike traditional robotic solvers that rely on fixed parent-child kinematic chains, WiggleSolve treats the system as a collection of Rigid Bodies containing multiple spatial Nodes. Solving is performed by applying explicit transformations to these groups to satisfy geometric constraints.

## Core Concepts

### 1. Rigid Bodies & Nodes
- **Rigid Body:** A container that holds a set of Nodes. All nodes in a body move together as a single rigid unit.
- **Node:** A coordinate frame defined by a 4x4 Transformation Matrix. A node has a `localTransform` relative to its body and a computed `absoluteTransform` in world space.
- **Global Nodes:** Standalone reference frames used for targets or world-space anchors.

### 2. Manual Solving Logic (Explicit Operations)
Instead of an automated tree traversal, solving is defined through explicit **Align** operations:
- **Effector:** The node you want to move.
- **Target:** The coordinate frame you want to reach.
- **Pivot:** The physical location and orientation of the joint axis.
- **Moving Bodies:** An explicit list of Rigid Bodies that will be transformed by this step.

### 3. Actuators
Actuators are physical drivers applied *before* the iterative loops. They allow for manual interactive control of the mechanism. Moving an actuator slider rigidly transforms its associated bodies around a pivot.

### 4. Definition Mode Alignments (LookAt)
During the design phase, nodes can be dynamically aligned to other nodes using **LookAt** logic. You can specify a primary axis (X, Y, or Z) and a target node; the system will automatically calculate the necessary `localTransform` to maintain that orientation.

## Technical Architecture

### Core Engine (`core-js`)
- **Matrix-First Math:** Pure SE(3) math using 4x4 matrices for all transformations.
- **Delta-Transform Solver:** Calculates incremental spatial corrections at the pivot and applies them to body groups.
- **Hoisted Workspaces:** Optimized monorepo structure with shared developer tools and dependency-free logic.

### UI Tooling (`tooling-ui`)
- **Real-Time Visualizer:** 3D viewport showing bodies, coordinate frames, and rigid links.
- **Interactive Sequence Editor:** Build nested loops and alignment logic visually.
- **Live Simulator:** Drive actuators in "Solved Mode" to see real-time convergence and mechanism behavior.

## Workflow
1. **Design:** Create Rigid Bodies and Nodes. Use LookAt Align to set up complex orientations.
2. **Drive:** Define Actuators to specify how you want to manually interact with the machine.
3. **Logic:** Build a Solving Sequence with loops and Align steps to handle the automated constraints.
4. **Solve:** Drag the Actuator sliders to see your mechanism come to life.
