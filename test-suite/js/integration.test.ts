import * as path from 'path';
import { loadAndRun, SolveResult } from './loader';

const DEFINITIONS_DIR = path.resolve(__dirname, '../../definitions');

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

describe('Integration: planar_2_link_arm', () => {
  let result: SolveResult;

  beforeAll(() => {
    result = loadAndRun(path.join(DEFINITIONS_DIR, 'planar_2_link_arm.json'));
  });

  test('solver converges', () => {
    expect(result.converged).toBe(true);
  });

  test('effector reaches target within threshold', () => {
    const effector = result.nodePositions['link2_end'];
    const target = result.nodePositions['target'];
    expect(dist(effector, target)).toBeLessThan(0.01);
  });

  test('joint values remain within defined limits', () => {
    expect(result.jointValues['j1']).toBeGreaterThanOrEqual(-Math.PI);
    expect(result.jointValues['j1']).toBeLessThanOrEqual(Math.PI);
    expect(result.jointValues['j2']).toBeGreaterThanOrEqual(-Math.PI);
    expect(result.jointValues['j2']).toBeLessThanOrEqual(Math.PI);
  });
});

describe('Integration: prismatic_slider', () => {
  let result: SolveResult;

  beforeAll(() => {
    result = loadAndRun(path.join(DEFINITIONS_DIR, 'prismatic_slider.json'));
  });

  test('solver converges', () => {
    expect(result.converged).toBe(true);
  });

  test('effector reaches target within threshold', () => {
    const effector = result.nodePositions['slider_effector'];
    const target = result.nodePositions['target'];
    expect(dist(effector, target)).toBeLessThan(0.01);
  });

  test('joint value stays within limits', () => {
    expect(result.jointValues['slider_joint']).toBeGreaterThanOrEqual(0);
    expect(result.jointValues['slider_joint']).toBeLessThanOrEqual(5);
  });

  test('joint value converges to target distance (~2.0)', () => {
    // Target is at x=2, starting from x=0 — geometric series converges to 2.0
    expect(result.jointValues['slider_joint']).toBeCloseTo(2.0, 1);
  });
});

describe('Parity: shared numerical bounds with core-py', () => {
  // Both implementations must satisfy the same bounds against the same definitions.
  // If both test suites (JS and Python) pass these assertions, they are in parity.

  test('planar arm: target position matches definition', () => {
    const result = loadAndRun(path.join(DEFINITIONS_DIR, 'planar_2_link_arm.json'));
    // Target is hardcoded at (1.5, 0.5, 0) in the definition
    const target = result.nodePositions['target'];
    expect(target[0]).toBeCloseTo(1.5, 4);
    expect(target[1]).toBeCloseTo(0.5, 4);
    expect(target[2]).toBeCloseTo(0.0, 4);
  });

  test('planar arm: effector within 0.01 of target at (1.5, 0.5, 0)', () => {
    const result = loadAndRun(path.join(DEFINITIONS_DIR, 'planar_2_link_arm.json'));
    const effector = result.nodePositions['link2_end'];
    expect(dist(effector, [1.5, 0.5, 0])).toBeLessThan(0.01);
  });

  test('prismatic slider: joint converges to 2.0 ± 0.05', () => {
    const result = loadAndRun(path.join(DEFINITIONS_DIR, 'prismatic_slider.json'));
    expect(Math.abs(result.jointValues['slider_joint'] - 2.0)).toBeLessThan(0.05);
  });
});
