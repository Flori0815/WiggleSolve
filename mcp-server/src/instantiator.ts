import { translationMat16, IDENTITY_MAT16, rotationZMat16, rotationXMat16, rotationYMat16 } from 'core-js';
import type { DemoDefinition } from 'core-js';

export type ParameterType = 'number' | 'tuple2' | 'xyz' | 'axis3' | 'boolean';

export interface ParameterSpec {
  name?: string;
  type: ParameterType;
  default?: unknown;
  description?: string;
}

export type FormulaName =
  | 'passthrough'
  | 'translationX'
  | 'translationY'
  | 'translationZ'
  | 'translationXYZ'
  | 'rotationX'
  | 'rotationY'
  | 'rotationZ'
  | 'identity';

export interface ParameterBinding {
  formula: FormulaName;
  input: string;
}

export interface KinematicTemplate {
  templateId: string;
  name: string;
  description?: string;
  parameters: Record<string, ParameterSpec>;
  parameterBindings: Record<string, ParameterBinding>;
  definition: unknown;
}

function applyFormula(formula: FormulaName, value: unknown): unknown {
  switch (formula) {
    case 'identity':
      return [...IDENTITY_MAT16];
    case 'translationX':
      return translationMat16(value as number, 0, 0);
    case 'translationY':
      return translationMat16(0, value as number, 0);
    case 'translationZ':
      return translationMat16(0, 0, value as number);
    case 'translationXYZ': {
      const [x, y, z] = value as [number, number, number];
      return translationMat16(x, y, z);
    }
    case 'rotationX':
      return rotationXMat16(value as number);
    case 'rotationY':
      return rotationYMat16(value as number);
    case 'rotationZ':
      return rotationZMat16(value as number);
    case 'passthrough':
    default:
      return value;
  }
}

function resolveTokens(node: unknown, resolvedParams: Record<string, unknown>): unknown {
  if (Array.isArray(node)) {
    return node.map(item => resolveTokens(item, resolvedParams));
  }
  if (node !== null && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    if ('$param' in obj && typeof obj['$param'] === 'string') {
      const paramName = obj['$param'];
      if (!(paramName in resolvedParams)) {
        throw new Error(`Missing value for parameter binding "${paramName}"`);
      }
      return resolvedParams[paramName];
    }
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(obj)) {
      result[key] = resolveTokens(val, resolvedParams);
    }
    return result;
  }
  return node;
}

export function instantiateTemplate(
  template: KinematicTemplate,
  params: Record<string, unknown>,
): DemoDefinition {
  const resolved: Record<string, unknown> = {};
  for (const [bindingName, binding] of Object.entries(template.parameterBindings)) {
    const rawValue = params[binding.input];
    resolved[bindingName] = applyFormula(binding.formula, rawValue);
  }

  for (const [paramName, value] of Object.entries(params)) {
    if (!(paramName in resolved)) {
      resolved[paramName] = value;
    }
  }

  const concrete = resolveTokens(template.definition, resolved);
  return concrete as DemoDefinition;
}

export function getDefaultParams(template: KinematicTemplate): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const [name, spec] of Object.entries(template.parameters)) {
    if (spec.default !== undefined) defaults[name] = spec.default;
  }
  return defaults;
}
