import { setFrame } from './frame-stage.js?v=20260817-visual-centering-v2';

export function initializeExperience() {
  const accordion = document.querySelector('[data-mobile-accordion]');
  const stage = document.querySelector('.mobile-product-stage--experience');
  if (!accordion || !stage) return;

  const items = [...accordion.querySelectorAll('[data-mobile-device-state]')];
  const select = (index) => {
    items.forEach((item, itemIndex) => {
      const active = itemIndex === index;
      item.classList.toggle('is-active', active);
      item.querySelector('button')?.setAttribute('aria-expanded', String(active));
      const tray = item.querySelector('.mobile-accordion__tray');
      if (tray) tray.inert = !active;
    });
    setFrame(stage, index);
  };

  items.forEach((item, index) => {
    item.querySelector('button')?.addEventListener('click', () => select(index));
  });
  select(0);
}
