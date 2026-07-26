export const PRODUCT_SCREEN_PRESETS = Object.freeze({
  phone: Object.freeze({
    width: 390,
    height: 844,
    scale: 0.8,
    safeTop: 52,
    textureUrl: './product-render/screens/phone.jpg?v=20260726-html-screen-v1'
  }),
  laptop: Object.freeze({
    width: 1440,
    height: 932,
    scale: 0.75,
    safeTop: 0,
    textureUrl: './product-render/screens/laptop.jpg?v=20260726-html-screen-v1'
  })
});

export const PRODUCT_FRAME_LIMITS = Object.freeze({
  state: Object.freeze({ minimum: 0, maximum: 2, fallback: 0 }),
  width: Object.freeze({ minimum: 640, maximum: 4096, fallback: 1600 }),
  height: Object.freeze({ minimum: 360, maximum: 2304, fallback: 900 }),
  quality: Object.freeze({ minimum: 0.5, maximum: 1, fallback: 0.9 })
});

export function clampProductValue(value, { minimum, maximum, fallback }) {
  const numeric = Number(value);
  return Math.min(maximum, Math.max(minimum, Number.isFinite(numeric) ? numeric : fallback));
}
