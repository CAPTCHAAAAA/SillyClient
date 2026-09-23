import React from "react";
import { Play, LoaderCircle, Minimize2, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";

export interface LaunchConsoleModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  isLight: boolean;
  glassBg: string;
  operationPurpose: "launch" | "create" | "restart";
  launchError: string | null;
  launchProgress: { pct: number; text: string } | null;
  lastLaunchParams: any;
  launchLogs: { msg: string; level?: string }[];
  launchingId: string | null;
  onRetry: () => void;
  onClose: () => void;
  onMinimize?: () => void;
  onEnterTavern?: (params: any) => Promise<void>;
}

/**
 * 启动控制台模态窗口 (LaunchConsoleModal)
 * 1. 严格绝对居中 (top: 50%, left: 50%, transform: translate(-50%, -50%))；
 * 2. 扁平轻拟物风格，0 绿字，低调银白高光质感；
 * 3. 支持操作内联化：提供最小化至底部后台活动胶囊（ActivityCapsule）能力。
 */
export const LaunchConsoleModal: React.FC<LaunchConsoleModalProps> = ({
  isOpen,
  isClosing = false,
  isLight,
  glassBg,
  operationPurpose,
  launchError,
  launchProgress,
  lastLaunchParams,
  launchLogs,
  launchingId,
  onRetry,
  onClose,
  onMinimize,
  onEnterTavern,
}) => {
  if (!isOpen && !isClosing) return null;

  return (
    <div
      className={cn(
        "ios-task-surface fixed rounded-3xl overflow-hidden backdrop-blur-[40px] saturate-180",
        "shadow-[0_24px_80px_rgba(0,0,0,0.4),0_0_0_0.5px_rgba(255,255,255,0.06),inset_0_0.5px_0_rgba(255,255,255,0.08)]",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(360px, calc(100vw - 2rem))",
      }}
    >
      {/* 标题栏与内联最小化操作 */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <h3
            className={cn(
              "text-[17px] font-bold tracking-tight",
              isLight ? "text-[#1a1625]" : "text-white"
            )}
          >
            {launchError
              ? operationPurpose === "create"
                ? "创建失败"
                : "启动失败"
              : operationPurpose === "create"
              ? launchProgress?.pct === 100
                ? "实例创建完成"
                : "正在创建实例"
              : "启动中"}
          </h3>

          <div className="flex items-center gap-2">
            {launchProgress && !launchError && (
              <span
                className={cn(
                  "text-[14px] font-medium tabular-nums tracking-tight",
                  isLight ? "text-[#8b3a52]" : "text-[#c4788e]"
                )}
              >
                {launchProgress.pct}%
              </span>
            )}

            {/* 操作内联化：最小化按钮 */}
            {onMinimize && !launchError && launchProgress?.pct !== 100 && (
              <button
                type="button"
                onClick={onMinimize}
                title="缩小至后台活动胶囊"
                aria-label="缩小至后台活动胶囊"
                className={cn(
                  "motion-control p-1 rounded-lg transition-colors",
                  isLight
                    ? "hover:bg-black/5 text-[#1a1625]/40 hover:text-[#1a1625]/70"
                    : "hover:bg-white/5 text-white/40 hover:text-white/70"
                )}
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              title="关闭"
              aria-label="关闭启动面板"
              className={cn(
                "motion-control p-1 rounded-lg transition-colors",
                isLight
                  ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
                  : "hover:bg-white/5 text-white/30 hover:text-white/60"
              )}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <p
          className={cn(
            "text-[12px] mt-1",
            isLight ? "text-[#1a1625]/40" : "text-white/40"
          )}
        >
          {lastLaunchParams?.name || "实例"}
        </p>
      </div>

      {/* 进度条 */}
      <div className="px-6 pb-4">
        <div
          className={cn(
            "h-[3px] rounded-full overflow-hidden relative",
            isLight ? "bg-black/[0.06]" : "bg-white/[0.08]"
          )}
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width,background-color] duration-500 ease-out relative overflow-hidden",
              launchError
                ? "bg-red-500/80"
                : isLight
                ? "bg-[#8b3a52]"
                : "bg-gradient-to-r from-[#7a3245] via-[#a04860] to-[#8b3a52]"
            )}
            style={{
              width: `${launchError ? 100 : launchProgress?.pct || 0}%`,
            }}
          >
            {!launchError &&
              launchProgress &&
              launchProgress.pct > 0 &&
              launchProgress.pct < 100 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
              )}
          </div>
        </div>
        <p
          className={cn(
            "text-[12px] mt-2 font-medium truncate",
            isLight ? "text-[#1a1625]/50" : "text-white/50"
          )}
        >
          {launchError ? launchError : launchProgress?.text || "初始化"}
        </p>
      </div>

      {/* 日志区域 — 色差内凹效果 */}
      <div className="mx-6 mb-5">
        <div
          className={cn(
            "rounded-2xl overflow-hidden max-h-[200px] overflow-y-auto",
            "border shadow-[inset_0_2px_6px_rgba(0,0,0,0.3),inset_0_0.5px_0_rgba(0,0,0,0.2)]",
            isLight
              ? "bg-black/[0.04] border-black/[0.1]"
              : "bg-black/[0.32] border-white/[0.03]"
          )}
        >
          <div className="px-4 py-3 text-[11px] leading-[1.7] space-y-1">
            {launchLogs.map((log, i) => (
              <div
                key={i}
                className={cn(
                  "truncate",
                  log.level === "error"
                    ? "text-red-400/90"
                    : log.level === "success"
                    ? isLight
                      ? "text-[#1a1625]/65"
                      : "text-white/65"
                    : isLight
                    ? "text-[#1a1625]/50"
                    : "text-white/50"
                )}
              >
                {log.msg}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="px-6 pb-6 flex gap-2.5">
        {launchError ? (
          <>
            <button
              onClick={onRetry}
              disabled={!!launchingId}
              className={cn(
                "motion-control flex-1 h-9 rounded-full text-xs font-semibold disabled:opacity-50 transition-all border",
                isLight
                  ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625] hover:bg-black/[0.14] active:bg-black/[0.18]"
                  : "bg-white/15 border-white/10 text-white hover:bg-white/25 active:bg-white/30"
              )}
            >
              重试
            </button>
            <button
              onClick={onClose}
              className={cn(
                "motion-control flex-1 h-9 rounded-full text-xs font-medium transition-all border",
                isLight
                  ? "bg-black/[0.04] border-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.08]"
                  : "bg-white/[0.08] border-white/[0.06] text-white/60 hover:bg-white/[0.14]"
              )}
            >
              关闭
            </button>
          </>
        ) : operationPurpose === "create" ? (
          launchProgress?.pct === 100 ? (
            <div className="w-full flex items-center gap-2">
              <button
                onClick={async () => {
                  if (onEnterTavern && lastLaunchParams) {
                    await onEnterTavern(lastLaunchParams);
                  } else {
                    onClose();
                  }
                }}
                className={cn(
                  "motion-control flex-1 h-9 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition-all border",
                  isLight
                    ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625] hover:bg-black/[0.14] active:bg-black/[0.18]"
                    : "bg-white/20 border-white/15 text-white hover:bg-white/30 active:bg-white/35"
                )}
              >
                <Play className="w-3 h-3 fill-current" />
                <span>进入酒馆</span>
              </button>
              <button
                onClick={onClose}
                className={cn(
                  "motion-control px-4 h-9 rounded-full text-xs font-medium transition-all border",
                  isLight
                    ? "bg-black/[0.04] border-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.08]"
                    : "bg-white/[0.08] border-white/[0.06] text-white/60 hover:bg-white/[0.14]"
                )}
              >
                稍后
              </button>
            </div>
          ) : (
            <div
              className={cn(
                "w-full h-10 rounded-xl flex items-center justify-center gap-2 text-[12px] font-medium transition-all duration-300",
                isLight
                  ? "bg-black/[0.04] text-[#1a1625]/45"
                  : "bg-white/[0.06] text-white/45"
              )}
            >
              <LoaderCircle className="h-4 w-4 animate-spin text-current" />
              <span>完成前请保持应用打开</span>
            </div>
          )
        ) : (
          <button
            onClick={onMinimize || onClose}
            className={cn(
              "motion-control w-full h-10 rounded-xl text-[13px] font-semibold",
              isLight
                ? "bg-black/[0.05] text-[#1a1625]/40 hover:bg-black/[0.08]"
                : "bg-white/[0.08] text-white/40 hover:bg-white/[0.12]"
            )}
          >
            隐藏
          </button>
        )}
      </div>
    </div>
  );
};
