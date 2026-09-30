import React, { useState, useRef, useEffect } from "react";
import { Play, MoreVertical } from "lucide-react";
import { cn } from "../../lib/utils";
import { TarvenEnv } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";

export interface RunningConsoleCardProps {
  instance: TavernInstance;
  index: number;
  isLight: boolean;
  onReturnToTavern?: (instance: TavernInstance) => void;
  onStopInstance?: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  terminalLogs?: { msg: string; level?: string }[];
  setTerminalLogs?: React.Dispatch<React.SetStateAction<{ msg: string; level?: string }[]>>;
  isWindows?: boolean;
}

/**
 * 运行态控制台卡片组件 (RunningConsoleCard)
 * 高内聚：完全对齐 LaunchConsoleModal 纯正实色轻拟物风格，负责终端日志展示、命令交互投递与就地状态操作
 */
export const RunningConsoleCard: React.FC<RunningConsoleCardProps> = ({
  instance,
  index,
  isLight,
  onReturnToTavern,
  onStopInstance,
  onOpenMenu,
  terminalLogs,
  setTerminalLogs,
  isWindows = false,
}) => {
  const [terminalInput, setTerminalInput] = useState("");
  const logsEndRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  const terminalDisplayPrompt = isWindows
    ? `${instance.installDir || instance.id}>`
    : "~ $";
  const terminalPlaceholder = isWindows
    ? "输入 Windows 命令..."
    : "输入 shell 命令...";

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !terminalInput.trim()) return;
    const command = terminalInput.trim();
    const instanceId = instance.installDir || instance.id;
    setTerminalLogs?.((previous) => [
      ...previous,
      {
        msg: `${terminalDisplayPrompt} ${command}`,
        level: "info",
      },
    ]);
    TarvenEnv.sendCommand({
      text: command,
      instanceId,
    }).catch(() => {});
    setTerminalInput("");
  };

  const displayLogs =
    terminalLogs && terminalLogs.length > 0 && terminalLogs[0].msg !== "就绪，选择实例启动"
      ? terminalLogs
      : [
          { msg: `SillyTavern ${instance.version || "1.12.4"}`, level: "success" },
          { msg: `127.0.0.1:${instance.port || 8000}`, level: "info" },
          { msg: `Daemon active on background`, level: "info" },
        ];

  return (
    <div
      className={cn(
        "motion-instance-card ios-task-surface w-full h-full rounded-[18px] relative flex flex-col justify-between p-3.5 overflow-hidden border cursor-default select-text",
        isLight
          ? "bg-[#f5f6f9] border-black/10 shadow-[0_16px_40px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.9)]"
          : "bg-[#15101d] border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]",
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
            "px-2 py-0.5 rounded-full text-[10px] font-mono tracking-tight border flex-shrink-0",
            isLight
              ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625]/60"
              : "bg-white/[0.06] border-white/[0.08] text-white/50"
          )}
        >
          {instance.version ? `v${instance.version}` : "v1.12.4"}
        </span>
      </div>

      {/* 控制台内部设计：对齐 LaunchConsoleModal 色差内凹效果，内部 r 角更小更方（rounded-lg），边框完全对齐 */}
      <div
        onClick={() => terminalInputRef.current?.focus()}
        className={cn(
          "flex-1 min-h-0 mb-3 rounded-lg p-2.5 flex flex-col cursor-text select-text overflow-hidden font-mono text-[10.5px] leading-relaxed border transition-colors",
          "shadow-[inset_0_2px_6px_rgba(0,0,0,0.35),inset_0_0.5px_0_rgba(0,0,0,0.2)]",
          isLight
            ? "bg-black/[0.04] border-black/[0.10]"
            : "bg-black/[0.38] border-white/[0.05]"
        )}
        style={{
          backgroundColor: isLight
            ? undefined
            : "var(--sc-console-mask-bg, rgba(0, 0, 0, var(--sc-console-mask-opacity, 0.38)))",
        }}
      >
        {/* 日志流与命令行输入 */}
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-subtle pr-1 font-mono text-[10px]">
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
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* 底部按钮栏：向导风格实色按钮，与上方元素边框完全垂直对齐 */}
      <div className="flex items-center justify-between gap-2 flex-shrink-0">
        {/* 返回酒馆（主动作，实色白色胶囊） */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReturnToTavern?.(instance);
          }}
          className={cn(
            "motion-control px-4 h-8 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 flex-1 transition-all border active:scale-[0.98]",
            isLight
              ? "bg-[#1a1625] border-[#1a1625] text-white hover:bg-[#1a1625]/90 active:bg-[#1a1625]/80 shadow-[0_2px_8px_rgba(0,0,0,0.10)]"
              : "bg-white border-white text-[#14101e] hover:bg-white/90 active:bg-white/80 shadow-[0_2px_10px_rgba(255,255,255,0.12)]"
          )}
        >
          <Play className="w-3 h-3 fill-current" />
          返回酒馆
        </button>

        {/* 关闭（次动作，向导次级实色胶囊，仅文字使用红色字体） */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onStopInstance?.(instance);
          }}
          className={cn(
            "motion-control px-3.5 h-8 rounded-full text-xs font-medium transition-all border active:scale-[0.98]",
            isLight
              ? "bg-black/[0.04] border-black/[0.06] text-red-600 hover:bg-black/[0.08]"
              : "bg-white/[0.08] border-white/[0.06] text-rose-400 hover:bg-white/[0.14] hover:text-rose-300"
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
              ? "bg-black/[0.04] border-black/[0.06] text-[#1a1625]/60 hover:bg-black/[0.08]"
              : "bg-white/[0.08] border-white/[0.06] text-white/60 hover:bg-white/[0.14]"
          )}
        >
          <MoreVertical
            className={cn(
              "w-3.5 h-3.5",
              isLight ? "text-[#1a1625]/60" : "text-white/60"
            )}
          />
        </button>
      </div>
    </div>
  );
};
