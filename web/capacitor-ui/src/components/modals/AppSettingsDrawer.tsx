import React, { useState, useRef, useLayoutEffect } from "react";
import { X, ChevronRight } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import type { ContentOpenMode, AppUpdateInfo, RenderEngineSettings } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { ActionButton } from "../common/ActionButton";
import { ToggleSwitch } from "../common/ToggleSwitch";
import { SegmentedSwitch } from "../common/SegmentedSwitch";
import type { TavernInstance } from "../../types";
import { openExternalUrl } from "../../lib/external-links";


export interface AppSettingsDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows: boolean;
  pullToRefresh: boolean;
  setPullToRefresh: (v: boolean) => void;
  renderSettings?: RenderEngineSettings | null;
  onRenderSettingsChange?: (next: RenderEngineSettings) => void;
  contentOpenMode: ContentOpenMode;
  setContentOpenMode: (m: ContentOpenMode) => void;
  replayOnboarding: () => void;
  createCardPinned: boolean;
  setCreateCardPinned: (pinned: boolean) => void;
  setInstances: React.Dispatch<React.SetStateAction<TavernInstance[]>>;
  appUpdateState: "idle" | "checking" | "current" | "available" | "error";
  appUpdateInfo: AppUpdateInfo | null;
  checkForAppUpdate: () => Promise<any>;
  openProjectPage: () => void;
  onOpenCleanGarbage: () => void;
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
    <div className="app-settings-row setting-row">
      <div className="app-settings-copy">
        <div className="app-settings-label setting-label">{label}</div>
        <div className="app-settings-desc setting-desc">{desc}</div>
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
      className="app-settings-row app-settings-link-row setting-row is-interactive motion-control"
    >
      <div className="app-settings-copy">
        <div className="app-settings-label setting-label">{label}</div>
        <div className="app-settings-desc setting-desc">{desc}</div>
      </div>
      <div className="app-settings-control">
        <ChevronRight className="w-4 h-4 opacity-35" />
      </div>
    </button>
  );
}

/**
 * APP 全局设置抽屉面板 (AppSettingsDrawer)
 * 涵盖：通用设置、应用维护与更新。
 * 全域接入向导级同位驻留 DOM、微位移升降与高斯模糊虚化交叉溶变动效。
 */
export const AppSettingsDrawer: React.FC<AppSettingsDrawerProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isWindows,
  pullToRefresh,
  setPullToRefresh,
  renderSettings,
  onRenderSettingsChange,
  contentOpenMode,
  setContentOpenMode,
  replayOnboarding,
  createCardPinned,
  setCreateCardPinned,
  setInstances,
  appUpdateState,
  appUpdateInfo,
  checkForAppUpdate,
  openProjectPage,
  onOpenCleanGarbage,
}) => {
  const [appSettingsTab, setAppSettingsTab] = useState<
    "general" | "maintenance"
  >("general");

  const generalRef = useRef<HTMLDivElement>(null);
  const maintenanceRef = useRef<HTMLDivElement>(null);
  const [tabContentHeight, setTabContentHeight] = useState<number | null>(null);

  // 动态测量当前激活 Tab 面板高度，实现向导级白天黑夜级平滑伸缩过渡
  useLayoutEffect(() => {
    if (!isOpen) return;
    const targetEl =
      appSettingsTab === "general"
        ? generalRef.current
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
    renderSettings,
    contentOpenMode,
    appUpdateState,
    appUpdateInfo,
  ]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-task-surface app-settings-surface reading-flat-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
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

      <div className="px-5 pt-5 pb-3.5 flex-shrink-0">
        {/* 顶部胶囊切换栏 */}
        <div
          className="app-settings-tabs ios-choice-track mb-0"
          role="group"
          aria-label="设置分类"
        >
          {(
            [
              { id: "general", label: "通用" },
              { id: "maintenance", label: "维护" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={appSettingsTab === tab.id}
              className="app-settings-tab ios-choice-control motion-control h-9 text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
              onClick={() => setAppSettingsTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="app-settings-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-5 pb-5 scrollbar-hidden">
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
              {renderSettings && onRenderSettingsChange && (
                <>
                  <AppSettingsRow
                    label="顶栏变色龙"
                    desc="进入酒馆后顶栏自动融合页面主色调"
                  >
                    <ToggleSwitch
                      on={renderSettings.immersiveColor}
                      ariaLabel="顶栏变色龙"
                      onChange={(enabled) => {
                        onRenderSettingsChange({
                          ...renderSettings,
                          immersiveColor: enabled,
                          clickEffect: enabled ? renderSettings.clickEffect : false,
                        });
                      }}
                      isLight={isLight}
                    />
                  </AppSettingsRow>
                  <AppSettingsRow
                    label="取色频率"
                    desc={
                      renderSettings.colorExtractionMode === "once"
                        ? "仅在进入酒馆时采样一次以降低功耗"
                        : "随酒馆画面变化实时过渡顶栏色彩"
                    }
                  >
                    <SegmentedSwitch
                      value={renderSettings.colorExtractionMode}
                      options={[
                        { id: "realtime", label: "实时" },
                        { id: "once", label: "单次" },
                      ]}
                      disabled={!renderSettings.immersiveColor}
                      ariaLabel="取色频率"
                      onChange={(mode) => {
                        onRenderSettingsChange({
                          ...renderSettings,
                          colorExtractionMode: mode,
                        });
                      }}
                      isLight={isLight}
                    />
                  </AppSettingsRow>
                  <AppSettingsRow
                    label="点击光效"
                    desc={
                      renderSettings.immersiveColor
                        ? "轻触酒馆页面时在顶栏泛起柔光反馈"
                        : "开启顶栏变色龙后可用"
                    }
                  >
                    <ToggleSwitch
                      on={renderSettings.immersiveColor && renderSettings.clickEffect}
                      disabled={!renderSettings.immersiveColor}
                      ariaLabel="点击光效"
                      onChange={(enabled) => {
                        if (!renderSettings.immersiveColor) return;
                        onRenderSettingsChange({
                          ...renderSettings,
                          clickEffect: enabled,
                        });
                      }}
                      isLight={isLight}
                    />
                  </AppSettingsRow>
                </>
              )}
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
              <AppSettingsRow
                label="创建卡片置顶"
                desc="关闭后创建实例卡片可与普通卡片一样拖动排序"
              >
                <ToggleSwitch
                  on={createCardPinned}
                  onChange={setCreateCardPinned}
                  isLight={isLight}
                />
              </AppSettingsRow>
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
                  <ActionButton
                    onClick={() => {
                      void checkForAppUpdate();
                    }}
                  >
                    {appUpdateState === "checking" ? "检查中" : "检查"}
                  </ActionButton>
                  {appUpdateInfo?.updateAvailable &&
                    appUpdateInfo.releaseUrl && (
                      <ActionButton
                        onClick={() => {
                          const url = appUpdateInfo.releaseUrl!;
                          onClose();
                          void openExternalUrl(url).catch(() => {});
                        }}
                      >
                        查看
                      </ActionButton>
                    )}
                </div>
              </AppSettingsRow>
              <AppSettingsRow
                label="临时文件"
                desc="扫描可以安全移除的缓存"
              >
                <ActionButton
                  tone="warning"
                  onClick={() => {
                    onClose();
                    onOpenCleanGarbage();
                  }}
                >
                  检查
                </ActionButton>
              </AppSettingsRow>
              <AppSettingsRow
                label="重置 SillyClient"
                desc="清除实例列表与本地数据"
              >
                <ActionButton
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
                </ActionButton>
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
