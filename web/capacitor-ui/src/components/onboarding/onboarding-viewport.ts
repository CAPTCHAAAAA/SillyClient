export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface ViewportMetrics {
  offsetLeft?: number | null;
  offsetTop?: number | null;
  width?: number | null;
  height?: number | null;
}

export interface RevealPlan {
  needed: boolean;
  block: ScrollLogicalPosition;
  inline: ScrollLogicalPosition;
}

export interface ClipAncestor {
  bounds: Bounds;
  scrollable: boolean;
}

export interface TargetClipping {
  visibleClip: Bounds | null;
  scrollports: Bounds[];
}

function intersectAll(bounds: readonly Bounds[]) {
  let result: Bounds | null = bounds[0] ?? null;
  for (let index = 1; result && index < bounds.length; index++) {
    result = intersectBounds(result, bounds[index]);
  }
  return result;
}

export function getViewportBounds(
  viewport: ViewportMetrics | null | undefined,
  layoutWidth: number,
  layoutHeight: number,
): Bounds {
  const metrics = viewport ?? {};
  const left = Number.isFinite(metrics.offsetLeft) ? metrics.offsetLeft! : 0;
  const top = Number.isFinite(metrics.offsetTop) ? metrics.offsetTop! : 0;
  const width = Number.isFinite(metrics.width) && metrics.width! > 0
    ? metrics.width!
    : Math.max(0, layoutWidth);
  const height = Number.isFinite(metrics.height) && metrics.height! > 0
    ? metrics.height!
    : Math.max(0, layoutHeight);
  return { left, top, right: left + width, bottom: top + height };
}

export function intersectBounds(first: Bounds, second: Bounds): Bounds | null {
  const left = Math.max(first.left, second.left);
  const top = Math.max(first.top, second.top);
  const right = Math.min(first.right, second.right);
  const bottom = Math.min(first.bottom, second.bottom);
  return right > left && bottom > top ? { left, top, right, bottom } : null;
}

export function resolveTargetClipping(
  viewport: Bounds,
  ancestors: readonly ClipAncestor[],
): TargetClipping {
  const visibleClip = intersectAll([viewport, ...ancestors.map(({ bounds }) => bounds)]);
  const scrollports = ancestors.flatMap((ancestor, index) => {
    if (!ancestor.scrollable) return [];
    const visibleScrollport = intersectAll([
      viewport,
      ...ancestors.slice(index).map(({ bounds }) => bounds),
    ]);
    return visibleScrollport ? [visibleScrollport] : [];
  });

  return { visibleClip, scrollports };
}

function axisNeedsReveal(
  targetStart: number,
  targetEnd: number,
  clipStart: number,
  clipEnd: number,
  margin: number,
) {
  const start = clipStart + margin;
  const end = clipEnd - margin;
  const targetSize = targetEnd - targetStart;
  if (end <= start) return { needed: false, oversized: false };
  if (targetSize > end - start) {
    return { needed: Math.abs(targetStart - start) > 1, oversized: true };
  }
  return {
    needed: targetStart < start - 1 || targetEnd > end + 1,
    oversized: false,
  };
}

export function getRevealPlan(
  target: Bounds,
  clips: readonly Bounds[],
  margin = 8,
): RevealPlan {
  let needed = false;
  let oversizedBlock = false;
  let oversizedInline = false;

  for (const clip of clips) {
    const vertical = axisNeedsReveal(target.top, target.bottom, clip.top, clip.bottom, margin);
    const horizontal = axisNeedsReveal(target.left, target.right, clip.left, clip.right, margin);
    needed ||= vertical.needed || horizontal.needed;
    oversizedBlock ||= vertical.oversized;
    oversizedInline ||= horizontal.oversized;
  }

  return {
    needed,
    block: oversizedBlock ? "start" : "nearest",
    inline: oversizedInline ? "start" : "nearest",
  };
}

export function getCalloutPosition(
  target: Bounds,
  preferredWidth: number,
  height: number,
  viewport: Bounds,
  gap = 18,
  margin = 16,
) {
  const viewportWidth = Math.max(0, viewport.right - viewport.left);
  const width = Math.min(preferredWidth, Math.max(0, viewportWidth - margin * 2));
  const minLeft = viewport.left + margin;
  const maxLeft = Math.max(minLeft, viewport.right - margin - width);
  const left = Math.max(minLeft, Math.min(target.left, maxLeft));
  const belowTop = target.bottom + gap;
  const top = belowTop + height <= viewport.bottom - margin
    ? belowTop
    : Math.max(viewport.top + margin, target.top - height - gap);
  return { left, top, width };
}
