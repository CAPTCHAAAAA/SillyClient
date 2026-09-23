import React, { useState, useRef, useEffect } from "react";
import { Play, MoreVertical, Edit2 } from "lucide-react";
import { cn } from "../../lib/utils";
import type { TavernInstance } from "../../types";

export interface InstanceCardProps {
  instance: TavernInstance;
  index: number;
  isLight: boolean;
  hoveredCard: string | null;
  setHoveredCard: (id: string | null) => void;
  activeCardMenu: string | null;
  launchingId: string | null;
  onLaunch: (instance: TavernInstance) => void;
  onOpenMenu: (instance: TavernInstance, rect: DOMRect) => void;
  onRenameSave: (instanceId: string, newName: string) => void;
  isExternallyRenaming?: boolean;
  onClearExternalRenaming?: () => void;
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
 * 实例卡片组件 (InstanceCard)
 * 1. 扁平拟物材质与毛玻璃悬浮展开；
 * 2. 操作内联化：标题支持双击就地内联编辑（双击直接改名，Enter 保存，Esc 取消）；
 * 3. 0 聚焦自发光与 0 绿字。
 */
export const InstanceCard: React.FC<InstanceCardProps> = ({
  instance,
  index,
  isLight,
  hoveredCard,
  setHoveredCard,
  activeCardMenu,
  launchingId,
  onLaunch,
  onOpenMenu,
  onRenameSave,
  isExternallyRenaming = false,
  onClearExternalRenaming,
}) => {
  const [isEditingInline, setIsEditingInline] = useState(false);
  const [editName, setEditName] = useState(instance.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isExternallyRenaming) {
      setIsEditingInline(true);
      setEditName(instance.subtitle || instance.name);
      onClearExternalRenaming?.();
    }
  }, [isExternallyRenaming, instance.name, instance.subtitle, onClearExternalRenaming]);

  useEffect(() => {
    if (isEditingInline) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingInline]);

  const handleSave = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== (instance.subtitle || instance.name)) {
      onRenameSave(instance.id, trimmed);
    }
    setIsEditingInline(false);
  };

  const handleCancel = () => {
    setEditName(instance.subtitle || instance.name);
    setIsEditingInline(false);
  };

  const isExpanded = hoveredCard === instance.id;
  const isMenuOpen = activeCardMenu === instance.id;

  return (
    <div
      data-card-index={String(index + 1)}
      className={cn(
        "motion-instance-card flex-shrink-0 w-60 h-[320px] rounded-[18px] snap-center relative group border",
        isExpanded && "is-expanded",
        isLight
          ? cn(
              "border-black/[0.08]",
              isExpanded && "border-black/15 z-20",
              isMenuOpen && "border-black/25 ring-1 ring-black/10 z-30"
            )
          : cn(
              "border-white/[0.06]",
              isExpanded && "border-white/15 z-20",
              isMenuOpen && "border-white/25 ring-1 ring-white/10 z-30"
            )
      )}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("button")) return;
        setHoveredCard(isExpanded ? null : instance.id);
      }}
    >
      {/* 封面与遮罩 */}
      <div className="absolute inset-0 rounded-[18px] overflow-hidden">
        <img
          src={instance.cover || "./tavern-logo.png"}
          alt=""
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div
          className="absolute inset-0"
          style={{
            background: isLight
              ? "linear-gradient(135deg, oklch(1 0 0 / 0.40) 0%, oklch(1 0 0 / 0.25) 100%)"
              : "oklch(0 0 0 / 0.5)",
          }}
        />
      </div>

      <div
        className={cn(
          "absolute inset-0 rounded-[18px] transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          isLight
            ? "bg-gradient-to-t from-white/70 via-white/35 to-white/5"
            : "bg-gradient-to-t from-black/75 via-black/40 to-black/10",
          isExpanded ? "opacity-0" : "opacity-100"
        )}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-[18px] bg-gradient-to-t from-black/80 via-black/50 to-black/20 transition-opacity duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          isExpanded ? "opacity-100" : "opacity-0"
        )}
      />

      <div className="relative h-full flex flex-col p-3.5 overflow-hidden rounded-[18px]">
        {/* 版本胶囊 */}
        <span
          className={cn(
            "self-start px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border w-fit",
            isLight
              ? "bg-black/[0.06] text-[#1a1625]/55 border-black/[0.08]"
              : "bg-white/[0.08] text-white/50 border-white/[0.08]"
          )}
        >
          {instance.version || "—"}
        </span>

        <div className="flex-1" />

        {/* 标题（支持双击就地内联编辑） */}
        {isEditingInline ? (
          <div className="mb-2" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
              className={cn(
                "w-full h-7 px-2 rounded-lg border text-sm font-medium leading-snug transition-colors outline-none",
                isLight
                  ? "bg-white/90 border-black/20 text-[#1a1625]"
                  : "bg-black/80 border-white/25 text-white"
              )}
            />
          </div>
        ) : (
          <div
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditingInline(true);
              setEditName(instance.subtitle || instance.name);
            }}
            title="双击直接内联重命名"
            className={cn(
              "text-sm font-medium leading-snug mb-2 flex items-center justify-between group/title",
              isLight ? "text-[#1a1625]/75" : "text-white/80"
            )}
          >
            <span className="truncate">{instance.subtitle || instance.name}</span>
            <Edit2 className="w-3 h-3 opacity-0 group-hover/title:opacity-40 transition-opacity flex-shrink-0 ml-1" />
          </div>
        )}

        {/* 类型与状态指示 */}
        <div className="flex items-center justify-between mt-1.5">
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
                instance.type === "local"
                  ? isLight
                    ? "text-[#1a1625]/60"
                    : "text-white/60"
                  : instance.status === "online"
                  ? isLight
                    ? "text-[#1a1625]/60"
                    : "text-white/60"
                  : "text-red-400/55"
              )}
            >
              {instance.type === "local"
                ? "本地"
                : getStatusText(instance.status)}
            </span>
          </div>
        </div>

        {/* 鼠标悬浮展开的详情抽屉 */}
        <div
          className={cn("motion-accordion", isExpanded && "is-open")}
          aria-hidden={!isExpanded}
        >
          <div className="motion-accordion-inner">
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
                    "motion-control h-7 px-4 rounded-full text-[11px] font-semibold flex items-center justify-center gap-1 disabled:opacity-50",
                    isLight
                      ? "bg-black/[0.07] text-[#1a1625] hover:bg-black/[0.14]"
                      : "bg-white/15 text-white hover:bg-white/25"
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
                    "motion-control w-7 h-7 rounded-full flex items-center justify-center",
                    isLight
                      ? "bg-black/[0.07] hover:bg-black/[0.14]"
                      : "bg-white/15 hover:bg-white/25"
                  )}
                >
                  <MoreVertical
                    className={cn(
                      "w-3 h-3",
                      isLight ? "text-[#1a1625]" : "text-white"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
