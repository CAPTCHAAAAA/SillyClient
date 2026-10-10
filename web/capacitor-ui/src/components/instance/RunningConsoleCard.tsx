import React, { useState, useRef, useEffect } from "react";
import { Play, MoreVertical } from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { TarvenEnv } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";
import { useInstanceLogs } from "../../hooks/useInstanceLogs";
import { instanceLogs } from "../../lib/log-store";

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

  return (
    <div
      className={cn(
        "ios-task-surface w-full h-full rounded-[26px] relative flex flex-col justify-between p-3.5 overflow-hidden backdrop-blur-[40px] saturate-180 cursor-default select-text",
        glassBg
          ? glassBg
          : isLight
            ? "bg-white/85"
            : "bg-[#1a1625]/90",
        isLight && "is-light"
      )}
    >
      {/* 上方：实例名和版本标签（上下间距对称，严格左右对齐，无多余状态灯） */}
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
            "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border flex-shrink-0",
            isLight
              ? "bg-black/[0.06] text-[#1a1625]/55 border-black/[0.08]"
              : "bg-white/[0.08] text-white/50 border-white/[0.08]"
          )}
        >
          {formatDisplayVersion(instance.version)}
        </span>
      </div>

      {/* 控制台内部设计：深度下沉物理凹陷舱体，多层顶部下沉内阴影 + 底部发丝倒角高光反光线，空间深度感极其明显 */}
      <div
        onClick={() => terminalInputRef.current?.focus()}
        className={cn(
          "flex-1 min-h-0 mb-3 rounded-lg p-2.5 flex flex-col cursor-text select-text overflow-hidden font-mono text-[10.5px] leading-relaxed relative z-10 transition-colors border",
          isLight
            ? "bg-[#e5e0da] border-black/15 shadow-[inset_0_3px_8px_rgba(0,0,0,0.16),inset_0_1px_2px_rgba(0,0,0,0.12),inset_0_-1px_0.5px_rgba(255,255,255,0.9),0_1px_1px_rgba(255,255,255,0.8)]"
            : "bg-[#09080e] border-black/50 shadow-[inset_0_4px_10px_-1px_rgba(0,0,0,0.85),inset_0_1.5px_3px_rgba(0,0,0,0.95),inset_0_-1px_0.5px_rgba(255,255,255,0.08),0_1px_1px_rgba(255,255,255,0.05)]"
        )}
      >
        {/* 日志流与命令行输入 */}
        <div ref={logsContainerRef} data-native-log-list className="flex-1 overflow-y-auto space-y-1 scrollbar-subtle pr-1 font-mono text-[10px]">
          {displayLogs.map((log, logIdx) => (
            <div
              key={logIdx}
              className={cn(
                "whitespace-pre-wrap break-words leading-relaxed",
                log.level === "error"
                  ? "text-red-400/90"
                  : log.level === "success"
                  ? (isLight ? "text-emerald-700 font-semibold" : "text-white/80")
                  : (isLight ? "text-[#1a1625]/60" : "text-white/60")
              )}
            >
              {log.msg}
            </div>
          ))}

          {/* 命令行输入：紧随日志末尾，纯正终端风格，无分割线 */}
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                "select-none font-semibold flex-shrink-0",
                isLight ? "text-emerald-700" : "text-emerald-400"
              )}
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
              className={cn(
                "min-w-0 flex-1 border-none bg-transparent outline-none font-mono text-[10px]",
                isLight
                  ? "text-[#1a1625] placeholder:text-black/25"
                  : "text-white/90 placeholder:text-white/25"
              )}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>

      {/* 底部按钮栏：向导风格实色按钮，与上方元素边框完全垂直对齐 */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        {/* 返回酒馆（主动作，低饱和沉稳胶囊，避免深色纯白刺眼光斑） */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReturnToTavern?.(instance);
          }}
          className={cn(
            "motion-control px-4 h-8 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 transition-colors border active:scale-[0.98]",
            isLight
              ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625] active:bg-black/[0.18]"
              : "bg-white/20 border-white/15 text-white/70 hover:text-white active:bg-white/35"
          )}
        >
          <Play className="w-3 h-3 fill-current" />
          返回酒馆
        </button>

        {/* 关闭（次动作，统一低饱和规范红） */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStopInstance?.(instance);
          }}
          className={cn(
            "motion-control px-3.5 h-8 rounded-full text-xs font-medium transition-colors border active:scale-[0.98]",
            isLight
              ? "bg-black/[0.04] border-black/[0.06] text-red-900/50 hover:text-red-900/80"
              : "bg-white/[0.08] border-white/[0.06] text-red-400/55 hover:text-red-300/90"
          )}
        >
          关闭
        </button>

        {/* 更多菜单（与向导一致的圆点按钮） */}
        <button
          type="button"
          title="操作菜单"
          aria-label="操作菜单"
          onClick={(e) => {
            e.stopPropagation();
            const r = e.currentTarget.getBoundingClientRect();
            onOpenMenu(instance, r);
          }}
          className={cn(
            "motion-control w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors",
            isLight
              ? "bg-black/[0.04] border-black/[0.06] text-[#1a1625]/50 hover:text-[#1a1625]"
              : "bg-white/[0.08] border-white/[0.06] text-white/50 hover:text-white"
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
