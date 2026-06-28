import type { KinematicSystem } from '../system/KinematicSystem';
import type { Condition } from './conditions';
import { evaluateCondition } from './conditions';
import type { Operation } from './operations';
import { applyOperation } from './operations';

export type Instruction =
  | { type: 'operation'; operation: Operation }
  | { type: 'loop'; max_iterations: number; condition: Condition; steps: Instruction[] };

export class Executor {
  private system: KinematicSystem;
  constructor(system: KinematicSystem) {
    this.system = system;
  }

  execute(sequence: Instruction[]): boolean {
    for (const instruction of sequence) {
      if (instruction.type === 'operation') {
        applyOperation(this.system, instruction.operation);
      } else if (instruction.type === 'loop') {
        let converged = false;
        for (let i = 0; i <= instruction.max_iterations; i++) {
          if (evaluateCondition(this.system, instruction.condition)) {
            converged = true;
            break;
          }
          if (i < instruction.max_iterations) {
            this.execute(instruction.steps);
          }
        }
        if (!converged) {
          return false; // Loop failed to converge
        }
      }
    }
    return true;
  }
}
