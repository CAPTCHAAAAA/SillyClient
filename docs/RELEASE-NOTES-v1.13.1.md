# SillyClient v1.13.1

> Windows：同步通用前端，终端与管理菜单加回缩放手柄。Android：同步同一套前端，版本升至 versionCode 73。iOS：同步同一套前端，选中实例后的终端提示符改为 iOS 分支。本版只更新前端界面，未改动实例创建、存储、导入导出等链路。

## 变更内容

**界面与交互**（Windows / Android / iOS）

- 缩放手柄：终端与管理菜单的右下角加回缩放手柄，弧线贴在卡片圆角外侧。拖动改变窗口大小，面板内容不缩放。
- 终端面板：外壳改为毛玻璃，日志区下沉为独立凹槽，顶栏与日志同一块深色。点击面板外侧可关闭。
- 动态壁纸拨杆：轨道 `52×32`，拨杆 `24×24`，打开时保持 `#34c759` 绿色自发光。
- 新手引导：12 张图示改为当前界面，文案对齐「锁定」「迁移目录」「实例终端」。

**Windows**

- 覆盖安装，实例与设置保留。安装目录不创建 `instances\`。

**Android**

- 版本 1.13.1（versionCode 73）。覆盖安装，实例与设置保留，签名与历史版本一致。

**iOS**

- 选中实例后，终端标题与提示符显示 iOS 分支，不再落回安卓的 `~ $`。
- 未签名 IPA（Build 36），需在 macOS 上使用 Xcode 签名后安装。

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
