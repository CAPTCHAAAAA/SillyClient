const DEFAULT_STORAGE_KEY = 'landing-title-font';

export function createTitleFontController({
  button,
  title,
  wordmark,
  fonts = ['Syndra'],
  defaultFont = 'Syndra',
  storageKey = DEFAULT_STORAGE_KEY,
  labelFor = font => font,
  minimumSize = 30,
  loadSize = 72,
  scalePx = value => value
}) {
  if (!button || !title || !wordmark || fonts.length === 0) {
    return {
      apply() {},
      fit() {},
      syncLabel() {}
    };
  }

  let activeFont = localStorage.getItem(storageKey);
  if (!fonts.includes(activeFont)) {
    activeFont = fonts.includes(defaultFont) ? defaultFont : fonts[0];
  }

  function fit() {
    title.style.fontSize = '';
    requestAnimationFrame(() => {
      const baseSize = parseFloat(getComputedStyle(title).fontSize);
      const available = title.clientWidth;
      const required = wordmark.scrollWidth;
      if (required > available) {
        title.style.fontSize = `${Math.max(scalePx(minimumSize), baseSize * available / required)}px`;
      }
    });
  }

  function syncLabel() {
    const label = labelFor(activeFont);
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
  }

  function apply(font, animate = false) {
    activeFont = fonts.includes(font) ? font : fonts[0];
    title.style.setProperty('--title-font', `"${activeFont}"`);
    title.style.fontWeight = activeFont === 'Syndra' ? '600' : '400';
    syncLabel();
    localStorage.setItem(storageKey, activeFont);

    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      wordmark.getAnimations().forEach(animation => animation.cancel());
      wordmark.animate(
        [
          {
            opacity: 0.52,
            transform: `translateY(${scalePx(3)}px) scale(0.985)`,
            filter: `blur(${scalePx(2)}px)`
          },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }
        ],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    }

    document.fonts
      .load(`${activeFont === 'Syndra' ? 600 : 400} ${scalePx(loadSize)}px "${activeFont}"`)
      .finally(fit);
  }

  button.addEventListener('click', () => {
    const nextIndex = (fonts.indexOf(activeFont) + 1) % fonts.length;
    apply(fonts[nextIndex], true);
  });
  window.addEventListener('resize', fit);
  apply(activeFont);

  return {
    apply,
    fit,
    syncLabel,
    get activeFont() {
      return activeFont;
    }
  };
}
