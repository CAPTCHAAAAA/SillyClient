(function () {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const cards = [...document.querySelectorAll('[data-spotlight-card]')];
  if (!cards.length || !finePointer.matches) return;

  let frame = 0;
  let pointerX = -1;
  let pointerY = -1;
  let hasPointer = false;

  cards.forEach((card) => {
    card.style.setProperty(
      '--spotlight-color',
      card.dataset.spotlightColor || 'rgba(255, 255, 255, 0.25)'
    );
  });

  function updateCards() {
    frame = 0;
    if (reducedMotion.matches) {
      cards.forEach((card) => card.classList.remove('is-spotlight-active'));
      return;
    }
    cards.forEach((card) => {
      const rect = card.getBoundingClientRect();
      const x = pointerX - rect.left;
      const y = pointerY - rect.top;
      const isInside = hasPointer
        && x >= 0
        && y >= 0
        && x <= rect.width
        && y <= rect.height;

      card.classList.toggle('is-spotlight-active', isInside);
      if (!isInside) return;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  }

  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(updateCards);
  }

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    hasPointer = true;
    requestUpdate();
  }, { passive: true });

  window.addEventListener('mouseout', (event) => {
    if (event.relatedTarget) return;
    hasPointer = false;
    requestUpdate();
  }, { passive: true });

  window.addEventListener('blur', () => {
    hasPointer = false;
    requestUpdate();
  });

  window.addEventListener('resize', requestUpdate, { passive: true });
  document.getElementById('scroller')?.addEventListener('scroll', requestUpdate, { passive: true });

  reducedMotion.addEventListener('change', () => {
    requestUpdate();
  });
})();
