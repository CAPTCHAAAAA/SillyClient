import { useEffect, useRef, useState } from "react";
import { ChevronDown, ExternalLink, Flag, Loader2, RotateCcw, Send } from "lucide-react";
import { type DiagnosticDeliveryMode } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { formatDiagnosticReportIdDisplay } from "../../lib/diagnostic-report";
import { openExternalUrl } from "../../lib/external-links";
import { toDiagnosticReportInput, type DiagnosticContext } from "../../lib/native-errors";
import {
  submitDiagnosticReport,
  submitDiagnosticReportViaDraft,
} from "../../lib/submit-diagnostic-report";
import { ActionButton } from "./ActionButton";

export interface DiagnosticReportPromptProps {
  diagnostic: DiagnosticContext | null | undefined;
  isLight: boolean;
  compact?: boolean;
  extraSecrets?: Array<string | null | undefined>;
  className?: string;
}

type ReportPhase = "idle" | "submitting" | "submitted" | "error";

export function DiagnosticReportPrompt({
  diagnostic,
  isLight,
  compact = false,
  extraSecrets,
  className,
}: DiagnosticReportPromptProps) {
  const [phase, setPhase] = useState<ReportPhase>("idle");
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [reportId, setReportId] = useState<string | null>(null);
  const [reportUrl, setReportUrl] = useState<string | null>(null);
  const [deliveryMode, setDeliveryMode] = useState<DiagnosticDeliveryMode | null>(null);
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const requestEpochRef = useRef(0);

  const resetKey = diagnostic ? `${diagnostic.fingerprint}:${diagnostic.timestamp}` : "";

  useEffect(() => {
    requestEpochRef.current += 1;
    setPhase("idle");
    setNoteOpen(false);
    setNote("");
    setReportId(null);
    setReportUrl(null);
    setDeliveryMode(null);
    setFailureReason(null);
  }, [resetKey]);

  if (!diagnostic) {
    return null;
  }

  const executeSubmission = async (
    submitter: typeof submitDiagnosticReport
  ) => {
    if (phase === "submitting" || phase === "submitted") return;
    const epoch = ++requestEpochRef.current;
    setPhase("submitting");
    setFailureReason(null);
    try {
      const payload = toDiagnosticReportInput(diagnostic, note, extraSecrets);
      const response = await submitter(payload);
      if (epoch !== requestEpochRef.current) return;
      if (response?.ok) {
        setReportId(
          formatDiagnosticReportIdDisplay(response.reportId, response.deliveryMode)
        );
        setReportUrl(response.reportUrl ?? null);
        setDeliveryMode(response.deliveryMode ?? null);
        setPhase("submitted");
      } else {
        setFailureReason(response?.message?.trim() || "提交未完成，请重试");
        setPhase("error");
      }
    } catch (error) {
      if (epoch !== requestEpochRef.current) return;
      const raw = (error instanceof Error ? error.message : String(error ?? "")).trim();
      setFailureReason(raw ? `提交失败：${raw}` : "提交失败，请重试");
      setPhase("error");
    }
  };

  const handleSubmit = () => void executeSubmission(submitDiagnosticReport);
  const handleDraftFallback = () => void executeSubmission(submitDiagnosticReportViaDraft);

  const dividerClass = "pt-2";
  const mutedTextClass = isLight ? "text-[#1a1625]/55" : "text-white/55";
  const actionBtnClass = cn(
    "!h-7 !min-w-0 px-2.5 text-[10.5px] font-medium select-none",
    isLight
      ? "text-[#1a1625]/70 hover:text-[#1a1625]"
      : "text-white/75 hover:text-white"
  );
  const ghostBtnClass = cn(
    "!h-7 !min-w-0 px-2 text-[10.5px] font-normal select-none",
    isLight
      ? "text-[#1a1625]/55 hover:text-[#1a1625]/85"
      : "text-white/60 hover:text-white/90"
  );

  return (
    <div
      className={cn(
        "mt-2 min-w-0",
        dividerClass,
        className
      )}
      data-testid="diagnostic-report-prompt"
      data-report-phase={phase}
    >
      {phase === "submitted" ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px]">
          <span
            className={cn(
              "font-medium tracking-tight",
              isLight ? "text-black/80" : "text-white/90"
            )}
          >
            {deliveryMode === "github-prefill"
              ? "已打开 GitHub 预填草稿"
              : `已提交（${reportId || "#SC-PENDING"}）`}
          </span>
          <div className="flex items-center gap-2">
            {reportUrl && (
              <ActionButton
                onClick={() => void openExternalUrl(reportUrl).catch(() => {})}
                className={ghostBtnClass}
                data-testid="diagnostic-report-view-issue"
              >
                <ExternalLink className="h-3 w-3" />
                <span>{deliveryMode === "github-prefill" ? "打开草稿" : "查看 Issue"}</span>
              </ActionButton>
            )}
            <span className={mutedTextClass}>
              {compact ? "已记录本次故障" : "仅含脱敏故障摘要，感谢反馈"}
            </span>
          </div>
        </div>
      ) : phase === "error" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("min-w-0 flex-1 text-[10.5px] leading-snug", mutedTextClass)}>
            {failureReason || "提交失败，请重试"}
          </span>
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <ActionButton
              onClick={handleDraftFallback}
              className={cn(ghostBtnClass, "flex-shrink-0 whitespace-nowrap")}
              data-testid="diagnostic-report-draft-fallback"
            >
              <ExternalLink className="h-3 w-3" />
              <span>打开草稿</span>
            </ActionButton>
            <ActionButton
              onClick={handleSubmit}
              className={cn(actionBtnClass, "flex-shrink-0 whitespace-nowrap")}
              data-testid="diagnostic-report-retry"
            >
              <RotateCcw className="h-3 w-3" />
              <span>{compact ? "重试上报" : "重试"}</span>
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className={cn("min-w-0 flex-1 text-[10.5px] leading-snug", mutedTextClass)}>
              {compact
                ? "仅传脱敏摘要"
                : "仅发送脱敏报错摘要，不含实例名、聊天记录或本机路径"}
            </span>
            <div className="flex flex-shrink-0 items-center gap-1">
              {phase === "idle" && (
                <ActionButton
                  onClick={() => setNoteOpen((prev) => !prev)}
                  className={ghostBtnClass}
                  aria-expanded={noteOpen}
                  data-testid="diagnostic-report-note-toggle"
                >
                  <span>{noteOpen ? "收起说明" : "补充说明"}</span>
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      noteOpen && "rotate-180"
                    )}
                  />
                </ActionButton>
              )}
              <ActionButton
                disabled={phase === "submitting"}
                onClick={handleSubmit}
                className={cn(
                  actionBtnClass,
                  phase === "submitting" && "cursor-wait opacity-70"
                )}
                data-testid="diagnostic-report-submit"
              >
                {phase === "submitting" ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>发送中...</span>
                  </>
                ) : noteOpen ? (
                  <>
                    <Send className="h-3 w-3" />
                    <span>提交反馈</span>
                  </>
                ) : (
                  <>
                    <Flag className="h-3 w-3" />
                    <span>上报问题</span>
                  </>
                )}
              </ActionButton>
            </div>
          </div>

          {noteOpen && phase === "idle" && (
            <div className="min-w-0 space-y-1">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                maxLength={200}
                placeholder="补充说明当时操作（选填，勿填写密码或密钥）"
                data-testid="diagnostic-report-note-input"
                className={cn(
                  "ios-field-control manage-flat w-full min-w-0 rounded-xl border-0 px-3 py-1.5 text-[11px] outline-none transition-colors",
                  isLight
                    ? "bg-black/[0.045] text-[#1a1625]/85 placeholder:text-[#1a1625]/35"
                    : "bg-white/[0.055] text-white/90 placeholder:text-white/35"
                )}
              />
              <div className="flex items-center justify-between text-[10px]">
                <span className={mutedTextClass}>提交前会自动过滤路径、地址与凭据</span>
                <span className={mutedTextClass}>{note.length}/200</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
