import threeLinkArm  from '@demos/three_link_arm.json';
import scaraRobot    from '@demos/scara_robot.json';
import fourLinkSnake from '@demos/four_link_snake.json';
import gantryWrist   from '@demos/gantry_wrist.json';
import spatial3dArm  from '@demos/spatial_3d_arm.json';

export type DemoNodeDef = {
  id: string;
  localTransform: number[];
};

export type DemoBodyDef = {
  id: string;
  nodes: DemoNodeDef[];
};

export type DemoGlobalNodeDef = {
  id: string;
  absoluteTransform: number[];
};

export type DemoJointDef = {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: [number, number, number];
  limits: [number, number];
};

export type DemoActuatorDef = {
  id: string;
  type: 'revolute' | 'prismatic';
  axis: 'x' | 'y' | 'z';
  pivotNode: string;
  movingBodies: string[];
};

export type DemoStepDef = {
  type: 'operation';
  operation: {
    type: 'align_node';
    effectorNode: string;
    targetNode: string;
    pivotNode: string;
    jointId: string;
    movingBodies: string[];
  };
};

export type DemoLoopDef = {
  type: 'loop';
  max_iterations: number;
  condition: {
    type: 'distance_less_than';
    nodeA: string;
    nodeB: string;
    threshold: number;
  };
  steps: DemoStepDef[];
};

export type DemoDefinition = {
  name: string;
  description: string;
  system: {
    bodies: DemoBodyDef[];
    globalNodes: DemoGlobalNodeDef[];
    joints: DemoJointDef[];
  };
  actuators: DemoActuatorDef[];
  sequence: DemoLoopDef[];
};

export type DemoEntry = {
  id: string;
  definition: DemoDefinition;
};

export const DEMOS: DemoEntry[] = [
  { id: 'three_link_arm',  definition: threeLinkArm  as DemoDefinition },
  { id: 'scara_robot',     definition: scaraRobot    as DemoDefinition },
  { id: 'four_link_snake', definition: fourLinkSnake as DemoDefinition },
  { id: 'gantry_wrist',    definition: gantryWrist   as DemoDefinition },
  { id: 'spatial_3d_arm',  definition: spatial3dArm  as DemoDefinition },
];
