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
  token: string
  type: 'orphan_instance' | 'orphan_cover' | 'temp_file' | 'cache'
  sizeBytes: number
  description: string
}

export type MaintenanceKind = 'download_cache' | 'broken_extension' | 'stale_extension_reference'
export type MaintenanceAction = 'delete_cache' | 'quarantine' | 'remove_disabled_reference'

export interface MaintenanceItem {
  id: string
  token: string
  kind: MaintenanceKind
  relativePath: string
  sizeBytes: number
  description: string
  confidence: 'owned' | 'suspected'
  defaultSelected: boolean
  action: MaintenanceAction
}

export interface MaintenanceScan {
  instanceId: string
  scanId: string
  expiresAt: number
  items: MaintenanceItem[]
  warnings: string[]
}

export interface MaintenanceResult {
  id: string
  success: boolean
  action?: MaintenanceAction
  error?: string
  freedBytes: number
  quarantinedBytes: number
  recoveryId?: string
}

export interface MaintenanceApplyResult {
  success: boolean
  results: MaintenanceResult[]
  freedBytes: number
  quarantinedBytes: number
  recoveryIds: string[]
}

export interface MaintenanceRecovery {
  recoveryId: string
  token: string
  createdAt: number
  description: string
  relativePath: string
  kind: MaintenanceKind
  action: MaintenanceAction
  sizeBytes: number
  canRestore: boolean
  conflict?: string
}

export interface CompanionPresetSelection {
  bundleId: 'sc-bordeaux'
  revision: number
}

export type PreinstalledExtensionId = 'tavern-helper' | 'littlewhitebox' | 'prompt-template' | 'dice'

export interface PreinstallSelection {
  revision: 1
  extensionIds: PreinstalledExtensionId[]
}

export type InstallPathMode = "root" | "exact"

export interface TarvenEnvPlugin {
  provisionAndStart(options: {
    port: number
    instanceId: string
    operationId?: string
    version: string
    zipballUrl?: string
    localZipPath?: string
    /** Complete native installation path; unsupported locations fail without fallback. */
    installPath?: string
    installPathMode?: InstallPathMode
    companionPreset?: CompanionPresetSelection
    preinstall?: PreinstallSelection
    config: InstanceConfig
  }): Promise<{ ready: boolean }>

  enterImmersive(options: {
    url: string
    instanceId?: string
    showGestureHint?: boolean
  }): Promise<void>
  /** Open a credential-free HTTP(S) page in the system browser, never the Tavern view. */
  openExternalUrl(options: { url: string }): Promise<void>
  exitImmersive(): Promise<void>
  returnToTavern(): Promise<void>
  closeTavern(options?: { instanceId?: string; operationId?: string }): Promise<void>
  getStatus(): Promise<{ serverReady: boolean; mode: string; url?: string; instanceId?: string; operationId?: string }>

  /** 拉取 GitHub SillyTavern releases 列表。 */
  fetchReleases(): Promise<{ releases: GithubRelease[] }>

  /** Installation selectors return an executable root; source selectors may return document URIs. */
  pickDirectory(options?: { purpose?: "installation" | "source" }): Promise<{
    name: string
    path: string
    installPathMode?: InstallPathMode
  }>

  /** 读取应用级设置；instancesRoot 为当前默认实例存储根（实例是其直接子目录）。 */
  getAppSettings(): Promise<{ instancesRoot: string; defaultInstancesRoot: string; configuredInstancesRoot?: string }>

  /** 设置默认实例存储根；path 留空恢复出厂默认。仅影响之后创建的实例。 */
  setInstancesRoot(options?: { path?: string }): Promise<{ instancesRoot: string; configured: boolean }>

  /** 调用系统图片选择器,把图片复制到 covers/{instanceId},返回可加载的文件路径。 */
  pickImage(options: { instanceId: string }): Promise<{ path: string; url?: string }>

  /** 调用系统文件选择器,选择 SillyTavern zip 文件,复制到 tmp 并返回路径。 */
  pickZipFile(): Promise<{ path: string; sizeBytes: number }>

  /** 调用系统保存位置选择器,写入文本/JSON 文件。 */
  saveTextFile(options: { fileName: string; mimeType: string; content: string }): Promise<void>

  /** 调用系统文件选择器,读取小型文本/JSON 文件内容。 */
  readTextFile(options?: { mimeType?: string }): Promise<{ content: string; fileName: string }>

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
  cleanGarbage(options: { dryRun: boolean; activeInstanceIds?: string[]; activeCoverPaths?: string[] }): Promise<{ items: GarbageItem[]; totalBytes: number }>

  /** 删除指定垃圾项(按 path)。 */
  deleteGarbageItem(options: { path: string; token?: string }): Promise<{ success: boolean; error?: string }>

  scanInstanceMaintenance(options: { instanceId: string; installPath?: string }): Promise<MaintenanceScan>
  applyInstanceMaintenance(options: {
    instanceId: string
    scanId: string
    items: { id: string; token: string }[]
    installPath?: string
  }): Promise<MaintenanceApplyResult>
  listInstanceMaintenanceRecovery(options: { instanceId: string; installPath?: string }): Promise<{
    items: MaintenanceRecovery[]
    warnings: string[]
  }>
  restoreInstanceMaintenance(options: {
    instanceId: string
    recoveryId: string
    token: string
    installPath?: string
  }): Promise<{ success: boolean; recoveryId?: string; relativePath?: string; error?: string }>

  /** 数据迁移：将旧酒馆目录或 ZIP 压缩包迁入新实例 */
  migrateInstance(options: {
    sourcePath: string
    targetPath?: string
    instanceId: string
    operationId?: string
    mode?: 'copy' | 'takeover'
    includeSecrets?: boolean
    preinstall?: PreinstallSelection
  }): Promise<{ success: boolean; instanceId: string; targetPath?: string }>

  /** 检测保存在旧版路径（如 C 盘 AppData）的待迁移实例 */
  checkLegacyInstances(): Promise<{
    instances: Array<{
      instanceId: string
      name: string
      currentPath: string
      targetPath: string
      version?: string
    }>
  }>

  /** 单个实例无损迁移 / 路径重定位 */
  relocateInstance(options: {
    instanceId: string
    targetPath?: string
  }): Promise<{
    success: boolean
    instanceId: string
    oldPath: string
    newPath: string
    unchanged?: boolean
  }>

  /** 一键批量无损迁移旧路径实例至当前客户端默认实例目录 */
  migrateLegacyInstances(options?: {
    instanceIds?: string[]
  }): Promise<{
    success: boolean
    results: Array<{
      success: boolean
      instanceId: string
      oldPath: string
      newPath: string
      unchanged?: boolean
    }>
  }>

  /** 重命名实例并同步修改底层物理存储文件夹与注册表 */
  renameInstance(options: {
    instanceId: string
    newName: string
    installPath?: string
  }): Promise<{
    success: boolean
    oldId: string
    newId: string
    oldPath: string
    newPath: string
  }>

  /** 设置或更新实例访问密码（本地安全开关） */
  setInstancePassword(options: {
    instanceId: string
    password?: string
    oldPassword?: string
  }): Promise<{
    success: boolean
    hasPassword: boolean
  }>

  /** 校验实例访问密码 */
  verifyInstancePassword(options: {
    instanceId: string
    password: string
  }): Promise<{
    valid: boolean
  }>

  /** 查询实例是否设置了访问密码 */
  hasInstancePassword(options: {
    instanceId: string
  }): Promise<{
    hasPassword: boolean
  }>

  /** 解除并清除实例访问密码 */
  clearInstancePassword(options: {
    instanceId: string
    oldPassword?: string
  }): Promise<{
    success: boolean
  }>

  /** 批量获取所有实例的密码保护状态 */
  listInstancePasswordStatus(): Promise<Record<string, boolean>>

  addListener(
    eventName: 'log' | 'progress' | 'ready' | 'mode' | 'error',
    listenerFunc: (data: TarvenEvent) => void,
  ): Promise<PluginListenerHandle>
}

export interface TarvenEvent {
  instanceId?: string
  operationId?: string
  source?: 'command'
  message?: string
  line?: string
  text?: string
  level?: string
  percent?: number
  stage?: string
  ready?: boolean
  url?: string
  port?: number
  mode?: string
  tavernRunning?: boolean
  lastUsedAt?: string
  totalUsageMs?: number
}

export const TarvenEnv = registerPlugin<TarvenEnvPlugin>('TarvenEnv',
  import.meta.env.DEV && new URLSearchParams(window.location.search).get('nativePreview') === '1'
    ? { web: async () => (await import('./dev/native-preview')).nativePreview }
    : undefined,
)
