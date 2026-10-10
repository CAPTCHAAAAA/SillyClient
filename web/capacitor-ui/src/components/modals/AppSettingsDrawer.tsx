import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { X, ChevronRight } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { TarvenEnv } from "../../capacitor-plugin";
import type { ContentOpenMode, AppUpdateInfo } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ToggleSwitch } from "../common/ToggleSwitch";
import type { TavernInstance } from "../../types";
import { createInstanceBackup } from "../../lib/instance-persistence";
import { openExternalUrl } from "../../lib/external-links";
import { APP_VERSION } from "../../constants/app-version";


export interface AppSettingsDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  isWeb: boolean;
  pullToRefresh: boolean;
  setPullToRefresh: (v: boolean) => void;
  contentOpenMode: ContentOpenMode;
  setContentOpenMode: (m: ContentOpenMode) => void;
  replayOnboarding: () => void;
  instances: TavernInstance[];
  setInstances: React.Dispatch<React.SetStateAction<TavernInstance[]>>;
  onImportBackup: (content: string) => void;
  importInputRef: React.RefObject<HTMLInputElement | null>;
  appUpdateState: "idle" | "checking" | "current" | "available" | "error";
  appUpdateInfo: AppUpdateInfo | null;
  checkForAppUpdate: () => Promise<any>;
  openProjectPage: () => void;
  onOpenCleanGarbage: () => void;
  onOpenWhatsNew?: () => void;
}

function AppSettingsRow({
  label,
  desc,
  children,
}: {
  label: string;
  desc: string;
  children: React.ReactNode;
}) {
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
      <span className="app-settings-pending">敬请期待</span>
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
    <button
      type="button"
      onClick={onClick}
      className="app-settings-row app-settings-link-row is-interactive motion-control"
    >
      <div className="app-settings-copy">
        <div className="app-settings-label">{label}</div>
        <div className="app-settings-desc">{desc}</div>
      </div>
      <div className="app-settings-control">
        <ChevronRight className="w-4 h-4 opacity-35" />
      </div>
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

/**
 * APP 全局设置抽屉面板 (AppSettingsDrawer)
 * 涵盖：通用设置、数据备份导出、应用维护与更新。
 * 全域接入向导级同位驻留 DOM、微位移升降与高斯模糊虚化交叉溶变动效。
 */
export const AppSettingsDrawer: React.FC<AppSettingsDrawerProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isWindows,
  isWeb,
  pullToRefresh,
  setPullToRefresh,
  contentOpenMode,
  setContentOpenMode,
  replayOnboarding,
  instances,
  setInstances,
  onImportBackup,
  importInputRef,
  appUpdateState,
  appUpdateInfo,
  checkForAppUpdate,
  openProjectPage,
  onOpenCleanGarbage,
  onOpenWhatsNew,
}) => {
  const [appSettingsTab, setAppSettingsTab] = useState<
    "general" | "data" | "maintenance"
  >("general");

  // 默认实例存储路径：实例始终是该根的直接子目录；仅影响之后创建的实例。
  const [instancesRoot, setInstancesRoot] = useState<string | null>(null);
  const [configuredInstancesRoot, setConfiguredInstancesRoot] = useState<string | null>(null);
  useEffect(() => {
    if (!isOpen || instancesRoot !== null) return;
    TarvenEnv.getAppSettings()
      .then(settings => {
        setInstancesRoot(settings.instancesRoot);
        setConfiguredInstancesRoot(settings.configuredInstancesRoot ?? null);
      })
      .catch(() => setInstancesRoot(""));
  }, [isOpen, instancesRoot]);

  const chooseInstancesRoot = async () => {
    try {
      const picked = await TarvenEnv.pickDirectory({ purpose: "installation" });
      if (!picked?.path) return;
      const result = await TarvenEnv.setInstancesRoot({ path: picked.path });
      setInstancesRoot(result.instancesRoot);
      setConfiguredInstancesRoot(result.configured ? result.instancesRoot : null);
    } catch {
      /* 用户取消或授权中断：保持现有路径不变 */
    }
  };

  const resetInstancesRoot = async () => {
    try {
      const result = await TarvenEnv.setInstancesRoot({});
      setInstancesRoot(result.instancesRoot);
      setConfiguredInstancesRoot(null);
    } catch {
      /* 保持现有路径不变 */
    }
  };

  const displayInstancesRoot = instancesRoot === null
    ? "读取中…"
    : instancesRoot === ""
      ? "暂不可用"
      : instancesRoot;

  const generalRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLDivElement>(null);
  const maintenanceRef = useRef<HTMLDivElement>(null);
  const [tabContentHeight, setTabContentHeight] = useState<number | null>(null);

  // 动态测量当前激活 Tab 面板高度，实现向导级白天黑夜级平滑伸缩过渡
  useLayoutEffect(() => {
    if (!isOpen) return;
    const targetEl =
      appSettingsTab === "general"
        ? generalRef.current
        : appSettingsTab === "data"
        ? dataRef.current
        : maintenanceRef.current;
    if (!targetEl) return;

    const updateHeight = (entry?: ResizeObserverEntry) => {
      const h = entry?.borderBoxSize?.[0]?.blockSize ?? targetEl.offsetHeight;
      if (h > 0) setTabContentHeight(Math.ceil(h));
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([entry]) => {
        updateHeight(entry);
      });
      ro.observe(targetEl);
      return () => ro.disconnect();
    }
  }, [
    appSettingsTab,
    isOpen,
    pullToRefresh,
    contentOpenMode,
    instances.length,
    appUpdateState,
    appUpdateInfo,
  ]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-task-surface app-settings-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.DRAWER,
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
          "app-settings-header flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <span
          className={cn(
            "text-sm font-semibold",
            isLight ? "text-[#1a1625]" : "text-white"
          )}
        >
          APP 设置
        </span>
        <div className="app-settings-header-actions">
          <button
            onClick={onClose}
            className={cn(
              "motion-control p-1.5 rounded-lg transition-colors",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="app-settings-body flex-1 overflow-y-auto p-5 scrollbar-subtle">
        {/* 顶部胶囊切换栏 */}
        <div
          className="app-settings-tabs flex gap-2 mb-4"
          role="group"
          aria-label="设置分类"
        >
          {(
            [
              { id: "general", label: "通用" },
              { id: "data", label: "数据" },
              { id: "maintenance", label: "维护" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={appSettingsTab === tab.id}
              className="app-settings-tab ios-choice-control motion-control flex-1 h-9 rounded-xl text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              onClick={() => setAppSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 模式切换容器（向导级平滑高度自适应 + 同位驻留高斯模糊交叉溶变） */}
        <div
          className="motion-panel-stack"
          style={{
            height: tabContentHeight ? `${tabContentHeight}px` : undefined,
          }}
        >
          {/* 通用设置面板 */}
          <div
            ref={generalRef}
            className={cn(
              "motion-panel-face w-full",
              appSettingsTab === "general"
                ? "is-active relative pointer-events-auto"
                : "absolute inset-x-0 top-0 pointer-events-none select-none"
            )}
            aria-hidden={appSettingsTab !== "general"}
            inert={appSettingsTab !== "general"}
          >
            <div className="app-settings-list space-y-1">
              <AppSettingsRow
                label="下拉刷新"
                desc="在酒馆界面顶部下拉即可刷新"
              >
                <ToggleSwitch
                  on={pullToRefresh}
                  onChange={(v) => {
                    setPullToRefresh(v);
                    TarvenEnv.setPullToRefresh({ enabled: v }).catch(() => {});
                  }}
                  isLight={isLight}
                />
              </AppSettingsRow>
              {isWindows && (
                <AppSettingsRow
                  label="系统浏览器"
                  desc="关闭后将在 SillyClient 窗口内打开"
                >
                  <ToggleSwitch
                    on={contentOpenMode === "browser"}
                    onChange={(useBrowser) => {
                      const previous = contentOpenMode;
                      const mode: ContentOpenMode = useBrowser
                        ? "browser"
                        : "webview";
                      setContentOpenMode(mode);
                      TarvenEnv.setContentOpenMode({ mode }).catch(() =>
                        setContentOpenMode(previous)
                      );
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
          </div>

          {/* 数据设置面板 */}
          <div
            ref={dataRef}
            className={cn(
              "motion-panel-face w-full",
              appSettingsTab === "data"
                ? "is-active relative pointer-events-auto"
                : "absolute inset-x-0 top-0 pointer-events-none select-none"
            )}
            aria-hidden={appSettingsTab !== "data"}
            inert={appSettingsTab !== "data"}
          >
            <div className="app-settings-list space-y-1">
              <AppSettingsRow
                label="默认实例存储路径"
                desc={`${displayInstancesRoot} · 实例以此处一级子目录存放`}
              >
                <div className="app-settings-actions">
                  <AppSettingsAction
                    onClick={() => { void chooseInstancesRoot(); }}
                  >
                    更改
                  </AppSettingsAction>
                  {configuredInstancesRoot !== null && (
                    <AppSettingsAction
                      onClick={() => { void resetInstancesRoot(); }}
                    >
                      默认
                    </AppSettingsAction>
                  )}
                </div>
              </AppSettingsRow>
              <AppSettingsRow
                label="实例备份"
                desc="迁移实例列表与应用设置"
              >
                <div className="app-settings-actions">
                  <AppSettingsAction
                    onClick={async () => {
                      if (Capacitor.isNativePlatform()) {
                        try {
                          const res = await TarvenEnv.readTextFile({ mimeType: "application/json" });
                          if (!res?.content) return;
                          onImportBackup(res.content);
                          onClose();
                        } catch {
                          /* 用户取消或读取失败 */
                        }
                      } else {
                        importInputRef.current?.click();
                      }
                    }}
                  >
                    导入
                  </AppSettingsAction>
                  <AppSettingsAction
                    onClick={async () => {
                      const data = createInstanceBackup(instances);
                      const fileName = `sillyclient-backup-${new Date()
                        .toISOString()
                        .slice(0, 10)}.json`;
                      if (Capacitor.isNativePlatform()) {
                        try {
                          await TarvenEnv.saveTextFile({
                            fileName,
                            mimeType: "application/json",
                            content: data,
                          });
                        } catch {
                          /* 用户取消或原生保存失败 */
                        }
                        onClose();
                        return;
                      }
                      const blob = new Blob([data], {
                        type: "application/json",
                      });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = fileName;
                      a.click();
                      URL.revokeObjectURL(url);
                      onClose();
                    }}
                  >
                    导出
                  </AppSettingsAction>
                </div>
              </AppSettingsRow>
              <AppSettingsRow
                label="浏览数据"
                desc="清除应用内网页缓存"
              >
                <AppSettingsAction
                  onClick={() => TarvenEnv.clearWebViewData().catch(() => {})}
                >
                  清除
                </AppSettingsAction>
              </AppSettingsRow>
              <AppSettingsPlaceholder />
            </div>
          </div>

          {/* 维护设置面板 */}
          <div
            ref={maintenanceRef}
            className={cn(
              "motion-panel-face w-full",
              appSettingsTab === "maintenance"
                ? "is-active relative pointer-events-auto"
                : "absolute inset-x-0 top-0 pointer-events-none select-none"
            )}
            aria-hidden={appSettingsTab !== "maintenance"}
            inert={appSettingsTab !== "maintenance"}
          >
            <div className="app-settings-list space-y-1">
              <AppSettingsRow
                label="检查新版本"
                desc={
                  appUpdateState === "available"
                    ? `发现 SillyClient v${appUpdateInfo?.latestVersion}`
                    : appUpdateState === "checking"
                    ? "正在检查 SillyClient 更新"
                    : appUpdateState === "error"
                    ? "暂时无法连接更新服务"
                    : appUpdateState === "current"
                    ? `当前已是最新版本 v${appUpdateInfo?.currentVersion}`
                    : "启动时自动检查，也可随时手动检查"
                }
              >
                <div className="app-settings-actions">
                  <AppSettingsAction
                    onClick={() => {
                      void checkForAppUpdate();
                    }}
                  >
                    {appUpdateState === "checking" ? "检查中" : "检查"}
                  </AppSettingsAction>
                  {appUpdateInfo?.updateAvailable &&
                    appUpdateInfo.releaseUrl && (
                      <AppSettingsAction
                        onClick={() => {
                          const url = appUpdateInfo.releaseUrl!;
                          onClose();
                          void openExternalUrl(url).catch(() => {});
                        }}
                      >
                        查看
                      </AppSettingsAction>
                    )}
                </div>
              </AppSettingsRow>
              <AppSettingsLinkRow
                label={`${APP_VERSION} 主要更新`}
                desc="查看本次版本新增功能与核心改进"
                onClick={() => {
                  onClose();
                  onOpenWhatsNew?.();
                }}
              />
              <AppSettingsRow
                label="临时文件"
                desc="扫描可以安全移除的缓存"
              >
                <AppSettingsAction
                  tone="warning"
                  onClick={() => {
                    onClose();
                    onOpenCleanGarbage();
                  }}
                >
                  检查
                </AppSettingsAction>
              </AppSettingsRow>
              <AppSettingsRow
                label="重置 SillyClient"
                desc="清除实例列表与本地数据"
              >
                <AppSettingsAction
                  tone="danger"
                  onClick={() => {
                    if (
                      confirm("确认清空数据并重新初始化？所有实例将被删除")
                    ) {
                      localStorage.removeItem("sillyclient.instances");
                      TarvenEnv.clearWebViewData().catch(() => {});
                      setInstances([]);
                    }
                  }}
                >
                  重置
                </AppSettingsAction>
              </AppSettingsRow>
              <AppSettingsLinkRow
                label="项目发布页"
                desc="查看安装包、更新说明与项目动态"
                onClick={openProjectPage}
              />
              <AppSettingsPlaceholder />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
