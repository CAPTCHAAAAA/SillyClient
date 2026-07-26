import {
  blobToDataUrl,
  encodeCanvas,
  publishProductFrame
} from './frame-export.js?v=20260726-product-config-v1';
import {
  PRODUCT_FRAME_LIMITS,
  clampProductValue
} from './config.js?v=20260726-product-config-v1';

export function createProductFrameRenderer({
  request,
  canvas,
  renderer,
  composer,
  camera,
  waitForModels,
  bindScreenMaterials,
  prepareState,
  settleFrame
}) {
  let screenMaterialsPromise = null;

  async function render({
    state = request.state,
    width = PRODUCT_FRAME_LIMITS.width.fallback,
    height = PRODUCT_FRAME_LIMITS.height.fallback,
    type = 'image/webp',
    quality = PRODUCT_FRAME_LIMITS.quality.fallback
  } = {}) {
    if (!request.enabled) {
      throw new Error('Open the page with ?productRender=1 before exporting a product frame');
    }
    await waitForModels();

    if (!screenMaterialsPromise) screenMaterialsPromise = bindScreenMaterials();
    await screenMaterialsPromise;

    const outputState = Math.round(clampProductValue(state, PRODUCT_FRAME_LIMITS.state));
    const outputWidth = Math.round(clampProductValue(width, PRODUCT_FRAME_LIMITS.width));
    const outputHeight = Math.round(clampProductValue(height, PRODUCT_FRAME_LIMITS.height));
    const outputQuality = clampProductValue(quality, PRODUCT_FRAME_LIMITS.quality);

    prepareState(outputState);
    renderer.setPixelRatio(1);
    renderer.setSize(outputWidth, outputHeight, false);
    composer.setPixelRatio(1);
    composer.setSize(outputWidth, outputHeight);
    camera.aspect = outputWidth / outputHeight;
    camera.updateProjectionMatrix();

    for (let frame = 0; frame < 36; frame += 1) {
      settleFrame();
    }
    composer.render(0);

    const blob = await encodeCanvas(canvas, { type, quality: outputQuality });
    document.documentElement.dataset.productRenderState = String(outputState);
    document.documentElement.dataset.productRenderEncoded = 'false';
    return blob;
  }

  const api = Object.freeze({
    render,
    renderDataUrl: async options => blobToDataUrl(await render(options))
  });
  window.SillyProductRenderer = api;

  if (request.enabled) {
    document.documentElement.dataset.productRenderReady = 'false';
    render({
      state: request.state,
      width: request.width,
      height: request.height,
      quality: request.quality
    }).then(blobToDataUrl).then(dataUrl => {
      publishProductFrame({ dataUrl, state: request.state });
    }).catch(error => {
      document.documentElement.dataset.productRenderError = error.message;
      console.error('WebGL product render failed:', error);
    });
  }

  return api;
}
