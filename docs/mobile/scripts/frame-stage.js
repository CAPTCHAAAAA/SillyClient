const FRAME_LABELS = ['Android', 'Windows', 'Android · Windows'];
// These offsets follow the visible device composition in each rendered frame,
// rather than the transparent canvas bounds.
const FRAME_VISUAL_OFFSETS = ['-13.4%', '-7.9%', '-15.3%'];

export function setFrame(stage, index) {
  const nextIndex = Math.max(0, Math.min(2, Number(index) || 0));
  stage.dataset.mobileFrame = String(nextIndex);
  stage.style.setProperty('--mobile-frame-visual-shift-x', FRAME_VISUAL_OFFSETS[nextIndex]);
  stage.querySelectorAll('[data-mobile-frame-image]').forEach((image) => {
    const active = Number(image.dataset.mobileFrameImage) === nextIndex;
    image.classList.toggle('is-active', active);
    image.setAttribute('aria-hidden', String(!active));
  });
  const label = stage.querySelector('[data-mobile-frame-label]');
  const count = stage.querySelector('[data-mobile-frame-count]');
  if (label) label.textContent = FRAME_LABELS[nextIndex];
  if (count) count.textContent = `0${nextIndex + 1} / 03`;
}

export function initializeFrameStages() {
  document.querySelectorAll('[data-mobile-frame-stage]').forEach((stage) => {
    setFrame(stage, stage.dataset.mobileFrame || 0);
  });
}
