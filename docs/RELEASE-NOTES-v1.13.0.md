# SillyClient v1.13.0

> 三端同版更新。Windows：取消默认存储位置，修复升级后实例失联与误装顶替。Android：支持多开，删除实例时同步删除本地文件夹，创建时不再向用户目录写入 node_modules。iOS：接通实例导出，对齐同一套创建与迁移约定。三端同步通用前端新版动效。

## ⚠️ 重要提醒（仅 Windows，v1.10.0–v1.12.1 用户必读）

仅 Windows 版。v1.10.0–v1.12.1 期间，若实例存放在安装目录的 `instances` 文件夹（当时迁移向导的默认目标，或创建实例时未选择位置），每次版本更新或卸载都会将其随安装目录一并清除。本版本起该默认落点已彻底移除。Android 与 iOS 没有这个问题。

- 实例当前位于安装目录 `instances\` 下的用户：请立即通过「实例管理 → 存储路径 → 存储迁移」搬至自选文件夹。
- 创建实例时自行选择过位置的（桌面、文档等任意自定义文件夹）：不受影响。
- 详细说明与致歉见下文。

## 关于 Windows 版实例数据丢失问题的致歉与说明

各位 SillyClient 用户：

我们要为 Windows 版 v1.10.0 至 v1.12.1 期间的一个严重缺陷，向所有受影响的用户郑重道歉。

### 发生了什么

在上述版本中，如果你的实例存放在**安装目录下的 `instances` 文件夹**（当时旧实例迁移向导的默认目标，也是创建实例时未主动选择位置的默认落点），那么**每次版本更新或卸载重装时，安装程序会将安装目录整体清空重建，其中的实例数据会被一并删除，且不经过回收站**。

这意味着：这部分用户的酒馆数据（角色卡、聊天记录、世界书、预设等）已经在某次更新中被物理删除。经我们核查，被删除的数据无法通过软件手段恢复。如果你的电脑开启过 Windows「文件历史记录」或系统还原点，可尝试从中找回；否则，我们深感愧疚地说，数据已经无法挽回。

无论你当时是否有备份习惯，把数据放在一个会被安装器清空的位置，是我们设计上的失误。这个责任完全在我们，不在你。

### 哪些人没有受影响

- 创建实例时主动选择了安装位置的（例如桌面、文档或任意自定义文件夹）——你的数据不在安装程序的清理范围内，全程安全；
- 从 v1.9 及更早版本升级、且从未使用过迁移向导的——旧版数据存放在系统用户目录，不受更新与卸载影响；
- 使用 Android / iOS 版本的用户——本问题仅存在于 Windows 版安装包。

### 我们在 v1.13.0 中做了什么

- **彻底取消默认存储落点**：实例只会创建在你自己选择的文件夹里，安装目录不再存放任何用户数据；
- **创建与迁移全程必选位置**：不再存在"没选就默默放进默认目录"的入口；
- **旧版实例自动找回**：升级后启动时会自动搜索历史存储位置并接管，找不到时明确提示，绝不再用全新空白实例顶替你的数据；
- **迁移向导重做**：目标文件夹由你指定，多个实例逐项迁移、互不牵连。

### 建议你现在做的事

1. 打开「实例管理 → 关于实例」，确认每个实例的存放路径；
2. 如果路径仍指向安装目录下的 `instances` 文件夹，请立即通过「实例管理 → 存储路径 → 存储迁移」将其搬到自选位置；
3. 定期使用「实例管理 → 导出实例（ZIP）」为你的实例留一份备份。

再次为受影响的用户道歉。谢谢你们愿意用这个还不完美的软件，我们会用更严格的设计和测试守住你们的数据。

—— SillyClient 开发组

## 变更内容

**界面与动效**（Windows / Android / iOS）

- 动态封面底板透明化透出壁纸；管理页遮罩对齐首页变量；管理阅读区改为更淡的薄毛玻璃。
- 管理页翻页收焦刹车动效；创建与启动面板的遮罩关闭时同步淡出；交互控件统一扁平胶囊样式。
- 卡片圆角收边去除亮边；FlipCard 背面倾斜与阴影修正；删除确认改为进度条呈现。

**Windows**

- 彻底取消软件默认存储落点：实例只会创建在用户显式选择的文件夹；创建、迁移、搬迁三入口均为必选，选定后登记并自动沿用。安装目录不再存放用户数据。
- 修复旧版本升级后实例失联：启动时自动搜索全部历史存储位置（旧版隐藏目录、历史默认根、自定义根）并接管补登记；卡片残留旧路径时以注册表权威静默自愈。
- 实例目录丢失或损坏时，不再静默下载全新实例顶替，改为明确提示并引导接管现存目录或重新创建。
- 创建向导「安装目录（必选）」空值硬校验（此前空值会静默落入默认位置）。
- 迁移目标文件夹改为用户必选（只读 + 浏览），迁移成功后登记为实例存储根。
- 多实例逐项迁移，单个失败不阻断其余，失败原因明示可重试；迁移完成后卡片自动指向新位置。
- 迁移提醒不再因「稍后处理」或一次检测异常而永久跳过。
- 垃圾清理扫描覆盖全部历史存储落点。
- 移除冗余批量迁移接口；创建流程的一次性安装参数不再持久化到实例卡片。
- 覆盖安装保留自选位置中的实例与设置。安装目录 `instances` 内的数据会在更新时被清除，须先迁移。

**Android**

- 支持同时运行多个实例。
- 在软件内删除实例时，同步删除对应的本地文件夹。
- 创建实例不再向用户目录写入 `node_modules`。
- 对齐无默认存储位置：创建、迁移必须选择文件夹。实例目录缺失且并非新建时，不再静默重装顶替。
- 迁移逐项进行，单个失败不阻断其余；「稍后处理」或一次检测异常不再永久跳过提醒。
- 创建流程的一次性安装参数不再持久化到实例卡片。
- 同步通用前端至 55edc3b：动态封面底板、扁平胶囊、遮罩关闭同步淡出、删除进度条、设置项悬停。
- 版本 1.13.0（versionCode 72）。
- 覆盖安装，实例与设置保留。

**iOS**

- 对齐创建意图：实例目录缺失且并非新建时，拒绝静默重装顶替，改为明确提示。
- 对齐无默认存储落点：创建向导预填已登记的实例根，目录必选，创建成功后登记为存储根；设置中不再提供恢复默认路径。
- 存储页接通「导出实例（ZIP）」，保存到「文件」App 的 Documents/Exports/；实例运行中拒绝导出。
- 迁移逐项进行，单项失败不阻断其余；「稍后处理」或一次检测异常不再永久跳过提醒。
- 恢复「存储迁移」入口。
- 同步通用前端至 55edc3b：动态封面底板、扁平胶囊、遮罩关闭同步淡出、删除进度条、设置项悬停。
- 版本 1.13.0（Build 34）。

## What's Changed

**Windows · [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows)**

- fix: 新旧版本过渡根因修复——启动解析全位置接管、安装源创建意图铁律 [`3cab9bf`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/3cab9bf)
- feat: 落实无默认路径存储模型——迁移目标必选、安装目录默认根退役、创建链路闭环 [`dce7b9d`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/dce7b9d)
- chore: 1.13.0 版本升级与 What's New 公告 [`eb92cbe`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/eb92cbe)
- feat: 同步通用前端 667b83a..f0be259（动态封面底板/管理卡遮罩/溶解动效） [`73d7ee5`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/73d7ee5)
- feat: 同步通用前端至 55edc3b（遮罩同步淡出/设置项悬停/扁平胶囊） [`62e72f2`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/62e72f2)

**Android · [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android)**

- feat: 1.13.0——安装源创建意图铁律、迁移链路对齐与合并回归修复 [`3b13ec1`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/3b13ec1)
- feat: 多开支持、删除竞态根治与依赖实例自持（根除 node_modules 污染） [`0fa1b21`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/0fa1b21)
- fix: 删除物理清理同步化根治残留 + 键盘避让与发热治理 [`3e85866`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/3e85866)
- fix: .nomedia 免疫媒体扫描治创建发热 + 键盘避让纯平移 [`2d092f7`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/2d092f7)
- fix: 恢复定版删除事务编排器 + 三态切换抽搐根治 [`fcf6363`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/fcf6363)
- diag: 依赖校验失败自报现场（创建失败诊断增强） [`67042b3`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/67042b3)
- feat: 同步已验收通用前端 55edc3b（收焦刹车/遮罩同步淡出/扁平胶囊） [`a16c2e5`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/a16c2e5)

**iOS · [SillyClient-iOS](https://github.com/CAPTCHAAAAA/SillyClient-iOS)**

- feat: 同步 1.13.0 跨端契约，接通实例 ZIP 导出并清理死代码 [`d49845f`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/d49845f)
- fix: 消除 ZIPFoundation addEntry 重载歧义，导出归档可编过 [`8427fc3`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/8427fc3)
- feat: 同步通用前端 f0be259 封面底板，恢复存储迁移入口 [`f6f2acc`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/f6f2acc)
- feat: 同步通用前端 55edc3b 扁平胶囊基线（Build 34） [`9caf5ea`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/9caf5ea)

## 下载与校验

```
bef42c737f4cd09a76e37fc4f53eb116c0dcb47c9432460d4171577dc09120f0  SillyClient-Windows-v1.13.0.exe  (113 MB)
2dfac8ff31fe3d12a876830b073fca239204a9839bda71c633b25f3e80ba72bb  SillyClient-Android-v1.13.0.apk  (189 MB)
cb378fbddbddfcb309abc97db49a4429bb8123a998673e8069aba43559219864  SillyClient-iOS-v1.13.0-unsigned.ipa  (185 MB)
```

- Windows：覆盖安装。自选位置中的实例与设置保留；安装目录 `instances` 内的数据会在更新时被清除，请先迁移。
- Android：覆盖安装，实例与设置保留。
- iOS：未签名 IPA（Build 34），需在 macOS 上使用 Xcode 签名后安装。

**Windows Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Windows/compare/abf46b6...62e72f2
**Android Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-Android/compare/186944f...a16c2e5
**iOS Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient-iOS/compare/c2f8c8b...9caf5ea
