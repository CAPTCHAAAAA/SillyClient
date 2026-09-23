import React from "react";
import { Loader2, Maximize2, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";

interface ActivityCapsuleProps {
  instanceName: string;
  statusText: string;
  pct: number;
  hasError?: boolean;
  isComplete?: boolean;
  onExpand: () => void;
  isLight?: boolean;
  glassBg?: string;
}

/**
 * 底部后台启动常驻活动胶囊 (Activity Capsule)
 * 当用户将启动控制台“最小化”至后台时展示，不阻断前台对其他实例的操作，
 * 实时显示进度百分比与阶段，点击一键展开回全尺寸控制台。
 */
export const ActivityCapsule: React.FC<ActivityCapsuleProps> = ({
  instanceName,
  statusText,
  pct,
  hasError = false,
  isComplete = false,
  onExpand,
  isLight = false,
  glassBg = "bg-[#181524]/85",
}) => {
  return (
    <aside
      role="button"
      tabIndex={0}
      aria-label="后台启动任务状态"
      onClick={onExpand}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onExpand();
        }
      }}
      style={{ zIndex: LAYERS.ACTIVITY_CAPSULE }}
      className={cn(
        "fixed bottom-20 right-6 md:right-8 group cursor-pointer",
        "flex items-center gap-3 px-3.5 py-2.5 rounded-full border shadow-xl",
        "backdrop-blur-xl transition-all duration-300 select-none",
        "hover:scale-[1.02] active:scale-[0.98]",
        glassBg,
        isLight
          ? "border-black/[0.08] shadow-black/5 text-[#1a1625]"
          : "border-white/[0.12] shadow-black/40 text-[#f5f3ef]"
      )}
    >
      {/* 状态指示图标 */}
      <div className="flex-shrink-0 flex items-center justify-center">
        {hasError ? (
          <AlertCircle className="w-4 h-4 text-red-400" />
        ) : isComplete ? (
          <CheckCircle2 className="w-4 h-4 text-[#d0d0dc]" />
        ) : (
          <Loader2 className="w-4 h-4 animate-spin text-white/70" />
        )}
      </div>

      {/* 实例名称与状态文本 */}
      <div className="flex flex-col min-w-0 pr-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold truncate max-w-[130px]">
            {instanceName}
          </span>
          <span
            className={cn(
              "text-[10px] px-1.5 py-0.2 rounded-full font-mono",
              isLight ? "bg-black/[0.06] text-black/60" : "bg-white/[0.08] text-white/60"
            )}
          >
            {pct}%
          </span>
        </div>
        <span
          className={cn(
            "text-[10px] truncate max-w-[180px] leading-tight",
            isLight ? "text-black/50" : "text-white/45"
          )}
        >
          {statusText || "启动准备中..."}
        </span>
      </div>

      {/* 展开全屏提示图标 */}
      <div
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors",
          isLight
            ? "bg-black/[0.04] group-hover:bg-black/[0.08]"
            : "bg-white/[0.06] group-hover:bg-white/[0.12]"
        )}
      >
        <Maximize2 className="w-3 h-3 opacity-60 group-hover:opacity-100" />
      </div>
    </aside>
  );
};
