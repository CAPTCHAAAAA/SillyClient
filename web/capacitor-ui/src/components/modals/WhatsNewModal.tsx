import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { APP_VERSION } from "../../constants/app-version";

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
              v{APP_VERSION}
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
                ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                : "text-white/40 hover:text-white/85"
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
                拖拽：保留流光，收好边缘
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                01
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              长按拖动时，模糊卡片继续跟随底层背景变化，不再透出旁边的卡片；修正边缘细亮线，保留原有抬起与归位动画，运行中的终端卡片不参与拖拽排序。
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
                终端：统一材质，专注阅读
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                02
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              终端沿用设置与实例菜单的玻璃外壳，代码区域统一为深色。标题栏、字号控件和命令输入重新对齐，保留窗口拖动与右下角缩放手柄。
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
                细节：隐藏滚动条，淡化标签
              </span>
              <span className={cn("text-[10px] font-mono", isLight ? "text-[#1a1625]/35" : "text-white/30")}>
                03
              </span>
            </div>
            <div className={cn("text-[11.5px] leading-relaxed", isLight ? "text-[#1a1625]/65" : "text-white/65")}>
              启动日志、维护页及其他滚动区域隐藏滚动条，内容仍可正常滚动，不再因滚动条挤压布局。版本标签只去掉细边线，保持原有位置、尺寸与配色。
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
              "flat-capsule motion-control h-8 px-5 rounded-full text-xs font-medium border-0",
              isLight
                ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                : "text-white/60 hover:text-white"
            )}
          >
            开始使用
          </button>
        </div>
      </div>
    </>
  );
};
