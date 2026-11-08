export function menuShellBackground(isLight: boolean, isDynamic: boolean) {
  if (isLight) return "rgba(255,255,255,0.70)";
  if (isDynamic) return "rgba(28,20,32,0.70)";
  return "rgba(26,22,37,0.80)";
}

export const MENU_GLASS_FILTER = "blur(40px) saturate(1.8)";

export function terminalWellSurface(isLight: boolean, isDynamic: boolean) {
  return {
    background: isLight
      ? "rgba(226,225,223,0.84)"
      : isDynamic
        ? "oklch(0.18 0.014 350 / 0.84)"
        : "oklch(0.17 0.008 260 / 0.84)",
    boxShadow: isLight
      ? "inset 0 1px 1.5px rgba(47,39,52,0.08), inset 0 -0.5px 0 rgba(255,255,255,0.22)"
      : "inset 0 1px 1.5px rgba(0,0,0,0.35), inset 0 -0.5px 0 rgba(255,255,255,0.05)",
  };
}
