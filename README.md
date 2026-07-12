# SillyClient

> 多端 SillyTavern 本地运行环境，让酒馆在手机和桌面上开箱即用。

SillyClient 是一个跨平台的 SillyTavern 启动器与管理工具。它将 Node.js 运行时和 SillyTavern 服务封装为原生应用，无需 Termux、Docker 或命令行操作，安装即用。

## 平台支持

| 平台 | 版本 | 状态 | 仓库 |
|------|------|------|------|
| Android | v1.4.0 | 已发布 | [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android) |
| Windows | v1.4.0 | 已发布 | [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows) |

## 下载

前往 [Releases](../../releases) 页面下载最新版本。

### Android

1. 下载 `SillyClient-1.4.0-android.apk`
2. 允许"安装未知来源应用"
3. 打开 SillyClient，选择本地 zip 或在线拉取 SillyTavern
4. 点击启动即可

> 最低系统要求：Android 7.0 (API 24)
> 架构：arm64-v8a

### Windows

1. 下载 `SillyClient-Setup-1.4.0.exe`
2. 运行安装程序，可选择安装路径
3. 打开 SillyClient，选择本地 zip 或在线拉取 SillyTavern
4. 点击启动即可

> 最低系统要求：Windows 10
> 内置 Node.js v22.16.0 运行时，无需额外安装任何环境

## 核心功能

### 实例管理
- 多实例创建与切换，支持本地实例和远程连接
- GitHub 版本动态拉取，一键选择 SillyTavern 版本
- 从本地 zip 安装，自动解压、提升子目录、安装依赖
- 卡片式轮播界面，支持自定义封面图
- 实例配置持久化，端口/网络/协议参数可调

### 启动与运行
- 嵌入式 Node.js 运行时，无需外部依赖
- 本地实例一键启动，自动配置 SillyTavern
- 远程实例在线检测，15 秒轮询自动刷新状态
- 沉浸式窗口承载酒馆界面
- 自动检测可用端口

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

## 仓库结构

| 仓库 | 说明 |
|------|------|
| [SillyClient](.) | 主仓库：项目入口、文档、Release |
| [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android) | Android 端：Kotlin + Capacitor |
| [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows) | Windows 端：Electron + TypeScript |
| [SillyClient-Frontend](https://github.com/CAPTCHAAAAA/SillyClient-Frontend) | 共享前端：启动页 / 状态栏 UI 源码 |

## 构建

### Android

```bash
cd SillyClient-Android
cd web/capacitor-ui && pnpm install && pnpm build
cp dist/* ../../app/src/main/assets/public/
cd ../.. && ./gradlew :app:assembleDebug
```

### Windows

```bash
cd SillyClient-Windows
npm install
cd web/capacitor-ui && pnpm install && pnpm build
cp -r dist/* ../../../frontend-dist/
cd ../..
npm run pack
```

## 技术栈

| 层 | Android | Windows |
|----|---------|---------|
| 原生壳 | Kotlin + Capacitor 7 | Electron 33 + TypeScript |
| 前端 UI | React 19 + Vite 7 + Tailwind CSS v4 | 相同（无修改复用） |
| 运行时 | 嵌入式 Node.js（Termux bootstrap） | 内置 Node.js v22.16.0 |
| WebView | Android System WebView | WebView2 (BrowserWindow) |
| 目标服务 | SillyTavern | 相同 |

## v1.4.0 更新内容

### Android
- 手势退出改为返回启动器（实例继续后台运行）
- 顶部状态栏反方向滑动可返回酒馆
- 卡片菜单新增"返回酒馆"和"停止实例"按钮
- 封面图更换 bug 修复

### Windows
- PC 端酒馆窗口改为叠加模式（不关闭主窗口）
- 重写 runtime 层：paths.ts/process.ts 大幅简化
- npm install 直接用 node.exe npm-cli.js，不走 .cmd
- 启动服务改用 start-server.bat（Windows 原生方式）
- cmd.exe 改用 process.env.ComSpec 完整路径
- 封面图更换 bug 修复

## v1.3.0 更新内容

- 全面替换应用图标（聊天气泡设计，统一 Android + Windows）
- Windows 端内置 Node.js v22.16.0 运行时，即开即用
- 修复 npm install 报 ENOENT
- 修复端口被 Hyper-V 保留导致启动失败
- 酒馆改为独立窗口（Windows）

## 致谢

- [SillyTavern](https://github.com/SillyTavern/SillyTavern) - 本项目封装的目标服务
- [Capacitor](https://capacitorjs.com/) - 跨平台原生桥接框架
- [Termux](https://termux.dev/) - Android 端 Node.js 运行时来源
- [Electron](https://www.electronjs.org/) - Windows 端桌面应用框架

## License

[MIT](LICENSE)
