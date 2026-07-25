(() => {
  const pageScroller = document.getElementById('scroller');
  const topbar = document.getElementById('topbar');
  const journey = document.getElementById('journey');
  const menuButton = document.getElementById('menu-button');
  const navLinks = document.getElementById('nav-links');
  const reduceSectionMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const targets = [...document.querySelectorAll('[data-scroll-target]')];
  const navAnchors = [...document.querySelectorAll('.page-rail-dot')];
  const observedSections = [
    document.getElementById('journey'),
    document.getElementById('experience'),
    document.getElementById('platform')
  ];
  const pagePanels = [
    document.getElementById('hero'),
    document.getElementById('experience'),
    document.getElementById('platform')
  ];
  const titleFontButton = document.getElementById('title-font-button');
  const titleWordmark = document.querySelector('.title-wordmark');
  const heroTitle = document.querySelector('.hero-title');
  const languageButtons = [...document.querySelectorAll('[data-language]')];
  const descriptionMeta = document.querySelector('meta[name="description"]');
  const componentInspector = document.getElementById('component-inspector');
  const inspectorClose = document.getElementById('inspector-close');
  const inspectorScope = document.getElementById('inspector-scope');
  const inspectorTitle = document.getElementById('inspector-title');
  const inspectorBody = document.getElementById('inspector-body');
  const inspectorRelation = document.getElementById('inspector-relation');
  const inspectorStack = document.getElementById('inspector-stack');
  const inspectorPath = document.getElementById('inspector-path');
  const inspectorLink = document.getElementById('inspector-link');
  const inspectorLinkLabel = document.getElementById('inspector-link-label');
  const inspectorTriggers = [...document.querySelectorAll('[data-inspect-key]')];
  const fontRegistry = window.SillyLanding?.fonts;
  const titleFonts = fontRegistry?.available || ['Syndra'];
  const designPx = (value) => value * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 1);
  const translations = {
    zh: {
      documentTitle: 'SillyClient | Android 与 Windows 的 SillyTavern 客户端',
      metaDescription: 'SillyClient 在 Android 与 Windows 上管理 SillyTavern 本地实例和远程连接。',
      homeLabel: 'SillyClient 首页',
      primaryNav: '主要导航',
      overview: '概览',
      experience: '产品体验',
      download: '项目',
      downloadNow: '下载',
      clickToPreview: '点击预览',
      downloadAction: '前往下载页面',
      productExperience: '产品体验',
      openBilibili: '打开哔哩哔哩主页',
      openGithub: '打开 GitHub',
      languageSwitcher: '语言',
      getApp: '下载',
      openMenu: '打开导航菜单',
      closeMenu: '关闭导航菜单',
      loadingScene: '正在载入 3D 场景',
      appFrameTitle: 'SillyClient 软件界面',
      desktopFrameTitle: 'SillyClient 桌面软件界面',
      stageCaption: '3D 机身 · 可交互屏幕',
      fontLabel: '点击切换标题字体，当前为 {font}',
      heroEyebrow: '开源 SillyTavern 客户端',
      heroTagline: 'SillyClient 是面向 Android 与 Windows 的开源 SillyTavern 客户端。',
      heroSubtitle: '它将本地实例、远程服务、运行状态与日志集中在同一套控制台，并随安装包提供所需运行环境。无论随身使用还是桌面常驻，都能从同一入口启动和管理 SillyTavern。',
      latestRelease: '下载最新版本',
      viewSource: '查看源代码',
      techSummary: '平台支持与系统要求',
      enterExperience: '进入产品体验',
      experienceIndex: '01 / 产品体验',
      experienceTitle: 'SillyClient，一套界面，两端都顺手。',
      experienceBody: '手机与电脑共享同一套控制台，运行环境分别由 Kotlin 与 Electron 接管。界面保持一致，各端也保留原生能力。',
      devicePhoneTitle: 'Android，随身运行',
      devicePhoneBody: 'Kotlin 宿主管理实例目录、进程与内置 Node.js 生命周期；共享前端通过平台接口读取状态、日志和服务地址。',
      deviceDesktopTitle: 'Windows，桌面常驻',
      deviceDesktopBody: 'Electron 主进程负责实例文件、Node.js 运行时与窗口调度，控制台和 SillyTavern 内容窗口彼此独立。',
      deviceTogetherTitle: 'SillyClient，体验一致',
      deviceTogetherBody: 'Android 与 Windows 使用同一套 React 控制台和平台契约，交互、状态模型与版本能力由同一份源码维护。',
      lifecycleCreateTitle: '实例准备',
      lifecycleCreateBody: '下载、解压并校验所选版本',
      lifecycleRunTitle: '服务运行',
      lifecycleRunBody: '端口、状态与日志集中管理',
      lifecycleExitTitle: '内容访问',
      lifecycleExitBody: 'SillyTavern 在独立窗口中打开',
      interactiveScreen: 'Android · Windows',
      platformIndex: '02 / 源码与结构',
      platformTitleLead: 'SillyClient，',
      platformTitleTail: '三层代码，一条运行链路。',
      platformBody: '共享控制台定义能力，Android 与 Windows 各自完成系统实现。以下片段均取自当前仓库。',
      platformCarouselLabel: 'SillyClient 核心源码展示',
      previousStage: '上一幕',
      nextStage: '下一幕',
      sourceStageTitle: '共享契约，统一控制台能力。',
      sourceStageBody: 'TarvenEnv 统一描述实例创建、状态、窗口与日志事件。React 控制台只依赖这一层，不区分宿主平台。',
      deliveryStageTitle: 'Windows，同一契约接入桌面。',
      deliveryStageBody: 'Preload 代理把控制台调用送入 Electron 主进程；管理窗口、内容窗口与内置运行时保持各自边界。',
      openSharedSource: '打开共享接口源码',
      openAndroidSource: '打开 Android 就绪检查源码',
      openWindowsSource: '打开 Windows IPC 桥接源码',
      repositoryTitle: 'Android，确认就绪再交付。',
      repositoryBody: 'Kotlin 宿主管理下载、进程与端口检测。只有本地服务能够连接时，控制台才会收到 ready 状态。',
      pageSections: '页面章节',
      previousPage: '上一页',
      nextPage: '下一页',
      closeInspector: '关闭组件说明',
      connectedPath: '关联路径',
      sourceEntry: '源码入口',
      technologyStack: '技术栈',
      inspectHint: '悬浮或点击查看实现'
    },
    en: {
      documentTitle: 'SillyClient | SillyTavern for Android and Windows',
      metaDescription: 'Manage local SillyTavern instances and remote connections on Android and Windows.',
      homeLabel: 'SillyClient home',
      primaryNav: 'Primary navigation',
      overview: 'Overview',
      experience: 'Experience',
      download: 'Project',
      downloadNow: 'Download',
      downloadAction: 'Go to download page',
      clickToPreview: 'Click to preview',
      productExperience: 'Product experience',
      openBilibili: 'Open Bilibili profile',
      openGithub: 'Open GitHub',
      languageSwitcher: 'Language',
      getApp: 'Download',
      openMenu: 'Open navigation menu',
      closeMenu: 'Close navigation menu',
      loadingScene: 'Loading the 3D scene',
      appFrameTitle: 'SillyClient app interface',
      desktopFrameTitle: 'SillyClient desktop interface',
      stageCaption: '3D device · interactive screen',
      fontLabel: 'Cycle title font, currently {font}',
      heroEyebrow: 'Open-source SillyTavern client',
      heroTagline: 'SillyClient is an open-source SillyTavern client for Android and Windows.',
      heroSubtitle: 'Local instances, remote services, runtime status, and logs meet in one console, with the required runtime included. From a phone in hand to a desktop at work, SillyTavern starts and stays manageable from the same familiar place.',
      latestRelease: 'Download latest release',
      viewSource: 'View source',
      techSummary: 'Platform support and system requirements',
      enterExperience: 'Enter the product experience',
      experienceIndex: '01 / Product experience',
      experienceTitle: 'SillyClient, at home on both screens.',
      experienceBody: 'Phone and desktop share one console. Kotlin and Electron run each platform natively while the interface stays familiar.',
      devicePhoneTitle: 'Android, ready to go',
      devicePhoneBody: 'The Kotlin host manages instance storage, processes, and the bundled Node.js lifecycle. The shared frontend reads status, logs, and service URLs through the platform contract.',
      deviceDesktopTitle: 'Windows, always at hand',
      deviceDesktopBody: 'The Electron main process owns instance files, the Node.js runtime, and window orchestration. The console and SillyTavern content stay in separate windows.',
      deviceTogetherTitle: 'SillyClient, one experience',
      deviceTogetherBody: 'Android and Windows use the same React console and platform contract, keeping interaction, state models, and version capabilities in one source.',
      lifecycleCreateTitle: 'Instance setup',
      lifecycleCreateBody: 'Download, extract, and verify the selected version',
      lifecycleRunTitle: 'Service runtime',
      lifecycleRunBody: 'Manage ports, status, and logs in one console',
      lifecycleExitTitle: 'Content access',
      lifecycleExitBody: 'Open SillyTavern in a separate window',
      interactiveScreen: 'Android · Windows',
      platformIndex: '02 / Source and structure',
      platformTitleLead: 'SillyClient, ',
      platformTitleTail: 'three layers, one runtime path.',
      platformBody: 'The shared console defines capabilities. Android and Windows provide their native implementations. Every excerpt below comes from the current repositories.',
      platformCarouselLabel: 'SillyClient core source showcase',
      previousStage: 'Previous scene',
      nextStage: 'Next scene',
      sourceStageTitle: 'One contract for every console capability.',
      sourceStageBody: 'TarvenEnv defines instance setup, status, windows, and log events. The React console depends on this contract rather than a specific host platform.',
      deliveryStageTitle: 'Windows connects the same contract to desktop.',
      deliveryStageBody: 'The preload proxy sends console calls to Electron’s main process while the manager, content window, and bundled runtime keep clear boundaries.',
      openSharedSource: 'Open the shared contract source',
      openAndroidSource: 'Open the Android readiness source',
      openWindowsSource: 'Open the Windows IPC bridge source',
      repositoryTitle: 'Android delivers only after the service is ready.',
      repositoryBody: 'The Kotlin host owns downloads, processes, and port checks. The console receives ready only after the local service accepts a connection.',
      pageSections: 'Page sections',
      previousPage: 'Previous page',
      nextPage: 'Next page',
      closeInspector: 'Close component details',
      connectedPath: 'Connected path',
      sourceEntry: 'Source entry',
      technologyStack: 'Technology stack',
      inspectHint: 'Hover or activate to inspect'
    }
  };
  const inspectorCatalog = {
    zh: {
      heroAndroid: {
        scope: '平台能力 / Android',
        title: '原生宿主接管系统能力',
        body: '共享控制台运行在 WebView 中；Kotlin 负责文件、下载、进程、窗口适配与 arm64 运行时。',
        relation: 'React Console → TarvenEnv → SillyTavern',
        stack: ['Kotlin', 'Capacitor 7', 'WebView', 'Bionic Node.js'],
        path: 'app/src/main/java/com/sillyclient/MainActivity.kt',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/MainActivity.kt',
        linkLabel: '查看 Android 宿主',
        related: ['heroRuntime']
      },
      heroWindows: {
        scope: '平台能力 / Windows',
        title: 'Electron 负责桌面生命周期',
        body: '桌面宿主管理控制台、内容窗口与内置运行时，文件和进程能力通过同一接口交给共享前端。',
        relation: 'React Console → IPC Bridge → SillyTavern',
        stack: ['Electron 33', 'TypeScript', 'Node.js 22', 'NSIS'],
        path: 'src/main.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/main.ts',
        linkLabel: '查看 Windows 宿主',
        related: ['heroRuntime']
      },
      heroRuntime: {
        scope: '分发策略 / Runtime',
        title: '运行时随安装包交付',
        body: 'Android 与 Windows 都使用应用自带的 Node.js，不依赖 Termux，也不读取系统 PATH。',
        relation: '安装包 → 固定运行时 → 本地实例',
        stack: ['Node.js 22', 'arm64', 'x64', '版本固定'],
        path: 'docs/adr/0003-bundled-platform-runtimes.md',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/docs/adr/0003-bundled-platform-runtimes.md',
        linkLabel: '查看运行时决策',
        related: ['heroAndroid', 'heroWindows']
      },
      flowProvision: {
        scope: '实例生命周期 / 01',
        title: '先验证，再完成创建',
        body: '下载、解压、依赖安装和可运行性探测全部通过后，控制台才把实例标记为可用。',
        relation: 'Release / ZIP → 安装 → 就绪探测',
        stack: ['GitHub Releases', 'ZIP', 'npm', 'Readiness Probe'],
        path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt',
        linkLabel: '查看实例准备流程',
        related: ['flowRuntime']
      },
      flowRuntime: {
        scope: '实例生命周期 / 02',
        title: '平台宿主维持服务状态',
        body: '宿主选择端口、启动 Node.js、转发输出并持续同步状态；控制台只负责呈现和发出操作。',
        relation: '端口 → Node.js 进程 → 状态与日志',
        stack: ['Process API', 'stdio', 'Port Probe', 'Node.js'],
        path: 'src/runtime/process.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/runtime/process.ts',
        linkLabel: '查看进程管理',
        related: ['flowProvision', 'flowWindow']
      },
      flowWindow: {
        scope: '实例生命周期 / 03',
        title: '管理窗口与内容窗口分离',
        body: '关闭 SillyTavern 内容视图只返回控制台，不会连带停止仍在运行的本地实例。',
        relation: '控制台 ↔ 内容窗口 ↔ 后台服务',
        stack: ['WebView', 'BrowserWindow', 'Window State'],
        path: 'docs/phone-demo.html',
        href: './phone-demo.html',
        linkLabel: '打开界面演示',
        related: ['flowRuntime']
      },
      runtimeFrontend: {
        scope: '运行架构 / Shared UI',
        title: '一份 React 控制台',
        body: '实例配置、状态和日志界面只在 Android 仓库维护，再同步到 Android、Windows 与 Pages。',
        relation: 'React UI → Platform Contract',
        stack: ['React 19', 'TanStack Router', 'TanStack Query', 'Tailwind CSS 4'],
        path: 'web/capacitor-ui/src/routes/index.tsx',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/web/capacitor-ui/src/routes/index.tsx',
        linkLabel: '查看控制台源码',
        related: ['runtimeContract']
      },
      runtimeContract: {
        scope: '运行架构 / Contract',
        title: '接口隔离平台差异',
        body: '前端只调用稳定的 TarvenEnv 契约；Android 与 Windows 分别实现文件、下载、进程和窗口能力。',
        relation: 'React Console → TarvenEnv → Native Host',
        stack: ['TypeScript', 'Capacitor Plugin', 'Electron IPC'],
        path: 'web/capacitor-ui/src/capacitor-plugin.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/web/capacitor-ui/src/capacitor-plugin.ts',
        linkLabel: '查看平台契约',
        related: ['runtimeFrontend', 'runtimeAndroid', 'runtimeWindows']
      },
      runtimeAndroid: {
        scope: '运行架构 / Android',
        title: 'Kotlin 实现移动端能力',
        body: 'Android 宿主处理实例文件、DisplayCutout、双 WebView 与 Bionic Node.js 生命周期。',
        relation: 'TarvenEnv → Kotlin → Bionic Node.js',
        stack: ['Kotlin', 'Android WebView', 'DisplayCutout', 'JNI'],
        path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt',
        linkLabel: '查看 Android 实现',
        related: ['runtimeContract']
      },
      runtimeWindows: {
        scope: '运行架构 / Windows',
        title: 'Electron 实现桌面端能力',
        body: 'Windows 宿主实现同一契约，并负责独立窗口、文件系统、进程管理与安装器资源。',
        relation: 'TarvenEnv → Electron → Windows Node.js',
        stack: ['Electron', 'TypeScript', 'BrowserWindow', 'Node.js'],
        path: 'src/plugin.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/plugin.ts',
        linkLabel: '查看 Windows 实现',
        related: ['runtimeContract']
      },
      sourceFrontend: {
        scope: '源码流向 / Single Source',
        title: '共享前端只有一个维护入口',
        body: '功能修改发生在 web/capacitor-ui；其余平台目录是同步后的构建产物，不作为源码入口。',
        relation: 'web/capacitor-ui → Android / Windows / Pages',
        stack: ['pnpm', 'Vite 7', 'TypeScript 5.8', 'Sync Scripts'],
        path: 'web/capacitor-ui/',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/tree/main/web/capacitor-ui',
        linkLabel: '浏览前端源码',
        related: ['repoMain', 'repoAndroid', 'repoWindows', 'repoBuild']
      },
      repoMain: {
        scope: '仓库职责 / Main',
        title: '公共入口与发布中心',
        body: '主仓库维护 GitHub Pages、公共文档、Release 记录与 Android、Windows 安装包。',
        relation: 'Docs + Pages + Releases',
        stack: ['GitHub Pages', 'Markdown', 'Three.js', 'Release Assets'],
        path: 'docs/',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/docs',
        linkLabel: '浏览主仓库',
        related: ['sourceFrontend', 'repoBuild']
      },
      repoAndroid: {
        scope: '仓库职责 / Android',
        title: '共享前端与移动端源码',
        body: 'Android 仓库同时拥有 React 控制台唯一源码、Kotlin 宿主和 arm64 运行时资源。',
        relation: 'React Source + Kotlin Host + APK',
        stack: ['React', 'Kotlin', 'Gradle', 'Capacitor'],
        path: 'SillyClient-Android',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android',
        linkLabel: '浏览 Android 仓库',
        related: ['sourceFrontend', 'repoBuild']
      },
      repoWindows: {
        scope: '仓库职责 / Windows',
        title: '桌面宿主与安装器',
        body: 'Windows 仓库维护 Electron 宿主、桌面运行时准备脚本以及 NSIS 安装器。',
        relation: 'Synced UI + Electron Host + EXE',
        stack: ['Electron Builder', 'TypeScript', 'PowerShell', 'NSIS'],
        path: 'SillyClient-Windows',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows',
        linkLabel: '浏览 Windows 仓库',
        related: ['sourceFrontend', 'repoBuild']
      },
      repoBuild: {
        scope: '构建流向 / Generated',
        title: '构建一次，同步到三处',
        body: '前端构建后进入 Android assets、Windows frontend-dist 与 Pages docs/app；这些目录都可重新生成。',
        relation: 'Source → Build → Platform Artifacts',
        stack: ['Vite Build', 'Integrity Check', 'Sync Scripts'],
        path: 'scripts/sync-pages-app.mjs',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/scripts/sync-pages-app.mjs',
        linkLabel: '查看同步脚本',
        related: ['sourceFrontend', 'repoMain', 'repoAndroid', 'repoWindows']
      }
    },
    en: {
      heroAndroid: { scope: 'Platform / Android', title: 'A native host owns system capabilities', body: 'The shared console runs in a WebView while Kotlin handles files, downloads, processes, window adaptation, and the arm64 runtime.', relation: 'React Console → TarvenEnv → SillyTavern', stack: ['Kotlin', 'Capacitor 7', 'WebView', 'Bionic Node.js'], path: 'app/src/main/java/com/sillyclient/MainActivity.kt', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/MainActivity.kt', linkLabel: 'View Android host', related: ['heroRuntime'] },
      heroWindows: { scope: 'Platform / Windows', title: 'Electron owns the desktop lifecycle', body: 'The desktop host manages console and content windows plus the bundled runtime, exposing files and processes through the shared contract.', relation: 'React Console → IPC Bridge → SillyTavern', stack: ['Electron 33', 'TypeScript', 'Node.js 22', 'NSIS'], path: 'src/main.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/main.ts', linkLabel: 'View Windows host', related: ['heroRuntime'] },
      heroRuntime: { scope: 'Distribution / Runtime', title: 'The runtime ships with the app', body: 'Both platforms use their bundled Node.js runtime instead of Termux or a Node.js installation found on PATH.', relation: 'Installer → Pinned Runtime → Local Instance', stack: ['Node.js 22', 'arm64', 'x64', 'Pinned Version'], path: 'docs/adr/0003-bundled-platform-runtimes.md', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/docs/adr/0003-bundled-platform-runtimes.md', linkLabel: 'Read runtime decision', related: ['heroAndroid', 'heroWindows'] },
      flowProvision: { scope: 'Instance lifecycle / 01', title: 'Verify before creation completes', body: 'Download, extraction, dependency installation, and the readiness probe must all pass before an instance becomes available.', relation: 'Release / ZIP → Install → Readiness Probe', stack: ['GitHub Releases', 'ZIP', 'npm', 'Readiness Probe'], path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', linkLabel: 'View provisioning flow', related: ['flowRuntime'] },
      flowRuntime: { scope: 'Instance lifecycle / 02', title: 'The native host maintains service state', body: 'The host selects a port, starts Node.js, forwards output, and synchronizes status while the console presents and controls it.', relation: 'Port → Node.js Process → Status and Logs', stack: ['Process API', 'stdio', 'Port Probe', 'Node.js'], path: 'src/runtime/process.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/runtime/process.ts', linkLabel: 'View process management', related: ['flowProvision', 'flowWindow'] },
      flowWindow: { scope: 'Instance lifecycle / 03', title: 'Management and content stay separate', body: 'Closing the SillyTavern content view returns to the console without stopping the local instance that is still running.', relation: 'Console ↔ Content Window ↔ Service', stack: ['WebView', 'BrowserWindow', 'Window State'], path: 'docs/phone-demo.html', href: './phone-demo.html', linkLabel: 'Open interface demo', related: ['flowRuntime'] },
      runtimeFrontend: { scope: 'Runtime / Shared UI', title: 'One React console', body: 'Instance settings, status, and logs are maintained once in the Android repository, then synchronized to Android, Windows, and Pages.', relation: 'React UI → Platform Contract', stack: ['React 19', 'TanStack Router', 'TanStack Query', 'Tailwind CSS 4'], path: 'web/capacitor-ui/src/routes/index.tsx', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/web/capacitor-ui/src/routes/index.tsx', linkLabel: 'View console source', related: ['runtimeContract'] },
      runtimeContract: { scope: 'Runtime / Contract', title: 'A contract isolates platform differences', body: 'The frontend calls a stable TarvenEnv contract; Android and Windows separately implement files, downloads, processes, and windows.', relation: 'React Console → TarvenEnv → Native Host', stack: ['TypeScript', 'Capacitor Plugin', 'Electron IPC'], path: 'web/capacitor-ui/src/capacitor-plugin.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/web/capacitor-ui/src/capacitor-plugin.ts', linkLabel: 'View platform contract', related: ['runtimeFrontend', 'runtimeAndroid', 'runtimeWindows'] },
      runtimeAndroid: { scope: 'Runtime / Android', title: 'Kotlin implements mobile capabilities', body: 'The Android host owns instance files, DisplayCutout handling, two WebViews, and the Bionic Node.js lifecycle.', relation: 'TarvenEnv → Kotlin → Bionic Node.js', stack: ['Kotlin', 'Android WebView', 'DisplayCutout', 'JNI'], path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', linkLabel: 'View Android implementation', related: ['runtimeContract'] },
      runtimeWindows: { scope: 'Runtime / Windows', title: 'Electron implements desktop capabilities', body: 'The Windows host implements the same contract and owns separate windows, the filesystem, process management, and installer resources.', relation: 'TarvenEnv → Electron → Windows Node.js', stack: ['Electron', 'TypeScript', 'BrowserWindow', 'Node.js'], path: 'src/plugin.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/master/src/plugin.ts', linkLabel: 'View Windows implementation', related: ['runtimeContract'] },
      sourceFrontend: { scope: 'Source flow / Single Source', title: 'The shared frontend has one source', body: 'Feature work happens in web/capacitor-ui. Platform copies are generated outputs, not maintenance entry points.', relation: 'web/capacitor-ui → Android / Windows / Pages', stack: ['pnpm', 'Vite 7', 'TypeScript 5.8', 'Sync Scripts'], path: 'web/capacitor-ui/', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/tree/main/web/capacitor-ui', linkLabel: 'Browse frontend source', related: ['repoMain', 'repoAndroid', 'repoWindows', 'repoBuild'] },
      repoMain: { scope: 'Repository / Main', title: 'Public entry and release center', body: 'The main repository owns GitHub Pages, public documentation, release records, and both platform installers.', relation: 'Docs + Pages + Releases', stack: ['GitHub Pages', 'Markdown', 'Three.js', 'Release Assets'], path: 'docs/', href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/docs', linkLabel: 'Browse main repository', related: ['sourceFrontend', 'repoBuild'] },
      repoAndroid: { scope: 'Repository / Android', title: 'Shared frontend and mobile source', body: 'The Android repository contains the only React console source, the Kotlin host, and arm64 runtime assets.', relation: 'React Source + Kotlin Host + APK', stack: ['React', 'Kotlin', 'Gradle', 'Capacitor'], path: 'SillyClient-Android', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android', linkLabel: 'Browse Android repository', related: ['sourceFrontend', 'repoBuild'] },
      repoWindows: { scope: 'Repository / Windows', title: 'Desktop host and installer', body: 'The Windows repository owns the Electron host, runtime preparation scripts, and the NSIS installer.', relation: 'Synced UI + Electron Host + EXE', stack: ['Electron Builder', 'TypeScript', 'PowerShell', 'NSIS'], path: 'SillyClient-Windows', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows', linkLabel: 'Browse Windows repository', related: ['sourceFrontend', 'repoBuild'] },
      repoBuild: { scope: 'Build flow / Generated', title: 'Build once, synchronize to three targets', body: 'The frontend build feeds Android assets, Windows frontend-dist, and Pages docs/app. Each target can be regenerated.', relation: 'Source → Build → Platform Artifacts', stack: ['Vite Build', 'Integrity Check', 'Sync Scripts'], path: 'scripts/sync-pages-app.mjs', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/scripts/sync-pages-app.mjs', linkLabel: 'View sync script', related: ['sourceFrontend', 'repoMain', 'repoAndroid', 'repoWindows'] }
    }
  };
  let currentLanguage = 'zh';
  let activeTitleFont = fontRegistry?.defaultFont || 'Syndra';
  function setupSectionReveals() {
    const revealItems = [...document.querySelectorAll('[data-reveal]')];
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || !('IntersectionObserver' in window)) {
      revealItems.forEach((item) => item.classList.add('is-visible'));
      return;
    }

    revealItems.forEach((item) => item.classList.add('will-reveal'));
    // If GSAP ScrollTrigger is active, it handles the reveal animation
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      root: pageScroller,
      threshold: 0.16,
      rootMargin: '0px 0px -8% 0px'
    });
    revealItems.forEach((item) => observer.observe(item));
  }

  setupSectionReveals();

  const fineInspectorPointer = matchMedia('(hover: hover) and (pointer: fine)');
  let currentInspectorTrigger = null;
  let inspectorPinned = false;
  let inspectorHideTimer = 0;

  function inspectorEntry(trigger) {
    return inspectorCatalog[currentLanguage]?.[trigger?.dataset.inspectKey] || null;
  }

  function clearInspectorContext() {
    document.querySelectorAll('[data-inspect-group].is-inspecting').forEach((group) => {
      group.classList.remove('is-inspecting');
      group.querySelectorAll('[data-inspect-key]').forEach((node) => {
        node.classList.remove('is-context-active', 'is-context-related', 'is-context-muted');
      });
    });
    inspectorTriggers.forEach((trigger) => trigger.setAttribute('aria-expanded', 'false'));
  }

  function applyInspectorContext(trigger, entry) {
    clearInspectorContext();
    const group = trigger.closest('[data-inspect-group]');
    if (!group) return;
    const related = new Set(entry.related || []);
    group.classList.add('is-inspecting');
    group.querySelectorAll('[data-inspect-key]').forEach((node) => {
      const key = node.dataset.inspectKey;
      node.classList.toggle('is-context-active', node === trigger);
      node.classList.toggle('is-context-related', related.has(key));
      node.classList.toggle('is-context-muted', node !== trigger && !related.has(key));
    });
    trigger.setAttribute('aria-expanded', 'true');
  }

  function positionInspector(trigger) {
    if (!trigger || matchMedia('(max-aspect-ratio: 999 / 1000)').matches) {
      componentInspector.style.removeProperty('left');
      componentInspector.style.removeProperty('top');
      componentInspector.style.removeProperty('transform-origin');
      return;
    }

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = componentInspector.offsetWidth;
    const panelHeight = componentInspector.offsetHeight;
    const margin = designPx(18);
    const railClearance = designPx(52);
    const inspectorGap = designPx(14);
    const rightCandidate = triggerRect.right + inspectorGap;
    const fitsRight = rightCandidate + panelWidth <= innerWidth - railClearance;
    const left = fitsRight
      ? rightCandidate
      : Math.max(margin, triggerRect.left - panelWidth - inspectorGap);
    const top = Math.max(designPx(82), Math.min(
      innerHeight - panelHeight - margin,
      triggerRect.top + triggerRect.height / 2 - panelHeight / 2
    ));

    componentInspector.style.left = `${Math.round(left)}px`;
    componentInspector.style.top = `${Math.round(top)}px`;
    componentInspector.style.transformOrigin = `${fitsRight ? '0%' : '100%'} 50%`;
  }

  function renderInspector(trigger) {
    const entry = inspectorEntry(trigger);
    if (!entry) return false;
    inspectorScope.textContent = entry.scope;
    inspectorTitle.textContent = entry.title;
    inspectorBody.textContent = entry.body;
    inspectorRelation.textContent = entry.relation;
    inspectorPath.textContent = entry.path;
    inspectorPath.title = entry.path;
    inspectorLink.href = entry.href;
    inspectorLinkLabel.textContent = entry.linkLabel;
    inspectorStack.replaceChildren(...entry.stack.map((label) => {
      const item = document.createElement('li');
      item.textContent = label;
      return item;
    }));
    applyInspectorContext(trigger, entry);
    return true;
  }

  function showInspector(trigger, pinned = false) {
    clearTimeout(inspectorHideTimer);
    if (!renderInspector(trigger)) return;
    currentInspectorTrigger = trigger;
    inspectorPinned = pinned;
    componentInspector.classList.add('is-open');
    componentInspector.classList.toggle('is-pinned', pinned);
    componentInspector.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => positionInspector(trigger));
  }

  function hideInspector() {
    clearTimeout(inspectorHideTimer);
    componentInspector.classList.remove('is-open', 'is-pinned');
    componentInspector.setAttribute('aria-hidden', 'true');
    clearInspectorContext();
    currentInspectorTrigger = null;
    inspectorPinned = false;
  }

  function scheduleInspectorHide() {
    clearTimeout(inspectorHideTimer);
    inspectorHideTimer = window.setTimeout(() => {
      if (inspectorPinned || componentInspector.contains(document.activeElement)) return;
      hideInspector();
    }, 140);
  }

  function syncInspectorLabels() {
    const hint = translations[currentLanguage].inspectHint;
    inspectorTriggers.forEach((trigger) => {
      const entry = inspectorEntry(trigger);
      if (entry) trigger.setAttribute('aria-label', `${entry.title}. ${hint}`);
    });
  }

  inspectorTriggers.forEach((trigger) => {
    if (fineInspectorPointer.matches) {
      trigger.addEventListener('pointerenter', () => {
        if (!inspectorPinned) showInspector(trigger);
      });
      trigger.addEventListener('pointerleave', scheduleInspectorHide);
    }
    trigger.addEventListener('focus', () => showInspector(trigger));
    trigger.addEventListener('blur', scheduleInspectorHide);
    trigger.addEventListener('click', () => {
      if (currentInspectorTrigger === trigger && inspectorPinned) {
        hideInspector();
        return;
      }
      showInspector(trigger, true);
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      trigger.click();
    });
  });

  if (fineInspectorPointer.matches) {
    componentInspector.addEventListener('pointerenter', () => clearTimeout(inspectorHideTimer));
    componentInspector.addEventListener('pointerleave', scheduleInspectorHide);
  }
  componentInspector.addEventListener('focusin', () => clearTimeout(inspectorHideTimer));
  componentInspector.addEventListener('focusout', scheduleInspectorHide);
  inspectorClose.addEventListener('click', hideInspector);
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && currentInspectorTrigger) hideInspector();
  });
  window.addEventListener('resize', () => {
    if (currentInspectorTrigger) positionInspector(currentInspectorTrigger);
  });
  pageScroller.addEventListener('scroll', () => {
    if (currentInspectorTrigger) hideInspector();
  }, { passive: true });

  function syncMenuLabel() {
    const key = navLinks.classList.contains('is-open') ? 'closeMenu' : 'openMenu';
    menuButton.setAttribute('aria-label', translations[currentLanguage][key]);
  }

  function applyLanguage(language) {
    currentLanguage = translations[language] ? language : 'zh';
    const copy = translations[currentLanguage];
    document.documentElement.lang = currentLanguage === 'zh' ? 'zh-CN' : 'en';
    document.title = copy.documentTitle;
    if (descriptionMeta) descriptionMeta.setAttribute('content', copy.metaDescription);

    document.querySelectorAll('[data-i18n]').forEach((element) => {
      const value = copy[element.dataset.i18n];
      if (value) element.textContent = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((element) => {
      const value = copy[element.dataset.i18nAria];
      if (value) element.setAttribute('aria-label', value);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((element) => {
      const value = copy[element.dataset.i18nTitle];
      if (value) element.setAttribute('title', value);
    });

    languageButtons.forEach((button) => {
      const active = button.dataset.language === currentLanguage;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    localStorage.setItem('landing-language', currentLanguage);
    syncMenuLabel();
    syncTitleFontLabel();
    syncInspectorLabels();
    if (currentInspectorTrigger) renderInspector(currentInspectorTrigger);
    if (window.SillyScrollReveal) window.SillyScrollReveal.refresh();
    window.dispatchEvent(new CustomEvent('sillyclient-language-change', {
      detail: { language: currentLanguage }
    }));
    requestAnimationFrame(fitHeroTitle);
  }

  function fitHeroTitle() {
    heroTitle.style.fontSize = '';
    requestAnimationFrame(() => {
      const baseSize = parseFloat(getComputedStyle(heroTitle).fontSize);
      const available = heroTitle.clientWidth;
      const required = titleWordmark.scrollWidth;
      if (required > available) {
        heroTitle.style.fontSize = `${Math.max(designPx(30), baseSize * available / required)}px`;
      }
    });
  }

  function syncTitleFontLabel() {
    const label = translations[currentLanguage].fontLabel.replace('{font}', activeTitleFont);
    titleFontButton.setAttribute('aria-label', label);
    titleFontButton.setAttribute('title', label);
  }

  function applyTitleFont(font, animate = false) {
    const selected = titleFonts.includes(font) ? font : 'Syndra';
    activeTitleFont = selected;
    heroTitle.style.setProperty('--title-font', `"${selected}"`);
    heroTitle.style.fontWeight = selected === 'Syndra' ? '600' : '400';
    syncTitleFontLabel();
    localStorage.setItem('landing-title-font', selected);
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      titleWordmark.getAnimations().forEach((animation) => animation.cancel());
      const shift = designPx(3);
      const blur = designPx(2);
      titleWordmark.animate(
        [
          { opacity: 0.52, transform: `translateY(${shift}px) scale(0.985)`, filter: `blur(${blur}px)` },
          { opacity: 1, transform: 'translateY(0) scale(1)', filter: 'blur(0)' }
        ],
        { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
      );
    }
    document.fonts.load(`${selected === 'Syndra' ? 600 : 400} ${designPx(72)}px "${selected}"`).finally(fitHeroTitle);
  }

  applyTitleFont(localStorage.getItem('landing-title-font') || 'Syndra');
  titleFontButton.addEventListener('click', () => {
    const nextIndex = (titleFonts.indexOf(activeTitleFont) + 1) % titleFonts.length;
    applyTitleFont(titleFonts[nextIndex], true);
  });
  const savedLanguage = localStorage.getItem('landing-language');
  applyLanguage(savedLanguage || (navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'));
  languageButtons.forEach((button) => {
    button.addEventListener('click', () => applyLanguage(button.dataset.language));
  });
  window.addEventListener('resize', fitHeroTitle);

  function targetTop(target) {
    if (!target) return 0;
    if (target.id === 'experience') {
      const hero = document.getElementById('hero');
      return journey.offsetTop + (hero ? hero.offsetHeight : 0);
    }
    return pageScroller.scrollTop + target.getBoundingClientRect().top;
  }

  let currentPageIndex = 0;
  let pageNavigationLocked = false;
  let pageScrollFrame = 0;
  const pageTurnDuration = 720;

  function goToPage(index) {
    let nextIndex = Math.max(0, Math.min(pagePanels.length - 1, index));
    const showcaseApi = window.SillyDeviceShowcase;

    if (nextIndex === 2 && showcaseApi && !showcaseApi.hasSeenAll()) {
      if (currentPageIndex === 1) {
        const firstUnseen = showcaseApi.firstUnseen();
        if (firstUnseen >= 0) showcaseApi.select(firstUnseen, 'navigation-gate');
      }
      nextIndex = 1;
    }

    const destination = targetTop(observedSections[nextIndex]);
    if (nextIndex === currentPageIndex && Math.abs(pageScroller.scrollTop - destination) < 2) return;

    pageNavigationLocked = true;
    cancelAnimationFrame(pageScrollFrame);
    pageScroller.classList.add('is-page-turning');
    schedulePageActivation(nextIndex, reduceSectionMotion.matches ? 0 : 60);

    /* When transitioning TO page 3 (platform), pre-reveal the first
       content block so it's visible by the time the scroll arrives.
       The platform-intro is already always-visible (no data-reveal),
       but the runtime-topology (first data-reveal) should start
       animating in during the page-turn, not after. */
    if (nextIndex === 2 && !reduceSectionMotion.matches) {
      var firstReveal = document.querySelector('.platform-section [data-reveal]');
      if (firstReveal && typeof gsap !== 'undefined') {
        /* Override the ScrollTrigger fromTo: play immediately with a delay
           that roughly matches when the content enters the viewport. */
        gsap.to(firstReveal, {
          opacity: 1, y: 0, filter: 'blur(0px)',
          duration: 0.8, ease: 'power3.out', delay: 0.25,
          overwrite: 'auto'
        });
      }
    }

    if (reduceSectionMotion.matches) {
      pageScroller.scrollTop = destination;
      pageScroller.classList.remove('is-page-turning');
      pageNavigationLocked = false;
      updatePageState();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
      return;
    }

    const startTop = pageScroller.scrollTop;
    const distance = destination - startTop;
    const startTime = performance.now();

    function turnFrame(now) {
      const progress = Math.min(1, (now - startTime) / pageTurnDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      pageScroller.scrollTop = startTop + distance * eased;

      /* Sync ScrollTrigger during programmatic scroll.
         Lenis doesn't fire its 'scroll' event when we set scrollTop
         directly, so GSAP ScrollTrigger animations won't update.
         Force an update on every frame to ensure reveals fire
         at the correct scroll position. */
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();

      if (progress < 1) {
        pageScrollFrame = requestAnimationFrame(turnFrame);
        return;
      }

      pageScroller.scrollTop = destination;
      pageScroller.classList.remove('is-page-turning');
      pageNavigationLocked = false;
      updatePageState();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.update();
    }

    pageScrollFrame = requestAnimationFrame(turnFrame);
  }

  function navigateExperience(direction, source) {
    const showcaseApi = window.SillyDeviceShowcase;
    if (showcaseApi?.step(direction, source)) return;

    if (direction > 0 && showcaseApi && !showcaseApi.hasSeenAll()) {
      const firstUnseen = showcaseApi.firstUnseen();
      if (firstUnseen >= 0) {
        showcaseApi.select(firstUnseen, source);
        return;
      }
    }

    goToPage(direction > 0 ? 2 : 0);
  }

  window.SillyLandingNavigation = {
    goToPage,
    goToTarget(targetId) {
      const target = document.getElementById(targetId);
      const pageIndex = observedSections.indexOf(target);
      if (pageIndex >= 0) goToPage(pageIndex);
    }
  };

  targets.forEach((control) => {
    control.addEventListener('click', (event) => {
      const target = document.getElementById(control.dataset.scrollTarget);
      if (!target) return;
      event.preventDefault();
      const pageIndex = observedSections.indexOf(target);
      if (pageIndex >= 0) goToPage(pageIndex);
      navLinks.classList.remove('is-open');
      menuButton.setAttribute('aria-expanded', 'false');
      syncMenuLabel();
    });
  });



  window.addEventListener('wheel', (event) => {
    if (Math.abs(event.deltaY) < 18) return;
    if (pageNavigationLocked) {
      event.preventDefault();
      return;
    }
    const direction = event.deltaY > 0 ? 1 : -1;
    const platformTop = targetTop(observedSections[2]);

    /* Page 3: allow free scrolling within the platform section.
       The platform section contains multiple content blocks that the user
       must be able to scroll through. Only intercept when scrolling UP at
       the very top of the section to snap back to page 2. */
    if (currentPageIndex === 2) {
      if (direction < 0 && pageScroller.scrollTop <= platformTop + 3) {
        event.preventDefault();
        goToPage(1);
      }
      /* For all other cases on page 3, let Lenis handle the scroll
         (do NOT preventDefault — that was blocking all downward scroll). */
      return;
    }

    if (currentPageIndex === 1) {
      event.preventDefault();
      navigateExperience(direction, 'wheel');
      return;
    }

    /* Page 1: snap-turn into the guided device sequence. */
    const nextIndex = Math.max(0, Math.min(pagePanels.length - 1, currentPageIndex + direction));
    if (nextIndex === currentPageIndex) return;
    event.preventDefault();
    goToPage(nextIndex);
  }, { passive: false, capture: true });

  window.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
    if (target instanceof HTMLButtonElement && (event.key === ' ' || event.key === 'Enter')) return;

    const platformTop = targetTop(observedSections[2]);
    const forwardKey = event.key === 'ArrowDown' || event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey);
    const backwardKey = event.key === 'ArrowUp' || event.key === 'PageUp' || (event.key === ' ' && event.shiftKey);

    if (currentPageIndex === 1 && (forwardKey || backwardKey)) {
      event.preventDefault();
      if (!pageNavigationLocked) navigateExperience(forwardKey ? 1 : -1, 'keyboard');
      return;
    }

    let nextIndex = currentPageIndex;
    if (forwardKey) {
      if (currentPageIndex < 2) nextIndex += 1;
    } else if (backwardKey) {
      if (currentPageIndex < 2 || pageScroller.scrollTop <= platformTop + 3) nextIndex -= 1;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = 2;
    } else {
      return;
    }

    nextIndex = Math.max(0, Math.min(pagePanels.length - 1, nextIndex));
    if (nextIndex === currentPageIndex) return;
    event.preventDefault();
    if (!pageNavigationLocked) goToPage(nextIndex);
  });

  menuButton.addEventListener('click', () => {
    const open = navLinks.classList.toggle('is-open');
    menuButton.setAttribute('aria-expanded', String(open));
    syncMenuLabel();
  });

  let pendingPageIndex = -1;
  let activePageIndex = -1;
  let pageActivationTimer = 0;

  function schedulePageActivation(index, delay = 130) {
    if (activePageIndex === index && pendingPageIndex === index) return;

    if (pendingPageIndex !== index) {
      pendingPageIndex = index;
      pagePanels.forEach((panel, panelIndex) => {
        panel.classList.remove('is-page-active', 'is-page-pending');
        if (panelIndex === index) panel.classList.add('is-page-pending');
      });
    }

    clearTimeout(pageActivationTimer);
    pageActivationTimer = window.setTimeout(() => {
      const panel = pagePanels[pendingPageIndex];
      if (!panel) return;
      panel.classList.remove('is-page-pending');
      void panel.offsetWidth;
      panel.classList.add('is-page-active');
      activePageIndex = pendingPageIndex;
      window.dispatchEvent(new CustomEvent('page-activation', {
        detail: { pageIndex: activePageIndex }
      }));
    }, delay);
  }

  function updatePageState() {
    const scrollTop = pageScroller.scrollTop;
    const range = Math.max(1, journey.offsetHeight - pageScroller.clientHeight);
    const progress = Math.max(0, Math.min(1, (scrollTop - journey.offsetTop) / range));
    const experienceTop = targetTop(observedSections[1]);
    const platformTop = targetTop(observedSections[2]);
    /* Platform-blend: fade the 3D stage out BEFORE the sticky range ends.
       The visual-stage is sticky within the journey (200vh). Its sticky range
       ends at scrollTop = journey.offsetHeight - clientHeight = range.
       If we fade across the full experienceTop→platformTop distance, the phone
       is still partially visible when it starts scrolling away, creating a
       jarring "slide+fade" effect. Instead, complete the fade within the first
       60% of the transition so the phone is fully invisible before scrolling. */
    const transitionDistance = Math.max(1, platformTop - experienceTop);
    const platformBlend = Math.max(0, Math.min(1,
      (scrollTop - experienceTop) / (transitionDistance * 0.6)
    ));
    document.documentElement.style.setProperty('--journey-progress', progress.toFixed(4));
    document.documentElement.style.setProperty('--platform-blend', platformBlend.toFixed(4));
    topbar.classList.toggle('is-compact', scrollTop > 30);

    const probe = scrollTop + pageScroller.clientHeight * 0.48;
    let activeIndex = 0;
    if (probe >= targetTop(observedSections[2])) activeIndex = 2;
    else if (progress > 0.48) activeIndex = 1;

    currentPageIndex = activeIndex;
    navAnchors.forEach((link, index) => {
      const active = index === activeIndex;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    if (!pageNavigationLocked) schedulePageActivation(activeIndex);

    /* Dispatch page-state-change so the floating nav bar can react.
       Only fires when the index actually changes (previousPageIndex is
       tracked outside this function scope). */
    if (window.__prevPageIndex !== activeIndex) {
      window.__prevPageIndex = activeIndex;
      window.dispatchEvent(new CustomEvent('page-state-change', {
        detail: { pageIndex: activeIndex }
      }));
    }
  }

  pageScroller.addEventListener('scroll', updatePageState, { passive: true });
  window.addEventListener('resize', updatePageState);
  updatePageState();
})();
