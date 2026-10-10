import React from "react";
import { X, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";

export interface RenameModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  value: string;
  onChange: (v: string) => void;
  onSave: () => void;
  error?: string | null;
  saving?: boolean;
}

/**
 * 实例重命名阻断弹窗 (RenameModal)
 * 1. 采用阻断级 Z-Index (LAYERS.DIALOG_SURFACE 与 LAYERS.DIALOG_BACKDROP)；
 * 2. 具备物理弹性弹出与离场动画 (.animate-modal-dialog)；
 * 3. 异步重命名状态与磁盘错误提示；
 * 4. 彻底同步底层物理存储文件夹与注册表。
 */
export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  value,
  onChange,
  onSave,
  error = null,
  saving = false,
}) => {
  if (!isOpen && !isClosing) return null;

  return (
    <>
      <LayerBackdrop
        isOpen={isOpen}
        isClosing={isClosing}
        onClick={saving ? undefined : onClose}
        zIndex={LAYERS.DIALOG_BACKDROP}
        blur={true}
        className={cn(
          "transition-all duration-300",
          isLight ? "bg-black/25 backdrop-blur-[12px]" : "bg-black/55 backdrop-blur-[12px]"
        )}
      />
      <div
        className={cn(
          "ios-task-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-modal-dialog-exit" : "animate-modal-dialog"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(380px, calc(100vw - 2rem))",
        }}
      >
        <div
          className={cn(
            "flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <span
            className={cn(
              "text-sm font-semibold",
              isLight ? "text-[#1a1625]" : "text-white"
            )}
          >
            重命名实例
          </span>
          {!saving && (
            <button
              onClick={onClose}
              className={cn(
                "motion-control p-1.5 rounded-lg transition-colors",
                isLight
                  ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                  : "text-white/40 hover:text-white/85"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <label className={cn("text-xs font-medium block", isLight ? "text-[#1a1625]/70" : "text-white/70")}>
              实例新名称
            </label>
            <input
              type="text"
              value={value}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving && value.trim()) onSave();
              }}
              placeholder="输入新名称"
              autoFocus
              className={cn(
                "ios-field-control motion-control w-full h-9 px-3 rounded-xl border text-xs transition-colors",
                isLight
                  ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-black/20"
                  : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
              )}
            />
          </div>

          <p className={cn("text-[11px] opacity-45 leading-relaxed", isLight ? "text-[#1a1625]" : "text-white")}>
            保存后将同步修改底层数据目录名称并更新系统注册表与配置。
          </p>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={cn(
              "flex-1 h-8 rounded-full text-xs font-medium border transition-colors disabled:opacity-40",
              isLight
                ? "bg-transparent border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                : "bg-transparent border-white/[0.08] text-white/60 hover:text-white"
            )}
          >
            取消
          </button>
          <button
            type="button"
            disabled={saving || !value.trim()}
            onClick={onSave}
            className={cn(
              "flex-1 h-8 rounded-full text-xs font-medium border transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5",
              isLight
                ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625]"
                : "bg-white/20 border-white/15 text-white/70 hover:text-white"
            )}
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                正在重命名...
              </>
            ) : (
              "保存"
            )}
          </button>
        </div>
      </div>
    </>
  );
};
