const desktopViewport = matchMedia('(min-aspect-ratio: 1 / 1)');
let modelLoaded = false;

function loadDesktopModel() {
  if (!desktopViewport.matches || modelLoaded) return;
  modelLoaded = true;
  import('./phone-model.js?v=20260726-screen-overscan-v52');
}

loadDesktopModel();
desktopViewport.addEventListener('change', loadDesktopModel);
