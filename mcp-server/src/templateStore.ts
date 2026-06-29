import * as fs from 'node:fs';
import * as path from 'node:path';
import type { KinematicTemplate } from './instantiator.js';

function getTemplatesDir(): string {
  return process.env['WIGGLESOLVE_TEMPLATES_DIR'] ?? path.join(process.cwd(), '..', 'templates');
}

export function listTemplates(): KinematicTemplate[] {
  const dir = getTemplatesDir();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.template.json'))
    .map(f => {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8');
      return JSON.parse(raw) as KinematicTemplate;
    });
}

export function getTemplate(templateId: string): KinematicTemplate | null {
  const dir = getTemplatesDir();
  const filePath = path.join(dir, `${templateId}.template.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as KinematicTemplate;
}

export function saveTemplate(template: KinematicTemplate): string {
  const dir = getTemplatesDir();
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${template.templateId}.template.json`);
  fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf8');
  return filePath;
}

export function deleteTemplate(templateId: string): boolean {
  const dir = getTemplatesDir();
  const filePath = path.join(dir, `${templateId}.template.json`);
  if (!fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}
