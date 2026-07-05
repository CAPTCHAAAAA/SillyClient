# 更新日志

所有版本变更记录。日期格式为 YYYY-MM-DD。

## [v1.0.1] — 2026-07-05

SillyClient 首个正式版。在 Android 上本地运行 SillyTavern 的启动器，无需 Termux，开箱即用。

### 新功能

#### 实例管理
- 多实例创建与切换，支持本地实例和远程连接两种模式
- GitHub SillyTavern releases 动态拉取，版本下拉支持 20+ 版本选择
- 卡片式轮播界面，支持鼠标拖拽 + 触屏滑动 + 方向键 + 圆点指示器
- 卡片自定义封面图，通过系统图片选择器更换
- 实例重命名、管理、卸载
- 实例配置持久化到 localStorage，支持版本迁移

#### 启动与运行
- 嵌入式 Node.js 运行时，无需 Termux 或外部依赖
- 本地实例一键启动：自动下载 SillyTavern → 配置 config.yaml → 启动 Node 服务 → 进入沉浸式
- 远程实例直接连接，原生 HEAD 请求检测在线状态，15 秒自动轮询
- 启动超时兜底机制（首次下载 180s / 已有实例 60s）
- 启动失败自动退出沉浸式，返回启动器

#### 实例配置
- 启动端口自定义
- 允许外部监听开关（局域网访问）
- IPv4/IPv6 协议开关
- IPv6 DNS 优先开关
- 心跳写入间隔配置
- HTTP Keep-Alive 开关
- 配置写入 SillyTavern config.yaml，启动时生效
- draftConfig 保存模式：修改后需确认保存才生效

#### 终端面板
- 实时日志显示（info/error/success 三色）
- 监听原生 log/progress/ready/mode 事件
- 命令输入框，回车发送到 Node stdin
- 字号调节滑块（9-20px）
- 面板拖拽缩放（鼠标 + 触屏）
- 进度日志合并连续百分比行防刷屏
- 一键刷新酒馆 WebView

#### 数据管理
- 数据导出：将实例配置序列化为 JSON 下载
- 数据导入：选择 JSON 文件合并恢复实例
- 垃圾清理：扫描孤立实例目录、孤立封面图、临时文件、WebView 缓存
- 实例卸载：原生删除安装目录 + 封面图，返回释放空间
- WebView 缓存/Cookie/历史清理
- 宿主数据重置（清空 localStorage + WebView 数据）

#### 界面定制
- 动态光效背景（5 层流光动画，可暂停）
- 自定义壁纸上传
- 暗色 / 亮色主题切换
- 9 种 Logo 字体循环切换
- 挖孔屏安全区自动避让（getSafeInsets）

#### 交互体验
- 下拉刷新（iOS 风格指数阻尼动画，阈值 55px）
- 水平手势过滤防误触
- 实例搜索栏（实时过滤 + 回车跳转）
- 版本下拉菜单智能定位（下方空间不足时上方展开）
- 统一的退出动画过渡

#### APP 设置菜单
- 下拉刷新开关
- 导入/导出数据压缩包
- 清空浏览器数据
- 清理垃圾（扫描 + 一键清理）
- 清空宿主数据并重新初始化

### Bug 修复
- 修复更换插图闪退问题（@ActivityCallback 方法签名修正为 Capacitor 6 正确签名）
- 修复更换插图二次更换失败问题（图片 URL 添加时间戳破除缓存）
- 修复版本下拉菜单内容超出屏幕无法滚动问题
- 修复版本下拉菜单弹出位置超出屏幕显示区域问题
- 修复下拉刷新与卡片水平滑动误触问题（添加垂直手势检测）
- 修复实例卸载仅从内存移除不清理原生文件问题
- 修复终端面板右侧超出设置按钮边缘问题

### 技术优化
- 移除 37 个未使用的 npm 依赖（@radix-ui 全系列、@supabase、framer-motion、recharts、zod 等）
- 删除 46 个未使用的 shadcn/ui 组件文件
- 删除死状态变量（verDropdownClosing、newInstanceZipUrl）
- 删除死代码分支（"latest" 版本判断、零长度 SVG line）
- 合并重复组件（ManageItem / AppMenuItem）
- 提取 parsePackageVersion 公共方法消除重复逻辑
- 清理未使用的 import / 私有方法 / 参数
- 统一日志 TAG 常量替代字面量
- 简化插件 config 解析逻辑

### 技术栈
- Android 原生壳：Kotlin + Capacitor 7 + Gradle
- 前端 UI：React 19 + Vite 7 + Tailwind CSS v4
- 路由与数据：TanStack Router + TanStack Query
- 运行时：嵌入式 Node.js（Termux bootstrap）
- 目标服务：SillyTavern

### 最低系统要求
- Android 7.0 (API 24)
- 架构：arm64-v8a
- 存储空间：首次启动需约 200MB（下载 SillyTavern + node_modules）
