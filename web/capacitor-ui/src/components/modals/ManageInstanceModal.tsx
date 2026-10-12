import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import {
  X,
  Search,
  Eraser,
  Play,
  Lock,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { InstanceConfig } from "../../capacitor-plugin";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { coverPlate, coverTone } from "../instance/coverTone";
import { LAYERS } from "../../constants/layers";
import type { TavernInstance, ManageTab, BgMode, ThemeStyle } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";


const MANAGE_IMAGE_W = 1254;
const MANAGE_IMAGE_H = 687;
/** Figma 里「启动端口」的字号。固定 20px，不跟菜单 em 走。 */
const MANAGE_LABEL_PX = 20;
/**
 * 字号锁在当前视觉：面板根字号 16×78/71。
 * 字和菜单的比例保持这一档。外框再整体缩小，只为看起来更精致。
 */
const MANAGE_TYPE_SCALE = 78 / 71;
const MANAGE_FONT_PX = 16 * MANAGE_TYPE_SCALE;
/** 示意图宽 1254。顶栏不再留弹性空隙，设置行中间空白随帧宽一起收掉。 */
const MANAGE_FRAME_W = 1080;
const MANAGE_FRAME_H = MANAGE_IMAGE_H;
/** 相对当前 CSS 帧的整帧显示比例。字号、间距、圆角一起走，不除 devicePixelRatio。 */
const MANAGE_VISUAL_SCALE = 0.67;
/** 长于 --motion-dissolve（780ms），让切实例时的离场层走完溶解。 */
const MANAGE_FACE_EXIT_MS = 860;
/** 布局用。设计像素按 Figma 帧 1:1 落到 CSS 像素，不跟字号一起放大。 */
const manageEm = (px: number) => `${px / MANAGE_FONT_PX}em`;
/** 字号用。保持缩小菜单之前的像素大小。 */
const manageFont = (px: number) => `${px * MANAGE_TYPE_SCALE}px`;
/**
 * 毛玻璃选择组件的内凹轨道。几何按 44px 母版 × 49/44。
 * 文件里的暗边只有黑 10% + overlay 8%，亮边是白 25% 的 1px 内阴影。
 * 导出的示意图几乎是平的，不能再把这些 alpha 加成深槽。
 * 模糊取 GLASS radius 11.58 × 49/44。没有外投影，也不压 brightness。
 */
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
}

function manageRecessedGlass(isLight: boolean): React.CSSProperties {
  return {
    background: isLight ? "rgba(26,22,37,0.045)" : "rgba(255,255,255,0.05)",
    boxShadow: isLight
      ? "inset 0 1px 1.5px rgba(28,18,24,0.08), inset 0 -0.5px 0 rgba(255,255,255,0.7)"
      : "inset 0 1px 1.5px rgba(0,0,0,0.22), inset 0 -0.5px 0 rgba(255,255,255,0.08)",
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
      style={isPortrait ? { height: 48, width: "100%" } : { height: manageEm(49) }}
    >
      {MANAGE_TABS.map((tab) => {
        const isTabActive = manageTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={isTabActive}
            onClick={() => {
              if (tab.id === manageTab) return;
              setManageTab(tab.id);
            }}
            className="ios-choice-control motion-control flex select-none items-center justify-center whitespace-nowrap border font-medium"
            style={{
              width: isPortrait ? undefined : manageEm(109),
              fontSize: isPortrait ? 16 : manageFont(16),
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

const MANAGE_VIEW_GUTTER = 32;
/**
 * 竖版画板就是「竖向.png」的 687×843。
 * 宽和高锁死这个比例，放进视口时整帧 zoom，不再把宽拉满、高截成扁条。
 * 最大就是这张画板本身。
 */
const PORTRAIT_FRAME_W = 687;
const PORTRAIT_FRAME_H = 843;
const PORTRAIT_GUTTER = 16;
const PORTRAIT_CTRL = 48;
const PORTRAIT_CARD_W = 196;
const PORTRAIT_CARD_ACTIVE_W = 214;
const PORTRAIT_CARD_H = 196;
const PORTRAIT_CARD_GAP = 14;
const portraitFitFor = (viewportW: number, viewportH: number) => {
  const availW = Math.max(1, viewportW - PORTRAIT_GUTTER * 2);
  const availH = Math.max(1, viewportH - PORTRAIT_GUTTER * 2);
  return {
    zoom: Math.min(1, availW / PORTRAIT_FRAME_W, availH / PORTRAIT_FRAME_H),
  };
};

/**
 * 设计帧高仍是 Figma「Movie workspace」的 687，宽从 1254 收到 MANAGE_FRAME_W。
 * 「启动端口」在未缩放的帧里是 20px。整帧再用 CSS zoom = MANAGE_VISUAL_SCALE 显示，
 * 大约是上一档 CSS 尺寸的 67%。比例不变。禁止再除 devicePixelRatio，也不要锁回物理像素。
 * 右下角曲线只能把它拖大，不能拖到比这张缩放后的帧更小。屏幕不够时只裁切，不把帧再缩小。
 *
 * 浏览器页面无法限制操作系统窗口的最小尺寸。
 * 构建桌面或移动宿主时必须把窗口最小值适配到 manageMenuMinWindowCss()，
 * 即设计帧乘以 MANAGE_VISUAL_SCALE 后再加上四周 MANAGE_VIEW_GUTTER。浏览器预览小于该尺寸时只裁切，不缩小。
 */
/** 宿主窗口最小尺寸，单位 CSS 像素。按缩放后的显示尺寸计算，不乘 1/devicePixelRatio。 */
export const manageMenuMinWindowCss = () => ({
  width: Math.ceil(MANAGE_FRAME_W * MANAGE_VISUAL_SCALE) + MANAGE_VIEW_GUTTER * 2,
  height: Math.ceil(MANAGE_FRAME_H * MANAGE_VISUAL_SCALE) + MANAGE_VIEW_GUTTER * 2,
});

export interface ManageInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  bgMode?: BgMode;
  themeStyle?: ThemeStyle;
  glassBg: string;
  isWindows: boolean;
  allInstances: TavernInstance[];
  onSelectInstance: (instance: TavernInstance) => void;
  onLaunchInstance: (instance: TavernInstance) => void;
  launchingId: string | null;
  onTriggerRename: (instance: TavernInstance) => void;
  onTriggerDelete: (instance: TavernInstance) => void;
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
  children,
}: {
  label: string;
  desc?: string;
  isLight: boolean;
  isPortrait: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center justify-between gap-6"
        style={{
          minHeight: isPortrait ? 68 : 88,
          marginInline: isPortrait ? 20 : 28,
        }}
      >
      <div className="min-w-0 flex-1 pr-4">
        <div
          className={cn(
            "font-medium leading-tight",
            isLight ? "text-[#1a1625]/85" : "text-white/88"
          )}
          style={{ fontSize: MANAGE_LABEL_PX }}
        >
          {label}
        </div>
        {desc && (
          <div
            className={cn(
              "leading-snug",
              isLight ? "text-[#1a1625]/45" : "text-white/48"
            )}
            style={{ marginTop: 4, fontSize: 13 }}
          >
            {desc}
          </div>
        )}
      </div>
      <div className={isPortrait ? "shrink-0" : "min-w-0 max-w-[46%]"}>{children}</div>
      </div>
    </div>
  );
}

function ManageSettingValue({
  isLight,
  mono = false,
  children,
}: {
  isLight: boolean;
  mono?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "text-right break-words",
        mono && "font-mono",
        isLight ? "text-[#1a1625]/72" : "text-white/78"
      )}
      style={{ fontSize: 16 }}
    >
      {children}
    </div>
  );
}

function manageNumberFieldClass(isLight: boolean) {
  return cn(
    "manage-recess h-10 w-[112px] rounded-xl border-0 text-center outline-none",
    isLight ? "text-[#1a1625]" : "text-white"
  );
}

function manageTextFieldClass(isLight: boolean) {
  return cn(
    "manage-recess h-10 w-full rounded-xl border-0 px-3.5 outline-none",
    isLight
      ? "text-[#1a1625] placeholder:text-[#1a1625]/30"
      : "text-white placeholder:text-white/35"
  );
}

function ManageToggle({
  on,
  onChange,
  isLight,
}: {
  on: boolean;
  onChange: (value: boolean) => void;
  isLight: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
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
    "manage-recess motion-control flex h-10 flex-shrink-0 items-center rounded-xl border-0 px-4 font-medium",
    isLight
      ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
      : "text-white/65 hover:text-white/85",
  );
}

function managePanelFaceClass(active: boolean, portrait = false) {
  return cn(
    "motion-panel-face w-full",
    portrait ? "absolute inset-0" : "h-full",
    active
      ? "is-active pointer-events-auto"
      : "pointer-events-none select-none",
    !portrait && (active ? "relative" : "absolute inset-0"),
  );
}

function manageFaceScrollClassName(portrait: boolean) {
  return cn(
    "min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
    portrait ? "absolute inset-0 pb-3" : "h-full",
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
      onClick={() => onSelect(item)}
      className={cn(
        "motion-instance-card group relative cursor-pointer select-none flex-shrink-0",
        !isPortrait && "w-full",
        selected && "is-expanded"
      )}
      style={{
        width: isPortrait ? (selected ? PORTRAIT_CARD_ACTIVE_W : PORTRAIT_CARD_W) : undefined,
        height: isPortrait ? PORTRAIT_CARD_H : selected ? manageEm(196) : manageEm(152),
        borderRadius: manageEm(22),
      }}
    >
      <div className="manage-card-clip">
        {/* 封面与遮罩：与首页实例卡片同一套逻辑。图上一层匀色，底部渐变遮罩按选中态溶变 */}
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
        <div className="pointer-events-none absolute left-0 top-0 z-[2] flex items-center gap-1.5" style={{ padding: manageEm(14) }}>
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-[10px] font-semibold tracking-wide",
              isLight
                ? "bg-black/[0.06] text-[#1a1625]/60"
                : "bg-white/10 text-white/72"
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
          style={{ paddingInline: manageEm(14), paddingBottom: manageEm(14), gap: manageEm(8) }}
        >
          <div
            className={cn(
              "motion-control min-w-0 flex-1 truncate text-sm font-medium leading-snug",
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
  themeStyle = "dark",
  glassBg,
  allInstances,
  onSelectInstance,
  onLaunchInstance,
  launchingId,
  onTriggerRename,
  onTriggerDelete,
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
  const [manageFilter, setManageFilter] = useState<"all" | "local" | "remote">("all");
  const cardListRef = useRef<HTMLDivElement>(null);
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
  const [panelSize, setPanelSize] = useState({ w: MANAGE_FRAME_W, h: MANAGE_FRAME_H });
  const [isPortrait, setIsPortrait] = useState(() => (
    typeof window !== "undefined" && window.matchMedia("(max-width: 760px)").matches
  ));
  const [viewportBox, setViewportBox] = useState(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 390,
    h: typeof window !== "undefined" ? window.innerHeight : 844,
  }));
  const isPortraitRef = useRef(isPortrait);
  isPortraitRef.current = isPortrait;
  const portraitScrollMode = useRef<ScrollBehavior>("auto");
  const resizeDrag = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const sync = () => {
      setIsPortrait(query.matches);
      setViewportBox({ w: window.innerWidth, h: window.innerHeight });
    };
    sync();
    query.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      query.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
    };
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
  }, [isOpen, instance?.id, allInstances.length, manageSearchQuery, manageFilter, isPortrait]);
  useEffect(() => {
    if (!isOpen) return;
    setPanelSize({ w: MANAGE_FRAME_W, h: MANAGE_FRAME_H });
  }, [isOpen, instance?.id]);
  const onResizePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDrag.current = {
      x: event.clientX,
      y: event.clientY,
      w: panelSize.w,
      h: panelSize.h,
    };
  };
  const onResizePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const drag = resizeDrag.current;
    if (!drag) return;
    const zoom = MANAGE_VISUAL_SCALE;
    const maxW = Math.max(MANAGE_FRAME_W, (window.innerWidth - 16) / zoom);
    const maxH = Math.max(MANAGE_FRAME_H, (window.innerHeight - 16) / zoom);
    // 窗口居中，右下角要跟着指针走，宽高需要吃掉两倍位移。
    // panelSize 是设计像素；zoom 之后指针位移要除回 zoom。不读取 devicePixelRatio。
    const nextW = Math.round(Math.min(maxW, Math.max(MANAGE_FRAME_W, drag.w + (event.clientX - drag.x) * 2 / zoom)));
    const nextH = Math.round(Math.min(maxH, Math.max(MANAGE_FRAME_H, drag.h + (event.clientY - drag.y) * 2 / zoom)));
    setPanelSize((current) => (current.w === nextW && current.h === nextH ? current : { w: nextW, h: nextH }));
  };
  const onResizePointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
    resizeDrag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
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

  const logKey = instance?.installDir || instance?.id;
  const terminalLogs = useInstanceLogs(logKey, (isOpen || isClosing) && manageTab === "terminal");
  useLayoutEffect(() => {
    if (!isOpen || manageTab !== "terminal") return;
    syncRightFade();
  }, [isOpen, manageTab, terminalLogs.length]);
  const setTerminalLogs = (value: { msg: string; level?: string }[] | ((previous: { msg: string; level?: string }[]) => { msg: string; level?: string }[])) => {
    if (logKey) instanceLogs.update(logKey, value);
  };
  const filteredManageInstances = allInstances.filter((inst) => {
    if (manageFilter === "local" && inst.type !== "local") return false;
    if (manageFilter === "remote" && inst.type !== "remote") return false;
    if (!manageSearchQuery.trim()) return true;
    const query = manageSearchQuery.trim().toLowerCase();
    return (
      inst.name.toLowerCase().includes(query) ||
      (inst.subtitle || "").toLowerCase().includes(query) ||
      (inst.url || "").toLowerCase().includes(query)
    );
  });
  filteredIdsRef.current = filteredManageInstances.map((inst) => inst.id);
  useLayoutEffect(() => {
    if (!isOpen || !isPortrait) return;
    centerPortraitCard(portraitScrollMode.current);
    portraitScrollMode.current = "auto";
  }, [isOpen, isPortrait, instance?.id, filteredIdsRef.current.join("|")]);


  if (!instance || (!isOpen && !isClosing)) return null;

  const mp = instance;
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
      copyManageFaceValues(active, clone);
      clone.classList.add("manage-settings-outgoing");
      clone.style.pointerEvents = "none";
      host.appendChild(clone);
      pendingOutgoingRef.current = clone;
    }
    setSettingsFaceEpoch((value) => value + 1);
    setSettingsFaceReady(false);
    onSelectInstance(item);
  };

  const isDynamic = bgMode === "dynamic";
  const portraitFit = portraitFitFor(viewportBox.w, viewportBox.h);

  const rightFadeTop = manageEm(36);
  const rightFadeBottom = isPortrait ? manageEm(40) : manageEm(36);
  const rightFaceMask = rightFade.top || rightFade.bottom
    ? `linear-gradient(to bottom, ${rightFade.top ? "transparent" : "#000"} 0, #000 ${rightFadeTop}, #000 calc(100% - ${rightFadeBottom}), ${rightFade.bottom ? "transparent" : "#000"} 100%)`
    : undefined;
  const cardListMask = cardListFade.top || cardListFade.bottom
    ? isPortrait
      ? `linear-gradient(to right, ${cardListFade.top ? "transparent" : "#000"} 0, #000 ${manageEm(36)}, #000 calc(100% - ${manageEm(36)}), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
      : `linear-gradient(to bottom, ${cardListFade.top ? "transparent" : "#000"} 0, #000 ${manageEm(36)}, #000 calc(100% - ${manageEm(36)}), ${cardListFade.bottom ? "transparent" : "#000"} 100%)`
    : undefined;

  return (
    <div
      className={cn(
        "ios-task-surface manage-panel-surface fixed flex flex-col overflow-hidden select-none",
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        fontSize: MANAGE_FONT_PX,
        zoom: isPortrait ? portraitFit.zoom : MANAGE_VISUAL_SCALE,
        width: isPortrait ? PORTRAIT_FRAME_W : panelSize.w,
        height: isPortrait ? PORTRAIT_FRAME_H : panelSize.h,
        borderRadius: isPortrait ? 40 : manageEm(49),
        padding: isPortrait ? "18px 18px 16px" : `${manageEm(27)} ${manageEm(27)} ${manageEm(23)}`,
        background: isLight
          ? "rgba(255,255,255,0.70)"
          : isDynamic
            ? "rgba(28,20,32,0.70)"
            : "rgba(26,22,37,0.80)",
        backdropFilter: "blur(40px) saturate(1.8)",
        WebkitBackdropFilter: "blur(40px) saturate(1.8)",
      }}
    >
      {/* 顶部统一控制栏 (Movie navigation: 1200px × 49px, 下间距 28px) */}
      <div className="relative flex items-center w-full flex-shrink-0 select-none" style={{ height: isPortrait ? PORTRAIT_CTRL : manageEm(49), marginBottom: isPortrait ? 16 : manageEm(28), gap: isPortrait ? 8 : undefined }}>
        {isPortrait && (
          <>
            <button
              type="button"
              aria-label="向前翻卡片"
              disabled={!filteredManageInstances.some((item, index, list) => item.id === mp.id && index > 0)}
              onClick={() => {
                const index = filteredManageInstances.findIndex((item) => item.id === mp.id);
                const previous = filteredManageInstances[index - 1];
                if (previous) selectManagedInstance(previous);
              }}
              className={cn(
                "manage-recess motion-control flex flex-shrink-0 items-center justify-center rounded-full border-0",
                "disabled:pointer-events-none disabled:opacity-35",
                isLight ? "text-[#1a1625]/60 hover:text-[#1a1625]/85" : "text-white/60 hover:text-white/85"
              )}
              style={{ width: PORTRAIT_CTRL, height: PORTRAIT_CTRL }}
            >
              <ChevronLeft style={{ width: 18, height: 18 }} />
            </button>
            <button
              type="button"
              aria-label="向后翻卡片"
              disabled={!filteredManageInstances.some((item, index, list) => item.id === mp.id && index < list.length - 1)}
              onClick={() => {
                const index = filteredManageInstances.findIndex((item) => item.id === mp.id);
                const next = filteredManageInstances[index + 1];
                if (next) selectManagedInstance(next);
              }}
              className={cn(
                "manage-recess motion-control flex flex-shrink-0 items-center justify-center rounded-full border-0",
                "disabled:pointer-events-none disabled:opacity-35",
                isLight ? "text-[#1a1625]/60 hover:text-[#1a1625]/85" : "text-white/60 hover:text-white/85"
              )}
              style={{ width: PORTRAIT_CTRL, height: PORTRAIT_CTRL }}
            >
              <ChevronRight style={{ width: 18, height: 18 }} />
            </button>
          </>
        )}
        {/* 左上角搜索栏 (Search movies: 280px × 49px, 圆角 rounded-full, 与下方左侧栏 280px 严格垂直对齐) */}
        <div
          className="manage-recess overflow-hidden rounded-full flex flex-shrink-0 items-center"
          style={{
            width: isPortrait ? 292 : manageEm(280),
            height: isPortrait ? PORTRAIT_CTRL : manageEm(49),
            paddingInline: isPortrait ? 16 : manageEm(28),
            gap: isPortrait ? 10 : manageEm(15),
            position: isPortrait ? "absolute" : undefined,
            left: isPortrait ? "50%" : undefined,
            transform: isPortrait ? "translateX(-50%)" : undefined,
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
            value={manageSearchQuery}
            onChange={(e) => setManageSearchQuery(e.target.value)}
            placeholder="搜索实例..."
            className={cn(
              "min-w-0 flex-1 appearance-none bg-transparent text-[1em] font-normal outline-none",
              isLight
                ? "text-[#1a1625] placeholder:text-[#1a1625]/40"
                : "text-white placeholder:text-white/45"
            )}
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

        <div className="flex items-center flex-shrink-0" style={{ height: isPortrait ? PORTRAIT_CTRL : manageEm(49), gap: isPortrait ? 0 : manageEm(18), marginLeft: isPortrait ? "auto" : undefined }}>
          {!isPortrait && (
            <div
              className={cn("motion-slot is-before", manageTab === "launch" && "is-open")}
              style={{ ["--slot-gap" as string]: manageEm(18) }}
              aria-hidden={manageTab !== "launch"}
            >
              <div className="motion-slot-clip">
                <div className="motion-slot-face">
                  <button
                    type="button"
                    disabled={isSavingManagePanel}
                    onClick={onSaveManagedInstance}
                    className={cn(
                      "manage-recess motion-control flex flex-shrink-0 items-center justify-center rounded-full border-0 font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
                      isLight
                        ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
                        : "text-white/60 hover:text-white/85"
                    )}
                    style={{ height: manageEm(49), minHeight: manageEm(49), paddingBlock: 0, paddingInline: manageEm(22), lineHeight: 1, boxSizing: "border-box", fontSize: manageFont(16) }}
                  >
                    {isSavingManagePanel ? "保存中..." : "保存"}
                  </button>
                </div>
              </div>
            </div>
          )}
          {!isPortrait && (
          <button
            type="button"
            disabled={Boolean(launchingId)}
            onClick={() => {
              onClose();
              onLaunchInstance(mp);
            }}
            className={cn(
              "motion-control flex flex-shrink-0 items-center justify-center rounded-full border-0 font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
              isLight
                ? "bg-black/[0.07] text-[#1a1625]/60 hover:text-[#1a1625]"
                : "bg-white/15 text-white/60 hover:text-white"
            )}
            style={{ height: manageEm(49), minHeight: manageEm(49), paddingBlock: 0, paddingInline: manageEm(22), lineHeight: 1, boxSizing: "border-box", gap: manageEm(8), fontSize: manageFont(16) }}
          >
            <Play className="fill-current" style={{ width: manageEm(15), height: manageEm(15) }} />
            {launchingId === mp.id ? "启动中" : "启动"}
          </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="关闭管理面板"
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
      <div className={cn("flex w-full min-h-0 flex-1", isPortrait && "flex-col")} style={{ gap: isPortrait ? 14 : manageEm(22) }}>
        {/* 左侧实例边栏。竖版改成横向卡片带，材质不变。 */}
        <aside
          className={cn("flex-shrink-0 flex flex-col min-h-0 overflow-hidden", isPortrait && "w-full")}
          style={{
            width: isPortrait ? "100%" : manageEm(280),
            height: isPortrait ? "auto" : "100%",
            borderRadius: manageEm(30),
            padding: isPortrait ? "12px" : `${manageEm(27)} ${manageEm(28)}`,
            background: isLight ? "rgba(26, 22, 37, 0.04)" : "rgba(255, 255, 255, 0.04)",
            boxShadow: isLight
              ? "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(28,18,24,0.05)"
              : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.14)",
          }}
        >
          {/* 卡片容器：滚到边缘时渐隐，避免最后一张被栏体硬切 */}
          <div
            className={cn("min-h-0 min-w-0 overflow-hidden", isPortrait ? "w-full" : "flex-1")}
            style={{
              height: isPortrait ? PORTRAIT_CARD_H : undefined,
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
            "relative min-h-0 min-w-0 flex-1 overflow-hidden",
            isPortrait && "flex flex-col",
            isLight ? "text-[#1a1625]" : "text-white/88"
          )}
          style={{
            height: isPortrait ? undefined : "100%",
            borderRadius: manageEm(MANAGE_PANE_RADIUS),
            background: isLight ? "rgba(26, 22, 37, 0.04)" : "rgba(255, 255, 255, 0.04)",
            boxShadow: isLight
              ? "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(28,18,24,0.05)"
              : "inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.14)",
          }}
        >
            <div className={cn("motion-panel-stack min-h-0 w-full overflow-hidden", isPortrait ? "flex-1" : "h-full")}>
              {/* 启动与配置 */}
              <div
                className={managePanelFaceClass(manageTab === "launch" && settingsFaceReady, isPortrait)}
                aria-hidden={manageTab !== "launch"}
                inert={manageTab !== "launch"}
              >
                <div
                  ref={launchFaceRef}
                  onScroll={syncRightFade}
                  className={manageFaceScrollClassName(isPortrait)}
                  style={{
                    WebkitMaskImage: rightFaceMask,
                    maskImage: rightFaceMask,
                  }}
                >
                <>
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
                        desc="Android 宿主默认建议关闭，只在明确需要局域网访问时开启"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          on={draftConfig.listen}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, listen: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv4"
                        desc="至少要保留一个网络协议可用"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          on={draftConfig.ipv4}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv4: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 IPv6"
                        desc="如果网络环境稳定支持 IPv6，可以开启"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          on={draftConfig.ipv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, ipv6: v }))
                          }
                          isLight={isLight}
                        />
                      </ManageItem>
                      <ManageItem
                        label="优先使用 IPv6 DNS"
                        desc="在 IPv6 网络质量足够好时再开启"
                        isLight={isLight} isPortrait={isPortrait}
                      >
                        <ManageToggle
                          on={draftConfig.dnsIpv6}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, dnsIpv6: v }))
                          }
                          isLight={isLight}
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
                          on={draftConfig.keepAlive}
                          onChange={(v) =>
                            setDraftConfig((prev) => ({ ...prev, keepAlive: v }))
                          }
                          isLight={isLight}
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
                          on={draftRemoteAuthEnabled}
                          onChange={setDraftRemoteAuthEnabled}
                          isLight={isLight}
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
                          <div className="space-y-2" style={{ padding: "4px 40px 18px" }}>
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
                  >
                    <div className="flex items-center gap-2">
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
                            "manage-recess motion-control rounded-md px-2 py-0.5 text-[10px] font-medium",
                            isLight
                              ? "text-[#1a1625]/60 hover:text-[#1a1625]/85"
                              : "text-white/60 hover:text-white/85"
                          )}
                        >
                          修改密码
                        </button>
                      )}
                      <ManageToggle
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
                      <div className="space-y-2" style={{ padding: "4px 40px 18px" }}>
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
                              "manage-recess motion-control h-7 rounded-lg px-3 text-xs font-medium",
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
                              "motion-control h-7 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-40",
                              passwordMode === "clear"
                                ? isLight
                                  ? "manage-recess text-red-900/70 hover:text-red-900"
                                  : "manage-recess text-red-200/80 hover:text-red-100"
                                : isLight
                                  ? "bg-black text-white/80 hover:text-white"
                                  : "bg-white text-[#1a1625]/80 hover:text-[#1a1625]"
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
                </>
                {manageSaveError && (
                  <p
                    className={cn(
                      "font-medium leading-snug",
                      isLight ? "text-red-900/70" : "text-red-300/80"
                    )}
                    style={{ marginTop: manageEm(16), fontSize: manageFont(13) }}
                  >
                    {manageSaveError}
                  </p>
                )}
                </div>
              </div>

              {/* 存储 */}
              <div
                className={managePanelFaceClass(manageTab === "storage" && settingsFaceReady, isPortrait)}
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
                <ManageItem
                  label={mp.type === "local" ? "实例位置" : "连接地址"}
                  isLight={isLight} isPortrait={isPortrait}
                >
                  <ManageSettingValue isLight={isLight} mono>
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
                    style={{ fontSize: 16 }}
                  >
                    更换插图
                  </button>
                </ManageItem>
                  {mp.type === "local" && onOpenRelocate && (
                    <ManageItem
                      label="存储迁移"
                      desc="无损搬迁至新目录或软件默认路径"
                      isLight={isLight} isPortrait={isPortrait}
                    >
                      <button
                        type="button"
                        onClick={() => onOpenRelocate(mp)}
                        className={manageCapsuleButtonClass(isLight)}
                        style={{ fontSize: 16 }}
                      >
                        迁移目录
                      </button>
                    </ManageItem>
                  )}
                  {mp.type === "local" && onOpenMaintenance && (
                    <ManageItem label="实例维护" isLight={isLight} isPortrait={isPortrait}>
                      <button
                        type="button"
                        onClick={() => onOpenMaintenance(mp)}
                        className={manageCapsuleButtonClass(isLight)}
                        style={{ fontSize: 16 }}
                      >
                        扫描
                      </button>
                    </ManageItem>
                  )}
                </div>
              </div>

              {/* 终端 */}
              <div
                ref={terminalFaceRef}
                className={managePanelFaceClass(manageTab === "terminal" && settingsFaceReady, isPortrait)}
                style={{
                  boxSizing: "border-box",
                  padding: manageEm(MANAGE_NEST_INSET),
                }}
                aria-hidden={manageTab !== "terminal"}
                inert={manageTab !== "terminal"}
              >
                <div
                  className="flex h-full min-h-0 flex-col overflow-hidden text-white/78"
                  style={{
                    borderRadius: manageEm(MANAGE_PANE_RADIUS - MANAGE_NEST_INSET),
                    background: isLight
                      ? "rgba(22,18,28,0.90)"
                      : isDynamic
                        ? "oklch(0.18 0.014 350 / 0.84)"
                        : "oklch(0.17 0.008 260 / 0.84)",
                    boxShadow: "inset 0 1px 1.5px rgba(0,0,0,0.35), inset 0 -0.5px 0 rgba(255,255,255,0.05)",
                  }}
                >
                  {mp.type === "remote" ? (
                    <div
                      className="flex flex-1 items-center justify-center px-6 text-center text-white/55"
                      style={{ fontSize: manageFont(14) }}
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
                        className="font-medium text-white/55"
                        style={{ fontSize: manageFont(13) }}
                      >
                        {mp.subtitle || mp.name} · 实例终端
                      </span>
                      <button
                        type="button"
                        onClick={() => setTerminalLogs([])}
                        className="motion-control p-1.5 text-white/40 hover:text-white/85"
                        title="清空终端"
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
                      className="h-full overflow-y-auto leading-relaxed [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                      style={{ padding: `${manageEm(4)} ${manageEm(18)} ${manageEm(16)}`, fontSize: manageFont(13) }}
                    >
                      {terminalLogs.map((log, index) => (
                        <div
                          key={index}
                          className={cn(
                            "mb-0.5 whitespace-pre-wrap break-all",
                            log.level === "error"
                              ? "text-red-300/90"
                              : log.level === "success"
                              ? "text-white/88"
                              : "text-white/72"
                          )}
                        >
                          {log.msg}
                        </div>
                      ))}
                      <div className="mt-1 flex gap-2">
                        <span className="select-none text-white/45">
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
                          className={cn(
                            "min-w-0 flex-1 border-none bg-transparent outline-none",
                            "text-white/82 placeholder:text-white/28"
                          )}
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
                </div>
              </div>

              {/* 关于 */}
              <div
                className={managePanelFaceClass(manageTab === "about" && settingsFaceReady, isPortrait)}
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
                <ManageItem label="实例名称" isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight}>{mp.subtitle || mp.name}</ManageSettingValue>
                </ManageItem>
                <ManageItem label={mp.type === "local" ? "实例位置" : "连接地址"} isLight={isLight} isPortrait={isPortrait}>
                  <ManageSettingValue isLight={isLight} mono>{effectiveInstancePath}</ManageSettingValue>
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
            <div ref={outgoingHostRef} className="pointer-events-none absolute inset-0 z-[2]" />
            </div>
            {isPortrait && (
              <div className="relative z-10 flex flex-shrink-0 items-center justify-end" style={{ gap: 8, padding: "12px 10px 8px" }}>
                <div
                  className={cn("motion-slot is-before", manageTab === "launch" && "is-open")}
                  style={{ ["--slot-gap" as string]: "8px" }}
                  aria-hidden={manageTab !== "launch"}
                >
                  <div className="motion-slot-clip">
                    <div className="motion-slot-face">
                      <button
                        type="button"
                        disabled={isSavingManagePanel}
                        onClick={onSaveManagedInstance}
                        className={cn(
                          "manage-recess motion-control flex h-9 flex-shrink-0 items-center justify-center rounded-full border-0 px-4 text-sm font-medium whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
                          isLight ? "text-[#1a1625]/60 hover:text-[#1a1625]/85" : "text-white/60 hover:text-white/85"
                        )}
                      >
                        {isSavingManagePanel ? "保存中..." : "保存"}
                      </button>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={Boolean(launchingId)}
                  onClick={() => {
                    onClose();
                    onLaunchInstance(mp);
                  }}
                  className={cn(
                    "motion-control flex h-9 flex-shrink-0 items-center justify-center gap-1.5 rounded-full border-0 px-4 text-sm font-semibold whitespace-nowrap disabled:pointer-events-none disabled:opacity-50",
                    isLight ? "bg-black/[0.07] text-[#1a1625]/60 hover:text-[#1a1625]" : "bg-white/15 text-white/60 hover:text-white"
                  )}
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {launchingId === mp.id ? "启动中" : "启动"}
                </button>
              </div>
            )}

        </section>
      </div>
      {!isPortrait && <svg
        aria-label="拖动缩放管理窗口"
        role="button"
        className="absolute z-10 cursor-nwse-resize touch-none"
        style={{ right: 0, bottom: 0, width: 49, height: 49, overflow: "visible" }}
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      >
        <path
          d="M 35 0 A 35 35 0 0 1 0 35"
          fill="none"
          stroke="transparent"
          strokeWidth="18"
        />
        <path
          d="M 35 0 A 35 35 0 0 1 0 35"
          fill="none"
          stroke={isLight ? "rgba(28,18,24,0.28)" : "rgba(255,255,255,0.32)"}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>}
    </div>
  );
};
