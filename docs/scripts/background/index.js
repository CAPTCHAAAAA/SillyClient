import { initColorBends } from './color-bends.js?v=20261102-stage-quality-v5';
import { initDotField } from './dot-field.js?v=20261102-stage-quality-v5';

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
