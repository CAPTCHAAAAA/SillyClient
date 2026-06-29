# SillyClient 架构说明

> 项目架构的总览文档。动手前先读，改动方向请对照下述约定。

最后更新：2026-06-29

---

## 0. 一句话定位

**SillyClient** 把 SillyTavern 在设备上本地化运行：随 App 打包服务端，本地启动，前端套壳。
品牌名 **SillyClient 唯一**，跨所有框架 / 平台 / UI 统一，**不接受** `Tarven++` / `TarvenPlus` 等别名。

---

## 1. 核心理念：插件化多端（必读）

### 1.1 问题
不同平台的"底座"完全不同：
- **安卓**：没有现成 Node，必须把 Node.js 以原生库（`libtarven-node.so`）打包进 App，运行时解压、用 `ProcessBuilder` 拉起，监听 `127.0.0.1:8000`。
- **PC**：系统里已有 Node，SillyTavern 直接跑在系统 Node 上，**不走虚拟机那套**。
- **iOS**：又是另一套约束。

如果每个平台从零把"启动器 + 阅读环境"重写一遍，工作量爆炸、维护噩梦、bug 满天。

### 1.2 解法：把"一整个原生阅读环境"封装成插件

**关键认知：插件封装的是"一个完整的沉浸式阅读环境"，不是零散的能力方法集合。**

一个插件实现，内部完整包含：
- Node.js 的启动 / 下载 / 检测 / 配置 / 轮询就绪
- **一个原生 WebView 承载酒馆**（加载 `127.0.0.1:8000` 或远程地址）
- 沉浸式（刘海/状态栏适配、SHORT_EDGES、抗 MIUI/HyperOS）
- 变色龙顶框（PixelCopy 取色 → scrim/光波/色波）
- 进/出阅读环境的生命周期

webUI（控制台）**永远只调统一的插件接口**，不知道底下是安卓虚拟机还是 PC 系统 Node。
**新增平台 = 新增一份插件实现去填接口，webUI 零改动。**

### 1.3 约定（务必遵守）

| 编号 | 约定 |
|---|---|
| **B1** | 品牌名统一 `SillyClient`，全平台全框架。 |
| **B2** | **酒馆（SillyTavern）永远由插件内的原生 WebView 承载，Capacitor 不渲染酒馆。** Capacitor 的 WebView 只承载控制台 webUI。 |
| **B3** | 启动器本体（环境检测/下载/配置/启动/打开阅读环境）**已完善，不重写**。要做的是封装成插件，不是再造一遍。 |
| **B4** | 锁定项（Node 运行时 / 变色龙顶框 / 沉浸式）原逻辑不动，只加插件接口。详见第 5 节。 |
| **B5** | **最终只存活一个工程：`com.sillyclient`**。它 Capacitor 化后仍叫 `com.sillyclient` / appName `SillyClient` / 仓库 `SillyClient`。`TarvenIonicApp` 那条重写线**作废**。 |

---

## 2. 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  控制台 webUI (React/Ionic, Capacitor WebView 承载)           │
│  只调统一接口，不认平台。可做"环境管理器"(ComfyUI 式)。        │
└───────────────────────────┬─────────────────────────────────┘
                            │ Capacitor plugin 接口
                            │ (provision / start / enter / …)
┌───────────────────────────┴─────────────────────────────────┐
│  插件接口契约层 (TS interface，全平台共享，写一次)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ 各平台各写一份实现去填接口
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
  安卓插件实现          PC 插件实现         iOS 插件实现
  (Node 虚拟机)         (系统 Node)         (待定)
  ────────────         ────────────         ────────────
  libtarven-node.so    spawn 系统 Node      …
  原生 WebView 承 ST   原生 WebView 承 ST   …
  沉浸式/顶框          沉浸式/顶框          …
```

### 2.1 接口契约层（写一次，全平台共享）

Capacitor plugin 的 TypeScript 接口声明。webUI 只 import 这个，绝不直接碰原生。
**所有平台共享同一份接口，差异只在实现。**

### 2.2 平台实现层

每个平台一份 `@CapacitorPlugin` 实现，填契约层的接口。
安卓复用现有已完善的代码（见第 4 节），**不重写**。

### 2.3 多环境层（ComfyUI 式，规划中）

一个系统上可配多个环境，可切换：
- 安卓本地虚拟机环境
- PC 本地 Node 环境
- 远程服务器环境

webUI 提供"环境管理器"：增删环境 / 切换当前环境 / 启停。
酒馆 WebView 的加载地址跟随当前环境（`127.0.0.1:8000` / 远程 URL / …）。

---

## 3. 两个 WebView 的分工（约定 B2 详解）

| WebView | 承载 | 谁渲染 | 归属 | 说明 |
|---|---|---|---|---|
| **Capacitor WebView** | 控制台 webUI | Capacitor (React/Ionic) | 控制层 | 控制台通过插件接口控制阅读环境 |
| **插件内原生 WebView** | 酒馆 SillyTavern | 插件自己（原生） | 阅读环境层 | 承载 `127.0.0.1:8000`，叠沉浸式/顶框 |

**为什么这样分？**
- 酒馆是远端内容（跨源 iframe），JS 读不到其文档、canvas 会被污染。沉浸式/顶框这些**重活必须原生做**，所以酒馆 WebView 归插件内部。
- 控制台是自有 webUI，跨平台复用，由 Capacitor 承载最合适。
- **两者职责正交，绝不混淆。**

---

## 4. 现有安卓代码怎么变插件（不重写，只封装）

### 4.1 现有能力清单（已完善，能跑）

| 能力 | 现有实现 | 状态 |
|---|---|---|
| Node.js 本地运行时 | `runtime/*`（AssetExtractor/RuntimeFileUtils/RuntimePaths/TarvenProcessRunner/TarvenRuntimeManager）+ MainActivity 供水链路（provisionAndStart/extractNativeLibs/downloadAndExtractServer/startServer/pollUntilReady） | **锁定** |
| 原生 WebView 承酒馆 | `webView`/`webViewScreen` 加载 `127.0.0.1:8000` | 锁定 |
| 沉浸式 / 进出酒馆 | `switchToWebView`/`enterTavern`/`exitTavern`/`enterImmersive`/刘海取 px | 锁定 |
| 变色龙顶框 | `sampleTopColor`(PixelCopy) + `TopScrimBar` + `TopColor`（`DO NOT CHANGE`） | **锁定** |
| 自撸桥（待替代） | `TarvenN.invoke` / `__tarvenDispatch`（HybridUiHost + web/bridge.ts） | 渐进替代为插件接口 |

### 4.2 封装做法

**不是在另一个工程重写，是在现有 `com.sillyclient` 上加 Capacitor 插件层。**

1. 现有工程加 Capacitor 依赖（`@capacitor/android`）。
2. MainActivity 继承 `BridgeActivity`（Capacitor 宿主），**保留全部现有逻辑**。
3. 把"一整个阅读环境"那块（Node 启动 + WebView 承 ST + 沉浸式 + 顶框）整体包成 `TavernEnvPlugin`，`@PluginMethod` 暴露进/出/取色/状态等控制接口。
4. 控制台 webUI（现有 `web/console`）经 `@capacitor/core` 调插件。
5. 酒馆仍是插件内原生 WebView，**不动**。

### 4.3 插件接口草案（控制台 → 阅读环境）

```ts
interface TavernEnvPlugin {
  provision(envId?: string): Promise<void>       // 配置环境（下载/检测/解压）
  start(envId?: string): Promise<{ url: string }> // 启动，返回酒馆地址
  stop(envId?: string): Promise<void>
  status(envId?: string): Promise<{ ready: boolean }>
  enterImmersive(): Promise<void>                 // 进沉浸式（插件搭原生 WebView 承 ST + 顶框）
  exitImmersive(): Promise<void>
  getColor(): Promise<{ hex: string }>            // 取当前顶框色
  // 多环境（后续）
  listEnvironments(): Promise<Environment[]>
  addEnvironment(config): Promise<Environment>
  removeEnvironment(id: string): Promise<void>
  setCurrent(id: string): Promise<void>
}
```

---

## 5. 锁定项与约束（不可擅改）

### 5.1 变色龙顶框（`DO NOT CHANGE`）

- **取色层**：`MainActivity.sampleTopColor`，PixelCopy 读 WebView 顶部 3px×全宽条带 → 平均非透明像素。
- **渲染层**：`TopScrimBar`（scrim 三段渐变 45/80/100% + 点击白色光波 + 自下而上色波）+ `TopColor`（纯色数学）。
- **约束**：酒馆是远端跨源 iframe，JS 取不到色、canvas 被污染，**取色层无可移植 API，必须各端原生**（Android=PixelCopy / iOS=UIGraphics / 桌面=离屏捕获）。
- 历史背景：远程 `main` 分支曾有更重的 `ChameleonController`（单动画器版），本项目保留**轻量版 TopScrimBar**。

### 5.2 Node.js 运行时

- Node v24 Bionic，以 `libtarven-node.so` + `libc++_shared.so`（arm64-v8a）打包。
- `rootfs-libs.zip` 运行时解压，`ProcessBuilder` 拉起，监听 `127.0.0.1:8000`。
- 首启从 GitHub Release 下 `server-source.zip`（SillyTavern + node_modules）。
- PC 平台**不走这套**，直接用系统 Node。

### 5.3 沉浸式 / 刘海适配
`DisplayCutout` 取硬件像素（`statusBarFixedPx`），SHORT_EDGES 沉浸式，专门抗 MIUI/HyperOS 系统行为。

---

## 6. 路线与阶段

### 当前阶段：工程 Capacitor 化 + 封装 TavernEnvPlugin
- [ ] 现有 `com.sillyclient` 加 `@capacitor/android`
- [ ] MainActivity → `BridgeActivity`，保留全逻辑
- [ ] 封装 `TavernEnvPlugin`，复用现有 Node 启动 / WebView / 沉浸式 / 顶框
- [ ] 控制台 webUI 经 `@capacitor/core` 调插件
- [ ] 自撸 `TarvenN` 桥渐进退役

### 后续阶段
- PC 端插件实现（系统 Node，不走虚拟机）
- iOS 端插件实现
- 多环境管理器（ComfyUI 式）

### 已作废（不再投入）
- `TarvenIonicApp`（`com.tarven.plus`）：在其中重写 `TarvenServerPlugin` 的整条线。
  错误在于"重写壳"而非"封装插件"，且包名/品牌违背铁律。仅作探索参考保留。

---

## 7. 历史记录（写给后来者）

1. **不要重写已完善的启动器本体。** 2026-06 期间曾在 `TarvenIonicApp` 里把 Node 启动/进酒馆又写了一遍，结果踩了 kotlin 插件未配置（`ClassNotFoundException`）、pnpm deps 校验拦截、jvmTarget 不匹配等一堆 Capacitor/Ionic 工具链坑，纯属重复劳动。**正确做法是封装成插件。**

2. **酒馆渲染权永远在插件内的原生 WebView。** 不要试图让 Capacitor 去渲染酒馆。酒馆是远端跨源内容，沉浸式/顶框必须原生做。

3. **品牌名只有 SillyClient。** 历史上 `Tarven++` / `TarvenPlus` 混用过，造成仓库与应用名漂移。统一用 SillyClient。

4. **取色层没有可移植 API。** 别想在 JS 里读酒馆顶色——跨源 iframe 挡死。各端原生（PixelCopy/UIGraphics/离屏捕获）。

5. **多端复用的是 webUI 和接口契约，不是原生重活。** Node 启动、取色、沉浸式这些重活仍要各端原生重写，Capacitor 只省下 UI 壳和控制接口那一层。

---

## 8. 目录与关键文件（当前 `com.sillyclient`）

```
app/src/main/java/com/sillyclient/
├── MainActivity.kt              # 宿主：环境搭建 + 阅读环境（待包成插件）
├── runtime/                     # Node 运行时（锁定）
│   ├── AssetExtractor.kt
│   ├── RuntimeFileUtils.kt
│   ├── RuntimePaths.kt
│   ├── TarvenProcessRunner.kt
│   └── TarvenRuntimeManager.kt
└── ui/
    ├── HybridUiHost.kt          # 自撸桥（待退役），承载启动页 webUI
    ├── TopScrimBar.kt           # 变色龙顶框渲染（锁定，DO NOT CHANGE）
    └── TopColor.kt              # 取色纯数学（锁定）

web/
├── launch/                      # 启动页 webUI（Vite 单文件 React）
└── console/                     # 控制台 webUI（待经 @capacitor/core 接入）

app/src/main/assets/ui/launch/   # 启动页构建产物
```

---

## 9. 相关链接

- 仓库：https://github.com/CAPTCHAAAAA/SillyClient
- Capacitor 转型探索工程（已作废，仅参考）：https://github.com/CAPTCHAAAAA/SillyClient-Capacitor
- 当前安卓基线 Release：`v0.6-sillyclient-baseline`（分支 `sillyclient-baseline`）
