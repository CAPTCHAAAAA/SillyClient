import React, { useState, useRef, useEffect } from "react";
import { Terminal, Eraser, X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import type { TavernInstance } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { GLOBAL_LOG_KEY, instanceLogs } from "../../lib/log-store";

export interface TerminalModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  safeInsetTop: number;
  terminalPos: { left: number; right: number };
  terminalDisplayTitle: string;
  terminalDisplayBanner: string;
  terminalDisplayPrompt: string;
  terminalDisplayPlaceholder: string;
  terminalInstance: TavernInstance | null;
}

/**
 * 全局调试终端浮窗 (TerminalModal)
 * 提供日志实时流、字号调节、清空与命令交互。
 */
export const TerminalModal: React.FC<TerminalModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  safeInsetTop,
  terminalPos,
  terminalDisplayTitle,
  terminalDisplayBanner,
  terminalDisplayPrompt,
  terminalDisplayPlaceholder,
  terminalInstance,
}) => {
  const terminalSize = { w: 640, h: 340 };
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const [terminalInput, setTerminalInput] = useState("");
  const logKey = terminalInstance?.installDir || terminalInstance?.id || GLOBAL_LOG_KEY;
  const terminalLogs = useInstanceLogs(logKey, isOpen || isClosing);
  // 拖动定位与状态
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    dragCleanup.current?.();
  }, []);

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragCleanup.current?.();

    const modalEl = modalRef.current;
    if (!modalEl) return;

    const rect = modalEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left;
    const initialTop = rect.top;

    setIsDragging(true);

    const onPointerMove = (ev: PointerEvent) => {
      const deltaX = ev.clientX - startX;
      const deltaY = ev.clientY - startY;

      const maxLeft = Math.max(8, window.innerWidth - terminalSize.w - 8);
      const maxTop = Math.max(8, window.innerHeight - terminalSize.h - 8);

      const nextX = Math.max(8, Math.min(maxLeft, initialLeft + deltaX));
      const nextY = Math.max(8, Math.min(maxTop, initialTop + deltaY));

      setDragPos({ x: nextX, y: nextY });
    };

    const onPointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      dragCleanup.current = null;
    };

    dragCleanup.current = onPointerUp;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      ref={modalRef}
      data-terminal-modal="true"
      className={cn(
        "fixed",
        isClosing ? "animate-terminal-exit" : "animate-terminal-enter",
        isDragging && "select-none"
      )}
      style={{
        zIndex: LAYERS.MODAL,
        top: dragPos ? dragPos.y : `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 5.5rem)`,
        left: dragPos ? dragPos.x : terminalPos.left,
        width: terminalSize.w,
        height: terminalSize.h,
        minWidth: 320,
        minHeight: 200,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 2rem)",
      }}
    >
    <div
      className={cn(
        "absolute inset-0 flex flex-col overflow-hidden rounded-2xl border backdrop-blur-[40px]",
        isLight
          ? "bg-[#1e1e2e] border-black/10 text-[#cdd6f4] shadow-[0_16px_60px_rgba(0,0,0,0.18)]"
          : "bg-[#0d0d14] border-white/10 text-[#cdd6f4] shadow-[0_16px_60px_rgba(0,0,0,0.30)]"
      )}
    >
      {/* 标题栏 (支持拖拽到其他位置) */}
      <div
        data-terminal-header="true"
        onPointerDown={handleDragStart}
        className={cn(
          "flex items-center justify-between px-4 h-9 flex-shrink-0 border-b border-white/[0.06] select-none touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Terminal
            className={cn(
              "w-3.5 h-3.5",
              "text-white/40"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              "text-white/50"
            )}
          >
            {terminalDisplayTitle}
          </span>
        </div>
        <div
          className="flex items-center gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* 字号调节 */}
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-lg",
              "bg-white/[0.04]"
            )}
          >
            <span
              className={cn(
                "text-[10px] tabular-nums w-6 text-right",
                "text-white/35"
              )}
            >
              {terminalFontSize}
            </span>
            <input
              type="range"
              min={9}
              max={20}
              step={1}
              value={terminalFontSize}
              onChange={(e) => setTerminalFontSize(Number(e.target.value))}
              className="ios-font-slider w-14 h-1 appearance-none bg-none cursor-pointer"
            />
            <span
              className={cn(
                "text-[10px]",
                "text-white/25"
              )}
            >
              A
            </span>
          </div>
          <button
            onClick={() => instanceLogs.update(logKey, [])}
            title="清空终端"
            className="p-1 rounded-md text-white/40 transition-colors hover:text-white/85"
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-white/40 transition-colors hover:text-white/85"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 终端内容区 */}
      <div
        data-native-log-list
        className="flex-1 bg-transparent font-sans leading-relaxed p-4 overflow-y-auto scrollbar-subtle text-[#cdd6f4]"
        style={{ fontSize: `${terminalFontSize}px` }}
      >
        <div className="opacity-50 mb-1">{terminalDisplayBanner}</div>
        {terminalLogs.map((log, i) => (
          <div
            key={i}
            className={cn(
              "mb-0.5 whitespace-pre-wrap break-all",
              log.level === "error"
                ? "text-red-400"
                : log.level === "success"
                ? "text-white/90 font-medium"
                : "opacity-80"
            )}
          >
            {log.msg}
          </div>
        ))}
        <div className="flex gap-2 mt-1">
          <span className="text-white/35 select-none">
            {terminalDisplayPrompt}
          </span>
          <input
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                terminalInput.trim() &&
                terminalInstance?.type !== "remote" &&
                terminalInstance
              ) {
                const cmd = terminalInput.trim();
                const instanceId =
                  terminalInstance.installDir || terminalInstance.id;
                instanceLogs.append(logKey, { msg: `${terminalDisplayPrompt} ${cmd}`, level: "info" });
                TarvenEnv.sendCommand({ text: cmd, instanceId }).catch(error => {
                  instanceLogs.append(instanceId, {
                    msg: `命令失败: ${error instanceof Error ? error.message : String(error)}`,
                    level: "error",
                  });
                });
                setTerminalInput("");
              }
            }}
            className="flex-1 bg-transparent outline-none text-[#cdd6f4] border-none"
            placeholder={terminalDisplayPlaceholder}
            disabled={!terminalInstance || terminalInstance.type === "remote"}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </div>

    </div>
    </div>
  );
};
