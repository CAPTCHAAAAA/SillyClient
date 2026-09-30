import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { TavernInstance } from "../../types";
import { InstanceCard } from "./InstanceCard";

export interface InstanceCarouselRef {
  goToSlide: (index: number) => void;
  activeSlide: number;
}

export interface InstanceCarouselProps {
  instances: TavernInstance[];
  isLight: boolean;
  glassBg?: string;
  hoveredCard: string | null;
  setHoveredCard: (id: string | null) => void;
  activeCardMenu: string | null;
  launchingId: string | null;
  onLaunch: (instance: TavernInstance) => void;
  onReturnToTavern?: (instance: TavernInstance) => void;
  onStopInstance?: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  onRenameSave: (instanceId: string, newName: string) => void;
  externallyRenamingId?: string | null;
  onClearExternalRenaming?: () => void;
  terminalLogs?: { msg: string; level?: string }[];
  setTerminalLogs?: React.Dispatch<React.SetStateAction<{ msg: string; level?: string }[]>>;
  isWindows?: boolean;
  isWeb?: boolean;
  isShowcase?: boolean;
  onNewInstance: () => void;
  activeSlide?: number;
  onActiveSlideChange?: (index: number) => void;
}

/**
 * 实例轮播组件 (InstanceCarousel)
 * 高内聚低耦合：
 * - 拥有独立的滚动容器、手势拖拽、触控与键盘原生导航；
 * - 搭载精确的物理视口中心对齐与无频闪（Zero Flicker）平滑插值引擎；
 * - 杜绝 CSS Scroll-Snap 与平滑滚动互斥冲突，消灭指示器与翻页键频闪。
 */
export const InstanceCarousel = forwardRef<InstanceCarouselRef, InstanceCarouselProps>(({
  instances,
  isLight,
  glassBg,
  hoveredCard,
  setHoveredCard,
  activeCardMenu,
  launchingId,
  onLaunch,
  onReturnToTavern,
  onStopInstance,
  onOpenMenu,
  onRenameSave,
  externallyRenamingId,
  onClearExternalRenaming,
  terminalLogs,
  setTerminalLogs,
  isWindows = false,
  isWeb = false,
  isShowcase = false,
  onNewInstance,
  activeSlide: activeSlideProp,
  onActiveSlideChange,
}, ref) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [internalActiveSlide, setInternalActiveSlide] = useState(activeSlideProp ?? 0);
  const activeSlide = activeSlideProp !== undefined ? activeSlideProp : internalActiveSlide;

  const setActiveSlide = useCallback((index: number) => {
    setInternalActiveSlide(index);
    onActiveSlideChange?.(index);
  }, [onActiveSlideChange]);

  useEffect(() => {
    if (activeSlideProp !== undefined) {
      setInternalActiveSlide(activeSlideProp);
    }
  }, [activeSlideProp]);
  const totalSlides = instances.length + 1; // 0: 新建实例, 1..N: 实例卡片

  // 程序化滚动状态锁定，防止滚动中间帧触发指示器闪烁
  const isProgrammaticScrollingRef = useRef(false);
  const activeSlideRef = useRef(0);
  activeSlideRef.current = activeSlide;

  const animationFrameIdRef = useRef<number | null>(null);

  // 平滑滚动至指定索引卡片（基于精确物理中心对齐 + RAF 柔性无频闪曲线）
  const goToSlide = useCallback((targetIndex: number) => {
    const el = carouselRef.current;
    if (!el) return;

    const clampedIndex = Math.max(0, Math.min(totalSlides - 1, targetIndex));
    const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
    const target = cards[clampedIndex];
    if (!target) return;

    // 立即锁定目标指示器，杜绝中间状态反向抖动
    isProgrammaticScrollingRef.current = true;
    setActiveSlide(clampedIndex);

    // 取消正在进行的滚动动画
    if (animationFrameIdRef.current !== null) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }

    const startScroll = el.scrollLeft;
    const targetCenter = target.getBoundingClientRect().left + target.offsetWidth / 2;
    const containerCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
    const distanceToCenter = targetCenter - containerCenter;
    const targetScroll = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, startScroll + distanceToCenter));

    // 如果已经在目标位置，直接释放锁定
    if (Math.abs(targetScroll - startScroll) < 1) {
      isProgrammaticScrollingRef.current = false;
      return;
    }

    // 动画期间临时解开 CSS 强制吸附，杜绝 Blink 引擎逐帧抢占抽搐
    el.style.scrollSnapType = "none";

    const duration = 280; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic: 1 - (1 - t)^3
      const ease = 1 - Math.pow(1 - progress, 3);
      el.scrollLeft = startScroll + (targetScroll - startScroll) * ease;

      if (progress < 1) {
        animationFrameIdRef.current = requestAnimationFrame(animate);
      } else {
        el.scrollLeft = targetScroll;
        el.style.scrollSnapType = "x mandatory";
        animationFrameIdRef.current = null;
        // 微小延迟释放锁定，确保滚动惯性完全静止
        setTimeout(() => {
          isProgrammaticScrollingRef.current = false;
        }, 30);
      }
    };

    animationFrameIdRef.current = requestAnimationFrame(animate);
  }, [totalSlides]);

  useImperativeHandle(ref, () => ({
    goToSlide,
    activeSlide,
  }), [goToSlide, activeSlide]);

  // 当存在运行中实例且初次感知时，居中平滑聚焦至该卡片
  const prevRunningIdRef = useRef<string | null>(null);
  useEffect(() => {
    const runningInstance = instances.find(i => i.status === "running");
    const runningId = runningInstance ? runningInstance.id : null;
    if (runningId && runningId !== prevRunningIdRef.current) {
      prevRunningIdRef.current = runningId;
      const runningIdx = instances.findIndex(i => i.id === runningId);
      if (runningIdx >= 0) {
        goToSlide(runningIdx + 1);
      }
    } else if (!runningId) {
      prevRunningIdRef.current = null;
    }
  }, [instances, goToSlide]);

  // 键盘左右箭头原生翻页快捷支持
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable ||
          target.closest("[role='dialog']") ||
          target.closest(".modal-backdrop"))
      ) {
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToSlide(activeSlideRef.current - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToSlide(activeSlideRef.current + 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToSlide]);

  // 拖拽手势与原生滚动指示器联动
  const dragState = useRef<{ isDown: boolean; startX: number; scrollLeft: number }>({ isDown: false, startX: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest("input, textarea, select, [contenteditable='true']")) {
        return;
      }
      const x = "touches" in e ? e.touches[0].pageX : e.pageX;
      dragState.current = { isDown: true, startX: x - el.offsetLeft, scrollLeft: el.scrollLeft };
      el.style.cursor = "grabbing";
      el.style.scrollSnapType = "none";
    };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current.isDown) return;
      if ("touches" in e) return; // 触屏交给原生滚动以保证跟手流畅
      e.preventDefault();
      const x = e.pageX;
      const walk = x - el.offsetLeft - dragState.current.startX;
      el.scrollLeft = dragState.current.scrollLeft - walk;
    };

    const onUp = () => {
      if (!dragState.current.isDown) return;
      dragState.current.isDown = false;
      el.style.cursor = "grab";
      el.style.scrollSnapType = "x mandatory";
    };

    const onLeave = () => {
      if (dragState.current.isDown) onUp();
    };

    // 滚动时更新指示器 (仅在非程序化滚动时依据物理中心距离更新)
    const updateIndicatorOnScroll = () => {
      if (isProgrammaticScrollingRef.current) return;
      const containerCenter = el.getBoundingClientRect().left + el.clientWidth / 2;
      const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
      let closestIdx = 0;
      let closestDist = Infinity;
      cards.forEach((card) => {
        const cardCenter = card.getBoundingClientRect().left + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - containerCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = parseInt(card.dataset.cardIndex || "0", 10);
        }
      });
      if (closestIdx !== activeSlideRef.current) {
        setActiveSlide(closestIdx);
      }
    };

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          updateIndicatorOnScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    el.style.cursor = "grab";
    el.addEventListener("mousedown", onDown);
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseup", onUp);
    el.addEventListener("mouseleave", onLeave);
    el.addEventListener("touchstart", onDown, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onUp, { passive: true });
    el.addEventListener("scroll", onScroll);

    return () => {
      el.removeEventListener("mousedown", onDown);
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseup", onUp);
      el.removeEventListener("mouseleave", onLeave);
      el.removeEventListener("touchstart", onDown);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onUp);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto px-6 md:px-8">
      <div className="relative">
        {/* 轮播滑动轨道 */}
        <div
          ref={carouselRef}
          className="carousel-scrollbar-hidden flex gap-5 overflow-x-auto snap-x snap-mandatory px-3 py-4 -mx-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none", scrollPaddingInline: "1px" }}
        >
          {/* 左侧视口居中弹性垫片 */}
          <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />

          {/* 新建实例卡片 */}
          <button
            type="button"
            onClick={onNewInstance}
            className={cn(
              "motion-instance-card flex-shrink-0 w-60 h-[320px] rounded-[18px] overflow-hidden snap-center group relative cursor-pointer text-left focus:outline-none",
              isLight
                ? "bg-black/[0.03] border border-black/[0.08] hover:border-black/15"
                : "bg-white/[0.04] border border-white/[0.06] hover:border-white/15"
            )}
            data-card-index="0"
          >
            <div className="relative h-full flex flex-col justify-between p-3.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-[background-color,box-shadow,filter] duration-200",
                  isLight ? "bg-black/[0.06]" : "bg-white/[0.08]"
                )}
              >
                <Play className={cn("w-3.5 h-3.5", isLight ? "text-[#1a1625]/40" : "text-white/40")} />
              </div>
              <div>
                <div className={cn("text-base font-semibold mb-0.5", isLight ? "text-[#1a1625]" : "text-white")}>
                  {isWeb && !isShowcase && !import.meta.env.DEV ? "下载 APK" : "新建实例"}
                </div>
                <div className={cn("text-xs", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
                  {isWeb && !isShowcase && !import.meta.env.DEV ? "获取最新版本" : "设置新的酒馆环境"}
                </div>
              </div>
            </div>
          </button>

          {/* 解耦后的实例卡片列表 */}
          {instances.map((instance, index) => (
            <InstanceCard
              key={instance.id}
              instance={instance}
              index={index}
              isLight={isLight}
              glassBg={glassBg}
              hoveredCard={hoveredCard}
              setHoveredCard={setHoveredCard}
              activeCardMenu={activeCardMenu}
              launchingId={launchingId}
              onLaunch={onLaunch}
              onReturnToTavern={onReturnToTavern}
              onStopInstance={onStopInstance}
              onOpenMenu={onOpenMenu}
              onRenameSave={onRenameSave}
              isExternallyRenaming={externallyRenamingId === instance.id}
              onClearExternalRenaming={onClearExternalRenaming}
              terminalLogs={terminalLogs}
              setTerminalLogs={setTerminalLogs}
              isWindows={isWindows}
            />
          ))}

          {/* 右侧视口居中弹性垫片 */}
          <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />
        </div>

        {/* 翻页指示器 + 方向控制键 (无频闪、舒适热区与微拟物触感) */}
        <div className="flex items-center justify-center gap-3 mt-4 select-none">
          <button
            type="button"
            onClick={() => goToSlide(activeSlide - 1)}
            disabled={activeSlide === 0}
            aria-label="上一页"
            className={cn(
              "motion-control w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none",
              activeSlide === 0
                ? isLight ? "text-[#1a1625]/15 cursor-default opacity-40" : "text-white/15 cursor-default opacity-40"
                : isLight
                  ? "text-[#1a1625]/60 hover:text-[#1a1625] hover:bg-[#1a1625]/8 active:scale-95 cursor-pointer"
                  : "text-white/60 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToSlide(i)}
                aria-label={`切换到第 ${i + 1} 张卡片`}
                aria-current={i === activeSlide ? "true" : undefined}
                className="motion-control group flex h-7 w-5 items-center justify-center rounded-full cursor-pointer focus:outline-none"
              >
                <span
                  className={cn(
                    "block h-1.5 w-4 rounded-full transition-[transform,background-color,opacity] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                    i === activeSlide
                      ? isLight ? "scale-x-100 bg-[#1a1625]/60" : "scale-x-100 bg-white/70"
                      : isLight ? "scale-x-[0.375] bg-[#1a1625]/15 group-hover:bg-[#1a1625]/30" : "scale-x-[0.375] bg-white/20 group-hover:bg-white/40"
                  )}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToSlide(activeSlide + 1)}
            disabled={activeSlide === totalSlides - 1}
            aria-label="下一页"
            className={cn(
              "motion-control w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none",
              activeSlide === totalSlides - 1
                ? isLight ? "text-[#1a1625]/15 cursor-default opacity-40" : "text-white/15 cursor-default opacity-40"
                : isLight
                  ? "text-[#1a1625]/60 hover:text-[#1a1625] hover:bg-[#1a1625]/8 active:scale-95 cursor-pointer"
                  : "text-white/60 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
InstanceCarousel.displayName = "InstanceCarousel";
