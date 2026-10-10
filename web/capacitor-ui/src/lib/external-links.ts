import { Capacitor } from "@capacitor/core";
import type { MouseEvent } from "react";
import { TarvenEnv } from "../capacitor-plugin";
import { validateExternalUrl } from "./external-url";

export async function openExternalUrl(value: string): Promise<void> {
  const url = validateExternalUrl(value);
  if (Capacitor.isNativePlatform()) {
    await TarvenEnv.openExternalUrl({ url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function handleExternalLink(event: MouseEvent<HTMLAnchorElement>, url: string): void {
  if (event.type === "auxclick" && event.button !== 1) return;
  event.preventDefault();
  event.stopPropagation();
  void openExternalUrl(url).catch(() => {});
}
