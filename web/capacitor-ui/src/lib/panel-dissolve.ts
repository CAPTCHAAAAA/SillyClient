const DISSOLVING_ATTR = "dissolving";

let observerInstalled = false;

export interface TriggerPanelDissolveOptions {
  restart?: boolean;
}

/**
 * 在 `.motion-panel-stack` 高度变化期间挂载羽化遮罩属性，避免 `overflow: hidden` 产生生硬裁切线。
 */
export function triggerPanelStackDissolve(
  stackEl: HTMLElement | null,
  options: TriggerPanelDissolveOptions = {}
): void {
  if (!stackEl) return;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    delete stackEl.dataset[DISSOLVING_ATTR];
    return;
  }
  if (stackEl.dataset[DISSOLVING_ATTR] === "true") {
    if (!options.restart) return;
    delete stackEl.dataset[DISSOLVING_ATTR];
    // 强制重排以在连续切换高度时重新触发羽化溶解关键帧。
    void stackEl.offsetWidth;
  }
  stackEl.dataset[DISSOLVING_ATTR] = "true";
}

export function installGlobalPanelDissolveObserver(): void {
  if (observerInstalled || typeof document === "undefined") return;
  observerInstalled = true;

  document.addEventListener("transitionrun", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (event.propertyName !== "height" || !target.classList.contains("motion-panel-stack")) {
      return;
    }
    triggerPanelStackDissolve(target);
  });

  document.addEventListener("animationend", (event) => {
    if (event.animationName !== "motion-stack-feather") return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    delete target.dataset[DISSOLVING_ATTR];
  });
}
