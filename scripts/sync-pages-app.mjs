import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceArgument = process.argv[2];
if (!sourceArgument) {
  console.error('Usage: node scripts/sync-pages-app.mjs <capacitor-ui/dist>');
  process.exit(1);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(sourceArgument);
const destination = path.join(root, 'docs', 'app');

if (!fs.existsSync(path.join(source, 'index.html'))) {
  console.error(`Frontend build not found at ${source}`);
  process.exit(1);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.mkdirSync(destination, { recursive: true });
fs.cpSync(source, destination, { recursive: true });
console.log(`Synced ${source} -> ${destination}`);
