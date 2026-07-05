# SillyClient 架构设计

> 最后更新：2026-07-05

## 总体架构

SillyClient 采用 **原生壳 + WebView 前端 + 嵌入式运行时** 三层架构。

```
┌─────────────────────────────────────────┐
│              SillyClient App             │
│  ┌─────────────────────────────────┐    │
│  │     Capacitor WebView (前端)      │    │
│  │  ┌───────────┐ ┌─────────────┐  │    │
│  │  │  启动器UI   │ │  终端面板    │  │    │
│  │  └───────────┘ └─────────────┘  │    │
│  └──────────┬──────────────────────┘    │
│             │ TarvenEnv Plugin            │
│  ┌──────────▼──────────────────────┐    │
│  │      原生壳 (Kotlin)              │    │
│  │  ┌──────────┐ ┌──────────────┐  │    │
│  │  │ Node.js  │ │ SillyTavern  │  │    │
│  │  │ 运行时    │ │ (HTTP :port) │  │    │
│  │  └──────────┘ └──────────────┘  │    │
│  └─────────────────────────────────┘    │
│  ┌─────────────────────────────────┐    │
│  │     沉浸式 WebView (酒馆)         │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

## 分层职责

### 1. 前端层（Capacitor WebView）

- **技术栈**：React 19 + Vite 7 + Tailwind CSS v4
- **职责**：启动器主界面、实例管理、终端面板、设置面板
- **通信**：通过 `@capacitor/core` 的 `registerPlugin` 调用原生插件
- **产物**：构建后拷贝到 `app/src/main/assets/public/`

### 2. 原生壳层（Kotlin）

- **基类**：`MainActivity` 继承 `BridgeActivity`（Capacitor 7）
- **核心插件**：`TarvenEnvPlugin` — 封装所有原生能力
- **职责**：
  - Node.js 进程管理（启动/停止/通信）
  - SillyTavern 实例配置（config.yaml 写入）
  - 文件系统操作（扫描/清理/卸载）
  - WebView 沉浸式模式控制
  - GitHub API 调用（releases 拉取）

### 3. 运行时层

- **Node.js**：嵌入式运行时，打包为 `.so` 库
- **SillyTavern**：首启从 GitHub 下载 zipball，解压到本地目录
- **通信**：Node 进程的 stdout/stderr 通过事件推送到前端终端

## 插件接口（TarvenEnvPlugin）

| 方法 | 用途 |
|------|------|
| `provisionAndStart` | 下载 + 配置 + 启动 SillyTavern 实例 |
| `enterImmersive` | 进入沉浸式 WebView 承载酒馆 |
| `exitImmersive` | 退出沉浸式返回启动器 |
| `getStatus` | 查询服务就绪状态 |
| `scanInstances` | 扫描本地已存在的实例 |
| `getInstanceInfo` | 读取实例详情（版本/大小/路径） |
| `fetchReleases` | 拉取 GitHub SillyTavern releases |
| `pickDirectory` | 系统目录选择器 |
| `pickImage` | 系统图片选择器（封面） |
| `sendCommand` | 向 Node stdin 发送命令 |
| `reloadTavern` | 刷新酒馆 WebView |
| `clearWebViewData` | 清空 WebView 缓存 |
| `getSafeInsets` | 获取安全区 insets |
| `setPullToRefresh` | 启用/禁用下拉刷新 |
| `pingUrl` | 探测远程实例在线状态 |
| `uninstallInstance` | 卸载实例（删除文件） |
| `cleanGarbage` | 扫描垃圾文件 |
| `deleteGarbageItem` | 删除指定垃圾项 |

## 事件系统

插件通过 `notifyListeners` 向前端推送事件：

| 事件 | 触发时机 |
|------|----------|
| `log` | Node 进程输出日志 |
| `progress` | 下载/解压进度更新 |
| `ready` | 服务就绪 |
| `mode` | 模式切换（launcher/immersive） |

## 多端架构

SillyClient 设计为多端软件，各端共享前端 UI 源码，原生壳各自实现：

| 端 | 原生壳 | 前端 |
|----|--------|------|
| Android | Kotlin + Capacitor | React（capacitor-ui） |
| Windows | 规划中（Tauri/Electron） | React（复用共享前端） |

共享前端源码存放于 [SillyClient-Frontend](https://github.com/CAPTCHAAAAA/SillyClient-Frontend) 仓库。
