import React, { useState, useRef, useEffect } from "react";
import { Terminal, Eraser, Flag, X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { getAppliedUiScale, toUnscaledPx } from "../../lib/ui-scale";
import { LAYERS } from "../../constants/layers";
import { reportGlobalError } from "../../lib/global-error-store";
import { humanizeNativeError } from "../../lib/native-errors";
import type { TavernInstance } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { GLOBAL_LOG_KEY, instanceLogs } from "../../lib/log-store";
import { TerminalWell } from "../common/TerminalWell";
import { CornerResizeCurve, CORNER_RESIZE_SAFE_INSET } from "./CornerResizeCurve";

const VIEWPORT_PADDING = 8;
const VIEWPORT_SPACING = VIEWPORT_PADDING + CORNER_RESIZE_SAFE_INSET;

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
  const [terminalFontSize, setTerminalFontSize] = useState(12);
  const [terminalInput, setTerminalInput] = useState("");
  const logKey = terminalInstance?.installDir || terminalInstance?.id || GLOBAL_LOG_KEY;
  const terminalLogs = useInstanceLogs(logKey, isOpen || isClosing);
  const latestTerminalError = [...terminalLogs].reverse().find(log => log.level === "error") ?? null;
  // 拖动定位与状态
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [terminalBox, setTerminalBox] = useState({ w: 640, h: 340 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeCleanup = useRef<(() => void) | null>(null);

  useEffect(() => () => {
    dragCleanup.current?.();
    resizeCleanup.current?.();
  }, []);

  const onResizePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const modalEl = modalRef.current;
    if (!modalEl) return;
    event.preventDefault();
    event.stopPropagation();
    resizeCleanup.current?.();

    const captureTarget = event.currentTarget;
    const pointerId = event.pointerId;
    try {
      captureTarget.setPointerCapture?.(pointerId);
    } catch {
      // 合成指针环境静默降级至 window 监听
    }

    const scale = getAppliedUiScale();
    const maxW = Math.max(320, toUnscaledPx(window.innerWidth) - VIEWPORT_SPACING);
    const maxH = Math.max(200, toUnscaledPx(window.innerHeight) - VIEWPORT_SPACING);
    const startX = event.clientX;
    const startY = event.clientY;
    const rect = modalEl.getBoundingClientRect();
    const startW = rect.width / scale;
    const startH = rect.height / scale;

    let frame: number | null = null;
    let pending: { w: number; h: number } | null = null;
    let latest: { w: number; h: number } | null = null;
    let lastApplied: { w: number; h: number } | null = null;

    const applyBox = (box: { w: number; h: number }) => {
      if (lastApplied && lastApplied.w === box.w && lastApplied.h === box.h) return;
      lastApplied = box;
      modalEl.style.width = `${box.w}px`;
      modalEl.style.height = `${box.h}px`;
    };

    const flush = () => {
      frame = null;
      const next = pending;
      pending = null;
      if (next) applyBox(next);
    };

    setIsResizing(true);

    const onMove = (moveEvent: PointerEvent) => {
      const next = {
        w: Math.round(Math.min(maxW, Math.max(320, startW + (moveEvent.clientX - startX) / scale))),
        h: Math.round(Math.min(maxH, Math.max(200, startH + (moveEvent.clientY - startY) / scale))),
      };
      latest = next;
      pending = next;
      if (frame === null) {
        frame = requestAnimationFrame(flush);
      }
    };

    const cleanup = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      pending = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      try {
        if (captureTarget.hasPointerCapture?.(pointerId)) {
          captureTarget.releasePointerCapture(pointerId);
        }
      } catch {
        // 忽略释放阶段的宿主状态差异
      }
    };

    const onUp = () => {
      cleanup();
      if (latest) {
        applyBox(latest);
        setTerminalBox(latest);
      }
      setIsResizing(false);
      resizeCleanup.current = null;
    };

    resizeCleanup.current = cleanup;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    dragCleanup.current?.();

    const modalEl = modalRef.current;
    if (!modalEl) return;

    const scale = getAppliedUiScale();
    const rect = modalEl.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const initialLeft = rect.left / scale;
    const initialTop = rect.top / scale;
    const maxLeft = Math.max(VIEWPORT_PADDING, (window.innerWidth - rect.width) / scale - CORNER_RESIZE_SAFE_INSET);
    const maxTop = Math.max(VIEWPORT_PADDING, (window.innerHeight - rect.height) / scale - CORNER_RESIZE_SAFE_INSET);

    let frame: number | null = null;
    let pending: { x: number; y: number } | null = null;
    let latest: { x: number; y: number } | null = null;

    const flush = () => {
      frame = null;
      const next = pending;
      pending = null;
      if (!next) return;
      modalEl.style.left = `${next.x}px`;
      modalEl.style.top = `${next.y}px`;
    };

    setIsDragging(true);

    const onPointerMove = (ev: PointerEvent) => {
      const next = {
        x: Math.round(Math.max(VIEWPORT_PADDING, Math.min(maxLeft, initialLeft + (ev.clientX - startX) / scale))),
        y: Math.round(Math.max(VIEWPORT_PADDING, Math.min(maxTop, initialTop + (ev.clientY - startY) / scale))),
      };
      latest = next;
      pending = next;
      if (frame === null) {
        frame = requestAnimationFrame(flush);
      }
    };

    const cleanup = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      pending = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };

    const onPointerUp = () => {
      cleanup();
      if (latest) {
        modalEl.style.left = `${latest.x}px`;
        modalEl.style.top = `${latest.y}px`;
        setDragPos(latest);
      }
      setIsDragging(false);
      dragCleanup.current = null;
    };

    dragCleanup.current = cleanup;
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  };

  if (!isOpen && !isClosing) return null;

  const isDynamic = glassBg.includes("1c1420");
  return (
    <div
      ref={modalRef}
      data-terminal-modal="true"
      className={cn(
        "ios-task-surface reading-flat-surface fixed flex flex-col rounded-2xl backdrop-blur-[40px] saturate-180",
        glassBg,
        isLight && "is-light",
        isClosing ? "animate-terminal-exit" : "animate-terminal-enter",
        isDragging && "select-none"
      )}
      style={{
        zIndex: LAYERS.MODAL,
        top: `clamp(${VIEWPORT_PADDING}px, ${dragPos ? `${dragPos.y}px` : `calc(max(env(safe-area-inset-top), ${safeInsetTop}px) + 5.5rem)`}, calc(var(--ui-vh, 100vh) - min(${terminalBox.h}px, var(--ui-vh, 100vh) - ${VIEWPORT_SPACING}px) - ${CORNER_RESIZE_SAFE_INSET}px))`,
        left: `clamp(${VIEWPORT_PADDING}px, ${dragPos?.x ?? terminalPos.left}px, calc(var(--ui-vw, 100vw) - min(${terminalBox.w}px, var(--ui-vw, 100vw) - ${VIEWPORT_SPACING}px) - ${CORNER_RESIZE_SAFE_INSET}px))`,
        width: terminalBox.w,
        height: terminalBox.h,
        minWidth: `min(320px, calc(var(--ui-vw, 100vw) - ${VIEWPORT_SPACING}px))`,
        minHeight: 200,
        maxWidth: `calc(var(--ui-vw, 100vw) - ${VIEWPORT_SPACING}px)`,
        maxHeight: `calc(var(--ui-vh, 100vh) - ${VIEWPORT_SPACING}px)`,
      }}
    >
      {/* 毛玻璃卡片本体，裁剪只作用在这里，不牵连外面的手柄 */}
      <div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[inherit]"
      >
      {/* 标题栏 (支持拖拽到其他位置) */}
      <div
        data-terminal-header="true"
        onPointerDown={handleDragStart}
        className={cn(
          "flex items-center justify-between gap-3 px-6 py-[13px] flex-shrink-0 select-none touch-none",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
      >
        <div
          data-onboarding-target="terminal-drag"
          className="flex min-w-0 flex-1 self-stretch items-center gap-2 rounded-lg"
        >
          <Terminal
            className={cn(
              "w-3.5 h-3.5 flex-shrink-0",
              isLight ? "text-[#1a1625]/40" : "text-white/40"
            )}
          />
          <span
            className={cn(
              "truncate text-xs font-medium leading-none",
              isLight ? "text-[#1a1625]/50" : "text-white/50"
            )}
          >
            {terminalDisplayTitle}
          </span>
        </div>
        <div
          className="flex h-7 flex-shrink-0 items-center gap-1.5"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* 字号调节 */}
          <div
            className={cn(
              "flex h-7 items-center gap-1.5 px-2 rounded-lg",
              isLight ? "bg-black/[0.04]" : "bg-white/[0.04]"
            )}
          >
            <span
              className={cn(
                "text-[10px] tabular-nums w-4 text-center leading-none",
                isLight ? "text-[#1a1625]/35" : "text-white/35"
              )}
            >
              {terminalFontSize}
            </span>
            <input
              type="range"
              aria-label="终端字号"
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
                "text-[10px] leading-none",
                isLight ? "text-[#1a1625]/25" : "text-white/25"
              )}
            >
              A
            </span>
          </div>
          {latestTerminalError && (
            <button
              type="button"
              onClick={() => {
                const friendly = humanizeNativeError(latestTerminalError.msg);
                reportGlobalError(latestTerminalError.msg, {
                  area: "terminal",
                  stage: "terminal-log",
                  userMessage: `终端运行报错：${friendly}`,
                  extraSecrets: [terminalInstance?.subtitle, terminalInstance?.name, terminalInstance?.installPath],
                  force: true,
                });
              }}
              title="反馈终端异常"
              aria-label="反馈终端异常"
              className={cn(
                "terminal-tool flex h-7 w-7 items-center justify-center rounded-full transition-colors",
                isLight
                  ? "text-[#783047]/70 hover:text-[#783047]"
                  : "text-[#e8a2b5]/75 hover:text-[#f2c4d1]"
              )}
            >
              <Flag className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => instanceLogs.update(logKey, [])}
            title="清空终端"
            aria-label="清空终端"
            className={cn(
              "terminal-tool flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              isLight
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
            )}
          >
            <Eraser className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            aria-label="关闭终端"
            data-onboarding-target="terminal-close"
            className={cn(
              "terminal-tool flex h-7 w-7 items-center justify-center rounded-full transition-colors",
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
      <div className="flex min-h-0 flex-1 px-2.5 pb-2.5">
        <TerminalWell
          isLight={isLight}
          isDynamic={isDynamic}
          data-native-log-list
          className="terminal-output h-full min-h-0 w-full overflow-y-auto px-3.5 py-3 scrollbar-subtle"
          style={{ fontSize: `${terminalFontSize}px` }}
        >
          <div className="terminal-caption mb-1">{terminalDisplayBanner}</div>
          {terminalLogs.map((log, index) => (
            <div
              key={index}
              className="terminal-log-line"
              data-level={log.level}
            >
              {log.msg}
            </div>
          ))}
          <div className="terminal-command-row">
            <span className="terminal-prompt" title={terminalDisplayPrompt}>
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
                    const friendly = humanizeNativeError(error);
                    instanceLogs.append(instanceId, {
                      msg: `命令失败: ${friendly}`,
                      level: "error",
                    });
                    reportGlobalError(error, {
                      area: "terminal",
                      stage: "send-command",
                      userMessage: `终端命令失败：${friendly}`,
                      extraSecrets: [terminalInstance?.subtitle, terminalInstance?.name, terminalInstance?.installPath],
                    });
                  });
                  setTerminalInput("");
                }
              }}
              className="terminal-command-input"
              aria-label="终端命令"
              placeholder={terminalDisplayPlaceholder}
              disabled={!terminalInstance || terminalInstance.type === "remote"}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </TerminalWell>
      </div>
      </div>

      {/* 缩放曲线挂在卡片外层，不被 overflow-hidden 裁掉 */}
      <CornerResizeCurve
        isLight={isLight}
        label="拖动缩放终端"
        active={isResizing}
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
};
