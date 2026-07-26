import { initializeExperience } from './experience.js';
import { initializeEntryGate } from './entry-gate.js';
import { initializeFrameStages } from './frame-stage.js';
import { createI18n } from './i18n.js';
import { initializeNavigation } from './navigation.js';
import { initializeSourceCarousel } from './source-carousel.js';
import { initializeTitleFont } from './title-font.js';

createI18n();
initializeEntryGate();
initializeTitleFont();
initializeFrameStages();
initializeExperience();
initializeSourceCarousel();
initializeNavigation();

document.documentElement.classList.add('mobile-ready');
