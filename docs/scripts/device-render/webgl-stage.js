import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createStudioLighting } from '../studio-lighting.js?v=20261102-final-v12';

export function createWebglStage({
  THREE,
  canvas,
  preserveDrawingBuffer,
  heroScene,
  verticalFovForAspect
}) {
  // 渲染分辨率统一上限 2x：竖屏此前 1.4 是偏糊的主因；配合按需渲染，静止时无成本
  const renderPixelRatio = () => Math.min(devicePixelRatio, 2);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d10, 0.012);

  const initialAspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  const camera = new THREE.PerspectiveCamera(
    verticalFovForAspect(initialAspect),
    initialAspect,
    0.1,
    200
  );
  camera.position.fromArray(heroScene.camera.position);
  camera.up.fromArray(heroScene.camera.up).normalize();

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    preserveDrawingBuffer
  });
  renderer.setPixelRatio(renderPixelRatio());
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0x0b0d10, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.84;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // EffectComposer 会绕过画布自身的 MSAA（场景先渲到离屏目标），
  // 因此给渲染目标显式开 8x 多重采样，硬件抗锯齿与 SMAA 叠加。
  const initialSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(
    initialSize.x,
    initialSize.y,
    { type: THREE.HalfFloatType, samples: 8 }
  ));
  composer.addPass(new RenderPass(scene, camera));
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(canvas.clientWidth, canvas.clientHeight),
    0.025,
    0.22,
    1.18
  );
  composer.addPass(bloomPass);
  composer.addPass(new SMAAPass(
    canvas.clientWidth * renderPixelRatio(),
    canvas.clientHeight * renderPixelRatio()
  ));
  composer.addPass(new OutputPass());

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.44;
  pmremGenerator.dispose();

  createStudioLighting(THREE, scene);

  return {
    bloomPass,
    camera,
    composer,
    renderer,
    renderPixelRatio,
    scene
  };
}
