(function () {
  const showcase = document.getElementById('device-showcase');
  if (!showcase) return;

  const items = [...showcase.querySelectorAll('[data-device-state]')];
  let activeIndex = 0;
  const viewedStates = new Set();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const transitionDuration = reducedMotion.matches ? 0 : 1500;
  let transitionLockedUntil = 0;

  function isTransitionLocked() {
    return performance.now() < transitionLockedUntil;
  }

  function selectState(index, source = 'programmatic') {
    if (source !== 'initial' && isTransitionLocked()) return false;

    const previousIndex = activeIndex;
    activeIndex = (index + items.length) % items.length;
    const changed = activeIndex !== previousIndex;
    viewedStates.add(activeIndex);

    items.forEach((item, itemIndex) => {
      const active = itemIndex === activeIndex;
      const button = item.querySelector('button');
      const tray = item.querySelector('.device-accordion-tray');
      item.classList.toggle('is-active', active);
      button?.setAttribute('aria-expanded', String(active));
      tray?.setAttribute('aria-hidden', String(!active));
      if (tray) tray.inert = !active;
    });

    document.documentElement.dataset.deviceShowcaseState = String(activeIndex);
    window.dispatchEvent(new CustomEvent('device-showcase-change', {
      detail: {
        index: activeIndex,
        previousIndex,
        source,
        duration: transitionDuration,
        hasSeenAll: viewedStates.size === items.length
      }
    }));

    if (changed) transitionLockedUntil = performance.now() + transitionDuration;
    return changed;
  }

  function stepState(direction, source = 'navigation') {
    // Consume repeated input while the current camera move settles.
    if (isTransitionLocked()) return true;

    const nextIndex = Math.max(0, Math.min(items.length - 1, activeIndex + Math.sign(direction)));
    if (nextIndex === activeIndex) return false;
    selectState(nextIndex, source);
    return true;
  }

  window.SillyDeviceShowcase = {
    getIndex: () => activeIndex,
    getCount: () => items.length,
    hasSeenAll: () => viewedStates.size === items.length,
    firstUnseen: () => items.findIndex((_, index) => !viewedStates.has(index)),
    select: selectState,
    step: stepState
  };

  items.forEach((item, index) => {
    item.querySelector('button')?.addEventListener('click', () => {
      selectState(index === activeIndex ? activeIndex + 1 : index, 'click');
    });
  });

  selectState(0, 'initial');
})();
