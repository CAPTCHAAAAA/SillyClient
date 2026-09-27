import React, { useRef, useEffect, useState } from "react";
import { X, ChevronDown, AlertTriangle, LoaderCircle, Info } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ToggleSwitch } from "../common/ToggleSwitch";

export type WizardMode = "local" | "remote" | "import";

export interface DiscoveredTavern {
  name: string;
  version: string;
  path: string;
}

export interface NewInstanceWizardModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  newInstanceName: string;
  setNewInstanceName: (v: string) => void;
  newInstanceMode: WizardMode;
  switchInstanceMode: (mode: WizardMode) => void;
  newInstanceDir: string;
  setNewInstanceDir: (v: string) => void;
  newInstanceVersion: string;
  setNewInstanceVersion: (v: string) => void;
  newInstanceLocalZip: string | null;
  setNewInstanceLocalZip: (v: string | null) => void;
  newInstanceCompanionPresetEnabled: boolean;
  setNewInstanceCompanionPresetEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  newInstanceUrl: string;
  setNewInstanceUrl: (v: string) => void;
  newRemoteAuthEnabled: boolean;
  setNewRemoteAuthEnabled: (v: boolean) => void;
  newRemoteAuthUsername: string;
  setNewRemoteAuthUsername: (v: string) => void;
  newRemoteAuthPassword: string;
  setNewRemoteAuthPassword: (v: string) => void;
  // 数据迁移配置
  migrationAccessMode?: "copy" | "takeover";
  setMigrationAccessMode?: (m: "copy" | "takeover") => void;
  migrationSourcePath?: string;
  setMigrationSourcePath?: (p: string) => void;
  migrationIncludeSecrets?: boolean;
  setMigrationIncludeSecrets?: (inc: boolean) => void;
  migrationCustomDest?: string;
  setMigrationCustomDest?: (dest: string) => void;
  discoveredTaverns?: DiscoveredTavern[];
  isScanningTaverns?: boolean;
  onScanTaverns?: () => void;
  onPickSourceFolder?: () => void;
  onPickSourceZip?: () => void;
  migrationPreflight?: {
    version?: string;
    nativePlugins?: string[];
  } | null;
  newInstanceError: string | null;
  isCreatingInstance: boolean;
  createInstance: () => void;
  releases: any[];
  setReleases: (r: any[]) => void;
  fetchingReleases: boolean;
  setFetchingReleases: (v: boolean) => void;
  verDropdownOpen: boolean;
  isVerDropdownClosing: boolean;
  openVersionDropdown: (trigger: HTMLElement) => void;
  closeVersionDropdown: () => void;
  addTerminalLog: (msg: string, level?: string) => void;
}

interface InfoBadgeButtonProps {
  isOpen: boolean;
  onToggle: () => void;
  hasBeenRead?: boolean;
  isLight: boolean;
  title?: string;
  readTitle?: string;
}

function InfoBadgeButton({
  isOpen,
  onToggle,
  hasBeenRead = false,
  isLight,
  title,
  readTitle,
}: InfoBadgeButtonProps) {
  const isUnread = !hasBeenRead && !isOpen;

  return (
    <button
      type="button"
      onClick={onToggle}
      title={
        isOpen
          ? "收起说明"
          : isUnread
          ? title || "重要提示：点击查看说明"
          : readTitle || "点击查看说明"
      }
      className={cn(
        "motion-control relative w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300",
        isUnread
          ? isLight
            ? "bg-rose-500/10 border border-rose-500/40 text-rose-600 hover:bg-rose-500/20 shadow-[0_0_8px_rgba(244,63,94,0.22)]"
            : "bg-rose-500/15 border border-rose-500/40 text-rose-400 hover:bg-rose-500/25 shadow-[0_0_8px_rgba(244,63,94,0.30)]"
          : isOpen
          ? isLight
            ? "bg-black/10 text-[#1a1625]"
            : "bg-white/15 text-white"
          : isLight
          ? "text-[#1a1625]/30 hover:text-[#1a1625]/70 hover:bg-black/5"
          : "text-white/30 hover:text-white/70 hover:bg-white/5"
      )}
    >
      {isUnread ? (
        <span
          className={cn(
            "text-[10px] font-bold font-mono leading-none select-none",
            isLight ? "text-rose-600" : "text-rose-400"
          )}
        >
          !
        </span>
      ) : (
        <Info className="w-2.5 h-2.5" />
      )}
    </button>
  );
}

function NewInstanceField({
  label,
  desc,
  info,
  unreadAlert = false,
  rightAction,
  isLight,
  children,
}: {
  label: string;
  desc?: string;
  info?: string | React.ReactNode;
  unreadAlert?: boolean;
  rightAction?: React.ReactNode;
  isLight: boolean;
  children: React.ReactNode;
}) {
  const [showInfo, setShowInfo] = useState(false);
  const [hasBeenRead, setHasBeenRead] = useState(false);

  const handleToggle = () => {
    if (!hasBeenRead) setHasBeenRead(true);
    setShowInfo(!showInfo);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "text-xs font-medium",
              isLight ? "text-[#1a1625]/70" : "text-white/70"
            )}
          >
            {label}
          </span>
          {info && (
            <InfoBadgeButton
              isOpen={showInfo}
              onToggle={handleToggle}
              hasBeenRead={unreadAlert ? hasBeenRead : true}
              isLight={isLight}
            />
          )}
        </div>
        {rightAction}
      </div>

      {desc && !info && (
        <div
          className={cn(
            "text-[10px] mb-2",
            isLight ? "text-[#1a1625]/30" : "text-white/30"
          )}
        >
          {desc}
        </div>
      )}

      {info && (
        <div
          className={cn("motion-accordion", showInfo && "is-open")}
          aria-hidden={!showInfo}
        >
          <div className="motion-accordion-inner">
            <div
              className={cn(
                "mb-2.5 p-2.5 rounded-xl border text-[11px] leading-relaxed",
                isLight
                  ? "bg-black/[0.03] border-black/[0.06] text-[#1a1625]/65"
                  : "bg-white/[0.03] border-white/[0.06] text-white/65"
              )}
            >
              {info}
            </div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}

/**
 * 新建实例向导模态框 (NewInstanceWizardModal)
 * 1. 严格绝对居中；
 * 2. 本地模式与远程模式同位驻留 DOM，实现“白天黑夜级”平滑自适应高度跟随与交叉溶变过渡；
 * 3. 输入框聚焦彻底扁平无光，无任何绿色光圈。
 */
export const NewInstanceWizardModal: React.FC<NewInstanceWizardModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isWindows,
  newInstanceName,
  setNewInstanceName,
  newInstanceMode,
  switchInstanceMode,
  newInstanceDir,
  setNewInstanceDir,
  newInstanceVersion,
  setNewInstanceLocalZip,
  newInstanceLocalZip,
  setNewInstanceVersion,
  newInstanceCompanionPresetEnabled,
  setNewInstanceCompanionPresetEnabled,
  newInstanceUrl,
  setNewInstanceUrl,
  newRemoteAuthEnabled,
  setNewRemoteAuthEnabled,
  newRemoteAuthUsername,
  setNewRemoteAuthUsername,
  newRemoteAuthPassword,
  setNewRemoteAuthPassword,
  migrationAccessMode = "copy",
  setMigrationAccessMode = () => {},
  migrationSourcePath = "",
  setMigrationSourcePath = () => {},
  migrationIncludeSecrets = false,
  setMigrationIncludeSecrets = () => {},
  migrationCustomDest = "",
  setMigrationCustomDest = () => {},
  discoveredTaverns = [],
  isScanningTaverns = false,
  onScanTaverns = () => {},
  onPickSourceFolder = () => {},
  onPickSourceZip = () => {},
  migrationPreflight = null,
  newInstanceError,
  isCreatingInstance,
  createInstance,
  releases,
  setReleases,
  fetchingReleases,
  setFetchingReleases,
  verDropdownOpen,
  isVerDropdownClosing,
  openVersionDropdown,
  closeVersionDropdown,
  addTerminalLog,
}) => {
  const wizardLocalRef = useRef<HTMLDivElement>(null);
  const wizardRemoteRef = useRef<HTMLDivElement>(null);
  const wizardImportRef = useRef<HTMLDivElement>(null);
  const [wizardHeight, setWizardHeight] = useState<number | null>(null);
  const [showPreflightInfo, setShowPreflightInfo] = useState(false);
  const [hasReadPreflight, setHasReadPreflight] = useState(false);
  const [showSecretsInfo, setShowSecretsInfo] = useState(false);
  const [hasReadSecrets, setHasReadSecrets] = useState(false);

  // 动态测量激活模式的高度以实现白天黑夜级平滑伸缩
  useEffect(() => {
    const targetEl =
      newInstanceMode === "local"
        ? wizardLocalRef.current
        : newInstanceMode === "remote"
        ? wizardRemoteRef.current
        : wizardImportRef.current;
    if (!targetEl) return;

    const updateHeight = () => {
      if (targetEl) {
        const h = targetEl.getBoundingClientRect().height;
        if (h > 0) setWizardHeight(Math.round(h));
      }
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        updateHeight();
      });
      ro.observe(targetEl);
      return () => ro.disconnect();
    }
  }, [
    newInstanceMode,
    newInstanceCompanionPresetEnabled,
    newRemoteAuthEnabled,
    migrationAccessMode,
    migrationSourcePath,
    discoveredTaverns,
    migrationPreflight,
    showPreflightInfo,
    hasReadPreflight,
    showSecretsInfo,
    hasReadSecrets,
    isOpen,
  ]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-task-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(460px, calc(100vw - 2rem))",
        maxHeight: "min(85vh, calc(100vh - 4rem))",
      }}
    >
      {/* 头部 */}
      <div
        className={cn(
          "flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            isLight ? "text-[#1a1625]" : "text-white"
          )}
        >
          新建实例
        </span>
        <button
          disabled={isCreatingInstance}
          onClick={() => {
            closeVersionDropdown();
            onClose();
          }}
          className={cn(
            "motion-control p-1.5 rounded-lg transition-colors disabled:pointer-events-none disabled:opacity-30",
            isLight
              ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
              : "hover:bg-white/5 text-white/30 hover:text-white/60"
          )}
        >
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
                ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
            )}
          />
        </NewInstanceField>

        {/* 实例模式 */}
        <div>
          <div
            className={cn(
              "text-xs font-medium mb-2",
              isLight ? "text-[#1a1625]/70" : "text-white/70"
            )}
          >
            实例模式
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => switchInstanceMode("local")}
              aria-pressed={newInstanceMode === "local"}
              className={cn(
                "ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                newInstanceMode === "local"
                  ? isLight
                    ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]"
                    : "bg-white/10 border-white/15 text-white"
                  : isLight
                  ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:border-black/12 hover:text-[#1a1625]/55"
                  : "bg-transparent border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/55"
              )}
            >
              本地实例
            </button>
            <button
              onClick={() => switchInstanceMode("remote")}
              aria-pressed={newInstanceMode === "remote"}
              className={cn(
                "ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                newInstanceMode === "remote"
                  ? isLight
                    ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]"
                    : "bg-white/10 border-white/15 text-white"
                  : isLight
                  ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:border-black/12 hover:text-[#1a1625]/55"
                  : "bg-transparent border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/55"
              )}
            >
              远程连接
            </button>
            <button
              onClick={() => switchInstanceMode("import")}
              aria-pressed={newInstanceMode === "import"}
              className={cn(
                "ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                newInstanceMode === "import"
                  ? isLight
                    ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]"
                    : "bg-white/10 border-white/15 text-white"
                  : isLight
                  ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:border-black/12 hover:text-[#1a1625]/55"
                  : "bg-transparent border-white/[0.06] text-white/35 hover:border-white/12 hover:text-white/55"
              )}
            >
              数据迁移
            </button>
          </div>
        </div>

        {/* 模式配置切换容器（平滑高度过渡 + 白天黑夜级优雅溶变） */}
        <div
          className="relative transition-[height] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
          style={{ height: wizardHeight ? `${wizardHeight}px` : undefined }}
        >
          {/* 本地模式配置 */}
          <div
            ref={wizardLocalRef}
            className={cn(
              "w-full space-y-5 transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
              newInstanceMode === "local"
                ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto"
                : "absolute inset-x-0 top-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none"
            )}
            aria-hidden={newInstanceMode !== "local"}
          >
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
                      ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                      : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                  )}
                />
                <button
                  onClick={async () => {
                    try {
                      const { name, path } = await TarvenEnv.pickDirectory();
                      setNewInstanceDir(isWindows ? path : name);
                    } catch {
                      /* 取消 */
                    }
                  }}
                  className={cn(
                    "motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0",
                    isLight
                      ? "border-black/[0.08] text-[#1a1625]/50 hover:bg-black/[0.04]"
                      : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                  )}
                >
                  浏览
                </button>
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
                      if (releases.length === 0 && !fetchingReleases) {
                        setFetchingReleases(true);
                        try {
                          const { releases: r } = await TarvenEnv.fetchReleases();
                          setReleases(r);
                        } catch {
                          /* 网络失败,保留默认选项 */
                        }
                        setFetchingReleases(false);
                      }
                      const trigger = document.getElementById("ver-trigger");
                      if (trigger) {
                        openVersionDropdown(trigger);
                      }
                    }
                  }}
                  className={cn(
                    "ios-field-control motion-control flex-1 min-w-0 h-9 px-3 rounded-xl border text-sm text-left flex items-center justify-between transition-colors",
                    isLight
                      ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]"
                      : "bg-white/[0.04] border-white/[0.08] text-white"
                  )}
                >
                  <span className="truncate">
                    {fetchingReleases
                      ? "获取版本中"
                      : newInstanceLocalZip
                      ? "本地 ZIP"
                      : newInstanceVersion === "stable"
                      ? "内置版"
                      : newInstanceVersion}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 flex-shrink-0 opacity-40 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      verDropdownOpen && !isVerDropdownClosing && "rotate-180"
                    )}
                  />
                </button>
                <button
                  onClick={async () => {
                    try {
                      const { path, sizeBytes } = await TarvenEnv.pickZipFile();
                      setNewInstanceLocalZip(path);
                      setNewInstanceVersion("local");
                      addTerminalLog(
                        `> 已选择本地文件 (${(sizeBytes / 1048576).toFixed(1)}MB)`,
                        "info"
                      );
                    } catch {
                      /* 取消 */
                    }
                  }}
                  className={cn(
                    "motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0",
                    isLight
                      ? "border-black/[0.08] text-[#1a1625]/50 hover:bg-black/[0.04]"
                      : "border-white/[0.08] text-white/50 hover:bg-white/[0.04]"
                  )}
                >
                  {newInstanceLocalZip ? "更换" : "导入 ZIP"}
                </button>
              </div>
            </NewInstanceField>

            <section
              className={cn("companion-preset", isLight && "is-light")}
              data-enabled={newInstanceCompanionPresetEnabled}
            >
              <div className="companion-preset__label">主题预设</div>
              <div className="companion-preset__row">
                <div className="companion-preset__thumb" aria-hidden="true">
                  <img
                    src="./assets/companion-presets/sc-bordeaux/sillyclient-bg-preview.jpg"
                    alt=""
                    width="112"
                    height="70"
                    decoding="async"
                  />
                </div>
                <div className="companion-preset__copy">
                  <span className="companion-preset__name">SC Bordeaux</span>
                  <span className="companion-preset__summary">
                    实例安装完成后自动应用
                  </span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-label="使用 SC Bordeaux 主题预设"
                  aria-checked={newInstanceCompanionPresetEnabled}
                  onClick={() =>
                    setNewInstanceCompanionPresetEnabled((value) => !value)
                  }
                  className="companion-preset__switch motion-control"
                >
                  <span className="companion-preset__knob" />
                </button>
              </div>
              <div
                className="companion-preset__details"
                aria-hidden={!newInstanceCompanionPresetEnabled}
              >
                <div className="companion-preset__details-inner">
                  <div className="companion-preset__details-body">
                    <div className="companion-preset__detail-row">
                      <span>主题</span>
                      <strong>SC Bordeaux</strong>
                    </div>
                    <div className="companion-preset__detail-row">
                      <span>壁纸</span>
                      <strong>7680 × 4320 · JPG</strong>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* 远程模式配置 */}
          <div
            ref={wizardRemoteRef}
            className={cn(
              "w-full space-y-5 transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
              newInstanceMode === "remote"
                ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto"
                : "absolute inset-x-0 top-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none"
            )}
            aria-hidden={newInstanceMode !== "remote"}
          >
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
                    ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                    : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                )}
              />
            </NewInstanceField>

            <div
              className={cn(
                "border-t pt-3",
                isLight ? "border-black/[0.04]" : "border-white/[0.04]"
              )}
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div
                    className={cn(
                      "text-xs font-medium",
                      isLight ? "text-[#1a1625]/70" : "text-white/70"
                    )}
                  >
                    Basic Auth
                  </div>
                  <div
                    className={cn(
                      "mt-0.5 text-[10px]",
                      isLight ? "text-[#1a1625]/35" : "text-white/35"
                    )}
                  >
                    用于受 HTTP 基本认证保护的远程地址
                  </div>
                </div>
                <ToggleSwitch
                  on={newRemoteAuthEnabled}
                  onChange={setNewRemoteAuthEnabled}
                  isLight={isLight}
                />
              </div>

              <div
                className={cn(
                  "motion-accordion",
                  newRemoteAuthEnabled && "is-open"
                )}
                aria-hidden={!newRemoteAuthEnabled}
              >
                <div className="motion-accordion-inner">
                  <div className="pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={newRemoteAuthUsername}
                        onChange={(e) =>
                          setNewRemoteAuthUsername(e.target.value)
                        }
                        placeholder="用户名"
                        autoCapitalize="none"
                        autoCorrect="off"
                        autoComplete="username"
                        disabled={!newRemoteAuthEnabled}
                        className={cn(
                          "h-9 min-w-0 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                          isLight
                            ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                            : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                        )}
                      />
                      <input
                        type="password"
                        value={newRemoteAuthPassword}
                        onChange={(e) =>
                          setNewRemoteAuthPassword(e.target.value)
                        }
                        placeholder="密码"
                        autoComplete="current-password"
                        disabled={!newRemoteAuthEnabled}
                        className={cn(
                          "h-9 min-w-0 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                          isLight
                            ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                            : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                        )}
                      />
                    </div>
                    <p
                      className={cn(
                        "mt-2 text-[10px] leading-relaxed",
                        isLight ? "text-[#1a1625]/35" : "text-white/35"
                      )}
                    >
                      密码由系统安全存储保管，不会写入连接地址。公网连接建议使用
                      HTTPS。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 数据迁移模式配置 */}
          <div
            ref={wizardImportRef}
            className={cn(
              "w-full space-y-4 transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
              newInstanceMode === "import"
                ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto"
                : "absolute inset-x-0 top-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none"
            )}
            aria-hidden={newInstanceMode !== "import"}
          >
            {/* 1. 接入方式 */}
            <NewInstanceField
              label="接入方式"
              unreadAlert={true}
              info={
                <div className="space-y-1">
                  <div>
                    <span className="font-medium text-white/85">复制迁移（推荐）：</span>
                    将旧酒馆数据（聊天、角色、预设、世界书、插件）完整复制到受管存储，原酒馆目录完全保持不变。首次启动由内置 Node 22 自动重建依赖。
                  </div>
                  <div className="pt-1">
                    <span className="font-medium text-white/85">原地接管（高级）：</span>
                    直接指向原酒馆物理目录启动，注册为受管实例，不复制任何文件。移除实例仅解除登记，绝不修改或删除原物理文件。
                  </div>
                </div>
              }
              isLight={isLight}
            >
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMigrationAccessMode("copy")}
                  aria-pressed={migrationAccessMode === "copy"}
                  className={cn(
                    "ios-choice-control motion-control flex-1 h-8 rounded-xl text-xs font-medium border transition-colors duration-300",
                    migrationAccessMode === "copy"
                      ? isLight
                        ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]"
                        : "bg-white/10 border-white/15 text-white"
                      : isLight
                      ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:text-[#1a1625]/55"
                      : "bg-transparent border-white/[0.06] text-white/35 hover:text-white/55"
                  )}
                >
                  复制迁移 (推荐)
                </button>
                <button
                  type="button"
                  onClick={() => setMigrationAccessMode("takeover")}
                  aria-pressed={migrationAccessMode === "takeover"}
                  className={cn(
                    "ios-choice-control motion-control flex-1 h-8 rounded-xl text-xs font-medium border transition-colors duration-300",
                    migrationAccessMode === "takeover"
                      ? isLight
                        ? "bg-[#1a1625]/8 border-[#1a1625]/15 text-[#1a1625]"
                        : "bg-white/10 border-white/15 text-white"
                      : isLight
                      ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:text-[#1a1625]/55"
                      : "bg-transparent border-white/[0.06] text-white/35 hover:text-white/55"
                  )}
                >
                  原地接管 (高级)
                </button>
              </div>
            </NewInstanceField>

            {/* 2. 旧酒馆来源 */}
            <NewInstanceField
              label="旧酒馆来源"
              unreadAlert={true}
              info="支持选择包含 server.js 或 data/ 目录的本地文件夹，或包含旧酒馆备份的 .zip 文件。点击右侧「自动扫描」可快速检索系统常见安装位置的历史酒馆。"
              rightAction={
                <button
                  type="button"
                  disabled={isScanningTaverns}
                  onClick={onScanTaverns}
                  className={cn(
                    "motion-control text-[11px] font-normal transition-colors",
                    isLight
                      ? "text-[#1a1625]/45 hover:text-[#1a1625]/80"
                      : "text-white/45 hover:text-white/80"
                  )}
                >
                  {isScanningTaverns ? "扫描中..." : "自动扫描"}
                </button>
              }
              isLight={isLight}
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={migrationSourcePath}
                    onChange={(e) => setMigrationSourcePath(e.target.value)}
                    placeholder="选择文件夹或 ZIP 文件路径"
                    className={cn(
                      "flex-1 h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
                      isLight
                        ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                        : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
                    )}
                  />
                  <button
                    type="button"
                    onClick={onPickSourceFolder}
                    className={cn(
                      "motion-control px-3 h-9 rounded-xl text-xs font-medium border flex-shrink-0 transition-colors",
                      isLight
                        ? "border-black/[0.08] text-[#1a1625]/60 hover:bg-black/[0.04]"
                        : "border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                    )}
                  >
                    浏览
                  </button>
                  {migrationAccessMode === "copy" && (
                    <button
                      type="button"
                      onClick={onPickSourceZip}
                      className={cn(
                        "motion-control px-3 h-9 rounded-xl text-xs font-medium border flex-shrink-0 transition-colors",
                        isLight
                          ? "border-black/[0.08] text-[#1a1625]/60 hover:bg-black/[0.04]"
                          : "border-white/[0.08] text-white/60 hover:bg-white/[0.04]"
                      )}
                    >
                      ZIP
                    </button>
                  )}
                </div>

                {/* 候选列表 (点击切换) */}
                {discoveredTaverns && discoveredTaverns.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <div
                      className={cn(
                        "text-[10px] px-1",
                        isLight ? "text-[#1a1625]/35" : "text-white/35"
                      )}
                    >
                      已发现 {discoveredTaverns.length} 个候选（点击选用）
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto scrollbar-subtle">
                      {discoveredTaverns.map((t, idx) => {
                        const isSelected = migrationSourcePath === t.path;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setMigrationSourcePath(t.path);
                              if (!newInstanceName.trim()) setNewInstanceName(t.name);
                            }}
                            className={cn(
                              "motion-control w-full text-left px-2.5 py-1.5 rounded-lg border flex items-center justify-between transition-colors",
                              isSelected
                                ? isLight
                                  ? "bg-[#1a1625]/8 border-[#1a1625]/20 text-[#1a1625]"
                                  : "bg-white/10 border-white/20 text-white"
                                : isLight
                                ? "bg-black/[0.02] border-black/[0.05] text-[#1a1625]/70 hover:border-black/10"
                                : "bg-white/[0.02] border-white/[0.05] text-white/70 hover:border-white/10"
                            )}
                          >
                            <div className="truncate mr-2">
                              <span className="text-xs font-medium">{t.name}</span>
                              <span
                                className={cn(
                                  "ml-2 text-[10px] font-mono",
                                  isLight ? "text-[#1a1625]/40" : "text-white/40"
                                )}
                              >
                                v{t.version}
                              </span>
                            </div>
                            <span
                              className={cn(
                                "text-[10px] font-mono truncate max-w-[150px]",
                                isLight ? "text-[#1a1625]/30" : "text-white/30"
                              )}
                            >
                              {t.path}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </NewInstanceField>

            {/* 3. 预检卡片 (若已识别来源，默认单行展示版本与 (i) 符号，未读时显示醒目红色感叹号，点击展开详细检测明细) */}
            {migrationSourcePath && (
              <div
                className={cn(
                  "rounded-xl border px-3 py-2 text-xs transition-colors",
                  isLight
                    ? "bg-black/[0.02] border-black/[0.06]"
                    : "bg-white/[0.02] border-white/[0.06]"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={cn(
                        "font-medium text-xs",
                        isLight ? "text-[#1a1625]/75" : "text-white/75"
                      )}
                    >
                      数据预检
                    </span>
                    <InfoBadgeButton
                      isOpen={showPreflightInfo}
                      onToggle={() => {
                        if (!hasReadPreflight) setHasReadPreflight(true);
                        setShowPreflightInfo(!showPreflightInfo);
                      }}
                      hasBeenRead={hasReadPreflight}
                      isLight={isLight}
                      title="重要提示：点击查看预检详情"
                      readTitle="点击查看预检详情"
                    />
                  </div>
                  <span
                    className={cn(
                      "font-mono text-[11px]",
                      isLight ? "text-[#1a1625]/45" : "text-white/45"
                    )}
                  >
                    SillyTavern v{migrationPreflight?.version || "1.12.8"}
                  </span>
                </div>

                <div
                  className={cn("motion-accordion", showPreflightInfo && "is-open")}
                  aria-hidden={!showPreflightInfo}
                >
                  <div className="motion-accordion-inner">
                    <div
                      className={cn(
                        "pt-2 mt-2 border-t text-[11px] leading-relaxed space-y-1",
                        isLight
                          ? "border-black/[0.04] text-[#1a1625]/60"
                          : "border-white/[0.04] text-white/60"
                      )}
                    >
                      <div>完整度检测：包含聊天记录、角色预设、世界书与扩展插件。</div>
                      <div>环境隔离策略：自动排除 .git 版本库与旧依赖缓存。</div>
                      {migrationPreflight?.nativePlugins &&
                        migrationPreflight.nativePlugins.length > 0 && (
                          <div
                            className={cn(
                              "pt-0.5",
                              isLight ? "text-[#1a1625]/45" : "text-white/45"
                            )}
                          >
                            检测到原生模块 ({migrationPreflight.nativePlugins.join(", ")})，首次启动将自动重构。
                          </div>
                        )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. 敏感凭据脱敏选项 (采用统一的 ios-toggle，未读时显示醒目红色感叹号，点击 (i) 展开安全说明) */}
            <div className="py-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isLight ? "text-[#1a1625]/75" : "text-white/75"
                    )}
                  >
                    包含敏感凭据 (secrets.json)
                  </span>
                  <InfoBadgeButton
                    isOpen={showSecretsInfo}
                    onToggle={() => {
                      if (!hasReadSecrets) setHasReadSecrets(true);
                      setShowSecretsInfo(!showSecretsInfo);
                    }}
                    hasBeenRead={hasReadSecrets}
                    isLight={isLight}
                    title="安全提示：点击查看敏感凭据说明"
                    readTitle="点击查看说明"
                  />
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setMigrationIncludeSecrets(!migrationIncludeSecrets)
                  }
                  className="ios-toggle flex-shrink-0 ml-3"
                  aria-label="包含敏感凭据"
                >
                  <div
                    className={cn(
                      "ios-toggle-track",
                      migrationIncludeSecrets && "ios-toggle-track-active"
                    )}
                  >
                    <div className="ios-toggle-icons">
                      <span className="ios-toggle-icon-off">○</span>
                      <span className="ios-toggle-icon-on">│</span>
                    </div>
                    <div
                      className={cn(
                        "ios-toggle-thumb",
                        migrationIncludeSecrets && "ios-toggle-thumb-active"
                      )}
                    />
                  </div>
                </button>
              </div>

              <div
                className={cn("motion-accordion", showSecretsInfo && "is-open")}
                aria-hidden={!showSecretsInfo}
              >
                <div className="motion-accordion-inner">
                  <div
                    className={cn(
                      "mt-2 p-2.5 rounded-xl border text-[11px] leading-relaxed",
                      isLight
                        ? "bg-black/[0.03] border-black/[0.06] text-[#1a1625]/65"
                        : "bg-white/[0.03] border-white/[0.06] text-white/65"
                    )}
                  >
                    为安全起见默认排除 secrets.json，以防止历史 API Key 或第三方密钥意外泄露；开启后将随同导入已有密钥与私有认证配置。
                  </div>
                </div>
              </div>
            </div>

            {/* 5. 目标路径 (仅复制迁移下展示) */}
            {migrationAccessMode === "copy" && (
              <NewInstanceField
                label="目标保存路径"
                unreadAlert={true}
                info="受管实例的本地独立存储路径。数据将完整复制至此，与原物理酒馆隔离运行。"
                isLight={isLight}
              >
                <input
                  type="text"
                  value={
                    migrationCustomDest ||
                    `%LOCALAPPDATA%/SillyClient/tarven/servers/${
                      newInstanceName.trim() || "imported"
                    }`
                  }
                  readOnly
                  className={cn(
                    "w-full h-9 px-3 rounded-xl border text-xs focus:outline-none focus:ring-0 opacity-80 cursor-default",
                    isLight
                      ? "bg-black/[0.02] border-black/[0.06] text-[#1a1625]/70"
                      : "bg-white/[0.02] border-white/[0.06] text-white/70"
                  )}
                />
              </NewInstanceField>
            )}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div
        className={cn(
          "px-5 py-3 border-t flex-shrink-0",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        {newInstanceError && (
          <div
            className={cn(
              "mb-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-[11px] leading-relaxed",
              isLight
                ? "border-red-900/10 bg-red-900/[0.04] text-red-900/65"
                : "border-red-400/10 bg-red-400/[0.05] text-red-300/75"
            )}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{newInstanceError}</span>
          </div>
        )}
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={isCreatingInstance}
            onClick={() => {
              closeVersionDropdown();
              onClose();
            }}
            className={cn(
              "motion-control px-4 h-8 rounded-full text-xs font-medium transition-all border",
              "disabled:pointer-events-none disabled:opacity-40",
              isLight
                ? "bg-black/[0.04] border-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.08]"
                : "bg-white/[0.08] border-white/[0.06] text-white/60 hover:bg-white/[0.14]"
            )}
          >
            取消
          </button>
          <button
            onClick={createInstance}
            disabled={isCreatingInstance}
            className={cn(
              "motion-control px-5 h-8 rounded-full text-xs font-semibold disabled:pointer-events-none disabled:opacity-50 flex items-center gap-1.5 transition-all border",
              isLight
                ? "bg-[#1a1625] border-[#1a1625] text-white hover:bg-[#1a1625]/90 active:bg-[#1a1625]/80 shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
                : "bg-white border-white text-[#14101e] hover:bg-white/90 active:bg-white/80 shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
            )}
          >
            {isCreatingInstance && (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            )}
            {isCreatingInstance
              ? newInstanceMode === "remote"
                ? "验证连接"
                : newInstanceMode === "import"
                ? "正在启动迁移..."
                : "获取当前版本"
              : newInstanceMode === "import"
              ? migrationAccessMode === "takeover"
                ? "确认原地接管"
                : "开始复制迁移"
              : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
};
