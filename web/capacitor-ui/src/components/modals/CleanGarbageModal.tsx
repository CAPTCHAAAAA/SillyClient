import React from "react";
import { X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";

export interface CleanGarbageModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  cleaningGarbage: boolean;
  setCleaningGarbage: (v: boolean) => void;
  garbageItems: { path: string; description: string; type: string; sizeBytes: number }[];
  setGarbageItems: React.Dispatch<React.SetStateAction<{ path: string; description: string; type: string; sizeBytes: number }[]>>;
}

/**
 * 垃圾与临时缓存清理弹窗 (CleanGarbageModal)
 * 采用阻断级 Z-Index (LAYERS.DIALOG_SURFACE)。
 */
export const CleanGarbageModal: React.FC<CleanGarbageModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  cleaningGarbage,
  setCleaningGarbage,
  garbageItems,
  setGarbageItems,
}) => {
  if (!isOpen && !isClosing) return null;

  return (
    <>
      <LayerBackdrop
        isClosing={isClosing}
        onClick={() => {
          if (!cleaningGarbage) onClose();
        }}
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
          width: "min(420px, calc(100vw - 2rem))",
          maxHeight: "min(80vh, calc(100vh - 4rem))",
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
            清理垃圾
          </span>
          <button
            onClick={() => {
              if (!cleaningGarbage) onClose();
            }}
            className={cn(
              "p-1.5 rounded-lg transition-colors",
              isLight
                ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
                : "hover:bg-white/5 text-white/30 hover:text-white/60"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-subtle">
          {cleaningGarbage && garbageItems.length === 0 ? (
            <div
              className={cn(
                "text-center py-8 text-sm",
                isLight ? "text-[#1a1625]/40" : "text-white/40"
              )}
            >
              扫描中...
            </div>
          ) : garbageItems.length === 0 ? (
            <div
              className={cn(
                "text-center py-8 text-sm",
                isLight ? "text-[#1a1625]/40" : "text-white/40"
              )}
            >
              未发现垃圾文件
            </div>
          ) : (
            <div className="space-y-2">
              {garbageItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl border",
                    isLight
                      ? "bg-black/[0.03] border-black/[0.06]"
                      : "bg-white/[0.03] border-white/[0.06]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-xs font-medium",
                        isLight ? "text-[#1a1625]/80" : "text-white/80"
                      )}
                    >
                      {item.description}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded-md",
                          isLight
                            ? "bg-black/[0.05] text-[#1a1625]/40"
                            : "bg-white/[0.06] text-white/40"
                        )}
                      >
                        {item.type}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] tabular-nums",
                          isLight ? "text-[#1a1625]/40" : "text-white/40"
                        )}
                      >
                        {item.sizeBytes >= 1024 * 1024
                          ? `${(item.sizeBytes / 1024 / 1024).toFixed(1)} MB`
                          : item.sizeBytes >= 1024
                          ? `${(item.sizeBytes / 1024).toFixed(0)} KB`
                          : `${item.sizeBytes} B`}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
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
            onClick={onClose}
            disabled={cleaningGarbage}
            className={cn(
              "motion-control px-4 h-8 rounded-xl text-[11px] font-medium disabled:opacity-50",
              isLight
                ? "bg-black/[0.05] text-[#1a1625]/45 hover:bg-black/[0.08]"
                : "bg-white/[0.06] text-white/45 hover:bg-white/10"
            )}
          >
            取消
          </button>
          <button
            onClick={async () => {
              setCleaningGarbage(true);
              try {
                for (const item of garbageItems) {
                  try {
                    await TarvenEnv.deleteGarbageItem({ path: item.path });
                  } catch {}
                }
                setGarbageItems([]);
                onClose();
              } catch (e) {
                console.error(e);
              }
              setCleaningGarbage(false);
            }}
            disabled={cleaningGarbage || garbageItems.length === 0}
            className={cn(
              "motion-control px-4 h-8 rounded-xl text-[11px] font-semibold disabled:opacity-50",
              isLight
                ? "bg-[#1a1625] text-[#f5f3ef] hover:bg-[#1a1625]/90"
                : "bg-white/90 text-[#1a1625] hover:bg-white"
            )}
          >
            全部清理
          </button>
        </div>
      </div>
    </>
  );
};
