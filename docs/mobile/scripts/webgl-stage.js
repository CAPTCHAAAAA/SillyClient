import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStudioLighting } from '../../scripts/studio-lighting.js';
import { loadPhoneDevice } from '../../scripts/device-render/phone-device.js';
import { loadLaptopModel } from '../../scripts/laptop-model.js';
import { installProductScreenMaterials } from '../../scripts/product-render/screen-materials.js';
import { composeShowcaseTransition } from '../../scripts/device-transition.js';
import {
  HERO_SCENE,
  PHONE_SHOWCASE_STATES,
  LAPTOP_SHOWCASE_STATES,
  CAMERA_SHOWCASE_STATES
} from '../../scripts/device-scene-config.js';

const slots = [...document.querySelectorAll('[data-mobile-frame-stage]')];
const experience = document.querySelector('.mobile-product-stage--experience');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const canvas = document.createElement('canvas');
canvas.id = 'mobile-product-webgl';
canvas.setAttribute('aria-hidden', 'true');
document.body.append(canvas);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 200);
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
const clock = { last: 0, dirtyUntil: 0, from: 0, to: 0, started: -Infinity, origin: null };
const framingBias = [0.17, -0.075, 0.055];
const localBounds = new THREE.Box3();
const corner = new THREE.Vector3();
const center = new THREE.Vector3();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const back = new THREE.Vector3();
const points = [];
const metrics = { draws: 0, state: 0, moving: false, slots: [], error: null };
let renderer;
let phone;
let laptop;
let ready = false;
let raf = 0;
let environment;
let viewWidth = 0;
let viewHeight = 0;

function invalidate(duration = 1700) {
  clock.dirtyUntil = Math.max(clock.dirtyUntil, performance.now() + duration);
  if (!raf && ready && !document.hidden) raf = requestAnimationFrame(tick);
}

function selectState(index) {
  const next = THREE.MathUtils.clamp(Number(index) || 0, 0, 2);
  if (next === clock.to) return;
  const now = performance.now();
  // A new selection continues from the visible pose, including a partially open lid.
  const moving = !reduced.matches && now - clock.started < 1500;
  clock.origin = moving ? (metrics.pose || poseAt(now)) : null;
  clock.from = clock.to;
  clock.to = next;
  clock.started = now;
  metrics.state = next;
  invalidate();
}

function poseAt(now) {
  const progress = reduced.matches ? 1 : THREE.MathUtils.clamp((now - clock.started) / 1500, 0, 1);
  metrics.moving = progress < 1;
  const origin = clock.origin;
  const pose = composeShowcaseTransition({
    phoneStates: origin ? [origin.phone, PHONE_SHOWCASE_STATES[clock.to]] : PHONE_SHOWCASE_STATES,
    laptopStates: origin ? [origin.laptop, LAPTOP_SHOWCASE_STATES[clock.to]] : LAPTOP_SHOWCASE_STATES,
    cameraStates: origin ? [origin.camera, CAMERA_SHOWCASE_STATES[clock.to]] : CAMERA_SHOWCASE_STATES,
    fromIndex: origin ? 0 : clock.from,
    toIndex: origin ? 1 : clock.to,
    progress
  });
  const amount = progress ** 3 * (progress * (progress * 6 - 15) + 10);
  pose.framingBias = THREE.MathUtils.lerp(
    origin?.framingBias ?? framingBias[clock.from], framingBias[clock.to], amount
  );
  if (origin) {
    const lid = LAPTOP_SHOWCASE_STATES[clock.to].lidMode === 'perpendicular' ? 1 : 0;
    pose.laptop.lidBlend = THREE.MathUtils.lerp(origin.laptop.lidBlend, lid, amount);
  }
  metrics.pose = pose;
  return pose;
}

function applyPose(hero, pose) {
  if (hero) {
    phone.root.position.fromArray(HERO_SCENE.phone.position);
    phone.root.rotation.fromArray(HERO_SCENE.phone.rotation);
    phone.root.scale.setScalar(HERO_SCENE.phone.scale * 1.06);
    laptop.root.position.fromArray(HERO_SCENE.laptop.position);
    laptop.root.rotation.fromArray(HERO_SCENE.laptop.rotation);
    laptop.root.scale.setScalar(HERO_SCENE.laptop.scale);
    laptop.lidPivot.rotation.x = laptop.authoredLidAngle;
    camera.position.fromArray(HERO_SCENE.camera.position);
    camera.up.fromArray(HERO_SCENE.camera.up);
    camera.lookAt(new THREE.Vector3().fromArray(HERO_SCENE.camera.position)
      .add(new THREE.Vector3().fromArray(HERO_SCENE.camera.direction)));
  } else {
    const p = pose.phone;
    const l = pose.laptop;
    phone.root.position.set(p.x, p.y, p.z);
    phone.root.rotation.set(p.pitch, phone.baseRotationY + p.yaw, p.roll);
    phone.root.scale.setScalar(p.scale);
    laptop.root.position.set(l.x, l.y, l.z);
    laptop.root.rotation.set(l.pitch, l.yaw, l.roll);
    laptop.root.scale.setScalar(l.scale);
    laptop.lidPivot.rotation.x = THREE.MathUtils.lerp(
      laptop.authoredLidAngle, laptop.perpendicularLidAngle, l.lidBlend
    );
    const c = pose.camera;
    camera.position.set(c.x, c.y, c.z);
    camera.up.set(0, 1, 0);
    camera.lookAt(c.lookX, c.lookY, c.lookZ);
  }
  if (!metrics.moving && !reduced.matches) {
    phone.root.rotation.y += pointer.x * 0.055;
    phone.root.rotation.x += pointer.y * 0.022;
    laptop.root.rotation.y -= pointer.x * 0.025;
  }
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
}

function fitViewport(width, height, hero, pose) {
  camera.clearViewOffset();
  camera.zoom = 1;
  camera.aspect = width / height;
  camera.fov = 40;
  camera.updateProjectionMatrix();
  localBounds.makeEmpty();
  points.length = 0;
  for (const model of [phone.root, laptop.root]) {
    model.traverse(mesh => {
      if (!mesh.isMesh || !mesh.visible) return;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const bounds = mesh.geometry.boundingBox;
      for (let index = 0; index < 8; index++) {
        corner.set(
          index & 1 ? bounds.max.x : bounds.min.x,
          index & 2 ? bounds.max.y : bounds.min.y,
          index & 4 ? bounds.max.z : bounds.min.z
        ).applyMatrix4(mesh.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
        points.push(corner.clone());
        localBounds.expandByPoint(corner);
      }
    });
  }
  localBounds.getCenter(center);
  const vertical = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const horizontal = vertical * camera.aspect;
  let distance = -Infinity;
  for (const point of points) {
    distance = Math.max(distance,
      Math.abs(point.x - center.x) / (horizontal * 0.9) + point.z,
      Math.abs(point.y - center.y) / (vertical * 0.9) + point.z,
      point.z + 0.2
    );
  }
  right.setFromMatrixColumn(camera.matrixWorld, 0);
  up.setFromMatrixColumn(camera.matrixWorld, 1);
  back.setFromMatrixColumn(camera.matrixWorld, 2);
  camera.position.addScaledVector(right, center.x)
    .addScaledVector(up, center.y).addScaledVector(back, distance);
  camera.updateMatrixWorld(true);
  const projected = { left: Infinity, right: -Infinity, bottom: Infinity, top: -Infinity };
  for (const point of points) {
    const x = (point.x - center.x) / ((distance - point.z) * horizontal);
    const y = (point.y - center.y) / ((distance - point.z) * vertical);
    projected.left = Math.min(projected.left, x);
    projected.right = Math.max(projected.right, x);
    projected.bottom = Math.min(projected.bottom, y);
    projected.top = Math.max(projected.top, y);
  }
  const midpointX = (projected.left + projected.right) * 0.5;
  const midpointY = (projected.bottom + projected.top) * 0.5;
  const spanX = projected.right - projected.left;
  const spanY = projected.top - projected.bottom;
  const zoom = Math.min(hero ? 1.3 : 1.21, (hero ? 1.9 : 1.94) / Math.max(spanX, spanY));
  // Balance the visible devices while keeping every edge inside the frame.
  const horizontalRoom = Math.max(0, 0.99 - spanX * zoom * 0.5);
  const offsetX = THREE.MathUtils.clamp(
    (hero ? -0.075 : pose.framingBias) * spanX * zoom,
    -horizontalRoom, horizontalRoom
  );
  camera.zoom = zoom;
  camera.setViewOffset(
    width, height,
    (midpointX * zoom - offsetX) * width * 0.5,
    -midpointY * zoom * height * 0.5,
    width, height
  );
  projected.left = (projected.left - midpointX) * zoom + offsetX;
  projected.right = (projected.right - midpointX) * zoom + offsetX;
  projected.bottom = (projected.bottom - midpointY) * zoom;
  projected.top = (projected.top - midpointY) * zoom;
  return projected;
}

function resize() {
  const width = document.documentElement.clientWidth;
  const height = innerHeight;
  const ratio = Math.min(devicePixelRatio || 1, 1.75);
  if (width !== viewWidth || height !== viewHeight || ratio !== renderer.getPixelRatio()) {
    viewWidth = width;
    viewHeight = height;
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height, false);
  }
}

function draw(now) {
  resize();
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, viewWidth, viewHeight);
  renderer.clear();
  const delta = Math.min((now - clock.last) / 1000 || 0.016, 0.05);
  pointer.x = THREE.MathUtils.damp(pointer.x, pointer.tx, 7, delta);
  pointer.y = THREE.MathUtils.damp(pointer.y, pointer.ty, 7, delta);
  const pose = poseAt(now);
  metrics.slots = [];
  for (const slot of slots) {
    const rect = slot.getBoundingClientRect();
    const visibleTop = Math.max(0, rect.top);
    const visibleBottom = Math.min(viewHeight, rect.bottom);
    if (visibleBottom <= visibleTop || rect.width < 1 || rect.height < 1) continue;
    const hero = slot.classList.contains('mobile-product-stage--hero');
    const footer = hero ? 0 : 27;
    const height = Math.max(1, rect.height - footer);
    applyPose(hero, pose);
    const projected = fitViewport(rect.width, height, hero, pose);
    renderer.setViewport(rect.left, viewHeight - rect.top - height, rect.width, height);
    renderer.setScissor(
      Math.max(0, rect.left), Math.max(0, viewHeight - Math.min(rect.top + height, viewHeight)),
      Math.min(rect.right, viewWidth) - Math.max(0, rect.left),
      Math.max(0, Math.min(rect.top + height, viewHeight) - visibleTop)
    );
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
    metrics.slots.push({ hero, rect: { x: rect.x, y: rect.y, width: rect.width, height }, projected, zoom: camera.zoom });
  }
  renderer.setScissorTest(false);
  clock.last = now;
  metrics.draws++;
}

function tick(now) {
  raf = 0;
  if (!ready || document.hidden) return;
  if (now - clock.last >= 1000 / 45) draw(now);
  if (now < clock.dirtyUntil || metrics.moving) raf = requestAnimationFrame(tick);
}

function resetPointer() {
  pointer.tx = 0;
  pointer.ty = 0;
  invalidate(500);
}

function rebuildEnvironment() {
  environment?.dispose();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.44;
  room.dispose();
  pmrem.dispose();
}

async function initialize() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setClearColor(0x0b0d10, 0);
    renderer.autoClear = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.84;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene.fog = new THREE.FogExp2(0x0b0d10, 0.012);
    createStudioLighting(THREE, scene);
    rebuildEnvironment();
    const loader = new GLTFLoader();
    [phone, laptop] = await Promise.all([
      loadPhoneDevice({ THREE, loader, scene, heroScene: HERO_SCENE }),
      loadLaptopModel({ THREE, loader, scene })
    ]);
    await installProductScreenMaterials({
      THREE, renderer, phoneScreenMesh: phone.screenMesh, laptopScreenMesh: laptop.screenMesh
    });
    ready = true;
    selectState(experience.dataset.mobileFrame);
    draw(performance.now());
    document.documentElement.classList.add('mobile-webgl-ready');
    document.documentElement.dataset.mobileWebgl = 'ready';
    invalidate();
  } catch (error) {
    metrics.error = error.message;
    document.documentElement.dataset.mobileWebgl = 'fallback';
    document.documentElement.classList.remove('mobile-webgl-ready');
    renderer?.dispose();
    canvas.hidden = true;
    console.error('Mobile WebGL stage:', error);
  }
}

new MutationObserver(() => selectState(experience.dataset.mobileFrame))
  .observe(experience, { attributes: true, attributeFilter: ['data-mobile-frame'] });
const observer = new ResizeObserver(() => invalidate(700));
slots.forEach(slot => observer.observe(slot));
window.addEventListener('resize', () => invalidate(700), { passive: true });
window.addEventListener('scroll', () => invalidate(700), { passive: true });
document.addEventListener('scroll', () => invalidate(700), { passive: true, capture: true });
window.addEventListener('page-state-change', () => invalidate());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(raf);
    raf = 0;
  } else invalidate(600);
});
document.addEventListener('pointermove', event => {
  if (reduced.matches || !ready) return;
  const slot = slots.find(item => {
    const rect = item.getBoundingClientRect();
    return event.clientX >= rect.left && event.clientX <= rect.right
      && event.clientY >= rect.top && event.clientY <= rect.bottom;
  });
  if (!slot) return resetPointer();
  const rect = slot.getBoundingClientRect();
  pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
  pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  invalidate(500);
}, { passive: true });
document.addEventListener('pointerup', resetPointer, { passive: true });
document.addEventListener('pointercancel', resetPointer, { passive: true });
reduced.addEventListener('change', () => { resetPointer(); invalidate(); });
canvas.addEventListener('webglcontextlost', event => {
  event.preventDefault();
  ready = false;
  cancelAnimationFrame(raf);
  raf = 0;
  document.documentElement.classList.remove('mobile-webgl-ready');
  document.documentElement.dataset.mobileWebgl = 'fallback';
});
canvas.addEventListener('webglcontextrestored', () => {
  rebuildEnvironment();
  ready = true;
  document.documentElement.classList.add('mobile-webgl-ready');
  document.documentElement.dataset.mobileWebgl = 'ready';
  invalidate();
});

window.__mobileWebglStage = {
  get metrics() { return structuredClone(metrics); },
  samplePixels() {
    if (!ready) return { ready: false, error: metrics.error };
    draw(performance.now());
    const gl = renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const pixels = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let opaque = 0;
    let colored = 0;
    let signature = 0;
    for (let index = 0; index < pixels.length; index += 32) {
      if (pixels[index + 3] > 10) opaque++;
      if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 30) colored++;
      signature = (signature + pixels[index] * 3 + pixels[index + 1] * 5 + pixels[index + 2] * 7) >>> 0;
    }
    return { ready: true, width, height, opaque, colored, signature, ...structuredClone(metrics) };
  }
};

initialize();
