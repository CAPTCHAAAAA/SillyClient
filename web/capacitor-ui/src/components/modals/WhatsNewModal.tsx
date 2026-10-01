import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";

export interface WhatsNewModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
}

/**
 * 版本核心更新全屏虚化画布 (WhatsNewModal)
 * 纯正轻拟物扁平 + 微边框 + 低亮度中等透明度设计，杜绝冗余图标与花哨修饰。
 */
export const WhatsNewModal: React.FC<WhatsNewModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
}) => {
  if (!isOpen && !isClosing) return null;

  return (
    <>
      {/* 全屏虚化遮罩 */}
      <LayerBackdrop
        isOpen={isOpen}
        isClosing={isClosing}
        onClick={onClose}
        zIndex={LAYERS.MODAL_BACKDROP}
        blur={false}
        className={cn(
          "transition-all duration-300",
          isLight ? "bg-black/25 backdrop-blur-[36px]" : "bg-black/60 backdrop-blur-[36px]"
        )}
      />

      {/* 居中任务画布 */}
      <div
        className={cn(
          "ios-task-surface fixed rounded-3xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-clone-panel-exit" : "animate-clone-panel"
        )}
        style={{
          zIndex: LAYERS.MODAL_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(560px, calc(100vw - 2rem))",
          maxHeight: "min(84vh, calc(100vh - 3.5rem))",
        }}
      >
        {/* 顶部标题栏 */}
        <div
          className={cn(
            "flex items-center justify-between px-6 h-14 flex-shrink-0 border-b",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={cn(
                "px-2.5 py-1 rounded-xl text-[10px] font-mono font-medium uppercase border-0",
                isLight
                  ? "bg-black/[0.04] text-[#1a1625]/60"
                  : "bg-white/[0.06] text-white/60"
              )}
            >
              v2.0.1
            </span>
            <span className={cn("text-sm font-semibold tracking-tight", isLight ? "text-[#1a1625]" : "text-white")}>
              版本主要更新
            </span>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              isLight
                ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60"
                : "hover:bg-white/5 text-white/30 hover:text-white/60"
            )}
            aria-label="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 正文：轻微色差无边框区域（轻拟物轻盈色块，直达核心） */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 scrollbar-subtle">
          
          {/* 01 可以使用什么新功能 */}
          <div
            className={cn(
              "p-4 rounded-xl transition-colors",
              isLight ? "bg-black/[0.035]" : "bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-[13px] font-semibold tracking-tight", isLight ? "text-[#1a1625]/90" : "text-white/90")}>
                新功能：跨平台数据迁移与原地接管
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                01
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              支持直接导入已有酒馆数据。“原地接管”零额外占用存储，移除实例时仅解除登记、绝不误删原文件；也可按需选择“复制迁移”沙盒化运行。
            </div>
          </div>

          {/* 02 可以看到什么新更新 */}
          <div
            className={cn(
              "p-4 rounded-xl transition-colors",
              isLight ? "bg-black/[0.035]" : "bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-[13px] font-semibold tracking-tight", isLight ? "text-[#1a1625]/90" : "text-white/90")}>
                新更新：界面视觉升级与全域平滑过渡
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                02
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              设置抽屉与向导各级面板全面接入同位驻留模糊溶变过渡，容器高度自适应伸缩；向导机制说明升级为极简小红点折叠，界面更干净整洁。
            </div>
          </div>

          {/* 03 可以体验到什么新优化 */}
          <div
            className={cn(
              "p-4 rounded-xl transition-colors",
              isLight ? "bg-black/[0.035]" : "bg-white/[0.04]"
            )}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className={cn("text-[13px] font-semibold tracking-tight", isLight ? "text-[#1a1625]/90" : "text-white/90")}>
                新优化：120Hz 硬件高刷与底层渲染重构
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                03
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              Android 底层注入硬件 120Hz 锁帧，消除滑动降频；酒馆前台运行时控制台自动深度休眠，拔除 14 层动态模糊滤镜，更流畅、更省电。
            </div>
          </div>

        </div>

        {/* 底部操作区 */}
        <div
          className={cn(
            "flex items-center justify-between px-6 py-4 flex-shrink-0 border-t",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <span className={cn("text-[11px]", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
            可在「APP 设置 - 维护」中再次查看
          </span>
          <button
            onClick={onClose}
            className={cn(
              "motion-control h-8 px-5 rounded-xl text-xs font-medium border-0 transition-colors",
              isLight
                ? "bg-black/[0.06] hover:bg-black/[0.1] text-[#1a1625]/85"
                : "bg-white/[0.08] hover:bg-white/[0.12] text-white/90"
            )}
          >
            开始使用
          </button>
        </div>
      </div>
    </>
  );
};
