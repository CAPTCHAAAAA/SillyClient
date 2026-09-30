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
  onRenameSave: (instanceId: string, newName: string) => void;
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
 * - 停止态普通卡片归口于 InstanceStoppedCard (扁平拟物材质、封面、标题内联编辑、点击详情抽屉)；
 * - 运行态控制台归口于 RunningConsoleCard (实色轻拟物控制台、终端日志流、实时命令交互、就地操作按钮)；
 * - 两者彼此解耦，通过轻量级 300ms 纯透明度平滑溶变过渡，互不干扰 DOM 与交互事件。
 */
export const InstanceCard = React.memo<InstanceCardProps>((props) => {
  const isRunning = props.instance.status === "running";
  const isExpanded = props.hoveredCard === props.instance.id;
  const isMenuOpen = props.activeCardMenu === props.instance.id;

  return (
    <div
      data-card-index={String(props.index + 1)}
      className="flex-shrink-0 w-60 h-[320px] rounded-[18px] snap-center relative"
      style={{ contain: "layout paint" }}
    >
      {isRunning ? (
        <RunningConsoleCard
          instance={props.instance}
          index={props.index}
          isLight={props.isLight}
          onReturnToTavern={props.onReturnToTavern}
          onStopInstance={props.onStopInstance}
          onOpenMenu={props.onOpenMenu}
          terminalLogs={props.terminalLogs}
          setTerminalLogs={props.setTerminalLogs}
          isWindows={props.isWindows}
        />
      ) : (
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
          onRenameSave={props.onRenameSave}
          isExternallyRenaming={props.isExternallyRenaming}
          onClearExternalRenaming={props.onClearExternalRenaming}
        />
      )}
    </div>
  );
});
InstanceCard.displayName = "InstanceCard";
