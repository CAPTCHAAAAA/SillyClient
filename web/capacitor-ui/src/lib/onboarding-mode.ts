export const ONBOARDING_CHANNEL = "sillyclient-onboarding";

export const isOnboardingSandbox = window.parent !== window
  && new URLSearchParams(window.location.search).get("onboardingSandbox") === "1";

export interface OnboardingSeed {
  sessionId: string;
  platform: "web" | "windows" | "android" | "ios";
  bgMode: "dynamic" | "custom";
  themeStyle: "light" | "dark";
  safeInsetTop: number;
}
