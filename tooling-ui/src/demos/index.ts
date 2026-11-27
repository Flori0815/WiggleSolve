import threeLinkArm           from '@demos/three_link_arm.json';
import scaraRobot             from '@demos/scara_robot.json';
import fourLinkSnake          from '@demos/four_link_snake.json';
import gantryWrist            from '@demos/gantry_wrist.json';
import spatial3dArm           from '@demos/spatial_3d_arm.json';
import panTiltCamera          from '@definitions/pan_tilt_camera.json';
import xyzCncMachine          from '@definitions/xyz_cnc_machine.json';
import satelliteDish          from '@demos/satellite_dish.json';
import solarTracker           from '@demos/solar_tracker.json';
import hydraulicCrane         from '@demos/hydraulic_crane.json';
import forkliftMast           from '@demos/forklift_mast.json';
import carSeatAdjuster        from '@demos/car_seat_adjuster.json';
import stageSpotlight         from '@demos/stage_spotlight.json';
import periscope              from '@demos/periscope.json';
import retractableLandingGear from '@demos/retractable_landing_gear.json';
import fdm3dPrinter           from '@demos/fdm_3d_printer.json';
import conveyorDiverter       from '@demos/conveyor_diverter.json';
import windTurbineYaw         from '@demos/wind_turbine_yaw.json';
import kneeOrthosis           from '@demos/knee_orthosis.json';
import telescopeAltaz         from '@demos/telescope_altaz.json';

export type DemoEntry = {
  id: string;
  category: string;
  /** Raw JSON; validated by the core when loaded. */
  definition: { name: string; description: string };
};

export const DEMOS: DemoEntry[] = [
  { id: 'three_link_arm',           category: 'Robot arms',    definition: threeLinkArm },
  { id: 'scara_robot',              category: 'Robot arms',    definition: scaraRobot },
  { id: 'four_link_snake',          category: 'Robot arms',    definition: fourLinkSnake },
  { id: 'gantry_wrist',             category: 'Robot arms',    definition: gantryWrist },
  { id: 'spatial_3d_arm',           category: 'Robot arms',    definition: spatial3dArm },
  { id: 'pan_tilt_camera',          category: 'Cameras & optics', definition: panTiltCamera },
  { id: 'stage_spotlight',          category: 'Cameras & optics', definition: stageSpotlight },
  { id: 'telescope_altaz',          category: 'Cameras & optics', definition: telescopeAltaz },
  { id: 'periscope',                category: 'Cameras & optics', definition: periscope },
  { id: 'satellite_dish',           category: 'Aerospace',     definition: satelliteDish },
  { id: 'retractable_landing_gear', category: 'Aerospace',     definition: retractableLandingGear },
  { id: 'solar_tracker',            category: 'Energy',        definition: solarTracker },
  { id: 'wind_turbine_yaw',         category: 'Energy',        definition: windTurbineYaw },
  { id: 'hydraulic_crane',          category: 'Industrial',    definition: hydraulicCrane },
  { id: 'xyz_cnc_machine',          category: 'Industrial',    definition: xyzCncMachine },
  { id: 'fdm_3d_printer',           category: 'Industrial',    definition: fdm3dPrinter },
  { id: 'forklift_mast',            category: 'Industrial',    definition: forkliftMast },
  { id: 'conveyor_diverter',        category: 'Industrial',    definition: conveyorDiverter },
  { id: 'car_seat_adjuster',        category: 'Automotive & medical', definition: carSeatAdjuster },
  { id: 'knee_orthosis',            category: 'Automotive & medical', definition: kneeOrthosis },
];

export const DEFAULT_DEMO_ID = 'three_link_arm';
