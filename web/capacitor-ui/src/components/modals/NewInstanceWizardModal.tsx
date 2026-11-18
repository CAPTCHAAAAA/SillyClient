import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, Info, LoaderCircle } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { PreinstalledExtensionId } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { PreinstallOptions } from "../instance/PreinstallOptions";
import { ActionButton } from "../common/ActionButton";
import { ErrorReportAlert } from "../common/ErrorReportAlert";
import { reportGlobalError } from "../../lib/global-error-store";
import {
  createDiagnosticContext,
  humanizeNativeError,
  isUserCancellationError,
  type DiagnosticContext,
} from "../../lib/native-errors";

export type WizardMode = "local" | "remote";

export interface NewInstanceWizardModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  isIOS?: boolean;
  newInstanceName: string;
  setNewInstanceName: (value: string) => void;
  newInstanceMode: WizardMode;
  switchInstanceMode: (mode: WizardMode) => void;
  newInstanceDir: string;
  setNewInstanceDir: (value: string) => void;
  onPickInstallFolder: () => void;
  newInstanceVersion: string;
  setNewInstanceVersion: (value: string) => void;
  newInstanceLocalZip: string | null;
  setNewInstanceLocalZip: (value: string | null) => void;
  newInstanceCompanionPresetEnabled: boolean;
  setNewInstanceCompanionPresetEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  newInstanceExtensionIds: PreinstalledExtensionId[];
  setNewInstanceExtensionIds: React.Dispatch<React.SetStateAction<PreinstalledExtensionId[]>>;
  newInstanceUrl: string;
  setNewInstanceUrl: (value: string) => void;
  newRemoteAuthEnabled: boolean;
  setNewRemoteAuthEnabled: (value: boolean) => void;
  newRemoteAuthUsername: string;
  setNewRemoteAuthUsername: (value: string) => void;
  newRemoteAuthPassword: string;
  setNewRemoteAuthPassword: (value: string) => void;
  newInstanceError: string | null;
  newInstanceDiagnostic?: DiagnosticContext | null;
  isCreatingInstance: boolean;
  createInstance: () => void;
  releases: any[];
  setReleases: (releases: any[]) => void;
  fetchingReleases: boolean;
  setFetchingReleases: (value: boolean) => void;
  verDropdownOpen: boolean;
  isVerDropdownClosing: boolean;
  openVersionDropdown: (trigger: HTMLElement) => void;
  closeVersionDropdown: () => void;
  addTerminalLog: (message: string, level?: string) => void;
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
        "motion-control relative flex h-4 w-4 items-center justify-center rounded-full transition-colors duration-200",
        isUnread
          ? isLight
            ? "bg-red-900/[0.06] text-red-900/60 hover:text-red-900/85"
            : "bg-red-400/[0.08] text-red-300/75 hover:text-red-200"
          : isOpen
          ? isLight
            ? "bg-black/10 text-[#1a1625]"
            : "bg-white/15 text-white"
          : isLight
          ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
          : "text-white/40 hover:text-white/85"
      )}
    >
      {isUnread ? (
        <span
          className={cn(
            "select-none font-mono text-[10px] font-bold leading-none",
            isLight ? "text-red-900/70" : "text-red-300/80"
          )}
        >
          !
        </span>
      ) : (
        <Info className="h-2.5 w-2.5" />
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
    setShowInfo((current) => !current);
  };

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
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
            "mb-2 text-[10px]",
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
                "mb-2.5 rounded-xl p-2.5 text-[11px] leading-relaxed",
                isLight
                  ? "bg-black/[0.035] text-[#1a1625]/65"
                  : "bg-white/[0.04] text-white/65"
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

export const NewInstanceWizardModal: React.FC<NewInstanceWizardModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isWindows,
  isIOS = false,
  newInstanceName,
  setNewInstanceName,
  newInstanceMode,
  switchInstanceMode,
  newInstanceDir,
  setNewInstanceDir,
  onPickInstallFolder,
  newInstanceVersion,
  setNewInstanceVersion,
  newInstanceLocalZip,
  setNewInstanceLocalZip,
  newInstanceCompanionPresetEnabled,
  setNewInstanceCompanionPresetEnabled,
  newInstanceExtensionIds,
  setNewInstanceExtensionIds,
  newInstanceUrl,
  setNewInstanceUrl,
  newRemoteAuthEnabled,
  setNewRemoteAuthEnabled,
  newRemoteAuthUsername,
  setNewRemoteAuthUsername,
  newRemoteAuthPassword,
  setNewRemoteAuthPassword,
  newInstanceError,
  newInstanceDiagnostic,
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
  const wizardContainerRef = useRef<HTMLDivElement>(null);
  const wizardLocalRef = useRef<HTMLDivElement>(null);
  const wizardRemoteRef = useRef<HTMLDivElement>(null);
  const wizardBodyRef = useRef<HTMLDivElement>(null);
  const [wizardHeight, setWizardHeight] = useState<number | null>(null);
  const [wizardBodyFade, setWizardBodyFade] = useState({
    top: false,
    bottom: false,
  });
  const [releasesError, setReleasesError] = useState<string | null>(null);
  const [releasesDiagnostic, setReleasesDiagnostic] = useState<DiagnosticContext | null>(null);
  const [localPickerError, setLocalPickerError] = useState<string | null>(null);
  const [localPickerDiagnostic, setLocalPickerDiagnostic] = useState<DiagnosticContext | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setReleasesError(null);
      setReleasesDiagnostic(null);
      setLocalPickerError(null);
      setLocalPickerDiagnostic(null);
    }
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    const targetEl =
      newInstanceMode === "local"
        ? wizardLocalRef.current
        : wizardRemoteRef.current;
    if (!targetEl) return;

    const measureHeight = (entry?: ResizeObserverEntry) => {
      const borderBoxSize = entry?.borderBoxSize;
      const measured = Array.isArray(borderBoxSize)
        ? (borderBoxSize[0] as ResizeObserverSize | undefined)?.blockSize
        : (borderBoxSize as ResizeObserverSize | undefined)?.blockSize;
      const height = measured ?? targetEl.offsetHeight;
      if (height > 0) setWizardHeight(Math.ceil(height));
    };

    measureHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => measureHeight(entry));
    observer.observe(targetEl);
    return () => observer.disconnect();
  }, [
    isOpen,
    newInstanceMode,
    newInstanceCompanionPresetEnabled,
    newInstanceExtensionIds,
    newRemoteAuthEnabled,
  ]);

  const syncWizardBodyFade = () => {
    const node = wizardBodyRef.current;
    if (!node) return;
    const top = node.scrollTop > 2;
    const bottom = node.scrollHeight - node.clientHeight - node.scrollTop > 2;
    setWizardBodyFade((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom }
    );
  };

  useLayoutEffect(() => {
    if (!isOpen) return;
    syncWizardBodyFade();
    const node = wizardBodyRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncWizardBodyFade());
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [
    isOpen,
    newInstanceMode,
    wizardHeight,
    newInstanceError,
    newInstanceDiagnostic,
    newInstanceCompanionPresetEnabled,
    newRemoteAuthEnabled,
  ]);

  const handleSwitchMode = (mode: WizardMode) => {
    if (mode === newInstanceMode) return;
    if (wizardContainerRef.current) {
      setWizardHeight(wizardContainerRef.current.offsetHeight);
    }
    switchInstanceMode(mode);
  };

  if (!isOpen && !isClosing) return null;

  const wizardBodyMask =
    wizardBodyFade.top || wizardBodyFade.bottom
      ? `linear-gradient(to bottom, ${
          wizardBodyFade.top ? "transparent" : "#000"
        } 0, #000 36px, #000 calc(100% - 36px), ${
          wizardBodyFade.bottom ? "transparent" : "#000"
        } 100%)`
      : undefined;

  return (
    <div
      data-platform={isWindows ? "windows" : "other"}
      className={cn(
        "ios-task-surface reading-flat-surface fixed flex flex-col overflow-hidden rounded-2xl backdrop-blur-[40px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(460px, calc(var(--ui-vw, 100vw) - 2rem))",
        maxHeight: "min(calc(var(--ui-vh, 100vh) * 0.85), calc(var(--ui-vh, 100vh) - 4rem))",
      }}
    >
      <div
        className={cn(
          "flex h-12 flex-shrink-0 items-center border-b px-5",
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
      </div>

      <div
        className="flex min-h-0 flex-col overflow-hidden"
        style={{
          flex: "1 1 auto",
          WebkitMaskImage: wizardBodyMask,
          maskImage: wizardBodyMask,
        }}
      >
        <div
          ref={wizardBodyRef}
          onScroll={syncWizardBodyFade}
          className="scrollbar-hidden min-h-0 space-y-5 overflow-y-auto p-5"
          style={{ flex: "1 1 auto" }}
        >
              <NewInstanceField label="名称" isLight={isLight}>
            <input
              type="text"
              value={newInstanceName}
              onChange={(event) => setNewInstanceName(event.target.value)}
              placeholder="我的酒馆"
              className={cn(
                "h-9 w-full rounded-xl border-0 px-3 text-sm transition-colors focus:outline-none focus:ring-0",
                isLight
                  ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
                  : "bg-white/[0.04] text-white placeholder:text-white/25"
              )}
            />
          </NewInstanceField>

          <div>
            <div
              className={cn(
                "mb-2 text-xs font-medium",
                isLight ? "text-[#1a1625]/70" : "text-white/70"
              )}
            >
              实例模式
            </div>
            <div className="ios-choice-track" role="group" aria-label="实例模式">
              <button
                type="button"
                onClick={() => handleSwitchMode("local")}
                aria-pressed={newInstanceMode === "local"}
                className="ios-choice-control flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                本地实例
              </button>
              <button
                type="button"
                onClick={() => handleSwitchMode("remote")}
                aria-pressed={newInstanceMode === "remote"}
                className="ios-choice-control flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              >
                远程连接
              </button>
            </div>
          </div>

          <div
            ref={wizardContainerRef}
            className="motion-panel-stack"
            style={{ height: wizardHeight ? `${wizardHeight}px` : undefined }}
          >
            <div
              ref={wizardLocalRef}
              className={cn(
                "motion-panel-face w-full space-y-5",
                newInstanceMode === "local"
                  ? "is-active relative pointer-events-auto"
                  : "absolute inset-x-0 top-0 pointer-events-none select-none"
              )}
              aria-hidden={newInstanceMode !== "local"}
              inert={newInstanceMode !== "local"}
            >
              <NewInstanceField
                label="安装目录"
                isLight={isLight}
                desc={
                  isIOS
                    ? "必选：点「浏览」选择存放文件夹（iOS 请进入目标文件夹后点击右上角「打开」确认），实例会创建在该文件夹内。"
                    : undefined
                }
              >
                <div className="flex w-full items-center gap-2">
                  <input
                    type="text"
                    value={newInstanceDir}
                    onChange={(event) => setNewInstanceDir(event.target.value)}
                    placeholder="选择或输入路径"
                    className={cn(
                      "h-9 min-w-0 flex-1 rounded-xl border-0 px-3 text-sm transition-colors focus:outline-none focus:ring-0",
                      isLight
                        ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
                        : "bg-white/[0.04] text-white placeholder:text-white/25"
                    )}
                  />
                  <button
                    type="button"
                    onClick={onPickInstallFolder}
                    className={cn(
                      "flat-capsule motion-control h-9 flex-shrink-0 rounded-full border-0 px-3 text-[11px] font-medium",
                      isLight
                        ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    浏览
                  </button>
                </div>
              </NewInstanceField>

              <NewInstanceField label="版本" isLight={isLight}>
                <div className="flex w-full items-center gap-2">
                  <button
                    id="ver-trigger"
                    type="button"
                    onClick={async () => {
                      if (verDropdownOpen) {
                        closeVersionDropdown();
                        return;
                      }
                      if (releases.length === 0 && !fetchingReleases) {
                        setFetchingReleases(true);
                        setReleasesError(null);
                        setReleasesDiagnostic(null);
                        try {
                          const { releases: fetchedReleases } =
                            await TarvenEnv.fetchReleases();
                          setReleases(fetchedReleases);
                        } catch (error) {
                          const friendly = humanizeNativeError(error);
                          setReleasesError(`获取版本列表失败，当前可直接使用内置版；${friendly}`);
                          setReleasesDiagnostic(
                            createDiagnosticContext(error, {
                              area: "update",
                              stage: "fetch-releases",
                              platform: isIOS ? "ios" : isWindows ? "windows" : "android",
                              userMessage: friendly,
                            })
                          );
                          addTerminalLog("> 获取版本列表失败，使用内置版", "info");
                        } finally {
                          setFetchingReleases(false);
                        }
                      }
                      const trigger = document.getElementById("ver-trigger");
                      if (trigger) openVersionDropdown(trigger);
                    }}
                    className={cn(
                      "ios-field-control motion-control flex h-9 min-w-0 flex-1 items-center justify-between rounded-xl border-0 px-3 text-left text-sm transition-colors",
                      isLight
                        ? "bg-black/[0.04] text-[#1a1625]"
                        : "bg-white/[0.04] text-white"
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
                        "h-3.5 w-3.5 flex-shrink-0 opacity-40 transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
                        verDropdownOpen &&
                          !isVerDropdownClosing &&
                          "rotate-180"
                      )}
                    />
                  </button>
                  {!isIOS && (
                  <button
                    type="button"
                    onClick={async () => {
                      setLocalPickerError(null);
                      setLocalPickerDiagnostic(null);
                      try {
                        const { path, sizeBytes } =
                          await TarvenEnv.pickZipFile({ purpose: "instanceSource" });
                        setNewInstanceLocalZip(path);
                        setNewInstanceVersion("local");
                        addTerminalLog(
                          `> 已选择本地文件 (${(sizeBytes / 1048576).toFixed(
                            1
                          )}MB)`,
                          "info"
                        );
                      } catch (error) {
                        if (isUserCancellationError(error, isIOS)) return;
                        const friendly = humanizeNativeError(error);
                        const context = createDiagnosticContext(error, {
                          area: "picker",
                          stage: "pick-zip",
                          platform: isWindows ? "windows" : "android",
                          userMessage: friendly,
                          extraSecrets: [newInstanceName, newInstanceDir],
                        });
                        setLocalPickerError(friendly);
                        setLocalPickerDiagnostic(context);
                        reportGlobalError(error, {
                          area: "picker",
                          stage: "pick-zip",
                          platform: isWindows ? "windows" : "android",
                          userMessage: friendly,
                          diagnostic: context,
                          extraSecrets: [newInstanceName, newInstanceDir],
                        });
                      }
                    }}
                    className={cn(
                      "flat-capsule motion-control h-9 flex-shrink-0 rounded-full border-0 px-3 text-[11px] font-medium",
                      isLight
                        ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    {newInstanceLocalZip ? "更换" : "导入 ZIP"}
                  </button>
                  )}
                </div>
                <ErrorReportAlert
                  error={releasesError}
                  diagnostic={releasesDiagnostic}
                  area="update"
                  stage="fetch-releases"
                  platform={isIOS ? "ios" : isWindows ? "windows" : "android"}
                  isLight={isLight}
                  compact
                  className="mt-2"
                />
              </NewInstanceField>

              <PreinstallOptions
                isLight={isLight}
                themeEnabled={newInstanceCompanionPresetEnabled}
                setThemeEnabled={setNewInstanceCompanionPresetEnabled}
                extensionIds={newInstanceExtensionIds}
                setExtensionIds={setNewInstanceExtensionIds}
              />
            </div>

            <div
              ref={wizardRemoteRef}
              className={cn(
                "motion-panel-face w-full space-y-5",
                newInstanceMode === "remote"
                  ? "is-active relative pointer-events-auto"
                  : "absolute inset-x-0 top-0 pointer-events-none select-none"
              )}
              aria-hidden={newInstanceMode !== "remote"}
              inert={newInstanceMode !== "remote"}
            >
              <NewInstanceField label="连接地址" isLight={isLight}>
                <input
                  type="url"
                  value={newInstanceUrl}
                  onChange={(event) => setNewInstanceUrl(event.target.value)}
                  placeholder="https://example.com"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className={cn(
                    "h-9 w-full rounded-xl border-0 px-3 text-sm transition-colors focus:outline-none focus:ring-0",
                    isLight
                      ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
                      : "bg-white/[0.04] text-white placeholder:text-white/25"
                  )}
                />
              </NewInstanceField>

              <div
                className={cn(
                  "border-t pt-3",
                  isLight ? "border-black/[0.04]" : "border-white/[0.04]"
                )}
              >
                <div className="setting-row flex items-center justify-between gap-4">
                  <div>
                    <div
                      className={cn(
                        "setting-label text-xs font-medium",
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
                  <div
                    className={cn(
                      "companion-preset flex-shrink-0 ml-3",
                      isLight && "is-light"
                    )}
                  >
                    <button
                      type="button"
                      role="switch"
                      aria-label="启用 Basic Auth"
                      aria-checked={newRemoteAuthEnabled}
                      onClick={() =>
                        setNewRemoteAuthEnabled(!newRemoteAuthEnabled)
                      }
                      className="companion-preset__switch motion-control"
                    >
                      <span className="companion-preset__knob" />
                    </button>
                  </div>
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
                          onChange={(event) =>
                            setNewRemoteAuthUsername(event.target.value)
                          }
                          placeholder="用户名"
                          autoCapitalize="none"
                          autoCorrect="off"
                          autoComplete="username"
                          disabled={!newRemoteAuthEnabled}
                          className={cn(
                            "h-9 min-w-0 rounded-xl border-0 px-3 text-sm transition-colors focus:outline-none focus:ring-0",
                            isLight
                              ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
                              : "bg-white/[0.04] text-white placeholder:text-white/25"
                          )}
                        />
                        <input
                          type="password"
                          value={newRemoteAuthPassword}
                          onChange={(event) =>
                            setNewRemoteAuthPassword(event.target.value)
                          }
                          placeholder="密码"
                          autoComplete="current-password"
                          disabled={!newRemoteAuthEnabled}
                          className={cn(
                            "h-9 min-w-0 rounded-xl border-0 px-3 text-sm transition-colors focus:outline-none focus:ring-0",
                            isLight
                              ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
                              : "bg-white/[0.04] text-white placeholder:text-white/25"
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
      </div>

      <div
        className={cn(
          "flex-shrink-0 border-t px-5 py-3",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <ErrorReportAlert
          error={newInstanceError || localPickerError}
          diagnostic={newInstanceError ? newInstanceDiagnostic : localPickerDiagnostic}
          area="create"
          platform={isIOS ? "ios" : isWindows ? "windows" : "android"}
          isLight={isLight}
          extraSecrets={[newInstanceName, newInstanceDir, newInstanceUrl, newInstanceLocalZip]}
          className="mb-3"
        />
        <div className="flex items-center justify-end gap-2">
          <ActionButton
            disabled={isCreatingInstance}
            onClick={() => {
              closeVersionDropdown();
              onClose();
            }}
            className={cn(
              "!h-8 px-4 text-xs font-medium",
              isLight
                ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                : "text-white/60 hover:text-white"
            )}
          >
            取消
          </ActionButton>
          <ActionButton
            onClick={createInstance}
            data-onboarding-target="create-submit"
            disabled={isCreatingInstance}
            className={cn(
              "!h-8 px-5 text-xs font-semibold",
              isLight
                ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                : "text-white/70 hover:text-white"
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
          </ActionButton>
        </div>
      </div>
    </div>
  );
};
