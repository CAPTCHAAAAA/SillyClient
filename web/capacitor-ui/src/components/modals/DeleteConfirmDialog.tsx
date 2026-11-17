import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { ActionButton } from "../common/ActionButton";
import { ErrorReportAlert } from "../common/ErrorReportAlert";
import type { DiagnosticContext } from "../../lib/native-errors";
import type { TavernInstance } from "../../types";

export interface DeleteConfirmDialogProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isDeleting: boolean;
  deleteError: string | null;
  deleteDiagnostic?: DiagnosticContext | null;
  onConfirm: () => Promise<void>;
}

/**
 * 实例删除确认阻断对话框 (DeleteConfirmDialog)
 * 采用最高安全级别 Z-Index (LAYERS.DIALOG_SURFACE)。
 */
export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isDeleting,
  deleteError,
  deleteDiagnostic,
  onConfirm,
}) => {
  if ((!isOpen && !isClosing) || !instance) return null;

  return (
    <>
      <LayerBackdrop
        isOpen={isOpen}
        isClosing={isClosing}
        onClick={() => {
          if (!isDeleting && !isClosing) onClose();
        }}
        zIndex={LAYERS.DIALOG_BACKDROP}
        blur={true}
      />
      <div
        inert={isClosing}
        className={cn(
          "ios-task-surface reading-flat-surface fixed overflow-hidden rounded-2xl backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(380px, calc(var(--ui-vw, 100vw) - 2rem))",
        }}
      >
        <div
          className="flex h-12 items-center justify-between px-5"
        >
          <span
            className={cn(
              "text-sm font-semibold",
              isLight ? "text-[#1a1625]" : "text-white"
            )}
          >
            删除实例
          </span>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onClose}
            className={cn(
              "rounded-lg p-1.5 transition-colors disabled:pointer-events-none disabled:opacity-30",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-5 py-5">
          <p
            className={cn(
              "text-[15px] font-medium",
              isLight ? "text-[#1a1625]/85" : "text-white/85"
            )}
          >
            确定删除“{instance.subtitle || instance.name}”？
          </p>
          <p
            className={cn(
              "mt-2 text-[12px] leading-relaxed",
              isLight ? "text-[#1a1625]/40" : "text-white/40"
            )}
          >
            {instance.type === "local"
              ? "实例目录、配置与封面会从设备中永久删除，且无法恢复。"
              : "只会移除这条远程连接，不会影响远程服务器上的数据。"}
          </p>
          {instance.type === "local" && (
            <p
              className={cn(
                "mt-3 text-[10px] font-medium",
                isLight ? "text-[#a12c4c]/70" : "text-[#e88ca5]/65"
              )}
            >
              此操作无法撤销
            </p>
          )}
          {isDeleting && (
            <div className="mt-4">
              <div
                className={cn(
                  "h-[3px] overflow-hidden rounded-full",
                  isLight ? "bg-black/[0.06]" : "bg-white/[0.08]"
                )}
                role="progressbar"
                aria-valuetext={instance.type === "local" ? "正在删除实例文件" : "正在移除连接"}
              >
                <div
                  className={cn(
                    "delete-progress-fill relative h-full overflow-hidden rounded-full",
                    isLight
                      ? "bg-[#8b3a52]"
                      : "bg-gradient-to-r from-[#7a3245] via-[#a04860] to-[#8b3a52]"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_ease-in-out_infinite]" />
                </div>
              </div>
              <p
                className={cn(
                  "mt-2 text-[12px] font-medium",
                  isLight ? "text-[#1a1625]/50" : "text-white/50"
                )}
              >
                {instance.type === "local" ? "正在删除实例文件" : "正在移除连接"}
              </p>
            </div>
          )}
          <ErrorReportAlert
            error={deleteError}
            diagnostic={deleteDiagnostic}
            area="manage"
            stage="delete-instance"
            isLight={isLight}
            extraSecrets={[instance.subtitle, instance.name, instance.installPath]}
            className="mt-4"
          />
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <ActionButton
            disabled={isDeleting}
            onClick={onClose}
            className={cn(
              "!h-8 px-4 text-xs font-medium",
              isLight
                ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                : "text-white/60 hover:text-white"
            )}
          >
            取消
          </ActionButton>
          <ActionButton
            tone="danger"
            disabled={isDeleting}
            onClick={onConfirm}
            className="!h-8 px-5 text-xs font-semibold"
          >
            {isDeleting ? "正在删除" : "删除"}
          </ActionButton>
        </div>
      </div>
    </>
  );
};
