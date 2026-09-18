(() => {
  const copy = window.SC_SHOWCASE_COPY;
  const mobile = /\/mobile\.html$/.test(location.pathname);
  const section = document.getElementById(mobile ? 'source' : 'platform');
  if (!section || !copy) return;
  const mediaPath = './showcase-media/';
  const icon = name => `<svg aria-hidden="true"><use href="./landing-icons.svg#icon-${name}"></use></svg>`;
  const host = section.querySelector(mobile ? '[data-mobile-source-carousel]' : '[data-platform-carousel]');
  const oldViewport = section.querySelector(mobile ? '.mobile-source-viewport' : '.platform-carousel');
  const video = oldViewport.querySelector('[data-bilibili-stage]');
  const frame = video.querySelector('iframe');
  const additionalVideo = video.cloneNode(true);
  const additionalFrame = additionalVideo.querySelector('iframe');
  additionalFrame.removeAttribute('src');
  additionalFrame.removeAttribute('data-i18n-title');
  additionalFrame.removeAttribute('data-mobile-i18n-title');
  const videos = [
    { stage: video, frame, source: frame.dataset.bilibiliPlayer },
    {
      stage: additionalVideo,
      frame: additionalFrame,
      source: 'https://player.bilibili.com/player.html?bvid=BV1tfe16FEwN&page=1&autoplay=0'
    }
  ];
  const videoCount = videos.length;
  const items = [...videos.map(() => null), ...copy.zh.slides];
  // The accordion owns the video lifecycle so a collapsed player cannot keep playing.
  videos.forEach(player => player.frame.removeAttribute('data-bilibili-player'));
  host.removeAttribute(mobile ? 'data-mobile-source-carousel' : 'data-platform-carousel');
  section.classList.add('sc-product-showcase');
  const galleryRoot = document.createElement('div');
  galleryRoot.className = 'accordion-gallery sc-media-accordion';
  galleryRoot.setAttribute('role', 'group');
  galleryRoot.innerHTML = items.map((slide, index) => `
    <article class="ag-panel${index < videoCount ? ' ag-panel--video' : ''}${index === 0 ? ' is-active' : ''}" data-feature="${index}">
      <div class="ag-media" id="sc-media-${index}">
        ${slide ? `<img src="${mediaPath}${slide.id}.webp" width="1600" height="1600" alt="" decoding="async" draggable="false">` : ''}
      </div>
      <span class="ag-dim" aria-hidden="true"></span>
      <span class="ag-collapsed" aria-hidden="true"><span>${String(index + 1).padStart(2, '0')}</span><span data-collapsed-label="${index}"></span></span>
      <span class="ag-caption" aria-hidden="true"><span class="ag-caption-bar"></span><span class="ag-caption-text" data-feature-label="${index}"></span></span>
      <button type="button" class="ag-toggle" aria-expanded="${index === 0}" aria-controls="sc-media-${index}" tabindex="${index === 0 ? 0 : -1}"></button>
    </article>`).join('');
  videos.forEach((player, index) => {
    galleryRoot.querySelector(`[data-feature="${index}"] .ag-media`).append(player.stage);
  });
  oldViewport.replaceWith(galleryRoot);
  const previous = section.querySelector(mobile ? '[data-mobile-source-previous]' : '[data-platform-previous]');
  const next = section.querySelector(mobile ? '[data-mobile-source-next]' : '[data-platform-next]');
  const counter = section.querySelector(mobile ? '[data-mobile-source-current]' : '[data-platform-current]');
  const stageLabels = lang => [
    copy[lang].stageLabels[0], copy[lang].additionalVideoLabel,
    ...copy[lang].slides.map(slide => slide.tab)
  ];
  const totalLabel = ` / ${String(items.length).padStart(2, '0')}`;
  if (mobile) {
    counter.parentElement.replaceChildren(counter, document.createTextNode(totalLabel));
  } else {
    counter.nextElementSibling.textContent = totalLabel;
    const type = section.querySelector('[data-text-type-follow-carousel]');
    type.dataset.textTypeZh = JSON.stringify(stageLabels('zh'));
    type.dataset.textTypeEn = JSON.stringify(stageLabels('en'));
  }
  const enlarge = document.createElement('button');
  enlarge.type = 'button';
  enlarge.className = 'sc-gallery-icon';
  enlarge.setAttribute('data-open-image', '');
  enlarge.hidden = true;
  enlarge.innerHTML = icon('external');
  previous.before(enlarge);

  const dialog = document.createElement('dialog');
  dialog.className = 'sc-gallery-dialog';
  dialog.setAttribute('aria-labelledby', 'sc-gallery-lightbox-title');
  dialog.innerHTML = `
    <div class="sc-gallery-dialog-heading">
      <span id="sc-gallery-lightbox-title"></span>
      <button type="button" class="sc-gallery-icon" data-close-dialog>${icon('close')}</button>
    </div>
    <img class="sc-gallery-original" width="1600" height="1600" alt="">
    <div class="sc-gallery-dialog-bottom">
      <span data-lightbox-count></span>
      <div>
        <button type="button" class="sc-gallery-icon" data-gallery-previous>${icon('caret-left')}</button>
        <button type="button" class="sc-gallery-icon" data-gallery-next>${icon('caret-right')}</button>
      </div>
    </div>`;
  document.body.append(dialog);
  const notice = document.createElement('p');
  notice.className = 'sc-demo-model-notice';
  notice.dataset.showcaseText = 'modelNotice';
  document.querySelector(mobile ? '.mobile-primary-action' : '.hero-actions')?.after(notice);
  document.querySelector(mobile ? '.mobile-specs' : '.hero-specs')?.remove();
  let language = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
  let current = 0;
  let returnFocus;
  let sectionVisible = false;
  const panels = [...galleryRoot.querySelectorAll('.ag-panel')];
  videos.forEach(player => {
    player.frame.addEventListener('load', () => {
      if (player.frame.getAttribute('src') === player.source) player.stage.classList.add('is-loaded');
    });
  });

  function updateVideos() {
    videos.forEach((player, index) => {
      if (current === index && sectionVisible) {
        if (!player.frame.hasAttribute('src')) player.frame.src = player.source;
      } else if (player.frame.hasAttribute('src')) {
        player.frame.removeAttribute('src');
        player.stage.classList.remove('is-loaded');
      }
    });
  }

  function updateSelection() {
    const slideIndex = current - videoCount;
    const slide = copy[language].slides[slideIndex];
    counter.textContent = String(current + 1).padStart(2, '0');
    previous.disabled = current === 0;
    next.disabled = current === panels.length - 1;
    enlarge.hidden = !slide;
    if (mobile) section.querySelector('[data-mobile-source-type]').textContent = stageLabels(language)[current];
    window.dispatchEvent(new CustomEvent('platform-slide-change', { detail: { index: current } }));
    updateVideos();
    if (dialog.open && slide) {
      const image = dialog.querySelector('img');
      const path = `${mediaPath}${slide.id}.webp`;
      if (image.getAttribute('src') !== path) image.src = path;
      image.alt = slide.alt;
      dialog.querySelector('#sc-gallery-lightbox-title').textContent = slide.tab;
      dialog.querySelector('[data-lightbox-count]').textContent = `${String(slideIndex + 1).padStart(2, '0')} / ${String(copy[language].slides.length).padStart(2, '0')}`;
    }
    dialog.querySelector('[data-gallery-previous]').disabled = current <= videoCount;
    dialog.querySelector('[data-gallery-next]').disabled = current === panels.length - 1;
  }

  const gallery = new window.SCAccordionGallery(galleryRoot, {
    orientation: 'horizontal',
    defaultIndex: 0,
    expandRatio: mobile ? 0.62 : 0.52,
    aspectRatio: 1,
    tilt: mobile ? 0 : 8,
    onChange(index) {
      current = index;
      updateSelection();
    }
  });

  function updateLanguage() {
    language = document.documentElement.lang.startsWith('en') ? 'en' : 'zh';
    const text = copy[language];
    document.querySelectorAll('[data-showcase-text]').forEach(element => {
      element.textContent = text[element.dataset.showcaseText];
    });
    panels.forEach((panel, index) => {
      const slide = text.slides[index - videoCount];
      const label = stageLabels(language)[index];
      panel.querySelector('.ag-toggle').setAttribute('aria-label', label);
      panel.querySelector('.ag-toggle').title = slide ? `${slide.title} ${slide.body}`
        : index === 0 ? text.videoTitle : text.additionalVideoTitle;
      if (slide) panel.querySelector('img').alt = slide.alt;
      panel.querySelector('[data-feature-label]').textContent = label;
      panel.querySelector('[data-collapsed-label]').textContent = label;
    });
    additionalFrame.title = text.additionalVideoTitle;
    galleryRoot.setAttribute('aria-label', text.platformCarouselLabel);
    for (const [selector, label] of [
      ['[data-open-image]', text.enlarge],
      ['[data-gallery-previous]', text.previousImage],
      ['[data-gallery-next]', text.nextImage],
      ['[data-close-dialog]', text.close]
    ]) {
      for (const parent of [section, dialog]) {
        parent.querySelectorAll(selector).forEach(button => {
          button.setAttribute('aria-label', label);
          button.title = label;
        });
      }
    }
    updateSelection();
  }

  previous.addEventListener('click', () => gallery.select(current - 1));
  next.addEventListener('click', () => gallery.select(current + 1));
  enlarge.addEventListener('click', event => {
    returnFocus = event.currentTarget;
    dialog.showModal();
    updateSelection();
  });
  dialog.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-gallery-previous]').addEventListener('click', () => gallery.select(Math.max(videoCount, current - 1)));
  dialog.querySelector('[data-gallery-next]').addEventListener('click', () => gallery.select(current + 1));
  dialog.addEventListener('keydown', event => {
    event.stopPropagation();
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      gallery.select(event.key === 'Home' ? videoCount : event.key === 'End' ? panels.length - 1
        : Math.max(videoCount, current + (event.key === 'ArrowRight' ? 1 : -1)));
    }
  });
  dialog.addEventListener('click', event => {
    const bounds = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < bounds.left || event.clientX > bounds.right
      || event.clientY < bounds.top || event.clientY > bounds.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => returnFocus?.focus({ preventScroll: true }));
  window.addEventListener('wheel', event => {
    if (dialog.open) event.stopImmediatePropagation();
  }, { capture: true, passive: true });
  new MutationObserver(updateLanguage).observe(document.documentElement, {
    attributes: true, attributeFilter: ['lang']
  });
  updateLanguage();

  function activateSection() {
    sectionVisible = true;
    gallery.select(0);
    updateVideos();
  }
  function enterSection() {
    if (!sectionVisible) activateSection();
  }
  function leaveSection() {
    sectionVisible = false;
    updateVideos();
  }
  new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) leaveSection();
      else if (entry.intersectionRatio >= 0.35) enterSection();
    }
  }, { root: mobile ? null : document.getElementById('scroller'), threshold: [0, 0.35] }).observe(section);
  if (mobile) {
    initializeMobilePaging();
    let pageIndex = document.documentElement.dataset.mobilePage;
    new MutationObserver(() => {
      const nextIndex = document.documentElement.dataset.mobilePage;
      if (nextIndex === pageIndex) return;
      pageIndex = nextIndex;
      if (pageIndex === '2') activateSection();
      else leaveSection();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-mobile-page'] });
  } else {
    window.addEventListener('page-state-change', event => {
      if (event.detail.pageIndex === 2) activateSection();
      else leaveSection();
    });
  }

  function initializeMobilePaging() {
    const root = document.documentElement;
    const pages = [...document.querySelectorAll('.mobile-pages > .mobile-page')];
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const pageTurnDuration = 720;
    const experienceItems = [...pages[1].querySelectorAll('[data-mobile-device-state]')];
    const seenExperienceItems = new Set();
    let experienceLockedUntil = 0;
    let current = Math.max(0, pages.findIndex(page => page.classList.contains('is-active')));
    let animationFrame;
    let moving = false;
    let touch;
    let wheelLocked = false;
    let wheelDistance = 0;
    let wheelTimer;
    root.classList.add('sc-mobile-paged');

    function experienceIndex() {
      return Math.max(0, experienceItems.findIndex(item => item.classList.contains('is-active')));
    }

    function selectExperience(index) {
      // Reuse the existing accordion control to keep the image, copy and ARIA state together.
      experienceItems[index].querySelector('button').click();
    }

    pages[1].addEventListener('click', event => {
      if (current !== 1 || !event.target.closest('[data-mobile-device-state] button')) return;
      seenExperienceItems.add(experienceIndex());
      experienceLockedUntil = performance.now() + (reduced.matches ? 0 : 480);
    });

    function navigate(index, animate = true) {
      if (animate && (moving || performance.now() < experienceLockedUntil)) return;
      let next = Math.max(0, Math.min(pages.length - 1, index));
      if (animate && next > 1 && seenExperienceItems.size < experienceItems.length) {
        if (current === 1) {
          selectExperience(experienceItems.findIndex((item, index) => !seenExperienceItems.has(index)));
          return;
        }
        next = 1;
      }
      current = next;
      if (current === 1 && experienceItems.length) seenExperienceItems.add(experienceIndex());
      cancelAnimationFrame(animationFrame);
      const start = window.scrollY;
      const end = pages[current].getBoundingClientRect().top + start;
      const duration = animate && !reduced.matches && Math.abs(end - start) > 1 ? pageTurnDuration : 0;
      const started = performance.now();
      moving = duration > 0;
      pages.forEach((page, index) => { page.inert = index !== current; });
      function frame(now) {
        const progress = duration ? Math.min(1, (now - started) / duration) : 1;
        const eased = 1 - Math.pow(1 - progress, 3);
        window.scrollTo({ top: start + (end - start) * eased, behavior: 'instant' });
        // Keep the shared background on the desktop navigation event contract.
        const probe = window.scrollY + innerHeight * 0.48;
        let pageIndex = 0;
        pages.forEach((page, index) => {
          if (probe >= page.offsetTop) pageIndex = index;
        });
        if (window.__prevPageIndex !== pageIndex) {
          window.__prevPageIndex = pageIndex;
          window.dispatchEvent(new CustomEvent('page-state-change', {
            detail: { pageIndex }
          }));
        }
        if (progress < 1) animationFrame = requestAnimationFrame(frame);
        else {
          moving = false;
          if (root.classList.contains('mobile-ready')) root.dataset.mobilePage = String(current);
        }
      }
      frame(started);
    }

    function stepPage(direction) {
      if (moving || performance.now() < experienceLockedUntil) return;
      if (current === 1 && experienceItems.length) {
        const next = experienceIndex() + direction;
        if (next >= 0 && next < experienceItems.length) {
          selectExperience(next);
          return;
        }
      }
      navigate(current + direction);
    }

    function blocked(target) {
      return document.body.classList.contains('mobile-entry-locked')
        || !!document.querySelector('dialog[open]')
        || !!target?.closest('input, textarea, select, [contenteditable="true"], iframe, [role="slider"]');
    }

    function canScrollInside(target, direction) {
      for (let element = target; element && element !== document.body; element = element.parentElement) {
        if (!/auto|scroll/.test(getComputedStyle(element).overflowY)) continue;
        const remaining = element.scrollHeight - element.clientHeight;
        if (remaining > 1 && (direction > 0 ? element.scrollTop < remaining - 1 : element.scrollTop > 1)) return true;
      }
      return false;
    }

    window.addEventListener('wheel', event => {
      if (blocked(event.target) || event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelLocked = false; wheelDistance = 0; }, 180);
      if (!moving && canScrollInside(event.target, event.deltaY)) {
        wheelLocked = true;
        return;
      }
      event.preventDefault();
      if (moving || wheelLocked) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      wheelDistance += event.deltaY * unit;
      if (Math.abs(wheelDistance) < 36) return;
      wheelLocked = true;
      stepPage(Math.sign(wheelDistance));
    }, { passive: false });

    window.addEventListener('touchstart', event => {
      touch = event.touches.length === 1 && !blocked(event.target)
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY, target: event.target, handled: false, internal: false }
        : null;
    }, { passive: true });
    window.addEventListener('touchmove', event => {
      if (!touch || event.touches.length !== 1) { touch = null; return; }
      const dx = touch.x - event.touches[0].clientX;
      const dy = touch.y - event.touches[0].clientY;
      if (touch.internal || Math.abs(dy) <= Math.abs(dx)) return;
      if (!moving && !touch.handled && canScrollInside(touch.target, dy)) {
        touch.internal = true;
        return;
      }
      if (event.cancelable) event.preventDefault();
      if (moving || touch.handled || Math.abs(dy) < 48) return;
      touch.handled = true;
      stepPage(Math.sign(dy));
    }, { passive: false });
    window.addEventListener('touchend', () => { touch = null; }, { passive: true });
    window.addEventListener('touchcancel', () => { touch = null; }, { passive: true });

    document.addEventListener('click', event => {
      const button = event.target.closest('[data-mobile-target]');
      if (!button || blocked(button)) return;
      const index = pages.findIndex(page => page.id === button.dataset.mobileTarget);
      if (index < 0) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      navigate(index);
    }, true);
    window.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || blocked(event.target)
        || event.target.closest('button, a')) return;
      const directions = { ArrowDown: 1, PageDown: 1, ArrowUp: -1, PageUp: -1, ' ': event.shiftKey ? -1 : 1 };
      if (!(event.key in directions) && !['Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      if (event.key in directions) stepPage(directions[event.key]);
      else navigate(event.key === 'Home' ? 0 : pages.length - 1);
    });
    window.addEventListener('resize', () => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(() => navigate(current, false));
    });
    navigate(current, false);
    return navigate;
  }

  window.SC_PRODUCT_SHOWCASE = {
    select: (index, focus = false) => gallery.select(index, focus),
    get current() { return current; }
  };
})();
