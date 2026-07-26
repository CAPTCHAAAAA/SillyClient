# 参与开发

SillyClient 由三个独立仓库组成。先确认改动属于哪一层，再打开对应仓库。

| 改动 | 仓库 |
| --- | --- |
| 项目主页、公共文档、Release | `SillyClient` |
| React 控制台、Android 宿主与运行时 | `SillyClient-Android` |
| Windows 宿主、进程与窗口管理 | `SillyClient-Windows` |

共享 React 控制台的唯一源码是 Android 仓库中的 `web/capacitor-ui/`。Windows 的 `frontend-dist/` 和主仓库的 `docs/app/` 都是它的构建副本，不在副本上直接开发。

Pages 副本从主仓库同步：

```bash
node scripts/sync-pages-app.mjs ../SillyClient_Android/web/capacitor-ui/dist
```

宣传页本身由主仓库 `docs/` 维护。目录职责、入口路由、产品帧生成和发布验收见
[`docs/PAGES-MAINTENANCE.md`](./docs/PAGES-MAINTENANCE.md)。`docs/app/` 与
`docs/phone-demo.html` 是共享前端生成物；其余宣传页模块不是 Android 前端构建产物，
不要用同步脚本覆盖。

## 提交前

1. 只提交当前改动需要的文件，不带入缓存、截图或安装包。
2. 在对应仓库运行 README 中列出的检查。
3. 修改 Pages 时运行 `node scripts/validate-pages.mjs`。
4. 运行 `git diff --check`，确认没有意外换行和空白字符。
5. 涉及跨仓库契约时，同一批提交中更新架构文档和同步脚本。

提交信息使用简短的祈使句，说明实际改动，例如 `fix: keep instance state after closing the reader`。正文用于解释为什么，不复述 diff。

## 发版

平台仓库只保存源码。Tag、安装包和 Release 统一发布到主仓库，具体步骤见 [`release/RELEASE-GUIDE.md`](./release/RELEASE-GUIDE.md)。
