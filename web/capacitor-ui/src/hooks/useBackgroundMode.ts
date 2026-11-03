import { useCallback, useEffect, useRef, useState } from "react";
import type { BgMode, ThemeStyle } from "../types";

export function useBackgroundMode() {
  const [bgMode, setBgMode] = useState<BgMode>(() => {
    try {
      const saved = localStorage.getItem("sillyclient.bgMode") || localStorage.getItem("bgMode");
      if (saved === "dynamic" || saved === "custom") return saved;
    } catch {}
    return "dynamic";
  });
  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(() => {
    try {
      const saved = localStorage.getItem("sillyclient.themeStyle") || localStorage.getItem("theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {}
    return "dark";
  });
  const [dynamicPaused, setDynamicPaused] = useState(false);
  const themeSwitchFrame = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("sillyclient.bgMode", bgMode);
      localStorage.setItem("sillyclient.themeStyle", themeStyle);
    } catch {}
  }, [bgMode, themeStyle]);

  useEffect(() => () => {
    if (themeSwitchFrame.current !== null) window.cancelAnimationFrame(themeSwitchFrame.current);
  }, []);

  const switchThemeMode = useCallback((apply: () => void, shedAmbient = false) => {
    if (themeSwitchFrame.current !== null) window.cancelAnimationFrame(themeSwitchFrame.current);
    const shedAmbientFirst = shedAmbient && bgMode === "dynamic" && themeStyle === "light";
    if (!shedAmbientFirst) {
      document.querySelector(".ambient-glow-container")?.classList.remove("is-shedding");
      apply();
      return;
    }
    document.querySelector(".ambient-glow-container")?.classList.add("is-shedding");
    themeSwitchFrame.current = window.requestAnimationFrame(() => {
      themeSwitchFrame.current = window.requestAnimationFrame(() => {
        themeSwitchFrame.current = null;
        apply();
      });
    });
  }, [bgMode, themeStyle]);

  return { bgMode, setBgMode, themeStyle, setThemeStyle, dynamicPaused, setDynamicPaused, switchThemeMode };
}
