/**
 * Regenerates the demo definitions produced by parametric generators.
 * Run with `npm run generate:demos -w @wigglesolve/core`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { GENERATED_DEMOS, formatDefinition } from '../src/mechanisms/demos';

const DEMOS_DIR = path.resolve(__dirname, '../../demos');

for (const [file, definition] of Object.entries(GENERATED_DEMOS)) {
  fs.writeFileSync(path.join(DEMOS_DIR, file), formatDefinition(definition));
  console.log(`wrote demos/${file}`);
}
