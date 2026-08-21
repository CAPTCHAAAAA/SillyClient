# SillyClient Pages

本目录是 SillyClient 项目主页的发布源。GitHub Pages 从主仓库 `main` 分支的
`docs/` 目录读取文件，线上入口为
[captchaaaaa.github.io/SillyClient](https://captchaaaaa.github.io/SillyClient/)。

网页不再使用独立的前端仓库。旧 `SillyClient-Frontend` 仓库已经停止使用；
宣传页、设备演示、公共文档和 Release 入口统一由
[`SillyClient`](https://github.com/CAPTCHAAAAA/SillyClient) 主仓库维护。

## 页面入口

| 文件 | 用途 | 运行条件 |
| --- | --- | --- |
| `index.html` | 桌面完整演示，包含实时 Three.js 设备舞台 | 视口宽度大于或等于高度 |
| `mobile.html` | 移动轻量演示，使用透明 4K 产品帧 | 视口高度大于宽度 |
| `phone-demo.html` | 手机与电脑屏幕中的产品前端 | 由同步脚本生成 |
| `product-render/screen-source.html` | 把产品前端转换为设备屏幕纹理 | 仅用于资产生成 |
| `landing-3d-v2.html` | 旧地址兼容入口 | 保留，不作为开发入口 |

`scripts/viewport-router.js` 在其余依赖加载前判断宽高比，并在视口跨过
1:1 临界值时切换入口。`?desktop=1`、`?mobile=1` 和 `?productRender=1`
只用于本地预览、自动化验证和产品帧导出。

## 目录职责

```text
docs/
├── index.html                  桌面页面结构
├── mobile.html                 移动页面结构
├── app/                        共享 React 控制台构建副本
├── mobile/                     移动页脚本与样式
├── mobile-frames/              移动页使用的透明 4K WebP 产品帧
├── models/                     线上 Three.js 使用的 GLB
├── product-render/             屏幕纹理与产品帧生成入口
├── scripts/
│   ├── background/             动态背景渲染
│   ├── device-render/          WebGL 舞台、手机、投影与输入
│   ├── page/                   桌面内容、导航与检查器
│   ├── product-render/         产品帧配置、贴图与导出
│   └── ui/                     桌面和移动共用的界面控制器
└── styles/
    └── page/                   桌面页面分区样式
```

完整模块说明、依赖方向和修改流程见
[`PAGES-MAINTENANCE.md`](./PAGES-MAINTENANCE.md)。跨仓库边界见
[`ARCHITECTURE.md`](./ARCHITECTURE.md)。

## 源码与生成物

共享 React 控制台在本仓库维护的源码在
`web/capacitor-ui/`。本目录中的 `app/` 与
`phone-demo.html` 是构建副本，不接受功能修改。

以下内容需要提交，因为 GitHub Pages 会直接读取：

- `app/` 和 `phone-demo.html`
- `models/`、`landing-fonts/` 与页面图标
- `product-render/screens/`
- `mobile-frames/`
- 所有页面、样式和运行脚本

以下内容不得提交：

- 浏览器截图、临时导出和调试录屏
- Blender 缓存与备份文件
- 本地服务日志和依赖目录
- 未经过验收的中间纹理或产品帧

## 修改入口

| 需求 | 修改位置 |
| --- | --- |
| 产品配色、全局材质 | `styles/theme.css` |
| 桌面页面内容与双语文案 | `scripts/page/content.js`、`index.html` |
| 移动页面内容与双语文案 | `mobile/scripts/content.js`、`mobile.html` |
| 背景流光与点阵 | `scripts/background/` |
| 手机模型与材质 | `scripts/device-render/phone-device.js` |
| 电脑模型与铰链 | `scripts/laptop-model.js` |
| 相机、灯光、抗锯齿 | `scripts/device-render/webgl-stage.js` |
| 设备站位与转场 | `scripts/device-scene-config.js`、`scripts/device-transition.js` |
| HTML 屏幕刚性投影 | `scripts/device-render/screen-projection.js` |
| 移动产品帧 | `product-render/`、`scripts/product-render/` |
| 标题字体轮换 | `scripts/ui/title-font-controller.js`、`styles/fonts.css` |
| 视口入口选择 | `scripts/viewport-router.js` |

`index.html` 与 `mobile.html` 只保留语义结构和依赖装配。不要把新样式或业务逻辑重新
写回 HTML，也不要把已经拆分的模块合并到 `page.js`、`phone-model.js` 或
`background.js`。

## 本地检查

在主仓库根目录运行：

```bash
node scripts/validate-pages.mjs
git diff --check
```

页面需要通过 HTTP 服务访问，不能直接双击 HTML。当前工作区约定使用：

```text
http://127.0.0.1:8767/
```

提交前至少检查横屏桌面入口、竖屏移动入口、第二页三个设备状态、第三页轮播、
中英文切换、标题字体轮换，以及浏览器控制台是否有错误。
