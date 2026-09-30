import React from "react";
import { X, ArrowRight, Database, Zap, Sparkles } from "lucide-react";
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
 * 版本核心改进全屏虚化画布 (WhatsNewModal)
 * 1. 采用全屏柔焦毛玻璃 (backdrop-blur-[36px]) 将底座彻底虚化；
 * 2. 居中任务画布遵循 ios-task-surface 与轻拟物克制风格；
 * 3. 语言风格中立专业、解压客观，仅展示相较上个版本的实际新增与核心改进。
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
          width: "min(580px, calc(100vw - 2rem))",
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
                "px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border",
                isLight ? "bg-black/5 border-black/10 text-[#1a1625]/70" : "bg-white/10 border-white/15 text-white/80"
              )}
            >
              v2.0.0
            </span>
            <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>
              版本核心更新
            </span>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "p-1.5 rounded-full transition-colors",
              isLight
                ? "hover:bg-black/5 text-[#1a1625]/30 hover:text-[#1a1625]/60 active:scale-95"
                : "hover:bg-white/5 text-white/30 hover:text-white/60 active:scale-95"
            )}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 正文：3 大更新板块（客观专业、中立解压，无推销词汇） */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3.5 scrollbar-subtle">
          
          {/* 1. 数据迁移与原生导入 */}
          <div
            className={cn(
              "p-4 rounded-2xl border transition-colors",
              isLight ? "bg-black/[0.03] border-black/[0.06]" : "bg-white/[0.03] border-white/[0.06]"
            )}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center border",
                  isLight ? "bg-black/[0.05] border-black/[0.08] text-[#1a1625]" : "bg-white/[0.08] border-white/10 text-white"
                )}
              >
                <Database className="w-3.5 h-3.5" />
              </div>
              <span className={cn("text-xs font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>
                数据迁移与原生导入
              </span>
            </div>
            <div className="space-y-2 text-[12px] leading-relaxed">
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 复制迁移与原地接管：</span>
                支持完整复制旧版酒馆数据并在自定义路径下独立运行；或直接关联原目录原地接管零额外占用。移除实例时仅解除登记关联，绝不改动或删除用户原物理文件。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 私有凭据自主控制：</span>
                向导迁移时默认安全排除 secrets.json 密钥文件；用户可按需勾选保留随同导入。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 跨端原生文件读取支持：</span>
                新增原生读取接口，Android 端接入系统 SAF 存储框架，Windows 端接入原生系统文件对话框，解决部分 WebView 下备份导入无响应缺陷；增强 ZIP 离线包识别与后台解压。
              </div>
            </div>
          </div>

          {/* 2. Android 端性能与高刷重构 */}
          <div
            className={cn(
              "p-4 rounded-2xl border transition-colors",
              isLight ? "bg-black/[0.03] border-black/[0.06]" : "bg-white/[0.03] border-white/[0.06]"
            )}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center border",
                  isLight ? "bg-black/[0.05] border-black/[0.08] text-[#1a1625]" : "bg-white/[0.08] border-white/10 text-white"
                )}
              >
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className={cn("text-xs font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>
                Android 端性能与高刷重构
              </span>
            </div>
            <div className="space-y-2 text-[12px] leading-relaxed">
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 120Hz 硬件高刷锁定：</span>
                在 Android 12 及以上版本底层 WebView 句柄注入 setFrameRate 硬件锁定 120Hz，消除滑动释放后手势降频掉帧。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 减轻 GPU 显存与渲染负担：</span>
                拔除移动端多达 14 层的动态 backdrop-filter 遮罩与实时 SVG 噪点滤镜；滚动监听彻底消除强制同步重排，滑动交由硬件合成器处理。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 轻量变色龙与双 WebView 深度休眠：</span>
                顶部变色龙改为纯事件驱动轻量 DOM 探针，首帧秒级应用缓存色；酒馆前台运行时控制台 WebView 自动深度休眠，杜绝资源抢占。
              </div>
            </div>
          </div>

          {/* 3. 前端界面交互与动效 */}
          <div
            className={cn(
              "p-4 rounded-2xl border transition-colors",
              isLight ? "bg-black/[0.03] border-black/[0.06]" : "bg-white/[0.03] border-white/[0.06]"
            )}
          >
            <div className="flex items-center gap-2.5 mb-2.5">
              <div
                className={cn(
                  "w-6 h-6 rounded-lg flex items-center justify-center border",
                  isLight ? "bg-black/[0.05] border-black/[0.08] text-[#1a1625]" : "bg-white/[0.08] border-white/10 text-white"
                )}
              >
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className={cn("text-xs font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>
                前端界面交互与动效
              </span>
            </div>
            <div className="space-y-2 text-[12px] leading-relaxed">
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 极简红色感叹号折叠交互：</span>
                向导接入方式、私有凭据说明与数据检测卡片统一采用红色感叹号展开模式（InfoBadgeButton + motion-accordion），默认保持克制表单，按需平滑展开详细说明。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 平滑同位驻留与高度变形：</span>
                向导子模式（复制迁移 / 原地接管）切换引入同位驻留 DOM 与平滑自适应物理高度变形；实例卡片停止与运行态彻底解耦为同位驻留，杜绝抖动。
              </div>
              <div className={cn(isLight ? "text-[#1a1625]/75" : "text-white/75")}>
                <span className={cn("font-medium", isLight ? "text-[#1a1625]" : "text-white")}>• 物理弹簧指示器：</span>
                轮播指示器移除外层生硬边框，升级为小圆点配合物理弹簧滑块，支持触控滑动与键盘无缝导航。
              </div>
            </div>
          </div>

        </div>

        {/* 底部操作区 */}
        <div
          className={cn(
            "flex items-center justify-between px-6 py-3.5 flex-shrink-0 border-t",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <span className={cn("text-[11px]", isLight ? "text-[#1a1625]/40" : "text-white/40")}>
            可在「APP 设置 - 维护」中再次查看
          </span>
          <button
            onClick={onClose}
            className={cn(
              "motion-control h-8 px-4 rounded-full text-xs font-medium border flex items-center gap-1.5 transition-all",
              isLight
                ? "bg-black/[0.08] hover:bg-black/[0.12] border-black/10 text-[#1a1625] active:scale-95"
                : "bg-white/10 hover:bg-white/15 border-white/15 text-white active:scale-95"
            )}
          >
            <span>开始使用</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
};
