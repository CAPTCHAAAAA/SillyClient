export function initializePageNavigation({ getMenuLabel }) {
  const pageScroller = document.getElementById('scroller');
  const topbar = document.getElementById('topbar');
  const journey = document.getElementById('journey');
  const menuButton = document.getElementById('menu-button');
  const navLinks = document.getElementById('nav-links');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll('[data-scroll-target]')];
  const navAnchors = [...document.querySelectorAll('.page-rail-dot')];
  const sections = [
    document.getElementById('journey'),
    document.getElementById('experience'),
    document.getElementById('platform')
  ];
  const panels = [
    document.getElementById('hero'),
    document.getElementById('experience'),
    document.getElementById('platform')
  ];

  let currentPageIndex = 0;
  let navigationLocked = false;
  let scrollFrame = 0;
  let pendingPageIndex = -1;
  let activePageIndex = -1;
  let activationTimer = 0;
  const pageTurnDuration = 720;

  function syncMenuLabel() {
    const open = navLinks.classList.contains('is-open');
    menuButton.setAttribute('aria-label', getMenuLabel(open));
  }

  function targetTop(target) {
    if (!target) return 0;
    if (target.id === 'experience') {
      const hero = document.getElementById('hero');
      return journey.offsetTop + (hero ? hero.offsetHeight : 0);
    }
    return pageScroller.scrollTop + target.getBoundingClientRect().top;
  }

  function schedulePageActivation(index, delay = 130) {
    if (activePageIndex === index && pendingPageIndex === index) return;

    if (pendingPageIndex !== index) {
      pendingPageIndex = index;
      panels.forEach((panel, panelIndex) => {
        panel.classList.remove('is-page-active', 'is-page-pending');
        if (panelIndex === index) panel.classList.add('is-page-pending');
      });
    }

    clearTimeout(activationTimer);
    activationTimer = window.setTimeout(() => {
      const panel = panels[pendingPageIndex];
      if (!panel) return;
      panel.classList.remove('is-page-pending');
      void panel.offsetWidth;
      panel.classList.add('is-page-active');
      activePageIndex = pendingPageIndex;
      window.dispatchEvent(new CustomEvent('page-activation', {
        detail: { pageIndex: activePageIndex }
      }));
    }, delay);
  }

  function updatePageState() {
    const scrollTop = pageScroller.scrollTop;
    const range = Math.max(1, journey.offsetHeight - pageScroller.clientHeight);
    const progress = Math.max(0, Math.min(1, (scrollTop - journey.offsetTop) / range));
    const experienceTop = targetTop(sections[1]);
    const platformTop = targetTop(sections[2]);
    const transitionDistance = Math.max(1, platformTop - experienceTop);
    const platformBlend = Math.max(0, Math.min(1,
      (scrollTop - experienceTop) / (transitionDistance * 0.6)
    ));

    document.documentElement.style.setProperty('--journey-progress', progress.toFixed(4));
    document.documentElement.style.setProperty('--platform-blend', platformBlend.toFixed(4));
    topbar.classList.toggle('is-compact', scrollTop > 30);

    const probe = scrollTop + pageScroller.clientHeight * 0.48;
    let activeIndex = 0;
    if (probe >= targetTop(sections[2])) activeIndex = 2;
    else if (progress > 0.48) activeIndex = 1;

    currentPageIndex = activeIndex;
    navAnchors.forEach((link, index) => {
      const active = index === activeIndex;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (!navigationLocked) schedulePageActivation(activeIndex);

    if (window.__prevPageIndex !== activeIndex) {
      window.__prevPageIndex = activeIndex;
      window.dispatchEvent(new CustomEvent('page-state-change', {
        detail: { pageIndex: activeIndex }
      }));
    }
  }

  function goToPage(index) {
    let nextIndex = Math.max(0, Math.min(panels.length - 1, index));
    const showcaseApi = window.SillyDeviceShowcase;

    if (nextIndex === 2 && showcaseApi && !showcaseApi.hasSeenAll()) {
      if (currentPageIndex === 1) {
        const firstUnseen = showcaseApi.firstUnseen();
        if (firstUnseen >= 0) showcaseApi.select(firstUnseen, 'navigation-gate');
      }
      nextIndex = 1;
    }

    const destination = targetTop(sections[nextIndex]);
    if (nextIndex === currentPageIndex && Math.abs(pageScroller.scrollTop - destination) < 2) return;

    navigationLocked = true;
    cancelAnimationFrame(scrollFrame);
    pageScroller.classList.add('is-page-turning');
    schedulePageActivation(nextIndex, reduceMotion.matches ? 0 : 60);

    if (nextIndex === 2 && !reduceMotion.matches) {
      const firstReveal = document.querySelector('.platform-section [data-reveal]');
      if (firstReveal && typeof gsap !== 'undefined') {
        gsap.to(firstReveal, {
          opacity: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.8,
          ease: 'power3.out',
          delay: 0.25,
          overwrite: 'auto'
        });
      }
    }

    if (reduceMotion.matches) {
      pageScroller.scrollTop = destination;
      pageScroller.classList.remove('is-page-turning');
      navigationLocked = false;
      updatePageState();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      return;
    }

    const startTop = pageScroller.scrollTop;
    const distance = destination - startTop;
    const startTime = performance.now();

    function turnFrame(now) {
      const progress = Math.min(1, (now - startTime) / pageTurnDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      pageScroller.scrollTop = startTop + distance * eased;
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();

      if (progress < 1) {
        scrollFrame = requestAnimationFrame(turnFrame);
        return;
      }

      pageScroller.scrollTop = destination;
      pageScroller.classList.remove('is-page-turning');
      navigationLocked = false;
      updatePageState();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
    }

    scrollFrame = requestAnimationFrame(turnFrame);
  }

  function navigateExperience(direction, source) {
    const showcaseApi = window.SillyDeviceShowcase;
    if (showcaseApi?.step(direction, source)) return;

    if (direction > 0 && showcaseApi && !showcaseApi.hasSeenAll()) {
      const firstUnseen = showcaseApi.firstUnseen();
      if (firstUnseen >= 0) {
        showcaseApi.select(firstUnseen, source);
        return;
      }
    }

    goToPage(direction > 0 ? 2 : 0);
  }

  window.SillyLandingNavigation = {
    goToPage,
    goToTarget(targetId) {
      const target = document.getElementById(targetId);
      const pageIndex = sections.indexOf(target);
      if (pageIndex >= 0) goToPage(pageIndex);
    }
  };

  targets.forEach(control => {
    control.addEventListener('click', event => {
      const target = document.getElementById(control.dataset.scrollTarget);
      if (!target) return;
      event.preventDefault();
      const pageIndex = sections.indexOf(target);
      if (pageIndex >= 0) goToPage(pageIndex);
      navLinks.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      syncMenuLabel();
    });
  });

  window.addEventListener('wheel', event => {
    if (Math.abs(event.deltaY) < 18) return;
    if (navigationLocked) {
      event.preventDefault();
      return;
    }
    const direction = event.deltaY > 0 ? 1 : -1;
    const platformTop = targetTop(sections[2]);

    if (currentPageIndex === 2) {
      if (direction < 0 && pageScroller.scrollTop <= platformTop + 3) {
        event.preventDefault();
        goToPage(1);
      }
      return;
    }

    if (currentPageIndex === 1) {
      event.preventDefault();
      navigateExperience(direction, 'wheel');
      return;
    }

    const nextIndex = Math.max(0, Math.min(panels.length - 1, currentPageIndex + direction));
    if (nextIndex === currentPageIndex) return;
    event.preventDefault();
    goToPage(nextIndex);
  }, { passive: false, capture: true });

  window.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (
      target.isContentEditable
      || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)
    )) return;
    if (target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;

    const platformTop = targetTop(sections[2]);
    const forwardKey = event.key === 'ArrowDown'
      || event.key === 'PageDown'
      || (event.key === ' ' && !event.shiftKey);
    const backwardKey = event.key === 'ArrowUp'
      || event.key === 'PageUp'
      || (event.key === ' ' && event.shiftKey);

    if (currentPageIndex === 1 && (forwardKey || backwardKey)) {
      event.preventDefault();
      if (!navigationLocked) navigateExperience(forwardKey ? 1 : -1, 'keyboard');
      return;
    }

    let nextIndex = currentPageIndex;
    if (forwardKey) {
      if (currentPageIndex < 2) nextIndex += 1;
    } else if (backwardKey) {
      if (currentPageIndex < 2 || pageScroller.scrollTop <= platformTop + 3) nextIndex -= 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = 2;
    } else {
      return;
    }

    nextIndex = Math.max(0, Math.min(panels.length - 1, nextIndex));
    if (nextIndex === currentPageIndex) return;
    event.preventDefault();
    if (!navigationLocked) goToPage(nextIndex);
  });

  menuButton.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    syncMenuLabel();
  });

  pageScroller.addEventListener('scroll', updatePageState, { passive: true });
  window.addEventListener('resize', updatePageState);
  updatePageState();

  return { goToPage, syncMenuLabel, updatePageState };
}
