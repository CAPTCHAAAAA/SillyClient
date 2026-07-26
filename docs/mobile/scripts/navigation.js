export function initializeNavigation() {
  const pages = [...document.querySelectorAll('[data-mobile-page]')];
  const railButtons = [...document.querySelectorAll('.mobile-page-rail [data-mobile-target]')];
  const targetButtons = [...document.querySelectorAll('[data-mobile-target]')];

  targetButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      const target = document.getElementById(button.dataset.mobileTarget);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add('is-visible');
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.mobile-reveal').forEach((element) => revealObserver.observe(element));

  const pageObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    const pageIndex = Number(visible.target.dataset.mobilePage);
    document.documentElement.dataset.mobilePage = String(pageIndex);
    pages.forEach((page, index) => page.classList.toggle('is-active', index === pageIndex));
    railButtons.forEach((button, index) => {
      const active = index === pageIndex;
      button.classList.toggle('is-active', active);
      if (active) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    });
  }, { threshold: [0.35, 0.55, 0.75] });
  pages.forEach((page) => pageObserver.observe(page));
}
