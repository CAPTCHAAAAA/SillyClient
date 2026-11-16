import { useMemo } from "react";
import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { DiagnosticArea } from "../../capacitor-plugin";
import { reportGlobalError } from "../../lib/global-error-store";
import { cn } from "../../lib/utils";
import { createDiagnosticContext, type DiagnosticContext } from "../../lib/native-errors";

export interface ErrorReportAlertProps {
  error: string | null | undefined;
  diagnostic?: DiagnosticContext | null;
  area: DiagnosticArea;
  stage?: string;
  platform?: string;
  isLight: boolean;
  compact?: boolean;
  extraSecrets?: Array<string | null | undefined>;
  className?: string;
  trailingAction?: ReactNode;
}

/**
 * 轻量内联异常提示条：保持弹窗与表单紧凑无臃肿，并在右侧提供一键呼出全局反馈菜单的入口。
 */
export function ErrorReportAlert({
  error,
  diagnostic,
  area,
  stage,
  platform,
  isLight,
  compact = false,
  extraSecrets,
  className,
  trailingAction,
}: ErrorReportAlertProps) {
  const cleanError = error?.trim() || "";
  const fallbackKey = cleanError ? `${area}|${stage ?? ""}|${platform ?? ""}|${cleanError}` : "";

  const fallbackDiagnostic = useMemo(() => {
    if (diagnostic || !cleanError) return null;
    return createDiagnosticContext(cleanError, {
      area,
      stage,
      platform,
      userMessage: cleanError,
    });
    // Keyed by scalar fallbackKey so unstable array references never recreate context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diagnostic, fallbackKey]);

  const resolvedDiagnostic = diagnostic ?? fallbackDiagnostic;

  if (!cleanError) return null;

  return (
    <div
      role="alert"
      className={cn(
        "min-w-0 rounded-xl border-0",
        compact ? "px-3 py-2 text-[11px] leading-snug" : "px-3 py-2 text-[11px] leading-relaxed",
        isLight
          ? "bg-[#a12c4c]/[0.05] text-[#783047]/80"
          : "bg-white/[0.045] text-[#e8a2b5]/85",
        className
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <span className="min-w-0 flex-1 whitespace-pre-wrap break-words">{cleanError}</span>
        <div className="flex flex-shrink-0 items-center gap-1">
          {trailingAction}
          <button
            type="button"
            data-testid="error-report-trigger"
            onClick={() =>
              reportGlobalError(resolvedDiagnostic?.summary || cleanError, {
                area,
                stage,
                platform,
                userMessage: cleanError,
                diagnostic: resolvedDiagnostic,
                extraSecrets,
                force: true,
              })
            }
            className={cn(
              "flat-capsule motion-control rounded-full border-0 px-2 py-0.5 text-[10.5px] font-medium whitespace-nowrap transition-colors",
              isLight
                ? "text-[#783047]/75 hover:text-[#783047]"
                : "text-[#e8a2b5]/80 hover:text-[#f2c4d1]"
            )}
          >
            反馈
          </button>
        </div>
      </div>
    </div>
  );
}
