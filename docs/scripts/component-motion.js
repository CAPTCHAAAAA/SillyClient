(function () {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ===== Magnet effect DISABLED — buttons no longer follow mouse ===== */

  /* ===== TiltedCard (react-bits pattern) — runtime graph 3D tilt ===== */
  var tiltContainer = document.querySelector('.runtime-topology');
  if (tiltContainer) {
    var maxTilt = 3.5;
    var tiltRaf = null;

    tiltContainer.addEventListener('mousemove', function (e) {
      if (tiltRaf) return;
      var cx = e.clientX, cy = e.clientY;
      tiltRaf = requestAnimationFrame(function () {
        tiltRaf = null;
        var r = tiltContainer.getBoundingClientRect();
        var px = (cx - r.left) / r.width;
        var py = (cy - r.top) / r.height;
        var rotY = (px - 0.5) * 2 * maxTilt;
        var rotX = (0.5 - py) * 2 * maxTilt;
        tiltContainer.style.setProperty('--tilt-x', rotX.toFixed(2) + 'deg');
        tiltContainer.style.setProperty('--tilt-y', rotY.toFixed(2) + 'deg');
      });
    }, { passive: true });

    tiltContainer.addEventListener('mouseleave', function () {
      tiltContainer.style.setProperty('--tilt-x', '0deg');
      tiltContainer.style.setProperty('--tilt-y', '0deg');
    }, { passive: true });
  }
})();
