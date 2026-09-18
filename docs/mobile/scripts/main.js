import { initializeExperience } from './experience.js?v=20260817-visual-centering-v2';
import { initializeFrameStages } from './frame-stage.js?v=20260817-visual-centering-v2';
import { createI18n } from './i18n.js?v=20260919-mobile-webgl-v1';
import { initializeNavigation } from './navigation.js';
import { initializeSourceCarousel } from './source-carousel.js';
import { initializeTitleFont } from './title-font.js';
import { initializeBilibiliPlayers } from '../../scripts/ui/bilibili-player.js?v=20260817-video-source-cards-v1';

createI18n();
initializeTitleFont();
initializeFrameStages();
initializeExperience();
initializeSourceCarousel();
initializeBilibiliPlayers();
initializeNavigation();

document.documentElement.classList.add('mobile-ready');
