(() => {
  const desktopViewport = matchMedia('(min-aspect-ratio: 1 / 1)');

  function routeForViewport() {
    const params = new URLSearchParams(window.location.search);
    const mobilePage = /\/mobile\.html$/i.test(window.location.pathname);
    const forceDesktop = params.get('desktop') === '1' || params.has('productRender');
    const forceMobile = params.get('mobile') === '1';
    const useDesktop = forceDesktop || (!forceMobile && desktopViewport.matches);

    if (mobilePage) {
      if (!useDesktop) return;
      const target = new URL('./', window.location.href);
      target.search = window.location.search;
      target.hash = window.location.hash;
      target.searchParams.delete('mobile');
      window.location.replace(target.href);
      return;
    }

    if (useDesktop) return;

    const target = new URL('./mobile.html', window.location.href);
    target.search = window.location.search;
    target.hash = window.location.hash;
    target.searchParams.delete('desktop');
    window.location.replace(target.href);
  }

  routeForViewport();
  desktopViewport.addEventListener('change', routeForViewport);
})();
