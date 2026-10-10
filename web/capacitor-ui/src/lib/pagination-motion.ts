export const PAGINATION_SLOT_WIDTH = 22;
export const PAGINATION_REST_WIDTH = 18;
export const PAGINATION_DURATION = 260;

export interface PaginationPose {
  center: number;
  width: number;
}

interface FrameScheduler {
  now: () => number;
  request: (callback: FrameRequestCallback) => number;
  cancel: (frame: number) => void;
}

const clamp = (value: number, min = 0, max = 1) => Math.max(min, Math.min(max, value));

export const paginationCenter = (index: number) => index * PAGINATION_SLOT_WIDTH + PAGINATION_SLOT_WIDTH / 2;

// Invert the x component of cubic-bezier(0.23, 1, 0.32, 1).
export function paginationEase(progress: number): number {
  const x = clamp(progress);
  if (x === 0 || x === 1) return x;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 18; iteration++) {
    const t = (low + high) / 2;
    const inverse = 1 - t;
    const curveX = 3 * inverse * inverse * t * 0.23 + 3 * inverse * t * t * 0.32 + t * t * t;
    if (curveX < x) low = t;
    else high = t;
  }
  return 1 - Math.pow(1 - (low + high) / 2, 3);
}

export function samplePaginationPose(start: PaginationPose, target: number, progress: number): PaginationPose {
  if (progress >= 1) return { center: target, width: PAGINATION_REST_WIDTH };
  const p = paginationEase(progress);
  const amplitude = Math.min(20, Math.abs(target - start.center) / PAGINATION_SLOT_WIDTH * 8);
  return {
    center: start.center + (target - start.center) * p,
    width: clamp(
      start.width + (PAGINATION_REST_WIDTH - start.width) * p + amplitude * 4 * p * (1 - p),
      PAGINATION_REST_WIDTH,
      38,
    ),
  };
}

export function paginationDotOpacity(dotCenter: number, pose: PaginationPose): number {
  return clamp((Math.abs(dotCenter - pose.center) - pose.width / 2 - 4) / 4);
}

export function createPaginationMotion(
  initialIndex: number,
  render: (pose: PaginationPose) => void,
  scheduler: FrameScheduler = {
    now: () => performance.now(),
    request: callback => requestAnimationFrame(callback),
    cancel: frame => cancelAnimationFrame(frame),
  },
) {
  let target = paginationCenter(initialIndex);
  let pose = { center: target, width: PAGINATION_REST_WIDTH };
  let movement: { start: PaginationPose; time: number } | null = null;
  let frame = 0;
  let disposed = false;

  const cancel = () => {
    if (frame) scheduler.cancel(frame);
    frame = 0;
    movement = null;
  };
  const snap = () => {
    if (disposed) return;
    cancel();
    pose = { center: target, width: PAGINATION_REST_WIDTH };
    render(pose);
  };
  const advancePagination = (time: number) => {
    frame = 0;
    if (!movement || disposed) return;
    const progress = clamp((time - movement.time) / PAGINATION_DURATION);
    pose = samplePaginationPose(movement.start, target, progress);
    render(pose);
    if (progress < 1) frame = scheduler.request(advancePagination);
    else movement = null;
  };

  render(pose);
  return {
    to(index: number, animated = true) {
      if (disposed) return;
      const nextTarget = paginationCenter(index);
      if (!animated) {
        target = nextTarget;
        snap();
        return;
      }
      if (target === nextTarget) return;
      cancel();
      target = nextTarget;
      movement = { start: pose, time: scheduler.now() };
      frame = scheduler.request(advancePagination);
    },
    snap,
    dispose() {
      cancel();
      disposed = true;
    },
  };
}
