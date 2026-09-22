/**
 * SillyClient iOS Node.js 启动引导脚本 (ios-loader.mjs)
 *
 * 运行于 NodeMobile 进程内独立工作线程。
 * 职责：
 * 1. 拦截异常，杜绝由于 JS 异常导致 iOS 宿主闪退；
 * 2. 强制启用 ST_DISABLE_SHARP=true，确保图像解码走纯 JS / WASM (@jimp)；
 * 3. 动态加载 server.js 核心并启动 SillyTavern 完整服务。
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

console.log('[ios-loader] ==========================================');
console.log('[ios-loader] SillyClient iOS Node.js Runtime Starting');
console.log(`[ios-loader] Node.js Version: ${process.version}`);
console.log('[ios-loader] ==========================================');

process.env.ST_DISABLE_SHARP = 'true';
process.env.NODE_ENV = 'production';

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
    // 尝试在环境变量中查找 TARVEN_SERVER_DIR
    if (process.env.TARVEN_SERVER_DIR && fs.existsSync(path.join(process.env.TARVEN_SERVER_DIR, 'server.js'))) {
        serverDir = process.env.TARVEN_SERVER_DIR;
        serverEntry = path.join(serverDir, 'server.js');
    }
}

console.log(`[ios-loader] SillyTavern serverDirectory: ${serverDir}`);
console.log(`[ios-loader] Loading server entry: ${serverEntry}`);

if (fs.existsSync(serverEntry)) {
    try {
        await import(serverEntry);
        console.log('[ios-loader] SillyTavern 核心服务已成功拉起，正在监听端口！');
    } catch (e) {
        console.error('[ios-loader] 加载 server.js 遇到错误:', e);
    }
} else {
    console.error(`[ios-loader] 错误: 未能在 ${serverEntry} 找到 SillyTavern server.js`);
}
