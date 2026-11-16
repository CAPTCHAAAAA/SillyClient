import React, { useEffect, useState } from "react";
import { X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { ActionButton } from "../common/ActionButton";
import { ErrorReportAlert } from "../common/ErrorReportAlert";
import type { GarbageItem } from "../../capacitor-plugin";
import { executeGarbagePlan } from "../../lib/garbage-plan";
import { reportGlobalError } from "../../lib/global-error-store";
import {
  createDiagnosticContext,
  humanizeNativeError,
  type DiagnosticContext,
} from "../../lib/native-errors";

export interface CleanGarbageModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  cleaningGarbage: boolean;
  setCleaningGarbage: (v: boolean) => void;
  garbageItems: GarbageItem[];
  setGarbageItems: React.Dispatch<React.SetStateAction<GarbageItem[]>>;
  error: string | null;
  setError: (value: string | null) => void;
  diagnostic?: DiagnosticContext | null;
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
  error,
  setError,
  diagnostic,
}) => {
  const [deleteDiagnostic, setDeleteDiagnostic] = useState<DiagnosticContext | null>(null);

  useEffect(() => {
    if (!isOpen || !error) {
      setDeleteDiagnostic(null);
    }
  }, [error, isOpen]);

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
          "ios-task-surface reading-flat-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(420px, calc(var(--ui-vw, 100vw) - 2rem))",
          maxHeight: "min(calc(var(--ui-vh, 100vh) * 0.8), calc(var(--ui-vh, 100vh) - 4rem))",
        }}
      >
        <div
          className="flex items-center justify-between px-5 h-12 flex-shrink-0"
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
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 scrollbar-subtle">
          <ErrorReportAlert
            error={error}
            diagnostic={diagnostic ?? deleteDiagnostic}
            area="cleanup"
            isLight={isLight}
            className="mb-3"
          />
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
              {error ? "扫描未完成" : "未发现垃圾文件"}
            </div>
          ) : (
            <div className="space-y-2">
              {garbageItems.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-center justify-between gap-3 p-3 rounded-xl",
                    isLight
                      ? "bg-black/[0.035]"
                      : "bg-white/[0.04]"
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

        <div className="flex items-center justify-end gap-2 px-5 py-3 flex-shrink-0">
          <ActionButton
            onClick={onClose}
            disabled={cleaningGarbage}
            className={cn(
              "!h-8 px-4 text-[11px] font-medium",
              isLight
                ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                : "text-white/60 hover:text-white"
            )}
          >
            取消
          </ActionButton>
          <ActionButton
            onClick={async () => {
              setCleaningGarbage(true);
              setError(null);
              setDeleteDiagnostic(null);
              try {
                const result = await executeGarbagePlan(garbageItems, options => TarvenEnv.deleteGarbageItem(options));
                setGarbageItems(result.failed);
                if (result.errors.length) {
                  const rawErrors = result.errors.join("\n");
                  const friendly = result.errors.map(item => humanizeNativeError(item)).join("\n");
                  const context = createDiagnosticContext(rawErrors, {
                    area: "cleanup",
                    stage: "delete-garbage",
                    userMessage: friendly,
                  });
                  setError(friendly);
                  setDeleteDiagnostic(context);
                  reportGlobalError(rawErrors, {
                    area: "cleanup",
                    stage: "delete-garbage",
                    userMessage: friendly,
                    diagnostic: context,
                  });
                } else {
                  onClose();
                }
              } catch (e) {
                const friendly = humanizeNativeError(e);
                const context = createDiagnosticContext(e, {
                  area: "cleanup",
                  stage: "delete-garbage",
                  userMessage: friendly,
                });
                setError(friendly);
                setDeleteDiagnostic(context);
                reportGlobalError(e, {
                  area: "cleanup",
                  stage: "delete-garbage",
                  userMessage: friendly,
                  diagnostic: context,
                });
              } finally {
                setCleaningGarbage(false);
              }
            }}
            disabled={cleaningGarbage || garbageItems.length === 0}
            className={cn(
              "!h-8 px-4 text-[11px] font-semibold",
              isLight
                ? "text-[#1a1625]/80 hover:text-[#1a1625]"
                : "text-white/85 hover:text-white"
            )}
          >
            全部清理
          </ActionButton>
        </div>
      </div>
    </>
  );
};
