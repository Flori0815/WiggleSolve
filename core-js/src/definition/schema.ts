import { z } from 'zod';

/**
 * JSON interchange format for a complete mechanism: topology (bodies, nodes,
 * joints), manual drives (actuators) and the solving sequence.
 * All matrices are 16-element column-major SE(3) arrays.
 */

const Axis = z.enum(['x', 'y', 'z']);
const Vec3 = z.tuple([z.number(), z.number(), z.number()]);
const Mat16 = z.array(z.number()).length(16);

export const NodeDefSchema = z.object({
  id: z.string(),
  localTransform: Mat16,
});

export const BodyDefSchema = z.object({
  id: z.string(),
  /**
   * Optional explicit world placement. When omitted, actuated bodies are placed
   * at their actuator's pivot (see `assembleKinematicChain`) and all others at
   * the world origin.
   */
  transform: Mat16.optional(),
  nodes: z.array(NodeDefSchema),
});

export const GlobalNodeDefSchema = z.object({
  id: z.string(),
  absoluteTransform: Mat16,
});

export const JointDefSchema = z.object({
  id: z.string(),
  type: z.enum(['revolute', 'prismatic']),
  axis: Vec3,
  limits: z.tuple([z.number(), z.number()]),
});

export const ActuatorDefSchema = z.object({
  id: z.string(),
  type: z.enum(['revolute', 'prismatic']),
  axis: Axis,
  pivotNode: z.string(),
  movingBodies: z.array(z.string()),
});

export const StepDefSchema = z.object({
  type: z.literal('operation'),
  operation: z.object({
    type: z.literal('align_node'),
    effectorNode: z.string(),
    targetNode: z.string(),
    pivotNode: z.string(),
    jointId: z.string(),
    movingBodies: z.array(z.string()),
    damping: z.number().positive().max(1).optional(),
  }),
});

export const LoopDefSchema = z.object({
  type: z.literal('loop'),
  max_iterations: z.number().int().nonnegative(),
  condition: z.object({
    type: z.literal('distance_less_than'),
    nodeA: z.string(),
    nodeB: z.string(),
    threshold: z.number().positive(),
  }),
  steps: z.array(StepDefSchema),
});

export const MechanismDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  system: z.object({
    bodies: z.array(BodyDefSchema),
    globalNodes: z.array(GlobalNodeDefSchema).optional().default([]),
    joints: z.array(JointDefSchema),
  }),
  actuators: z.array(ActuatorDefSchema),
  sequence: z.array(LoopDefSchema),
});

export type NodeDef = z.infer<typeof NodeDefSchema>;
export type BodyDef = z.infer<typeof BodyDefSchema>;
export type GlobalNodeDef = z.infer<typeof GlobalNodeDefSchema>;
export type JointDef = z.infer<typeof JointDefSchema>;
export type ActuatorDef = z.infer<typeof ActuatorDefSchema>;
export type StepDef = z.infer<typeof StepDefSchema>;
export type LoopDef = z.infer<typeof LoopDefSchema>;
/** Parsed definition (defaults applied). */
export type MechanismDefinition = z.infer<typeof MechanismDefinitionSchema>;
/** Raw definition as written in JSON (optional fields may be missing). */
export type MechanismDefinitionInput = z.input<typeof MechanismDefinitionSchema>;
