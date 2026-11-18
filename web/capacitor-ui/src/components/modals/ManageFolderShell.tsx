import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import { buildFolderTabSvgPath, projectTabToClipViewport } from "../../lib/folder-tab-geometry";
import {
  easeSharedTransition,
  MANAGE_PAGE_TRANSITION_MS,
} from "../../lib/manage-shared-transition";

export interface FolderTabItem<T extends string = string> {
  id: T;
  label: string;
  dataOnboardingTarget?: string;
}

export interface ManageFolderShellProps<T extends string = string> {
  tabs: readonly FolderTabItem<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
  isPortrait: boolean;
  isLight: boolean;
  tabHeight: number;
  paneRadius: number;
  tabRadius: number;
  filletRadius: number;
  tabFontSize?: number | string;
  closeButton?: ReactNode;
  paneRef: RefObject<HTMLElement | null>;
  className?: string;
  children: ReactNode;
}

interface TrackRect {
  left: number;
  width: number;
}

interface BoxSize {
  width: number;
  height: number;
}

const SLIDE_DURATION_MS = MANAGE_PAGE_TRANSITION_MS;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * 文件夹式一体连通标签外壳：
 * - 单条闭合 SVG 路径一体渲染上方激活页签凸耳、底角反圆弧顺切与下方设置面板，消灭双层透明叠影与半像素拼缝；
 * - 页签切换时在轨道坐标内做 60fps 滑移插值，几何引擎按边界余量自动等比收敛圆角至 0；
 * - 窄屏或缩放溢出时显示 `<` / `>` 滚动按钮，只移动导航轨道不切换激活内容，溢出部分按裁切视口优雅下沉回收。
 */
export function ManageFolderShell<T extends string = string>({
  tabs,
  activeTab,
  onSelectTab,
  isPortrait,
  isLight,
  tabHeight,
  paneRadius,
  tabRadius,
  filletRadius,
  tabFontSize,
  closeButton,
  paneRef,
  className,
  children,
}: ManageFolderShellProps<T>) {
  const shellRef = useRef<HTMLDivElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabInnerRef = useRef<HTMLDivElement>(null);
  const tabButtonRefs = useRef<Partial<Record<T, HTMLButtonElement | null>>>({});

  const [boxSize, setBoxSize] = useState<BoxSize>({ width: 0, height: 0 });
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const trackRectRef = useRef<TrackRect | null>(null);
  const [renderedRect, setRenderedRect] = useState<TrackRect | null>(null);
  const [viewportMetrics, setViewportMetrics] = useState<{
    scrollLeft: number;
    clipLeft: number;
    clipRight: number;
  }>({ scrollLeft: 0, clipLeft: 0, clipRight: 0 });

  const animFrameRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const prevActiveTabRef = useRef<T>(activeTab);
  const hasOverflowRef = useRef(hasOverflow);
  hasOverflowRef.current = hasOverflow;

  const measureTabTrackRect = useCallback((tabId: T): TrackRect | null => {
    const btn = tabButtonRefs.current[tabId];
    if (!btn) return null;
    return {
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    };
  }, []);

  const syncScrollAndOverflow = useCallback(() => {
    const shell = shellRef.current;
    const nav = navRef.current;
    const scroller = scrollerRef.current;
    const inner = tabInnerRef.current;
    if (!shell || !nav || !scroller) return;

    const shellW = shell.clientWidth;
    const shellH = shell.clientHeight;
    if (shellW > 0 && shellH > 0) {
      setBoxSize(prev => (prev.width === shellW && prev.height === shellH ? prev : { width: shellW, height: shellH }));
    }

    const navW = nav.clientWidth;
    // 防抖震荡：非溢出时用 scrollWidth vs scroller.clientWidth 判进入；
    // 已溢出时按钮为自然宽，直接对比 naturalWidth vs nav.clientWidth 判退出。
    const naturalWidth = inner ? inner.scrollWidth : scroller.scrollWidth;
    const nextOverflow = hasOverflowRef.current
      ? naturalWidth > navW - 2
      : naturalWidth > scroller.clientWidth + 2;

    if (nextOverflow !== hasOverflowRef.current) {
      hasOverflowRef.current = nextOverflow;
      setHasOverflow(nextOverflow);
    }

    const scrollLeft = scroller.scrollLeft;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const nextLeft = nextOverflow && scrollLeft > 1;
    const nextRight = nextOverflow && maxScroll - scrollLeft > 1;
    setCanScrollLeft(prev => (prev === nextLeft ? prev : nextLeft));
    setCanScrollRight(prev => (prev === nextRight ? prev : nextRight));

    const clipLeft = scroller.offsetLeft;
    const clipRight = clipLeft + scroller.clientWidth;
    setViewportMetrics(prev =>
      prev.scrollLeft === scrollLeft && prev.clipLeft === clipLeft && prev.clipRight === clipRight
        ? prev
        : { scrollLeft, clipLeft, clipRight }
    );
  }, []);

  const cancelAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  useEffect(() => () => {
    cancelAnimation();
    if (scrollFrameRef.current !== null) {
      cancelAnimationFrame(scrollFrameRef.current);
    }
  }, [cancelAnimation]);

  // 监测容器与按钮宽度变化（窗口调整、横竖屏切换、字体加载、语言渲染）
  useLayoutEffect(() => {
    syncScrollAndOverflow();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      syncScrollAndOverflow();
      const target = measureTabTrackRect(activeTab);
      if (target && animFrameRef.current === null) {
        trackRectRef.current = target;
        setRenderedRect(target);
      }
    });
    if (shellRef.current) observer.observe(shellRef.current);
    if (navRef.current) observer.observe(navRef.current);
    if (tabInnerRef.current) observer.observe(tabInnerRef.current);
    return () => observer.disconnect();
  }, [activeTab, isPortrait, tabs, measureTabTrackRect, syncScrollAndOverflow]);

  // 切换标签时执行 60fps 滑移插值；当且仅当选中标签切换且处于视口外时自动卷回可见范围
  useLayoutEffect(() => {
    syncScrollAndOverflow();
    const target = measureTabTrackRect(activeTab);
    if (!target) return;

    const from = trackRectRef.current;
    const tabChanged = prevActiveTabRef.current !== activeTab;
    prevActiveTabRef.current = activeTab;

    const scroller = scrollerRef.current;
    if (scroller && hasOverflowRef.current && tabChanged) {
      const viewLeft = scroller.scrollLeft;
      const viewRight = viewLeft + scroller.clientWidth;
      const tabLeftEdge = target.left;
      const tabRightEdge = target.left + target.width;
      const pad = 12;
      if (tabLeftEdge < viewLeft + pad) {
        scroller.scrollTo({
          left: Math.max(0, tabLeftEdge - pad),
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      } else if (tabRightEdge > viewRight - pad) {
        scroller.scrollTo({
          left: Math.max(0, tabRightEdge - scroller.clientWidth + pad),
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    }

    if (!from || !tabChanged || prefersReducedMotion()) {
      cancelAnimation();
      trackRectRef.current = target;
      setRenderedRect(target);
      return;
    }

    cancelAnimation();
    const startLeft = from.left;
    const startWidth = from.width;
    const deltaLeft = target.left - startLeft;
    const deltaWidth = target.width - startWidth;
    if (Math.abs(deltaLeft) < 0.25 && Math.abs(deltaWidth) < 0.25) {
      trackRectRef.current = target;
      setRenderedRect(target);
      return;
    }

    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = now - startTime;
      const rawT = Math.min(1, elapsed / SLIDE_DURATION_MS);
      const eased = easeSharedTransition(rawT);
      const next: TrackRect = {
        left: startLeft + deltaLeft * eased,
        width: startWidth + deltaWidth * eased,
      };
      trackRectRef.current = next;
      setRenderedRect(next);
      if (rawT < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        animFrameRef.current = null;
        const settled = measureTabTrackRect(activeTab) ?? target;
        trackRectRef.current = settled;
        setRenderedRect(settled);
      }
    };
    animFrameRef.current = requestAnimationFrame(step);
  }, [activeTab, isPortrait, hasOverflow, cancelAnimation, measureTabTrackRect, syncScrollAndOverflow]);

  const handleScrollerScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      syncScrollAndOverflow();
    });
  }, [syncScrollAndOverflow]);

  const scrollTabsBy = useCallback((direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const current = scroller.scrollLeft;
    const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const rects = tabs
      .map((t) => measureTabTrackRect(t.id))
      .filter((r): r is TrackRect => r !== null);

    let nextScroll = current + direction * Math.max(80, Math.round(scroller.clientWidth * 0.56));
    if (rects.length > 0) {
      if (direction > 0) {
        const nextTab = rects.find((r) => r.left > current + 8);
        nextScroll = nextTab ? Math.min(maxScroll, nextTab.left) : maxScroll;
      } else {
        const prevCandidates = rects.filter((r) => r.left < current - 8);
        nextScroll = prevCandidates.length > 0 ? Math.max(0, prevCandidates[prevCandidates.length - 1].left) : 0;
      }
    }

    scroller.scrollTo({
      left: Math.max(0, Math.min(maxScroll, nextScroll)),
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [tabs, measureTabTrackRect]);

  const effectiveTabHeight = topBarRef.current?.clientHeight || tabHeight;
  const activeRect = renderedRect ?? measureTabTrackRect(activeTab) ?? { left: 0, width: 0 };
    const projectedRaw = projectTabToClipViewport(
    activeRect.left,
    activeRect.width,
    viewportMetrics.scrollLeft,
    viewportMetrics.clipLeft,
    viewportMetrics.clipRight > viewportMetrics.clipLeft ? viewportMetrics.clipRight : boxSize.width
  );
  // 若贴近面板右边界且未受关闭按钮/向右箭头占位，吸附最后 1.5px 子像素误差以实现无痕直下融合
  const projected =
    !hasOverflow &&
    projectedRaw.tabWidth > 0 &&
    boxSize.width - (projectedRaw.tabLeft + projectedRaw.tabWidth) <= 1.5 &&
    viewportMetrics.clipRight >= boxSize.width - 1.5
      ? { ...projectedRaw, tabWidth: Math.max(0, boxSize.width - projectedRaw.tabLeft) }
      : projectedRaw;

  const shapeBase = {
    width: boxSize.width,
    height: boxSize.height,
    tabHeight: effectiveTabHeight,
    tabLeft: projected.tabLeft,
    tabWidth: projected.tabWidth,
    paneRadius,
    tabRadius,
    filletRadius,
    collapseRatio: projected.collapseRatio,
  };

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const clipId = `folder-clip-${uid}`;
  const shadowFilterId = `folder-shadow-${uid}`;
  const glowFilterId = `folder-glow-${uid}`;
  const shadowGradId = `folder-shadow-grad-${uid}`;
  const bounceGradId = `folder-bounce-grad-${uid}`;

  const fillPath = boxSize.width > 0 && boxSize.height > 0
    ? buildFolderTabSvgPath({ ...shapeBase, inset: 0 })
    : "";
  const outerHolePath = fillPath
    ? `M -48 -48 H ${boxSize.width + 48} V ${boxSize.height + 48} H -48 Z ${fillPath}`
    : "";

  const shadowBaseHex = isLight ? "#1a1625" : "#000000";
  const shadowOpacity = isLight ? 0.085 : 0.28;
  const bounceOpacity = isLight ? 0.58 : 0.055;
  const arrowSize = isPortrait ? 28 : 30;

  return (
    <div
      ref={shellRef}
      className={cn("manage-folder-shell relative flex min-h-0 min-w-0 flex-1 flex-col", className)}
    >
      {fillPath && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${boxSize.width} ${boxSize.height}`}
          preserveAspectRatio="none"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={fillPath} />
            </clipPath>
            <filter
              id={shadowFilterId}
              filterUnits="userSpaceOnUse"
              x={-24}
              y={-24}
              width={boxSize.width + 48}
              height={boxSize.height + 48}
            >
              <feGaussianBlur stdDeviation="1.5 2.8" />
            </filter>
            <filter
              id={glowFilterId}
              filterUnits="userSpaceOnUse"
              x={-24}
              y={-24}
              width={boxSize.width + 48}
              height={boxSize.height + 48}
            >
              <feGaussianBlur stdDeviation="1.2 1.8" />
            </filter>
            <linearGradient id={shadowGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={shadowBaseHex} stopOpacity={shadowOpacity} />
              <stop offset="72%" stopColor={shadowBaseHex} stopOpacity={shadowOpacity * 0.72} />
              <stop offset="100%" stopColor={shadowBaseHex} stopOpacity={0} />
            </linearGradient>
            <linearGradient id={bounceGradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ffffff" stopOpacity={0} />
              <stop offset="68%" stopColor="#ffffff" stopOpacity={0} />
              <stop offset="100%" stopColor="#ffffff" stopOpacity={bounceOpacity} />
            </linearGradient>
          </defs>

          {/* 无边框纯色差底衬：与左侧实例槽保持同源色差厚度 */}
          <path d={fillPath} fill="var(--manage-well-fill)" />

          {/* 极轻拟物凹凸雕琢：严格裁切于廓形内，仅用柔焦顶部内阴与微弱底边反光形成无描边立体感 */}
          <g clipPath={`url(#${clipId})`}>
            <path
              d={outerHolePath}
              fill={`url(#${shadowGradId})`}
              fillRule="evenodd"
              transform="translate(0, 2)"
              filter={`url(#${shadowFilterId})`}
            />
            <path
              d={outerHolePath}
              fill={`url(#${bounceGradId})`}
              fillRule="evenodd"
              transform="translate(0, -1.2)"
              filter={`url(#${glowFilterId})`}
            />
          </g>
        </svg>
      )}

      {/* 顶部一体标签行：左侧可滚动分类耳标，桌面右侧集成关闭按钮 */}
      <div
        ref={topBarRef}
        className="manage-folder-top relative z-[2] flex w-full flex-shrink-0 items-stretch select-none"
        style={{ height: tabHeight }}
      >
        <div
          ref={navRef}
          className="manage-folder-nav flex min-w-0 flex-1 items-stretch"
        >
          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollTabsBy(-1)}
              disabled={!canScrollLeft}
              aria-label="向左滚动分类标签"
              title="向左查看更多标签"
              className={cn(
                "manage-folder-scroll-btn motion-control flex flex-shrink-0 items-center justify-center border-0 bg-transparent outline-none",
                isLight ? "text-[#1a1625]/72 hover:text-[#1a1625]" : "text-white/72 hover:text-white",
                !canScrollLeft && "is-disabled"
              )}
              style={{
                width: arrowSize,
                height: isPortrait ? tabHeight : Math.max(32, tabHeight - 10),
                alignSelf: "flex-start",
              }}
            >
              <ChevronLeft className="h-[15px] w-[15px]" />
            </button>
          )}

          <div
            ref={scrollerRef}
            onScroll={handleScrollerScroll}
            className={cn(
              "manage-folder-scroller flex min-w-0 flex-1 items-stretch overflow-x-auto overflow-y-hidden",
              canScrollLeft && "has-fade-left",
              canScrollRight && "has-fade-right"
            )}
          >
            <div
              ref={tabInnerRef}
              role="tablist"
              aria-label="实例设置分类"
              className={cn(
                "manage-folder-tabs-inner relative flex items-stretch",
                !hasOverflow && isPortrait ? "w-full" : "w-max"
              )}
            >
              {tabs.map((item) => {
                const selected = activeTab === item.id;
                const fillEvenly = !hasOverflow && isPortrait;
                return (
                  <button
                    key={item.id}
                    ref={(el) => { tabButtonRefs.current[item.id] = el; }}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    data-active={selected ? "true" : "false"}
                    data-onboarding-target={item.dataOnboardingTarget}
                    onClick={() => onSelectTab(item.id)}
                    className={cn(
                      "manage-folder-tab motion-control relative flex items-center justify-center whitespace-nowrap border-0 bg-transparent outline-none",
                      fillEvenly ? "flex-1 basis-0" : "flex-shrink-0",
                      selected
                        ? isLight
                          ? "font-semibold text-[#1a1625]"
                          : "font-semibold text-white/95"
                        : isLight
                          ? "font-medium text-[#1a1625]/50 hover:text-[#1a1625]/82"
                          : "font-medium text-white/46 hover:text-white/82"
                    )}
                    style={{
                      fontSize: tabFontSize,
                      height: tabHeight,
                      paddingInline: isPortrait ? 12 : 22,
                      paddingBottom: isPortrait ? 1 : 8,
                    }}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {hasOverflow && (
            <button
              type="button"
              onClick={() => scrollTabsBy(1)}
              disabled={!canScrollRight}
              aria-label="向右滚动分类标签"
              title="向右查看更多标签"
              className={cn(
                "manage-folder-scroll-btn motion-control flex flex-shrink-0 items-center justify-center border-0 bg-transparent outline-none",
                isLight ? "text-[#1a1625]/72 hover:text-[#1a1625]" : "text-white/72 hover:text-white",
                !canScrollRight && "is-disabled"
              )}
              style={{
                width: arrowSize,
                height: isPortrait ? tabHeight : Math.max(32, tabHeight - 10),
                alignSelf: "flex-start",
              }}
            >
              <ChevronRight className="h-[15px] w-[15px]" />
            </button>
          )}
        </div>

        {!isPortrait && closeButton && (
          <div
            className="flex flex-shrink-0 items-start justify-end"
            style={{ marginLeft: 12 }}
          >
            {closeButton}
          </div>
        )}
      </div>

      {/* 一体化设置内容宿主区：透明背景由外层 SVG 统一承担填充与轮廓描边 */}
      <section
        ref={paneRef}
        className={cn(
          "manage-folder-pane relative z-[1] flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          isLight ? "text-[#1a1625]" : "text-white/88"
        )}
        style={{
          borderBottomLeftRadius: paneRadius,
          borderBottomRightRadius: paneRadius,
        }}
      >
        {children}
      </section>
    </div>
  );
}
