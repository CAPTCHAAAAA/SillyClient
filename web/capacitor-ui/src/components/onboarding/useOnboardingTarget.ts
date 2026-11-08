import { useLayoutEffect, useRef, useState } from "react";

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
const MOTION_EVENTS = [
  "animationstart",
  "animationend",
  "animationcancel",
  "transitionrun",
  "transitionend",
  "transitioncancel",
] as const;

function getGeometry(element: Element): TargetGeometry | null {
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
  const canReceivePointer = [[0.5, 0.5], [0.8, 0.8], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8]]
    .some(([horizontal, vertical]) => {
      const hit = document.elementFromPoint(
        rect.left + rect.width * horizontal,
        rect.top + rect.height * vertical,
      );
      return hit === element || Boolean(hit && element.contains(hit));
    });
  if (!canReceivePointer) return null;

  const padding = TARGET_PADDING;
  const left = Math.max(6, rect.left - padding);
  const top = Math.max(6, rect.top - padding);
  const right = Math.min(window.innerWidth - 6, rect.right + padding);
  const bottom = Math.min(window.innerHeight - 6, rect.bottom + padding);
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

function revealTarget(element: Element) {
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = window.getComputedStyle(ancestor);
    if (!/auto|scroll|overlay/.test(style.overflowY) || ancestor.scrollHeight <= ancestor.clientHeight) continue;
    const rect = element.getBoundingClientRect();
    const container = ancestor.getBoundingClientRect();
    const top = Math.max(8, container.top + ancestor.clientTop + 8);
    const bottom = Math.min(window.innerHeight - 8, container.top + ancestor.clientTop + ancestor.clientHeight - 8);
    if (bottom <= top) continue;
    const delta = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
    const scrollTop = Math.max(0, Math.min(ancestor.scrollHeight - ancestor.clientHeight, ancestor.scrollTop + delta));
    if (Math.abs(scrollTop - ancestor.scrollTop) < 1) continue;
    ancestor.scrollTo({
      top: scrollTop,
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
    return true;
  }
  return false;
}

export function useOnboardingTarget(selector: string, stepId: string) {
  const targetRef = useRef<Element | null>(null);
  const [state, setState] = useState<TargetState>({
    stepId, geometry: null, tracking: false, ready: false,
  });

  useLayoutEffect(() => {
    let frameId: number | null = null;
    let geometry: TargetGeometry | null = null;
    let tracking = false;
    let ready = false;
    let stableFrames = 0;
    let initialized = false;
    let ancestors: Element[] = [];
    const revealedTargets = new WeakSet<Element>();
    targetRef.current = null;

    const resizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleMeasure);

    function scheduleMeasure() {
      if (frameId === null) frameId = window.requestAnimationFrame(measure);
    }

    function measure() {
      frameId = null;
      let target = targetRef.current;
      if (target && !isAvailableTarget(target)) target = null;
      let nextGeometry = target ? getGeometry(target) : null;
      if (!nextGeometry) {
        for (const candidate of document.querySelectorAll(selector)) {
          if (!isAvailableTarget(candidate)) continue;
          nextGeometry = getGeometry(candidate);
          if (nextGeometry) {
            target = candidate;
            break;
          }
          target ||= candidate;
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
      if (target && !animating && !revealedTargets.has(target)) {
        revealedTargets.add(target);
        if (revealTarget(target)) {
          nextGeometry = getGeometry(target);
          scheduleMeasure();
        }
      }
      const geometryChanged = !sameGeometry(geometry, nextGeometry);
      const nextTracking = animating || (!targetChanged && geometryChanged);
      stableFrames = targetChanged || geometryChanged || animating ? 0 : stableFrames + 1;
      const nextReady = Boolean(nextGeometry && stableFrames >= 2);
      if (!initialized || geometryChanged || tracking !== nextTracking || ready !== nextReady) {
        initialized = true;
        geometry = nextGeometry;
        tracking = nextTracking;
        ready = nextReady;
        setState({ stepId, geometry, tracking, ready });
      }
      if (animating || geometryChanged || (target && !nextReady)) scheduleMeasure();
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
        })) scheduleMeasure();
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
      ) scheduleMeasure();
    };

    for (const eventName of MOTION_EVENTS) document.addEventListener(eventName, handleMotion, true);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("scroll", scheduleMeasure, true);
    window.addEventListener("orientationchange", scheduleMeasure);
    window.visualViewport?.addEventListener("resize", scheduleMeasure);
    measure();

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      for (const eventName of MOTION_EVENTS) document.removeEventListener(eventName, handleMotion, true);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("scroll", scheduleMeasure, true);
      window.removeEventListener("orientationchange", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
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
