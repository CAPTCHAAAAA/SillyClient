/*
 * Device-stage geometry derived from SillyClient_Assets/models/blender/模拟场景.blend.
 * Blender uses Z-up; glTF/Three.js uses Y-up, so vectors map as (x, z, -y).
 * The uniform world scale and origin change keep the authored projection intact.
 */

export const HERO_SCENE = Object.freeze({
  horizontalFov: 50.692255,
  camera: Object.freeze({
    position: Object.freeze([7.964888, -0.542994, 4.215993]),
    direction: Object.freeze([-0.849063, 0.03594, -0.527067]),
    up: Object.freeze([0.030536, 0.999354, 0.018954])
  }),
  phone: Object.freeze({
    position: Object.freeze([2.752342, -0.78821, 1.633243]),
    rotation: Object.freeze([0.717762, -0.653719, -0.428156]),
    scale: 0.605536
  }),
  laptop: Object.freeze({
    position: Object.freeze([0, 0, 0]),
    rotation: Object.freeze([0, 0, 0]),
    scale: 0.633652,
    lidMode: 'authored'
  })
});

export const PHONE_SHOWCASE_STATES = Object.freeze([
  Object.freeze({ x: 0.74, y: 0.06, z: 0.52, scale: 0.7, yaw: -0.14, pitch: -0.045, roll: 0 }),
  Object.freeze({ x: 2.82, y: 0.1, z: -1.3, scale: 0.3, yaw: 1.25, pitch: 0.02, roll: -0.08 }),
  Object.freeze({ x: -0.08, y: 0.11, z: 0.42, scale: 0.4, yaw: 0.1, pitch: -0.04, roll: 0 })
]);

export const LAPTOP_SHOWCASE_STATES = Object.freeze([
  Object.freeze({ x: 2.28, y: 0.04, z: -1.28, scale: 0.34, yaw: 0.16, pitch: 0.02, roll: -0.012, lidMode: 'authored' }),
  Object.freeze({ x: 1.18, y: 0.13, z: 0.08, scale: 0.44, yaw: -0.04, pitch: 0.02, roll: 0, lidMode: 'perpendicular' }),
  Object.freeze({ x: 1.87, y: 0.11, z: -0.38, scale: 0.44, yaw: 0.12, pitch: 0.02, roll: -0.004, lidMode: 'perpendicular' })
]);

export const CAMERA_SHOWCASE_STATES = Object.freeze([
  Object.freeze({ x: -0.46, y: 0.34, z: 6.18, lookX: 0.44, lookY: 0.02, lookZ: 0.02 }),
  Object.freeze({ x: 0.92, y: 0.28, z: 6.02, lookX: 0.58, lookY: 0.02, lookZ: -0.16 }),
  Object.freeze({ x: -0.58, y: 0.56, z: 5.55, lookX: 0.34, lookY: 0.04, lookZ: -0.05 })
]);

export function verticalFovForAspect(aspect) {
  const safeAspect = Math.max(0.1, aspect);
  const horizontalRadians = HERO_SCENE.horizontalFov * Math.PI / 180;
  return 2 * Math.atan(Math.tan(horizontalRadians / 2) / safeAspect) * 180 / Math.PI;
}
