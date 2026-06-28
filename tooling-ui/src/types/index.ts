export type UIJointConfig = {
  type: 'revolute' | 'prismatic';
  axis: 'x' | 'y' | 'z';
};

export type UIActuator = UIJointConfig & {
  id: string;
  pivotNode: string;
  movingBodies: string[];
  value: number;
};

export type InlineInputState = {
  isOpen: boolean;
  value: string;
  error: string;
};
