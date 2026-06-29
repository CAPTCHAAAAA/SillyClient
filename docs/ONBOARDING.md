# 新人上手指南

> 给接手 SillyClient 的人。先读 [`ARCHITECTURE.md`](./ARCHITECTURE.md) 了解架构与约定，再读本指南动手。

## 环境要求

| 工具 | 版本 | 说明 |
|---|---|---|
| JDK | 17+ | 当前实测 25 亦可，源码兼容 17 |
| Android SDK | compileSdk 37 / minSdk 26 / targetSdk 37 | |
| Node.js | 18+（建议 20+） | 构建 web 模块用 |
| pnpm | 8+ | web 模块依赖管理 |
| 设备 | arm64-v8a，Android 8.0+ | 首启需联网下 ~136MB server-source |

`gradlew` wrapper 已在仓库根，无需全局 Gradle。

## 第一次构建（安卓）

```bash
# 1. 原生壳（含已完善的启动器本体）
./gradlew :app:assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk

# 2. 启动页 webUI（如改动过 web/launch）
cd web/launch
pnpm install        # 首次
pnpm build          # vite-plugin-singlefile → dist/index.html（自包含单文件）
cp dist/index.html ../../app/src/main/assets/ui/launch/index.html
# 再跑步骤 1 重新打 APK
```

## 装机运行（adb）

```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
# 保留数据用 -r（避免首启重下 136MB）。干净安装去掉 -r。
adb shell monkey -p com.sillyclient -c android.intent.category.LAUNCHER 1
```

首启流程：App 启动 → 下载解压 server-source → 启 Node → 轮询 `127.0.0.1:8000` 就绪 → WebView 加载酒馆。

## 调试

- WebView 远程调试：`chrome://inspect`（已开 `setWebContentsDebuggingEnabled`）。
- 原生日志：`adb logcat -s SillyClient:* HybridUiHost:* AndroidRuntime:E`
- 服务端日志：`adb shell run-as com.sillyclient cat files/tarven/logs/server.log | tail -50`
- 端口检查：`adb shell "cat /proc/net/tcp | grep ':1F40'"`（8000 = 0x1F40）

## 关键路径速查

| 想做的事 | 看哪里 |
|---|---|
| 理解启动流程 | `MainActivity.kt` onCreate → 恢复/初始化分支 |
| 改 Node 启动 | `runtime/*`（锁定，谨慎） + MainActivity 供水链路 |
| 改顶框取色/渲染 | `MainActivity.sampleTopColor` / `ui/TopScrimBar.kt` / `ui/TopColor.kt`（DO NOT CHANGE） |
| 改沉浸式 | `enterImmersive`/`showSystemBars`/`statusBarFixedPx` |
| 改启动页 UI | `web/launch/src/`（React + Vite） |
| 改桥接 | `ui/HybridUiHost.kt`（自撸桥，待退役为插件） + `web/*/src/bridge.ts` |

## ⚠️ 不要踩的坑

1. **别重写启动器本体。** 见 ARCHITECTURE.md §7。封装成插件，不要另起工程重写。
2. **别让 Capacitor 渲染酒馆。** 酒馆归插件内原生 WebView（约定 B2）。
3. **别碰顶框代码**（`TopScrimBar`/`TopColor`/`sampleTopColor`），除非要加新平台的取色实现。
4. **品牌名只用 SillyClient。** 见约定 B1。
5. **别用强推 main。** 远程 `main` 是旧 `com.tarven.plus` + ChameleonController 历史；当前基线在 `sillyclient-baseline` 分支。

## Capacitor 化进行中（当前阶段）

工程正从"自撸桥"迁移到"Capacitor 插件化"。期间两套机制并存：
- 自撸 `TarvenN` 桥（`HybridUiHost` + `web/bridge.ts`）：当前在用。
- Capacitor 插件接口：逐步接管，最终替代自撸桥。

迁移目标见 ARCHITECTURE.md §6。**迁移期间不要删除自撸桥**，待插件接口完整覆盖后再退役。

## 提交规范

- 中文 commit，说清改了什么、为什么。
- 涉及锁定项（Node/顶框/沉浸式）的改动必须显式说明动机。
- 外发操作（push/release）需明确授权。

## 找不到答案？

读 `ARCHITECTURE.md` 全文 → 读 `MainActivity.kt` 与 `ui/HybridUiHost.kt` 全文 → 读 `web/launch/src/bridge.ts`。
这三处基本能解释整个系统。
