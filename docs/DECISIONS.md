# 决策记录（ADR）

> 记录 SillyClient 关键架构决策的**为什么**，含背景与被否方案，避免后来者重复走弯路。

---

## ADR-001：采用 Capacitor 插件化多端架构

**状态**：采纳

**背景**
- 项目需要跨平台（安卓 / PC / iOS）让 webUI 控制本地运行的 SillyTavern。
- 各平台"底座"差异巨大：安卓需打包 Node 虚拟机；PC 直接用系统 Node；iOS 又不同。
- 若每平台从零写整套启动器 + 阅读环境，工作量与 bug 面不可控。

**决策**
- 把"一整个原生阅读环境"封装成 Capacitor 插件。
- webUI 只调统一插件接口，不认平台；每平台写一份插件实现填接口。
- 复用各平台已做好的原生能力，不重写。

**被否方案**
- **每平台独立重写整套**：工作量爆炸，否决。
- **纯 web / 不用原生**：酒馆是跨源 iframe，取色/沉浸式做不到，否决。

**后果**
- webUI 与接口契约一次写好、全平台复用。
- Node 启动 / 取色 / 沉浸式等重活仍需各端原生实现（无法跨平台复用），这是固有成本。

---

## ADR-002：插件封装"完整阅读环境"，而非零散能力

**状态**：采纳

**背景**
- 早期理解偏差：以为插件是"暴露零散原生方法"（provision 一个方法、enterImmersive 一个方法…）。
- 实际上，沉浸式阅读体验是一组强耦合的能力（原生 WebView 承酒馆 + 沉浸式 + 顶框 + 进出生命周期），拆散后无法独立工作。

**决策**
- 一个插件实现 = 一整个沉浸式阅读环境，内部完整自洽。
- webUI 通过接口控制这个环境（进/出/取色/状态），不关心环境内部如何搭建。

**后果**
- 插件内部高内聚，平台移植时整块替换，边界清晰。
- 明确了"酒馆由插件内原生 WebView 承载，Capacitor 不渲染酒馆"（铁律 B2）。

---

## ADR-003：作废 TarvenIonicApp 重写线

**状态**：采纳（2026-06-29）

**背景**
- 曾新建 `TarvenIonicApp`（`com.tarven.plus`）试图把整个安卓壳用 Capacitor + Ionic 重写。
- 在其中重写了 `TarvenServerPlugin`（provisionAndStart/enterImmersive…），等于把已完善的启动器本体又做了一遍。
- 踩了一堆工具链坑：kotlin 插件未配置导致 `ClassNotFoundException`、pnpm deps 校验拦截构建、jvmTarget 不匹配。
- 包名 `com.tarven.plus` 与品牌 `SillyClient` 不一致，违背铁律 B1。

**决策**
- `TarvenIonicApp` 整条线作废，不再投入。
- 改为在现有已完善的 `com.sillyclient` 工程上加 Capacitor 插件层（封装，不重写）。
- `TarvenIonicApp` 仓库保留作探索参考。

**教训**
- 不要重写已完善的东西，要封装。
- 工具链坑（Capacitor/Ionic）是净增复杂度，自撸桥的纯原生工程反而零此类问题。

---

## ADR-004：顶框保留轻量版 TopScrimBar，不取远程 ChameleonController

**状态**：采纳

**背景**
- 远程 `main` 分支历史上有更重的 `ChameleonController`（单动画器、含中断平滑的 scrim+gloss 版本）。
- 本地 `sillyclient-baseline` 用的是更轻的 `TopScrimBar`（scrim 三段渐变 + 点击白色光波 + 自下而上色波）。

**决策**
- 保留轻量 `TopScrimBar`，不回退到 ChameleonController。
- 顶框代码标记 `DO NOT CHANGE`，锁定。

**理由**
- 轻量版实测满足需求，渲染开销更低。
- 变色龙顶框是锁定项，不轻易折腾已验证的实现。

**约束**
- 取色层（读酒馆顶像素）无跨平台 API，各端必须原生实现（Android=PixelCopy）。

---

## ADR-005：最终唯一工程为 com.sillyclient

**状态**：采纳

**背景**
- 历史上有两个工程并存：`com.sillyclient`（自撸桥基线）与 `com.tarven.plus`（Capacitor 重写）。
- 双工程导致对账负担、重复劳动、品牌漂移。

**决策**
- 最终只存活 `com.sillyclient`：它 Capacitor 化后仍叫 `com.sillyclient` / appName `SillyClient` / 仓库 `SillyClient`。
- appId 即 `com.sillyclient`，不存在改名重签问题（因为它本来就是）。

**后果**
- 消除双工程对账负担。
- 品牌与 appId 统一（约定 B1/B5）。
