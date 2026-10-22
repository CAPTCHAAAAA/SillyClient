# SillyClient v1.13.2

> Android：修复进入酒馆后导入世界书、预设或角色时文件选择器无法选中文件的问题。Windows：修复自动导出写入系统下载目录的问题，改为写入软件安装目录。iOS：本版无更新，继续使用 v1.13.1（Build 36）。

## 变更内容

**Windows**

- 自动导出不再写入 `下载\SillyClient-导出`，改为写入软件安装目录内的 `exports\`。
- 主动点「导出实例（ZIP）」仍弹系统保存对话框，保存位置由用户选择。
- 覆盖安装，实例、设置与存储路径保留。版本 1.13.2。
- 安装目录会在更新或卸载时被清空；需要长期保留的备份，请使用「导出实例（ZIP）」自选保存位置。

**Android**

- 进入酒馆实例后，从页面导入世界书、预设或角色时，文件选择器不再按 MIME 元数据过滤，`.json` 等文件可以正常选中。
- 影响 v1.13.1 及更早版本。
- 版本 1.13.2（versionCode 74）。覆盖安装，实例与设置保留，签名与历史版本一致。

**iOS**

- 本版无更新，继续使用 v1.13.1（Build 36）。

## What's Changed

**Windows · [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows)**

- fix: 兜底导出改到软件安装目录 exports，绝不私自写入用户下载目录 [`67c8336`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/67c8336)
- chore: release 1.13.2（含兜底导出改落安装目录） [`7b35c77`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/7b35c77)

**Android · [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android)**

- release: v1.13.2（versionCode 74），WebView 文件选择器不再按扩展名过滤 [`e610059`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/e610059)
- chore: 合并 feature/release-hardening（v1.13.2）到 main [`b26c719`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/b26c719)

**iOS · [SillyClient-iOS](https://github.com/CAPTCHAAAAA/SillyClient-iOS)**

- 本版无更新。

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
