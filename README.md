# SillyClient

> 多端 SillyTavern 本地运行环境，让酒馆在手机和桌面上开箱即用。

SillyClient 是一个跨平台的 SillyTavern 启动器与管理工具。它将 Node.js 运行时和 SillyTavern 服务封装为原生应用，无需 Termux、Docker 或命令行操作，安装即用。

## 平台支持

| 平台 | 状态 | 仓库 |
|------|------|------|
| Android | v1.0.0 已发布 | [SillyClient-Android](modules/android/) |
| Windows | 规划中 | — |

## 核心功能

### 实例管理
- 多实例创建与切换，支持本地实例和远程连接
- GitHub 版本动态拉取，一键选择 SillyTavern 版本
- 卡片式轮播界面，支持自定义封面图
- 实例配置持久化，端口/网络/协议参数可调

### 启动与运行
- 嵌入式 Node.js 运行时，无需外部依赖
- 本地实例一键启动，自动下载并配置 SillyTavern
- 远程实例在线检测，15 秒轮询自动刷新状态
- 沉浸式 WebView 承载酒馆界面

### 开发者工具
- 实时终端面板，查看日志、发送命令
- 字号调节、面板拖拽缩放
- 酒馆页面一键刷新

### 数据管理
- 数据导入导出（JSON 备份/恢复）
- 垃圾清理（扫描孤立文件、临时文件、缓存）
- 实例卸载（原生清理安装目录）
- WebView 缓存清理

### 界面定制
- 动态光效背景 / 自定义壁纸
- 暗色 / 亮色主题切换
- 9 种 Logo 字体循环切换
- 挖孔屏安全区自动避让

### 交互体验
- 下拉刷新（iOS 风格阻尼动画）
- 实例搜索与快速跳转
- 卡片管理菜单（重命名 / 换图 / 卸载）
- 触屏 + 鼠标双重适配

## 下载

前往 [Releases](../../releases) 页面下载最新版本。

### Android 安装

1. 下载 APK 文件
2. 允许"安装未知来源应用"
3. 打开 SillyClient，首次启动会自动下载 SillyTavern
4. 选择版本，点击启动即可

> 最低系统要求：Android 7.0 (API 24)  
> 架构：arm64-v8a

## 仓库结构

本项目采用 Git 子模块架构，各端独立开发：

```
SillyClient/                   ← 主仓库（你在这里）
├── README.md                  ← 项目介绍
├── LICENSE                    ← MIT 协议
├── docs/                      ← 架构文档
├── release/                   ← 发布说明
└── modules/                   ← 各端子模块
    ├── android/               ← → SillyClient-Android
    └── frontend/              ← → SillyClient-Frontend
```

| 仓库 | 说明 |
|------|------|
| [SillyClient](.) | 主仓库：项目入口、文档、Release |
| [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android) | Android 端：原生壳 + Capacitor 前端 |
| [SillyClient-Frontend](https://github.com/CAPTCHAAAAA/SillyClient-Frontend) | 共享前端：启动页 / 状态栏 UI 源码 |

## 构建

### 克隆（含子模块）

```bash
git clone --recurse-submodules https://github.com/CAPTCHAAAAA/SillyClient.git
```

### Android 构建

详见 [Android 构建指南](modules/android/docs/BUILD.md)。

简要步骤：
```bash
cd modules/android
cd web/capacitor-ui && pnpm install && pnpm build
cp dist/* ../../app/src/main/assets/public/
cd ../.. && ./gradlew :app:assembleDebug
# 产物：app/build/outputs/apk/debug/app-debug.apk
```

## 技术栈

| 层 | 技术 |
|----|------|
| Android 原生壳 | Kotlin + Capacitor 7 + Gradle |
| 前端 UI | React 19 + Vite 7 + Tailwind CSS v4 |
| 路由与数据 | TanStack Router + TanStack Query |
| 运行时 | 嵌入式 Node.js（Termux bootstrap） |
| 目标服务 | [SillyTavern](https://github.com/SillyTavern/SillyTavern) |

## 文档

- [架构设计](docs/ARCHITECTURE.md)
- [更新日志](release/CHANGELOG.md)

## 致谢

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) — 本项目封装的目标服务
- [Capacitor](https://capacitorjs.com/) — 跨平台原生桥接框架
- [Termux](https://termux.dev/) — Node.js 运行时 bootstrap 来源

## License

[MIT](LICENSE)
