import threeLinkArm          from '@demos/three_link_arm.json';
import scaraRobot            from '@demos/scara_robot.json';
import fourLinkSnake         from '@demos/four_link_snake.json';
import gantryWrist           from '@demos/gantry_wrist.json';
import spatial3dArm          from '@demos/spatial_3d_arm.json';
import panTiltCamera         from '@definitions/pan_tilt_camera.json';
import xyzCncMachine         from '@definitions/xyz_cnc_machine.json';
import satelliteDish         from '@demos/satellite_dish.json';
import solarTracker          from '@demos/solar_tracker.json';
import hydraulicCrane        from '@demos/hydraulic_crane.json';
import forkliftMast          from '@demos/forklift_mast.json';
import carSeatAdjuster       from '@demos/car_seat_adjuster.json';
import stageSpotlight        from '@demos/stage_spotlight.json';
import periscope             from '@demos/periscope.json';
import retractableLandingGear from '@demos/retractable_landing_gear.json';
import fdm3dPrinter          from '@demos/fdm_3d_printer.json';
import conveyorDiverter      from '@demos/conveyor_diverter.json';
import windTurbineYaw        from '@demos/wind_turbine_yaw.json';
import kneeOrthosis          from '@demos/knee_orthosis.json';
import telescopeAltaz        from '@demos/telescope_altaz.json';

import type {
  DemoDefinition,
} from '../schema';

export type {
  DemoNodeDef,
  DemoBodyDef,
  DemoGlobalNodeDef,
  DemoJointDef,
  DemoActuatorDef,
  DemoStepDef,
  DemoLoopDef,
  DemoDefinition,
} from '../schema';

export type DemoEntry = {
  id: string;
  definition: DemoDefinition;
};

export const DEMOS: DemoEntry[] = [
  // ── Arm / robot (original examples) ─────────────────────────────────────
  { id: 'three_link_arm',          definition: threeLinkArm          as DemoDefinition },
  { id: 'scara_robot',             definition: scaraRobot            as DemoDefinition },
  { id: 'four_link_snake',         definition: fourLinkSnake         as DemoDefinition },
  { id: 'gantry_wrist',            definition: gantryWrist           as DemoDefinition },
  { id: 'spatial_3d_arm',          definition: spatial3dArm          as DemoDefinition },
  // ── Cameras & broadcast ─────────────────────────────────────────────────
  { id: 'pan_tilt_camera',         definition: panTiltCamera         as DemoDefinition },
  { id: 'stage_spotlight',         definition: stageSpotlight        as DemoDefinition },
  // ── Astronomy ───────────────────────────────────────────────────────────
  { id: 'telescope_altaz',         definition: telescopeAltaz        as DemoDefinition },
  // ── Aerospace ───────────────────────────────────────────────────────────
  { id: 'satellite_dish',          definition: satelliteDish         as DemoDefinition },
  { id: 'retractable_landing_gear',definition: retractableLandingGear as DemoDefinition },
  // ── Energy ──────────────────────────────────────────────────────────────
  { id: 'solar_tracker',           definition: solarTracker          as DemoDefinition },
  { id: 'wind_turbine_yaw',        definition: windTurbineYaw        as DemoDefinition },
  // ── Construction ────────────────────────────────────────────────────────
  { id: 'hydraulic_crane',         definition: hydraulicCrane        as DemoDefinition },
  // ── Manufacturing ───────────────────────────────────────────────────────
  { id: 'xyz_cnc_machine',         definition: xyzCncMachine         as DemoDefinition },
  { id: 'fdm_3d_printer',          definition: fdm3dPrinter          as DemoDefinition },
  // ── Automotive ──────────────────────────────────────────────────────────
  { id: 'car_seat_adjuster',       definition: carSeatAdjuster       as DemoDefinition },
  // ── Logistics ───────────────────────────────────────────────────────────
  { id: 'forklift_mast',           definition: forkliftMast          as DemoDefinition },
  { id: 'conveyor_diverter',       definition: conveyorDiverter      as DemoDefinition },
  // ── Naval / defence ─────────────────────────────────────────────────────
  { id: 'periscope',               definition: periscope             as DemoDefinition },
  // ── Medical / wearable ──────────────────────────────────────────────────
  { id: 'knee_orthosis',           definition: kneeOrthosis          as DemoDefinition },
];
