import { PRODUCT_SCREEN_PRESETS } from './config.js?v=20260726-product-config-v1';

function loadTexture(THREE, url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, resolve, undefined, reject);
  });
}

function prepareTexture(THREE, renderer, texture, { flipY = false } = {}) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = flipY;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  return texture;
}

function replaceScreenMaterial(THREE, mesh, texture) {
  const previous = mesh.material;
  mesh.material = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    side: THREE.DoubleSide,
    depthWrite: true,
    toneMapped: false
  });
  if (Array.isArray(previous)) previous.forEach(material => material?.dispose?.());
  else previous?.dispose?.();
}

export async function installProductScreenMaterials({
  THREE,
  renderer,
  phoneScreenMesh,
  laptopScreenMesh
}) {
  if (!phoneScreenMesh || !laptopScreenMesh) {
    throw new Error('Both product screen meshes are required before texture binding');
  }

  const [phoneTexture, laptopTexture] = await Promise.all([
    loadTexture(THREE, PRODUCT_SCREEN_PRESETS.phone.textureUrl),
    loadTexture(THREE, PRODUCT_SCREEN_PRESETS.laptop.textureUrl)
  ]);

  replaceScreenMaterial(THREE, phoneScreenMesh, prepareTexture(THREE, renderer, phoneTexture));
  replaceScreenMaterial(
    THREE,
    laptopScreenMesh,
    prepareTexture(THREE, renderer, laptopTexture, { flipY: true })
  );
  document.documentElement.dataset.productScreens = 'html-textured';
}
