import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { createStudioLighting } from '../studio-lighting.js?v=20260726-product-lighting-v2';

export function createWebglStage({
  THREE,
  canvas,
  preserveDrawingBuffer,
  heroScene,
  verticalFovForAspect
}) {
  const renderPixelRatio = () => Math.min(devicePixelRatio, innerHeight > innerWidth ? 1.4 : 2);
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

  const composer = new EffectComposer(renderer);
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
