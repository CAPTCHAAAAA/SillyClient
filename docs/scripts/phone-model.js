import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadLaptopModel } from './laptop-model.js?v=20260726-screen-overscan-v21';
import { createStudioLighting } from './studio-lighting.js?v=20260726-product-lighting-v2';
import { composeShowcaseTransition } from './device-transition.js?v=20260726-bullet-time-v3';
import {
  HERO_SCENE,
  PHONE_SHOWCASE_STATES,
  LAPTOP_SHOWCASE_STATES,
  CAMERA_SHOWCASE_STATES,
  verticalFovForAspect
} from './device-scene-config.js?v=20260726-stage-three-close-v10';

const canvas = document.getElementById('three-canvas');
const loadingEl = document.getElementById('loading');
const section = document.getElementById('sec-phone');
const scroller = document.getElementById('scroller');
const journey = document.getElementById('journey');
const screenFrame = document.getElementById('screen-frame');
const appScreen = document.getElementById('app-screen');
const laptopScreenFrame = document.getElementById('laptop-screen-frame');
const laptopAppScreen = document.getElementById('laptop-app-screen');
const labelTitle = document.getElementById('phone-label-title');
const labelCta = document.getElementById('phone-label-cta');
let labelTitleW = 0, labelTitleH = 0, labelCtaW = 0, labelCtaH = 0;
const renderPixelRatio = () => Math.min(devicePixelRatio, innerHeight > innerWidth ? 1.4 : 2);

// ========================================
// Three.js Scene + GLB Model
// ========================================
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x0b0d10, 0.012);

const initialAspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
const camera = new THREE.PerspectiveCamera(verticalFovForAspect(initialAspect), initialAspect, 0.1, 200);
camera.position.fromArray(HERO_SCENE.camera.position);
camera.up.fromArray(HERO_SCENE.camera.up).normalize();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(renderPixelRatio());
renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
renderer.setClearColor(0x0b0d10, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.84;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
  0.025,
  0.22,
  1.18
);
composer.addPass(bloomPass);
const smaaPass = new SMAAPass(
  canvas.clientWidth * renderPixelRatio(),
  canvas.clientHeight * renderPixelRatio()
);
composer.addPass(smaaPass);
composer.addPass(new OutputPass());

const pmremGenerator = new THREE.PMREMGenerator(renderer);
scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.44;
pmremGenerator.dispose();

createStudioLighting(THREE, scene);

// ========================================
// Load GLB + Setup Screen
// ========================================
const loader = new GLTFLoader();
let phoneGroup = null;
let baseRotationY = 0;
const restingYaw = -0.12;
const restingPitch = -0.035;
let screenMesh = null;
let screenPlaneZ = 0;
let phoneVisible = false;
let laptop = null;
const laptopScreenSourceWidth = 1440;
let laptopScreenSourceHeight = 932;
let showcaseState = Number(document.documentElement.dataset.deviceShowcaseState || 0);
let showcaseFromState = showcaseState;
let phoneScreenAlpha = 1;
let laptopScreenAlpha = 0;
let showcaseTransitionStartedAt = -Infinity;
let showcaseTransitionDuration = 1500;

window.addEventListener('device-showcase-change', (event) => {
  const nextState = THREE.MathUtils.clamp(Number(event.detail?.index) || 0, 0, 2);
  if (nextState === showcaseState) return;
  showcaseFromState = showcaseState;
  showcaseState = nextState;
  const requestedDuration = Number(event.detail?.duration);
  showcaseTransitionDuration = Number.isFinite(requestedDuration)
    ? Math.max(0, requestedDuration)
    : 1500;
  showcaseTransitionStartedAt = performance.now();
});

loader.load('./models/iphone_17_air.glb', (gltf) => {
  const phoneModel = gltf.scene;
  let phoneBodyMaterial = null;
  const phoneLogoMeshes = [];

  // Screen mesh: make transparent (iframe overlay will show the real app)
  // Glass mesh: semi-transparent
  phoneModel.traverse((child) => {
    if (!child.isMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const mn = materials.map(material => material?.name || '').join(' ');
    if (/^Cube(?:$|_)/.test(child.name)) {
      child.visible = false;
      return;
    }
    if (/17Air_color1/i.test(mn)) phoneBodyMaterial = materials[0] || phoneBodyMaterial;
    if (/logo/i.test(mn) || /^Object_8(?:$|_)/.test(child.name)) {
      phoneLogoMeshes.push(child);
      return;
    }
    if (/17Air_(color[123]|logo|12)/.test(mn)) {
      materials.forEach((material) => {
        if (!material) return;
        material.metalness = Math.max(material.metalness ?? 0, 0.94);
        material.roughness = THREE.MathUtils.clamp(material.roughness ?? 0.21, 0.16, 0.24);
        material.envMapIntensity = 0.64;
        if (/17Air_color[123]/.test(material.name || '')) material.color.multiplyScalar(0.7);
        material.needsUpdate = true;
      });
    }
    if (mn.includes('17Air_Screen')) {
      screenMesh = child;
      child.material = new THREE.MeshStandardMaterial({
        color: 0x010102,
        metalness: 0,
        roughness: 1,
        envMapIntensity: 0.05,
        depthWrite: true,
        side: THREE.DoubleSide
      });
    }
    if (mn.includes('17Air_Glass')) {
      child.material = new THREE.MeshPhysicalMaterial({
        color: 0x9eb4c9,
        transparent: true,
        opacity: 0.07,
        roughness: 0.22,
        metalness: 0.05,
        transmission: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.12,
        depthWrite: false,
        side: THREE.DoubleSide
      });
    }
  });
  phoneLogoMeshes.forEach((mesh) => {
    if (phoneBodyMaterial) mesh.material = phoneBodyMaterial;
  });

  // Scale the model, center it inside a pivot, then rotate the pivot.
  const box = new THREE.Box3().setFromObject(phoneModel);
  const size = box.getSize(new THREE.Vector3());
  const scale = 3.2 / size.y;
  phoneModel.scale.setScalar(scale);
  const box2 = new THREE.Box3().setFromObject(phoneModel);
  const center = box2.getCenter(new THREE.Vector3());
  phoneModel.position.sub(center);

  phoneGroup = new THREE.Group();
  phoneGroup.add(phoneModel);
  scene.add(phoneGroup);
  phoneGroup.updateMatrixWorld(true);

  if (screenMesh) {
    screenMesh.geometry.computeBoundingBox();
    const screenBox = screenMesh.geometry.boundingBox;
    screenPlaneZ = (screenBox.min.z + screenBox.max.z) / 2;

    // This Sketchfab asset exports its display on local -Z after nested axis conversion.
    // A fixed half-turn is the verified front-facing baseline for this exact GLB.
    baseRotationY = Math.PI;
    phoneGroup.rotation.fromArray(HERO_SCENE.phone.rotation);
    phoneGroup.position.fromArray(HERO_SCENE.phone.position);
    phoneGroup.scale.setScalar(HERO_SCENE.phone.scale);
    phoneGroup.updateMatrixWorld(true);
    if (loadingEl) loadingEl.style.display = 'none';
  } else if (loadingEl) {
    loadingEl.textContent = '模型中未找到可映射的屏幕';
  }
}, undefined, (err) => {
  console.error('GLTF load error:', err);
  phoneGroup = null;
  screenFrame.style.display = 'none';
  if (loadingEl) loadingEl.textContent = '3D 模型加载失败，请刷新页面重试';
});

loadLaptopModel({ THREE, loader, scene }).then((loadedLaptop) => {
  laptop = loadedLaptop;
  laptopScreenSourceHeight = Math.round(laptopScreenSourceWidth / laptop.screenAspect);
  laptopScreenFrame.style.width = `${laptopScreenSourceWidth}px`;
  laptopScreenFrame.style.height = `${laptopScreenSourceHeight}px`;
  laptopAppScreen.style.width = `${laptopScreenSourceWidth}px`;
  laptopAppScreen.style.height = `${laptopScreenSourceHeight}px`;
  laptop.root.position.fromArray(HERO_SCENE.laptop.position);
  laptop.root.rotation.fromArray(HERO_SCENE.laptop.rotation);
  laptop.root.scale.setScalar(HERO_SCENE.laptop.scale);
  if (laptop.lidPivot) laptop.lidPivot.rotation.x = laptop.authoredLidAngle;
  document.documentElement.dataset.laptopPerpendicularError = laptop.perpendicularError.toExponential(3);
  document.documentElement.dataset.laptopPerpendicularAngle = laptop.perpendicularLidAngle.toFixed(6);
  laptop.root.updateMatrixWorld(true);
}).catch((error) => {
  console.error('MacBook GLTF load error:', error);
  laptop = null;
  if (laptopScreenFrame) laptopScreenFrame.style.display = 'none';
});

// ========================================
// 3D → 2D Projection (for iframe overlay)
// ========================================
// Convert world position to section-relative pixels. The WebGL stage is a
// centered 16:9 canvas, so projected overlays must include its letterbox offset.
function toScreen(worldPos) {
  const v = worldPos.clone().project(camera);
  const canvasRect = canvas.getBoundingClientRect();
  const sectionRect = section.getBoundingClientRect();
  return {
    x: canvasRect.left - sectionRect.left + (v.x + 1) / 2 * canvasRect.width,
    y: canvasRect.top - sectionRect.top + (1 - v.y) / 2 * canvasRect.height,
    z: v.z
  };
}

function solveLinearSystem(matrix, values) {
  const size = values.length;
  const rows = matrix.map((row, index) => [...row, values[index]]);

  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    if (Math.abs(rows[pivot][column]) < 1e-10) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];

    const divisor = rows[column][column];
    for (let index = column; index <= size; index++) rows[column][index] /= divisor;

    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let index = column; index <= size; index++) {
        rows[row][index] -= factor * rows[column][index];
      }
    }
  }
  return rows.map(row => row[size]);
}

function quadToMatrix3d(points, width, height) {
  const source = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];
  const matrix = [];
  const values = [];

  source.forEach(([x, y], index) => {
    const { x: targetX, y: targetY } = points[index];
    matrix.push([x, 0, y, 0, 1, 0, -targetX * x, -targetX * y]);
    values.push(targetX);
    matrix.push([0, x, 0, y, 0, 1, -targetY * x, -targetY * y]);
    values.push(targetY);
  });

  const result = solveLinearSystem(matrix, values);
  if (!result) return null;
  const [a, b, c, d, e, f, g, h] = result;
  return `matrix3d(${a},${b},0,${g},${c},${d},0,${h},0,0,1,0,${e},${f},0,1)`;
}

const projectedOverlayTransforms = new WeakMap();

function stabilizeProjectedPoint(point) {
  const precision = Math.max(1, window.devicePixelRatio || 1) * 32;
  return {
    x: Math.round(point.x * precision) / precision,
    y: Math.round(point.y * precision) / precision,
    z: point.z
  };
}

function updateProjectedOverlay({ frame, mesh, planeZ, localCorners, insetXRatio, insetYRatio, fallbackWidth, fallbackHeight }) {
  if (!frame || !mesh || !phoneVisible) {
    if (frame) frame.style.display = 'none';
    return;
  }

  mesh.updateMatrixWorld(true);
  const box = mesh.geometry.boundingBox;
  const insetX = (box.max.x - box.min.x) * (insetXRatio || 0);
  const insetY = (box.max.y - box.min.y) * (insetYRatio || 0);
  const overlayCorners = localCorners || [
    new THREE.Vector3(box.min.x + insetX, box.max.y - insetY, planeZ),
    new THREE.Vector3(box.max.x - insetX, box.max.y - insetY, planeZ),
    new THREE.Vector3(box.max.x - insetX, box.min.y + insetY, planeZ),
    new THREE.Vector3(box.min.x + insetX, box.min.y + insetY, planeZ)
  ];
  const projected = overlayCorners.map(sourceCorner => {
    const corner = sourceCorner.clone();
    mesh.localToWorld(corner);
    return stabilizeProjectedPoint(toScreen(corner));
  });

  if (projected.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y) || Math.abs(point.z) > 1)) {
    frame.style.display = 'none';
    return;
  }

  // Reorder the plane corners to visual top-left, top-right, bottom-right, bottom-left.
  const byY = [...projected].sort((a, b) => a.y - b.y);
  const top = byY.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = byY.slice(2).sort((a, b) => a.x - b.x);
  const visualCorners = [top[0], top[1], bottom[1], bottom[0]];
  frame.style.display = 'block';
  const transform = quadToMatrix3d(visualCorners, fallbackWidth, fallbackHeight);

  if (!transform) {
    frame.style.display = 'none';
    return;
  }

  if (projectedOverlayTransforms.get(frame) !== transform) {
    frame.style.transform = transform;
    projectedOverlayTransforms.set(frame, transform);
  }
}

function updateScreenOverlay() {
  if (!phoneGroup || !screenMesh) {
    screenFrame.style.display = 'none';
    return;
  }
  phoneGroup.updateMatrixWorld(true);
  updateProjectedOverlay({
    frame: screenFrame,
    mesh: screenMesh,
    planeZ: screenPlaneZ,
    insetXRatio: 0.018,
    insetYRatio: 0.012,
    fallbackWidth: 390,
    fallbackHeight: 844
  });
}

function updateLaptopScreenOverlay() {
  if (!laptop?.screenMesh) {
    if (laptopScreenFrame) laptopScreenFrame.style.display = 'none';
    return;
  }
  laptop.root.updateMatrixWorld(true);
  updateProjectedOverlay({
    frame: laptopScreenFrame,
    mesh: laptop.screenMesh,
    localCorners: laptop.screenCorners,
    fallbackWidth: laptopScreenSourceWidth,
    fallbackHeight: laptopScreenSourceHeight
  });
}

// ========================================
// Camera input: pointer on desktop, calibrated device orientation on mobile.
// ========================================
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const compactInput = matchMedia('(max-aspect-ratio: 999 / 1000) and (pointer: coarse)');
const deviceOrientationType = window.DeviceOrientationEvent;
const orientationMotion = {
  x: 0,
  y: 0,
  tx: 0,
  ty: 0,
  baselineBeta: 0,
  baselineGamma: 0,
  hasBaseline: false,
  active: false,
  listening: false,
  permissionSettled: false,
  permissionPending: false,
  lastSample: 0
};

function normalizeAngleDelta(value) {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function resetOrientationBaseline() {
  orientationMotion.hasBaseline = false;
  orientationMotion.active = false;
  orientationMotion.tx = 0;
  orientationMotion.ty = 0;
}

function updateOrientationMotion(event) {
  if (!compactInput.matches || reduced || !phoneVisible) return;
  if (event.beta == null || event.gamma == null) return;
  const beta = Number(event.beta);
  const gamma = Number(event.gamma);
  if (!Number.isFinite(beta) || !Number.isFinite(gamma)) return;

  if (!orientationMotion.hasBaseline) {
    orientationMotion.baselineBeta = beta;
    orientationMotion.baselineGamma = gamma;
    orientationMotion.hasBaseline = true;
    orientationMotion.lastSample = performance.now();
    return;
  }

  const betaDelta = normalizeAngleDelta(beta - orientationMotion.baselineBeta);
  const gammaDelta = normalizeAngleDelta(gamma - orientationMotion.baselineGamma);
  const screenAngle = Number(screen.orientation?.angle ?? window.orientation ?? 0);
  let yaw = gammaDelta;
  let pitch = betaDelta;

  if (screenAngle === 90 || screenAngle === -270) {
    yaw = betaDelta;
    pitch = -gammaDelta;
  } else if (screenAngle === -90 || screenAngle === 270) {
    yaw = -betaDelta;
    pitch = gammaDelta;
  } else if (Math.abs(screenAngle) === 180) {
    yaw = -gammaDelta;
    pitch = -betaDelta;
  }

  orientationMotion.tx = THREE.MathUtils.clamp(yaw / 28, -1, 1);
  orientationMotion.ty = THREE.MathUtils.clamp(pitch / 24, -1, 1);
  orientationMotion.active = true;
  orientationMotion.lastSample = performance.now();
}

function attachDeviceOrientation() {
  if (!deviceOrientationType || orientationMotion.listening || reduced) return;
  window.addEventListener('deviceorientation', updateOrientationMotion, { passive: true });
  orientationMotion.listening = true;
}

async function requestDeviceOrientationAccess() {
  if (
    !compactInput.matches
    || reduced
    || !deviceOrientationType
    || orientationMotion.permissionSettled
    || orientationMotion.permissionPending
  ) return;

  const requestPermission = deviceOrientationType.requestPermission;
  if (typeof requestPermission !== 'function') {
    orientationMotion.permissionSettled = true;
    attachDeviceOrientation();
    return;
  }

  orientationMotion.permissionPending = true;
  try {
    const permission = await requestPermission.call(deviceOrientationType);
    orientationMotion.permissionSettled = true;
    if (permission === 'granted') attachDeviceOrientation();
  } catch {
    orientationMotion.permissionSettled = true;
  } finally {
    orientationMotion.permissionPending = false;
  }
}

function setPointerFromViewport(clientX, clientY) {
  if (!finePointer.matches || !phoneVisible) return;
  const rect = section.getBoundingClientRect();
  pointer.tx = THREE.MathUtils.clamp(((clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
  pointer.ty = THREE.MathUtils.clamp(((clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
}
if (finePointer.matches) {
  window.addEventListener('pointermove', e => {
    setPointerFromViewport(e.clientX, e.clientY);
  }, { passive: true });
}

if (compactInput.matches && deviceOrientationType) {
  if (typeof deviceOrientationType.requestPermission === 'function') {
    section.addEventListener('click', requestDeviceOrientationAccess, { passive: true });
  } else {
    orientationMotion.permissionSettled = true;
    attachDeviceOrientation();
  }
}

const orientationTarget = screen.orientation || window;
orientationTarget.addEventListener('change', resetOrientationBaseline, { passive: true });
window.addEventListener('orientationchange', resetOrientationBaseline, { passive: true });
compactInput.addEventListener('change', (event) => {
  resetOrientationBaseline();
  if (event.matches && deviceOrientationType && typeof deviceOrientationType.requestPermission !== 'function') {
    orientationMotion.permissionSettled = true;
    attachDeviceOrientation();
  }
});

let trackedFrameWindow = null;
function attachIframePointerTracking() {
  try {
    const frameWindow = appScreen.contentWindow;
    if (!frameWindow || frameWindow === trackedFrameWindow) return;
    if (finePointer.matches) {
      frameWindow.addEventListener('pointermove', e => {
        if (!phoneVisible) return;
        const frameWidth = appScreen.clientWidth || 390;
        const frameHeight = appScreen.clientHeight || 844;
        pointer.tx = THREE.MathUtils.clamp((e.clientX / frameWidth - 0.5) * 2, -1, 1);
        pointer.ty = THREE.MathUtils.clamp((e.clientY / frameHeight - 0.5) * 2, -1, 1);
      }, { passive: true });
    }
    if (compactInput.matches && typeof deviceOrientationType?.requestPermission === 'function') {
      frameWindow.addEventListener('click', requestDeviceOrientationAccess, { passive: true });
    }
    trackedFrameWindow = frameWindow;
  } catch {
    // 跨源屏幕页仍可显示，只关闭 iframe 内部的指针跟随。
  }
}
appScreen.addEventListener('load', attachIframePointerTracking);
if (appScreen.contentDocument?.readyState !== 'loading') attachIframePointerTracking();

const motionClock = new THREE.Clock();
let journeyProgress = 0;

function updateJourneyProgress() {
  const range = Math.max(1, journey.offsetHeight - scroller.clientHeight);
  journeyProgress = THREE.MathUtils.clamp(
    (scroller.scrollTop - journey.offsetTop) / range,
    0,
    1
  );
}

scroller.addEventListener('scroll', updateJourneyProgress, { passive: true });
updateJourneyProgress();

const phoneObserver = new IntersectionObserver(([entry]) => {
  phoneVisible = entry.isIntersecting;
  if (!phoneVisible) {
    screenFrame.style.display = 'none';
    if (laptopScreenFrame) laptopScreenFrame.style.display = 'none';
    resetOrientationBaseline();
  }
}, { root: scroller, threshold: 0.05 });
phoneObserver.observe(section);

const phoneShowcaseStates = PHONE_SHOWCASE_STATES;
const laptopShowcaseStates = LAPTOP_SHOWCASE_STATES;
const cameraShowcaseStates = CAMERA_SHOWCASE_STATES;
const heroCameraPosition = new THREE.Vector3().fromArray(HERO_SCENE.camera.position);
const heroCameraDirection = new THREE.Vector3().fromArray(HERO_SCENE.camera.direction).normalize();
const heroCameraUp = new THREE.Vector3().fromArray(HERO_SCENE.camera.up).normalize();
const heroCameraLookTarget = heroCameraPosition.clone().addScaledVector(heroCameraDirection, 6);
const cameraLookTarget = heroCameraLookTarget.clone();
const cameraUpTarget = heroCameraUp.clone();
let lastRenderTime = 0;
let loopRafId = 0;
function loop(now = 0) {
  loopRafId = requestAnimationFrame(loop);
  if (!phoneVisible) return;

  const compact = section.clientHeight > section.clientWidth;
  const minimumFrameInterval = compact ? 1000 / 45 : 0;
  if (now - lastRenderTime < minimumFrameInterval) return;
  lastRenderTime = now;

  const delta = Math.min(motionClock.getDelta(), 0.05);
  pointer.x = THREE.MathUtils.damp(pointer.x, pointer.tx, 5.5, delta);
  pointer.y = THREE.MathUtils.damp(pointer.y, pointer.ty, 5.5, delta);
  const orientationFresh = compact
    && orientationMotion.active
    && now - orientationMotion.lastSample < 1600;
  if (!orientationFresh) orientationMotion.active = false;
  orientationMotion.x = THREE.MathUtils.damp(
    orientationMotion.x,
    orientationFresh ? orientationMotion.tx : 0,
    4.4,
    delta
  );
  orientationMotion.y = THREE.MathUtils.damp(
    orientationMotion.y,
    orientationFresh ? orientationMotion.ty : 0,
    4.4,
    delta
  );
  const journeyEase = THREE.MathUtils.smoothstep(journeyProgress, 0.08, 0.86);
  const overlayOpacity = THREE.MathUtils.smoothstep(journeyProgress, 0.43, 0.72);
  const rawMotionX = reduced ? 0 : (compact ? orientationMotion.x : pointer.x);
  const rawMotionY = reduced ? 0 : (compact ? orientationMotion.y : pointer.y);
  const heroMotion = 1 - journeyEase;
  const showcaseTransitionProgress = THREE.MathUtils.clamp(
    showcaseTransitionDuration === 0
      ? 1
      : (performance.now() - showcaseTransitionStartedAt) / showcaseTransitionDuration,
    0,
    1
  );
  const showcasePose = composeShowcaseTransition({
    phoneStates: phoneShowcaseStates,
    laptopStates: laptopShowcaseStates,
    cameraStates: cameraShowcaseStates,
    fromIndex: showcaseFromState,
    toIndex: showcaseState,
    progress: showcaseTransitionProgress
  });
  const phoneState = showcasePose.phone;
  const laptopState = showcasePose.laptop;
  const cinematicTransition = showcaseTransitionProgress < 1 && journeyEase > 0.5;
  const motionX = cinematicTransition ? 0 : rawMotionX;
  const motionY = cinematicTransition ? 0 : rawMotionY;
  const poseDamping = cinematicTransition ? 13 : 7.8;
  const showcaseScreenReveal = showcaseTransitionProgress < 0.42
    ? 1 - THREE.MathUtils.smoothstep(showcaseTransitionProgress, 0, 0.18)
    : THREE.MathUtils.smoothstep(showcaseTransitionProgress, 0.58, 0.96);

  phoneScreenAlpha = THREE.MathUtils.damp(
    phoneScreenAlpha,
    showcaseState === 1 ? 0 : 1,
    7,
    delta
  );
  laptopScreenAlpha = THREE.MathUtils.damp(
    laptopScreenAlpha,
    showcaseState === 0 ? 0 : 1,
    6,
    delta
  );

  if (phoneGroup) {
    const phoneMotionRange = THREE.MathUtils.lerp(0.16, 0.075, journeyEase);
    const targetRY = THREE.MathUtils.lerp(
      HERO_SCENE.phone.rotation[1],
      baseRotationY + phoneState.yaw,
      journeyEase
    )
      + motionX * (phoneMotionRange * journeyEase + 0.07 * heroMotion);
    const targetRX = THREE.MathUtils.lerp(HERO_SCENE.phone.rotation[0], phoneState.pitch, journeyEase)
      + motionY * (0.05 * journeyEase + 0.032 * heroMotion);
    const targetX = THREE.MathUtils.lerp(HERO_SCENE.phone.position[0], phoneState.x, journeyEase)
      + motionX * (0.022 * journeyEase + 0.014 * heroMotion);
    const targetY = THREE.MathUtils.lerp(HERO_SCENE.phone.position[1], phoneState.y, journeyEase)
      - motionY * (0.014 * journeyEase + 0.01 * heroMotion);
    const targetZ = THREE.MathUtils.lerp(HERO_SCENE.phone.position[2], phoneState.z, journeyEase);
    const targetRoll = THREE.MathUtils.lerp(HERO_SCENE.phone.rotation[2], phoneState.roll, journeyEase)
      - motionX * 0.012 * heroMotion;
    const targetScale = THREE.MathUtils.lerp(HERO_SCENE.phone.scale, phoneState.scale, journeyEase);
    const nextScale = THREE.MathUtils.damp(phoneGroup.scale.x, targetScale, poseDamping, delta);
    phoneGroup.rotation.y = THREE.MathUtils.damp(phoneGroup.rotation.y, targetRY, poseDamping + 0.7, delta);
    phoneGroup.rotation.x = THREE.MathUtils.damp(phoneGroup.rotation.x, targetRX, poseDamping + 0.7, delta);
    phoneGroup.rotation.z = THREE.MathUtils.damp(phoneGroup.rotation.z, targetRoll, poseDamping + 0.4, delta);
    phoneGroup.position.x = THREE.MathUtils.damp(phoneGroup.position.x, targetX, poseDamping, delta);
    phoneGroup.position.y = THREE.MathUtils.damp(phoneGroup.position.y, targetY, poseDamping, delta);
    phoneGroup.position.z = THREE.MathUtils.damp(phoneGroup.position.z, targetZ, poseDamping, delta);
    phoneGroup.scale.setScalar(nextScale);
  }

  if (laptop) {
    const heroLaptop = HERO_SCENE.laptop;
    const cameraMotionX = showcaseState === 1 ? -motionX : motionX;
    const cameraMotionY = showcaseState === 1 ? -motionY : motionY;
    const laptopTargetX = THREE.MathUtils.lerp(heroLaptop.position[0], laptopState.x, journeyEase)
      - cameraMotionX * 0.01 * journeyEase - motionX * 0.01 * heroMotion;
    const laptopTargetY = THREE.MathUtils.lerp(heroLaptop.position[1], laptopState.y, journeyEase)
      - cameraMotionY * 0.009 * journeyEase - motionY * 0.007 * heroMotion;
    const laptopTargetZ = THREE.MathUtils.lerp(heroLaptop.position[2], laptopState.z, journeyEase);
    const laptopTargetScale = THREE.MathUtils.lerp(heroLaptop.scale, laptopState.scale, journeyEase);
    const laptopTargetYaw = THREE.MathUtils.lerp(heroLaptop.rotation[1], laptopState.yaw, journeyEase)
      + cameraMotionX * 0.018 * journeyEase - motionX * 0.035 * heroMotion;
    const laptopTargetRoll = THREE.MathUtils.lerp(heroLaptop.rotation[2], laptopState.roll, journeyEase)
      + motionX * 0.008 * heroMotion;

    laptop.root.position.x = THREE.MathUtils.damp(laptop.root.position.x, laptopTargetX, poseDamping, delta);
    laptop.root.position.y = THREE.MathUtils.damp(laptop.root.position.y, laptopTargetY, poseDamping, delta);
    laptop.root.position.z = THREE.MathUtils.damp(laptop.root.position.z, laptopTargetZ, poseDamping, delta);
    laptop.root.rotation.x = THREE.MathUtils.damp(
      laptop.root.rotation.x,
      THREE.MathUtils.lerp(heroLaptop.rotation[0], laptopState.pitch, journeyEase)
        - cameraMotionY * 0.011 * journeyEase + motionY * 0.018 * heroMotion,
      poseDamping,
      delta
    );
    laptop.root.rotation.y = THREE.MathUtils.damp(laptop.root.rotation.y, laptopTargetYaw, poseDamping, delta);
    laptop.root.rotation.z = THREE.MathUtils.damp(laptop.root.rotation.z, laptopTargetRoll, poseDamping, delta);
    const nextLaptopScale = THREE.MathUtils.damp(laptop.root.scale.x, laptopTargetScale, poseDamping, delta);
    laptop.root.scale.setScalar(nextLaptopScale);
    if (laptop.lidPivot) {
      const heroLid = laptop.authoredLidAngle ?? 0;
      const stateLid = THREE.MathUtils.lerp(
        heroLid,
        laptop.perpendicularLidAngle,
        laptopState.lidBlend ?? (laptopState.lidMode === 'perpendicular' ? 1 : 0)
      );
      const lidTarget = THREE.MathUtils.lerp(heroLid, stateLid, journeyEase);
      laptop.lidPivot.rotation.x = THREE.MathUtils.damp(laptop.lidPivot.rotation.x, lidTarget, 7.2, delta);
    }
  }

  const cameraState = showcasePose.camera;
  const cameraDamping = cinematicTransition ? 11.5 : 4.5;
  const cameraMotionX = showcaseState === 1 ? -motionX : motionX;
  const cameraMotionY = showcaseState === 1 ? -motionY : motionY;
  camera.position.x = THREE.MathUtils.damp(
    camera.position.x,
    THREE.MathUtils.lerp(heroCameraPosition.x, cameraState.x, journeyEase)
      + cameraMotionX * 0.11 * journeyEase,
    cameraDamping,
    delta
  );
  camera.position.y = THREE.MathUtils.damp(
    camera.position.y,
    THREE.MathUtils.lerp(heroCameraPosition.y, cameraState.y, journeyEase)
      + cameraMotionY * 0.065 * journeyEase,
    cameraDamping,
    delta
  );
  camera.position.z = THREE.MathUtils.damp(
    camera.position.z,
    THREE.MathUtils.lerp(heroCameraPosition.z, cameraState.z, journeyEase) + Math.abs(cameraMotionX) * 0.025 * journeyEase,
    cameraDamping,
    delta
  );
  cameraLookTarget.x = THREE.MathUtils.damp(
    cameraLookTarget.x,
    THREE.MathUtils.lerp(heroCameraLookTarget.x, cameraState.lookX, journeyEase) - cameraMotionX * 0.018 * journeyEase,
    cinematicTransition ? 10.5 : 4.3,
    delta
  );
  cameraLookTarget.y = THREE.MathUtils.damp(
    cameraLookTarget.y,
    THREE.MathUtils.lerp(heroCameraLookTarget.y, cameraState.lookY, journeyEase) + cameraMotionY * 0.014 * journeyEase,
    cinematicTransition ? 10.5 : 4.3,
    delta
  );
  cameraLookTarget.z = THREE.MathUtils.damp(
    cameraLookTarget.z,
    THREE.MathUtils.lerp(heroCameraLookTarget.z, cameraState.lookZ, journeyEase),
    cinematicTransition ? 10.5 : 4.3,
    delta
  );
  cameraUpTarget.lerpVectors(heroCameraUp, THREE.Object3D.DEFAULT_UP, journeyEase).normalize();
  camera.up.copy(cameraUpTarget);
  const nextFov = THREE.MathUtils.lerp(verticalFovForAspect(camera.aspect), 40, journeyEase);
  if (Math.abs(camera.fov - nextFov) > 0.001) {
    camera.fov = nextFov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(cameraLookTarget);
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);

  if (phoneGroup) {
    screenFrame.style.setProperty('--reflection-x', `${42 - motionX * 12}%`);
    screenFrame.style.setProperty('--reflection-y', `${18 + motionY * 7}%`);
    screenFrame.style.setProperty('--reflection-angle', `${116 - motionX * 6}deg`);
    screenFrame.style.setProperty('--reflection-opacity', `${0.18 + Math.abs(motionX) * 0.025}`);
    const phoneOverlayOpacity = overlayOpacity * phoneScreenAlpha * showcaseScreenReveal;
    screenFrame.style.opacity = phoneOverlayOpacity.toFixed(3);
    screenFrame.style.pointerEvents = phoneOverlayOpacity > 0.92 ? 'auto' : 'none';
    updateScreenOverlay();

    // ====== Floating labels — project 3D phone corners to screen ======
    if (phoneGroup && phoneVisible && labelTitle && labelCta && !reduced) {
      const labelVisible = journeyEase < 0.6 && journeyProgress > 0.02;
      labelTitle.classList.toggle('is-visible', labelVisible);
      labelCta.classList.toggle('is-visible', labelVisible);
      if (labelVisible) {
        phoneGroup.updateMatrixWorld(true);
        labelTitleW = labelTitle.offsetWidth || 0;
        labelTitleH = labelTitle.offsetHeight || 0;
        labelCtaW = labelCta.offsetWidth || 0;
        labelCtaH = labelCta.offsetHeight || 0;
        const box3 = new THREE.Box3().setFromObject(phoneGroup);
        const labelAlpha = THREE.MathUtils.smoothstep(journeyEase, 0, 0.3) * THREE.MathUtils.smoothstep(journeyEase, 0.6, 0.35);
        labelTitle.style.opacity = labelAlpha.toFixed(3);
        labelCta.style.opacity = labelAlpha.toFixed(3);
        // Title label: top-right corner of phone bounding box, offset outward
        const topRightWorld = new THREE.Vector3(box3.max.x + 0.18, box3.max.y + 0.08, box3.min.z);
        const topRightScreen = toScreen(topRightWorld);
        if (Number.isFinite(topRightScreen.x) && Math.abs(topRightScreen.z) < 1) {
          labelTitle.style.transform = `translate(${topRightScreen.x - labelTitleW}px, ${topRightScreen.y}px)`;
        }
        // CTA label: bottom-left corner, offset outward
        const bottomLeftWorld = new THREE.Vector3(box3.min.x - 0.08, box3.min.y - 0.22, box3.min.z);
        const bottomLeftScreen = toScreen(bottomLeftWorld);
        if (Number.isFinite(bottomLeftScreen.x) && Math.abs(bottomLeftScreen.z) < 1) {
          labelCta.style.transform = `translate(${bottomLeftScreen.x}px, ${bottomLeftScreen.y - labelCtaH}px)`;
        }
      }
    }
  }

  if (laptop && laptopScreenFrame) {
    const laptopOverlayOpacity = overlayOpacity * laptopScreenAlpha * showcaseScreenReveal;
    laptopScreenFrame.style.opacity = laptopOverlayOpacity.toFixed(3);
    laptopScreenFrame.style.pointerEvents = laptopOverlayOpacity > 0.92 ? 'auto' : 'none';
    laptopScreenFrame.style.setProperty('--laptop-reflection-x', `${46 - motionX * 8}%`);
    laptopScreenFrame.style.setProperty('--laptop-reflection-y', `${14 + motionY * 5}%`);
    laptopScreenFrame.style.setProperty('--laptop-reflection-angle', `${118 - motionX * 5}deg`);
    laptopScreenFrame.style.setProperty('--laptop-reflection-opacity', `${0.12 + Math.abs(motionX) * 0.018}`);
    if (laptopOverlayOpacity > 0.015) updateLaptopScreenOverlay();
    else laptopScreenFrame.style.display = 'none';
  }

  canvas.style.opacity = '1';
  composer.render(delta);
}
loop();

function resizeScene() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.fov = THREE.MathUtils.lerp(verticalFovForAspect(camera.aspect), 40, THREE.MathUtils.smoothstep(journeyProgress, 0.08, 0.86));
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(w, h, false);
  composer.setPixelRatio(renderPixelRatio());
  composer.setSize(w, h);
  updateJourneyProgress();
  updateScreenOverlay();
  if (laptopScreenAlpha > 0.015) updateLaptopScreenOverlay();
}
let resizeRaf = 0;
window.addEventListener('resize', () => { cancelAnimationFrame(resizeRaf); resizeRaf = requestAnimationFrame(resizeScene); });
new ResizeObserver(resizeScene).observe(canvas);
