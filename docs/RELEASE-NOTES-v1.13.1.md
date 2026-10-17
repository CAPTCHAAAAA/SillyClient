# SillyClient v1.13.1

> 三端同版更新。Windows：同步通用前端并覆盖安装 1.13.1，后端零改动。Android：同步同一套前端，versionCode 73 / versionName 1.13.1。iOS：同步同一套前端（Build 36），补齐选中实例后的终端提示符。三端后端与存储契约均未改动。

## 变更内容

**界面与交互**（Windows / Android / iOS）

- 缩放手柄回归：终端与管理菜单右下角共用一道贴在圆角外侧的弧线手柄，静息露 48°、悬停与拖动展开到 78°。拖动只改窗口宽高，不缩放面板内容。
- 终端面板：外壳改回毛玻璃，日志区下沉为独立内凹槽，顶栏与日志同一块深色；点面板外侧可关闭。
- 管理菜单：外层改为全屏居中的壳，内层仍是设计帧靠 zoom 缩放，拖动只手柄改外壳尺寸；翻页收焦刹车与阅读区薄毛玻璃保持不变。
- 动态壁纸拨杆：轨道 `52×32`、拨杆 `24×24`、行程 `20px`，开态保留 `#34c759` 绿色自发光。
- 新手引导：12 张图示换成当前毛玻璃界面，文案对齐「锁定」「迁移目录」「实例终端」。

**Windows**

- 同步上述通用前端。后端零改动，88/88 测试全绿。
- 覆盖安装后 ProductVersion 1.13.1.0。安装目录依旧不创建 `instances\`。
- 终端提示走 Windows 分支：「Windows 控制台」「C:\>」「输入 Windows 命令」「Windows · cmd.exe」，未串成 Android shell。

**Android**

- 同步上述通用前端。后端零改动。
- 版本 1.13.1（versionCode 73）。覆盖安装，实例与设置保留，签名与历史版本一致。

**iOS**

- 同步上述通用前端。原生 Swift / ObjC、桥接方法与版本契约未动。
- 终端走 iOS 分支：标题「iOS 控制台」、提示符「ios >」、横幅「SillyClient {版本} · iOS · NodeMobile」、占位「iOS 进程内环境（可查看服务运行日志）」，不出现 Android shell 字样。
- 版本 1.13.1（Build 36）。未签名 IPA，需在 macOS 上使用 Xcode 签名后安装。

## What's Changed

**Windows · [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows)**

- feat: 同步通用前端 674a9a6 并升版 1.13.1 [`d687c84`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/d687c84)
- docs: 记录 1.13.1 前端同步、终端文案实证与覆盖安装 [`8e49c7f`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/8e49c7f)

**Android · [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android)**

- feat: 同步通用前端 674a9a6 并发布 1.13.1（versionCode 73） [`c1c26e3`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/c1c26e3)

**iOS · [SillyClient-iOS](https://github.com/CAPTCHAAAAA/SillyClient-iOS)**

- feat: 同步通用前端 3f1c112（引导换图、拨杆收紧、终端去缩放柄） [`e69fbb9`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/e69fbb9)
- feat: 同步通用前端 bd45fb2 缩放手柄，版本升 1.13.1（Build 36） [`05fa50b`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/05fa50b)
- fix: 选中实例后的终端提示符留在 iOS 分支，不再落回安卓的 `~ $` [`4d5e4e4`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/4d5e4e4)

**通用前端 · [SillyClient](https://github.com/CAPTCHAAAAA/SillyClient)**

- feat: 收紧动态壁纸开关并保留绿色自发光 [`3f1c112`](https://github.com/CAPTCHAAAAA/SillyClient/commit/3f1c112)
- feat: 终端与管理菜单右下角缩放手柄 [`674a9a6`](https://github.com/CAPTCHAAAAA/SillyClient/commit/674a9a6)

## 下载与校验

```
4e31041b4563c2e1c574e56ab3440e298aaaea754a8bdc48c784938b137c1208  SillyClient-Windows-v1.13.1.exe       (113 MB)
a2a32c264890e954423944681b0290c4a4f1893ff8405de9f6d1f4c0236739c7  SillyClient-Android-v1.13.1.apk       (189 MB)
6f250e552a5f67b1a376f9744d3183d198fabb034afcf4127ec34e079d5ace90  SillyClient-iOS-v1.13.1-unsigned.ipa  (185 MB)
```

- Windows：覆盖安装，实例与设置保留。
- Android：覆盖安装，实例与设置保留（versionCode 73，签名与历史版本一致）。
- iOS：未签名 IPA（Build 36），需在 macOS 上使用 Xcode 签名后安装。

**Windows Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Windows/compare/62e72f2...8e49c7f
**Android Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Android/compare/a16c2e5...c1c26e3
**iOS Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-iOS/compare/9caf5ea...4d5e4e4
