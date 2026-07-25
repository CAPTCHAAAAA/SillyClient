(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var selectors = '.lifecycle-list > div, .graph-platforms article, .repo-targets article, .repo-source, .repo-release, .graph-source, .graph-contract, .platform-action, .primary-action, .secondary-action';
  var pending = null;
  document.querySelectorAll(selectors).forEach(function (el) {
    el.addEventListener('mousemove', function (e) {
      var target = el;
      var cx = e.clientX, cy = e.clientY;
      if (pending) return;
      pending = requestAnimationFrame(function () {
        pending = null;
        var r = target.getBoundingClientRect();
        target.style.setProperty('--mx', ((cx - r.left) / r.width * 100) + '%');
        target.style.setProperty('--my', ((cy - r.top) / r.height * 100) + '%');
      });
    }, { passive: true });
  });
})();
