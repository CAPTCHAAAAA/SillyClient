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
        body: '桌面宿主管理控制台、内容窗口与内置运行时，文件和进程能力通过强类型契约交给共享前端。',
        relation: 'React Console → IPC Bridge → SillyTavern',
        stack: ['Electron 33', 'TypeScript', 'Node.js 22', 'NSIS'],
        path: 'src/main.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/main.ts',
        linkLabel: '查看 Windows 宿主',
        related: ['heroRuntime']
      },
      heroRuntime: {
        scope: '分发策略 / Runtime',
        title: '运行时随安装包交付',
        body: '各平台均使用应用自带的固定版本 Node.js 运行时，不依赖 Termux，也不受系统 PATH 干扰。',
        relation: '安装包 → 固定运行时 → 本地实例',
        stack: ['Node.js', 'arm64', 'x64', '版本固定'],
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
        path: 'src/provision-workflow.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/provision-workflow.ts',
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
        title: '通用 React 控制台',
        body: '实例配置、状态和日志界面在主仓库统一维护基线，再按各端契约同步至 Windows、Android、iOS 与 Pages。',
        relation: 'React UI → Platform Contract',
        stack: ['React 19', 'TanStack Router', 'TanStack Query', 'Tailwind CSS 4'],
        path: 'web/capacitor-ui/src/routes/index.tsx',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/web/capacitor-ui/src/routes/index.tsx',
        linkLabel: '查看控制台源码',
        related: ['runtimeContract']
      },
      runtimeContract: {
        scope: '运行架构 / Contract',
        title: '接口隔离平台差异',
        body: '前端只调用稳定的 TarvenEnv 契约；各平台原生宿主分别实现文件、下载、进程和窗口能力。',
        relation: 'React Console → TarvenEnv → Native Host',
        stack: ['TypeScript', 'Capacitor Plugin', 'Electron IPC'],
        path: 'web/capacitor-ui/src/capacitor-plugin.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/web/capacitor-ui/src/capacitor-plugin.ts',
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
        body: 'Windows 宿主通过纯净门面与自治领域服务实现同一契约，负责独立窗口、文件系统与进程管理。',
        relation: 'TarvenEnv → Electron → Windows Node.js',
        stack: ['Electron', 'TypeScript', 'BrowserWindow', 'Node.js'],
        path: 'src/plugin.ts',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/plugin.ts',
        linkLabel: '查看 Windows 实现',
        related: ['runtimeContract']
      },
      sourceFrontend: {
        scope: '源码流向 / Single Source',
        title: '通用前端统一维护基线',
        body: '跨端通用界面与动效在 web/capacitor-ui 维护；平台宿主内的副本由官方同步脚本生成与校验。',
        relation: 'web/capacitor-ui → Windows / Android / iOS / Pages',
        stack: ['pnpm', 'Vite 7', 'TypeScript 5.8', 'Sync Scripts'],
        path: 'web/capacitor-ui/',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/web/capacitor-ui',
        linkLabel: '浏览前端源码',
        related: ['repoMain', 'repoAndroid', 'repoWindows', 'repoBuild']
      },
      repoMain: {
        scope: '仓库职责 / Main',
        title: '公共入口与发布中心',
        body: '主仓库维护通用前端基线、GitHub Pages、公共文档、Release 记录与各平台正式安装包。',
        relation: 'Shared UI + Pages + Releases',
        stack: ['GitHub Pages', 'React 19', 'Three.js', 'Release Assets'],
        path: 'docs/',
        href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/docs',
        linkLabel: '浏览主仓库',
        related: ['sourceFrontend', 'repoBuild']
      },
      repoAndroid: {
        scope: '仓库职责 / Android',
        title: 'Android 宿主与运行时',
        body: 'Android 仓库维护 Kotlin 原生宿主、SAF 存储契约以及 arm64 Bionic Node.js 运行时资源。',
        relation: 'Synced UI + Kotlin Host + APK',
        stack: ['Kotlin', 'Gradle', 'Capacitor', 'Bionic Node.js'],
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
        title: '构建一次，多端同步',
        body: '前端构建后通过官方同步脚本分发至各平台宿主与 Pages docs/app；所有目标产物均可重新生成。',
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
      heroWindows: { scope: 'Platform / Windows', title: 'Electron owns the desktop lifecycle', body: 'The desktop host manages console and content windows plus the bundled runtime, exposing files and processes through typed IPC contracts.', relation: 'React Console → IPC Bridge → SillyTavern', stack: ['Electron 33', 'TypeScript', 'Node.js 22', 'NSIS'], path: 'src/main.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/main.ts', linkLabel: 'View Windows host', related: ['heroRuntime'] },
      heroRuntime: { scope: 'Distribution / Runtime', title: 'The runtime ships with the app', body: 'Every platform uses its bundled Node.js runtime instead of Termux or a Node.js installation found on PATH.', relation: 'Installer → Pinned Runtime → Local Instance', stack: ['Node.js', 'arm64', 'x64', 'Pinned Version'], path: 'docs/adr/0003-bundled-platform-runtimes.md', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/docs/adr/0003-bundled-platform-runtimes.md', linkLabel: 'Read runtime decision', related: ['heroAndroid', 'heroWindows'] },
      flowProvision: { scope: 'Instance lifecycle / 01', title: 'Verify before creation completes', body: 'Download, extraction, dependency installation, and the readiness probe must all pass before an instance becomes available.', relation: 'Release / ZIP → Install → Readiness Probe', stack: ['GitHub Releases', 'ZIP', 'npm', 'Readiness Probe'], path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', linkLabel: 'View provisioning flow', related: ['flowRuntime'] },
      flowRuntime: { scope: 'Instance lifecycle / 02', title: 'The native host maintains service state', body: 'The host selects a port, starts Node.js, forwards output, and synchronizes status while the console presents and controls it.', relation: 'Port → Node.js Process → Status and Logs', stack: ['Process API', 'stdio', 'Port Probe', 'Node.js'], path: 'src/provision-workflow.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/provision-workflow.ts', linkLabel: 'View process management', related: ['flowProvision', 'flowWindow'] },
      flowWindow: { scope: 'Instance lifecycle / 03', title: 'Management and content stay separate', body: 'Closing the SillyTavern content view returns to the console without stopping the local instance that is still running.', relation: 'Console ↔ Content Window ↔ Service', stack: ['WebView', 'BrowserWindow', 'Window State'], path: 'docs/phone-demo.html', href: './phone-demo.html', linkLabel: 'Open interface demo', related: ['flowRuntime'] },
      runtimeFrontend: { scope: 'Runtime / Shared UI', title: 'Shared React console', body: 'Instance settings, status, and logs are maintained in the main repository baseline, then synchronized across Windows, Android, iOS, and Pages.', relation: 'React UI → Platform Contract', stack: ['React 19', 'TanStack Router', 'TanStack Query', 'Tailwind CSS 4'], path: 'web/capacitor-ui/src/routes/index.tsx', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/web/capacitor-ui/src/routes/index.tsx', linkLabel: 'View console source', related: ['runtimeContract'] },
      runtimeContract: { scope: 'Runtime / Contract', title: 'A contract isolates platform differences', body: 'The frontend calls a stable TarvenEnv contract while native hosts implement files, downloads, processes, and windows.', relation: 'React Console → TarvenEnv → Native Host', stack: ['TypeScript', 'Capacitor Plugin', 'Electron IPC'], path: 'web/capacitor-ui/src/capacitor-plugin.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/web/capacitor-ui/src/capacitor-plugin.ts', linkLabel: 'View platform contract', related: ['runtimeFrontend', 'runtimeAndroid', 'runtimeWindows'] },
      runtimeAndroid: { scope: 'Runtime / Android', title: 'Kotlin implements mobile capabilities', body: 'The Android host owns instance files, DisplayCutout handling, two WebViews, and the Bionic Node.js lifecycle.', relation: 'TarvenEnv → Kotlin → Bionic Node.js', stack: ['Kotlin', 'Android WebView', 'DisplayCutout', 'JNI'], path: 'app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android/blob/main/app/src/main/java/com/sillyclient/plugin/TarvenEnvPlugin.kt', linkLabel: 'View Android implementation', related: ['runtimeContract'] },
      runtimeWindows: { scope: 'Runtime / Windows', title: 'Electron implements desktop capabilities', body: 'The Windows host implements the same contract through a clean facade and domain services for windows, files, and processes.', relation: 'TarvenEnv → Electron → Windows Node.js', stack: ['Electron', 'TypeScript', 'BrowserWindow', 'Node.js'], path: 'src/plugin.ts', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows/blob/main/src/plugin.ts', linkLabel: 'View Windows implementation', related: ['runtimeContract'] },
      sourceFrontend: { scope: 'Source flow / Single Source', title: 'One baseline for the shared frontend', body: 'Cross-platform UI and motion live in web/capacitor-ui. Platform copies are generated and verified by official sync scripts.', relation: 'web/capacitor-ui → Windows / Android / iOS / Pages', stack: ['pnpm', 'Vite 7', 'TypeScript 5.8', 'Sync Scripts'], path: 'web/capacitor-ui/', href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/web/capacitor-ui', linkLabel: 'Browse frontend source', related: ['repoMain', 'repoAndroid', 'repoWindows', 'repoBuild'] },
      repoMain: { scope: 'Repository / Main', title: 'Public entry and release center', body: 'The main repository owns the shared frontend baseline, GitHub Pages, public documentation, release records, and official installers.', relation: 'Shared UI + Pages + Releases', stack: ['GitHub Pages', 'React 19', 'Three.js', 'Release Assets'], path: 'docs/', href: 'https://github.com/CAPTCHAAAAA/SillyClient/tree/main/docs', linkLabel: 'Browse main repository', related: ['sourceFrontend', 'repoBuild'] },
      repoAndroid: { scope: 'Repository / Android', title: 'Android host and runtime', body: 'The Android repository owns the Kotlin native host, SAF storage contract, and arm64 Bionic Node.js runtime assets.', relation: 'Synced UI + Kotlin Host + APK', stack: ['Kotlin', 'Gradle', 'Capacitor', 'Bionic Node.js'], path: 'SillyClient-Android', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Android', linkLabel: 'Browse Android repository', related: ['sourceFrontend', 'repoBuild'] },
      repoWindows: { scope: 'Repository / Windows', title: 'Desktop host and installer', body: 'The Windows repository owns the Electron host, runtime preparation scripts, and the NSIS installer.', relation: 'Synced UI + Electron Host + EXE', stack: ['Electron Builder', 'TypeScript', 'PowerShell', 'NSIS'], path: 'SillyClient-Windows', href: 'https://github.com/CAPTCHAAAAA/SillyClient-Windows', linkLabel: 'Browse Windows repository', related: ['sourceFrontend', 'repoBuild'] },
      repoBuild: { scope: 'Build flow / Generated', title: 'Build once, sync across targets', body: 'The frontend build feeds platform hosts and Pages docs/app through official sync scripts. Each target can be regenerated.', relation: 'Source → Build → Platform Artifacts', stack: ['Vite Build', 'Integrity Check', 'Sync Scripts'], path: 'scripts/sync-pages-app.mjs', href: 'https://github.com/CAPTCHAAAAA/SillyClient/blob/main/scripts/sync-pages-app.mjs', linkLabel: 'View sync script', related: ['sourceFrontend', 'repoMain', 'repoAndroid', 'repoWindows'] }
    }
  };

export { inspectorCatalog };
