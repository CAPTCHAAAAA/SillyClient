import React from "react";
import { cn } from "../../lib/utils";
import type { TavernInstance } from "../../types";
import { InstanceStoppedCard } from "./InstanceStoppedCard";
import { RunningConsoleCard } from "./RunningConsoleCard";

export interface InstanceCardProps {
  instance: TavernInstance;
  index: number;
  isLight: boolean;
  glassBg?: string;
  hoveredCard: string | null;
  setHoveredCard: (id: string | null) => void;
  activeCardMenu: string | null;
  launchingId: string | null;
  onLaunch: (instance: TavernInstance) => void;
  onReturnToTavern?: (instance: TavernInstance) => void;
  onStopInstance?: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  onRenameSave?: (instanceId: string, newName: string) => void;
  isExternallyRenaming?: boolean;
  onClearExternalRenaming?: () => void;
  terminalLogs?: { msg: string; level?: string }[];
  setTerminalLogs?: React.Dispatch<React.SetStateAction<{ msg: string; level?: string }[]>>;
  isWindows?: boolean;
}

/**
 * 实例轮播槽位卡片 (InstanceCard)
 * 职责：纯净卡片槽位与状态流体过渡调度。
 * 高内聚低耦合：
 * - 停止态卡片 100% 保持 1.9.1 原始无缝单层卡片与纯粹拟物动效结构；
 * - 运行态卡片归口于 RunningConsoleCard (实色轻拟物控制台、终端日志流、实时命令交互、就地操作按钮)；
 * - 两者彼此解耦，互不干扰 DOM 与交互事件。
 */
export const InstanceCard = React.memo<InstanceCardProps>((props) => {
  const isRunning = props.instance.status === "running";
  const isExpanded = props.hoveredCard === props.instance.id;
  const isMenuOpen = props.activeCardMenu === props.instance.id;

  return (
    <div
      data-card-index={String(props.index + 1)}
      data-card-running={isRunning ? "true" : "false"}
      className="flex-shrink-0 w-60 h-[320px] rounded-[18px] snap-center relative"
      style={{
        transformStyle: "preserve-3d",
      }}
    >
      {/* 停止态普通卡片面（同位驻留，统一 500ms 高斯模糊与位移交叉溶变，和设置页/主题切换 100% 对齐） */}
      <div
        className={cn(
          "w-full h-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          !isRunning
            ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto visible"
            : "absolute inset-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none invisible"
        )}
        aria-hidden={isRunning}
      >
        <InstanceStoppedCard
          instance={props.instance}
          index={props.index}
          isLight={props.isLight}
          glassBg={props.glassBg}
          isExpanded={isExpanded}
          isMenuOpen={isMenuOpen}
          launchingId={props.launchingId}
          onToggleExpand={() => props.setHoveredCard(isExpanded ? null : props.instance.id)}
          onLaunch={props.onLaunch}
          onOpenMenu={props.onOpenMenu}
          onRenameSave={props.onRenameSave || (() => {})}
          isExternallyRenaming={props.isExternallyRenaming}
          onClearExternalRenaming={props.onClearExternalRenaming}
        />
      </div>

      {/* 运行态控制台卡片面 (RunningConsoleCard, 统一 500ms 高斯模糊与位移交叉溶变) */}
      <div
        className={cn(
          "w-full h-full transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          isRunning
            ? "relative opacity-100 translate-y-0 filter-none pointer-events-auto visible"
            : "absolute inset-0 opacity-0 translate-y-1.5 blur-[3px] pointer-events-none select-none invisible"
        )}
        aria-hidden={!isRunning}
      >
        <RunningConsoleCard
          instance={props.instance}
          index={props.index}
          isLight={props.isLight}
          glassBg={props.glassBg}
          onReturnToTavern={props.onReturnToTavern}
          onStopInstance={props.onStopInstance}
          onOpenMenu={props.onOpenMenu}
          terminalLogs={props.terminalLogs}
          setTerminalLogs={props.setTerminalLogs}
          isWindows={props.isWindows}
        />
      </div>
    </div>
  );
});
InstanceCard.displayName = "InstanceCard";
