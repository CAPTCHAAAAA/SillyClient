# SillyClient v1.13.2

> Android：修复酒馆文件导入无法选中文件，并支持 5 GiB 以上的大型 ZIP 数据备份。Windows：修复自动导出写入系统下载目录的问题，改为写入软件安装目录。iOS：本版无更新，继续使用 v1.13.1（Build 36）。

## 变更内容

**Windows**

- 自动导出不再写入 `下载\SillyClient-导出`，改为写入软件安装目录内的 `exports\`。
- 主动点「导出实例（ZIP）」仍弹系统保存对话框，保存位置由用户选择。
- 覆盖安装，实例、设置与存储路径保留。版本 1.13.2。
- 安装目录会在更新或卸载时被清空；需要长期保留的备份，请使用「导出实例（ZIP）」自选保存位置。

**Android**

- 进入酒馆实例后，从页面导入世界书、预设或角色时，文件选择器不再按 MIME 元数据过滤，`.json` 等文件可以正常选中。
- 「导入数据（ZIP）」不再沿用 2 GiB 源码包上限，改为按压缩包大小动态限制，最高支持 32 GiB 压缩包。
- SAF 本地 ZIP 通过 `ParcelFileDescriptor` 和可寻址通道直接读取，不再先完整复制到缓存；不支持随机读取的文件提供方会回退缓存副本。
- 导入前按实例目录可用空间预检并预留空间，空间不足时直接提示，避免写入中途占满设备。
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
- fix: 支持 5 GiB 以上数据备份，按目标空间动态预检 [`b6adfb6`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/b6adfb6)
- perf: SAF ZIP 通过 PFD 可寻址通道直读，移除整包缓存复制 [`bc6bc7a`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/bc6bc7a)
- chore: 合并 v1.13.2 Android 资产更新到 main [`7d90f0e`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/7d90f0e)

**iOS · [SillyClient-iOS](https://github.com/CAPTCHAAAAA/SillyClient-iOS)**

- 本版无更新。

## 下载与校验

```
b81747ff41f394468d84d7470299d1aa717a016c1e6864a2aa80a9fbccced733  SillyClient-Windows-v1.13.2.exe       (113 MB)
2daeccaba43635780a26c9553f26e0112e2c615bdeab0f1a1e178aba5053c88b  SillyClient-Android-v1.13.2.apk       (190 MB)
```

- Windows：覆盖安装，实例与设置保留。
- Android：覆盖安装，实例与设置保留（versionCode 74，签名与历史版本一致）。
- iOS：本版无新包，继续使用 v1.13.1（Build 36）未签名 IPA。

**Windows Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Windows/compare/8e49c7f...902d491
**Android Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Android/compare/c1c26e3...7d90f0e
