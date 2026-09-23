import React from "react";
import { X } from "lucide-react";
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
}

/**
 * 实例重命名备用弹窗 (RenameModal)
 * 采用统一 Z-Index (LAYERS.DIALOG_SURFACE)。
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
}) => {
  if (!isOpen && !isClosing) return null;

  return (
    <>
      <LayerBackdrop
        isClosing={isClosing}
        onClick={onClose}
        zIndex={LAYERS.DIALOG_BACKDROP}
        blur={true}
      />
      <div
        className={cn(
          "ios-task-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(360px, calc(100vw - 2rem))",
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
          <button
            onClick={onClose}
            className={cn(
              "motion-control p-1.5 rounded-lg transition-colors",
              isLight
                ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
                : "hover:bg-white/5 text-white/30 hover:text-white/60"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSave();
            }}
            placeholder="输入新名称"
            autoFocus
            className={cn(
              "w-full h-9 px-3 rounded-xl border text-sm focus:outline-none focus:ring-0 transition-colors",
              isLight
                ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25"
                : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25"
            )}
          />
        </div>

        <div
          className={cn(
            "flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <button
            onClick={onClose}
            className={cn(
              "flex-1 h-9 rounded-full text-xs font-medium border transition-colors",
              isLight
                ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]/60 hover:bg-black/[0.08]"
                : "bg-white/[0.04] border-white/[0.08] text-white/60 hover:bg-white/[0.08]"
            )}
          >
            取消
          </button>
          <button
            onClick={onSave}
            className={cn(
              "flex-1 h-9 rounded-full text-xs font-medium border transition-colors",
              isLight
                ? "bg-[#1a1625] text-white border-transparent hover:bg-[#1a1625]/90"
                : "bg-white text-[#1a1625] border-transparent hover:bg-white/90"
            )}
          >
            保存
          </button>
        </div>
      </div>
    </>
  );
};
