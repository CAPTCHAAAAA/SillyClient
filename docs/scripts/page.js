import { translations } from './page/content.js?v=20260817-video-source-cards-v1';
import { inspectorCatalog } from './page/inspector-content.js?v=20260726-page-modules-v1';
import { createComponentInspector } from './page/component-inspector.js?v=20260726-page-modules-v1';
import { initializePageNavigation } from './page/navigation-controller.js?v=20260726-page-modules-v2';
import { initializeBilibiliPlayers } from './ui/bilibili-player.js?v=20260817-video-source-cards-v1';
import { createTitleFontController } from './ui/title-font-controller.js?v=20260726-title-font-v1';

(() => {
  const pageScroller = document.getElementById('scroller');
  const titleFontButton = document.getElementById('title-font-button');
  const titleWordmark = document.querySelector('.title-wordmark');
  const heroTitle = document.querySelector('.hero-title');
  const languageButtons = [...document.querySelectorAll('[data-language]')];
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const fontRegistry = window.SillyLanding?.fonts;
  const titleFonts = fontRegistry?.available || ['Syndra'];
  const designPx = (value) => value * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 1);
  let currentLanguage = 'zh';
  const titleFontController = createTitleFontController({
    button: titleFontButton,
    title: heroTitle,
    wordmark: titleWordmark,
    fonts: titleFonts,
    defaultFont: fontRegistry?.defaultFont || 'Syndra',
    labelFor: font => translations[currentLanguage].fontLabel.replace('{font}', font),
    scalePx: designPx
  });
  const inspectorController = createComponentInspector({
    catalog: inspectorCatalog,
    translations,
    getLanguage: () => currentLanguage,
    pageScroller,
    scalePx: designPx
  });
  const navigationController = initializePageNavigation({
    getMenuLabel: open => translations[currentLanguage][open ? 'closeMenu' : 'openMenu']
  });
  initializeBilibiliPlayers();
  function setupSectionReveals() {
    const revealItems = [...document.querySelectorAll('[data-reveal]')];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    revealItems.forEach((item) => item.classList.add('will-reveal'));
    // If GSAP ScrollTrigger is active, it handles the reveal animation
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      root: pageScroller,
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px'
    });
    revealItems.forEach((item) => observer.observe(item));
  }

  setupSectionReveals();

  function applyLanguage(language) {
    currentLanguage = translations[language] ? language : 'zh';
    const copy = translations[currentLanguage];
    document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
    document.title = copy.documentTitle;
    if (descriptionMeta) descriptionMeta.setAttribute('content', copy.metaDescription);

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = copy[element.dataset.i18n];
      if (value) element.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      const value = copy[element.dataset.i18nAria];
      if (value) element.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const value = copy[element.dataset.i18nTitle];
      if (value) element.setAttribute('title', value);
    });

    languageButtons.forEach((button) => {
      const active = button.dataset.language === currentLanguage;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem('landing-language', currentLanguage);
    navigationController.syncMenuLabel();
    titleFontController.syncLabel();
    inspectorController.syncLabels();
    inspectorController.refresh();
    if (window.SillyScrollReveal) window.SillyScrollReveal.refresh();
    window.dispatchEvent(new CustomEvent('sillyclient-language-change', {
      detail: { language: currentLanguage }
    }));
    requestAnimationFrame(titleFontController.fit);
  }
  const savedLanguage = localStorage.getItem('landing-language');
  applyLanguage(savedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
  languageButtons.forEach((button) => {
    button.addEventListener('click', () => applyLanguage(button.dataset.language));
  });

})();
