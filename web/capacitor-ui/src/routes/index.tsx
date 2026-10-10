import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import {
  Menu,
  ChevronDown,
  Check,
  X,
  Play,
  Search,
  Folder,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Terminal,
} from "lucide-react";
import { cn, normalizeStoredVersion, formatDisplayVersion } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv, DEFAULT_CONFIG } from "@/capacitor-plugin";
import { openExternalUrl } from "@/lib/external-links";
import type { AppUpdateInfo, CompanionPresetSelection, ContentOpenMode, InstanceConfig, InstallPathMode, GithubRelease, GarbageItem, TarvenEvent, PreinstalledExtensionId } from "@/capacitor-plugin";
import { buildInstanceSubfolder, cleanInstallPath, exactInstallTarget, installationSelection, sanitizeFolderName } from "@/lib/install-location";
import { normalizeStoredInstances, serializeInstanceRecords, parseInstanceBackup, type StoredInstance } from "@/lib/instance-persistence";
import { GLOBAL_LOG_KEY, instanceLogs, type LogLine } from "@/lib/log-store";
import { OperationCoordinator, OperationCancelledError, type OperationContext } from "@/lib/operation-coordinator";
import { APP_VERSION } from "@/constants/app-version";
import { fetchAppUpdate } from "@/lib/app-update";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";
import { WhatsNewModal } from "@/components/modals/WhatsNewModal";
import { LegacyMigrationModal, type LegacyMigrationItem } from "@/components/modals/LegacyMigrationModal";
import { RelocateInstanceModal } from "@/components/modals/RelocateInstanceModal";
import { LAYERS } from "@/constants/layers";
import { useLayerStack } from "@/hooks/useLayerStack";
import { LayerBackdrop } from "@/components/common/LayerBackdrop";
import { InstanceCarousel, type InstanceCarouselRef } from "@/components/instance/InstanceCarousel";
import { NewInstanceWizardModal } from "@/components/modals/NewInstanceWizardModal";
import { ManageInstanceModal } from "@/components/modals/ManageInstanceModal";
import { InstanceMaintenancePanel } from "@/components/modals/InstanceMaintenancePanel";
import { BackgroundSettingsDrawer } from "@/components/modals/BackgroundSettingsDrawer";
import { AppSettingsDrawer } from "@/components/modals/AppSettingsDrawer";
import { TerminalModal } from "@/components/modals/TerminalModal";
import { CleanGarbageModal } from "@/components/modals/CleanGarbageModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { RenameModal } from "@/components/modals/RenameModal";
import { VersionDropdownMenu } from "@/components/modals/VersionDropdownMenu";
import { CardActionMenu } from "@/components/modals/CardActionMenu";
import { LaunchConsoleModal } from "@/components/modals/LaunchConsoleModal";
import { UnlockInstanceModal } from "@/components/modals/UnlockInstanceModal";
import type { TavernInstance, ManageTab, BgMode, ThemeStyle, OperationPurpose } from "@/types";

export const Route = createFileRoute("/")({
  component: SillyClientLauncher,
});




const INSTANCES_KEY = "sillyclient.instances";
const INSTANCES_VERSION_KEY = "sillyclient.instances.version";
const ONBOARDING_KEY = "sillyclient.onboarding.version";
const ONBOARDING_VERSION = "3";
const WHATS_NEW_KEY = "sillyclient.whatsnew.version";
const WHATS_NEW_VERSION = APP_VERSION;
const LEGACY_MIGRATION_KEY = "sillyclient.legacy_migration.version";
const CURRENT_VERSION = 2;
const BACKGROUND_PANEL_EXIT_MS = 300;
const PANEL_EXIT_MS = 300;
const POPOVER_EXIT_MS = 200;
const MANAGE_PANEL_OPEN_GAP_MS = 32;

function hydrateInstance(t: StoredInstance): TavernInstance {
  return {
    ...t,
    cover: normalizeStoredCover(t.cover),
    totalUsage: t.type === "local" && /(?:^|\s)\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)$/i.test(t.totalUsage || "")
      ? "—"
      : t.totalUsage,
    icon: t.type === "local" ? <Folder className="w-5 h-5" /> : <Cloud className="w-5 h-5" />,
  };
}

function mergeInstanceBackup(existing: TavernInstance[], incoming: StoredInstance[]) {
  const map = new Map(existing.map(instance => [instance.id, instance]));
  for (const item of incoming) map.set(item.id, hydrateInstance(item));
  return Array.from(map.values());
}

/** 从 localStorage 读取已持久化的实例列表;版本不匹配时清空旧数据。 */
function loadInstances(): TavernInstance[] {
  // 版本不匹配说明是旧版残留数据,清空
  const savedVersion = localStorage.getItem(INSTANCES_VERSION_KEY);
  if (savedVersion !== String(CURRENT_VERSION)) {
    localStorage.removeItem(INSTANCES_KEY);
    localStorage.setItem(INSTANCES_VERSION_KEY, String(CURRENT_VERSION));
    return [];
  }
  try {
    const raw = localStorage.getItem(INSTANCES_KEY);
    if (raw) {
      return normalizeStoredInstances(JSON.parse(raw), { resetStatus: true }).map(hydrateInstance);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function normalizeStoredCover(cover?: string) {
  if (!cover || cover.startsWith("?")) return undefined;
  const isWindowsHost = typeof window !== "undefined"
    && (window as typeof window & { __SILLYCLIENT_PLATFORM__?: string }).__SILLYCLIENT_PLATFORM__ === "windows";
  if (!isWindowsHost || !cover.startsWith("capacitor-file:///")) return cover;

  try {
    const parsed = new URL(cover);
    const fileName = decodeURIComponent(parsed.pathname).split("/").filter(Boolean).pop();
    return fileName
      ? `app://localhost/__sillyclient_cover__/${encodeURIComponent(fileName)}${parsed.search}`
      : undefined;
  } catch {
    return undefined;
  }
}

/** 持久化实例列表(icon 不持久化,加载时还原)。 */
function saveInstances(list: TavernInstance[]) {
  try {
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(serializeInstanceRecords(list)));
  } catch {
    /* ignore */
  }
}

/** 仅 Vite 开发预览使用，不进入正式构建与本地存储。 */
const DEMO_INSTANCE: TavernInstance = {
  id: "demo-instance",
  name: "演示实例",
  subtitle: "本地演示 · 可展开",
  version: "1.12.4",
  status: "running",
  type: "local",
  createdAt: "2026-08-22",
  lastUsed: "刚刚",
  totalUsage: "3 小时",
  color: "#a3e635",
  port: 8000,
  icon: <Folder className="w-5 h-5" />,
};


const SC_BORDEAUX_PRESET: CompanionPresetSelection = {
  bundleId: "sc-bordeaux",
  revision: 1,
};

function formatOperationStage(stage?: string, percent?: number) {
  const value = (stage || "").toLowerCase();
  if (value.includes("download")) return percent ? `正在下载当前版本 · ${percent}%` : "正在下载当前版本";
  if (value.includes("extract")) return "正在解压并校验文件";
  if (value.includes("depend") || value.includes("npm")) return "正在安装运行依赖";
  if (value.includes("runtime")) return "运行环境已准备";
  if (value.includes("source ready")) return "实例文件校验完成";
  if (value.includes("start")) return "正在启动 SillyTavern";
  if (value.includes("waiting") || value.includes("poll")) return "正在确认实例可运行";
  if (value.includes("ready") || value.includes("就绪")) return "实例已就绪";
  return stage || "正在初始化";
}

function formatNativeDate(value?: string) {
  if (!value) return "—";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatUsageDuration(value?: number) {
  if (!Number.isFinite(value)) return "—";
  const totalSeconds = Math.max(0, Math.floor(Number(value) / 1000));
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

// 外部组件定义(避免内部函数组件每次渲染重新创建导致 input 失焦)
function SillyClientLauncher() {
  const isWeb = !Capacitor.isNativePlatform();
  const showcaseParams = new URLSearchParams(window.location.search);
  const isShowcase = showcaseParams.get("showcase") === "1";
  const isNativePreview = import.meta.env.DEV && showcaseParams.get("nativePreview") === "1";
  const isDemoPreview = import.meta.env.DEV && isWeb && !isShowcase;
  const showcaseSafeTop = isShowcase
    ? Math.max(0, Number(showcaseParams.get("safeTop")) || 52)
    : 0;
  const isWindows = typeof window !== "undefined"
    && (
      (window as typeof window & { __SILLYCLIENT_PLATFORM__?: string }).__SILLYCLIENT_PLATFORM__ === "windows"
      || Capacitor.getPlatform() === "windows"
    );
  const isAndroid = Capacitor.getPlatform() === "android";
  const terminalTitle = isWindows ? "Windows 控制台" : "Android 终端";
  const terminalPrompt = isWindows ? "C:\\>" : "~ $";
  const terminalBanner = isWindows
    ? `SillyClient ${APP_VERSION} · Windows · cmd.exe`
    : `SillyClient ${APP_VERSION} · Android shell`;
  const terminalPlaceholder = isWindows ? "输入 Windows 命令" : "输入 Android shell 命令";
  const [showOnboarding, setShowOnboarding] = useState(
    () => (!isWeb || isWindows) && !isShowcase && localStorage.getItem(ONBOARDING_KEY) !== ONBOARDING_VERSION,
  );
  const [showWhatsNew, setShowWhatsNew] = useState(
    () => (!isWeb || isWindows) && !isShowcase && localStorage.getItem(ONBOARDING_KEY) === ONBOARDING_VERSION && localStorage.getItem(WHATS_NEW_KEY) !== WHATS_NEW_VERSION,
  );
  const [isWhatsNewClosing, setIsWhatsNewClosing] = useState(false);
  const [showLegacyMigration, setShowLegacyMigration] = useState(false);
  const [isLegacyMigrationClosing, setIsLegacyMigrationClosing] = useState(false);
  const [legacyMigrationList, setLegacyMigrationList] = useState<LegacyMigrationItem[]>([]);
  const [relocatingInstance, setRelocatingInstance] = useState<TavernInstance | null>(null);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [isRelocateModalClosing, setIsRelocateModalClosing] = useState(false);
  const [instances, setInstances] = useState<TavernInstance[]>(() => {
    if (isShowcase) return [];
    const loaded = loadInstances();
    return isDemoPreview ? [DEMO_INSTANCE, ...loaded] : loaded;
  });
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>(() => {
    try {
      const saved = localStorage.getItem("sillyclient.bgMode") || localStorage.getItem("bgMode");
      if (saved === "dynamic" || saved === "custom") return saved;
    } catch {}
    return "dynamic";
  });
  const [dynamicPaused, setDynamicPaused] = useState(false);
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(() => {
    try {
      const saved = localStorage.getItem("sillyclient.themeStyle") || localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });
  const [themeSmoothing, setThemeSmoothing] = useState(false);
  const themeSmoothingTimer = useRef<number | null>(null);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalClosing, setIsTerminalClosing] = useState(false);
  const [terminalSize, setTerminalSize] = useState({ w: 640, h: 340 });
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const operations = useMemo(() => new OperationCoordinator(), []);
  const [launchLogKey, setLaunchLogKey] = useState<string | null>(null);
  const lastMigration = useRef<Parameters<typeof TarvenEnv.migrateInstance>[0] | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchProgress, setLaunchProgress] = useState<{ pct: number; text: string } | null>(null);
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [isLaunchPanelClosing, setIsLaunchPanelClosing] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const setLaunchLogs = useCallback((value: LogLine[] | ((previous: LogLine[]) => LogLine[])) => {
    const key = operations.current?.logKey || GLOBAL_LOG_KEY;
    instanceLogs.update(key, value);
    setLaunchLogKey(current => current === key ? current : key);
  }, [operations]);
  const [lastLaunchParams, setLastLaunchParams] = useState<TavernInstance | null>(null);
  const [operationPurpose, setOperationPurpose] = useState<OperationPurpose>("launch");

  // 实例访问密码解锁状态
  const [unlockingInstance, setUnlockingInstance] = useState<TavernInstance | null>(null);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [isUnlockModalClosing, setIsUnlockModalClosing] = useState(false);
  const closeUnlockModal = useCallback(() => {
    setIsUnlockModalClosing(true);
    setTimeout(() => {
      setIsUnlockModalOpen(false);
      setIsUnlockModalClosing(false);
      setUnlockingInstance(null);
    }, POPOVER_EXIT_MS);
  }, []);

  // Logo 字体切换
  const logoFonts = [
    { name: 'Yummy', family: "'Yummy', sans-serif" },
    { name: 'Arcade Raiders', family: "'Arcade Raiders', sans-serif" },
    { name: 'Noisy Walk', family: "'Noisy Walk', sans-serif" },
    { name: 'Stay Pixel', family: "'Stay Pixel', sans-serif" },
    { name: '04B 30', family: "'04B 30', sans-serif" },
    { name: 'Pixel Chaos', family: "'Pixel Chaos', sans-serif" },
    { name: 'Soap', family: "'Soap', sans-serif" },
    { name: 'Syndra', family: "'Syndra', sans-serif" },
    { name: 'Dynamic Display', family: "'Dynamic Display', sans-serif" },
  ];
  const [logoFontIndex, setLogoFontIndex] = useState(0);

  // 实例卡片状态
  const [activeCardMenu, setActiveCardMenu] = useState<string | null>(null);
  const [isCardMenuClosing, setIsCardMenuClosing] = useState(false);
  const [showManagePanel, setShowManagePanel] = useState<TavernInstance | null>(null);
  const [maintenanceInstance, setMaintenanceInstance] = useState<TavernInstance | null>(null);
  const closeMaintenance = useCallback(() => setMaintenanceInstance(null), []);
  const [isManagePanelClosing, setIsManagePanelClosing] = useState(false);
  const [manageTab, setManageTab] = useState<ManageTab>("launch");
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [manageFilter, setManageFilter] = useState<"all" | "local" | "remote">("all");
  const [manageMoreOpen, setManageMoreOpen] = useState(false);
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [isAppMenuClosing, setIsAppMenuClosing] = useState(false);
  const [appSettingsTab, setAppSettingsTab] = useState<"general" | "data" | "maintenance">("general");
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [showNewInstancePanel, setShowNewInstancePanel] = useState(false);
  const [isNewInstancePanelClosing, setIsNewInstancePanelClosing] = useState(false);
  const [newInstanceMode, setNewInstanceMode] = useState<"local" | "remote" | "import">("local");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceDir, setNewInstanceDir] = useState("");
  const [newInstancePathMode, setNewInstancePathMode] = useState<InstallPathMode>("exact");
  const directoryPickerGeneration = useRef(0);
  const [newInstanceUrl, setNewInstanceUrl] = useState("http://");
  const [newRemoteAuthEnabled, setNewRemoteAuthEnabled] = useState(false);
  const [newRemoteAuthUsername, setNewRemoteAuthUsername] = useState("");
  const [newRemoteAuthPassword, setNewRemoteAuthPassword] = useState("");
  // Windows 数据迁移状态
  const [migrationAccessMode, setMigrationAccessMode] = useState<"copy" | "takeover">("copy");
  const [migrationSourcePath, setMigrationSourcePath] = useState("");
  const [migrationIncludeSecrets, setMigrationIncludeSecrets] = useState(false);
  const [migrationCustomDest, setMigrationCustomDest] = useState("");
  const [migrationTargetPathMode, setMigrationTargetPathMode] = useState<InstallPathMode>("exact");
  const [newInstanceVersion, setNewInstanceVersion] = useState("stable");
  const [newInstanceCompanionPresetEnabled, setNewInstanceCompanionPresetEnabled] = useState(false);
  const [newInstanceExtensionIds, setNewInstanceExtensionIds] = useState<PreinstalledExtensionId[]>([]);
  const [newInstanceLocalZip, setNewInstanceLocalZip] = useState<string | null>(null);
  const [newInstanceError, setNewInstanceError] = useState<string | null>(null);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  // GitHub releases 真实数据
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [fetchingReleases, setFetchingReleases] = useState(false);
  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  // 终端输入
  const [terminalInput, setTerminalInput] = useState("");
  const [terminalInstanceId, setTerminalInstanceId] = useState<string | null>(null);
  const terminalLogTarget = useRef(GLOBAL_LOG_KEY);
  terminalLogTarget.current = instances.find(instance => instance.id === terminalInstanceId)?.installDir
    || terminalInstanceId || GLOBAL_LOG_KEY;
  const setTerminalLogs = useCallback((value: LogLine[] | ((previous: LogLine[]) => LogLine[])) => {
    instanceLogs.update(terminalLogTarget.current, value);
  }, []);
  // 关于页真实数据
  const [aboutInfo, setAboutInfo] = useState<{ version: string; path: string; sizeBytes: number; createdAt: string; status: string } | null>(null);
  // 安全 insets(挖孔避让)
  const [safeInsetTop, setSafeInsetTop] = useState(showcaseSafeTop);
  // APP 设置:下拉刷新
  const [pullToRefresh, setPullToRefreshState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sc_pull_to_refresh") === "true";
    } catch {
      return false;
    }
  });

  const setPullToRefresh = useCallback((enabled: boolean) => {
    setPullToRefreshState(enabled);
    try {
      localStorage.setItem("sc_pull_to_refresh", enabled ? "true" : "false");
    } catch {}
    TarvenEnv.setPullToRefresh({ enabled }).catch(() => {});
  }, []);

  useEffect(() => {
    TarvenEnv.setPullToRefresh({ enabled: pullToRefresh }).catch(() => {});
  }, [pullToRefresh]);
  const [contentOpenMode, setContentOpenMode] = useState<ContentOpenMode>("webview");
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(() => import.meta.env.DEV
    ? {
        currentVersion: APP_VERSION,
        latestVersion: "1.8.3",
        updateAvailable: true,
        releaseUrl: "https://github.com/CAPTCHAAAAA/SillyClient/releases/latest",
      }
    : null);
  const [appUpdateState, setAppUpdateState] = useState<"idle" | "checking" | "current" | "available" | "error">(
    () => import.meta.env.DEV ? "available" : "idle"
  );
  const [updatePromptDismissed, setUpdatePromptDismissed] = useState(false);
  const [updateBannerRight, setUpdateBannerRight] = useState(28);
  const [verDropdownOpen, setVerDropdownOpen] = useState(false);
  const [isVerDropdownClosing, setIsVerDropdownClosing] = useState(false);
  const [verDropdownPos, setVerDropdownPos] = useState({ bottom: 0, left: 0, width: 0, maxHeight: 360 });
  const versionDropdownRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<InstanceCarouselRef>(null);
  const terminalBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const cardMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managePanelOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managePanelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [terminalPos, setTerminalPos] = useState({ left: 16, right: 16 });
  const [isLaunchMinimized, setIsLaunchMinimized] = useState(false);
  const [externallyRenamingId, setExternallyRenamingId] = useState<string | null>(null);

  // 向导模式平滑过渡 (本地 / 远程)
  const wizardLocalRef = useRef<HTMLDivElement>(null);
  const wizardRemoteRef = useRef<HTMLDivElement>(null);
  const [wizardHeight, setWizardHeight] = useState<number | undefined>(undefined);

  // 背景设置模式平滑过渡 (基础 / 自定义)
  const bgDynamicRef = useRef<HTMLDivElement>(null);
  const bgCustomRef = useRef<HTMLDivElement>(null);
  const [bgContentHeight, setBgContentHeight] = useState<number | undefined>(undefined);

  // 下拉刷新启动页
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const touchStartX = useRef(0);
  const isPulling = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 卡片重命名
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [isRenameClosing, setIsRenameClosing] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [isRenamingSaving, setIsRenamingSaving] = useState(false);

  // 数据导入文件 ref
  const importInputRef = useRef<HTMLInputElement>(null);
  // 管理面板 draftConfig/draftPort(保存前不写入 instances)
  const [draftConfig, setDraftConfig] = useState<InstanceConfig>(DEFAULT_CONFIG);
  const [draftPort, setDraftPort] = useState(8000);
  const [draftRemoteAuthEnabled, setDraftRemoteAuthEnabled] = useState(false);
  const [draftRemoteAuthUsername, setDraftRemoteAuthUsername] = useState("");
  const [draftRemoteAuthPassword, setDraftRemoteAuthPassword] = useState("");
  const [storedRemoteAuthUsername, setStoredRemoteAuthUsername] = useState("");
  const [manageSaveError, setManageSaveError] = useState<string | null>(null);
  const [isSavingManagePanel, setIsSavingManagePanel] = useState(false);
  // 清理垃圾
  const [showCleanPanel, setShowCleanPanel] = useState(false);
  const [isCleanPanelClosing, setIsCleanPanelClosing] = useState(false);
  const [garbageItems, setGarbageItems] = useState<GarbageItem[]>([]);
  const [garbageError, setGarbageError] = useState<string | null>(null);
  const [cleaningGarbage, setCleaningGarbage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TavernInstance | null>(null);
  const [isDeletingInstance, setIsDeletingInstance] = useState(false);
  const [deleteInstanceError, setDeleteInstanceError] = useState<string | null>(null);

  const isLight = bgMode === "custom" && themeStyle === "light";
  const isDynamic = bgMode === "dynamic";

  const normalizedManageSearch = manageSearchQuery.trim().toLowerCase();
  const filteredManageInstances = instances.filter(instance => {
    const matchesFilter = manageFilter === "all" || instance.type === manageFilter;
    const haystack = `${instance.name} ${instance.subtitle || ""} ${instance.url || ""}`.toLowerCase();
    return matchesFilter && (!normalizedManageSearch || haystack.includes(normalizedManageSearch));
  });
  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return instances.filter(t => (t.subtitle || t.name).toLowerCase().includes(query));
  }, [instances, searchQuery]);

  const terminalInstance = terminalInstanceId
    ? instances.find(instance => instance.id === terminalInstanceId) || null
    : null;
  const activeInstance = activeSlide > 0 ? instances[activeSlide - 1] || null : null;
  const terminalDisplayTitle = terminalInstance
    ? `${terminalInstance.subtitle || terminalInstance.name} · 实例终端`
    : terminalTitle;
  const terminalDisplayPrompt = terminalInstance
    ? (isWindows ? `${terminalInstance.installDir || terminalInstance.id}>` : "~ $")
    : terminalPrompt;
  const terminalDisplayBanner = terminalInstance
    ? `${terminalInstance.subtitle || terminalInstance.name} · ${terminalInstance.type === "local" ? "本地实例" : "远程实例"}`
    : terminalBanner;
  const terminalDisplayPlaceholder = terminalInstance?.type === "remote"
    ? "远程实例不支持本地终端"
    : terminalInstance
      ? terminalPlaceholder
      : "请先选择实例";

  useEffect(() => () => {
    if (cardMenuCloseTimerRef.current) clearTimeout(cardMenuCloseTimerRef.current);
    if (managePanelOpenTimerRef.current) clearTimeout(managePanelOpenTimerRef.current);
    if (managePanelCloseTimerRef.current) clearTimeout(managePanelCloseTimerRef.current);
    if (renameCloseTimerRef.current) clearTimeout(renameCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isWindows) return;
    TarvenEnv.getContentOpenMode()
      .then(({ mode }) => setContentOpenMode(mode))
      .catch(() => setContentOpenMode("webview"));
  }, [isWindows]);

  const checkForAppUpdate = useCallback(async () => {
    setAppUpdateState("checking");
    try {
      const result = await fetchAppUpdate(APP_VERSION, isWindows ? "windows" : Capacitor.getPlatform() === "ios" ? "ios" : isWeb ? "web" : "android");
      setAppUpdateInfo(result);
      setAppUpdateState(result.updateAvailable ? "available" : "current");
      if (result.updateAvailable) setUpdatePromptDismissed(false);
      return result;
    } catch (error) {
      console.warn("[checkAppUpdate]", error);
      setAppUpdateState("error");
      return null;
    }
  }, [isWindows, isWeb]);

  useEffect(() => {
    if (isShowcase || import.meta.env.DEV) return;
    const timer = window.setTimeout(() => { void checkForAppUpdate(); }, 900);
    return () => window.clearTimeout(timer);
  }, [checkForAppUpdate, isShowcase]);

  useEffect(() => {
    if (appUpdateState !== "available") return;
    const updateRight = () => {
      const el = settingsBtnRef.current;
      if (el) {
        setUpdateBannerRight(Math.max(0, window.innerWidth - el.getBoundingClientRect().right));
      }
    };
    updateRight();
    window.addEventListener("resize", updateRight);
    return () => window.removeEventListener("resize", updateRight);
  }, [appUpdateState]);

  // 支持通过 URL 参数直接唤起向导指定面板 (例如 ?wizard=import 方便本地走查)
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const wizardParam = params.get("wizard") || params.get("mode") || params.get("tab");
        if (wizardParam === "import" || wizardParam === "migration") {
          setNewInstanceMode("import");
          setShowNewInstancePanel(true);
        } else if (wizardParam === "1" || wizardParam === "local") {
          setNewInstanceMode("local");
          setShowNewInstancePanel(true);
        } else if (wizardParam === "remote") {
          setNewInstanceMode("remote");
          setShowNewInstancePanel(true);
        }
        if (import.meta.env.DEV && params.get("nativePreview") === "1" && params.get("maintenance") === "1") {
          const local = instances.find(instance => instance.type === "local");
          if (local) setMaintenanceInstance(local);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 液态玻璃底色:动态模式微偏红,黑夜模式蓝紫,白天模式白色
  const glassBg = isLight
    ? "bg-white/70 border-black/5 shadow-[0_16px_60px_rgba(0,0,0,0.10)]"
    : isDynamic
      ? "bg-[#1c1420]/70 border-white/10 shadow-[0_16px_60px_rgba(0,0,0,0.30)]"
      : "bg-[#0d0d12]/85 border-white/[0.08] shadow-[0_16px_60px_rgba(0,0,0,0.50)]";



  // 自检:启动时扫描本地已存在的酒馆实例,自动添加卡片
  const syncExistingInstances = useCallback(async () => {
    if (isShowcase) return;
    try {
      const { instances: scannedInstances } = await TarvenEnv.scanInstances();
      setInstances(prev => {
        const scannedById = new Map(scannedInstances.map(instance => [instance.instanceId, instance]));
        const updated = prev.map(instance => {
          if (instance.type !== "local") return instance;
          const scannedInstance = scannedById.get(instance.installDir || instance.id);
          if (!scannedInstance) return instance;
          return {
            ...instance,
            version: scannedInstance.version === "unknown" ? instance.version : normalizeStoredVersion(scannedInstance.version),
            installPath: scannedInstance.path || instance.installPath,
            installPathMode: scannedInstance.path ? "exact" as const : instance.installPathMode,
            status: scannedInstance.hasServer ? instance.status : "error" as const,
            createdAt: scannedInstance.createdAt ? formatNativeDate(scannedInstance.createdAt) : instance.createdAt,
            lastUsed: scannedInstance.lastUsedAt ? formatNativeDate(scannedInstance.lastUsedAt) : instance.lastUsed,
            totalUsage: scannedInstance.totalUsageMs !== undefined
              ? formatUsageDuration(scannedInstance.totalUsageMs)
              : instance.totalUsage,
          };
        });
        // 合并:已存在的不重复添加
        const existingIds = new Set(updated.map(t => t.installDir || t.id));
        const scanned = scannedInstances
          .filter(s => !existingIds.has(s.instanceId))
          .map<TavernInstance>(s => ({
            id: `scan-${s.instanceId}`,
            name: "SillyTavern",
            subtitle: s.instanceId,
            version: normalizeStoredVersion(s.version),
            status: s.hasServer ? "stopped" : "error",
            type: "local",
            lastUsed: formatNativeDate(s.lastUsedAt),
            createdAt: formatNativeDate(s.createdAt),
            totalUsage: s.totalUsageMs !== undefined ? formatUsageDuration(s.totalUsageMs)
              : s.sizeBytes > 0 ? `${(s.sizeBytes / 1024 / 1024).toFixed(0)}MB` : "—",
            icon: <Folder className="w-5 h-5" />,
            color: "#9ca3af",
            port: 8000,
            installDir: s.instanceId,
            installPath: s.path,
            installPathMode: s.path ? "exact" : undefined,
            config: { ...DEFAULT_CONFIG },
          }));
        return [...scanned, ...updated];
      });
    } catch { /* 非 Capacitor 环境 */ }
  }, [isShowcase]);

  useEffect(() => {
    syncExistingInstances();
  }, [syncExistingInstances]);

  // 原生进程被系统结束后，持久化的 running 状态可能已经失效。
  useEffect(() => {
    if (isShowcase) return;
    (async () => {
      try {
        const status = await TarvenEnv.getStatus();
        setInstances(prev => prev.map(instance => {
          if (instance.type !== "local" || instance.status === "error") return instance;
          const isActive = status.serverReady
            && !!status.instanceId
            && (instance.installDir || instance.id) === status.instanceId;
          return { ...instance, status: isActive ? "running" : "stopped" };
        }));
      } catch {
        /* 浏览器环境没有原生运行状态。 */
      }
    })();
  }, [isShowcase]);

  // 安全 insets(挖孔避让) — 原生返回物理像素,需除以 devicePixelRatio 转为 CSS 像素
  // 用 useLayoutEffect + 轮询确保 insets 就绪(首次 mount 时可能返回 0)
  useEffect(() => {
    if (isShowcase) return;
    let cancelled = false;
    const fetchInsets = async () => {
      try {
        const insets = await TarvenEnv.getSafeInsets();
        if (cancelled) return;
        const dpr = window.devicePixelRatio || 1;
        const top = Math.round(insets.top / dpr);
        if (top > 0) { setSafeInsetTop(top); return; }
        // 还没就绪,500ms 后重试
        setTimeout(fetchInsets, 500);
      } catch { /* 非 Capacitor 环境 */ }
    };
    fetchInsets();
    return () => { cancelled = true; };
  }, [isShowcase]);

  // 管理面板打开时，立即拉取真实实例数据
  useEffect(() => {
    if (!showManagePanel) return;
    const t = showManagePanel;
    setAboutInfo(null);
    (async () => {
      try {
        if (t.type === "local") {
          const info = await TarvenEnv.getInstanceInfo({
            instanceId: t.installDir || t.id,
            installPath: t.installPath,
            port: t.port ?? 8000,
          });
          setAboutInfo({
            version: info.version,
            path: info.path,
            sizeBytes: info.sizeBytes,
            createdAt: formatNativeDate(info.createdAt),
            status: info.status,
          });
          setInstances(prev => prev.map(instance => instance.id === t.id
            ? {
                ...instance,
                installPath: info.path || instance.installPath,
                installPathMode: info.path ? "exact" : instance.installPathMode,
                createdAt: info.createdAt ? formatNativeDate(info.createdAt) : instance.createdAt,
                lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : instance.lastUsed,
                totalUsage: info.totalUsageMs !== undefined
                  ? formatUsageDuration(info.totalUsageMs)
                  : instance.totalUsage,
              }
            : instance));
        }
      } catch { /* 远程或非 Capacitor */ }
    })();
  }, [showManagePanel]);

  const toggleBgPanel = () => {
    if (showBgPanel) {
      setIsPanelClosing(true);
      setTimeout(() => { setShowBgPanel(false); setIsPanelClosing(false); }, BACKGROUND_PANEL_EXIT_MS);
    } else {
      setShowBgPanel(true);
    }
  };

  const handleWallpaperUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setCustomWallpaperUrl(URL.createObjectURL(file));
  };

  useEffect(() => { document.documentElement.classList.add('dark'); }, []);

  useEffect(() => () => {
    if (themeSmoothingTimer.current !== null) window.clearTimeout(themeSmoothingTimer.current);
  }, []);

  const switchThemeMode = useCallback((apply: () => void) => {
    setThemeSmoothing(true);
    apply();
    if (themeSmoothingTimer.current !== null) window.clearTimeout(themeSmoothingTimer.current);
    themeSmoothingTimer.current = window.setTimeout(() => setThemeSmoothing(false), 1200);
  }, []);

  const switchInstanceMode = useCallback((mode: "local" | "remote" | "import") => {
    if (newInstanceMode === mode) return;
    setNewInstanceMode(mode);
  }, [newInstanceMode]);

  useEffect(() => {
    directoryPickerGeneration.current += 1;
    return () => { directoryPickerGeneration.current += 1; };
  }, [showNewInstancePanel, newInstanceMode, migrationAccessMode]);

  const handleSetNewInstanceDir = useCallback((value: string) => {
    const clean = value.replace(/^["']|["']$/g, "").trim();
    setNewInstanceDir(clean);
    setNewInstancePathMode("exact");
    setNewInstanceError(null);
    directoryPickerGeneration.current += 1;
  }, []);

  const handlePickInstallFolder = useCallback(async () => {
    const generation = ++directoryPickerGeneration.current;
    try {
      const selection = installationSelection(await TarvenEnv.pickDirectory({ purpose: "installation" }));
      if (generation !== directoryPickerGeneration.current) return;
      setNewInstanceDir(selection.path);
      setNewInstancePathMode(selection.mode);
      setNewInstanceError(null);
    } catch (error) {
      if (generation !== directoryPickerGeneration.current) return;
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel/i.test(message)) setNewInstanceError(message);
    }
  }, []);

  const handlePickTargetFolder = useCallback(async () => {
    const generation = ++directoryPickerGeneration.current;
    try {
      if (typeof (window as any).migrationDebug?.choose === "function") {
        const selected = await (window as any).migrationDebug.choose("target");
        if (selected && generation === directoryPickerGeneration.current) {
          const clean = String(selected).trim().replace(/^["']|["']$/g, "").trim();
          setMigrationCustomDest(clean);
          setMigrationTargetPathMode("exact");
          setNewInstanceError(null);
          return;
        }
      }
      const selection = installationSelection(await TarvenEnv.pickDirectory({ purpose: "installation" }));
      if (generation !== directoryPickerGeneration.current) return;
      setMigrationCustomDest(selection.path);
      setMigrationTargetPathMode(selection.mode);
      setNewInstanceError(null);
    } catch (error) {
      if (generation !== directoryPickerGeneration.current) return;
      const message = error instanceof Error ? error.message : String(error);
      if (!/cancel/i.test(message)) setNewInstanceError(message);
    }
  }, []);

  const handlePickSourceFolder = useCallback(async () => {
    const generation = ++directoryPickerGeneration.current;
    try {
      if (typeof (window as any).migrationDebug?.choose === "function") {
        const selected = await (window as any).migrationDebug.choose("source");
        if (selected && generation === directoryPickerGeneration.current) {
          const clean = String(selected).trim().replace(/^["']|["']$/g, "").trim();
          setMigrationSourcePath(clean);
          setNewInstanceError(null);
          return;
        }
      }
      const { path } = await TarvenEnv.pickDirectory({ purpose: "source" });
      if (generation !== directoryPickerGeneration.current) return;
      if (path) {
        const clean = String(path).trim().replace(/^["']|["']$/g, "").trim();
        setMigrationSourcePath(clean);
        setNewInstanceError(null);
      }
    } catch {
      /* 用户取消 */
    }
  }, []);

  const handlePickSourceZip = useCallback(async () => {
    try {
      if (typeof (window as any).migrationDebug?.choose === "function") {
        const selected = await (window as any).migrationDebug.choose("zip");
        if (selected) {
          const clean = String(selected).trim().replace(/^["']|["']$/g, "").trim();
          setMigrationSourcePath(clean);
          setNewInstanceError(null);
          return;
        }
      }
      if (typeof (TarvenEnv as any).pickZipFile === "function") {
        const { path } = await (TarvenEnv as any).pickZipFile();
        if (path) {
          const clean = String(path).trim().replace(/^["']|["']$/g, "").trim();
          setMigrationSourcePath(clean);
          setNewInstanceError(null);
          return;
        }
      }
    } catch {
      /* 用户取消 */
    }
  }, []);

  const handleSetMigrationSourcePath = useCallback((val: string) => {
    setMigrationSourcePath(val);
    setNewInstanceError(null);
    directoryPickerGeneration.current += 1;
  }, []);

  const handleSetMigrationCustomDest = useCallback((val: string) => {
    setMigrationCustomDest(val);
    setMigrationTargetPathMode("exact");
    setNewInstanceError(null);
    directoryPickerGeneration.current += 1;
  }, []);

  // 向导容器自适应平滑高度测量
  useEffect(() => {
    const activeEl = newInstanceMode === "local" ? wizardLocalRef.current : wizardRemoteRef.current;
    if (!activeEl) return;
    setWizardHeight(activeEl.offsetHeight);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === activeEl) {
          setWizardHeight(entry.target.clientHeight || entry.contentRect.height);
        }
      }
    });
    ro.observe(activeEl);
    return () => ro.disconnect();
  }, [newInstanceMode, newInstanceCompanionPresetEnabled, showNewInstancePanel, newRemoteAuthEnabled]);

  // 背景设置容器自适应平滑高度测量
  useEffect(() => {
    const activeEl = bgMode === "dynamic" ? bgDynamicRef.current : bgCustomRef.current;
    if (!activeEl) return;
    setBgContentHeight(activeEl.offsetHeight);

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === activeEl) {
          setBgContentHeight(entry.target.clientHeight || entry.contentRect.height);
        }
      }
    });
    ro.observe(activeEl);
    return () => ro.disconnect();
  }, [bgMode, showBgPanel, customWallpaperUrl]);

  // 背景模式与主题风格持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sillyclient.bgMode", bgMode);
      localStorage.setItem("sillyclient.themeStyle", themeStyle);
    } catch {}
  }, [bgMode, themeStyle]);

  // 实例列表持久化到 localStorage
  useEffect(() => {
    if (!isShowcase && !isDemoPreview) saveInstances(instances);
  }, [instances, isShowcase, isDemoPreview]);

  // 远程实例在线状态检测(用原生 pingUrl 绕过 WebView CORS)
  const checkRemoteStatus = useCallback(async () => {
    const remotes = instances.filter(t => t.type === "remote" && t.url);
    if (remotes.length === 0) return;
    const results = await Promise.all(remotes.map(async (r) => {
      try {
        const res = await TarvenEnv.pingUrl({ url: r.url!, instanceId: r.id });
        return { id: r.id, online: res.online };
      } catch {
        return { id: r.id, online: false };
      }
    }));
    const statusByInstance = new Map<string, TavernInstance["status"]>(
      results.map(r => [r.id, r.online ? "online" as const : "offline" as const])
    );
    setInstances(prev => {
      let changed = false;
      const next = prev.map(t => {
        if (t.type !== "remote") return t;
        const nextStatus = statusByInstance.get(t.id);
        if (!nextStatus || t.status === nextStatus) return t;
        changed = true;
        return { ...t, status: nextStatus };
      });
      return changed ? next : prev;
    });
  }, [instances.filter(t => t.type === "remote").map(t => `${t.id}${t.url}${t.basicAuth?.username || ""}`).join(",")]);

  // 启动时 + 每15s 轮询
  useEffect(() => {
    checkRemoteStatus();
    const interval = setInterval(checkRemoteStatus, 15000);
    return () => clearInterval(interval);
  }, [checkRemoteStatus]);

  // 启动时同步各实例密码保护状态
  useEffect(() => {
    TarvenEnv.listInstancePasswordStatus().then((status) => {
      if (status && typeof status === "object") {
        setInstances((prev) => {
          let changed = false;
          const next = prev.map((inst) => {
            const key = inst.installDir || inst.id;
            const has = Boolean(status[key] || status[inst.id]);
            if (inst.hasPassword !== has) {
              changed = true;
              return { ...inst, hasPassword: has };
            }
            return inst;
          });
          return changed ? next : prev;
        });
      }
    }).catch(() => {});
  }, []);

  const handleUpdateInstancePasswordStatus = useCallback((instanceId: string, hasPassword: boolean) => {
    setInstances((prev) =>
      prev.map((inst) => {
        if (inst.id === instanceId || inst.installDir === instanceId) {
          return { ...inst, hasPassword };
        }
        return inst;
      })
    );
  }, []);

  // 手机桌面级长按拖拽重排持久化
  const handleReorderInstances = useCallback((newInstances: TavernInstance[]) => {
    setInstances(newInstances);
    saveInstances(newInstances);
  }, []);

  // 下拉刷新:触发远程状态检测与本地实例同步
  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(60);
    try {
      await Promise.allSettled([
        checkRemoteStatus(),
        syncExistingInstances(),
      ]);
    } catch { /* ignore */ }
    setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 600);
  }, [checkRemoteStatus, syncExistingInstances]);

  // touch 事件处理:仅当滚动到顶部且开启下拉刷新且无弹窗时触发下拉,整个内容跟随拖拽(iOS 原生风格)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!pullToRefresh || isRefreshing) return;
    // 有弹窗/面板打开时不触发下拉刷新
    if (renamingId || showNewInstancePanel || showManagePanel || activeCardMenu) return;
    // 输入框/文本域/内容可编辑元素不触发下拉刷新
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isPulling.current = true;
  }, [pullToRefresh, isRefreshing, renamingId, showNewInstancePanel, showManagePanel, activeCardMenu]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pullToRefresh || !isPulling.current || isRefreshing) return;
    const deltaY = e.touches[0].clientY - touchStartY.current;
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
    // 垂直手势检测:水平偏移不能超过垂直的 0.6 倍
    if (deltaX > deltaY * 0.6) { isPulling.current = false; setPullDistance(0); return; }
    if (deltaY > 0) {
      e.preventDefault();
      // iOS 风格阻尼:指数衰减,拉得越多阻力越大
      const damped = Math.pow(deltaY, 0.7) * 1.2;
      setPullDistance(Math.min(damped, 120));
    }
  }, [pullToRefresh, isRefreshing]);

  const onTouchEnd = useCallback(() => {
    if (!pullToRefresh) {
      isPulling.current = false;
      setPullDistance(0);
      return;
    }
    if (!isPulling.current) return;
    isPulling.current = false;
    if (pullDistance > 55) {
      handlePullRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullToRefresh, pullDistance, handlePullRefresh]);

  // 监听原生插件事件:日志 / 就绪 / 模式变化
  useEffect(() => {
    if (isShowcase) return;
    let disposed = false;
    const handles: { remove: () => Promise<void> }[] = [];
    const register = async (event: "log" | "progress" | "ready" | "mode", listener: (d: TarvenEvent) => void) => {
      const handle = await TarvenEnv.addListener(event, d => {
        if (!disposed) listener(d);
      });
      if (disposed) await handle.remove();
      else handles.push(handle);
    };
    const append = (d: TarvenEvent, line: LogLine, progress = false) => {
      if (!operations.acceptsGlobal(d)) return;
      const current = operations.current;
      const key = d.instanceId || current?.instanceId || GLOBAL_LOG_KEY;
      instanceLogs.append(key, line, progress);
      if (current?.busy && current.accepts(d)) {
        instanceLogs.append(current.logKey, line, progress);
      }
    };
    (async () => {
      try {
        await register("log", d => {
          const message = d.message || d.line || d.text;
          if (d.source === "command") {
            if (d.instanceId && message) {
              instanceLogs.append(d.instanceId, { msg: message, level: d.level || "info" });
            }
            return;
          }
          if (message) append(d, { msg: message, level: d.level || "info" });
        });
        await register("progress", d => {
          if (d.source === "command") return;
          const percent = d.percent ?? 0;
          const msg = d.stage ? `${d.stage} ${percent}%` : `${percent}%`;
          append(d, { msg, level: "info" }, true);
        });
        await register("ready", d => {
          if (d.source === "command") return;
          if (d.ready !== false) append(d, { msg: `✓ 就绪${d.url ? " " + d.url : ""}`, level: "success" });
        });
        await register("mode", d => {
          if (d.source === "command") return;
          if (!d.instanceId || !operations.acceptsGlobal(d)) return;
          if (d.mode === "launcher" && d.tavernRunning === true && d.instanceId) {
            setInstances(prev => prev.map(instance => (instance.type === "local" && (instance.installDir || instance.id) === d.instanceId)
              ? { ...instance, status: "running", pendingTavernGestureHint: undefined }
              : instance));
          }
          // 只有 tavernRunning=false（实例真正关闭）时才置 stopped
          // tavernRunning=true（手势退出）时实例还在跑，不改变状态
          if (d.mode === "launcher" && d.tavernRunning === false) {
            setInstances(prev => prev.map(t => {
              if (t.type !== "local") return t;
              const isStoppedInstance = (t.installDir || t.id) === d.instanceId;
              if (!isStoppedInstance) return t;
              return {
                ...t,
                status: t.status === "running" ? "stopped" : t.status,
                lastUsed: isStoppedInstance && d.lastUsedAt ? formatNativeDate(d.lastUsedAt) : t.lastUsed,
                totalUsage: isStoppedInstance && d.totalUsageMs !== undefined
                  ? formatUsageDuration(d.totalUsageMs)
                  : t.totalUsage,
              };
            }));
          }
        });
      } catch { /* 非 Capacitor 原生环境,忽略 */ }
    })();
    return () => {
      disposed = true;
      for (const handle of handles) void handle.remove();
    };
  }, [isShowcase, operations]);

  useEffect(() => () => { operations.cancel(); }, [operations]);

  // 配置并启动本地实例。创建流程只在确认服务可访问后写入卡片。
  const doLaunch = useCallback(async (instance: TavernInstance, operation: OperationContext, enterWhenReady = true) => {
    operation.assertCurrent();
    const port = instance.port ?? 8000;
    const instanceId = instance.installDir || instance.id;
    const version = instance.version || "stable";
    const config = instance.config ?? DEFAULT_CONFIG;
    const zipballUrl = instance.zipballUrl;
    const localZipPath = instance.localZipPath;
    const installPath = instance.installPath;
    const companionPreset = instance.companionPreset;
    const preinstall = instance.preinstall;

    setLaunchProgress({ pct: 0, text: "初始化" });
    setLaunchError(null);
    setLaunchLogs([{ msg: `启动 ${instance.name} (${instance.type})`, level: "info" }]);
    setLaunchLogs(prev => [...prev, { msg: `准备 Node 环境 [${instanceId}] :${port}`, level: "info" }]);

    if (isWeb) {
      for (let p = 25; p <= 75; p += 25) {
        await operation.delay(200);
        setLaunchProgress({ pct: p, text: `准备启动服务 (${p}%)` });
        setLaunchLogs(prev => [...prev, { msg: `服务就绪进度 ${p}%`, level: "info" }]);
      }
      await operation.delay(200);
      setLaunchProgress({ pct: 100, text: "实例已就绪" });
      setLaunchLogs(prev => [...prev, { msg: "服务已就绪 (浏览器演示)", level: "success" }]);
      return { url: "http://127.0.0.1:8000/", port: 8000 };
    }

    // 注册事件监听
    let readyReceived = false;
    let errorMsg: string | null = null;
    let resolvedPort = port;
    let resolvedUrl = `http://127.0.0.1:${port}/`;
      await operation.listen(TarvenEnv.addListener("progress", d => {
        if (d.source === "command" || !operation.accepts(d)) return;
        const pct = d.percent ?? 0;
        const text = formatOperationStage(d.stage, pct);
        setLaunchProgress(previous => {
          if (previous?.pct === pct && previous.text === text) return previous;
          return { pct, text };
        });
      }));

      await operation.listen(TarvenEnv.addListener("error", d => {
        if (d.source === "command" || !operation.accepts(d)) return;
        errorMsg = d.message || "未知错误";
      }));

      await operation.listen(TarvenEnv.addListener("ready", d => {
        if (d.source === "command" || !operation.accepts(d) || readyReceived) return;
        if (d.ready !== false) {
          readyReceived = true;
          if (d.port) resolvedPort = d.port;
          if (d.url) resolvedUrl = d.url.endsWith("/") ? d.url : `${d.url}/`;
        }
      }));

      // 调用原生 provision
      const provisionResult = await operation.wait(TarvenEnv.provisionAndStart({
        port, instanceId, operationId: operation.id, version, zipballUrl, localZipPath,
        installPath, installPathMode: instance.installPathMode, companionPreset, preinstall, config,
      }));
      if (provisionResult?.ready === false) {
        throw new Error(errorMsg || "实例未能启动，请检查安装日志");
      }
      if (provisionResult?.ready === true) readyReceived = true;

      const deadline = Date.now() + 600000;
      while (!readyReceived && !errorMsg && Date.now() < deadline) {
        await operation.delay(500);
        if (readyReceived || errorMsg) break;
        try {
          const status = await operation.wait(TarvenEnv.getStatus());
          if (status.serverReady && operation.accepts(status)) {
            readyReceived = true;
            if (status.url) resolvedUrl = status.url.endsWith("/") ? status.url : `${status.url}/`;
          }
        } catch (error) {
          if (error instanceof OperationCancelledError) throw error;
        }
      }
      operation.assertCurrent();

      if (errorMsg) {
        throw new Error(errorMsg);
      }

      if (!readyReceived) {
        throw new Error("超时：下载/安装超过 10 分钟，检查网络后重试");
      }

      setLaunchProgress({ pct: 100, text: enterWhenReady ? "实例已就绪" : "创建完成，可以运行" });
      setLaunchLogs(prev => [...prev, {
        msg: enterWhenReady ? "服务就绪，进入沉浸式" : "服务可访问，实例创建完成",
        level: "success",
      }]);
      if (enterWhenReady) {
        await operation.wait(TarvenEnv.enterImmersive({
          url: resolvedUrl,
          instanceId,
          showGestureHint: instance.pendingTavernGestureHint === true,
        }));
      }
      return { url: resolvedUrl, port: resolvedPort };
  }, [isWeb, setLaunchLogs]);

  const openRemoteInstance = useCallback(async (instance: TavernInstance, operation: OperationContext) => {
    const url = instance.url || "http://127.0.0.1:8000";
    setLaunchLogs([{ msg: `检查 ${url}`, level: "info" }]);
    setLaunchProgress({ pct: 25, text: "正在验证远程连接" });
    const result = await operation.wait(TarvenEnv.pingUrl({ url, instanceId: instance.id }));
    if (!result.online) {
      throw new Error(result.error || "远程实例当前不可访问");
    }

    setLaunchLogs(prev => [...prev, {
      msg: instance.basicAuth ? "远程认证已确认" : "远程实例连接正常",
      level: instance.basicAuth ? "info" : "success",
    }]);
    if (contentOpenMode === "browser" && instance.basicAuth) {
      setLaunchLogs(prev => [...prev, { msg: "系统浏览器可能会再次请求账号和密码", level: "info" }]);
    }
    setLaunchProgress({ pct: 75, text: "正在打开远程实例" });
    await operation.wait(TarvenEnv.enterImmersive({
      url,
      instanceId: instance.id,
      showGestureHint: instance.pendingTavernGestureHint === true,
    }));
    setLaunchProgress({ pct: 100, text: "远程实例已打开" });
  }, [contentOpenMode, setLaunchLogs]);

  // 启动实例直接执行入口 (跳过密码阻断，在已完成密码校验或无密码时调用)
  const launchTavernDirect = useCallback(async (instance: TavernInstance) => {
    if (operations.busy) return;
    const operation = operations.begin(instance.installDir || instance.id, "launch");
    lastMigration.current = null;
    setLaunchLogKey(operation.logKey);
    setLaunchingId(instance.id);
    if (instance.type === "local") {
      setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "running" } : t));
    }
    setShowLaunchPanel(true);
    setOperationPurpose("launch");
    setLastLaunchParams(instance);
    try {
      if (instance.type === "local") {
        const result = await doLaunch(instance, operation);
        const info = await operation.wait(TarvenEnv.getInstanceInfo({
          instanceId: instance.installDir || instance.id,
          installPath: instance.installPathMode === "root" ? undefined : instance.installPath,
          port: result.port,
        }));
        setInstances(prev => prev.map(t => t.id === instance.id ? {
          ...t,
          status: "running",
          port: result.port,
          version: info.version && info.version !== "unknown" ? normalizeStoredVersion(info.version) : t.version,
          installPath: info.path || t.installPath,
          installPathMode: info.path ? "exact" : t.installPathMode,
          createdAt: info.createdAt ? formatNativeDate(info.createdAt) : t.createdAt,
          lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : t.lastUsed,
          totalUsage: info.totalUsageMs !== undefined ? formatUsageDuration(info.totalUsageMs) : t.totalUsage,
        } : t));
        operation.schedule(() => {
          setIsLaunchPanelClosing(true);
          operation.schedule(() => {
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setLaunchProgress(null);
          }, PANEL_EXIT_MS);
        }, 800);
      } else {
        await openRemoteInstance(instance, operation);
        setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "online" } : t));
        operation.schedule(() => {
          setIsLaunchPanelClosing(true);
          operation.schedule(() => {
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setLaunchProgress(null);
          }, PANEL_EXIT_MS);
        }, 500);
      }
    } catch (err: any) {
      if (!operation.isCurrent || err instanceof OperationCancelledError) return;
      const msg = err?.message || String(err);
      setLaunchError(msg);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `失败: ${msg}`, level: "error" }]);
      setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "error" } : t));
      try { await operation.wait(TarvenEnv.exitImmersive()); } catch {}
    } finally {
      if (operation.isCurrent) {
        operation.finish();
        setLaunchingId(null);
      }
    }
  }, [operations, doLaunch, openRemoteInstance, setLaunchLogs]);

  // 启动实例入口 (含访问密码保险开关拦截)
  const launchTavern = useCallback(async (instance: TavernInstance) => {
    if (instance.hasPassword && instance.status !== "running" && instance.status !== "online") {
      setUnlockingInstance(instance);
      setIsUnlockModalOpen(true);
      return;
    }
    await launchTavernDirect(instance);
  }, [launchTavernDirect]);

  // 返回酒馆会话（无缝唤醒后台保活的酒馆 WebView）
  const handleReturnToTavern = useCallback(async (instance: TavernInstance) => {
    const expected = operations.current;
    try {
      if (expected) await expected.wait(TarvenEnv.returnToTavern());
      else await TarvenEnv.returnToTavern();
    } catch (error) {
      if (error instanceof OperationCancelledError || operations.current !== expected) return;
      // 容错或浏览器环境 fallback
      await launchTavern(instance);
    }
  }, [launchTavern, operations]);

  // 直接停止/关闭实例（就地停止进程并解除运行态）
  const handleStopInstance = useCallback(async (instance: TavernInstance) => {
    const instanceId = instance.installDir || instance.id;
    const cancelled = operations.cancel(instanceId);
    const remainingOperation = operations.current;
    if (cancelled) {
      setLaunchingId(null);
      setIsCreatingInstance(false);
      setLaunchProgress(null);
    }
    try {
      await TarvenEnv.closeTavern({ instanceId, operationId: cancelled?.id });
    } catch (error) {
      instanceLogs.append(instanceId, { msg: `停止失败: ${error instanceof Error ? error.message : String(error)}`, level: "error" });
      return;
    }
    if (operations.current !== remainingOperation) return;
    setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "stopped" } : t));
    setIsLaunchMinimized(false);
  }, [operations]);

  const provisionCreatedInstance = useCallback(async (instance: TavernInstance, operation: OperationContext) => {
    if (isWeb) {
      for (let p = 20; p <= 80; p += 20) {
        await operation.delay(200);
        setLaunchProgress({ pct: p, text: `正在安装组件... (${p}%)` });
        setLaunchLogs(prev => [...prev, { msg: `安装进度 ${p}%`, level: "info" }]);
      }
      await operation.delay(250);
      setLaunchProgress({ pct: 100, text: "创建完成，可以运行" });
      setLaunchLogs(prev => [...prev, { msg: "服务可访问，实例创建完成", level: "success" }]);
      setInstances(prev => prev.some(t => t.id === instance.id) ? prev : [...prev, { ...instance, status: "running" }]);
      return;
    }

    if (instance.type === "remote") {
      const url = instance.url || "";
      setLaunchProgress({ pct: 20, text: "正在检查远程连接" });
      setLaunchLogs([{ msg: `检查 ${url}`, level: "info" }]);
      const result = await operation.wait(TarvenEnv.pingUrl({ url, instanceId: instance.id }));
      if (!result.online) throw new Error(result.error || "远程实例当前不可访问");
      setLaunchProgress({ pct: 100, text: "连接可用，创建完成" });
      setLaunchLogs(prev => [...prev, {
        msg: instance.basicAuth ? "远程认证已确认" : "远程实例连接正常",
        level: instance.basicAuth ? "info" : "success",
      }]);
      setInstances(prev => prev.some(t => t.id === instance.id) ? prev : [...prev, { ...instance, status: "online" }]);
      return;
    }

    const result = await doLaunch(instance, operation, false);
    const info = await operation.wait(TarvenEnv.getInstanceInfo({
      instanceId: instance.installDir || instance.id,
      installPath: instance.installPathMode === "root" ? undefined : instance.installPath,
      port: result.port,
    }));
    if (!info.path) throw new Error("原生未确认实例的实际安装目录，创建未完成");
    setLastLaunchParams({ ...instance, installPath: info.path, installPathMode: "exact", port: result.port });
    setInstances(prev => prev.some(t => t.id === instance.id)
      ? prev
      : [...prev, {
          ...instance,
          status: "running",
          port: result.port,
          version: info.version && info.version !== "unknown" ? normalizeStoredVersion(info.version) : instance.version,
          installPath: info.path || instance.installPath,
          installPathMode: "exact",
          createdAt: info.createdAt ? formatNativeDate(info.createdAt) : instance.createdAt,
          lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : instance.lastUsed,
          totalUsage: info.totalUsageMs !== undefined ? formatUsageDuration(info.totalUsageMs) : instance.totalUsage,
        }]);
  }, [doLaunch, isWeb, setLaunchLogs]);

  const migrateCreatedInstance = useCallback(async (
    instance: TavernInstance,
    options: Parameters<typeof TarvenEnv.migrateInstance>[0],
    operation: OperationContext,
  ) => {
    operation.assertCurrent();
    setLaunchProgress({ pct: 20, text: "正在预检旧酒馆目录结构与数据完整性..." });
    setLaunchLogs([{ msg: `【数据迁移】开始${options.mode === "takeover" ? "原地接管" : "复制迁移"}: ${options.sourcePath}`, level: "info" }]);
    const result = await operation.wait(TarvenEnv.migrateInstance({ ...options, operationId: operation.id }));
    if (result?.success !== true) throw new Error("数据迁移未成功，请检查来源文件是否完整");
    const finalInstance = {
      ...instance,
      installPath: result.targetPath || options.targetPath || (options.mode === "takeover" ? options.sourcePath : instance.installPath),
      installPathMode: "exact" as const,
    };
    setLastLaunchParams(finalInstance);
    setLaunchProgress({ pct: 100, text: "数据迁移完成，实例已注册" });
    setLaunchLogs(prev => [...prev, {
      msg: options.mode === "takeover" ? "【成功】已原地接管目录，可随时启动运行。" : "【成功】旧酒馆数据复制迁移完成，可随时启动运行。",
      level: "success",
    }]);
    setInstances(prev => prev.some(item => item.id === finalInstance.id) ? prev : [finalInstance, ...prev]);
  }, [setLaunchLogs]);

  const createInstance = useCallback(async () => {
    if (operations.busy) return;
    const now = Date.now();
    const rawGivenName = newInstanceName.trim();
    let instanceDisplayName: string;
    let safeCandidateId: string;

    if (rawGivenName) {
      // 严格检查重名：不允许创建同名实例
      const isDuplicate = instances.some(i =>
        (i.subtitle || i.name).trim().toLowerCase() === rawGivenName.toLowerCase() ||
        i.id.toLowerCase() === rawGivenName.toLowerCase()
      );
      if (isDuplicate) {
        setNewInstanceError(`已存在名为「${rawGivenName}」的实例，请使用其他名称`);
        return;
      }
      instanceDisplayName = rawGivenName;
      safeCandidateId = sanitizeFolderName(rawGivenName);
    } else {
      // 未输入名称时自动编号：新实例、新实例 (2)、新实例 (3)...
      const baseName = "新实例";
      let chosenName = baseName;
      let counter = 2;
      const existingNames = new Set(
        instances.map(i => (i.subtitle || i.name).trim().toLowerCase())
      );
      while (existingNames.has(chosenName.toLowerCase())) {
        chosenName = `${baseName} (${counter++})`;
      }
      instanceDisplayName = chosenName;
      safeCandidateId = sanitizeFolderName(chosenName);
    }

    let candidateId = safeCandidateId;
    let counter = 2;
    const existingIds = new Set(instances.map(i => (i.installDir || i.id).toLowerCase()));
    while (existingIds.has(candidateId.toLowerCase())) {
      candidateId = `${safeCandidateId} (${counter++})`;
    }
    const instanceId = candidateId;
    const operation = operations.begin(instanceId, "create");
    lastMigration.current = null;
    setNewInstanceError(null);
    setIsCreatingInstance(true);
    let operationStarted = false;
    let remoteCredentialsSaved = false;
    let pendingInstanceId: string | null = null;

    try {
      const installDir = instanceId;
      pendingInstanceId = instanceId;
      const customParentDir = cleanInstallPath(newInstanceDir);
      let resolvedCustomPath: string | undefined = undefined;
      if (customParentDir) {
        // 统一在指定父目录下生成以实例名命名的子文件夹
        resolvedCustomPath = buildInstanceSubfolder(customParentDir, instanceDisplayName);
      }
      let selectedVersion = newInstanceVersion;
      let selectedZipballUrl: string | undefined;

      if (newInstanceMode === "local" && !newInstanceLocalZip) {
        let availableReleases = releases;
        if (availableReleases.length === 0) {
          try {
            const response = await operation.wait(TarvenEnv.fetchReleases());
            availableReleases = response.releases || [];
            setReleases(availableReleases);
          } catch (error) {
            if (error instanceof OperationCancelledError) throw error;
            availableReleases = [{ tag: "1.12.0", prerelease: false, zipballUrl: "" }];
            setReleases(availableReleases);
          }
        }
        const selectedRelease = selectedVersion === "stable"
          ? availableReleases.find(release => !release.prerelease) || availableReleases[0]
          : availableReleases.find(release => release.tag === selectedVersion) || availableReleases[0];
        if (!selectedRelease && !isWeb) throw new Error("无法获取当前 SillyTavern 版本，请检查网络后重试");
        selectedVersion = selectedRelease?.tag || "1.12.0";
        selectedZipballUrl = selectedRelease?.zipballUrl;
      }

      let port = 8000;
      const occupiedPorts = new Set(instances.filter(t => t.type === "local").map(t => t.port ?? 8000));
      while (occupiedPorts.has(port)) port += 1;

      let remoteUrl = newInstanceUrl.trim();
      if (newInstanceMode === "remote") {
        const parsed = new URL(remoteUrl);
        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("连接地址必须使用 HTTP 或 HTTPS");
        if (parsed.username || parsed.password) {
          throw new Error("请不要把账号密码写入连接地址，改用下方的 Basic Auth 配置");
        }
        remoteUrl = parsed.toString();
        if (newRemoteAuthEnabled) {
          if (!newRemoteAuthUsername.trim()) throw new Error("请输入 Basic Auth 用户名");
          if (!newRemoteAuthPassword) throw new Error("请输入 Basic Auth 密码");
        }
        const preflight = await operation.wait(TarvenEnv.pingUrl({
          url: remoteUrl,
          ...(newRemoteAuthEnabled
            ? { username: newRemoteAuthUsername.trim(), password: newRemoteAuthPassword }
            : {}),
        }));
        if (!preflight.online) throw new Error(preflight.error || "远程实例当前不可访问");
      }

      const cleanSourcePath = migrationSourcePath.trim().replace(/^["']|["']$/g, "").trim();
      let cleanCustomDest: string | undefined = undefined;
      if (newInstanceMode === "import") {
        if (!cleanSourcePath) {
          throw new Error("请选择或输入旧酒馆文件夹或 ZIP 备份包路径");
        }
        if (migrationAccessMode === "takeover") {
          cleanCustomDest = cleanSourcePath;
        } else {
          const rawDest = cleanInstallPath(migrationCustomDest);
          if (rawDest) {
            cleanCustomDest = buildInstanceSubfolder(rawDest, instanceDisplayName);
          }
        }
      }

      const effectiveInstallPath = newInstanceMode === "import"
        ? cleanCustomDest
        : (resolvedCustomPath || undefined);

      // 物理防覆盖预检：非原地接管模式下，目标目录不能与已有本地实例冲突
      if (effectiveInstallPath && (newInstanceMode !== "import" || migrationAccessMode !== "takeover")) {
        const normTarget = effectiveInstallPath.toLowerCase().replace(/[\\/]+$/, "");
        const conflictingInstance = instances.find(inst => {
          if (inst.type !== "local" || !inst.installPath) return false;
          return inst.installPath.toLowerCase().replace(/[\\/]+$/, "") === normTarget;
        });
        if (conflictingInstance) {
          throw new Error(`目标路径「${effectiveInstallPath}」已被实例「${conflictingInstance.subtitle || conflictingInstance.name}」使用，无法重复创建`);
        }
      }

      const allowPreinstall = newInstanceMode === "local"
        || (newInstanceMode === "import" && migrationAccessMode === "copy");

      const instance: TavernInstance = {
        id: instanceId,
        name: "SillyTavern",
        subtitle: newInstanceMode === "import"
          ? (migrationAccessMode === "takeover" ? (rawGivenName || "原地接管酒馆") : (rawGivenName || "已迁移酒馆"))
          : instanceDisplayName,
        version: newInstanceMode === "import"
          ? "local"
          : (newInstanceLocalZip ? "local" : normalizeStoredVersion(selectedVersion)),
        type: newInstanceMode === "remote" ? "remote" : "local",
        status: newInstanceMode === "remote" ? "offline" : "stopped",
        icon: newInstanceMode === "remote" ? <Cloud className="w-5 h-5" /> : <Folder className="w-5 h-5" />,
        color: newInstanceMode === "import" ? "#e11d48" : "#6366f1",
        createdAt: new Date().toISOString().slice(0, 10),
        lastUsed: "—",
        totalUsage: "0s",
        pendingTavernGestureHint: isAndroid || undefined,
        ...(newInstanceMode === "remote"
          ? {
              url: remoteUrl,
              basicAuth: newRemoteAuthEnabled
                ? { username: newRemoteAuthUsername.trim() }
                : undefined,
            }
          : {
              port,
              installDir,
              installPath: effectiveInstallPath,
              installPathMode: "exact" as const,
              zipballUrl: selectedZipballUrl,
              localZipPath: newInstanceLocalZip || undefined,
              companionPreset: allowPreinstall && newInstanceCompanionPresetEnabled ? SC_BORDEAUX_PRESET : undefined,
              preinstall: allowPreinstall && newInstanceExtensionIds.length > 0
                ? { revision: 1, extensionIds: [...newInstanceExtensionIds] }
                : undefined,
              config: { ...DEFAULT_CONFIG },
            }),
      };

      if (newInstanceMode === "remote" && newRemoteAuthEnabled) {
        const credentialWrite = TarvenEnv.setRemoteBasicAuth({
          instanceId,
          username: newRemoteAuthUsername.trim(),
          password: newRemoteAuthPassword,
        }).then(result => {
          if (!operation.isCurrent) {
            void TarvenEnv.clearRemoteBasicAuth({ instanceId }).catch(() => {});
          }
          return result;
        });
        await operation.wait(credentialWrite);
        remoteCredentialsSaved = true;
      }

      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      setVerDropdownOpen(false);
      setOperationPurpose("create");
      setLastLaunchParams(instance);
      setLaunchLogKey(operation.logKey);
      setShowLaunchPanel(true);
      setLaunchError(null);
      setLaunchProgress({
        pct: 0,
        text: newInstanceMode === "import"
          ? (migrationAccessMode === "takeover" ? "准备原地接管旧酒馆..." : "准备执行数据迁移...")
          : newInstanceMode === "local"
          ? "准备下载当前版本"
          : "准备检查连接"
      });
      setLaunchingId(instance.id);
      operationStarted = true;

      if (newInstanceMode === "import") {
        lastMigration.current = {
          sourcePath: cleanSourcePath,
          targetPath: migrationAccessMode === "copy" ? (effectiveInstallPath || undefined) : undefined,
          instanceId: instance.installDir || instance.id,
          mode: migrationAccessMode,
          includeSecrets: migrationIncludeSecrets,
          preinstall: instance.preinstall,
        };
        await migrateCreatedInstance(instance, lastMigration.current, operation);
        setNewInstanceName("");
        setMigrationSourcePath("");
        setMigrationCustomDest("");
        setMigrationTargetPathMode("exact");
        setNewInstanceExtensionIds([]);
        setNewInstanceCompanionPresetEnabled(false);
        return;
      }

      await provisionCreatedInstance(instance, operation);
      setNewInstanceName("");
      setNewInstanceDir("");
      setNewInstancePathMode("exact");
      setNewInstanceUrl("http://");
      setNewRemoteAuthEnabled(false);
      setNewRemoteAuthUsername("");
      setNewRemoteAuthPassword("");
      setNewInstanceVersion("stable");
      setNewInstanceCompanionPresetEnabled(false);
      setNewInstanceExtensionIds([]);
      setNewInstanceLocalZip(null);
    } catch (err: any) {
      if (!operation.isCurrent || err instanceof OperationCancelledError) return;
      const message = err?.message || String(err);
      if (!operationStarted) {
        if (remoteCredentialsSaved && pendingInstanceId) {
          try { await operation.wait(TarvenEnv.clearRemoteBasicAuth({ instanceId: pendingInstanceId })); } catch {}
          if (!operation.isCurrent) return;
        }
        setNewInstanceError(message);
      } else {
        setLaunchError(message);
        setLaunchProgress(null);
        setLaunchLogs(prev => [...prev, { msg: `创建失败: ${message}`, level: "error" }]);
      }
    } finally {
      if (operation.isCurrent) {
        operation.finish();
        setLaunchingId(null);
        setIsCreatingInstance(false);
      }
    }
  }, [
    instances,
    isAndroid,
    isWeb,
    operations,
    newInstanceDir,
    newInstancePathMode,
    newInstanceCompanionPresetEnabled,
    newInstanceExtensionIds,
    newInstanceLocalZip,
    newInstanceMode,
    newInstanceName,
    newInstanceUrl,
    newInstanceVersion,
    newRemoteAuthEnabled,
    newRemoteAuthPassword,
    newRemoteAuthUsername,
    migrationAccessMode,
    migrationSourcePath,
    migrationCustomDest,
    migrationTargetPathMode,
    migrationIncludeSecrets,
    provisionCreatedInstance,
    migrateCreatedInstance,
    setLaunchLogs,
    releases,
  ]);

  // 重试当前操作
  const retryLaunch = useCallback(async () => {
    if (!lastLaunchParams || operations.busy) return;
    const operation = operations.begin(lastLaunchParams.installDir || lastLaunchParams.id, operationPurpose);
    setLaunchLogKey(operation.logKey);
    setLaunchError(null);
    setLaunchProgress({ pct: 0, text: operationPurpose === "create" ? "重新创建" : "重新启动" });
    if (operationPurpose === "launch" && lastLaunchParams.type === "local") {
      setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running" } : t));
    }
    setLaunchingId(lastLaunchParams.id);
    try {
      if (operationPurpose === "create") {
        if (lastMigration.current) {
          await migrateCreatedInstance(lastLaunchParams, lastMigration.current, operation);
        } else {
          await provisionCreatedInstance(lastLaunchParams, operation);
        }
      } else if (lastLaunchParams.type === "remote") {
        await openRemoteInstance(lastLaunchParams, operation);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "online" } : t));
        operation.schedule(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 500);
      } else {
        const result = await doLaunch(lastLaunchParams, operation);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running", port: result.port } : t));
        operation.schedule(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 800);
      }
    } catch (err: any) {
      if (!operation.isCurrent || err instanceof OperationCancelledError) return;
      const msg = err?.message || String(err);
      setLaunchError(msg);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `重试失败: ${msg}`, level: "error" }]);
      if (operationPurpose === "launch") {
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "error" } : t));
      }
    } finally {
      if (operation.isCurrent) {
        operation.finish();
        setLaunchingId(null);
      }
    }
  }, [lastLaunchParams, operationPurpose, doLaunch, openRemoteInstance, provisionCreatedInstance, migrateCreatedInstance, operations, setLaunchLogs]);

  /** 终端拖拽调整大小(同时支持鼠标与触屏)。 */
  const startResize = (clientX: number, clientY: number) => {
    const startX = clientX;
    const startY = clientY;
    const startW = terminalSize.w;
    const startH = terminalSize.h;
    const onMove = (mx: number, my: number) => {
      const newW = Math.min(Math.max(startW + mx - startX, 320), window.innerWidth - 32);
      const newH = Math.min(Math.max(startH + my - startY, 200), window.innerHeight - 112);
      setTerminalSize({ w: newW, h: newH });
    };
    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY);
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    const onTouchMove = (ev: TouchEvent) => { const t = ev.touches[0]; onMove(t.clientX, t.clientY); };
    const onTouchEnd = () => {
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'se-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
  };

  const getStatusText = (status: TavernInstance["status"]) => {
    switch (status) {
      case "running": return "运行中";
      case "stopped": return "已停止";
      case "error": return "错误";
      case "online": return "在线";
      case "offline": return "离线";
    }
  };

  const closeCardMenu = useCallback(() => {
    if (cardMenuCloseTimerRef.current) clearTimeout(cardMenuCloseTimerRef.current);
    setIsCardMenuClosing(true);
    cardMenuCloseTimerRef.current = setTimeout(() => {
      setActiveCardMenu(null);
      setIsCardMenuClosing(false);
      cardMenuCloseTimerRef.current = null;
    }, POPOVER_EXIT_MS);
  }, []);

  const pickInstanceCover = useCallback(async (instance: TavernInstance) => {
    try {
      const result = await TarvenEnv.pickImage({ instanceId: instance.installDir || instance.id });
      if (!result?.path) return;
      const coverUrl = isWindows
        ? result.url
        : Capacitor.isNativePlatform()
        ? Capacitor.convertFileSrc(result.path)
        : result.path;
      if (!coverUrl) throw new Error("原生端返回了无效的插图路径");
      const nextCover = `${coverUrl}?t=${Date.now()}`;
      setInstances(prev => prev.map(t => t.id === instance.id
        ? { ...t, cover: nextCover }
        : t));
      setShowManagePanel(current => current?.id === instance.id
        ? { ...current, cover: nextCover }
        : current);
    } catch (err) {
      console.error("[pickImage]", err);
    }
  }, [isWindows]);

  const closeRenameDialog = useCallback(() => {
    if (!renamingId || isRenameClosing) return;
    if (renameCloseTimerRef.current) clearTimeout(renameCloseTimerRef.current);
    setIsRenameClosing(true);
    renameCloseTimerRef.current = setTimeout(() => {
      setRenamingId(null);
      setRenameValue("");
      setRenameError(null);
      setIsRenameClosing(false);
      renameCloseTimerRef.current = null;
    }, PANEL_EXIT_MS);
  }, [isRenameClosing, renamingId]);

  const executeRenameInstance = useCallback(async (instanceId: string, newName: string): Promise<boolean> => {
    const trimmed = newName.trim();
    if (!trimmed) return false;

    const target = instances.find(inst => inst.id === instanceId);
    if (!target) return false;

    // 如果名称没有发生改变，直接返回成功
    if (trimmed === (target.subtitle || target.name)) {
      return true;
    }

    // 远程实例无本地文件系统目录，仅更新显示名称
    if (target.type === "remote") {
      setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, name: trimmed, subtitle: trimmed } : inst));
      setShowManagePanel(prev => prev && prev.id === instanceId ? { ...prev, name: trimmed, subtitle: trimmed } : prev);
      return true;
    }

    // 严密保护：如果实例正在运行，无法安全重命名底层文件夹
    if (target.status === "running") {
      throw new Error("实例正在运行中，请先停止实例再执行重命名！");
    }

    const res = await TarvenEnv.renameInstance({
      instanceId: target.installDir || target.id,
      newName: trimmed,
      installPath: target.installPath,
    });

    if (res && res.success) {
      setInstances(prev => prev.map(inst => {
        if (inst.id === instanceId || inst.installDir === instanceId) {
          return {
            ...inst,
            id: res.newId,
            name: trimmed,
            subtitle: trimmed,
            installDir: res.newId,
            installPath: res.newPath,
          };
        }
        return inst;
      }));

      setShowManagePanel(prev => {
        if (prev && (prev.id === instanceId || prev.installDir === instanceId)) {
          return {
            ...prev,
            id: res.newId,
            name: trimmed,
            subtitle: trimmed,
            installDir: res.newId,
            installPath: res.newPath,
          };
        }
        return prev;
      });

      return true;
    }

    return false;
  }, [instances]);

  const openInstanceTerminal = useCallback((instance: TavernInstance) => {
    setTerminalInstanceId(instance.id);
    instanceLogs.append(instance.installDir || instance.id, {
      msg: `${instance.subtitle || instance.name} · 实例终端${instance.type === "remote" ? "（远程实例不支持本地命令）" : ""}`,
      level: "info",
    });
    setTerminalInput("");
    setIsTerminalClosing(false);
    setShowTerminal(true);
  }, []);

  const openManagePanel = useCallback((instance: TavernInstance) => {
    if (managePanelOpenTimerRef.current) {
      clearTimeout(managePanelOpenTimerRef.current);
      managePanelOpenTimerRef.current = null;
    }
    if (managePanelCloseTimerRef.current) {
      clearTimeout(managePanelCloseTimerRef.current);
      managePanelCloseTimerRef.current = null;
      setShowManagePanel(null);
    }
    if (cardMenuCloseTimerRef.current) clearTimeout(cardMenuCloseTimerRef.current);

    setIsManagePanelClosing(false);
    setManageTab("launch");
    setManageSearchQuery("");
    setManageFilter("all");
    setManageMoreOpen(false);
    setTerminalInstanceId(instance.id);
    setIsCardMenuClosing(true);

    cardMenuCloseTimerRef.current = setTimeout(() => {
      setActiveCardMenu(null);
      setIsCardMenuClosing(false);
      cardMenuCloseTimerRef.current = null;

      // Let WebView release the popover's backdrop layer before mounting the larger panel.
      managePanelOpenTimerRef.current = setTimeout(() => {
        setShowManagePanel(instance);
        managePanelOpenTimerRef.current = null;
      }, MANAGE_PANEL_OPEN_GAP_MS);
    }, POPOVER_EXIT_MS);
  }, []);

  const closeVersionDropdown = useCallback(() => {
    if (!verDropdownOpen || isVerDropdownClosing) return;
    setIsVerDropdownClosing(true);
    setTimeout(() => {
      setVerDropdownOpen(false);
      setIsVerDropdownClosing(false);
    }, POPOVER_EXIT_MS);
  }, [isVerDropdownClosing, verDropdownOpen]);

  useEffect(() => {
    if (!verDropdownOpen || isVerDropdownClosing) return;
    const frame = requestAnimationFrame(() => {
      const menu = versionDropdownRef.current;
      if (menu) menu.scrollTop = menu.scrollHeight;
    });
    return () => cancelAnimationFrame(frame);
  }, [isVerDropdownClosing, releases.length, verDropdownOpen]);

  const confirmDeleteInstance = useCallback(async () => {
    if (!pendingDelete || isDeletingInstance) return;
    setIsDeletingInstance(true);
    setDeleteInstanceError(null);

    try {
      let freedBytes = 0;
      if (pendingDelete.type === "local") {
        if (pendingDelete.status === "running") {
          operations.cancel(pendingDelete.installDir || pendingDelete.id);
          await TarvenEnv.closeTavern({ instanceId: pendingDelete.installDir || pendingDelete.id });
        }
        const result = await TarvenEnv.uninstallInstance({
          instanceId: pendingDelete.installDir || pendingDelete.id,
          installPath: pendingDelete.installPath,
          port: pendingDelete.port,
        });
        if (!result.success) throw new Error("原生端未能删除实例文件");
        freedBytes = result.freedBytes || 0;
      } else {
        await TarvenEnv.clearRemoteBasicAuth({ instanceId: pendingDelete.id });
      }

      setInstances(prev => prev.filter(instance => instance.id !== pendingDelete.id));
      setTerminalInstanceId(current => current === pendingDelete.id ? null : current);
      setTerminalLogs(prev => [...prev, {
        msg: freedBytes > 0
          ? `已删除 ${pendingDelete.subtitle || pendingDelete.name}，释放 ${(freedBytes / 1048576).toFixed(1)}MB`
          : `已移除 ${pendingDelete.subtitle || pendingDelete.name}`,
        level: "success",
      }]);
      setPendingDelete(null);
      setActiveSlide(current => Math.max(0, Math.min(current, instances.length - 1)));
    } catch (err: any) {
      setDeleteInstanceError(err?.message || String(err));
    } finally {
      setIsDeletingInstance(false);
    }
  }, [instances.length, isDeletingInstance, pendingDelete, operations, setTerminalLogs]);

  /** 更新当前管理面板实例的 config 字段。 */
  const updateManagedConfig = (patch: Partial<InstanceConfig>) => {
    if (!showManagePanel) return;
    setInstances(prev => prev.map(t => t.id === showManagePanel.id ? { ...t, config: { ...(t.config ?? DEFAULT_CONFIG), ...patch } } : t));
  };

  const closeManagePanel = useCallback(() => {
    if (!showManagePanel || isManagePanelClosing) return;
    if (managePanelOpenTimerRef.current) {
      clearTimeout(managePanelOpenTimerRef.current);
      managePanelOpenTimerRef.current = null;
    }
    if (managePanelCloseTimerRef.current) clearTimeout(managePanelCloseTimerRef.current);
    setIsManagePanelClosing(true);
    managePanelCloseTimerRef.current = setTimeout(() => {
      setShowManagePanel(null);
      setIsManagePanelClosing(false);
      setManageTab("launch");
      setManageMoreOpen(false);
      setTerminalInstanceId(null);
      managePanelCloseTimerRef.current = null;
    }, PANEL_EXIT_MS);
  }, [isManagePanelClosing, showManagePanel]);

  const dismissLaunchPanel = useCallback(async () => {
    if (isLaunchPanelClosing) return;
    const original = operations.current;
    const cancelled = original?.busy ? operations.cancel() : null;
    const expected = operations.current;
    if (cancelled) {
      setLaunchingId(null);
      setIsCreatingInstance(false);
      try {
        await TarvenEnv.closeTavern({ instanceId: cancelled.instanceId, operationId: cancelled.id });
      } catch (error) {
        instanceLogs.append(cancelled.instanceId, {
          msg: `取消失败: ${error instanceof Error ? error.message : String(error)}`,
          level: "error",
        });
      }
      if (operations.current !== expected) return;
    }
    if (
      operationPurpose === "create" &&
      lastLaunchParams?.type === "remote" &&
      !instances.some(instance => instance.id === lastLaunchParams.id)
    ) {
      try { await TarvenEnv.clearRemoteBasicAuth({ instanceId: lastLaunchParams.id }); } catch {}
      if (operations.current !== expected) return;
      setShowNewInstancePanel(true);
    }
    setIsLaunchPanelClosing(true);
    setTimeout(() => {
      if (operations.current !== expected) return;
      setShowLaunchPanel(false);
      setIsLaunchPanelClosing(false);
      setLaunchError(null);
      setLaunchProgress(null);
    }, PANEL_EXIT_MS);
  }, [instances, isLaunchPanelClosing, lastLaunchParams, operationPurpose, operations]);

  const closeCleanPanel = useCallback(() => {
    if (cleaningGarbage || isCleanPanelClosing) return;
    setIsCleanPanelClosing(true);
    setTimeout(() => {
      setShowCleanPanel(false);
      setIsCleanPanelClosing(false);
    }, PANEL_EXIT_MS);
  }, [cleaningGarbage, isCleanPanelClosing]);

  const saveManagedInstance = useCallback(async () => {
    if (!showManagePanel || isSavingManagePanel) return;
    setManageSaveError(null);
    setIsSavingManagePanel(true);
    try {
      if (showManagePanel.type === "remote") {
        const username = draftRemoteAuthUsername.trim();
        if (draftRemoteAuthEnabled) {
          if (!username) throw new Error("请输入 Basic Auth 用户名");
          if (!draftRemoteAuthPassword && storedRemoteAuthUsername && username !== storedRemoteAuthUsername) {
            throw new Error("更改 Basic Auth 用户名时，请重新输入密码");
          }
          const verification = await TarvenEnv.pingUrl({
            url: showManagePanel.url || "",
            instanceId: showManagePanel.id,
            ...(draftRemoteAuthPassword ? { username, password: draftRemoteAuthPassword } : {}),
          });
          if (!verification.online) {
            throw new Error(verification.error || "Basic Auth 验证失败");
          }
          await TarvenEnv.setRemoteBasicAuth({
            instanceId: showManagePanel.id,
            username,
            ...(draftRemoteAuthPassword ? { password: draftRemoteAuthPassword } : {}),
          });
        } else {
          await TarvenEnv.clearRemoteBasicAuth({ instanceId: showManagePanel.id });
        }

        const result = await TarvenEnv.pingUrl({
          url: showManagePanel.url || "",
          instanceId: showManagePanel.id,
        });
        setInstances(prev => prev.map(instance => instance.id === showManagePanel.id
          ? {
              ...instance,
              basicAuth: draftRemoteAuthEnabled ? { username } : undefined,
              status: result.online ? "online" : "offline",
            }
          : instance));
      } else {
        updateManagedConfig(draftConfig);
        setInstances(prev => prev.map(instance => instance.id === showManagePanel.id
          ? { ...instance, port: draftPort }
          : instance));
      }
      closeManagePanel();
    } catch (error: any) {
      setManageSaveError(error?.message || String(error));
    } finally {
      setIsSavingManagePanel(false);
    }
  }, [
    closeManagePanel,
    draftConfig,
    draftPort,
    draftRemoteAuthEnabled,
    draftRemoteAuthPassword,
    draftRemoteAuthUsername,
    isSavingManagePanel,
    showManagePanel,
    storedRemoteAuthUsername,
  ]);

  const closeAppMenu = useCallback(() => {
    setIsAppMenuClosing(true);
    setTimeout(() => {
      setShowAppMenu(false);
      setIsAppMenuClosing(false);
      setAppSettingsTab("general");
    }, PANEL_EXIT_MS);
  }, []);

  const openProjectPage = useCallback(() => {
    const url = "https://captchaaaaa.github.io/SillyClient/";
    closeAppMenu();
    void openExternalUrl(url).catch(() => {});
  }, [closeAppMenu]);

  const replayOnboarding = useCallback(() => {
    closeAppMenu();
    setTimeout(() => setShowOnboarding(true), PANEL_EXIT_MS + 20);
  }, [closeAppMenu]);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    setShowOnboarding(false);
    if (localStorage.getItem(WHATS_NEW_KEY) !== WHATS_NEW_VERSION) {
      setTimeout(() => setShowWhatsNew(true), 150);
    } else if (isWindows && localStorage.getItem(LEGACY_MIGRATION_KEY) !== APP_VERSION) {
      setTimeout(() => {
        if (TarvenEnv.checkLegacyInstances) {
          TarvenEnv.checkLegacyInstances()
            .then(({ instances }) => {
              setLegacyMigrationList(instances || []);
              setShowLegacyMigration(true);
              setIsLegacyMigrationClosing(false);
            })
            .catch(() => {
              setLegacyMigrationList([]);
              setShowLegacyMigration(true);
              setIsLegacyMigrationClosing(false);
            });
        } else {
          setLegacyMigrationList([]);
          setShowLegacyMigration(true);
          setIsLegacyMigrationClosing(false);
        }
      }, 150);
    }
  }, [isWindows]);

  const dismissLegacyMigration = useCallback(() => {
    localStorage.setItem(LEGACY_MIGRATION_KEY, APP_VERSION);
    setIsLegacyMigrationClosing(true);
    setTimeout(() => {
      setShowLegacyMigration(false);
      setIsLegacyMigrationClosing(false);
    }, PANEL_EXIT_MS);
  }, []);

  const handleLegacyMigrationComplete = useCallback(() => {
    localStorage.setItem(LEGACY_MIGRATION_KEY, APP_VERSION);
    if (TarvenEnv.scanInstances) {
      TarvenEnv.scanInstances()
        .then(({ instances: scanned }) => {
          if (scanned && scanned.length > 0) {
            setInstances((prev) => {
              const updated = prev.map((inst) => {
                const safeId = inst.installDir || inst.id;
                const found = scanned.find((s) => s.instanceId === safeId);
                if (found) {
                  return {
                    ...inst,
                    installPath: found.path,
                  };
                }
                return inst;
              });
              saveInstances(updated);
              return updated;
            });
          }
        })
        .catch(() => {});
    }
  }, []);

  const dismissWhatsNew = useCallback(() => {
    localStorage.setItem(WHATS_NEW_KEY, WHATS_NEW_VERSION);
    setIsWhatsNewClosing(true);
    setTimeout(() => {
      setShowWhatsNew(false);
      setIsWhatsNewClosing(false);

      // 公告关闭后，弹出旧版路径实例迁移向导 (无论是否有需要迁移的实例均弹出，空则展示优雅空态供审查)
      if (isWindows) {
        if (TarvenEnv.checkLegacyInstances) {
          TarvenEnv.checkLegacyInstances()
            .then(({ instances }) => {
              setLegacyMigrationList(instances || []);
              setShowLegacyMigration(true);
              setIsLegacyMigrationClosing(false);
            })
            .catch(() => {
              setLegacyMigrationList([]);
              setShowLegacyMigration(true);
              setIsLegacyMigrationClosing(false);
            });
        } else {
          setLegacyMigrationList([]);
          setShowLegacyMigration(true);
          setIsLegacyMigrationClosing(false);
        }
      }
    }, PANEL_EXIT_MS);
  }, [isWindows]);

  const openRelocateModal = useCallback((target: TavernInstance) => {
    setRelocatingInstance(target);
    setShowRelocateModal(true);
    setIsRelocateModalClosing(false);
  }, []);

  const closeRelocateModal = useCallback(() => {
    setIsRelocateModalClosing(true);
    setTimeout(() => {
      setShowRelocateModal(false);
      setIsRelocateModalClosing(false);
      setRelocatingInstance(null);
    }, PANEL_EXIT_MS);
  }, []);

  const handleInstanceRelocated = useCallback((instanceId: string, newPath: string) => {
    setInstances((prev) => {
      const updated = prev.map((inst) => {
        if (inst.id === instanceId || inst.installDir === instanceId) {
          return {
            ...inst,
            installPath: newPath,
          };
        }
        return inst;
      });
      saveInstances(updated);
      return updated;
    });

    setShowManagePanel((current) => {
      if (current && (current.id === instanceId || current.installDir === instanceId)) {
        return {
          ...current,
          installPath: newPath,
        };
      }
      return current;
    });
  }, []);

  const openWhatsNew = useCallback(() => {
    closeAppMenu();
    setTimeout(() => {
      setShowWhatsNew(true);
      setIsWhatsNewClosing(false);
    }, PANEL_EXIT_MS + 20);
  }, [closeAppMenu]);

  // 管理面板打开时初始化本地配置或远程认证状态。
  useEffect(() => {
    if (showManagePanel) {
      setDraftConfig(showManagePanel.config ?? DEFAULT_CONFIG);
      setDraftPort(showManagePanel.port ?? 8000);
      setManageSaveError(null);
      setDraftRemoteAuthEnabled(Boolean(showManagePanel.basicAuth));
      setDraftRemoteAuthUsername(showManagePanel.basicAuth?.username || "");
      setDraftRemoteAuthPassword("");
      setStoredRemoteAuthUsername(showManagePanel.basicAuth?.username || "");

      if (showManagePanel.type === "remote") {
        const instanceId = showManagePanel.id;
        void TarvenEnv.getRemoteBasicAuthStatus({ instanceId }).then(status => {
          if (showManagePanel.id !== instanceId) return;
          setDraftRemoteAuthEnabled(status.configured);
          setDraftRemoteAuthUsername(status.username || showManagePanel.basicAuth?.username || "");
          setStoredRemoteAuthUsername(status.username || "");
        }).catch(() => {});
      }
    }
  }, [showManagePanel]);

  // 本版本更新后开屏弹窗检测：若无引导与公告，且本版本尚未展示过旧版迁移弹窗，则自动弹出（无旧实例时展示优雅空态供审查）
  useEffect(() => {
    if (
      !showOnboarding &&
      !showWhatsNew &&
      isWindows &&
      localStorage.getItem(LEGACY_MIGRATION_KEY) !== APP_VERSION
    ) {
      if (TarvenEnv.checkLegacyInstances) {
        TarvenEnv.checkLegacyInstances()
          .then(({ instances }) => {
            setLegacyMigrationList(instances || []);
            setShowLegacyMigration(true);
            setIsLegacyMigrationClosing(false);
          })
          .catch(() => {
            setLegacyMigrationList([]);
            setShowLegacyMigration(true);
            setIsLegacyMigrationClosing(false);
          });
      } else {
        setLegacyMigrationList([]);
        setShowLegacyMigration(true);
        setIsLegacyMigrationClosing(false);
      }
    }
  }, [showOnboarding, showWhatsNew, isWindows]);

  const openVersionDropdown = useCallback((trigger: HTMLElement) => {
    const r = trigger.getBoundingClientRect();
    setVerDropdownPos({
      bottom: window.innerHeight - r.top + 4,
      left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
      width: r.width,
      maxHeight: Math.max(0, Math.min(360, r.top - 12)),
    });
    setIsVerDropdownClosing(false);
    setVerDropdownOpen(true);
  }, []);

  // 统一浮层管理器注册 (ESC 键与 Android 原生物理返回键)
  const { registerLayer } = useLayerStack();

  useEffect(() => {
    if (showBgPanel) return registerLayer("bg_panel", () => {
      setIsPanelClosing(true);
      setTimeout(() => { setShowBgPanel(false); setIsPanelClosing(false); }, BACKGROUND_PANEL_EXIT_MS);
    });
  }, [showBgPanel, registerLayer]);

  useEffect(() => {
    if (showTerminal) return registerLayer("terminal", () => {
      setIsTerminalClosing(true);
      setTimeout(() => { setShowTerminal(false); setIsTerminalClosing(false); }, PANEL_EXIT_MS);
    });
  }, [showTerminal, registerLayer]);

  useEffect(() => {
    if (showAppMenu) return registerLayer("app_menu", () => {
      setIsAppMenuClosing(true);
      setTimeout(() => { setShowAppMenu(false); setIsAppMenuClosing(false); }, PANEL_EXIT_MS);
    });
  }, [showAppMenu, registerLayer]);

  useEffect(() => {
    if (showManagePanel) return registerLayer("manage_panel", closeManagePanel);
  }, [showManagePanel, registerLayer, closeManagePanel]);

  useEffect(() => {
    if (showNewInstancePanel) return registerLayer("new_instance", () => {
      if (!isCreatingInstance) {
        closeVersionDropdown();
        setIsNewInstancePanelClosing(true);
        setTimeout(() => { setShowNewInstancePanel(false); setIsNewInstancePanelClosing(false); }, PANEL_EXIT_MS);
      }
    });
  }, [showNewInstancePanel, registerLayer, isCreatingInstance, closeVersionDropdown]);

  useEffect(() => {
    if (showLaunchPanel) return registerLayer("launch_panel", dismissLaunchPanel);
  }, [showLaunchPanel, registerLayer, dismissLaunchPanel]);

  useEffect(() => {
    if (pendingDelete) return registerLayer("delete_confirm", () => {
      if (!isDeletingInstance) setPendingDelete(null);
    });
  }, [pendingDelete, registerLayer, isDeletingInstance]);

  useEffect(() => {
    if (renamingId) return registerLayer("rename_modal", () => {
      setIsRenameClosing(true);
      setTimeout(() => { setRenamingId(null); setIsRenameClosing(false); }, PANEL_EXIT_MS);
    });
  }, [renamingId, registerLayer]);

  useEffect(() => {
    if (verDropdownOpen) return registerLayer("version_dropdown", closeVersionDropdown);
  }, [verDropdownOpen, registerLayer, closeVersionDropdown]);

  useEffect(() => {
    if (activeCardMenu) return registerLayer("card_menu", closeCardMenu);
  }, [activeCardMenu, registerLayer, closeCardMenu]);

  useEffect(() => {
    if (showLegacyMigration) return registerLayer("legacy_migration", dismissLegacyMigration);
  }, [showLegacyMigration, registerLayer, dismissLegacyMigration]);

  useEffect(() => {
    if (showRelocateModal) return registerLayer("relocate_modal", closeRelocateModal);
  }, [showRelocateModal, registerLayer, closeRelocateModal]);

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "min-h-screen overflow-y-auto scrollbar-hidden overscroll-none transition-colors duration-900",
        themeSmoothing && "theme-smoothing",
        isLight ? "bg-[#f0ece8] text-[#1a1625]" : "bg-[#1a1625] text-white"
      )}
    >
      {/* 下拉刷新指示器 — 固定在顶部,不跟随拖拽 */}
      <div
        className="fixed left-0 right-0 z-[40] flex justify-center pointer-events-none"
        style={{
          top: `calc(env(safe-area-inset-top) + 72px)`,
          opacity: pullDistance > 5 || isRefreshing ? 1 : 0,
          transition: isRefreshing || !isPulling.current ? 'opacity 0.3s' : 'none',
        }}
      >
        <div className={cn("flex flex-col items-center gap-1.5", isLight ? "text-[#1a1625]/30" : "text-white/30")}>
          <div className={cn("w-6 h-6 flex items-center justify-center rounded-full", isRefreshing ? "animate-spin" : "")}>
            {isRefreshing ? (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg className="w-4 h-4 transition-transform duration-300 ease-out" style={{ transform: pullDistance > 55 ? 'rotate(180deg)' : 'rotate(0deg)' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12l7 7 7-7" />
              </svg>
            )}
          </div>
          <span className="text-[9px] font-medium tracking-wide">{isRefreshing ? "刷新中" : pullDistance > 55 ? "松开刷新" : "下拉刷新"}</span>
        </div>
      </div>

      {/* 动态背景光效 */}
      {bgMode === "dynamic" && (
        <div className={cn("ambient-glow-container", dynamicPaused && "ambient-paused")}>
          <div className="ambient-glow ambient-glow-1" />
          <div className="ambient-glow ambient-glow-2" />
          <div className="ambient-glow ambient-glow-3" />
          <div className="ambient-glow ambient-glow-4" />
          <div className="ambient-glow ambient-glow-5" />
        </div>
      )}

      {/* 自定义壁纸 */}
      {bgMode === "custom" && customWallpaperUrl && (
        <div className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${customWallpaperUrl})` }} />
      )}

      <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />
      <input ref={importInputRef} type="file" accept=".json,application/json,text/plain" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const incoming = parseInstanceBackup(String(reader.result));
            setInstances(prev => mergeInstanceBackup(prev, incoming));
          } catch (err) { console.error('[import]', err); }
        };
        reader.readAsText(file);
        e.target.value = "";
      }} />

      {/* 顶部导航 */}
      <header className="fixed left-0 right-0 z-50 px-4" style={{ top: `max(env(safe-area-inset-top), ${safeInsetTop + 4}px)` }}>
        <div className={cn("h-12 flex items-center px-3 rounded-[var(--radius-3xl)] border backdrop-blur-[40px] saturate-180 transition-colors", isLight ? "bg-white/60 border-black/5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]" : "glass-panel")}>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              ref={terminalBtnRef}
              onClick={() => {
                if (isWeb && !isWindows && !isShowcase) return;
                if (showTerminal) {
                  setIsTerminalClosing(true);
                  setTimeout(() => { setShowTerminal(false); setIsTerminalClosing(false); }, PANEL_EXIT_MS);
                } else {
                  const instance = activeInstance;
                  const btn = terminalBtnRef.current;
                  const settingsBtn = settingsBtnRef.current;
                  if (btn) {
                    const rect = btn.getBoundingClientRect();
                    const settingsRect = settingsBtn?.getBoundingClientRect();
                    const rightEdge = settingsRect ? window.innerWidth - settingsRect.right : 16;
                    setTerminalPos({ left: rect.left, right: Math.max(8, rightEdge) });
                  }
                  if (!instance) {
                    setTerminalInstanceId(null);
                    setTerminalLogs([{ msg: "请先选择一个实例，再打开实例终端", level: "info" }]);
                    setTerminalInput("");
                    setIsTerminalClosing(false);
                    setShowTerminal(true);
                    return;
                  }
                  openInstanceTerminal(instance);
                }
              }}
              className={cn(
                "ios-glass-btn px-3 h-8 flex items-center justify-center text-xs font-medium transition-all",
                isLight ? "text-[#1a1625]/70" : "text-white/70"
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <button onClick={toggleBgPanel} className={cn("flex items-center gap-2 px-4 py-1.5 rounded-full transition-all max-w-[200px] border", isLight ? "border-black/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05),0_1px_2px_rgba(255,255,255,0.5)]" : "border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_1px_2px_rgba(255,255,255,0.1)]")}>
              <span className={cn("text-sm font-medium truncate", isLight ? "text-[#1a1625]" : "text-white")}>
                {new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <ChevronDown className={cn("w-4 h-4 flex-shrink-0 transition-transform", isLight ? "text-[#1a1625]/60" : "text-white/60", showBgPanel && "rotate-180")} />
            </button>
          </div>

          <button
            ref={settingsBtnRef}
            onClick={() => {
              if (isWeb && !isShowcase) return;
              if (showAppMenu) {
                closeAppMenu();
              } else {
                setUpdatePromptDismissed(true);
                setAppSettingsTab("general");
                setShowAppMenu(true);
              }
            }}
            className={cn(
              "motion-control ios-glass-btn px-4 h-9 flex items-center justify-center text-xs font-medium flex-shrink-0",
              isLight ? "text-[#1a1625]/70" : "text-white/70"
            )}
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 新版本提示胶囊 (严格与右上角设置按钮右边框对齐) */}
      {appUpdateState === "available" && appUpdateInfo && !updatePromptDismissed && (
        <div
          className={cn(
            "fixed z-[41] flex items-center gap-2 h-10 pl-3.5 pr-1.5 rounded-2xl border backdrop-blur-[40px] saturate-180 shadow-[0_16px_50px_rgba(0,0,0,0.35)]",
            glassBg
          )}
          style={{
            top: `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 60px)`,
            right: updateBannerRight,
          }}
        >
          <div className={cn("text-xs font-medium whitespace-nowrap", isLight ? "text-[#1a1625]/85" : "text-white/85")}>
            发现新版本 v{appUpdateInfo.latestVersion}
          </div>
          <button
            onClick={() => {
              const url = appUpdateInfo.releaseUrl || "https://github.com/CAPTCHAAAAA/SillyClient/releases/latest";
              void openExternalUrl(url).catch(() => {});
              setUpdatePromptDismissed(true);
            }}
            className={cn(
              "motion-control h-7 px-3 rounded-full text-xs font-semibold transition-all border",
              isLight
                ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625]"
                : "bg-white/20 border-white/15 text-white/70 hover:text-white"
            )}
          >
            查看
          </button>
          <button
            onClick={() => setUpdatePromptDismissed(true)}
            aria-label="关闭更新提示"
            className={cn(
              "motion-control w-7 h-7 rounded-full flex items-center justify-center transition-all",
              isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/85" : "text-white/40 hover:text-white/85"
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 主内容 */}
      <main
        className="pb-12 px-6 min-h-screen flex flex-col items-center"
        style={{
          paddingTop: `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 68px)`,
          transform: pullDistance > 0 ? `translate3d(0, ${pullDistance}px, 0)` : undefined,
          transition: isPulling.current || isRefreshing ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
          willChange: pullDistance > 0 ? 'transform' : 'auto',
          contain: 'layout style',
        }}
      >
        {/* Logo */}
        <div className="mb-4 text-center select-none cursor-pointer group" onClick={() => setLogoFontIndex(prev => (prev + 1) % logoFonts.length)} title={`点击切换字体 (${logoFonts[logoFontIndex].name})`}>
          <span
            className="inline-block text-[clamp(3rem,10vw,7.5rem)] font-normal leading-none transition-all duration-300"
            style={{
              fontFamily: logoFonts[logoFontIndex].family,
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ color: isLight ? '#a09b9e' : '#ffd2dc' }}>Silly</span>
            <span style={{ color: '#e8365d' }}>Client</span>
          </span>
          <div className={cn(
            "text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            isLight ? "text-[#1a1625]/25" : "text-white/25"
          )}>{logoFonts[logoFontIndex].name}</div>
        </div>

        {/* 搜索栏 */}
        <div className="relative mb-10 w-full max-w-2xl">
          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const match = instances.find(t => (t.subtitle || t.name).toLowerCase().includes(searchQuery.toLowerCase()));
                if (match) {
                  const idx = instances.indexOf(match) + 1;
                  carouselRef.current?.goToSlide(idx);
                }
              }
            }}
            placeholder="搜索并打开实例"
            className={cn(
              "w-full h-14 pl-12 pr-4 rounded-[20px] border focus:outline-none focus:ring-0",
              isLight ? "bg-black/5 border-black/10 text-[#1a1625] placeholder:text-[#1a1625]/40" : "bg-white/5 border-white/10 text-white placeholder:text-white/40"
            )}
          />
          {searchQuery && (
            <div className="motion-menu-list animate-dropdown absolute top-full left-0 right-0 mt-2 rounded-2xl border overflow-hidden z-30 max-h-64 overflow-y-auto scrollbar-subtle">
              {searchResults.map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    const idx = instances.indexOf(t) + 1;
                    carouselRef.current?.goToSlide(idx);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "motion-menu-item w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors",
                    isLight ? "bg-[#f5f3ef]/95 text-[#1a1625]/60 hover:text-[#1a1625]" : "bg-[#1a1625]/95 text-white/60 hover:text-white"
                  )}
                >
                  <span className="scale-75">{t.icon}</span>
                  <span>{t.subtitle || t.name}</span>
                  <span className={cn("ml-auto text-[10px]", isLight ? "text-[#1a1625]/40" : "text-white/40")}>{t.type === "local" ? "本地" : "远程"}</span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <div className={cn("px-4 py-3 text-sm", isLight ? "bg-[#f5f3ef]/95 text-[#1a1625]/40" : "bg-[#1a1625]/95 text-white/40")}>无匹配实例</div>
              )}
            </div>
          )}
        </div>

        {/* 实例卡片轮播 (高内聚低耦合组件调度) */}
        <InstanceCarousel
          ref={carouselRef}
          instances={instances}
          isLight={isLight}
          glassBg={glassBg}
          hoveredCard={hoveredCard}
          setHoveredCard={setHoveredCard}
          activeCardMenu={activeCardMenu}
          launchingId={launchingId}
          onLaunch={launchTavern}
          onReturnToTavern={handleReturnToTavern}
          onStopInstance={handleStopInstance}
          onOpenMenu={(inst, rect) => {
            setMenuPos({
              top: Math.min(rect.bottom + 6, window.innerHeight - 200),
              left: Math.max(12, Math.min(rect.left - 60, window.innerWidth - 160)),
            });
            setActiveCardMenu(inst.id);
            setIsCardMenuClosing(false);
          }}
          onRenameSave={async (instanceId, newName) => {
            try {
              await executeRenameInstance(instanceId, newName);
              setExternallyRenamingId(null);
            } catch (err: any) {
              alert(err?.message || "重命名实例文件夹失败");
            }
          }}
          externallyRenamingId={externallyRenamingId}
          onClearExternalRenaming={() => setExternallyRenamingId(null)}
          onReorderInstances={handleReorderInstances}
          isWindows={isWindows}
          isWeb={isWeb}
          isShowcase={isShowcase}
          onNewInstance={() => {
            if (isWeb && !isShowcase && !import.meta.env.DEV) {
              void openExternalUrl("https://github.com/CAPTCHAAAAA/SillyClient/releases/latest").catch(() => {});
              return;
            }
            setNewInstanceMode("local");
            setNewInstanceName("");
            setNewInstanceDir("");
            setNewInstancePathMode("exact");
            setMigrationTargetPathMode("exact");
            setNewInstanceUrl("http://");
            setNewRemoteAuthEnabled(false);
            setNewRemoteAuthUsername("");
            setNewRemoteAuthPassword("");
            setNewInstanceVersion("stable");
            setNewInstanceCompanionPresetEnabled(false);
            setNewInstanceExtensionIds([]);
            setNewInstanceLocalZip(null);
            setNewInstanceError(null);
            setShowNewInstancePanel(true);
          }}
          activeSlide={activeSlide}
          onActiveSlideChange={setActiveSlide}
        />
      </main>

      {/* 解耦业务组件: 卡片操作菜单 */}
      {activeCardMenu && (() => {
        const targetInstance = instances.find(i => i.id === activeCardMenu);
        if (!targetInstance) return null;
        return (
          <CardActionMenu
            instance={targetInstance}
            isOpen={!!activeCardMenu}
            isClosing={isCardMenuClosing}
            onClose={closeCardMenu}
            isLight={isLight}
            menuPos={menuPos}
            onManage={(inst) => {
              closeCardMenu();
              openManagePanel(inst);
            }}
            onRename={(inst) => {
              closeCardMenu();
              setExternallyRenamingId(inst.id);
            }}
            onPickCover={(inst) => {
              closeCardMenu();
              void pickInstanceCover(inst);
            }}
            onDelete={(inst) => {
              closeCardMenu();
              setDeleteInstanceError(null);
              setPendingDelete(inst);
            }}
          />
        );
      })()}

      {/* 解耦业务组件: 背景设置抽屉 (昼夜级平滑自适应高度跟随) */}
      <BackgroundSettingsDrawer
        isOpen={showBgPanel}
        isClosing={isPanelClosing}
        onClose={() => {
          setIsPanelClosing(true);
          setTimeout(() => {
            setShowBgPanel(false);
            setIsPanelClosing(false);
          }, BACKGROUND_PANEL_EXIT_MS);
        }}
        isLight={isLight}
        safeInsetTop={safeInsetTop}
        bgMode={bgMode}
        setBgMode={setBgMode}
        switchThemeMode={switchThemeMode}
        dynamicPaused={dynamicPaused}
        setDynamicPaused={setDynamicPaused}
        themeStyle={themeStyle}
        setThemeStyle={setThemeStyle}
        customWallpaperUrl={customWallpaperUrl}
        setCustomWallpaperUrl={setCustomWallpaperUrl}
        onSelectWallpaperFile={() => wallpaperInputRef.current?.click()}
      />

      {/* 解耦业务组件: 终端面板 */}
      <TerminalModal
        isOpen={showTerminal}
        isClosing={isTerminalClosing}
        onClose={() => {
          setIsTerminalClosing(true);
          setTimeout(() => {
            setShowTerminal(false);
            setIsTerminalClosing(false);
          }, PANEL_EXIT_MS);
        }}
        isLight={isLight}
        glassBg={glassBg}
        safeInsetTop={safeInsetTop}
        terminalPos={terminalPos}
        terminalDisplayTitle={terminalDisplayTitle}
        terminalDisplayBanner={terminalDisplayBanner}
        terminalDisplayPrompt={terminalDisplayPrompt}
        terminalDisplayPlaceholder={terminalDisplayPlaceholder}
        terminalInstance={terminalInstance}
      />

      {/* 解耦业务组件: APP 设置抽屉 */}
      <AppSettingsDrawer
        isOpen={showAppMenu}
        isClosing={isAppMenuClosing}
        onClose={() => {
          setIsAppMenuClosing(true);
          setTimeout(() => {
            setShowAppMenu(false);
            setIsAppMenuClosing(false);
          }, PANEL_EXIT_MS);
        }}
        isLight={isLight}
        glassBg={glassBg}
        isWindows={isWindows}
        isWeb={isWeb}
        pullToRefresh={pullToRefresh}
        setPullToRefresh={setPullToRefresh}
        contentOpenMode={contentOpenMode}
        setContentOpenMode={setContentOpenMode}
        replayOnboarding={replayOnboarding}
        instances={instances}
        setInstances={setInstances}
        onImportBackup={content => {
          const incoming = parseInstanceBackup(content);
          setInstances(previous => mergeInstanceBackup(previous, incoming));
        }}
        importInputRef={importInputRef}
        appUpdateState={appUpdateState}
        appUpdateInfo={appUpdateInfo}
        checkForAppUpdate={checkForAppUpdate}
        openProjectPage={openProjectPage}
        onOpenWhatsNew={openWhatsNew}
        onOpenCleanGarbage={async () => {
          closeAppMenu();
          setCleaningGarbage(true);
          setShowCleanPanel(true);
          setGarbageItems([]);
          setGarbageError(null);
          try {
            const { items } = await TarvenEnv.cleanGarbage({
              dryRun: true,
              activeInstanceIds: Array.from(new Set(instances.flatMap(instance => [instance.id, instance.installDir].filter((id): id is string => !!id)))),
              activeCoverPaths: instances.map(instance => instance.cover).filter((cover): cover is string => !!cover),
            });
            setGarbageItems(items);
          } catch (e) {
            setGarbageError(e instanceof Error ? e.message : String(e));
          }
          setCleaningGarbage(false);
        }}
      />

      {/* 解耦业务组件: 重命名弹窗 (备用兜底) */}
      <RenameModal
        isOpen={!!renamingId}
        isClosing={isRenameClosing}
        onClose={closeRenameDialog}
        isLight={isLight}
        glassBg={glassBg}
        value={renameValue}
        onChange={setRenameValue}
        error={renameError}
        saving={isRenamingSaving}
        onSave={async () => {
          if (!renamingId || !renameValue.trim() || isRenamingSaving) return;
          setIsRenamingSaving(true);
          setRenameError(null);
          try {
            const ok = await executeRenameInstance(renamingId, renameValue.trim());
            if (ok) {
              closeRenameDialog();
            }
          } catch (err: any) {
            setRenameError(err?.message || "重命名实例失败，请检查文件夹权限");
          } finally {
            setIsRenamingSaving(false);
          }
        }}
      />

      {/* 解耦业务组件: 实例访问密码解锁对话框 (本地保险开关) */}
      <UnlockInstanceModal
        instance={unlockingInstance}
        isOpen={isUnlockModalOpen}
        isClosing={isUnlockModalClosing}
        onClose={closeUnlockModal}
        isLight={isLight}
        glassBg={glassBg}
        onUnlockSuccess={(inst) => {
          closeUnlockModal();
          void launchTavernDirect(inst);
        }}
      />

      {/* 解耦业务组件: 高阻断级删除确认对话框 */}
      <DeleteConfirmDialog
        instance={pendingDelete}
        isOpen={!!pendingDelete}
        onClose={() => {
          if (!isDeletingInstance) {
            setPendingDelete(null);
            setDeleteInstanceError(null);
          }
        }}
        isLight={isLight}
        glassBg={glassBg}
        isDeleting={isDeletingInstance}
        deleteError={deleteInstanceError}
        onConfirm={confirmDeleteInstance}
      />

      {/* 解耦公共组件: 统一多层遮罩 */}
      <LayerBackdrop
        isOpen={showNewInstancePanel || isNewInstancePanelClosing || showLaunchPanel || isLaunchPanelClosing}
        isClosing={!showNewInstancePanel && !showLaunchPanel && (isNewInstancePanelClosing || isLaunchPanelClosing)}
        onClick={() => {
          if (showNewInstancePanel && !isCreatingInstance) {
            closeVersionDropdown();
            setIsNewInstancePanelClosing(true);
            setTimeout(() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
            }, PANEL_EXIT_MS);
          } else if (showLaunchPanel && (launchError || (operationPurpose === "create" && launchProgress?.pct === 100))) {
            dismissLaunchPanel();
          }
        }}
      />

      {/* 解耦业务组件: 启动控制台 (数学绝对居中、支持最小化至活动胶囊、轻拟物扁平按钮、无绿字) */}
      <LaunchConsoleModal
        isOpen={showLaunchPanel}
        isClosing={isLaunchPanelClosing}
        isLight={isLight}
        glassBg={glassBg}
        operationPurpose={operationPurpose}
        launchError={launchError}
        launchProgress={launchProgress}
        lastLaunchParams={lastLaunchParams}
        logKey={launchLogKey}
        launchingId={launchingId}
        onRetry={retryLaunch}
        onClose={dismissLaunchPanel}
        onMinimize={() => {
          const expected = operations.current;
          setIsLaunchPanelClosing(true);
          setTimeout(() => {
            if (operations.current !== expected) return;
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setIsLaunchMinimized(true);
          }, PANEL_EXIT_MS);
        }}
        onEnterTavern={async (params: any) => {
          const instance = params || lastLaunchParams;
          if (instance) await launchTavern(instance);
        }}
      />

      {/* 解耦业务组件: 清理垃圾弹窗 */}
      <CleanGarbageModal
        isOpen={showCleanPanel}
        isClosing={isCleanPanelClosing}
        onClose={() => {
          setIsCleanPanelClosing(true);
          setTimeout(() => {
            setShowCleanPanel(false);
            setIsCleanPanelClosing(false);
          }, PANEL_EXIT_MS);
        }}
        isLight={isLight}
        glassBg={glassBg}
        cleaningGarbage={cleaningGarbage}
        setCleaningGarbage={setCleaningGarbage}
        garbageItems={garbageItems}
        setGarbageItems={setGarbageItems}
        error={garbageError}
        setError={setGarbageError}
      />

      {/* 解耦业务组件: 新建实例向导 (同位驻留 DOM、昼夜平滑高度自适应、无自发光输入框) */}
      <NewInstanceWizardModal
        isOpen={showNewInstancePanel}
        isClosing={isNewInstancePanelClosing}
        onClose={() => {
          if (!isCreatingInstance) {
            closeVersionDropdown();
            setIsNewInstancePanelClosing(true);
            setTimeout(() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
            }, PANEL_EXIT_MS);
          }
        }}
        isLight={isLight}
        glassBg={glassBg}
        isWindows={isWindows}
        newInstanceName={newInstanceName}
        setNewInstanceName={setNewInstanceName}
        newInstanceMode={newInstanceMode}
        switchInstanceMode={switchInstanceMode}
        newInstanceDir={newInstanceDir}
        setNewInstanceDir={handleSetNewInstanceDir}
        onPickInstallFolder={handlePickInstallFolder}
        newInstanceVersion={newInstanceVersion}
        setNewInstanceVersion={setNewInstanceVersion}
        newInstanceLocalZip={newInstanceLocalZip}
        setNewInstanceLocalZip={setNewInstanceLocalZip}
        newInstanceCompanionPresetEnabled={newInstanceCompanionPresetEnabled}
        setNewInstanceCompanionPresetEnabled={setNewInstanceCompanionPresetEnabled}
        newInstanceExtensionIds={newInstanceExtensionIds}
        setNewInstanceExtensionIds={setNewInstanceExtensionIds}
        newInstanceUrl={newInstanceUrl}
        setNewInstanceUrl={setNewInstanceUrl}
        newRemoteAuthEnabled={newRemoteAuthEnabled}
        setNewRemoteAuthEnabled={setNewRemoteAuthEnabled}
        newRemoteAuthUsername={newRemoteAuthUsername}
        setNewRemoteAuthUsername={setNewRemoteAuthUsername}
        newRemoteAuthPassword={newRemoteAuthPassword}
        setNewRemoteAuthPassword={setNewRemoteAuthPassword}
        migrationAccessMode={migrationAccessMode}
        setMigrationAccessMode={setMigrationAccessMode}
        migrationSourcePath={migrationSourcePath}
        setMigrationSourcePath={handleSetMigrationSourcePath}
        migrationIncludeSecrets={migrationIncludeSecrets}
        setMigrationIncludeSecrets={setMigrationIncludeSecrets}
        migrationCustomDest={migrationCustomDest}
        setMigrationCustomDest={handleSetMigrationCustomDest}
        onPickSourceFolder={handlePickSourceFolder}
        onPickSourceZip={handlePickSourceZip}
        onPickTargetFolder={handlePickTargetFolder}
        migrationPreflight={
          migrationSourcePath
            ? {
                version: "1.12.8",
                nativePlugins: ["better-sqlite3", "sharp"],
              }
            : null
        }
        newInstanceError={newInstanceError}
        isCreatingInstance={isCreatingInstance}
        createInstance={createInstance}
        releases={releases}
        setReleases={setReleases}
        fetchingReleases={fetchingReleases}
        setFetchingReleases={setFetchingReleases}
        verDropdownOpen={verDropdownOpen}
        isVerDropdownClosing={isVerDropdownClosing}
        openVersionDropdown={openVersionDropdown}
        closeVersionDropdown={closeVersionDropdown}
        addTerminalLog={(msg, level) => {
          setTerminalLogs(prev => [...prev, { msg, level }]);
        }}
      />

      {/* 解耦业务组件: 版本选择下拉浮层 */}
      <VersionDropdownMenu
        isOpen={verDropdownOpen}
        isClosing={isVerDropdownClosing}
        onClose={closeVersionDropdown}
        isLight={isLight}
        glassBg={glassBg}
        releases={releases}
        currentVersion={newInstanceVersion}
        onSelectVersion={(tag) => {
          setNewInstanceVersion(tag);
          closeVersionDropdown();
        }}
        dropdownPos={verDropdownPos}
      />

      {/* 解耦业务组件: 实例管理面板 */}
      <ManageInstanceModal
        instance={showManagePanel}
        isOpen={!!showManagePanel}
        isClosing={isManagePanelClosing}
        onClose={closeManagePanel}
        isLight={isLight}
        bgMode={bgMode}
        themeStyle={themeStyle}
        glassBg={glassBg}
        isWindows={isWindows}
        allInstances={instances}
        onSelectInstance={(inst) => {
          setShowManagePanel(inst);
          setTerminalInstanceId(inst.id);
          if (maintenanceInstance) setMaintenanceInstance(inst.type === "local" ? inst : null);
        }}
        onOpenMaintenance={(inst) => {
          if (inst.type === "local") setMaintenanceInstance(inst);
        }}
        onOpenRelocate={openRelocateModal}
        onLaunchInstance={(inst) => {
          closeManagePanel();
          launchTavern(inst);
        }}
        launchingId={launchingId}
        onTriggerRename={(inst) => {
          closeManagePanel();
          setRenamingId(inst.id);
          setRenameValue(inst.subtitle || inst.name);
          setRenameError(null);
          setIsRenameClosing(false);
        }}
        onTriggerDelete={(inst) => {
          closeManagePanel();
          setDeleteInstanceError(null);
          setPendingDelete(inst);
        }}
        onPickCover={(inst) => {
          void pickInstanceCover(inst);
        }}
        aboutInfo={aboutInfo}
        draftConfig={draftConfig}
        setDraftConfig={setDraftConfig}
        draftPort={draftPort}
        setDraftPort={setDraftPort}
        draftRemoteAuthEnabled={draftRemoteAuthEnabled}
        setDraftRemoteAuthEnabled={setDraftRemoteAuthEnabled}
        draftRemoteAuthUsername={draftRemoteAuthUsername}
        setDraftRemoteAuthUsername={setDraftRemoteAuthUsername}
        draftRemoteAuthPassword={draftRemoteAuthPassword}
        setDraftRemoteAuthPassword={setDraftRemoteAuthPassword}
        isSavingManagePanel={isSavingManagePanel}
        manageSaveError={manageSaveError}
        onSaveManagedInstance={saveManagedInstance}
        terminalDisplayPrompt={terminalDisplayPrompt}
        terminalPlaceholder={terminalPlaceholder}
        onUpdateInstancePasswordStatus={handleUpdateInstancePasswordStatus}
      />

      <InstanceMaintenancePanel instance={maintenanceInstance} isOpen={!!maintenanceInstance}
        onClose={closeMaintenance} isLight={isLight} glassBg={glassBg} registerLayer={registerLayer} />

      {/* 首次引导 */}
      {showOnboarding && (
        <OnboardingGuide
          isLight={isLight}
          onComplete={dismissOnboarding}
          onSkip={dismissOnboarding}
        />
      )}

      {/* 版本主要更新画布 (全屏虚化) */}
      <WhatsNewModal
        isOpen={showWhatsNew}
        isClosing={isWhatsNewClosing}
        onClose={dismissWhatsNew}
        isLight={isLight}
        glassBg={glassBg}
      />

      {/* 新版本旧路径实例全屏一键迁移向导 */}
      <LegacyMigrationModal
        isOpen={showLegacyMigration}
        isClosing={isLegacyMigrationClosing}
        onClose={dismissLegacyMigration}
        isLight={isLight}
        glassBg={glassBg}
        legacyInstances={legacyMigrationList}
        onMigrationComplete={handleLegacyMigrationComplete}
      />

      {/* 单实例存储路径迁移模态框 */}
      <RelocateInstanceModal
        instance={relocatingInstance}
        isOpen={showRelocateModal}
        isClosing={isRelocateModalClosing}
        onClose={closeRelocateModal}
        isLight={isLight}
        glassBg={glassBg}
        onRelocated={handleInstanceRelocated}
      />

      {/* 【视觉与动效测试专用】底部悬浮调试板：仅在本地开发走查环境可见，用于设计验收与过渡动效测试，在任何正式生产构建（Windows/Android/Pages）中自动剔除 */}
      {import.meta.env.DEV && !isNativePreview && (
        <div
          title="【视觉测试专用】仅用于本地开发、设计走查与过渡动效测试，正式生产原生端不包含"
          className="fixed bottom-4 right-4 z-[99] flex flex-wrap items-center gap-1.5 p-1.5 rounded-full border backdrop-blur-[32px] saturate-180 shadow-[0_8px_32px_rgba(0,0,0,0.4)] select-none text-[11px] transition-all bg-[#14101e]/85 border-white/10"
        >
          <div className="flex items-center gap-1.5 pl-2.5 pr-1 text-white/50 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
            <span>调试板 (视觉测试专用)</span>
          </div>
          <button
            onClick={() => {
              setShowWhatsNew(true);
              setIsWhatsNewClosing(false);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/70 hover:text-white active:bg-white/25 font-medium transition-colors"
          >
            更新画布
          </button>
          <button
            onClick={() => {
              setShowLegacyMigration(true);
              setIsLegacyMigrationClosing(false);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/70 hover:text-white active:bg-white/25 font-medium transition-colors"
          >
            旧版迁移
          </button>
          <button
            onClick={() => {
              setShowLaunchPanel(false);
              setIsLaunchPanelClosing(false);
              setShowNewInstancePanel(true);
              setIsNewInstancePanelClosing(false);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/70 hover:text-white active:bg-white/25 font-medium transition-colors"
          >
            打开向导
          </button>
          <button
            onClick={() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
              setOperationPurpose("create");
              setLastLaunchParams({ ...DEMO_INSTANCE, id: "demo-test", name: "体验新实例", type: "local" });
              setShowLaunchPanel(true);
              setIsLaunchPanelClosing(false);
              setLaunchError(null);
              setLaunchProgress({ pct: 45, text: "正在下载运行环境..." });
              setLaunchLogs([
                { msg: "开始创建 体验新实例", level: "info" },
                { msg: "解压运行时与核心组件...", level: "info" },
              ]);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/70 hover:text-white active:bg-white/25 font-medium transition-colors"
          >
            模拟过渡
          </button>
          <button
            onClick={() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
              setOperationPurpose("create");
              setLastLaunchParams({ ...DEMO_INSTANCE, id: "demo-test", name: "体验新实例", type: "local" });
              setShowLaunchPanel(true);
              setIsLaunchPanelClosing(false);
              setLaunchError(null);
              setLaunchProgress({ pct: 100, text: "创建完成，可以运行" });
              setLaunchLogs([
                { msg: "服务可访问，实例创建完成", level: "success" },
              ]);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/20 bg-white/20 text-white/80 hover:text-white active:bg-white/35 font-semibold transition-colors"
          >
            模拟完成态
          </button>
          <button
            onClick={() => {
              dismissLaunchPanel();
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
            }}
            title="关闭弹层"
            className="motion-control w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export default SillyClientLauncher;
