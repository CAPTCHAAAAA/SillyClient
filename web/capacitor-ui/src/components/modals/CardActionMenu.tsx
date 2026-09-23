import React from "react";
import { createPortal } from "react-dom";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import type { TavernInstance } from "../../types";

export interface CardActionMenuProps {
  instance: TavernInstance;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  menuPos: { top: number; left: number };
  onManage: (instance: TavernInstance) => void;
  onRename: (instance: TavernInstance) => void;
  onPickCover: (instance: TavernInstance) => void;
  onDelete: (instance: TavernInstance) => void;
}

/**
 * 实例卡片操作悬浮菜单 (CardActionMenu)
 * 支持返回酒馆、停止、管理、双击/点击内联重命名、更换插图与删除。
 */
export const CardActionMenu: React.FC<CardActionMenuProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  menuPos,
  onManage,
  onRename,
  onPickCover,
  onDelete,
}) => {
  if (!isOpen && !isClosing) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/15 backdrop-blur-[2px] overlay-backdrop",
          isClosing && "overlay-backdrop-exit"
        )}
        style={{ zIndex: LAYERS.POPOVER_MENU - 1 }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        className={cn(
          "ios-floating-menu instance-card-menu motion-menu-list fixed w-44 py-1 px-1 rounded-2xl overflow-hidden backdrop-blur-[40px] saturate-180",
          isLight && "is-light",
          isClosing ? "animate-popover-exit" : "animate-popover"
        )}
        style={{
          zIndex: LAYERS.POPOVER_MENU,
          top: Math.max(Math.min(menuPos.top, window.innerHeight - 240), 16),
          left: Math.max(Math.min(menuPos.left + 8, window.innerWidth - 192), 16),
          transform: "translateY(-50%)",
        }}
      >
        {instance.status === "running" && instance.type === "local" && (
          <>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                onClose();
                try {
                  await TarvenEnv.returnToTavern();
                } catch (err) {
                  console.error("[returnToTavern]", err);
                }
              }}
              className={cn(
                "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
                isLight
                  ? "text-[#1a1625]/50 hover:text-[#1a1625]/80"
                  : "text-white/50 hover:text-white/80"
              )}
            >
              返回酒馆
            </button>
            <button
              onClick={async (e) => {
                e.stopPropagation();
                onClose();
                try {
                  await TarvenEnv.closeTavern();
                } catch (err) {
                  console.error("[closeTavern]", err);
                }
              }}
              className={cn(
                "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
                isLight
                  ? "text-red-900/40 hover:text-red-900/70"
                  : "text-red-400/40 hover:text-red-400/70"
              )}
            >
              停止实例
            </button>
            <div className="h-1.5" />
          </>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onManage(instance);
          }}
          className={cn(
            "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
            isLight
              ? "text-[#1a1625]/50 hover:text-[#1a1625]/80"
              : "text-white/50 hover:text-white/80"
          )}
        >
          管理
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onRename(instance);
          }}
          className={cn(
            "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
            isLight
              ? "text-[#1a1625]/50 hover:text-[#1a1625]/80"
              : "text-white/50 hover:text-white/80"
          )}
        >
          重命名
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onPickCover(instance);
          }}
          className={cn(
            "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
            isLight
              ? "text-[#1a1625]/50 hover:text-[#1a1625]/80"
              : "text-white/50 hover:text-white/80"
          )}
        >
          更换插图
        </button>
        <div className="h-1.5" />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            onDelete(instance);
          }}
          className={cn(
            "motion-menu-item w-full px-3 py-2.5 text-left text-sm transition-colors",
            isLight
              ? "text-red-900/50 hover:text-red-900/80"
              : "text-red-400/55 hover:text-red-300/90"
          )}
        >
          删除实例
        </button>
      </div>
    </>,
    document.body
  );
};
