import React, { useRef, useEffect, useState } from "react";
import { X, ChevronDown, AlertTriangle, LoaderCircle } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ToggleSwitch } from "../common/ToggleSwitch";

export interface NewInstanceWizardModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  newInstanceName: string;
  setNewInstanceName: (v: string) => void;
  newInstanceMode: "local" | "remote";
  switchInstanceMode: (mode: "local" | "remote") => void;
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

function NewInstanceField({
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
    <div>
      <div
        className={cn(
          "text-xs font-medium mb-1.5",
          isLight ? "text-[#1a1625]/70" : "text-white/70"
        )}
      >
        {label}
      </div>
      {desc && (
        <div
          className={cn(
            "text-[10px] mb-2",
            isLight ? "text-[#1a1625]/30" : "text-white/30"
          )}
        >
          {desc}
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
  const [wizardHeight, setWizardHeight] = useState<number | null>(null);

  // 动态测量激活模式的高度以实现白天黑夜级平滑伸缩
  useEffect(() => {
    const targetEl =
      newInstanceMode === "local"
        ? wizardLocalRef.current
        : wizardRemoteRef.current;
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
                ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625] hover:bg-black/[0.14] active:bg-black/[0.18]"
                : "bg-white/20 border-white/15 text-white hover:bg-white/30 active:bg-white/35"
            )}
          >
            {isCreatingInstance && (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            )}
            {isCreatingInstance
              ? newInstanceMode === "remote"
                ? "验证连接"
                : "获取当前版本"
              : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
};
