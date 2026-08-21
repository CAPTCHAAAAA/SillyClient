# SillyClient UI

Android、Windows 和 GitHub Pages 共用同一套 React 控制台。本目录是主仓库维护的未适配基线前端源码。

```bash
pnpm install --frozen-lockfile
pnpm run dev
pnpm run typecheck
pnpm run build
```

`pnpm run build` 只生成 `dist/`。Android 使用 Android 仓库的 `scripts/sync-frontend.mjs` 同步，Windows 使用 `Sync-Frontend.ps1`，Pages 使用本仓库 `scripts/sync-pages-app.mjs`，不直接修改生成副本。

平台能力通过 `src/capacitor-plugin.ts` 中的 `TarvenEnv` 契约调用。浏览器预览使用 shim；新增或修改方法时必须同时更新 Kotlin 与 Electron 实现。
