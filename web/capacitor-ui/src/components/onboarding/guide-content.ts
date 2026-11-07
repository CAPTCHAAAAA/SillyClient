export type GuidePlatform = "web" | "windows" | "android" | "ios";

export const guideImages = {
  home: { file: "home", width: 1280, height: 900, alt: "启动器首页，顶部控制岛、实例搜索、卡片与底部分页" },
  toolbar: { file: "toolbar", width: 672, height: 48, alt: "顶部控制岛，左侧终端、中间时间与背景设置、右侧应用设置" },
  card: { file: "card", width: 240, height: 321, alt: "展开的普通实例卡片，显示版本、名称、使用信息、启动与更多按钮" },
  menu: { file: "card-menu", width: 176, height: 176, alt: "实例更多菜单：管理、更换插图、删除实例" },
  running: { file: "running", width: 240, height: 321, alt: "运行态卡片，上方名称与版本，中间终端，下方返回酒馆、关闭与更多" },
  manage: { file: "manage-launch", width: 630, height: 612, alt: "实例管理的启动参数页，左侧实例列表，右侧端口、网络、保活与密码设置" },
  storage: { file: "manage-storage", width: 630, height: 494, alt: "存储路径页：实例位置、占用空间、ZIP 导入导出、插图与维护扫描" },
  instanceTerminal: { file: "manage-terminal", width: 630, height: 458, alt: "实例管理中的实例终端分类与日志区" },
  terminal: { file: "terminal", width: 641, height: 340, alt: "独立终端窗口，顶部字号滑杆、清空与关闭，下方日志区" },
  background: { file: "background-basic", width: 288, height: 193, alt: "背景设置的基础模式与动态壁纸开关" },
  general: { file: "settings-general", width: 460, height: 594, alt: "应用通用设置，含下拉刷新、移动端取色与光效、重新演示引导和创建卡片置顶" },
  maintenance: { file: "settings-maintenance", width: 460, height: 520, alt: "应用维护设置：检查新版本、临时文件检查、重置和项目发布页" },
} as const;

export interface GuideLesson {
  id: string;
  title: string;
  summary: string;
  image: keyof typeof guideImages;
  platforms?: readonly GuidePlatform[];
}

export interface GuideChapter {
  id: string;
  title: string;
  lessons: readonly GuideLesson[];
}

export const guideChapters: readonly GuideChapter[] = [
  {
    id: "basics",
    title: "先记住这几处",
    lessons: [
      {
        id: "top-entries",
        title: "顶部三个入口",
        summary: "左侧打开终端，中间调整背景，右侧进入应用设置。",
        image: "toolbar",
      },
      {
        id: "card-expand",
        title: "卡片展开",
        summary: "点卡片查看操作，再点一次收起。",
        image: "card",
      },
      {
        id: "page-switch",
        title: "滑动与翻页",
        summary: "左右滑动或点分页切换；桌面也可用方向键。",
        image: "home",
      },
    ],
  },
  {
    id: "subtle",
    title: "容易忽略的操作",
    lessons: [
      {
        id: "card-menu",
        title: "三点菜单",
        summary: "管理、插图和删除等操作都藏在卡片的三点菜单里。",
        image: "menu",
      },
      {
        id: "reorder-cards",
        title: "拖动排序",
        summary: "长按未运行卡片，抬起后拖动排序。",
        image: "home",
      },
      {
        id: "create-card-pinning",
        title: "创建卡片置顶",
        summary: "设置 → 通用；关闭后新建卡片也能参与排序。",
        image: "general",
      },
      {
        id: "running-card",
        title: "运行态展开",
        summary: "运行卡默认只显示状态与终端，点卡片后展开底部操作。",
        image: "running",
      },
      {
        id: "terminal-window",
        title: "终端可以移动",
        summary: "拖标题栏移动，拖右下角调整大小；关闭终端不会停止实例。",
        image: "terminal",
      },
    ],
  },
  {
    id: "manage",
    title: "实例管理",
    lessons: [
      {
        id: "manage-navigation",
        title: "管理页切换",
        summary: "三点 → 管理；左侧换实例，上方换分类，右下角可缩放。",
        image: "manage",
      },
      {
        id: "instance-terminal",
        title: "实例终端",
        summary: "管理 → 实例终端查看当前实例日志；运行卡同步显示运行日志。",
        image: "instanceTerminal",
      },
      {
        id: "storage-transfer",
        title: "导入与导出",
        summary: "迁移不在创建页完成：先建新实例，再到管理 → 存储路径导入或导出 ZIP。",
        image: "storage",
      },
    ],
  },
  {
    id: "settings",
    title: "设置里的细节",
    lessons: [
      {
        id: "settings-pages",
        title: "设置分两页",
        summary: "通用与维护分开；列表较长时继续下滑，隐藏开关都在这里。",
        image: "general",
      },
      {
        id: "mobile-color",
        title: "顶栏取色与光效",
        summary: "移动端设置里可分别开关顶栏取色、取色频率与点击光效。",
        image: "general",
        platforms: ["android", "ios"],
      },
      {
        id: "maintenance",
        title: "维护入口",
        summary: "维护里检查更新和临时文件；通用里可重新打开本引导。",
        image: "maintenance",
      },
    ],
  },
  {
    id: "appearance",
    title: "背景入口",
    lessons: [
      {
        id: "background-settings",
        title: "切换背景",
        summary: "点击顶部中间入口，切换基础流光或自定义背景与明暗模式。",
        image: "background",
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
