import {
  PRODUCT_FRAME_LIMITS,
  clampProductValue
} from './config.js?v=20260726-product-config-v1';

export function readProductRenderRequest(search = window.location.search) {
  const params = new URLSearchParams(search);

  return Object.freeze({
    enabled: params.has('productRender'),
    state: Math.round(clampProductValue(params.get('productState'), PRODUCT_FRAME_LIMITS.state)),
    width: Math.round(clampProductValue(params.get('renderWidth'), PRODUCT_FRAME_LIMITS.width)),
    height: Math.round(clampProductValue(params.get('renderHeight'), PRODUCT_FRAME_LIMITS.height)),
    quality: clampProductValue(params.get('renderQuality'), PRODUCT_FRAME_LIMITS.quality)
  });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(reader.result), { once: true });
    reader.addEventListener('error', () => reject(reader.error), { once: true });
    reader.readAsDataURL(blob);
  });
}

export function encodeCanvas(canvas, { type = 'image/webp', quality = 0.9 } = {}) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => blob ? resolve(blob) : reject(new Error('WebGL canvas export returned no data')),
      type,
      quality
    );
  });
}

export function publishProductFrame({ dataUrl, state }) {
  window.__sillyProductFrame = dataUrl;
  let output = document.getElementById('product-render-output');
  if (!output) {
    output = document.createElement('textarea');
    output.id = 'product-render-output';
    output.hidden = true;
    document.body.append(output);
  }
  output.value = dataUrl;
  output.textContent = dataUrl;
  document.documentElement.dataset.productRenderState = String(state);
  document.documentElement.dataset.productRenderEncoded = 'true';
  document.documentElement.dataset.productRenderReady = 'true';
}
