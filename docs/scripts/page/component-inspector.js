export function createComponentInspector({
  catalog,
  translations,
  getLanguage,
  pageScroller,
  scalePx = value => value
}) {
  const panel = document.getElementById('component-inspector');
  const closeButton = document.getElementById('inspector-close');
  const scope = document.getElementById('inspector-scope');
  const title = document.getElementById('inspector-title');
  const body = document.getElementById('inspector-body');
  const relation = document.getElementById('inspector-relation');
  const stack = document.getElementById('inspector-stack');
  const path = document.getElementById('inspector-path');
  const link = document.getElementById('inspector-link');
  const linkLabel = document.getElementById('inspector-link-label');
  const triggers = [...document.querySelectorAll('[data-inspect-key]')];

  if (!panel || !closeButton || !pageScroller) {
    return {
      hide() {},
      refresh() {},
      syncLabels() {}
    };
  }

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let currentTrigger = null;
  let pinned = false;
  let hideTimer = 0;

  function entryFor(trigger) {
    return catalog[getLanguage()]?.[trigger?.dataset.inspectKey] || null;
  }

  function clearContext() {
    document.querySelectorAll('[data-inspect-group].is-inspecting').forEach(group => {
      group.classList.remove('is-inspecting');
      group.querySelectorAll('[data-inspect-key]').forEach(node => {
        node.classList.remove('is-context-active', 'is-context-related', 'is-context-muted');
      });
    });
    triggers.forEach(trigger => trigger.setAttribute('aria-expanded', 'false'));
  }

  function applyContext(trigger, entry) {
    clearContext();
    const group = trigger.closest('[data-inspect-group]');
    if (!group) return;
    const related = new Set(entry.related || []);
    group.classList.add('is-inspecting');
    group.querySelectorAll('[data-inspect-key]').forEach(node => {
      const key = node.dataset.inspectKey;
      node.classList.toggle('is-context-active', node === trigger);
      node.classList.toggle('is-context-related', related.has(key));
      node.classList.toggle('is-context-muted', node !== trigger && !related.has(key));
    });
    trigger.setAttribute('aria-expanded', 'true');
  }

  function position(trigger) {
    if (!trigger || matchMedia('(max-aspect-ratio: 999 / 1000)').matches) {
      panel.style.removeProperty('left');
      panel.style.removeProperty('top');
      panel.style.removeProperty('transform-origin');
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth;
    const panelHeight = panel.offsetHeight;
    const margin = scalePx(18);
    const railClearance = scalePx(52);
    const gap = scalePx(14);
    const rightCandidate = triggerRect.right + gap;
    const fitsRight = rightCandidate + panelWidth <= innerWidth - railClearance;
    const left = fitsRight
      ? rightCandidate
      : Math.max(margin, triggerRect.left - panelWidth - gap);
    const top = Math.max(scalePx(82), Math.min(
      innerHeight - panelHeight - margin,
      triggerRect.top + triggerRect.height / 2 - panelHeight / 2
    ));

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    panel.style.transformOrigin = `${fitsRight ? '0%' : '100%'} 50%`;
  }

  function render(trigger) {
    const entry = entryFor(trigger);
    if (!entry) return false;
    scope.textContent = entry.scope;
    title.textContent = entry.title;
    body.textContent = entry.body;
    relation.textContent = entry.relation;
    path.textContent = entry.path;
    path.title = entry.path;
    link.href = entry.href;
    linkLabel.textContent = entry.linkLabel;
    stack.replaceChildren(...entry.stack.map(label => {
      const item = document.createElement('li');
      item.textContent = label;
      return item;
    }));
    applyContext(trigger, entry);
    return true;
  }

  function show(trigger, shouldPin = false) {
    clearTimeout(hideTimer);
    if (!render(trigger)) return;
    currentTrigger = trigger;
    pinned = shouldPin;
    panel.classList.add('is-open');
    panel.classList.toggle('is-pinned', shouldPin);
    panel.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => position(trigger));
  }

  function hide() {
    clearTimeout(hideTimer);
    panel.classList.remove('is-open', 'is-pinned');
    panel.setAttribute('aria-hidden', 'true');
    clearContext();
    currentTrigger = null;
    pinned = false;
  }

  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (pinned || panel.contains(document.activeElement)) return;
      hide();
    }, 140);
  }

  function syncLabels() {
    const hint = translations[getLanguage()].inspectHint;
    triggers.forEach(trigger => {
      const entry = entryFor(trigger);
      if (entry) trigger.setAttribute('aria-label', `${entry.title}. ${hint}`);
    });
  }

  function refresh() {
    if (currentTrigger) render(currentTrigger);
  }

  triggers.forEach(trigger => {
    if (finePointer.matches) {
      trigger.addEventListener('pointerenter', () => {
        if (!pinned) show(trigger);
      });
      trigger.addEventListener('pointerleave', scheduleHide);
    }
    trigger.addEventListener('focus', () => show(trigger));
    trigger.addEventListener('blur', scheduleHide);
    trigger.addEventListener('click', () => {
      if (currentTrigger === trigger && pinned) {
        hide();
        return;
      }
      show(trigger, true);
    });
    trigger.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      trigger.click();
    });
  });

  if (finePointer.matches) {
    panel.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    panel.addEventListener('pointerleave', scheduleHide);
  }
  panel.addEventListener('focusin', () => clearTimeout(hideTimer));
  panel.addEventListener('focusout', scheduleHide);
  closeButton.addEventListener('click', hide);
  window.addEventListener('keydown', event => {
    if (event.key === 'Escape' && currentTrigger) hide();
  });
  window.addEventListener('resize', () => {
    if (currentTrigger) position(currentTrigger);
  });
  pageScroller.addEventListener('scroll', () => {
    if (currentTrigger) hide();
  }, { passive: true });

  return { hide, refresh, syncLabels };
}
