/**
 * SillyClient iOS Node.js 启动引导脚本 (ios-loader.mjs)
 *
 * 运行于 NodeMobile 进程内独立工作线程。
 * 职责：
 * 1. 拦截异常与 process.exit，杜绝由于 JS 异常或退出导致 iOS 宿主闪退；
 * 2. 强制启用 ST_DISABLE_SHARP=true，确保图像解码走纯 JS / WASM (@jimp)；
 * 3. 动态加载 server.js 核心并启动 SillyTavern 完整服务；
 * 4. 确保工作目录切换至 SillyTavern 根目录，保证内部相对路径和依赖解析正常。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

console.log('[ios-loader] ==========================================');
console.log('[ios-loader] SillyClient iOS Node.js Runtime Starting');
console.log(`[ios-loader] Node.js Version: ${process.version}`);
console.log('[ios-loader] ==========================================');

// 关键环境变量设置
process.env.ST_DISABLE_SHARP = 'true';
process.env.NODE_ENV = 'production';
process.env.AUTO_LAUNCH = 'false';
process.env.NO_BROWSER = 'true';
process.env.BROWSER = 'none';

// 拦截 process.exit，防止 SillyTavern 或第三方库杀死 iOS 宿主 App 进程
const originalExit = process.exit;
process.exit = function(code) {
    console.error(`[ios-loader] Intercepted process.exit(${code}) - suppressed to prevent host crash.`);
    if (code !== 0) {
        console.error(new Error('[ios-loader] Stacktrace for non-zero exit:').stack);
    }
};

process.on('uncaughtException', (err) => {
    console.error('[ios-loader] 捕获未处理异常 (已拦截防闪退):', err && err.message, err && err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ios-loader] 捕获未处理 Promise 拒绝:', reason);
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
        console.error('[ios-loader] Warning: failed to chdir to serverDir:', chdirErr);
    }
}

// 确保 config.yaml 存在并禁用浏览器自启
try {
    const configPath = path.join(serverDir, 'config.yaml');
    let configContent = '';
    if (fs.existsSync(configPath)) {
        configContent = fs.readFileSync(configPath, 'utf8');
    }
    if (!configContent.includes('browserLaunch')) {
        const extraConfig = '\nbrowserLaunch:\n  enabled: false\nlisten: false\n';
        fs.appendFileSync(configPath, extraConfig);
        console.log('[ios-loader] Injected browserLaunch.enabled: false into config.yaml');
    }
} catch (configErr) {
    console.error('[ios-loader] Warning: could not check/update config.yaml:', configErr);
}

if (fs.existsSync(serverEntry)) {
    try {
        const entryUrl = pathToFileURL(serverEntry).href;
        console.log(`[ios-loader] Importing SillyTavern server entry: ${entryUrl}`);
        await import(entryUrl);
        console.log('[ios-loader] SillyTavern 核心服务已成功拉起，正在监听端口！');
    } catch (e) {
        console.error('[ios-loader] 加载 server.js 遇到错误:', e && e.message, e && e.stack);
    }
} else {
    console.error(`[ios-loader] 错误: 未能在 ${serverEntry} 找到 SillyTavern server.js`);
}
