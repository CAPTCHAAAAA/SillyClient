import React from "react";
import { Play, MoreVertical, Lock } from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import type { TavernInstance } from "../../types";
import { coverTone, coverWash } from "./coverTone";
import { useFrozenCoverPlate } from "./useFrozenCoverPlate";
import { InstanceCardDrawer } from "./InstanceCardDrawer";
import { InstanceRenameField, type InstanceRenameState } from "./InstanceRenameField";

export interface InstanceStoppedCardProps {
  instance: TavernInstance;
  index: number;
  isLight: boolean;
  isDynamic?: boolean;
  glassBg?: string;
  isExpanded: boolean;
  launchingId: string | null;
  onToggleExpand: () => void;
  onLaunch: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  rename?: InstanceRenameState;
  isReordering?: boolean;
}

function getStatusText(status: TavernInstance["status"]) {
  switch (status) {
    case "running":
      return "运行中";
    case "online":
      return "在线";
    case "offline":
      return "离线";
    case "error":
      return "异常";
    default:
      return "已停止";
  }
}

/**
 * 停止态实例卡片组件 (InstanceStoppedCard)
 * 高内聚：专注表达静止态扁平拟物材质、封面、标题及点击展开详情抽屉
 */
export const InstanceStoppedCard: React.FC<InstanceStoppedCardProps> = ({
  instance,
  index,
  isLight,
  isDynamic = false,
  isExpanded,
  launchingId,
  onToggleExpand,
  onLaunch,
  onOpenMenu,
  rename,
  isReordering = false,
}) => {
  const coverSrc = instance.cover || "./tavern-logo.png";
  const { rootRef, plateRef, usePlate } = useFrozenCoverPlate(isLight, isDynamic, isReordering, coverSrc);

  return (
    <div
      ref={rootRef}
      data-slot={String(index + 1)}
      className={cn(
        "motion-instance-card w-full h-full rounded-[26px] relative group cursor-pointer overflow-hidden",
        isLight && "is-light",
        isExpanded && "is-expanded"
      )}
      data-frozen-plate={usePlate ? "" : undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        onToggleExpand();
      }}
    >
      {/* 封面与遮罩：100% 饱满贴合圆角内壁，彻底消除边缘漏边 */}
      <div className="absolute inset-0">
        {usePlate ? <div ref={plateRef} className="cover-frozen-plate" /> : null}
        <img
          src={instance.cover || "./tavern-logo.png"}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: coverWash(coverTone(isLight, isDynamic)),
          }}
        />
      </div>

      <div className="card-volume-wash" aria-hidden="true" />

      <div
        className={cn(
          "absolute inset-0 rounded-[26px] transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none",
          isLight
            ? "bg-gradient-to-t from-white/70 via-white/35 to-white/5"
            : "bg-gradient-to-t from-black/75 via-black/40 to-black/10",
          isExpanded ? "opacity-0" : "opacity-100"
        )}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-[26px] bg-gradient-to-t from-black/80 via-black/50 to-black/20 transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] pointer-events-none",
          isExpanded ? "opacity-100" : "opacity-0"
        )}
      />

      <div className="relative h-full flex flex-col p-3.5 overflow-hidden rounded-[26px]">
        {/* 版本胶囊与密码锁标记 */}
        <div className="self-start flex items-center gap-1.5 w-fit">
          <span
            className={cn(
              "px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide border border-transparent",
              isLight
                ? "bg-black/[0.035] text-[#1a1625]/60"
                : "bg-white/[0.07] text-white/70"
            )}
          >
            {formatDisplayVersion(instance.version)}
          </span>
          {instance.hasPassword && (
            <span
              title="已设置访问密码"
              className={cn(
                "px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border inline-flex items-center gap-1",
                isLight
                  ? "bg-black/[0.06] text-[#1a1625]/60 border-black/[0.08]"
                  : "bg-white/[0.08] text-white/60 border-white/[0.08]"
              )}
            >
              <Lock className="w-2.5 h-2.5" />
              <span>锁定</span>
            </span>
          )}
        </div>

        <div className="flex-1" />

        <div
          title={rename ? undefined : instance.subtitle || instance.name}
          data-renaming={rename ? "true" : undefined}
          style={rename ? { width: "100%" } : undefined}
          className={cn(
            "preview-card-subtitle relative text-sm font-medium leading-snug mb-2 flex items-center justify-between",
            isLight ? "text-[#1a1625]/75" : "text-white/80"
          )}
        >
          <span aria-hidden={Boolean(rename && !rename.closing)} className="instance-rename-label truncate">
            {instance.subtitle || instance.name}
          </span>
          {rename && <InstanceRenameField state={rename} isLight={isLight} />}
        </div>

        {/* 类型与状态指示 */}
        <div className="preview-card-status flex items-center justify-between mt-1.5">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center justify-center shrink-0 scale-[0.72]",
                isLight ? "text-[#1a1625]/50" : "text-white"
              )}
            >
              {instance.icon}
            </span>
            <span
              className={cn(
                "text-[10px] font-medium",
                isLight ? "text-[#1a1625]/45" : "text-white/55"
              )}
            >
              {instance.type === "local" ? "本地" : "远程"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <div
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                instance.type === "local"
                  ? isLight
                    ? "bg-[#1a1625]/45"
                    : "bg-white/50"
                  : instance.status === "online"
                  ? isLight
                    ? "bg-[#1a1625]/45"
                    : "bg-white/50"
                  : "bg-red-400/50"
              )}
            />
            <span
              className={cn(
                "text-[10px] font-medium",
                isLight ? "text-[#1a1625]/60" : "text-white/60"
              )}
            >
              {instance.type === "local"
                ? "本地"
                : getStatusText(instance.status)}
            </span>
          </div>
        </div>

        {/* 鼠标点击展开的详情抽屉 */}
        <InstanceCardDrawer isOpen={isExpanded}>
            <div className="pt-2 space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={cn(
                    isLight ? "text-[#1a1625]/35" : "text-white/40"
                  )}
                >
                  创建时间
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    isLight ? "text-[#1a1625]/60" : "text-white/70"
                  )}
                >
                  {instance.createdAt || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={cn(
                    isLight ? "text-[#1a1625]/35" : "text-white/40"
                  )}
                >
                  上次使用
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    isLight ? "text-[#1a1625]/60" : "text-white/70"
                  )}
                >
                  {instance.lastUsed || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span
                  className={cn(
                    isLight ? "text-[#1a1625]/35" : "text-white/40"
                  )}
                >
                  累计使用
                </span>
                <span
                  className={cn(
                    "font-medium tabular-nums",
                    isLight ? "text-[#1a1625]/60" : "text-white/70"
                  )}
                >
                  {instance.totalUsage || "—"}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunch(instance);
                  }}
                  disabled={launchingId === instance.id}
                  className={cn(
                    "flat-capsule motion-control h-7 px-4 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 border-0 disabled:opacity-50",
                    isLight
                      ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                      : "text-white/60 hover:text-white"
                  )}
                >
                  <Play className="w-2.5 h-2.5" />{" "}
                  {launchingId === instance.id ? "启动中" : "启动"}
                </button>
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
                    "flat-capsule motion-control w-7 h-7 rounded-full flex items-center justify-center border-0",
                    isLight
                      ? "text-[#1a1625]/55 hover:text-[#1a1625]"
                      : "text-white/55 hover:text-white"
                  )}
                >
                  <MoreVertical className="w-3 h-3 text-current transition-colors" />
                </button>
              </div>
            </div>
        </InstanceCardDrawer>
      </div>
    </div>
  );
};
