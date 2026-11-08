import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
import type { ManageTab } from "../../types";

export const MANAGE_VISUAL_SCALE = 0.67;
const DEFAULT_WIDTH = 940 * MANAGE_VISUAL_SCALE;
const MIN_WIDTH = 580;
const VIEW_GUTTER = 32;

interface ManagePanelLayoutOptions {
  visible: boolean;
  ready: boolean;
  isPortrait: boolean;
  isLocal: boolean;
  tab: ManageTab;
  instanceId?: string;
  surfaceRef: RefObject<HTMLDivElement | null>;
  paneRef: RefObject<HTMLElement | null>;
}

function viewportSize(isPortrait = false) {
  const viewport = isPortrait ? window.visualViewport : null;
  if (viewport && viewport.scale === 1) {
    return { width: viewport.width, height: viewport.height, left: viewport.offsetLeft, top: viewport.offsetTop };
  }
  return { width: window.innerWidth, height: window.innerHeight, left: 0, top: 0 };
}

function intrinsicHeight(content: HTMLElement) {
  let height = content.offsetHeight;
  content.querySelectorAll<HTMLElement>(".motion-accordion").forEach(accordion => {
    const inner = accordion.firstElementChild as HTMLElement | null;
    if (!inner) return;
    height += (accordion.classList.contains("is-open") ? inner.scrollHeight : 0) - accordion.offsetHeight;
  });
  return height;
}

export function useManagePanelLayout({
  visible,
  ready,
  isPortrait,
  isLocal,
  tab,
  instanceId,
  surfaceRef,
  paneRef,
}: ManagePanelLayoutOptions) {
  const windowRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(() => viewportSize(isPortrait));
  const [contentHeight, setContentHeight] = useState(460);
  const [manualBox, setManualBox] = useState<{ width: number; height: number } | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const resizeCleanupRef = useRef<(() => void) | null>(null);
  const pendingBoxRef = useRef<{ width: number; height: number } | null>(null);
  const latestBoxRef = useRef<{ width: number; height: number } | null>(null);
  const resizeFrameRef = useRef<number | null>(null);

  const applyResizeBox = useCallback((box: { width: number; height: number }) => {
    const windowElement = windowRef.current;
    if (!windowElement) return;
    windowElement.style.width = `${box.width}px`;
    windowElement.style.height = `${box.height}px`;
  }, []);

  const flushResize = useCallback(() => {
    resizeFrameRef.current = null;
    const next = pendingBoxRef.current;
    pendingBoxRef.current = null;
    if (!next) return;
    applyResizeBox(next);
  }, [applyResizeBox]);

  const cancelResizeFrame = useCallback(() => {
    if (resizeFrameRef.current !== null) {
      cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = null;
    }
    pendingBoxRef.current = null;
    latestBoxRef.current = null;
  }, []);

  useLayoutEffect(() => {
    if (!visible) return;
    let frame: number | null = null;
    const sync = () => setViewport(current => {
      const next = viewportSize(isPortrait);
      return current.width === next.width && current.height === next.height
        && current.left === next.left && current.top === next.top ? current : next;
    });
    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        sync();
      });
    };
    const visualViewport = isPortrait ? window.visualViewport : null;
    sync();
    window.addEventListener("resize", schedule);
    visualViewport?.addEventListener("resize", schedule);
    visualViewport?.addEventListener("scroll", schedule);
    return () => {
      window.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("resize", schedule);
      visualViewport?.removeEventListener("scroll", schedule);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [visible, isPortrait]);

  useEffect(() => {
    if (visible) return;
    resizeCleanupRef.current?.();
    setIsResizing(false);
    cancelResizeFrame();
    setManualBox(null);
  }, [cancelResizeFrame, visible]);

  useEffect(() => () => {
    resizeCleanupRef.current?.();
    cancelResizeFrame();
  }, [cancelResizeFrame]);

  useLayoutEffect(() => {
    if (!visible || !ready || (manualBox && !isPortrait)) return;
    const surface = surfaceRef.current;
    const pane = paneRef.current;
    const header = surface?.querySelector<HTMLElement>(".manage-header");
    const body = surface?.querySelector<HTMLElement>(".manage-body");
    const face = pane?.querySelector<HTMLElement>(".motion-panel-face.is-active");
    if (!surface || !pane || !header || !body || !face) return;
    const content = face.querySelector<HTMLElement>(".manage-content");
    const scroller = content?.parentElement;
    const actions = face.querySelector<HTMLElement>(".manage-actions");
    const sidebar = body.querySelector<HTMLElement>("aside");
    const tabs = body.querySelector<HTMLElement>(":scope > .manage-choice-track");
    const measure = () => {
      const scale = isPortrait ? 1 : MANAGE_VISUAL_SCALE;
      const surfaceStyle = getComputedStyle(surface);
      const scrollStyle = scroller ? getComputedStyle(scroller) : null;
      const contentPadding = scrollStyle
        ? parseFloat(scrollStyle.paddingTop) + parseFloat(scrollStyle.paddingBottom)
        : 0;
      const readingHeight = tab === "terminal"
        ? isLocal ? (isPortrait ? 280 : 560) : (isPortrait ? 128 : 240)
        : (content ? intrinsicHeight(content) : 0) + contentPadding + (actions?.offsetHeight ?? 0);
      const paneHeight = Math.max(isPortrait ? 152 : 320, readingHeight);
      const bodyExtra = isPortrait
        ? (sidebar?.offsetHeight ?? 0) + (tabs?.offsetHeight ?? 0) + parseFloat(getComputedStyle(body).rowGap) * 2
        : 0;
      const chrome = parseFloat(surfaceStyle.paddingTop) + parseFloat(surfaceStyle.paddingBottom)
        + header.offsetHeight + parseFloat(getComputedStyle(header).marginBottom) + bodyExtra;
      const next = Math.ceil((chrome + paneHeight) * scale);
      setContentHeight(current => current === next ? current : next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    [header, isPortrait ? sidebar : null, tabs, content, actions].forEach(node => {
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, [visible, ready, isPortrait, isLocal, tab, instanceId, Boolean(manualBox), surfaceRef, paneRef]);

  const maxWidth = Math.max(1, viewport.width - (isPortrait ? 32 : VIEW_GUTTER * 2));
  const maxHeight = Math.max(1, isPortrait
    ? Math.min(720, viewport.height * 0.85, viewport.height - VIEW_GUTTER * 2)
    : viewport.height - VIEW_GUTTER * 2);
  const width = Math.min(maxWidth, isPortrait ? 460 : manualBox?.width ?? DEFAULT_WIDTH);
  const height = Math.min(maxHeight, !isPortrait && manualBox ? manualBox.height : contentHeight);

  const onResizePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const bounds = windowRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanupRef.current?.();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = bounds.width;
    const startHeight = bounds.height;
    const initialBox = { width: startWidth, height: startHeight };
    pendingBoxRef.current = null;
    latestBoxRef.current = initialBox;
    setManualBox(initialBox);
    setIsResizing(true);
    const onMove = (moveEvent: PointerEvent) => {
      const available = viewportSize();
      const nextBox = {
        width: Math.round(Math.min(available.width - VIEW_GUTTER * 2, Math.max(MIN_WIDTH, startWidth + moveEvent.clientX - startX))),
        height: Math.round(Math.min(available.height - VIEW_GUTTER * 2, Math.max(300, startHeight + moveEvent.clientY - startY))),
      };
      latestBoxRef.current = nextBox;
      pendingBoxRef.current = nextBox;
      if (resizeFrameRef.current === null) {
        resizeFrameRef.current = requestAnimationFrame(flushResize);
      }
    };
    const removeListeners = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    const onUp = () => {
      if (resizeFrameRef.current !== null) {
        cancelAnimationFrame(resizeFrameRef.current);
        resizeFrameRef.current = null;
      }
      pendingBoxRef.current = null;
      const finalBox = latestBoxRef.current;
      latestBoxRef.current = null;
      if (finalBox) {
        applyResizeBox(finalBox);
        setManualBox(finalBox);
      }
      setIsResizing(false);
      removeListeners();
      resizeCleanupRef.current = null;
    };
    resizeCleanupRef.current = () => {
      removeListeners();
      cancelResizeFrame();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return { windowRef, width, height, viewport, isResizing, onResizePointerDown };
}
