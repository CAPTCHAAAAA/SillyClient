import React, { useState, useRef, useEffect } from "react";
import { Play, MoreVertical } from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { TarvenEnv } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";
import { TerminalWell } from "../common/TerminalWell";

export interface RunningConsoleCardProps {
  instance: TavernInstance;
  index: number;
  isLight: boolean;
  glassBg?: string;
  onReturnToTavern?: (instance: TavernInstance) => void;
  onStopInstance?: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
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
  index,
  isLight,
  glassBg,
  onReturnToTavern,
  onStopInstance,
  onOpenMenu,
  active,
  isWindows = false,
}) => {
  const [terminalInput, setTerminalInput] = useState("");
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);
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

  return (
    <div
      className={cn(
        "ios-task-surface w-full h-full rounded-[26px] relative flex flex-col justify-between p-3.5 overflow-hidden backdrop-blur-[40px] saturate-180 cursor-default select-text",
        glassBg,
        isLight && "is-light"
      )}
      style={isLight ? { backgroundColor: "rgb(var(--app-light-surface-rgb, 242 238 228) / 0.7)" } : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
    >
      <div className="flex items-center justify-between mb-2.5 flex-shrink-0">
        <span
          className={cn(
            "text-[13px] font-bold tracking-tight truncate",
            isLight ? "text-[#1a1625]" : "text-white"
          )}
        >
          {instance.subtitle || instance.name}
        </span>
        <span
          className={cn(
            "px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide border border-transparent flex-shrink-0",
            isLight
              ? "bg-black/[0.035] text-[#1a1625]/60"
              : "bg-white/[0.07] text-white/70"
          )}
        >
          {formatDisplayVersion(instance.version)}
        </span>
      </div>

      <TerminalWell
        isLight={isLight}
        isDynamic={isDynamic}
        compact
        onClick={() => terminalInputRef.current?.focus()}
        className="flex-1 min-h-0 mb-3 p-2.5 flex flex-col cursor-text select-text overflow-hidden relative z-10"
      >
        {/* 日志流与命令行输入 */}
        <div ref={logsContainerRef} data-native-log-list className="terminal-output flex-1 overflow-y-auto scrollbar-subtle">
          {displayLogs.map((log, logIdx) => (
            <div
              key={logIdx}
              className="terminal-log-line"
              data-level={log.level}
            >
              {log.msg}
            </div>
          ))}

          {/* 命令行输入：紧随日志末尾，纯正终端风格，无分割线 */}
          <div className="terminal-command-row">
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
        </div>
      </TerminalWell>

      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onReturnToTavern?.(instance);
          }}
          className={cn(
            "flat-capsule motion-control px-4 h-8 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 min-w-0 flex-1 cursor-pointer whitespace-nowrap border-0",
            isLight
              ? "text-[#1a1625]/70 hover:text-[#1a1625]"
              : "text-white/70 hover:text-white"
          )}
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
          className={cn(
            "flat-capsule motion-control px-3.5 h-8 shrink-0 cursor-pointer rounded-full text-xs font-medium whitespace-nowrap border-0",
            isLight
              ? "text-red-900/55 hover:text-red-900/80"
              : "text-red-300/70 hover:text-red-200"
          )}
        >
          关闭
        </button>

        <button
          type="button"
          title="操作菜单"
          aria-label="操作菜单"
          onClick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onOpenMenu(instance, rect);
          }}
          className={cn(
            "flat-capsule motion-control w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer border-0",
            isLight
              ? "text-[#1a1625]/55 hover:text-[#1a1625]"
              : "text-white/55 hover:text-white"
          )}
        >
          <MoreVertical className="w-3.5 h-3.5 text-current transition-colors" />
        </button>
      </div>
    </div>
  );
};
RunningConsoleCardComponent.displayName = "RunningConsoleCard";
export const RunningConsoleCard = React.memo(RunningConsoleCardComponent);
