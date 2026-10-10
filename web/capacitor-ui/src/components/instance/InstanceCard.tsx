import React from "react";
import type { TavernInstance } from "../../types";
import { InstanceStoppedCard } from "./InstanceStoppedCard";
import { RunningConsoleCard } from "./RunningConsoleCard";
import { FlipCard } from "../common/FlipCard";

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
  isWindows?: boolean;
  onLongPress?: (instance: TavernInstance) => void;
  style?: React.CSSProperties;
  className?: string;
  isReordering?: boolean;
  isDropping?: boolean;
  isReorderCommitting?: boolean;
  onPointerDownCapture?: (e: React.PointerEvent) => void;
  onClickCapture?: (e: React.MouseEvent) => void;
}

/**
 * 实例轮播槽位卡片 (InstanceCard)
 * 职责：纯净卡片槽位与状态 3D 旋转翻转过渡调度。
 * 高内聚低耦合：
 * - 停止态卡片 InstanceStoppedCard 100% 保持原有无缝单层卡片与纯粹拟物动效结构；
 * - 运行态卡片归口于 RunningConsoleCard (实色轻拟物控制台、终端日志流、实时命令交互、就地操作按钮)；
 * - 正反两面严格约束于 240x320 物理尺寸与 18px 圆角，通过 3D 弹簧物理旋转实现无缝翻转。
 */
export const InstanceCard = React.memo<InstanceCardProps>((props) => {
  const isRunning = props.instance.status === "running";
  const isExpanded = props.hoveredCard === props.instance.id;
  const isMenuOpen = props.activeCardMenu === props.instance.id;

  return (
    <FlipCard
      data-instance-id={props.instance.id}
      data-card-index={String(props.index + 1)}
      data-card-running={isRunning ? "true" : "false"}
      data-reordering={props.isReordering ? "true" : undefined}
      data-dropping={props.isDropping ? "true" : undefined}
      data-reorder-committing={props.isReorderCommitting ? "true" : undefined}
      className={`flex-shrink-0 snap-center${props.className ? ` ${props.className}` : ""}`}
      style={props.style}
      width={240}
      height={320}
      radius={26}
      flipped={isRunning}
      axis="y"
      flipOnClick={false}
      onLongPress={props.onLongPress ? () => props.onLongPress?.(props.instance) : undefined}
      onPointerDownCapture={props.onPointerDownCapture}
      onClickCapture={props.onClickCapture}
      draggable={false}
      tilt={true}
      tiltMax={3.8}
      glare={true}
      glareOpacity={props.isLight ? 0.010 : 0.015}
      behindGlow={true}
      behindGlowColor={props.isLight ? "rgba(0, 0, 0, 0.015)" : "rgba(255, 255, 255, 0.025)"}
      behindGlowSize="35%"
      borderColor="transparent"
      hoverScale={1.0}
      perspective={1100}
      stiffness={160}
      damping={28}
      background={props.isLight ? "#fbfafc" : "#16131f"}
      color={props.isLight ? "#1a1625" : "#f5f5f5"}
      shadow={true}
      shadowColor="#000000"
      shadowOpacity={props.isLight ? 0.05 : 0.18}
      front={
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
      }
      back={
        <RunningConsoleCard
          instance={props.instance}
          index={props.index}
          isLight={props.isLight}
          glassBg={props.glassBg}
          onReturnToTavern={props.onReturnToTavern}
          onStopInstance={props.onStopInstance}
          onOpenMenu={props.onOpenMenu}
          active={isRunning}
          isWindows={props.isWindows}
        />
      }
    />
  );
});
InstanceCard.displayName = "InstanceCard";
