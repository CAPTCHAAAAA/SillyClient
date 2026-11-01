window.SC_SHOWCASE_COPY = {
  "zh": {
    "documentTitle": "SillyClient | SillyTavern 跨平台启动与管理工具",
    "metaDescription": "面向 Windows、Android 与 iOS 的 SillyTavern（酒馆）启动与管理工具。内置 Node.js 运行环境，支持应用内下载部署、多版本实例管理与远程酒馆连接。",
    "download": "功能与界面",
    "source": "功能与界面",
    "heroEyebrow": "Windows · Android · iOS 酒馆启动与管理工具",
    "heroTagline": "无需配置环境，在手机与电脑上直接运行 SillyTavern。",
    "heroSubtitle": "内置 Node.js 运行环境，省去命令行与依赖配置。可在应用内直接下载酒馆版本、导入本地压缩包、管理多个独立实例，或添加地址连接已有的远程酒馆。",
    "experienceTitle": "本机独立运行，或跨设备连接。",
    "experienceBody": "三端共用同一套管理界面。既可在手机或电脑上独立部署运行，也可直接连接电脑与服务器上的现有酒馆。",
    "devicePhoneTitle": "移动端：脱离电脑，手机独立运行",
    "devicePhoneBody": "无需安装 Termux 或配置命令行。在手机应用内即可完成版本下载、目录选择与服务启动，直接进入酒馆聊天界面。",
    "deviceDesktopTitle": "Windows：窗口分离，后台常驻运行",
    "deviceDesktopBody": "无需保持命令行窗口常开。控制台与酒馆聊天窗口彼此独立，关闭聊天窗口不会中断后台服务，支持多版本实例并存。",
    "deviceTogetherTitle": "远程连接：直连电脑与服务器酒馆",
    "deviceTogetherBody": "若酒馆已运行在电脑、局域网或云服务器上，填入服务地址与访问密码即可直接连接使用，无需在当前设备重复安装。",
    "modelNotice": "MIT 开源免费 · 安装包已内置运行环境，支持多镜像下载与 ZIP 离线导入",
    "kicker": "02 / 演示与界面实览",
    "heading": "从首次部署，\n到日常管理与维护。",
    "intro": "先通过实机视频了解整体流程，\n再逐一查看各核心界面的实际用途。",
    "watchVideo": "观看实机演示",
    "platformIndex": "02 / 演示与界面实览",
    "platformTitleLead": "从首次部署，",
    "platformTitleTail": "到日常管理与维护。",
    "platformBody": "先通过实机视频了解整体流程，再逐一查看主页列表、新建向导、卡片菜单、内置终端与壁纸设置的实际界面。",
    "platformCarouselLabel": "SillyClient 实机演示与界面实览",
    "stageLabels": ["实机演示", "界面实览"],
    "galleryStageTitle": "界面实览",
    "galleryLabel": "SillyClient 界面图片",
    "imageNote": "Android 界面 · 产品渲染图",
    "enlarge": "查看大图",
    "previousImage": "上一张",
    "nextImage": "下一张",
    "close": "关闭",
    "videoTitle": "SillyClient 实机操作演示",
    "additionalVideoLabel": "版本演进",
    "additionalVideoTitle": "SillyClient 版本功能演示",
    "videoVersion": "演示版本 1.8.1",
    "videoFallback": "在哔哩哔哩观看",
    "downloadControl": {
      "platform": "选择系统平台",
      "download": "下载 {platform} 最新安装包",
      "manual": "前往 Releases 查看全部版本与更新日志",
      "loading": "正在查询最新安装包…",
      "started": "已开始下载 {platform} 安装包。",
      "missing": "当前版本未包含 {platform} 安装包，请点击下方查看全部版本。",
      "failed": "无法获取安装包，请稍后重试或点击下方查看全部版本。"
    },
    "slides": [
      {
        "id": "overview",
        "tab": "实例主页",
        "title": "本地酒馆与远程连接同屏排列，版本与运行状态清晰可见",
        "body": "在主页集中管理多个互不干扰的酒馆环境。支持按名称搜索、长按拖拽调整卡片顺序，点击卡片即可启动服务或直接进入聊天界面。",
        "alt": "SillyClient 主页，显示搜索栏、新建实例入口和带版本号标签的本地实例卡片"
      },
      {
        "id": "create",
        "tab": "新建与导入",
        "title": "自选存放目录，支持在线下载、导入 ZIP 与启用主题预设",
        "body": "同一向导覆盖本地部署与远程连接。创建本地酒馆时可自由指定文件夹路径，除在线获取各版本外，也支持直接导入现有 ZIP 备份，并在安装时自动写入配套主题与扩展。",
        "alt": "新建实例界面，包含本地与远程模式切换、安装目录选择、版本下拉、ZIP 导入和 SC Bordeaux 主题预设开关"
      },
      {
        "id": "manage",
        "tab": "卡片菜单",
        "title": "在卡片菜单中快速重命名、更换封面插图或设置访问密码",
        "body": "针对多个酒馆实例，可通过更换封面插图与重命名（自动同步底层文件夹名称）直观区分用途，也可随时调出管理面板或彻底清理不再使用的实例文件。",
        "alt": "实例卡片展开的快捷菜单，包含管理、重命名、更换插图和删除实例四项操作"
      },
      {
        "id": "configure",
        "tab": "参数与终端",
        "title": "内置实时终端与参数面板，集中处理端口修改、迁移与排障",
        "body": "将进阶维护功能集中在单实例面板内：随时调整监听端口与启动参数，一键迁移实例存放位置或导出备份，并通过内置终端实时查看 Node.js 运行日志与执行维护指令。",
        "alt": "实例管理面板，包含启动参数、存储、终端与关于标签，当前展示内置终端界面"
      },
      {
        "id": "personalize",
        "tab": "背景与壁纸",
        "title": "从顶栏时间胶囊直接切换浅色、深色、动态壁纸或自定义背景",
        "body": "无需进入多层设置菜单，从顶部状态栏即可直接展开背景设置面板。支持开启或关闭实时渲染的流体动态壁纸，也可上传本地图片定制控制台背景。",
        "alt": "从顶栏时间区域展开的背景设置浮层，包含基础与自定义背景切换及动态壁纸开关"
      }
    ]
  },
  "en": {
    "documentTitle": "SillyClient | Cross-Platform SillyTavern Launcher & Manager",
    "metaDescription": "SillyTavern launcher and manager for Windows, Android, and iOS. Built-in Node.js runtime with in-app deployment, multi-instance management, and remote server connection.",
    "download": "Interface",
    "source": "Interface",
    "heroEyebrow": "SillyTavern Launcher & Manager for Windows · Android · iOS",
    "heroTagline": "Run and manage SillyTavern on phone and PC without environment setup.",
    "heroSubtitle": "Includes a built-in Node.js runtime with no command-line setup required. Download releases directly in the app, import local archives, manage multiple isolated instances, or connect to an existing remote server.",
    "experienceTitle": "Run on your device, or connect across.",
    "experienceBody": "All platforms share one management interface. Deploy and run SillyTavern standalone on your phone or PC, or connect directly to an existing server on your computer or cloud host.",
    "devicePhoneTitle": "Mobile: Standalone on your phone",
    "devicePhoneBody": "No Termux or command-line setup required. Download releases, choose a storage folder, and start the service directly in the mobile app to enter SillyTavern.",
    "deviceDesktopTitle": "Windows: Separate console & service",
    "deviceDesktopBody": "No command prompt window to keep open. The console and chat window run independently—closing the chat window keeps the background service alive, while multiple versions coexist cleanly.",
    "deviceTogetherTitle": "Remote: Connect to PC or server",
    "deviceTogetherBody": "If SillyTavern is already running on your PC, local network, or cloud host, enter its address and password to connect directly without installing another local copy.",
    "modelNotice": "Free & open-source (MIT) · Bundled runtime with multi-mirror download and offline ZIP import",
    "kicker": "02 / WALKTHROUGH & INTERFACE",
    "heading": "From first deployment\nto daily maintenance.",
    "intro": "Watch the real-device walkthrough,\nthen inspect each core interface view.",
    "watchVideo": "Watch walkthrough",
    "platformIndex": "02 / WALKTHROUGH & INTERFACE",
    "platformTitleLead": "From first deployment ",
    "platformTitleTail": "to daily maintenance.",
    "platformBody": "Start with the real-device video walkthrough, then explore the actual views for the home list, setup wizard, card actions, built-in terminal, and wallpaper settings.",
    "platformCarouselLabel": "SillyClient walkthrough and interface gallery",
    "stageLabels": ["Walkthrough", "Interface"],
    "galleryStageTitle": "Interface gallery",
    "galleryLabel": "SillyClient interface gallery",
    "imageNote": "Android interface · Product render",
    "enlarge": "View full image",
    "previousImage": "Previous image",
    "nextImage": "Next image",
    "close": "Close",
    "videoTitle": "SillyClient real-device walkthrough",
    "additionalVideoLabel": "Feature video",
    "additionalVideoTitle": "SillyClient version feature showcase",
    "videoVersion": "Recorded with version 1.8.1",
    "videoFallback": "Watch on Bilibili",
    "downloadControl": {
      "platform": "Select platform",
      "download": "Download latest {platform} installer",
      "manual": "View all releases and changelog on GitHub",
      "loading": "Checking latest installer...",
      "started": "{platform} installer download started.",
      "missing": "No {platform} installer in this release. View all releases below.",
      "failed": "Unable to fetch the installer. Try again or view all releases below."
    },
    "slides": [
      {
        "id": "overview",
        "tab": "Instance Home",
        "title": "Local instances and remote servers arranged as cards with clear version and status tags",
        "body": "Manage multiple isolated SillyTavern environments on one screen. Search by name, drag to reorder cards, and tap any card to start the service or enter the chat interface.",
        "alt": "SillyClient home screen with search bar, create card, and a local instance card showing its version tag"
      },
      {
        "id": "create",
        "tab": "Create & Import",
        "title": "Choose a storage folder, download a release or import a ZIP, and apply theme presets",
        "body": "One guided modal covers both local setup and remote connections. Pick any target folder, download an official release or import a local ZIP archive, and automatically apply companion themes and extensions upon install.",
        "alt": "Create dialog with local and remote modes, installation folder, release selector, ZIP import, and SC Bordeaux theme preset switch"
      },
      {
        "id": "manage",
        "tab": "Card Menu",
        "title": "Quickly rename instances, customize cover artwork, or set a local access password",
        "body": "Distinguish multiple instances with custom cover illustrations and names (synced with the underlying folder), configure a local password lock, or cleanly remove unused installations.",
        "alt": "Instance card context menu showing manage, rename, change artwork, and delete actions"
      },
      {
        "id": "configure",
        "tab": "Config & Terminal",
        "title": "Built-in live terminal and parameter controls for port changes, migration, and debugging",
        "body": "Advanced maintenance in one panel: adjust listening ports and launch arguments, relocate storage directories or export backups, and inspect live Node.js logs or run shell commands in the built-in terminal.",
        "alt": "Instance management panel showing startup parameters, storage, terminal, and about tabs with the terminal open"
      },
      {
        "id": "personalize",
        "tab": "Wallpaper",
        "title": "Switch between light, dark, animated fluid wallpaper, or custom images from the top bar",
        "body": "Access appearance controls directly from the top status bar without digging through menus. Toggle real-time animated fluid wallpapers or apply your own custom background image.",
        "alt": "Background settings popover expanded from the top clock bar with basic, custom, and animated wallpaper controls"
      }
    ]
  }
};
