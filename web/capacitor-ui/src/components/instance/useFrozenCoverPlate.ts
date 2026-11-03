import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { coverIsTransparent, queueFrozenPlate } from "./frozenCoverPlate";

const resizeSubscribers = new Set<() => void>();
const refreshOnResize = () => {
  for (const refresh of resizeSubscribers) refresh();
};

function subscribeResize(refresh: () => void) {
  if (resizeSubscribers.size === 0) window.addEventListener("resize", refreshOnResize);
  resizeSubscribers.add(refresh);
  return () => {
    resizeSubscribers.delete(refresh);
    if (resizeSubscribers.size === 0) window.removeEventListener("resize", refreshOnResize);
  };
}

export function useFrozenCoverPlate(
  isLight: boolean,
  isDynamic: boolean,
  isReordering: boolean,
  coverSrc?: string,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const [usePlate, setUsePlate] = useState(() => !coverSrc || /cover-clear-|tavern-logo/i.test(coverSrc));

  useLayoutEffect(() => {
    const root = rootRef.current;
    const host = plateRef.current;
    if (usePlate && root && host) return queueFrozenPlate(host, root, true);
  }, [usePlate, isReordering, isLight, isDynamic, coverSrc]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || isReordering) return;
    const cover = coverSrc ? root.querySelector("img") : null;
    if (coverSrc && !cover) return;
    let cancelRefresh: (() => void) | undefined;
    const refresh = () => {
      const knownClear = !coverSrc || /cover-clear-|tavern-logo/i.test(coverSrc);
      if (!knownClear && cover && (!cover.complete || !coverIsTransparent(cover))) {
        setUsePlate(false);
        return;
      }
      setUsePlate(true);
      const host = plateRef.current;
      if (host) cancelRefresh = queueFrozenPlate(host, root);
    };
    cover?.addEventListener("load", refresh);
    const timer = window.setTimeout(refresh, 60);
    const unsubscribeResize = subscribeResize(refresh);
    return () => {
      window.clearTimeout(timer);
      cover?.removeEventListener("load", refresh);
      unsubscribeResize();
      cancelRefresh?.();
    };
  }, [coverSrc, isReordering, isLight, isDynamic]);

  return { rootRef, plateRef, usePlate };
}
