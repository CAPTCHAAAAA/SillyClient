(() => {
  // DOM adaptation of the user-supplied React Bits AccordionGallery.
  class AccordionGallery {
    constructor(root, options = {}) {
      this.root = root;
      this.options = {
        defaultIndex: 0, expandRatio: 0.52, orientation: 'horizontal', aspectRatio: 0,
        duration: 0.6, ease: 'power3.out', parallax: 0.5, tilt: 8,
        stagger: 0.06, trigger: 'hover', ...options
      };
      this.panels = [...root.querySelectorAll('.ag-panel')];
      this.controls = this.panels.map(panel => panel.querySelector('.ag-toggle'));
      this.active = Math.max(0, Math.min(this.panels.length - 1, this.options.defaultIndex));
      this.vertical = this.options.orientation === 'vertical';
      this.reduced = matchMedia('(prefers-reduced-motion: reduce)');
      this.pointer = matchMedia('(hover: hover) and (pointer: fine)');
      this.events = new AbortController();
      const listen = { signal: this.events.signal };
      root.classList.toggle('accordion-gallery--vertical', this.vertical);
      this.panels.forEach((panel, index) => {
        panel.addEventListener('pointerenter', event => {
          if (this.options.trigger === 'hover' && this.pointer.matches && event.pointerType !== 'touch') {
            this.select(index);
          }
        }, listen);
        panel.addEventListener('click', () => this.select(index), listen);
        this.controls[index].addEventListener('focus', () => this.select(index), listen);
        panel.addEventListener('keydown', event => {
          const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          const count = this.panels.length;
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1
            : (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + count) % count;
          this.select(next, true);
        }, listen);
      });
      this.reduced.addEventListener('change', () => this.applyLayout(false), listen);
      this.observer = new ResizeObserver(() => {
        cancelAnimationFrame(this.resizeFrame);
        this.resizeFrame = requestAnimationFrame(() => this.measure());
      });
      this.observer.observe(root);
      this.measure();
    }

    measure() {
      const { root, vertical, panels, options } = this;
      const width = root.clientWidth;
      if (!width) return;
      const styles = getComputedStyle(root);
      const gap = parseFloat(vertical ? styles.rowGap : styles.columnGap) || 0;
      const ratio = Math.max(0.2, Math.min(0.9, options.expandRatio));
      const fixedAspect = !vertical && options.aspectRatio > 0;
      const height = fixedAspect
        ? Math.max(1, width - gap * (panels.length - 1)) * ratio / options.aspectRatio
        : root.clientHeight;
      if (!height) return;
      if (fixedAspect) root.style.height = `${height}px`;
      const usable = Math.max(1, (vertical ? height : width) - gap * (panels.length - 1));
      this.mediaWidth = vertical ? width : usable * ratio;
      this.mediaHeight = vertical ? usable * ratio : height;
      root.style.setProperty('--ag-media-width', `${this.mediaWidth}px`);
      root.style.setProperty('--ag-media-height', `${this.mediaHeight}px`);
      this.applyLayout(false);
    }

    select(index, focus = false) {
      const next = Math.max(0, Math.min(this.panels.length - 1, index));
      if (next !== this.active) {
        this.active = next;
        this.applyLayout(true);
        this.options.onChange?.(next);
      }
      if (focus) this.controls[next].focus({ preventScroll: true });
    }

    applyLayout(animate) {
      const { panels, active, vertical, options } = this;
      const ratio = Math.max(0.2, Math.min(0.9, options.expandRatio));
      const grow = panels.length > 1 ? ratio * (panels.length - 1) / (1 - ratio) : 1;
      this.timeline?.kill();
      const duration = animate && !this.reduced.matches ? options.duration : 0;
      const timeline = window.gsap?.timeline();
      panels.forEach((panel, index) => {
        const selected = index === active;
        const media = panel.querySelector('.ag-media');
        const labels = [...panel.querySelectorAll('.ag-caption-bar, .ag-caption-text')];
        const rotation = selected || this.reduced.matches ? 0 : (index < active ? options.tilt : -options.tilt);
        const drift = Math.max(-1.5, Math.min(1.5, active - index));
        const shift = selected || this.reduced.matches ? 0
          : drift * options.parallax * (vertical ? this.mediaHeight : this.mediaWidth) * 0.06;
        panel.classList.toggle('is-active', selected);
        this.controls[index].setAttribute('aria-expanded', String(selected));
        this.controls[index].tabIndex = selected ? 0 : -1;
        const player = panel.querySelector('[data-bilibili-stage]');
        if (player) {
          player.inert = !selected;
          player.setAttribute('aria-hidden', String(!selected));
        }
        if (!timeline) {
          const transition = duration ? `${duration}s cubic-bezier(.215,.61,.355,1)` : '0s';
          panel.style.transition = `flex-grow ${transition}, transform ${transition}`;
          media.style.transition = `transform ${transition}, filter ${transition}`;
          panel.querySelector('.ag-dim').style.transition = `opacity ${transition}`;
          panel.style.flexGrow = selected ? grow : 1;
          panel.style.transform = vertical ? `rotateX(${-rotation}deg)` : `rotateY(${rotation}deg)`;
          panel.style.setProperty('--ag-dim', selected ? 0 : 0.35);
          media.style.transform = `translate(-50%, -50%) translate(${vertical ? 0 : shift}px, ${vertical ? shift : 0}px)`;
          media.style.setProperty('--ag-gray', selected ? 0 : 1);
          labels.forEach(label => {
            label.style.transition = `opacity ${transition}, transform ${transition}`;
            label.style.opacity = selected ? 1 : 0;
            label.style.transform = selected ? 'none' : 'translateX(-10px)';
          });
          return;
        }
        timeline.to(panel, {
          flexGrow: selected ? grow : 1,
          ...(vertical ? { rotateX: -rotation } : { rotateY: rotation }),
          '--ag-dim': selected ? 0 : 0.35,
          duration, ease: options.ease
        }, 0);
        timeline.to(media, {
          xPercent: -50, yPercent: -50,
          x: vertical ? 0 : shift, y: vertical ? shift : 0,
          '--ag-gray': selected ? 0 : 1,
          duration, ease: options.ease
        }, 0);
        timeline.to(labels, {
          opacity: selected ? 1 : 0, x: selected ? 0 : -10,
          duration: selected ? duration : duration * 0.6, ease: options.ease,
          stagger: selected && duration ? options.stagger : 0
        }, 0);
      });
      this.timeline = timeline;
    }

    destroy() {
      this.timeline?.kill();
      cancelAnimationFrame(this.resizeFrame);
      this.observer.disconnect();
      this.events.abort();
    }
  }
  window.SCAccordionGallery = AccordionGallery;
})();
