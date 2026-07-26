const desktopViewport = matchMedia('(min-aspect-ratio: 1 / 1)');
const productRenderRequested = new URLSearchParams(window.location.search).has('productRender');
let modelLoaded = false;

function loadDesktopModel() {
  if ((!desktopViewport.matches && !productRenderRequested) || modelLoaded) return;
  modelLoaded = true;
  import('./phone-model.js?v=20260726-device-modules-v5');
}

loadDesktopModel();
desktopViewport.addEventListener('change', loadDesktopModel);
