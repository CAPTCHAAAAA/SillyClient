import { initColorBends } from './color-bends.js?v=20260726-background-modules-v1';
import { initDotField } from './dot-field.js?v=20260726-background-modules-v1';

function initializeBackground() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.body) return;
  initColorBends();
  initDotField();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeBackground, { once: true });
} else {
  initializeBackground();
}

export { initializeBackground };
