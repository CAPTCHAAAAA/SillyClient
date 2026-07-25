(function () {
  'use strict';

  var carousel = document.querySelector('[data-platform-carousel]');
  if (!carousel) return;

  var viewport = carousel.querySelector('.platform-viewport');
  var track = carousel.querySelector('.platform-track');
  var slides = Array.from(carousel.querySelectorAll('[data-platform-slide]'));
  var previousButton = carousel.querySelector('[data-platform-previous]');
  var nextButton = carousel.querySelector('[data-platform-next]');
  var currentLabel = carousel.querySelector('[data-platform-current]');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var activeIndex = 0;
  var resizeFrame = 0;

  if (!viewport || !track || slides.length === 0 || !previousButton || !nextButton) return;

  function designUnit() {
    return parseFloat(getComputedStyle(document.documentElement).fontSize) || 1;
  }

  function updatePosition(animate) {
    var activeSlide = slides[activeIndex];
    if (!activeSlide) return;

    var maximumOffset = Math.max(0, track.scrollWidth - viewport.clientWidth);
    var centeredOffset = activeSlide.offsetLeft + activeSlide.offsetWidth / 2 - viewport.clientWidth / 2;
    var targetOffset = Math.max(0, Math.min(centeredOffset, maximumOffset));

    if (!animate || reducedMotion.matches) track.style.transition = 'none';
    carousel.style.setProperty('--platform-track-x', -targetOffset + 'px');

    if (!animate || reducedMotion.matches) {
      requestAnimationFrame(function () {
        track.style.removeProperty('transition');
      });
    }
  }

  function updateSlideWidth() {
    var unit = designUnit();
    var slideWidth = Math.max(318 * unit, Math.min(362 * unit, viewport.clientWidth * 0.34));
    var trackPadding = Math.max(18 * unit, (viewport.clientWidth - slideWidth) / 2);
    carousel.style.setProperty('--platform-slide-width', slideWidth + 'px');
    carousel.style.setProperty('--platform-track-padding', trackPadding + 'px');
    updatePosition(false);
  }

  function select(index, animate) {
    activeIndex = Math.max(0, Math.min(slides.length - 1, index));

    slides.forEach(function (slide, slideIndex) {
      var isActive = slideIndex === activeIndex;
      slide.classList.toggle('is-active', isActive);
      slide.setAttribute('aria-hidden', String(!isActive));
      slide.inert = !isActive;
    });

    previousButton.disabled = activeIndex === 0;
    nextButton.disabled = activeIndex === slides.length - 1;
    if (currentLabel) currentLabel.textContent = String(activeIndex + 1).padStart(2, '0');
    updatePosition(animate !== false);
    window.dispatchEvent(new CustomEvent('platform-slide-change', {
      detail: { index: activeIndex }
    }));
  }

  previousButton.addEventListener('click', function () {
    select(activeIndex - 1, true);
  });

  nextButton.addEventListener('click', function () {
    select(activeIndex + 1, true);
  });

  carousel.addEventListener('keydown', function (event) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    select(activeIndex + (event.key === 'ArrowRight' ? 1 : -1), true);
  });

  window.addEventListener('resize', function () {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(updateSlideWidth);
  }, { passive: true });

  updateSlideWidth();
  select(0, false);
})();
