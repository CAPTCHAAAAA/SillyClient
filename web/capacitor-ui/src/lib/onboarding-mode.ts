export const ONBOARDING_CHANNEL = "sillyclient-onboarding";
export const ONBOARDING_STARTUP_TIMEOUT_MS = 12000;

export const isOnboardingSandbox = window.parent !== window
  && new URLSearchParams(window.location.search).get("onboardingSandbox") === "1";

export const onboardingSessionId = isOnboardingSandbox
  ? new URLSearchParams(window.location.search).get("onboardingSession")
  : null;

export interface OnboardingSeed {
  sessionId: string;
  platform: "web" | "windows" | "android" | "ios";
  bgMode: "dynamic" | "custom";
  themeStyle: "light" | "dark";
  safeInsetTop: number;
}

export function postOnboardingMessage(type: "ready" | "started" | "error" | "finish") {
  if (!isOnboardingSandbox || !onboardingSessionId) return;
  window.parent.postMessage({
    channel: ONBOARDING_CHANNEL,
    type,
    sessionId: onboardingSessionId,
  }, window.location.origin === "null" ? "*" : window.location.origin);
}
