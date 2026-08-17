export function initializeBilibiliPlayers(root = document) {
  const frames = [...root.querySelectorAll('[data-bilibili-player]')];
  if (!frames.length) return;

  const loadFrame = (frame) => {
    if (frame.dataset.bilibiliLoaded === 'true') return;
    const source = frame.dataset.bilibiliPlayer;
    if (!source) return;

    const stage = frame.closest('[data-bilibili-stage]');
    frame.dataset.bilibiliLoaded = 'true';
    frame.addEventListener('load', () => stage?.classList.add('is-loaded'), { once: true });
    frame.setAttribute('src', source);
  };

  if (!('IntersectionObserver' in window)) {
    frames.forEach(loadFrame);
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      loadFrame(entry.target);
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '360px 0px' });

  frames.forEach((frame) => observer.observe(frame));
}
