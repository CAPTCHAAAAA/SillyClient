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
  glassBg,
  safeInsetTop,
  terminalPos,
  terminalDisplayTitle,
  terminalDisplayBanner,
  terminalDisplayPrompt,
  terminalDisplayPlaceholder,
  terminalInstance,
}) => {
  const [terminalSize, setTerminalSize] = useState({ w: 640, h: 340 });
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const [terminalInput, setTerminalInput] = useState("");
  const logKey = terminalInstance?.installDir || terminalInstance?.id || GLOBAL_LOG_KEY;
  const terminalLogs = useInstanceLogs(logKey, isOpen || isClosing);
  const resizeCleanup = useRef<(() => void) | null>(null);

  // 拖动定位与状态
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => {
    resizeCleanup.current?.();
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

  const startResize = (startX: number, startY: number) => {
    resizeCleanup.current?.();
    const origW = terminalSize.w;
    const origH = terminalSize.h;
    const onMove = (clientX: number, clientY: number) => {
      setTerminalSize({
        w: Math.max(320, Math.min(window.innerWidth - 16, origW + (clientX - startX))),
        h: Math.max(200, Math.min(window.innerHeight - 16, origH + (clientY - startY))),
      });
    };
    const onMouseMove = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches[0]) onMove(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onEnd = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
      resizeCleanup.current = null;
    };
    resizeCleanup.current = onEnd;
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onEnd);
  };

  if (!isOpen && !isClosing) return null;

  return (
    <div
      ref={modalRef}
      data-terminal-modal="true"
      className={cn(
        "fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
        glassBg,
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
      {/* 标题栏 (支持拖拽到其他位置) */}
      <div
        data-terminal-header="true"
        onPointerDown={handleDragStart}
        className={cn(
          "flex items-center justify-between px-4 h-9 flex-shrink-0 border-b select-none touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab",
          isLight ? "border-black/[0.06]" : "border-white/[0.06]"
        )}
      >
        <div className="flex items-center gap-2 pointer-events-none">
          <Terminal
            className={cn(
              "w-3.5 h-3.5",
              isLight ? "text-[#1a1625]/40" : "text-white/40"
            )}
          />
          <span
            className={cn(
              "text-xs font-medium",
              isLight ? "text-[#1a1625]/50" : "text-white/50"
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
              isLight ? "bg-black/[0.04]" : "bg-white/[0.04]"
            )}
          >
            <span
              className={cn(
                "text-[10px] tabular-nums w-6 text-right",
                isLight ? "text-[#1a1625]/35" : "text-white/35"
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
              className={cn(
                "ios-font-slider w-14 h-1 appearance-none bg-none cursor-pointer",
                isLight && "ios-font-slider-light"
              )}
            />
            <span
              className={cn(
                "text-[10px]",
                isLight ? "text-[#1a1625]/25" : "text-white/25"
              )}
            >
              A
            </span>
          </div>
          <button
            onClick={() => instanceLogs.update(logKey, [])}
            title="清空终端"
            className={cn(
              "p-1 rounded-md transition-colors",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className={cn(
              "p-1 rounded-md transition-colors",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 终端内容区 */}
      <div
        data-native-log-list
        className={cn(
          "flex-1 font-sans leading-relaxed p-4 overflow-y-auto scrollbar-subtle",
          isLight
            ? "bg-[#1e1e2e]/90 text-[#cdd6f4]"
            : "bg-[#0d0d14]/90 text-[#cdd6f4]"
        )}
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
                ? isLight
                  ? "text-[#1a1625]/90 font-medium"
                  : "text-white/90 font-medium"
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

      {/* 拖拽缩放 */}
      <div
        className={cn(
          "absolute bottom-1 right-1 w-5 h-5 cursor-se-resize z-10 opacity-40 transition-opacity hover:opacity-80 touch-none",
          isLight ? "text-[#1a1625]" : "text-white"
        )}
        onMouseDown={(e) => startResize(e.clientX, e.clientY)}
        onTouchStart={(e) => {
          e.preventDefault();
          const t = e.touches[0];
          startResize(t.clientX, t.clientY);
        }}
      >
        <svg viewBox="0 0 12 12" fill="none" className="w-full h-full">
          <line
            x1="11"
            y1="1"
            x2="5"
            y2="7"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
          <line
            x1="11"
            y1="4"
            x2="8"
            y2="7"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
