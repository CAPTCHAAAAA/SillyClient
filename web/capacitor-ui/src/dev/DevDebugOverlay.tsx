import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { X, Wrench } from "lucide-react";
import { cn } from "../lib/utils";
import { reportGlobalError } from "../lib/global-error-store";
import type { LauncherDevHost } from "../types";
import {
  DEV_ALL_PREVIEW_INSTANCE_IDS,
  DEV_DEMO_RUNNING_INSTANCES,
  DEV_FAULT_TEST_INSTANCE,
  createMockAppUpdate,
  createPreviewLaunchOptions,
  createSampleRuntimeReportError,
} from "./dev-fixtures";

function injectPreviewInstances(host: LauncherDevHost) {
  host.setPreviewMode(true);
  host.setInstances((prev) => {
    const userOnly = prev.filter((item) => !DEV_ALL_PREVIEW_INSTANCE_IDS.has(item.id));
    return [DEV_FAULT_TEST_INSTANCE, ...DEV_DEMO_RUNNING_INSTANCES, ...userOnly];
  });
}

/**
 * 纯开发环境悬浮调试板：仅在 `import.meta.env.DEV` 下由 `src/main.tsx` 动态挂载。
 * 与业务路由完全物理隔离，禁止三端作为软件源码同步，Vite 生产打包会整目录消除。
 */
function DevDebugOverlay() {
  const [host, setHost] = useState<LauncherDevHost | null>(() =>
    typeof window !== "undefined" ? window.__SILLYCLIENT_DEV_HOST__ ?? null : null,
  );
  const [collapsed, setCollapsed] = useState(false);
  const [previewInjected, setPreviewInjected] = useState(true);
  const [mockUpdateVisible, setMockUpdateVisible] = useState(true);
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    const syncTone = () => {
      const tone = document.querySelector("[data-theme-tone]")?.getAttribute("data-theme-tone");
      setIsLight(tone === "light");
    };
    syncTone();
    const observer = new MutationObserver(syncTone);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-theme-tone"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const connect = () => {
      const current = window.__SILLYCLIENT_DEV_HOST__ ?? null;
      if (current) {
        setHost(current);
        injectPreviewInstances(current);
        current.setMockAppUpdate(createMockAppUpdate());
      }
    };
    connect();
    window.addEventListener("sillyclient:dev-host-ready", connect);
    return () => window.removeEventListener("sillyclient:dev-host-ready", connect);
  }, []);

  if (!host) return null;

  const buttonClass = cn(
    "flat-capsule motion-control h-7 px-3 rounded-full border-0 font-medium",
    isLight ? "text-[#1a1625]/75 hover:text-[#1a1625]" : "text-white/75 hover:text-white",
  );

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="展开开发环境调试板（仅本地开发可见，不进入三端构建）"
        className={cn(
          "ios-floating-menu fixed bottom-4 right-4 z-[99] flex items-center gap-1.5 h-8 px-3 rounded-full border-0 select-none text-[11px] font-medium transition-all",
          isLight ? "is-light text-[#1a1625]/75 hover:text-[#1a1625]" : "text-white/75 hover:text-white",
        )}
      >
        <Wrench className="w-3 h-3" />
        <span>DEV 调试</span>
      </button>
    );
  }

  return (
    <div
      title="【仅开发环境】物理隔离于 src/dev/，不进入三端同步与正式生产包"
      className={cn(
        "ios-floating-menu fixed bottom-4 right-4 z-[99] flex flex-wrap items-center gap-1.5 p-1.5 rounded-full border-0 select-none text-[11px] transition-all",
        isLight && "is-light",
      )}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 pl-2.5 pr-1 font-medium",
          isLight ? "text-[#1a1625]/55" : "text-white/50",
        )}
      >
        <span className={cn("w-1.5 h-1.5 rounded-full", isLight ? "bg-[#1a1625]/40" : "bg-white/40")} />
        <span>DEV 调试板</span>
      </div>

      <button type="button" onClick={() => host.openWizard()} className={buttonClass}>
        打开向导
      </button>

      <button
        type="button"
        onClick={() => host.previewLaunchConsole(createPreviewLaunchOptions("progress"))}
        className={buttonClass}
      >
        模拟过渡
      </button>

      <button
        type="button"
        onClick={() => host.previewLaunchConsole(createPreviewLaunchOptions("complete"))}
        className={buttonClass}
      >
        模拟完成态
      </button>

      <button
        type="button"
        onClick={() => {
          const failure = createPreviewLaunchOptions("failure");
          host.previewLaunchConsole(failure);
          if (failure.diagnostic) {
            reportGlobalError(new Error(failure.error || "Launch failed"), {
              area: "launch",
              stage: "pingUrl",
              platform: "web",
              userMessage: failure.error || undefined,
              diagnostic: failure.diagnostic,
              force: true,
            });
          }
        }}
        className={buttonClass}
      >
        模拟启动报错
      </button>

      <button
        type="button"
        onClick={() => {
          const { previewError, diagnostic } = createSampleRuntimeReportError();
          reportGlobalError(previewError, {
            area: "runtime",
            stage: "runtimeInit",
            platform: "windows",
            diagnostic,
            force: true,
          });
        }}
        className={buttonClass}
      >
        触发报错上报
      </button>

      <button
        type="button"
        onClick={() => {
          const next = !mockUpdateVisible;
          setMockUpdateVisible(next);
          host.setMockAppUpdate(next ? createMockAppUpdate() : null);
        }}
        className={buttonClass}
      >
        {mockUpdateVisible ? "隐藏更新横幅" : "预览更新横幅"}
      </button>

      <button
        type="button"
        onClick={() => {
          if (previewInjected) {
            host.setPreviewMode(false);
            host.setInstances((prev) => prev.filter((item) => !DEV_ALL_PREVIEW_INSTANCE_IDS.has(item.id)));
            setPreviewInjected(false);
          } else {
            injectPreviewInstances(host);
            setPreviewInjected(true);
          }
        }}
        className={buttonClass}
      >
        {previewInjected ? "隐藏测试卡片" : "恢复测试卡片"}
      </button>

      <button
        type="button"
        onClick={() => {
          host.dismissPreviewPanels();
          setCollapsed(true);
        }}
        title="关闭弹层并折叠调试板"
        className={cn(
          "motion-control w-7 h-7 rounded-full flex items-center justify-center transition-colors",
          isLight ? "text-[#1a1625]/40 hover:text-[#1a1625]" : "text-white/40 hover:text-white",
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}

let devDockRoot: ReactDOM.Root | null = null;

export function mountDevDebugOverlay() {
  if (typeof document === "undefined" || devDockRoot) return;
  const hostEl = document.getElementById("sillyclient-dev-dock") ?? document.createElement("div");
  hostEl.id = "sillyclient-dev-dock";
  if (!hostEl.parentNode) document.body.appendChild(hostEl);
  devDockRoot = ReactDOM.createRoot(hostEl);
  devDockRoot.render(
    <React.StrictMode>
      <DevDebugOverlay />
    </React.StrictMode>,
  );
}
