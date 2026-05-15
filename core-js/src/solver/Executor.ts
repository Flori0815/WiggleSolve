import { KinematicSystem } from '../system/KinematicSystem';
import { Condition, evaluateCondition } from './conditions';
import { Operation, applyOperation } from './operations';

export type Instruction =
  | { type: 'operation'; operation: Operation }
  | { type: 'loop'; max_iterations: number; condition: Condition; steps: Instruction[] };

export class Executor {
  constructor(private system: KinematicSystem) {}

  execute(sequence: Instruction[]): boolean {
    for (const instruction of sequence) {
      if (instruction.type === 'operation') {
        applyOperation(this.system, instruction.operation);
      } else if (instruction.type === 'loop') {
        let converged = false;
        for (let i = 0; i < instruction.max_iterations; i++) {
          if (evaluateCondition(this.system, instruction.condition)) {
            converged = true;
            break;
          }
          this.execute(instruction.steps);
        }
        if (!converged && !evaluateCondition(this.system, instruction.condition)) {
          return false; // Loop failed to converge
        }
      }
    }
    return true;
  }
}
