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

describe('Integration: pan_tilt_camera', () => {
  let result: SolveResult;

  beforeAll(() => {
    result = loadAndRun(path.join(DEFINITIONS_DIR, 'pan_tilt_camera.json'));
  });

  test('solver converges', () => {
    expect(result.converged).toBe(true);
  });

  test('effector reaches target within threshold', () => {
    const effector = result.nodePositions['lens_tip'];
    const target = result.nodePositions['target'];
    expect(dist(effector, target)).toBeLessThan(0.01);
  });

  test('joint values remain within defined limits', () => {
    expect(result.jointValues['j_pan']).toBeGreaterThanOrEqual(-Math.PI);
    expect(result.jointValues['j_pan']).toBeLessThanOrEqual(Math.PI);
    expect(result.jointValues['j_tilt']).toBeGreaterThanOrEqual(-Math.PI / 2);
    expect(result.jointValues['j_tilt']).toBeLessThanOrEqual(Math.PI / 2);
  });
});

describe('Integration: xyz_cnc_machine', () => {
  let result: SolveResult;

  beforeAll(() => {
    result = loadAndRun(path.join(DEFINITIONS_DIR, 'xyz_cnc_machine.json'));
  });

  test('solver converges', () => {
    expect(result.converged).toBe(true);
  });

  test('effector reaches target within threshold', () => {
    const effector = result.nodePositions['spindle_tip'];
    const target = result.nodePositions['target'];
    expect(dist(effector, target)).toBeLessThan(0.01);
  });

  test('joint values remain within defined limits', () => {
    expect(result.jointValues['x_joint']).toBeGreaterThanOrEqual(0.0);
    expect(result.jointValues['x_joint']).toBeLessThanOrEqual(3.0);
    expect(result.jointValues['y_joint']).toBeGreaterThanOrEqual(0.0);
    expect(result.jointValues['y_joint']).toBeLessThanOrEqual(3.0);
    expect(result.jointValues['z_joint']).toBeGreaterThanOrEqual(-2.0);
    expect(result.jointValues['z_joint']).toBeLessThanOrEqual(0.0);
  });

  test('joint values converge to target coordinates', () => {
    expect(result.jointValues['x_joint']).toBeCloseTo(1.5, 1);
    expect(result.jointValues['y_joint']).toBeCloseTo(1.2, 1);
    expect(result.jointValues['z_joint']).toBeCloseTo(-0.8, 1);
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

  test('pan_tilt: effector within 0.05 of target', () => {
    const result = loadAndRun(path.join(DEFINITIONS_DIR, 'pan_tilt_camera.json'));
    const effector = result.nodePositions['lens_tip'];
    expect(dist(effector, [0.3, 0.3, 0.4243])).toBeLessThan(0.05);
  });

  test('xyz_cnc: joint values match within 0.05', () => {
    const result = loadAndRun(path.join(DEFINITIONS_DIR, 'xyz_cnc_machine.json'));
    expect(Math.abs(result.jointValues['x_joint'] - 1.5)).toBeLessThan(0.05);
    expect(Math.abs(result.jointValues['y_joint'] - 1.2)).toBeLessThan(0.05);
    expect(Math.abs(result.jointValues['z_joint'] - (-0.8))).toBeLessThan(0.05);
  });
});
