import React, { useRef, useLayoutEffect, useState, useEffect } from "react";
import { X, Moon, Sun, Check, Image as ImageIcon, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { triggerPanelStackDissolve } from "../../lib/panel-dissolve";
import { ActionButton } from "../common/ActionButton";
import { ToggleSwitch } from "../common/ToggleSwitch";
import {
  UI_SCALE_MAX,
  UI_SCALE_MIN,
  UI_SCALE_STEP,
  formatUiScaleLabel,
  normalizeUiScale,
} from "../../lib/ui-scale";
import type { BgMode, ThemeStyle } from "../../types";


export interface BackgroundSettingsDrawerProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  safeInsetTop: number;
  bgMode: BgMode;
  setBgMode: (mode: BgMode) => void;
  switchThemeMode: (callback: () => void, shedAmbient?: boolean) => void;
  dynamicPaused: boolean;
  setDynamicPaused: (paused: boolean) => void;
  themeStyle: ThemeStyle;
  setThemeStyle: (style: ThemeStyle) => void;
  customWallpaperUrl: string | null;
  setCustomWallpaperUrl: (url: string | null) => void;
  onSelectWallpaperFile: () => void;
  uiScale: number;
  onUiScaleChange: (scale: number) => void;
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
  uiScale,
  onUiScaleChange,
}) => {
  const panelStackRef = useRef<HTMLDivElement>(null);
  const bgDynamicRef = useRef<HTMLDivElement>(null);
  const bgCustomRef = useRef<HTMLDivElement>(null);
  const scaleTrackRef = useRef<HTMLDivElement>(null);
  const scaleDragRectRef = useRef<{ left: number; width: number; height: number } | null>(null);
  const scalePointerIdRef = useRef<number | null>(null);
  const [dragScaleRatio, setDragScaleRatio] = useState<number | null>(null);
  const [scaleExpanded, setScaleExpanded] = useState(false);

  useEffect(() => {
    if (!isOpen && !isClosing) {
      setScaleExpanded(false);
    }
  }, [isOpen, isClosing]);

  const scaleSpan = UI_SCALE_MAX - UI_SCALE_MIN;
  const committedScale = normalizeUiScale(uiScale);
  const committedRatio = Math.min(1, Math.max(0, (committedScale - UI_SCALE_MIN) / scaleSpan));
  const activeRatio = dragScaleRatio ?? committedRatio;
  const displayScale =
    dragScaleRatio === null
      ? committedScale
      : normalizeUiScale(UI_SCALE_MIN + dragScaleRatio * scaleSpan);

  const ratioFromClientX = (clientX: number, rect: { left: number; width: number; height: number }) => {
    const inset = (rect.height || 22) / 2;
    const span = Math.max(1, rect.width - inset * 2);
    const clampedX = Math.min(rect.width - inset, Math.max(inset, clientX - rect.left));
    return (clampedX - inset) / span;
  };

  const commitScaleDrag = (clientX: number | null, target: HTMLDivElement, pointerId: number) => {
    if (scalePointerIdRef.current !== pointerId) return;
    const rect = scaleDragRectRef.current;
    scalePointerIdRef.current = null;
    scaleDragRectRef.current = null;
    if (target.hasPointerCapture?.(pointerId)) {
      target.releasePointerCapture(pointerId);
    }
    const nextRatio = rect && clientX !== null ? ratioFromClientX(clientX, rect) : dragScaleRatio;
    setDragScaleRatio(null);
    if (nextRatio === null) return;
    const nextScale = normalizeUiScale(UI_SCALE_MIN + nextRatio * scaleSpan);
    if (nextScale !== committedScale) {
      onUiScaleChange(nextScale);
    }
  };

  // 动态测量模式高度：直接写入容器高度以避免弹出首帧二次同步 React 重渲染，同时保留模式切换平滑过渡
  useLayoutEffect(() => {
    if (!isOpen) return;
    const stackEl = panelStackRef.current;
    const targetEl =
      bgMode === "dynamic" ? bgDynamicRef.current : bgCustomRef.current;
    if (!stackEl || !targetEl) return;

    const updateHeight = (entry?: ResizeObserverEntry) => {
      const h = entry?.borderBoxSize?.[0]?.blockSize ?? targetEl.offsetHeight;
      if (h > 0) {
        const nextHeight = `${Math.ceil(h)}px`;
        const prevHeight = stackEl.style.height;
        if (prevHeight && prevHeight !== nextHeight) {
          triggerPanelStackDissolve(stackEl, { restart: true });
        }
        stackEl.style.height = nextHeight;
      }
    };

    updateHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([entry]) => {
        updateHeight(entry);
      });
      ro.observe(targetEl);
      return () => ro.disconnect();
    }
  }, [bgMode, customWallpaperUrl, isOpen]);

  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-floating-menu fixed left-1/2 -translate-x-1/2 w-72 border-0 backdrop-blur-[40px] saturate-180 rounded-[var(--radius-3xl)] overflow-y-auto scrollbar-hidden",
        isLight && "is-light",
        isClosing ? "bg-panel-exit" : "bg-panel-enter"
      )}
      style={{
        zIndex: LAYERS.DRAWER,
        top: `calc(max(env(safe-area-inset-top), ${safeInsetTop + 4}px) + 3.5rem)`,
        maxWidth: "calc(var(--ui-vw, 100vw) - 2rem)",
        maxHeight: "calc(var(--ui-dvh, 100dvh) - 6rem)",
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
            data-onboarding-target="background-close"
            className={cn(
              "p-1 rounded-lg transition-colors",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
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
          <div className="ios-choice-track" role="group" aria-label="背景模式">
            <button
              type="button"
              onClick={() => switchThemeMode(() => setBgMode("dynamic"))}
              aria-pressed={bgMode === "dynamic"}
              className="ios-choice-control px-2 py-2 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              基础
            </button>
            <button
              type="button"
              onClick={() => switchThemeMode(() => setBgMode("custom"), true)}
              aria-pressed={bgMode === "custom"}
              className="ios-choice-control px-2 py-2 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
            >
              自定义
            </button>
          </div>
        </div>

        {/* 模式切换容器（平滑高度过渡 + 白天黑夜级优雅溶变） */}
        <div ref={panelStackRef} className="motion-panel-stack">
          {/* 动态/基础模式 */}
          <div
            ref={bgDynamicRef}
            className={cn(
              "motion-panel-face w-full",
              bgMode === "dynamic"
                ? "is-active relative pointer-events-auto"
                : "absolute inset-x-0 top-0 pointer-events-none select-none"
            )}
            aria-hidden={bgMode !== "dynamic"}
            inert={bgMode !== "dynamic"}
          >
            <div className="setting-row flex items-center justify-between py-1">
              <span
                className={cn(
                  "setting-label text-xs font-medium",
                  isLight ? "text-[#1a1625]" : "text-white/90"
                )}
              >
                动态壁纸
              </span>
              <ToggleSwitch
                on={!dynamicPaused}
                onChange={(enabled) => setDynamicPaused(!enabled)}
                isLight={isLight}
                ariaLabel="切换动态壁纸"
              />
            </div>
          </div>

          {/* 自定义模式 */}
          <div
            ref={bgCustomRef}
            className={cn(
              "motion-panel-face w-full space-y-3",
              bgMode === "custom"
                ? "is-active relative pointer-events-auto"
                : "absolute inset-x-0 top-0 pointer-events-none select-none"
            )}
            aria-hidden={bgMode !== "custom"}
            inert={bgMode !== "custom"}
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
              <div className="ios-choice-track" role="group" aria-label="主题风格">
                <button
                  type="button"
                  onClick={() => switchThemeMode(() => setThemeStyle("dark"))}
                  aria-pressed={themeStyle === "dark"}
                  className="ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                >
                  <Moon className="w-3.5 h-3.5" /> 暗夜
                </button>
                <button
                  type="button"
                  onClick={() => switchThemeMode(() => setThemeStyle("light"))}
                  aria-pressed={themeStyle === "light"}
                  className="ios-choice-control flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
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
                  "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-colors border-0",
                  isLight
                    ? "bg-black/[0.04] text-[#1a1625]/75 hover:text-[#1a1625]"
                    : "bg-white/[0.045] text-white/75 hover:text-white"
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
                <ActionButton
                  tone="danger"
                  onClick={() => setCustomWallpaperUrl(null)}
                  className="w-full !h-8 text-xs"
                >
                  移除壁纸
                </ActionButton>
              )}
            </div>
          </div>
        </div>

        {/* 界面缩放（默认折叠，按需展开为与壁纸磨砂强度一致的液态玻璃调节拨杆） */}
        <div
          className={cn(
            "pt-3.5 border-t",
            isLight ? "border-black/[0.06]" : "border-white/[0.055]"
          )}
        >
          <button
            type="button"
            aria-expanded={scaleExpanded}
            aria-controls="bg-ui-scale-panel"
            onClick={() => setScaleExpanded((prev) => !prev)}
            className={cn(
              "motion-control group flex w-full items-center justify-between py-0.5 text-xs font-medium",
              isLight
                ? scaleExpanded
                  ? "text-[#1a1625]"
                  : "text-[#1a1625]/60 hover:text-[#1a1625]"
                : scaleExpanded
                ? "text-white/90"
                : "text-white/55 hover:text-white/90"
            )}
          >
            <span>界面缩放</span>
            <span className="flex items-center gap-1.5 flex-shrink-0">
              <span
                data-scale-value
                className={cn(
                  "text-[10px] font-normal tabular-nums transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isLight
                    ? "text-[#1a1625]/35 group-hover:text-[#1a1625]/55"
                    : "text-white/30 group-hover:text-white/50"
                )}
              >
                {formatUiScaleLabel(displayScale)}
              </span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 flex-shrink-0 transition-[transform,color] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                  isLight
                    ? "text-[#1a1625]/40 group-hover:text-[#1a1625]/70"
                    : "text-white/35 group-hover:text-white/70",
                  scaleExpanded && "rotate-180"
                )}
              />
            </span>
          </button>

          <div
            id="bg-ui-scale-panel"
            className={cn("motion-accordion bg-ui-scale-accordion", scaleExpanded && "is-open")}
            aria-hidden={!scaleExpanded}
            inert={!scaleExpanded}
          >
            <div className="motion-accordion-inner">
              <div className="pt-2.5 pb-1">
                <div
                  className={cn(
                    "sc-tactile-slider",
                    isLight && "is-light",
                    dragScaleRatio !== null && "is-dragging"
                  )}
                  role="slider"
                  tabIndex={0}
                  aria-label="界面缩放"
                  aria-valuemin={Math.round(UI_SCALE_MIN * 100)}
                  aria-valuemax={Math.round(UI_SCALE_MAX * 100)}
                  aria-valuenow={Math.round(displayScale * 100)}
                  aria-valuetext={formatUiScaleLabel(displayScale)}
                  aria-orientation="horizontal"
                  style={{ "--sc-slider-t": String(activeRatio) } as React.CSSProperties}
                  onPointerDown={(e) => {
                    if (e.pointerType === "mouse" && e.button !== 0) return;
                    const rect = scaleTrackRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    e.preventDefault();
                    e.currentTarget.focus({ preventScroll: true });
                    scalePointerIdRef.current = e.pointerId;
                    scaleDragRectRef.current = { left: rect.left, width: rect.width, height: rect.height };
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setDragScaleRatio(ratioFromClientX(e.clientX, scaleDragRectRef.current));
                  }}
                  onPointerMove={(e) => {
                    if (scalePointerIdRef.current !== e.pointerId || !scaleDragRectRef.current) return;
                    setDragScaleRatio(ratioFromClientX(e.clientX, scaleDragRectRef.current));
                  }}
                  onPointerUp={(e) => commitScaleDrag(e.clientX, e.currentTarget, e.pointerId)}
                  onPointerCancel={(e) => commitScaleDrag(null, e.currentTarget, e.pointerId)}
                  onLostPointerCapture={() => {
                    scalePointerIdRef.current = null;
                    scaleDragRectRef.current = null;
                    setDragScaleRatio(null);
                  }}
                  onKeyDown={(e) => {
                    let next: number | null = null;
                    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = committedScale + UI_SCALE_STEP;
                    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = committedScale - UI_SCALE_STEP;
                    else if (e.key === "Home") next = UI_SCALE_MIN;
                    else if (e.key === "End") next = UI_SCALE_MAX;
                    if (next === null) return;
                    e.preventDefault();
                    const normalized = normalizeUiScale(next);
                    if (normalized !== committedScale) onUiScaleChange(normalized);
                  }}
                >
                  <div ref={scaleTrackRef} className="sc-tactile-slider__track" aria-hidden="true">
                    <span className="sc-tactile-slider__fill" />
                    <span className="sc-tactile-slider__knob" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
