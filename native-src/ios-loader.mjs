/**
 * SillyClient iOS Node.js 启动引导脚本 (ios-loader.mjs)
 *
 * 运行于 NodeMobile 进程内独立工作线程。
 * 职责：
 * 1. 拦截 stderr / stdout 输出与异常，全部输出至 STDOUT 管道写入 server.log；
 * 2. 拦截 process.exit，杜绝由于 JS 异常导致 iOS 宿主闪退；
 * 3. 强制启用 ST_DISABLE_SHARP=true，确保图像解码走纯 JS / WASM (@jimp)；
 * 4. 挂载持久心跳定时器，防止 libuv 事件循环因异步间隙提前退出；
 * 5. 加载 SillyTavern 核心服务并监听 server-started 事件；
 * 6. 服务就绪后自动在沙盒写入 server-ready.txt 信号。
 */

import path from 'node:path';
import fs from 'node:fs';
import util from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// 注入 SafeTextDecoder，彻底消除 NodeMobile (small-icu) 下对 fatal: true 的 ERR_NO_ICU 报错
if (typeof globalThis.TextDecoder !== 'undefined') {
    const OrigTextDecoder = globalThis.TextDecoder;
    class SafeTextDecoder extends OrigTextDecoder {
        constructor(encoding = 'utf-8', options = {}) {
            if (options && options.fatal) {
                const safeOpts = { ...options };
                delete safeOpts.fatal;
                super(encoding, safeOpts);
            } else {
                super(encoding, options);
            }
        }
    }
    globalThis.TextDecoder = SafeTextDecoder;
    if (util && util.TextDecoder) {
        util.TextDecoder = SafeTextDecoder;
    }
}

// 注入 WebAssembly 实例安全兜底，防止在 iOS jitless 环境下缺少 exports 属性引发 TypeError: exports.init is not a function
if (typeof globalThis.WebAssembly !== 'undefined' && globalThis.WebAssembly.Instance) {
    const OrigInstance = globalThis.WebAssembly.Instance;
    try {
        class SafeInstance extends OrigInstance {
            constructor(module, importObject) {
                super(module, importObject);
                if (!this.exports) this.exports = {};
                if (typeof this.exports.init !== 'function') this.exports.init = () => {};
                if (typeof this.exports.update !== 'function') this.exports.update = () => {};
                if (typeof this.exports.final !== 'function') this.exports.final = () => {};
                if (typeof this.exports.digest !== 'function') this.exports.digest = () => '00000000';
                if (!this.exports.memory || !this.exports.memory.buffer) {
                    this.exports.memory = { buffer: new ArrayBuffer(65536) };
                }
            }
        }
        globalThis.WebAssembly.Instance = SafeInstance;
    } catch (_) {}
}

// 关键环境变量设置
process.env.ST_DISABLE_SHARP = 'true';
process.env.NODE_ENV = 'production';
process.env.AUTO_LAUNCH = 'false';
process.env.NO_BROWSER = 'true';
process.env.BROWSER = 'none';

// 重定向 console.error 和 console.warn 到 process.stdout，保证写进 server.log
const origError = console.error;
const origWarn = console.warn;
console.error = function(...args) {
    process.stdout.write('[ERR] ' + util.format(...args) + '\n');
    origError.apply(console, args);
};
console.warn = function(...args) {
    process.stdout.write('[WARN] ' + util.format(...args) + '\n');
    origWarn.apply(console, args);
};

console.log('[ios-loader] ==========================================');
console.log('[ios-loader] SillyClient iOS Node.js Runtime Starting');
console.log(`[ios-loader] Node.js Version: ${process.version}`);
console.log('[ios-loader] ==========================================');

// 保持 libuv 事件循环长久活跃，绝不因短暂空闲退出
const keepAliveTimer = setInterval(() => {}, 60000);
const statusDirectory = path.dirname(process.env.TARVEN_SERVER_DIR || fileURLToPath(new URL('.', import.meta.url)));
let startupFailed = false;
let serviceReady = false;

function reportStartupFailure(error) {
    if (serviceReady || startupFailed) return;
    startupFailed = true;
    const message = String(error?.message || error || 'Unknown startup failure').slice(0, 2000);
    try {
        fs.writeFileSync(path.join(statusDirectory, 'server-failed.json'), JSON.stringify({ message }));
    } catch (writeError) {
        console.log('[ios-loader] Could not write startup failure marker:', writeError.message);
    }
}

for (const name of ['server-ready.txt', 'server-failed.json']) {
    fs.rmSync(path.join(statusDirectory, name), { force: true });
}

// 拦截 process.exit，防止 SillyTavern 或第三方库杀死 iOS 宿主 App 进程
const originalExit = process.exit;
process.exit = function(code) {
    console.log(`[ios-loader] Intercepted process.exit(${code}) - suppressed to prevent host crash.`);
    if (code !== 0) {
        console.log(new Error('[ios-loader] Stacktrace for non-zero exit:').stack);
    }
    reportStartupFailure(new Error(`SillyTavern exited before becoming ready (code ${code}).`));
};

process.on('uncaughtException', (err) => {
    console.log('[ios-loader] 捕获未处理异常 (已拦截防闪退):', err && err.message, err && err.stack);
    reportStartupFailure(err);
});

process.on('unhandledRejection', (reason) => {
    console.log('[ios-loader] 捕获未处理 Promise 拒绝:', reason && (reason.stack || reason.message || reason));
    reportStartupFailure(reason);
});

// 计算当前脚本所在目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 查找 server.js
let serverDir = __dirname;
let serverEntry = path.join(serverDir, 'server.js');

if (!fs.existsSync(serverEntry)) {
    if (process.env.TARVEN_SERVER_DIR && fs.existsSync(path.join(process.env.TARVEN_SERVER_DIR, 'server.js'))) {
        serverDir = process.env.TARVEN_SERVER_DIR;
        serverEntry = path.join(serverDir, 'server.js');
    }
}

console.log(`[ios-loader] SillyTavern serverDirectory: ${serverDir}`);
console.log(`[ios-loader] Loading server entry: ${serverEntry}`);

// 确保当前工作目录切换为 serverDir
if (process.cwd() !== serverDir) {
    try {
        process.chdir(serverDir);
        console.log(`[ios-loader] Successfully changed cwd to: ${serverDir}`);
    } catch (chdirErr) {
        console.log('[ios-loader] Warning: failed to chdir to serverDir:', chdirErr);
    }
}

// 确保必要的子目录存在，防止只读/缺失报错
const requiredDirs = [
    path.join(serverDir, 'backups', '_migration'),
    path.join(serverDir, 'data', '_storage'),
    path.join(serverDir, 'data', '_errors'),
    path.join(serverDir, 'data', 'default-user')
];
for (const rd of requiredDirs) {
    try {
        if (!fs.existsSync(rd)) {
            fs.mkdirSync(rd, { recursive: true });
        }
    } catch (dirErr) {
        console.log('[ios-loader] Directory ensure notice:', rd, dirErr && dirErr.message);
    }
}

// 监听 SillyTavern 事件总线
try {
    const eventsPath = path.join(serverDir, 'src', 'server-events.js');
    if (fs.existsSync(eventsPath)) {
        const eventsModule = pathToFileURL(eventsPath).href;
        const { serverEvents, EVENT_NAMES } = await import(eventsModule);
        serverEvents.on(EVENT_NAMES.SERVER_STARTED, ({ url }) => {
            if (startupFailed) return;
            serviceReady = true;
            console.log(`[ios-loader] 🎉 SillyTavern 官方服务真正监听就绪: ${url}`);
            const candidates = [
                process.env.DATA_DIR,
                path.join(serverDir, 'data'),
                path.dirname(serverDir)
            ];
            for (const c of candidates) {
                if (c && fs.existsSync(c)) {
                    try {
                        fs.writeFileSync(path.join(c, 'server-ready.txt'), 'ready');
                        console.log(`[ios-loader] Written server-ready.txt to: ${c}`);
                    } catch (_) {}
                }
            }
        });
    }
} catch (evErr) {
    console.log('[ios-loader] Notice: could not hook server-events early:', evErr && evErr.message);
}

// 运行时防御性检查与修补 (确保无遗留 ICU 正则阻断)
try {
    const patchScript = path.join(serverDir, 'patch-sillytavern.mjs');
    if (fs.existsSync(patchScript)) {
        console.log('[ios-loader] 执行运行时环境防御性补丁...');
        await import(pathToFileURL(patchScript).href);
    }
} catch (pErr) {
    console.log('[ios-loader] Defense patch notice:', pErr && pErr.message);
}

if (fs.existsSync(serverEntry)) {
    try {
        if (typeof globalThis.WebAssembly === 'undefined') {
            // Node's built-in fetch lazily loads Undici's WASM HTTP parser.
            const fetchGlobals = ['fetch', 'Headers', 'Request', 'Response', 'FormData', 'Blob', 'File'];
            // Replacing a lazy property directly can invoke its native getter.
            for (const name of fetchGlobals) delete globalThis[name];
            const require = createRequire(path.join(serverDir, 'package.json'));
            const fetchModule = await import(pathToFileURL(require.resolve('node-fetch')).href);
            for (const name of fetchGlobals) {
                Object.defineProperty(globalThis, name, {
                    value: fetchModule[name === 'fetch' ? 'default' : name],
                    configurable: true, enumerable: true, writable: true,
                });
            }
            console.log('[ios-loader] Using node-fetch without a WASM HTTP parser.');
        }
        const entryUrl = pathToFileURL(serverEntry).href;
        console.log(`[ios-loader] Importing SillyTavern server entry: ${entryUrl}`);
        await import(entryUrl);
        console.log('[ios-loader] SillyTavern server entry import complete, background startup in progress...');
    } catch (e) {
        console.log('[ios-loader] 加载 server.js 遇到严重错误:', e && e.message, e && e.stack);
        reportStartupFailure(e);
    }
} else {
    console.log(`[ios-loader] 错误: 未能在 ${serverEntry} 找到 SillyTavern server.js`);
    reportStartupFailure(new Error('SillyTavern server.js is missing.'));
}
