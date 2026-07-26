import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const requiredFiles = [
  'README.md',
  'PAGES-MAINTENANCE.md',
  'ARCHITECTURE.md',
  'index.html',
  'mobile.html',
  'landing-3d-v2.html',
  'phone-demo.html',
  'landing-icons.svg',
  'sillyclient-logo.svg',
  'styles/theme.css',
  'styles/fonts.css',
  'styles/phone.css',
  'styles/laptop.css',
  'styles/page.css',
  'styles/page/base.css',
  'styles/page/journey.css',
  'styles/page/platform.css',
  'styles/page/inspector.css',
  'styles/page/responsive.css',
  'styles/showcase.css',
  'styles/hero.css',
  'styles/navigation.css',
  'styles/optics.css',
  'styles/scroll-reveal.css',
  'styles/variable-proximity.css',
  'styles/text-type.css',
  'mobile/styles/tokens.css',
  'mobile/styles/shell.css',
  'mobile/styles/hero.css',
  'mobile/styles/experience.css',
  'mobile/styles/source.css',
  'scripts/fonts.js',
  'scripts/background.js',
  'scripts/background/shared.js',
  'scripts/background/color-bends.js',
  'scripts/background/dot-field.js',
  'scripts/background/index.js',
  'scripts/effects-runtime.js',
  'scripts/page.js',
  'scripts/page/component-inspector.js',
  'scripts/page/content.js',
  'scripts/page/inspector-content.js',
  'scripts/page/navigation-controller.js',
  'scripts/ui/title-font-controller.js',
  'scripts/desktop-model-loader.js',
  'scripts/device-scene-config.js',
  'scripts/device-render/input-motion.js',
  'scripts/device-render/phone-device.js',
  'scripts/device-render/screen-projection.js',
  'scripts/device-render/webgl-stage.js',
  'scripts/phone-model.js',
  'scripts/laptop-model.js',
  'scripts/device-showcase.js',
  'scripts/platform-carousel.js',
  'scripts/spotlight-card.js',
  'scripts/scroll-reveal.js',
  'scripts/variable-proximity.js',
  'scripts/text-type.js',
  'scripts/component-hover.js',
  'scripts/component-motion.js',
  'mobile/scripts/content.js',
  'mobile/scripts/entry-gate.js',
  'mobile/scripts/i18n.js',
  'mobile/scripts/frame-stage.js',
  'mobile/scripts/experience.js',
  'mobile/scripts/source-carousel.js',
  'mobile/scripts/title-font.js',
  'mobile/scripts/navigation.js',
  'mobile/scripts/main.js',
  'scripts/product-render/frame-export.js',
  'scripts/product-render/config.js',
  'scripts/product-render/product-frame-renderer.js',
  'scripts/product-render/screen-materials.js',
  'scripts/viewport-router.js',
  'product-render/screen-source.html',
  'product-render/README.md',
  'product-render/screens/phone.jpg',
  'product-render/screens/laptop.jpg',
  'mobile-frames/android.webp',
  'mobile-frames/windows.webp',
  'mobile-frames/together.webp',
  'models/iphone_17_air.glb',
  'models/macbook_pro_m3_16_inch_2024.glb',
  'app/index.html',
];

const errors = [];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(docsDir, relativePath))) {
    errors.push(`missing Pages file: docs/${relativePath}`);
  }
}

const repositoryDocuments = [
  'README.md',
  'README.en.md',
  'CONTRIBUTING.md',
  'docs/README.md',
  'docs/PAGES-MAINTENANCE.md',
  'docs/ARCHITECTURE.md',
  'docs/adr/0002-single-frontend-source.md',
];
for (const relativePath of repositoryDocuments) {
  const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
  if (content.includes('SillyClient-Android/App/web/capacitor-ui')) {
    errors.push(`${relativePath}: contains the retired nested Android frontend path`);
  }
}

for (const htmlName of ['index.html', 'mobile.html', 'landing-3d-v2.html', 'phone-demo.html']) {
  const htmlPath = path.join(docsDir, htmlName);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const referencePattern = /\b(?:src|href)=["']([^"']+)["']/g;

  for (const match of html.matchAll(referencePattern)) {
    const reference = match[1];
    if (/^(?:https?:|data:|mailto:|javascript:|#)/.test(reference)) continue;

    const cleanPath = reference.split(/[?#]/, 1)[0];
    const absolutePath = path.resolve(path.dirname(htmlPath), cleanPath);
    if (!absolutePath.startsWith(docsDir + path.sep) || !fs.existsSync(absolutePath)) {
      errors.push(`${htmlName}: unresolved local reference ${reference}`);
    }
  }
}

function validateTranslations({ htmlName, scriptName, attributePattern, namespace }) {
  const html = fs.readFileSync(path.join(docsDir, htmlName), 'utf8');
  const runtime = fs.readFileSync(path.join(docsDir, scriptName), 'utf8');
  const translationMatch = runtime.match(/const translations = (\{[\s\S]*?\n\s*\});/);

  if (!translationMatch) {
    errors.push(`${scriptName}: translations object not found`);
    return;
  }

  const translations = vm.runInNewContext(`(${translationMatch[1]})`);
  const languages = Object.keys(translations);
  const baseline = new Set(Object.keys(translations[languages[0]] ?? {}));
  const usedKeys = new Set(
    [...html.matchAll(attributePattern)].map((match) => match[1]),
  );

  for (const language of languages) {
    const keys = new Set(Object.keys(translations[language]));
    for (const key of baseline) {
      if (!keys.has(key)) errors.push(`${namespace}.${language}: missing key ${key}`);
    }
    for (const key of keys) {
      if (!baseline.has(key)) errors.push(`${namespace}.${language}: extra key ${key}`);
    }
    for (const key of usedKeys) {
      if (!keys.has(key)) errors.push(`${namespace}.${language}: UI uses missing key ${key}`);
    }
  }
}

validateTranslations({
  htmlName: 'index.html',
  scriptName: 'scripts/page/content.js',
  attributePattern: /data-i18n(?:-aria|-title)?=["']([^"']+)["']/g,
  namespace: 'translations',
});

validateTranslations({
  htmlName: 'mobile.html',
  scriptName: 'mobile/scripts/content.js',
  attributePattern: /data-mobile-i18n(?:-aria|-alt)?=["']([^"']+)["']/g,
  namespace: 'mobileTranslations',
});

const mobileSources = [
  'mobile.html',
  'mobile/scripts/content.js',
  'mobile/scripts/entry-gate.js',
  'mobile/scripts/i18n.js',
  'mobile/scripts/frame-stage.js',
  'mobile/scripts/experience.js',
  'mobile/scripts/source-carousel.js',
  'mobile/scripts/title-font.js',
  'mobile/scripts/navigation.js',
  'mobile/scripts/main.js',
  'mobile/styles/tokens.css',
  'mobile/styles/shell.css',
  'mobile/styles/hero.css',
  'mobile/styles/experience.css',
  'mobile/styles/source.css',
].map((relativePath) => fs.readFileSync(path.join(docsDir, relativePath), 'utf8')).join('\n').toLowerCase();
for (const forbiddenDependency of ['<canvas', '<iframe', 'three.js', "from 'three", 'phone-model.js', 'models/', '.glb', 'gsap']) {
  if (mobileSources.includes(forbiddenDependency)) {
    errors.push(`mobile page: heavy desktop dependency is not allowed: ${forbiddenDependency}`);
  }
}

const viewportRouter = fs.readFileSync(path.join(docsDir, 'scripts/viewport-router.js'), 'utf8');
if (!viewportRouter.includes("matchMedia('(min-aspect-ratio: 1 / 1)')")) {
  errors.push('viewport router: desktop must start at a 1:1 aspect ratio');
}
if (!viewportRouter.includes("new URL('./mobile.html'")) {
  errors.push('viewport router: portrait route to mobile.html is missing');
}

const pageStyles = fs.readFileSync(path.join(docsDir, 'styles/page.css'), 'utf8');
for (const stylesheet of ['base.css', 'journey.css', 'platform.css', 'inspector.css', 'responsive.css']) {
  if (!pageStyles.includes(`./page/${stylesheet}`)) {
    errors.push(`page styles: missing module import ${stylesheet}`);
  }
}

const pageController = fs.readFileSync(path.join(docsDir, 'scripts/page.js'), 'utf8');
for (const moduleName of ['component-inspector.js', 'navigation-controller.js', 'title-font-controller.js']) {
  if (!pageController.includes(moduleName)) {
    errors.push(`page controller: missing module import ${moduleName}`);
  }
}

const mobileFramePaths = [
  'mobile-frames/android.webp',
  'mobile-frames/windows.webp',
  'mobile-frames/together.webp',
];
let mobileFrameBytes = 0;
for (const relativePath of mobileFramePaths) {
  const absolutePath = path.join(docsDir, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const header = fs.readFileSync(absolutePath).subarray(0, 30);
  if (header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WEBP') {
    errors.push(`docs/${relativePath}: expected a WebP product frame`);
  } else if (header.toString('ascii', 12, 16) === 'VP8X') {
    const width = 1 + header.readUIntLE(24, 3);
    const height = 1 + header.readUIntLE(27, 3);
    if (width !== 3840 || height !== 2160) {
      errors.push(`docs/${relativePath}: expected 3840x2160, received ${width}x${height}`);
    }
  } else {
    errors.push(`docs/${relativePath}: expected an alpha-capable VP8X WebP container`);
  }
  mobileFrameBytes += fs.statSync(absolutePath).size;
}
if (mobileFrameBytes > 256 * 1024) {
  errors.push(`mobile product frames exceed the 256 KiB transfer budget: ${mobileFrameBytes} bytes`);
}

for (const relativePath of [
  'product-render/screens/phone.jpg',
  'product-render/screens/laptop.jpg',
]) {
  const absolutePath = path.join(docsDir, relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  const header = fs.readFileSync(absolutePath).subarray(0, 3);
  if (header[0] !== 0xff || header[1] !== 0xd8 || header[2] !== 0xff) {
    errors.push(`docs/${relativePath}: expected a JPEG screen texture`);
  }
}

const productRenderer = fs.readFileSync(path.join(docsDir, 'scripts/phone-model.js'), 'utf8');
const screenMaterialModule = fs.readFileSync(path.join(docsDir, 'scripts/product-render/screen-materials.js'), 'utf8');
const productRenderConfig = fs.readFileSync(path.join(docsDir, 'scripts/product-render/config.js'), 'utf8');
if (!productRenderer.includes('installProductScreenMaterials')) {
  errors.push('product renderer: HTML screen texture binding is missing');
}
for (const screenTexture of ['phone.jpg', 'laptop.jpg']) {
  if (!productRenderConfig.includes(screenTexture)) {
    errors.push(`product renderer: missing ${screenTexture} screen texture binding`);
  }
}
if (!screenMaterialModule.includes('PRODUCT_SCREEN_PRESETS')) {
  errors.push('product renderer: screen material module is not using the shared product configuration');
}
for (const moduleName of [
  'input-motion.js',
  'phone-device.js',
  'screen-projection.js',
  'webgl-stage.js',
  'product-frame-renderer.js',
]) {
  if (!productRenderer.includes(moduleName)) {
    errors.push(`device renderer: missing module import ${moduleName}`);
  }
}

const screenSource = fs.readFileSync(path.join(docsDir, 'product-render/screen-source.html'), 'utf8');
if (!screenSource.includes('scripts/product-render/config.js')) {
  errors.push('screen source: shared product configuration import is missing');
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Pages structure and translations are valid.');
