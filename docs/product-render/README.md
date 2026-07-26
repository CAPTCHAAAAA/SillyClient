# 产品展示资产

本目录负责把产品前端转换为设备屏幕纹理。最终产品图由同一套 Three.js
场景重新渲染，不使用宣传页截图。

## 数据入口

- 产品前端唯一源码：`SillyClient-Android/web/capacitor-ui/`
- Pages 展示副本：`docs/app/`
- 展示页面：`docs/phone-demo.html`
- 尺寸与贴图配置：`docs/scripts/product-render/config.js`
- 屏幕纹理：`docs/product-render/screens/`
- 移动端透明产品帧：`docs/mobile-frames/`

不要直接修改 `docs/app/` 或 `docs/phone-demo.html`。它们由同步脚本生成。

## 更新流程

1. 在 Android 仓库完成并构建 React 前端。
2. 在主仓库执行 `node scripts/sync-pages-app.mjs <capacitor-ui/dist>`。
3. 用 `screen-source.html?screen=phone` 和
   `screen-source.html?screen=laptop` 更新两张屏幕纹理。
4. 依次用 `?productRender=1&productState=0|1|2&renderWidth=3840&renderHeight=2160`
   重新导出三种 WebGL 产品帧。
5. 将三帧写入 `android.webp`、`windows.webp` 和 `together.webp`。
6. 执行 `node scripts/validate-pages.mjs`。

导出完成时，页面根节点必须同时具有
`data-product-render-ready="true"` 和
`data-product-screens="html-textured"`。任何可见设备屏幕都必须显示当前
`phone-demo.html` 的内容。
