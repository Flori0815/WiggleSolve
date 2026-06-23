from __future__ import annotations
from typing import List, Union
from wigglesolve.solver.conditions import Condition, evaluate_condition
from wigglesolve.solver.operations import Operation, apply_operation


class OperationInstruction:
    def __init__(self, operation: Operation) -> None:
        self.type = "operation"
        self.operation = operation


class LoopInstruction:
    def __init__(
        self,
        max_iterations: int,
        condition: Condition,
        steps: List[Instruction],
    ) -> None:
        self.type = "loop"
        self.max_iterations = max_iterations
        self.condition = condition
        self.steps = steps


Instruction = Union[OperationInstruction, LoopInstruction]


class Executor:
    def __init__(self, system) -> None:
        self._system = system

    def execute(self, sequence: List[Instruction]) -> bool:
        for instruction in sequence:
            if instruction.type == "operation":
                apply_operation(self._system, instruction.operation)
            elif instruction.type == "loop":
                converged = False
                for _ in range(instruction.max_iterations):
                    if evaluate_condition(self._system, instruction.condition):
                        converged = True
                        break
                    self.execute(instruction.steps)
                if not converged and not evaluate_condition(self._system, instruction.condition):
                    return False
        return True
