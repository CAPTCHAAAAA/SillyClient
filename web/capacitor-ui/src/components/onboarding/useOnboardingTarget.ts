import { useLayoutEffect, useRef, useState } from "react";
import {
  getRevealPlan,
  getViewportBounds,
  intersectBounds,
  resolveTargetClipping,
  type ClipAncestor,
  type Bounds,
} from "./onboarding-viewport";

export interface TargetGeometry {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  radius: number;
}

interface TargetState {
  stepId: string;
  geometry: TargetGeometry | null;
  tracking: boolean;
  ready: boolean;
}

const TARGET_PADDING = 8;
const TARGET_WAIT_WINDOW_MS = 8000;
const TARGET_RETRY_INTERVAL_MS = 250;
const SETTLE_FRAME_BUDGET = 120;
const REVEAL_FALLBACK_MS = 800;
const REVEAL_IDLE_MS = 180;
const OVERFLOW_CLIP = /^(auto|scroll|overlay|hidden|clip)$/;
const MOTION_EVENTS = [
  "animationstart",
  "animationend",
  "animationcancel",
  "transitionrun",
  "transitionend",
  "transitioncancel",
] as const;

function getElementBounds(element: Element): Bounds {
  const rect = element.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

function getTargetClipping(element: Element, viewport: Bounds) {
  const clippingAncestors: ClipAncestor[] = [];

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    const clipsX = OVERFLOW_CLIP.test(style.overflowX);
    const clipsY = OVERFLOW_CLIP.test(style.overflowY);
    if (!clipsX && !clipsY) continue;

    const rect = ancestor.getBoundingClientRect();
    const clip: Bounds = {
      left: clipsX ? rect.left + ancestor.clientLeft : Number.NEGATIVE_INFINITY,
      right: clipsX ? rect.left + ancestor.clientLeft + ancestor.clientWidth : Number.POSITIVE_INFINITY,
      top: clipsY ? rect.top + ancestor.clientTop : Number.NEGATIVE_INFINITY,
      bottom: clipsY ? rect.top + ancestor.clientTop + ancestor.clientHeight : Number.POSITIVE_INFINITY,
    };
    const scrollsX = clipsX && ancestor.scrollWidth > ancestor.clientWidth + 1;
    const scrollsY = clipsY && ancestor.scrollHeight > ancestor.clientHeight + 1;
    clippingAncestors.push({ bounds: clip, scrollable: scrollsX || scrollsY });
  }

  return resolveTargetClipping(viewport, clippingAncestors);
}

function canReceivePointer(element: Element, bounds: Bounds) {
  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return [[0.5, 0.5], [0.8, 0.8], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8]]
    .some(([horizontal, vertical]) => {
      const hit = document.elementFromPoint(
        bounds.left + width * horizontal,
        bounds.top + height * vertical,
      );
      return hit === element || Boolean(hit && element.contains(hit));
    });
}

function getGeometry(element: Element, viewport: Bounds): TargetGeometry | null {
  if (!element.isConnected || element.closest('[inert], [aria-hidden="true"]')) return null;
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  if (
    rect.width <= 0
    || rect.height <= 0
    || style.visibility === "hidden"
    || style.display === "none"
    || element.matches(':disabled, [aria-disabled="true"]')
  ) return null;
  const clipping = getTargetClipping(element, viewport);
  const visible = clipping.visibleClip && intersectBounds(getElementBounds(element), clipping.visibleClip);
  if (!visible || !canReceivePointer(element, visible)) return null;

  const padding = TARGET_PADDING;
  const left = Math.max(clipping.visibleClip!.left + 6, visible.left - padding);
  const top = Math.max(clipping.visibleClip!.top + 6, visible.top - padding);
  const right = Math.min(clipping.visibleClip!.right - 6, visible.right + padding);
  const bottom = Math.min(clipping.visibleClip!.bottom - 6, visible.bottom + padding);
  if (right <= left || bottom <= top) return null;

  const corner = style.borderTopLeftRadius;
  const radius = corner.endsWith("%")
    ? Math.min(rect.width, rect.height) * parseFloat(corner) / 100
    : parseFloat(corner) || 0;

  return {
    left,
    top,
    right,
    bottom,
    width: right - left,
    height: bottom - top,
    radius: Math.min((right - left) / 2, (bottom - top) / 2, Math.max(12, radius + padding)),
  };
}

function sameGeometry(previous: TargetGeometry | null, next: TargetGeometry | null) {
  if (previous === next) return true;
  if (!previous || !next) return false;
  return (
    Math.abs(previous.left - next.left) < 0.5
    && Math.abs(previous.top - next.top) < 0.5
    && Math.abs(previous.width - next.width) < 0.5
    && Math.abs(previous.height - next.height) < 0.5
    && previous.radius === next.radius
  );
}

function getAncestors(element: Element | null) {
  const ancestors: Element[] = [];
  for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
    ancestors.push(ancestor);
  }
  return ancestors;
}

function isAvailableTarget(element: Element) {
  if (
    !element.isConnected
    || element.closest('[inert], [aria-hidden="true"]')
    || element.matches(':disabled, [aria-disabled="true"]')
  ) return false;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

export function useOnboardingTarget(selector: string, stepId: string) {
  const targetRef = useRef<Element | null>(null);
  const [state, setState] = useState<TargetState>({
    stepId, geometry: null, tracking: false, ready: false,
  });

  useLayoutEffect(() => {
    let frameId: number | null = null;
    let retryTimer: number | null = null;
    let revealTimer: number | null = null;
    let geometry: TargetGeometry | null = null;
    let tracking = false;
    let ready = false;
    let stableFrames = 0;
    let settleFrames = 0;
    let initialized = false;
    let ancestors: Element[] = [];
    let pendingReveal = false;
    let retryUntil = performance.now() + TARGET_WAIT_WINDOW_MS;
    targetRef.current = null;

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => scheduleMeasure());

    function scheduleMeasure(resetSettleBudget = true) {
      if (resetSettleBudget) settleFrames = 0;
      if (frameId === null) frameId = window.requestAnimationFrame(measure);
    }

    function clearRevealTimer() {
      if (revealTimer !== null) {
        window.clearTimeout(revealTimer);
        revealTimer = null;
      }
    }

    function finishReveal() {
      if (!pendingReveal) return;
      pendingReveal = false;
      clearRevealTimer();
      scheduleMeasure();
    }

    function scheduleRevealFinish(delay: number) {
      clearRevealTimer();
      revealTimer = window.setTimeout(finishReveal, delay);
    }

    function resetTargetWait() {
      retryUntil = performance.now() + TARGET_WAIT_WINDOW_MS;
      if (retryTimer !== null) {
        window.clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function scheduleRetry() {
      if (frameId !== null || retryTimer !== null || pendingReveal) return;
      const remaining = retryUntil - performance.now();
      if (remaining <= 0) return;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        settleFrames = 0;
        scheduleMeasure();
      }, Math.min(TARGET_RETRY_INTERVAL_MS, remaining));
    }

    function requestReveal(target: Element, viewport: Bounds, scrollports: readonly Bounds[]) {
      if (pendingReveal) return false;
      const plan = getRevealPlan(getElementBounds(target), [viewport, ...scrollports]);
      if (!plan.needed || typeof target.scrollIntoView !== "function") return false;

      pendingReveal = true;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      try {
        target.scrollIntoView({
          block: plan.block,
          inline: plan.inline,
          behavior: reducedMotion ? "instant" : "smooth",
        });
      } catch {
        pendingReveal = false;
        return false;
      }
      scheduleRevealFinish(reducedMotion ? 0 : REVEAL_FALLBACK_MS);
      return true;
    }

    function handleScroll() {
      if (pendingReveal) scheduleRevealFinish(REVEAL_IDLE_MS);
      resetTargetWait();
      scheduleMeasure();
    }

    function handleScrollEnd() {
      if (pendingReveal) scheduleRevealFinish(80);
      scheduleMeasure();
    }

    function measure() {
      frameId = null;
      const viewport = getViewportBounds(
        window.visualViewport,
        window.innerWidth,
        window.innerHeight,
      );
      let target = targetRef.current;
      if (target && !isAvailableTarget(target)) target = null;
      let clipping = target ? getTargetClipping(target, viewport) : null;
      let nextGeometry = target ? getGeometry(target, viewport) : null;
      if (!nextGeometry) {
        for (const candidate of document.querySelectorAll(selector)) {
          if (!isAvailableTarget(candidate)) continue;
          const candidateClipping = getTargetClipping(candidate, viewport);
          nextGeometry = getGeometry(candidate, viewport);
          if (nextGeometry) {
            target = candidate;
            clipping = candidateClipping;
            break;
          }
          if (!target) {
            target = candidate;
            clipping = candidateClipping;
          }
        }
      }

      const targetChanged = target !== targetRef.current;
      targetRef.current = target;
      const nextAncestors = getAncestors(target);
      if (
        nextAncestors.length !== ancestors.length
        || nextAncestors.some((ancestor, index) => ancestor !== ancestors[index])
      ) {
        resizeObserver?.disconnect();
        ancestors = nextAncestors;
        for (const ancestor of ancestors) resizeObserver?.observe(ancestor);
      }

      const animating = ancestors.some((ancestor) =>
        ancestor.getAnimations?.().some((animation) =>
          (animation.playState === "running" || animation.pending)
          && animation.effect?.getComputedTiming().iterations !== Infinity
        )
      );
      if (target && clipping && !animating) {
        requestReveal(target, viewport, clipping.scrollports);
      }
      const geometryChanged = !sameGeometry(geometry, nextGeometry);
      const nextTracking = pendingReveal || animating || (!targetChanged && geometryChanged);
      stableFrames = targetChanged || geometryChanged || animating || pendingReveal
        ? 0
        : stableFrames + 1;
      const nextReady = Boolean(nextGeometry && stableFrames >= 2 && !animating && !pendingReveal);
      if (!initialized || geometryChanged || tracking !== nextTracking || ready !== nextReady) {
        initialized = true;
        geometry = nextGeometry;
        tracking = nextTracking;
        ready = nextReady;
        setState({ stepId, geometry, tracking, ready });
      }
      if (!target || !nextGeometry) {
        scheduleRetry();
      } else if (pendingReveal) {
        return;
      } else if (animating || geometryChanged || !nextReady) {
        if (settleFrames < SETTLE_FRAME_BUDGET) {
          settleFrames++;
          scheduleMeasure(false);
        } else {
          settleFrames = 0;
          scheduleRetry();
        }
      }
    }

    const mutationObserver = typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver((mutations) => {
        if (mutations.some((mutation) => {
          if (mutation.type === "childList") return true;
          const element = mutation.target;
          if (!(element instanceof Element)) return false;
          if (element.closest(".sc-onboarding")) return false;
          const target = targetRef.current;
          return !target?.isConnected || element.contains(target) || target.contains(element);
        })) {
          resetTargetWait();
          scheduleMeasure();
        }
      });
    mutationObserver?.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-expanded", "aria-pressed", "aria-hidden", "aria-disabled", "disabled", "inert"],
    });

    const handleMotion = (event: Event) => {
      const element = event.target;
      const target = targetRef.current;
      if (
        element instanceof Element
        && target
        && (element.contains(target) || target.contains(element))
      ) {
        resetTargetWait();
        scheduleMeasure();
      }
    };

    for (const eventName of MOTION_EVENTS) document.addEventListener(eventName, handleMotion, true);
    window.addEventListener("resize", handleScroll);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("scrollend", handleScrollEnd);
    window.addEventListener("orientationchange", handleScroll);
    document.addEventListener("scrollend", handleScrollEnd, true);
    window.visualViewport?.addEventListener("resize", handleScroll);
    window.visualViewport?.addEventListener("scroll", handleScroll);
    measure();

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      if (retryTimer !== null) window.clearTimeout(retryTimer);
      clearRevealTimer();
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      for (const eventName of MOTION_EVENTS) document.removeEventListener(eventName, handleMotion, true);
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("scrollend", handleScrollEnd);
      window.removeEventListener("orientationchange", handleScroll);
      document.removeEventListener("scrollend", handleScrollEnd, true);
      window.visualViewport?.removeEventListener("resize", handleScroll);
      window.visualViewport?.removeEventListener("scroll", handleScroll);
      targetRef.current = null;
    };
  }, [selector, stepId]);

  const current = state.stepId === stepId;
  return {
    targetRef,
    targetGeometry: current ? state.geometry : null,
    tracking: current && state.tracking,
    ready: current && state.ready,
  };
}
