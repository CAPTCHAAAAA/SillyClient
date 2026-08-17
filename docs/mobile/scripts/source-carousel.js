const TYPE_LABELS = {
  zh: ['完整演示', '共享控制台', 'Android 原生宿主', 'Windows 桌面运行时'],
  en: ['full walkthrough', 'shared console', 'Android native host', 'Windows desktop runtime']
};

export function initializeSourceCarousel() {
  const carousel = document.querySelector('[data-mobile-source-carousel]');
  if (!carousel) return;
  const track = carousel.querySelector('.mobile-source-track');
  const slides = [...carousel.querySelectorAll('[data-mobile-source-slide]')];
  const previous = carousel.querySelector('[data-mobile-source-previous]');
  const next = carousel.querySelector('[data-mobile-source-next]');
  const current = carousel.querySelector('[data-mobile-source-current]');
  const type = document.querySelector('[data-mobile-source-type]');
  let index = 0;
  let language = document.documentElement.lang.startsWith('zh') ? 'zh' : 'en';

  const render = () => {
    track.style.setProperty('--mobile-source-index', String(index));
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === index;
      slide.classList.toggle('is-active', active);
      slide.setAttribute('aria-hidden', String(!active));
      slide.inert = !active;
    });
    previous.disabled = index === 0;
    next.disabled = index === slides.length - 1;
    current.textContent = String(index + 1).padStart(2, '0');
    if (type) type.textContent = TYPE_LABELS[language][index];
  };

  previous.addEventListener('click', () => {
    index = Math.max(0, index - 1);
    render();
  });
  next.addEventListener('click', () => {
    index = Math.min(slides.length - 1, index + 1);
    render();
  });
  window.addEventListener('mobile-language-change', (event) => {
    language = event.detail.language;
    render();
  });
  render();
}
