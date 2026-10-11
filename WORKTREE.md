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
| 2026-10-11 | Agent | 管理菜单按 Movie workspace 骨架重做：控制岛玻璃、扁平设置项、页签溶解、终端内凹、磨砂滑杆内圈提亮。显示为 CSS zoom 0.67（约 724×460），不除 devicePixelRatio。新建实例卡复用 FlipCard 倾斜按压，封面圆角毛边修复。`tsc --noEmit && vite build` 通过。只推本分支，未合入 main。 | 已推送 `lts/common-frontend` |
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
