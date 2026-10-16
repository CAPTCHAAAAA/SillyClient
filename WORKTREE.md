# SillyClient 工作树规约：全端通用前端控制台开发 (Common Frontend)

> **[LTS 核心工作树]** 本文档为该工作树的自包含边界与记录中枢。本树所有进行中改动、调试日志与设计草稿就地记录在此，严禁向中央本地目录散落碎片文档。

---

## 1. 职责与范围边界 (Scope & Boundaries)

- **所属仓库**: `SillyClient_Main`（官方跨端通用 React 前端基线权威归属仓库）
- **标识分支**: `lts/common-frontend`
- **授权修改范围**:
  - `web/capacitor-ui/`：React 19 + Tailwind v4 + Lucide 跨端控制台源码；
  - 通用 3D 机械卡片按压与中心下沉动效、长按拖拽重排、悬停纯字体高亮；
  - Terminal 标题栏自由拖拽与视口吸附定位；
  - 通用向导、设置抽屉与维护面板交互逻辑。
- **严禁事项 (Forbidden Boundaries)**:
  - 严禁硬编码单平台私有绝对路径或平台特有 API；
  - 严禁绕过 `web/capacitor-ui` 凭空编写假 HTML/假 DOM 走查；
  - 严禁引入破坏视口宽度的突发滚动条（必须保持 `scrollbar-gutter: stable`）。

---

## 2. 核心架构契约 (Invariants & Constraints)

1. **同构唯一权威源**：本项目所有跨平台通用控制台组件一律在此修改，经审核后通过脚本向 Android/Windows/iOS 分发，杜绝版本分叉；
2. **纯净代码标准**：实例卡片遵循已完成解耦的 `InstanceStoppedCard` 与 `RunningConsoleCard` 架构，禁止使用布尔 hack 或堆砌屎山样式；
3. **性能闸门**：确保 120Hz 高刷丝滑无抖动，所有物理交互与弹簧动画均使用硬件加速。

---

## 3. 本树推进与改动记录 (Worktree Activity Log)

| 日期 | 操作人 / 提交 | 改动摘要与内部验证结果 | 状态 |
| :--- | :--- | :--- | :---: |
| 2026-10-17 | Agent (`674a9a6`) | 终端与管理菜单右下角缩放手柄。终端手柄弧线与卡片外圆角同心并外移 12px 落在玻璃外侧，露出长度由 `stroke-dasharray` 控制，悬停与拖动时变长变粗提亮，320ms `cubic-bezier(0.22, 1, 0.36, 1)`。日志井改成四边统一 10px 内缩，去掉原来预留的 54px 空洞。管理菜单根节点外包一层全屏居中层承载手柄，内层仍是设计帧尺寸靠 `zoom` 缩放，进出场改用不自带居中位移的 `manage-panel` 动画；拖动可缩放（实测 630×460 拉到 700×502），竖版不显示。终端打开时补上与创建实例弹窗同层的 `LayerBackdrop`。`tsc --noEmit && vite build` 通过。 | 待合入主仓 |
| 2026-10-16 | Agent (`a14b13c`) | 新手引导图换成当前毛玻璃界面。实例卡示意图只用默认酒馆标志，不再用自定义封面。文案对齐「锁定」「迁移目录」和「实例终端」。顶栏小图标按高度适配，不再拉到 19rem。引导版本仍是 3。终端顶栏和日志改成同一块深色，右下角缩放曲线删掉，CornerResizeCurve 不要加回去。tsc 与 vite build 通过。已合入 main 并推送。未同步 Android / Windows / iOS，没有新 Release。 | 已合入主仓 |
| 2026-10-16 | Agent (`ec678dc`) | 创建实例与启动面板共用遮罩。关闭时若没有另一块面板留着，遮罩跟面板一起 280ms 淡出，不再等卸载后突然消失。下拉、弹窗、终端和卡片菜单的退场去掉 28% 透明度停顿。设置行、顶栏和时间按钮补上同一套文字高亮，扁平胶囊只留 0.5px 发丝。`tsc --noEmit && vite build` 通过。已快进合入 `main` 并推送。未同步 Android / Windows / iOS，没有新 Release。 | 已合入主仓 |
| 2026-10-15 | Agent (`5fa1a78`) | 管理页翻页改为收焦刹车：不横滑、不缩放、不回弹。旧页 320ms 让开，新页透明度 380ms、模糊 560ms，曲线 `cubic-bezier(0.23, 1, 0.32, 1)`。交互胶囊无描边，悬停只提亮文字。卡片圆角改为内收 1px 裁切，收掉亮边和壁纸红线。首页松手翻页按出手速度减速贴住，期间锁住 scroll-snap。横版设计宽收到 940，仍 zoom 0.67。竖版不再整帧放大，最大约 440×580。管理菜单右下角缩放条已删除。终端缩放柄在玻璃外。`tsc --noEmit && vite build` 通过。已快进合入 `main` 并推送。未同步 Android / Windows / iOS，没有新 Release。 | 已合入主仓 |
| 2026-10-14 | Agent (`5206c83`) | 管理阅读区只罩薄薄一层浅酒红、浅靛蓝或暖白，毛玻璃还在，不再涂实色。动态透明封面不再铺底板。高阅读设置项保持扁平。删除弹窗改进度条，浏览器预览删除不打后端。卡片背面倾斜不再反向。`tsc --noEmit && vite build` 通过。已快进合入 `main` 并推送。未同步 Android / Windows / iOS，没有新 Release。 | 已合入主仓 |
| 2026-10-13 | Agent (`f0be259`) | 动态透明封面底板取紫与酒红之间的中段，白天白、黑夜墨色不动。管理页卡片遮罩改用首页同一套 `--sf-grad` / `--sf-lg`，不再叠纯黑。状态切换溶解统一 780ms 两端减速。离开动态壁纸切到白天时先卸光斑。`tsc --noEmit && vite build` 通过。已合入 `main` 并推送。未同步 Android / Windows / iOS，没有新 Release。 | 已合入主仓 |
| 2026-10-12 | Agent (`3fbd81f`) | 管理菜单透明底封面改为高不透明度主题色垫底，不透明插图不变。去掉 zoom 0.67 下会光栅化圆角的 mask，卡片只留一层裁切。本地预览增加三张透明底封面。`tsc --noEmit && vite build` 通过。已合入 `main` 并推送。未同步 Android / Windows / iOS。 | 已合入主仓 |
| 2026-10-11 | Agent (`b88c18e`) | 竖版管理菜单锁定「竖向.png」`687×843`，屏幕不够时整帧 zoom，不再拉成扁宽条。搜索改为居中短胶囊，分类只保留选中项胶囊。设置、背景和新建实例的状态按钮并成轻微沟槽，选中项更深。首页搜索轻内凹，向导溢出渐隐。`tsc --noEmit && vite build` 通过。已快进合入 `main` 并推送。未同步 Android / Windows / iOS。 | 已合入主仓 |
| 2026-10-11 | Agent (`b89e89a`，主仓 `71f17fa`) | 管理菜单按 Movie workspace 骨架重做：控制岛玻璃、扁平设置项、页签溶解、终端内凹、磨砂滑杆内圈提亮。显示为 CSS zoom 0.67（约 724×460），不除 devicePixelRatio。新建实例卡复用 FlipCard 倾斜按压，封面圆角毛边修复。`tsc --noEmit && vite build` 通过。已快进合入 `main` 并推送。 | 已合入主仓 |
| 2026-10-10 | Agent (9cd200e) | 全量归位通用前端基线：3D机械下沉卡片、长按拖拽重排与Terminal拖拽定位 | 已同步并推送主干 |
| 2026-10-10 | Agent | 正式建立 `lts/common-frontend` 独立全端前端开发区，挂载依赖软链接并通过 tsc 严格类型检查 | 准备就绪 |

---

## 4. 交付与推送门禁 (Milestone & Delivery Gate)

- **本地门禁**:
  1. `cd web/capacitor-ui && pnpm run typecheck` 必须 0 错误；
  2. `pnpm run build` 必须构建成功；
  3. 本地 HTTP 走查通过。
- **中央登记协议**:
  - 本树日常细碎开发仅记录在上方第 3 节中；
  - **当且仅当向远端分支执行 `git push` 或完成全平台同步时**，才向 `Local/docs/CURRENT_STATE.md` 与 `.worktrees/README.md` 登记里程碑事实索引。
