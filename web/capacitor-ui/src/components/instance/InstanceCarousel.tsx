import React, { useRef, useState, useEffect, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from "react";
import { Play, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";
import type { TavernInstance } from "../../types";
import { InstanceCard } from "./InstanceCard";
import { setCarouselSnapLock } from "../../lib/carousel-snap";
import { createPaginationMotion, paginationCenter, paginationDotOpacity, PAGINATION_REST_WIDTH } from "../../lib/pagination-motion";
import { FlipCard } from "../common/FlipCard";

const REORDER_CURVE = "cubic-bezier(0.22, 0.7, 0.3, 1)";
const REORDER_SETTLE_MS = 380;
const RELEASE_ALPHA = 0.84;
type GestureSample = { x: number; t: number };

function pushGestureSample(samples: GestureSample[], x: number, t: number) {
  samples.push({ x, t });
  const cutoff = t - 96;
  while (samples.length > 2 && samples[0].t < cutoff) samples.shift();
}

/** 最近约 72ms 的位移。松手停住则速度归零，避免单帧抖动被当成甩动。 */
function gestureVelocity(samples: GestureSample[], now: number) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  if (now - last.t > 72) return 0;
  let first = samples[0];
  for (let i = samples.length - 1; i >= 0; i -= 1) {
    if (last.t - samples[i].t <= 72) first = samples[i];
    else break;
  }
  const dt = last.t - first.t;
  if (dt < 16) return 0;
  return (last.x - first.x) / dt;
}

function releaseDuration(distance: number, velocity: number) {
  const span = Math.abs(distance);
  if (span < 1) return 0;
  const rest = Math.min(460, Math.max(210, 200 + span * 0.9));
  const toward = Math.sign(velocity) === Math.sign(distance) ? Math.abs(velocity) : 0;
  if (toward < 0.05) return Math.round(rest);
  const matched = (3 * span) / toward;
  return Math.round(Math.min(480, Math.max(200, Math.min(rest, matched))));
}

/** 起点接上松手速度，终点速度为 0。静止翻页初速靠近临界值，整段持续减速，避免中段匀速平移。 */
function releaseOffset(progress: number, distance: number, velocity: number, duration: number) {
  const t = Math.max(0, Math.min(1, progress));
  const span = Math.abs(distance);
  if (span < 0.5 || duration < 1) return distance * t;
  const maxSlope = (3 * distance) / duration;
  let slope = velocity;
  const sameWay = slope === 0 || Math.sign(slope) === Math.sign(distance);
  if (sameWay) {
    const floor = maxSlope * RELEASE_ALPHA;
    if (Math.abs(slope) < Math.abs(floor)) slope = floor;
    if (Math.abs(slope) > Math.abs(maxSlope)) slope = maxSlope;
  } else {
    const cap = Math.abs(maxSlope) * 0.28;
    if (Math.abs(slope) > cap) slope = Math.sign(slope) * cap;
  }
  const t2 = t * t;
  const t3 = t2 * t;
  const blend = -2 * t3 + 3 * t2;
  const incoming = t3 - 2 * t2 + t;
  return distance * blend + slope * duration * incoming;
}

/** 卡片相对滚动容器内容的左缘。offsetParent 是外层定位盒，不能直接拿 offsetLeft 当 scrollLeft。 */
function cardContentLeft(scroller: HTMLElement, card: HTMLElement) {
  return card.offsetLeft - scroller.offsetLeft;
}

function scrollLeftForCard(scroller: HTMLElement, card: HTMLElement) {
  const cardWidth = card.offsetWidth || 240;
  const raw = cardContentLeft(scroller, card) - (scroller.clientWidth - cardWidth) / 2;
  const max = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  return Math.min(max, Math.max(0, raw));
}

function releaseCardIndex(scroller: HTMLElement, cards: HTMLElement[], scrollVelocity: number) {
  const nearest = closestCardIndex(scroller, cards);
  if (Math.abs(scrollVelocity) < 0.12) return nearest;
  const projected = scroller.scrollLeft + scrollVelocity / 0.0034;
  const projectedCenter = projected + scroller.clientWidth / 2;
  let idx = nearest;
  let best = Infinity;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const center = cardContentLeft(scroller, card) + card.offsetWidth / 2;
    const dist = Math.abs(center - projectedCenter);
    if (dist < best) {
      best = dist;
      idx = i;
    }
  }
  return Math.max(0, Math.min(cards.length - 1, Math.max(nearest - 1, Math.min(nearest + 1, idx))));
}

function closestCardIndex(scroller: HTMLElement, cards: HTMLElement[]) {
  const containerCenter = scroller.scrollLeft + scroller.clientWidth / 2;
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < cards.length; i += 1) {
    const card = cards[i];
    const center = cardContentLeft(scroller, card) + card.offsetWidth / 2;
    const dist = Math.abs(center - containerCenter);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

export interface InstanceCarouselRef {
  goToSlide: (index: number) => void;
  activeSlide: number;
}

export interface InstanceCarouselProps {
  instances: TavernInstance[];
  isLight: boolean;
  isDynamic?: boolean;
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
  isWindows?: boolean;
  isWeb?: boolean;
  isShowcase?: boolean;
  isLocalPreview?: boolean;
  onNewInstance: () => void;
  activeSlide?: number;
  onActiveSlideChange?: (index: number) => void;
  onLongPressCard?: (instance: TavernInstance) => void;
  onReorderInstances?: (newInstances: TavernInstance[]) => void;
}

/**
 * 实例轮播组件 (InstanceCarousel)
 * 高内聚低耦合：
 * - 拥有独立的滚动容器、手势拖拽、触控与键盘原生导航；
 * - 搭载精确的物理视口中心对齐与无频闪（Zero Flicker）平滑插值引擎；
 * - 杜绝 CSS Scroll-Snap 与平滑滚动互斥冲突，消灭指示器与翻页键频闪。
 */
const InstanceCarouselComponent = forwardRef<InstanceCarouselRef, InstanceCarouselProps>(({
  instances,
  isLight,
  isDynamic = false,
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
  isWindows = false,
  isWeb = false,
  isShowcase = false,
  isLocalPreview = false,
  onNewInstance,
  activeSlide: activeSlideProp,
  onActiveSlideChange,
  onLongPressCard,
  onReorderInstances,
}, ref) => {
  const carouselRef = useRef<HTMLDivElement>(null);
  const [internalActiveSlide, setInternalActiveSlide] = useState(activeSlideProp ?? 0);
  const activeSlide = activeSlideProp !== undefined ? activeSlideProp : internalActiveSlide;

  const setActiveSlide = useCallback((index: number) => {
    setInternalActiveSlide(index);
    onActiveSlideChange?.(index);
  }, [onActiveSlideChange]);

  // 本地实例列表原子状态：确保拖拽落位在子组件内部同帧原子提交新顺序，杜绝跨组件 props 延迟导致的闪现
  const [localInstances, setLocalInstances] = useState(instances);

  useEffect(() => {
    if (!reorderStateRef.current?.active) {
      setLocalInstances(instances);
    }
  }, [instances]);

  const totalSlides = localInstances.length + 1; // 0: 新建实例, 1..N: 实例卡片

  // 程序化滚动状态锁定，防止滚动中间帧触发指示器闪烁
  const isProgrammaticScrollingRef = useRef(false);
  const activeSlideRef = useRef(0);
  activeSlideRef.current = activeSlide;
  const paginationMoverRef = useRef<HTMLDivElement>(null);
  const paginationCapsuleRef = useRef<HTMLSpanElement>(null);
  const paginationDotsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const paginationMotionRef = useRef<ReturnType<typeof createPaginationMotion> | null>(null);
  const animatePaginationRef = useRef(true);
  const reducedMotionRef = useRef(false);
  const settleTokenRef = useRef(0);
  const settleFrameRef = useRef(0);

  const cancelSettle = useCallback(() => {
    settleTokenRef.current += 1;
    if (settleFrameRef.current) {
      cancelAnimationFrame(settleFrameRef.current);
      settleFrameRef.current = 0;
    }
  }, []);

  const releaseSnap = useCallback((el: HTMLElement) => {
    isProgrammaticScrollingRef.current = false;
    setCarouselSnapLock(el, "drag", false);
    el.style.scrollBehavior = "";
  }, []);

  const settleScrollTo = useCallback((el: HTMLElement, targetScroll: number, scrollVelocity = 0) => {
    cancelSettle();
    const token = settleTokenRef.current;
    const from = el.scrollLeft;
    const distance = targetScroll - from;
    setCarouselSnapLock(el, "drag", true);
    el.style.scrollBehavior = "auto";
    isProgrammaticScrollingRef.current = true;

    if (reducedMotionRef.current || Math.abs(distance) < 0.5) {
      el.scrollLeft = targetScroll;
      if (settleTokenRef.current === token) releaseSnap(el);
      return;
    }

    const duration = releaseDuration(distance, scrollVelocity);
    if (duration < 1) {
      el.scrollLeft = targetScroll;
      if (settleTokenRef.current === token) releaseSnap(el);
      return;
    }
    const startedAt = performance.now();
    const step = (now: number) => {
      if (settleTokenRef.current !== token) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      el.scrollLeft = from + releaseOffset(progress, distance, scrollVelocity, duration);
      if (progress < 1) {
        settleFrameRef.current = requestAnimationFrame(step);
        return;
      }
      el.scrollLeft = targetScroll;
      settleFrameRef.current = requestAnimationFrame(() => {
        settleFrameRef.current = 0;
        if (settleTokenRef.current !== token) return;
        el.scrollLeft = targetScroll;
        releaseSnap(el);
      });
    };
    settleFrameRef.current = requestAnimationFrame(step);
  }, [cancelSettle, releaseSnap]);

  useLayoutEffect(() => {
    const mover = paginationMoverRef.current;
    const capsule = paginationCapsuleRef.current;
    if (!mover || !capsule) return;
    const dots = paginationDotsRef.current.slice(0, totalSlides);
    const opacities: number[] = [];
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;
    const motion = createPaginationMotion(activeSlideRef.current, pose => {
      mover.style.transform = `translate3d(${pose.center - PAGINATION_REST_WIDTH / 2}px, 0, 0)`;
      capsule.style.transform = `scaleX(${pose.width / PAGINATION_REST_WIDTH})`;
      dots.forEach((dot, index) => {
        const opacity = paginationDotOpacity(paginationCenter(index), pose);
        if (dot && opacity !== opacities[index]) {
          dot.style.opacity = String(opacity);
          opacities[index] = opacity;
        }
      });
    });
    paginationMotionRef.current = motion;
    const onReducedMotion = () => {
      reducedMotionRef.current = media.matches;
      if (media.matches) motion.snap();
    };
    const onVisibility = () => {
      if (document.hidden) motion.snap();
    };
    media.addEventListener("change", onReducedMotion);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      media.removeEventListener("change", onReducedMotion);
      document.removeEventListener("visibilitychange", onVisibility);
      motion.dispose();
      if (paginationMotionRef.current === motion) paginationMotionRef.current = null;
    };
  }, [totalSlides]);

  useLayoutEffect(() => {
    paginationMotionRef.current?.to(activeSlide, animatePaginationRef.current && !reducedMotionRef.current && !document.hidden);
    animatePaginationRef.current = true;
  }, [activeSlide, totalSlides]);

  // 按释放曲线把滚动收到目标卡中心。吸附锁在动画结束后才打开。
  const goToSlide = useCallback((targetIndex: number, animateIndicator = true, scrollVelocity = 0) => {
    const el = carouselRef.current;
    if (!el) return;

    const clampedIndex = Math.max(0, Math.min(totalSlides - 1, targetIndex));
    const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
    const target = cards[clampedIndex];
    if (!target) return;

    // 立即锁定目标指示器，杜绝中间状态反向抖动
    isProgrammaticScrollingRef.current = true;
    if (clampedIndex !== activeSlideRef.current) animatePaginationRef.current = animateIndicator;
    else if (!animateIndicator) paginationMotionRef.current?.snap();
    setActiveSlide(clampedIndex);

    const targetScroll = scrollLeftForCard(el, target);

    // 吸附全程锁住 scroll-snap。松手速度接进曲线，再减速贴到目标卡，结束才解锁。
    // 否则 mandatory snap 会先跳一帧，看起来像系统刷新把卡片弹回去。
    settleScrollTo(el, targetScroll, scrollVelocity);
  }, [totalSlides, setActiveSlide, settleScrollTo]);

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
        goToSlide(activeSlideRef.current - 1, false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToSlide(activeSlideRef.current + 1, false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToSlide]);

  // 桌面端鼠标拖拽支持（零延迟硬件加速平滑滚动与自然惯性吸附）
  const dragState = useRef<{
    isDown: boolean;
    startX: number;
    scrollLeft: number;
    hasDragged: boolean;
    samples: GestureSample[];
  }>({
    isDown: false,
    startX: 0,
    scrollLeft: 0,
    hasDragged: false,
    samples: [],
  });

  // 手机桌面级长按拖拽重排状态机 (Springboard Drag-to-Reorder)
  const [reorderState, setReorderState] = useState<{
    active: boolean;
    draggedIndex: number;
    targetIndex: number;
    dragOffset: number;
    isDropping: boolean;
  } | null>(null);

  // 瞬时提交保护标记：DOM 节点换位首帧强制关闭所有 transition，消除闪烁
  const [isReorderCommitting, setIsReorderCommitting] = useState(false);

  // 在 DOM 节点物理重排提交的首帧（浏览器绘制前），同步强制抹平所有卡片 transition 与 transform
  useLayoutEffect(() => {
    if (!isReorderCommitting) return;
    const el = carouselRef.current;
    if (!el) return;
    const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
    cards.forEach(card => {
      card.style.transition = "none";
      card.style.transform = "none";
    });
    void el.offsetHeight; // 强制刷新渲染管线，彻底杀灭任何进行中的插值动画
  }, [isReorderCommitting]);

  const reorderStateRef = useRef(reorderState);
  reorderStateRef.current = reorderState;

  const pointerStartRef = useRef<{ x: number; y: number; cardIndex: number; pointerId: number } | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const justReorderedRef = useRef(false);
  const reorderSamplesRef = useRef<GestureSample[]>([]);
  const dropFrameRef = useRef(0);
  const dropTokenRef = useRef(0);

  // 动态测量卡片槽位物理步长 (240px card + 28px gap = 268px)
  const getCardStride = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return 268;
    const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
    if (cards.length >= 3) {
      const diff = cards[2].offsetLeft - cards[1].offsetLeft;
      if (diff > 100) return diff;
    }
    return 268;
  }, []);

  // 卡片按下手势监听：按住 320ms 且无大幅滑动时触发手机桌面级长按拖拽重排
  const handleCardPointerDown = useCallback((instanceIndex: number, e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, input, textarea, select, [contenteditable='true'], .ios-task-surface, a")) {
      return;
    }

    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardIndex: instanceIndex,
      pointerId: e.pointerId,
    };

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      const start = pointerStartRef.current;
      if (!start || start.cardIndex !== instanceIndex) return;

      try { navigator.vibrate?.([25]); } catch {}

      const el = carouselRef.current;
      if (el) {
        setCarouselSnapLock(el, "drag", true);
        el.style.scrollBehavior = "auto";
      }

      dragState.current.isDown = false;
      justReorderedRef.current = true;
      reorderSamplesRef.current = [{ x: start.x, t: performance.now() }];

      const initial = {
        active: true,
        draggedIndex: instanceIndex,
        targetIndex: instanceIndex,
        dragOffset: 0,
        isDropping: false,
      };
      reorderStateRef.current = initial;
      setReorderState(initial);
    }, 320);
  }, []);

  // 全局指针跟踪与 Springboard 邻卡实时让位调度（视口容器绝对静止，杜绝自动滚屏与 snap 暴冲）
  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      const start = pointerStartRef.current;
      if (!start) return;

      const currentReorder = reorderStateRef.current;
      if (!currentReorder?.active) {
        // 未进入重排，若移动超标则取消长按计时器（认定为正常浏览滚动）
        const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
        if (dist > 7) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
        }
        return;
      }

      // 已处于拖拽重排模式中：纯在当前视口内平滑计算槽位，容器保持完全静止
      e.preventDefault();
      const dx = e.clientX - start.x;
      pushGestureSample(reorderSamplesRef.current, e.clientX, performance.now());
      const stride = getCardStride();
      const slotDelta = Math.round(dx / stride);
      const newTarget = Math.max(0, Math.min(localInstances.length - 1, currentReorder.draggedIndex + slotDelta));

      if (newTarget !== currentReorder.targetIndex) {
        try { navigator.vibrate?.([10]); } catch {}
      }

      const nextState = {
        ...currentReorder,
        dragOffset: dx,
        targetIndex: newTarget,
      };
      reorderStateRef.current = nextState;
      setReorderState(nextState);
    };

    const onPointerUp = (e: PointerEvent) => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }

      const currentReorder = reorderStateRef.current;
      if (!currentReorder?.active) {
        pointerStartRef.current = null;
        return;
      }

      pointerStartRef.current = null;
      const stride = getCardStride();
      const fromIdx = currentReorder.draggedIndex;
      const toIdx = currentReorder.targetIndex;
      const fromOffset = currentReorder.dragOffset;
      const finalOffset = (currentReorder.targetIndex - currentReorder.draggedIndex) * stride;
      const distance = finalOffset - fromOffset;
      const pointerVelocity = gestureVelocity(reorderSamplesRef.current, performance.now());
      const duration = reducedMotionRef.current ? 0 : releaseDuration(distance, pointerVelocity);

      const finishReorder = () => {
        if (fromIdx !== toIdx) {
          const next = [...localInstances];
          const [moved] = next.splice(fromIdx, 1);
          next.splice(toIdx, 0, moved);

          // 原子更新：在子组件同一个渲染周期中，将本地渲染数据更新为新顺序，彻底消灭跨组件 props 时差闪现
          setLocalInstances(next);
          onReorderInstances?.(next);
        }

        // 瞬时进入无过渡提交保护期，强制所有卡片 transition: none，消除 DOM 重排抽搐
        setIsReorderCommitting(true);
        setReorderState(null);
        reorderStateRef.current = null;

        // 双 rAF 跨帧保护：等待 React 完成真实 DOM 节点调换并在首个合成帧绘制完成后，平稳释放冻结
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = carouselRef.current;
            if (el) {
              const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
              cards.forEach(card => {
                card.style.transition = "";
                card.style.transform = "";
              });
            }
            setIsReorderCommitting(false);

            // 在 DOM 彻底稳定后平稳解除原生 Scroll-Snap 锁定，视口完全静止
            if (el) {
              setCarouselSnapLock(el, "drag", false);
              el.style.scrollBehavior = "";
            }

            setTimeout(() => {
              justReorderedRef.current = false;
            }, 200);
          });
        });
      };

      if (duration < 1) {
        finishReorder();
        return;
      }

      const token = dropTokenRef.current + 1;
      dropTokenRef.current = token;
      const dropping = {
        ...currentReorder,
        dragOffset: fromOffset,
        isDropping: true,
      };
      reorderStateRef.current = dropping;
      setReorderState(dropping);
      const started = performance.now();
      const step = (now: number) => {
        if (dropTokenRef.current !== token) return;
        const progress = Math.min(1, (now - started) / duration);
        const offset = progress >= 1
          ? finalOffset
          : fromOffset + releaseOffset(progress, distance, pointerVelocity, duration);
        const next = { ...dropping, dragOffset: offset };
        reorderStateRef.current = next;
        setReorderState(next);
        if (progress < 1) {
          dropFrameRef.current = requestAnimationFrame(step);
          return;
        }
        dropFrameRef.current = requestAnimationFrame(() => {
          dropFrameRef.current = 0;
          if (dropTokenRef.current !== token) return;
          finishReorder();
        });
      };
      dropFrameRef.current = requestAnimationFrame(step);
    };

    const onPointerCancel = (e: PointerEvent) => {
      onPointerUp(e);
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerCancel);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    };
  }, [getCardStride, localInstances, onReorderInstances]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest("button, input, textarea, select, [contenteditable='true'], .ios-task-surface")
      ) {
        return;
      }
      dragState.current = {
        isDown: true,
        startX: e.pageX,
        scrollLeft: el.scrollLeft,
        hasDragged: false,
        samples: [{ x: e.pageX, t: performance.now() }],
      };
      cancelSettle();
      isProgrammaticScrollingRef.current = false;
      // 拖拽开始：临时禁用 CSS scroll-snap 与平滑滚动，杜绝浏览器在拖拽过程中强行重吸附导致的生硬卡顿
      setCarouselSnapLock(el, "drag", true);
      el.style.scrollBehavior = "auto";
      el.style.cursor = "grabbing";
    };

    const onMouseMove = (e: MouseEvent) => {
      if (reorderStateRef.current?.active) return;
      if (!dragState.current.isDown) return;
      const x = e.pageX;
      const walk = x - dragState.current.startX;
      if (Math.abs(walk) > 4) {
        dragState.current.hasDragged = true;
      }
      if (dragState.current.hasDragged) {
        e.preventDefault();
        pushGestureSample(dragState.current.samples, x, performance.now());
        el.scrollLeft = dragState.current.scrollLeft - walk;
        }
    };

    const onMouseUp = () => {
      if (reorderStateRef.current?.active) return;
      if (!dragState.current.isDown) return;
      dragState.current.isDown = false;
      el.style.cursor = "grab";

      if (!dragState.current.hasDragged) {
        releaseSnap(el);
        return;
      }

      const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
      if (cards.length === 0) {
        releaseSnap(el);
        return;
      }
      const scrollVelocity = -gestureVelocity(dragState.current.samples, performance.now());
      goToSlide(releaseCardIndex(el, cards, scrollVelocity), true, scrollVelocity);
    };

    // 拖拽完成拦截点击穿透，防止松开鼠标时意外触发展开或激活按钮
    const onClickCapture = (e: MouseEvent) => {
      if (justReorderedRef.current) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (dragState.current.hasDragged) {
        e.preventDefault();
        e.stopPropagation();
        dragState.current.hasDragged = false;
      }
    };

    // 滚动时更新指示器：基于 offsetLeft 零重排零回流计算，采用 requestAnimationFrame 保证 120Hz 顺滑
    const updateIndicatorOnScroll = () => {
      if (isProgrammaticScrollingRef.current) return;
      const cards = Array.from(el.children).filter(c => (c as HTMLElement).hasAttribute("data-card-index")) as HTMLElement[];
      const closestIdx = closestCardIndex(el, cards);
      if (closestIdx !== activeSlideRef.current) {
        animatePaginationRef.current = true;
        activeSlideRef.current = closestIdx;
        setActiveSlide(closestIdx);
      }
    };

    let scrollFrame = 0;
    const onScroll = () => {
      if (!scrollFrame) {
        scrollFrame = requestAnimationFrame(() => {
          scrollFrame = 0;
          updateIndicatorOnScroll();
        });
      }
    };

    el.style.cursor = "grab";
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("scroll", onScroll);
      if (scrollFrame) cancelAnimationFrame(scrollFrame);
      cancelSettle();
      dragState.current.isDown = false;
      releaseSnap(el);
    };
  }, [goToSlide, setActiveSlide, cancelSettle, releaseSnap]);

  const createLabel = isWeb && !isShowcase && !isLocalPreview && !import.meta.env.DEV ? "下载 APK" : "新建实例";
  const createHint = isWeb && !isShowcase && !isLocalPreview && !import.meta.env.DEV ? "获取最新版本" : "设置新的酒馆环境";

  return (
    <div className="w-full max-w-6xl mx-auto px-6 md:px-8">
      <div className="relative">
        {/* 轮播滑动轨道：垂直上下预留 36px+ 充足空间，杜绝全向 3D 体积光阴影被滚动容器边缘裁切分层 */}
        <div
          ref={carouselRef}
          data-carousel-committing={isReorderCommitting ? "true" : undefined}
          className="carousel-scrollbar-hidden flex gap-7 overflow-x-auto snap-x snap-mandatory px-3 py-9 -mx-2 -my-4"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
            scrollPaddingInline: "1px",
            WebkitOverflowScrolling: "touch",
            touchAction: "pan-x",
            overscrollBehaviorX: "contain",
            willChange: "scroll-position",
          }}
        >
          {/* 左侧视口居中弹性垫片 */}
          <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />

          {/* 新建实例卡片：倾斜/高光/按压跟实例卡，内部仍是原透明雾面 + 边缘内发光 */}
          <FlipCard
            data-card-index="0"
            className="group flex-shrink-0 snap-center cursor-pointer"
            width={240}
            height={320}
            radius={26}
            flipped={false}
            axis="y"
            flipOnClick={false}
            draggable={false}
            tilt
            tiltMax={3.8}
            glare
            glareOpacity={isLight ? 0.01 : 0.015}
            behindGlow={false}
            borderColor="transparent"
            hoverScale={1}
            perspective={1100}
            stiffness={160}
            damping={28}
            background="transparent"
            color={isLight ? "#1a1625" : "#f5f5f5"}
            shadow
            shadowColor="#000000"
            shadowOpacity={isLight ? 0.05 : 0.18}
            ariaLabel={createLabel}
            onClick={onNewInstance}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (!event.repeat) onNewInstance();
            }}
            front={(
              <div
                data-card-index="0"
                className="motion-instance-card relative h-full w-full overflow-hidden rounded-[26px] text-left"
              >
                <div className="relative z-[2] flex h-full flex-col justify-between p-3.5">
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      isLight ? "bg-black/[0.06]" : "bg-white/[0.08]"
                    )}
                  >
                    <Play className={cn("h-3.5 w-3.5 fill-current transition-colors", isLight ? "text-[#1a1625]/40 group-hover:text-[#1a1625]/80" : "text-white/40 group-hover:text-white/80")} />
                  </div>
                  <div>
                    <div className={cn("mb-0.5 text-base font-semibold transition-colors", isLight ? "text-[#1a1625]" : "text-white")}>
                      {createLabel}
                    </div>
                    <div className={cn("text-xs transition-colors", isLight ? "text-[#1a1625]/40 group-hover:text-[#1a1625]/75" : "text-white/40 group-hover:text-white/75")}>
                      {createHint}
                    </div>
                  </div>
                </div>
              </div>
            )}
          />

          {/* 解耦后的实例卡片列表 */}
          {localInstances.map((instance, index) => {
            const stride = getCardStride();
            const isBeingDragged = reorderState?.active && reorderState.draggedIndex === index;
            const isDropping = isBeingDragged && reorderState.isDropping;

            let shiftX = 0;
            if (reorderState?.active && !isBeingDragged) {
              const { draggedIndex, targetIndex } = reorderState;
              if (draggedIndex < targetIndex) {
                if (index > draggedIndex && index <= targetIndex) {
                  shiftX = -stride;
                }
              } else if (draggedIndex > targetIndex) {
                if (index >= targetIndex && index < draggedIndex) {
                  shiftX = stride;
                }
              }
            }

            // 针对 DOM 重排瞬态的精密样式隔离：
            // 1. 提交帧 (isReorderCommitting)：强制关闭一切 transition 并重置 transform，使新物理位置与 0 位移完美对齐，0 帧闪烁；
            // 2. 拖拽与落位帧：拖动时无过渡跟随，松手后按减速曲线贴入槽位；
            // 3. 邻卡让位帧：平滑侧移让位；
            // 4. 常态：不施加多余 inline transform/transition，纯净原生排版。
            const reorderTransition = reducedMotionRef.current
              ? "none"
              : `transform ${REORDER_SETTLE_MS}ms ${REORDER_CURVE}`;
            const cardStyle: React.CSSProperties | undefined = isReorderCommitting
              ? {
                  transform: "none",
                  transition: "none",
                }
              : isBeingDragged
              ? {
                  transform: `translate3d(${reorderState.dragOffset}px, 0, 0)`,
                  zIndex: 50,
                  transition: "none",
                  pointerEvents: isDropping ? "none" : "auto",
                }
              : shiftX !== 0
              ? {
                  transform: `translate3d(${shiftX}px, 0, 0)`,
                  transition: reorderTransition,
                }
              : reorderState?.active
              ? {
                  transform: "translate3d(0, 0, 0)",
                  transition: reorderTransition,
                }
              : undefined;

            return (
              <InstanceCard
                key={instance.id}
                instance={instance}
                index={index}
                style={cardStyle}
                isReordering={isBeingDragged}
                isDropping={isDropping}
                isReorderCommitting={isReorderCommitting}
                onPointerDownCapture={(e) => handleCardPointerDown(index, e)}
                isLight={isLight}
                isDynamic={isDynamic}
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
                isWindows={isWindows}
                onLongPress={onLongPressCard}
              />
            );
          })}

          {/* 右侧视口居中弹性垫片 */}
          <div className="flex-shrink-0 w-[calc(50%-120px)]" aria-hidden />
        </div>

        {/* 翻页指示器 + 方向控制键 (无频闪、舒适热区与微拟物触感) */}
        <div className="flex items-center justify-center gap-3 mt-4 select-none">
          <button
            type="button"
            onClick={event => goToSlide(activeSlide - 1, event.detail !== 0)}
            disabled={activeSlide === 0}
            aria-label="上一页"
            className={cn(
              "motion-control w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none",
              activeSlide === 0
                ? isLight ? "text-[#1a1625]/15 cursor-default opacity-40" : "text-white/15 cursor-default opacity-40"
                : isLight
                  ? "text-[#1a1625]/50 hover:text-[#1a1625] active:scale-95 cursor-pointer"
                  : "text-white/50 hover:text-white active:scale-95 cursor-pointer"
            )}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* 无外边框流体指示器轨道：零胶囊边框、零多余背景、纯净槽位与动态流体滑块 */}
          <div
            className={cn("carousel-pagination relative flex items-center h-7 select-none", isLight && "is-light")}
            style={{ contain: "layout paint style" }}
          >
            {/* 槽位圆点列表 (每个槽位宽 22px，热区舒适) */}
            <div className="flex items-center">
              {Array.from({ length: totalSlides }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={event => goToSlide(i, event.detail !== 0)}
                  aria-label={`切换到第 ${i + 1} 张卡片`}
                  aria-current={i === activeSlide ? "true" : undefined}
                  className="motion-control group flex h-7 w-[22px] items-center justify-center cursor-pointer focus:outline-none"
                >
                  <span
                    ref={element => { paginationDotsRef.current[i] = element; }}
                    className="carousel-pagination__dot-coverage"
                  >
                    <span className="carousel-pagination__dot" />
                  </span>
                </button>
              ))}
            </div>

            {/* 绝对定位 Apple 流体果冻滑动胶囊 (Spring Pill) */}
            <div
              aria-hidden="true"
              ref={paginationMoverRef}
              className="carousel-pagination__mover"
            >
              <span ref={paginationCapsuleRef} className="carousel-pagination__capsule" />
            </div>
          </div>

          <button
            type="button"
            onClick={event => goToSlide(activeSlide + 1, event.detail !== 0)}
            disabled={activeSlide === totalSlides - 1}
            aria-label="下一页"
            className={cn(
              "motion-control w-8 h-8 rounded-full flex items-center justify-center transition-all focus:outline-none",
              activeSlide === totalSlides - 1
                ? isLight ? "text-[#1a1625]/15 cursor-default opacity-40" : "text-white/15 cursor-default opacity-40"
                : isLight
                  ? "text-[#1a1625]/50 hover:text-[#1a1625] active:scale-95 cursor-pointer"
                  : "text-white/50 hover:text-white active:scale-95 cursor-pointer"
            )}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
});
InstanceCarouselComponent.displayName = "InstanceCarousel";
export const InstanceCarousel = React.memo(InstanceCarouselComponent);
