import React, { useState, useRef, useEffect } from "react";
import { Play, MoreVertical } from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { TarvenEnv } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";
import { TerminalWell } from "../common/TerminalWell";
import { InstanceCardDrawer } from "./InstanceCardDrawer";
import "../common/console-card.css";
import "./RunningConsoleCard.css";

export interface RunningConsoleCardProps {
  instance: TavernInstance;
  isLight: boolean;
  glassBg?: string;
  onReturnToTavern?: (instance: TavernInstance) => void;
  onStopInstance?: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
  active: boolean;
  isWindows?: boolean;
}

export { formatDisplayVersion };

/**
 * 运行态控制台卡片组件 (RunningConsoleCard)
 * 高内聚：完全对齐 LaunchConsoleModal 纯正实色轻拟物风格，负责终端日志展示、命令交互投递与就地状态操作
 */
const RunningConsoleCardComponent: React.FC<RunningConsoleCardProps> = ({
  instance,
  isLight,
  glassBg,
  onReturnToTavern,
  onStopInstance,
  onOpenMenu,
  isExpanded,
  onToggleExpand,
  active,
  isWindows = false,
}) => {
  const [terminalInput, setTerminalInput] = useState("");
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const actionsId = React.useId();
  const logKey = instance.installDir || instance.id;
  const terminalLogs = useInstanceLogs(logKey, active);

  const terminalDisplayPrompt = isWindows
    ? `${instance.installDir || instance.id}>`
    : "~ $";
  const terminalPlaceholder = isWindows
    ? "输入 Windows 命令..."
    : "输入 shell 命令...";

  useEffect(() => {
    if (active && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [active, terminalLogs]);

  useEffect(() => {
    const output = logsContainerRef.current;
    if (!active || !output) return;
    let previousHeight = output.clientHeight;
    const observer = new ResizeObserver(() => {
      const currentHeight = output.clientHeight;
      const bottomGap = output.scrollHeight - Math.max(previousHeight, currentHeight) - output.scrollTop;
      if (bottomGap <= 2) output.scrollTop = output.scrollHeight;
      previousHeight = currentHeight;
    });
    observer.observe(output);
    return () => observer.disconnect();
  }, [active]);

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !terminalInput.trim()) return;
    const command = terminalInput.trim();
    const instanceId = instance.installDir || instance.id;
    instanceLogs.append(logKey, {
        msg: `${terminalDisplayPrompt} ${command}`,
        level: "info",
    });
    TarvenEnv.sendCommand({
      text: command,
      instanceId,
    }).catch(error => {
      instanceLogs.append(instanceId, {
        msg: `命令失败: ${error instanceof Error ? error.message : String(error)}`,
        level: "error",
      });
    });
    setTerminalInput("");
  };

  const displayLogs = !active ? [] :
    terminalLogs && terminalLogs.length > 0 && terminalLogs[0].msg !== "就绪，选择实例启动"
      ? terminalLogs
      : [
          { msg: `SillyTavern ${formatDisplayVersion(instance.version)}`, level: "success" },
          { msg: `127.0.0.1:${instance.port || 8000}`, level: "info" },
          { msg: `Daemon active on background`, level: "info" },
        ];

  const isDynamic = Boolean(glassBg?.includes("1c1420"));
  const displayName = instance.subtitle || instance.name;
  const displayVersion = formatDisplayVersion(instance.version);

  return (
    <div
      className={cn(
        "running-console-card console-card ios-task-surface w-full h-full rounded-[26px] relative flex flex-col px-3 pt-2 pb-2.5 overflow-hidden backdrop-blur-[40px] saturate-180 cursor-pointer select-text",
        glassBg,
        isLight && "is-light"
      )}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
        if (event.key === "Escape" && isExpanded) {
          event.stopPropagation();
          onToggleExpand();
          toggleRef.current?.focus({ preventScroll: true });
        }
      }}
      onClick={(event) => {
        const target = event.target as Element;
        if (event.defaultPrevented || target.closest("button, a")) return;
        const isEditing = Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
        if (isExpanded && isEditing) return;
        const selection = window.getSelection();
        if (!isEditing && selection && !selection.isCollapsed && selection.anchorNode && event.currentTarget.contains(selection.anchorNode)) return;
        onToggleExpand();
      }}
    >
      <button
        ref={toggleRef}
        type="button"
        aria-label={isExpanded ? "收起实例操作" : "展开实例操作"}
        aria-expanded={isExpanded}
        aria-controls={actionsId}
        onClick={onToggleExpand}
        className="running-console-card__toolbar relative z-10 flex items-center gap-2 bg-transparent border-0 px-3 pt-0 pb-[3px] shrink-0 cursor-pointer text-left"
      >
        <span className="running-console-card__identity min-w-0 flex-1 flex items-center gap-1.5">
          <span
            title={displayName}
            className={cn(
              "running-console-card__title min-w-0 flex-1 text-[13px] font-normal leading-4 truncate",
              isLight ? "text-[#1a1625]/80" : "text-white/80"
            )}
          >
            {displayName}
          </span>
          <span
            title={displayVersion}
            className={cn(
              "running-console-card__version max-w-[40%] shrink-0 truncate text-[10px] font-normal leading-none tabular-nums",
              isLight ? "text-[#1a1625]/65" : "text-white/50"
            )}
          >
            {displayVersion}
          </span>
        </span>
      </button>

      <TerminalWell
        isLight={isLight}
        isDynamic={isDynamic}
        compact
        onClick={() => {
          if (window.getSelection()?.isCollapsed !== false) terminalInputRef.current?.focus();
        }}
        className="flex-1 min-h-0 mt-1.5 p-3 flex flex-col gap-2 cursor-text select-text overflow-hidden relative z-10"
      >
        <div ref={logsContainerRef} data-native-log-list className="terminal-output min-h-0 flex-1 overflow-y-auto scrollbar-subtle">
          {displayLogs.map((log, logIdx) => (
            <div
              key={logIdx}
              className="terminal-log-line"
              data-level={log.level}
            >
              {log.msg}
            </div>
          ))}
        </div>
        <div className="terminal-output terminal-command-row shrink-0">
          <span
            className="terminal-prompt"
            title={terminalDisplayPrompt}
          >
            {terminalDisplayPrompt}
          </span>
          <input
            ref={terminalInputRef}
            type="text"
            value={terminalInput}
            onChange={(e) => setTerminalInput(e.target.value)}
            onKeyDown={handleTerminalKeyDown}
            placeholder={terminalPlaceholder}
            className="terminal-command-input"
            aria-label="实例终端命令"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>
      </TerminalWell>

      <InstanceCardDrawer
        id={actionsId}
        isOpen={isExpanded}
        className="running-console-card__action-drawer relative z-10 -mx-0.5 shrink-0"
      >
          <div className="running-console-card__actions flex items-center gap-1.5 pt-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReturnToTavern?.(instance);
              }}
              className="console-card__action console-card__action--primary flat-capsule motion-control"
            >
              <Play className="w-3 h-3 shrink-0 fill-current" />
              返回酒馆
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStopInstance?.(instance);
              }}
              className="console-card__action console-card__action--quiet console-card__destructive flat-capsule motion-control ml-auto"
            >
              关闭
            </button>

            <button
              type="button"
              title="操作菜单"
              aria-label="操作菜单"
              onClick={(event) => {
                event.stopPropagation();
                onOpenMenu(instance, event.currentTarget.getBoundingClientRect());
              }}
              className={cn(
                "console-card__action flat-capsule motion-control !h-8 !w-8 !min-h-0 !p-0 rounded-full flex items-center justify-center shrink-0 cursor-pointer border-0",
                isLight
                  ? "text-[#1a1625]/65 hover:text-[#1a1625]"
                  : "text-white/50 hover:text-white"
              )}
            >
              <MoreVertical className="w-3.5 h-3.5 text-current transition-colors" />
            </button>
          </div>
      </InstanceCardDrawer>
    </div>
  );
};
RunningConsoleCardComponent.displayName = "RunningConsoleCard";
export const RunningConsoleCard = React.memo(RunningConsoleCardComponent);
