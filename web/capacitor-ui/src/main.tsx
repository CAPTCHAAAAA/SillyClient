// 应用入口：样式在 ./styles.css（Tailwind v4 + design token），路由见 ./router.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import { isOnboardingSandbox, postOnboardingMessage } from "./lib/onboarding-mode";

async function mountApplication() {
  if (isOnboardingSandbox) {
    const { installOnboardingSandbox } = await import("./components/onboarding/onboarding-runtime");
    await installOnboardingSandbox();
  } else if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("nativePreview") === "1") {
    const { installNativePreview } = await import("./dev/native-preview");
    installNativePreview();
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
