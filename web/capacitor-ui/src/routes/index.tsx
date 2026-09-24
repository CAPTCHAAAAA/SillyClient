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
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv, DEFAULT_CONFIG } from "@/capacitor-plugin";
import type { AppUpdateInfo, CompanionPresetSelection, ContentOpenMode, InstanceConfig, GithubRelease } from "@/capacitor-plugin";
import frontendPackage from "../../package.json";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";
import { LAYERS } from "@/constants/layers";
import { useLayerStack } from "@/hooks/useLayerStack";
import { LayerBackdrop } from "@/components/common/LayerBackdrop";
import { ActivityCapsule } from "@/components/common/ActivityCapsule";
import { InstanceCard } from "@/components/instance/InstanceCard";
import { LaunchConsoleModal } from "@/components/modals/LaunchConsoleModal";
import { NewInstanceWizardModal } from "@/components/modals/NewInstanceWizardModal";
import { ManageInstanceModal } from "@/components/modals/ManageInstanceModal";
import { BackgroundSettingsDrawer } from "@/components/modals/BackgroundSettingsDrawer";
import { AppSettingsDrawer } from "@/components/modals/AppSettingsDrawer";
import { TerminalModal } from "@/components/modals/TerminalModal";
import { CleanGarbageModal } from "@/components/modals/CleanGarbageModal";
import { DeleteConfirmDialog } from "@/components/modals/DeleteConfirmDialog";
import { RenameModal } from "@/components/modals/RenameModal";
import { VersionDropdownMenu } from "@/components/modals/VersionDropdownMenu";
import { CardActionMenu } from "@/components/modals/CardActionMenu";
import type { TavernInstance, ManageTab, InstanceSnapshot, BgMode, ThemeStyle, OperationPurpose } from "@/types";

export const Route = createFileRoute("/")({
  component: SillyClientLauncher,
});




const INSTANCES_KEY = "sillyclient.instances";
const INSTANCES_VERSION_KEY = "sillyclient.instances.version";
const ONBOARDING_KEY = "sillyclient.onboarding.version";
const ONBOARDING_VERSION = "3";
const CURRENT_VERSION = 2;
const BACKGROUND_PANEL_EXIT_MS = 300;
const PANEL_EXIT_MS = 300;
const POPOVER_EXIT_MS = 200;
const MANAGE_PANEL_OPEN_GAP_MS = 32;
const INSTANCE_SNAPSHOTS_KEY = "sillyclient.instanceSnapshots";

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
      const parsed = JSON.parse(raw) as TavernInstance[];
      // icon 在持久化时无法存为 ReactNode,这里按 type 还原为图标节点
      return parsed.map((t) => ({
        ...t,
        cover: normalizeStoredCover(t.cover),
        totalUsage: t.type === "local" && /(?:^|\s)\d+(?:\.\d+)?\s*(?:B|KB|MB|GB)$/i.test(t.totalUsage || "")
          ? "—"
          : t.totalUsage,
        icon: t.type === "local" ? <Folder className="w-5 h-5" /> : <Cloud className="w-5 h-5" />,
      }));
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
    const storable = list.map(({ icon: _icon, ...rest }) => rest);
    localStorage.setItem(INSTANCES_KEY, JSON.stringify(storable));
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

function compareFrontendVersions(left: string, right: string): number {
  const parts = (value: string) => value.replace(/^v/i, "").split("-")[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
  const a = parts(left);
  const b = parts(right);
  for (let index = 0; index < 3; index += 1) {
    const diff = (a[index] || 0) - (b[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchAppUpdateFromFrontend(): Promise<AppUpdateInfo> {
  const currentVersion = frontendPackage.version;
  const apiUrl = "https://api.github.com/repos/CAPTCHAAAAA/SillyClient/releases/latest";
  let lastError: unknown = null;

  for (const candidate of [apiUrl, `https://gh-proxy.com/${apiUrl}`]) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const raw = await response.json() as { tag_name?: string; html_url?: string; published_at?: string };
      const latestVersion = String(raw?.tag_name || "").replace(/^v/i, "").trim();
      if (!latestVersion) throw new Error("Release tag is empty");
      return {
        currentVersion,
        latestVersion,
        updateAvailable: compareFrontendVersions(currentVersion, latestVersion) < 0,
        releaseUrl: typeof raw?.html_url === "string" ? raw.html_url : undefined,
        publishedAt: typeof raw?.published_at === "string" ? raw.published_at : undefined,
      };
    } catch (error) {
      lastError = error;
    }
  }

  try {
    const response = await fetchWithTimeout(
      "https://data.jsdelivr.com/v1/package/gh/CAPTCHAAAAA/SillyClient",
    );
    const raw = await response.json() as { versions?: string[] };
    const latestVersion = String(raw?.versions?.[0] || "").replace(/^v/i, "").trim();
    if (!latestVersion) throw new Error("jsDelivr returned no versions");
    return {
      currentVersion,
      latestVersion,
      updateAvailable: compareFrontendVersions(currentVersion, latestVersion) < 0,
      releaseUrl: "https://github.com/CAPTCHAAAAA/SillyClient/releases/latest",
    };
  } catch (error) {
    lastError = error;
  }

  throw new Error(lastError instanceof Error ? lastError.message : String(lastError));
}

function normalizeInstanceId(value: string, fallback: string) {
  const normalized = value
    .trim()
    .replace(/[^\p{L}\p{N}._-]+/gu, "-")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return normalized || fallback;
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
  const isDemoPreview = import.meta.env.DEV && !isShowcase;
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
  const terminalTitle = isWindows
    ? "Windows 控制台"
    : isIOS
    ? "iOS 控制台"
    : "Android 终端";
  const terminalPrompt = isWindows
    ? "C:\\>"
    : isIOS
    ? "ios >"
    : "~ $";
  const terminalBanner = isWindows
    ? "SillyClient 1.9.1 · Windows · cmd.exe"
    : isIOS
    ? "SillyClient 1.9.1 · iOS · NodeMobile"
    : "SillyClient 1.9.1 · Android shell";
  const terminalPlaceholder = isWindows
    ? "输入 Windows 命令"
    : isIOS
    ? "iOS 进程内环境（可查看服务运行日志）"
    : "输入 Android shell 命令";
  const isAutoTourActive = typeof window !== "undefined" && (
    (window as any).__E2E_AUTO_TOUR__ === true ||
    (window as any).__SILKY_AUTO_TOUR__ === true ||
    (window as any).__SILLEY_AUTO_TOUR__ === true ||
    new URLSearchParams(window.location.search).get("autotour") === "1"
  );
  const [showOnboarding, setShowOnboarding] = useState(
    () => !isAutoTourActive && (!isWeb || isWindows) && !isShowcase && localStorage.getItem(ONBOARDING_KEY) !== ONBOARDING_VERSION,
  );
  const [instances, setInstances] = useState<TavernInstance[]>(() => {
    if (isShowcase) return [];
    const loaded = loadInstances();
    return isDemoPreview ? [DEMO_INSTANCE, ...loaded] : loaded;
  });
  const [showBgPanel, setShowBgPanel] = useState(false);
  const [isPanelClosing, setIsPanelClosing] = useState(false);
  const [bgMode, setBgMode] = useState<BgMode>("dynamic");
  const [dynamicPaused, setDynamicPaused] = useState(false);
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>("dark");
  const [themeSmoothing, setThemeSmoothing] = useState(false);
  const themeSmoothingTimer = useRef<number | null>(null);
  const [customWallpaperUrl, setCustomWallpaperUrl] = useState<string | null>(null);
  const wallpaperInputRef = useRef<HTMLInputElement>(null);
  const [showTerminal, setShowTerminal] = useState(false);
  const [isTerminalClosing, setIsTerminalClosing] = useState(false);
  const [terminalSize, setTerminalSize] = useState({ w: 640, h: 340 });
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const [terminalLogs, setTerminalLogs] = useState<{ msg: string; level?: string }[]>([
    { msg: "就绪，选择实例启动", level: "info" },
  ]);
  const [launchingId, setLaunchingId] = useState<string | null>(null);
  const [launchProgress, setLaunchProgress] = useState<{ pct: number; text: string } | null>(null);
  const [showLaunchPanel, setShowLaunchPanel] = useState(false);
  const [isLaunchPanelClosing, setIsLaunchPanelClosing] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launchLogs, setLaunchLogs] = useState<{ msg: string; level?: string }[]>([]);
  const [lastLaunchParams, setLastLaunchParams] = useState<any>(null);
  const [operationPurpose, setOperationPurpose] = useState<OperationPurpose>("launch");

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
  const [newInstanceMode, setNewInstanceMode] = useState<"local" | "remote">("local");
  const [newInstanceName, setNewInstanceName] = useState("");
  const [newInstanceDir, setNewInstanceDir] = useState("");
  const [newInstanceUrl, setNewInstanceUrl] = useState("http://");
  const [newRemoteAuthEnabled, setNewRemoteAuthEnabled] = useState(false);
  const [newRemoteAuthUsername, setNewRemoteAuthUsername] = useState("");
  const [newRemoteAuthPassword, setNewRemoteAuthPassword] = useState("");
  const [newInstanceVersion, setNewInstanceVersion] = useState("stable");
  const [newInstanceCompanionPresetEnabled, setNewInstanceCompanionPresetEnabled] = useState(false);
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
  const [instanceSnapshots, setInstanceSnapshots] = useState<Record<string, InstanceSnapshot[]>>({});
  // 关于页真实数据
  const [aboutInfo, setAboutInfo] = useState<{ version: string; path: string; sizeBytes: number; createdAt: string; status: string } | null>(null);
  // 安全 insets(挖孔避让)
  const [safeInsetTop, setSafeInsetTop] = useState(showcaseSafeTop);
  // APP 设置:下拉刷新
  const [pullToRefresh, setPullToRefresh] = useState(false);
  const [contentOpenMode, setContentOpenMode] = useState<ContentOpenMode>("webview");
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(() => import.meta.env.DEV
    ? {
        currentVersion: frontendPackage.version,
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
  const carouselRef = useRef<HTMLDivElement>(null);
  const versionDropdownRef = useRef<HTMLDivElement>(null);
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
  const [garbageItems, setGarbageItems] = useState<any[]>([]);
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
    ? (isWindows ? `${terminalInstance.installDir || terminalInstance.id}>` : isIOS ? "ios >" : "~ $")
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
      const result = await fetchAppUpdateFromFrontend();
      setAppUpdateInfo(result);
      setAppUpdateState(result.updateAvailable ? "available" : "current");
      if (result.updateAvailable) setUpdatePromptDismissed(false);
      return result;
    } catch (error) {
      console.warn("[checkAppUpdate]", error);
      setAppUpdateState("error");
      return null;
    }
  }, []);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(INSTANCE_SNAPSHOTS_KEY);
      if (raw) setInstanceSnapshots(JSON.parse(raw) as Record<string, InstanceSnapshot[]>);
    } catch {
      /* ignore invalid local snapshots */
    }
  }, []);

  useEffect(() => {
    if (isShowcase) return;
    try {
      localStorage.setItem(INSTANCE_SNAPSHOTS_KEY, JSON.stringify(instanceSnapshots));
    } catch {
      /* ignore storage quota errors */
    }
  }, [instanceSnapshots, isShowcase]);

  // 液态玻璃底色:动态模式微偏红,黑夜模式蓝紫,白天模式白色
  const glassBg = isLight
    ? "bg-white/70 border-black/5 shadow-[0_16px_60px_rgba(0,0,0,0.10)]"
    : isDynamic
      ? "bg-[#1c1420]/70 border-white/10 shadow-[0_16px_60px_rgba(0,0,0,0.30)]"
      : "bg-[#1a1625]/70 border-white/10 shadow-[0_16px_60px_rgba(0,0,0,0.35)]";

  // 轮播滚动到指定卡片（居中）
  const scrollToSlide = useCallback((index: number) => {
    const el = carouselRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('[data-card-index]');
    const target = cards[index] as HTMLElement | undefined;
    if (!target) return;
    const cardWidth = 240;
    const containerWidth = el.clientWidth;
    const scrollLeft = target.offsetLeft - (containerWidth - cardWidth) / 2;
    el.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    setActiveSlide(index);
  }, []);

  // 轮播拖拽 + 滚动指示器联动
  const dragState = useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({ isDown: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const x = 'touches' in e ? e.touches[0].pageX : e.pageX;
      dragState.current = { isDown: true, startX: x - el.offsetLeft, scrollLeft: el.scrollLeft };
      el.style.cursor = 'grabbing';
      el.style.scrollSnapType = 'none';
    };
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDown) return;
      // 仅鼠标桌面端手动跟随(1:1);触屏交给原生滚动以保证跟手流畅
      if ('touches' in e) return;
      e.preventDefault();
      const x = e.pageX;
      const walk = (x - el.offsetLeft - dragState.current.startX);
      el.scrollLeft = dragState.current.scrollLeft - walk;
    };
    const onUp = () => {
      dragState.current.isDown = false;
      el.style.cursor = 'grab';
      el.style.scrollSnapType = 'x mandatory';
    };
    const onLeave = () => {
      if (dragState.current.isDown) onUp();
    };

    // 滚动时更新指示器
    const updateIndicator = () => {
      const containerWidth = el.clientWidth;
      const containerCenter = el.scrollLeft + containerWidth / 2;
      const cards = el.querySelectorAll('[data-card-index]');
      let closestIdx = 0;
      let closestDist = Infinity;
      cards.forEach((card) => {
        const center = (card as HTMLElement).offsetLeft + 120;
        const dist = Math.abs(center - containerCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = parseInt((card as HTMLElement).dataset.cardIndex || '0');
        }
      });
      setActiveSlide(closestIdx);
    };

    let scrollTimer: ReturnType<typeof setTimeout>;
    const onScroll = () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(updateIndicator, 80); };

    el.style.cursor = 'grab';
    el.addEventListener('mousedown', onDown);
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseup', onUp);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('touchstart', onDown, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onUp, { passive: true });
    el.addEventListener('scroll', onScroll);

    return () => {
      clearTimeout(scrollTimer);
      el.removeEventListener('mousedown', onDown);
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseup', onUp);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onDown);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onUp);
      el.removeEventListener('scroll', onScroll);
    };
  }, []);

  // 自检:启动时扫描本地已存在的酒馆实例,自动添加卡片
  useEffect(() => {
    if (isShowcase) return;
    (async () => {
      try {
        const { instances: scannedInstances } = await TarvenEnv.scanInstances();
        setInstances(prev => {
          if (!isWindows) {
            const existingIds = new Set(prev.map(instance => instance.installDir || instance.id));
            const scanned = scannedInstances
              .filter(instance => !existingIds.has(instance.instanceId))
              .map<TavernInstance>(instance => ({
                id: `scan-${instance.instanceId}`,
                name: "SillyTavern",
                subtitle: instance.instanceId,
                version: instance.version === "unknown" ? "—" : `v${instance.version}`,
                status: instance.hasServer ? "stopped" : "error",
                type: "local",
                lastUsed: "—",
                createdAt: "—",
                totalUsage: instance.sizeBytes > 0 ? `${(instance.sizeBytes / 1024 / 1024).toFixed(0)}MB` : "—",
                icon: <Folder className="w-5 h-5" />,
                color: "#9ca3af",
                port: 8000,
                installDir: instance.instanceId,
                config: { ...DEFAULT_CONFIG },
              }));
            return [...scanned, ...prev];
          }

          const scannedById = new Map(scannedInstances.map(instance => [instance.instanceId, instance]));
          const retained = prev.filter(instance => instance.type !== "local" || scannedById.has(instance.installDir || instance.id));
          const updated = retained.map(instance => {
            if (instance.type !== "local") return instance;
            const scannedInstance = scannedById.get(instance.installDir || instance.id);
            if (!scannedInstance) return instance;
            return {
              ...instance,
              version: scannedInstance.version === "unknown" ? instance.version : `v${scannedInstance.version}`,
              installPath: scannedInstance.path || instance.installPath,
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
              version: s.version === "unknown" ? "—" : `v${s.version}`,
              status: s.hasServer ? "stopped" : "error",
              type: "local",
              lastUsed: formatNativeDate(s.lastUsedAt),
              createdAt: formatNativeDate(s.createdAt),
              totalUsage: formatUsageDuration(s.totalUsageMs),
              icon: <Folder className="w-5 h-5" />,
              color: "#9ca3af",
              port: 8000,
              installDir: s.instanceId,
              installPath: s.path,
              config: { ...DEFAULT_CONFIG },
            }));
          return [...scanned, ...updated];
        });
      } catch { /* 非 Capacitor 环境 */ }
    })();
  }, [isShowcase, isWindows]);

  // 原生进程被系统结束后，持久化的 running 状态可能已经失效。
  useEffect(() => {
    if (isShowcase) return;
    (async () => {
      try {
        const status = await TarvenEnv.getStatus();
        const activePort = status.url ? Number(new URL(status.url).port || 80) : null;
        setInstances(prev => prev.map(instance => {
          if (instance.type !== "local" || instance.status === "error") return instance;
          const isActive = status.serverReady
            && activePort !== null
            && (instance.port ?? 8000) === activePort;
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

  // 管理面板打开且切到关于页时,拉取真实实例数据
  useEffect(() => {
    if (!showManagePanel || (manageTab !== "about" && manageTab !== "storage")) return;
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
  }, [showManagePanel, manageTab]);

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

  const switchInstanceMode = useCallback((mode: "local" | "remote") => {
    if (newInstanceMode === mode) return;
    setThemeSmoothing(true);
    setNewInstanceMode(mode);
    if (themeSmoothingTimer.current !== null) window.clearTimeout(themeSmoothingTimer.current);
    themeSmoothingTimer.current = window.setTimeout(() => setThemeSmoothing(false), 800);
  }, [newInstanceMode]);

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

  // 下拉刷新:触发远程状态检测
  const handlePullRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(60);
    try {
      await checkRemoteStatus();
    } catch { /* ignore */ }
    setTimeout(() => { setIsRefreshing(false); setPullDistance(0); }, 600);
  }, [checkRemoteStatus]);

  // touch 事件处理:仅当滚动到顶部且无弹窗时触发下拉,整个内容跟随拖拽(iOS 原生风格)
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
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
  }, [isRefreshing, renamingId, showNewInstancePanel, showManagePanel, activeCardMenu]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || isRefreshing) return;
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
  }, [isRefreshing]);

  const onTouchEnd = useCallback(() => {
    isPulling.current = false;
    if (pullDistance > 55) {
      handlePullRefresh();
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, handlePullRefresh]);

  // 监听原生插件事件:日志 / 就绪 / 模式变化
  useEffect(() => {
    if (isShowcase) return;
    let logHandle: any, readyHandle: any, modeHandle: any, progressHandle: any;
    (async () => {
      try {
        logHandle = await TarvenEnv.addListener("log", (d: { message: string; level?: string }) => {
          setTerminalLogs(prev => [...prev, { msg: d.message, level: d.level }]);
        });
        progressHandle = await TarvenEnv.addListener("progress", (d: { percent: number; stage?: string }) => {
          const msg = d.stage ? `${d.stage} ${d.percent}%` : `${d.percent}%`;
          setTerminalLogs(prev => {
            // 合并连续进度行,避免刷屏
            const last = prev[prev.length - 1];
            if (last && last.level === "info" && /\d+%$/.test(last.msg)) {
              return [...prev.slice(0, -1), { msg, level: "info" }];
            }
            return [...prev, { msg, level: "info" }];
          });
        });
        readyHandle = await TarvenEnv.addListener("ready", (d: { url?: string; port?: number }) => {
          setTerminalLogs(prev => [...prev, { msg: `✓ 就绪${d.url ? " " + d.url : ""}`, level: "success" }]);
        });
        modeHandle = await TarvenEnv.addListener("mode", (d: { mode: string; tavernRunning?: boolean; instanceId?: string; lastUsedAt?: string; totalUsageMs?: number }) => {
          if (d.mode === "launcher" && d.tavernRunning === true && d.instanceId) {
            setInstances(prev => prev.map(instance => instance.id === d.instanceId
              ? { ...instance, pendingTavernGestureHint: undefined }
              : instance));
          }
          // 只有 tavernRunning=false（实例真正关闭）时才置 stopped
          // tavernRunning=true（手势退出）时实例还在跑，不改变状态
          if (d.mode === "launcher" && !d.tavernRunning) {
            setInstances(prev => prev.map(t => {
              if (t.type !== "local") return t;
              const isStoppedInstance = !d.instanceId || (t.installDir || t.id) === d.instanceId;
              if (!isStoppedInstance && t.status !== "running") return t;
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
      logHandle?.remove?.();
      progressHandle?.remove?.();
      readyHandle?.remove?.();
      modeHandle?.remove?.();
    };
  }, [isShowcase]);

  // 配置并启动本地实例。创建流程只在确认服务可访问后写入卡片。
  const doLaunch = useCallback(async (instance: TavernInstance, enterWhenReady = true) => {
    const port = instance.port ?? 8000;
    const instanceId = instance.installDir || instance.id;
    const version = instance.version || "stable";
    const config = instance.config ?? DEFAULT_CONFIG;
    const zipballUrl = instance.zipballUrl;
    const localZipPath = instance.localZipPath;
    const installPath = instance.installPath;
    const companionPreset = instance.companionPreset;

    setLaunchProgress({ pct: 0, text: "初始化" });
    setLaunchError(null);
    setLaunchLogs([{ msg: `启动 ${instance.name} (${instance.type})`, level: "info" }]);
    setLaunchLogs(prev => [...prev, { msg: `准备 Node 环境 [${instanceId}] :${port}`, level: "info" }]);

    if (isWeb) {
      for (let p = 25; p <= 75; p += 25) {
        await new Promise(r => setTimeout(r, 200));
        setLaunchProgress({ pct: p, text: `准备启动服务 (${p}%)` });
        setLaunchLogs(prev => [...prev, { msg: `服务就绪进度 ${p}%`, level: "info" }]);
      }
      await new Promise(r => setTimeout(r, 200));
      setLaunchProgress({ pct: 100, text: "实例已就绪" });
      setLaunchLogs(prev => [...prev, { msg: "服务已就绪 (浏览器演示)", level: "success" }]);
      return { url: "http://127.0.0.1:8000/", port: 8000 };
    }

    // 注册事件监听
    let readyHandle: any;
    let progressHandle: any;
    let logHandle: any;
    let errorHandle: any;
    let readyReceived = false;
    let errorMsg: string | null = null;
    let resolvedPort = port;
    let resolvedUrl = `http://127.0.0.1:${port}/`;
    let statusInterval: ReturnType<typeof setInterval> | null = null;
    let readyCheck: ReturnType<typeof setInterval> | null = null;
    let readyTimeout: ReturnType<typeof setTimeout> | null = null;

    try {
      progressHandle = await TarvenEnv.addListener("progress", (d: { percent: number; stage?: string }) => {
        setLaunchProgress({ pct: d.percent ?? 0, text: formatOperationStage(d.stage, d.percent) });
        const msg = d.stage ? `${d.stage} ${d.percent}%` : `${d.percent}%`;
        setLaunchLogs(prev => {
          const last = prev[prev.length - 1];
          if (last && last.level === "info" && /\d+%$/.test(last.msg)) {
            return [...prev.slice(0, -1), { msg, level: "info" }];
          }
          return [...prev, { msg, level: "info" }];
        });
      });

      logHandle = await TarvenEnv.addListener("log", (d: { message?: string; line?: string; text?: string; level?: string }) => {
        const line = d.message || d.line || d.text || "";
        if (!line) return;
        setLaunchLogs(prev => [...prev.slice(-80), { msg: line, level: d.level || "info" }]);
      });

      errorHandle = await TarvenEnv.addListener("error", (d: { message?: string }) => {
        errorMsg = d.message || "未知错误";
      });

      readyHandle = await TarvenEnv.addListener("ready", (d: { ready?: boolean; url?: string; port?: number }) => {
        if (readyReceived) return;
        if (d.ready !== false) {
          readyReceived = true;
          if (d.port) resolvedPort = d.port;
          if (d.url) resolvedUrl = d.url.endsWith("/") ? d.url : `${d.url}/`;
        }
      });

      // 调用原生 provision
      const provisionResult = await TarvenEnv.provisionAndStart({ port, instanceId, version, zipballUrl, localZipPath, installPath, companionPreset, config });
      if (provisionResult?.ready === false && !readyReceived) {
        throw new Error(errorMsg || "实例未能启动，请检查安装日志");
      }

      // 等待 ready 或 error，同时轮询
      statusInterval = setInterval(async () => {
        try {
          const s = await TarvenEnv.getStatus();
          if (s.serverReady && !readyReceived) {
            readyReceived = true;
            if (s.url) resolvedUrl = s.url.endsWith("/") ? s.url : `${s.url}/`;
          }
        } catch {}
      }, 2000);

      // 超时兜底 600s
      await new Promise<void>((resolve) => {
        readyTimeout = setTimeout(() => resolve(), 600000);
        readyCheck = setInterval(() => {
          if (readyReceived || errorMsg) {
            if (readyTimeout) clearTimeout(readyTimeout);
            if (readyCheck) clearInterval(readyCheck);
            resolve();
          }
        }, 500);
      });

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
        await TarvenEnv.enterImmersive({
          url: resolvedUrl,
          instanceId: instance.id,
          showGestureHint: instance.pendingTavernGestureHint === true,
        });
      }
      return { url: resolvedUrl, port: resolvedPort };
    } finally {
      if (statusInterval) clearInterval(statusInterval);
      if (readyCheck) clearInterval(readyCheck);
      if (readyTimeout) clearTimeout(readyTimeout);
      readyHandle?.remove?.();
      progressHandle?.remove?.();
      logHandle?.remove?.();
      errorHandle?.remove?.();
    }
  }, []);

  const openRemoteInstance = useCallback(async (instance: TavernInstance) => {
    const url = instance.url || "http://127.0.0.1:8000";
    setLaunchLogs([{ msg: `检查 ${url}`, level: "info" }]);
    setLaunchProgress({ pct: 25, text: "正在验证远程连接" });
    const result = await TarvenEnv.pingUrl({ url, instanceId: instance.id });
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
    await TarvenEnv.enterImmersive({
      url,
      instanceId: instance.id,
      showGestureHint: instance.pendingTavernGestureHint === true,
    });
    setLaunchProgress({ pct: 100, text: "远程实例已打开" });
  }, [contentOpenMode]);

  // 启动实例入口
  const launchTavern = useCallback(async (instance: TavernInstance) => {
    if (launchingId) return;
    setLaunchingId(instance.id);
    if (instance.type === "local") {
      setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "running" } : t));
    }
    setShowLaunchPanel(true);
    setOperationPurpose("launch");
    setLastLaunchParams(instance);
    try {
      if (instance.type === "local") {
        const result = await doLaunch(instance);
        const info = await TarvenEnv.getInstanceInfo({
          instanceId: instance.installDir || instance.id,
          installPath: instance.installPath,
          port: result.port,
        });
        setInstances(prev => prev.map(t => t.id === instance.id ? {
          ...t,
          status: "running",
          port: result.port,
          installPath: info.path || t.installPath,
          createdAt: info.createdAt ? formatNativeDate(info.createdAt) : t.createdAt,
          lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : t.lastUsed,
          totalUsage: info.totalUsageMs !== undefined ? formatUsageDuration(info.totalUsageMs) : t.totalUsage,
        } : t));
        setTimeout(() => {
          setIsLaunchPanelClosing(true);
          setTimeout(() => {
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setLaunchProgress(null);
          }, PANEL_EXIT_MS);
        }, 800);
      } else {
        await openRemoteInstance(instance);
        setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "online" } : t));
        setTimeout(() => {
          setIsLaunchPanelClosing(true);
          setTimeout(() => {
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setLaunchProgress(null);
          }, PANEL_EXIT_MS);
        }, 500);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setLaunchError(msg);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `失败: ${msg}`, level: "error" }]);
      setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "error" } : t));
      try { await TarvenEnv.exitImmersive(); } catch {}
    } finally {
      setLaunchingId(null);
    }
  }, [launchingId, doLaunch, openRemoteInstance]);

  const provisionCreatedInstance = useCallback(async (instance: TavernInstance) => {
    if (isWeb) {
      for (let p = 20; p <= 80; p += 20) {
        await new Promise(r => setTimeout(r, 200));
        setLaunchProgress({ pct: p, text: `正在安装组件... (${p}%)` });
        setLaunchLogs(prev => [...prev, { msg: `安装进度 ${p}%`, level: "info" }]);
      }
      await new Promise(r => setTimeout(r, 250));
      setLaunchProgress({ pct: 100, text: "创建完成，可以运行" });
      setLaunchLogs(prev => [...prev, { msg: "服务可访问，实例创建完成", level: "success" }]);
      setInstances(prev => prev.some(t => t.id === instance.id) ? prev : [...prev, { ...instance, status: "running" }]);
      return;
    }

    if (instance.type === "remote") {
      const url = instance.url || "";
      setLaunchProgress({ pct: 20, text: "正在检查远程连接" });
      setLaunchLogs([{ msg: `检查 ${url}`, level: "info" }]);
      const result = await TarvenEnv.pingUrl({ url, instanceId: instance.id });
      if (!result.online) throw new Error(result.error || "远程实例当前不可访问");
      setLaunchProgress({ pct: 100, text: "连接可用，创建完成" });
      setLaunchLogs(prev => [...prev, {
        msg: instance.basicAuth ? "远程认证已确认" : "远程实例连接正常",
        level: instance.basicAuth ? "info" : "success",
      }]);
      setInstances(prev => prev.some(t => t.id === instance.id) ? prev : [...prev, { ...instance, status: "online" }]);
      return;
    }

    const result = await doLaunch(instance, false);
    const info = await TarvenEnv.getInstanceInfo({
      instanceId: instance.installDir || instance.id,
      installPath: instance.installPath,
      port: result.port,
    });
    setInstances(prev => prev.some(t => t.id === instance.id)
      ? prev
      : [...prev, {
          ...instance,
          status: "running",
          port: result.port,
          installPath: info.path || instance.installPath,
          createdAt: info.createdAt ? formatNativeDate(info.createdAt) : instance.createdAt,
          lastUsed: info.lastUsedAt ? formatNativeDate(info.lastUsedAt) : instance.lastUsed,
          totalUsage: info.totalUsageMs !== undefined ? formatUsageDuration(info.totalUsageMs) : instance.totalUsage,
        }]);
  }, [doLaunch]);

  const createInstance = useCallback(async () => {
    if (isCreatingInstance || launchingId) return;
    setNewInstanceError(null);
    setIsCreatingInstance(true);
    let operationStarted = false;
    let remoteCredentialsSaved = false;
    let pendingInstanceId: string | null = null;

    try {
      const now = Date.now();
      const instanceId = `new-${now}`;
      pendingInstanceId = instanceId;
      const subtitle = newInstanceName.trim() || "新实例";
      const installDir = isWindows
        ? `local-${now}`
        : normalizeInstanceId(newInstanceDir, `local-${now}`);
      const installPath = isWindows && newInstanceDir.trim() ? newInstanceDir.trim() : undefined;
      let selectedVersion = newInstanceVersion;
      let selectedZipballUrl: string | undefined;

      if (newInstanceMode === "local" && !newInstanceLocalZip) {
        let availableReleases = releases;
        if (availableReleases.length === 0) {
          try {
            const response = await TarvenEnv.fetchReleases();
            availableReleases = response.releases || [];
            setReleases(availableReleases);
          } catch {
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
        const preflight = await TarvenEnv.pingUrl({
          url: remoteUrl,
          ...(newRemoteAuthEnabled
            ? { username: newRemoteAuthUsername.trim(), password: newRemoteAuthPassword }
            : {}),
        });
        if (!preflight.online) throw new Error(preflight.error || "远程实例当前不可访问");
      }

      const instance: TavernInstance = {
        id: instanceId,
        name: "SillyTavern",
        subtitle,
        version: newInstanceLocalZip ? "local" : selectedVersion,
        type: newInstanceMode,
        status: newInstanceMode === "local" ? "stopped" : "offline",
        icon: newInstanceMode === "local" ? <Folder className="w-5 h-5" /> : <Cloud className="w-5 h-5" />,
        color: "#6366f1",
        createdAt: new Date().toISOString().slice(0, 10),
        lastUsed: "—",
        totalUsage: "0s",
        pendingTavernGestureHint: (isAndroid || isIOS) || undefined,
        ...(newInstanceMode === "local"
          ? {
              port,
              installDir,
              installPath,
              zipballUrl: selectedZipballUrl,
              localZipPath: newInstanceLocalZip || undefined,
              companionPreset: newInstanceCompanionPresetEnabled ? SC_BORDEAUX_PRESET : undefined,
              config: { ...DEFAULT_CONFIG },
            }
          : {
              url: remoteUrl,
              basicAuth: newRemoteAuthEnabled
                ? { username: newRemoteAuthUsername.trim() }
                : undefined,
            }),
      };

      if (newInstanceMode === "remote" && newRemoteAuthEnabled) {
        await TarvenEnv.setRemoteBasicAuth({
          instanceId,
          username: newRemoteAuthUsername.trim(),
          password: newRemoteAuthPassword,
        });
        remoteCredentialsSaved = true;
      }

      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      setVerDropdownOpen(false);
      setOperationPurpose("create");
      setLastLaunchParams(instance);
      setShowLaunchPanel(true);
      setLaunchError(null);
      setLaunchProgress({ pct: 0, text: newInstanceMode === "local" ? "准备下载当前版本" : "准备检查连接" });
      setLaunchingId(instance.id);
      operationStarted = true;

      await provisionCreatedInstance(instance);
      setNewInstanceName("");
      setNewInstanceDir("");
      setNewInstanceUrl("http://");
      setNewRemoteAuthEnabled(false);
      setNewRemoteAuthUsername("");
      setNewRemoteAuthPassword("");
      setNewInstanceVersion("stable");
      setNewInstanceCompanionPresetEnabled(false);
      setNewInstanceLocalZip(null);
    } catch (err: any) {
      const message = err?.message || String(err);
      if (!operationStarted) {
        if (remoteCredentialsSaved && pendingInstanceId) {
          try { await TarvenEnv.clearRemoteBasicAuth({ instanceId: pendingInstanceId }); } catch {}
        }
        setNewInstanceError(message);
      } else {
        setLaunchError(message);
        setLaunchProgress(null);
        setLaunchLogs(prev => [...prev, { msg: `创建失败: ${message}`, level: "error" }]);
      }
    } finally {
      setLaunchingId(null);
      setIsCreatingInstance(false);
    }
  }, [
    instances,
    isAndroid,
    isIOS,
    isCreatingInstance,
    launchingId,
    newInstanceDir,
    newInstanceCompanionPresetEnabled,
    newInstanceLocalZip,
    newInstanceMode,
    newInstanceName,
    newInstanceUrl,
    newInstanceVersion,
    newRemoteAuthEnabled,
    newRemoteAuthPassword,
    newRemoteAuthUsername,
    provisionCreatedInstance,
    releases,
  ]);

  // 重试当前操作
  const retryLaunch = useCallback(async () => {
    if (!lastLaunchParams) return;
    setLaunchError(null);
    setLaunchProgress({ pct: 0, text: operationPurpose === "create" ? "重新创建" : "重新启动" });
    if (operationPurpose === "launch" && lastLaunchParams.type === "local") {
      setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running" } : t));
    }
    setLaunchingId(lastLaunchParams.id);
    try {
      if (operationPurpose === "create") {
        await provisionCreatedInstance(lastLaunchParams);
        setTimeout(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 1100);
      } else if (lastLaunchParams.type === "remote") {
        await openRemoteInstance(lastLaunchParams);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "online" } : t));
        setTimeout(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 500);
      } else {
        const result = await doLaunch(lastLaunchParams);
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "running", port: result.port } : t));
        setTimeout(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 800);
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      setLaunchError(msg);
      setLaunchProgress(null);
      setLaunchLogs(prev => [...prev, { msg: `重试失败: ${msg}`, level: "error" }]);
      if (operationPurpose === "launch") {
        setInstances(prev => prev.map(t => t.id === lastLaunchParams.id ? { ...t, status: "error" } : t));
      }
    } finally {
      setLaunchingId(null);
    }
  }, [lastLaunchParams, operationPurpose, doLaunch, openRemoteInstance, provisionCreatedInstance]);

  // 自动化测试演练调度器 (iOS CI E2E Auto Tour)
  const [autoTourStage, setAutoTourStage] = useState<string | null>(null);
  useEffect(() => {
    const testInstance: TavernInstance = {
      id: "ios-autotour-instance",
      name: "SillyTavern 自动化演练",
      subtitle: "端到端真机验证 · 状态栏与沉浸流",
      version: "1.12.0",
      status: "stopped",
      type: "local",
      createdAt: "2026-09-22",
      lastUsed: "刚刚",
      totalUsage: "2 小时",
      color: "#38bdf8",
      port: 8000,
      icon: <Folder className="w-5 h-5" />,
    };

    const resetAllModals = () => {
      setShowManagePanel(null);
      setIsManagePanelClosing(false);
      setShowLaunchPanel(false);
      setIsLaunchPanelClosing(false);
      setIsLaunchMinimized(false);
      setShowAppMenu(false);
      setIsAppMenuClosing(false);
      setShowBgPanel(false);
      setIsPanelClosing(false);
      setShowNewInstancePanel(false);
      setIsNewInstancePanelClosing(false);
      setShowCleanPanel(false);
      setIsCleanPanelClosing(false);
      setPendingDelete(null);
      setShowTerminal(false);
      setIsTerminalClosing(false);
      setActiveCardMenu(null);
      setIsCardMenuClosing(false);
      setExternallyRenamingId(null);
      setRenamingId(null);
      setVerDropdownOpen(false);
      setIsVerDropdownClosing(false);
      setSearchQuery("");
    };

    const handleStage = async (stage: string) => {
      console.log("[AutoTour] Stage triggered:", stage);
      setShowOnboarding(false);
      try { localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION); } catch {}
      setInstances(prev => prev.length === 0 ? [testInstance] : prev);

      if (stage === "stage1") {
        resetAllModals();
        setAutoTourStage("01: 控制台初始化与灵动岛避让 [状态栏正常可见]");
      } else if (stage === "stage_search" || stage === "stage1b") {
        resetAllModals();
        setSearchQuery("Silly");
        setAutoTourStage("01b: 实例全局搜索 [实时过滤与高亮]");
      } else if (stage === "stage_card_menu") {
        resetAllModals();
        setActiveCardMenu(testInstance.id);
        setMenuPos({ top: 220, left: 180 });
        setAutoTourStage("02: 卡片操作浮动菜单 [CardActionMenu 启动/编辑/导出/清理/删除]");
      } else if (stage === "stage_inline_rename") {
        resetAllModals();
        setExternallyRenamingId(testInstance.id);
        setAutoTourStage("02b: 双击标题原地内联重命名 [Inline Title Rename]");
      } else if (stage === "stage2") {
        resetAllModals();
        setShowManagePanel(testInstance);
        setAutoTourStage("02c: 实例管理与属性配置抽屉 [Manage Drawer]");
      } else if (stage === "stage2b") {
        resetAllModals();
        setShowManagePanel(testInstance);
        setAutoTourStage("02d: 调用系统文件选择器 [UIDocumentPickerViewController]");
        TarvenEnv.pickZipFile().then((res) => {
          console.log("[AutoTour] pickZipFile returned:", res);
        }).catch((err) => {
          console.log("[AutoTour] pickZipFile error:", err);
        });
      } else if (stage === "stage2c") {
        resetAllModals();
        setShowManagePanel(testInstance);
        setAutoTourStage("02e: 数据包解析导入成功 [SillyTavern-Backup.zip]");
        setLaunchLogs([
          { msg: "已选取备份文件: SillyTavern-Backup.zip (1.47 MB)", level: "success" },
          { msg: "校验 ZIP 哈希值及 manifest.json 完整性通过", level: "info" }
        ]);
      } else if (stage === "stage_app_settings") {
        resetAllModals();
        setShowAppMenu(true);
        setAppSettingsTab("general");
        setAutoTourStage("03a: 应用系统设置抽屉 [AppSettingsDrawer 通用/数据/维护]");
      } else if (stage === "stage_bg_settings") {
        resetAllModals();
        setShowBgPanel(true);
        setAutoTourStage("03b: 背景与视觉主题设置抽屉 [BackgroundSettingsDrawer]");
      } else if (stage === "stage_wizard") {
        resetAllModals();
        setShowNewInstancePanel(true);
        setNewInstanceName("新酒馆实例");
        setAutoTourStage("03c: 新建实例向导弹窗 [NewInstanceWizardModal 本地/远程]");
      } else if (stage === "stage_ver_dropdown") {
        resetAllModals();
        setShowNewInstancePanel(true);
        setNewInstanceName("新酒馆实例");
        setVerDropdownPos({
          bottom: 240,
          left: 24,
          width: Math.min(window.innerWidth - 48, 380),
          maxHeight: 280,
        });
        setVerDropdownOpen(true);
        setAutoTourStage("03d: 版本选择下拉菜单 [VersionDropdown]");
      } else if (stage === "stage_clean_modal") {
        resetAllModals();
        setShowCleanPanel(true);
        setGarbageItems([
          { id: "cache-1", label: "沙盒运行日志缓存 (server.log)", size: "2.4 MB", checked: true },
          { id: "cache-2", label: "历史备份未解压分卷", size: "14.8 MB", checked: true },
          { id: "cache-3", label: "WebKit 临时离线渲染缓存", size: "8.1 MB", checked: true }
        ]);
        setAutoTourStage("03e: 存储与垃圾清理模态框 [CleanGarbageModal]");
      } else if (stage === "stage_delete_dialog") {
        resetAllModals();
        setPendingDelete(testInstance);
        setAutoTourStage("03f: 实例销毁与删除确认对话框 [DeleteConfirmDialog]");
      } else if (stage === "stage3") {
        resetAllModals();
        setShowLaunchPanel(true);
        setIsLaunchMinimized(false);
        setOperationPurpose("launch");
        setLaunchProgress({ pct: 65, text: "正在调度 Node 运行环境并启动 SillyTavern..." });
        setLaunchLogs([
          { msg: "TarvenEnv.provisionAndStart 调度成功", level: "info" },
          { msg: "加载沙盒环境 Documents/SillyTavern", level: "info" },
          { msg: "Node 运行时状态检查: 正常 (Port: 8000)", level: "success" },
          { msg: "DeepSeek 官方 API 渠道验证: 就绪", level: "info" },
          { msg: "准备加载主界面 WebView 视图", level: "info" },
        ]);
        setAutoTourStage("04a: 启动控制台模态窗 [LaunchConsoleModal live stream]");
      } else if (stage === "stage_capsule") {
        resetAllModals();
        setShowLaunchPanel(true);
        setIsLaunchMinimized(true);
        setAutoTourStage("04b: 启动控制台最小化为后台活动胶囊 [ActivityCapsule]");
      } else if (stage === "stage_terminal") {
        resetAllModals();
        setShowTerminal(true);
        setTerminalLogs([
          { msg: "=== SillyClient iOS 沙盒控制台 ===", level: "info" },
          { msg: "沙盒路径: /var/mobile/Containers/Data/Application/.../Documents", level: "info" },
          { msg: "NodeMobile: v18.20.4 (arm64-apple-ios-simulator, jitless)", level: "info" },
          { msg: "SillyTavern 运行环境端口: 8000 (HTTP 200 OK)", level: "success" },
          { msg: "DeepSeek API: sk-4a9edb...eef2 (deepseek-chat · 官方 Key)", level: "info" },
          { msg: "输入 'status' 或 'gc' 获取运行态诊断", level: "info" },
        ]);
        setAutoTourStage("04c: iOS 沙盒与 NodeMobile 终端交互控制台 [TerminalModal]");
      } else if (stage === "stage4") {
        resetAllModals();
        setAutoTourStage("05a: 酒馆全沉浸态 [状态栏平滑隐藏 prefersStatusBarHidden=true]");
        await TarvenEnv.enterImmersive({ url: "http://127.0.0.1:8000/", showGestureHint: true });
      } else if (stage === "stage5") {
        resetAllModals();
        setAutoTourStage("08: 退出沉浸返回控制台 [状态栏恢复可见]");
        await TarvenEnv.exitImmersive();
      }
    };

    (window as any).__onAutoTourStage = handleStage;

    if (new URLSearchParams(window.location.search).get("autotour") === "1") {
      handleStage("stage1");
      setTimeout(() => handleStage("stage2"), 3000);
      setTimeout(() => handleStage("stage3"), 6000);
      setTimeout(() => handleStage("stage4"), 9000);
      setTimeout(() => handleStage("stage5"), 13000);
    }

    return () => {
      delete (window as any).__onAutoTourStage;
    };
  }, []);

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

  const createInstanceSnapshot = useCallback(() => {
    if (!showManagePanel) return;
    const createdAt = new Date().toISOString();
    const snapshot: InstanceSnapshot = {
      id: `${showManagePanel.id}-${Date.now()}`,
      createdAt,
      label: `快照 ${new Date(createdAt).toLocaleDateString("zh-CN")}`,
      port: draftPort,
      config: { ...draftConfig },
    };
    setInstanceSnapshots(prev => ({
      ...prev,
      [showManagePanel.id]: [snapshot, ...(prev[showManagePanel.id] || [])],
    }));
  }, [draftConfig, draftPort, showManagePanel]);

  const deleteInstanceSnapshot = useCallback((instanceId: string, snapshotId: string) => {
    setInstanceSnapshots(prev => ({
      ...prev,
      [instanceId]: (prev[instanceId] || []).filter(snapshot => snapshot.id !== snapshotId),
    }));
  }, []);

  const closeRenameDialog = useCallback(() => {
    if (!renamingId || isRenameClosing) return;
    if (renameCloseTimerRef.current) clearTimeout(renameCloseTimerRef.current);
    setIsRenameClosing(true);
    renameCloseTimerRef.current = setTimeout(() => {
      setRenamingId(null);
      setIsRenameClosing(false);
      renameCloseTimerRef.current = null;
    }, PANEL_EXIT_MS);
  }, [isRenameClosing, renamingId]);

  const openInstanceTerminal = useCallback((instance: TavernInstance) => {
    setTerminalInstanceId(instance.id);
    setTerminalLogs([{
      msg: `${instance.subtitle || instance.name} · 实例终端${instance.type === "remote" ? "（远程实例不支持本地命令）" : ""}`,
      level: "info",
    }]);
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
          await TarvenEnv.closeTavern();
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
      setInstanceSnapshots(prev => {
        if (!(pendingDelete.id in prev)) return prev;
        const next = { ...prev };
        delete next[pendingDelete.id];
        return next;
      });
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
  }, [instances.length, isDeletingInstance, pendingDelete]);

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
    if (
      operationPurpose === "create" &&
      lastLaunchParams?.type === "remote" &&
      !instances.some(instance => instance.id === lastLaunchParams.id)
    ) {
      try { await TarvenEnv.clearRemoteBasicAuth({ instanceId: lastLaunchParams.id }); } catch {}
      setShowNewInstancePanel(true);
    }
    setIsLaunchPanelClosing(true);
    setTimeout(() => {
      setShowLaunchPanel(false);
      setIsLaunchPanelClosing(false);
      setLaunchError(null);
      setLaunchProgress(null);
    }, PANEL_EXIT_MS);
  }, [instances, isLaunchPanelClosing, lastLaunchParams, operationPurpose]);

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
    if (isWeb) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setTimeout(() => {
      TarvenEnv.enterImmersive({ url }).catch(() => {});
    }, PANEL_EXIT_MS);
  }, [closeAppMenu, isWeb]);

  const replayOnboarding = useCallback(() => {
    closeAppMenu();
    setTimeout(() => setShowOnboarding(true), PANEL_EXIT_MS + 20);
  }, [closeAppMenu]);

  const dismissOnboarding = useCallback(() => {
    localStorage.setItem(ONBOARDING_KEY, ONBOARDING_VERSION);
    setShowOnboarding(false);
  }, []);

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

  return (
    <div
      ref={scrollRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={cn(
        "min-h-screen overflow-y-auto overscroll-none transition-colors duration-900",
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
      <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const parsed = JSON.parse(String(reader.result));
            const incoming = (parsed.instances || []) as TavernInstance[];
            setInstances(prev => {
              const map = new Map(prev.map(t => [t.id, t]));
              for (const item of incoming) {
                const icon = item.type === "local" ? <Folder className="w-5 h-5" /> : <Cloud className="w-5 h-5" />;
                map.set(item.id, { ...item, pendingTavernGestureHint: undefined, icon });
              }
              return Array.from(map.values());
            });
          } catch (err) { console.error('[import]', err); }
        };
        reader.readAsText(file);
        e.target.value = "";
      }} />

      {/* 顶部导航 */}
      <header className="fixed left-0 right-0 z-40 px-4" style={{ top: `max(env(safe-area-inset-top), ${safeInsetTop + 4}px)` }}>
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
            <button onClick={toggleBgPanel} className={cn("flex items-center gap-2 px-4 py-1.5 rounded-full transition-all max-w-[200px] border", isLight ? "hover:bg-black/5 border-black/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05),0_1px_2px_rgba(255,255,255,0.5)]" : "hover:bg-white/10 border-white/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2),0_1px_2px_rgba(255,255,255,0.1)]")}>
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
              if (isWeb) {
                window.open(url, "_blank", "noopener,noreferrer");
              } else {
                TarvenEnv.enterImmersive({ url }).catch(() => {});
              }
              setUpdatePromptDismissed(true);
            }}
            className={cn(
              "motion-control h-7 px-3 rounded-full text-xs font-semibold transition-all border",
              isLight
                ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625] hover:bg-black/[0.14]"
                : "bg-white/20 border-white/15 text-white hover:bg-white/30"
            )}
          >
            查看
          </button>
          <button
            onClick={() => setUpdatePromptDismissed(true)}
            aria-label="关闭更新提示"
            className={cn(
              "motion-control w-7 h-7 rounded-full flex items-center justify-center transition-all",
              isLight ? "hover:bg-black/5 text-[#1a1625]/50" : "hover:bg-white/10 text-white/50"
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
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling.current || isRefreshing ? 'none' : 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
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
                  scrollToSlide(idx);
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
                    scrollToSlide(idx);
                    setSearchQuery("");
                  }}
                  className={cn(
                    "motion-menu-item w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors",
                    isLight ? "bg-[#f5f3ef]/95 hover:bg-black/5 text-[#1a1625]/80" : "bg-[#1a1625]/95 hover:bg-white/10 text-white/80"
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

        {/* 实例卡片轮播 */}
        <div className="w-full max-w-6xl mx-auto px-6 md:px-8">
          <div className="relative">
            <div
              ref={carouselRef}
              className="carousel-scrollbar-hidden flex gap-5 overflow-x-auto snap-x snap-mandatory px-3 py-4 -mx-2"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', scrollPaddingInline: '1px' }}
            >
              <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />

              {/* 新建实例卡片 */}
              <button
                onClick={() => {
                  if (isWeb && !isShowcase) { window.open('https://github.com/CAPTCHAAAAA/SillyClient/releases/latest', '_blank'); return; }
                  setNewInstanceMode("local");
                  setNewInstanceName("");
                  setNewInstanceDir("");
                  setNewInstanceUrl("http://");
                  setNewRemoteAuthEnabled(false);
                  setNewRemoteAuthUsername("");
                  setNewRemoteAuthPassword("");
                  setNewInstanceVersion("stable");
                  setNewInstanceCompanionPresetEnabled(false);
                  setNewInstanceLocalZip(null);
                  setNewInstanceError(null);
                  setShowNewInstancePanel(true);
                }}
                className={cn(
                  "motion-instance-card flex-shrink-0 w-60 h-[320px] rounded-[18px] overflow-hidden snap-center group relative",
                  isLight ? "bg-black/[0.03] border border-black/[0.08] hover:border-black/15" : "bg-white/[0.04] border border-white/[0.06] hover:border-white/15"
                )}
                data-card-index="0"
              >
                <div className="relative h-full flex flex-col justify-between p-3.5">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-[background-color,box-shadow,filter] duration-200", isLight ? "bg-black/[0.06]" : "bg-white/[0.08]")}>
                    <Play className={cn("w-3.5 h-3.5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
                  </div>
                  <div>
                    <div className={cn("text-base font-semibold mb-0.5", isLight ? "text-[#1a1625]" : "text-white")}>{isWeb && !isShowcase ? "下载 APK" : "新建实例"}</div>
                    <div className={cn("text-xs", isLight ? "text-[#1a1625]/40" : "text-white/40")}>{isWeb && !isShowcase ? "获取最新版本" : "设置新的酒馆环境"}</div>
                  </div>
                </div>
              </button>

              {/* 解耦后的实例卡片列表 (支持双击原地内联重命名) */}
              {instances.map((instance, index) => (
                <InstanceCard
                  key={instance.id}
                  instance={instance}
                  index={index}
                  isLight={isLight}
                  hoveredCard={hoveredCard}
                  setHoveredCard={setHoveredCard}
                  activeCardMenu={activeCardMenu}
                  launchingId={launchingId}
                  onLaunch={launchTavern}
                  onOpenMenu={(inst, rect) => {
                    setMenuPos({
                      top: Math.min(rect.bottom + 6, window.innerHeight - 200),
                      left: Math.max(12, Math.min(rect.left - 60, window.innerWidth - 160)),
                    });
                    setActiveCardMenu(inst.id);
                    setIsCardMenuClosing(false);
                  }}
                  onRenameSave={(instanceId, newName) => {
                    setInstances(prev => prev.map(inst => inst.id === instanceId ? { ...inst, name: newName, subtitle: newName } : inst));
                    setExternallyRenamingId(null);
                  }}
                  isExternallyRenaming={externallyRenamingId === instance.id}
                  onClearExternalRenaming={() => setExternallyRenamingId(null)}
                />
              ))}

              <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />
            </div>

            {/* 指示器 + 方向键 */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))}
                disabled={activeSlide === 0}
                className={cn(
                  "motion-control w-7 h-7 rounded-full flex items-center justify-center",
                  activeSlide === 0
                    ? isLight ? "text-[#1a1625]/15 cursor-default" : "text-white/15 cursor-default"
                    : isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/70 hover:bg-[#1a1625]/8" : "text-white/40 hover:text-white/70 hover:bg-white/10"
                )}
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              {Array.from({ length: instances.length + 1 }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToSlide(i)}
                  aria-label={`切换到第 ${i + 1} 张卡片`}
                  aria-current={i === activeSlide ? "true" : undefined}
                  className="motion-control group flex h-4 w-4 items-center justify-center rounded-full"
                >
                  <span className={cn(
                    "block h-1.5 w-4 rounded-full transition-[transform,background-color,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                    i === activeSlide
                      ? isLight ? "scale-x-100 bg-[#1a1625]/45" : "scale-x-100 bg-white/50"
                      : isLight ? "scale-x-[0.375] bg-[#1a1625]/12 group-hover:bg-[#1a1625]/20" : "scale-x-[0.375] bg-white/15 group-hover:bg-white/25"
                  )} />
                </button>
              ))}

              <button
                onClick={() => scrollToSlide(Math.min(instances.length, activeSlide + 1))}
                disabled={activeSlide === instances.length}
                className={cn(
                  "motion-control w-7 h-7 rounded-full flex items-center justify-center",
                  activeSlide === instances.length
                    ? isLight ? "text-[#1a1625]/15 cursor-default" : "text-white/15 cursor-default"
                    : isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/70 hover:bg-[#1a1625]/8" : "text-white/40 hover:text-white/70 hover:bg-white/10"
                )}
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
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
        terminalLogs={terminalLogs}
        setTerminalLogs={setTerminalLogs}
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
        importInputRef={importInputRef}
        appUpdateState={appUpdateState}
        appUpdateInfo={appUpdateInfo}
        checkForAppUpdate={checkForAppUpdate}
        openProjectPage={openProjectPage}
        onOpenCleanGarbage={async () => {
          closeAppMenu();
          setCleaningGarbage(true);
          setShowCleanPanel(true);
          setGarbageItems([]);
          try {
            const { items } = await TarvenEnv.cleanGarbage({ dryRun: true });
            setGarbageItems(items);
          } catch (e) {
            console.error(e);
          }
          setCleaningGarbage(false);
        }}
      />

      {/* 解耦业务组件: 重命名弹窗 (备用兜底) */}
      <RenameModal
        isOpen={!!renamingId}
        isClosing={isRenameClosing}
        onClose={() => {
          setIsRenameClosing(true);
          setTimeout(() => {
            setRenamingId(null);
            setIsRenameClosing(false);
          }, PANEL_EXIT_MS);
        }}
        isLight={isLight}
        glassBg={glassBg}
        value={renameValue}
        onChange={setRenameValue}
        onSave={() => {
          if (renamingId && renameValue.trim()) {
            setInstances(prev => prev.map(inst => inst.id === renamingId ? { ...inst, name: renameValue.trim(), subtitle: renameValue.trim() } : inst));
          }
          setIsRenameClosing(true);
          setTimeout(() => {
            setRenamingId(null);
            setIsRenameClosing(false);
          }, PANEL_EXIT_MS);
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
        launchLogs={launchLogs}
        launchingId={launchingId}
        onRetry={retryLaunch}
        onClose={dismissLaunchPanel}
        onMinimize={() => {
          setIsLaunchPanelClosing(true);
          setTimeout(() => {
            setShowLaunchPanel(false);
            setIsLaunchPanelClosing(false);
            setIsLaunchMinimized(true);
          }, PANEL_EXIT_MS);
        }}
        onEnterTavern={async (params) => {
          await launchTavern(params || lastLaunchParams);
        }}
      />

      {/* 操作内联化: 底部常驻活动胶囊 (Activity Capsule) */}
      {isLaunchMinimized && (launchingId || launchProgress) && (
        <ActivityCapsule
          instanceName={lastLaunchParams?.name || (launchingId ? instances.find(i => i.id === launchingId)?.name : "") || "实例"}
          statusText={launchError ? "启动失败" : (launchProgress?.text || "正在启动...")}
          pct={launchProgress?.pct || 0}
          hasError={!!launchError}
          isComplete={launchProgress?.pct === 100}
          onExpand={() => {
            setIsLaunchMinimized(false);
            setShowLaunchPanel(true);
            setIsLaunchPanelClosing(false);
          }}
          isLight={isLight}
          glassBg={glassBg}
        />
      )}

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
        setNewInstanceDir={setNewInstanceDir}
        newInstanceVersion={newInstanceVersion}
        setNewInstanceVersion={setNewInstanceVersion}
        newInstanceLocalZip={newInstanceLocalZip}
        setNewInstanceLocalZip={setNewInstanceLocalZip}
        newInstanceCompanionPresetEnabled={newInstanceCompanionPresetEnabled}
        setNewInstanceCompanionPresetEnabled={setNewInstanceCompanionPresetEnabled}
        newInstanceUrl={newInstanceUrl}
        setNewInstanceUrl={setNewInstanceUrl}
        newRemoteAuthEnabled={newRemoteAuthEnabled}
        setNewRemoteAuthEnabled={setNewRemoteAuthEnabled}
        newRemoteAuthUsername={newRemoteAuthUsername}
        setNewRemoteAuthUsername={setNewRemoteAuthUsername}
        newRemoteAuthPassword={newRemoteAuthPassword}
        setNewRemoteAuthPassword={setNewRemoteAuthPassword}
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
        glassBg={glassBg}
        isWindows={isWindows}
        allInstances={instances}
        onSelectInstance={(inst) => {
          setShowManagePanel(inst);
          setTerminalInstanceId(inst.id);
        }}
        onOpenNewInstanceWizard={() => {
          closeManagePanel();
          setTimeout(() => {
            setShowNewInstancePanel(true);
            setIsNewInstancePanelClosing(false);
          }, PANEL_EXIT_MS);
        }}
        onLaunchInstance={(inst) => {
          closeManagePanel();
          launchTavern(inst);
        }}
        launchingId={launchingId}
        onTriggerRename={(inst) => {
          closeManagePanel();
          setRenamingId(inst.id);
          setRenameValue(inst.name);
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
        snapshots={instanceSnapshots}
        onCreateSnapshot={createInstanceSnapshot}
        onRestoreSnapshot={(snapshot) => {
          setDraftPort(snapshot.port);
          setDraftConfig({ ...snapshot.config });
          setManageTab("launch");
        }}
        onDeleteSnapshot={deleteInstanceSnapshot}
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
        terminalLogs={terminalLogs}
        setTerminalLogs={setTerminalLogs}
        terminalDisplayPrompt={terminalDisplayPrompt}
        terminalPlaceholder={terminalPlaceholder}
      />

      {/* 首次引导 */}
      {showOnboarding && (
        <OnboardingGuide
          isLight={isLight}
          onComplete={dismissOnboarding}
          onSkip={dismissOnboarding}
        />
      )}

      {/* 【视觉与动效测试专用】底部悬浮调试板：仅在开发或 Web 走查环境可见，用于设计验收与过渡动效测试（打开向导/模拟过渡/模拟完成态），不属于生产业务逻辑，在 Windows/Android 原生正式运行时完全不渲染 */}
      {(import.meta.env.DEV || isWeb) && (
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
              setShowLaunchPanel(false);
              setIsLaunchPanelClosing(false);
              setShowNewInstancePanel(true);
              setIsNewInstancePanelClosing(false);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/90 hover:bg-white/20 active:bg-white/25 font-medium transition-all"
          >
            打开向导
          </button>
          <button
            onClick={() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
              setOperationPurpose("create");
              setLastLaunchParams({ id: "demo-test", name: "体验新实例", type: "local" });
              setShowLaunchPanel(true);
              setIsLaunchPanelClosing(false);
              setLaunchError(null);
              setLaunchProgress({ pct: 45, text: "正在下载运行环境..." });
              setLaunchLogs([
                { msg: "开始创建 体验新实例", level: "info" },
                { msg: "解压运行时与核心组件...", level: "info" },
              ]);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/10 bg-white/10 text-white/90 hover:bg-white/20 active:bg-white/25 font-medium transition-all"
          >
            模拟过渡
          </button>
          <button
            onClick={() => {
              setShowNewInstancePanel(false);
              setIsNewInstancePanelClosing(false);
              setOperationPurpose("create");
              setLastLaunchParams({ id: "demo-test", name: "体验新实例", type: "local" });
              setShowLaunchPanel(true);
              setIsLaunchPanelClosing(false);
              setLaunchError(null);
              setLaunchProgress({ pct: 100, text: "创建完成，可以运行" });
              setLaunchLogs([
                { msg: "服务可访问，实例创建完成", level: "success" },
              ]);
            }}
            className="motion-control h-7 px-3 rounded-full border border-white/20 bg-white/20 text-white hover:bg-white/30 active:bg-white/35 font-semibold transition-all"
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
            className="motion-control w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {autoTourStage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-white font-mono text-[11px] font-medium shadow-2xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>{autoTourStage}</span>
        </div>
      )}
    </div>
  );
}

export default SillyClientLauncher;
