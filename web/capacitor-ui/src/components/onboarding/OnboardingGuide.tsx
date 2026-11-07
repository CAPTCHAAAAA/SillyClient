import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ActionButton } from "@/components/common/ActionButton";
import { getGuideChapters, getGuideImage, type GuidePlatform } from "./guide-content";
import "./OnboardingGuide.css";

interface OnboardingGuideProps {
  isLight: boolean;
  platform: GuidePlatform;
  onComplete: () => void;
  onSkip: () => void;
}

type TransitionPhase = "idle" | "leaving" | "entering";

function getFocusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0
    && getComputedStyle(element).visibility === "visible"
    && !element.closest("[inert]"));
}

export default function OnboardingGuide({ isLight, platform, onComplete, onSkip }: OnboardingGuideProps) {
  const chapters = useMemo(() => getGuideChapters(platform), [platform]);
  const lessons = useMemo(() => chapters.flatMap((chapter, chapterIndex) =>
    chapter.lessons.map((lesson, viewIndex) => ({ ...lesson, chapter, chapterIndex, viewIndex })),
  ), [chapters]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const [direction, setDirection] = useState<"forward" | "backward">("forward");
  const [entryActive, setEntryActive] = useState(false);
  const [pending, setPending] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const figureButtonRef = useRef<HTMLButtonElement>(null);
  const imageDialogRef = useRef<HTMLDivElement>(null);
  const closeActionRef = useRef<(() => void) | null>(null);
  const navigationRef = useRef(0);
  const targetIndexRef = useRef(0);
  const navigatingRef = useRef(false);
  const mountedRef = useRef(true);
  const restorePageFocusRef = useRef(false);
  const previousImageOpenRef = useRef(false);
  const lesson = lessons[currentIndex];
  const image = getGuideImage(lesson.image);

  const requestClose = useCallback((complete = false) => {
    if (closeActionRef.current) return;
    closeActionRef.current = complete ? onComplete : onSkip;
    navigationRef.current += 1;
    setClosing(true);
  }, [onComplete, onSkip]);

  const navigateTo = useCallback(async (index: number) => {
    if (closeActionRef.current || navigatingRef.current) return;
    const target = Math.max(0, Math.min(lessons.length - 1, index));
    if (target === currentIndex) return;
    navigatingRef.current = true;
    targetIndexRef.current = target;
    const token = ++navigationRef.current;
    setPending(true);
    const nextImage = new Image();
    nextImage.src = getGuideImage(lessons[target].image).src;
    await nextImage.decode().catch(() => undefined);
    if (!mountedRef.current || token !== navigationRef.current) return;
    restorePageFocusRef.current = stepRef.current?.contains(document.activeElement) ?? false;
    setPending(false);
    setDirection(target > currentIndex ? "forward" : "backward");
    setTransitionPhase("leaving");
  }, [currentIndex, lessons]);

  useLayoutEffect(() => {
    const step = stepRef.current;
    if (!step || transitionPhase === "idle" || closing) return;
    if (transitionPhase === "entering" && !entryActive) {
      void step.offsetWidth;
      const frame = requestAnimationFrame(() => setEntryActive(true));
      return () => cancelAnimationFrame(frame);
    }
    let cancelled = false;
    const token = navigationRef.current;
    void Promise.allSettled(step.getAnimations().map((animation) => animation.finished)).then(() => {
      if (cancelled || token !== navigationRef.current) return;
      if (transitionPhase === "leaving") {
        setCurrentIndex(targetIndexRef.current);
        setEntryActive(false);
        setTransitionPhase("entering");
      } else {
        navigatingRef.current = false;
        setTransitionPhase("idle");
        setEntryActive(false);
      }
    });
    return () => { cancelled = true; };
  }, [transitionPhase, entryActive, closing]);

  useLayoutEffect(() => {
    if (!closing) return;
    let cancelled = false;
    const animations = rootRef.current?.getAnimations({ subtree: true }) ?? [];
    void Promise.allSettled(animations.map((animation) => animation.finished)).then(() => {
      if (!cancelled) closeActionRef.current?.();
    });
    return () => { cancelled = true; };
  }, [closing]);

  useEffect(() => {
    mountedRef.current = true;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const isolated: { element: HTMLElement; inert: boolean }[] = [];
    let ancestor: HTMLElement | null = rootRef.current;
    while (ancestor?.parentElement) {
      for (const sibling of Array.from(ancestor.parentElement.children)) {
        if (sibling instanceof HTMLElement && sibling !== ancestor && !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) {
          isolated.push({ element: sibling, inert: sibling.inert });
          sibling.inert = true;
        }
      }
      if (ancestor.parentElement === document.body) break;
      ancestor = ancestor.parentElement;
    }
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    rootRef.current?.focus({ preventScroll: true });
    return () => {
      mountedRef.current = false;
      navigationRef.current += 1;
      isolated.forEach(({ element, inert }) => { element.inert = inert; });
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
      const restoreFocus = previousFocus?.isConnected && previousFocus !== document.body
        ? previousFocus
        : document.querySelector<HTMLElement>("header button");
      if (restoreFocus && !restoreFocus.closest("[inert]")) restoreFocus.focus({ preventScroll: true });
    };
  }, []);

  useLayoutEffect(() => {
    readerRef.current?.scrollTo({ top: 0 });
  }, [currentIndex]);

  useEffect(() => {
    for (const index of [currentIndex - 1, currentIndex + 1]) {
      if (!lessons[index]) continue;
      const neighbor = new Image();
      neighbor.src = getGuideImage(lessons[index].image).src;
    }
  }, [currentIndex, lessons]);

  useLayoutEffect(() => {
    if (transitionPhase !== "idle" || !restorePageFocusRef.current || closing) return;
    restorePageFocusRef.current = false;
    stepRef.current?.querySelector<HTMLElement>('[aria-current="page"]')?.focus({ preventScroll: true });
  }, [transitionPhase, closing]);

  useLayoutEffect(() => {
    if (previousImageOpenRef.current && !imageOpen) figureButtonRef.current?.focus({ preventScroll: true });
    previousImageOpenRef.current = imageOpen;
  }, [imageOpen]);

  useEffect(() => {
    if (!imageOpen) return;
    getFocusableElements(imageDialogRef.current!)[0]?.focus({ preventScroll: true });
  }, [imageOpen]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      if (imageOpen) setImageOpen(false);
      else requestClose();
      return;
    }
    if (event.key === "Tab") {
      const focusRoot = imageDialogRef.current ?? panelRef.current;
      if (!focusRoot) return;
      const focusable = getFocusableElements(focusRoot);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && (!focusable.includes(document.activeElement as HTMLElement) || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!focusable.includes(document.activeElement as HTMLElement) || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
      return;
    }
    if (!imageOpen && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      event.preventDefault();
      event.stopPropagation();
      void navigateTo(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
  };

  const stepMotionClass = transitionPhase === "leaving"
    ? `is-review-leaving ${direction === "forward" ? "to-left" : "to-right"}`
    : transitionPhase === "entering"
      ? `is-review-entering ${direction === "forward" ? "from-right" : "from-left"}${entryActive ? " is-review-active" : ""}`
      : "";

  return (
    <div
      ref={rootRef}
      className={`sc-onboarding ${isLight ? "is-light" : "is-dark"}${closing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="使用引导"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      <div className="sc-onboarding-backdrop" aria-hidden="true" />
      <div ref={panelRef} className="sc-onboarding-panel" inert={imageOpen || closing} aria-hidden={imageOpen || undefined}>
        <div ref={readerRef} className="sc-onboarding-reader" aria-busy={pending || transitionPhase !== "idle"}>
          <div ref={stepRef} className={`sc-onboarding-step ${stepMotionClass}`} inert={transitionPhase !== "idle"}>
            <div className="sc-onboarding-copy">
              <div
                className="sc-onboarding-chapter"
                aria-label={`第 ${lesson.chapterIndex + 1} 章：${lesson.chapter.title}，本章第 ${lesson.viewIndex + 1} 页，共 ${lesson.chapter.lessons.length} 页`}
              >
                <span className="sc-onboarding-chapter-number" aria-hidden="true">
                  {String(lesson.chapterIndex + 1).padStart(2, "0")}
                </span>
                <span className="sc-onboarding-chapter-name">{lesson.chapter.title}</span>
                <span className="sc-onboarding-chapter-page" aria-hidden="true">
                  {String(lesson.viewIndex + 1).padStart(2, "0")} / {String(lesson.chapter.lessons.length).padStart(2, "0")}
                </span>
              </div>
              <h2 id="sc-onboarding-lesson-title">{lesson.title}</h2>
              <p>{lesson.summary}</p>
            </div>
            <figure className={`sc-onboarding-shot is-${lesson.image}`}>
              <button ref={figureButtonRef} type="button" onClick={() => setImageOpen(true)} aria-label={`放大界面图：${image.alt}`}>
                <img
                  src={image.src}
                  width={image.width}
                  height={image.height}
                  alt={image.alt}
                  onError={() => setFailedImage(image.src)}
                  onLoad={() => setFailedImage((failed) => failed === image.src ? null : failed)}
                />
              </button>
              {failedImage === image.src && <figcaption>图片暂不可用，仍可阅读说明</figcaption>}
            </figure>
          </div>
        </div>

        <footer className="sc-onboarding-footer">
          <button type="button" className="sc-onboarding-skip" onClick={() => requestClose()} aria-label="跳过使用引导">
            跳过
          </button>
          <div className="sc-onboarding-progress">
            <span className="sc-onboarding-progress-count" aria-hidden="true">
              {String(currentIndex + 1).padStart(2, "0")}<span> / {String(lessons.length).padStart(2, "0")}</span>
            </span>
            <div
              className="sc-onboarding-progress-track"
              role="progressbar"
              aria-label="教程阅读进度"
              aria-valuemin={0}
              aria-valuemax={lessons.length}
              aria-valuenow={currentIndex + 1}
            >
              <span style={{ width: `${((currentIndex + 1) / lessons.length) * 100}%` }} />
            </div>
          </div>
          <span className="sr-only" role="status" aria-live="polite">第 {lesson.chapterIndex + 1} 章，{lesson.chapter.title}，本章第 {lesson.viewIndex + 1} 页，共 {lesson.chapter.lessons.length} 页；教程总进度 {currentIndex + 1} / {lessons.length}</span>
          <div className="sc-onboarding-actions">
            {currentIndex > 0 && <ActionButton className="is-back" onClick={() => { void navigateTo(currentIndex - 1); }}>上一步</ActionButton>}
            <ActionButton className="is-next" onClick={() => {
              if (navigatingRef.current) return;
              if (currentIndex === lessons.length - 1) requestClose(true);
              else void navigateTo(currentIndex + 1);
            }}>{currentIndex === lessons.length - 1 ? "完成" : "下一步"}</ActionButton>
          </div>
        </footer>
      </div>
      {imageOpen && (
        <div ref={imageDialogRef} className="sc-onboarding-lightbox" role="dialog" aria-modal="true" aria-label="放大的教程界面图">
          <div className="sc-onboarding-lightbox-bar">
            <span>{lesson.title}</span>
            <ActionButton onClick={() => setImageOpen(false)} aria-label="关闭放大图片">返回</ActionButton>
          </div>
          <div className="sc-onboarding-lightbox-scroll">
            <img src={image.src} width={image.width} height={image.height} alt={image.alt} />
          </div>
          <p>可滚动查看原图 · Esc 返回引导</p>
        </div>
      )}
    </div>
  );
}
