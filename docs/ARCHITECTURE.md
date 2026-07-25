# 项目架构

SillyClient 用一套 React 控制台管理 Android 和 Windows 上的 SillyTavern 实例。界面共用，文件、进程、窗口和系统适配由各平台实现。

## 仓库边界

| 仓库 | 负责内容 | 默认分支 |
| --- | --- | --- |
| `SillyClient` | GitHub Pages、公共文档、Release 与安装包 | `main` |
| `SillyClient-Android` | React 控制台唯一源码、Kotlin 宿主、Android 运行时 | `main` |
| `SillyClient-Windows` | Electron 宿主、Windows 运行时与安装器 | `master` |

仓库不通过 Git submodule 互相嵌套。跨仓库关系由版本、同步脚本和 Release 记录表达，避免只有部分平台被子模块追踪。

## 运行结构

```mermaid
flowchart LR
    UI["React 控制台"] --> Contract["TarvenEnv 接口"]
    Contract --> Android["Android / Kotlin"]
    Contract --> Windows["Windows / Electron"]
    Android --> ANode["内置 Bionic Node.js"]
    Windows --> WNode["内置 Windows Node.js"]
    ANode --> ST["SillyTavern 实例"]
    WNode --> ST
    Android --> AView["原生 WebView"]
    Windows --> WView["独立 Electron 窗口"]
```

控制台负责实例配置和状态展示。平台层负责下载、解压、进程生命周期、端口检测和窗口切换。实例只有通过可运行性检查后才算创建成功。

## 前端产物流向

唯一源码：`SillyClient-Android/web/capacitor-ui/`

| 目标 | 用途 | 是否提交 |
| --- | --- | --- |
| Android `app/src/main/assets/public/` | APK 内控制台 | 是 |
| Windows `frontend-dist/` | Electron 打包输入 | 否，可再生 |
| 主仓库 `docs/app/` | GitHub Pages 设备屏幕演示 | 是，Pages 直接使用 |

修改前端后先在 Android 仓库构建，再同步到目标。不要在生成副本上修功能。

## Pages 宣传页结构

`docs/index.html` 只保留页面语义结构和依赖装配。视觉与运行逻辑按职责拆分：

| 模块 | 文件 | 负责内容 |
| --- | --- | --- |
| 产品主题 | `docs/styles/theme.css` | 产品色板、基础材质与全局字体栈 |
| 页面骨架 | `docs/styles/page.css` | 全局布局、基础组件与响应式规则 |
| 首屏构图 | `docs/styles/hero.css` | 左侧产品介绍、右侧交叉设备摄影画幅与翻页提示 |
| 页面导航 | `docs/styles/navigation.css` | 顶部信息栏与右侧三点页轨 |
| 展示舞台 | `docs/styles/showcase.css`、`docs/scripts/spotlight-card.js` | 双端设备叙事、横向源码卡片轨道与局部光场 |
| 舞台光学 | `docs/styles/optics.css` | 边缘色散与舞台体积边界；设备模型不使用景深或渐进虚化 |
| 项目轮播 | `docs/scripts/platform-carousel.js` | 第三页分镜切换、键盘控制与可访问状态 |
| 文字动效 | `docs/styles/scroll-reveal.css`、`docs/scripts/scroll-reveal.js`、`docs/styles/variable-proximity.css`、`docs/scripts/variable-proximity.js`、`docs/styles/text-type.css`、`docs/scripts/text-type.js` | 翻页主标题、英文邻近字重与源码标签打字效果 |
| 手机外观 | `docs/styles/phone.css` | 屏幕投影层、灵动岛与反射 |
| 电脑外观 | `docs/styles/laptop.css` | 桌面屏幕投影层与反射 |
| 标题字体 | `docs/styles/fonts.css`、`docs/scripts/fonts.js` | 首屏字体资源与轮换列表 |
| 动态背景 | `docs/scripts/background.js` | Color Bends 与 Dot Field 渲染 |
| 场景配置 | `docs/scripts/device-scene-config.js` | 保存从资产库 Blender 场景换算出的相机、设备姿态与舞台状态 |
| 设备舞台 | `docs/scripts/phone-model.js` | 单一 Three.js 场景、反射环境、设备编排与双端屏幕投影 |
| 电脑模型 | `docs/scripts/laptop-model.js` | GLB 节点处理、屏幕与键盘网格法线校准、精确垂直铰链与标志隐藏 |
| 双端展示 | `docs/scripts/device-showcase.js` | 第二页折叠项与三种设备站位状态 |
| 页面编排 | `docs/scripts/page.js` | 文案、语言、分屏导航与状态 |
| 局部动效 | `docs/scripts/effects-runtime.js`、`component-*.js` | 文本、悬浮与组件反馈 |

`SillyClient_Assets/models/blender/模拟场景.blend` 是开屏视角与设备相对姿态的视觉基准。网页不会导出或叠加第二份场景模型；`device-scene-config.js` 只保存坐标系换算后的相机与姿态数据，`phone-model.js` 仍使用原始手机、电脑 GLB 在同一画布中实时渲染。第二页电脑的第一状态保留模型原始铰链角，第二、第三状态根据屏幕与键盘网格法线求解严格垂直角。

颜色和全局排版修改从 `theme.css` 开始；模型、背景或页面布局修改进入对应模块，不在
`index.html` 增加新的内联样式或脚本。`scripts/validate-pages.mjs` 会检查模块
文件、页面引用和中英文键的一致性。

页面排版由 `page.css` 中的 `--layout-unit` 控制，桌面内容画布以 16:9 为参考并居中保留稳定留白。文字层级使用独立排版变量，不与 3D 模型尺寸绑定。背景始终覆盖实际视口；Three.js 设备使用居中的固定 16:9 舞台，宽高比变化时通过留白适配，不改变镜头透视。组件尺寸使用 `rem`，全屏背景、滚动容器和页高使用 `vw` / `vh`。视口高度大于宽度时暂时只显示电脑端访问提示，不加载 3D 模型。手机与电脑共用 `phone-demo.html` 内的前端构建，分别按 `390 × 844` 和 `1440 × 900` 源画布映射到对应的 3D 屏幕。

## 发布边界

平台仓库不创建 Tag 或 Release。发布版本号、说明、校验值、APK 和 EXE 都进入主仓库 Release。平台提交哈希写入发布记录，安装包由对应提交构建。

关键决策见 [`adr/`](./adr/README.md)。平台内部实现分别以各平台仓库的架构文档为准。
