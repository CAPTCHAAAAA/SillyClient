import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Search,
  Eraser,
  Play,
  ChevronLeft,
  ChevronRight,
  Lock,
  Folder,
  Globe,
} from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { InstanceConfig } from "../../capacitor-plugin";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { TavernInstance, ManageTab, BgMode, ThemeStyle } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";


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
  children,
}: {
  label: string;
  desc?: string;
  isLight: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-2 border-b last:border-b-0",
        isLight ? "border-black/[0.04]" : "border-white/[0.04]"
      )}
    >
      <div className="flex-1 min-w-0 pr-2">
        <div
          className={cn(
            "text-xs font-medium leading-tight mb-0.5",
            isLight ? "text-[#1a1625]/75" : "text-white/80"
          )}
        >
          {label}
        </div>
        {desc && (
          <div
            className={cn(
              "text-[10px] leading-tight",
              isLight ? "text-[#1a1625]/35" : "text-white/35"
            )}
          >
            {desc}
          </div>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function ManageDetailRow({
  label,
  value,
  isLight,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  isLight: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <span
        className={cn(
          "text-xs font-medium",
          isLight ? "text-[#1a1625]/70" : "text-white/70"
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "text-right text-xs break-all",
          mono && "font-mono",
          isLight ? "text-[#1a1625]/85" : "text-white/85"
        )}
      >
        {value}
      </span>
    </div>
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
  const setTerminalLogs = (value: { msg: string; level?: string }[] | ((previous: { msg: string; level?: string }[]) => { msg: string; level?: string }[])) => {
    if (logKey) instanceLogs.update(logKey, value);
  };


  if (!instance || (!isOpen && !isClosing)) return null;

  const mp = instance;
  const effectiveInstancePath =
    mp.type === "local"
      ? (aboutInfo?.path || localAboutInfo?.path || mp.installPath || (mp.installDir && (mp.installDir.includes("/") || mp.installDir.includes("\\")) ? mp.installDir : null) || "—")
      : (mp.url || "—");

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

  const currentIndex = allInstances.findIndex((inst) => inst.id === mp.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < allInstances.length - 1;
  const handlePrevInstance = () => {
    if (hasPrev) onSelectInstance(allInstances[currentIndex - 1]);
  };
  const handleNextInstance = () => {
    if (hasNext) onSelectInstance(allInstances[currentIndex + 1]);
  };

  const isDynamic = bgMode === "dynamic";
  const isDark = !isLight && !isDynamic;

  return (
    <div
      className={cn(
        "ios-task-surface manage-panel-surface fixed flex flex-col overflow-hidden backdrop-blur-[40px] select-none",
        "rounded-[49px] pt-[27px] px-[27px] pb-[23px]",
        isLight
          ? "bg-white/65 border border-black/10 shadow-[0_20px_60px_rgba(0,0,0,0.12)] is-light"
          : isDynamic
          ? "bg-[#16121f]/35 border border-white/10 shadow-[0_24px_70px_rgba(0,0,0,0.50)] saturate-[180%]"
          : "bg-[#0c0c10]/60 border border-white/[0.08] shadow-[0_24px_70px_rgba(0,0,0,0.65)]",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(1254px, calc(100vw - 2rem))",
        height: "min(687px, calc(100vh - 2rem))",
        maxHeight: "calc(100vh - 2rem)",
      }}
    >
      {/* 顶部统一控制栏 (Movie navigation: 1200px × 49px, 下间距 28px) */}
      <div className="flex items-center w-full h-[49px] flex-shrink-0 mb-[28px] select-none">
        {/* 左上角搜索栏 (Search movies: 280px × 49px, 圆角 rounded-full, 与下方左侧栏 280px 严格垂直对齐) */}
        <div
          className={cn(
            "w-[280px] h-[49px] flex-shrink-0 rounded-full px-5 flex items-center gap-2.5 transition-all border",
            isLight
              ? "bg-black/[0.03] border-black/10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.08),0_1px_2px_rgba(255,255,255,0.60)]"
              : isDynamic
              ? "bg-black/25 border-white/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.45),0_1px_2px_rgba(255,255,255,0.08)]"
              : "bg-black/35 border-white/[0.08] shadow-[inset_0_1px_3px_rgba(0,0,0,0.55),0_1px_2px_rgba(255,255,255,0.05)]"
          )}
        >
          <Search
            className={cn(
              "w-[18px] h-[18px] flex-shrink-0",
              isLight ? "text-[#1a1625]/40" : "text-white/40"
            )}
          />
          <input
            type="search"
            value={manageSearchQuery}
            onChange={(e) => setManageSearchQuery(e.target.value)}
            placeholder="搜索实例..."
            className={cn(
              "min-w-0 flex-1 bg-transparent text-xs font-medium outline-none",
              isLight
                ? "text-[#1a1625] placeholder:text-[#1a1625]/35"
                : "text-white placeholder:text-white/35"
            )}
          />
          {manageSearchQuery && (
            <button
              type="button"
              onClick={() => setManageSearchQuery("")}
              className={cn(
                "p-1 rounded-full transition-colors",
                isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]" : "text-white/40 hover:text-white"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 搜索栏与 Tab 间距: 29px */}
        <div className="w-[29px] flex-shrink-0" />

        {/* 四个分类标签页 (Categories: 688px × 49px, 内部 4 个胶囊高 47px, 严格按照 Figma 间距 50px 与胶囊尺寸) */}
        <div className="w-[688px] h-[49px] flex-shrink-0 flex items-center justify-start gap-[50px]">
          {(
            [
              { id: "launch", label: "启动参数", width: "w-[111px]" },
              { id: "storage", label: "存储路径", width: "w-[109px]" },
              { id: "terminal", label: "实例终端", width: "w-[109px]" },
              { id: "about", label: "关于实例", width: "w-[109px]" },
            ] as const
          ).map((tab) => {
            const isTabActive = manageTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setManageTab(tab.id)}
                aria-pressed={isTabActive}
                className={cn(
                  "h-[47px] rounded-full text-[15px] select-none flex-shrink-0 flex items-center justify-center transition-[background-color,box-shadow,color] duration-150 outline-none",
                  tab.width,
                  isTabActive
                    ? isLight
                      ? "bg-black/[0.12] text-[#1a1625] font-semibold shadow-sm active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18),inset_0_1px_2px_rgba(0,0,0,0.12)] active:bg-black/[0.16]"
                      : isDynamic
                      ? "bg-white/20 text-white font-semibold shadow-sm backdrop-blur border border-white/20 active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/35"
                      : "bg-[#aaa9a6] text-black font-semibold shadow-sm active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-[#92918e]"
                    : isLight
                    ? "bg-transparent text-[#1a1625]/60 hover:text-[#1a1625] hover:bg-black/[0.04] font-medium active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.12)] active:bg-black/[0.08]"
                    : isDynamic
                    ? "bg-transparent text-white/60 hover:text-white hover:bg-white/[0.06] font-medium active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] active:bg-black/25"
                    : "bg-transparent text-[#d1d0d0] hover:text-white hover:bg-white/[0.06] font-medium active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.45)] active:bg-black/25"
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab 与翻页组间距: 28px */}
        <div className="w-[28px] flex-shrink-0" />

        {/* 翻页按钮组 (Carousel navigation: 108px × 49px, 包含两个 49×49 圆形按键, 间距 10px) */}
        <div className="w-[108px] h-[49px] flex-shrink-0 flex items-center gap-[10px]">
          <button
            type="button"
            onClick={handlePrevInstance}
            disabled={!hasPrev}
            title="切换到上一个实例"
            className={cn(
              "w-[49px] h-[49px] rounded-full flex items-center justify-center border select-none transition-[background-color,box-shadow,color] duration-150 outline-none disabled:opacity-30 disabled:pointer-events-none",
              isLight
                ? "bg-black/[0.05] hover:bg-black/[0.10] text-[#1a1625]/80 border-black/[0.06] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.20),inset_0_1px_2px_rgba(0,0,0,0.12)] active:bg-black/[0.14]"
                : isDynamic
                ? "bg-white/[0.10] hover:bg-white/[0.18] text-white/90 border-white/10 backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
                : "bg-white/[0.08] hover:bg-white/[0.15] text-white/90 border-white/[0.08] backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
            )}
          >
            <ChevronLeft className="w-[22px] h-[22px]" />
          </button>
          <button
            type="button"
            onClick={handleNextInstance}
            disabled={!hasNext}
            title="切换到下一个实例"
            className={cn(
              "w-[49px] h-[49px] rounded-full flex items-center justify-center border select-none transition-[background-color,box-shadow,color] duration-150 outline-none disabled:opacity-30 disabled:pointer-events-none",
              isLight
                ? "bg-black/[0.05] hover:bg-black/[0.10] text-[#1a1625]/80 border-black/[0.06] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.20),inset_0_1px_2px_rgba(0,0,0,0.12)] active:bg-black/[0.14]"
                : isDynamic
                ? "bg-white/[0.10] hover:bg-white/[0.18] text-white/90 border-white/10 backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
                : "bg-white/[0.08] hover:bg-white/[0.15] text-white/90 border-white/[0.08] backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
            )}
          >
            <ChevronRight className="w-[22px] h-[22px]" />
          </button>
        </div>

        {/* 翻页组与关闭按键间距: 18px */}
        <div className="w-[18px] flex-shrink-0" />

        {/* 关闭按钮 (Account controls: 49px × 49px 圆形按键) */}
        <button
          type="button"
          onClick={onClose}
          title="关闭管理面板"
          className={cn(
            "w-[49px] h-[49px] rounded-full flex items-center justify-center border select-none transition-[background-color,box-shadow,color] duration-150 outline-none flex-shrink-0",
            isLight
              ? "bg-black/[0.06] hover:bg-black/[0.12] text-[#1a1625]/80 border-black/[0.06] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.20),inset_0_1px_2px_rgba(0,0,0,0.12)] active:bg-black/[0.14]"
              : isDynamic
              ? "bg-white/[0.12] hover:bg-white/[0.22] text-white border-white/10 backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
              : "bg-[#aaa9a6]/25 hover:bg-[#aaa9a6]/35 text-white/90 border-white/[0.08] backdrop-blur-md active:shadow-[inset_0_2px_5px_rgba(0,0,0,0.55),inset_0_1px_2px_rgba(0,0,0,0.35)] active:bg-black/40"
          )}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 主体两列分屏 (Movie content: 1200px × 560px, 列间距 28px) */}
      <div className="flex gap-[28px] w-full h-[560px] min-h-0 flex-shrink-0">
        {/* 左侧实例边栏 (Viewing sidebar: 280px × 560px, rounded-[30px], 内 padding 左右 28px, 上 27px, 下 27px) */}
        <aside
          className={cn(
            "w-[280px] h-[560px] flex-shrink-0 flex flex-col min-h-0 rounded-[30px] pt-[27px] px-[28px] pb-[27px] overflow-hidden transition-colors border",
            isLight
              ? "bg-black/[0.025] border-black/[0.05]"
              : isDynamic
              ? "bg-white/[0.035] border-white/10 backdrop-blur-xl"
              : "bg-white/[0.025] border-white/[0.06] backdrop-blur-xl"
          )}
        >
          {/* 卡片容器：彻底无痕纯净滚动，禁止横向溢出，不占任何像素挤压 */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-[14px] select-none">
            {filteredManageInstances.map((item) => {
              const selected = item.id === mp.id;
              return (
                <div
                  key={item.id}
                  onClick={() => onSelectInstance(item)}
                  className={cn(
                    "relative w-full rounded-[16px] overflow-hidden cursor-pointer select-none flex-shrink-0",
                    selected
                      ? "h-[224px] shadow-[0_12px_32px_rgba(0,0,0,0.40)]"
                      : "h-[152px] opacity-90 hover:opacity-100 shadow-none"
                  )}
                  style={{
                    transition: "height 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease",
                  }}
                >
                  {/* 封面全铺背景：无边框裁剪 */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[16px]">
                    <img
                      src={item.cover || "./tavern-logo.png"}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{
                        background: isLight
                          ? "rgba(255, 255, 255, 0.15)"
                          : "rgba(0, 0, 0, 0.20)",
                      }}
                    />
                  </div>

                  {/* 顶部左上角版本标签与密码锁 */}
                  <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 pointer-events-none">
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-[6px] text-[10px] font-semibold tracking-wide backdrop-blur-md",
                        isLight
                          ? "bg-white/70 text-[#1a1625]/85 border border-black/10 shadow-xs"
                          : isDynamic
                          ? "bg-black/45 text-white/90 border border-white/15 shadow-xs"
                          : "bg-black/55 text-white/90 border border-white/10 shadow-xs"
                      )}
                    >
                      {formatDisplayVersion(item.version)}
                    </span>
                    {item.hasPassword && (
                      <span
                        title="已设置访问密码"
                        className={cn(
                          "px-1.5 py-0.5 rounded-[6px] text-[10px] font-semibold tracking-wide inline-flex items-center gap-1 backdrop-blur-md",
                          isLight
                            ? "bg-white/70 text-[#1a1625]/85 border border-black/10 shadow-xs"
                            : "bg-black/50 text-white/90 border border-white/15 shadow-xs"
                        )}
                      >
                        <Lock className="w-2.5 h-2.5" />
                        <span>锁定</span>
                      </span>
                    )}
                  </div>

                  {/* 底部透明遮罩抽屉 (Trailer details: 收起态 52px, 展开态 124px, 严格 1:1 复刻 Figma 材质与排版) */}
                  <div
                    className={cn(
                      "absolute left-0 right-0 bottom-0 z-20 overflow-hidden rounded-b-[16px] backdrop-blur-[20px] backdrop-saturate-150 transition-[height] duration-280",
                      selected ? "h-[124px]" : "h-[52px]",
                      isLight
                        ? "bg-white/65 text-[#1a1625]"
                        : isDynamic
                        ? "bg-[#181222]/45 text-white"
                        : "bg-[#0d0d12]/60 text-white"
                    )}
                    style={{
                      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                    }}
                  >
                    {/* 首行 (固定在 52px 高度区域，标题 + 26px 圆形图标) */}
                    <div className="h-[52px] flex items-center justify-between px-[14px]">
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="text-sm font-medium leading-tight truncate">
                          {item.subtitle || item.name}
                        </div>
                      </div>

                      {/* 26px × 26px 圆形高斯模糊图标胶囊 (严格按照 Figma 规范: 本地显示 Folder, 远程显示 Globe) */}
                      <div
                        className={cn(
                          "w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 backdrop-blur-md shadow-xs transition-colors",
                          isLight
                            ? "bg-black/[0.08] border border-black/15 text-[#1a1625]"
                            : isDynamic
                            ? "bg-white/25 border border-white/40 text-white"
                            : "bg-white/20 border border-white/30 text-white"
                        )}
                        title={item.type === "local" ? "本地实例" : "远程实例"}
                      >
                        {item.type === "local" ? (
                          <Folder className="w-[13px] h-[13px]" />
                        ) : (
                          <Globe className="w-[13px] h-[13px]" />
                        )}
                      </div>
                    </div>

                    {/* 展开态详细信息区 (边角自洽填充 3 行统计信息: 创建时间、上次使用、累计使用) */}
                    <div
                      className="px-[14px] pb-3 space-y-1 select-none transition-opacity duration-280"
                      style={{
                        opacity: selected ? 1 : 0,
                        pointerEvents: selected ? "auto" : "none",
                        transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
                      }}
                    >
                      <div className="flex items-center justify-between text-[11px] leading-[18px]">
                        <span className={cn(isLight ? "text-[#1a1625]/45" : "text-white/45")}>
                          创建时间
                        </span>
                        <span className={cn("font-medium tabular-nums", isLight ? "text-[#1a1625]/80" : "text-white/85")}>
                          {item.createdAt || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] leading-[18px]">
                        <span className={cn(isLight ? "text-[#1a1625]/45" : "text-white/45")}>
                          上次使用
                        </span>
                        <span className={cn("font-medium tabular-nums", isLight ? "text-[#1a1625]/80" : "text-white/85")}>
                          {item.lastUsed || "—"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] leading-[18px]">
                        <span className={cn(isLight ? "text-[#1a1625]/45" : "text-white/45")}>
                          累计使用
                        </span>
                        <span className={cn("font-medium tabular-nums", isLight ? "text-[#1a1625]/80" : "text-white/85")}>
                          {item.totalUsage || "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
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
        </aside>

        {/* 右侧主设置面板 (Discover movies: 892px × 560px, rounded-[30px], 与左侧栏 280px + 间距 28px = 1200px 严格对齐) */}
        <section
          className={cn(
            "flex min-h-0 min-w-0 w-[892px] h-[560px] flex-shrink-0 flex-col rounded-[30px] overflow-hidden transition-all border shadow-2xl",
            isLight
              ? "bg-white/60 border-black/10 text-[#1a1625] backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.8),0_16px_40px_rgba(0,0,0,0.06)]"
              : isDynamic
              ? "bg-[#181324]/35 border-white/10 text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_16px_40px_rgba(0,0,0,0.40)]"
              : "bg-[#121216]/50 border-white/[0.08] text-white backdrop-blur-2xl shadow-[inset_0_1px_1px_rgba(255,255,255,0.04),0_16px_40px_rgba(0,0,0,0.50)]"
          )}
        >
          {/* Tab 内容区：彻底隐藏滚动条，无痕平滑滚动，留足呼吸边距 */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-8 pt-5 pb-6">
            <div className="w-full">
              {/* 启动与配置 */}
              <div
                className={cn(
                  "w-full transition-all duration-300",
                  manageTab === "launch"
                    ? "block opacity-100"
                    : "hidden opacity-0"
                )}
                aria-hidden={manageTab !== "launch"}
              >
                <>
                  {mp.type === "local" ? (
                    <>
                      <ManageItem
                        label="启动端口"
                        desc="宿主 WebView 和本地服务都会使用这个端口"
                        isLight={isLight}
                      >
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          value={draftPort}
                          onChange={(e) => {
                            setDraftPort(parseInt(e.target.value) || 8000);
                          }}
                          className={cn(
                            "w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                              : "bg-white/[0.04] border-white/[0.08] text-white"
                          )}
                        />
                      </ManageItem>
                      <ManageItem
                        label="允许外部监听"
                        desc="Android 宿主默认建议关闭，只在明确需要局域网访问时开启"
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                        isLight={isLight}
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
                          className={cn(
                            "w-20 h-7 px-2 rounded-lg text-xs text-center border focus:outline-none focus:ring-0 transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                              : "bg-white/[0.04] border-white/[0.08] text-white"
                          )}
                        />
                      </ManageItem>
                      <ManageItem
                        label="启用 HTTP Keep-Alive"
                        desc="网络波动大时可临时关闭"
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                        isLight={isLight}
                      >
                        <ToggleSwitch
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
                          <div className="pt-3 space-y-2">
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
                              className={cn(
                                "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
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
                              className={cn(
                                "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
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
                    isLight={isLight}
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
                            "motion-control text-[10px] font-medium px-2 py-0.5 rounded-md border transition-colors",
                            isLight
                              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                              : "bg-white/[0.06] border-white/[0.08] text-white/60 hover:text-white"
                          )}
                        >
                          修改密码
                        </button>
                      )}
                      <ToggleSwitch
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
                      <div className="pt-3 space-y-2">
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
                                className={cn(
                                  "w-full h-8 px-3 rounded-xl border text-xs focus:outline-none focus:ring-0 transition-colors",
                                  isLight
                                    ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                    : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                                )}
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
                              className={cn(
                                "w-full h-8 px-3 rounded-xl border text-xs focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
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
                              className={cn(
                                "w-full h-8 px-3 rounded-xl border text-xs focus:outline-none focus:ring-0 transition-colors",
                                isLight
                                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                              )}
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
                            className={cn(
                              "w-full h-8 px-3 rounded-xl border text-xs focus:outline-none focus:ring-0 transition-colors",
                              isLight
                                ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                                : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                            )}
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
                              "motion-control h-7 px-3 rounded-lg text-xs font-medium border transition-colors",
                              isLight
                                ? "border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                                : "border-white/[0.08] text-white/60 hover:text-white"
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
                              "motion-control h-7 px-3.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40",
                              passwordMode === "clear"
                                ? "bg-red-500/10 text-red-500/70 border border-red-500/20 hover:text-red-500"
                                : isLight
                                  ? "bg-black text-white/80 hover:text-white"
                                  : "bg-white text-[#111114]/80 hover:text-[#111114]"
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
              </div>

              {/* 存储 */}
              <div
                className={cn(
                  "w-full space-y-4 transition-all duration-300",
                  manageTab === "storage"
                    ? "block opacity-100"
                    : "hidden opacity-0"
                )}
                aria-hidden={manageTab !== "storage"}
              >
                <div className="space-y-4">
                  <div
                    className={cn(
                      "rounded-xl px-4",
                      isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                    )}
                  >
                    <ManageDetailRow
                      label={mp.type === "local" ? "实例位置" : "连接地址"}
                      value={effectiveInstancePath}
                      isLight={isLight}
                      mono
                    />
                    <ManageDetailRow
                      label="占用空间"
                      value={
                        mp.type === "local" &&
                        (aboutInfo?.sizeBytes !== undefined || localAboutInfo?.sizeBytes !== undefined)
                          ? `${(((aboutInfo?.sizeBytes ?? localAboutInfo?.sizeBytes ?? 0)) / 1024 / 1024).toFixed(
                              1
                            )} MB`
                          : "—"
                      }
                      isLight={isLight}
                    />
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-between gap-4 rounded-xl px-4 py-3",
                      isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                    )}
                  >
                    <div className="min-w-0">
                      <div
                        className={cn(
                          "text-xs font-medium",
                          isLight ? "text-[#1a1625]/70" : "text-white/70"
                        )}
                      >
                        实例插图
                      </div>
                      <div
                        className={cn(
                          "mt-1 truncate text-[10px]",
                          isLight ? "text-[#1a1625]/30" : "text-white/30"
                        )}
                      >
                        {mp.cover ? "已使用自定义插图" : "使用默认插图"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onPickCover(mp)}
                      className={cn(
                        "motion-control h-8 rounded-xl px-3 text-[11px] font-medium transition-colors",
                        isLight
                          ? "bg-black/[0.06] text-[#1a1625]/60 hover:text-[#1a1625]"
                          : "bg-white/[0.07] text-white/60 hover:text-white"
                      )}
                    >
                      更换插图
                    </button>
                  </div>
                  {mp.type === "local" && onOpenRelocate && (
                    <div
                      className={cn(
                        "flex items-center justify-between gap-4 rounded-xl px-4 py-3",
                        isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                      )}
                    >
                      <div className="min-w-0">
                        <div
                          className={cn(
                            "text-xs font-medium",
                            isLight ? "text-[#1a1625]/70" : "text-white/70"
                          )}
                        >
                          存储迁移
                        </div>
                        <div
                          className={cn(
                            "mt-1 truncate text-[10px]",
                            isLight ? "text-[#1a1625]/30" : "text-white/30"
                          )}
                        >
                          无损搬迁至新目录或软件默认路径
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onOpenRelocate(mp)}
                        className={cn(
                          "motion-control h-8 rounded-xl px-3 text-[11px] font-medium transition-colors",
                          isLight
                            ? "bg-black/[0.06] text-[#1a1625]/60 hover:text-[#1a1625]"
                            : "bg-white/[0.07] text-white/60 hover:text-white"
                        )}
                      >
                        迁移目录
                      </button>
                    </div>
                  )}
                  {mp.type === "local" && onOpenMaintenance && (
                    <ManageItem label="实例维护" isLight={isLight}>
                      <button type="button" onClick={() => onOpenMaintenance(mp)}
                        className={cn(
                          "motion-control h-8 rounded-xl px-3 text-[11px] font-medium transition-colors",
                          isLight
                            ? "bg-black/[0.06] text-[#1a1625]/60 hover:text-[#1a1625]"
                            : "bg-white/[0.07] text-white/60 hover:text-white"
                        )}>
                        扫描
                      </button>
                    </ManageItem>
                  )}

                </div>
              </div>

              {/* 终端 */}
              <div
                className={cn(
                  "w-full transition-all duration-300",
                  manageTab === "terminal"
                    ? "block opacity-100"
                    : "hidden opacity-0"
                )}
                aria-hidden={manageTab !== "terminal"}
              >
                {mp.type === "remote" ? (
                  <div
                    className={cn(
                      "rounded-xl px-4 py-8 text-center text-xs",
                      isLight
                        ? "bg-black/[0.025] text-[#1a1625]/35"
                        : "bg-white/[0.025] text-white/35"
                    )}
                  >
                    远程实例不支持本地终端
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex h-full min-h-[300px] flex-col overflow-hidden rounded-xl border transition-colors",
                      isLight
                        ? "bg-black/[0.03] border-black/[0.06] text-[#1a1625]"
                        : isDynamic
                        ? "bg-[#100c18]/45 border-white/[0.08] backdrop-blur-md text-[#d7d5df]"
                        : "bg-[#101016]/60 border-white/[0.06] backdrop-blur-md text-[#d7d5df]"
                    )}
                  >
                    <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-white/[0.055] px-4">
                      <span className="text-[10px] font-medium text-white/40">
                        {mp.subtitle || mp.name} · 实例终端
                      </span>
                      <button
                        type="button"
                        onClick={() => setTerminalLogs([])}
                        className="motion-control p-1.5 text-white/30 hover:text-white/55"
                        title="清空终端"
                      >
                        <Eraser className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div data-native-log-list className="min-h-0 flex-1 overflow-y-auto p-4 font-sans text-[11.5px] leading-relaxed [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                      {terminalLogs.map((log, index) => (
                        <div
                          key={index}
                          className={cn(
                            "mb-0.5 whitespace-pre-wrap break-all",
                            log.level === "error"
                              ? "text-red-300/85"
                              : log.level === "success"
                              ? "text-white/85"
                              : "text-white/60"
                          )}
                        >
                          {log.msg}
                        </div>
                      ))}
                      <div className="mt-1 flex gap-2">
                        <span className="select-none text-white/35">
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
                          className="min-w-0 flex-1 border-none bg-transparent text-white/75 outline-none placeholder:text-white/20"
                          placeholder={terminalPlaceholder}
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 关于 */}
              <div
                className={cn(
                  "w-full space-y-4 transition-all duration-300",
                  manageTab === "about"
                    ? "block opacity-100"
                    : "hidden opacity-0"
                )}
                aria-hidden={manageTab !== "about"}
              >
                <div
                  className={cn(
                    "rounded-xl px-4",
                    isLight ? "bg-black/[0.025]" : "bg-white/[0.025]"
                  )}
                >
                  <ManageDetailRow
                    label="实例名称"
                    value={mp.subtitle || mp.name}
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label={mp.type === "local" ? "实例位置" : "连接地址"}
                    value={effectiveInstancePath}
                    isLight={isLight}
                    mono
                  />
                  <ManageDetailRow
                    label="版本"
                    value={
                      formatDisplayVersion(
                        mp.type === "local" &&
                        ((aboutInfo?.version && aboutInfo.version !== "unknown") ||
                         (localAboutInfo?.version && localAboutInfo.version !== "unknown"))
                          ? (aboutInfo?.version && aboutInfo.version !== "unknown" ? aboutInfo.version : localAboutInfo?.version)
                          : mp.version
                      )
                    }
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="类型"
                    value={mp.type === "local" ? "本地实例" : "远程实例"}
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="状态"
                    value={
                      mp.type === "local"
                        ? aboutInfo?.status || localAboutInfo?.status || getStatusText(mp.status)
                        : getStatusText(mp.status)
                    }
                    isLight={isLight}
                  />
                  <ManageDetailRow
                    label="创建时间"
                    value={
                      mp.type === "local" && (aboutInfo?.createdAt || localAboutInfo?.createdAt)
                        ? (aboutInfo?.createdAt || localAboutInfo?.createdAt)
                        : mp.createdAt || "—"
                    }
                    isLight={isLight}
                  />
                  {mp.type === "remote" && (
                    <ManageDetailRow
                      label="Basic Auth"
                      value={mp.basicAuth?.username || "未配置"}
                      isLight={isLight}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 右侧面板底部操作栏 */}
          <div
            className={cn(
              "relative flex flex-shrink-0 items-center justify-between border-t px-8 h-[52px]",
              isLight
                ? "border-black/[0.06] bg-black/[0.015]"
                : isDynamic
                ? "border-white/[0.08] bg-white/[0.02]"
                : "border-white/[0.06] bg-white/[0.015]"
            )}
          >
            <div className="min-w-0 flex-1 pr-3">
              {manageSaveError && (
                <span
                  className={cn(
                    "text-[11px] leading-snug",
                    isLight ? "text-red-900/65" : "text-red-300/75"
                  )}
                >
                  {manageSaveError}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
              {manageTab === "launch" && (
                <button
                  disabled={isSavingManagePanel}
                  onClick={onSaveManagedInstance}
                  className={cn(
                    "motion-control h-8 rounded-xl px-4 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                    isLight
                      ? "bg-black/[0.06] text-[#1a1625]/70 hover:text-[#1a1625]"
                      : isDynamic
                      ? "bg-white/[0.12] text-white/80 hover:text-white"
                      : "bg-white/[0.08] text-white/80 hover:text-white"
                  )}
                >
                  {isSavingManagePanel ? "保存中..." : "保存"}
                </button>
              )}
              <button
                type="button"
                disabled={Boolean(launchingId)}
                onClick={() => {
                  onClose();
                  onLaunchInstance(mp);
                }}
                className={cn(
                  "motion-control flex h-8 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 shadow-sm",
                  isLight
                    ? "bg-[#1a1625] text-white hover:bg-[#1a1625]/90"
                    : "bg-white text-[#111114] hover:bg-white/90"
                )}
              >
                <Play className="h-3 w-3 fill-current" />
                {launchingId === mp.id ? "启动中" : "启动"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
