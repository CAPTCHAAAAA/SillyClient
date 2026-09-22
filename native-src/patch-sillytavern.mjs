/**
 * SillyClient iOS SillyTavern 兼容性补丁脚本 (patch-sillytavern.mjs)
 *
 * 运行于构建期与启动预备期。
 * 核心任务：
 * 1. 修复 sillytavern-transformers 中 NodeMobile (iOS small-icu) 不支持的 Unicode 属性转义正则 (/^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u)；
 * 2. 将 SillyTavern src/transformers.js 改造成按需懒加载 (Lazy import)，杜绝服务启动阶段不必要的 100MB+ 模型库解析与内存占用；
 * 3. 深度递归扫描并安全兜底 node_modules 中任何潜在的 ICU 正则语法冲突。
 */

import fs from 'node:fs';
import path from 'node:path';

const targetDir = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
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
    console.log(`[patch-sillytavern] [1/4] Successfully patched: ${tokenizersPath}`);
  } else {
    console.log(`[patch-sillytavern] [1/4] Notice: target regex pattern not found in tokenizers.js (may already be patched)`);
  }
} else {
  console.log(`[patch-sillytavern] [1/4] Notice: ${tokenizersPath} does not exist`);
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
    console.log(`[patch-sillytavern] [2/4] Successfully patched: ${distPath}`);
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
    console.log(`[patch-sillytavern] [2b/4] Successfully patched minified: ${distMinPath}`);
  }
}

// 3. 补丁 SillyTavern 官方源码 src/transformers.js 使其懒加载
const serverTransformersPath = path.join(targetDir, 'src', 'transformers.js');
if (fs.existsSync(serverTransformersPath)) {
  let content = fs.readFileSync(serverTransformersPath, 'utf8');
  if (content.includes("import { pipeline, env, RawImage } from 'sillytavern-transformers';")) {
    // 替换顶层静态 import
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
    // 禁用顶层 configureTransformers() 调用
    content = content.replace('configureTransformers();', '// configureTransformers() is handled on-demand in getTransformers()');

    // 替换 getRawImage 中的 RawImage 调用
    content = content.replace(
      'const rawImage = await RawImage.fromBlob(blob);',
      'const { RawImage } = await getTransformers();\n        const rawImage = await RawImage.fromBlob(blob);'
    );

    // 替换 getPipeline 中的 pipeline 调用
    content = content.replace(
      "const instance = await pipeline(task, model, { cache_dir: cacheDir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });",
      "const { pipeline } = await getTransformers();\n    const instance = await pipeline(task, model, { cache_dir: cacheDir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });"
    );

    fs.writeFileSync(serverTransformersPath, content, 'utf8');
    console.log(`[patch-sillytavern] [3/4] Successfully made transformers lazy in: ${serverTransformersPath}`);
  } else {
    console.log(`[patch-sillytavern] [3/4] Notice: src/transformers.js does not contain static import or is already patched`);
  }
}

// 4. 深度递归扫描并防御性替换 node_modules 中的任意 \p{Cc} 遗留
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
          if (code.includes('\\p{Cc}') || code.includes('\\p{Cf}')) {
            console.log(`[patch-sillytavern] [4/4] Found unicode regex in: ${fullPath}`);
            code = code.replace(
              /\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u/g,
              '/^[\\u0000-\\u001F\\u007F-\\u009F\\uD800-\\uDFFF\\uE000-\\uF8FF]$/'
            );
            code = code.replace(
              /\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}/g,
              '[\\u0000-\\u001F\\u007F-\\u009F\\uD800-\\uDFFF\\uE000-\\uF8FF]'
            );
            fs.writeFileSync(fullPath, code, 'utf8');
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}

const nodeModulesDir = path.join(targetDir, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log(`[patch-sillytavern] [4/4] Scanning node_modules for remaining ICU regexes...`);
  deepScanAndPatch(nodeModulesDir);
}

console.log('[patch-sillytavern] All SillyTavern iOS patches executed successfully!');
