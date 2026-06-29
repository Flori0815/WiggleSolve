# Algorithms

## 1. Forward Kinematics

**Where:** `RigidBody.updateNodes()` → called via `KinematicSystem.updateForwardKinematics()`

**Rule:** For every node attached to a body:
```
node.absoluteTransform = body.transform × node.localTransform
```

**When to call:** After any change to `body.transform`. The system does not auto-propagate — you must call `body.updateNodes()` or `system.updateForwardKinematics()` explicitly.

```ts
// core-js/src/elements/RigidBody.ts
updateNodes(): void {
  for (const node of this.nodes.values()) {
    node.absoluteTransform = this.transform.multiply(node.localTransform);
  }
}
```

---

## 2. Kinematic Chain Assembly

**Where:** `core-js/src/system/assembly.ts:assembleKinematicChain()`

**Purpose:** Place moving bodies at their initial positions before solving. Bodies not listed in any actuator's `movingBodies` are treated as anchors (already positioned).

**Algorithm (greedy):**
```
positioned = { bodies not in any actuator.movingBodies }
call updateNodes() for each positioned body

repeat until no progress:
  for each unpositioned body:
    find best actuator where:
      - body is in actuator.movingBodies
      - actuator.pivotNode belongs to a positioned body
      - prefer actuator with fewest movingBodies (most specific)
    if found:
      place body.transform = identity.translate(pivot.position)
      call body.updateNodes()
      mark body as positioned
```

**Note:** This is initialization only — bodies are placed at their pivot's world position, not at their final solved pose.

---

## 3. LookAt Alignment (Definition Mode)

**Where:** `KinematicSystem.solveNodeAlignment()` (`core-js/src/system/KinematicSystem.ts`)

**Purpose:** During definition/design phase, orient a node so a chosen axis points at a target node. Modifies `node.localTransform` (not absoluteTransform directly).

**Algorithm:**
```
1. Compute worldDir = normalize(target.position - node.position)
2. Transform to local space: localDir = parentBody.transform.invert().rotateVector(worldDir)
3. Build orthonormal basis with localDir as primary axis (z by default):
   - z = localDir
   - x = cross(z, [0,1,0]) (or [1,0,0] if z is nearly parallel to y)
   - y = cross(z, x)
4. Fill rotation matrix rows/columns based on primaryAxis ('x'|'y'|'z')
5. If secondaryAxis + secondaryTarget are set:
   - Project secondary target direction perpendicular to primary axis
   - Compute signed angle (Rodrigues rotation) to align secondary axis
   - Apply correction rotation around primary axis
6. Preserve localTransform translation: node.localTransform = lookAtMat.translate(localPos)
```

**Numerical guard:** Skip if `worldDir.length() < 1e-6`.

---

## 4. CCD Solver — Core Loop

**Where:** `Executor.execute()` (`core-js/src/solver/Executor.ts`)

**Instruction types:**
```ts
type Instruction =
  | { type: 'operation'; operation: Operation }
  | { type: 'loop'; max_iterations: number; condition: Condition; steps: Instruction[] }
```

**Executor pseudocode:**
```
execute(sequence):
  for each instruction in sequence:
    if instruction.type == 'operation':
      applyOperation(system, instruction.operation)
    
    if instruction.type == 'loop':
      converged = false
      for i in 0..max_iterations:
        if evaluateCondition(system, condition):
          converged = true; break
        if i < max_iterations:
          execute(steps)   // recursive — loops can nest
      if not converged: return false
  
  return true
```

**Returns** `true` if all loops converged, `false` if any loop hit `max_iterations` without converging.

---

## 5. align_node Operation (CCD Step)

**Where:** `applyOperation()` (`core-js/src/solver/operations.ts`)

This is the single CCD step: rotate or translate one joint to bring `effectorNode` closer to `targetNode`.

### Revolute joint

```
pPos = pivot.absoluteTransform.translation
ePos = effector.absoluteTransform.translation
tPos = target.absoluteTransform.translation

worldAxis = pivot.absoluteTransform.rotateVector(joint.axis).normalize()

pToE = normalize(ePos - pPos)
pToT = normalize(tPos - pPos)

angle = acos(clamp(dot(pToE, pToT), -1, 1))
if angle < 1e-6: skip

cross = normalize(cross(pToE, pToT))
projection = dot(cross, worldAxis)   // sign of rotation

step = angle × projection × damping  // damping default 0.5

newValue = clamp(joint.value + step, joint.limits[0], joint.limits[1])
actualStep = newValue - joint.value
if |actualStep| < 1e-8: skip

joint.value = newValue
applyJointDelta(joint, pivot, movingBodies, actualStep)
```

### Prismatic joint

```
eToT = tPos - ePos
step = dot(eToT, worldAxis) × damping

// same limit clamping and delta application
```

---

## 6. Joint Delta Transform

**Where:** `applyJointDelta()` (`core-js/src/system/utils.ts`)

Applies a delta transform to all moving bodies in world space.

```
if |deltaValue| < 1e-8: return

Build localStepMat:
  revolute: rotate around joint.axis by deltaValue
  prismatic: translate along joint.axis by deltaValue

pivotT = pivot.absoluteTransform
pivotInv = pivotT.invert()

deltaT = pivotT × localStepMat × pivotInv   // world-space delta

for each movingBody:
  body.transform = deltaT × body.transform
  body.updateNodes()
```

This wraps the local step in pivot-space: `T_world = T_pivot × T_local × T_pivot⁻¹`.

---

## 7. Convergence Condition

**Where:** `evaluateCondition()` (`core-js/src/solver/conditions.ts`)

Currently one type: `distance_less_than`.

```ts
posA = nodeA.absoluteTransform.translation
posB = nodeB.absoluteTransform.translation
return distance(posA, posB) < threshold
```

Throws if either node is not found in the system.

---

## 8. Actuator Delta (Interactive Control)

**Where:** `KinematicSystem.applyActuatorDelta()`

Called when a user drags a slider in the UI. Computes `delta = currentSliderValue - lastSliderValue`, then calls `applyJointDelta(joint, pivot, movingBodies, delta)` directly (bypassing the solver sequence).

---

## Numerical Stability Notes

| Guard | Value | Where |
|-------|-------|-------|
| Skip near-zero length vectors | `1e-6` | CCD effector/target distance, LookAt direction |
| Skip near-zero joint steps | `1e-8` | `applyJointDelta`, after limit clamping |
| Skip near-zero alignment | `1e-6` | `angle < 1e-6` in revolute step |
| Clamp dot product for acos | `max(-1, min(1, dot))` | Prevent NaN from floating-point drift |
| Damping factor | `0.5` (default) | `Operation.damping` — halves each CCD step for stability |
| Convergence threshold | `0.01` (typical) | `condition.threshold` in JSON |

---

## Typical Solve Configuration

For an N-joint arm: one outer loop, N steps (inner-to-outer joint order recommended for fastest convergence):

```json
{
  "type": "loop",
  "max_iterations": 100,
  "condition": { "type": "distance_less_than", "nodeA": "effector", "nodeB": "target", "threshold": 0.01 },
  "steps": [
    { "type": "operation", "operation": { "type": "align_node", ... joint N (innermost) ... } },
    { "type": "operation", "operation": { "type": "align_node", ... joint N-1 ... } },
    ...
    { "type": "operation", "operation": { "type": "align_node", ... joint 1 (outermost) ... } }
  ]
}
```

CCD converges faster when innermost joints are adjusted first.
