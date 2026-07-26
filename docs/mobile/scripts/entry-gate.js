export function initializeEntryGate() {
  const gate = document.querySelector('[data-mobile-entry-gate]');
  if (!gate) {
    document.body.classList.remove('mobile-entry-locked');
    return;
  }

  let dismissed = false;

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    gate.classList.add('is-leaving');
    gate.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('mobile-entry-locked');
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.setTimeout(() => gate.remove(), 440);
  }

  gate.addEventListener('click', dismiss, { once: true });
}
