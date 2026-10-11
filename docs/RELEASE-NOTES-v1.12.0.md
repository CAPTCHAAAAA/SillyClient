# SillyClient v1.12.0

> **三端同版 · 横跨 4 个仓库 · 19 项提交。**
> 核心主题：实例数据进出全线打通（ZIP 导入 / 系统另存为导出），管理菜单重做为竖版 687×843，实例卡片进入 3D 时代。

## 这次更新了什么

**1. 实例数据进出全线打通**
导出不再写死"下载/SillyClient-导出"——点击导出直接弹出系统"另存为"，位置和文件名由你自己定，取消静默复位。导入只认 ZIP：先预检告诉你"将导入多少项用户数据、忽略多少依赖与程序文件"，执行时只覆盖用户数据，`secrets.json` 永不触碰。旧 JSON 备份通道退役，数据进出一条路，不再有两套语义。

**2. 管理菜单全面重做，三端一个模样**
竖版 687×843 定版：启动参数 / 存储路径 / 实例终端 / 关于实例 四页签，连体沟槽选择条、居中短胶囊搜索；小屏整帧等比缩放，不再拉成扁宽条。Android、Windows、iOS 从此是同一张脸。

**3. 实例卡片进入 3D 时代**
FlipCard 物理翻面让启动态与停止态在同一张卡片上溶变；长按拖拽重排，松手即持久化；实例终端窗口可自由拖拽定位。hover 与按压手感三端完全一致——移动端没有 hover，但每一次按压都有反馈。

**4. iOS 追平双端**
iOS 不再是"二等公民"：接通原生 ZIP 导入导出与新版设置契约，预装扩展获得多镜像下载回退，服务端插件启用；修改访问密码前自动回收已解锁会话（Keychain 守卫）。41 项前端单测、116 项运行时测试、7 套云验证全绿。

**5. 更干净的底层**
设置抽屉只剩【通用 / 维护】两页，"默认实例存储路径""实例备份"彻底移除——实例位置永远由你选，应用不设任何默认路径。Android 后端完成纯净重构：强类型领域模型取代元组传参、死代码剥离、编译器 0 警告；原生报错全面中文化。扩展与预装资源下载获得多镜像自动回退（ghfast.top / gh-proxy.com / ghproxy.net），单一镜像失效不再卡安装。

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

Android / Windows 覆盖安装即可，实例与设置原样保留（Android versionCode 70，签名与历史版本一致）。iOS 为未签名 IPA，在 macOS 上用 Xcode 签名后安装。

**Full Changelog**: https://github.com/CAPTCHAAAAA/SillyClient/compare/v1.11.0...v1.12.0
