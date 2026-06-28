import * as fs from 'fs';
import * as path from 'path';
import { loadAndRun } from './loader';

const DEMOS_DIR = path.resolve(__dirname, '../../demos');
const demoFiles = fs.readdirSync(DEMOS_DIR).filter(f => f.endsWith('.json'));

describe.each(demoFiles)('Demo smoke test: %s', (file) => {
  test('solver runs without throwing', () => {
    const result = loadAndRun(path.join(DEMOS_DIR, file));
    // Demos may not converge (some are open-loop), but must not throw
    expect(typeof result.converged).toBe('boolean');
  });
});
