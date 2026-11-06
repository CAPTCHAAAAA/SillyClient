import React from "react";
import { Play } from "lucide-react";
import { cn } from "../../lib/utils";
import { ActionButton } from "../common/ActionButton";
import { TerminalWell } from "../common/TerminalWell";
import { LAYERS } from "../../constants/layers";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import "../common/console-card.css";
import "./LaunchConsoleModal.css";

export interface LaunchConsoleModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  isLight: boolean;
  glassBg: string;
  operationPurpose: "launch" | "create" | "restart";
  launchError: string | null;
  launchProgress: { pct: number; text: string } | null;
  lastLaunchParams: any;
  logKey: string | null;
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
 * 3. 支持操作内联化：提供可选的最小化回调，交由页面协调启动任务状态。
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
  logKey,
  launchingId,
  onRetry,
  onClose,
  onMinimize,
  onEnterTavern,
}) => {
  const launchLogs = useInstanceLogs(logKey, isOpen || isClosing);
  const visibleLaunchLogs = launchLogs.filter((log, index) => {
    if (launchError || !launchProgress?.text || index !== launchLogs.length - 1) return true;
    return log.msg.trim() !== launchProgress.text.trim();
  });
  const isDynamic = glassBg.includes("1c1420");
  const titleId = React.useId();
  const statusId = React.useId();
  if (!isOpen && !isClosing) return null;

  const progress = Math.min(100, Math.max(0, launchProgress?.pct || 0));
  const progressText = launchProgress?.text?.trim() || "初始化";
  const progressLabel =
    progressText.replace(/\s*(?:[·•]\s*)?\d{1,3}%\s*$/, "").trim() || "处理中";
  const instanceName = lastLaunchParams?.name || "实例";
  const title = launchError
    ? operationPurpose === "create" ? "创建失败" : "启动失败"
    : operationPurpose === "create"
      ? launchProgress?.pct === 100 ? "实例创建完成" : "正在创建实例"
      : "启动中";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-launch-console={operationPurpose}
      className={cn(
        "launch-console-card console-card ios-task-surface fixed flex flex-col rounded-[26px] px-3 pt-2 pb-3 overflow-hidden backdrop-blur-[40px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
      )}
      style={{
        zIndex: LAYERS.MODAL_SURFACE,
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      }}
    >
      <div className="launch-console-card__header relative z-10">
        <h3 id={titleId} className="launch-console-card__title">{title}</h3>
        <span className="launch-console-card__name" title={instanceName}>
          {instanceName}
        </span>
      </div>

      <TerminalWell
        isLight={isLight}
        isDynamic={isDynamic}
        compact
        className="launch-console-card__terminal relative z-10"
      >
        <div data-native-log-list className="launch-console-card__logs terminal-output scrollbar-hidden">
          {visibleLaunchLogs.map((log, index) => (
            <div
              key={index}
              className="terminal-log-line"
              data-level={log.level}
            >
              {log.msg}
            </div>
          ))}
        </div>
      </TerminalWell>

      <div className={cn("launch-console-card__actions relative z-10", launchError && "is-error")}>
        <div className="launch-console-card__progress">
          <div className="launch-console-card__status">
            <span id={statusId} role="status" className="launch-console-card__status-text">
              {launchError || progressLabel}
            </span>
            {!launchError && launchProgress && (
              <span className="launch-console-card__percent">{progress}%</span>
            )}
          </div>
          <div
            role="progressbar"
            aria-label={operationPurpose === "create" ? "实例创建进度" : "实例启动进度"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={launchError ? undefined : progress}
            aria-describedby={statusId}
            className="launch-console-card__track"
          >
            <div
              className="launch-console-card__fill"
              style={{ transform: `scaleX(${launchError ? 1 : progress / 100})` }}
            />
          </div>
        </div>
        <div className="launch-console-card__button-group">
          {launchError ? (
            <>
              <ActionButton
                onClick={onRetry}
                disabled={!!launchingId}
              >
                重试
              </ActionButton>
              <ActionButton
                onClick={onClose}
                tone="danger"
              >
                关闭
              </ActionButton>
            </>
          ) : operationPurpose === "create" ? (
            launchProgress?.pct === 100 ? (
              <>
                <ActionButton
                  onClick={async () => {
                    if (onEnterTavern && lastLaunchParams) {
                      await onEnterTavern(lastLaunchParams);
                    } else {
                      onClose();
                    }
                  }}
                >
                  <Play className="w-3 h-3 shrink-0 fill-current" />
                  <span>进入酒馆</span>
                </ActionButton>
                <ActionButton
                  onClick={onClose}
                >
                  稍后
                </ActionButton>
              </>
            ) : (
              <ActionButton
                onClick={onClose}
                title="取消创建"
                aria-label="取消创建"
                tone="danger"
              >
                <span>取消</span>
              </ActionButton>
            )
          ) : (
            <ActionButton
              onClick={onMinimize || onClose}
            >
              隐藏
            </ActionButton>
          )}
        </div>
      </div>
    </div>
  );
};
