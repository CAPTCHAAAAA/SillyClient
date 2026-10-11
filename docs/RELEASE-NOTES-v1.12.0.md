# SillyClient v1.12.0

> 三端同版发布，横跨 4 个仓库、19 项提交。主要内容：新增实例数据 ZIP 导入与导出，管理菜单重做为竖版 687×843，实例卡片升级 3D 翻面与拖拽重排，iOS 功能对齐 Android / Windows。

## 变更内容

**实例数据导入与导出**

- 新增 ZIP 数据导入：导入前预检，列出将导入的用户数据项数与将被忽略的依赖、程序文件；执行时仅覆盖用户数据，不导入 `secrets.json`。
- 新增实例导出：打包为 ZIP 后调用系统"另存为"，由用户指定保存位置与文件名；取消时静默返回。
- 移除 JSON 备份导入入口，数据导入仅支持 ZIP。

**管理菜单**

- 重做为竖版 687×843：启动参数 / 存储路径 / 实例终端 / 关于实例 四页签；搜索为居中短胶囊，分类仅保留选中项胶囊；小屏整帧等比缩放。三端界面一致。

**实例卡片**

- 升级 FlipCard 3D 翻面，启动态与停止态同位过渡。
- 支持长按拖拽重排，排序结果持久化；实例终端窗口支持拖拽定位。
- hover 与按压效果三端一致。

**设置**

- 设置抽屉精简为【通用 / 维护】两页。
- 移除"默认实例存储路径"与"实例备份"入口；实例存储位置仅在创建与迁移时通过目录选择器指定，应用不设默认路径。

**iOS**

- 功能与 Android / Windows 对齐：接通原生 ZIP 导入导出与新版设置契约。
- 预装扩展下载支持多镜像回退；启用服务端插件。
- 修改实例访问密码前回收已解锁会话。

**其他**

- 扩展与预装资源下载支持多镜像自动回退（ghfast.top / gh-proxy.com / ghproxy.net）。
- Android 原生后端重构：强类型领域模型取代元组传参，移除死代码，编译器 0 警告。
- 原生报错信息中文化。

## What's Changed

**Android · [SillyClient-Android](https://github.com/CAPTCHAAAAA/SillyClient-Android)**

- feat: 实例导出接入系统 SAF 另存为，拔除硬编码导出路径 [`a5b2043`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/a5b2043)
- feat: 实例存放位置改由用户指定，新增压缩包数据无损导入 [`77d088b`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/77d088b)
- feat: 同步通用前端竖版管理菜单与 3D 物理卡片基线 [`cac5971`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/cac5971)
- refactor: 纯净后端骨架——强类型领域模型，0 编译器警告 [`9912e36`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/9912e36)
- docs: 工作树台账与真机验收记录 [`dc272af`](https://github.com/CAPTCHAAAAA/SillyClient-Android/commit/dc272af)

**Windows · [SillyClient-Windows](https://github.com/CAPTCHAAAAA/SillyClient-Windows)**

- feat: 同步已验收通用前端基线并发布 1.12.0 [`ccad821`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/ccad821)
- fix: 补接漏改基线——首页搜索栏、管理菜单主题属性与 hover 规范 [`3b2f9ad`](https://github.com/CAPTCHAAAAA/SillyClient-Windows/commit/3b2f9ad)

**iOS · [SillyClient-iOS](https://github.com/CAPTCHAAAAA/SillyClient-iOS)**

- feat: 特性对齐 Windows / Android，接通原生 ZIP 与设置契约 [`7a44d07`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/7a44d07)
- feat: 预装扩展多镜像回退，启用服务端插件 [`4ae7b82`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/4ae7b82)
- feat: 对齐通用前端 1.12.0 基线，版本升至 Build 30 [`1fe642b`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/1fe642b)
- test: 契约审计与特性同步回归套件 [`ead0e98`](https://github.com/CAPTCHAAAAA/SillyClient-iOS/commit/ead0e98)

**通用前端 · [SillyClient](https://github.com/CAPTCHAAAAA/SillyClient)**

- feat: 竖版管理菜单对齐 687×843，选择条改为连体沟槽 [`b88c18e`](https://github.com/CAPTCHAAAAA/SillyClient/commit/b88c18e)

## 下载与校验

```
cc330ac7448a10495910c1976d0b3b93ca0f53af3cb6aff74c6706b7fcc451a9  SillyClient-Android-v1.12.0.apk      (189 MB)
3c282648be0e74a72d85d1214f6aa8b98e9901f879002162af721ffac0dc63b1  SillyClient-Windows-v1.12.0.exe      (113 MB)
7a6905a66438718f71a97cd019e9c7357d8db07c6f762f68870f0df400d53dff  SillyClient-iOS-v1.12.0-unsigned.ipa (453 MB)
```

Android / Windows 覆盖安装，实例与设置原样保留（Android versionCode 70，签名与历史版本一致）。iOS 为未签名 IPA，需在 macOS 上使用 Xcode 签名后安装。

**Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient/compare/v1.11.0...v1.12.0
