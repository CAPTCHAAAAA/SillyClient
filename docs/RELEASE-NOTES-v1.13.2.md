# SillyClient v1.13.2

> 紧急修复。Android：进入酒馆后导入世界书、预设或角色时，系统文件选择器能打开但文件无法选中，本版修复该问题。Windows：自动导出会把备份写进系统下载目录，本版改为写入软件安装目录。iOS 无新版本。

## ⚠️ 重要提醒

Windows 的自动导出位于安装目录 `exports\`，安装目录在更新或卸载时会被清空。需要长期保留的备份，请使用「导出实例（ZIP）」自选保存位置。

## 变更内容

**Windows**

- 原有表现：没有窗口可弹保存对话框时，导出会自行写入 `下载\SillyClient-导出`，占用用户下载目录。
- 现在的表现：自动导出写入软件安装目录内的 `exports\`；主动点「导出实例（ZIP）」仍弹系统保存对话框，位置由用户选择。
- 实例、设置与存储路径不变。版本 1.13.2。覆盖安装，实例与设置保留。

**Android**

- 原有表现：进入酒馆实例后，从页面导入世界书、预设或角色时，文件选择器能打开，但 `.json` 等文件呈灰色或不可点。
- 现在的表现：文件选择器不再按 MIME 元数据过滤这些扩展名，可以正常选中并交给酒馆导入。
- 影响范围：v1.13.1 及更早的 Android 用户。版本 1.13.2（versionCode 74）。覆盖安装，实例与设置保留，签名与历史版本一致。

**iOS**

- 本版无新版本，继续使用 v1.13.1（Build 36）。

## 下载与校验

```
b81747ff41f394468d84d7470299d1aa717a016c1e6864a2aa80a9fbccced733  SillyClient-Windows-v1.13.2.exe       (113 MB)
de8426738b54058aaf800688e7ba6bc6d2690c515faceadbbc151bbc56ab22ca  SillyClient-Android-v1.13.2.apk       (189 MB)
```

- Windows：覆盖安装，实例与设置保留。
- Android：覆盖安装，实例与设置保留（versionCode 74，签名与历史版本一致）。
- iOS：本版无新包，继续使用 v1.13.1（Build 36）未签名 IPA。

**Windows Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Windows/compare/8e49c7f...902d491
**Android Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Android/compare/c1c26e3...e610059
