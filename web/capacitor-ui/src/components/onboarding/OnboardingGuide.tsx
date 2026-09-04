import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import "./OnboardingGuide.css";

interface OnboardingGuideProps {
  isLight: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

interface GuideView {
  label: string;
  description: string;
  image: string;
  imageAlt: string;
  imageClass: string;
}

const STEP_EXIT_MS = 210;
const STEP_ENTER_MS = 380;
const CLOSE_MS = 270;
const REDUCED_STEP_EXIT_MS = 100;
const REDUCED_STEP_ENTER_MS = 110;
const REDUCED_CLOSE_MS = 100;

type TransitionPhase = "idle" | "leaving" | "entering";

interface GuideStep {
  title: string;
  views: GuideView[];
}

const guideSteps: GuideStep[] = [
  {
    title: "新建实例",
    views: [
      {
        label: "入口",
        description: "从首页的新建实例卡片开始，创建本地实例或添加远程连接。",
        image: "./onboarding/create-instance.webp",
        imageAlt: "首页中的新建实例卡片",
        imageClass: "is-card",
      },
      {
        label: "创建面板",
        description: "填写名称并选择本地或远程连接。本地版本可使用内置版，也可从版本一栏右侧导入 ZIP。",
        image: "./onboarding/create-open.webp",
        imageAlt: "展开后的新建实例面板",
        imageClass: "is-panel",
      },
      {
        label: "主题预设",
        description: "创建本地实例时可启用 SC Bordeaux，安装完成后会自动应用主题预设与配套壁纸。",
        image: "./onboarding/theme-preset-open.webp",
        imageAlt: "新建实例面板中的 SC Bordeaux 主题预设",
        imageClass: "is-panel",
      },
    ],
  },
  {
    title: "实例卡片",
    views: [
      {
        label: "展开后",
        description: "轻触实例卡片可查看创建时间、最近使用与快捷操作；再次轻触即可收回。",
        image: "./onboarding/instance-card-default-expanded.webp",
        imageAlt: "使用默认封面的展开实例卡片",
        imageClass: "is-card",
      },
    ],
  },
  {
    title: "控制台",
    views: [
      {
        label: "入口",
        description: "点击顶部控制岛左侧的控制台入口，展开或收起运行记录。",
        image: "./onboarding/console-button.webp",
        imageAlt: "顶部控制岛左侧的控制台入口",
        imageClass: "is-toolbar",
      },
      {
        label: "展开后",
        description: "下载、安装、启动与错误信息会保留在这里，便于确认实例当前所处的阶段。",
        image: "./onboarding/terminal-open.webp",
        imageAlt: "展开后的运行控制台",
        imageClass: "is-terminal",
      },
    ],
  },
  {
    title: "背景与主题",
    views: [
      {
        label: "入口",
        description: "点击顶部控制岛中间区域，切换动态、黑夜与白天模式，或设置本地壁纸和磨砂强度。",
        image: "./onboarding/background-button.webp",
        imageAlt: "顶部控制岛中间的背景与主题入口",
        imageClass: "is-toolbar",
      },
    ],
  },
  {
    title: "APP 设置",
    views: [
      {
        label: "入口",
        description: "点击顶部控制岛右侧的菜单，打开 APP 设置。",
        image: "./onboarding/settings-button.webp",
        imageAlt: "顶部控制岛右侧的 APP 设置入口",
        imageClass: "is-toolbar",
      },
      {
        label: "设置内容",
        description: "设置按通用、数据与维护分类。重新演示引导位于通用页，需要时可随时再次打开。",
        image: "./onboarding/settings-open.webp",
        imageAlt: "展开后的 APP 设置面板",
        imageClass: "is-panel",
      },
    ],
  },
];

export default function OnboardingGuide({
  isLight,
  onComplete,
  onSkip,
}: OnboardingGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [currentView, setCurrentView] = useState(0);
  const [transitionDirection, setTransitionDirection] = useState<"forward" | "backward">("forward");
  const [transitionPhase, setTransitionPhase] = useState<TransitionPhase>("idle");
  const [isEntryActive, setIsEntryActive] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelContentRef = useRef<HTMLDivElement>(null);
  const stepRootRef = useRef<HTMLDivElement>(null);
  const stepTimerRef = useRef<number | null>(null);
  const enterTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const entryFrameRef = useRef<number | null>(null);
  const restorePanelTransitionFrameRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);
  const isTransitioningRef = useRef(false);
  const isClosingRef = useRef(false);
  const hasMeasuredRef = useRef(false);
  const reduceMotionRef = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const step = guideSteps[currentStep];
  const view = step.views[currentView];

  const requestClose = useCallback((action: () => void) => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    isTransitioningRef.current = false;
    transitionTokenRef.current += 1;
    if (stepTimerRef.current !== null) window.clearTimeout(stepTimerRef.current);
    if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    if (entryFrameRef.current !== null) window.cancelAnimationFrame(entryFrameRef.current);
    setIsClosing(true);
    closeTimerRef.current = window.setTimeout(
      action,
      reduceMotionRef.current ? REDUCED_CLOSE_MS : CLOSE_MS,
    );
  }, []);

  const transitionTo = useCallback((nextStep: number, nextView: number) => {
    if (
      isTransitioningRef.current ||
      isClosingRef.current ||
      (nextStep === currentStep && nextView === currentView)
    ) return;
    const currentOrder = currentStep * 10 + currentView;
    const nextOrder = nextStep * 10 + nextView;
    const token = transitionTokenRef.current + 1;
    transitionTokenRef.current = token;
    isTransitioningRef.current = true;
    setTransitionDirection(nextOrder >= currentOrder ? "forward" : "backward");
    setIsEntryActive(false);
    setTransitionPhase("leaving");
    if (stepTimerRef.current !== null) window.clearTimeout(stepTimerRef.current);
    stepTimerRef.current = window.setTimeout(() => {
      if (token !== transitionTokenRef.current || isClosingRef.current) return;
      setCurrentStep(nextStep);
      setCurrentView(nextView);
      setTransitionPhase("entering");
    }, reduceMotionRef.current ? REDUCED_STEP_EXIT_MS : STEP_EXIT_MS);
  }, [currentStep, currentView]);

  useLayoutEffect(() => {
    if (transitionPhase !== "entering") return;
    const stepRoot = stepRootRef.current;
    if (!stepRoot) return;
    const token = transitionTokenRef.current;

    void stepRoot.offsetWidth;
    entryFrameRef.current = window.requestAnimationFrame(() => {
      if (token !== transitionTokenRef.current || isClosingRef.current) return;
      setIsEntryActive(true);
    });
    enterTimerRef.current = window.setTimeout(() => {
      if (token !== transitionTokenRef.current || isClosingRef.current) return;
      setTransitionPhase("idle");
      setIsEntryActive(false);
      isTransitioningRef.current = false;
    }, reduceMotionRef.current ? REDUCED_STEP_ENTER_MS : STEP_ENTER_MS);

    return () => {
      if (entryFrameRef.current !== null) window.cancelAnimationFrame(entryFrameRef.current);
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
    };
  }, [currentStep, currentView, transitionPhase]);

  useEffect(() => {
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose(onSkip);
      if (event.key === "ArrowLeft") {
        transitionTo(Math.max(0, currentStep - 1), 0);
      }
      if (event.key === "ArrowRight") {
        transitionTo(Math.min(guideSteps.length - 1, currentStep + 1), 0);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentStep, onSkip, requestClose, transitionTo]);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current !== null) window.clearTimeout(stepTimerRef.current);
      if (enterTimerRef.current !== null) window.clearTimeout(enterTimerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      if (entryFrameRef.current !== null) window.cancelAnimationFrame(entryFrameRef.current);
      if (restorePanelTransitionFrameRef.current !== null) {
        window.cancelAnimationFrame(restorePanelTransitionFrameRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    const content = panelContentRef.current;
    if (!root || !panel || !content) return;

    const measure = () => {
      const rootStyle = window.getComputedStyle(root);
      const panelStyle = window.getComputedStyle(panel);
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const rootInsets =
        Number.parseFloat(rootStyle.paddingTop) +
        Number.parseFloat(rootStyle.paddingBottom);
      const panelChrome =
        Number.parseFloat(panelStyle.paddingTop) +
        Number.parseFloat(panelStyle.paddingBottom) +
        Number.parseFloat(panelStyle.borderTopWidth) +
        Number.parseFloat(panelStyle.borderBottomWidth);
      const contentHeight = Math.max(content.getBoundingClientRect().height, content.scrollHeight);
      const availableHeight = Math.max(0, viewportHeight - rootInsets);

      const targetHeight = Math.ceil(Math.min(contentHeight + panelChrome, availableHeight));
      if (!hasMeasuredRef.current) {
        hasMeasuredRef.current = true;
        panel.style.transition = "none";
        setPanelHeight(targetHeight);
        restorePanelTransitionFrameRef.current = window.requestAnimationFrame(() => {
          panel.style.removeProperty("transition");
        });
        return;
      }
      setPanelHeight(targetHeight);
    };

    const frame = window.requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(content);
    const images = Array.from(content.querySelectorAll("img"));
    images.forEach((image) => image.addEventListener("load", measure));
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);

    return () => {
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
      images.forEach((image) => image.removeEventListener("load", measure));
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, [currentStep, currentView]);

  const goNext = () => {
    if (currentStep === guideSteps.length - 1) {
      requestClose(onComplete);
      return;
    }
    transitionTo(currentStep + 1, 0);
  };

  const stepMotionClass = transitionPhase === "leaving"
    ? `is-review-leaving ${transitionDirection === "forward" ? "to-left" : "to-right"}`
    : transitionPhase === "entering"
      ? `is-review-entering ${transitionDirection === "forward" ? "from-right" : "from-left"} ${isEntryActive ? "is-review-active" : ""}`
      : "";

  return (
    <div
      ref={rootRef}
      className={`sc-onboarding ${isLight ? "is-light" : "is-dark"} ${isClosing ? "is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="SillyClient 使用引导"
    >
      <div className="sc-onboarding-backdrop" aria-hidden />
      <div
        ref={panelRef}
        className="sc-onboarding-panel"
        style={panelHeight === null ? undefined : { height: `${panelHeight}px` }}
      >
        <div ref={panelContentRef} className="sc-onboarding-panel-content">
          <header className="sc-onboarding-header">
            <div>
              <strong>SillyClient</strong>
              <span>使用引导</span>
            </div>
            <button type="button" onClick={() => requestClose(onSkip)}>跳过</button>
          </header>

          <div
            ref={stepRootRef}
            className={`sc-onboarding-step ${stepMotionClass}`}
            key={`${currentStep}-${currentView}`}
          >
            <figure className={`sc-onboarding-shot ${view.imageClass}`}>
              <img src={view.image} alt={view.imageAlt} />
            </figure>
            {step.views.length > 1 && (
              <div className="sc-onboarding-subnav" aria-label={`${step.title}详细页面`}>
                {step.views.map((item, index) => (
                  <button
                    type="button"
                    key={item.label}
                    className={index === currentView ? "is-current" : ""}
                    aria-current={index === currentView ? "page" : undefined}
                    onClick={() => transitionTo(currentStep, index)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
            <div className="sc-onboarding-copy">
              <span>{String(currentStep + 1).padStart(2, "0")}</span>
              <h2>{step.title}</h2>
              <p>{view.description}</p>
            </div>
          </div>

          <footer className="sc-onboarding-footer">
            <div className="sc-onboarding-dots" aria-label={`第 ${currentStep + 1} 步，共 ${guideSteps.length} 步`}>
              {guideSteps.map((item, index) => (
                <button
                  type="button"
                  key={item.title}
                  className={index === currentStep ? "is-current" : ""}
                  aria-label={`查看第 ${index + 1} 步：${item.title}`}
                  aria-current={index === currentStep ? "step" : undefined}
                  onClick={() => transitionTo(index, 0)}
                />
              ))}
            </div>
            <div className="sc-onboarding-actions">
              {currentStep > 0 && (
                <button type="button" className="is-back" onClick={() => transitionTo(currentStep - 1, 0)}>
                  上一步
                </button>
              )}
              <button type="button" className="is-next" onClick={goNext}>
                {currentStep === guideSteps.length - 1 ? "完成" : "下一步"}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
