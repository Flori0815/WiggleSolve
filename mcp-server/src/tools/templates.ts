import { session } from '../session';
import { instantiateTemplate, getDefaultParams } from '../instantiator';
import { listTemplates, getTemplate, saveTemplate, deleteTemplate } from '../templateStore';
import type { ParameterSpec, ParameterBinding } from '../instantiator';

function ok(message: string) {
  return { content: [{ type: 'text' as const, text: message }] };
}
function err(message: string) {
  return { content: [{ type: 'text' as const, text: message }], isError: true };
}

export function handleListTemplates() {
  const templates = listTemplates();
  if (templates.length === 0) return ok('No templates saved yet.');
  const summary = templates.map(t => ({
    templateId: t.templateId,
    name: t.name,
    description: t.description,
    parameters: Object.keys(t.parameters),
  }));
  return ok(JSON.stringify(summary, null, 2));
}

export function handleGetTemplate(args: { templateId: string }) {
  const template = getTemplate(args.templateId);
  if (!template) return err(`Template "${args.templateId}" not found.`);
  return ok(JSON.stringify(template, null, 2));
}

export function handleGetTemplateParams(args: { templateId: string }) {
  const template = getTemplate(args.templateId);
  if (!template) return err(`Template "${args.templateId}" not found.`);
  return ok(JSON.stringify(template.parameters, null, 2));
}

export function handleInstantiateTemplate(args: {
  templateId: string;
  params?: Record<string, unknown>;
}) {
  const template = getTemplate(args.templateId);
  if (!template) return err(`Template "${args.templateId}" not found.`);
  const params = { ...getDefaultParams(template), ...(args.params ?? {}) };
  try {
    const definition = instantiateTemplate(template, params);
    return ok(JSON.stringify(definition, null, 2));
  } catch (e) {
    return err(`Instantiation failed: ${String(e)}`);
  }
}

export function handleLoadTemplateToSession(args: {
  templateId: string;
  params?: Record<string, unknown>;
}) {
  const template = getTemplate(args.templateId);
  if (!template) return err(`Template "${args.templateId}" not found.`);
  const params = { ...getDefaultParams(template), ...(args.params ?? {}) };
  try {
    const definition = instantiateTemplate(template, params);
    session.mutate(d => {
      Object.assign(d, definition);
    });
    return ok(`Loaded template "${args.templateId}" into session. 3D view should update.`);
  } catch (e) {
    return err(`Failed to load template: ${String(e)}`);
  }
}

export function handleSaveAsTemplate(args: {
  templateId: string;
  name?: string;
  description?: string;
  parameters: Record<string, ParameterSpec>;
  parameterBindings: Record<string, ParameterBinding>;
}) {
  const def = session.getDefinition();
  const template = {
    templateId: args.templateId,
    name: args.name ?? def.name,
    description: args.description ?? def.description,
    parameters: args.parameters,
    parameterBindings: args.parameterBindings,
    definition: def,
  };
  const filePath = saveTemplate(template);
  return ok(`Template "${args.templateId}" saved to ${filePath}.`);
}

export function handleDeleteTemplate(args: { templateId: string }) {
  const deleted = deleteTemplate(args.templateId);
  if (!deleted) return err(`Template "${args.templateId}" not found.`);
  return ok(`Template "${args.templateId}" deleted.`);
}
