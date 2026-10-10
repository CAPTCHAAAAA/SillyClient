import React, { useState } from "react";
import { X, AlertCircle, Loader2, Info } from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { TarvenEnv } from "../../capacitor-plugin";

export interface LegacyMigrationItem {
  instanceId: string;
  name: string;
  currentPath: string;
  targetPath: string;
  version?: string;
}

export interface LegacyMigrationModalProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  legacyInstances: LegacyMigrationItem[];
  onMigrationComplete?: () => void;
}

/**
 * 新版本旧路径实例全屏一键迁移向导 (LegacyMigrationModal)
 * 1. 采用阻断级 Z-Index 与物理弹簧入场动画 (.animate-modal-dialog)；
 * 2. 拔除全部多重嵌套卡片方框与对勾图标，控件与字阶 100% 对齐向导；
 * 3. 仅保留用于产品设计哲学说明的单 Info 图标；
 * 4. 完美支持无旧实例时的优雅空状态展示，便于审查走查。
 */
export const LegacyMigrationModal: React.FC<LegacyMigrationModalProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  legacyInstances = [],
  onMigrationComplete,
}) => {
  const [migrating, setMigrating] = useState(false);
  const [currentMigratingId, setCurrentMigratingId] = useState<string | null>(null);
  const [completedIds, setCompletedIds] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAllDone, setIsAllDone] = useState(false);

  if (!isOpen && !isClosing) return null;

  const handleStartMigration = async () => {
    if (migrating || legacyInstances.length === 0) return;
    setMigrating(true);
    setErrorMsg(null);

    const successful: string[] = [];
    try {
      for (const item of legacyInstances) {
        setCurrentMigratingId(item.instanceId);
        const res = await TarvenEnv.relocateInstance({
          instanceId: item.instanceId,
          targetPath: item.targetPath,
        });
        if (res.success) {
          successful.push(item.instanceId);
          setCompletedIds([...successful]);
        }
      }
      setIsAllDone(true);
      onMigrationComplete?.();
    } catch (err: any) {
      setErrorMsg(err?.message || "迁移过程中发生异常，未完成项保留原状");
    } finally {
      setMigrating(false);
      setCurrentMigratingId(null);
    }
  };

  return (
    <>
      {/* 阻断级虚化遮罩 */}
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

      {/* 居中任务画布 */}
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
          width: "min(480px, calc(100vw - 2rem))",
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
            旧版实例存储迁移
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
          {/* 实例列表或空状态 (完全平铺，无嵌套厚边框卡片) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/70" : "text-white/70")}>
                待迁移实例 ({legacyInstances.length})
              </label>
            </div>

            {legacyInstances.length === 0 ? (
              <div className="py-7 text-center space-y-1.5">
                <div className={cn("text-xs font-medium", isLight ? "text-[#1a1625]/70" : "text-white/70")}>
                  未检测到需要迁移的旧版实例
                </div>
                <p className={cn("text-[11px] opacity-45 max-w-xs mx-auto leading-relaxed", isLight ? "text-[#1a1625]" : "text-white")}>
                  当前所有受管实例均已处于统一规范目录结构下，无需执行额外迁移。
                </p>
              </div>
            ) : (
              <div className="divide-y divide-black/[0.05] dark:divide-white/[0.05]">
                {legacyInstances.map((item) => {
                  const isCompleted = completedIds.includes(item.instanceId);
                  const isCurrent = currentMigratingId === item.instanceId;

                  return (
                    <div
                      key={item.instanceId}
                      className="py-2.5 space-y-1 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <span className={cn("font-medium text-xs truncate", isLight ? "text-[#1a1625]" : "text-white")}>
                            {item.name}
                          </span>
                          {item.version && (
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border flex-shrink-0",
                                isLight
                                  ? "bg-black/[0.06] text-[#1a1625]/55 border-black/[0.08]"
                                  : "bg-white/[0.08] text-white/50 border-white/[0.08]"
                              )}
                            >
                              {formatDisplayVersion(item.version)}
                            </span>
                          )}
                        </div>

                        {/* 状态徽标 (无对勾图标) */}
                        {isCompleted ? (
                          <span className="text-[11px] text-emerald-500 font-medium flex-shrink-0">
                            已就绪
                          </span>
                        ) : isCurrent ? (
                          <span className="text-[11px] text-amber-500 font-medium flex-shrink-0 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            迁移中
                          </span>
                        ) : (
                          <span className={cn("text-[11px] flex-shrink-0 opacity-40", isLight ? "text-[#1a1625]" : "text-white")}>
                            待迁移
                          </span>
                        )}
                      </div>

                      {/* 路径变化 */}
                      <div className="flex items-center gap-1.5 font-mono text-[10.5px] truncate opacity-50">
                        <span className="truncate max-w-[45%]" title={item.currentPath}>
                          {item.currentPath}
                        </span>
                        <span className="opacity-40">→</span>
                        <span className="truncate max-w-[45%]" title={item.targetPath}>
                          {item.targetPath}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 异常提示 */}
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* 底部小字解释说明（仅保留单一 information 图标） */}
          <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed opacity-55">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <p>
              新版本实例统一归集至客户端根目录下的 <code className="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-[10.5px]">instances/</code> 文件夹，消除 C 盘 AppData 空间碎片并支持便携备份。受管实例在迁移过程中将自动同步底层注册表与配置，一步到位无损继续运行。
            </p>
          </div>
        </div>

        {/* 底部按钮栏 */}
        <div
          className={cn(
            "px-5 py-4 flex-shrink-0 border-t flex items-center justify-end gap-2.5",
            isLight ? "border-black/[0.06] bg-black/[0.01]" : "border-white/[0.06] bg-white/[0.01]"
          )}
        >
          {isAllDone || legacyInstances.length === 0 ? (
            <button
              onClick={onClose}
              className={cn(
                "motion-control px-5 h-8 rounded-full text-xs font-medium transition-colors border",
                isLight
                  ? "bg-black/[0.08] border-black/[0.10] text-[#1a1625]/70 hover:text-[#1a1625]"
                  : "bg-white/20 border-white/15 text-white/70 hover:text-white"
              )}
            >
              进入控制台
            </button>
          ) : (
            <>
              {!migrating && (
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "motion-control px-4 h-8 rounded-full text-xs font-medium transition-colors border disabled:opacity-40",
                    isLight
                      ? "bg-transparent border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                      : "bg-transparent border-white/[0.08] text-white/60 hover:text-white"
                  )}
                >
                  稍后处理
                </button>
              )}
              <button
                type="button"
                disabled={migrating}
                onClick={handleStartMigration}
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
                    正在搬迁数据与更新注册表...
                  </>
                ) : (
                  "开始一键迁移"
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};
