// 应用入口：样式在 ./styles.css（Tailwind v4 + design token），路由见 ./router.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import { isOnboardingSandbox, postOnboardingMessage } from "./lib/onboarding-mode";
import { installGlobalPanelDissolveObserver } from "./lib/panel-dissolve";
import { applyUiScale, loadUiScale } from "./lib/ui-scale";

async function mountApplication() {
  installGlobalPanelDissolveObserver();
  if (isOnboardingSandbox) {
    const { installOnboardingSandbox } = await import("./components/onboarding/onboarding-runtime");
    await installOnboardingSandbox();
  } else {
    applyUiScale(loadUiScale());
    if (import.meta.env.DEV) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("nativePreview") === "1") {
        const { installNativePreview } = await import("./dev/native-preview");
        installNativePreview();
      } else if (params.get("showcase") !== "1") {
        const { mountDevDebugOverlay } = await import("./dev/DevDebugOverlay");
        mountDevDebugOverlay();
      }
    }
  }

  const router = getRouter();

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <RouterProvider router={router} />
    </React.StrictMode>
  );
}

void mountApplication().catch((error: unknown) => {
  if (isOnboardingSandbox) {
    postOnboardingMessage("error");
    return;
  }
  throw error;
});
