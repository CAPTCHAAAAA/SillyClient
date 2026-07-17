# SillyClient

跨平台 SillyTavern 启动器。Android / Windows 双端，内置 Node.js 运行时，安装即用，无需 Termux，无需命令行。

Cross-platform SillyTavern launcher. Embedded Node.js runtime. No Termux, no CLI.

[![Release](https://img.shields.io/github/v/release/CAPTCHAAAAA/SillyClient?style=flat-square&color=e8365d&labelColor=1a1625)](https://github.com/CAPTCHAAAAA/SillyClient/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

**[Live Demo](https://captchaaaaa.github.io/SillyClient/)**

## Platforms

| Platform | Arch | Min Version | Status |
|----------|------|-------------|--------|
| Android | arm64-v8a | 7.0 (API 26) | v1.4.1 |
| Windows | x64 | 10 | v1.4.1 |

## Tech Stack

| Layer | Android | Windows | Shared |
|-------|---------|---------|--------|
| Native | Kotlin, Capacitor 7 | Electron 33, TypeScript | |
| UI | | | React 19, Vite 7, Tailwind CSS v4 |
| Runtime | Embedded Node.js (cross-compiled binary) | Embedded Node.js v22 (bundled `node.exe`) | |

Both platforms share the same React frontend via a Capacitor shim bridge. The web layer requires zero modification to run on either platform.

## Features

- Multi-instance management with local and remote server support
- GitHub release fetching and one-click SillyTavern installation from zip
- Process lifecycle control (start, stop, port detection)
- Real-time terminal panel with command input
- Data import/export and garbage collection
- Swipe gestures on Android (status bar drag-down to return to launcher)
- Overlay tavern window on Windows (main window stays visible)

## Repositories

| Repo | Purpose |
|------|---------|
| [SillyClient](https://github.com/CAPTCHAAAAA/SillyClient) | Documentation, releases, project overview |
| [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android) | Android client source (Kotlin + Capacitor) |
| [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows) | Windows client source (Electron + TypeScript) |
| [SillyClient-Frontend](https://github.com/CAPTCHAAAAA/SillyClient-Frontend) | Shared frontend components |

Releases and tags are published on the main repo only. Platform repos store source code.

## Build

### Prerequisites

- Android: Gradle 8+, JDK 17
- Windows: Node.js 22+ (dev only), pnpm, Electron 33+

### Android

```bash
cd web/capacitor-ui
pnpm install && pnpm build
cp -r dist/* ../../app/src/main/assets/public/
cd ../..
./gradlew :app:assembleRelease
```

### Windows

```bash
npm install
npm run build:web
cp -r web/capacitor-ui/dist/* frontend-dist/
npm run pack
```

Output: `release/SillyClient Setup 1.4.1.exe`

## Download

[Releases](https://github.com/CAPTCHAAAAA/SillyClient/releases)

## License

[MIT](https://opensource.org/licenses/MIT)
