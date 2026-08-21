import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef, useCallback, useMemo, startTransition } from "react";
import { createPortal } from "react-dom";
import {
  Menu,
  ChevronDown,
  Check,
  X,
  Play,
  Search,
  Folder,
  Cloud,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  Moon,
  Sun,
  Image as ImageIcon,
  Terminal,
  SlidersHorizontal,
  History,
  HardDrive,
  Info,
  MoreHorizontal,
  Eraser,
  AlertTriangle,
  LoaderCircle,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv, DEFAULT_CONFIG } from "@/capacitor-plugin";
import type { AppUpdateInfo, ContentOpenMode, InstanceConfig, GithubRelease } from "@/capacitor-plugin";
import OnboardingGuide from "@/components/onboarding/OnboardingGuide";

export const Route = createFileRoute("/")({
  component: SillyClientLauncher,
});

interface TavernInstance {
  id: string;
  name: string;
  subtitle?: string;
  version?: string;
  status: "running" | "stopped" | "error" | "online" | "offline";
  type: "local" | "remote";
  lastUsed?: string;
  createdAt?: string;
  totalUsage?: string;
  icon: React.ReactNode;
  color: string;
  /** 本地实例监听端口(type=local 时有效),默认 8000 */
  port?: number;
  /** 远程实例地址(type=remote 时有效) */
  url?: string;
  /** 远程实例的 Basic Auth 元数据；密码只保存在平台安全存储中。 */
  basicAuth?: {
    username: string;
  };
  /** 安装目录标识(本地实例,用于多实例隔离) */
  installDir?: string;
  /** Windows 本地实例实际安装目录。 */
  installPath?: string;
  /** GitHub release zipball 下载地址(本地实例首次安装时下载) */
  zipballUrl?: string;
  /** 本地 zip 文件路径(从本地导入) */
  localZipPath?: string;
  /** 自定义封面图片路径(更换插图) */
  cover?: string;
  /** 本地实例运行配置(映射管理面板设置) */
  config?: InstanceConfig;
  /** Android 新建实例首次进入酒馆时显示状态栏返回提示；仅在用户实际滑动返回后清除。 */
  pendingTavernGestureHint?: boolean;
}

type ManageTab = "launch" | "snapshots" | "storage" | "terminal" | "about";

interface InstanceSnapshot {
  id: string;
  createdAt: string;
  label: string;
  port: number;
  config: InstanceConfig;
}

const INSTANCES_KEY = "sillyclient.instances";
const INSTANCES_VERSION_KEY = "sillyclient.instances.version";
const ONBOARDING_KEY = "sillyclient.onboarding.version";
const ONBOARDING_VERSION = "2";
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

type BgMode = "dynamic" | "custom";
type ThemeStyle = "dark" | "light";
type OperationPurpose = "launch" | "create";

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
function NewInstanceField({ label, desc, isLight, children }: { label: string; desc?: string; isLight: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn("text-xs font-medium mb-1.5", isLight ? "text-[#1a1625]/70" : "text-white/70")}>{label}</div>
      {desc && <div className={cn("text-[10px] mb-2", isLight ? "text-[#1a1625]/30" : "text-white/30")}>{desc}</div>}
      {children}
    </div>
  );
}

function ManageItem({ label, desc, isLight, children }: { label: string; desc?: string; isLight: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-3 border-b last:border-b-0", isLight ? "border-black/[0.04]" : "border-white/[0.04]")}>
      <div className="flex-1 min-w-0">
        <div className={cn("text-xs font-medium mb-0.5", isLight ? "text-[#1a1625]/70" : "text-white/70")}>{label}</div>
        <div className={cn("text-[10px] leading-snug", isLight ? "text-[#1a1625]/30" : "text-white/30")}>{desc}</div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ManageDetailRow({ label, value, isLight, mono = false }: { label: string; value: React.ReactNode; isLight: boolean; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span className={cn("text-xs flex-shrink-0", isLight ? "text-[#1a1625]/40" : "text-white/40")}>{label}</span>
      <span className={cn("text-xs font-medium text-right break-all", mono && "font-mono text-[10px]", isLight ? "text-[#1a1625]/70" : "text-white/70")}>{value}</span>
    </div>
  );
}

function AppSettingsRow({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="app-settings-row">
      <div className="app-settings-copy">
        <div className="app-settings-label">{label}</div>
        <div className="app-settings-desc">{desc}</div>
      </div>
      <div className="app-settings-control">{children}</div>
    </div>
  );
}

function AppSettingsPlaceholder() {
  return (
    <div className="app-settings-row is-pending" aria-disabled="true">
      <span className="app-settings-pending">等待后续添加</span>
    </div>
  );
}

function AppSettingsLinkRow({
  label,
  desc,
  onClick,
}: {
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="app-settings-row app-settings-link-row" onClick={onClick}>
      <span className="app-settings-copy">
        <span className="app-settings-label">{label}</span>
        <span className="app-settings-desc">{desc}</span>
      </span>
    </button>
  );
}

function AppSettingsAction({
  children,
  onClick,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  tone?: "default" | "warning" | "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "app-settings-action motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0",
        tone !== "default" && `is-${tone}`
      )}
    >
      {children}
    </button>
  );
}

function ToggleSwitch({ defaultOn = false, on, onChange, isLight }: { defaultOn?: boolean; on?: boolean; onChange?: (v: boolean) => void; isLight: boolean }) {
  const [internal, setInternal] = useState(defaultOn);
  const isControlled = on !== undefined;
  const value = isControlled ? on! : internal;
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => { if (!isControlled) setInternal(!internal); onChange?.(!value); }}
      className={cn(
        "relative w-10 h-[22px] rounded-full transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        value
          ? isLight ? "bg-[#1a1625]/60" : "bg-white/30"
          : isLight ? "bg-black/[0.08]" : "bg-white/[0.08]"
      )}
    >
      <div className={cn(
        "absolute left-[2px] top-[2px] w-[18px] h-[18px] rounded-full shadow-sm transition-[transform,background-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        value && "translate-x-[18px]",
        isLight
          ? "bg-white shadow-black/10"
          : value ? "bg-white shadow-white/20" : "bg-white/50 shadow-black/15"
      )} />
    </button>
  );
}

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
  const terminalTitle = isWindows ? "Windows 控制台" : "Android 终端";
  const terminalPrompt = isWindows ? "C:\\>" : "~ $";
  const terminalBanner = isWindows
    ? "SillyClient 1.8.2 · Windows · cmd.exe"
    : "SillyClient 1.8.2 · Android shell";
  const terminalPlaceholder = isWindows ? "输入 Windows 命令" : "输入 Android shell 命令";
  const [showOnboarding, setShowOnboarding] = useState(
    () => (!isWeb || isWindows) && !isShowcase && localStorage.getItem(ONBOARDING_KEY) !== ONBOARDING_VERSION,
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
  const [appUpdateInfo, setAppUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [appUpdateState, setAppUpdateState] = useState<"idle" | "checking" | "current" | "available" | "error">("idle");
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
      const result = await TarvenEnv.checkAppUpdate();
      setAppUpdateInfo(result);
      setAppUpdateState(result.updateAvailable ? "available" : "current");
      return result;
    } catch (error) {
      console.warn("[checkAppUpdate]", error);
      setAppUpdateState("error");
      return null;
    }
  }, []);

  useEffect(() => {
    if ((isWeb && !isWindows) || isShowcase) return;
    const timer = window.setTimeout(() => { void checkForAppUpdate(); }, 900);
    return () => window.clearTimeout(timer);
  }, [checkForAppUpdate, isShowcase, isWeb, isWindows]);

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
    startTransition(apply);
    if (themeSmoothingTimer.current !== null) window.clearTimeout(themeSmoothingTimer.current);
    themeSmoothingTimer.current = window.setTimeout(() => setThemeSmoothing(false), 1200);
  }, []);

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

    setLaunchProgress({ pct: 0, text: "初始化" });
    setLaunchError(null);
    setLaunchLogs([{ msg: `启动 ${instance.name} (${instance.type})`, level: "info" }]);
    setLaunchLogs(prev => [...prev, { msg: `准备 Node 环境 [${instanceId}] :${port}`, level: "info" }]);

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
      const provisionResult = await TarvenEnv.provisionAndStart({ port, instanceId, version, zipballUrl, localZipPath, installPath, config });
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
        setTimeout(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 800);
      } else {
        await openRemoteInstance(instance);
        setInstances(prev => prev.map(t => t.id === instance.id ? { ...t, status: "online" } : t));
        setTimeout(() => { setShowLaunchPanel(false); setLaunchProgress(null); }, 500);
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
          const response = await TarvenEnv.fetchReleases();
          availableReleases = response.releases || [];
          setReleases(availableReleases);
        }
        const selectedRelease = selectedVersion === "stable"
          ? availableReleases.find(release => !release.prerelease) || availableReleases[0]
          : availableReleases.find(release => release.tag === selectedVersion);
        if (!selectedRelease) throw new Error("无法获取当前 SillyTavern 版本，请检查网络后重试");
        selectedVersion = selectedRelease.tag;
        selectedZipballUrl = selectedRelease.zipballUrl;
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
        pendingTavernGestureHint: isAndroid || undefined,
        ...(newInstanceMode === "local"
          ? {
              port,
              installDir,
              installPath,
              zipballUrl: selectedZipballUrl,
              localZipPath: newInstanceLocalZip || undefined,
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
      setTimeout(() => {
        setShowLaunchPanel(false);
        setLaunchProgress(null);
        setNewInstanceName("");
        setNewInstanceDir("");
        setNewInstanceUrl("http://");
        setNewRemoteAuthEnabled(false);
        setNewRemoteAuthUsername("");
        setNewRemoteAuthPassword("");
        setNewInstanceVersion("stable");
        setNewInstanceLocalZip(null);
      }, 1100);
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
    isCreatingInstance,
    launchingId,
    newInstanceDir,
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
    if (
      operationPurpose === "create" &&
      lastLaunchParams?.type === "remote" &&
      !instances.some(instance => instance.id === lastLaunchParams.id)
    ) {
      try { await TarvenEnv.clearRemoteBasicAuth({ instanceId: lastLaunchParams.id }); } catch {}
      setShowNewInstancePanel(true);
    }
    setShowLaunchPanel(false);
    setLaunchError(null);
    setLaunchProgress(null);
  }, [instances, lastLaunchParams, operationPurpose]);

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
    )}>
      {/* 下拉刷新指示器 — 固定在顶部,不跟随拖拽 */}
      <div className="fixed left-0 right-0 z-[60] flex justify-center pointer-events-none" style={{ top: `calc(env(safe-area-inset-top) + 72px)`, opacity: pullDistance > 5 || isRefreshing ? 1 : 0, transition: isRefreshing || !isPulling.current ? 'opacity 0.3s' : 'none' }}>
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

      {/* 背景设置面板 */}
      {(showBgPanel || isPanelClosing) && (
        <div
          className={cn(
            "ios-floating-menu fixed left-1/2 -translate-x-1/2 z-[55] w-72 border backdrop-blur-[40px] saturate-180 rounded-[var(--radius-3xl)]",
            isLight ? "bg-white/60 border-black/5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]" : "glass-panel",
            isLight && "is-light",
            isPanelClosing ? "bg-panel-exit" : "bg-panel-enter"
          )}
          style={{ top: `calc(max(env(safe-area-inset-top), ${safeInsetTop + 4}px) + 3.5rem)` }}
        >
          <div className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white/90")}>背景设置</span>
              <button onClick={toggleBgPanel} className={cn("p-1 rounded-lg transition-colors", isLight ? "hover:bg-black/5 text-[#1a1625]/60" : "hover:bg-white/5 text-white/40")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/50" : "text-white/40")}>背景模式</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => switchThemeMode(() => setBgMode("dynamic"))} aria-pressed={bgMode === "dynamic"} className={cn(
                  "ios-choice-control px-2 py-2 rounded-lg text-xs font-medium transition-all border",
                  bgMode === "dynamic"
                    ? isLight ? "bg-black/10 border-black/20 text-[#1a1625]" : "bg-white/10 border-white/20 text-white/90"
                    : isLight ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                )}>基础</button>
                <button onClick={() => switchThemeMode(() => setBgMode("custom"))} aria-pressed={bgMode === "custom"} className={cn(
                  "ios-choice-control px-2 py-2 rounded-lg text-xs font-medium transition-all border",
                  bgMode === "custom"
                    ? isLight ? "bg-black/10 border-black/20 text-[#1a1625]" : "bg-white/10 border-white/20 text-white/90"
                    : isLight ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                )}>自定义</button>
              </div>
            </div>

            {bgMode === "dynamic" && (
              <div className="flex items-center justify-between py-1">
                <span className={cn("text-xs font-medium", isLight ? "text-[#1a1625]" : "text-white/90")}>动态壁纸</span>
                <button onClick={() => setDynamicPaused(!dynamicPaused)} className="ios-toggle" aria-label="切换动态壁纸">
                  <div className={cn("ios-toggle-track", !dynamicPaused && "ios-toggle-track-active")}>
                    <div className="ios-toggle-icons">
                      <span className="ios-toggle-icon-off">○</span>
                      <span className="ios-toggle-icon-on">│</span>
                    </div>
                    <div className={cn("ios-toggle-thumb", !dynamicPaused && "ios-toggle-thumb-active")} />
                  </div>
                </button>
              </div>
            )}

            {bgMode === "custom" && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/50" : "text-white/40")}>主题风格</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => switchThemeMode(() => setThemeStyle("dark"))} aria-pressed={themeStyle === "dark"} className={cn(
                      "ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                      themeStyle === "dark"
                        ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                        : isLight ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    )}><Moon className="w-3.5 h-3.5" /> 暗夜</button>
                    <button onClick={() => switchThemeMode(() => setThemeStyle("light"))} aria-pressed={themeStyle === "light"} className={cn(
                      "ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                      themeStyle === "light"
                        ? isLight ? "bg-black/10 border-black/20 text-[#1a1625]" : "bg-white/10 border-white/20 text-white/90"
                        : isLight ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10" : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    )}><Sun className="w-3.5 h-3.5" /> 白天</button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/50" : "text-white/40")}>壁纸图片</span>
                  <button onClick={() => wallpaperInputRef.current?.click()} className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all border",
                    isLight ? "bg-black/5 border-black/10 hover:bg-black/10 text-[#1a1625]" : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                  )}>
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", customWallpaperUrl ? "bg-emerald-500/20 text-emerald-400" : isLight ? "bg-black/10 text-[#1a1625]/50" : "bg-white/10 text-white/50")}>
                      {customWallpaperUrl ? <Check className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]" : "text-white/90")}>{customWallpaperUrl ? "已导入壁纸" : "导入本地图片"}</div>
                      <div className={cn("text-[10px] truncate", isLight ? "text-[#1a1625]/50" : "text-white/40")}>{customWallpaperUrl ? "点击更换" : "支持 JPG / PNG / WebP"}</div>
                    </div>
                  </button>
                  {customWallpaperUrl && (
                    <button onClick={() => setCustomWallpaperUrl(null)} className={cn(
                      "w-full px-3 py-2 rounded-lg text-[10px] font-medium transition-all border",
                      isLight ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/15" : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
                    )}>移除壁纸</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 顶部导航 */}
      <header className="fixed left-0 right-0 z-50 px-4" style={{ top: `max(env(safe-area-inset-top), ${safeInsetTop + 4}px)` }}>
        <div className={cn("h-12 flex items-center px-3 rounded-[var(--radius-3xl)] border backdrop-blur-[40px] saturate-180 transition-colors", isLight ? "bg-white/60 border-black/5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]" : "glass-panel")}>
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              ref={terminalBtnRef}
              onClick={() => {
                // Windows uses the shared web renderer, but still exposes the native terminal bridge.
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
          )}>
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* 终端面板 */}
      {(showTerminal || isTerminalClosing) && (
        <div
          className={cn(
            "fixed z-[55] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
            glassBg,
            isTerminalClosing ? "animate-terminal-exit" : "animate-terminal-enter"
          )}
          style={{
            top: `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 5.5rem)`,
            left: terminalPos.left,
            right: terminalPos.right,
            width: terminalSize.w,
            height: terminalSize.h,
            minWidth: 320,
            minHeight: 200,
            maxWidth: `calc(100vw - ${terminalPos.left + terminalPos.right}px)`,
            maxHeight: 'calc(100vh - 7rem)',
          }}
        >
          {/* 标题栏 */}
          <div className={cn(
            "flex items-center justify-between px-4 h-9 flex-shrink-0 border-b",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}>
            <div className="flex items-center gap-2">
              <Terminal className={cn("w-3.5 h-3.5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
              <span className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/50" : "text-white/50")}>{terminalDisplayTitle}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* iOS 横向滚轮 — 字号调节 */}
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg",
                isLight ? "bg-black/[0.04]" : "bg-white/[0.04]"
              )}>
                <span className={cn("text-[10px] tabular-nums w-6 text-right", isLight ? "text-[#1a1625]/35" : "text-white/35")}>{terminalFontSize}</span>
                <input
                  type="range"
                  min={9}
                  max={20}
                  step={1}
                  value={terminalFontSize}
                  onChange={(e) => setTerminalFontSize(Number(e.target.value))}
                  className={cn("ios-font-slider w-14 h-1 appearance-none bg-none cursor-pointer", isLight && "ios-font-slider-light")}
                />
                <span className={cn("text-[10px]", isLight ? "text-[#1a1625]/25" : "text-white/25")}>A</span>
              </div>
              <button
                onClick={() => {
                  setTerminalLogs([]);
                }}
                title="清空终端"
                className={cn("p-1 rounded-md transition-colors", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}
              >
                <Eraser className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  setIsTerminalClosing(true);
                  setTimeout(() => { setShowTerminal(false); setIsTerminalClosing(false); }, PANEL_EXIT_MS);
                }}
                className={cn("p-1 rounded-md transition-colors", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* 终端内容区 */}
          <div
            className={cn("flex-1 font-mono leading-relaxed p-4 overflow-y-auto scrollbar-subtle", isLight ? "bg-[#1e1e2e]/90 text-[#cdd6f4]" : "bg-[#0d0d14]/90 text-[#cdd6f4]")}
            style={{ fontSize: `${terminalFontSize}px` }}
          >
            <div className="opacity-50 mb-1">{terminalDisplayBanner}</div>
            {terminalLogs.map((log, i) => (
              <div key={i} className={cn(
                "mb-0.5 whitespace-pre-wrap break-all",
                log.level === "error" ? "text-red-400" : log.level === "success" ? "text-emerald-400" : "opacity-80"
              )}>{log.msg}</div>
            ))}
            <div className="flex gap-2 mt-1">
              <span className="text-emerald-400/70 select-none">{terminalDisplayPrompt}</span>
              <input
                type="text"
                value={terminalInput}
                onChange={(e) => setTerminalInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && terminalInput.trim() && terminalInstance?.type !== "remote" && terminalInstance) {
                    const cmd = terminalInput.trim();
                    const instanceId = terminalInstance.installDir || terminalInstance.id;
                    setTerminalLogs(prev => [...prev, { msg: `${terminalDisplayPrompt} ${cmd}`, level: "info" }]);
                    TarvenEnv.sendCommand({ text: cmd, instanceId }).catch(() => {});
                    setTerminalInput("");
                  }
                }}
                className="flex-1 bg-transparent outline-none text-[#cdd6f4] border-none"
                placeholder={terminalDisplayPlaceholder}
                disabled={!terminalInstance || terminalInstance.type === "remote"}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>
          </div>

          {/* 拖拽调整大小手柄 — 简约斜线标识 */}
          <div
            className={cn("absolute bottom-1 right-1 w-5 h-5 cursor-se-resize z-10 opacity-40 transition-opacity hover:opacity-80 touch-none", isLight ? "text-[#1a1625]" : "text-white")}
            onMouseDown={(e) => startResize(e.clientX, e.clientY)}
            onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; startResize(t.clientX, t.clientY); }}
          >
            <svg viewBox="0 0 12 12" fill="none" className="w-full h-full">
              <line x1="11" y1="1" x2="5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="11" y1="4" x2="8" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      )}

      {/* APP 菜单 */}
      {(showAppMenu || isAppMenuClosing) && (
        <>
          <div className={cn(
            "fixed inset-0 z-[56] bg-black/15 backdrop-blur-[2px] overlay-backdrop",
            isAppMenuClosing && "overlay-backdrop-exit"
          )} onClick={closeAppMenu} />
          <div className={cn(
            "ios-task-surface app-settings-surface fixed z-[58] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
            glassBg,
            isLight && "is-light",
            isAppMenuClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
          )} style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(460px, calc(100vw - 2rem))',
            maxHeight: 'min(85vh, calc(100vh - 4rem))',
          }}>
            {/* 头部 */}
            <div className={cn("app-settings-header flex items-center justify-between px-5 h-12 flex-shrink-0 border-b", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>APP 设置</span>
              <div className="app-settings-header-actions">
                <button onClick={closeAppMenu} className={cn("motion-control p-1.5 rounded-lg transition-colors", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="app-settings-body flex-1 overflow-y-auto p-5 scrollbar-subtle">
              <div className="app-settings-tabs flex gap-2" role="group" aria-label="设置分类">
                {([
                  { id: "general", label: "通用" },
                  { id: "data", label: "数据" },
                  { id: "maintenance", label: "维护" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    aria-pressed={appSettingsTab === tab.id}
                    className="app-settings-tab ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border"
                    onClick={() => setAppSettingsTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div
                key={appSettingsTab}
                id={`app-settings-panel-${appSettingsTab}`}
                className="app-settings-tab-panel motion-tab-content"
                aria-live="polite"
              >
                {appSettingsTab === "general" && (
                  <div className="app-settings-list">
                    <AppSettingsRow label="下拉刷新" desc="在酒馆界面顶部下拉即可刷新">
                      <ToggleSwitch on={pullToRefresh} onChange={(v) => { setPullToRefresh(v); TarvenEnv.setPullToRefresh({ enabled: v }).catch(() => {}); }} isLight={isLight} />
                    </AppSettingsRow>
                    {isWindows && (
                      <AppSettingsRow label="系统浏览器" desc="关闭后将在 SillyClient 窗口内打开">
                        <ToggleSwitch
                          on={contentOpenMode === "browser"}
                          onChange={(useBrowser) => {
                            const previous = contentOpenMode;
                            const mode: ContentOpenMode = useBrowser ? "browser" : "webview";
                            setContentOpenMode(mode);
                            TarvenEnv.setContentOpenMode({ mode }).catch(() => setContentOpenMode(previous));
                          }}
                          isLight={isLight}
                        />
                      </AppSettingsRow>
                    )}
                    <AppSettingsLinkRow
                      label="重新演示引导"
                      desc="再次查看 SillyClient 的使用说明"
                      onClick={replayOnboarding}
                    />
                    <AppSettingsPlaceholder />
                  </div>
                )}

                {appSettingsTab === "data" && (
                  <div className="app-settings-list">
                    <AppSettingsRow label="实例备份" desc="迁移实例列表与应用设置">
                      <div className="app-settings-actions">
                        <AppSettingsAction onClick={() => importInputRef.current?.click()}>导入</AppSettingsAction>
                        <AppSettingsAction onClick={async () => {
                          const data = JSON.stringify({
                            version: 2,
                            instances: instances.map(({ icon: _icon, pendingTavernGestureHint: _pendingHint, ...rest }) => rest),
                            exportedAt: new Date().toISOString(),
                          }, null, 2);
                          const fileName = `sillyclient-backup-${new Date().toISOString().slice(0,10)}.json`;
                          if (Capacitor.isNativePlatform()) {
                            try {
                              await TarvenEnv.saveTextFile({
                                fileName,
                                mimeType: 'application/json',
                                content: data,
                              });
                            } catch { /* 用户取消或原生保存失败时回到启动器 */ }
                            closeAppMenu();
                            return;
                          }
                          const blob = new Blob([data], { type: 'application/json' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url; a.download = fileName;
                          a.click();
                          URL.revokeObjectURL(url);
                          closeAppMenu();
                        }}>导出</AppSettingsAction>
                      </div>
                    </AppSettingsRow>
                    <AppSettingsRow label="浏览数据" desc="清除应用内网页缓存">
                      <AppSettingsAction onClick={() => TarvenEnv.clearWebViewData().catch(() => {})}>清除</AppSettingsAction>
                    </AppSettingsRow>
                    <AppSettingsPlaceholder />
                  </div>
                )}

                {appSettingsTab === "maintenance" && (
                  <div className="app-settings-list">
                    <AppSettingsRow
                      label="检查新版本"
                      desc={appUpdateState === "available"
                        ? `发现 SillyClient v${appUpdateInfo?.latestVersion}`
                        : appUpdateState === "checking"
                          ? "正在检查 SillyClient 更新"
                          : appUpdateState === "error"
                            ? "暂时无法连接更新服务"
                            : appUpdateState === "current"
                              ? `当前已是最新版本 v${appUpdateInfo?.currentVersion}`
                              : "启动时自动检查，也可随时手动检查"}
                    >
                      <div className="app-settings-actions">
                        <AppSettingsAction onClick={() => { void checkForAppUpdate(); }}>
                          {appUpdateState === "checking" ? "检查中" : "检查"}
                        </AppSettingsAction>
                        {appUpdateInfo?.updateAvailable && appUpdateInfo.releaseUrl && (
                          <AppSettingsAction onClick={() => {
                            const url = appUpdateInfo.releaseUrl!;
                            closeAppMenu();
                            if (isWeb) {
                              window.open(url, "_blank", "noopener,noreferrer");
                            } else {
                              window.setTimeout(() => { TarvenEnv.enterImmersive({ url }).catch(() => {}); }, PANEL_EXIT_MS);
                            }
                          }}>查看</AppSettingsAction>
                        )}
                      </div>
                    </AppSettingsRow>
                    <AppSettingsRow label="临时文件" desc="扫描可以安全移除的缓存">
                      <AppSettingsAction tone="warning" onClick={async () => {
                        closeAppMenu();
                        setCleaningGarbage(true);
                        setShowCleanPanel(true);
                        setGarbageItems([]);
                        try {
                          const { items } = await TarvenEnv.cleanGarbage({ dryRun: true });
                          setGarbageItems(items);
                        } catch (e) { console.error(e); }
                        setCleaningGarbage(false);
                      }}>检查</AppSettingsAction>
                    </AppSettingsRow>
                    <AppSettingsRow label="重置 SillyClient" desc="清除实例列表与本地数据">
                      <AppSettingsAction tone="danger" onClick={() => { if (confirm("确认清空数据并重新初始化？所有实例将被删除")) { localStorage.removeItem("sillyclient.instances"); TarvenEnv.clearWebViewData().catch(() => {}); setInstances([]); } }}>重置</AppSettingsAction>
                    </AppSettingsRow>
                    <AppSettingsLinkRow
                      label="项目发布页"
                      desc="查看安装包、更新说明与项目动态"
                      onClick={openProjectPage}
                    />
                    <AppSettingsPlaceholder />
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* 主内容 — 跟随下拉拖拽(iOS 原生风格) */}
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
            <span style={{
              color: isLight ? '#a09b9e' : '#ffd2dc',
            }}>Silly</span>
            <span style={{
              color: '#e8365d',
            }}>Client</span>
          </span>
          <div className={cn(
            "text-[10px] opacity-0 group-hover:opacity-100 transition-opacity duration-300",
            isLight ? "text-[#1a1625]/25" : "text-white/25"
          )}>{logoFonts[logoFontIndex].name}</div>
        </div>

        {/* 搜索栏 */}
        <div className="relative mb-10 w-full max-w-2xl">
          <Search className={cn("absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => {
            if (e.key === "Enter") {
              const match = instances.find(t => (t.subtitle || t.name).toLowerCase().includes(searchQuery.toLowerCase()));
              if (match) {
                const idx = instances.indexOf(match) + 1; // +1 因为新建卡片在 index 0
                scrollToSlide(idx);
              }
            }
          }} placeholder="搜索并打开实例" className={cn(
            "w-full h-14 pl-12 pr-4 rounded-[20px] border focus:outline-none focus:border-[#1a1625]/30 transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
            isLight ? "bg-black/5 border-black/10 text-[#1a1625] placeholder:text-[#1a1625]/40 focus:bg-black/8" : "bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:bg-white/10"
          )} />
          {searchQuery && (
            <div className="motion-menu-list animate-dropdown absolute top-full left-0 right-0 mt-2 rounded-2xl border overflow-hidden z-30 max-h-64 overflow-y-auto scrollbar-subtle">
              {searchResults.map(t => (
                <button key={t.id} onClick={() => { const idx = instances.indexOf(t) + 1; scrollToSlide(idx); setSearchQuery(""); }} className={cn(
                  "motion-menu-item w-full px-4 py-3 text-left text-sm flex items-center gap-3 transition-colors",
                  isLight ? "bg-[#f5f3ef]/95 hover:bg-black/5 text-[#1a1625]/80" : "bg-[#1a1625]/95 hover:bg-white/10 text-white/80"
                )}>
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

              {/* 新建实例 */}
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

              {/* 实例卡片 */}
              {instances.map((instance, index) => (
                <div
                    key={instance.id}
                    data-card-index={String(index + 1)}
                    className={cn(
                      "motion-instance-card flex-shrink-0 w-60 h-[320px] rounded-[18px] snap-center relative group border",
                      hoveredCard === instance.id && "is-expanded",
                      isLight
                        ? cn("border-black/[0.08]", hoveredCard === instance.id && "border-black/15 z-20", activeCardMenu === instance.id && "border-black/25 ring-1 ring-black/10 z-30")
                        : cn("border-white/[0.06]", hoveredCard === instance.id && "border-white/15 z-20", activeCardMenu === instance.id && "border-white/25 ring-1 ring-white/10 z-30")
                    )}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    setHoveredCard(hoveredCard === instance.id ? null : instance.id);
                  }}
                >
                    <div className="absolute inset-0 rounded-[18px] overflow-hidden">
                    <img src={instance.cover || "./tavern-logo.png"} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0" style={{
                      background: isLight
                        ? 'linear-gradient(135deg, oklch(1 0 0 / 0.40) 0%, oklch(1 0 0 / 0.25) 100%)'
                        : 'oklch(0 0 0 / 0.5)'
                    }} />
                  </div>

                    <div className={cn(
                      "absolute inset-0 rounded-[18px] transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isLight ? "bg-gradient-to-t from-white/70 via-white/35 to-white/5" : "bg-gradient-to-t from-black/75 via-black/40 to-black/10",
                      hoveredCard === instance.id ? "opacity-0" : "opacity-100"
                    )} />
                    <div className={cn(
                      "absolute inset-0 rounded-[18px] bg-gradient-to-t from-black/80 via-black/50 to-black/20 transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                      hoveredCard === instance.id ? "opacity-100" : "opacity-0"
                    )} />

                    <div className="relative h-full flex flex-col p-3.5 overflow-hidden rounded-[18px]">
                    <span className={cn(
                      "self-start px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border backdrop-blur-md w-fit",
                      isLight && hoveredCard !== instance.id
                        ? "bg-black/[0.06] text-[#1a1625]/55 border-black/[0.08]"
                        : "bg-white/[0.08] text-white/50 border-white/[0.08]"
                    )}>
                      {instance.version || "—"}
                    </span>

                    <div className="flex-1" />

                    <div className={cn(
                      "text-sm font-medium leading-snug mb-2",
                      isLight && hoveredCard !== instance.id ? "text-[#1a1625]/75" : "text-white/80"
                    )}>{instance.subtitle}</div>

                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "flex items-center justify-center shrink-0 scale-[0.72]",
                          isLight && hoveredCard !== instance.id ? "text-[#1a1625]/50" : "text-white"
                        )}>
                          {instance.icon}
                        </span>
                        <span className={cn(
                          "text-[10px] font-medium",
                          isLight && hoveredCard !== instance.id ? "text-[#1a1625]/45" : "text-white/55"
                        )}>
                          {instance.type === "local" ? "本地" : "远程"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className={cn("w-1.5 h-1.5 rounded-full",
                          instance.type === "local"
                            ? "bg-sky-400/70 shadow-[0_0_4px_sky-400/50]"
                            : instance.status === "online"
                              ? "bg-emerald-400/70 shadow-[0_0_4px_emerald-400/50]"
                              : "bg-red-400/60 shadow-[0_0_3px_red-400/40]"
                        )} />
                        <span className={cn("text-[10px] font-medium",
                          instance.type === "local"
                            ? "text-sky-400/80 shadow-[0_0_6px_sky-400/40]"
                            : instance.status === "online"
                              ? "text-emerald-400/80 shadow-[0_0_6px_emerald-400/40]"
                              : "text-red-400/60 shadow-[0_0_4px_red-400/30]"
                        )}>
                          {instance.type === "local" ? "本地" : getStatusText(instance.status)}
                        </span>
                      </div>
                    </div>

                    <div className={cn("motion-accordion", hoveredCard === instance.id && "is-open")} aria-hidden={hoveredCard !== instance.id}>
                      <div className="motion-accordion-inner">
                      <div className="pt-2 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn(
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/35" : "text-white/40"
                          )}>创建时间</span>
                          <span className={cn(
                            "font-medium tabular-nums",
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/60" : "text-white/70"
                          )}>{instance.createdAt || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn(
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/35" : "text-white/40"
                          )}>上次使用</span>
                          <span className={cn(
                            "font-medium tabular-nums",
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/60" : "text-white/70"
                          )}>{instance.lastUsed || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className={cn(
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/35" : "text-white/40"
                          )}>累计使用</span>
                          <span className={cn(
                            "font-medium tabular-nums",
                            isLight && hoveredCard !== instance.id ? "text-[#1a1625]/60" : "text-white/70"
                          )}>{instance.totalUsage || "—"}</span>
                        </div>
                        <div className="flex items-center justify-between pt-1.5">
                          <button onClick={(e) => { e.stopPropagation(); launchTavern(instance); }} disabled={launchingId === instance.id} className={cn(
                            "motion-control h-7 px-4 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50",
                            "bg-white/15 text-white hover:bg-white/25 backdrop-blur-md"
                          )}>
                            <Play className="w-2.5 h-2.5" /> {launchingId === instance.id ? "启动中" : "启动"}
                          </button>
                          <button onClick={(e) => {
                            e.stopPropagation();
                            const id = instance.id;
                            if (activeCardMenu === id) {
                              setActiveCardMenu(null);
                            } else {
                              const r = e.currentTarget.getBoundingClientRect();
                              setMenuPos({ top: r.top + r.height / 2, left: r.left });
                              setActiveCardMenu(id);
                            }
                          }} className={cn(
                            "motion-control w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center",
                            "bg-white/15 hover:bg-white/25"
                          )}>
                            <MoreVertical className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      </div>
                      </div>
                    </div>

                  </div>
                    {/* 三点菜单 */}
                  {(activeCardMenu === instance.id || (isCardMenuClosing && activeCardMenu === instance.id)) && createPortal(
                    <>
                      <div className={cn(
                        "fixed inset-0 z-40 bg-black/15 backdrop-blur-[2px] overlay-backdrop",
                        isCardMenuClosing && "overlay-backdrop-exit"
                      )} onClick={(e) => { e.stopPropagation(); closeCardMenu(); }} />
                      <div className={cn(
                        "ios-floating-menu instance-card-menu motion-menu-list fixed z-50 w-44 py-1 px-1 rounded-2xl overflow-hidden backdrop-blur-[40px] saturate-180",
                        isLight && "is-light",
                        isCardMenuClosing ? "animate-popover-exit" : "animate-popover"
                      )} style={{
                        top: Math.max(Math.min(menuPos.top, window.innerHeight - 240), 16),
                        left: Math.max(Math.min(menuPos.left + 8, window.innerWidth - 192), 16),
                        transform: 'translateY(-50%)',
                      }}>
                        {instance.status === "running" && instance.type === "local" && (
                          <>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation(); closeCardMenu();
                                try { await TarvenEnv.returnToTavern(); } catch (err) { console.error('[returnToTavern]', err); }
                              }}
                              className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-[#1a1625]/50 hover:text-[#1a1625]/80" : "text-white/50 hover:text-white/80")}
                            >返回酒馆</button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation(); closeCardMenu();
                                try { await TarvenEnv.closeTavern(); } catch (err) { console.error('[closeTavern]', err); }
                              }}
                              className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-red-900/40 hover:text-red-900/70" : "text-red-400/40 hover:text-red-400/70")}
                            >停止实例</button>
                            <div className="h-1.5" />
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); openManagePanel(instance); }}
                          className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-[#1a1625]/50 hover:text-[#1a1625]/80" : "text-white/50 hover:text-white/80")}
                        >管理</button>
                        <button onClick={(e) => { e.stopPropagation(); closeCardMenu(); setIsRenameClosing(false); setRenamingId(instance.id); setRenameValue(instance.name); }} className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-[#1a1625]/50 hover:text-[#1a1625]/80" : "text-white/50 hover:text-white/80")}>重命名</button>
                        <button onClick={(e) => {
                          e.stopPropagation();
                          closeCardMenu();
                          void pickInstanceCover(instance);
                        }} className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-[#1a1625]/50 hover:text-[#1a1625]/80" : "text-white/50 hover:text-white/80")}>更换插图</button>
                        <div className="h-1.5" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeCardMenu();
                            setDeleteInstanceError(null);
                            setPendingDelete(instance);
                          }}
                          className={cn("motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors", isLight ? "text-red-900/50 hover:text-red-900/80" : "text-red-400/55 hover:text-red-300/90")}
                        >删除实例</button>
                      </div>
                    </>,
                    document.body
                  )}
                </div>
              ))}

              <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />
            </div>

            {/* 指示器 + 方向键 */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => scrollToSlide(Math.max(0, activeSlide - 1))} disabled={activeSlide === 0} className={cn(
                "motion-control w-7 h-7 rounded-full flex items-center justify-center",
                activeSlide === 0
                  ? isLight ? "text-[#1a1625]/15 cursor-default" : "text-white/15 cursor-default"
                  : isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/70 hover:bg-[#1a1625]/8" : "text-white/40 hover:text-white/70 hover:bg-white/10"
              )}><ChevronLeft className="w-3.5 h-3.5" /></button>

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

              <button onClick={() => scrollToSlide(Math.min(instances.length, activeSlide + 1))} disabled={activeSlide === instances.length} className={cn(
                "motion-control w-7 h-7 rounded-full flex items-center justify-center",
                activeSlide === instances.length
                  ? isLight ? "text-[#1a1625]/15 cursor-default" : "text-white/15 cursor-default"
                  : isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/70 hover:bg-[#1a1625]/8" : "text-white/40 hover:text-white/70 hover:bg-white/10"
              )}><ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        </div>

      </main>

      {/* 重命名弹窗 */}
      {(renamingId || isRenameClosing) && (
        <>
          <div className={cn("fixed inset-0 z-[70] bg-black/15 backdrop-blur-[2px] overlay-backdrop", isRenameClosing && "overlay-backdrop-exit")} onClick={closeRenameDialog} />
          <div className={cn("ios-task-surface fixed z-[72] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180", glassBg, isLight && "is-light", isRenameClosing ? "animate-clone-panel-exit" : "animate-clone-panel")} style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(360px, calc(100vw - 2rem))',
          }}>
            <div className="p-5">
              <div className={cn("text-sm font-semibold mb-3", isLight ? "text-[#1a1625]" : "text-white")}>重命名实例</div>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                autoFocus
                className={cn(
                  "w-full h-10 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                  isLight
                    ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                    : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                )}
              />
              <div className="flex gap-2 mt-4">
                <button onClick={closeRenameDialog} className={cn("flex-1 h-9 rounded-xl text-xs font-medium border transition-colors", isLight ? "border-black/[0.08] text-[#1a1625]/50 hover:bg-black/5" : "border-white/[0.08] text-white/50 hover:bg-white/5")}>取消</button>
                <button onClick={() => {
                  const name = renameValue.trim();
                  if (name) setInstances(prev => prev.map(t => t.id === renamingId ? { ...t, name, subtitle: name } : t));
                  closeRenameDialog();
                }} className={cn("flex-1 h-9 rounded-xl text-xs font-medium transition-colors", isLight ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90" : "bg-white/90 text-[#1a1625] hover:bg-white")}>确定</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 删除实例二次确认 */}
      {pendingDelete && (
        <>
          <div
            className="fixed inset-0 z-[73] bg-black/15 backdrop-blur-[2px] overlay-backdrop"
            onClick={() => { if (!isDeletingInstance) { setPendingDelete(null); setDeleteInstanceError(null); } }}
          />
          <div className={cn(
            "ios-task-surface fixed z-[74] overflow-hidden rounded-2xl backdrop-blur-[40px] saturate-180 animate-clone-panel",
            glassBg,
            isLight && "is-light"
          )} style={{
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: "min(380px, calc(100vw - 2rem))",
          }}>
            <div className={cn("flex h-12 items-center justify-between border-b px-5", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>删除实例</span>
              <button
                type="button"
                disabled={isDeletingInstance}
                onClick={() => { setPendingDelete(null); setDeleteInstanceError(null); }}
                className={cn(
                  "rounded-lg p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-30",
                  isLight ? "text-[#1a1625]/30 hover:bg-black/5" : "text-white/30 hover:bg-white/5"
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-5">
              <p className={cn("text-[15px] font-medium", isLight ? "text-[#1a1625]/85" : "text-white/85")}>
                确定删除“{pendingDelete.subtitle || pendingDelete.name}”？
              </p>
              <p className={cn("mt-2 text-[12px] leading-relaxed", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
                {pendingDelete.type === "local"
                  ? "实例目录、配置与封面会从设备中永久删除，且无法恢复。"
                  : "只会移除这条远程连接，不会影响远程服务器上的数据。"}
              </p>
              {pendingDelete.type === "local" && (
                <p className={cn("mt-3 text-[10px] font-medium", isLight ? "text-[#a12c4c]/70" : "text-[#e88ca5]/65")}>
                  此操作无法撤销
                </p>
              )}
              {deleteInstanceError && (
                <div className={cn(
                  "mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
                  isLight ? "border-[#a12c4c]/10 bg-[#a12c4c]/[0.04] text-[#783047]/65" : "border-[#e88ca5]/10 bg-white/[0.025] text-[#e8a2b5]/75"
                )}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{deleteInstanceError}</span>
                </div>
              )}
            </div>
            <div className={cn("flex items-center justify-end gap-2 border-t px-5 py-3", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <button
                type="button"
                disabled={isDeletingInstance}
                onClick={() => { setPendingDelete(null); setDeleteInstanceError(null); }}
                className={cn(
                  "motion-control h-8 rounded-xl px-4 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-40",
                  isLight ? "bg-black/[0.05] text-[#1a1625]/45 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/45 hover:bg-white/10"
                )}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isDeletingInstance}
                onClick={confirmDeleteInstance}
                className={cn(
                  "motion-control flex h-8 items-center justify-center gap-1.5 rounded-xl px-4 text-[11px] font-semibold disabled:pointer-events-none disabled:opacity-60",
                  isLight ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90" : "bg-white/90 text-[#1a1625] hover:bg-white"
                )}
              >
                {isDeletingInstance && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {isDeletingInstance ? "正在删除" : "删除"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 启动进度面板 */}
      {showLaunchPanel && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/25 backdrop-blur-[4px]" />
          <div className={cn(
            "ios-task-surface fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-[min(360px,calc(100vw-2rem))] rounded-3xl overflow-hidden backdrop-blur-[40px] saturate-180",
            "shadow-[0_24px_80px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.06),inset_0_0.5px_0_rgba(255,255,255,0.08)]",
            glassBg,
            isLight && "is-light"
          )}>
            {/* 标题 */}
            <div className="px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <h3 className={cn("text-[17px] font-bold tracking-tight", isLight ? "text-[#1a1625]" : "text-white")}>
                  {launchError
                    ? operationPurpose === "create" ? "创建失败" : "启动失败"
                    : operationPurpose === "create" ? "正在创建实例" : "启动中"}
                </h3>
                {launchProgress && !launchError && (
                  <span className={cn("text-[14px] font-mono tabular-nums font-semibold", isLight ? "text-[#8b3a52]" : "text-[#c4788e]")}>{launchProgress.pct}%</span>
                )}
              </div>
              <p className={cn("text-[12px] mt-1", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
                {lastLaunchParams?.name || "实例"}
              </p>
            </div>

            {/* 进度条 */}
            <div className="px-6 pb-4">
              <div className={cn(
                "h-[3px] rounded-full overflow-hidden relative",
                isLight ? "bg-black/[0.06]" : "bg-white/[0.08]"
              )}>
                <div
                  className={cn(
                    "h-full rounded-full transition-[width,background-color] duration-500 ease-out relative overflow-hidden",
                    launchError
                      ? "bg-red-500/80"
                      : isLight
                        ? "bg-[#8b3a52]"
                        : "bg-gradient-to-r from-[#7a3245] via-[#a04860] to-[#8b3a52]"
                  )}
                  style={{ width: `${launchError ? 100 : (launchProgress?.pct || 0)}%` }}
                >
                  {!launchError && launchProgress && launchProgress.pct > 0 && launchProgress.pct < 100 && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
                  )}
                </div>
              </div>
              <p className={cn("text-[12px] mt-2 font-medium truncate", isLight ? "text-[#1a1625]/50" : "text-white/50")}>
                {launchError ? launchError : (launchProgress?.text || "初始化")}
              </p>
            </div>

            {/* 日志区域 — 色差内凹效果 */}
            <div className="mx-6 mb-5">
              <div className={cn(
                "rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto",
                "border shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(0,0,0,0.2)]",
                isLight
                  ? "bg-black/[0.04] border-black/[0.1]"
                  : "bg-black/[0.32] border-white/[0.03]"
              )}>
                <div className="px-4 py-3 font-mono text-[11px] leading-[1.7] space-y-1">
                  {launchLogs.map((log, i) => (
                    <div key={i} className={cn(
                      "truncate",
                      log.level === "error" ? "text-red-400/90" :
                      log.level === "success" ? "text-emerald-400/90" :
                      isLight ? "text-[#1a1625]/50" : "text-white/50"
                    )}>
                      {log.msg}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 底部按钮 */}
            <div className="px-6 pb-6 flex gap-2.5">
              {launchError ? (
                <>
                  <button
                    onClick={() => retryLaunch()}
                    disabled={!!launchingId}
                    className={cn(
                      "motion-control flex-1 h-10 rounded-xl text-[13px] font-semibold disabled:opacity-50",
                      isLight ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90" : "bg-white/90 text-[#1a1625] hover:bg-white"
                    )}
                  >
                    重试
                  </button>
                  <button
                    onClick={dismissLaunchPanel}
                    className={cn(
                      "motion-control flex-1 h-10 rounded-xl text-[13px] font-semibold",
                      isLight ? "bg-black/[0.05] text-[#1a1625]/60 hover:bg-black/[0.08]" : "bg-white/[0.08] text-white/60 hover:bg-white/[0.12]"
                    )}
                  >
                    关闭
                  </button>
                </>
              ) : (
                operationPurpose === "create" ? (
                  <div className={cn(
                    "w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[12px] font-medium",
                    isLight ? "bg-black/[0.04] text-[#1a1625]/45" : "bg-white/[0.06] text-white/45"
                  )}>
                    {launchProgress?.pct === 100
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      : <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {launchProgress?.pct === 100 ? "已确认实例可运行" : "完成前请保持应用打开"}
                  </div>
                ) : (
                  <button
                    onClick={() => { setShowLaunchPanel(false); setLaunchProgress(null); }}
                    className={cn(
                      "motion-control w-full h-10 rounded-xl text-[13px] font-semibold",
                      isLight ? "bg-black/[0.05] text-[#1a1625]/40 hover:bg-black/[0.08]" : "bg-white/[0.08] text-white/40 hover:bg-white/[0.12]"
                    )}
                  >
                    隐藏
                  </button>
                )
              )}
            </div>
          </div>
        </>
      )}

      {/* 清理垃圾面板 */}
      {showCleanPanel && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/15 backdrop-blur-[2px]" onClick={() => { if (!cleaningGarbage) setShowCleanPanel(false); }} />
          <div className={cn("ios-task-surface fixed z-[72] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180", glassBg, isLight && "is-light")} style={{
            top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            width: 'min(420px, calc(100vw - 2rem))',
            maxHeight: 'min(80vh, calc(100vh - 4rem))',
          }}>
            <div className={cn("flex items-center justify-between px-5 h-12 flex-shrink-0 border-b", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>清理垃圾</span>
              <button onClick={() => { if (!cleaningGarbage) setShowCleanPanel(false); }} className={cn("p-1.5 rounded-lg transition-colors", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 scrollbar-subtle">
              {cleaningGarbage && garbageItems.length === 0 ? (
                <div className={cn("text-center py-8 text-sm", isLight ? "text-[#1a1625]/40" : "text-white/40")}>扫描中...</div>
              ) : garbageItems.length === 0 ? (
                <div className={cn("text-center py-8 text-sm", isLight ? "text-[#1a1625]/40" : "text-white/40")}>未发现垃圾文件</div>
              ) : (
                <div className="space-y-2">
                  {garbageItems.map((item, i) => (
                    <div key={i} className={cn("flex items-center justify-between gap-3 p-3 rounded-xl border", isLight ? "bg-black/[0.03] border-black/[0.06]" : "bg-white/[0.03] border-white/[0.06]")}>
                      <div className="flex-1 min-w-0">
                        <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/80" : "text-white/80")}>{item.description}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md", isLight ? "bg-black/[0.05] text-[#1a1625]/40" : "bg-white/[0.06] text-white/40")}>{item.type}</span>
                          <span className={cn("text-[10px] tabular-nums", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
                            {item.sizeBytes >= 1024 * 1024 ? `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB` : item.sizeBytes >= 1024 ? `${(item.sizeBytes / 1024).toFixed(0)} KB` : `${item.sizeBytes} B`}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={cn("flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <button onClick={() => setShowCleanPanel(false)} disabled={cleaningGarbage} className={cn(
                "motion-control px-4 h-8 rounded-xl text-[11px] font-medium disabled:opacity-50",
                isLight ? "bg-black/[0.05] text-[#1a1625]/45 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/45 hover:bg-white/10"
              )}>取消</button>
              <button
                onClick={async () => {
                  setCleaningGarbage(true);
                  try {
                    for (const item of garbageItems) {
                      try { await TarvenEnv.deleteGarbageItem({ path: item.path }); } catch {}
                    }
                    setGarbageItems([]);
                    setShowCleanPanel(false);
                  } catch (e) { console.error(e); }
                  setCleaningGarbage(false);
                }}
                disabled={cleaningGarbage || garbageItems.length === 0}
                className={cn(
                  "motion-control px-4 h-8 rounded-xl text-[11px] font-semibold disabled:opacity-50",
                  isLight ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90" : "bg-white/90 text-[#1a1625] hover:bg-white"
                )}>全部清理</button>
            </div>
          </div>
        </>
      )}

      {/* 新建实例面板 */}
      {(showNewInstancePanel || isNewInstancePanelClosing) && (
        <>
          <div className={cn(
            "fixed inset-0 z-[60] bg-black/15 backdrop-blur-[2px] overlay-backdrop",
            isNewInstancePanelClosing && "overlay-backdrop-exit"
          )} onClick={() => {
            if (!isCreatingInstance) {
              closeVersionDropdown();
              setIsNewInstancePanelClosing(true);
              setTimeout(() => {
                setShowNewInstancePanel(false);
                setIsNewInstancePanelClosing(false);
              }, PANEL_EXIT_MS);
            }
          }} />
          <div className={cn(
            "ios-task-surface fixed z-[62] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
            glassBg,
            isLight && "is-light",
            isNewInstancePanelClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
          )} style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(460px, calc(100vw - 2rem))',
            maxHeight: 'min(85vh, calc(100vh - 4rem))',
          }}>
            {/* 头部 */}
            <div className={cn("flex items-center justify-between px-5 h-12 flex-shrink-0 border-b", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>新建实例</span>
              <button disabled={isCreatingInstance} onClick={() => { closeVersionDropdown(); setIsNewInstancePanelClosing(true); setTimeout(() => { setShowNewInstancePanel(false); setIsNewInstancePanelClosing(false); }, PANEL_EXIT_MS); }} className={cn("motion-control p-1.5 rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5 scrollbar-subtle">
              {/* 实例名称 */}
              <NewInstanceField label="名称" isLight={isLight}>
                <input
                  type="text"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  placeholder="我的酒馆"
                  className={cn(
                    "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                    isLight
                      ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                      : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                  )}
                />
              </NewInstanceField>

              {/* 实例模式 */}
              <div>
                <div className={cn("text-xs font-medium mb-2", isLight ? "text-[#1a1625]/70" : "text-white/70")}>实例模式</div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setNewInstanceMode("local")}
                    aria-pressed={newInstanceMode === "local"}
                    className={cn(
                      "ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border",
                      newInstanceMode === "local"
                        ? isLight ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]" : "bg-white/10 border-white/15 text-white"
                        : isLight ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:border-black/12 hover:text-[#1a1625]/55" : "bg-transparent border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/55"
                    )}
                  >本地实例</button>
                  <button
                    onClick={() => setNewInstanceMode("remote")}
                    aria-pressed={newInstanceMode === "remote"}
                    className={cn(
                      "ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border",
                      newInstanceMode === "remote"
                        ? isLight ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]" : "bg-white/10 border-white/15 text-white"
                        : isLight ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:border-black/12 hover:text-[#1a1625]/55" : "bg-transparent border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/55"
                    )}
                  >远程连接</button>
                </div>
              </div>

              {/* 本地模式配置 */}
              {newInstanceMode === "local" && (
                <div key="local" className="motion-section-enter space-y-5">
                  <NewInstanceField label="安装目录" isLight={isLight}>
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={newInstanceDir}
                        onChange={(e) => setNewInstanceDir(e.target.value)}
                        placeholder="选择或输入路径"
                        className={cn(
                          "flex-1 h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                          isLight
                            ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                            : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                        )}
                      />
                      <button onClick={async () => {
                        try {
                          const { name, path } = await TarvenEnv.pickDirectory();
                          setNewInstanceDir(isWindows ? path : name);
                        } catch { /* 取消 */ }
                      }} className={cn(
                        "motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0",
                        isLight ? "border-black/[0.08] text-[#1a1625]/50 hover:bg-black/[0.04]" : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                      )}>浏览</button>
                    </div>
                  </NewInstanceField>

                  <NewInstanceField label="版本" isLight={isLight}>
                    <div className="flex items-center gap-2 w-full">
                      <button
                        id="ver-trigger"
                        onClick={async () => {
                          if (verDropdownOpen) {
                            closeVersionDropdown();
                          } else {
                            // 首次打开时拉取 GitHub releases
                            if (releases.length === 0 && !fetchingReleases) {
                              setFetchingReleases(true);
                              try {
                                const { releases: r } = await TarvenEnv.fetchReleases();
                                setReleases(r);
                              } catch { /* 网络失败,保留默认选项 */ }
                              setFetchingReleases(false);
                            }
                            const trigger = document.getElementById('ver-trigger');
                            if (trigger) {
                              const r = trigger.getBoundingClientRect();
                              setVerDropdownPos({
                                bottom: window.innerHeight - r.top + 4,
                                left: Math.max(8, Math.min(r.left, window.innerWidth - r.width - 8)),
                                width: r.width,
                                maxHeight: Math.max(0, Math.min(360, r.top - 12)),
                              });
                            }
                            setIsVerDropdownClosing(false);
                            setVerDropdownOpen(true);
                          }
                        }}
                        className={cn(
                          "ios-field-control motion-control flex-1 min-w-0 h-9 px-3 rounded-xl border text-sm text-left flex items-center justify-between transition-colors",
                          isLight
                            ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                            : "bg-white/[0.04] border-white/[0.08] text-white"
                        )}
                      >
                        <span className="truncate">{fetchingReleases ? "获取版本中" : (newInstanceLocalZip ? "本地 ZIP" : newInstanceVersion === "stable" ? "稳定版" : newInstanceVersion)}</span>
                        <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 opacity-40 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]", verDropdownOpen && !isVerDropdownClosing && "rotate-180")} />
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const { path, sizeBytes } = await TarvenEnv.pickZipFile();
                            setNewInstanceLocalZip(path);
                            setNewInstanceVersion("local");
                            setTerminalLogs(prev => [...prev, { msg: `> 已选择本地文件 (${(sizeBytes / 1048576).toFixed(1)}MB)`, level: "info" }]);
                          } catch { /* 取消 */ }
                        }}
                        className={cn(
                          "motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0",
                          isLight ? "border-black/[0.08] text-[#1a1625]/50 hover:bg-black/[0.04]" : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                        )}
                      >{newInstanceLocalZip ? "更换" : "导入 ZIP"}</button>
                    </div>
                  </NewInstanceField>
                </div>
              )}

              {/* 远程模式配置 */}
              {newInstanceMode === "remote" && (
                <div key="remote" className="motion-section-enter space-y-5">
                  <NewInstanceField label="连接地址" isLight={isLight}>
                    <input
                      type="url"
                      value={newInstanceUrl}
                      onChange={(e) => setNewInstanceUrl(e.target.value)}
                      placeholder="https://example.com"
                      autoCapitalize="none"
                      autoCorrect="off"
                      className={cn(
                        "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                        isLight
                          ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                          : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                      )}
                    />
                  </NewInstanceField>

                  <div className={cn(
                    "border-t pt-3",
                    isLight ? "border-black/[0.04]" : "border-white/[0.04]"
                  )}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/70" : "text-white/70")}>Basic Auth</div>
                        <div className={cn("mt-0.5 text-[10px]", isLight ? "text-[#1a1625]/35" : "text-white/35")}>用于受 HTTP 基本认证保护的远程地址</div>
                      </div>
                      <ToggleSwitch on={newRemoteAuthEnabled} onChange={setNewRemoteAuthEnabled} isLight={isLight} />
                    </div>

                    <div className={cn("motion-accordion", newRemoteAuthEnabled && "is-open")} aria-hidden={!newRemoteAuthEnabled}>
                      <div className="motion-accordion-inner">
                      <div className="pt-3">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={newRemoteAuthUsername}
                          onChange={(e) => setNewRemoteAuthUsername(e.target.value)}
                          placeholder="用户名"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="username"
                          disabled={!newRemoteAuthEnabled}
                          className={cn(
                            "h-9 min-w-0 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                              : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                          )}
                        />
                        <input
                          type="password"
                          value={newRemoteAuthPassword}
                          onChange={(e) => setNewRemoteAuthPassword(e.target.value)}
                          placeholder="密码"
                          autoComplete="current-password"
                          disabled={!newRemoteAuthEnabled}
                          className={cn(
                            "h-9 min-w-0 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                              : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                          )}
                        />
                      </div>
                      <p className={cn("mt-2 text-[10px] leading-relaxed", isLight ? "text-[#1a1625]/35" : "text-white/35")}>
                        密码由系统安全存储保管，不会写入连接地址。公网连接建议使用 HTTPS。
                      </p>
                      </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            <div className={cn("px-5 py-3 border-t flex-shrink-0", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              {newInstanceError && (
                <div className={cn(
                  "mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
                  isLight ? "border-red-900/10 bg-red-900/[0.04] text-red-900/65" : "border-red-400/10 bg-red-400/[0.05] text-red-300/75"
                )}>
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>{newInstanceError}</span>
                </div>
              )}
              <div className="flex items-center justify-end gap-2">
              <button disabled={isCreatingInstance} onClick={() => { closeVersionDropdown(); setIsNewInstancePanelClosing(true); setTimeout(() => { setShowNewInstancePanel(false); setIsNewInstancePanelClosing(false); }, PANEL_EXIT_MS); }} className={cn(
                "motion-control px-4 h-8 rounded-xl text-[11px] font-medium",
                "disabled:pointer-events-none disabled:opacity-40",
                isLight ? "bg-black/[0.05] text-[#1a1625]/45 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/45 hover:bg-white/10"
              )}>取消</button>
              <button
                onClick={createInstance}
                disabled={isCreatingInstance}
                className={cn(
                  "motion-control px-4 h-8 rounded-xl text-[11px] font-semibold disabled:pointer-events-none disabled:opacity-60 flex items-center gap-1.5",
                  isLight ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90" : "bg-white/90 text-[#1a1625] hover:bg-white"
                )}
              >
                {isCreatingInstance && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}
                {isCreatingInstance ? (newInstanceMode === "remote" ? "验证连接" : "获取当前版本") : "创建"}
              </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 版本下拉菜单 — 渲染在面板外部避免 transform 裁剪 */}
      {(verDropdownOpen || isVerDropdownClosing) && (
        <>
          <div className={cn("fixed inset-0 z-[70] overlay-backdrop", isVerDropdownClosing && "overlay-backdrop-exit")} onClick={closeVersionDropdown} />
          <div className={cn(
            "motion-menu-list fixed z-[72] rounded-md overflow-hidden backdrop-blur-[40px] saturate-180",
            isVerDropdownClosing ? "animate-dropdown-up-exit" : "animate-dropdown-up",
            glassBg
          )} style={{
            bottom: verDropdownPos.bottom,
            left: verDropdownPos.left,
            width: verDropdownPos.width,
            maxHeight: verDropdownPos.maxHeight,
            overflowY: "auto",
            overscrollBehavior: "contain",
            transformOrigin: "bottom center",
          }} ref={versionDropdownRef}>
            {[
              ...releases.slice(0, 20).reverse().map(r => ({
                value: r.tag,
                label: r.tag,
                sublabel: r.prerelease ? "预发布版本" : "正式版本",
                zipballUrl: r.zipballUrl,
                recommended: r.tag === releases.find(x => !x.prerelease)?.tag
              })),
              { value: "stable", label: "稳定版", sublabel: "自动获取最新正式版", zipballUrl: undefined },
            ].map((opt, optionIndex, options) => (
              <button
                key={opt.value}
                onClick={() => {
                  setNewInstanceLocalZip(null);
                  setNewInstanceVersion(opt.value);
                  closeVersionDropdown();
                }}
                className={cn(
                  "motion-menu-item w-full px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-2",
                  newInstanceVersion === opt.value
                    ? isLight ? "bg-[#1a1625]/8" : "bg-white/10"
                    : isLight ? "hover:bg-black/[0.04]" : "hover:bg-white/[0.06]"
                )}
                style={{ animationDelay: `${Math.min(options.length - 1 - optionIndex, 5) * 14}ms` }}
              >
                <div className="flex flex-col items-start min-w-0">
                  <span className={cn("text-[13px] font-medium", newInstanceVersion === opt.value
                    ? isLight ? "text-[#1a1625]" : "text-white"
                    : isLight ? "text-[#1a1625]/80" : "text-white/80"
                  )}>
                    {opt.label}
                    {(opt as any).recommended && <span className={cn("ml-1 text-[10px] px-1.5 py-0.5 rounded-full", isLight ? "bg-[#1a1625]/10 text-[#1a1625]/60" : "bg-white/10 text-white/60")}>推荐</span>}
                  </span>
                  <span className={cn("text-[11px] mt-0.5", isLight ? "text-[#1a1625]/40" : "text-white/40")}>{opt.sublabel}</span>
                </div>
                {newInstanceVersion === opt.value && <Check className={cn("w-4 h-4 flex-shrink-0", isLight ? "text-[#1a1625]/60" : "text-white/60")} />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* 管理面板 */}
      {(() => {
        const mp = showManagePanel;
        if (!mp) return null;
        return (
        <>
          <div className={cn(
            "fixed inset-0 z-[60] bg-black/25 backdrop-blur-[2px] overlay-backdrop",
            isManagePanelClosing && "overlay-backdrop-exit"
          )} onClick={closeManagePanel} />
          <div className={cn(
            "ios-task-surface manage-panel-surface fixed z-[62] rounded-2xl flex flex-col overflow-hidden backdrop-blur-[28px] saturate-180",
            glassBg,
            isLight && "is-light",
            isManagePanelClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
          )} style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 'min(900px, calc(100vw - 2rem))',
            height: 'min(680px, calc(100vh - 2rem))',
            maxHeight: 'calc(100vh - 2rem)',
          }}>
            {/* 头部 */}
            <div className={cn("flex items-center justify-between px-5 h-12 flex-shrink-0 border-b", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>{mp!.subtitle || mp!.name}</span>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded-md", isLight ? "bg-black/[0.05] text-[#1a1625]/35" : "bg-white/[0.06] text-white/35")}>{mp!.version || "—"}</span>
              </div>
              <button onClick={closeManagePanel} className={cn("motion-control p-1.5 rounded-lg", isLight ? "hover:bg-black/5 text-[#1a1625]/30" : "hover:bg-white/5 text-white/30")}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 搜索与筛选 */}
            <div className={cn("flex-shrink-0 border-b px-5 pt-4 pb-3", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <div className={cn("flex items-center gap-3 h-10 rounded-xl px-3", isLight ? "bg-black/[0.03]" : "bg-white/[0.035]")}>
                <Search className={cn("h-4 w-4 flex-shrink-0", isLight ? "text-[#1a1625]/35" : "text-white/35")} />
                <input
                  type="search"
                  value={manageSearchQuery}
                  onChange={(e) => setManageSearchQuery(e.target.value)}
                  placeholder="搜索并打开实例"
                  className={cn("min-w-0 flex-1 bg-transparent text-xs outline-none", isLight ? "text-[#1a1625] placeholder:text-[#1a1625]/30" : "text-white placeholder:text-white/30")}
                />
                {manageSearchQuery && <button type="button" onClick={() => setManageSearchQuery("")} className={cn("p-1", isLight ? "text-[#1a1625]/30" : "text-white/30")}><X className="h-3.5 w-3.5" /></button>}
              </div>
              <div className="mt-3 flex items-center gap-2">
                {([
                  { id: "all", label: "全部" },
                  { id: "local", label: "本地" },
                  { id: "remote", label: "云端" },
                ] as const).map(filter => (
                  <button key={filter.id} type="button" onClick={() => setManageFilter(filter.id)} aria-pressed={manageFilter === filter.id} className={cn(
                    "ios-choice-control motion-control rounded-full px-3 py-1 text-[11px] font-medium",
                    manageFilter === filter.id
                      ? isLight ? "bg-[#1a1625]/10 text-[#1a1625]" : "bg-white/10 text-white"
                      : isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/65" : "text-white/40 hover:text-white/70"
                  )}>{filter.label}</button>
                ))}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
              <aside className={cn(
                "flex max-h-36 flex-shrink-0 flex-col border-b sm:max-h-none sm:w-52 sm:border-b-0 sm:border-r",
                isLight ? "border-black/[0.06]" : "border-white/[0.06]"
              )}>
                <div className={cn("px-4 pb-2 pt-3 text-[10px] font-semibold uppercase tracking-[0.08em]", isLight ? "text-[#1a1625]/30" : "text-white/30")}>
                  实例
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 scrollbar-subtle">
                  {filteredManageInstances.map(instance => {
                    const selected = instance.id === mp.id;
                    return (
                      <button
                        key={instance.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => {
                          setShowManagePanel(instance);
                          setTerminalInstanceId(instance.id);
                          setTerminalLogs([{
                            msg: `${instance.subtitle || instance.name} · 实例终端${instance.type === "remote" ? "（远程实例不支持本地命令）" : ""}`,
                            level: "info",
                          }]);
                          setTerminalInput("");
                          setManageMoreOpen(false);
                        }}
                        className={cn(
                          "motion-control mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left",
                          selected
                            ? isLight ? "bg-black/[0.07]" : "bg-white/[0.08]"
                            : isLight ? "hover:bg-black/[0.035]" : "hover:bg-white/[0.04]"
                        )}
                      >
                        <span className={cn("flex h-7 w-7 flex-shrink-0 items-center justify-center", selected ? isLight ? "text-[#1a1625]/75" : "text-white/80" : isLight ? "text-[#1a1625]/35" : "text-white/35")}>
                          {instance.icon}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block truncate text-xs font-medium", selected ? isLight ? "text-[#1a1625]/85" : "text-white/85" : isLight ? "text-[#1a1625]/55" : "text-white/55")}>
                            {instance.subtitle || instance.name}
                          </span>
                          <span className={cn("mt-0.5 block truncate text-[10px]", isLight ? "text-[#1a1625]/28" : "text-white/28")}>
                            {instance.type === "local" ? "本地实例" : instance.url || "远程实例"}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  {filteredManageInstances.length === 0 && (
                    <div className={cn("px-3 py-6 text-center text-[11px]", isLight ? "text-[#1a1625]/30" : "text-white/30")}>
                      没有匹配的实例
                    </div>
                  )}
                </div>
              </aside>

              <section className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className={cn("flex flex-shrink-0 items-center gap-1 overflow-x-auto border-b px-4 py-2 scrollbar-subtle", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
                  {([
                    { id: "launch", label: "启动参数", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
                    { id: "snapshots", label: "快照", icon: <History className="h-3.5 w-3.5" /> },
                    { id: "storage", label: "存储", icon: <HardDrive className="h-3.5 w-3.5" /> },
                    { id: "terminal", label: "终端", icon: <Terminal className="h-3.5 w-3.5" /> },
                    { id: "about", label: "关于", icon: <Info className="h-3.5 w-3.5" /> },
                  ] as const).map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      aria-pressed={manageTab === tab.id}
                      onClick={() => {
                        setManageTab(tab.id);
                        setManageMoreOpen(false);
                        if (tab.id === "terminal") setTerminalInstanceId(mp.id);
                      }}
                      className={cn(
                        "ios-choice-control motion-control flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium",
                        manageTab === tab.id
                          ? isLight ? "bg-black/[0.07] text-[#1a1625]/80" : "bg-white/[0.08] text-white/80"
                          : isLight ? "text-[#1a1625]/35 hover:text-[#1a1625]/60" : "text-white/35 hover:text-white/60"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab 内容 */}
                <div className="min-h-0 flex-1 overflow-y-auto p-5 scrollbar-subtle">
                  <div key={`${mp.id}-${manageTab}`} className="motion-tab-content space-y-4">
              {manageTab === "launch" && (
                <>
                  {mp!.type === "local" ? (
                  <>
                  <ManageItem label="启动端口" desc="宿主 WebView 和本地服务都会使用这个端口" isLight={isLight}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={draftPort} onChange={(e) => {
                      setDraftPort(parseInt(e.target.value) || 8000);
                    }} className={cn("w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                      isLight ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] focus:border-[#1a1625]/20" : "bg-white/[0.04] border-white/[0.08] text-white focus:border-white/20"
                    )} />
                  </ManageItem>
                  <ManageItem label="允许外部监听" desc="Android 宿主默认建议关闭，只在明确需要局域网访问时开启" isLight={isLight}>
                    <ToggleSwitch on={draftConfig.listen} onChange={(v) => setDraftConfig(prev => ({ ...prev, listen: v }))} isLight={isLight} />
                  </ManageItem>
                  <ManageItem label="启用 IPv4" desc="至少要保留一个网络协议可用" isLight={isLight}>
                    <ToggleSwitch on={draftConfig.ipv4} onChange={(v) => setDraftConfig(prev => ({ ...prev, ipv4: v }))} isLight={isLight} />
                  </ManageItem>
                  <ManageItem label="启用 IPv6" desc="如果网络环境稳定支持 IPv6，可以开启" isLight={isLight}>
                    <ToggleSwitch on={draftConfig.ipv6} onChange={(v) => setDraftConfig(prev => ({ ...prev, ipv6: v }))} isLight={isLight} />
                  </ManageItem>
                  <ManageItem label="优先使用 IPv6 DNS" desc="在 IPv6 网络质量足够好时再开启" isLight={isLight}>
                    <ToggleSwitch on={draftConfig.dnsIpv6} onChange={(v) => setDraftConfig(prev => ({ ...prev, dnsIpv6: v }))} isLight={isLight} />
                  </ManageItem>
                  <ManageItem label="心跳写入间隔" desc="单位秒，填 0 关闭心跳文件" isLight={isLight}>
                    <input type="text" inputMode="numeric" pattern="[0-9]*" value={draftConfig.heartbeat} onChange={(e) => {
                      const heartbeat = parseInt(e.target.value) || 0;
                      setDraftConfig(prev => ({ ...prev, heartbeat }));
                    }} className={cn("w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                      isLight ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] focus:border-[#1a1625]/20" : "bg-white/[0.04] border-white/[0.08] text-white focus:border-white/20"
                    )} />
                  </ManageItem>
                  <ManageItem label="启用 HTTP Keep-Alive" desc="网络波动大时可临时关闭" isLight={isLight}>
                    <ToggleSwitch on={draftConfig.keepAlive} onChange={(v) => setDraftConfig(prev => ({ ...prev, keepAlive: v }))} isLight={isLight} />
                  </ManageItem>
                  </>
                  ) : (
                  <div>
                    <ManageItem label="Basic Auth" desc="为受 HTTP 基本认证保护的远程地址提供凭据" isLight={isLight}>
                      <ToggleSwitch on={draftRemoteAuthEnabled} onChange={setDraftRemoteAuthEnabled} isLight={isLight} />
                    </ManageItem>
                    <div
                      className={cn("motion-accordion", draftRemoteAuthEnabled && "is-open")}
                      aria-hidden={!draftRemoteAuthEnabled}
                    >
                      <div className="motion-accordion-inner">
                      <div className="pt-3 space-y-2">
                        <input
                          type="text"
                          disabled={!draftRemoteAuthEnabled}
                          value={draftRemoteAuthUsername}
                          onChange={(e) => setDraftRemoteAuthUsername(e.target.value)}
                          placeholder="用户名"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="username"
                          className={cn(
                            "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                              : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                          )}
                        />
                        <input
                          type="password"
                          disabled={!draftRemoteAuthEnabled}
                          value={draftRemoteAuthPassword}
                          onChange={(e) => setDraftRemoteAuthPassword(e.target.value)}
                          placeholder={mp!.basicAuth ? "留空则保留现有密码" : "密码"}
                          autoComplete="current-password"
                          className={cn(
                            "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-[#1a1625]/20"
                              : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                          )}
                        />
                        <p className={cn("text-[10px] leading-relaxed", isLight ? "text-[#1a1625]/35" : "text-white/35")}>
                          密码由系统安全存储保管。保存时会立即验证当前连接。
                        </p>
                      </div>
                      </div>
                    </div>
                  </div>
                  )}
                </>
              )}
              {manageTab === "snapshots" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]/80" : "text-white/80")}>配置快照</div>
                      <div className={cn("mt-1 text-[10px]", isLight ? "text-[#1a1625]/35" : "text-white/35")}>保存并恢复当前实例的启动参数。</div>
                    </div>
                    <button
                      type="button"
                      disabled={mp.type !== "local"}
                      onClick={createInstanceSnapshot}
                      className={cn(
                        "motion-control h-8 rounded-xl px-3 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-35",
                        isLight ? "bg-black/[0.06] text-[#1a1625]/65 hover:bg-black/[0.09]" : "bg-white/[0.07] text-white/65 hover:bg-white/[0.11]"
                      )}
                    >
                      创建快照
                    </button>
                  </div>
                  {mp.type !== "local" ? (
                    <div className={cn("rounded-xl px-4 py-8 text-center text-xs", isLight ? "bg-black/[0.025] text-[#1a1625]/35" : "bg-white/[0.025] text-white/35")}>
                      远程实例不保存本地启动参数快照
                    </div>
                  ) : (instanceSnapshots[mp.id] || []).length === 0 ? (
                    <div className={cn("rounded-xl px-4 py-8 text-center text-xs", isLight ? "bg-black/[0.025] text-[#1a1625]/35" : "bg-white/[0.025] text-white/35")}>
                      暂无快照
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(instanceSnapshots[mp.id] || []).map(snapshot => (
                        <div key={snapshot.id} className={cn("flex items-center justify-between gap-4 rounded-xl px-4 py-3", isLight ? "bg-black/[0.035]" : "bg-white/[0.035]")}>
                          <div className="min-w-0">
                            <div className={cn("truncate text-xs font-medium", isLight ? "text-[#1a1625]/70" : "text-white/70")}>{snapshot.label}</div>
                            <div className={cn("mt-1 text-[10px] tabular-nums", isLight ? "text-[#1a1625]/30" : "text-white/30")}>
                              {new Date(snapshot.createdAt).toLocaleString("zh-CN")} · 端口 {snapshot.port}
                            </div>
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDraftPort(snapshot.port);
                                setDraftConfig({ ...snapshot.config });
                                setManageTab("launch");
                              }}
                              className={cn("motion-control rounded-lg px-2.5 py-1.5 text-[10px] font-medium", isLight ? "text-[#1a1625]/55 hover:text-[#1a1625]/80" : "text-white/55 hover:text-white/80")}
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteInstanceSnapshot(mp.id, snapshot.id)}
                              className={cn("motion-control rounded-lg px-2.5 py-1.5 text-[10px] font-medium", isLight ? "text-red-900/45 hover:text-red-900/75" : "text-red-300/45 hover:text-red-200/75")}
                            >
                              删除
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {manageTab === "storage" && (
                <div className="space-y-4">
                  <div className={cn("rounded-xl px-4", isLight ? "bg-black/[0.025]" : "bg-white/[0.025]")}>
                    <ManageDetailRow
                      label={mp.type === "local" ? "实例位置" : "连接地址"}
                      value={mp.type === "local" ? (aboutInfo?.path || mp.installDir || "—") : (mp.url || "—")}
                      isLight={isLight}
                      mono
                    />
                    <ManageDetailRow
                      label="占用空间"
                      value={mp.type === "local" && aboutInfo?.sizeBytes !== undefined
                        ? `${(aboutInfo.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                        : "—"}
                      isLight={isLight}
                    />
                  </div>
                  <div className={cn("flex items-center justify-between gap-4 rounded-xl px-4 py-3", isLight ? "bg-black/[0.025]" : "bg-white/[0.025]")}>
                    <div className="min-w-0">
                      <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/70" : "text-white/70")}>实例插图</div>
                      <div className={cn("mt-1 truncate text-[10px]", isLight ? "text-[#1a1625]/30" : "text-white/30")}>
                        {mp.cover ? "已使用自定义插图" : "使用默认插图"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void pickInstanceCover(mp)}
                      className={cn("motion-control h-8 rounded-xl px-3 text-[11px] font-medium", isLight ? "bg-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.09]" : "bg-white/[0.07] text-white/60 hover:bg-white/[0.11]")}
                    >
                      更换插图
                    </button>
                  </div>
                </div>
              )}
              {manageTab === "terminal" && (
                mp.type === "remote" ? (
                  <div className={cn("rounded-xl px-4 py-8 text-center text-xs", isLight ? "bg-black/[0.025] text-[#1a1625]/35" : "bg-white/[0.025] text-white/35")}>
                    远程实例不支持本地终端
                  </div>
                ) : (
                  <div className="flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl bg-[#101016]/95 text-[#d7d5df] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.055)]">
                    <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/[0.055] px-4">
                      <span className="text-[10px] font-medium text-white/40">{mp.subtitle || mp.name} · 实例终端</span>
                      <button type="button" onClick={() => setTerminalLogs([])} className="motion-control p-1.5 text-white/30 hover:text-white/55" title="清空终端">
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed scrollbar-subtle">
                      {terminalLogs.map((log, index) => (
                        <div key={index} className={cn("mb-0.5 whitespace-pre-wrap break-all", log.level === "error" ? "text-red-300/85" : log.level === "success" ? "text-white/85" : "text-white/60")}>
                          {log.msg}
                        </div>
                      ))}
                      <div className="mt-1 flex gap-2">
                        <span className="select-none text-white/35">{terminalDisplayPrompt}</span>
                        <input
                          type="text"
                          value={terminalInput}
                          onChange={(event) => setTerminalInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter" || !terminalInput.trim()) return;
                            const command = terminalInput.trim();
                            const instanceId = mp.installDir || mp.id;
                            setTerminalLogs(previous => [...previous, { msg: `${terminalDisplayPrompt} ${command}`, level: "info" }]);
                            TarvenEnv.sendCommand({ text: command, instanceId }).catch(() => {});
                            setTerminalInput("");
                          }}
                          className="min-w-0 flex-1 border-none bg-transparent text-white/75 outline-none placeholder:text-white/20"
                          placeholder={terminalPlaceholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
              {manageTab === "about" && (
                <div className={cn("rounded-xl px-4", isLight ? "bg-black/[0.025]" : "bg-white/[0.025]")}>
                  <ManageDetailRow label="实例名称" value={mp.subtitle || mp.name} isLight={isLight} />
                  <ManageDetailRow label="版本" value={mp.type === "local" && aboutInfo?.version && aboutInfo.version !== "unknown" ? `v${aboutInfo.version}` : (mp.version || "—")} isLight={isLight} />
                  <ManageDetailRow label="类型" value={mp.type === "local" ? "本地实例" : "远程实例"} isLight={isLight} />
                  <ManageDetailRow label="状态" value={mp.type === "local" ? (aboutInfo?.status || getStatusText(mp.status)) : getStatusText(mp.status)} isLight={isLight} />
                  <ManageDetailRow label="创建时间" value={mp.type === "local" && aboutInfo?.createdAt ? aboutInfo.createdAt : (mp.createdAt || "—")} isLight={isLight} />
                  {mp.type === "remote" && <ManageDetailRow label="Basic Auth" value={mp.basicAuth?.username || "未配置"} isLight={isLight} />}
                </div>
              )}
                  </div>
                </div>
              </section>
            </div>

            {/* 底部按钮 */}
            <div className={cn("relative flex flex-shrink-0 items-center gap-2 border-t px-4 py-3", isLight ? "border-black/[0.06]" : "border-white/[0.06]")}>
              <button
                type="button"
                onClick={() => {
                  closeManagePanel();
                  setTimeout(() => {
                    setNewInstanceMode("local");
                    setNewInstanceName("");
                    setNewInstanceDir("");
                    setNewInstanceUrl("http://");
                    setNewRemoteAuthEnabled(false);
                    setNewRemoteAuthUsername("");
                    setNewRemoteAuthPassword("");
                    setNewInstanceVersion("stable");
                    setNewInstanceLocalZip(null);
                    setNewInstanceError(null);
                    setShowNewInstancePanel(true);
                  }, PANEL_EXIT_MS);
                }}
                className={cn("motion-control h-8 rounded-xl px-3 text-[11px] font-medium", isLight ? "bg-black/[0.05] text-[#1a1625]/50 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]")}
              >
                新建实例
              </button>
              {manageSaveError && (
                <span className={cn("ml-auto max-w-[38%] text-[10px] leading-snug", isLight ? "text-red-900/65" : "text-red-300/75")}>{manageSaveError}</span>
              )}
              <div className={cn("flex items-center gap-2", !manageSaveError && "ml-auto")}>
                {manageTab === "launch" && (
                  <button disabled={isSavingManagePanel} onClick={saveManagedInstance} className={cn(
                    "motion-control h-8 rounded-xl px-3 text-[11px] font-medium disabled:pointer-events-none disabled:opacity-50",
                    isLight ? "bg-black/[0.05] text-[#1a1625]/55 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/55 hover:bg-white/[0.10]"
                  )}>{isSavingManagePanel ? "验证中" : "保存"}</button>
                )}
                <button
                  type="button"
                  disabled={Boolean(launchingId)}
                  onClick={() => {
                    closeManagePanel();
                    setTimeout(() => void launchTavern(mp), PANEL_EXIT_MS);
                  }}
                  className="motion-control flex h-8 min-w-28 items-center justify-center gap-1.5 rounded-xl bg-white/90 px-4 text-[11px] font-semibold text-[#1a1625] hover:bg-white disabled:pointer-events-none disabled:opacity-50"
                >
                  <Play className="h-3 w-3" />
                  {launchingId === mp.id ? "启动中" : "启动"}
                </button>
                <div className="relative">
                  <button
                    type="button"
                    aria-expanded={manageMoreOpen}
                    onClick={() => setManageMoreOpen(open => !open)}
                    className={cn("motion-control flex h-8 items-center gap-1.5 rounded-xl px-3 text-[11px] font-medium", isLight ? "bg-black/[0.05] text-[#1a1625]/50 hover:bg-black/[0.08]" : "bg-white/[0.06] text-white/50 hover:bg-white/[0.10]")}
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                    更多
                  </button>
                  {manageMoreOpen && (
                    <div className={cn("ios-floating-menu absolute bottom-10 right-0 z-10 w-32 overflow-hidden rounded-xl py-1 backdrop-blur-[32px]", glassBg, isLight && "is-light")}>
                      <button type="button" onClick={() => {
                        setManageMoreOpen(false);
                        closeManagePanel();
                        setTimeout(() => {
                          setIsRenameClosing(false);
                          setRenamingId(mp.id);
                          setRenameValue(mp.name);
                        }, PANEL_EXIT_MS);
                      }} className={cn("motion-menu-item w-full px-3 py-2 text-left text-[11px]", isLight ? "text-[#1a1625]/55 hover:text-[#1a1625]/80" : "text-white/55 hover:text-white/80")}>重命名</button>
                      <button type="button" onClick={() => {
                        setManageMoreOpen(false);
                        void pickInstanceCover(mp);
                      }} className={cn("motion-menu-item w-full px-3 py-2 text-left text-[11px]", isLight ? "text-[#1a1625]/55 hover:text-[#1a1625]/80" : "text-white/55 hover:text-white/80")}>更换插图</button>
                      <button type="button" onClick={() => {
                        setManageMoreOpen(false);
                        closeManagePanel();
                        setTimeout(() => {
                          setDeleteInstanceError(null);
                          setPendingDelete(mp);
                        }, PANEL_EXIT_MS);
                      }} className={cn("motion-menu-item w-full px-3 py-2 text-left text-[11px]", isLight ? "text-red-900/50 hover:text-red-900/75" : "text-red-300/50 hover:text-red-200/75")}>删除实例</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
        );
      })()}

      {showOnboarding && (
        <OnboardingGuide
          isLight={isLight}
          onComplete={dismissOnboarding}
          onSkip={dismissOnboarding}
        />
      )}

    </div>
  );
}

export default SillyClientLauncher;
