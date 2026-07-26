import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { loadLaptopModel } from './laptop-model.js?v=20260726-screen-overscan-v21';
import { composeShowcaseTransition } from './device-transition.js?v=20260726-bullet-time-v3';
import { createInputMotion } from './device-render/input-motion.js?v=20260726-device-modules-v2';
import { loadPhoneDevice } from './device-render/phone-device.js?v=20260726-device-modules-v1';
import { createScreenProjection } from './device-render/screen-projection.js?v=20260726-device-modules-v2';
import { createWebglStage } from './device-render/webgl-stage.js?v=20260726-device-modules-v1';
import { readProductRenderRequest } from './product-render/frame-export.js?v=20260726-product-config-v1';
import { createProductFrameRenderer } from './product-render/product-frame-renderer.js?v=20260726-product-renderer-v1';
import { installProductScreenMaterials } from './product-render/screen-materials.js?v=20260726-html-screen-v3';
import {
  HERO_SCENE,
  PHONE_SHOWCASE_STATES,
  LAPTOP_SHOWCASE_STATES,
  CAMERA_SHOWCASE_STATES,
  verticalFovForAspect
} from './device-scene-config.js?v=20260726-stage-three-close-v10';

const canvas = document.getElementById('three-canvas');
const pageParams = new URLSearchParams(window.location.search);
const productRenderRequest = readProductRenderRequest();
const productRenderMode = productRenderRequest.enabled;
const requestedProductState = productRenderRequest.state;
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
const {
  bloomPass,
  camera,
  composer,
  renderer,
  renderPixelRatio,
  scene
} = createWebglStage({
  THREE,
  canvas,
  preserveDrawingBuffer: productRenderMode,
  heroScene: HERO_SCENE,
  verticalFovForAspect
});

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
let phoneVisible = productRenderMode;
let laptop = null;
const laptopScreenSourceWidth = 1440;
let laptopScreenSourceHeight = 932;
let showcaseState = productRenderMode
  ? requestedProductState
  : Number(document.documentElement.dataset.deviceShowcaseState || 0);
let showcaseFromState = showcaseState;
let phoneScreenAlpha = 1;
let laptopScreenAlpha = 0;
let showcaseTransitionStartedAt = -Infinity;
let showcaseTransitionDuration = productRenderMode ? 0 : 1500;

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

loadPhoneDevice({ THREE, loader, scene, heroScene: HERO_SCENE }).then(phone => {
  phoneGroup = phone.root;
  screenMesh = phone.screenMesh;
  screenPlaneZ = phone.screenPlaneZ;
  baseRotationY = phone.baseRotationY;
  if (screenMesh) {
    if (loadingEl) loadingEl.style.display = 'none';
  } else if (loadingEl) {
    loadingEl.textContent = '模型中未找到可映射的屏幕';
  }
}).catch(err => {
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
const screenProjection = createScreenProjection({
  THREE,
  camera,
  canvas,
  section,
  isStageVisible: () => phoneVisible
});

function updateScreenOverlay() {
  if (!phoneGroup || !screenMesh) {
    screenFrame.style.display = 'none';
    return;
  }
  phoneGroup.updateMatrixWorld(true);
  screenProjection.update({
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
  screenProjection.update({
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
const inputMotion = createInputMotion({
  THREE,
  section,
  appScreen,
  isStageVisible: () => phoneVisible
});
const {
  compactInput,
  orientationMotion,
  pointer,
  reduced
} = inputMotion;

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
    inputMotion.resetOrientation();
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
function loop(now = 0, frameOptions = null) {
  if (!frameOptions) loopRafId = requestAnimationFrame(loop);
  if (!phoneVisible && !frameOptions?.force) return;

  const compact = section.clientHeight > section.clientWidth;
  const minimumFrameInterval = compact ? 1000 / 45 : 0;
  if (!frameOptions && now - lastRenderTime < minimumFrameInterval) return;
  lastRenderTime = now;

  const delta = frameOptions?.delta ?? Math.min(motionClock.getDelta(), 0.05);
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
        const topRightScreen = screenProjection.project(topRightWorld);
        if (Number.isFinite(topRightScreen.x) && Math.abs(topRightScreen.z) < 1) {
          labelTitle.style.transform = `translate(${topRightScreen.x - labelTitleW}px, ${topRightScreen.y}px)`;
        }
        // CTA label: bottom-left corner, offset outward
        const bottomLeftWorld = new THREE.Vector3(box3.min.x - 0.08, box3.min.y - 0.22, box3.min.z);
        const bottomLeftScreen = screenProjection.project(bottomLeftWorld);
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

function waitForProductModels(timeout = 20000) {
  if (phoneGroup && laptop) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const check = () => {
      if (phoneGroup && laptop) {
        resolve();
        return;
      }
      if (performance.now() - startedAt >= timeout) {
        reject(new Error('Product models did not finish loading before export'));
        return;
      }
      requestAnimationFrame(check);
    };
    check();
  });
}

createProductFrameRenderer({
  request: productRenderRequest,
  canvas,
  renderer,
  composer,
  camera,
  waitForModels: waitForProductModels,
  bindScreenMaterials: () => installProductScreenMaterials({
    THREE,
    renderer,
    phoneScreenMesh: screenMesh,
    laptopScreenMesh: laptop.screenMesh
  }),
  prepareState(outputState) {
    cancelAnimationFrame(loopRafId);
    phoneVisible = true;
    journeyProgress = 1;
    showcaseFromState = outputState;
    showcaseState = outputState;
    showcaseTransitionDuration = 0;
    showcaseTransitionStartedAt = -Infinity;
    phoneScreenAlpha = outputState === 1 ? 0 : 1;
    laptopScreenAlpha = outputState === 0 ? 0 : 1;
    inputMotion.reset();
  },
  settleFrame: () => loop(performance.now(), { force: true, delta: 0.2 })
});

function resizeScene() {
  if (productRenderMode) return;
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
