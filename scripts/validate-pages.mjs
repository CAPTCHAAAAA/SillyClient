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
  'landing-premium.css',
  'sillyclient-logo.svg',
  'models/iphone_17_air.glb',
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
const translationMatch = landing.match(/const translations = (\{[\s\S]*?\n\s*\});/);

if (!translationMatch) {
  errors.push('index.html: translations object not found');
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
