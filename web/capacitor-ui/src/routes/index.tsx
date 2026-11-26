import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import {
  Menu,
  ChevronDown,
  X,
  Search,
  Folder,
  Cloud,
  Terminal,
} from "lucide-react";
import { cn, normalizeStoredVersion } from "@/lib/utils";
import { applyUiScale, loadUiScale, saveUiScale, toUnscaledPx } from "@/lib/ui-scale";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv, DEFAULT_CONFIG, normalizeRenderEngineSettings } from "@/capacitor-plugin";
import { openExternalUrl } from "@/lib/external-links";
import type { AppUpdateInfo, CompanionPresetSelection, ContentOpenMode, InstanceConfig, InstallPathMode, GithubRelease, GarbageItem, TarvenEvent, PreinstalledExtensionId, RenderEngineSettings } from "@/capacitor-plugin";
import { buildInstanceSubfolder, cleanInstallPath, exactInstallTarget, installationSelection, instanceParentPath, normalizeInstanceIdentity, sanitizeFolderName, shouldShowDirectoryPickerError, validateInstallPathInput } from "@/lib/install-location";
import { createDiagnosticContext, humanizeNativeError, type DiagnosticContext } from "@/lib/native-errors";
import {
  ProvisionTimeoutTracker,
  formatProvisionTimeoutError,
  resolveProvisionFailure,
} from "@/lib/provision-timeout";
import { selectTavernRelease } from "@/lib/tavern-release";
import { normalizeStoredInstances, serializeInstanceRecords, type StoredInstance } from "@/lib/instance-persistence";
import { GLOBAL_LOG_KEY, instanceLogs, type LogLine } from "@/lib/log-store";
import { OperationCoordinator, OperationCancelledError, type OperationContext } from "@/lib/operation-coordinator";
import { APP_VERSION } from "@/constants/app-version";
import { fetchAppUpdate } from "@/lib/app-update";
import { isOnboardingSandbox } from "@/lib/onboarding-mode";
import type { GuideStep } from "@/components/onboarding/guide-content";
import OnboardingSession from "@/components/onboarding/OnboardingSession";
import { RelocateInstanceModal } from "@/components/modals/RelocateInstanceModal";
import { LAYERS } from "@/constants/layers";
import { useLayerStack } from "@/hooks/useLayerStack";
import { useBackgroundMode } from "@/hooks/useBackgroundMode";
import { HeaderClock } from "@/components/common/HeaderClock";
import { LayerBackdrop } from "@/components/common/LayerBackdrop";
import { ActionButton } from "@/components/common/ActionButton";
import { GlobalErrorReportOverlay } from "@/components/common/GlobalErrorReportOverlay";
import { reportGlobalError } from "@/lib/global-error-store";
import { InstanceCarousel, type InstanceCarouselRef } from "@/components/instance/InstanceCarousel";
import type { InstanceRenameState } from "@/components/instance/InstanceRenameField";
import { NewInstanceWizardModal } from "@/components/modals/NewInstanceWizardModal";
import { ManageInstanceModal } from "@/components/modals/ManageInstanceModal";
import { InstanceMaintenancePanel } from "@/components/modals/InstanceMaintenancePanel";
import { BackgroundSettingsDrawer } from "@/components/modals/BackgroundSettingsDrawer";
import { AppSettingsDrawer } from "@/components/modals/AppSettingsDrawer";
import { TerminalModal } from "@/components/modals/TerminalModal";
import { CleanGarbageModal } from "@/components/modals/CleanGarbageModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { VersionDropdownMenu } from "@/components/modals/VersionDropdownMenu";
import { CardActionMenu } from "@/components/modals/CardActionMenu";
import { LaunchConsoleModal } from "@/components/modals/LaunchConsoleModal";
import { UnlockInstanceModal } from "@/components/modals/UnlockInstanceModal";
import type { TavernInstance, OperationPurpose, LauncherDevHost, LauncherPreviewConsoleOptions } from "@/types";

const OnboardingGuide = lazy(() => import("@/components/onboarding/OnboardingGuide"));

export const Route = createFileRoute("/")({
  component: SillyClientLauncher,
});




const INSTANCES_KEY = "sillyclient.instances";
const INSTANCES_VERSION_KEY = "sillyclient.instances.version";
const ONBOARDING_KEY = "sillyclient.onboarding.version";
const ONBOARDING_VERSION = "6";
const CREATE_CARD_SLOT_KEY = "sillyclient.createCardSlot";
const CURRENT_VERSION = 2;
const BACKGROUND_PANEL_EXIT_MS = 300;
const PANEL_EXIT_MS = 300;
const POPOVER_EXIT_MS = 300;
const MANAGE_PANEL_OPEN_GAP_MS = 32;

function loadCreateCardSlot(maxSlot: number) {
  try {
    if (localStorage.getItem("sillyclient.createCardPinned") !== "false") return 0;
    const raw = localStorage.getItem(CREATE_CARD_SLOT_KEY);
    if (raw === null) return 0;
    const slot = Number(raw);
    if (!Number.isSafeInteger(slot) || slot < 0) return 0;
    return Math.min(slot, maxSlot);
  } catch {
    return 0;
  }
}

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

function stripOneShotCreationParams(instance: TavernInstance): TavernInstance {
  const { zipballUrl: _zipballUrl, localZipPath: _localZipPath, preinstall: _preinstall, companionPreset: _companionPreset, ...rest } = instance;
  return rest as TavernInstance;
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
      return normalizeStoredInstances(JSON.parse(raw), { resetStatus: true })
        .map(hydrateInstance)
        .map(stripOneShotCreationParams);
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

const SC_BORDEAUX_PRESET: CompanionPresetSelection = {
  bundleId: "sc-bordeaux",
  revision: 3,
};

class ClientValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClientValidationError";
  }
}

const LOGO_FONTS = [
  { name: "Yummy", family: "'Yummy', sans-serif" },
  { name: "Arcade Raiders", family: "'Arcade Raiders', sans-serif" },
  { name: "Noisy Walk", family: "'Noisy Walk', sans-serif" },
  { name: "Stay Pixel", family: "'Stay Pixel', sans-serif" },
  { name: "04B 30", family: "'04B 30', sans-serif" },
  { name: "Pixel Chaos", family: "'Pixel Chaos', sans-serif" },
  { name: "Soap", family: "'Soap', sans-serif" },
  { name: "Syndra", family: "'Syndra', sans-serif" },
  { name: "Dynamic Display", family: "'Dynamic Display', sans-serif" },
] as const;

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
  const showcaseSafeTop = isShowcase
    ? Math.max(0, Number(showcaseParams.get("safeTop")) || 52)
    : 0;
  const isWindows = typeof window !== "undefined"
    && (
      (window as typeof window & { __SILLYCLIENT_PLATFORM__?: string }).__SILLYCLIENT_PLATFORM__ === "windows"
      || Capacitor.getPlatform() === "windows"
    );
  const isAndroid = Capacitor.getPlatform() === "android";
  const isIOS = Capacitor.getPlatform() === "ios";
  const isMobile = isAndroid || isIOS;
  const isLocalPreview = isWeb && !isWindows && /^(127\.0\.0\.1|localhost)$/.test(window.location.hostname);
  const platformTag = isWindows ? "windows" : isIOS ? "ios" : isAndroid ? "android" : "web";
  const previewModeRef = useRef(false);
  const terminalTitle = isWindows ? "Windows 控制台" : isIOS ? "iOS 控制台" : "Android 终端";
  const terminalPrompt = isWindows ? "C:\\>" : isIOS ? "ios >" : "~ $";
  const terminalBanner = isWindows
    ? `SillyClient ${APP_VERSION} · Windows · cmd.exe`
    : isIOS
    ? `SillyClient ${APP_VERSION} · iOS · NodeMobile`
    : `SillyClient ${APP_VERSION} · Android shell`;
  const terminalPlaceholder = isWindows ? "输入 Windows 命令" : isIOS ? "iOS 进程内环境（可查看服务运行日志）" : "输入 Android shell 命令";
  const [showOnboarding, setShowOnboarding] = useState(
    () => isOnboardingSandbox || ((!isWeb || isWindows || (import.meta.env.DEV && isLocalPreview)) && !isShowcase && localStorage.getItem(ONBOARDING_KEY) !== ONBOARDING_VERSION),
  );
  const [relocatingInstance, setRelocatingInstance] = useState<TavernInstance | null>(null);
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [isRelocateModalClosing, setIsRelocateModalClosing] = useState(false);
  const [instances, setInstances] = useState<TavernInstance[]>(() => (isShowcase ? [] : loadInstances()));
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const { bgMode, setBgMode, themeStyle, setThemeStyle, dynamicPaused, setDynamicPaused, switchThemeMode } = useBackgroundMode();
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalClosing, setIsTerminalClosing] = useState(false);
  const operations = useMemo(() => new OperationCoordinator(), []);
  const [launchLogKey, setLaunchLogKey] = useState<string | null>(null);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchProgress, setLaunchProgress] = useState<{ pct: number; text: string } | null>(null);
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [isLaunchPanelClosing, setIsLaunchPanelClosing] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchDiagnostic, setLaunchDiagnostic] = useState<DiagnosticContext | null>(null);
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
  const [logoFontIndex, setLogoFontIndex] = useState(0);

  // 实例卡片状态
  const [activeCardMenu, setActiveCardMenu] = useState<string | null>(null);
  const [isCardMenuClosing, setIsCardMenuClosing] = useState(false);
  const [showManagePanel, setShowManagePanel] = useState<TavernInstance | null>(null);
  const [maintenanceInstance, setMaintenanceInstance] = useState<TavernInstance | null>(null);
  const [isMaintenanceClosing, setIsMaintenanceClosing] = useState(false);
  const closeMaintenance = useCallback(() => {
    setMaintenanceInstance(null);
    setIsMaintenanceClosing(false);
  }, []);
  const [isManagePanelClosing, setIsManagePanelClosing] = useState(false);
  const [showAppMenu, setShowAppMenu] = useState(false);
  const [isAppMenuClosing, setIsAppMenuClosing] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [createCardSlot, setCreateCardSlotState] = useState(() => loadCreateCardSlot(instances.length));
  const setCreateCardSlot = useCallback((slot: number) => {
    const normalizedSlot = Math.max(0, Math.min(instances.length, Math.trunc(slot)));
    setCreateCardSlotState(normalizedSlot);
    if (!isShowcase) {
      try {
        localStorage.setItem(CREATE_CARD_SLOT_KEY, String(normalizedSlot));
      } catch {}
    }
  }, [instances.length, isShowcase]);
  const [showNewInstancePanel, setShowNewInstancePanel] = useState(false);
  const [isNewInstancePanelClosing, setIsNewInstancePanelClosing] = useState(false);
  const [newInstanceMode, setNewInstanceMode] = useState<"local" | "remote">("local");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceDir, setNewInstanceDir] = useState("");
  const [newInstancePathMode, setNewInstancePathMode] = useState<InstallPathMode>("exact");
  const directoryPickerGeneration = useRef(0);
  const [newInstanceUrl, setNewInstanceUrl] = useState("http://");
  const [newRemoteAuthEnabled, setNewRemoteAuthEnabled] = useState(false);
  const [newRemoteAuthUsername, setNewRemoteAuthUsername] = useState("");
  const [newRemoteAuthPassword, setNewRemoteAuthPassword] = useState("");
  const [newInstanceVersion, setNewInstanceVersion] = useState("stable");
  const [newInstanceCompanionPresetEnabled, setNewInstanceCompanionPresetEnabled] = useState(false);
  const [newInstanceExtensionIds, setNewInstanceExtensionIds] = useState<PreinstalledExtensionId[]>([]);
  const [newInstanceLocalZip, setNewInstanceLocalZip] = useState<string | null>(null);
  const [newInstanceError, setNewInstanceError] = useState<string | null>(null);
  const [newInstanceDiagnostic, setNewInstanceDiagnostic] = useState<DiagnosticContext | null>(null);
  const [isCreatingInstance, setIsCreatingInstance] = useState(false);
  // GitHub releases 真实数据
  const [releases, setReleases] = useState<GithubRelease[]>([]);
  const [fetchingReleases, setFetchingReleases] = useState(false);
  // 搜索
  const [searchQuery, setSearchQuery] = useState("");
  // 终端输入
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
  const [createCardPinned, setCreateCardPinnedState] = useState<boolean>(() => {
    try {
      return localStorage.getItem("sillyclient.createCardPinned") !== "false";
    } catch {
      return true;
    }
  });
  const setCreateCardPinned = useCallback((pinned: boolean) => {
    setCreateCardPinnedState(pinned);
    if (pinned) setCreateCardSlot(0);
    try {
      localStorage.setItem("sillyclient.createCardPinned", pinned ? "true" : "false");
    } catch {}
  }, [setCreateCardSlot]);

  useEffect(() => {
    const normalizedSlot = createCardPinned
      ? 0
      : Math.max(0, Math.min(instances.length, createCardSlot));
    if (normalizedSlot !== createCardSlot) {
      setCreateCardSlot(normalizedSlot);
    } else if (!isShowcase) {
      try {
        localStorage.setItem(CREATE_CARD_SLOT_KEY, String(normalizedSlot));
      } catch {}
    }
  }, [createCardPinned, createCardSlot, instances.length, isShowcase, setCreateCardSlot]);

  const canPreviewRenderSettings = ((isWeb && isLocalPreview) || isOnboardingSandbox) && !isWindows;
  const [renderSettings, setRenderSettings] = useState<RenderEngineSettings | null>(
    () => (canPreviewRenderSettings ? normalizeRenderEngineSettings(null) : null),
  );
  const renderHydrated = useRef(canPreviewRenderSettings);
  const renderSettingsRef = useRef(renderSettings);
  const renderSavePending = useRef(false);
  const renderSettingsGeneration = useRef(0);
  const [renderSettingsPending, setRenderSettingsPending] = useState(false);
  const [renderSettingsError, setRenderSettingsError] = useState<string | null>(null);
  const [renderSettingsDiagnostic, setRenderSettingsDiagnostic] = useState<DiagnosticContext | null>(null);
  const commitRenderSettings = useCallback(
    async (next: RenderEngineSettings) => {
      if ((!isMobile && !canPreviewRenderSettings) || !renderHydrated.current
        || renderSavePending.current) return;
      const previous = renderSettingsRef.current;
      const normalized = normalizeRenderEngineSettings(next);
      renderSettingsGeneration.current++;
      renderSavePending.current = true;
      setRenderSettingsPending(true);
      setRenderSettingsError(null);
      setRenderSettingsDiagnostic(null);
      renderSettingsRef.current = normalized;
      setRenderSettings(normalized);
      try {
        if (isMobile) await TarvenEnv.setRenderEngineSettings(normalized);
      } catch (error) {
        renderSettingsRef.current = previous;
        setRenderSettings(previous);
        const friendly = `设置保存失败：${humanizeNativeError(error)}`;
        const context = createDiagnosticContext(error, {
          area: "settings",
          stage: "save-render-settings",
          platform: platformTag,
          userMessage: friendly,
        });
        setRenderSettingsError(friendly);
        setRenderSettingsDiagnostic(context);
        reportGlobalError(error, {
          area: "settings",
          stage: "save-render-settings",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
        });
      } finally {
        renderSavePending.current = false;
        setRenderSettingsPending(false);
      }
    },
    [isMobile, canPreviewRenderSettings, platformTag],
  );
  useEffect(() => {
    if (!isMobile) return;
    let cancelled = false;
    const generation = renderSettingsGeneration.current;
    TarvenEnv.getRenderEngineSettings()
      .then((settings) => {
        if (cancelled || generation !== renderSettingsGeneration.current || renderSavePending.current) return;
        const normalized = normalizeRenderEngineSettings(settings);
        renderSettingsRef.current = normalized;
        setRenderSettings(normalized);
        renderHydrated.current = true;
        setRenderSettingsError(null);
        setRenderSettingsDiagnostic(null);
      })
      .catch((error) => {
        if (cancelled || generation !== renderSettingsGeneration.current) return;
        const friendly = `设置读取失败：${humanizeNativeError(error)}`;
        const context = createDiagnosticContext(error, {
          area: "settings",
          stage: "load-render-settings",
          platform: platformTag,
          userMessage: friendly,
        });
        setRenderSettingsError(friendly);
        setRenderSettingsDiagnostic(context);
        reportGlobalError(error, {
          area: "settings",
          stage: "load-render-settings",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isMobile, platformTag]);
  const [contentOpenMode, setContentOpenMode] = useState<ContentOpenMode>("webview");
  const [uiScale, setUiScale] = useState<number>(() => (isOnboardingSandbox ? 1 : loadUiScale()));
  const handleUiScaleChange = useCallback((scale: number) => {
    const applied = applyUiScale(saveUiScale(scale));
    setUiScale(applied);
  }, []);
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appUpdateState, setAppUpdateState] = useState<"idle" | "checking" | "current" | "available" | "error">("idle");
  const [appUpdateError, setAppUpdateError] = useState<string | null>(null);
  const [appUpdateDiagnostic, setAppUpdateDiagnostic] = useState<DiagnosticContext | null>(null);
  const [updatePromptDismissed, setUpdatePromptDismissed] = useState(false);
  const [updateBannerRight, setUpdateBannerRight] = useState(28);
  const [verDropdownOpen, setVerDropdownOpen] = useState(false);
  const [isVerDropdownClosing, setIsVerDropdownClosing] = useState(false);
  const [verDropdownPos, setVerDropdownPos] = useState({ bottom: 0, left: 0, width: 0, maxHeight: 360 });
  const carouselRef = useRef<InstanceCarouselRef>(null);
  const terminalBtnRef = useRef<HTMLButtonElement>(null);
  const settingsBtnRef = useRef<HTMLButtonElement>(null);
  const cardMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managePanelOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const managePanelCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renameSavingRef = useRef(false);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const [terminalPos, setTerminalPos] = useState({ left: 16, right: 16 });

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

  // 管理面板 draftConfig/draftPort(保存前不写入 instances)
  const [draftConfig, setDraftConfig] = useState<InstanceConfig>(DEFAULT_CONFIG);
  const [draftPort, setDraftPort] = useState(8000);
  const [draftRemoteAuthEnabled, setDraftRemoteAuthEnabled] = useState(false);
  const [draftRemoteAuthUsername, setDraftRemoteAuthUsername] = useState("");
  const [draftRemoteAuthPassword, setDraftRemoteAuthPassword] = useState("");
  const [storedRemoteAuthUsername, setStoredRemoteAuthUsername] = useState("");
  const [manageSaveError, setManageSaveError] = useState<string | null>(null);
  const [manageSaveDiagnostic, setManageSaveDiagnostic] = useState<DiagnosticContext | null>(null);
  const [isSavingManagePanel, setIsSavingManagePanel] = useState(false);
  // 清理垃圾
  const [showCleanPanel, setShowCleanPanel] = useState(false);
  const [isCleanPanelClosing, setIsCleanPanelClosing] = useState(false);
  const [garbageItems, setGarbageItems] = useState<GarbageItem[]>([]);
  const [garbageError, setGarbageError] = useState<string | null>(null);
  const [garbageDiagnostic, setGarbageDiagnostic] = useState<DiagnosticContext | null>(null);
  const [cleaningGarbage, setCleaningGarbage] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<TavernInstance | null>(null);
  const [isDeleteDialogClosing, setIsDeleteDialogClosing] = useState(false);
  const deleteCloseTimerRef = useRef<number | null>(null);
  const [isDeletingInstance, setIsDeletingInstance] = useState(false);
  const [deleteInstanceError, setDeleteInstanceError] = useState<string | null>(null);
  const [deleteDiagnostic, setDeleteDiagnostic] = useState<DiagnosticContext | null>(null);

  useEffect(() => () => {
    if (deleteCloseTimerRef.current !== null) {
      window.clearTimeout(deleteCloseTimerRef.current);
      deleteCloseTimerRef.current = null;
    }
  }, []);

  const openDeleteDialog = useCallback((inst: TavernInstance) => {
    if (deleteCloseTimerRef.current !== null) {
      window.clearTimeout(deleteCloseTimerRef.current);
      deleteCloseTimerRef.current = null;
    }
    setIsDeleteDialogClosing(false);
    setDeleteInstanceError(null);
    setDeleteDiagnostic(null);
    setPendingDelete(inst);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    if (!pendingDelete || isDeletingInstance || isDeleteDialogClosing) return;
    if (deleteCloseTimerRef.current !== null) {
      window.clearTimeout(deleteCloseTimerRef.current);
    }
    setIsDeleteDialogClosing(true);
    deleteCloseTimerRef.current = window.setTimeout(() => {
      deleteCloseTimerRef.current = null;
      setPendingDelete(null);
      setDeleteInstanceError(null);
      setDeleteDiagnostic(null);
      setIsDeleteDialogClosing(false);
    }, PANEL_EXIT_MS);
  }, [isDeleteDialogClosing, isDeletingInstance, pendingDelete]);

  const interactionLocks: readonly [boolean, boolean][] = [
    [showRelocateModal, isRelocateModalClosing],
    [showBgPanel, isPanelClosing],
    [showTerminal, isTerminalClosing],
    [showLaunchPanel, isLaunchPanelClosing],
    [isUnlockModalOpen, isUnlockModalClosing],
    [Boolean(activeCardMenu), isCardMenuClosing],
    [Boolean(showManagePanel), isManagePanelClosing],
    [showAppMenu, isAppMenuClosing],
    [showNewInstancePanel, isNewInstancePanelClosing],
    [verDropdownOpen, isVerDropdownClosing],
    [showCleanPanel, isCleanPanelClosing],
    [Boolean(pendingDelete), isDeleteDialogClosing],
    [Boolean(maintenanceInstance), isMaintenanceClosing],
  ];
  const isBackgroundInteractionBlocked =
    isCreatingInstance || interactionLocks.some(([open, closing]) => open || closing);
  const isBackgroundInteractionClosing =
    isBackgroundInteractionBlocked
    && !isCreatingInstance
    && !interactionLocks.some(([open, closing]) => open && !closing);
  const isPullGestureBlocked = isBackgroundInteractionBlocked
    || showOnboarding
    || Boolean(renamingId || isRenameClosing);

  useEffect(() => {
    TarvenEnv.setPullToRefresh({
      enabled: pullToRefresh && !isPullGestureBlocked,
    }).catch(() => {});
    if (!isPullGestureBlocked) return;
    isPulling.current = false;
    setPullDistance(current => current === 0 ? current : 0);
  }, [pullToRefresh, isPullGestureBlocked]);

  const isLight = bgMode === "custom" && themeStyle === "light";
  const isDynamic = bgMode === "dynamic";

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return instances.filter(t => (t.subtitle || t.name).toLowerCase().includes(query));
  }, [instances, searchQuery]);

  const terminalInstance = terminalInstanceId
    ? instances.find(instance => instance.id === terminalInstanceId) || null
    : null;
  const activeInstance = (() => {
    if (activeSlide === createCardSlot) return null;
    const instanceIndex = activeSlide - (activeSlide > createCardSlot ? 1 : 0);
    return instances[instanceIndex] || null;
  })();
  const terminalDisplayTitle = terminalInstance
    ? `${terminalInstance.subtitle || terminalInstance.name} · 实例终端`
    : terminalTitle;
  const terminalDisplayPrompt = terminalInstance
    ? (isWindows ? `${terminalInstance.installDir || terminalInstance.id}>` : (isIOS ? "ios >" : "~ $"))
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
  }, []);

  useEffect(() => {
    if (!isWindows) return;
    TarvenEnv.getContentOpenMode()
      .then(({ mode }) => setContentOpenMode(mode))
      .catch(() => setContentOpenMode("webview"));
  }, [isWindows]);

  const checkForAppUpdate = useCallback(async (options?: { interactive?: boolean }) => {
    if (isOnboardingSandbox) return null;
    setAppUpdateState("checking");
    setAppUpdateError(null);
    setAppUpdateDiagnostic(null);
    try {
      const result = await fetchAppUpdate(APP_VERSION, isWindows ? "windows" : Capacitor.getPlatform() === "ios" ? "ios" : isWeb ? "web" : "android");
      setAppUpdateInfo(result);
      setAppUpdateState(result.updateAvailable ? "available" : "current");
      if (result.updateAvailable) setUpdatePromptDismissed(false);
      return result;
    } catch (error) {
      console.warn("[checkAppUpdate]", error);
      const friendly = humanizeNativeError(error);
      const context = createDiagnosticContext(error, {
        area: "update",
        stage: "check-update",
        platform: platformTag,
        userMessage: friendly,
      });
      setAppUpdateError(friendly);
      setAppUpdateDiagnostic(context);
      setAppUpdateState("error");
      if (options?.interactive) {
        reportGlobalError(error, {
          area: "update",
          stage: "check-update",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
        });
      }
      return null;
    }
  }, [isWindows, isWeb, platformTag]);

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
        setUpdateBannerRight(Math.max(0, Math.round(toUnscaledPx(window.innerWidth - el.getBoundingClientRect().right))));
      }
    };
    updateRight();
    window.addEventListener("resize", updateRight);
    return () => window.removeEventListener("resize", updateRight);
  }, [appUpdateState, uiScale]);

  // 支持通过 URL 参数直接唤起向导指定面板
  useEffect(() => {
    try {
      if (typeof window !== "undefined" && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const wizardParam = params.get("wizard") || params.get("mode") || params.get("tab");
        if (wizardParam === "1" || wizardParam === "local") {
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

  // 液态玻璃底色:动态偏红紫,黑夜保持 #1a1625 深蓝紫,白天白色。黑夜不再用近黑 #0d0d12。
  const glassBg = isLight
    ? "bg-white/70 shadow-[0_16px_60px_rgba(0,0,0,0.10)]"
    : isDynamic
      ? "bg-[#1c1420]/70 shadow-[0_16px_60px_rgba(0,0,0,0.30)]"
      : "bg-[#1a1625]/80 shadow-[0_16px_60px_rgba(26,22,37,0.45)]";



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
    if (isShowcase || previewModeRef.current) return;
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

  const switchInstanceMode = useCallback((mode: "local" | "remote") => {
    if (newInstanceMode === mode) return;
    setNewInstanceMode(mode);
  }, [newInstanceMode]);

  useEffect(() => {
    directoryPickerGeneration.current += 1;
    return () => { directoryPickerGeneration.current += 1; };
  }, [showNewInstancePanel, newInstanceMode]);

  useEffect(() => {
    if (!showNewInstancePanel || !(isAndroid || isIOS)) return;
    if (isIOS && newInstanceMode !== "local") return;
    const generation = directoryPickerGeneration.current;
    let cancelled = false;
    TarvenEnv.getAppSettings()
      .then((settings) => {
        if (cancelled || generation !== directoryPickerGeneration.current) return;
        const raw = settings?.configuredInstancesRoot?.trim();
        if (!raw) return;
        const saved = isIOS ? raw : cleanInstallPath(raw);
        if (!saved) return;
        setNewInstanceDir((current) => {
          if (cancelled || current.trim()) return current;
          if (isIOS) setNewInstancePathMode("root");
          return saved;
        });
      })
      .catch(() => { /* Keep directory selection required when settings are unavailable. */ });
    return () => { cancelled = true; };
  }, [isAndroid, isIOS, newInstanceMode, showNewInstancePanel]);

  const handleSetNewInstanceDir = useCallback((value: string) => {
    const clean = value.replace(/^["']|["']$/g, "").trim();
    directoryPickerGeneration.current += 1;
    setNewInstanceDir(clean);
    setNewInstancePathMode("exact");
    setNewInstanceError(null);
    setNewInstanceDiagnostic(null);
  }, []);

  // 向导中的存放位置一律是"实例存放文件夹"（父目录）：先落成实例根；
  // 再取它的一级子目录作为实例目录。根更新失败时抛中文原因，绝不静默继续。
  const resolveInstanceParent = useCallback(async (
    rawValue: string, emptyMessage: string, instanceName: string,
  ): Promise<string> => {
    const parent = instanceParentPath(rawValue);
    if (!parent) throw new ClientValidationError(emptyMessage);
    try {
      await TarvenEnv.setInstancesRoot({ path: parent });
    } catch (error) {
      const reason = humanizeNativeError(error);
      const wrapped = new Error(`该文件夹不能作为实例存放位置：${reason}`) as Error & { cause?: unknown; code?: unknown };
      wrapped.cause = error;
      if (typeof error === "object" && error !== null && "code" in error) {
        wrapped.code = (error as { code?: unknown }).code;
      }
      throw wrapped;
    }
    return buildInstanceSubfolder(parent, instanceName);
  }, []);

  const handlePickInstallFolder = useCallback(async () => {
    const generation = ++directoryPickerGeneration.current;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const rawSelection = await TarvenEnv.pickDirectory({ purpose: "installation" });
      if (generation !== directoryPickerGeneration.current) return;
      const elapsedMs = Math.max(
        0,
        Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)
      );
      if (!rawSelection?.path?.trim()) {
        throw new Error(
          isIOS && elapsedMs < 800
            ? "PICKER_ABNORMAL_DISMISS: System picker dismissed without selection"
            : "No directory was selected"
        );
      }
      const selection = installationSelection(rawSelection);
      setNewInstanceDir(selection.path);
      setNewInstancePathMode(selection.mode);
      setNewInstanceError(null);
      setNewInstanceDiagnostic(null);
      if (isAndroid) {
        try {
          await TarvenEnv.setInstancesRoot({ path: selection.path });
        } catch (error) {
          const reason = humanizeNativeError(error);
          const friendly = `该文件夹不能作为实例存放位置：${reason}`;
          const context = createDiagnosticContext(error, {
            area: "picker",
            stage: "set-instances-root",
            platform: platformTag,
            userMessage: friendly,
            extraSecrets: [selection.path, newInstanceName],
          });
          setNewInstanceDir("");
          setNewInstanceError(friendly);
          setNewInstanceDiagnostic(context);
          reportGlobalError(error, {
            area: "picker",
            stage: "set-instances-root",
            platform: platformTag,
            userMessage: friendly,
            diagnostic: context,
            extraSecrets: [selection.path, newInstanceName],
          });
        }
      }
    } catch (error) {
      if (generation !== directoryPickerGeneration.current) return;
      const elapsedMs = Math.max(
        0,
        Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)
      );
      if (shouldShowDirectoryPickerError(error, isIOS)) {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "picker",
          platform: platformTag,
          elapsedMs,
          userMessage: friendly,
          extraSecrets: [newInstanceName, newInstanceDir],
        });
        setNewInstanceError(friendly);
        setNewInstanceDiagnostic(context);
        reportGlobalError(error, {
          area: "picker",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [newInstanceName, newInstanceDir],
        });
      }
    }
  }, [isAndroid, isIOS, newInstanceDir, newInstanceName, platformTag]);

  // 实例列表持久化到 localStorage
  useEffect(() => {
    if (!isShowcase && !previewModeRef.current) saveInstances(instances);
  }, [instances, isShowcase]);

  const remoteTargets = useMemo(
    () => instances
      .filter((t): t is TavernInstance & { url: string } => t.type === "remote" && Boolean(t.url))
      .map((t) => ({ id: t.id, url: t.url, username: t.basicAuth?.username || "" })),
    [instances],
  );
  const remoteTargetsKey = useMemo(
    () => remoteTargets.map((t) => `${t.id}\0${t.url}\0${t.username}`).join("\n"),
    [remoteTargets],
  );
  const remoteTargetsRef = useRef(remoteTargets);
  remoteTargetsRef.current = remoteTargets;

  // 远程实例在线状态检测(用原生 pingUrl 绕过 WebView CORS)
  const checkRemoteStatus = useCallback(async () => {
    const remotes = remoteTargetsRef.current;
    if (remotes.length === 0) return;
    const results = await Promise.all(remotes.map(async (r) => {
      try {
        const res = await TarvenEnv.pingUrl({ url: r.url, instanceId: r.id });
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
  }, [remoteTargetsKey]);

  // 启动时 + 每15s 轮询（仅存在远程实例时触发）
  useEffect(() => {
    if (remoteTargets.length === 0) return;
    checkRemoteStatus();
    const interval = setInterval(checkRemoteStatus, 15000);
    return () => clearInterval(interval);
  }, [checkRemoteStatus, remoteTargets.length]);

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
    if (!isShowcase && !previewModeRef.current) saveInstances(newInstances);
  }, [isShowcase]);

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
    if (!pullToRefresh || isRefreshing || isPullGestureBlocked) return;
    // 输入框/文本域/内容可编辑元素不触发下拉刷新
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    touchStartY.current = e.touches[0].clientY;
    touchStartX.current = e.touches[0].clientX;
    isPulling.current = true;
  }, [pullToRefresh, isRefreshing, isPullGestureBlocked]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPullGestureBlocked) {
      e.preventDefault();
      isPulling.current = false;
      setPullDistance(current => current === 0 ? current : 0);
      return;
    }
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
  }, [pullToRefresh, isRefreshing, isPullGestureBlocked]);

  const onTouchEnd = useCallback(() => {
    if (!pullToRefresh || isPullGestureBlocked) {
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
  }, [pullToRefresh, pullDistance, handlePullRefresh, isPullGestureBlocked]);

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

  // 配置并启动本地实例。创建流程只在确认服务可访问后写入卡片；
  // createIntent 仅创建向导为 true：安装源与预装项只随创建下发，启动既有实例绝不携带，
  // 后端据此在目录丢失/损坏时拒绝静默重装顶替用户数据。
  const lastLaunchCreateIntentRef = useRef(false);
  const doLaunch = useCallback(async (
    instance: TavernInstance,
    operation: OperationContext,
    enterWhenReady = true,
    createIntent = false
  ) => {
    operation.assertCurrent();
    lastLaunchCreateIntentRef.current = createIntent;
    const port = instance.port ?? 8000;
    const instanceId = instance.installDir || instance.id;
    const version = instance.version || "stable";
    const config = instance.config ?? DEFAULT_CONFIG;
    const zipballUrl = createIntent ? instance.zipballUrl : undefined;
    const localZipPath = createIntent ? instance.localZipPath : undefined;
    const installPath = instance.installPath;
    const companionPreset = createIntent ? instance.companionPreset : undefined;
    const preinstall = createIntent ? instance.preinstall : undefined;

    setLaunchProgress({ pct: 0, text: "初始化" });
    setLaunchError(null);
    setLaunchDiagnostic(null);
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
    const timeoutTracker = new ProvisionTimeoutTracker();

      await operation.listen(TarvenEnv.addListener("progress", d => {
        if (d.source === "command" || !operation.accepts(d)) return;
        timeoutTracker.touch();
        const pct = d.percent ?? 0;
        const text = formatOperationStage(d.stage, pct);
        setLaunchProgress(previous => {
          if (previous?.pct === pct && previous.text === text) return previous;
          return { pct, text };
        });
      }));

      await operation.listen(TarvenEnv.addListener("log", d => {
        if (d.source === "command" || !operation.accepts(d)) return;
        timeoutTracker.touch();
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
        port,
        instanceId,
        instanceName: instance.subtitle || instance.name,
        operationId: operation.id,
        version,
        createIntent,
        zipballUrl,
        localZipPath,
        installPath,
        installPathMode: instance.installPathMode,
        companionPreset,
        preinstall,
        config,
      }));
      const failureResolution = resolveProvisionFailure(provisionResult, errorMsg);
      if (failureResolution.kind === "cancelled") {
        throw new OperationCancelledError();
      }
      if (failureResolution.kind === "error") {
        throw new Error(failureResolution.message);
      }
      if (provisionResult?.ready === true) readyReceived = true;
      timeoutTracker.touch();

      while (!readyReceived && !errorMsg && timeoutTracker.check() === "active") {
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
        const timeoutStatus = timeoutTracker.check();
        throw new Error(
          formatProvisionTimeoutError(
            timeoutStatus === "total-timeout" ? "total-timeout" : "idle-timeout"
          )
        );
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
    if (isWeb) {
      await operation.delay(250);
      setLaunchProgress({ pct: 100, text: "远程实例已打开" });
      setLaunchLogs(prev => [...prev, { msg: "远程实例连接正常 (浏览器演示)", level: "success" }]);
      return;
    }
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
  }, [contentOpenMode, isWeb, setLaunchLogs]);

  // 启动实例直接执行入口 (跳过密码阻断，在已完成密码校验或无密码时调用)
  const launchTavernDirect = useCallback(async (instance: TavernInstance) => {
    if (operations.busy) return;
    const operation = operations.begin(instance.installDir || instance.id, "launch");
    setLaunchLogKey(operation.logKey);
    setLaunchError(null);
    setLaunchDiagnostic(null);
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
        if (isWeb) {
          setInstances(prev => prev.map(t => t.id === instance.id ? { ...t,
            status: "running",
            port: result.port,
          } : t));
        } else {
          const info = await operation.wait(TarvenEnv.getInstanceInfo({
            instanceId: instance.installDir || instance.id,
            installPath: instance.installPathMode === "root" ? undefined : instance.installPath,
            port: result.port,
          }));
          setInstances(prev => prev.map(t => t.id === instance.id ? { ...t,
            status: "running",
            port: result.port,
            version: info.version && info.version !== "unknown" ? normalizeStoredVersion(info.version) : t.version,
            installPath: info.path || t.installPath,
            installPathMode: info.path ? "exact" : t.installPathMode,
            createdAt: info.createdAt ? formatNativeDate(info.createdAt) : t.createdAt,
            lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : t.lastUsed,
            totalUsage: info.totalUsageMs !== undefined ? formatUsageDuration(info.totalUsageMs) : t.totalUsage,
          } : t));
        }
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
      const isValidation = err instanceof ClientValidationError;
      const msg = isValidation ? err.message : humanizeNativeError(err);
      const diagnostic = isValidation
        ? null
        : createDiagnosticContext(err, {
            area: "launch",
            platform: platformTag,
            userMessage: msg,
            extraSecrets: [instance.subtitle, instance.name, instance.installPath, instance.url],
          });
      setLaunchError(msg);
      setLaunchDiagnostic(diagnostic);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `失败: ${msg}`, level: "error" }]);
      setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "error" } : t));
      if (diagnostic) {
        reportGlobalError(err, {
          area: "launch",
          platform: platformTag,
          userMessage: msg,
          diagnostic,
          extraSecrets: [instance.subtitle, instance.name, instance.installPath, instance.url],
        });
      }
      if (!isWeb) {
        try { await operation.wait(TarvenEnv.exitImmersive()); } catch {}
      }
    } finally {
      if (operation.isCurrent) {
        operation.finish();
        setLaunchingId(null);
      }
    }
  }, [operations, doLaunch, isWeb, openRemoteInstance, platformTag, setLaunchLogs]);

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
    if (isWeb) return;
    const expected = operations.current;
    try {
      if (expected) await expected.wait(TarvenEnv.returnToTavern());
      else await TarvenEnv.returnToTavern();
    } catch (error) {
      if (error instanceof OperationCancelledError || operations.current !== expected) return;
      // 容错或浏览器环境 fallback
      await launchTavern(instance);
    }
  }, [isWeb, launchTavern, operations]);

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
    if (!isWeb) {
      try {
        await TarvenEnv.closeTavern({ instanceId, operationId: cancelled?.id });
      } catch (error) {
        const friendly = humanizeNativeError(error);
        instanceLogs.append(instanceId, { msg: `停止失败: ${friendly}`, level: "error" });
        reportGlobalError(error, {
          area: "launch",
          stage: "stop-instance",
          platform: platformTag,
          userMessage: `停止实例失败：${friendly}`,
          extraSecrets: [instance.subtitle, instance.name, instance.installPath],
        });
        return;
      }
    }
    if (operations.current !== remainingOperation) return;
    setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "stopped" } : t));
  }, [isWeb, operations, platformTag]);

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

    const result = await doLaunch(instance, operation, false, true);
    const info = await operation.wait(TarvenEnv.getInstanceInfo({
      instanceId: instance.installDir || instance.id,
      installPath: instance.installPathMode === "root" ? undefined : instance.installPath,
      port: result.port,
    }));
    if (!info.path) throw new Error("原生未确认实例的实际安装目录，创建未完成");
    // 安装源（zipballUrl/localZipPath）与预装项是一次性创建参数，绝不持久化到卡片。
    // 后端以 createIntent 区分创建与启动意图，卡片残留安装源会导致数据丢失时被静默重装顶替。
    const { zipballUrl: _zipballUrl, localZipPath: _localZipPath, preinstall: _preinstall, companionPreset: _companionPreset, ...persistedInstance } = instance;
    setLastLaunchParams({ ...persistedInstance, installPath: info.path, installPathMode: "exact", port: result.port });
    setInstances(prev => prev.some(t => t.id === instance.id)
      ? prev
      : [...prev, {
          ...persistedInstance,
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

  const createInstance = useCallback(async () => {
    if (operations.busy) {
      setNewInstanceError("请先等待当前任务完成，再创建新实例");
      setNewInstanceDiagnostic(null);
      return;
    }
    if ((isAndroid || isIOS) && newInstanceMode === "local" && !cleanInstallPath(newInstanceDir)) {
      setNewInstanceError(
        isIOS
          ? "请先点「浏览」选择实例安装目录（必选）"
          : "请先选择实例存放文件夹（必选）：点击「浏览」选择后，实例会创建在该文件夹下"
      );
      setNewInstanceDiagnostic(null);
      return;
    }
    if (newInstanceMode === "local") {
      const pathIssue = validateInstallPathInput(newInstanceDir, { isIOS });
      if (pathIssue) {
        setNewInstanceError(pathIssue);
        setNewInstanceDiagnostic(null);
        return;
      }
    }
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
        setNewInstanceDiagnostic(null);
        return;
      }
      instanceDisplayName = rawGivenName;
      safeCandidateId = isIOS ? normalizeInstanceIdentity(rawGivenName) : sanitizeFolderName(rawGivenName);
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
      safeCandidateId = isIOS ? normalizeInstanceIdentity(chosenName) : sanitizeFolderName(chosenName);
    }

    let candidateId = safeCandidateId;
    let counter = 2;
    const existingIds = new Set(instances.map(i => (i.installDir || i.id).toLowerCase()));
    while (existingIds.has(candidateId.toLowerCase())) {
      candidateId = isIOS ? `${safeCandidateId.slice(0, 120)}-${counter++}` : `${safeCandidateId} (${counter++})`;
    }
    const instanceId = candidateId;
    const operation = operations.begin(instanceId, "create");
    setNewInstanceError(null);
    setNewInstanceDiagnostic(null);
    setIsCreatingInstance(true);
    let operationStarted = false;
    let remoteCredentialsSaved = false;
    let pendingInstanceId: string | null = null;
    let effectiveInstallPathForReport: string | undefined;

    try {
      const installDir = instanceId;
      pendingInstanceId = instanceId;
      const customParentDir = cleanInstallPath(newInstanceDir);
      const resolvedCustomPath = (newInstanceMode === "local" && isAndroid)
        ? await resolveInstanceParent(newInstanceDir, "请先选择实例存放文件夹（必选）：点击「浏览」选择后，实例会创建在该文件夹下", instanceDisplayName)
        : (customParentDir ? exactInstallTarget(customParentDir, newInstancePathMode, instanceId) : undefined);
      effectiveInstallPathForReport = resolvedCustomPath || undefined;
      let selectedVersion = newInstanceVersion;
      let selectedZipballUrl: string | undefined;
      const selectedLocalZip = isIOS ? undefined : (newInstanceLocalZip || undefined);

      if (newInstanceMode === "local" && !selectedLocalZip) {
        let availableReleases = releases;
        if (availableReleases.length === 0) {
          try {
            const response = await operation.wait(TarvenEnv.fetchReleases());
            availableReleases = response.releases || [];
            setReleases(availableReleases);
          } catch (error) {
            if (error instanceof OperationCancelledError) throw error;
            throw (error instanceof Error ? error : new Error("无法获取 SillyTavern 版本，请重新获取列表或导入本地 ZIP"));
          }
        }
        const selectedRelease = selectTavernRelease(availableReleases, selectedVersion);
        selectedVersion = selectedRelease.tag;
        selectedZipballUrl = selectedRelease.zipballUrl;
      }

      let port = 8000;
      const occupiedPorts = new Set(instances.filter(t => t.type === "local").map(t => t.port ?? 8000));
      while (occupiedPorts.has(port)) port += 1;

      let remoteUrl = newInstanceUrl.trim();
      if (newInstanceMode === "remote") {
        let parsed: URL;
        try {
          parsed = new URL(remoteUrl);
        } catch {
          throw new ClientValidationError("连接地址格式无效，请检查后重试");
        }
        if (!["http:", "https:"].includes(parsed.protocol)) {
          throw new ClientValidationError("连接地址必须使用 HTTP 或 HTTPS");
        }
        if (parsed.username || parsed.password) {
          throw new ClientValidationError("请不要把账号密码写入连接地址，改用下方的 Basic Auth 配置");
        }
        remoteUrl = parsed.toString();
        if (newRemoteAuthEnabled) {
          if (!newRemoteAuthUsername.trim()) throw new ClientValidationError("请输入 Basic Auth 用户名");
          if (!newRemoteAuthPassword) throw new ClientValidationError("请输入 Basic Auth 密码");
        }
        const preflight = await operation.wait(TarvenEnv.pingUrl({
          url: remoteUrl,
          ...(newRemoteAuthEnabled
            ? { username: newRemoteAuthUsername.trim(), password: newRemoteAuthPassword }
            : {}),
        }));
        if (!preflight.online) throw new Error(preflight.error || "远程实例当前不可访问");
      }

      const effectiveInstallPath = resolvedCustomPath || undefined;

      // 物理防覆盖预检：目标目录不能与已有本地实例冲突
      if (effectiveInstallPath) {
        const normTarget = effectiveInstallPath.toLowerCase().replace(/[\\/]+$/, "");
        const conflictingInstance = instances.find(inst => {
          if (inst.type !== "local" || !inst.installPath) return false;
          return inst.installPath.toLowerCase().replace(/[\\/]+$/, "") === normTarget;
        });
        if (conflictingInstance) {
          throw new ClientValidationError(`目标路径「${effectiveInstallPath}」已被实例「${conflictingInstance.subtitle || conflictingInstance.name}」使用，无法重复创建`);
        }
      }

      const allowPreinstall = newInstanceMode === "local";

      const instance: TavernInstance = {
        id: instanceId,
        name: "SillyTavern",
        subtitle: instanceDisplayName,
        version: selectedLocalZip ? "local" : normalizeStoredVersion(selectedVersion),
        type: newInstanceMode === "remote" ? "remote" : "local",
        status: newInstanceMode === "remote" ? "offline" : "stopped",
        icon: newInstanceMode === "remote" ? <Cloud className="w-5 h-5" /> : <Folder className="w-5 h-5" />,
        color: "#6366f1",
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
              localZipPath: selectedLocalZip,
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

      if (newInstanceMode === "local" && newInstancePathMode === "root" && customParentDir) {
        void TarvenEnv.setInstancesRoot({ path: customParentDir }).catch(() => {});
      }

      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      setVerDropdownOpen(false);
      setOperationPurpose("create");
      setLastLaunchParams(instance);
      setLaunchLogKey(operation.logKey);
      setShowLaunchPanel(true);
      setLaunchError(null);
      setLaunchDiagnostic(null);
      setLaunchProgress({
        pct: 0,
        text: newInstanceMode === "local"
          ? "准备下载当前版本"
          : "准备检查连接"
      });
      setLaunchingId(instance.id);
      operationStarted = true;

      await provisionCreatedInstance(instance, operation);
      setNewInstanceName("");
      setNewInstanceDir("");
      setNewInstancePathMode("exact");
      setNewInstanceDiagnostic(null);
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
      const isValidation = err instanceof ClientValidationError;
      const message = isValidation ? err.message : humanizeNativeError(err);
      const diagnostic = isValidation
        ? null
        : createDiagnosticContext(err, {
            area: "create",
            platform: platformTag,
            userMessage: message,
            extraSecrets: [
              instanceDisplayName,
              newInstanceDir,
              effectiveInstallPathForReport,
              newInstanceUrl,
              newInstanceLocalZip,
              newRemoteAuthUsername,
              newRemoteAuthPassword,
            ],
          });
      if (!operationStarted) {
        if (remoteCredentialsSaved && pendingInstanceId) {
          try { await operation.wait(TarvenEnv.clearRemoteBasicAuth({ instanceId: pendingInstanceId })); } catch {}
          if (!operation.isCurrent) return;
        }
        setNewInstanceError(message);
        setNewInstanceDiagnostic(diagnostic);
      } else {
        setLaunchError(message);
        setLaunchDiagnostic(diagnostic);
        setLaunchProgress(null);
        setLaunchLogs(prev => [...prev, { msg: `创建失败: ${message}`, level: "error" }]);
      }
      if (diagnostic) {
        reportGlobalError(err, {
          area: "create",
          platform: platformTag,
          userMessage: message,
          diagnostic,
          extraSecrets: [
            instanceDisplayName,
            newInstanceDir,
            effectiveInstallPathForReport,
            newInstanceUrl,
            newInstanceLocalZip,
            newRemoteAuthUsername,
            newRemoteAuthPassword,
          ],
        });
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
    isIOS,
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
    platformTag,
    provisionCreatedInstance,
    resolveInstanceParent,
    setLaunchLogs,
    releases,
  ]);

  // 重试当前操作
  const retryLaunch = useCallback(async () => {
    if (!lastLaunchParams || operations.busy) return;
    const operation = operations.begin(lastLaunchParams.installDir || lastLaunchParams.id, operationPurpose);
    setLaunchLogKey(operation.logKey);
    setLaunchError(null);
    setLaunchDiagnostic(null);
    setLaunchProgress({ pct: 0, text: operationPurpose === "create" ? "重新创建" : "重新启动" });
    if (operationPurpose === "launch" && lastLaunchParams.type === "local") {
      setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running" } : t));
    }
    setLaunchingId(lastLaunchParams.id);
    try {
      if (operationPurpose === "create") {
        await provisionCreatedInstance(lastLaunchParams, operation);
      } else if (lastLaunchParams.type === "remote") {
        await openRemoteInstance(lastLaunchParams, operation);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "online" } : t));
        operation.schedule(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 500);
      } else {
        const result = await doLaunch(lastLaunchParams, operation, true, lastLaunchCreateIntentRef.current);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running", port: result.port } : t));
        operation.schedule(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 800);
      }
    } catch (err: any) {
      if (!operation.isCurrent || err instanceof OperationCancelledError) return;
      const isValidation = err instanceof ClientValidationError;
      const msg = isValidation ? err.message : humanizeNativeError(err);
      const diagnostic = isValidation
        ? null
        : createDiagnosticContext(err, {
            area: operationPurpose === "create" ? "create" : "launch",
            platform: platformTag,
            userMessage: msg,
            extraSecrets: [
              lastLaunchParams.subtitle,
              lastLaunchParams.name,
              lastLaunchParams.installPath,
              lastLaunchParams.url,
            ],
          });
      setLaunchError(msg);
      setLaunchDiagnostic(diagnostic);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `重试失败: ${msg}`, level: "error" }]);
      if (operationPurpose === "launch") {
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "error" } : t));
      }
      if (diagnostic) {
        reportGlobalError(err, {
          area: operationPurpose === "create" ? "create" : "launch",
          platform: platformTag,
          userMessage: msg,
          diagnostic,
          extraSecrets: [
            lastLaunchParams.subtitle,
            lastLaunchParams.name,
            lastLaunchParams.installPath,
            lastLaunchParams.url,
          ],
        });
      }
    } finally {
      if (operation.isCurrent) {
        operation.finish();
        setLaunchingId(null);
      }
    }
  }, [lastLaunchParams, operationPurpose, doLaunch, openRemoteInstance, platformTag, provisionCreatedInstance, operations, setLaunchLogs]);

  const closeCardMenu = useCallback((onClosed?: () => void) => {
    if (cardMenuCloseTimerRef.current) clearTimeout(cardMenuCloseTimerRef.current);
    setIsCardMenuClosing(true);
    cardMenuCloseTimerRef.current = setTimeout(() => {
      setActiveCardMenu(null);
      setIsCardMenuClosing(false);
      cardMenuCloseTimerRef.current = null;
      onClosed?.();
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
      if (shouldShowDirectoryPickerError(err, isIOS)) {
        const friendly = humanizeNativeError(err);
        const context = createDiagnosticContext(err, {
          area: "picker",
          stage: "pick-image",
          platform: platformTag,
          userMessage: friendly,
          extraSecrets: [instance.subtitle, instance.name, instance.installPath],
        });
        setManageSaveError(friendly);
        setManageSaveDiagnostic(context);
        reportGlobalError(err, {
          area: "picker",
          stage: "pick-image",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [instance.subtitle, instance.name, instance.installPath],
        });
      }
    }
  }, [isIOS, isWindows, platformTag]);

  const closeInstanceRename = useCallback(() => {
    if (!renamingId || isRenameClosing) return;
    setIsRenameClosing(true);
  }, [isRenameClosing, renamingId]);

  const finishInstanceRename = useCallback(() => {
    setRenamingId(null);
    setRenameValue("");
    setRenameError(null);
    setIsRenameClosing(false);
  }, []);

  const openInstanceRename = useCallback((instance: TavernInstance) => {
    if (instance.status === "running" || renameSavingRef.current) return;
    closeCardMenu(() => {
      setIsRenameClosing(false);
      setRenameValue(instance.subtitle || instance.name);
      setRenameError(null);
      setRenamingId(instance.id);
      setHoveredCard(instance.id);
    });
  }, [closeCardMenu]);

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

  const saveInstanceRename = useCallback(async () => {
    if (!renamingId || !renameValue.trim() || renameSavingRef.current || isRenameClosing) return;
    renameSavingRef.current = true;
    setIsRenamingSaving(true);
    setRenameError(null);
    try {
      const ok = await executeRenameInstance(renamingId, renameValue.trim());
      if (ok) {
        closeInstanceRename();
      } else {
        const message = "重命名未完成，请检查实例状态后重试";
        setRenameError(message);
        reportGlobalError(new Error(message), {
          area: "rename",
          stage: "rename-instance",
          platform: platformTag,
          userMessage: message,
          extraSecrets: [renameValue.trim()],
        });
      }
    } catch (error) {
      const friendly = humanizeNativeError(error);
      setRenameError(friendly);
      reportGlobalError(error, {
        area: "rename",
        stage: "rename-instance",
        platform: platformTag,
        userMessage: friendly,
        extraSecrets: [renameValue.trim()],
      });
    } finally {
      renameSavingRef.current = false;
      setIsRenamingSaving(false);
    }
  }, [renamingId, renameValue, isRenameClosing, executeRenameInstance, closeInstanceRename, platformTag]);

  const cancelInstanceRename = useCallback(() => {
    if (!renameSavingRef.current) closeInstanceRename();
  }, [closeInstanceRename]);

  useEffect(() => {
    if (renamingId && !instances.some(instance => instance.id === renamingId && instance.status !== "running")) {
      finishInstanceRename();
    }
  }, [instances, renamingId, finishInstanceRename]);

  const changeInstanceRename = useCallback((value: string) => {
    setRenameValue(value);
    setRenameError(null);
  }, []);

  const instanceRename = useMemo<InstanceRenameState | undefined>(() => renamingId ? {
    instanceId: renamingId,
    value: renameValue,
    error: renameError,
    saving: isRenamingSaving,
    closing: isRenameClosing,
    onChange: changeInstanceRename,
    onSave: saveInstanceRename,
    onCancel: cancelInstanceRename,
    onClosed: finishInstanceRename,
  } : undefined, [
    renamingId, renameValue, renameError, isRenamingSaving, isRenameClosing,
    changeInstanceRename, saveInstanceRename, cancelInstanceRename, finishInstanceRename,
  ]);

  const openInstanceTerminal = useCallback((instance: TavernInstance) => {
    setTerminalInstanceId(instance.id);
    instanceLogs.append(instance.installDir || instance.id, {
      msg: `${instance.subtitle || instance.name} · 实例终端${instance.type === "remote" ? "（远程实例不支持本地命令）" : ""}`,
      level: "info",
    });
    setIsTerminalClosing(false);
    setShowTerminal(true);
  }, []);

  const closeBgPanel = useCallback(() => {
    if (!showBgPanel || isPanelClosing) return;
    setIsPanelClosing(true);
    setTimeout(() => {
      setShowBgPanel(false);
      setIsPanelClosing(false);
    }, BACKGROUND_PANEL_EXIT_MS);
  }, [isPanelClosing, showBgPanel]);

  const closeTerminalPanel = useCallback(() => {
    if (!showTerminal || isTerminalClosing) return;
    setIsTerminalClosing(true);
    setTimeout(() => {
      setShowTerminal(false);
      setIsTerminalClosing(false);
    }, PANEL_EXIT_MS);
  }, [isTerminalClosing, showTerminal]);

  const handleTerminalButtonClick = useCallback(() => {
    if (isWeb && !isWindows && !isShowcase && !isLocalPreview) return;
    if (showTerminal) {
      closeTerminalPanel();
      return;
    }

    const instance = activeInstance;
    const btn = terminalBtnRef.current;
    const settingsBtn = settingsBtnRef.current;
    if (btn) {
      const rect = btn.getBoundingClientRect();
      const settingsRect = settingsBtn?.getBoundingClientRect();
      const rightEdge = settingsRect ? toUnscaledPx(window.innerWidth - settingsRect.right) : 16;
      setTerminalPos({ left: toUnscaledPx(rect.left), right: Math.max(8, rightEdge) });
    }
    if (!instance) {
      setTerminalInstanceId(null);
      setTerminalLogs([{ msg: "请先选择一个实例，再打开实例终端", level: "info" }]);
      setIsTerminalClosing(false);
      setShowTerminal(true);
      return;
    }
    openInstanceTerminal(instance);
  }, [
    activeInstance,
    closeTerminalPanel,
    isLocalPreview,
    isShowcase,
    isWeb,
    isWindows,
    openInstanceTerminal,
    setTerminalLogs,
    showTerminal,
  ]);

  const handleBackgroundButtonClick = useCallback(() => {
    toggleBgPanel();
  }, [showBgPanel]);

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

  const confirmDeleteInstance = useCallback(async () => {
    if (!pendingDelete || isDeletingInstance) return;
    setIsDeletingInstance(true);
    setDeleteInstanceError(null);

    try {
      let freedBytes = 0;
      if (isWeb) {
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
      } else if (pendingDelete.type === "local") {
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
      setIsDeleteDialogClosing(false);
      setDeleteDiagnostic(null);
      setActiveSlide(current => Math.max(0, Math.min(current, instances.length - 1)));
    } catch (err: any) {
      const friendly = humanizeNativeError(err);
      const context = createDiagnosticContext(err, {
        area: "manage",
        stage: "delete-instance",
        platform: platformTag,
        userMessage: friendly,
        extraSecrets: [pendingDelete.subtitle, pendingDelete.name, pendingDelete.installPath],
      });
      setDeleteInstanceError(friendly);
      setDeleteDiagnostic(context);
      reportGlobalError(err, {
        area: "manage",
        stage: "delete-instance",
        platform: platformTag,
        userMessage: friendly,
        diagnostic: context,
        extraSecrets: [pendingDelete.subtitle, pendingDelete.name, pendingDelete.installPath],
      });
    } finally {
      setIsDeletingInstance(false);
    }
  }, [instances.length, isDeletingInstance, isWeb, pendingDelete, platformTag, operations, setTerminalLogs]);

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
        const friendly = humanizeNativeError(error);
        instanceLogs.append(cancelled.instanceId, {
          msg: `取消失败: ${friendly}`,
          level: "error",
        });
        reportGlobalError(error, {
          area: "launch",
          stage: "cancel-operation",
          platform: platformTag,
          userMessage: `取消操作失败：${friendly}`,
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
      setLaunchDiagnostic(null);
      setLaunchProgress(null);
    }, PANEL_EXIT_MS);
  }, [instances, isLaunchPanelClosing, lastLaunchParams, operationPurpose, operations, platformTag]);

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
    setManageSaveDiagnostic(null);
    setIsSavingManagePanel(true);
    try {
      if (showManagePanel.type === "remote") {
        const username = draftRemoteAuthUsername.trim();
        if (draftRemoteAuthEnabled) {
          if (!username) throw new ClientValidationError("请输入 Basic Auth 用户名");
          if (!draftRemoteAuthPassword && storedRemoteAuthUsername && username !== storedRemoteAuthUsername) {
            throw new ClientValidationError("更改 Basic Auth 用户名时，请重新输入密码");
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
      if (error instanceof ClientValidationError) {
        setManageSaveError(error.message);
        setManageSaveDiagnostic(null);
      } else {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "manage",
          stage: "save-instance",
          platform: platformTag,
          userMessage: friendly,
          extraSecrets: [
            showManagePanel.subtitle,
            showManagePanel.name,
            showManagePanel.installPath,
            showManagePanel.url,
            draftRemoteAuthUsername,
            draftRemoteAuthPassword,
          ],
        });
        setManageSaveError(friendly);
        setManageSaveDiagnostic(context);
        reportGlobalError(error, {
          area: "manage",
          stage: "save-instance",
          platform: platformTag,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [
            showManagePanel.subtitle,
            showManagePanel.name,
            showManagePanel.installPath,
            showManagePanel.url,
            draftRemoteAuthUsername,
            draftRemoteAuthPassword,
          ],
        });
      }
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
    platformTag,
    showManagePanel,
    storedRemoteAuthUsername,
  ]);

  const closeAppMenu = useCallback(() => {
    setIsAppMenuClosing(true);
    setTimeout(() => {
      setShowAppMenu(false);
      setIsAppMenuClosing(false);
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
    if (isOnboardingSandbox) {
      void import("@/components/onboarding/onboarding-runtime").then(({ finishOnboardingSandbox }) => finishOnboardingSandbox());
      return;
    }
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    setShowOnboarding(false);
  }, []);

  const cancelOnboarding = useCallback(() => setShowOnboarding(false), []);

  const prepareOnboardingStep = useCallback((step: GuideStep) => {
    if (!isOnboardingSandbox) return;
    if (step.id === "create-submit") {
      setNewInstanceDir(localStorage.getItem("sillyclient.onboarding.instancesRoot") || "");
    }
    if (step.id === "card-reorder" || step.id === "card-expand" || step.id === "running-card" || step.id === "create-open") {
      if (step.id === "running-card") setHoveredCard(null);
      const targetId = step.id === "create-open" ? null : "onboarding-stopped";
      const targetIndex = targetId === null ? createCardSlot : instances.findIndex((instance) => instance.id === targetId);
      const slot = targetId === null ? targetIndex : targetIndex < createCardSlot ? targetIndex : targetIndex + 1;
      if (slot >= 0) carouselRef.current?.goToSlide(slot);
    }
  }, [createCardSlot, instances]);

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

  const handleInstanceRelocated = useCallback((instanceId: string, resultOrPath: any) => {
    const newPath = typeof resultOrPath === "string" ? resultOrPath : resultOrPath?.newPath || "";
    if (!newPath) return;
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
      if (!isShowcase && !previewModeRef.current) saveInstances(updated);
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

  // 管理面板打开时初始化本地配置或远程认证状态。
  useEffect(() => {
    if (showManagePanel) {
      setDraftConfig(showManagePanel.config ?? DEFAULT_CONFIG);
      setDraftPort(showManagePanel.port ?? 8000);
      setManageSaveError(null);
      setManageSaveDiagnostic(null);
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

  const openVersionDropdown = useCallback((trigger: HTMLElement) => {
    const r = trigger.getBoundingClientRect();
    const top = toUnscaledPx(r.top);
    const left = toUnscaledPx(r.left);
    const width = toUnscaledPx(r.width);
    const vw = toUnscaledPx(window.innerWidth);
    const vh = toUnscaledPx(window.innerHeight);
    setVerDropdownPos({
      bottom: vh - top + 4,
      left: Math.max(8, Math.min(left, vw - width - 8)),
      width,
      maxHeight: Math.max(0, Math.min(360, top - 12)),
    });
    setIsVerDropdownClosing(false);
    setVerDropdownOpen(true);
  }, []);

  const closeNewInstancePanel = useCallback(() => {
    if (isCreatingInstance) return;
    closeVersionDropdown();
    setIsNewInstancePanelClosing(true);
    setTimeout(() => {
      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      setNewInstanceError(null);
      setNewInstanceDiagnostic(null);
    }, PANEL_EXIT_MS);
  }, [closeVersionDropdown, isCreatingInstance]);

  // 统一浮层管理器注册 (ESC 键与 Android 原生物理返回键)
  const { registerLayer } = useLayerStack();

  useEffect(() => {
    if (showBgPanel) return registerLayer("bg_panel", closeBgPanel);
  }, [showBgPanel, registerLayer, closeBgPanel]);

  useEffect(() => {
    if (showTerminal) return registerLayer("terminal", closeTerminalPanel);
  }, [showTerminal, registerLayer, closeTerminalPanel]);

  useEffect(() => {
    if (showAppMenu) return registerLayer("app_menu", closeAppMenu);
  }, [showAppMenu, registerLayer, closeAppMenu]);

  useEffect(() => {
    if (showManagePanel) return registerLayer("manage_panel", closeManagePanel);
  }, [showManagePanel, registerLayer, closeManagePanel]);

  useEffect(() => {
    if (showNewInstancePanel) return registerLayer("new_instance", closeNewInstancePanel);
  }, [showNewInstancePanel, registerLayer, closeNewInstancePanel]);

  useEffect(() => {
    if (showLaunchPanel) return registerLayer("launch_panel", dismissLaunchPanel);
  }, [showLaunchPanel, registerLayer, dismissLaunchPanel]);

  useEffect(() => {
    if (pendingDelete) return registerLayer("delete_confirm", closeDeleteDialog);
  }, [pendingDelete, registerLayer, closeDeleteDialog]);

  useEffect(() => {
    if (renamingId) return registerLayer("instance_rename", cancelInstanceRename);
  }, [renamingId, registerLayer, cancelInstanceRename]);

  useEffect(() => {
    if (verDropdownOpen) return registerLayer("version_dropdown", closeVersionDropdown);
  }, [verDropdownOpen, registerLayer, closeVersionDropdown]);

  useEffect(() => {
    if (activeCardMenu) return registerLayer("card_menu", closeCardMenu);
  }, [activeCardMenu, registerLayer, closeCardMenu]);

  useEffect(() => {
    if (showRelocateModal) return registerLayer("relocate_modal", closeRelocateModal);
  }, [showRelocateModal, registerLayer, closeRelocateModal]);

  useEffect(() => {
    if (isAndroid && showOnboarding && !isOnboardingSandbox) {
      return registerLayer("onboarding", cancelOnboarding);
    }
  }, [isAndroid, showOnboarding, registerLayer, cancelOnboarding]);

  const handleCardMenuOpen = useCallback((instance: TavernInstance, rect: DOMRect) => {
    const bottom = toUnscaledPx(rect.bottom);
    const left = toUnscaledPx(rect.left);
    const vw = toUnscaledPx(window.innerWidth);
    const vh = toUnscaledPx(window.innerHeight);
    setMenuPos({
      top: Math.min(bottom + 6, vh - 200),
      left: Math.max(12, Math.min(left - 60, vw - 160)),
    });
    setActiveCardMenu(instance.id);
    setIsCardMenuClosing(false);
  }, []);

  const resetNewInstanceFields = useCallback((initialName = "") => {
    setNewInstanceMode("local");
    setNewInstanceName(initialName);
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
  }, []);

  const openNewInstancePanel = useCallback(() => {
    if (isWeb && !isShowcase && !isLocalPreview && !import.meta.env.DEV) {
      void openExternalUrl("https://github.com/CAPTCHAAAAA/SillyClient/releases/latest").catch(() => {});
      return;
    }
    resetNewInstanceFields("");
    setNewInstanceError(null);
    setNewInstanceDiagnostic(null);
    setShowNewInstancePanel(true);
  }, [isWeb, isShowcase, isLocalPreview, resetNewInstanceFields]);

  const handleLogoClick = useCallback(() => {
    setLogoFontIndex(prev => (prev + 1) % LOGO_FONTS.length);
  }, []);

  const devCallbacksRef = useRef<{
    openWizard: () => void;
    previewLaunchConsole: (options: LauncherPreviewConsoleOptions) => void;
    dismissPreviewPanels: () => void;
    setMockAppUpdate: (info: AppUpdateInfo | null) => void;
  } | null>(null);

  devCallbacksRef.current = {
    openWizard: () => {
      setShowLaunchPanel(false);
      setIsLaunchPanelClosing(false);
      setShowNewInstancePanel(true);
      setIsNewInstancePanelClosing(false);
    },
    previewLaunchConsole: (options) => {
      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      const logKey = options.instance.installDir || options.instance.id;
      instanceLogs.update(logKey, options.logs);
      setLaunchLogKey(logKey);
      setOperationPurpose(options.purpose);
      setLastLaunchParams(options.instance);
      setLaunchProgress(options.progress);
      setLaunchError(options.error ?? null);
      setLaunchDiagnostic(options.diagnostic ?? null);
      setIsLaunchPanelClosing(false);
      setShowLaunchPanel(true);
    },
    dismissPreviewPanels: () => {
      dismissLaunchPanel();
      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
    },
    setMockAppUpdate: (info) => {
      setAppUpdateInfo(info);
      setAppUpdateState(info ? "available" : "idle");
      setUpdatePromptDismissed(false);
    },
  };

  useEffect(() => {
    if (!import.meta.env.DEV || isShowcase || isOnboardingSandbox) return;
    const host: LauncherDevHost = {
      setPreviewMode: (enabled) => {
        previewModeRef.current = enabled;
      },
      setInstances: (updater) => setInstances(updater),
      openWizard: () => devCallbacksRef.current?.openWizard(),
      previewLaunchConsole: (options) => devCallbacksRef.current?.previewLaunchConsole(options),
      dismissPreviewPanels: () => devCallbacksRef.current?.dismissPreviewPanels(),
      setMockAppUpdate: (info) => devCallbacksRef.current?.setMockAppUpdate(info),
    };
    window.__SILLYCLIENT_DEV_HOST__ = host;
    window.dispatchEvent(new Event("sillyclient:dev-host-ready"));
    return () => {
      if (window.__SILLYCLIENT_DEV_HOST__ === host) {
        delete window.__SILLYCLIENT_DEV_HOST__;
      }
      previewModeRef.current = false;
    };
  }, [isShowcase]);

  return (
    <div
      ref={scrollRef}
      data-theme-tone={isLight ? "light" : "dark"}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "min-h-screen overflow-y-auto scrollbar-hidden overscroll-none transition-colors duration-900",
        isLight ? "bg-[rgb(var(--app-light-surface-rgb))] text-[#1a1625]" : "bg-[#1a1625] text-white"
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
        <div data-app-backdrop="ambient" className={cn("ambient-glow-container", dynamicPaused && "ambient-paused")}>
          <div className="ambient-glow ambient-glow-1" />
          <div className="ambient-glow ambient-glow-2" />
          <div className="ambient-glow ambient-glow-3" />
          <div className="ambient-glow ambient-glow-4" />
          <div className="ambient-glow ambient-glow-5" />
        </div>
      )}

      {/* 自定义壁纸 */}
      {bgMode === "custom" && customWallpaperUrl && (
        <div data-app-backdrop="image" className="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat" style={{ backgroundImage: `url(${customWallpaperUrl})` }} />
      )}

      <input ref={wallpaperInputRef} type="file" accept="image/*" className="hidden" onChange={handleWallpaperUpload} />

      {/* 顶部导航 */}
      <header className="fixed left-0 right-0 z-50 px-4" style={{ top: `max(env(safe-area-inset-top), ${safeInsetTop + 4}px)` }}>
        <div className={cn("ios-floating-menu h-12 flex items-center px-3 rounded-[var(--radius-3xl)] border-0 backdrop-blur-[40px] saturate-180 transition-colors", isLight && "is-light")}>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              ref={terminalBtnRef}
              onClick={handleTerminalButtonClick}
              aria-label="打开终端"
              data-onboarding-target="terminal"
              className={cn(
                "motion-control ios-glass-btn px-3 h-8 flex items-center justify-center text-xs font-medium",
                isLight ? "text-[#1a1625]/70 hover:text-[#1a1625]" : "text-white/70 hover:text-white"
              )}
            >
              <Terminal className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <button
              onClick={handleBackgroundButtonClick}
              aria-label="打开背景设置"
              data-onboarding-target="background"
              className={cn("motion-control group flex items-center gap-2 px-3 h-8 rounded-full border-0 max-w-[200px]", isLight ? "text-[#1a1625]/75 hover:text-[#1a1625]" : "text-white/75 hover:text-white")}
            >
              <HeaderClock />
              <ChevronDown className={cn("w-4 h-4 flex-shrink-0 text-current transition-transform", showBgPanel && "rotate-180")} />
            </button>
          </div>

          <button
            ref={settingsBtnRef}
            onClick={() => {
              if (isWeb && !isShowcase && !isLocalPreview) return;
              if (showAppMenu) {
                closeAppMenu();
              } else {
                setUpdatePromptDismissed(true);
                setShowAppMenu(true);
              }
            }}
            className={cn(
              "motion-control ios-glass-btn px-4 h-9 flex items-center justify-center text-xs font-medium flex-shrink-0",
              isLight ? "text-[#1a1625]/70 hover:text-[#1a1625]" : "text-white/70 hover:text-white"
            )}
            data-onboarding-target="settings"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 新版本提示浮层 (严格与右上角设置按钮右边框对齐，宽度固定、高度随内容自适应并限高省略) */}
      {appUpdateState === "available" && appUpdateInfo && !updatePromptDismissed && (
        <div
          className={cn(
            "ios-floating-menu animate-popover [--popover-origin:translateY(0)] fixed z-[41] w-[320px] px-3.5 py-3 rounded-2xl border-0 backdrop-blur-[40px] saturate-180 flex flex-col gap-2",
            isLight && "is-light"
          )}
          style={{
            top: `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 60px)`,
            right: updateBannerRight,
            maxWidth: `calc(var(--ui-vw, 100vw) - ${Math.max(16, updateBannerRight + 16)}px)`,
          }}
        >
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className={cn("text-xs font-semibold tracking-tight truncate", isLight ? "text-[#1a1625]/88" : "text-white/90")}>
              发现新版本 v{appUpdateInfo.latestVersion}
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <ActionButton
                onClick={() => {
                  const url = appUpdateInfo.releaseUrl || "https://github.com/CAPTCHAAAAA/SillyClient/releases/latest";
                  void openExternalUrl(url).catch(() => {});
                  setUpdatePromptDismissed(true);
                }}
                className={cn(
                  "!h-7 !min-w-0 px-3 text-xs font-semibold",
                  isLight
                    ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                    : "text-white/75 hover:text-white"
                )}
              >
                查看
              </ActionButton>
              <button
                type="button"
                onClick={() => setUpdatePromptDismissed(true)}
                aria-label="关闭更新提示"
                className={cn(
                  "motion-control w-7 h-7 rounded-full flex items-center justify-center transition-colors",
                  isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/85" : "text-white/40 hover:text-white/85"
                )}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {appUpdateInfo.releaseSummary && (
            <p
              className={cn(
                "update-banner-summary text-[11.5px] leading-[1.6]",
                isLight ? "text-[#1a1625]/68" : "text-white/70"
              )}
              title={appUpdateInfo.releaseSummary}
            >
              {appUpdateInfo.releaseSummary}
            </p>
          )}
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
        <div
          className="mb-4 text-center select-none cursor-pointer group"
          onClick={handleLogoClick}
          title={`点击切换字体 (${LOGO_FONTS[logoFontIndex].name})`}
        >
          <span
            className="inline-block text-[clamp(3rem,10vw,7.5rem)] font-normal leading-none transition-all duration-300"
            style={{
              fontFamily: LOGO_FONTS[logoFontIndex].family,
              letterSpacing: '0.03em',
            }}
          >
            <span style={{ color: isLight ? '#a09b9e' : '#ffd2dc' }}>Silly</span>
            <span style={{ color: '#e8365d' }}>Client</span>
          </span>
          <div className={cn(
            "text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isLight ? "text-[#1a1625]/25" : "text-white/25"
          )}>{LOGO_FONTS[logoFontIndex].name}</div>
        </div>

        {/* 搜索栏 */}
        <div className="relative mb-10 w-full max-w-2xl">
          <div className={cn("home-search", isLight && "is-light")}>
            <Search className={cn("pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
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
                "w-full h-14 pl-12 pr-4 rounded-[20px] border-0 bg-transparent focus:outline-none focus:ring-0",
                isLight ? "text-[#1a1625] placeholder:text-[#1a1625]/40" : "text-white placeholder:text-white/40"
              )}
            />
          </div>
          {searchQuery && (
            <div className={cn("ios-floating-menu motion-menu-list animate-dropdown absolute top-full left-0 right-0 mt-2 rounded-2xl border-0 overflow-hidden z-30 max-h-64 overflow-y-auto scrollbar-subtle", isLight && "is-light")}>
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
                    isLight ? "text-[#1a1625]/60 hover:text-[#1a1625]" : "text-white/60 hover:text-white"
                  )}
                >
                  <span className="scale-75">{t.icon}</span>
                  <span>{t.subtitle || t.name}</span>
                  <span className={cn("ml-auto text-[10px]", isLight ? "text-[#1a1625]/40" : "text-white/40")}>{t.type === "local" ? "本地" : "远程"}</span>
                </button>
              ))}
              {searchResults.length === 0 && (
                <div className={cn("px-4 py-3 text-sm", isLight ? "text-[#1a1625]/40" : "text-white/40")}>无匹配实例</div>
              )}
            </div>
          )}
        </div>

        {/* 实例卡片轮播 (高内聚低耦合组件调度) */}
        <InstanceCarousel
          ref={carouselRef}
          instances={instances}
          isLight={isLight}
          isDynamic={isDynamic}
          glassBg={glassBg}
          hoveredCard={hoveredCard}
          setHoveredCard={setHoveredCard}
          launchingId={launchingId}
          onLaunch={launchTavern}
          onReturnToTavern={handleReturnToTavern}
          onStopInstance={handleStopInstance}
          onOpenMenu={handleCardMenuOpen}
          rename={instanceRename}
          onReorderInstances={handleReorderInstances}
          createCardPinned={createCardPinned}
          createCardSlot={createCardSlot}
          onCreateCardSlotChange={setCreateCardSlot}
          isWindows={isWindows}
          isIOS={isIOS}
          isWeb={isWeb}
          isShowcase={isShowcase}
          isLocalPreview={isLocalPreview}
          onNewInstance={openNewInstancePanel}
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
            onRename={openInstanceRename}
            onPickCover={(inst) => {
              closeCardMenu();
              void pickInstanceCover(inst);
            }}
            onDelete={(inst) => {
              closeCardMenu();
              openDeleteDialog(inst);
            }}
          />
        );
      })()}

      {/* 统一背景交互锁：浮层打开或退场期间保留全屏 2px 虚化遮罩并同步退场，背景不可点击、不可滚动触发刷新。 */}
      <LayerBackdrop
        isOpen={isBackgroundInteractionBlocked}
        isClosing={isBackgroundInteractionClosing}
        blur
        zIndex={LAYERS.DRAWER_BACKDROP}
        className="!bg-transparent touch-none"
      />

      {/* 解耦业务组件: 背景设置抽屉 (昼夜级平滑自适应高度跟随) */}
      <BackgroundSettingsDrawer
        isOpen={showBgPanel}
        isClosing={isPanelClosing}
        onClose={closeBgPanel}
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
        uiScale={uiScale}
        onUiScaleChange={handleUiScaleChange}
      />

      {/* 解耦业务组件: 终端面板 */}
      <LayerBackdrop
        isOpen={showTerminal || isTerminalClosing}
        isClosing={isTerminalClosing}
        onClick={closeTerminalPanel}
        zIndex={LAYERS.MODAL_BACKDROP}
      />
      <TerminalModal
        isOpen={showTerminal}
        isClosing={isTerminalClosing}
        onClose={closeTerminalPanel}
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
        onClose={closeAppMenu}
        isLight={isLight}
        glassBg={glassBg}
        isWindows={isWindows}
        pullToRefresh={pullToRefresh}
        setPullToRefresh={setPullToRefresh}
        renderSettings={renderSettings}
        canSetPerformancePreset={isAndroid || (isWeb && canPreviewRenderSettings)}
        renderSettingsPending={renderSettingsPending}
        renderSettingsError={renderSettingsError}
        renderSettingsDiagnostic={renderSettingsDiagnostic}
        onRenderSettingsChange={commitRenderSettings}
        contentOpenMode={contentOpenMode}
        setContentOpenMode={setContentOpenMode}
        replayOnboarding={replayOnboarding}
        createCardPinned={createCardPinned}
        setCreateCardPinned={setCreateCardPinned}
        setInstances={setInstances}
        appUpdateState={appUpdateState}
        appUpdateInfo={appUpdateInfo}
        appUpdateError={appUpdateError}
        appUpdateDiagnostic={appUpdateDiagnostic}
        checkForAppUpdate={checkForAppUpdate}
        openProjectPage={openProjectPage}
        onOpenCleanGarbage={async () => {
          closeAppMenu();
          setCleaningGarbage(true);
          setShowCleanPanel(true);
          setGarbageItems([]);
          setGarbageError(null);
          setGarbageDiagnostic(null);
          try {
            const { items } = await TarvenEnv.cleanGarbage({
              dryRun: true,
              activeInstanceIds: Array.from(new Set(instances.flatMap(instance => [instance.id, instance.installDir].filter((id): id is string => !!id)))),
              activeCoverPaths: instances.map(instance => instance.cover).filter((cover): cover is string => !!cover),
            });
            setGarbageItems(items);
          } catch (e) {
            const friendly = humanizeNativeError(e);
            const context = createDiagnosticContext(e, {
              area: "cleanup",
              stage: "scan-garbage",
              platform: platformTag,
              userMessage: friendly,
            });
            setGarbageError(friendly);
            setGarbageDiagnostic(context);
            reportGlobalError(e, {
              area: "cleanup",
              stage: "scan-garbage",
              platform: platformTag,
              userMessage: friendly,
              diagnostic: context,
            });
          }
          setCleaningGarbage(false);
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
        isOpen={!!pendingDelete && !isDeleteDialogClosing}
        isClosing={isDeleteDialogClosing}
        onClose={closeDeleteDialog}
        isLight={isLight}
        glassBg={glassBg}
        isDeleting={isDeletingInstance}
        deleteError={deleteInstanceError}
        deleteDiagnostic={deleteDiagnostic}
        onConfirm={confirmDeleteInstance}
      />

      {/* 解耦公共组件: 统一多层遮罩 */}
      <LayerBackdrop
        isOpen={showNewInstancePanel || isNewInstancePanelClosing || showLaunchPanel || isLaunchPanelClosing}
        isClosing={(isNewInstancePanelClosing || isLaunchPanelClosing) && (!showNewInstancePanel || isNewInstancePanelClosing) && (!showLaunchPanel || isLaunchPanelClosing)}
        onClick={() => {
          if (showNewInstancePanel && !isCreatingInstance) {
            closeNewInstancePanel();
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
        launchDiagnostic={launchDiagnostic}
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
        onClose={closeCleanPanel}
        isLight={isLight}
        glassBg={glassBg}
        cleaningGarbage={cleaningGarbage}
        setCleaningGarbage={setCleaningGarbage}
        garbageItems={garbageItems}
        setGarbageItems={setGarbageItems}
        error={garbageError}
        diagnostic={garbageDiagnostic}
        setError={setGarbageError}
      />

      {/* 解耦业务组件: 新建实例向导 (同位驻留 DOM、昼夜平滑高度自适应、无自发光输入框) */}
      <NewInstanceWizardModal
        isOpen={showNewInstancePanel}
        isClosing={isNewInstancePanelClosing}
        onClose={closeNewInstancePanel}
        isLight={isLight}
        glassBg={glassBg}
        isWindows={isWindows}
        isIOS={isIOS}
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
        newInstanceError={newInstanceError}
        newInstanceDiagnostic={newInstanceDiagnostic}
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
        isWindows={isWindows}
        allInstances={instances}
        onSelectInstance={(inst) => {
          setShowManagePanel(inst);
          setTerminalInstanceId(inst.id);
          if (maintenanceInstance) setMaintenanceInstance(inst.type === "local" ? inst : null);
        }}
        onOpenMaintenance={(inst) => {
          if (inst.type === "local") {
            setIsMaintenanceClosing(false);
            setMaintenanceInstance(inst);
          }
        }}
        onOpenRelocate={openRelocateModal}
        onLaunchInstance={(inst) => {
          closeManagePanel();
          launchTavern(inst);
        }}
        launchingId={launchingId}
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
        manageSaveDiagnostic={manageSaveDiagnostic}
        isIOS={isIOS}
        onSaveManagedInstance={saveManagedInstance}
        terminalDisplayPrompt={terminalDisplayPrompt}
        terminalPlaceholder={terminalPlaceholder}
        onUpdateInstancePasswordStatus={handleUpdateInstancePasswordStatus}
      />

      <InstanceMaintenancePanel instance={maintenanceInstance} isOpen={!!maintenanceInstance}
        onClose={closeMaintenance} onClosingChange={setIsMaintenanceClosing}
        isLight={isLight} glassBg={glassBg} registerLayer={registerLayer} />

      {/* 首次引导 */}
      {showOnboarding && (
        <Suspense fallback={null}>
          {isOnboardingSandbox ? (
            <OnboardingGuide
              isLight={isLight}
              platform={isWindows ? "windows" : isAndroid ? "android" : isIOS ? "ios" : "web"}
              onStepChange={prepareOnboardingStep}
              onComplete={dismissOnboarding}
              onSkip={dismissOnboarding}
            />
          ) : (
            <OnboardingSession
              platform={isWindows ? "windows" : isAndroid ? "android" : isIOS ? "ios" : "web"}
              bgMode={bgMode}
              themeStyle={themeStyle}
              safeInsetTop={safeInsetTop}
              onComplete={dismissOnboarding}
              onCancel={cancelOnboarding}
            />
          )}
        </Suspense>
      )}

      {/* 单实例存储路径迁移模态框 */}
      <RelocateInstanceModal
        instance={relocatingInstance}
        isOpen={showRelocateModal}
        isClosing={isRelocateModalClosing}
        onClose={closeRelocateModal}
        isLight={isLight}
        glassBg={glassBg}
        isWindows={isWindows}
        isIOS={isIOS}
        onRelocated={handleInstanceRelocated}
      />

      {/* 全局置顶虚化问题反馈菜单（商业软件评分/反馈交互模式） */}
      <GlobalErrorReportOverlay
        isLight={isLight}
        glassBg={glassBg}
        registerLayer={registerLayer}
      />
    </div>
  );
}

export default SillyClientLauncher;
