import { z } from 'zod';

export const DemoNodeDefSchema = z.object({
  id: z.string(),
  localTransform: z.array(z.number()),
});

export const DemoBodyDefSchema = z.object({
  id: z.string(),
  nodes: z.array(DemoNodeDefSchema),
});

export const DemoGlobalNodeDefSchema = z.object({
  id: z.string(),
  absoluteTransform: z.array(z.number()),
});

export const DemoJointDefSchema = z.object({
  id: z.string(),
  type: z.enum(['revolute', 'prismatic']),
  axis: z.tuple([z.number(), z.number(), z.number()]),
  limits: z.tuple([z.number(), z.number()]),
});

export const DemoActuatorDefSchema = z.object({
  id: z.string(),
  type: z.enum(['revolute', 'prismatic']),
  axis: z.enum(['x', 'y', 'z']),
  pivotNode: z.string(),
  movingBodies: z.array(z.string()),
});

export const DemoStepDefSchema = z.object({
  type: z.literal('operation'),
  operation: z.object({
    type: z.literal('align_node'),
    effectorNode: z.string(),
    targetNode: z.string(),
    pivotNode: z.string(),
    jointId: z.string(),
    movingBodies: z.array(z.string()),
  }),
});

export const DemoLoopDefSchema = z.object({
  type: z.literal('loop'),
  max_iterations: z.number(),
  condition: z.object({
    type: z.literal('distance_less_than'),
    nodeA: z.string(),
    nodeB: z.string(),
    threshold: z.number(),
  }),
  steps: z.array(DemoStepDefSchema),
});

export const DemoDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  system: z.object({
    bodies: z.array(DemoBodyDefSchema),
    globalNodes: z.array(DemoGlobalNodeDefSchema).optional().default([]),
    joints: z.array(DemoJointDefSchema),
  }),
  actuators: z.array(DemoActuatorDefSchema),
  sequence: z.array(DemoLoopDefSchema),
});

export type DemoNodeDef = z.infer<typeof DemoNodeDefSchema>;
export type DemoBodyDef = z.infer<typeof DemoBodyDefSchema>;
export type DemoGlobalNodeDef = z.infer<typeof DemoGlobalNodeDefSchema>;
export type DemoJointDef = z.infer<typeof DemoJointDefSchema>;
export type DemoActuatorDef = z.infer<typeof DemoActuatorDefSchema>;
export type DemoStepDef = z.infer<typeof DemoStepDefSchema>;
export type DemoLoopDef = z.infer<typeof DemoLoopDefSchema>;
export type DemoDefinition = z.infer<typeof DemoDefinitionSchema>;
