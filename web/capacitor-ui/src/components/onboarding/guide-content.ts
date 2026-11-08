export type GuidePlatform = "web" | "windows" | "android" | "ios";

export type GuideInteraction = "click" | "drag";

export interface GuideStep {
  id: string;
  title: string;
  summary: string;
  target: string;
  interaction?: GuideInteraction;
  platforms?: readonly GuidePlatform[];
}

export const guideSteps: readonly GuideStep[] = [
  {
    id: "terminal-open",
    title: "打开终端",
    summary: "点左上角，查看全局日志与命令。",
    target: '[data-onboarding-target="terminal"]',
  },
  {
    id: "terminal-drag",
    title: "移动终端",
    summary: "按住左侧标题区域，拖动窗口。",
    target: '[data-onboarding-target="terminal-drag"]',
    interaction: "drag",
  },
  {
    id: "terminal-resize",
    title: "调整大小",
    summary: "拖右下角弧线调整终端尺寸。",
    target: '[aria-label="拖动缩放终端"]',
    interaction: "drag",
  },
  {
    id: "terminal-close",
    title: "收起终端",
    summary: "关闭窗口，不会停止实例。",
    target: '[data-onboarding-target="terminal-close"]',
  },
  {
    id: "background-open",
    title: "打开背景",
    summary: "点中间时间入口，切换背景与明暗。",
    target: '[data-onboarding-target="background"]',
  },
  {
    id: "background-close",
    title: "收起背景",
    summary: "看完设置，从右上角收起面板。",
    target: '[data-onboarding-target="background-close"]',
  },
  {
    id: "card-reorder",
    title: "长按排序",
    summary: "长按卡片后拖动，松手完成排序。",
    target: '[data-instance-id="onboarding-stopped"]',
    interaction: "drag",
  },
  {
    id: "card-expand",
    title: "展开实例卡片",
    summary: "点卡片查看详情与启动入口。",
    target: '[data-instance-id="onboarding-stopped"]',
  },
  {
    id: "card-menu",
    title: "打开卡片菜单",
    summary: "点三点菜单，找到「管理」。",
    target: '[data-instance-id="onboarding-stopped"] .flip-card__face--front .instance-card-drawer.is-open button[aria-label="操作菜单"]',
  },
  {
    id: "card-manage",
    title: "进入实例管理",
    summary: "导入已有数据，要先新建实例，再打开它的管理菜单。",
    target: '[data-onboarding-target="card-manage"]',
  },
  {
    id: "manage-storage",
    title: "导入已有实例",
    summary: "打开「存储路径」，找到「导入数据（ZIP）」。",
    target: '[data-onboarding-target="manage-storage"]',
  },
  {
    id: "manage-import-select",
    title: "选择旧实例备份",
    summary: "选择旧实例的 ZIP 备份，这里使用练习文件。",
    target: '[data-onboarding-target="manage-import-select"]',
  },
  {
    id: "manage-import-confirm",
    title: "导入数据",
    summary: "检查后点「导入」，覆盖新实例的用户数据。",
    target: '[data-onboarding-target="manage-import-confirm"]',
  },
  {
    id: "manage-close",
    title: "回到卡片",
    summary: "关闭管理面板，回到首页。",
    target: '[data-onboarding-target="manage-close"]',
  },
  {
    id: "launch-card",
    title: "启动实例",
    summary: "从卡片详情点击启动，进入进度卡片。",
    target: '[data-instance-id="onboarding-stopped"] .instance-card-drawer.is-open button:first-child',
  },
  {
    id: "launch-progress",
    title: "启动进度",
    summary: "日志和进度都在这里。隐藏窗口不会中断启动。",
    target: '[data-launch-console="launch"] .launch-console-card__button-group button',
  },
  {
    id: "running-card",
    title: "展开运行态",
    summary: "运行时卡片保持轻量，点开才显示操作。",
    target: '[data-instance-id="onboarding-stopped"][data-card-running="true"]',
  },
  {
    id: "running-return",
    title: "返回酒馆",
    summary: "回到正在运行的酒馆，不用重新启动。",
    target: '[data-instance-id="onboarding-stopped"] .running-console-card__actions .console-card__action--primary',
  },
  {
    id: "running-stop",
    title: "停止实例",
    summary: "关闭会停止这个实例，与隐藏窗口不同。",
    target: '[data-instance-id="onboarding-stopped"] .running-console-card__actions .console-card__destructive',
  },
  {
    id: "create-open",
    title: "创建实例",
    summary: "点创建卡片，新建一个独立的酒馆。",
    target: '[data-create-card]',
  },
  {
    id: "create-submit",
    title: "开始创建",
    summary: "练习目录已备好，点创建看看后续流程。",
    target: '[data-onboarding-target="create-submit"]',
  },
  {
    id: "create-progress",
    title: "创建进度",
    summary: "这里显示安装日志与进度。点取消，结束本次练习。",
    target: '[data-launch-console="create"] button[aria-label="取消创建"]',
  },
];

export function getGuideSteps(platform: GuidePlatform) {
  return guideSteps.filter((step) =>
    !step.platforms || step.platforms.includes(platform),
  );
}
