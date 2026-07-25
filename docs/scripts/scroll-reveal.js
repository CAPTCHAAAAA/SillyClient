(function () {
  const elements = () => [...document.querySelectorAll('[data-scroll-reveal]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const canAnimate = () => typeof gsap !== 'undefined' && !reducedMotion.matches;
  let currentPage = 0;

  function pageIndexFor(element) {
    if (element.closest('.platform-section')) return 2;
    if (element.closest('.experience-panel')) return 1;
    return 0;
  }

  function splitText(text) {
    if (/\p{Script=Han}/u.test(text) && typeof Intl.Segmenter === 'function') {
      const segmenter = new Intl.Segmenter(document.documentElement.lang, { granularity: 'word' });
      return [...segmenter.segment(text)].map(({ segment }) => segment);
    }
    return text.split(/(\s+)/);
  }

  function prepare(element) {
    const text = element.textContent.trim();
    if (!text) return [];

    element.replaceChildren();
    element.classList.add('scroll-reveal');
    element.setAttribute('aria-label', text);

    const fragment = document.createDocumentFragment();
    splitText(text).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        fragment.appendChild(document.createTextNode(part));
        return;
      }
      const word = document.createElement('span');
      word.className = 'scroll-reveal-word';
      word.setAttribute('aria-hidden', 'true');
      word.textContent = part;
      fragment.appendChild(word);
    });
    element.appendChild(fragment);
    return [...element.querySelectorAll('.scroll-reveal-word')];
  }

  function optionsFor(element) {
    return {
      opacity: Number(element.dataset.scrollRevealOpacity ?? 0.1),
      rotation: Number(element.dataset.scrollRevealRotation ?? 3),
      blur: Number(element.dataset.scrollRevealBlur ?? 4)
    };
  }

  function setInitial(element) {
    const words = [...element.querySelectorAll('.scroll-reveal-word')];
    const options = optionsFor(element);
    if (!canAnimate()) {
      element.style.removeProperty('transform');
      words.forEach((word) => {
        word.style.opacity = '1';
        word.style.filter = 'none';
      });
      return;
    }
    gsap.killTweensOf([element, ...words]);
    gsap.set(element, { rotate: options.rotation, transformOrigin: '0% 50%' });
    gsap.set(words, {
      opacity: options.opacity,
      filter: `blur(${options.blur}px)`,
      willChange: 'opacity, filter'
    });
  }

  function setFinal(element) {
    const words = [...element.querySelectorAll('.scroll-reveal-word')];
    if (typeof gsap !== 'undefined') {
      gsap.killTweensOf([element, ...words]);
      gsap.set(element, { rotate: 0 });
      gsap.set(words, { opacity: 1, filter: 'blur(0px)', clearProps: 'willChange' });
      return;
    }
    element.style.transform = 'none';
    words.forEach((word) => {
      word.style.opacity = '1';
      word.style.filter = 'none';
    });
  }

  function revealPage(pageIndex) {
    currentPage = pageIndex;
    const targets = elements().filter((element) => pageIndexFor(element) === pageIndex);
    if (!canAnimate()) {
      targets.forEach(setFinal);
      return;
    }

    targets.forEach((element, index) => {
      setInitial(element);
      const words = [...element.querySelectorAll('.scroll-reveal-word')];
      const timeline = gsap.timeline({ delay: index * 0.1 });
      timeline.to(element, {
        rotate: 0,
        duration: 0.82,
        ease: 'power3.out'
      }, 0);
      timeline.to(words, {
        opacity: 1,
        filter: 'blur(0px)',
        duration: 0.72,
        stagger: 0.045,
        ease: 'power2.out',
        onComplete: () => gsap.set(words, { clearProps: 'willChange' })
      }, 0.04);
    });
  }

  function refresh() {
    elements().forEach((element) => {
      prepare(element);
      if (pageIndexFor(element) === currentPage) setFinal(element);
      else setInitial(element);
    });
    if (window.SillyVariableProximity) window.SillyVariableProximity.refresh();
  }

  window.SillyScrollReveal = { refresh, revealPage };
  window.addEventListener('page-activation', (event) => {
    revealPage(Number(event.detail?.pageIndex) || 0);
  });
  reducedMotion.addEventListener('change', refresh);
  refresh();
})();
