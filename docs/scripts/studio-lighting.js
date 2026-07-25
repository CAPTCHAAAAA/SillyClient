import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

export function createStudioLighting(THREE, scene) {
  RectAreaLightUniformsLib.init();

  const ambient = new THREE.HemisphereLight(0xc8d0d8, 0x050407, 0.14);
  scene.add(ambient);

  // A narrow vertical softbox draws a controlled band across brushed metal.
  const keyStrip = new THREE.RectAreaLight(0xf0f3f6, 1.45, 1.0, 5.4);
  keyStrip.position.set(-4.4, 2.8, 4.4);
  keyStrip.lookAt(0.2, 0, 0);
  scene.add(keyStrip);

  // Broad, dim fill preserves readable shadow detail without flattening it.
  const fillPanel = new THREE.RectAreaLight(0x8993a0, 0.34, 4.8, 4.2);
  fillPanel.position.set(4.2, 1.4, 4.6);
  fillPanel.lookAt(0.3, -0.1, 0);
  scene.add(fillPanel);

  // A rear strip separates the silhouette and catches the chamfered edges.
  const rimStrip = new THREE.RectAreaLight(0xc7d7e2, 0.9, 0.38, 5.8);
  rimStrip.position.set(3.2, 0.1, -4.2);
  rimStrip.lookAt(0.4, 0, 0);
  scene.add(rimStrip);

  // A restrained hard source adds one small specular cue among the soft bands.
  const pinLight = new THREE.PointLight(0xe2ebf1, 5, 7, 2);
  pinLight.position.set(-4.2, 0.8, 3.0);
  scene.add(pinLight);

  return { ambient, keyStrip, fillPanel, rimStrip, pinLight };
}
