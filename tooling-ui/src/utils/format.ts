import type { JointType } from '@wigglesolve/core';

const DEG = 180 / Math.PI;

/** Unit shown to the user for a joint/actuator type. */
export const unitOf = (type: JointType) => (type === 'revolute' ? '°' : 'm');

/** Internal value (rad / m) → display value (° / m). */
export const toDisplay = (type: JointType, v: number) => (type === 'revolute' ? v * DEG : v);

/** Display value (° / m) → internal value (rad / m). */
export const fromDisplay = (type: JointType, v: number) => (type === 'revolute' ? v / DEG : v);

export const formatValue = (type: JointType, v: number) =>
  type === 'revolute' ? `${(v * DEG).toFixed(1)}°` : `${v.toFixed(3)} m`;
