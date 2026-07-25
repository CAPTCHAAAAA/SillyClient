(function () {
  'use strict';

  var elements = Array.from(document.querySelectorAll('[data-text-type]'));
  if (!elements.length) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var states = new Map();

  function numberValue(value, fallback) {
    var parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function languageKey() {
    return document.documentElement.lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  }

  function sentencesFor(element) {
    var raw = languageKey() === 'zh'
      ? element.dataset.textTypeZh
      : element.dataset.textTypeEn;
    try {
      var parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) && parsed.length ? parsed.map(String) : [''];
    } catch {
      return [''];
    }
  }

  function stopCursor(state) {
    if (state.cursorTween) {
      state.cursorTween.kill();
      state.cursorTween = null;
    }
    if (state.cursor) state.cursor.style.opacity = '1';
  }

  function startCursor(state) {
    stopCursor(state);
    if (reducedMotion.matches || !state.cursor || !window.gsap) return;
    state.cursorTween = window.gsap.to(state.cursor, {
      opacity: 0,
      duration: 0.5,
      repeat: -1,
      yoyo: true,
      ease: 'power2.inOut'
    });
  }

  function clearTimer(state) {
    if (!state.timer) return;
    window.clearTimeout(state.timer);
    state.timer = 0;
  }

  function render(state) {
    var sentence = state.sentences[state.sentenceIndex] || '';
    var characters = Array.from(sentence);
    state.content.textContent = characters.slice(0, state.characterIndex).join('');
  }

  function schedule(state, delay) {
    clearTimer(state);
    if (!state.visible || reducedMotion.matches || document.hidden) return;
    state.timer = window.setTimeout(function () { tick(state); }, delay);
  }

  function tick(state) {
    var sentence = state.sentences[state.sentenceIndex] || '';
    var length = Array.from(sentence).length;

    if (state.deleting) {
      if (state.characterIndex > 0) {
        state.characterIndex -= 1;
        render(state);
        schedule(state, state.deletingSpeed);
        return;
      }

      state.deleting = false;
      state.sentenceIndex = (state.sentenceIndex + 1) % state.sentences.length;
      schedule(state, 180);
      return;
    }

    if (state.characterIndex < length) {
      state.characterIndex += 1;
      render(state);
      schedule(state, state.typingSpeed);
      return;
    }

    if (state.followCarousel) return;
    state.deleting = true;
    schedule(state, state.pauseDuration);
  }

  function reset(state) {
    clearTimer(state);
    state.sentences = sentencesFor(state.element);
    state.sentenceIndex = state.followCarousel
      ? Math.min(state.carouselIndex, state.sentences.length - 1)
      : 0;
    state.characterIndex = reducedMotion.matches
      ? Array.from(state.sentences[state.sentenceIndex] || '').length
      : 0;
    state.deleting = false;
    render(state);
    startCursor(state);
    if (!reducedMotion.matches) schedule(state, state.initialDelay);
  }

  elements.forEach(function (element) {
    var content = element.querySelector('.text-type__content');
    var cursor = element.querySelector('.text-type__cursor');
    if (!content) return;

    var state = {
      element: element,
      content: content,
      cursor: cursor,
      cursorTween: null,
      timer: 0,
      visible: false,
      sentences: [],
      sentenceIndex: 0,
      characterIndex: 0,
      deleting: false,
      followCarousel: element.hasAttribute('data-text-type-follow-carousel'),
      carouselIndex: 0,
      typingSpeed: numberValue(element.dataset.textTypeSpeed, 50),
      deletingSpeed: numberValue(element.dataset.textTypeDeleteSpeed, 30),
      pauseDuration: numberValue(element.dataset.textTypePause, 2000),
      initialDelay: numberValue(element.dataset.textTypeInitialDelay, 0)
    };
    states.set(element, state);
    reset(state);
  });

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var state = states.get(entry.target);
      if (!state) return;
      state.visible = entry.isIntersecting;
      if (state.visible) schedule(state, state.characterIndex ? 120 : state.initialDelay);
      else clearTimer(state);
    });
  }, { threshold: 0.18 });

  states.forEach(function (state) { observer.observe(state.element); });

  window.addEventListener('platform-slide-change', function (event) {
    states.forEach(function (state) {
      if (!state.followCarousel) return;
      state.carouselIndex = Math.max(0, Number(event.detail && event.detail.index) || 0);
      reset(state);
    });
  });

  window.addEventListener('sillyclient-language-change', function () {
    states.forEach(reset);
  });

  document.addEventListener('visibilitychange', function () {
    states.forEach(function (state) {
      if (document.hidden) clearTimer(state);
      else if (state.visible) schedule(state, 120);
    });
  });

  reducedMotion.addEventListener('change', function () {
    states.forEach(reset);
  });
})();
