import React, { useRef, useEffect, useState } from "react";
import { X, Moon, Sun, Check, Image as ImageIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import type { BgMode, ThemeStyle } from "../../types";

export interface BackgroundSettingsDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  safeInsetTop: number;
  bgMode: BgMode;
  setBgMode: (mode: BgMode) => void;
  switchThemeMode: (callback: () => void) => void;
  dynamicPaused: boolean;
  setDynamicPaused: (paused: boolean) => void;
  themeStyle: ThemeStyle;
  setThemeStyle: (style: ThemeStyle) => void;
  customWallpaperUrl: string | null;
  setCustomWallpaperUrl: (url: string | null) => void;
  onSelectWallpaperFile: () => void;
}

/**
 * 背景设置抽屉 (BackgroundSettingsDrawer)
 * 1. 位于顶部导航正下方，居中浮动；
 * 2. 基础模式 vs 自定义模式同位驻留 DOM，实现“白天黑夜级”平滑自适应高度跟随与交叉溶变过渡；
 * 3. 语义化 Z-Index (LAYERS.DRAWER)。
 */
export const BackgroundSettingsDrawer: React.FC<BackgroundSettingsDrawerProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  safeInsetTop,
  bgMode,
  setBgMode,
  switchThemeMode,
  dynamicPaused,
  setDynamicPaused,
  themeStyle,
  setThemeStyle,
  customWallpaperUrl,
  setCustomWallpaperUrl,
  onSelectWallpaperFile,
}) => {
  const bgDynamicRef = useRef<HTMLDivElement>(null);
  const bgCustomRef = useRef<HTMLDivElement>(null);
  const [bgContentHeight, setBgContentHeight] = useState<number | null>(null);

  // 动态测量模式高度实现白天黑夜级平滑过渡
  useEffect(() => {
    const targetEl =
      bgMode === "dynamic" ? bgDynamicRef.current : bgCustomRef.current;
    if (!targetEl) return;

    const updateHeight = () => {
      if (targetEl) {
        const h = targetEl.getBoundingClientRect().height;
        if (h > 0) setBgContentHeight(Math.round(h));
      }
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(() => {
        updateHeight();
      });
      ro.observe(targetEl);
      return () => ro.disconnect();
    }
  }, [bgMode, customWallpaperUrl, isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-floating-menu fixed left-1/2 -translate-x-1/2 w-72 border backdrop-blur-[40px] saturate-180 rounded-[var(--radius-3xl)]",
        isLight
          ? "bg-white/60 border-black/5 shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "glass-panel",
        isLight && "is-light",
        isClosing ? "bg-panel-exit" : "bg-panel-enter"
      )}
      style={{
        zIndex: LAYERS.DRAWER,
        top: `calc(max(env(safe-area-inset-top), ${safeInsetTop + 4}px) + 3.5rem)`,
      }}
    >
      <div className="p-4 space-y-4">
        {/* 标题栏 */}
        <div className="flex items-center justify-between">
          <span
            className={cn(
              "text-sm font-semibold",
              isLight ? "text-[#1a1625]" : "text-white/90"
            )}
          >
            背景设置
          </span>
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded-lg transition-colors",
              isLight
                ? "hover:bg-black/5 text-[#1a1625]/60"
                : "hover:bg-white/5 text-white/40"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 模式选择 */}
        <div className="space-y-1.5">
          <span
            className={cn(
              "text-xs font-medium",
              isLight ? "text-[#1a1625]/50" : "text-white/40"
            )}
          >
            背景模式
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => switchThemeMode(() => setBgMode("dynamic"))}
              aria-pressed={bgMode === "dynamic"}
              className={cn(
                "ios-choice-control px-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                bgMode === "dynamic"
                  ? isLight
                    ? "bg-black/10 border-black/20 text-[#1a1625]"
                    : "bg-white/10 border-white/20 text-white/90"
                  : isLight
                  ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              )}
            >
              基础
            </button>
            <button
              onClick={() => switchThemeMode(() => setBgMode("custom"))}
              aria-pressed={bgMode === "custom"}
              className={cn(
                "ios-choice-control px-2 py-2 rounded-lg text-xs font-medium border transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                bgMode === "custom"
                  ? isLight
                    ? "bg-black/10 border-black/20 text-[#1a1625]"
                    : "bg-white/10 border-white/20 text-white/90"
                  : isLight
                  ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10"
                  : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
              )}
            >
              自定义
            </button>
          </div>
        </div>

        {/* 模式切换容器（平滑高度过渡 + 白天黑夜级优雅溶变） */}
        <div
          className="relative transition-[height] duration-600 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden"
          style={{
            height: bgContentHeight ? `${bgContentHeight}px` : undefined,
          }}
        >
          {/* 动态/基础模式 */}
          <div
            ref={bgDynamicRef}
            className={cn(
              "w-full transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
              bgMode === "dynamic"
                ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto"
                : "absolute inset-x-0 top-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none"
            )}
            aria-hidden={bgMode !== "dynamic"}
          >
            <div className="flex items-center justify-between py-1">
              <span
                className={cn(
                  "text-xs font-medium",
                  isLight ? "text-[#1a1625]" : "text-white/90"
                )}
              >
                动态壁纸
              </span>
              <button
                onClick={() => setDynamicPaused(!dynamicPaused)}
                className="ios-toggle"
                aria-label="切换动态壁纸"
              >
                <div
                  className={cn(
                    "ios-toggle-track",
                    !dynamicPaused && "ios-toggle-track-active"
                  )}
                >
                  <div className="ios-toggle-icons">
                    <span className="ios-toggle-icon-off">○</span>
                    <span className="ios-toggle-icon-on">│</span>
                  </div>
                  <div
                    className={cn(
                      "ios-toggle-thumb",
                      !dynamicPaused && "ios-toggle-thumb-active"
                    )}
                  />
                </div>
              </button>
            </div>
          </div>

          {/* 自定义模式 */}
          <div
            ref={bgCustomRef}
            className={cn(
              "w-full space-y-3 transition-all duration-600 ease-[cubic-bezier(0.22,1,0.36,1)]",
              bgMode === "custom"
                ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto"
                : "absolute inset-x-0 top-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none"
            )}
            aria-hidden={bgMode !== "custom"}
          >
            <div className="space-y-1.5">
              <span
                className={cn(
                  "text-xs font-medium",
                  isLight ? "text-[#1a1625]/50" : "text-white/40"
                )}
              >
                主题风格
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => switchThemeMode(() => setThemeStyle("dark"))}
                  aria-pressed={themeStyle === "dark"}
                  className={cn(
                    "ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                    themeStyle === "dark"
                      ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
                      : isLight
                      ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  )}
                >
                  <Moon className="w-3.5 h-3.5" /> 暗夜
                </button>
                <button
                  onClick={() => switchThemeMode(() => setThemeStyle("light"))}
                  aria-pressed={themeStyle === "light"}
                  className={cn(
                    "ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-all border",
                    themeStyle === "light"
                      ? isLight
                        ? "bg-black/10 border-black/20 text-[#1a1625]"
                        : "bg-white/10 border-white/20 text-white/90"
                      : isLight
                      ? "bg-black/5 border-black/10 text-[#1a1625]/60 hover:bg-black/10"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  )}
                >
                  <Sun className="w-3.5 h-3.5" /> 白天
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <span
                className={cn(
                  "text-xs font-medium",
                  isLight ? "text-[#1a1625]/50" : "text-white/40"
                )}
              >
                壁纸图片
              </span>
              <button
                onClick={onSelectWallpaperFile}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all border",
                  isLight
                    ? "bg-black/5 border-black/10 hover:bg-black/10 text-[#1a1625]"
                    : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    customWallpaperUrl
                      ? isLight
                        ? "bg-black/10 text-[#1a1625]/70"
                        : "bg-white/10 text-white/70"
                      : isLight
                      ? "bg-black/10 text-[#1a1625]/50"
                      : "bg-white/10 text-white/50"
                  )}
                >
                  {customWallpaperUrl ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div
                    className={cn(
                      "text-xs font-medium",
                      isLight ? "text-[#1a1625]" : "text-white/90"
                    )}
                  >
                    {customWallpaperUrl ? "已导入壁纸" : "导入本地图片"}
                  </div>
                  <div
                    className={cn(
                      "text-[10px] truncate",
                      isLight ? "text-[#1a1625]/50" : "text-white/40"
                    )}
                  >
                    {customWallpaperUrl ? "点击更换" : "支持 JPG / PNG / WebP"}
                  </div>
                </div>
              </button>
              {customWallpaperUrl && (
                <button
                  onClick={() => setCustomWallpaperUrl(null)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-[10px] font-medium transition-all border",
                    isLight
                      ? "bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/15"
                      : "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
                  )}
                >
                  移除壁纸
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
