import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import {
  X,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { TarvenEnv } from "../../capacitor-plugin";
import type { TavernInstance } from "../../types";


export interface RelocateInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  onRelocated?: (instanceId: string, newPath: string) => void;
}

/**
 * 单实例存储路径无损重定位弹窗 (RelocateInstanceModal)
 * 1. 采用阻断级 Z-Index (LAYERS.DIALOG_SURFACE 与 LAYERS.DIALOG_BACKDROP)；
 * 2. 具有物理弹性入场与离场动画 (.animate-modal-dialog)；
 * 3. 默认目录与自定义目录通过 motion-panel-stack / motion-panel-face 实现平滑高度跟随与交叉溶变；
 * 4. 彻底去除冗余方框嵌套与对勾图标，控件字体与交互行为 100% 对齐向导；
 * 5. 底部保留关于受管实例直接无损迁移的设计哲学说明。
 */
export const RelocateInstanceModal: React.FC<RelocateInstanceModalProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  onRelocated,
}) => {
  const [targetMode, setTargetMode] = useState<"default" | "custom">("default");
  const [customPath, setCustomPath] = useState("");
  const [currentRealPath, setCurrentRealPath] = useState<string>("");
  const [migrating, setMigrating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ newPath: string } | null>(null);

  const panelContainerRef = useRef<HTMLDivElement>(null);
  const defaultFaceRef = useRef<HTMLDivElement>(null);
  const customFaceRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState<number | null>(null);

  // 平滑自适应高度测量与交叉溶变过渡
  useLayoutEffect(() => {
    if (!isOpen) return;
    const targetEl = targetMode === "default" ? defaultFaceRef.current : customFaceRef.current;
    if (!targetEl) return;

    const measureHeight = (entry?: ResizeObserverEntry) => {
      const h = entry?.borderBoxSize?.[0]?.blockSize ?? targetEl.offsetHeight;
      if (h > 0) {
        setPanelHeight(Math.ceil(h));
      }
    };

    measureHeight();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(([entry]) => {
        measureHeight(entry);
      });
      ro.observe(targetEl);
      return () => ro.disconnect();
    }
  }, [targetMode, isOpen, customPath]);

  const handleSwitchMode = (mode: "default" | "custom") => {
    if (mode === targetMode) return;
    if (panelContainerRef.current) {
      setPanelHeight(panelContainerRef.current.offsetHeight);
    }
    setTargetMode(mode);
  };

  useEffect(() => {
    if (!isOpen || !instance) {
      setErrorMsg(null);
      setSuccessInfo(null);
      setMigrating(false);
      setTargetMode("default");
      setCustomPath("");
      return;
    }

    // 获取当前实例的真实物理路径
    const safeId = instance.installDir || instance.id;
    TarvenEnv.getInstanceInfo({
      instanceId: safeId,
      installPath: instance.installPath,
      port: instance.port ?? 8000,
    })
      .then((info) => {
        if (info.path) setCurrentRealPath(info.path);
        else setCurrentRealPath(instance.installPath || "—");
      })
      .catch(() => {
        setCurrentRealPath(instance.installPath || "—");
      });
  }, [isOpen, instance]);

  if (!isOpen && !isClosing) return null;
  if (!instance) return null;

  const isRunning = instance.status === "running";

  const handlePickDirectory = async () => {
    try {
      const res = await (TarvenEnv as any).pickDirectory({
        title: "选择实例迁移的目标目录",
      });
      if (res?.path) {
        setCustomPath(res.path.replace(/^["']|["']$/g, "").trim());
      }
    } catch {
      /* ignore */
    }
  };

  const handleExecuteRelocate = async () => {
    if (isRunning || migrating) return;
    setErrorMsg(null);
    setMigrating(true);

    try {
      const safeId = instance.installDir || instance.id;
      const target = targetMode === "custom" ? customPath.trim() : undefined;

      if (targetMode === "custom" && !target) {
        throw new Error("请先选择或输入自定义目标目录");
      }

      const res = await TarvenEnv.relocateInstance({
        instanceId: safeId,
        targetPath: target,
      });

      if (res.success) {
        setSuccessInfo({ newPath: res.newPath });
        onRelocated?.(instance.id, res.newPath);
      } else {
        throw new Error("迁移未成功完成");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "迁移失败，请检查路径权限后重试");
    } finally {
      setMigrating(false);
    }
  };

  return (
    <>
      <LayerBackdrop
        isOpen={isOpen}
        isClosing={isClosing}
        onClick={migrating ? undefined : onClose}
        zIndex={LAYERS.DIALOG_BACKDROP}
        blur={true}
        className={cn(
          "transition-all duration-300",
          isLight ? "bg-black/25 backdrop-blur-[12px]" : "bg-black/55 backdrop-blur-[12px]"
        )}
      />

      <div
        className={cn(
          "ios-task-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-modal-dialog-exit" : "animate-modal-dialog"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(460px, calc(100vw - 2rem))",
          maxHeight: "min(85vh, calc(100vh - 4rem))",
        }}
      >
        {/* 顶部标题栏 */}
        <div
          className={cn(
            "flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <span className={cn("text-sm font-semibold", isLight ? "text-[#1a1625]" : "text-white")}>
            迁移实例存储目录
          </span>
          {!migrating && (
            <button
              onClick={onClose}
              className={cn(
                "p-1.5 rounded-lg transition-colors",
                isLight
                  ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                  : "text-white/40 hover:text-white/85"
              )}
              aria-label="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 正文区域 */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hidden text-xs">
          {/* 当前实例信息 (扁平无多重框) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span className={cn("font-medium text-xs truncate", isLight ? "text-[#1a1625]" : "text-white")}>
                {instance.subtitle || instance.name}
              </span>
              <span
                className={cn(
                  "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border flex-shrink-0",
                  isLight
                    ? "bg-black/[0.06] text-[#1a1625]/55 border-black/[0.08]"
                    : "bg-white/[0.08] text-white/50 border-white/[0.08]"
                )}
              >
                {formatDisplayVersion(instance.version)}
              </span>
            </div>
            <div className="text-[11px] font-mono break-all opacity-45 leading-relaxed">
              当前路径: {currentRealPath || "读取中..."}
            </div>
          </div>

          {/* 运行状态警告 */}
          {isRunning && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>当前实例正在运行，请先在控制台停止后再执行迁移。</span>
            </div>
          )}

          {/* 成功状态 */}
          {successInfo ? (
            <div className="space-y-2 py-1">
              <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]" : "text-white")}>
                实例数据无损迁移完成
              </div>
              <div
                className={cn(
                  "text-[11px] font-mono break-all p-3 rounded-xl border leading-relaxed",
                  isLight ? "bg-black/[0.02] border-black/[0.06]" : "bg-white/[0.03] border-white/[0.06]"
                )}
              >
                {successInfo.newPath}
              </div>
              <p className="text-[11px] opacity-50 leading-relaxed">
                底层注册表与配置已一键同步，该实例已就绪，可随时直接启动运行。
              </p>
            </div>
          ) : (
            <>
              {/* 目标位置分段切换器 (完全对齐向导模式切换器) */}
              <div className="space-y-1.5">
                <label className={cn("text-xs font-medium block", isLight ? "text-[#1a1625]/70" : "text-white/70")}>
                  目标位置
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("default")}
                    className={cn(
                      "ios-choice-control py-2 rounded-xl text-xs font-medium transition-all border",
                      targetMode === "default"
                        ? isLight
                          ? "bg-black/[0.08] border-black/15 text-[#1a1625] shadow-sm"
                          : "bg-white/[0.10] border-white/20 text-white shadow-sm"
                        : isLight
                        ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:text-[#1a1625]/75"
                        : "bg-transparent border-white/[0.06] text-white/35 hover:text-white/75"
                    )}
                  >
                    默认目录 (instances/)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchMode("custom")}
                    className={cn(
                      "ios-choice-control py-2 rounded-xl text-xs font-medium transition-all border",
                      targetMode === "custom"
                        ? isLight
                          ? "bg-black/[0.08] border-black/15 text-[#1a1625] shadow-sm"
                          : "bg-white/[0.10] border-white/20 text-white shadow-sm"
                        : isLight
                        ? "bg-transparent border-black/[0.06] text-[#1a1625]/35 hover:text-[#1a1625]/75"
                        : "bg-transparent border-white/[0.06] text-white/35 hover:text-white/75"
                    )}
                  >
                    自定义目录
                  </button>
                </div>
              </div>

              {/* 模式配置切换容器 (平滑高度自适应 + 500ms 交叉溶变过渡) */}
              <div
                ref={panelContainerRef}
                className="motion-panel-stack"
                style={{ height: panelHeight ? `${panelHeight}px` : undefined }}
              >
                {/* 默认目录说明 */}
                <div
                  ref={defaultFaceRef}
                  className={cn(
                    "motion-panel-face w-full space-y-1.5",
                    targetMode === "default"
                      ? "is-active relative pointer-events-auto"
                      : "absolute inset-x-0 top-0 pointer-events-none select-none"
                  )}
                  aria-hidden={targetMode !== "default"}
                  inert={targetMode !== "default"}
                >
                  <p className={cn("text-xs leading-relaxed opacity-60", isLight ? "text-[#1a1625]" : "text-white")}>
                    将实例完整搬迁至客户端根目录下的 <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[11px]">instances/</code> 文件夹，消除 C 盘 AppData 碎片，便携性高且便于全量打包备份。
                  </p>
                </div>

                {/* 自定义目录表单 */}
                <div
                  ref={customFaceRef}
                  className={cn(
                    "motion-panel-face w-full space-y-1.5",
                    targetMode === "custom"
                      ? "is-active relative pointer-events-auto"
                      : "absolute inset-x-0 top-0 pointer-events-none select-none"
                  )}
                  aria-hidden={targetMode !== "custom"}
                  inert={targetMode !== "custom"}
                >
                  <div className="flex items-center gap-2 w-full">
                    <input
                      type="text"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      placeholder="选择或输入完整目标目录绝对路径"
                      className={cn(
                        "ios-field-control motion-control flex-1 min-w-0 h-9 px-3 rounded-xl border text-xs transition-colors",
                        isLight
                          ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-black/30 focus:border-black/20"
                          : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/30 focus:border-white/20"
                      )}
                    />
                    <button
                      type="button"
                      onClick={handlePickDirectory}
                      className={cn(
                        "motion-control h-9 px-3 rounded-xl text-[11px] font-medium border flex-shrink-0 transition-colors",
                        isLight
                          ? "border-black/[0.08] text-[#1a1625]/50 hover:text-[#1a1625]/85"
                          : "border-white/[0.08] text-white/50 hover:text-white/85"
                      )}
                    >
                      浏览
                    </button>
                  </div>
                  <p className={cn("text-[11px] opacity-45 leading-relaxed", isLight ? "text-[#1a1625]" : "text-white")}>
                    支持任意磁盘或分区路径。跨盘迁移时将执行安全校验并自动清理原位置。
                  </p>
                </div>
              </div>

              {/* 异常提示 */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* 底部小字解释说明（产品设计哲学说明，仅保留 information 图标） */}
              <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed opacity-55">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>
                  向导中的“导入旧酒馆”流程因涉及外部未知数据，需留存充分的备份与补救余地；而对于当前软件已接管或创建的实例，数据与依赖均处于受管状态，支持一键直接原子搬迁并自动重定向注册表与配置，一步到位无损继续运行。
                </p>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div
          className={cn(
            "px-5 py-4 flex-shrink-0 border-t flex items-center justify-end gap-2.5",
            isLight ? "border-black/[0.06] bg-black/[0.01]" : "border-white/[0.06] bg-white/[0.01]"
          )}
        >
          {successInfo ? (
            <button
              onClick={onClose}
              className={cn(
                "motion-control px-5 h-8 rounded-full text-xs font-medium transition-colors border",
                isLight
                  ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625]"
                  : "bg-white/20 border-white/15 text-white/70 hover:text-white"
              )}
            >
              完成
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={migrating}
                onClick={onClose}
                className={cn(
                  "motion-control px-4 h-8 rounded-full text-xs font-medium transition-colors border disabled:opacity-40",
                  isLight
                    ? "bg-transparent border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                    : "bg-transparent border-white/[0.08] text-white/60 hover:text-white"
                )}
              >
                取消
              </button>
              <button
                type="button"
                disabled={isRunning || migrating || (targetMode === "custom" && !customPath.trim())}
                onClick={handleExecuteRelocate}
                className={cn(
                  "motion-control px-5 h-8 rounded-full text-xs font-medium flex items-center justify-center gap-1.5 transition-colors border disabled:opacity-40",
                  isLight
                    ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625] active:bg-black/[0.18]"
                    : "bg-white/20 border-white/15 text-white/70 hover:text-white active:bg-white/35"
                )}
              >
                {migrating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    正在搬迁与更新注册表...
                  </>
                ) : (
                  "开始无损迁移"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
