import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  X,
  Search,
  Eraser,
  Play,
  Lock,
} from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { ImportArchiveSummary, InstanceConfig } from "../../capacitor-plugin";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { coverPlate, coverTone } from "../instance/coverTone";
import { syncFrozenPlatePosition } from "../instance/frozenCoverPlate";
import { useFrozenCoverPlate } from "../instance/useFrozenCoverPlate";
import {
  captureManagePageSnapshot,
  easeSharedTransition,
  MANAGE_PAGE_TRANSITION_MS,
  startManageSharedTransition,
  type CapturedManageSnapshot,
} from "../../lib/manage-shared-transition";
import { LAYERS } from "../../constants/layers";
import type { TavernInstance, ManageTab, BgMode } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";
import { MENU_GLASS_FILTER, menuShellBackground } from "../../lib/menu-surface";
import { TerminalWell } from "../common/TerminalWell";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { ErrorReportAlert } from "../common/ErrorReportAlert";
import { reportGlobalError } from "../../lib/global-error-store";
import {
  createDiagnosticContext,
  humanizeNativeError,
  isUserCancellationError,
  type DiagnosticContext,
} from "../../lib/native-errors";
import { CornerResizeCurve } from "./CornerResizeCurve";
import { ManageFolderShell } from "./ManageFolderShell";
import { MANAGE_VISUAL_SCALE, useManagePanelLayout } from "./useManagePanelLayout";
import "./ManageInstanceModal.css";

/** Figma 里「启动端口」的字号。固定 20px，不跟菜单 em 走。 */
const MANAGE_LABEL_PX = 20;
/**
 * 字号锁在当前视觉：面板根字号 16×78/71。
 * 字和菜单的比例保持这一档。外框再整体缩小，只为看起来更精致。
 */
const MANAGE_TYPE_SCALE = 78 / 71;
const MANAGE_FONT_PX = 16 * MANAGE_TYPE_SCALE;
const CARD_CENTER_DURATION_MS = MANAGE_PAGE_TRANSITION_MS;
/** 布局用。设计像素按 Figma 帧 1:1 落到 CSS 像素，不跟字号一起放大。 */
const manageEm = (px: number) => `${px / MANAGE_FONT_PX}em`;
/** 字号用。保持缩小菜单之前的像素大小。 */
const manageFont = (px: number) => `${px * MANAGE_TYPE_SCALE}px`;

function manageRecessedGlass(isLight: boolean): React.CSSProperties {
  return {
    background: "var(--manage-field-fill)",
    boxShadow: isLight
      ? "inset 0 1px 1.5px rgba(28,18,24,0.06)"
      : "inset 0 1px 1.5px rgba(0,0,0,0.16)",
  };
}

const MANAGE_TABS = [
  { id: "launch", label: "启动参数" },
  { id: "storage", label: "存储路径", dataOnboardingTarget: "manage-storage" },
  { id: "terminal", label: "实例终端" },
  { id: "about", label: "关于实例" },
] as const;

/** 右侧内容区外框圆角。内框圆角 = 外框圆角 - 边距。 */
const MANAGE_PANE_RADIUS = 30;
const MANAGE_NEST_INSET = 14;
/** 桌面一体文件夹标签高度：左列搜索框 (44) + 间距 (10) = 54，与左侧边栏顶边及关闭键对齐。 */
const MANAGE_SEARCH_HEIGHT = 44;
const MANAGE_FOLDER_TAB_HEIGHT = 54;
const MANAGE_FOLDER_TAB_RADIUS = 15;
const MANAGE_FOLDER_FILLET_RADIUS = 12;

const DESKTOP_SIDEBAR_W = 280;
const DESKTOP_SIDEBAR_PAD = 22;
const DESKTOP_CARD_W = DESKTOP_SIDEBAR_W - DESKTOP_SIDEBAR_PAD * 2;
const DESKTOP_CARD_H = 210;
// 展开态严格保持 3:4（与首页 240×320 正常卡片一致），避免高度拉长破坏比例
const DESKTOP_CARD_ACTIVE_H = (DESKTOP_CARD_W * 4) / 3;
const DESKTOP_CARD_GAP = 14;

const PORTRAIT_CTRL = 44;
const PORTRAIT_FOLDER_TAB_HEIGHT = 40;
const PORTRAIT_FOLDER_PANE_RADIUS = 22;
const PORTRAIT_FOLDER_TAB_RADIUS = 12;
const PORTRAIT_FOLDER_FILLET_RADIUS = 12;
const PORTRAIT_CARD_MIN_H = 100;
const PORTRAIT_CARD_MAX_H = 124;
const PORTRAIT_CARD_VH_RATIO = 0.145;
const PORTRAIT_CARD_WIDTH_RATIO = 1;
const PORTRAIT_CARD_REST_HEIGHT_RATIO = 0.85;
const PORTRAIT_CARD_REST_WIDTH_RATIO = 0.85;
const PORTRAIT_CARD_GAP = 10;

export interface ManageInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  bgMode?: BgMode;
  isWindows: boolean;
  allInstances: TavernInstance[];
  onSelectInstance: (instance: TavernInstance) => void;
  onLaunchInstance: (instance: TavernInstance) => void;
  launchingId: string | null;
  onPickCover: (instance: TavernInstance) => void;
  onOpenMaintenance?: (instance: TavernInstance) => void;
  onOpenRelocate?: (instance: TavernInstance) => void;
  // 实例关于信息
  aboutInfo?: { path?: string; version?: string; status?: string; createdAt?: string; sizeBytes?: number } | null;
  // 保存与草稿状态
  draftConfig: InstanceConfig;
  setDraftConfig: React.Dispatch<React.SetStateAction<InstanceConfig>>;
  draftPort: number;
  setDraftPort: (p: number) => void;
  draftRemoteAuthEnabled: boolean;
  setDraftRemoteAuthEnabled: (v: boolean) => void;
  draftRemoteAuthUsername: string;
  setDraftRemoteAuthUsername: (v: string) => void;
  draftRemoteAuthPassword: string;
  setDraftRemoteAuthPassword: (v: string) => void;
  isSavingManagePanel: boolean;
  manageSaveError: string | null;
  manageSaveDiagnostic?: DiagnosticContext | null;
  isIOS?: boolean;
  onSaveManagedInstance: () => Promise<void>;
  // 终端日志
  terminalDisplayPrompt: string;
  terminalPlaceholder: string;
  onUpdateInstancePasswordStatus?: (instanceId: string, hasPassword: boolean) => void;
}

function ManageItem({
  label,
  desc,
  rowKey,
  sharedId,
  isLight,
  isPortrait,
  stackOnPortrait = false,
  children,
}: {
  label: string;
  desc?: string;
  rowKey?: string;
  sharedId?: string;
  isLight: boolean;
  isPortrait: boolean;
  stackOnPortrait?: boolean;
  children: React.ReactNode;
}) {
  const stacked = isPortrait && stackOnPortrait;
  const resolvedSharedId =
    sharedId ??
    (label === "实例位置" || label === "连接地址"
      ? "location"
      : label === "Basic Auth"
        ? "remote-auth"
        : undefined);
  return (
    <div
      data-manage-row={rowKey || label}
      data-manage-shared={resolvedSharedId}
      className={cn("manage-item", stacked && "is-stacked")}
    >
      <div
        className={cn(
          "setting-row flex",
          stacked ? "flex-col items-stretch justify-center gap-2" : "items-center justify-between gap-3"
        )}
        style={{
          minHeight: isPortrait ? 60 : 88,
          marginInline: isPortrait ? 16 : 28,
          paddingBlock: isPortrait ? stacked ? 12 : 6 : undefined,
        }}
      >
      <div data-manage-text="" className="min-w-0 flex-1">
        <div
          className={cn(
            "setting-label font-medium leading-tight",
            isLight ? "text-[#1a1625]/85" : "text-white/88"
          )}
          style={{ fontSize: isPortrait ? 13 : MANAGE_LABEL_PX }}
        >
          {label}
        </div>
        {desc && (
          <div
            className={cn(
              "setting-desc leading-snug",
              isLight ? "text-[#1a1625]/45" : "text-white/48"
            )}
            style={{ marginTop: 4, fontSize: isPortrait ? 11 : 13 }}
          >
            {desc}
          </div>
        )}
      </div>
      <div data-manage-ctrl="" className={stacked ? "min-w-0 w-full" : isPortrait ? "min-w-0 max-w-[58%] shrink-0" : "min-w-0 max-w-[46%]"}>{children}</div>
      </div>
    </div>
  );
}

function ManageSettingValue({
  isLight,
  children,
}: {
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "setting-value text-right break-words",
        isLight ? "text-[#1a1625]/72" : "text-white/78"
      )}
      style={{ fontSize: "var(--manage-value-size, 16px)" }}
    >
      {children}
    </div>
  );
}

function manageNumberFieldClass(isLight: boolean) {
  return cn(
    "manage-flat manage-number-field h-10 w-[112px] rounded-xl border-0 text-center outline-none",
    isLight ? "text-[#1a1625]" : "text-white"
  );
}

function manageTextFieldClass(isLight: boolean) {
  return cn(
    "manage-flat h-10 w-full rounded-xl border-0 px-3.5 outline-none",
    isLight
      ? "text-[#1a1625] placeholder:text-[#1a1625]/30"
      : "text-white placeholder:text-white/35"
  );
}

function formatArchiveBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function isNativeCancelError(error: unknown, isIOS = false) {
  return isUserCancellationError(error, isIOS);
}

function ManageToggle({
  label,
  on,
  onChange,
  isLight,
  isPortrait,
}: {
  label: string;
  on: boolean;
  onChange: (value: boolean) => void;
  isLight: boolean;
  isPortrait: boolean;
}) {
  if (isPortrait) {
    return <ToggleSwitch ariaLabel={label} on={on} onChange={onChange} isLight={isLight} />;
  }
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="relative flex-shrink-0 rounded-full transition-colors duration-200"
      style={{
        width: 61,
        height: 33,
        background: on
          ? isLight
            ? "rgba(26,22,37,0.78)"
            : "rgba(255,255,255,0.86)"
          : manageRecessedGlass(isLight).background,
        boxShadow: on ? "none" : manageRecessedGlass(isLight).boxShadow,
      }}
    >
      <span
        className="absolute top-[3px] rounded-full transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{
          width: 27,
          height: 27,
          left: 3,
          transform: on ? "translateX(28px)" : "translateX(0)",
          background: isLight || !on ? "#ffffff" : "#1a1625",
        }}
      />
    </button>
  );
}

function getStatusText(status: TavernInstance["status"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "online":
      return "在线";
    case "offline":
      return "离线";
    case "error":
      return "异常";
    default:
      return "已停止";
  }
}

function manageCapsuleButtonClass(isLight: boolean) {
  return cn(
    "manage-flat flat-capsule motion-control flex h-[var(--manage-action-height,40px)] flex-shrink-0 items-center whitespace-nowrap rounded-full border-0 px-4 text-[length:var(--manage-action-size,16px)] font-medium",
    isLight
      ? "text-[#1a1625]/60 hover:text-[#1a1625]"
      : "text-white/60 hover:text-white",
  );
}

function managePanelFaceClass(active: boolean) {
  return cn(
    "motion-panel-face w-full",
    "h-full",
    active
      ? "is-active pointer-events-auto"
      : "pointer-events-none select-none",
    active ? "relative" : "absolute inset-0",
  );
}

const MANAGE_TAB_ORDER: readonly ManageTab[] = ["launch", "storage", "terminal", "about"];

function manageFaceScrollClassName(portrait: boolean) {
  return cn(
    "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
    "h-full",
    portrait && "pb-3",
  );
}

function ManageInstanceCard({
  item,
  selected,
  isPortrait,
  isLight,
  isDynamic,
  onSelect,
}: {
  item: TavernInstance;
  selected: boolean;
  isPortrait: boolean;
  isLight: boolean;
  isDynamic: boolean;
  onSelect: (item: TavernInstance) => void;
}) {
  const src = item.cover || "./tavern-logo.png";
  const { rootRef, plateRef, usePlate } = useFrozenCoverPlate(isLight, isDynamic, false, src);

  return (
    <div
      ref={rootRef}
      data-manage-card={item.id}
      data-frozen-plate={usePlate ? "" : undefined}
      role="button"
      tabIndex={0}
      aria-label={item.subtitle || item.name}
      aria-pressed={selected}
      onClick={() => onSelect(item)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onSelect(item);
      }}
      className={cn(
        "motion-instance-card group relative cursor-pointer select-none flex-shrink-0",
        isLight && "is-light",
        !isPortrait && "w-full",
        selected && "is-expanded"
      )}
      style={{
        width: isPortrait
          ? selected
            ? `calc(var(--manage-card-height) * ${PORTRAIT_CARD_WIDTH_RATIO})`
            : `calc(var(--manage-card-height) * ${PORTRAIT_CARD_REST_WIDTH_RATIO})`
          : undefined,
        height: isPortrait
          ? selected
            ? "var(--manage-card-height)"
            : `calc(var(--manage-card-height) * ${PORTRAIT_CARD_REST_HEIGHT_RATIO})`
          : selected
            ? manageEm(DESKTOP_CARD_ACTIVE_H)
            : manageEm(DESKTOP_CARD_H),
        borderRadius: isPortrait ? 16 : manageEm(22),
      }}
    >
      <div className={cn("manage-card-clip", isLight && "is-light")}>
        {/* 采样主场景实时背景层（壁纸/动态流光/深浅底板），与首页实例卡保持同一底层材质 */}
        {usePlate ? <div ref={plateRef} className="cover-frozen-plate" /> : (
          <div
            className="manage-card-veil"
            style={{ background: coverPlate(coverTone(isLight, isDynamic)) }}
          />
        )}
        <img
          src={src}
          alt=""
          draggable={false}
          onError={(e) => {
            (e.target as HTMLElement).style.display = "none";
          }}
        />
        <div className="manage-card-veil manage-card-cover-tint" />
        <div className="manage-card-veil manage-card-cover-wash" />
        <div className="card-volume-wash" aria-hidden="true" />
        <div className={cn("manage-card-veil manage-card-scrim", selected && "opacity-0")} />
        <div className={cn("manage-card-veil manage-card-scrim is-focus", selected ? "opacity-100" : "opacity-0")} />
        <div className="pointer-events-none absolute left-0 top-0 z-[2] flex items-center gap-1.5" style={{ padding: isPortrait ? 8 : manageEm(14) }}>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide",
              isPortrait && "px-1.5 text-[9.5px]",
              isLight
                ? "bg-black/[0.035] text-[#1a1625]/60"
                : "bg-white/[0.07] text-white/70"
            )}
          >
            {formatDisplayVersion(item.version)}
          </span>
          {item.hasPassword && (
            <span
              title="已设置访问密码"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide",
                isLight
                  ? "bg-black/[0.06] text-[#1a1625]/60"
                  : "bg-white/10 text-white/72"
              )}
            >
              <Lock className="h-2.5 w-2.5" />
              <span>锁定</span>
            </span>
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between"
          style={{ paddingInline: isPortrait ? 9 : manageEm(14), paddingBottom: isPortrait ? 9 : manageEm(14), gap: isPortrait ? 5 : manageEm(8) }}
        >
          <div
            className={cn(
              "min-w-0 flex-1 truncate text-sm font-medium leading-snug transition-colors duration-[780ms] ease-[cubic-bezier(0.5,0,0.2,1)]",
              isPortrait && "text-[11.5px]",
              isLight
                ? selected ? "text-[#1a1625]" : "text-[#1a1625]/78 group-hover:text-[#1a1625]"
                : selected ? "text-white" : "text-white/82 group-hover:text-white"
            )}
          >
            {item.subtitle || item.name}
          </div>
          <span
            className={cn(
              "flex shrink-0 items-end justify-center",
              isPortrait ? "[&>svg]:h-3 [&>svg]:w-3" : "[&>svg]:h-[14px] [&>svg]:w-[14px]",
              isLight ? "text-[#1a1625]/55" : "text-white/88"
            )}
          >
            {item.icon}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 实例管理高级控制面板 (ManageInstanceModal)
 * 涵盖：启动参数配置、存储信息与实例操作、实时终端、关于版本详情。
 */
export const ManageInstanceModal: React.FC<ManageInstanceModalProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  bgMode = "dynamic",
  isWindows,
  allInstances,
  onSelectInstance,
  onLaunchInstance,
  launchingId,
  onPickCover,
  onOpenMaintenance,
  onOpenRelocate,
  aboutInfo,
  draftConfig,
  setDraftConfig,
  draftPort,
  setDraftPort,
  draftRemoteAuthEnabled,
  setDraftRemoteAuthEnabled,
  draftRemoteAuthUsername,
  setDraftRemoteAuthUsername,
  draftRemoteAuthPassword,
  setDraftRemoteAuthPassword,
  isSavingManagePanel,
  manageSaveError,
  manageSaveDiagnostic,
  isIOS = false,
  onSaveManagedInstance,
  terminalDisplayPrompt,
  terminalPlaceholder,
  onUpdateInstancePasswordStatus,
}) => {
  const [manageTab, setManageTab] = useState<ManageTab>("launch");
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const cardListRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [cardListFade, setCardListFade] = useState({ top: false, bottom: false });
  const rightPaneRef = useRef<HTMLElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const sharedOverlayRef = useRef<HTMLDivElement>(null);
  const pendingPageSnapshotRef = useRef<{
    snapshot: CapturedManageSnapshot;
    instanceDirection: -1 | 1;
  } | null>(null);
  const sharedTransitionCleanupRef = useRef<(() => void) | null>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const launchFaceRef = useRef<HTMLDivElement>(null);
  const storageFaceRef = useRef<HTMLDivElement>(null);
  const terminalFaceRef = useRef<HTMLDivElement>(null);
  const terminalLogRef = useRef<HTMLDivElement>(null);
  const aboutFaceRef = useRef<HTMLDivElement>(null);
  const [rightFade, setRightFade] = useState({ top: false, bottom: false });
  const [isPortrait, setIsPortrait] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
  ));
  const isPortraitRef = useRef(isPortrait);
  const [exportStatus, setExportStatus] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [importArchive, setImportArchive] = useState<{
    archivePath?: string;
    archiveUri?: string;
    label: string;
    summary: ImportArchiveSummary;
  } | null>(null);
  const [importIncludeOptional, setImportIncludeOptional] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [storageDiagnostic, setStorageDiagnostic] = useState<DiagnosticContext | null>(null);
  const [isInspectingImport, setIsInspectingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  isPortraitRef.current = isPortrait;
  const cardScrollMode = useRef<ScrollBehavior>("auto");
  const userScrolledAsideRef = useRef(false);
  const selectedInstanceIdRef = useRef<string | null>(null);
  selectedInstanceIdRef.current = instance?.id ?? null;
  const scrollAnimFrameRef = useRef<number | null>(null);
  const transitionCenterUntilRef = useRef<number>(0);
  const stopScrollAnimation = () => {
    if (scrollAnimFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimFrameRef.current);
      scrollAnimFrameRef.current = null;
    }
  };
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const sync = () => setIsPortrait(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const syncAsidePlates = () => {
    const node = cardListRef.current;
    if (!node) return;
    node.querySelectorAll<HTMLElement>(".motion-instance-card[data-frozen-plate]").forEach((cardEl) => {
      syncFrozenPlatePosition(cardEl);
    });
  };
  const syncCardListFade = () => {
    const node = cardListRef.current;
    if (!node) return;
    const portrait = isPortraitRef.current;
    const top = portrait ? node.scrollLeft > 2 : node.scrollTop > 2;
    const bottom = portrait
      ? node.scrollWidth - node.clientWidth - node.scrollLeft > 2
      : node.scrollHeight - node.clientHeight - node.scrollTop > 2;
    setCardListFade((current) => (
      current.top === top && current.bottom === bottom ? current : { top, bottom }
    ));
    syncAsidePlates();
  };
  useLayoutEffect(() => {
    syncCardListFade();
    const node = cardListRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncCardListFade();
      if (userScrolledAsideRef.current) return;
      // 切卡触发的 780ms 缓动滚动正在运行：禁止 ResizeObserver 打断并强制瞬移，由帧回调直接吸收实时容器尺寸
      if (scrollAnimFrameRef.current !== null) return;
      if (performance.now() < transitionCenterUntilRef.current) {
        const scroller = cardListRef.current;
        if (!scroller) return;
        const target = computeCenteredScrollOffset(scroller);
        if (target === null) return;
        const cur = isPortraitRef.current ? scroller.scrollLeft : scroller.scrollTop;
        const delta = target - cur;
        const next = Math.abs(delta) < 0.75 ? target : cur + delta * 0.35;
        if (isPortraitRef.current) scroller.scrollLeft = next;
        else scroller.scrollTop = next;
        syncCardListFade();
        return;
      }
      centerSelectedCard("auto");
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, instance?.id, allInstances.length, manageSearchQuery, isPortrait]);
  useEffect(() => {
    if (!isOpen) return;
    let frame: number | null = null;
    const start = performance.now();
    // 面板入场缩放或卡片选中展开（780ms）期间持续同步屏幕坐标，保证背景层采样与渐隐边缘无漂移
    const tick = (now: number) => {
      syncCardListFade();
      if (now - start < 840) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = null;
      }
    };
    frame = requestAnimationFrame(tick);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [isOpen, instance?.id, isPortrait, bgMode, isLight, manageSearchQuery]);
  const syncRightFade = (event?: React.UIEvent<HTMLDivElement>) => {
    const node = event?.currentTarget ?? rightScrollRef.current;
    if (!node) return;
    const top = node.scrollTop > 2;
    const bottom = node.scrollHeight - node.clientHeight - node.scrollTop > 2;
    setRightFade((current) => (
      current.top === top && current.bottom === bottom ? current : { top, bottom }
    ));
  };
  useLayoutEffect(() => {
    if (!isOpen) return;
    const target =
      manageTab === "launch"
        ? launchFaceRef.current
        : manageTab === "storage"
          ? storageFaceRef.current
          : manageTab === "terminal"
            ? terminalLogRef.current
            : aboutFaceRef.current;
    if (!target) return;
    rightScrollRef.current = target;
    target.scrollTop = 0;
    syncRightFade();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncRightFade());
    observer.observe(target);
    return () => observer.disconnect();
  }, [isOpen, manageTab, instance?.id]);
  const computeCenteredScrollOffset = (scroller: HTMLElement): number | null => {
    const selectedId = selectedInstanceIdRef.current;
    if (!selectedId) return null;
    const index = filteredIdsRef.current.indexOf(selectedId);
    if (index < 0) return null;
    const count = filteredIdsRef.current.length;
    if (isPortraitRef.current) {
      const viewportW = scroller.clientWidth;
      const activeH = scroller.clientHeight > 10
        ? scroller.clientHeight
        : Math.max(PORTRAIT_CARD_MIN_H, Math.min(PORTRAIT_CARD_MAX_H, window.innerHeight * PORTRAIT_CARD_VH_RATIO));
      const cardW = activeH * PORTRAIT_CARD_REST_WIDTH_RATIO;
      const activeW = activeH * PORTRAIT_CARD_WIDTH_RATIO;
      const cardLeft = index * (cardW + PORTRAIT_CARD_GAP);
      const totalW = Math.max(0, count - 1) * (cardW + PORTRAIT_CARD_GAP) + activeW;
      const maxLeft = Math.max(0, totalW - viewportW);
      const targetLeft = cardLeft + activeW / 2 - viewportW / 2;
      return Math.max(0, Math.min(maxLeft, targetLeft));
    }
    if (scroller.clientHeight < 10) return null;
    const viewportH = scroller.clientHeight;
    const cardTop = index * (DESKTOP_CARD_H + DESKTOP_CARD_GAP);
    const totalH = Math.max(0, count - 1) * (DESKTOP_CARD_H + DESKTOP_CARD_GAP) + DESKTOP_CARD_ACTIVE_H;
    const maxTop = Math.max(0, totalH - viewportH);
    const targetTop = cardTop + DESKTOP_CARD_ACTIVE_H / 2 - viewportH / 2;
    return Math.max(0, Math.min(maxTop, targetTop));
  };

  const centerSelectedCard = (behavior: ScrollBehavior) => {
    const scroller = cardListRef.current;
    if (!scroller) return;
    const target = computeCenteredScrollOffset(scroller);
    if (target === null) return;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const current = isPortraitRef.current ? scroller.scrollLeft : scroller.scrollTop;
    if (reduced || behavior === "auto" || Math.abs(target - current) < 0.5) {
      stopScrollAnimation();
      if (isPortraitRef.current) scroller.scrollLeft = target;
      else scroller.scrollTop = target;
      syncCardListFade();
      return;
    }
    stopScrollAnimation();
    const startScroll = current;
    const startTime = performance.now();
    // 与右侧面板高度及内容溶解 780ms 保持同频，末尾留出轻微余量跟随 ResizeObserver 收敛
    transitionCenterUntilRef.current = startTime + 860;
    const step = (now: number) => {
      const node = cardListRef.current;
      if (!node || userScrolledAsideRef.current) {
        scrollAnimFrameRef.current = null;
        return;
      }
      const liveTarget = computeCenteredScrollOffset(node);
      if (liveTarget === null) {
        scrollAnimFrameRef.current = null;
        return;
      }
      const progress = Math.max(0, Math.min(1, (now - startTime) / CARD_CENTER_DURATION_MS));
      const eased = easeSharedTransition(progress);
      const next = startScroll + (liveTarget - startScroll) * eased;
      if (isPortraitRef.current) node.scrollLeft = next;
      else node.scrollTop = next;
      syncCardListFade();
      if (progress < 1) {
        scrollAnimFrameRef.current = requestAnimationFrame(step);
      } else {
        scrollAnimFrameRef.current = null;
      }
    };
    scrollAnimFrameRef.current = requestAnimationFrame(step);
  };
  const filteredIdsRef = useRef<string[]>([]);
  const [terminalInput, setTerminalInput] = useState("");
  const [localAboutInfo, setLocalAboutInfo] = useState<{ path?: string; sizeBytes?: number; version?: string; status?: string; createdAt?: string } | null>(null);

  const { windowRef, width: shellW, height: shellH, viewport, isResizing, onResizePointerDown } = useManagePanelLayout({
    visible: Boolean(instance) && (isOpen || isClosing),
    ready: true,
    isPortrait,
    isLocal: instance?.type === "local",
    tab: manageTab,
    instanceId: instance?.id,
    surfaceRef,
    paneRef: rightPaneRef,
  });

  // 访问密码保护状态
  const [hasPassword, setHasPassword] = useState(Boolean(instance?.hasPassword));
  const [isConfiguringPassword, setIsConfiguringPassword] = useState(false);
  const [passwordMode, setPasswordMode] = useState<"set" | "clear">("set");
  const [passwordOld, setPasswordOld] = useState("");
  const [passwordNew, setPasswordNew] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordDiagnostic, setPasswordDiagnostic] = useState<DiagnosticContext | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setHasPassword(Boolean(instance?.hasPassword));
    setIsConfiguringPassword(false);
    setPasswordOld("");
    setPasswordNew("");
    setPasswordConfirm("");
    setPasswordError(null);
    setPasswordDiagnostic(null);
    setPasswordSuccess(null);
  }, [instance?.id, instance?.hasPassword]);

  useEffect(() => {
    setLocalAboutInfo(null);
    if (!isOpen || !instance || instance.type !== "local") return;
    let active = true;
    TarvenEnv.getInstanceInfo({
      instanceId: instance.installDir || instance.id,
      installPath: instance.installPath,
      port: instance.port ?? 8000,
    }).then(info => {
      if (active && info.path) {
        setLocalAboutInfo({
          path: info.path,
          sizeBytes: info.sizeBytes,
          version: info.version,
          status: info.status,
          createdAt: info.createdAt,
        });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [isOpen, instance?.id, instance?.installPath, instance?.installDir]);

  useEffect(() => {
    setExportStatus(null);
    setIsExporting(false);
    setImportArchive(null);
    setImportIncludeOptional(false);
    setImportStatus(null);
    setStorageDiagnostic(null);
    setIsInspectingImport(false);
    setIsImporting(false);
  }, [instance?.id]);

  const logKey = instance?.installDir || instance?.id;
  const terminalLogs = useInstanceLogs(logKey, (isOpen || isClosing) && manageTab === "terminal");
  useLayoutEffect(() => {
    if (!isOpen || manageTab !== "terminal") return;
    syncRightFade();
  }, [isOpen, manageTab, terminalLogs.length]);
  const setTerminalLogs = (value: { msg: string; level?: string }[] | ((previous: { msg: string; level?: string }[]) => { msg: string; level?: string }[])) => {
    if (logKey) instanceLogs.update(logKey, value);
  };
  const manageQuery = manageSearchQuery.trim().toLowerCase();
  const filteredManageInstances = manageQuery
    ? allInstances.filter((inst) => (
        inst.name.toLowerCase().includes(manageQuery) ||
        (inst.subtitle || "").toLowerCase().includes(manageQuery) ||
        (inst.url || "").toLowerCase().includes(manageQuery)
      ))
    : allInstances;
  filteredIdsRef.current = filteredManageInstances.map((inst) => inst.id);
  useEffect(() => {
    if (!isOpen) {
      userScrolledAsideRef.current = false;
      stopScrollAnimation();
    }
    return () => stopScrollAnimation();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    centerSelectedCard(cardScrollMode.current);
    cardScrollMode.current = "auto";
  }, [isOpen, isPortrait, instance?.id, filteredIdsRef.current.join("|")]);

  useLayoutEffect(() => {
    sharedTransitionCleanupRef.current?.();
    sharedTransitionCleanupRef.current = null;

    if (!isOpen || isClosing) {
      pendingPageSnapshotRef.current = null;
      return;
    }

    const pending = pendingPageSnapshotRef.current;
    pendingPageSnapshotRef.current = null;
    if (!pending) return;

    const stackEl = stackRef.current;
    const overlayEl = sharedOverlayRef.current;
    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!stackEl || !overlayEl || reduced) return;

    const toFaceEl = stackEl.querySelector<HTMLElement>(`:scope > [data-manage-tab="${manageTab}"]`);
    if (!toFaceEl || !instance) return;

    const cleanup = startManageSharedTransition({
      stackEl,
      overlayEl,
      toFaceEl,
      from: pending.snapshot,
      toMeta: {
        tab: manageTab,
        instanceId: instance.id,
        tabIndex: MANAGE_TAB_ORDER.indexOf(manageTab),
      },
      instanceDirection: pending.instanceDirection,
      isPortrait,
      isLight,
      onFinish: () => {
        if (sharedTransitionCleanupRef.current === cleanup) {
          sharedTransitionCleanupRef.current = null;
        }
      },
    });
    sharedTransitionCleanupRef.current = cleanup;

    return () => {
      cleanup();
      if (sharedTransitionCleanupRef.current === cleanup) {
        sharedTransitionCleanupRef.current = null;
      }
    };
  }, [isOpen, isClosing, manageTab, instance?.id, instance?.type, isLight]);


  if (!instance || (!isOpen && !isClosing)) return null;

  const mp = instance;
  const isLocalInstance = mp.type === "local";
  const isInstanceRunning = mp.status === "running" || mp.status === "online";
  const effectiveInstancePath =
    mp.type === "local"
      ? (aboutInfo?.path || localAboutInfo?.path || mp.installPath || (mp.installDir && (mp.installDir.includes("/") || mp.installDir.includes("\\")) ? mp.installDir : null) || "—")
      : (mp.url || "—");

  const captureBeforeSettingsSwitch = (instanceDirection: -1 | 1 = 1) => {
    // Prior transition must restore live opacity/transform/filter BEFORE capturing snapshot on rapid mid-flight clicks.
    sharedTransitionCleanupRef.current?.();
    sharedTransitionCleanupRef.current = null;
    const stackEl = stackRef.current;
    if (!stackEl) return;
    const activeFace = stackEl.querySelector<HTMLElement>(`:scope > [data-manage-tab="${manageTab}"]`);
    if (activeFace) {
      const snapshot = captureManagePageSnapshot(stackEl, activeFace, {
        tab: manageTab,
        instanceId: mp.id,
        tabIndex: MANAGE_TAB_ORDER.indexOf(manageTab),
      });
      pendingPageSnapshotRef.current = { snapshot, instanceDirection };
    }
  };

  const selectManagedInstance = (item: TavernInstance) => {
    userScrolledAsideRef.current = false;
    cardScrollMode.current = "smooth";
    if (item.id === mp.id) {
      centerSelectedCard("smooth");
      return;
    }
    const ids = filteredIdsRef.current;
    const prevIdx = ids.indexOf(mp.id);
    const nextIdx = ids.indexOf(item.id);
    const dir: -1 | 1 = prevIdx >= 0 && nextIdx >= 0 && nextIdx < prevIdx ? -1 : 1;
    captureBeforeSettingsSwitch(dir);
    onSelectInstance(item);
  };

  const selectImportArchive = async () => {
    if (isInspectingImport || isImporting) return;
    setIsInspectingImport(true);
    setStorageDiagnostic(null);
    setImportStatus("正在检查 ZIP…");
    try {
      const selected = await TarvenEnv.pickZipFile({ purpose: "dataImport" });
      const archivePath = selected.path?.trim() || undefined;
      const archiveUri = selected.uri?.trim() || undefined;
      if (!archivePath && !archiveUri) throw new Error("未选择 ZIP 文件");
      const summary = await TarvenEnv.inspectImportArchive({
        ...(archivePath ? { archivePath } : {}),
        ...(archiveUri ? { archiveUri } : {}),
      });
      const label =
        archivePath?.split(/[/\\]/).pop() ||
        (archiveUri ? "已选择 ZIP 文件" : "未命名 ZIP 文件");
      setImportArchive({ archivePath, archiveUri, label, summary });
      setImportStatus(
        summary.importable
          ? `已检查：${summary.importEntries} 项 · ${formatArchiveBytes(summary.importBytes)}`
          : "压缩包中没有可导入的用户数据"
      );
    } catch (error) {
      setImportArchive(null);
      if (isNativeCancelError(error, isIOS)) {
        setImportStatus(null);
        setStorageDiagnostic(null);
      } else {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "import",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath],
        });
        setImportStatus(friendly);
        setStorageDiagnostic(context);
        reportGlobalError(error, {
          area: "import",
          stage: "pick-import-archive",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath],
        });
      }
    } finally {
      setIsInspectingImport(false);
    }
  };

  const importSelectedArchive = async () => {
    if (isImporting || !isLocalInstance || isInstanceRunning || !importArchive?.summary.importable) return;
    setIsImporting(true);
    setStorageDiagnostic(null);
    setImportStatus("正在导入…");
    try {
      const result = await TarvenEnv.importInstanceData({
        instanceId: mp.installDir || mp.id,
        installPath: mp.installPath,
        ...(importArchive.archivePath ? { archivePath: importArchive.archivePath } : {}),
        ...(importArchive.archiveUri ? { archiveUri: importArchive.archiveUri } : {}),
        includeOptional: importIncludeOptional,
      });
      setImportStatus(
        `已导入 ${result.imported} 项 · ${formatArchiveBytes(result.bytes)}`
      );
      setLocalAboutInfo(null);
    } catch (error) {
      if (isNativeCancelError(error, isIOS)) {
        setImportStatus(null);
        setStorageDiagnostic(null);
      } else {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "import",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath, importArchive.archivePath],
        });
        setImportStatus(friendly);
        setStorageDiagnostic(context);
        reportGlobalError(error, {
          area: "import",
          stage: "import-archive",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath, importArchive.archivePath],
        });
      }
    } finally {
      setIsImporting(false);
    }
  };

  const exportInstanceArchive = async () => {
    if (isExporting || !isLocalInstance) return;
    setIsExporting(true);
    setStorageDiagnostic(null);
    setExportStatus("正在打包…");
    try {
      const result = await TarvenEnv.exportInstance({
        instanceId: mp.installDir || mp.id,
        installPath: mp.installPath,
      });
      if (result.cancelled || result.canceled) {
        setExportStatus(null);
        return;
      }
      const label = result.path.split(/[/\\]/).pop() || result.path;
      setExportStatus(`已导出：${label}`);
    } catch (error) {
      if (isNativeCancelError(error, isIOS)) {
        setExportStatus(null);
        setStorageDiagnostic(null);
      } else {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "export",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath],
        });
        setExportStatus(friendly);
        setStorageDiagnostic(context);
        reportGlobalError(error, {
          area: "export",
          stage: "export-archive",
          platform: isIOS ? "ios" : undefined,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: [mp.subtitle, mp.name, mp.installPath],
        });
      }
    } finally {
      setIsExporting(false);
    }
  };

  const isDynamic = bgMode === "dynamic";

  const rightFadeTop = isPortrait ? "16px" : manageEm(36);
  const rightFadeBottom = isPortrait ? "20px" : manageEm(36);
  const rightFaceMask = rightFade.top || rightFade.bottom
    ? `linear-gradient(to bottom, ${rightFade.top ? "transparent" : "#000"} 0, #000 ${rightFadeTop}, #000 calc(100% - ${rightFadeBottom}), ${rightFade.bottom ? "transparent" : "#000"} 100%)`
    : undefined;
  const cardListMask = cardListFade.top || cardListFade.bottom
    ? isPortrait
      ? `linear-gradient(to right, ${cardListFade.top ? "transparent" : "#000"} 0, ${cardListFade.top ? "rgba(0,0,0,0.22)" : "#000"} 10px, ${cardListFade.top ? "rgba(0,0,0,0.68)" : "#000"} 21px, #000 34px, #000 calc(100% - 34px), ${cardListFade.bottom ? "rgba(0,0,0,0.68)" : "#000"} calc(100% - 21px), ${cardListFade.bottom ? "rgba(0,0,0,0.22)" : "#000"} calc(100% - 10px), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
      : `linear-gradient(to bottom, ${cardListFade.top ? "transparent" : "#000"} 0, ${cardListFade.top ? "rgba(0,0,0,0.22)" : "#000"} ${manageEm(14)}, ${cardListFade.top ? "rgba(0,0,0,0.68)" : "#000"} ${manageEm(28)}, #000 ${manageEm(44)}, #000 calc(100% - ${manageEm(44)}), ${cardListFade.bottom ? "rgba(0,0,0,0.68)" : "#000"} calc(100% - ${manageEm(28)}), ${cardListFade.bottom ? "rgba(0,0,0,0.22)" : "#000"} calc(100% - ${manageEm(14)}), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
    : undefined;

  const manageShellStyle: React.CSSProperties = { width: shellW, height: shellH };

  const searchBar = (
    <div
      className={cn(
        "manage-recess overflow-hidden rounded-full flex items-center",
        isPortrait ? "min-w-0 flex-1" : "w-full flex-shrink-0"
      )}
      style={{
        height: isPortrait ? PORTRAIT_CTRL : manageEm(MANAGE_SEARCH_HEIGHT),
        marginBottom: isPortrait ? undefined : manageEm(10),
        paddingInline: isPortrait ? 16 : manageEm(22),
        gap: isPortrait ? 10 : manageEm(12),
        border: "none",
      }}
    >
      <Search
        className={cn(
          "flex-shrink-0",
          isLight ? "text-[#1a1625]/45" : "text-white/50"
        )}
        style={{ width: manageEm(19), height: manageEm(19) }}
      />
      <input
        type="search"
        aria-label="搜索管理实例"
        value={manageSearchQuery}
        onChange={(e) => setManageSearchQuery(e.target.value)}
        placeholder="搜索实例..."
        className={cn(
          "min-w-0 flex-1 appearance-none bg-transparent text-[1em] font-normal outline-none",
          isLight
            ? "text-[#1a1625] placeholder:text-[#1a1625]/40"
            : "text-white placeholder:text-white/45"
        )}
        style={{ fontSize: isPortrait ? 16 : undefined }}
      />
      <div
        className={cn("motion-slot is-after", manageSearchQuery && "is-open")}
        style={{ ["--slot-gap" as string]: isPortrait ? "10px" : manageEm(12) }}
        aria-hidden={!manageSearchQuery}
      >
        <div className="motion-slot-clip">
          <div className="motion-slot-face">
            <button
              type="button"
              aria-label="清空实例搜索"
              disabled={!manageSearchQuery}
              onClick={() => setManageSearchQuery("")}
              className={cn(
                "motion-control rounded-full p-1",
                isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]/85" : "text-white/40 hover:text-white/85"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const closeButton = (
    <button
      type="button"
      onClick={onClose}
      title="关闭管理面板"
      data-onboarding-target="manage-close"
      className={cn(
        "manage-recess motion-control flex flex-shrink-0 select-none items-center justify-center rounded-full border-0 outline-none",
        isLight
          ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
          : "text-white/60 hover:text-white/85"
      )}
      style={{
        width: isPortrait ? PORTRAIT_CTRL : manageEm(MANAGE_SEARCH_HEIGHT),
        height: isPortrait ? PORTRAIT_CTRL : manageEm(MANAGE_SEARCH_HEIGHT),
        minHeight: isPortrait ? PORTRAIT_CTRL : manageEm(MANAGE_SEARCH_HEIGHT),
        paddingBlock: 0,
        lineHeight: 1,
        boxSizing: "border-box",
      }}
    >
      <X style={{ width: manageEm(19), height: manageEm(19) }} />
    </button>
  );

  const instanceCardsAside = (
    <aside
      className={cn(
        "manage-well relative flex flex-col min-h-0 overflow-hidden",
        isPortrait ? "w-full flex-shrink-0" : "flex-1 w-full"
      )}
      style={{
        height: isPortrait ? "auto" : undefined,
        borderRadius: isPortrait ? PORTRAIT_FOLDER_PANE_RADIUS : manageEm(MANAGE_PANE_RADIUS),
        padding: isPortrait ? "8px" : `${manageEm(DESKTOP_SIDEBAR_PAD)} ${manageEm(DESKTOP_SIDEBAR_PAD)}`,
      }}
    >
      {/* 卡片容器：滚到边缘时渐隐，避免最后一张被栏体硬切 */}
      <div
        className={cn("min-h-0 min-w-0 overflow-hidden", isPortrait ? "w-full" : "flex-1")}
        style={{
          height: isPortrait ? "var(--manage-card-height)" : undefined,
          WebkitMaskImage: cardListMask,
          maskImage: cardListMask,
        }}
      >
        <div
          ref={cardListRef}
          onScroll={syncCardListFade}
          onWheel={() => {
            userScrolledAsideRef.current = true;
            stopScrollAnimation();
          }}
          onTouchStart={() => {
            userScrolledAsideRef.current = true;
            stopScrollAnimation();
          }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              userScrolledAsideRef.current = true;
              stopScrollAnimation();
            }
          }}
          className={cn(
            "h-full w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex select-none",
            isPortrait ? "flex-row items-center overflow-x-auto overflow-y-hidden" : "flex-col overflow-y-auto overflow-x-hidden"
          )}
          style={{
            gap: isPortrait ? PORTRAIT_CARD_GAP : manageEm(DESKTOP_CARD_GAP),
            overflowAnchor: "none",
          }}
        >
          {filteredManageInstances.length > 0 ? (
            filteredManageInstances.map((item) => {
              const selected = item.id === mp.id;
              return (
                <ManageInstanceCard
                  key={item.id}
                  item={item}
                  selected={selected}
                  isPortrait={isPortrait}
                  isLight={isLight}
                  isDynamic={isDynamic}
                  onSelect={selectManagedInstance}
                />
              );
            })
          ) : (
            <div
              className={cn(
                "w-full py-8 text-center text-xs",
                isLight ? "text-[#1a1625]/35" : "text-white/35"
              )}
            >
              无匹配实例
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  return (
    <div
      className="fixed flex select-none"
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: isPortrait ? viewport.top : 0,
        left: isPortrait ? viewport.left : 0,
        width: isPortrait ? viewport.width : "var(--ui-vw, 100vw)",
        height: isPortrait ? viewport.height : "var(--ui-dvh, 100dvh)",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
    <div
      ref={windowRef}
      className={cn("manage-window relative flex flex-shrink-0", isResizing && "is-resizing")}
      style={{ ...manageShellStyle, pointerEvents: isClosing ? "none" : "auto" }}
    >
    <div
      ref={surfaceRef}
      className={cn(
        "ios-task-surface manage-panel-surface relative flex h-full w-full flex-col overflow-hidden",
        isPortrait && "is-portrait",
        isPortrait && viewport.height < window.innerHeight - 120 && "is-keyboard-open",
        isLight && "is-light",
        isClosing ? "animate-manage-panel-exit" : "animate-manage-panel"
      )}
      style={{
        fontSize: isPortrait ? 16 : MANAGE_FONT_PX,
        ["--manage-viewport-height" as string]: `${viewport.height}px`,
        zoom: isPortrait ? 1 : MANAGE_VISUAL_SCALE,
        width: isPortrait ? "100%" : shellW / MANAGE_VISUAL_SCALE,
        height: "100%",
        borderRadius: isPortrait ? 32 : manageEm(49),
        padding: isPortrait ? "14px 14px 12px" : `${manageEm(27)} ${manageEm(27)} ${manageEm(23)}`,
        background: menuShellBackground(isLight, isDynamic),
        backdropFilter: MENU_GLASS_FILTER,
        WebkitBackdropFilter: MENU_GLASS_FILTER,
      }}
    >
      {/* 竖版保留顶部搜索栏 + 关闭键。横版双列独立贯通，右侧分类页签直接与面板融合成文件夹轮廓。 */}
      {isPortrait && (
        <div
          className="manage-header relative flex items-center w-full flex-shrink-0 select-none"
          style={{ height: PORTRAIT_CTRL, marginBottom: 10, gap: 10 }}
        >
          {searchBar}
          <div className="flex items-center flex-shrink-0" style={{ height: PORTRAIT_CTRL, marginLeft: "auto" }}>
            {closeButton}
          </div>
        </div>
      )}

      <div className={cn("manage-body flex w-full min-h-0 flex-1", isPortrait && "flex-col")} style={{ gap: isPortrait ? 10 : manageEm(18) }}>
        {isPortrait ? (
          instanceCardsAside
        ) : (
          <div
            className="manage-left-col flex flex-shrink-0 flex-col min-h-0 h-full"
            style={{ width: manageEm(DESKTOP_SIDEBAR_W) }}
          >
            {searchBar}
            {instanceCardsAside}
          </div>
        )}

        <ManageFolderShell
          tabs={MANAGE_TABS}
          activeTab={manageTab}
          onSelectTab={(nextTab) => {
            if (nextTab === manageTab) return;
            captureBeforeSettingsSwitch(1);
            setManageTab(nextTab);
          }}
          isPortrait={isPortrait}
          isLight={isLight}
          tabHeight={isPortrait ? PORTRAIT_FOLDER_TAB_HEIGHT : MANAGE_FOLDER_TAB_HEIGHT}
          paneRadius={isPortrait ? PORTRAIT_FOLDER_PANE_RADIUS : MANAGE_PANE_RADIUS}
          tabRadius={isPortrait ? PORTRAIT_FOLDER_TAB_RADIUS : MANAGE_FOLDER_TAB_RADIUS}
          filletRadius={isPortrait ? PORTRAIT_FOLDER_FILLET_RADIUS : MANAGE_FOLDER_FILLET_RADIUS}
          tabFontSize={isPortrait ? 13.5 : manageFont(16)}
          closeButton={!isPortrait ? closeButton : undefined}
          paneRef={rightPaneRef}
        >
            <div ref={stackRef} className="motion-panel-stack min-h-0 w-full flex-1 overflow-hidden">
              {/* 启动与配置 */}
              <div
                data-manage-tab="launch"
                className={cn(managePanelFaceClass(manageTab === "launch"), "flex flex-col")}
                aria-hidden={manageTab !== "launch"}
                inert={manageTab !== "launch"}
              >
                <div
                  ref={launchFaceRef}
                  onScroll={syncRightFade}
                  className={cn(
                    "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
                  )}
                  style={{
                    WebkitMaskImage: rightFaceMask,
                    maskImage: rightFaceMask,
                    flex: "1 1 auto",
                    height: "auto",
                    minHeight: 0,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "safe center",
                    paddingBlock: isPortrait ? 8 : manageEm(8),
                  }}
                >
                <div className="manage-content">
                  {mp.type === "local" ? (
                    <>
                      <ManageItem
                        label="启动端口"
                        desc="宿主 WebView 和本地服务都会使用这个端口"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="启动端口"
                          value={draftPort}
                          onChange={(e) => {
                            setDraftPort(parseInt(e.target.value) || 8000);
                          }}
                          className={manageNumberFieldClass(isLight)}
                          style={{ fontSize: 16 }}
                        />
                      </ManageItem>
                      <ManageItem
                        label="允许外部监听"
                        desc={isWindows ? "仅在需要局域网访问时开启" : "移动宿主默认建议关闭，只在明确需要局域网访问时开启"}
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="允许外部监听"
                          on={draftConfig.listen}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, listen: v }))
                          }
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv4"
                        desc="至少要保留一个网络协议可用"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="启用 IPv4"
                          on={draftConfig.ipv4}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv4: v }))
                          }
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv6"
                        desc="如果网络环境稳定支持 IPv6，可以开启"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="启用 IPv6"
                          on={draftConfig.ipv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv6: v }))
                          }
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                      <ManageItem
                        label="优先使用 IPv6 DNS"
                        desc="在 IPv6 网络质量足够好时再开启"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="优先使用 IPv6 DNS"
                          on={draftConfig.dnsIpv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, dnsIpv6: v }))
                          }
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                      <ManageItem
                        label="心跳写入间隔"
                        desc="单位秒，填 0 关闭心跳文件"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          aria-label="心跳写入间隔"
                          value={draftConfig.heartbeat}
                          onChange={(e) => {
                            const heartbeat = parseInt(e.target.value) || 0;
                            setDraftConfig((prev) => ({ ...prev, heartbeat }));
                          }}
                          className={manageNumberFieldClass(isLight)}
                          style={{ fontSize: 16 }}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 HTTP Keep-Alive"
                        desc="网络波动大时可临时关闭"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="启用 HTTP Keep-Alive"
                          on={draftConfig.keepAlive}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, keepAlive: v }))
                          }
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                    </>
                  ) : (
                    <div>
                      <ManageItem
                        label="Basic Auth"
                        desc="为受 HTTP 基本认证保护的远程地址提供凭据"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          label="Basic Auth"
                          on={draftRemoteAuthEnabled}
                          onChange={setDraftRemoteAuthEnabled}
                          isLight={isLight}
                          isPortrait={isPortrait}
                        />
                      </ManageItem>
                      <div
                        className={cn(
                          "motion-accordion",
                          draftRemoteAuthEnabled && "is-open"
                        )}
                        aria-hidden={!draftRemoteAuthEnabled}
                        inert={!draftRemoteAuthEnabled}
                      >
                        <div className="motion-accordion-inner">
                          <div className="space-y-2" style={{ padding: isPortrait ? "4px 16px 18px" : "4px 40px 18px" }}>
                            <input
                              type="text"
                              disabled={!draftRemoteAuthEnabled}
                              value={draftRemoteAuthUsername}
                              onChange={(e) =>
                                setDraftRemoteAuthUsername(e.target.value)
                              }
                              placeholder="用户名"
                              autoCapitalize="none"
                              autoCorrect="off"
                              autoComplete="username"
                              className={manageTextFieldClass(isLight)}
                              style={{ fontSize: 16 }}
                            />
                            <input
                              type="password"
                              disabled={!draftRemoteAuthEnabled}
                              value={draftRemoteAuthPassword}
                              onChange={(e) =>
                                setDraftRemoteAuthPassword(e.target.value)
                              }
                              placeholder={
                                mp.basicAuth ? "留空则保留现有密码" : "密码"
                              }
                              autoComplete="current-password"
                              className={manageTextFieldClass(isLight)}
                              style={{ fontSize: 16 }}
                            />
                            <p
                              className={cn(
                                "text-[10px] leading-relaxed",
                                isLight ? "text-[#1a1625]/35" : "text-white/35"
                              )}
                            >
                              密码由系统安全存储保管。保存时会立即验证当前连接。
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 访问密码保护 */}
                  <ManageItem
                    label="访问密码保护"
                    desc="开启后需在本地输入密码方可启动或连接实例"
                    isLight={isLight} isPortrait={isPortrait}
                    stackOnPortrait={hasPassword && !isConfiguringPassword}
                  >
                    <div className="flex items-center justify-end gap-2">
                      {hasPassword && !isConfiguringPassword && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsConfiguringPassword(true);
                            setPasswordMode("set");
                            setPasswordOld("");
                            setPasswordNew("");
                            setPasswordConfirm("");
                            setPasswordError(null);
                            setPasswordSuccess(null);
                          }}
                          className={cn(
                            isPortrait
                              ? manageCapsuleButtonClass(isLight)
                              : "manage-flat flat-capsule motion-control h-7 rounded-full px-3 text-[11px] font-medium",
                            isLight
                              ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
                              : "text-white/60 hover:text-white/85"
                          )}
                        >
                          修改密码
                        </button>
                      )}
                      <ManageToggle
                        label="访问密码保护"
                        on={hasPassword || isConfiguringPassword}
                        onChange={(checked) => {
                          if (checked) {
                            setIsConfiguringPassword(true);
                            setPasswordMode("set");
                            setPasswordOld("");
                            setPasswordNew("");
                            setPasswordConfirm("");
                            setPasswordError(null);
                            setPasswordSuccess(null);
                          } else {
                            if (hasPassword) {
                              setIsConfiguringPassword(true);
                              setPasswordMode("clear");
                              setPasswordOld("");
                              setPasswordError(null);
                              setPasswordSuccess(null);
                            } else {
                              setIsConfiguringPassword(false);
                            }
                          }
                        }}
                        isLight={isLight}
                        isPortrait={isPortrait}
                      />
                    </div>
                  </ManageItem>

                  <div
                    className={cn(
                      "motion-accordion",
                      isConfiguringPassword && "is-open"
                    )}
                    aria-hidden={!isConfiguringPassword}
                    inert={!isConfiguringPassword}
                  >
                    <div className="motion-accordion-inner">
                      <div className="space-y-2" style={{ padding: isPortrait ? "4px 16px 18px" : "4px 40px 18px" }}>
                        {passwordMode === "set" ? (
                          <>
                            {hasPassword && (
                              <input
                                type="password"
                                value={passwordOld}
                                onChange={(e) => {
                                  setPasswordOld(e.target.value);
                                  if (passwordError) setPasswordError(null);
                                }}
                                placeholder="原访问密码"
                                autoComplete="current-password"
                                className={manageTextFieldClass(isLight)} style={{ fontSize: 16 }}
                              />
                            )}
                            <input
                              type="password"
                              value={passwordNew}
                              onChange={(e) => {
                                setPasswordNew(e.target.value);
                                if (passwordError) setPasswordError(null);
                              }}
                              placeholder={hasPassword ? "新访问密码" : "设置访问密码"}
                              autoComplete="new-password"
                              className={manageTextFieldClass(isLight)} style={{ fontSize: 16 }}
                            />
                            <input
                              type="password"
                              value={passwordConfirm}
                              onChange={(e) => {
                                setPasswordConfirm(e.target.value);
                                if (passwordError) setPasswordError(null);
                              }}
                              placeholder="确认访问密码"
                              autoComplete="new-password"
                              className={manageTextFieldClass(isLight)} style={{ fontSize: 16 }}
                            />
                          </>
                        ) : (
                          <input
                            type="password"
                            value={passwordOld}
                            onChange={(e) => {
                              setPasswordOld(e.target.value);
                              if (passwordError) setPasswordError(null);
                            }}
                            placeholder="输入原密码以解除保护"
                            autoComplete="current-password"
                            className={manageTextFieldClass(isLight)} style={{ fontSize: 16 }}
                          />
                        )}

                        <ErrorReportAlert
                          error={passwordError}
                          diagnostic={passwordDiagnostic}
                          area="auth"
                          stage="instance-password"
                          platform={isIOS ? "ios" : undefined}
                          isLight={isLight}
                          compact
                          extraSecrets={[mp.subtitle, mp.name, mp.installPath, passwordOld, passwordNew]}
                        />
                        {passwordSuccess && (
                          <p className={cn("text-[11px] font-medium", isLight ? "text-[#1a1625]/70" : "text-white/75")}>
                            {passwordSuccess}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsConfiguringPassword(false);
                              setPasswordError(null);
                              setPasswordDiagnostic(null);
                              setPasswordSuccess(null);
                            }}
                            disabled={passwordSaving}
                            className={cn(
                              isPortrait
                                ? manageCapsuleButtonClass(isLight)
                                : "manage-flat flat-capsule motion-control h-7 rounded-full px-3 text-xs font-medium",
                              isLight
                                ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
                                : "text-white/60 hover:text-white/85"
                            )}
                          >
                            取消
                          </button>
                          <button
                            type="button"
                            disabled={passwordSaving}
                            onClick={async () => {
                              if (!instance) return;
                              setPasswordSaving(true);
                              setPasswordError(null);
                              setPasswordDiagnostic(null);
                              setPasswordSuccess(null);
                              try {
                                if (passwordMode === "set") {
                                  const cleanNew = passwordNew.trim();
                                  if (!cleanNew) {
                                    setPasswordError("新密码不能为空");
                                    setPasswordDiagnostic(null);
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  if (cleanNew !== passwordConfirm.trim()) {
                                    setPasswordError("两次输入的密码不一致");
                                    setPasswordDiagnostic(null);
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  if (hasPassword && !passwordOld.trim()) {
                                    setPasswordError("请输入原密码");
                                    setPasswordDiagnostic(null);
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  const res = await TarvenEnv.setInstancePassword({
                                    instanceId: instance.installDir || instance.id,
                                    password: cleanNew,
                                    oldPassword: hasPassword ? passwordOld.trim() : undefined,
                                  });
                                  setHasPassword(res.hasPassword);
                                  setIsConfiguringPassword(false);
                                  setPasswordSuccess("密码设置成功");
                                  onUpdateInstancePasswordStatus?.(instance.id, res.hasPassword);
                                } else {
                                  if (!passwordOld.trim()) {
                                    setPasswordError("请输入原密码");
                                    setPasswordDiagnostic(null);
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  await TarvenEnv.clearInstancePassword({
                                    instanceId: instance.installDir || instance.id,
                                    oldPassword: passwordOld.trim(),
                                  });
                                  setHasPassword(false);
                                  setIsConfiguringPassword(false);
                                  setPasswordSuccess("已解除密码保护");
                                  onUpdateInstancePasswordStatus?.(instance.id, false);
                                }
                              } catch (err: any) {
                                const friendly = humanizeNativeError(err);
                                const stage = passwordMode === "set" ? "set-password" : "clear-password";
                                const context = createDiagnosticContext(err, {
                                  area: "auth",
                                  stage,
                                  platform: isIOS ? "ios" : undefined,
                                  userMessage: friendly,
                                  extraSecrets: [mp.subtitle, mp.name, mp.installPath, passwordOld, passwordNew],
                                });
                                setPasswordError(friendly);
                                setPasswordDiagnostic(context);
                                reportGlobalError(err, {
                                  area: "auth",
                                  stage,
                                  platform: isIOS ? "ios" : undefined,
                                  userMessage: friendly,
                                  diagnostic: context,
                                  extraSecrets: [mp.subtitle, mp.name, mp.installPath, passwordOld, passwordNew],
                                });
                              } finally {
                                setPasswordSaving(false);
                              }
                            }}
                            className={cn(
                              isPortrait
                                ? cn(manageCapsuleButtonClass(isLight), "justify-center disabled:opacity-40")
                                : "motion-control h-7 rounded-full px-3.5 text-xs font-semibold disabled:opacity-40",
                              passwordMode === "clear"
                                ? isLight
                                  ? "manage-flat text-red-900/70 hover:text-red-900"
                                  : "manage-flat text-red-200/80 hover:text-red-100"
                                : isLight
                                  ? "manage-flat text-[#1a1625]/75 hover:text-[#1a1625]"
                                  : "manage-flat text-white/80 hover:text-white"
                            )}
                          >
                            {passwordSaving
                              ? "保存中..."
                              : passwordMode === "clear"
                                ? "确认解除"
                                : hasPassword
                                  ? "保存修改"
                                  : "启用密码保护"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                {manageSaveError && (
                  <div style={{ marginTop: manageEm(16) }}>
                    <ErrorReportAlert
                      error={manageSaveError}
                      diagnostic={manageSaveDiagnostic}
                      area="manage"
                      stage="save-instance"
                      platform={isIOS ? "ios" : undefined}
                      isLight={isLight}
                      extraSecrets={[mp.subtitle, mp.name, mp.installPath]}
                    />
                  </div>
                )}
                </div>
                </div>
                <div
                  data-manage-actions=""
                  className={cn(
                    "manage-actions z-[1] flex flex-shrink-0 items-center justify-end",
                  )}
                  style={{
                    gap: isPortrait ? 12 : manageEm(14),
                    padding: isPortrait ? "4px 16px 12px" : `${manageEm(4)} 28px ${manageEm(18)}`,
                  }}
                >
                  <button
                    type="button"
                    disabled={isSavingManagePanel}
                    onClick={onSaveManagedInstance}
                    className={cn(
                      "manage-recess motion-control flex items-center justify-center rounded-full border-0 font-medium whitespace-nowrap",
                      isLight ? "text-[#1a1625]/60 hover:text-[#1a1625]/85" : "text-white/60 hover:text-white/85"
                    )}
                    style={{
                      height: isPortrait ? 32 : manageEm(49),
                      paddingInline: isPortrait ? 16 : manageEm(22),
                      fontSize: isPortrait ? 12 : manageFont(16),
                    }}
                  >
                    {isSavingManagePanel ? "保存中..." : "保存"}
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(launchingId)}
                    onClick={() => {
                      onClose();
                      onLaunchInstance(mp);
                    }}
                    className={cn(
                      "manage-flat motion-control flex flex-shrink-0 items-center justify-center rounded-full border-0 font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
                      isLight ? "text-[#1a1625]/70 hover:text-[#1a1625]" : "text-white/75 hover:text-white"
                    )}
                    style={{
                      height: isPortrait ? 32 : manageEm(49),
                      gap: isPortrait ? 6 : manageEm(8),
                      paddingInline: isPortrait ? 16 : manageEm(22),
                      fontSize: isPortrait ? 12 : manageFont(16),
                    }}
                  >
                    <Play className="fill-current" style={{ width: isPortrait ? 14 : manageEm(15), height: isPortrait ? 14 : manageEm(15) }} />
                    {launchingId === mp.id ? "启动中" : "启动"}
                  </button>
                </div>
              </div>

              {/* 存储 */}
              <div
                data-manage-tab="storage"
                className={managePanelFaceClass(manageTab === "storage")}
                aria-hidden={manageTab !== "storage"}
                inert={manageTab !== "storage"}
              >
                <div
                  ref={storageFaceRef}
                  onScroll={syncRightFade}
                  className={manageFaceScrollClassName(isPortrait)}
                  style={{
                    WebkitMaskImage: rightFaceMask,
                    maskImage: rightFaceMask,
                  }}
                >
                <div className="manage-content">
                <ManageItem
                  label={mp.type === "local" ? "实例位置" : "连接地址"}
                  isLight={isLight} isPortrait={isPortrait}
                  stackOnPortrait
                >
                  <ManageSettingValue isLight={isLight}>
                    {effectiveInstancePath}
                  </ManageSettingValue>
                </ManageItem>
                <ManageItem label="占用空间" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>
                    {mp.type === "local" &&
                    (aboutInfo?.sizeBytes !== undefined || localAboutInfo?.sizeBytes !== undefined)
                      ? `${(((aboutInfo?.sizeBytes ?? localAboutInfo?.sizeBytes ?? 0)) / 1024 / 1024).toFixed(1)} MB`
                      : "—"}
                  </ManageSettingValue>
                </ManageItem>
                <ManageItem
                  label="实例插图"
                  desc={mp.cover ? "已使用自定义插图" : "使用默认插图"}
                  isLight={isLight} isPortrait={isPortrait}
                >
                  <button
                    type="button"
                    onClick={() => onPickCover(mp)}
                    className={manageCapsuleButtonClass(isLight)}
                  >
                    更换插图
                  </button>
                </ManageItem>
                  {mp.type === "local" && onOpenRelocate && (
                    <ManageItem
                      label="存储迁移"
                      desc="无损搬迁至你选择的新目录"
                      isLight={isLight} isPortrait={isPortrait}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenRelocate(mp)}
                        className={manageCapsuleButtonClass(isLight)}
                      >
                        迁移目录
                      </button>
                    </ManageItem>
                  )}
                  {mp.type === "local" && (
                    <ManageItem
                      label="导出实例（ZIP）"
                      desc={exportStatus || "打包实例文件，由系统选择保存位置"}
                      isLight={isLight} isPortrait={isPortrait}
                    >
                      <button
                        type="button"
                        disabled={isExporting}
                        onClick={exportInstanceArchive}
                        className={manageCapsuleButtonClass(isLight)}
                      >
                        {isExporting ? "导出中..." : "导出"}
                      </button>
                    </ManageItem>
                  )}
                  {mp.type === "local" && (
                    <ManageItem
                      label="导入数据（ZIP）"
                      desc={
                        isInstanceRunning
                          ? "请先停止实例，再覆盖导入用户数据"
                          : importStatus || "先创建实例，再从 ZIP 覆盖导入用户数据"
                      }
                      isLight={isLight} isPortrait={isPortrait}
                      stackOnPortrait={Boolean(importArchive)}
                    >
                      <div className={cn("flex min-w-0 flex-col gap-2", isPortrait && importArchive ? "items-stretch" : "items-end")}>
                        <button
                          type="button"
                          disabled={isInspectingImport || isImporting || isInstanceRunning}
                          onClick={selectImportArchive}
                          data-onboarding-target="manage-import-select"
                          className={cn(manageCapsuleButtonClass(isLight), isPortrait && importArchive && "self-end")}
                        >
                          {isInspectingImport ? "检查中..." : "选择 ZIP"}
                        </button>
                        {importArchive && (
                          <div className={cn("flex min-w-0 max-w-full flex-col", isPortrait ? "items-stretch gap-3" : "items-end gap-1.5")}>
                            <span
                              className={cn(
                                "max-w-full font-medium",
                                isPortrait ? "break-words text-[13px] leading-relaxed [overflow-wrap:anywhere]" : "truncate text-[11px]",
                                isLight ? "text-[#1a1625]/65" : "text-white/65"
                              )}
                              title={importArchive.label}
                            >
                              {importArchive.label}
                            </span>
                            <span
                              className={cn(
                                "leading-snug",
                                isPortrait ? "text-left text-xs" : "text-right text-[10px]",
                                isLight ? "text-[#1a1625]/45" : "text-white/45"
                              )}
                            >
                              {importArchive.summary.importEntries} 项 ·{" "}
                              {formatArchiveBytes(importArchive.summary.importBytes)}
                              {importArchive.summary.skippedEntries > 0
                                ? ` · 忽略 ${importArchive.summary.skippedEntries} 项`
                                : ""}
                            </span>
                            {(importArchive.summary.hasConfig || importArchive.summary.hasSecrets) && (
                              <div className={cn("flex items-center gap-2", isPortrait && "justify-between")}>
                                <span
                                  className={cn(
                                    isPortrait ? "text-[13px]" : "text-[11px]",
                                    isLight ? "text-[#1a1625]/55" : "text-white/55"
                                  )}
                                >
                                  包含配置与密钥
                                </span>
                                <ManageToggle
                                  label="导入配置与密钥"
                                  on={importIncludeOptional}
                                  onChange={setImportIncludeOptional}
                                  isLight={isLight}
                                  isPortrait={isPortrait}
                                />
                              </div>
                            )}
                            <button
                              type="button"
                              disabled={isImporting || !importArchive.summary.importable || isInstanceRunning}
                              onClick={importSelectedArchive}
                              data-onboarding-target="manage-import-confirm"
                              className={cn(manageCapsuleButtonClass(isLight), isPortrait && "self-end")}
                            >
                              {isImporting ? "导入中..." : "导入"}
                            </button>
                          </div>
                        )}
                      </div>
                    </ManageItem>
                  )}
                  {mp.type === "local" && storageDiagnostic && (
                    <ErrorReportAlert
                      error={storageDiagnostic.userMessage || importStatus || exportStatus || "导入或备份未能完成"}
                      diagnostic={storageDiagnostic}
                      area={storageDiagnostic.area}
                      stage={storageDiagnostic.stage}
                      platform={isIOS ? "ios" : undefined}
                      isLight={isLight}
                      compact
                      extraSecrets={[mp.subtitle, mp.name, mp.installPath, importArchive?.archivePath]}
                    />
                  )}
                  {mp.type === "local" && onOpenMaintenance && (
                    <ManageItem label="实例维护" isLight={isLight} isPortrait={isPortrait}>
                      <button
                        type="button"
                        onClick={() => onOpenMaintenance(mp)}
                        className={manageCapsuleButtonClass(isLight)}
                      >
                        扫描
                      </button>
                    </ManageItem>
                  )}
                </div>
                </div>
              </div>

              {/* 终端 */}
              <div
                ref={terminalFaceRef}
                data-manage-tab="terminal"
                className={managePanelFaceClass(manageTab === "terminal")}
                style={{
                  boxSizing: "border-box",
                  padding: manageEm(MANAGE_NEST_INSET),
                }}
                aria-hidden={manageTab !== "terminal"}
                inert={manageTab !== "terminal"}
              >
                <TerminalWell
                  data-manage-well=""
                  isLight={isLight}
                  isDynamic={isDynamic}
                  className="flex h-full min-h-0 flex-col overflow-hidden"
                >
                  {mp.type === "remote" ? (
                    <div
                      className="flex flex-1 items-center justify-center px-6 text-center text-[var(--terminal-text-label)]"
                      style={{ fontSize: isPortrait ? 12 : manageFont(14) }}
                    >
                      远程实例不支持本地终端
                    </div>
                  ) : (
                    <>
                    <div
                      className="flex flex-shrink-0 items-center justify-between"
                      style={{ height: manageEm(44), paddingInline: manageEm(18) }}
                    >
                      <span
                        className="min-w-0 truncate font-medium text-[var(--terminal-text-label)]"
                        style={{ fontSize: isPortrait ? 12 : manageFont(13) }}
                      >
                        {mp.subtitle || mp.name} · 实例终端
                      </span>
                      <button
                        type="button"
                        onClick={() => setTerminalLogs([])}
                        className="terminal-tool motion-control ml-2 flex-shrink-0 rounded-full p-1.5 text-[var(--terminal-tool-color)] hover:text-[var(--terminal-tool-hover-color)]"
                        title="清空终端"
                        aria-label="清空实例终端"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div
                      className="min-h-0 flex-1"
                      style={{
                        WebkitMaskImage: rightFaceMask,
                        maskImage: rightFaceMask,
                      }}
                    >
                    <div
                      ref={terminalLogRef}
                      onScroll={syncRightFade}
                      data-native-log-list
                      className="terminal-output h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      style={{ padding: `${manageEm(4)} ${manageEm(18)} ${manageEm(16)}`, fontSize: isPortrait ? 12 : manageFont(15) }}
                    >
                      {terminalLogs.map((log, index) => (
                        <div
                          key={index}
                          className="terminal-log-line"
                          data-level={log.level}
                        >
                          {log.msg}
                        </div>
                      ))}
                      <div className="terminal-command-row">
                        <span className="terminal-prompt" title={terminalDisplayPrompt}>
                          {terminalDisplayPrompt}
                        </span>
                        <input
                          type="text"
                          value={terminalInput}
                          onChange={(event) =>
                            setTerminalInput(event.target.value)
                          }
                          onKeyDown={(event) => {
                            if (
                              event.key !== "Enter" ||
                              !terminalInput.trim()
                            )
                              return;
                            const command = terminalInput.trim();
                            const instanceId = mp.installDir || mp.id;
                            setTerminalLogs((previous) => [
                              ...previous,
                              {
                                msg: `${terminalDisplayPrompt} ${command}`,
                                level: "info",
                              },
                            ]);
                            TarvenEnv.sendCommand({
                              text: command,
                              instanceId,
                            }).catch(error => {
                              const message = humanizeNativeError(error);
                              instanceLogs.append(instanceId, {
                                msg: `命令失败: ${message}`,
                                level: "error",
                              });
                              reportGlobalError(error, {
                                area: "terminal",
                                stage: "send-command",
                                platform: isIOS ? "ios" : undefined,
                                userMessage: `终端命令失败：${message}`,
                                extraSecrets: [mp.subtitle, mp.name, mp.installPath],
                              });
                            });
                            setTerminalInput("");
                          }}
                          className="terminal-command-input"
                          aria-label="实例终端命令"
                          placeholder={terminalPlaceholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                    </div>
                    </>
                  )}
                </TerminalWell>
              </div>

              {/* 关于 */}
              <div
                data-manage-tab="about"
                className={managePanelFaceClass(manageTab === "about")}
                aria-hidden={manageTab !== "about"}
                inert={manageTab !== "about"}
              >
                <div
                  ref={aboutFaceRef}
                  onScroll={syncRightFade}
                  className={manageFaceScrollClassName(isPortrait)}
                  style={{
                    WebkitMaskImage: rightFaceMask,
                    maskImage: rightFaceMask,
                  }}
                >
                <div className="manage-content">
                <ManageItem label="实例名称" isLight={isLight} isPortrait={isPortrait} stackOnPortrait>
                  <ManageSettingValue isLight={isLight}>{mp.subtitle || mp.name}</ManageSettingValue>
                </ManageItem>
                <ManageItem label={mp.type === "local" ? "实例位置" : "连接地址"} isLight={isLight} isPortrait={isPortrait} stackOnPortrait>
                  <ManageSettingValue isLight={isLight}>{effectiveInstancePath}</ManageSettingValue>
                </ManageItem>
                <ManageItem label="版本" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>
                    {formatDisplayVersion(
                      mp.type === "local" &&
                      ((aboutInfo?.version && aboutInfo.version !== "unknown") ||
                       (localAboutInfo?.version && localAboutInfo.version !== "unknown"))
                        ? (aboutInfo?.version && aboutInfo.version !== "unknown" ? aboutInfo.version : localAboutInfo?.version)
                        : mp.version
                    )}
                  </ManageSettingValue>
                </ManageItem>
                <ManageItem label="类型" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>{mp.type === "local" ? "本地实例" : "远程实例"}</ManageSettingValue>
                </ManageItem>
                <ManageItem label="状态" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>
                    {mp.type === "local"
                      ? aboutInfo?.status || localAboutInfo?.status || getStatusText(mp.status)
                      : getStatusText(mp.status)}
                  </ManageSettingValue>
                </ManageItem>
                <ManageItem label="创建时间" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>
                    {mp.type === "local" && (aboutInfo?.createdAt || localAboutInfo?.createdAt)
                      ? (aboutInfo?.createdAt || localAboutInfo?.createdAt)
                      : mp.createdAt || "—"}
                  </ManageSettingValue>
                </ManageItem>
                {mp.type === "remote" && (
                  <ManageItem label="Basic Auth" isLight={isLight} isPortrait={isPortrait}>
                    <ManageSettingValue isLight={isLight}>{mp.basicAuth?.username || "未配置"}</ManageSettingValue>
                  </ManageItem>
                )}
                </div>
                </div>
              </div>
            <div
              ref={sharedOverlayRef}
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-[2] overflow-hidden"
            />
            </div>

        </ManageFolderShell>
      </div>
    </div>
      {!isPortrait && (
        <CornerResizeCurve
          isLight={isLight}
          label="拖动缩放管理菜单"
          active={isResizing}
          className={isClosing ? "animate-manage-panel-exit" : "animate-manage-panel"}
          cornerRadius={Math.round(49 * MANAGE_VISUAL_SCALE)}
          onPointerDown={onResizePointerDown}
        />
      )}
    </div>
    </div>
  );
};
