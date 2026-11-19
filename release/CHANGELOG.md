# 版本记录

这里只保留已经发布版本的用户可见变化。完整说明以各版本 Release 正文为准。写法与 v1.13.0 相同：先写各端一句摘要，再按端列变更。

## 1.15.1 - 2026-11-19

> 三端同步 `common-frontend`（`d946b58`）更新至 `1.15.1`（Android versionCode `78`，iOS Build `52`）：实例管理升级一体 SVG 文件夹耳标页签与 780ms 同向平切转场、竖屏 1:1 方卡，并完成业务源码与开发测试隔离及性能收敛。

- 通用前端：实例管理面板上线一体 SVG 文件夹耳标页签（`ManageFolderShell`）与 780ms 刚性同向平切 + 静止坐标系羽化（`manage-shared-transition`），竖屏顶部实例卡带改用 1:1 方卡与 0.85x 未选中缩放，桌面侧栏保持 3:4；修正 `CornerResizeCurve` 悬停/激活层次，拆分分钟边界对齐 `HeaderClock` 并仅在存在远程实例时轮询在线状态；业务源码严格剥离开发测试代码（`src/dev/` 物理隔离）。
- Windows：同步 `1.15.1` 前端更新，保留 Windows 控制台、强类型 IPC、系统目录选择与 ZIP 导入导出，版本更新为 `1.15.1`。
- Android：同步 `1.15.1` 前端更新，保留 SAF 存储访问框架与签名升级体系，版本更新为 `1.15.1` / `78`。
- iOS：同步 `1.15.1` 前端更新并补齐删除确认/维护弹窗遮罩同步退场，保留 iOS 控制台与 NodeMobile 运行时，版本更新为 `1.15.1` / Build `52`，发布未签名 IPA。

## 1.15.0 - 2026-11-18

> Windows：接入问题反馈与界面缩放，更新设置和实例管理面板。Android：同步界面更新，修复在线创建历史版本时的 `.nomedia` 解压冲突（versionCode 77）。iOS：同步问题反馈、缩放与面板更新，整合文件夹选择和安装路径修复（Build 51）。

- 通用前端：新增全局问题反馈窗口，支持填写补充说明、脱敏后提交 Sentry、返回反馈编号，以及失败重试和 GitHub 问题草稿。
- 通用前端：背景设置新增并保存 90%–150% 界面缩放偏好，修正缩放后的弹窗、终端与引导定位。
- 通用前端：修复新手引导准备期间偶发黑屏及无法继续的问题，补齐超时恢复、重试和返回首页；恢复设置与管理面板虚化，同步面板和遮罩退场。
- 主题预设：Windows / iOS 补齐 SC Bordeaux Revision 3，与 Android 内置主题一致，修复新建实例选择主题时因预设版本不一致而失败的问题；2026-11-18 已替换同版安装包及校验清单。
- Windows：接入统一反馈与界面更新，保留 Windows 控制台、目录选择及 ZIP 导入导出，版本更新为 `1.15.0`。
- Android：修复源码包内 `.nomedia` 与临时目录同名文件冲突导致的创建失败，版本更新为 `1.15.0` / `77`。
- iOS：整合 `1.14.2`–`1.14.5` 文件夹选择、目录授权恢复和路径校验修复，同步界面更新，版本更新为 `1.15.0` / Build `51`，发布未签名 IPA。

## 1.14.5 - 2026-11-15

> iOS：紧急修复系统文件选择器点击「打开」后静默丢弃结果及误粘贴界面显示名称导致英文报错的问题（Build 50）。Windows / Android：本版按紧急补丁跳过，继续使用 v1.14.1（后续统一整合）。

- iOS：`TarvenEnvPlugin.swift` 移除覆盖 `UIDocumentPickerViewController` 内部代理的 `presentationController?.delegate = self` 与 `.formSheet` 强制设置，恢复 `.automatic` 默认呈现，并用主队列分离检测定时器在异常关闭时明确返回 `PICKER_DISMISSED_WITHOUT_RESULT` 提示，不再按取消静默吞掉；清理 `AppDelegate.swift` 与 `packageClassList` 重复插件注册。
- iOS：新增 `validateInstallPathInput` 在创建实例与迁移确认前直接拦截「我的 iPhone ▸ ...」显示名称、相对路径与 URL 链接输入；`native-errors.ts` 补齐对应中文化错误提示。
- iOS：升版至 `1.14.5`（Build `50`），GitHub Actions Run `43715908309`（attempt 2）全绿交付未签名 IPA（仅含 CI 构建与模拟器无 UI 交互检验，未覆盖真实设备）。
- Windows / Android：本版跳过，继续使用 v1.14.1。

## 1.14.4 - 2026-11-14

> iOS：紧急修复留空/中文/含空格实例名创建校验失败与外置文件选择器同步安全作用域获取问题（Build 49）。Windows / Android：本版按紧急补丁跳过，继续使用 v1.14.1（后续统一整合）。

- iOS：恢复 `normalizeInstanceIdentity` 安全目录 ID 生成与 `-${counter++}` 后缀，解决未填名称（「新实例」）、中文或含空格实例名触发 `An explicit valid instance identity is required` 失败的问题，同时保留用户设定的展示名称。
- iOS：`UIDocumentPickerViewController` 选择回调改为在返回 UIKit 前同步锁定安全作用域（`preScoped`）后再入后台队列执行文件协调与 bookmark 保存；修正 `modalPresentationStyle = .formSheet` 与 presentation delegate 设置顺序，并取消非安装目录类选择器的沙盒 `Documents` 起始路径限制。
- iOS：补充实例目录标识错误中文提示并在创建、启动、迁移选择出口统一接入 `humanizeNativeError`，升版至 `1.14.4`（Build `49`），GitHub Actions Run `43585628585` 全绿交付未签名 IPA（仅含 CI 构建与模拟器无 UI 交互检验，未覆盖真实设备）。
- Windows / Android：本版跳过，继续使用 v1.14.1。

## 1.14.3 - 2026-11-14

> iOS：紧急修复文件夹与文件选择全链路（选择器下滑关闭卡死、外置目录 Bookmark 易失/陈旧拒用、非安装类选择缺少文件协调与前端错误吞咽），Build 48。Windows / Android：本版按紧急补丁跳过，继续使用 v1.14.1（后续统一整合）。

- iOS：`UIDocumentPickerViewController` 补齐 `UIAdaptivePresentationControllerDelegate` 下滑/外部点击关闭清理与退场过渡重试，返回 `PICKER_CANCELLED` 错误码，解决取消后后续所有选择锁死问题。
- iOS：外置目录 bookmark 改用 `options: []` 与 `.withoutChanges` 协调读取，并在 `select` 协调作用域内生成书签；`stale == true` 且目录身份一致时自动刷新持久化书签，能力探针纳入 `NSFileCoordinator` 写协调；源目录/ZIP/封面/文本选择均补齐文件协调，源目录作用域队列支持 FIFO 淘汰（保留 8 个），`getAppSettings` 自动清理失效预设根。
- iOS：前端迁移弹窗改用 `shouldShowDirectoryPickerError` 停止吞咽包含 `cancel` 的系统报错；首页目录与封面选择接入中文诊断翻译（覆盖 iCloud 未下载、`ENOTSUP`、bookmark 丢失等）。
- iOS：原生工程与前端升版至 `1.14.3`（Build `48`），GitHub Actions Run `43494192516` 全绿交付未签名 IPA。
- Windows / Android：本版跳过，继续使用 v1.14.1。

## 1.14.2 - 2026-11-11

> iOS：紧急修复新建实例安装目录选择与路径回填链路，确保 iOS 权限与目录持久化 100% 畅通（Build 40）。Windows / Android：本版无更新，继续使用 v1.14.1。

- iOS：新建实例向导补齐 iOS 平台身份透传（`isIOS={isIOS}`），恢复系统文件选择器操作引导提示；支持 `root/exact` 目录模式判定，Documents 根预填和用户选择的新目录均按父目录安全建立实例子文件夹，手动编辑自动切换为精确路径。
- iOS：隐藏 iOS 平台不支持的本地运行时 ZIP 安装入口，引导通过安全数据迁移；修复后目录选择回填、实例创建、持久化注册与启动调用全链路 100% 路径同构。
- iOS：原生工程与 Info.plist 升版至 1.14.2（Build 40），官方 CI 流水线测试全量通过并交付官方未签名 IPA。
- Windows / Android：本版无更新，继续使用 v1.14.1（Windows 保持 118.8 MB 安装包，Android 保持 versionCode 76）。

## 1.14.1 - 2026-11-10

> 通用前端：上线 22 步隔离实战引导与视口级 SVG Mask 硬件遮罩（彻底根治高刷屏撕裂频闪），卡片内联重命名与抽屉控制台，内置 SC Bordeaux 主题预设终态（Rev 3）。Android：WebView 硬件管线优化，新增可逆「酒馆性能优化」拨杆，实例时长统计接管，加固 SAF 存储与变色龙引擎（versionCode 76）。Windows：终态解耦后端与强类型 IPC 契约守护，Storage 页签 ZIP 导入导出。iOS：升版至 1.14.1（Build 39），守卫 NodeMobile 原生沙盒与独立终端提示符。

- 通用前端：彻底下线旧版迁移向导，落地 22 步隔离实战新手引导（`OnboardingSession`）；采用视口级 SVG Mask 矢量挖孔硬件遮罩取代大阴影，彻底消除 120Hz/144Hz 高刷屏画面撕裂与频闪，帧光栅化耗时降低 99.6%；沙箱加载平滑交错淡入淡出，弹层开启全局背景交互锁。
- 通用前端：卡片标题就地双向内联重命名（`InstanceRenameField`），卡片展开抽屉（`InstanceCardDrawer`），下线独立弹窗 `RenameModal`。
- 主题预设：内置 `SC Bordeaux`（波尔多红酒）升级终态 Revision 3，高斯模糊调谐至 14，更纯正深邃的深红宝石液态玻璃质感。
- Android：WebView 硬件管线优化，新增「酒馆性能优化」专属设置拨杆；`InstanceUsageStore` 接管实例运行时间统计与持久化；恪守 SAF 存储契约与目录自选铁律（versionCode 76）。
- Windows：坚守强类型 IPC 契约与纯净门面，Storage 页签支持原生 ZIP 导入预检与导出，安装包体积优化（118.8 MB）。
- iOS：原生工程与 CI 流水线对齐 1.14.1（Build 39），守卫 UIDocumentPicker 文件夹选择指引与沙盒隔离，独立终端提示符（`ios >`）。

## 1.14.0 - 2026-11-04

> Android：全量同步通用前端解耦基准，支持沉浸式渲染取色与点击光效联动，移除新版本内容公告弹窗。iOS：同步通用前端解耦基准（Build 38），完善文件夹沙盒选择操作引导，移除新版本内容公告弹窗。Windows：保持解耦后端稳定。

- 通用前端全面解耦优化：引入全新冻结盖板体系、SegmentedSwitch 拨杆、统一深色终端材质与 MapleMono 字体。
- 完整移除应用内新版本内容公告弹窗及其相关全局状态，保持启动与引导流转纯净。
- Android 新增沉浸式渲染低占用设置，支持全时/单次取色模式与点击光效联动。
- iOS 完善文件夹沙盒选择操作引导文案，保持 iOS 控制台独立提示符。

## 1.13.2 - 2026-10-27

> Android：修复酒馆文件导入、持续提示更新、实例启动与创建失败，并支持 5 GiB 以上大型 ZIP 数据备份。Windows：修复自动导出写入系统下载目录的问题，改为写入软件安装目录。iOS：本版无更新，继续使用 v1.13.1（Build 36）。

- Android 实例文件选择器放开 MIME 限制，支持大文件 ZIP 流式解压与可用空间预检。
- Windows 兜底导出目录收敛至软件安装目录 exports/。

## 1.13.1 - 2026-10-17

> Windows：同步通用前端并覆盖安装 1.13.1，后端零改动。Android：同步同一套前端，versionCode 73 / versionName 1.13.1。iOS：同步同一套前端（Build 36），补齐选中实例后的终端提示符。

- 终端与管理菜单回归右下角缩放手柄，终端改回毛玻璃外壳与下沉日志槽。
- 动态壁纸拨杆收紧并保留绿色自发光，新手引导换成当前界面图。

## 1.13.0 - 2026-10-16

> Windows：取消默认存储位置，修复升级后实例失联与误装顶替。Android：支持多开，删除实例时同步删除本地文件夹，创建时不再向用户目录写入 node_modules。iOS：接通实例导出，对齐同一套创建与迁移约定。

- 三端同步通用前端新版动效。
- 仅 Windows 的 v1.10.0–v1.12.1 用户需要阅读安装目录实例数据说明。致歉信只放在 v1.13.0。

## 1.12.1 - 2026-10-12

> Windows：恢复存储迁移、实例重命名和导出，并修复启动自愈与注册表读取。Android：透明封面垫主题色，修复管理卡圆角（versionCode 71）。iOS：同步同一套封面与圆角（Build 31）。

## 1.12.0 - 2026-10-11

> Windows：同步竖版管理菜单与 3D 卡片，并补上首页搜索栏与悬停。Android：实例位置改由用户指定，ZIP 导入只覆盖用户数据，导出改为系统另存为（versionCode 70）。iOS：接通 ZIP 导入导出与新版设置（Build 30）。

## 1.11.0 - 2026-10-08

> Windows：导入手机端 ZIP 时重置失效依赖，并支持配置实例存储根。Android：修复注册表历史路径和前台服务超时，创建改为共享依赖目录（versionCode 69）。iOS：修复真机运行时根路径校验，补上文件访问守卫（Build 29）。

- 三端新建、复制迁移、存储迁移都必须先选文件夹，不再有默认位置。

## 1.10.0 - 2026-10-05

> Windows：修复 Git 启动失败，并支持自定义实例存储根。Android：锁定设备最高刷新率，酒馆在前台时让控制台休眠。iOS：本版开始提供未签名 IPA，iOS 14.0 及以上。

## 2.0.1 - 2026-10-01

> Windows：同步更新说明画布和设置、实例管理的切换动效。Android：同样同步。iOS：本版没有安装包。

## 2.0.0 - 2026-10-01

> Windows：备份 JSON 改为原生对话框读取，并支持复制迁移与原地接管。Android：锁定高刷新率，去掉多层动态模糊，酒馆在前台时让控制台休眠。iOS：本版没有安装包。

## 1.9.2 - 2026-09-25

> Windows：同步拆开后的新前端。Android：锁定设备最高刷新率，酒馆在前台时让控制台休眠。iOS：本版开始提供 IPA，iOS 14.0 及以上。

## 1.9.1 - 2026-09-05

> Windows：修复导入壁纸图片后界面卡死。Android：同样修复。iOS：本版没有安装包。

## 1.9.0 - 2026-09-04

> Windows：升级压缩包处理依赖，去掉已知高危项。Android：与 Windows 共用控制岛、壁纸材质、实例卡片和 SC Bordeaux。iOS：本版没有安装包。

- 已有实例不会自动套用 SC Bordeaux。

## 1.8.2 - 2026-08-22

> Windows：选择「应用内窗口」时不再误开系统浏览器。Android：酒馆内导出改为调用系统保存。iOS：本版没有安装包。

## 1.8.1 - 2026-08-15

> Windows：修复实例终端按钮无响应；本版热修复未更换 Windows 安装包。Android：修复酒馆内选择文件打不开系统选择器。iOS：本版没有安装包。

## 1.8.0 - 2026-08-13

> Windows：修复插图、删除残留、自定义路径和使用时长。Android：安装包与实例、插图逻辑保持原 Release（versionCode 12）。iOS：本版没有安装包。

## 1.7.0 - 2026-08-12

> Windows：修复应用图标，远程实例密码使用 safeStorage。Android：远程实例密码使用 Keystore，新建实例后提示一次顶部滑动返回（versionCode 11）。iOS：本版没有安装包。

## 1.6.0 - 2026-07-27

> Windows：可选应用内窗口或系统浏览器打开酒馆，安装失败会清理残留。Android：同步同一套首次引导与控制台（versionCode 10）。iOS：本版没有安装包。

## 1.5.0 - 2026-07-19

> Windows：控制台改为 cmd.exe 提示，安装版直接使用内置运行时。Android：补齐创建、删除和状态回报（versionCode 9）。iOS：本版没有安装包。

## 1.4.1 - 2026-07-12

> Windows：修复 node.exe 被打进 asar 后无法启动 npm。Android：没有新安装包，继续使用 v1.4.0。iOS：本版没有安装包。

## 1.4.0 - 2026-07-12

> Windows：酒馆窗口改为叠加，启动改走 start-server.bat。Android：手势退出改为返回启动器，实例继续运行。iOS：本版没有安装包。

## 1.3.0 - 2026-07-10

> Windows：内置 Node.js v22.16.0，酒馆改为独立窗口。Android：同步更换应用图标，并修复安全区轮询导致的点击失效。iOS：本版没有安装包。

## 1.1.0 - 2026-07-06

> Windows：本版没有安装包。Android：修复 npm 安装和服务器启动，菜单改为系统字体和液态玻璃。iOS：本版没有安装包。

## 1.0.1 - 2026-07-05

> Windows：本版没有安装包。Android：首个正式版，在手机上本地运行 SillyTavern，不需要 Termux。iOS：本版没有安装包。
