# SillyClient v1.12.1

> Android 与 Windows 同版更新，iOS 无本版变更（v1.12.0 Build 30 仍为当前版本）。Android 资产首次纳入本 Release，Android 1.12.0 用户将收到更新提醒。

## 变更内容

**Android**

- 管理菜单透明底封面垫主题色：封面经透明度自动识别（canvas alpha 采样并缓存），透明底插图垫亮色 / 动态 / 暗色对应的底色，不透明插图行为不变。
- 管理卡圆角修复：去除缩放状态下产生毛边的 `mask-image` 双层裁切，仅保留单层裁切。
- versionCode 70 → 71，支持从 1.12.0 覆盖安装升级。

**Windows（重要修复）**

- 恢复被中断合并丢弃的存储页签功能：存储迁移、实例重命名、导出实例（ZIP，系统另存为）。
- 启动自愈：登记目录在磁盘上不存在、而卡片显式路径存在时（隐藏目录 → 用户目录过渡残留），自动对齐到现存路径，不再导致每次启动失败；对在用登记的冲突防护与同 ID 收养守卫保持不变。
- 注册表读取容错：单条损坏记录跳过并告警，不再污染整表读取（冻结存储契约 §4）；写入侧校验不变。
- 同步移植通用前端的透明封面垫主题色与圆角修复。
- 81/81 测试全绿。

**iOS**

- 无本版变更，v1.12.0（Build 30）仍为当前版本。

## What's Changed

**Android · [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android)**

- feat: 透明封面垫主题色与管理卡圆角修复，发布 1.12.1 (versionCode 71) [`186944f`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/186944f)

**Windows · [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows)**

- fix: restore lost storage-tab features and heal legacy directory-transition launches [`839b52f`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/839b52f)
- feat: port transparent cover polish from common frontend (3fbd81f) [`5802a5d`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/5802a5d)
- chore: release 1.12.1 (Windows-only update channel) [`abf46b6`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/abf46b6)

**通用前端 · [SillyClient](https://github.com/CAPTCHAAAAA/SillyClient)**

- feat: 透明封面垫主题色，并收管理卡圆角毛边 [`3fbd81f`](https://github.com/CAPTCHAAAAA/SillyClient/commit/3fbd81f)

## 下载与校验

```
4c14e4f6cc665f734109f933338ffc2c97bfab26726ca949d991718ee4ad5dff  SillyClient-Android-v1.12.1.apk  (189 MB)
ce785ed3bc5c460ac7bf728cc8ccf9a3a0cdae921c7a983a69d703b735d12b76  SillyClient-Windows-v1.12.1.exe  (113 MB)
```

Android / Windows 覆盖安装，实例与设置原样保留。iOS 无需操作。

**Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient/compare/v1.12.0...v1.12.1
