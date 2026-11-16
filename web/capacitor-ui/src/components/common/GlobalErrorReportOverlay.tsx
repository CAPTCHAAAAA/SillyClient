import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { ExternalLink, LoaderCircle, RotateCcw, Send, X } from "lucide-react";
import { type DiagnosticDeliveryMode } from "../../capacitor-plugin";
import { LAYERS } from "../../constants/layers";
import { formatDiagnosticReportIdDisplay } from "../../lib/diagnostic-report";
import { openExternalUrl } from "../../lib/external-links";
import {
  dismissGlobalError,
  getDiagnosticAreaLabel,
  useGlobalError,
  type GlobalErrorEntry,
} from "../../lib/global-error-store";
import { toDiagnosticReportInput } from "../../lib/native-errors";
import {
  submitDiagnosticReport,
  submitDiagnosticReportViaDraft,
} from "../../lib/submit-diagnostic-report";
import { cn } from "../../lib/utils";
import { ActionButton } from "./ActionButton";
import { LayerBackdrop } from "./LayerBackdrop";
import { TerminalWell } from "./TerminalWell";

const OVERLAY_EXIT_MS = 300;

type FrequencyTag = "first" | "intermittent" | "always";

const FREQUENCY_OPTIONS: ReadonlyArray<{ id: FrequencyTag; label: string }> = [
  { id: "first", label: "首次遇到" },
  { id: "intermittent", label: "偶尔出现" },
  { id: "always", label: "每次必现" },
];

function formatPlatformDisplay(platform: string): string {
  const normalized = platform.trim().toLowerCase();
  if (normalized === "ios") return "iOS";
  if (normalized === "android") return "Android";
  if (normalized === "windows" || normalized === "win32") return "Windows";
  if (normalized === "macos" || normalized === "darwin") return "macOS";
  if (normalized === "linux") return "Linux";
  if (normalized === "web") return "Web";
  return platform.trim() || "Desktop";
}

function formatVersionDisplay(version: string): string {
  const clean = version.trim();
  if (!clean) return "dev";
  if (/^v/i.test(clean) || !/^\d/.test(clean)) return clean;
  return `v${clean}`;
}

export interface GlobalErrorReportOverlayProps {
  isLight: boolean;
  glassBg: string;
  registerLayer?: (id: string, onClose: () => void) => () => void;
}

type SubmitPhase = "idle" | "submitting" | "submitted" | "error";

/**
 * 全局置顶虚化异常反馈菜单：
 * 任意模块发生预料之内或预料之外的报错时，柔焦虚化当前页面并直接引用 TerminalWell 终端风脱敏报错供一键提交反馈。
 */
export function GlobalErrorReportOverlay({
  isLight,
  glassBg,
  registerLayer,
}: GlobalErrorReportOverlayProps) {
  const activeError = useGlobalError();
  const [renderedEntry, setRenderedEntry] = useState<GlobalErrorEntry | null>(activeError);
  const [isClosing, setIsClosing] = useState(false);
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [frequency, setFrequency] = useState<FrequencyTag | null>(null);
  const [note, setNote] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DiagnosticDeliveryMode | null>(null);
  const [deduplicated, setDeduplicated] = useState(false);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const [stackHeight, setStackHeight] = useState<number | null>(null);
  const [bodyFade, setBodyFade] = useState({ top: false, bottom: false });

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stackRafRef = useRef<number | null>(null);
  const prevSubmittedRef = useRef(false);
  const requestEpochRef = useRef(0);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const stackContainerRef = useRef<HTMLDivElement>(null);
  const formFaceRef = useRef<HTMLDivElement>(null);
  const submittedFaceRef = useRef<HTMLDivElement>(null);

  const triggerShake = useCallback(() => {
    setIsShaking(false);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    requestAnimationFrame(() => {
      setIsShaking(true);
      shakeTimerRef.current = setTimeout(() => {
        shakeTimerRef.current = null;
        setIsShaking(false);
      }, 380);
    });
  }, []);

  useEffect(() => {
    if (activeError) {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
        exitTimerRef.current = null;
      }
      if (shakeTimerRef.current) {
        clearTimeout(shakeTimerRef.current);
        shakeTimerRef.current = null;
      }
      if (stackTimerRef.current) {
        clearTimeout(stackTimerRef.current);
        stackTimerRef.current = null;
      }
      if (stackRafRef.current !== null) {
        cancelAnimationFrame(stackRafRef.current);
        stackRafRef.current = null;
      }
      prevSubmittedRef.current = false;
      setIsClosing(false);
      setIsShaking(false);
      setStackHeight(null);
      setBodyFade({ top: false, bottom: false });
      setRenderedEntry(activeError);
      requestEpochRef.current += 1;
      setPhase("idle");
      setFrequency(null);
      setNote("");
      setReportId(null);
      setReportUrl(null);
      setDeliveryMode(null);
      setDeduplicated(false);
      setFailureReason(null);
      return;
    }

    if (renderedEntry && !isClosing) {
      setIsClosing(true);
      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        setRenderedEntry(null);
        setIsClosing(false);
      }, OVERLAY_EXIT_MS);
    }
  }, [activeError, isClosing, renderedEntry]);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    if (stackTimerRef.current) clearTimeout(stackTimerRef.current);
    if (stackRafRef.current !== null) cancelAnimationFrame(stackRafRef.current);
  }, []);

  const handleDismiss = useCallback(() => {
    if (!renderedEntry || isClosing) return;
    requestEpochRef.current += 1;
    setIsClosing(true);
    const dismissingId = renderedEntry.id;
    dismissGlobalError(dismissingId);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setRenderedEntry(null);
      setIsClosing(false);
    }, OVERLAY_EXIT_MS);
  }, [isClosing, renderedEntry]);

  useEffect(() => {
    if (!renderedEntry || isClosing || !registerLayer) return;
    return registerLayer("global_error_prompt", () => {
      if (phase !== "submitting") {
        handleDismiss();
      }
    });
  }, [handleDismiss, isClosing, phase, registerLayer, renderedEntry]);

  const isSubmitted = phase === "submitted";

  useLayoutEffect(() => {
    if (!renderedEntry) return;
    const wasSubmitted = prevSubmittedRef.current;
    prevSubmittedRef.current = isSubmitted;
    if (wasSubmitted === isSubmitted) return;

    const targetEl = isSubmitted ? submittedFaceRef.current : formFaceRef.current;
    if (!targetEl) {
      setStackHeight(null);
      return;
    }

    if (stackTimerRef.current) clearTimeout(stackTimerRef.current);
    if (stackRafRef.current !== null) cancelAnimationFrame(stackRafRef.current);

    stackRafRef.current = requestAnimationFrame(() => {
      stackRafRef.current = null;
      const height = targetEl.offsetHeight;
      if (height > 0) {
        setStackHeight(Math.ceil(height));
        stackTimerRef.current = setTimeout(() => {
          stackTimerRef.current = null;
          setStackHeight(null);
        }, 820);
      } else {
        setStackHeight(null);
      }
    });
  }, [renderedEntry?.id, isSubmitted]);

  const syncBodyFade = useCallback(() => {
    const node = bodyScrollRef.current;
    if (!node) return;
    const top = node.scrollTop > 2;
    const bottom = node.scrollHeight - node.clientHeight - node.scrollTop > 2;
    setBodyFade((current) =>
      current.top === top && current.bottom === bottom
        ? current
        : { top, bottom }
    );
  }, []);

  useLayoutEffect(() => {
    if (!renderedEntry) return;
    syncBodyFade();
    const node = bodyScrollRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncBodyFade());
    observer.observe(node);
    Array.from(node.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [renderedEntry?.id, isSubmitted, stackHeight, phase, syncBodyFade]);

  const selectedFrequencyLabel = frequency
    ? FREQUENCY_OPTIONS.find((item) => item.id === frequency)?.label ?? null
    : null;

  const buildReportPayload = () => {
    if (!renderedEntry) return null;
    const trimmedNote = note.trim();
    const combinedNote = selectedFrequencyLabel
      ? trimmedNote
        ? `[${selectedFrequencyLabel}] ${trimmedNote}`
        : `[${selectedFrequencyLabel}]`
      : trimmedNote;
    return toDiagnosticReportInput(
      renderedEntry.diagnostic,
      combinedNote,
      renderedEntry.extraSecrets
    );
  };

  const executeSubmission = async (
    submitter: typeof submitDiagnosticReport
  ) => {
    const payload = buildReportPayload();
    if (!payload || phase === "submitting" || phase === "submitted") return;
    const epoch = ++requestEpochRef.current;
    setPhase("submitting");
    setFailureReason(null);
    try {
      const response = await submitter(payload);
      if (epoch !== requestEpochRef.current) return;
      if (response?.ok) {
        const displayId = formatDiagnosticReportIdDisplay(
          response.reportId,
          response.deliveryMode
        );
        if (stackContainerRef.current) {
          setStackHeight(stackContainerRef.current.offsetHeight);
        }
        setReportId(displayId);
        setReportUrl(response.reportUrl ?? null);
        setDeliveryMode(response.deliveryMode ?? null);
        setDeduplicated(Boolean(response.deduplicated));
        setPhase("submitted");
        if (bodyScrollRef.current) {
          bodyScrollRef.current.scrollTop = 0;
        }
      } else {
        setFailureReason(response?.message?.trim() || "提交失败，请重试");
        setPhase("error");
        triggerShake();
      }
    } catch (error) {
      if (epoch !== requestEpochRef.current) return;
      const raw = (error instanceof Error ? error.message : String(error ?? "")).trim();
      setFailureReason(raw ? `提交失败：${raw}` : "提交失败，请重试");
      setPhase("error");
      triggerShake();
    }
  };

  const handleSubmit = () => void executeSubmission(submitDiagnosticReport);
  const handleDraftFallback = () => void executeSubmission(submitDiagnosticReportViaDraft);

  if (!renderedEntry || typeof document === "undefined") return null;

  const { diagnostic } = renderedEntry;
  const areaLabel = getDiagnosticAreaLabel(diagnostic.area);
  const safeCode = diagnostic.errorCode?.trim();
  const platformLabel = formatPlatformDisplay(diagnostic.platform);
  const versionLabel = formatVersionDisplay(diagnostic.appVersion);
  const isDynamic = glassBg.includes("1c1420");

  const rawSummary = diagnostic.summary?.trim() || "";
  const rawUserMessage = diagnostic.userMessage?.trim() || "";
  const quotedErrorText = rawSummary || rawUserMessage || "Unknown runtime error";

  const labelClass = cn(
    "text-xs font-medium",
    isLight ? "text-[#1a1625]/70" : "text-white/70"
  );
  const inputClass = cn(
    "ios-field-control global-error-note-input h-9 w-full rounded-xl border-0 px-3 focus:outline-none focus:ring-0",
    isLight
      ? "bg-black/[0.04] text-[#1a1625] placeholder:text-[#1a1625]/25"
      : "bg-white/[0.04] text-white placeholder:text-white/25"
  );
  const hairlineClass = isLight ? "border-black/[0.06]" : "border-white/[0.06]";
  const bodyMask =
    bodyFade.top || bodyFade.bottom
      ? `linear-gradient(to bottom, ${
          bodyFade.top ? "transparent" : "#000"
        } 0, #000 36px, #000 calc(100% - 36px), ${
          bodyFade.bottom ? "transparent" : "#000"
        } 100%)`
      : undefined;

  return createPortal(
    <>
      <LayerBackdrop
        isOpen={true}
        isClosing={isClosing}
        onClick={() => {
          if (phase !== "submitting") handleDismiss();
        }}
        zIndex={LAYERS.GLOBAL_ALERT_BACKDROP}
        blur={false}
        style={{ "--overlay-blur": "16px" } as CSSProperties}
        className={cn(
          "saturate-125",
          isLight ? "bg-[#e8e3de]/62" : "bg-black/42"
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-error-dialog-title"
        data-testid="global-error-report-overlay"
        data-report-phase={phase}
        className={cn(
          "ios-task-surface reading-flat-surface fixed flex flex-col overflow-hidden rounded-2xl backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
        )}
        style={{
          zIndex: LAYERS.GLOBAL_ALERT_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(460px, calc(var(--ui-vw, 100vw) - 2rem))",
          maxHeight: "min(calc(var(--ui-vh, 100vh) * 0.85), calc(var(--ui-vh, 100vh) - 4rem))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏：统一 NewInstanceWizardModal h-12 border-b + LaunchConsole 标题/副标签格局 */}
        <div
          className={cn(
            "flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b px-5",
            hairlineClass
          )}
        >
          <h2
            id="global-error-dialog-title"
            className={cn(
              "truncate text-sm font-semibold",
              isLight ? "text-[#1a1625]" : "text-white"
            )}
          >
            {isSubmitted ? "反馈已收到" : "问题反馈"}
          </h2>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span
              data-testid="global-error-header-badge"
              className={cn(
                "truncate text-[11px]",
                isSubmitted && "font-mono",
                isLight ? "text-[#1a1625]/45" : "text-white/45"
              )}
            >
              {isSubmitted ? reportId || "#SC-PENDING" : areaLabel}
            </span>
            <button
              type="button"
              disabled={phase === "submitting"}
              onClick={handleDismiss}
              aria-label="关闭反馈窗口"
              className={cn(
                "terminal-tool motion-control flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:pointer-events-none disabled:opacity-30",
                isLight
                  ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                  : "text-white/40 hover:text-white/85"
              )}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 主内容区：同构上下 36px 滚动渐隐遮罩 + motion-panel-stack 平滑溶解高度切换 */}
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          style={{
            WebkitMaskImage: bodyMask,
            maskImage: bodyMask,
          }}
        >
          <div
            ref={bodyScrollRef}
            onScroll={syncBodyFade}
            className="scrollbar-hidden min-h-0 flex-1 overflow-y-auto p-5 text-left"
          >
            <div
              ref={stackContainerRef}
              className="motion-panel-stack"
              style={
                stackHeight !== null
                  ? { height: `${stackHeight}px` }
                  : { overflow: "visible" }
              }
            >
              {/* 表单视图 */}
              <div
                ref={formFaceRef}
                className={cn(
                  "motion-panel-face w-full space-y-5",
                  !isSubmitted
                    ? "is-active relative pointer-events-auto"
                    : "absolute inset-x-0 top-0 pointer-events-none select-none"
                )}
                aria-hidden={isSubmitted}
                inert={isSubmitted}
              >
                {/* 1. 终端风原始报错展示区 */}
                <div>
                  <div className="mb-2">
                    <span className={labelClass}>捕获报错</span>
                  </div>

                  <TerminalWell
                    isLight={isLight}
                    isDynamic={isDynamic}
                    compact
                    data-testid="global-error-quote"
                    className="p-3 select-text"
                  >
                    <div className="terminal-output max-h-[140px] overflow-y-auto overscroll-contain scrollbar-subtle [scrollbar-gutter:stable]">
                      <div className="terminal-log-line mb-0" data-level="error">
                        {quotedErrorText}
                      </div>
                    </div>
                    <div className="terminal-output terminal-caption mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] leading-snug">
                      <span>{platformLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{versionLabel}</span>
                      {safeCode && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{safeCode}</span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{diagnostic.fingerprint}</span>
                      {diagnostic.elapsedMs !== undefined && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{diagnostic.elapsedMs}ms</span>
                        </>
                      )}
                    </div>
                  </TerminalWell>
                </div>

                {/* 2. 出现频率（同构 .ios-choice-track + .motion-control） */}
                <div>
                  <div className="mb-2 flex items-baseline gap-1.5">
                    <span className={labelClass}>出现频率</span>
                    <span
                      className={cn(
                        "text-[10.5px]",
                        isLight ? "text-[#1a1625]/35" : "text-white/35"
                      )}
                    >
                      选填
                    </span>
                  </div>
                  <div
                    className="ios-choice-track"
                    role="group"
                    aria-label="出现频率"
                  >
                    {FREQUENCY_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        disabled={phase === "submitting" || isSubmitted}
                        aria-pressed={frequency === option.id}
                        onClick={() =>
                          setFrequency((prev) =>
                            prev === option.id ? null : option.id
                          )
                        }
                        className="ios-choice-control motion-control flex items-center justify-center py-2 text-xs font-medium transition-colors duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3. 补充说明（严格统一新建实例菜单 h-9 rounded-xl 输入框范式） */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <div className="flex items-baseline gap-1.5">
                      <label htmlFor="global-error-note-input" className={labelClass}>
                        补充说明
                      </label>
                      <span
                        className={cn(
                          "text-[10.5px]",
                          isLight ? "text-[#1a1625]/35" : "text-white/35"
                        )}
                      >
                        选填
                      </span>
                    </div>
                    <span
                      aria-hidden={note.length === 0}
                      className={cn(
                        "font-mono text-[10px] transition-opacity duration-200",
                        note.length > 0 ? "opacity-100" : "opacity-0",
                        isLight ? "text-[#1a1625]/35" : "text-white/35"
                      )}
                    >
                      {note.length}/200
                    </span>
                  </div>
                  <input
                    id="global-error-note-input"
                    data-testid="global-error-note-input"
                    type="text"
                    maxLength={200}
                    disabled={phase === "submitting" || isSubmitted}
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 200))}
                    placeholder="简述触发前的操作步骤或界面现象"
                    className={inputClass}
                  />

                  {/* 失败提示沿用连续 .motion-accordion 折叠动画 + .animate-modal-shake 微震反馈 */}
                  <div
                    className={cn(
                      "motion-accordion",
                      phase === "error" && "is-open"
                    )}
                    aria-hidden={phase !== "error"}
                  >
                    <div className="motion-accordion-inner">
                      <p
                        role="alert"
                        className={cn(
                          "pt-3 text-xs leading-relaxed",
                          isShaking && "animate-modal-shake",
                          isLight ? "text-[#a12c4c]/85" : "text-[#e8a2b5]/85"
                        )}
                      >
                        {failureReason || "提交失败，请重试"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 回执视图：复用同款 TerminalWell compact 凹陷回执井 */}
              <div
                ref={submittedFaceRef}
                className={cn(
                  "motion-panel-face w-full space-y-4",
                  isSubmitted
                    ? "is-active relative pointer-events-auto"
                    : "absolute inset-x-0 top-0 pointer-events-none select-none"
                )}
                aria-hidden={!isSubmitted}
                inert={!isSubmitted}
              >
                <p
                  className={cn(
                    "text-[13.5px] font-medium leading-relaxed",
                    isLight ? "text-[#1a1625]/88" : "text-white/90"
                  )}
                >
                  {deliveryMode === "github-prefill"
                    ? "已在浏览器打开预填好脱敏日志的 GitHub Issue 页面，确认内容后即可直接发布。"
                    : deliveryMode === "sentry"
                      ? "感谢你的反馈，本次异常摘要与环境记录已加密上传至云端诊断收件箱（Sentry），可关闭窗口继续使用。"
                      : deduplicated
                        ? "检测到同指纹活跃 Issue，本次记录已自动追加到对应问题单。"
                        : "感谢你的反馈，本次异常摘要与环境记录已提交，可点击下方按钮查看或关闭窗口继续使用。"}
                </p>

                <TerminalWell
                  isLight={isLight}
                  isDynamic={isDynamic}
                  compact
                  className="p-3.5"
                >
                  <div className="terminal-output space-y-2">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[var(--terminal-text-label)]">
                        问题编号
                      </span>
                      <span
                        data-testid="global-error-report-id"
                        className="font-mono font-medium text-[var(--terminal-text-strong)]"
                      >
                        {reportId || "#SC-PENDING"}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[var(--terminal-text-label)]">
                        所属模块
                      </span>
                      <span className="font-medium text-[var(--terminal-text-strong)]">
                        {areaLabel}
                      </span>
                    </div>
                    {selectedFrequencyLabel && (
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[var(--terminal-text-label)]">
                          出现频率
                        </span>
                        <span className="font-medium text-[var(--terminal-text-strong)]">
                          {selectedFrequencyLabel}
                        </span>
                      </div>
                    )}
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[var(--terminal-text-label)]">
                        运行环境
                      </span>
                      <span className="font-mono text-[var(--terminal-text-strong)]">
                        {platformLabel} · {versionLabel}
                      </span>
                    </div>
                    <div className="terminal-caption truncate pt-1 font-mono text-[10px]">
                      {quotedErrorText}
                    </div>
                  </div>
                </TerminalWell>
              </div>
            </div>
          </div>
        </div>

        {/* 底部操作栏：同构 border-t px-5 py-3 + ActionButton h-8 胶囊 */}
        <div
          className={cn(
            "flex flex-shrink-0 items-center justify-between gap-3 border-t px-5 py-3",
            hairlineClass
          )}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-[10.5px] leading-snug",
              phase === "error" && "hidden sm:inline",
              isLight ? "text-[#1a1625]/35" : "text-white/35"
            )}
          >
            {isSubmitted
              ? "已安全归档脱敏记录"
              : "提交前自动剔除路径与凭据"}
          </span>
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
            {isSubmitted ? (
              <>
                {reportUrl && (
                  <ActionButton
                    onClick={() => void openExternalUrl(reportUrl).catch(() => {})}
                    data-testid="global-error-view-issue"
                    className={cn(
                      "!h-8 flex-shrink-0 whitespace-nowrap px-4 text-xs font-medium",
                      isLight
                        ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                        : "text-white/75 hover:text-white"
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>
                      {deliveryMode === "github-prefill" ? "打开 GitHub 草稿" : "查看 Issue"}
                    </span>
                  </ActionButton>
                )}
                <ActionButton
                  onClick={handleDismiss}
                  data-testid="global-error-done"
                  className={cn(
                    "!h-8 flex-shrink-0 whitespace-nowrap px-5 text-xs font-semibold",
                    isLight
                      ? "text-[#1a1625]/75 hover:text-[#1a1625]"
                      : "text-white/80 hover:text-white"
                  )}
                >
                  完成
                </ActionButton>
              </>
            ) : (
              <>
                <ActionButton
                  disabled={phase === "submitting"}
                  onClick={handleDismiss}
                  data-testid="global-error-dismiss"
                  className={cn(
                    "!h-8 flex-shrink-0 whitespace-nowrap px-4 text-xs font-medium",
                    isLight
                      ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  暂不提交
                </ActionButton>
                {phase === "error" && (
                  <ActionButton
                    onClick={handleDraftFallback}
                    data-testid="global-error-draft-fallback"
                    className={cn(
                      "!h-8 flex-shrink-0 whitespace-nowrap px-3.5 text-xs font-medium",
                      isLight
                        ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                        : "text-white/75 hover:text-white"
                    )}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>打开草稿</span>
                  </ActionButton>
                )}
                <ActionButton
                  disabled={phase === "submitting"}
                  onClick={handleSubmit}
                  data-testid={
                    phase === "error" ? "global-error-retry" : "global-error-submit"
                  }
                  className={cn(
                    "!h-8 flex-shrink-0 whitespace-nowrap px-5 text-xs font-semibold",
                    isLight
                      ? "text-[#1a1625]/80 hover:text-[#1a1625]"
                      : "text-white/85 hover:text-white"
                  )}
                >
                  {phase === "submitting" ? (
                    <>
                      <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                      <span>发送中...</span>
                    </>
                  ) : phase === "error" ? (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>重试提交</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>提交反馈</span>
                    </>
                  )}
                </ActionButton>
              </>
            )}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
