# ADR-0002：共享前端只有一个源码位置

- 状态：已采纳
- 日期：2026-07-19

## 背景

工作区曾保留多套控制台原型和构建副本，修改入口不明确，平台间容易出现界面漂移。

## 决定

React 控制台只在 `SillyClient-Android/App/web/capacitor-ui/` 开发。Android assets、Windows `frontend-dist/` 和 Pages `docs/app/` 都由该目录构建并同步。

## 结果

生成副本不接受手工功能修改。同步后必须分别验证 Android、Windows 和 Pages，因为同一份界面仍依赖不同的平台桥接实现。
