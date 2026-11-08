import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ONBOARDING_CHANNEL, type OnboardingSeed } from "../../lib/onboarding-mode";

interface OnboardingSessionProps extends Omit<OnboardingSeed, "sessionId"> {
  onComplete: () => void;
}

export default function OnboardingSession({ onComplete, ...seed }: OnboardingSessionProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [sessionId] = useState(() => Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-"));
  const [source] = useState(() => {
    const url = new URL(window.location.href);
    url.search = "";
    url.searchParams.set("onboardingSandbox", "1");
    url.hash = "/";
    return url.href;
  });
  const seedRef = useRef(seed);
  seedRef.current = seed;

  useEffect(() => {
    const app = document.getElementById("root");
    const previousInert = app?.inert ?? false;
    const previousOverflow = document.documentElement.style.overflow;
    const previousFocus = document.activeElement;
    if (app) app.inert = true;
    document.documentElement.style.overflow = "hidden";

    const handleMessage = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow || event.origin !== window.location.origin) return;
      if (event.data?.channel !== ONBOARDING_CHANNEL) return;
      if (event.data.type === "ready") {
        frame.contentWindow?.postMessage({
          channel: ONBOARDING_CHANNEL,
          type: "initialize",
          seed: { ...seedRef.current, sessionId },
        }, window.location.origin === "null" ? "*" : window.location.origin);
        frame.focus();
      } else if (event.data.type === "finish" && event.data.sessionId === sessionId) {
        onComplete();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (app) app.inert = previousInert;
      document.documentElement.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [onComplete, sessionId]);

  return createPortal(
    <iframe
      ref={frameRef}
      src={source}
      title="交互演练"
      sandbox="allow-scripts allow-same-origin"
      data-onboarding-session
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: 0, zIndex: 1000 }}
    />,
    document.body,
  );
}
