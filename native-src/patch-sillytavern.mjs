/**
 * SillyClient iOS SillyTavern 兼容性补丁脚本 (patch-sillytavern.mjs)
 *
 * 运行于构建期与启动预备期。
 * 核心任务：
 * 1. 修复 sillytavern-transformers 中 NodeMobile (iOS small-icu) 不支持的 Unicode 属性转义正则 (/^\p{Cc}|\p{Cf}|\p{Co}|\p{Cs}$/u) 与分词模式串；
 * 2. 修复 gpt-3-encoder 中不支持的 \p{L} / \p{N} 正则语法错误 (SyntaxError: Invalid regular expression: Invalid property name)；
 * 3. 修复 @jsquash/png, @jsquash/oxipng, isomorphic-git 中由于 small-icu 不支持 fatal: true 抛出 ERR_NO_ICU 的问题；
 * 4. 修复 tiktoken 在 iOS jitless / 无 WebAssembly 运行时环境下的安全降级适配；
 * 5. 将 SillyTavern src/transformers.js 改造成按需懒加载 (Lazy import)，杜绝服务启动阶段不必要的 100MB+ 模型库解析与内存占用；
 * 6. 深度递归扫描并防御性替换 node_modules 中任何潜在的 ICU 正则与 TextDecoder 选项冲突。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const origPatStr = "/'s|'t|'re|'ve|'m|'ll|'d| ?\\p{L}+| ?\\p{N}+| ?[^\\s\\p{L}\\p{N}]+|\\s+(?!\\S)|\\s+/gu";
const safePatStr = "/'s|'t|'re|'ve|'m|'ll|'d| ?[a-zA-Z\\u0080-\\uFFFF]+| ?[0-9]+| ?[^\\s\\w\\u0080-\\uFFFF]+|\\s+(?!\\S)|\\s+/g";

// 1. 补丁 sillytavern-transformers 的 src/tokenizers.js
const tokenizersPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'src', 'tokenizers.js');
if (fs.existsSync(tokenizersPath)) {
  let content = fs.readFileSync(tokenizersPath, 'utf8');
  const targetRegex = /return\s+\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(char\);/g;
  const replacement = 'const code = char.charCodeAt(0);\n                return (code <= 31 || (code >= 127 && code <= 159) || (code >= 55296 && code <= 57343) || (code >= 57344 && code <= 63743));';
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
  }
  if (content.includes(origPatStr)) {
    content = content.replaceAll(origPatStr, safePatStr);
  }
  fs.writeFileSync(tokenizersPath, content, 'utf8');
  console.log(`[patch-sillytavern] [1/6] Successfully patched: ${tokenizersPath}`);
}

// 2. 补丁 sillytavern-transformers 的 dist/transformers.js
const distPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'dist', 'transformers.js');
if (fs.existsSync(distPath)) {
  let content = fs.readFileSync(distPath, 'utf8');
  const targetRegex = /return\s+\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(char\);/g;
  const replacement = 'const code = char.charCodeAt(0); return (code <= 31 || (code >= 127 && code <= 159) || (code >= 55296 && code <= 57343) || (code >= 57344 && code <= 63743));';
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, replacement);
  }
  if (content.includes(origPatStr)) {
    content = content.replaceAll(origPatStr, safePatStr);
  }
  fs.writeFileSync(distPath, content, 'utf8');
  console.log(`[patch-sillytavern] [2/6] Successfully patched: ${distPath}`);
}

// 补丁 sillytavern-transformers 的 dist/transformers.min.js
const distMinPath = path.join(targetDir, 'node_modules', 'sillytavern-transformers', 'dist', 'transformers.min.js');
if (fs.existsSync(distMinPath)) {
  let content = fs.readFileSync(distMinPath, 'utf8');
  const targetRegex = /\/\^\\p\{Cc\}\|\\p\{Cf\}\|\\p\{Co\}\|\\p\{Cs\}\$\/u\.test\(([a-zA-Z0-9_$]+)\)/g;
  if (targetRegex.test(content)) {
    content = content.replace(targetRegex, '($1.charCodeAt(0)<=31||($1.charCodeAt(0)>=127&&$1.charCodeAt(0)<=159)||($1.charCodeAt(0)>=55296&&$1.charCodeAt(0)<=63743))');
  }
  if (content.includes(origPatStr)) {
    content = content.replaceAll(origPatStr, safePatStr);
  }
  fs.writeFileSync(distMinPath, content, 'utf8');
  console.log(`[patch-sillytavern] [2b/6] Successfully patched minified: ${distMinPath}`);
}

// 3. 补丁 gpt-3-encoder 的 Encoder.js (vectra -> gpt-3-encoder 依赖)
const gpt3EncoderPath = path.join(targetDir, 'node_modules', 'gpt-3-encoder', 'Encoder.js');
if (fs.existsSync(gpt3EncoderPath)) {
  let content = fs.readFileSync(gpt3EncoderPath, 'utf8');
  if (content.includes(origPatStr)) {
    content = content.replaceAll(origPatStr, safePatStr);
    fs.writeFileSync(gpt3EncoderPath, content, 'utf8');
    console.log(`[patch-sillytavern] [3/6] Successfully patched gpt-3-encoder: ${gpt3EncoderPath}`);
  } else {
    console.log(`[patch-sillytavern] [3/6] gpt-3-encoder already patched or pattern not found: ${gpt3EncoderPath}`);
  }
}

// 4. 补丁 TextDecoder { fatal: true } (ERR_NO_ICU: fatal option is not supported on Node.js compiled without ICU)
const textDecoderTargets = [
  path.join(targetDir, 'node_modules', '@jsquash', 'png', 'codec', 'pkg', 'squoosh_png.js'),
  path.join(targetDir, 'node_modules', '@jsquash', 'oxipng', 'codec', 'pkg', 'squoosh_oxipng.js'),
  path.join(targetDir, 'node_modules', '@jsquash', 'oxipng', 'codec', 'pkg-parallel', 'squoosh_oxipng.js'),
  path.join(targetDir, 'node_modules', 'isomorphic-git', 'models', 'index.js'),
  path.join(targetDir, 'node_modules', 'isomorphic-git', 'models', 'index.cjs'),
  path.join(targetDir, 'node_modules', 'tiktoken', 'tiktoken_bg.cjs'),
  path.join(targetDir, 'node_modules', 'tiktoken', 'lite', 'tiktoken_bg.cjs')
];
for (const tf of textDecoderTargets) {
  if (fs.existsSync(tf)) {
    let c = fs.readFileSync(tf, 'utf8');
    if (c.includes('fatal: true')) {
      c = c.replace(/ignoreBOM:\s*true,\s*fatal:\s*true/g, 'ignoreBOM: true');
      c = c.replace(/fatal:\s*true/g, 'fatal: false');
      fs.writeFileSync(tf, c, 'utf8');
      console.log(`[patch-sillytavern] [4/6] Successfully stripped fatal: true from: ${tf}`);
    }
  }
}

// 5. Keep imports usable without WASM, but never fabricate token IDs or decoded text.
const tiktokenFiles = [
  path.join(targetDir, 'node_modules', 'tiktoken', 'tiktoken.cjs'),
  path.join(targetDir, 'node_modules', 'tiktoken', 'lite', 'tiktoken.cjs')
];
for (const tf of tiktokenFiles) {
  if (fs.existsSync(tf)) {
    let c = fs.readFileSync(tf, 'utf8');
    if (!c.includes('// SillyClient iOS tiktoken fallback')) {
      const exportNames = tf.includes(`${path.sep}lite${path.sep}`)
        ? ['Tiktoken']
        : ['get_encoding', 'encoding_for_model', 'get_encoding_name_for_model', 'Tiktoken'];
      const exportAssignments = exportNames.map(name => `exports["${name}"] = wasm["${name}"];`).join('\n');
      const origInstantiation = `const wasmModule = new WebAssembly.Module(bytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
wasm.__wbg_set_wasm(wasmInstance.exports);
${exportAssignments}`;

      const safeInstantiation = `// SillyClient iOS tiktoken fallback
function unavailableTokenizer() {
  const error = new Error("This tokenizer requires WebAssembly, which is unavailable in the iOS runtime.");
  error.code = "ERR_IOS_WASM_UNAVAILABLE";
  throw error;
}

try {
  if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.Module === 'function' && typeof WebAssembly.Instance === 'function') {
    const wasmModule = new WebAssembly.Module(bytes);
    const wasmInstance = new WebAssembly.Instance(wasmModule, imports);
    if (wasmInstance && wasmInstance.exports && Object.keys(wasmInstance.exports).length > 0) {
      wasm.__wbg_set_wasm(wasmInstance.exports);
      exports["get_encoding"] = wasm["get_encoding"];
      exports["encoding_for_model"] = wasm["encoding_for_model"];
      exports["get_encoding_name_for_model"] = wasm["get_encoding_name_for_model"];
      exports["Tiktoken"] = wasm["Tiktoken"];
    } else {
      throw new Error("WebAssembly exports empty");
    }
  } else {
    throw new Error("WebAssembly not supported");
  }
} catch (e) {
  exports["get_encoding"] = unavailableTokenizer;
  exports["encoding_for_model"] = unavailableTokenizer;
  exports["get_encoding_name_for_model"] = unavailableTokenizer;
  exports["Tiktoken"] = class { constructor() { unavailableTokenizer(); } };
}`;

      if (c.includes('const wasmModule = new WebAssembly.Module(bytes);')) {
        if (!c.includes(origInstantiation)) {
          throw new Error(`Unsupported tiktoken initialization in ${tf}`);
        }
        c = c.replace(origInstantiation, safeInstantiation);
        fs.writeFileSync(tf, c, 'utf8');
        console.log(`[patch-sillytavern] [5/6] Successfully injected tiktoken WebAssembly fallback in: ${tf}`);
      }
    }
  }
}

// 6. 补丁 SillyTavern 官方源码 src/transformers.js 使其按需懒加载
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
    console.log(`[patch-sillytavern] [6/7] Successfully made transformers lazy in: ${serverTransformersPath}`);
  } else {
    console.log(`[patch-sillytavern] [6/7] Notice: src/transformers.js does not contain static import or is already patched`);
  }
}

// 7. 补丁 SillyTavern 官方源码 src/middleware/webpack-serve.js 确保使用 prebuilt-webpack，杜绝运行时导入 webpack
const webpackServePath = path.join(targetDir, 'src', 'middleware', 'webpack-serve.js');
if (fs.existsSync(webpackServePath)) {
  let content = fs.readFileSync(webpackServePath, 'utf8');
  if (content.includes('ios-frontend') || content.includes('prebuilt-webpack')) {
    console.log(`[patch-sillytavern] [7/8] Notice: webpack-serve.js is already using prebuilt-webpack: ${webpackServePath}`);
  } else {
    const prebuiltCandidates = [
      path.join(path.dirname(fileURLToPath(import.meta.url)), 'prebuilt-webpack.mjs'),
      path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'native-src', 'prebuilt-webpack.mjs'),
    ];
    let installed = false;
    for (const cand of prebuiltCandidates) {
      if (fs.existsSync(cand)) {
        fs.copyFileSync(cand, webpackServePath);
        console.log(`[patch-sillytavern] [7/8] Successfully installed prebuilt-webpack from ${cand} into: ${webpackServePath}`);
        installed = true;
        break;
      }
    }
    if (!installed) {
      const safeWebpackServe = `import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

// Installed as SillyTavern/src/middleware/webpack-serve.js after the host build.
const serverRoot = fileURLToPath(new URL('../../', import.meta.url));
const assetRoot = path.join(serverRoot, 'dist', 'ios-frontend');

export default function getWebpackServeMiddleware() {
    let assets = null;

    function middleware(req, res, next) {
        const name = req.path?.slice(1);
        if (assets?.has(name) && (req.method === 'GET' || req.method === 'HEAD')) {
            return res.sendFile(name, { root: assetRoot, dotfiles: 'deny' });
        }
        next();
    }

    middleware.runWebpackCompiler = async () => {
        assets = null;
        const manifestFile = path.join(assetRoot, 'manifest.json');
        if (!fs.existsSync(manifestFile)) {
            console.log('[ios-frontend] Notice: manifest.json not found, frontend prebuild bypassed.');
            return;
        }
        const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
        const pkg = JSON.parse(fs.readFileSync(path.join(serverRoot, 'package.json'), 'utf8'));
        if (manifest.format !== 1 || manifest.version !== pkg.version || !Array.isArray(manifest.assets)) {
            throw new Error('Invalid or incompatible iOS frontend manifest. Rebuild the application.');
        }

        const verified = new Set();
        for (const asset of manifest.assets) {
            const name = asset.name;
            if (typeof name !== 'string' || !name || name.includes('\\\\') || name.includes(':')
                || name.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.'))
                || verified.has(name) || !/^[a-f0-9]{64}$/.test(asset.sha256)) {
                throw new Error('Invalid asset entry in the iOS frontend manifest.');
            }
            const file = path.join(assetRoot, name);
            const realRoot = fs.realpathSync(assetRoot);
            const relative = path.relative(realRoot, fs.realpathSync(file));
            if (relative.startsWith('..') || path.isAbsolute(relative) || !fs.statSync(file).isFile()) {
                throw new Error(\`Invalid iOS frontend asset path: \${name}\`);
            }
            const content = fs.readFileSync(file);
            if (content.length !== asset.bytes
                || createHash('sha256').update(content).digest('hex') !== asset.sha256) {
                throw new Error(\`iOS frontend asset verification failed: \${name}\`);
            }
            verified.add(name);
        }
        if (!verified.has('lib.js')) {
            throw new Error('The prebuilt iOS frontend is missing lib.js.');
        }
        assets = verified;
        console.log(\`[ios-frontend] Verified \${assets.size} prebuilt assets; runtime compilation disabled.\`);
    };

    return middleware;
}
`;
      fs.writeFileSync(webpackServePath, safeWebpackServe, 'utf8');
      console.log(`[patch-sillytavern] [7/8] Successfully installed embedded prebuilt-webpack into: ${webpackServePath}`);
    }
  }
}

// 8. 深度递归扫描并防御性替换 node_modules 中的任意 \p{Cc}, \p{L}, \p{N} 与 fatal: true 遗留
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
      } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs') || entry.name.endsWith('.cjs'))) {
        try {
          let code = fs.readFileSync(fullPath, 'utf8');
          let modified = false;

          if (code.includes(origPatStr)) {
            code = code.replaceAll(origPatStr, safePatStr);
            modified = true;
          }

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

          if (code.includes('\\p{L}') || code.includes('\\p{N}') || code.includes('\\p{Lu}') || code.includes('\\p{Ll}')) {
            code = code.replace(/\\p\{L\}/g, 'a-zA-Z\\u0080-\\uFFFF');
            code = code.replace(/\\p\{N\}/g, '0-9');
            code = code.replace(/\\p\{Lu\}|\\p\{Uppercase_Letter\}/g, 'A-Z\\u0080-\\uFFFF');
            code = code.replace(/\\p\{Ll\}|\\p\{Lowercase_Letter\}/g, 'a-z');
            code = code.replace(/\\p\{Alpha\}/g, 'a-zA-Z\\u0080-\\uFFFF');
            code = code.replace(/\\p\{XID_Start\}/g, 'a-zA-Z\\u0080-\\uFFFF');
            code = code.replace(/\\p\{XID_Continue\}/g, 'a-zA-Z0-9\\u0080-\\uFFFF');
            modified = true;
          }

          if (code.includes('fatal: true') && (code.includes('TextDecoder') || fullPath.includes('@jsquash') || fullPath.includes('squoosh') || fullPath.includes('isomorphic-git'))) {
            code = code.replace(/ignoreBOM:\s*true,\s*fatal:\s*true/g, 'ignoreBOM: true');
            code = code.replace(/fatal:\s*true/g, 'fatal: false');
            modified = true;
          }

          if (modified) {
            fs.writeFileSync(fullPath, code, 'utf8');
            console.log(`[patch-sillytavern] [7/7] Deep patched: ${fullPath}`);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
}

const nodeModulesDir = path.join(targetDir, 'node_modules');
if (fs.existsSync(nodeModulesDir)) {
  console.log(`[patch-sillytavern] [7/7] Scanning node_modules for remaining ICU regexes & TextDecoder fatal options...`);
  deepScanAndPatch(nodeModulesDir);
}

console.log('[patch-sillytavern] All SillyTavern iOS patches executed successfully!');
