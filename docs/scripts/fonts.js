/* The title font list is isolated so visual choices stay out of page behavior. */
(function registerLandingFonts(global) {
  'use strict';

  global.SillyLanding = global.SillyLanding || {};
  global.SillyLanding.fonts = Object.freeze({
    defaultFont: 'Syndra',
    available: Object.freeze([
      'Syndra',
      'Dynamic Display',
      'Soap',
      'Yummy',
      'Arcade Raiders',
      'Noisy Walk',
      'Stay Pixel',
      '04B 30',
      'Pixel Chaos'
    ])
  });
})(window);
