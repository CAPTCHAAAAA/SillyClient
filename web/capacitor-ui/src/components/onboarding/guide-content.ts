export type GuidePlatform = "web" | "windows" | "android" | "ios";

export const guideImages = {
  home: { file: "home", width: 1280, height: 900, alt: "启动器首页，顶部控制岛、实例搜索、卡片与底部分页" },
  toolbar: { file: "toolbar", width: 672, height: 48, alt: "顶部控制岛，左侧终端、中间时间与背景设置、右侧应用设置" },
  card: { file: "card", width: 240, height: 321, alt: "展开的普通实例卡片，显示版本、名称、使用信息、启动与更多按钮" },
  menu: { file: "card-menu", width: 176, height: 176, alt: "实例更多菜单：管理、重命名、更换插图、删除实例" },
  rename: { file: "rename", width: 240, height: 321, alt: "普通卡片标题区域的重命名输入栏与取消、保存按钮" },
  running: { file: "running", width: 240, height: 321, alt: "运行态卡片，上方名称与版本，中间终端，下方返回酒馆、关闭与更多" },
  local: { file: "new-local", width: 460, height: 486, alt: "新建本地实例：名称、实例模式、安装目录、版本与预设安装" },
  presets: { file: "presets", width: 460, height: 766, alt: "创建面板展开预设安装，包含 SC Bordeaux 主题和各扩展开关" },
  remote: { file: "new-remote", width: 460, height: 506, alt: "新建远程连接：连接地址、Basic Auth 开关、用户名与密码" },
  import: { file: "new-import", width: 460, height: 668, alt: "数据迁移面板：来源文件夹或 ZIP、目标目录、敏感配置选项和检测" },
  launch: { file: "launch-progress", width: 340, height: 410, alt: "打开实例时的启动控制台，包含日志、当前阶段、进度条与隐藏按钮" },
  create: { file: "create-progress", width: 340, height: 410, alt: "创建实例时的控制台，包含安装日志、当前阶段、进度条与取消按钮" },
  manage: { file: "manage-launch", width: 630, height: 612, alt: "实例管理的启动参数页，左侧实例列表，右侧端口、网络、保活与密码设置" },
  password: { file: "manage-password-fields", width: 630, height: 712, alt: "实例管理中的访问密码保护表单，包含设置密码、确认密码与保存按钮" },
  unlock: { file: "unlock", width: 360, height: 234, alt: "启动锁定实例时的本地解锁提示，包含密码输入、显示密码、取消和解锁启动" },
  relocate: { file: "relocate", width: 460, height: 416, alt: "迁移实例存储目录窗口，自定义目录页显示当前位置、目标输入与浏览和开始迁移按钮" },
  storage: { file: "manage-storage", width: 630, height: 376, alt: "存储路径页：实例位置、占用空间、更换插图、迁移目录与维护扫描" },
  instanceTerminal: { file: "manage-terminal", width: 630, height: 458, alt: "实例管理中的实例终端分类，包含日志区与底部命令输入" },
  about: { file: "manage-about", width: 630, height: 436, alt: "关于实例页：实例名称、版本、类型、状态和创建时间" },
  terminal: { file: "terminal", width: 641, height: 340, alt: "独立终端窗口，顶部字号滑杆、清空与关闭，下方日志和命令输入" },
  background: { file: "background-basic", width: 288, height: 193, alt: "背景设置的基础模式与动态壁纸开关" },
  wallpaper: { file: "background-custom", width: 288, height: 313, alt: "自定义背景设置，暗夜或白天风格，以及导入本地图片入口" },
  general: { file: "settings-general", width: 460, height: 594, alt: "应用通用设置，含下拉刷新、移动端取色与光效、重新演示引导和创建卡片置顶" },
  data: { file: "settings-data", width: 460, height: 446, alt: "应用数据设置：默认实例存储路径、实例备份导入导出和浏览数据清除" },
  maintenance: { file: "settings-maintenance", width: 460, height: 520, alt: "应用维护设置：检查新版本、临时文件检查、重置和项目发布页" },
} as const;

export interface GuideLesson {
  id: string;
  label: string;
  title: string;
  summary: string;
  image: keyof typeof guideImages;
  note?: string;
  platforms?: readonly GuidePlatform[];
}

export interface GuideChapter {
  id: string;
  title: string;
  lessons: readonly GuideLesson[];
}

export const guideChapters: readonly GuideChapter[] = [
  {
    id: "start",
    title: "认识启动器",
    lessons: [
      {
        id: "control-island",
        label: "顶部入口",
        title: "三个常用入口",
        summary: "左侧打开终端，中间调整背景，右侧进入应用设置。",
        image: "toolbar",
      },
      {
        id: "find-instance",
        label: "搜索翻页",
        title: "搜索与翻页",
        summary: "输入名称筛选实例；左右滑动或点底部分页切换，桌面也可用方向键。",
        image: "home",
      },
      {
        id: "card-details",
        label: "展开卡片",
        title: "展开卡片",
        summary: "点击卡片展开，再点一次收起；「启动」打开酒馆，三点菜单管理实例。",
        image: "card",
      },
    ],
  },
  {
    id: "create",
    title: "创建与连接",
    lessons: [
      {
        id: "create-local",
        label: "本地实例",
        title: "创建本地实例",
        summary: "点「新建实例」，选择本地模式，填写名称、选择目录和版本后创建。",
        image: "local",
      },
      {
        id: "choose-version",
        label: "安装版本",
        title: "版本与源码",
        summary: "选择内置版、在线版本，或用「导入 ZIP」安装酒馆源码。",
        image: "local",
        note: "旧实例的聊天、角色等数据请从「数据迁移」导入。",
      },
      {
        id: "preinstall",
        label: "预设安装",
        title: "预设安装",
        summary: "展开「预设安装」，按需启用 SC Bordeaux 主题与扩展。",
        image: "presets",
      },
      {
        id: "connect-remote",
        label: "远程连接",
        title: "添加远程连接",
        summary: "选择远程模式，填写完整 http(s) 地址；服务需要时再填写 Basic Auth。",
        image: "remote",
      },
      {
        id: "operation-progress",
        label: "进度提示",
        title: "启动进度",
        summary: "下方显示阶段与进度，终端保留详细日志；点「隐藏」后任务仍会继续。",
        image: "launch",
      },
      {
        id: "cancel-create",
        label: "取消重试",
        title: "取消与重试",
        summary: "创建中可点「取消」终止；失败时先看日志，再按提示重试。",
        image: "create",
        note: "创建完成后可选「进入酒馆」或「稍后」。",
      },
    ],
  },
  {
    id: "cards",
    title: "卡片与运行",
    lessons: [
      {
        id: "running-card",
        label: "运行卡片",
        title: "运行卡片",
        summary: "点击运行卡片展开操作；终端可滚动查看日志，在底部输入命令。",
        image: "running",
      },
      {
        id: "return-and-stop",
        label: "返回关闭",
        title: "返回与关闭",
        summary: "「返回酒馆」继续访问，「关闭」停止本地实例。",
        image: "running",
        note: "关闭远程连接不会停止远端服务。",
      },
      {
        id: "reorder-cards",
        label: "拖动排序",
        title: "拖动排序",
        summary: "长按未运行卡片，抬起后拖动排序；关闭「创建卡片置顶」后，新建卡也能移动。",
        image: "home",
      },
      {
        id: "rename-card",
        label: "重命名",
        title: "重命名",
        summary: "未运行卡片的三点 → 重命名，输入后保存；取消或按 Esc 放弃。",
        image: "rename",
      },
      {
        id: "cover-and-remove",
        label: "插图删除",
        title: "插图与删除",
        summary: "在三点菜单更换插图或删除实例；卡片插图不会改变首页壁纸。",
        image: "menu",
        note: "删除前备份文件，并确认是否会删除本地数据。",
      },
    ],
  },
  {
    id: "manage",
    title: "实例管理",
    lessons: [
      {
        id: "manage-navigation",
        label: "管理入口",
        title: "管理实例",
        summary: "三点 → 管理。左侧切换实例，上方切换分类；参数改完后保存，桌面可拖右下角缩放。",
        image: "manage",
      },
      {
        id: "port-and-listen",
        label: "端口监听",
        title: "端口与监听",
        summary: "为本地实例设置不冲突的端口；需要局域网访问时再开启「允许外部连接」。",
        image: "manage",
        note: "开放连接前，请先配置认证与网络访问限制。",
      },
      {
        id: "network-options",
        label: "网络保活",
        title: "网络与保活",
        summary: "按网络选择 IPv4 / IPv6、连接保活与心跳间隔；填 0 可关闭心跳。",
        image: "manage",
      },
      {
        id: "remote-auth",
        label: "远程认证",
        title: "远程认证",
        summary: "仅在远端启用 Basic Auth 时填写账号密码；可在创建或管理页修改。",
        image: "remote",
        note: "Basic Auth 不是酒馆登录密码，也不是本地访问密码。",
      },
      {
        id: "access-password",
        label: "访问密码",
        title: "访问密码",
        summary: "在启动参数中开启访问保护，填写并保存密码；修改或解除时需验证原密码。",
        image: "password",
        note: "访问保护不会加密实例文件，请妥善保管密码。",
      },
      {
        id: "unlock-instance",
        label: "解锁启动",
        title: "解锁启动",
        summary: "启动带锁定标记的卡片，输入本地访问密码，再点「解锁启动」。校验无需联网。",
        image: "unlock",
      },
      {
        id: "storage-and-about",
        label: "存储路径",
        title: "存储路径",
        summary: "在「存储路径」查看实例位置和占用；更换插图、迁移与维护也在这里。",
        image: "storage",
      },
      {
        id: "about-instance",
        label: "关于实例",
        title: "关于实例",
        summary: "在「关于实例」查看名称、酒馆版本和状态；应用版本在设置 → 维护查看。",
        image: "about",
      },
    ],
  },
  {
    id: "console",
    title: "终端与排错",
    lessons: [
      {
        id: "console-entry",
        label: "终端入口",
        title: "终端入口",
        summary: "左上角看独立终端；管理页看选中实例，运行卡看当前日志，进度卡看本次任务。",
        image: "instanceTerminal",
      },
      {
        id: "console-tools",
        label: "终端操作",
        title: "终端操作",
        summary: "顶部滑杆调字号，底部输入命令后按 Enter；桌面可拖标题栏移动、拖右下角缩放。",
        image: "terminal",
        note: "「清空」只清显示日志，关闭终端不会停止实例。",
      },
      {
        id: "instance-maintenance",
        label: "实例维护",
        title: "实例维护",
        summary: "管理 → 存储路径 → 扫描，核对检测结果后再处理需要清理的项目。",
        image: "storage",
        note: "先备份重要文件，并非所有清理都能恢复。",
      },
      {
        id: "global-cleanup",
        label: "全局清理",
        title: "缓存清理",
        summary: "设置 → 数据可清浏览数据；维护页可检查临时文件，确认范围后再清理。",
        image: "maintenance",
      },
    ],
  },
  {
    id: "appearance",
    title: "背景与外观",
    lessons: [
      {
        id: "themes",
        label: "基础背景",
        title: "基础背景",
        summary: "点顶部时间打开背景设置；「基础」可开关动态壁纸，「自定义」可切换明暗风格。",
        image: "background",
      },
      {
        id: "custom-wallpaper",
        label: "自定义图",
        title: "自定义壁纸",
        summary: "背景 → 自定义 → 导入本地图片；可更换、移除，或切回「基础」恢复流光背景。",
        image: "wallpaper",
      },
      {
        id: "title-font",
        label: "首页标题",
        title: "首页字体",
        summary: "点击首页 SillyClient 标题切换展示字体，不影响正文和终端。",
        image: "home",
      },
    ],
  },
  {
    id: "settings",
    title: "应用设置",
    lessons: [
      {
        id: "general-settings",
        label: "通用偏好",
        title: "通用偏好",
        summary: "设置 → 通用可调整下拉刷新与创建卡片置顶；Windows 还可选择系统浏览器打开。",
        image: "general",
      },
      {
        id: "mobile-color",
        label: "取色光效",
        title: "取色与光效",
        summary: "开启「顶栏变色龙」让顶栏跟随页面取色；还可调整取色频率与点击光效。",
        image: "general",
        platforms: ["android", "ios"],
      },
      {
        id: "app-update",
        label: "应用更新",
        title: "应用更新",
        summary: "设置 → 维护 → 检查新版本，发现更新后使用对应平台的下载入口。",
        image: "maintenance",
        note: "这里更新的是 SillyClient，不是实例内的酒馆。",
      },
      {
        id: "replay-and-reset",
        label: "重播重置",
        title: "重播与重置",
        summary: "在通用设置中「重新演示引导」；点跳过或按 Esc 随时退出。",
        image: "general",
        note: "重置在维护页，是独立操作；先备份，再确认。",
      },
    ],
  },
  {
    id: "data",
    title: "备份与迁移",
    lessons: [
      {
        id: "list-backup",
        label: "列表备份",
        title: "实例列表备份",
        summary: "设置 → 数据 → 实例备份，用 JSON 导入、导出实例列表。",
        image: "data",
        note: "仅备份登记信息，不含聊天、角色或实例文件。",
      },
      {
        id: "full-export",
        label: "完整导出",
        title: "完整文件备份",
        summary: "先停止本地实例，再从管理 → 存储路径 → 导出实例（ZIP），选择保存位置。",
        image: "storage",
        platforms: ["windows"],
        note: "完整文件备份与设置页的 JSON 列表备份不同。",
      },
      {
        id: "default-location",
        label: "默认目录",
        title: "默认存储位置",
        summary: "设置 → 数据可更改默认实例存储路径；新建时仍需确认实际目标。",
        image: "data",
        note: "更改默认位置不会移动已有实例。",
      },
      {
        id: "import-existing",
        label: "导入数据",
        title: "导入已有实例",
        summary: "新建实例 → 数据迁移，选择来源文件夹或 ZIP 和目标目录，检测通过后导入。",
        image: "import",
        note: "确认新实例数据完整前，请保留原文件。",
      },
      {
        id: "relocate-instance",
        label: "迁移目录",
        title: "迁移存储目录",
        summary: "停止实例后，在管理 → 存储路径 → 迁移目录中选择新位置。",
        image: "relocate",
        note: "迁移前先备份，完成后核对新路径与数据。",
      },
      {
        id: "legacy-discovery",
        label: "旧版发现",
        title: "旧版实例",
        summary: "Windows 的旧版迁移提示可找回已有实例；也可从「数据迁移」手动检测来源。",
        image: "import",
        platforms: ["windows"],
        note: "复制与接管的处理不同，请先核对提示再确认。",
      },
    ],
  },
];

export function getGuideChapters(platform: GuidePlatform): GuideChapter[] {
  return guideChapters
    .map((chapter) => ({
      ...chapter,
      lessons: chapter.lessons.filter((lesson) =>
        platform === "web" || !lesson.platforms || lesson.platforms.includes(platform),
      ),
    }))
    .filter((chapter) => chapter.lessons.length > 0);
}

export function getGuideImage(image: keyof typeof guideImages) {
  const details = guideImages[image];
  return { ...details, src: `./onboarding/v4/${details.file}.webp` };
}
