import { createTitleFontController } from '../../scripts/ui/title-font-controller.js?v=20260726-title-font-v1';

export function initializeTitleFont() {
  const controller = createTitleFontController({
    button: document.getElementById('title-font-button'),
    title: document.querySelector('.hero-title'),
    wordmark: document.getElementById('title-wordmark'),
    fonts: window.SillyLanding?.fonts?.available ?? ['Syndra'],
    defaultFont: window.SillyLanding?.fonts?.defaultFont || 'Syndra',
    labelFor(font) {
      return document.documentElement.lang.startsWith('en')
        ? `Cycle title font, currently ${font}`
        : `点击切换标题字体，当前为 ${font}`;
    }
  });

  window.addEventListener('mobile-language-change', controller.syncLabel);
}
