# 🛡️ SillyClient LTS: 全端通用前端控制台开发体系 (Common Frontend)

> **[LTS 长期核心工程]** 本工作树为跨 Android / Windows / iOS / Pages 的全端通用前端控制台开发区，严禁随意删除！

- **所属仓库**: `SillyClient_Main`（官方跨端通用 React 前端基准所在仓库）
- **标识分支**: `lts/common-frontend`
- **代码路径**: `web/capacitor-ui/`
- **核心职责**:
  1. 维护跨平台通用的 React 19 + Tailwind v4 + Lucide 现代化实例管理控制台；
  2. 开发通用 3D 物理卡片按压与中心下沉、长按拖拽重排、悬停纯字体高亮、Terminal 自由拖拽定位等核心交互；
  3. 作为全端前端唯一权威修改源，走查通过后向各平台端分发同步，坚决避免将通用前端混淆为单平台私有代码。
- **环境命令**:
  - `cd web/capacitor-ui`
  - `pnpm run typecheck`（类型检查）
  - `pnpm run build`（生产构建）
