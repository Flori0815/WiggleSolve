import type { MechanismDefinition } from '../definition/schema';
import { droppedHingeFlap } from './droppedHingeFlap';
import { widebodyWing } from './widebodyWing';

/** Demo files in `demos/` that are generated from a parametric mechanism. */
export const GENERATED_DEMOS: Record<string, MechanismDefinition> = {
  'dropped_hinge_flap.json': droppedHingeFlap(),
  'widebody_wing.json': widebodyWing(),
};

/** JSON with 2-space indentation and numeric arrays kept on one line. */
export function formatDefinition(definition: MechanismDefinition): string {
  const json = JSON.stringify(definition, null, 2);
  return `${json.replace(/\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g, (_, list: string) => `[${list.split(/,\s*/).join(', ')}]`)}\n`;
}
