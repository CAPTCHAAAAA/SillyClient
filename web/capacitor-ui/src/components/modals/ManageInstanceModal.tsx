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
import { LAYERS } from "../../constants/layers";
import type { TavernInstance, ManageTab, BgMode } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";
import { MENU_GLASS_FILTER, menuShellBackground } from "../../lib/menu-surface";
import { TerminalWell } from "../common/TerminalWell";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { CornerResizeCurve } from "./CornerResizeCurve";
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
/** 长于 --motion-dissolve（780ms），让切实例时的离场层走完溶解。 */
const MANAGE_FACE_EXIT_MS = 860;
/** 布局用。设计像素按 Figma 帧 1:1 落到 CSS 像素，不跟字号一起放大。 */
const manageEm = (px: number) => `${px / MANAGE_FONT_PX}em`;
/** 字号用。保持缩小菜单之前的像素大小。 */
const manageFont = (px: number) => `${px * MANAGE_TYPE_SCALE}px`;
function copyManageFaceValues(source: HTMLElement, clone: HTMLElement) {
  const from = source.querySelectorAll("input, textarea");
  const to = clone.querySelectorAll("input, textarea");
  from.forEach((node, index) => {
    const target = to[index] as HTMLInputElement | undefined;
    if (!target) return;
    target.value = (node as HTMLInputElement).value;
    target.checked = (node as HTMLInputElement).checked;
  });
  clone.querySelectorAll<HTMLElement>("[id]").forEach((node) => node.removeAttribute("id"));
  const scrollSelector = ".overflow-y-auto, [data-native-log-list]";
  const scrollSources = source.querySelectorAll<HTMLElement>(scrollSelector);
  const scrollClones = clone.querySelectorAll<HTMLElement>(scrollSelector);
  scrollSources.forEach((node, index) => {
    const target = scrollClones[index];
    if (target) {
      target.scrollTop = node.scrollTop;
      target.scrollLeft = node.scrollLeft;
    }
  });
}

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
  { id: "storage", label: "存储路径" },
  { id: "terminal", label: "实例终端" },
  { id: "about", label: "关于实例" },
] as const;

function ManageTabTrack({

  manageTab,
  setManageTab,
  isPortrait,
}: {
  manageTab: ManageTab;
  setManageTab: (tab: ManageTab) => void;
  isPortrait: boolean;
}) {
  return (
    <div
      className={cn("ios-choice-track manage-choice-track flex-shrink-0", isPortrait && "is-portrait")}
      role="group"
      aria-label="管理分类"
      style={isPortrait ? { height: 36, width: "100%" } : { height: manageEm(49) }}
    >
      {MANAGE_TABS.map((tab) => {
        const isTabActive = manageTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isTabActive}
            data-onboarding-target={tab.id === "storage" ? "manage-storage" : undefined}
            onClick={() => {
              if (tab.id === manageTab) return;
              setManageTab(tab.id);
            }}
            className="ios-choice-control motion-control flex select-none items-center justify-center whitespace-nowrap border font-medium"
            style={{
              width: isPortrait ? undefined : manageEm(109),
              fontSize: isPortrait ? 12 : manageFont(16),
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

/** 右侧内容区外框圆角。内框圆角 = 外框圆角 - 边距。 */
const MANAGE_PANE_RADIUS = 30;
const MANAGE_NEST_INSET = 14;

const PORTRAIT_CTRL = 44;
const PORTRAIT_CARD_W = 148;
const PORTRAIT_CARD_ACTIVE_W = 168;
const PORTRAIT_CARD_GAP = 12;

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
  onSaveManagedInstance: () => Promise<void>;
  // 终端日志
  terminalDisplayPrompt: string;
  terminalPlaceholder: string;
  onUpdateInstancePasswordStatus?: (instanceId: string, hasPassword: boolean) => void;
}

function ManageItem({
  label,
  desc,
  isLight,
  isPortrait,
  stackOnPortrait = false,
  children,
}: {
  label: string;
  desc?: string;
  isLight: boolean;
  isPortrait: boolean;
  stackOnPortrait?: boolean;
  children: React.ReactNode;
}) {
  const stacked = isPortrait && stackOnPortrait;
  return (
    <div className={cn("manage-item", stacked && "is-stacked")}>
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
      <div className="min-w-0 flex-1">
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
      <div className={stacked ? "min-w-0 w-full" : isPortrait ? "min-w-0 max-w-[58%] shrink-0" : "min-w-0 max-w-[46%]"}>{children}</div>
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

function isNativeCancelError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message || "")
          : "";
  return /cancel(?:led|ed)?|取消|cancel/i.test(message);
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

  return (
    <div
      data-manage-card={item.id}
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
        !isPortrait && "w-full",
        selected && "is-expanded"
      )}
      style={{
        width: isPortrait ? (selected ? PORTRAIT_CARD_ACTIVE_W : PORTRAIT_CARD_W) : undefined,
        height: isPortrait ? "var(--manage-card-height)" : selected ? manageEm(196) : manageEm(152),
        borderRadius: isPortrait ? 18 : manageEm(22),
      }}
    >
      <div className="manage-card-clip">
        {/* 封面与遮罩：未选中加重底边。选中后收短，封面成为焦点 */}
        {!isLight && (
          <div
            className="manage-card-veil"
            style={{ background: coverPlate(coverTone(false, isDynamic)) }}
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
        <div className={cn("manage-card-veil manage-card-scrim", selected && "opacity-0")} />
        <div className={cn("manage-card-veil manage-card-scrim is-focus", selected ? "opacity-100" : "opacity-0")} />
        <div className="pointer-events-none absolute left-0 top-0 z-[2] flex items-center gap-1.5" style={{ padding: isPortrait ? 10 : manageEm(14) }}>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-medium tracking-wide",
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
          style={{ paddingInline: isPortrait ? 10 : manageEm(14), paddingBottom: isPortrait ? 10 : manageEm(14), gap: manageEm(8) }}
        >
          <div
            className={cn(
              "motion-control min-w-0 flex-1 truncate text-sm font-medium leading-snug",
              isPortrait && "text-[13px]",
              isLight
                ? "text-[#1a1625]/75 group-hover:text-[#1a1625]"
                : "text-white/80 group-hover:text-white"
            )}
          >
            {item.subtitle || item.name}
          </div>
          <span
            className={cn(
              "flex shrink-0 items-end justify-center [&>svg]:h-[14px] [&>svg]:w-[14px]",
              isLight ? "text-[#1a1625]/50" : "text-white"
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
  const outgoingHostRef = useRef<HTMLDivElement>(null);
  const pendingOutgoingRef = useRef<HTMLElement | null>(null);
  const [settingsFaceEpoch, setSettingsFaceEpoch] = useState(0);
  const [settingsFaceReady, setSettingsFaceReady] = useState(true);
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
  const [isInspectingImport, setIsInspectingImport] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  isPortraitRef.current = isPortrait;
  const portraitScrollMode = useRef<ScrollBehavior>("auto");
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const sync = () => setIsPortrait(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
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
  };
  useLayoutEffect(() => {
    syncCardListFade();
    const node = cardListRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncCardListFade());
    observer.observe(node);
    return () => observer.disconnect();
  }, [isOpen, instance?.id, allInstances.length, manageSearchQuery, isPortrait]);
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
  const centerPortraitCard = (behavior: ScrollBehavior) => {
    const scroller = cardListRef.current;
    if (!scroller || !instance?.id) return;
    const index = filteredIdsRef.current.indexOf(instance.id);
    if (index < 0) return;
    const cardLeft = index * (PORTRAIT_CARD_W + PORTRAIT_CARD_GAP);
    const left = cardLeft + PORTRAIT_CARD_ACTIVE_W / 2 - scroller.clientWidth / 2;
    scroller.scrollTo({ left: Math.max(0, left), behavior });
  };
  const filteredIdsRef = useRef<string[]>([]);
  useLayoutEffect(() => {
    if (settingsFaceReady) return;
    const root = rightPaneRef.current;
    const faces = root
      ? [...root.querySelectorAll<HTMLElement>(":scope > .motion-panel-stack > .motion-panel-face")]
      : [];
    const outgoing = pendingOutgoingRef.current;
    faces.forEach((face) => {
      face.style.transition = "none";
    });
    if (outgoing) outgoing.style.transition = "none";
    void root?.offsetWidth;
    faces.forEach((face) => {
      face.style.transition = "";
    });
    if (outgoing) outgoing.style.transition = "";
    void root?.offsetWidth;
    outgoing?.classList.remove("is-active");
    pendingOutgoingRef.current = null;
    setSettingsFaceReady(true);
  }, [settingsFaceEpoch, settingsFaceReady]);
  useEffect(() => {
    const host = outgoingHostRef.current;
    if (!host || !settingsFaceReady) return;
    const node = host.firstElementChild;
    if (!node) return;
    const timer = window.setTimeout(() => {
      if (host.firstElementChild === node) host.replaceChildren();
    }, MANAGE_FACE_EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [settingsFaceReady, settingsFaceEpoch]);
  const [terminalInput, setTerminalInput] = useState("");
  const [localAboutInfo, setLocalAboutInfo] = useState<{ path?: string; sizeBytes?: number; version?: string; status?: string; createdAt?: string } | null>(null);

  const { windowRef, width: shellW, height: shellH, viewport, isResizing, onResizePointerDown } = useManagePanelLayout({
    visible: Boolean(instance) && (isOpen || isClosing),
    ready: settingsFaceReady,
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
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    setHasPassword(Boolean(instance?.hasPassword));
    setIsConfiguringPassword(false);
    setPasswordOld("");
    setPasswordNew("");
    setPasswordConfirm("");
    setPasswordError(null);
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
  useLayoutEffect(() => {
    if (!isOpen || !isPortrait) return;
    centerPortraitCard(portraitScrollMode.current);
    portraitScrollMode.current = "auto";
  }, [isOpen, isPortrait, instance?.id, filteredIdsRef.current.join("|")]);


  if (!instance || (!isOpen && !isClosing)) return null;

  const mp = instance;
  const isLocalInstance = mp.type === "local";
  const isInstanceRunning = mp.status === "running" || mp.status === "online";
  const effectiveInstancePath =
    mp.type === "local"
      ? (aboutInfo?.path || localAboutInfo?.path || mp.installPath || (mp.installDir && (mp.installDir.includes("/") || mp.installDir.includes("\\")) ? mp.installDir : null) || "—")
      : (mp.url || "—");

  const selectManagedInstance = (item: TavernInstance) => {
    if (item.id === mp.id) return;
    portraitScrollMode.current = "smooth";
    const active = rightPaneRef.current?.querySelector<HTMLElement>(":scope > .motion-panel-stack > .motion-panel-face.is-active");
    const host = outgoingHostRef.current;
    if (active && host) {
      host.replaceChildren();
      const clone = active.cloneNode(true) as HTMLElement;
      clone.classList.add("manage-settings-outgoing");
      clone.style.pointerEvents = "none";
      clone.inert = true;
      clone.setAttribute("aria-hidden", "true");
      host.appendChild(clone);
      copyManageFaceValues(active, clone);
      pendingOutgoingRef.current = clone;
    }
    setSettingsFaceEpoch((value) => value + 1);
    setSettingsFaceReady(false);
    onSelectInstance(item);
  };

  const selectImportArchive = async () => {
    if (isInspectingImport || isImporting) return;
    setIsInspectingImport(true);
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
      setImportStatus(
        isNativeCancelError(error)
          ? null
          : error instanceof Error
            ? error.message
            : "检查 ZIP 失败，请重试"
      );
    } finally {
      setIsInspectingImport(false);
    }
  };

  const importSelectedArchive = async () => {
    if (isImporting || !isLocalInstance || isInstanceRunning || !importArchive?.summary.importable) return;
    setIsImporting(true);
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
      setImportStatus(
        isNativeCancelError(error)
          ? null
          : error instanceof Error
            ? error.message
            : "导入失败，请重试"
      );
    } finally {
      setIsImporting(false);
    }
  };

  const exportInstanceArchive = async () => {
    if (isExporting || !isLocalInstance) return;
    setIsExporting(true);
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
      setExportStatus(
        isNativeCancelError(error)
          ? null
          : error instanceof Error
            ? error.message
            : "导出失败，请重试"
      );
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
      ? `linear-gradient(to right, ${cardListFade.top ? "transparent" : "#000"} 0, #000 24px, #000 calc(100% - 24px), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
      : `linear-gradient(to bottom, ${cardListFade.top ? "transparent" : "#000"} 0, #000 ${manageEm(36)}, #000 calc(100% - ${manageEm(36)}), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
    : undefined;

  const manageShellStyle: React.CSSProperties = { width: shellW, height: shellH };

  return (
    <div
      className="fixed flex select-none"
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: isPortrait ? viewport.top : 0,
        left: isPortrait ? viewport.left : 0,
        width: isPortrait ? viewport.width : "100vw",
        height: isPortrait ? viewport.height : "100dvh",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
    <div
      ref={windowRef}
      className={cn("manage-window relative flex flex-shrink-0", isResizing && "is-resizing")}
      style={{ ...manageShellStyle, pointerEvents: "auto" }}
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
      {/* 顶部统一控制栏 (Movie navigation: 1200px × 49px, 下间距 28px) */}
      <div className="manage-header relative flex items-center w-full flex-shrink-0 select-none" style={{ height: isPortrait ? PORTRAIT_CTRL : manageEm(49), marginBottom: isPortrait ? 10 : manageEm(22), gap: isPortrait ? 10 : undefined }}>
        {/* 左上角搜索栏。竖版跟关闭键并排，不再绝对定位盖住翻页键。 */}
        <div
          className={cn(
            "manage-recess overflow-hidden rounded-full flex items-center",
            isPortrait ? "min-w-0 flex-1" : "flex-shrink-0"
          )}
          style={{
            width: isPortrait ? undefined : manageEm(280),
            height: isPortrait ? PORTRAIT_CTRL : manageEm(49),
            paddingInline: isPortrait ? 16 : manageEm(28),
            gap: isPortrait ? 10 : manageEm(15),
            border: "none",
          }}
        >
          <Search
            className={cn(
              "flex-shrink-0",
              isLight ? "text-[#1a1625]/45" : "text-white/50"
            )}
            style={{ width: manageEm(20), height: manageEm(20) }}
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
            style={{ ["--slot-gap" as string]: isPortrait ? "10px" : manageEm(15) }}
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

        {!isPortrait && (
        <>
        {/* 搜索栏与分类标签间距，与顶栏其余固定间距统一 */}
        <div className="flex-shrink-0" style={{ width: manageEm(18) }} />

        <ManageTabTrack manageTab={manageTab} setManageTab={setManageTab} isPortrait={false} />
        </>
        )}

        {/* 剩余空间留给标签与右侧操作之间，操作组本身右对齐关闭键 */}
        {!isPortrait && <div className="flex-1" style={{ minWidth: manageEm(18) }} />}

        <div className="flex items-center flex-shrink-0" style={{ height: isPortrait ? PORTRAIT_CTRL : manageEm(49), marginLeft: isPortrait ? "auto" : undefined }}>
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
            style={{ width: isPortrait ? PORTRAIT_CTRL : manageEm(49), height: isPortrait ? PORTRAIT_CTRL : manageEm(49), minHeight: isPortrait ? PORTRAIT_CTRL : manageEm(49), paddingBlock: 0, lineHeight: 1, boxSizing: "border-box" }}
          >
            <X style={{ width: manageEm(20), height: manageEm(20) }} />
          </button>
        </div>
      </div>

      {/* 主体两列分屏 (Movie content: 1200px × 560px, 列间距 28px) */}
      <div className={cn("manage-body flex w-full min-h-0 flex-1", isPortrait && "flex-col")} style={{ gap: isPortrait ? 10 : manageEm(18) }}>
        {/* 左侧实例边栏。竖版改成横向卡片带，材质不变。 */}
        <aside
          className={cn("manage-well relative flex-shrink-0 flex flex-col min-h-0 overflow-hidden", isPortrait && "w-full")}
          style={{
            width: isPortrait ? "100%" : manageEm(280),
            height: isPortrait ? "auto" : "100%",
            borderRadius: isPortrait ? 22 : manageEm(30),
            padding: isPortrait ? "8px" : `${manageEm(22)} ${manageEm(22)}`,
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
            className={cn(
              "h-full w-full [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex select-none",
              isPortrait ? "flex-row overflow-x-auto overflow-y-hidden" : "flex-col overflow-y-auto overflow-x-hidden"
            )}
            style={{ gap: isPortrait ? PORTRAIT_CARD_GAP : manageEm(14) }}
          >
            {filteredManageInstances.map((item) => {
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
            })}

            {filteredManageInstances.length === 0 && (
              <div
                className={cn(
                  "py-8 text-center text-xs",
                  isLight ? "text-[#1a1625]/35" : "text-white/35"
                )}
              >
                无匹配实例
              </div>
            )}
          </div>
          </div>
        </aside>

        {isPortrait && (
          <ManageTabTrack manageTab={manageTab} setManageTab={setManageTab} isPortrait />
        )}

        {/* 右侧主设置面板。竖版落到卡片和分类下面，材质与溶解不变。 */}
        <section
          ref={rightPaneRef}
          className={cn(
            "manage-well relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            isLight ? "text-[#1a1625]" : "text-white/88"
          )}
          style={{
            height: isPortrait ? undefined : "100%",
            borderRadius: isPortrait ? 22 : manageEm(MANAGE_PANE_RADIUS),
          }}
        >
            <div className="motion-panel-stack min-h-0 w-full flex-1 overflow-hidden">
              {/* 启动与配置 */}
              <div
                className={cn(managePanelFaceClass(manageTab === "launch" && settingsFaceReady), "flex flex-col")}
                aria-hidden={manageTab !== "launch" || !settingsFaceReady}
                inert={manageTab !== "launch" || !settingsFaceReady}
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

                        {passwordError && (
                          <p className="text-[11px] text-red-500 font-medium">
                            {passwordError}
                          </p>
                        )}
                        {passwordSuccess && (
                          <p className="text-[11px] text-emerald-500 font-medium">
                            {passwordSuccess}
                          </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsConfiguringPassword(false);
                              setPasswordError(null);
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
                              setPasswordSuccess(null);
                              try {
                                if (passwordMode === "set") {
                                  const cleanNew = passwordNew.trim();
                                  if (!cleanNew) {
                                    setPasswordError("新密码不能为空");
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  if (cleanNew !== passwordConfirm.trim()) {
                                    setPasswordError("两次输入的密码不一致");
                                    setPasswordSaving(false);
                                    return;
                                  }
                                  if (hasPassword && !passwordOld.trim()) {
                                    setPasswordError("请输入原密码");
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
                                setPasswordError(err?.message || "操作失败");
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
                  <p
                    className={cn(
                      "font-medium leading-snug",
                      isLight ? "text-red-900/70" : "text-red-300/80"
                    )}
                    style={{ marginTop: manageEm(16), fontSize: isPortrait ? 11 : manageFont(13) }}
                  >
                    {manageSaveError}
                  </p>
                )}
                </div>
                </div>
                <div
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
                className={managePanelFaceClass(manageTab === "storage" && settingsFaceReady)}
                aria-hidden={manageTab !== "storage" || !settingsFaceReady}
                inert={manageTab !== "storage" || !settingsFaceReady}
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
                className={managePanelFaceClass(manageTab === "terminal" && settingsFaceReady)}
                style={{
                  boxSizing: "border-box",
                  padding: manageEm(MANAGE_NEST_INSET),
                }}
                aria-hidden={manageTab !== "terminal" || !settingsFaceReady}
                inert={manageTab !== "terminal" || !settingsFaceReady}
              >
                <TerminalWell
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
                              instanceLogs.append(instanceId, {
                                msg: `命令失败: ${error instanceof Error ? error.message : String(error)}`,
                                level: "error",
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
                className={managePanelFaceClass(manageTab === "about" && settingsFaceReady)}
                aria-hidden={manageTab !== "about" || !settingsFaceReady}
                inert={manageTab !== "about" || !settingsFaceReady}
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
            <div ref={outgoingHostRef} className="pointer-events-none absolute inset-0 z-[2]" />
            </div>

        </section>
      </div>
    </div>
      {!isPortrait && (
        <CornerResizeCurve
          isLight={isLight}
          label="拖动缩放管理菜单"
          active={isResizing}
          onPointerDown={onResizePointerDown}
        />
      )}
    </div>
    </div>
  );
};
