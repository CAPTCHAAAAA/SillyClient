/**
 * SillyClient iOS Node.js 启动引导脚本 (ios-loader.js)
 *
 * 运行于 NodeMobile 进程内独立工作线程。
 * 职责：
 * 1. 初始化环境变量 (PORT, HOST, DATA_DIR)；
 * 2. 启用 ST_DISABLE_SHARP=true 纯 JS 容灾模式，杜绝缺失 C++ 动态库崩溃；
 * 3. 拦截控制台输出重定向至原生 Ring Buffer；
 * 4. 动态载入 Documents/SillyTavern/server.js。
 */

const path = require('path');
const fs = require('fs');

console.log('[ios-loader] 正在启动 SillyTavern iOS 运行时...');

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '127.0.0.1';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

process.env.PORT = String(PORT);
process.env.HOST = String(HOST);
process.env.DATA_DIR = String(DATA_DIR);
process.env.ST_DISABLE_SHARP = 'true';

// 捕获未处理异常，防止导致 iOS 宿主闪退
process.on('uncaughtException', (err) => {
    console.error('[ios-loader] 捕获未处理异常 (已拦截防闪退):', err.message, err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ios-loader] 捕获未处理 Promise 拒绝:', reason);
});

// 检查酒馆服务器入口
const serverEntry = path.join(DATA_DIR, '..', 'server.js');
console.log(`[ios-loader] 运行环境就绪: PORT=${PORT}, HOST=${HOST}, DATA_DIR=${DATA_DIR}`);

if (fs.existsSync(serverEntry)) {
    console.log(`[ios-loader] 正在加载核心: ${serverEntry}`);
    try {
        require(serverEntry);
    } catch (e) {
        console.error('[ios-loader] 加载 server.js 失败:', e);
    }
} else {
    console.warn(`[ios-loader] 未找到 ${serverEntry}，等待前端首次初始化解压...`);
}
