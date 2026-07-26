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

export { clamp, hexToRgbFloat, lerp, themeToken };
