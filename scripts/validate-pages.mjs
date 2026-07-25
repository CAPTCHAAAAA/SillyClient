import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsDir = path.join(root, 'docs');
const requiredFiles = [
  'index.html',
  'landing-3d-v2.html',
  'phone-demo.html',
  'landing-icons.svg',
  'sillyclient-logo.svg',
  'styles/theme.css',
  'styles/fonts.css',
  'styles/phone.css',
  'styles/laptop.css',
  'styles/page.css',
  'styles/showcase.css',
  'styles/hero.css',
  'styles/navigation.css',
  'styles/optics.css',
  'styles/scroll-reveal.css',
  'styles/variable-proximity.css',
  'styles/text-type.css',
  'scripts/fonts.js',
  'scripts/background.js',
  'scripts/effects-runtime.js',
  'scripts/page.js',
  'scripts/desktop-model-loader.js',
  'scripts/device-scene-config.js',
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

for (const htmlName of ['index.html', 'landing-3d-v2.html', 'phone-demo.html']) {
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

const landingPath = path.join(docsDir, 'index.html');
const landing = fs.readFileSync(landingPath, 'utf8');
const landingRuntimePath = path.join(docsDir, 'scripts', 'page.js');
const landingRuntime = fs.readFileSync(landingRuntimePath, 'utf8');
const translationMatch = landingRuntime.match(/const translations = (\{[\s\S]*?\n\s*\});/);

if (!translationMatch) {
  errors.push('scripts/page.js: translations object not found');
} else {
  const translations = vm.runInNewContext(`(${translationMatch[1]})`);
  const languages = Object.keys(translations);
  const baseline = new Set(Object.keys(translations[languages[0]] ?? {}));
  const usedKeys = new Set(
    [...landing.matchAll(/data-i18n(?:-aria|-title)?=["']([^"']+)["']/g)].map((match) => match[1]),
  );

  for (const language of languages) {
    const keys = new Set(Object.keys(translations[language]));
    for (const key of baseline) {
      if (!keys.has(key)) errors.push(`translations.${language}: missing key ${key}`);
    }
    for (const key of keys) {
      if (!baseline.has(key)) errors.push(`translations.${language}: extra key ${key}`);
    }
    for (const key of usedKeys) {
      if (!keys.has(key)) errors.push(`translations.${language}: UI uses missing key ${key}`);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join('\n'));
  process.exit(1);
}

console.log('Pages structure and translations are valid.');
