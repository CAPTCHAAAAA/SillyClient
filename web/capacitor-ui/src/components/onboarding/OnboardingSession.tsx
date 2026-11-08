import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ONBOARDING_CHANNEL, ONBOARDING_STARTUP_TIMEOUT_MS, type OnboardingSeed } from "../../lib/onboarding-mode";
import { MENU_GLASS_FILTER, menuShellBackground } from "../../lib/menu-surface";
import { ActionButton } from "../common/ActionButton";
import { LayerBackdrop } from "../common/LayerBackdrop";

interface OnboardingSessionProps extends Omit<OnboardingSeed, "sessionId"> {
  onComplete: () => void;
  onCancel: () => void;
}

function createSessionId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
}

export default function OnboardingSession({ onComplete, onCancel, ...seed }: OnboardingSessionProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const failStartupRef = useRef<(() => void) | null>(null);
  const [sessionId, setSessionId] = useState(createSessionId);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const seedRef = useRef(seed);
  seedRef.current = seed;
  const isLight = seed.bgMode === "custom" && seed.themeStyle === "light";

  useLayoutEffect(() => {
    const app = document.getElementById("root");
    const previousInert = app?.inert ?? false;
    const previousOverflow = document.documentElement.style.overflow;
    const previousFocus = document.activeElement;
    if (app) app.inert = true;
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (app) app.inert = previousInert;
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [onCancel]);

  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    let phase: "loading" | "ready" | "error" = "loading";
    let retryTimer: number | undefined;
    let deadline: number | undefined;
    const stopWaiting = () => {
      window.clearInterval(retryTimer);
      window.clearTimeout(deadline);
    };
    const fail = () => {
      if (phase === "error") return;
      phase = "error";
      stopWaiting();
      setStatus("error");
    };
    const initialize = () => {
      if (phase !== "loading") return;
      frame.contentWindow?.postMessage({
        channel: ONBOARDING_CHANNEL,
        type: "initialize",
        seed: { ...seedRef.current, sessionId },
      }, window.location.origin === "null" ? "*" : window.location.origin);
    };
    const handleMessage = (event: MessageEvent) => {
      if (phase === "error" || event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.channel !== ONBOARDING_CHANNEL || event.data.sessionId !== sessionId) return;
      if (event.data.type === "ready") {
        initialize();
      } else if (event.data.type === "started" && phase === "loading") {
        phase = "ready";
        stopWaiting();
        setStatus("ready");
      } else if (event.data.type === "error") {
        fail();
      } else if (event.data.type === "finish" && phase === "ready") {
        onComplete();
      }
    };

    failStartupRef.current = fail;
    window.addEventListener("message", handleMessage);
    retryTimer = window.setInterval(initialize, 300);
    deadline = window.setTimeout(fail, ONBOARDING_STARTUP_TIMEOUT_MS);
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("onboardingSandbox", "1");
    url.searchParams.set("onboardingSession", sessionId);
    url.hash = "/";
    frame.src = url.href;
    return () => {
      stopWaiting();
      window.removeEventListener("message", handleMessage);
      failStartupRef.current = null;
    };
  }, [onComplete, sessionId]);

  useLayoutEffect(() => {
    if (status === "ready") {
      frameRef.current?.focus();
    } else {
      fallbackRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
    }
  }, [status]);

  const retry = () => {
    setStatus("loading");
    setSessionId(createSessionId());
  };

  return createPortal(
    <>
      {status !== "error" && <iframe
        key={sessionId}
        ref={frameRef}
        title="交互演练"
        sandbox="allow-scripts allow-same-origin"
        data-onboarding-session
        onError={() => failStartupRef.current?.()}
        inert={status !== "ready"}
        aria-hidden={status !== "ready"}
        tabIndex={status === "ready" ? 0 : -1}
        style={{
          position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 1000,
          opacity: status === "ready" ? 1 : 0,
          pointerEvents: status === "ready" ? "auto" : "none",
        }}
      />}
      {status !== "ready" && <div
        ref={fallbackRef}
        data-onboarding-startup={status}
        className="fixed inset-0 flex items-center justify-center p-6"
        style={{ zIndex: 1001 }}
        role="dialog"
        aria-modal="true"
        aria-label="打开使用引导"
      >
        <LayerBackdrop zIndex={1001} />
        <div
          className={`ios-task-surface reading-flat-surface relative w-full max-w-xs rounded-3xl p-6 ${isLight ? "text-[#1a1625]/80" : "text-white/80"}`}
          style={{
            zIndex: 1002,
            background: menuShellBackground(isLight, seed.bgMode === "dynamic"),
            backdropFilter: MENU_GLASS_FILTER,
            WebkitBackdropFilter: MENU_GLASS_FILTER,
          }}
        >
          <div role="status" className="text-sm font-medium">
            {status === "error" ? "引导暂时没有打开" : "正在准备使用引导…"}
          </div>
          {status === "error" && <p className="mt-2 text-xs opacity-65">可以重试，也可以先返回首页。</p>}
          <div className="mt-5 flex items-center justify-end gap-2">
            <ActionButton onClick={onCancel}>返回</ActionButton>
            {status === "error" && <ActionButton onClick={retry}>重试</ActionButton>}
          </div>
        </div>
      </div>}
    </>,
    document.body,
  );
}
