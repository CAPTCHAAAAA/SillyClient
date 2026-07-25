/* ====== Lenis smooth scroll + GSAP ScrollTrigger integration ====== */
(function () {
  if (typeof Lenis === 'undefined' || typeof gsap === 'undefined') return;
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduceMotion) return;

  gsap.registerPlugin(ScrollTrigger);
  document.documentElement.classList.add('gsap-ready');
  var scroller = document.getElementById('scroller');
  var designPx = function (value) {
    return value * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 1);
  };

  // Initialize Lenis on the custom scroller element
  var lenis = new Lenis({
    wrapper: scroller,
    content: scroller.querySelector('main'),
    lerp: 0.085,
    smoothWheel: false,
    syncTouch: false,
    wheelMultiplier: 1,
    touchMultiplier: 1.5,
    autoRaf: true,
  });

  // Sync Lenis scroll with ScrollTrigger
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);

  window.__lenis = lenis;

  var heroLede = document.querySelector('.hero-lede');
  if (heroLede) {
    gsap.fromTo(heroLede,
      { filter: 'blur(' + designPx(8) + 'px)', opacity: 0, y: designPx(16) },
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', delay: 0.35 }
    );
  }

  var heroSub = document.querySelector('.hero-sub');
  if (heroSub) {
    gsap.fromTo(heroSub,
      { filter: 'blur(' + designPx(6) + 'px)', opacity: 0, y: designPx(10) },
      { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', delay: 0.5 }
    );
  }

  var heroActions = document.querySelector('.hero-actions');
  if (heroActions) {
    gsap.fromTo(heroActions,
      { opacity: 0, y: designPx(8) },
      { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out', delay: 0.65 }
    );
  }

  var heroSpecs = document.querySelector('.hero-specs');
  if (heroSpecs) {
    gsap.fromTo(heroSpecs,
      { opacity: 0, y: designPx(8) },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.78 }
    );
  }

  var eyebrow = document.querySelector('.eyebrow');
  if (eyebrow) {
    gsap.fromTo(eyebrow,
      { opacity: 0, y: designPx(-6) },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.05 }
    );
  }

  /* ====== Section content reveal (scrub-driven, GSAP ScrollTrigger) ======
     Platform-section elements use earlier triggers and shorter durations
     so content appears promptly during the page 2→3 transition. */
  var revealElements = document.querySelectorAll('[data-reveal]');
  revealElements.forEach(function (el) {
    var isPlatform = !!el.closest('.platform-section');
    gsap.fromTo(el,
      { opacity: 0, y: designPx(isPlatform ? 24 : 40), filter: 'blur(' + designPx(isPlatform ? 4 : 6) + 'px)' },
      {
        opacity: 1, y: 0, filter: 'blur(0px)',
        duration: isPlatform ? 0.7 : 1, ease: 'power3.out',
        scrollTrigger: {
          trigger: el,
          scroller: scroller,
          start: isPlatform ? 'top 96%' : 'top 92%',
          end: isPlatform ? 'top 75%' : 'top 55%',
          toggleActions: 'play none none none',
        }
      }
    );
  });

  /* ====== Staggered child reveals ====== */
  var staggerGroups = document.querySelectorAll('[data-stagger]');
  staggerGroups.forEach(function (group) {
    var children = Array.prototype.slice.call(group.children);
    if (!children.length) return;
    gsap.set(children, { opacity: 0, y: designPx(24), filter: 'blur(' + designPx(4) + 'px)' });
    gsap.to(children, {
      opacity: 1, y: 0, filter: 'blur(0px)',
      duration: 0.8, ease: 'power3.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: group,
        scroller: scroller,
        start: 'top 82%',
        toggleActions: 'play none none none',
      }
    });
  });

  /* ====== Smooth scroll for nav clicks (Lenis-powered) ====== */
  document.querySelectorAll('[data-scroll-target]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var targetId = link.getAttribute('data-scroll-target');
      var target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      }
    });
  });

  window.addEventListener('load', function () {
    ScrollTrigger.refresh();
  });
})();
