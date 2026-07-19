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

const appIndex = fs.readFileSync(path.join(source, 'index.html'), 'utf8');
const pageIndex = appIndex
  .replaceAll('./assets/', './app/assets/')
  .replaceAll('./fonts/', './app/fonts/');

const showcaseBootstrap = `    <script>
      (() => {
        const params = new URLSearchParams(window.location.search);
        params.set('showcase', '1');
        if (!params.has('safeTop')) params.set('safeTop', '52');
        history.replaceState(null, '', \`${'${location.pathname}'}?\${params}\${location.hash}\`);
      })();
    </script>\n`;
const phoneDemo = pageIndex
  .replace('<title>SillyClient 酒馆启动器</title>', '<title>SillyClient 展示界面</title>')
  .replace("var stored = localStorage.getItem('theme');", "var stored = 'dark';")
  .replace('  </head>', `${showcaseBootstrap}  </head>`);
fs.writeFileSync(path.join(root, 'docs', 'phone-demo.html'), phoneDemo);

console.log(`Synced ${source} -> ${destination}`);
