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

export { inspectorCatalog };
