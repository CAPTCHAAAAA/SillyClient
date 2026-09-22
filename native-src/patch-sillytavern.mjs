/**
 * SillyClient iOS SillyTavern 兼容性补丁脚本 (patch-sillytavern.mjs)
 *
 * 运行于构建期与启动预备期。
 * 核心任务：
 * 1. 修复 sillytavern-transformers 中 NodeMobile (iOS small-icu) 不支持的 Unicode 属性转义正则 (/^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u)；
 * 2. 修复 @jsquash/png, @jsquash/oxipng, isomorphic-git 中由于 small-icu 不支持 fatal: true 抛出 ERR_NO_ICU 的问题；
 * 3. 将 SillyTavern src/transformers.js 改造成按需懒加载 (Lazy import)，杜绝服务启动阶段不必要的 100MB+ 模型库解析与内存占用；
 * 4. 深度递归扫描并安全兜底 node_modules 中任何潜在的 ICU 正则与 TextDecoder 选项冲突。
 */

import fs from 'node:fs';
import path from 'node:path';

// 精确解析目标目录，过滤形如 --port=8000 的命令行参数
let targetDir = process.cwd();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (!arg.startsWith('-') && fs.existsSync(arg)) {
    targetDir = path.resolve(arg);
    break;
  }
}
console.log(`[patch-sillytavern] Starting patch on directory: ${targetDir}`);

// 1. 补丁 sillytavern-transformers 的 src/tokenizers.js
const tokenizersPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'src', 'tokenizers.js');
if (fs.existsSync(tokenizersPath)) {
  let content = fs.readFileSync(tokenizersPath, 'utf8');
  const targetRegex = /return\s+\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(char\);/g;
  const replacement = 'const code = char.charCodeAt(0);\n                return (code <= 31 || (code >= 127 && code <= 159) || (code >= 55296 && code <= 57343) || (code >= 57344 && code <= 63743));';
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(tokenizersPath, content, 'utf8');
    console.log(`[patch-sillytavern] [1/5] Successfully patched: ${tokenizersPath}`);
  } else {
    console.log(`[patch-sillytavern] [1/5] Notice: target regex pattern not found in tokenizers.js (may already be patched)`);
  }
}

// 2. 补丁 sillytavern-transformers 的 dist/transformers.js
const distPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'dist', 'transformers.js');
if (fs.existsSync(distPath)) {
  let content = fs.readFileSync(distPath, 'utf8');
  const targetRegex = /return\s+\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(char\);/g;
  const replacement = 'const code = char.charCodeAt(0); return (code <= 31 || (code >= 127 && code <= 159) || (code >= 55296 && code <= 57343) || (code >= 57344 && code <= 63743));';
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
    fs.writeFileSync(distPath, content, 'utf8');
    console.log(`[patch-sillytavern] [2/5] Successfully patched: ${distPath}`);
  }
}

// 补丁 sillytavern-transformers 的 dist/transformers.min.js
const distMinPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'dist', 'transformers.min.js');
if (fs.existsSync(distMinPath)) {
  let content = fs.readFileSync(distMinPath, 'utf8');
  const targetRegex = /\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(([a-zA-Z0-9_$]+)\)/g;
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, '($1.charCodeAt(0)<=31||($1.charCodeAt(0)>=127&&$1.charCodeAt(0)<=159)||($1.charCodeAt(0)>=55296&&$1.charCodeAt(0)<=63743))');
    fs.writeFileSync(distMinPath, content, 'utf8');
    console.log(`[patch-sillytavern] [2b/5] Successfully patched minified: ${distMinPath}`);
  }
}

// 3. 补丁 TextDecoder { fatal: true } (ERR_NO_ICU: fatal option is not supported on Node.js compiled without ICU)
const textDecoderTargets = [
  path.join(targetDir, 'node_modules', '@jsquash', 'png', 'codec', 'pkg', 'squoosh_png.js'),
  path.join(targetDir, 'node_modules', '@jsquash', 'oxipng', 'codec', 'pkg', 'squoosh_oxipng.js'),
  path.join(targetDir, 'node_modules', '@jsquash', 'oxipng', 'codec', 'pkg-parallel', 'squoosh_oxipng.js'),
  path.join(targetDir, 'node_modules', 'isomorphic-git', 'models', 'index.js'),
  path.join(targetDir, 'node_modules', 'isomorphic-git', 'models', 'index.cjs')
];
for (const tf of textDecoderTargets) {
  if (fs.existsSync(tf)) {
    let c = fs.readFileSync(tf, 'utf8');
    if (c.includes('fatal: true')) {
      c = c.replace(/ignoreBOM:\s*true,\s*fatal:\s*true/g, 'ignoreBOM: true');
      c = c.replace(/fatal:\s*true/g, 'fatal: false');
      fs.writeFileSync(tf, c, 'utf8');
      console.log(`[patch-sillytavern] [3/5] Successfully stripped fatal: true from: ${tf}`);
    }
  }
}

// 4. 补丁 SillyTavern 官方源码 src/transformers.js 使其按需懒加载
const serverTransformersPath = path.join(targetDir, 'src', 'transformers.js');
if (fs.existsSync(serverTransformersPath)) {
  let content = fs.readFileSync(serverTransformersPath, 'utf8');
  if (content.includes("import { pipeline, env, RawImage } from 'sillytavern-transformers';")) {
    content = content.replace(
      "import { pipeline, env, RawImage } from 'sillytavern-transformers';",
      `// SillyClient iOS: 懒加载 sillytavern-transformers 运行时
let _transformersModule = null;
async function getTransformers() {
    if (!_transformersModule) {
        _transformersModule = await import('sillytavern-transformers');
        _transformersModule.env.backends.onnx.wasm.numThreads = 1;
        _transformersModule.env.backends.onnx.wasm.wasmPaths = path.join(serverDirectory, 'node_modules', 'sillytavern-transformers', 'dist') + path.sep;
    }
    return _transformersModule;
}`
    );
    content = content.replace('configureTransformers();', '// configureTransformers() is handled on-demand in getTransformers()');

    content = content.replace(
      'const rawImage = await RawImage.fromBlob(blob);',
      'const { RawImage } = await getTransformers();\n        const rawImage = await RawImage.fromBlob(blob);'
    );

    content = content.replace(
      "const instance = await pipeline(task, model, { cache_dir: cacheDir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });",
      "const { pipeline } = await getTransformers();\n    const instance = await pipeline(task, model, { cache_dir: cacheDir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });"
    );

    fs.writeFileSync(serverTransformersPath, content, 'utf8');
    console.log(`[patch-sillytavern] [4/5] Successfully made transformers lazy in: ${serverTransformersPath}`);
  } else {
    console.log(`[patch-sillytavern] [4/5] Notice: src/transformers.js does not contain static import or is already patched`);
  }
}

// 5. 深度递归扫描并防御性替换 node_modules 中的任意 \p{Cc} 与 fatal: true 遗留
function deepScanAndPatch(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git' && entry.name !== 'build') {
          deepScanAndPatch(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
        try {
          let code = fs.readFileSync(fullPath, 'utf8');
          let modified = false;
          if (code.includes('\\p{Cc}') || code.includes('\\p{Cf}')) {
            code = code.replace(
              /\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u/g,
              '/^[\\u0000-\\u001F\\u007F-\\u009F\\uD800-\\uDFFF\\uE000-\\uF8FF]$/'
            );
            code = code.replace(
              /\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}/g,
              '[\\u0000-\\u001F\\u007F-\\u009F\\uD800-\\uDFFF\\uE000-\\uF8FF]'
            );
            modified = true;
          }
          if (code.includes('fatal: true') && (code.includes('TextDecoder') || fullPath.includes('@jsquash') || fullPath.includes('squoosh'))) {
            code = code.replace(/ignoreBOM:\s*true,\s*fatal:\s*true/g, 'ignoreBOM: true');
            code = code.replace(/fatal:\s*true/g, 'fatal: false');
            modified = true;
          }
          if (modified) {
            fs.writeFileSync(fullPath, code, 'utf8');
            console.log(`[patch-sillytavern] [5/5] Deep patched: ${fullPath}`);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}

const nodeModulesDir = path.join(targetDir, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log(`[patch-sillytavern] [5/5] Scanning node_modules for remaining ICU regexes & TextDecoder fatal options...`);
  deepScanAndPatch(nodeModulesDir);
}

console.log('[patch-sillytavern] All SillyTavern iOS patches executed successfully!');
