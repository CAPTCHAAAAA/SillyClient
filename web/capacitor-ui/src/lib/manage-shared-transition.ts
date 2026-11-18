export interface ScrollOffsetRecord {
  index: number;
  top: number;
  left: number;
}

export interface CapturedManageSnapshot {
  kind: "list" | "terminal";
  tab: string;
  instanceId: string;
  tabIndex: number;
  containerSize: { width: number; height: number };
  faceClone?: HTMLElement;
  scrollOffsets: ScrollOffsetRecord[];
  wellBox?: { left: number; top: number; width: number; height: number };
  wellClone?: HTMLElement;
  wellScrollOffsets: ScrollOffsetRecord[];
}

export interface DirectionalSlideFrame {
  outOpacity: number;
  outShiftPx: number;
  outBlurPx: number;
  inOpacity: number;
  inShiftPx: number;
  inBlurPx: number;
  featherPx: number;
}

export const MANAGE_PAGE_TRANSITION_MS = 780;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const remap = (p: number, start: number, end: number) =>
  end <= start ? (p >= end ? 1 : 0) : clamp01((p - start) / (end - start));
const smoothstep = (t: number) => t * t * (3 - 2 * t);

/**
 * Solve global unified `--motion-dissolve-ease: cubic-bezier(0.5, 0, 0.2, 1)`
 * so folder ear, container resize, sidebar cards, and flat sheet transitions
 * stay locked to the exact same phase across 780ms.
 */
export function easeSharedTransition(progress: number): number {
  const x = clamp01(progress);
  if (x <= 0 || x >= 1) return x;
  let lo = 0;
  let hi = 1;
  let u = x;
  for (let i = 0; i < 14; i += 1) {
    u = (lo + hi) * 0.5;
    const inv = 1 - u;
    const cx = 3 * inv * inv * u * 0.5 + 3 * inv * u * u * 0.2 + u * u * u;
    if (cx < x) lo = u;
    else hi = u;
  }
  const inv = 1 - u;
  return 3 * inv * u * u + u * u * u;
}

/**
 * Ride directly on the single global 780ms `cubic-bezier(0.5, 0, 0.2, 1)` phase `p`
 * without nested early-cutoff easing multipliers, so outgoing & incoming sheets glide
 * at the exact same slow-start / gentle-glide / long-cushion cadence as the folder ear
 * and container resize.
 */
export function computeDirectionalSlideFrame(
  progress: number,
  direction: -1 | 1,
  travelPx = 18,
  maxFeatherPx = 28
): DirectionalSlideFrame {
  const p = clamp01(progress);
  const midBell = p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p);

  const outFadeP = remap(p, 0, 0.68);
  const inFadeP = remap(p, 0.14, 0.94);
  const inFocusP = remap(p, 0.14, 0.90);

  return {
    outOpacity: 1 - smoothstep(outFadeP),
    outShiftPx: -direction * (travelPx * 0.85) * p,
    outBlurPx: outFadeP * 3.0,
    inOpacity: smoothstep(inFadeP),
    inShiftPx: direction * travelPx * (1 - p),
    inBlurPx: (1 - inFocusP) * 3.4,
    featherPx: midBell * maxFeatherPx,
  };
}

export function buildLinearFeatherMask(axis: "x" | "y", featherPx: number): string {
  if (featherPx <= 0.6) return "";
  const direction = axis === "x" ? "to right" : "to bottom";
  const s1 = (featherPx * 0.25).toFixed(1);
  const s2 = (featherPx * 0.58).toFixed(1);
  const s3 = (featherPx * 0.84).toFixed(1);
  const edge = featherPx.toFixed(1);
  return `linear-gradient(${direction}, transparent 0px, rgba(0, 0, 0, 0.14) ${s1}px, rgba(0, 0, 0, 0.56) ${s2}px, rgba(0, 0, 0, 0.88) ${s3}px, #000 ${edge}px, #000 calc(100% - ${edge}px), rgba(0, 0, 0, 0.88) calc(100% - ${s3}px), rgba(0, 0, 0, 0.56) calc(100% - ${s2}px), rgba(0, 0, 0, 0.14) calc(100% - ${s1}px), transparent 100%)`;
}

/**
 * Build a screen-stationary feather mask inside an element's local coordinate space by
 * counter-shifting stops by `-shiftPx`, so translated inputs/cards melt into the padded
 * aperture gradient before reaching any container boundary.
 */
export function buildStationarySlideMask(params: {
  axis: "x" | "y";
  spanPx: number;
  bleedPx: number;
  shiftPx: number;
  featherPx: number;
  bottomClipPx?: number | null;
  bottomFeatherPx?: number;
}): { maskImage: string; composite: boolean } {
  const {
    axis,
    spanPx,
    bleedPx,
    shiftPx,
    featherPx,
    bottomClipPx = null,
    bottomFeatherPx = 0,
  } = params;
  const layers: string[] = [];

  if (featherPx > 0.6 && spanPx > 1) {
    const f = Math.min(featherPx, (spanPx + bleedPx * 2) * 0.42);
    const leftStart = -bleedPx - shiftPx;
    const rightEnd = spanPx + bleedPx - shiftPx;
    const leftEnd = leftStart + f;
    const rightStart = rightEnd - f;
    const dir = axis === "x" ? "to right" : "to bottom";

    if (leftEnd < rightStart) {
      layers.push(
        `linear-gradient(${dir}, transparent ${leftStart.toFixed(1)}px, rgba(0, 0, 0, 0.16) ${(leftStart + f * 0.28).toFixed(1)}px, rgba(0, 0, 0, 0.60) ${(leftStart + f * 0.62).toFixed(1)}px, #000 ${leftEnd.toFixed(1)}px, #000 ${rightStart.toFixed(1)}px, rgba(0, 0, 0, 0.60) ${(rightEnd - f * 0.62).toFixed(1)}px, rgba(0, 0, 0, 0.16) ${(rightEnd - f * 0.28).toFixed(1)}px, transparent ${rightEnd.toFixed(1)}px)`
      );
    } else {
      layers.push(
        `linear-gradient(${dir}, transparent ${leftStart.toFixed(1)}px, rgba(0, 0, 0, 0.72) ${((leftStart + rightEnd) * 0.5).toFixed(1)}px, transparent ${rightEnd.toFixed(1)}px)`
      );
    }
  }

  if (bottomClipPx !== null && bottomFeatherPx > 0.6 && bottomClipPx > 12) {
    const bf = Math.min(bottomFeatherPx, bottomClipPx * 0.45);
    const vStart = Math.max(0, bottomClipPx - bf);
    const vEnd = bottomClipPx;
    layers.push(
      `linear-gradient(to bottom, #000 0px, #000 ${vStart.toFixed(1)}px, rgba(0, 0, 0, 0.52) ${(vStart + bf * 0.48).toFixed(1)}px, transparent ${vEnd.toFixed(1)}px)`
    );
  }

  return {
    maskImage: layers.join(", "),
    composite: layers.length > 1,
  };
}

function applyStationaryMask(
  el: HTMLElement,
  spec: { maskImage: string; composite: boolean }
): void {
  el.style.maskImage = spec.maskImage;
  el.style.webkitMaskImage = spec.maskImage;
  if (spec.composite) {
    el.style.maskComposite = "intersect";
    el.style.setProperty("-webkit-mask-composite", "source-in");
  } else {
    el.style.removeProperty("mask-composite");
    el.style.removeProperty("-webkit-mask-composite");
  }
}

const formatBlurFilter = (px: number): string => (px > 0.06 ? `blur(${px.toFixed(2)}px)` : "none");

function formatFlatTranslate(axis: "x" | "y", shiftPx: number): string {
  const x = axis === "x" ? shiftPx.toFixed(2) : "0";
  const y = axis === "y" ? shiftPx.toFixed(2) : "0";
  return `translate3d(${x}px, ${y}px, 0)`;
}

function registerLiveStyle(
  el: HTMLElement | null,
  restorers: Array<() => void>
): void {
  if (!el) return;
  const prevTransform = el.style.transform;
  const prevOpacity = el.style.opacity;
  const prevFilter = el.style.filter;
  const prevMask = el.style.maskImage;
  const prevWebkitMask = el.style.webkitMaskImage;
  const prevMaskComposite = el.style.maskComposite;
  const prevWebkitMaskComposite = el.style.getPropertyValue("-webkit-mask-composite");
  const prevTransition = el.style.transition;
  const prevWill = el.style.willChange;

  el.style.setProperty("transition", "none", "important");
  restorers.push(() => {
    el.style.transform = prevTransform;
    el.style.opacity = prevOpacity;
    el.style.filter = prevFilter;
    el.style.maskImage = prevMask;
    el.style.webkitMaskImage = prevWebkitMask;
    el.style.maskComposite = prevMaskComposite;
    if (prevWebkitMaskComposite) el.style.setProperty("-webkit-mask-composite", prevWebkitMaskComposite);
    else el.style.removeProperty("-webkit-mask-composite");
    el.style.willChange = prevWill;
    if (prevTransition) el.style.transition = prevTransition;
    else el.style.removeProperty("transition");
  });
}

function startTimedPhaseLoop(
  applyFrame: (p: number) => void,
  restorers: Array<() => void>,
  onExtraCleanup?: () => void,
  onFinish?: () => void
): () => void {
  let frameId: number | null = null;
  let cleaned = false;

  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (frameId !== null) {
      cancelAnimationFrame(frameId);
      frameId = null;
    }
    onExtraCleanup?.();
    for (const restore of restorers) restore();
    restorers.length = 0;
  };

  applyFrame(0);
  const start = performance.now();
  const tick = (now: number) => {
    if (cleaned) return;
    const raw = clamp01((now - start) / MANAGE_PAGE_TRANSITION_MS);
    const eased = easeSharedTransition(raw);
    applyFrame(eased);
    if (raw < 1) {
      frameId = requestAnimationFrame(tick);
      return;
    }
    frameId = null;
    cleanup();
    onFinish?.();
  };
  frameId = requestAnimationFrame(tick);

  return cleanup;
}

function collectScrollOffsets(root: HTMLElement): ScrollOffsetRecord[] {
  const offsets: ScrollOffsetRecord[] = [];
  const all = [root, ...root.querySelectorAll<HTMLElement>("*")];
  all.forEach((node, index) => {
    if (node.scrollTop > 0 || node.scrollLeft > 0) {
      offsets.push({ index, top: node.scrollTop, left: node.scrollLeft });
    }
  });
  return offsets;
}

function restoreScrollOffsets(root: HTMLElement, offsets: readonly ScrollOffsetRecord[]): void {
  if (offsets.length === 0) return;
  const all = [root, ...root.querySelectorAll<HTMLElement>("*")];
  for (const rec of offsets) {
    const target = all[rec.index];
    if (!target) continue;
    target.scrollTop = rec.top;
    target.scrollLeft = rec.left;
  }
}

function cloneNodeClean(source: HTMLElement): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement;
  clone.querySelectorAll<HTMLElement>("[id]").forEach((n) => n.removeAttribute("id"));
  const srcInputs = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  const dstInputs = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
  srcInputs.forEach((node, idx) => {
    const target = dstInputs[idx];
    if (!target) return;
    target.value = node.value;
    if ("checked" in node && "checked" in target) {
      target.checked = node.checked;
    }
  });
  clone.style.setProperty("transition", "none", "important");
  clone.style.pointerEvents = "none";
  return clone;
}

function measureScale(stackEl: HTMLElement): number {
  const rect = stackEl.getBoundingClientRect();
  const logicalW = stackEl.offsetWidth || stackEl.clientWidth;
  if (!logicalW || rect.width <= 0) return 1;
  const s = rect.width / logicalW;
  return s > 0.05 ? s : 1;
}

export function captureManagePageSnapshot(
  stackEl: HTMLElement,
  faceEl: HTMLElement,
  meta: { tab: string; instanceId: string; tabIndex: number }
): CapturedManageSnapshot {
  const width = faceEl.offsetWidth || stackEl.offsetWidth || stackEl.clientWidth || 1;
  const height = faceEl.offsetHeight || stackEl.offsetHeight || stackEl.clientHeight || 1;

  if (meta.tab === "terminal") {
    const wellEl = faceEl.querySelector<HTMLElement>("[data-manage-well]");
    if (wellEl) {
      const scale = measureScale(stackEl);
      const stackRect = stackEl.getBoundingClientRect();
      const wellRect = wellEl.getBoundingClientRect();
      const wellClone = cloneNodeClean(wellEl);
      wellClone.style.background = "transparent";
      wellClone.style.boxShadow = "none";
      const wellScrollOffsets = collectScrollOffsets(wellEl);

      const faceClone = cloneNodeClean(faceEl);
      const scrollOffsets = collectScrollOffsets(faceEl);

      return {
        kind: "terminal",
        tab: meta.tab,
        instanceId: meta.instanceId,
        tabIndex: meta.tabIndex,
        containerSize: { width, height },
        faceClone,
        scrollOffsets,
        wellBox: {
          left: (wellRect.left - stackRect.left) / scale,
          top: (wellRect.top - stackRect.top) / scale,
          width: wellRect.width / scale,
          height: wellRect.height / scale,
        },
        wellClone,
        wellScrollOffsets,
      };
    }
  }

  return {
    kind: "list",
    tab: meta.tab,
    instanceId: meta.instanceId,
    tabIndex: meta.tabIndex,
    containerSize: { width, height },
    faceClone: cloneNodeClean(faceEl),
    scrollOffsets: collectScrollOffsets(faceEl),
    wellScrollOffsets: [],
  };
}

export function startManageSharedTransition(params: {
  stackEl: HTMLElement;
  overlayEl: HTMLElement;
  toFaceEl: HTMLElement;
  from: CapturedManageSnapshot;
  toMeta: { tab: string; instanceId: string; tabIndex: number };
  instanceDirection: -1 | 1;
  isPortrait?: boolean;
  isLight: boolean;
  onFinish?: () => void;
}): () => void {
  const {
    overlayEl,
    toFaceEl,
    from,
    toMeta,
    instanceDirection,
    isPortrait = false,
    onFinish,
  } = params;

  const isCrossTab = from.tab !== toMeta.tab;
  const axis: "x" | "y" = isCrossTab || isPortrait ? "x" : "y";
  const dir: -1 | 1 = isCrossTab
    ? from.tabIndex <= toMeta.tabIndex
      ? 1
      : -1
    : instanceDirection;

  const restorers: Array<() => void> = [];
  registerLiveStyle(overlayEl, restorers);
  registerLiveStyle(toFaceEl, restorers);
  overlayEl.replaceChildren();

  let applyFrame: (p: number) => void = () => {};

  const toWellEl = toMeta.tab === "terminal"
    ? toFaceEl.querySelector<HTMLElement>("[data-manage-well]")
    : null;

  if (!isCrossTab && from.kind === "terminal" && toMeta.tab === "terminal" && toWellEl && from.wellClone && from.wellBox) {
    // Switching instances while remaining inside 实例终端: keep sunken shell calm, slide inner log feed.
    const innerEls = [...toWellEl.children] as HTMLElement[];
    for (const child of innerEls) registerLiveStyle(child, restorers);

    const oldInner = document.createElement("div");
    oldInner.style.cssText = "position:absolute;overflow:hidden;pointer-events:none;will-change:transform,opacity,filter;";
    oldInner.style.left = `${from.wellBox.left.toFixed(2)}px`;
    oldInner.style.top = `${from.wellBox.top.toFixed(2)}px`;
    oldInner.style.width = `${from.wellBox.width.toFixed(2)}px`;
    oldInner.style.height = `${from.wellBox.height.toFixed(2)}px`;
    oldInner.appendChild(from.wellClone);
    overlayEl.appendChild(oldInner);
    restoreScrollOffsets(from.wellClone, from.wellScrollOffsets);

    const travelPx = isPortrait ? 28 : 20;
    const maxFeatherPx = isPortrait ? 24 : 28;
    applyFrame = (p) => {
      const f = computeDirectionalSlideFrame(p, dir, travelPx, maxFeatherPx);
      const mask = buildLinearFeatherMask(axis, f.featherPx);
      oldInner.style.maskImage = mask;
      oldInner.style.webkitMaskImage = mask;
      oldInner.style.opacity = f.outOpacity.toFixed(4);
      oldInner.style.filter = formatBlurFilter(f.outBlurPx);
      oldInner.style.transform = formatFlatTranslate(axis, f.outShiftPx);

      const inBlur = formatBlurFilter(f.inBlurPx);
      const inTf = formatFlatTranslate(axis, f.inShiftPx);
      for (const child of innerEls) {
        child.style.opacity = f.inOpacity.toFixed(4);
        child.style.filter = inBlur;
        child.style.transform = inTf;
      }
    };
  } else {
    // Unified rigid flat plane slide across folder tabs & instances (zero stagger/scale misalignment).
    const faceClone = from.faceClone;
    if (faceClone) {
      faceClone.style.position = "absolute";
      faceClone.style.left = "0px";
      faceClone.style.top = "0px";
      faceClone.style.width = `${from.containerSize.width}px`;
      faceClone.style.height = `${from.containerSize.height}px`;
      faceClone.style.visibility = "visible";
      faceClone.style.opacity = "1";
      faceClone.style.pointerEvents = "none";
      faceClone.style.willChange = "transform, opacity, filter";
      overlayEl.appendChild(faceClone);
      restoreScrollOffsets(faceClone, from.scrollOffsets);
    }

    const travelPx = isCrossTab ? (isPortrait ? 22 : 26) : (isPortrait ? 20 : 18);
    const maxFeatherPx = isCrossTab ? (isPortrait ? 26 : 36) : (isPortrait ? 22 : 30);
    const stackSpan = axis === "x" ? from.containerSize.width : from.containerSize.height;
    applyFrame = (p) => {
      const f = computeDirectionalSlideFrame(p, dir, travelPx, maxFeatherPx);
      const toSpan = axis === "x"
        ? (toFaceEl.offsetWidth || from.containerSize.width)
        : (toFaceEl.offsetHeight || from.containerSize.height);

      if (faceClone) {
        const outMask = buildStationarySlideMask({
          axis,
          spanPx: stackSpan,
          bleedPx: 0,
          shiftPx: f.outShiftPx,
          featherPx: f.featherPx,
        });
        faceClone.style.opacity = f.outOpacity.toFixed(4);
        faceClone.style.filter = formatBlurFilter(f.outBlurPx);
        faceClone.style.transform = formatFlatTranslate(axis, f.outShiftPx);
        applyStationaryMask(faceClone, outMask);
      }

      const inMask = buildStationarySlideMask({
        axis,
        spanPx: toSpan,
        bleedPx: 0,
        shiftPx: f.inShiftPx,
        featherPx: f.featherPx,
      });
      toFaceEl.style.opacity = f.inOpacity.toFixed(4);
      toFaceEl.style.filter = formatBlurFilter(f.inBlurPx);
      toFaceEl.style.transform = formatFlatTranslate(axis, f.inShiftPx);
      applyStationaryMask(toFaceEl, inMask);
    };
  }

  return startTimedPhaseLoop(
    applyFrame,
    restorers,
    () => overlayEl.replaceChildren(),
    onFinish
  );
}
