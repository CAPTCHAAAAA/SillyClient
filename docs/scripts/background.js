/*!
 * background.js — Color Bends (WebGL) + Dot Field (Canvas 2D)
 *
 * Faithful vanilla-JS port of the React Bits background components.
 * Source: https://github.com/DavidHDev/react-bits
 *   src/content/Backgrounds/ColorBends/ColorBends.jsx
 *   src/content/Backgrounds/DotField/DotField.jsx
 *
 * Both canvases are position:fixed, z-index:0, pointer-events:none and sit
 * behind all page content.  They are inserted at the very beginning of <body>.
 *
 * If the user has prefers-reduced-motion the script does nothing.
 */
(function () {
  'use strict';

  /* ======================================================================= *
   *  Shared utilities
   * ======================================================================= */

  function lerp(a, b, t) { return a + (b - a) * t; }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  function themeToken(name, fallback) {
    var value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return value || fallback;
  }

  /** '#0d1117' -> [0.051, 0.067, 0.090]  (normalised 0-1 floats for WebGL) */
  function hexToRgbFloat(hex) {
    return [
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255
    ];
  }

  /* ======================================================================= *
   *  1. Color Bends  —  native WebGL shader background
   *     Source defaults: bandWidth=6, intensity=1.5, colors=[], autoRotate=0
   *     Homepage demo override: autoRotate=4
   *     NO fadeTop in source — removed.
   *     premultipliedAlpha: source uses true — we match exactly:
   *     blendFunc(ONE, ONE_MINUS_SRC_ALPHA) + vec4(col*a, a) output.
   * ======================================================================= */

  function initColorBends() {
    if (document.getElementById('rb-color-bends')) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'rb-color-bends';
    canvas.setAttribute('aria-hidden', 'true');
    /* Keep enough neutral shadow for contrast while allowing the product
       palette to remain visible between shader folds. */
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:0;pointer-events:none;opacity:1;' +
      'background:radial-gradient(ellipse 112% 86% at 50% 38%,' +
        '#241018 0%,#15090f 42%,#080609 76%,#10080d 100%);';

    var gl = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false
      }) ||
      canvas.getContext('experimental-webgl', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false
      });

    if (!gl) {
      console.warn('[landing-reactbits] WebGL not supported — Color Bends disabled.');
      return;
    }

    /* ---- Vertex shader (matches source: vUv = uv) ---- */
    var VERT_SRC = [
      'attribute vec2 aPos;',
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = aPos * 0.5 + 0.5;',
      '  gl_Position = vec4(aPos, 0.0, 1.0);',
      '}'
    ].join('\n');

    /* ---- Fragment shader — based on ColorBends.jsx source + scanline + noise.
       Source: github.com/DavidHDev/react-bits ColorBends.jsx
       Additions: uScanlineFreq (horizontal scanline density), uNoiseIntensity
       (film-grain amount). Both are user-requested CRT/film aesthetics.
       NO sRGB transform — it darkens low-intensity bands and hides the silk glow.
       premultipliedAlpha: blendFunc(ONE, ONE_MINUS_SRC_ALPHA), output col*a. */
    var FRAG_SRC = [
      'precision highp float;',
      '#define MAX_COLORS 8',
      'uniform vec2 uCanvas;',
      'uniform float uTime;',
      'uniform float uSpeed;',
      'uniform vec2 uRot;',
      'uniform int uColorCount;',
      'uniform vec3 uColors[MAX_COLORS];',
      'uniform int uTransparent;',
      'uniform float uScale;',
      'uniform float uFrequency;',
      'uniform float uWarpStrength;',
      'uniform vec2 uPointer;',
      'uniform float uPointerActive;',
      'uniform float uMouseInfluence;',
      'uniform float uParallax;',
      'uniform float uNoise;',
      'uniform int uIterations;',
      'uniform float uIntensity;',
      'uniform float uBandWidth;',
      'uniform float uScanlineFreq;',
      'uniform float uNoiseIntensity;',
      'uniform vec2 uPageOffset;',
      'varying vec2 vUv;',
      'void main() {',
      '  float t = uTime * uSpeed;',
      '  vec2 screenP = vUv * 2.0 - 1.0;',
      '  vec2 p = screenP + uPageOffset;',
      '  p += uPointer * uParallax * 0.1 * uPointerActive;',
      '  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);',
      '  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);',
      '  q /= max(uScale, 0.0001);',
      '  q /= 0.5 + 0.2 * dot(q, q);',
      '  q += 0.2 * cos(t) - 7.56;',
      '  vec2 toward = (uPointer - rp);',
      '  q += toward * uMouseInfluence * 0.2 * uPointerActive;',
      '  for (int j = 0; j < 5; j++) {',
      '    if (j >= uIterations - 1) break;',
      '    vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));',
      '    q += (rr - q) * 0.15;',
      '  }',
      '  vec3 col = vec3(0.0);',
      '  float a = 1.0;',
      '  if (uColorCount > 0) {',
      '    vec2 s = q;',
      '    vec3 sumCol = vec3(0.0);',
      '    vec3 baseCol = vec3(0.0);',
      '    float cover = 0.0;',
      '    for (int i = 0; i < MAX_COLORS; ++i) {',
      '      if (i >= uColorCount) break;',
      '      s -= 0.01;',
      '      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));',
      '      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);',
      '      float kBelow = clamp(uWarpStrength, 0.0, 1.0);',
      '      float kMix = pow(kBelow, 0.3);',
      '      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);',
      '      vec2 disp = (r - s) * kBelow;',
      '      vec2 warped = s + disp * gain;',
      '      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);',
      '      float m = mix(m0, m1, kMix);',
      '      float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));',
      '      w = pow(w, 0.4);',
      '      sumCol += uColors[i] * w;',
      '      baseCol += uColors[i];',
      '      cover = max(cover, w);',
      '    }',
      '    baseCol /= float(uColorCount);',
      '    vec3 themeFlow = baseCol * 0.10 + sumCol / float(uColorCount) * 0.48;',
      '    float chromaMask = smoothstep(0.06, 0.70, cover);',
      '    col = vec3(0.024, 0.014, 0.021) + themeFlow * mix(0.52, 1.16, chromaMask);',
      '    float deepFold = 1.0 - smoothstep(0.025, 0.13, cover);',
      '    col *= 1.0 - deepFold * 0.42;',
      '    float silkHighlight = smoothstep(0.72, 0.98, cover);',
      '    col += vec3(0.94, 0.25, 0.43) * silkHighlight * 0.042;',
      '    float flowTime = uTime * uSpeed * 4.0;',
      '    vec2 hoverDelta = screenP - uPointer;',
      '    vec2 hoverShape = hoverDelta * vec2(0.82, 1.45);',
      '    float hoverField = exp(-dot(hoverShape, hoverShape) * 2.35) * uPointerActive;',
      '    float hoverWarp = sin((hoverDelta.x - hoverDelta.y) * 5.2 - flowTime * 0.72)',
      '      * hoverField * 0.2;',
      '    float bend = sin(rp.y * 2.45 + flowTime * 0.72) * 1.28',
      '      + sin(rp.x * 1.35 - flowTime * 0.38) * 0.46 + hoverWarp;',
      '    float primaryFold = sin(rp.x * 4.6 + rp.y * 0.9 + bend - flowTime * 1.15);',
      '    float crossFold = sin(rp.x * 2.1 - rp.y * 3.7 + flowTime * 0.62);',
      '    float cloth = clamp(primaryFold * 0.76 + crossFold * 0.24, -1.0, 1.0);',
      '    float broadLight = smoothstep(-0.82, 0.72, cloth);',
      '    col *= mix(0.70, 1.07, broadLight);',
      '    float ridge = pow(max(cloth, 0.0), 9.0);',
      '    float trench = pow(max(-cloth, 0.0), 12.0);',
      '    col += vec3(0.94, 0.22, 0.42) * ridge * 0.05;',
      '    col *= 1.0 - trench * 0.48;',
      '    float hoverSheen = hoverField * (0.38 + 0.62 * pow(max(cloth, 0.0), 3.0));',
      '    col *= 1.0 + hoverField * 0.065;',
      '    col += vec3(0.72, 0.30, 0.40) * hoverSheen * 0.04;',
      '    a = 1.0;',
      '  } else {',
      '    vec2 s = q;',
      '    for (int k = 0; k < 3; ++k) {',
      '      s -= 0.01;',
      '      vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));',
      '      float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);',
      '      float kBelow = clamp(uWarpStrength, 0.0, 1.0);',
      '      float kMix = pow(kBelow, 0.3);',
      '      float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);',
      '      vec2 disp = (r - s) * kBelow;',
      '      vec2 warped = s + disp * gain;',
      '      float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);',
      '      float m = mix(m0, m1, kMix);',
      '      col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));',
      '      col[k] = pow(col[k], 0.4);',
      '    }',
      '    a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;',
      '  }',
      '  col *= uIntensity;',
      '  /* Source noise (uNoise) - band-domain grain */',
      '  if (uNoise > 0.0001) {',
      '    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);',
      '    col += (n - 0.5) * uNoise;',
      '    col = clamp(col, 0.0, 1.0);',
      '  }',
      '  /* Scanline effect - subtle horizontal CRT lines.',
      '     uScanlineFreq: lines per screen height (0 = disabled).',
      '     Multiplicative modulation, gentle 6% dip. */',
      '  if (uScanlineFreq > 0.5) {',
      '    float scan = 0.94 + 0.06 * sin(vUv.y * uCanvas.y * uScanlineFreq * 0.01);',
      '    col *= scan;',
      '  }',
      '  /* Film-grain noise intensity - screen-space grain over final color.',
      '     uNoiseIntensity: 0..1 amount (0 = disabled). Adds analog warmth. */',
      '  if (uNoiseIntensity > 0.001) {',
      '    float g = fract(sin(dot(gl_FragCoord.xy + vec2(uTime * 60.0), vec2(12.9898, 78.233))) * 43758.5453123);',
      '    col += (g - 0.5) * uNoiseIntensity;',
      '    col = clamp(col, 0.0, 1.0);',
      '  }',
      '  /* Premultiplied alpha output - no sRGB (kept linear for visible glow). */',
      '  vec3 rgb = (uTransparent > 0) ? col * a : col;',
      '  gl_FragColor = vec4(rgb, a);',
      '}'
    ].join('\n');

    /* ---- Compile / link ---- */
    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(sh);
        gl.deleteShader(sh);
        throw new Error(log);
      }
      return sh;
    }

    var vs, fs, program;
    try {
      vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
    } catch (err) {
      console.error('[landing-reactbits] Color Bends shader error: ' + err.message);
      return;
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);

    /* ---- Fullscreen quad geometry (two triangles) ---- */
    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,   1, -1,  -1, 1,
      -1,  1,   1, -1,   1, 1
    ]), gl.STATIC_DRAW);

    gl.useProgram(program);
    var aPosLoc = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

    /* ---- Uniform locations ---- */
    var U = {};
    ['uCanvas', 'uTime', 'uSpeed', 'uRot', 'uColorCount', 'uTransparent',
     'uScale', 'uFrequency', 'uWarpStrength', 'uPointer', 'uPointerActive', 'uMouseInfluence',
     'uParallax', 'uNoise', 'uIterations', 'uIntensity', 'uBandWidth',
     'uScanlineFreq', 'uNoiseIntensity', 'uPageOffset'
    ].forEach(function (name) { U[name] = gl.getUniformLocation(program, name); });

    var U_COLORS = [];
    for (var ci = 0; ci < 8; ci++) {
      U_COLORS.push(gl.getUniformLocation(program, 'uColors[' + ci + ']'));
    }

    /* ---- Configuration — silk-like warm glow, very slow + scanline/noise ----
       Reverse-engineered from github.com/DavidHDev/react-bits source defaults,
       then tuned for a calm, silky, warm aesthetic matching phone-demo theme.
       IMPORTANT: warpStrength MUST stay <=1. Values >1 trigger gain>1 which
       inflates displacement, making m explode and w=exp(-bandWidth/exp(bw*m))
       collapse to 0 — rendering invisible. Silk feel comes from slow speed
       + low intensity + dual soft colors, not from warping.
       New user-requested effects:
         scanlineFreq=80 — subtle horizontal CRT scanlines
         noiseIntensity=0.04 — gentle film grain for analog warmth */
    var CFG = {
      rotation:       90,      // source default
      autoRotate:     0.5,     // CUSTOM: very slow drift
      speed:          0.095,   // CUSTOM: gentle temporal evolution with a little more visible drift
      scale:          1,       // source default
      frequency:      1,       // source default
      warpStrength:   1,       // source default — MUST NOT exceed 1 (breaks w calc)
      mouseInfluence: 0.4,     // CUSTOM: subtle
      parallax:       0.2,     // CUSTOM: subtle
      noise:          0.06,    // CUSTOM: minimal band-domain grain
      iterations:     1,       // source default
      intensity:      1.8,     // CUSTOM: moderate — normalized sumCol prevents whiteout
      bandWidth:      4,       // CUSTOM: lower bw widens bands, raises w values
      transparent:    true,    // source default
      scanlineFreq:   80,      // CUSTOM: CRT scanline density (lines/screen)
      noiseIntensity: 0.04,    // CUSTOM: film-grain amount (0..1)
      colors:         [
        themeToken('--product-wine', '#6a112e'),
        themeToken('--product-rose', '#a32848')
      ]
    };

    /* Dark ambient profile: neutral shadows dominate; product rose appears
       only along the broad folds. Motion is intentionally near-static. */
    Object.assign(CFG, {
      autoRotate: 0.035,
      speed: 0.018,
      scale: 1.12,
      frequency: 0.82,
      warpStrength: 0.78,
      mouseInfluence: 0.18,
      parallax: 0.065,
      noise: 0.012,
      iterations: 3,
      intensity: 1.28,
      bandWidth: 3.15,
      transparent: false,
      colors: [
        themeToken('--product-wine', '#6a112e'),
        themeToken('--product-wine-mid', '#8b1a3a'),
        themeToken('--product-rose', '#a32848'),
        themeToken('--product-rose-bright', '#e8365d'),
        themeToken('--product-highlight', '#ff5e85')
      ]
    });

    var colorFloats = CFG.colors.map(hexToRgbFloat);

    /* ---- Set static uniforms once ---- */
    gl.uniform1f(U.uSpeed,          CFG.speed);
    gl.uniform1f(U.uScale,          CFG.scale);
    gl.uniform1f(U.uFrequency,      CFG.frequency);
    gl.uniform1f(U.uWarpStrength,   CFG.warpStrength);
    gl.uniform1f(U.uMouseInfluence, CFG.mouseInfluence);
    gl.uniform1f(U.uParallax,       CFG.parallax);
    gl.uniform1f(U.uNoise,          CFG.noise);
    gl.uniform1i(U.uIterations,     CFG.iterations);
    gl.uniform1f(U.uIntensity,      CFG.intensity);
    gl.uniform1f(U.uBandWidth,      CFG.bandWidth);
    gl.uniform1f(U.uScanlineFreq,   CFG.scanlineFreq);
    gl.uniform1f(U.uNoiseIntensity, CFG.noiseIntensity);
    gl.uniform1i(U.uTransparent,    CFG.transparent ? 1 : 0);
    gl.uniform1i(U.uColorCount,     colorFloats.length);
    for (var k = 0; k < colorFloats.length; k++) {
      var c = colorFloats[k];
      gl.uniform3f(U_COLORS[k], c[0], c[1], c[2]);
    }

    /* ---- Pointer smoothing (source: pointerSmooth=8, lerp dt*8) ---- */
    var pointer = { x: 0, y: 0 };
    var target  = { x: 0, y: 0 };
    var pointerActive = 0;
    var targetPointerActive = 0;
    var pageOffset = { x: 0, y: 0 };
    var pageTarget = { x: 0, y: 0 };
    var PAGE_OFFSETS = [
      { x: 0.00, y: 0.00 },
      { x: -0.62, y: 0.30 },
      { x: 0.54, y: -0.42 }
    ];

    function setPageTarget(pageIndex) {
      var index = clamp(Number(pageIndex) || 0, 0, PAGE_OFFSETS.length - 1);
      pageTarget.x = PAGE_OFFSETS[index].x;
      pageTarget.y = PAGE_OFFSETS[index].y;
    }

    setPageTarget(typeof window.__prevPageIndex === 'number' ? window.__prevPageIndex : 0);
    window.addEventListener('page-state-change', function (event) {
      setPageTarget(event.detail && event.detail.pageIndex);
    });

    function setTarget(cx, cy) {
      target.x =  (cx / window.innerWidth)  * 2 - 1;
      target.y = -((cy / window.innerHeight) * 2 - 1);
      targetPointerActive = 1;
    }
    window.addEventListener('mousemove', function (e) { setTarget(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener('mouseout', function (e) {
      if (!e.relatedTarget) targetPointerActive = 0;
    }, { passive: true });
    window.addEventListener('blur', function () { targetPointerActive = 0; });
    window.addEventListener('touchmove', function (e) {
      if (e.touches.length) setTarget(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', function () { targetPointerActive = 0; }, { passive: true });

    /* ---- Resize handling ---- */
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = window.innerWidth;
      var h = window.innerHeight;
      canvas.width  = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width  = w + 'px';
      canvas.style.height = h + 'px';
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    /* ---- Blend for premultiplied alpha (source: premultipliedAlpha=true) ---- */
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    /* ---- Render loop (source: clock.getDelta / clock.elapsedTime) ---- */
    var lastTime = performance.now();
    var elapsed  = 0;
    var running  = true;

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      running = false;
    }, false);

    function render() {
      if (!running) return;

      var now = performance.now();
      var dt  = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;
      elapsed += dt;

      /* Source: cur.lerp(tgt, dt * 8) — reduced to dt * 3 for lazier, smoother follow */
      var smoothAmt = Math.min(1, dt * 2.4);
      pointer.x = lerp(pointer.x, target.x, smoothAmt);
      pointer.y = lerp(pointer.y, target.y, smoothAmt);
      pointerActive = lerp(pointerActive, targetPointerActive, Math.min(1, dt * 4.2));

      /* Page changes move the color field faster than its ambient drift. */
      var pageShift = 1 - Math.exp(-dt * 2.4);
      pageOffset.x = lerp(pageOffset.x, pageTarget.x, pageShift);
      pageOffset.y = lerp(pageOffset.y, pageTarget.y, pageShift);

      var angle = (CFG.rotation + CFG.autoRotate * elapsed) * Math.PI / 180;

      gl.uniform1f(U.uTime,    elapsed);
      gl.uniform2f(U.uRot,     Math.cos(angle), Math.sin(angle));
      gl.uniform2f(U.uCanvas,  canvas.width, canvas.height);
      gl.uniform2f(U.uPointer, pointer.x, pointer.y);
      gl.uniform1f(U.uPointerActive, pointerActive);
      gl.uniform2f(U.uPageOffset, pageOffset.x, pageOffset.y);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      requestAnimationFrame(render);
    }
    requestAnimationFrame(render);

    document.body.insertBefore(canvas, document.body.firstChild);
  }

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

  /* ======================================================================= *
   *  Init
   * ======================================================================= */

  function init() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!document.body) return;
    initColorBends();
    initDotField();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
