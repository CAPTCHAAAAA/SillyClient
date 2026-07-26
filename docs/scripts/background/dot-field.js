import { clamp, hexToRgbFloat, lerp, themeToken } from './shared.js?v=20260726-background-modules-v1';

/* ======================================================================= *
   *  2. Dot Field  —  Canvas 2D interactive dot grid
   *     Faithful port of DotField.jsx:
   *     - step = dotRadius + dotSpacing
   *     - draw radius = dotRadius / 2
   *     - single linear gradient for all dots
   *     - engagement mechanism (mouse speed tracking)
   *     - squared falloff: push = (1-dist/cr)² * bulgeStrength * engagement
   *     - spring-back lerp 0.15 active, 0.1 idle
   *     - glow opacity follows engagement
   * ======================================================================= */

function initDotField() {
    if (document.getElementById('rb-dot-field')) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'rb-dot-field';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:1;pointer-events:none;opacity:0.38;';

    var ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      console.warn('[landing-reactbits] Canvas 2D not supported — Dot Field disabled.');
      return;
    }

    /* ---- Configuration — SOURCE DEFAULTS with phone-demo theme ----
       All structural parameters match DotField.jsx source defaults exactly.
       Gradient colors use phone-demo rose/mauve palette with boosted opacity
       for more visible dots. Warm off-white tones ensure dots read clearly
       against the #1a1625 warm purple-black background. */
    var CFG = {
      dotRadius:     2.6,     // 1.3px visible radius
      dotSpacing:    11.2,    // dense field with restrained per-dot contrast
      cursorRadius:  178,
      cursorForce:   0.1,     // SOURCE DEFAULT
      bulgeOnly:     true,    // SOURCE DEFAULT
      bulgeStrength: 18,
      glowRadius:    160,     // SOURCE DEFAULT
      sparkle:       false,   // SOURCE DEFAULT
      waveAmplitude: 0,       // SOURCE DEFAULT
      gradientFrom:  'rgba(234, 224, 229, 0.34)',
      gradientTo:    'rgba(222, 56, 96, 0.38)',
      glowColor:     '#120F17',  // SOURCE DEFAULT (dark glow — disabled below)
      glowEnabled:   false       // CUSTOM: dark glow creates blackening on warm bg
    };

    /* ---- State (mirrors source refs) ---- */
    var dots = [];
    var sizeRef = { w: 0, h: 0, offsetX: 0, offsetY: 0 };
    var mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0, active: false };
    var glowOpacity = 0;
    var engagement = 0;
    var frameCount = 0;

    var TWO_PI = Math.PI * 2;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    /* ---- Parse glow color for Canvas radial gradient ---- */
    function parseHex(hex) {
      var h = hex.replace('#', '');
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
      };
    }
    var glowCol = parseHex(CFG.glowColor);

    /* ---- Build dot grid (source: step = dotRadius + dotSpacing) ---- */
    function buildDots(w, h) {
      var step = CFG.dotRadius + CFG.dotSpacing;
      var cols = Math.floor(w / step);
      var rows = Math.floor(h / step);
      var padX = (w % step) / 2;
      var padY = (h % step) / 2;
      dots = new Array(rows * cols);
      var idx = 0;
      for (var row = 0; row < rows; row++) {
        for (var col = 0; col < cols; col++) {
          var ax = padX + col * step + step / 2;
          var ay = padY + row * step + step / 2;
          dots[idx++] = { ax: ax, ay: ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay };
        }
      }
    }

    /* ---- Resize (source: 100ms debounce) ---- */
    var resizeTimer = null;
    function resize() {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 100);
    }
    function doResize() {
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.w = w;
      sizeRef.h = h;
      sizeRef.offsetX = 0;
      sizeRef.offsetY = 0;
      buildDots(w, h);
    }

    /* ---- Mouse tracking (source: pageX - offsetX) ---- */
    function onMouseMove(e) {
      mouse.x = e.clientX - sizeRef.offsetX;
      mouse.y = e.clientY - sizeRef.offsetY;
      mouse.active = true;
    }
    function onTouchMove(e) {
      if (e.touches.length) {
        mouse.x = e.touches[0].clientX - sizeRef.offsetX;
        mouse.y = e.touches[0].clientY - sizeRef.offsetY;
        mouse.active = true;
      }
    }

    /* ---- Mouse speed sampling (source: setInterval 20ms) ---- */
    function updateMouseSpeed() {
      var dx = mouse.prevX - mouse.x;
      var dy = mouse.prevY - mouse.y;
      var dist = Math.sqrt(dx * dx + dy * dy);
      mouse.speed += (dist - mouse.speed) * 0.12;
      if (mouse.speed < 0.001) mouse.speed = 0;
      mouse.prevX = mouse.x;
      mouse.prevY = mouse.y;
    }
    var speedInterval = setInterval(updateMouseSpeed, 32);

    /* ---- Render loop (source: tick()) ---- */
    function tick() {
      frameCount++;
      var w = sizeRef.w, h = sizeRef.h;
      var cr = CFG.cursorRadius;
      var crSq = cr * cr;
      var rad = CFG.dotRadius / 2;  /* SOURCE: draw radius = dotRadius / 2 */
      var isBulge = CFG.bulgeOnly;
      var t = frameCount * 0.02;

      /* Engagement (source: targetEngagement = min(speed/5, 1)) */
      var targetEng = mouse.active ? Math.min(0.36 + mouse.speed / 12, 1) : 0;
      engagement += (targetEng - engagement) * 0.1;
      if (engagement < 0.001) engagement = 0;
      var eng = engagement;

      /* Glow opacity (source: follows engagement, 0.08 smooth) */
      glowOpacity += (eng * 0.18 - glowOpacity) * 0.08;

      ctx.clearRect(0, 0, w, h);

      /* SOURCE: single linear gradient for all dots */
      var grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, CFG.gradientFrom);
      grad.addColorStop(1, CFG.gradientTo);
      ctx.fillStyle = grad;

      ctx.beginPath();
      for (var i = 0, len = dots.length; i < len; i++) {
        var d = dots[i];
        var dx = mouse.x - d.ax;
        var dy = mouse.y - d.ay;
        var distSq = dx * dx + dy * dy;

        if (distSq < crSq && eng > 0.01) {
          var dist = Math.sqrt(distSq);
          if (isBulge) {
            /* SOURCE: push = (1-dist/cr)² * bulgeStrength * engagement */
            var tt = 1 - dist / cr;
            var push = tt * tt * CFG.bulgeStrength * eng;
            var angle = Math.atan2(dy, dx);
            d.sx += (d.ax - Math.cos(angle) * push - d.sx) * 0.12;
            d.sy += (d.ay - Math.sin(angle) * push - d.sy) * 0.12;
          } else {
            var angle2 = Math.atan2(dy, dx);
            var move = (500 / dist) * (mouse.speed * CFG.cursorForce);
            d.vx += Math.cos(angle2) * -move;
            d.vy += Math.sin(angle2) * -move;
          }
        } else if (isBulge) {
          /* SOURCE: spring back lerp 0.1 */
          d.sx += (d.ax - d.sx) * 0.08;
          d.sy += (d.ay - d.sy) * 0.08;
        }

        if (!isBulge) {
          d.vx *= 0.9;
          d.vy *= 0.9;
          d.x = d.ax + d.vx;
          d.y = d.ay + d.vy;
          d.sx += (d.x - d.sx) * 0.1;
          d.sy += (d.y - d.sy) * 0.1;
        }

        var drawX = d.sx;
        var drawY = d.sy;

        /* SOURCE: waveAmplitude displacement */
        if (CFG.waveAmplitude > 0) {
          drawY += Math.sin(d.ax * 0.03 + t) * CFG.waveAmplitude;
          drawX += Math.cos(d.ay * 0.03 + t * 0.7) * CFG.waveAmplitude * 0.5;
        }

        /* SOURCE: sparkle (3% of dots randomly larger) */
        if (CFG.sparkle) {
          var hash = ((i * 2654435761) ^ (frameCount >> 3)) >>> 0;
          if ((hash % 100) < 3) {
            ctx.moveTo(drawX + rad * 1.8, drawY);
            ctx.arc(drawX, drawY, rad * 1.8, 0, TWO_PI);
          } else {
            ctx.moveTo(drawX + rad, drawY);
            ctx.arc(drawX, drawY, rad, 0, TWO_PI);
          }
        } else {
          ctx.moveTo(drawX + rad, drawY);
          ctx.arc(drawX, drawY, rad, 0, TWO_PI);
        }
      }
      ctx.fill();

      /* Glow (source: SVG circle with radialGradient, opacity follows engagement)
         DISABLED: source default glowColor '#120F17' is dark and creates a visible
         black spot on our page where Color Bends provides a light background.
         The bulge interaction alone provides sufficient cursor feedback. */
      if (CFG.glowEnabled && glowOpacity > 0.01) {
        var glowGrad = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, CFG.glowRadius);
        glowGrad.addColorStop(0, 'rgba(' + glowCol.r + ',' + glowCol.g + ',' + glowCol.b + ',' + glowOpacity + ')');
        glowGrad.addColorStop(1, 'rgba(' + glowCol.r + ',' + glowCol.g + ',' + glowCol.b + ',0)');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, CFG.glowRadius, 0, TWO_PI);
        ctx.fill();
      }

      requestAnimationFrame(tick);
    }

    /* ---- Init ---- */
    doResize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseout', function (event) {
      if (!event.relatedTarget) mouse.active = false;
    }, { passive: true });
    window.addEventListener('blur', function () { mouse.active = false; });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', function () { mouse.active = false; }, { passive: true });
    requestAnimationFrame(tick);

    /* ---- Insert after Color Bends canvas ---- */
    var prev = document.getElementById('rb-color-bends');
    if (prev) {
      document.body.insertBefore(canvas, prev.nextSibling);
    } else {
      document.body.insertBefore(canvas, document.body.firstChild);
    }
  }

export { initDotField };
