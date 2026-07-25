(function () {
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const FROM_SETTINGS = "'wght' 560, 'opsz' 12";
  const TO_SETTINGS = "'wght' 900, 'opsz' 40";
  let letters = [];
  let pointerX = -9999;
  let pointerY = -9999;
  let frame = 0;

  function parseSettings(value) {
    return new Map(value.split(',').map((setting) => {
      const [axis, amount] = setting.trim().split(/\s+/);
      return [axis.replace(/['"]/g, ''), Number(amount)];
    }));
  }

  const fromSettings = parseSettings(FROM_SETTINGS);
  const toSettings = parseSettings(TO_SETTINGS);
  const axes = [...fromSettings].map(([axis, fromValue]) => ({
    axis,
    fromValue,
    toValue: toSettings.get(axis) ?? fromValue
  }));

  function resetLetters() {
    letters.forEach(({ element }) => {
      element.style.fontVariationSettings = FROM_SETTINGS;
    });
  }

  function update() {
    frame = 0;
    if (!finePointer.matches || reducedMotion.matches || !document.documentElement.lang.startsWith('en')) {
      resetLetters();
      return;
    }

    const measurements = letters.map((entry) => {
      const rect = entry.element.getBoundingClientRect();
      return {
        ...entry,
        centerX: rect.left + rect.width / 2,
        centerY: rect.top + rect.height / 2,
        visible: rect.bottom >= 0 && rect.top <= innerHeight
      };
    });

    measurements.forEach(({ element, radius, falloff, centerX, centerY, visible }) => {
      if (!visible) {
        element.style.fontVariationSettings = FROM_SETTINGS;
        return;
      }
      const distance = Math.hypot(pointerX - centerX, pointerY - centerY);
      if (distance >= radius) {
        element.style.fontVariationSettings = FROM_SETTINGS;
        return;
      }

      const normalized = Math.min(Math.max(1 - distance / radius, 0), 1);
      const influence = falloff === 'gaussian'
        ? Math.exp(-((distance / (radius / 2)) ** 2) / 2)
        : falloff === 'exponential'
          ? normalized ** 2
          : normalized;
      element.style.fontVariationSettings = axes.map(({ axis, fromValue, toValue }) => (
        `'${axis}' ${fromValue + (toValue - fromValue) * influence}`
      )).join(', ');
    });
  }

  function requestUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function refresh() {
    letters = [];
    const english = document.documentElement.lang.startsWith('en');
    document.querySelectorAll('[data-variable-proximity]').forEach((container) => {
      container.classList.remove('variable-proximity');
      if (!english) return;

      const radius = Number(container.dataset.vpRadius || 90);
      const falloff = container.dataset.vpFalloff || 'linear';
      container.querySelectorAll('.scroll-reveal-word').forEach((word) => {
        const text = word.textContent;
        word.replaceChildren(...Array.from(text, (character) => {
          const letter = document.createElement('span');
          letter.className = 'variable-proximity-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = character;
          letter.style.fontVariationSettings = FROM_SETTINGS;
          letters.push({ element: letter, radius, falloff });
          return letter;
        }));
      });
    });
    requestUpdate();
  }

  window.addEventListener('pointermove', (event) => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    requestUpdate();
  }, { passive: true });
  window.addEventListener('mouseout', (event) => {
    if (event.relatedTarget) return;
    pointerX = -9999;
    pointerY = -9999;
    requestUpdate();
  }, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  document.getElementById('scroller')?.addEventListener('scroll', requestUpdate, { passive: true });
  finePointer.addEventListener('change', requestUpdate);
  reducedMotion.addEventListener('change', requestUpdate);
  document.fonts?.ready.then(requestUpdate);

  window.SillyVariableProximity = { refresh };
  refresh();
})();
