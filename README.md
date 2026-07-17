<p align="center">
  <img src="https://img.shields.io/badge/v1.4.1-e8365d?style=flat-square&labelColor=1a1625&color=e8365d" alt="version" />
  <img src="https://img.shields.io/badge/license-MIT-1a1625?style=flat-square&labelColor=1a1625&color=4a4a6a" alt="license" />
</p>

<h1 align="center">SillyClient</h1>

<p align="center">
  <a href="https://captchaaaaa.github.io/SillyClient/">Live Demo</a> &middot;
  <a href="https://github.com/CAPTCHAAAAA/SillyClient/releases">Download</a> &middot;
  <a href="https://github.com/CAPTCHAAAAA/SillyClient">Source</a>
</p>

<!-- [中文](#中文) | [English](#english) -->

---

## 中文

SillyClient 是 SillyTavern 的跨平台启动器，支持 Android 与 Windows。内置 Embedded Node.js，无需系统预装运行时即可管理 SillyTavern 实例。

### 下载

[GitHub Releases](https://github.com/CAPTCHAAAAA/SillyClient/releases)

| 平台 | 架构 / 要求 |
|------|-------------|
| Android | arm64-v8a, API 26+ |
| Windows | x64, Windows 10+ |

### 核心功能

- **多实例管理** — 同时管理本地与远程 SillyTavern 实例
- **一键安装** — 从 GitHub Release 拉取并自动部署 SillyTavern
- **进程控制** — 启动、停止、重启，完整生命周期管理
- **实时终端** — 内嵌终端面板，实时查看 Node.js 输出
- **数据管理** — 导入导出 SillyTavern 数据
- **平台适配** — Android 手势导航，Windows 窗口叠加模式

### 技术栈

| 层 | Android | Windows |
|----|---------|---------|
| 框架 | Kotlin + Capacitor 7 | Electron 33 + TypeScript |
| 共享 UI | React 19 + Vite + Tailwind CSS v4 | 同左 |
| 运行时 | Embedded Node.js | Embedded Node.js |

### 仓库结构

- **主仓库** — 文档与 Release 发布
- **Android 端** — Android 原壳工程
- **Windows 端** — Electron 桌面工程
- **前端共享** — React UI 代码库

### 构建

项目采用 pnpm workspace 管理。克隆各子仓库后，在共享前端目录执行 `pnpm install && pnpm build`，产物由各平台工程消费。

### License

[MIT](./LICENSE)

---

## English

SillyClient is a cross-platform launcher for SillyTavern, running on Android and Windows. It bundles Embedded Node.js so no separate runtime installation is required.

### Download

[GitHub Releases](https://github.com/CAPTCHAAAAA/SillyClient/releases)

| Platform | Architecture |
|----------|--------------|
| Android | arm64-v8a, API 26+ |
| Windows | x64, Windows 10+ |

### Features

- **Multi-instance management** — local and remote SillyTavern instances in one place
- **One-click install** — fetch and deploy SillyTavern from GitHub Releases automatically
- **Process control** — start, stop, restart with full lifecycle management
- **Live terminal** — embedded terminal panel for real-time Node.js output
- **Data portability** — import and export SillyTavern data
- **Platform-native UX** — gesture navigation on Android, overlay mode on Windows

### Tech Stack

| Layer | Android | Windows |
|-------|---------|---------|
| Framework | Kotlin + Capacitor 7 | Electron 33 + TypeScript |
| Shared UI | React 19 + Vite + Tailwind CSS v4 | Same |
| Runtime | Embedded Node.js | Embedded Node.js |

### Repository Layout

- **Main repo** — documentation and releases
- **Android** — native Android shell project
- **Windows** — Electron desktop project
- **Shared frontend** — React UI codebase

### Build

The project uses pnpm workspaces. After cloning each sub-repo, run `pnpm install && pnpm build` in the shared frontend directory. Platform projects consume the output artifacts.

### License

[MIT](./LICENSE)
