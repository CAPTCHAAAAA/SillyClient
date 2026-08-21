import { registerPlugin, PluginListenerHandle } from '@capacitor/core'

/**
 * TarvenEnv 插件 —— 由原生侧 com.sillyclient.plugin.TarvenEnvPlugin 实现。
 *
 * 职责:provision/启动本地 Node 实例、进入/退出沉浸式 WebView(承酒馆,本地或远程)。
 * 端口与目标 URL 由前端实例数据决定,不再硬编码 8000。
 */

/** 本地实例的 SillyTavern 运行配置(映射管理面板全部设置项)。 */
export interface InstanceConfig {
  listen: boolean
  ipv4: boolean
  ipv6: boolean
  dnsIpv6: boolean
  heartbeat: number
  keepAlive: boolean
}

export const DEFAULT_CONFIG: InstanceConfig = {
  listen: false,
  ipv4: true,
  ipv6: false,
  dnsIpv6: false,
  heartbeat: 0,
  keepAlive: false,
}

/** GitHub release 条目(来自 SillyTavern/SillyTavern releases)。 */
export interface GithubRelease {
  tag: string
  zipballUrl: string
  prerelease: boolean
}

/** SillyClient 应用自身的更新检查结果。 */
export interface AppUpdateInfo {
  currentVersion: string
  latestVersion: string
  updateAvailable: boolean
  releaseUrl?: string
  publishedAt?: string
}

export type ContentOpenMode = 'webview' | 'browser'

/** 自检发现的本地实例。 */
export interface ScannedInstance {
  instanceId: string
  version: string
  path?: string
  sizeBytes: number
  hasServer: boolean
  createdAt?: string
  lastUsedAt?: string
  totalUsageMs?: number
}

/** 实例详情(管理面板「关于」真实数据)。 */
export interface InstanceInfo {
  instanceId: string
  version: string
  path: string
  sizeBytes: number
  createdAt: string
  lastUsedAt?: string
  totalUsageMs?: number
  status: string
}

/** 垃圾清理项。 */
export interface GarbageItem {
  path: string
  type: 'orphan_instance' | 'orphan_cover' | 'temp_file' | 'cache'
  sizeBytes: number
  description: string
}

export interface TarvenEnvPlugin {
  provisionAndStart(options: {
    port: number
    instanceId: string
    version: string
    zipballUrl?: string
    localZipPath?: string
    /** Windows 可选：实例实际安装目录的绝对路径。Android 忽略该字段。 */
    installPath?: string
    config: InstanceConfig
  }): Promise<{ ready: boolean }>

  enterImmersive(options: {
    url: string
    instanceId?: string
    showGestureHint?: boolean
  }): Promise<void>
  exitImmersive(): Promise<void>
  returnToTavern(): Promise<void>
  closeTavern(): Promise<void>
  getStatus(): Promise<{ serverReady: boolean; mode: string; url?: string }>

  /** 拉取 GitHub SillyTavern releases 列表。 */
  fetchReleases(): Promise<{ releases: GithubRelease[] }>

  /** 调用系统目录选择器,返回选中的目录显示名(用作实例安装标识)。 */
  pickDirectory(): Promise<{ name: string; path: string }>

  /** 调用系统图片选择器,把图片复制到 covers/{instanceId},返回可加载的文件路径。 */
  pickImage(options: { instanceId: string }): Promise<{ path: string; url?: string }>

  /** 调用系统文件选择器,选择 SillyTavern zip 文件,复制到 tmp 并返回路径。 */
  pickZipFile(): Promise<{ path: string; sizeBytes: number }>

  /** 调用系统保存位置选择器,写入文本/JSON 文件。 */
  saveTextFile(options: { fileName: string; mimeType: string; content: string }): Promise<void>

  /** 自检:扫描本地已存在的酒馆实例目录。 */
  scanInstances(): Promise<{ instances: ScannedInstance[] }>

  /** 读取实例详情(关于页真实数据)。 */
  getInstanceInfo(options: { instanceId: string; installPath?: string; port?: number }): Promise<InstanceInfo>

  /** 在当前平台的原生控制台中执行命令。 */
  sendCommand(options: { text: string; instanceId?: string }): Promise<void>

  /** 刷新酒馆 WebView。 */
  reloadTavern(): Promise<void>

  /** 清空宿主 WebView 缓存/Cookie/历史。 */
  clearWebViewData(): Promise<void>

  /** 获取安全 insets(挖孔/状态栏避让)。 */
  getSafeInsets(): Promise<{ top: number; bottom: number; left: number; right: number }>

  /** 启用/禁用酒馆 WebView 下拉刷新。 */
  setPullToRefresh(options: { enabled: boolean }): Promise<void>

  /** Windows: 获取和保存酒馆内容的全局打开方式。 */
  getContentOpenMode(): Promise<{ mode: ContentOpenMode }>
  setContentOpenMode(options: { mode: ContentOpenMode }): Promise<{ mode: ContentOpenMode }>

  /** 将远程实例的 Basic Auth 凭据写入平台安全存储。password 省略时保留现有密码。 */
  setRemoteBasicAuth(options: {
    instanceId: string
    username: string
    password?: string
  }): Promise<{ configured: boolean; username: string }>

  /** 查询远程实例是否已经配置 Basic Auth，不返回密码。 */
  getRemoteBasicAuthStatus(options: {
    instanceId: string
  }): Promise<{ configured: boolean; username?: string }>

  /** 删除远程实例对应的 Basic Auth 凭据。 */
  clearRemoteBasicAuth(options: { instanceId: string }): Promise<{ success: boolean }>

  /** 探测远程实例是否在线(原生 HEAD 请求,绕过 WebView CORS)。 */
  pingUrl(options: {
    url: string
    instanceId?: string
    username?: string
    password?: string
  }): Promise<{ online: boolean; statusCode?: number; authRequired?: boolean; error?: string }>

  /** 卸载实例:删除安装目录和封面图。 */
  uninstallInstance(options: { instanceId: string; installPath?: string; port?: number }): Promise<{ success: boolean; freedBytes: number }>

  /** 清理垃圾:扫描孤立文件/目录,返回可清理项。dryRun=true 仅扫描不删除。 */
  cleanGarbage(options: { dryRun: boolean }): Promise<{ items: GarbageItem[]; totalBytes: number }>

  /** 删除指定垃圾项(按 path)。 */
  deleteGarbageItem(options: { path: string }): Promise<{ success: boolean }>

  addListener(
    eventName: 'log' | 'progress' | 'ready' | 'mode' | 'error',
    listenerFunc: (data: any) => void,
  ): Promise<PluginListenerHandle>
}

export const TarvenEnv = registerPlugin<TarvenEnvPlugin>('TarvenEnv')
