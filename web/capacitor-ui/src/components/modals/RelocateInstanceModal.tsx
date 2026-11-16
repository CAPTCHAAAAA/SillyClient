import React, { useState, useEffect, useRef } from "react";
import {
  X,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { cn, formatDisplayVersion } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import { ActionButton } from "../common/ActionButton";
import { ErrorReportAlert } from "../common/ErrorReportAlert";
import { TarvenEnv } from "../../capacitor-plugin";
import type { InstanceRelocationResult } from "../../capacitor-plugin";
import {
  installationSelection,
  relocationTargetInParent,
  shouldShowDirectoryPickerError,
  validateInstallPathInput,
} from "../../lib/install-location";
import { requireRelocationResult } from "../../lib/instance-location-state";
import {
  createDiagnosticContext,
  humanizeNativeError,
  type DiagnosticContext,
} from "../../lib/native-errors";
import type { TavernInstance } from "../../types";
import { reportGlobalError } from "../../lib/global-error-store";

export interface RelocateInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  isWindows?: boolean;
  isIOS?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onRelocated?: (previousId: string, result: InstanceRelocationResult) => void;
}

/**
 * 单实例存储路径无损重定位弹窗 (RelocateInstanceModal)
 * 1. 采用阻断级 Z-Index (LAYERS.DIALOG_SURFACE 与 LAYERS.DIALOG_BACKDROP)；
 * 2. 具有物理弹性入场与离场动画 (.animate-modal-dialog)；
 * 3. 目标目录只允许通过目录选择器或路径输入指定（零默认目录铁律）；
 * 4. 彻底去除冗余方框嵌套与对勾图标，控件字体与交互行为 100% 对齐向导；
 * 5. 发生原生或运行时异常时展示脱敏「上报问题」交互。
 */
export const RelocateInstanceModal: React.FC<RelocateInstanceModalProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  isWindows = false,
  isIOS = false,
  onBusyChange,
  onRelocated,
}) => {
  const [customPath, setCustomPath] = useState("");
  const [currentRealPath, setCurrentRealPath] = useState<string>("");
  const [migrating, setMigrating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorDiagnostic, setErrorDiagnostic] = useState<DiagnosticContext | null>(null);
  const [successInfo, setSuccessInfo] = useState<InstanceRelocationResult | null>(null);
  const sessionRef = useRef(0);
  const busyRef = useRef(false);

  const platformName = isWindows ? "windows" : isIOS ? "ios" : "android";

  useEffect(() => {
    const session = ++sessionRef.current;
    setCurrentRealPath(instance?.installPath || "");
    setErrorMsg(null);
    setErrorDiagnostic(null);
    setSuccessInfo(null);
    setCustomPath("");

    if (!isOpen || !instance) {
      setMigrating(false);
      return;
    }

    const safeId = instance.installDir || instance.id;
    TarvenEnv.getInstanceInfo({
      instanceId: safeId,
      installPath: instance.installPath,
      port: instance.port ?? 8000,
    })
      .then((info) => {
        if (sessionRef.current !== session) return;
        if (info.path) setCurrentRealPath(info.path);
        else setCurrentRealPath(instance.installPath || "—");
      })
      .catch(() => {
        if (sessionRef.current !== session) return;
        setCurrentRealPath(instance.installPath || "—");
      });

    return () => {
      sessionRef.current += 1;
    };
  }, [isOpen, instance?.id]);

  if (!isOpen && !isClosing) return null;
  if (!instance) return null;

  const isRunning = instance.status === "running";
  const secrets = [
    instance.subtitle,
    instance.name,
    instance.installPath,
    customPath,
    currentRealPath,
  ];

  const handlePickDirectory = async () => {
    if (busyRef.current || isClosing) return;
    const session = sessionRef.current;
    const startedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    try {
      const res = await TarvenEnv.pickDirectory({
        purpose: "installation",
      });
      if (session !== sessionRef.current || busyRef.current) return;
      const elapsedMs = Math.max(
        0,
        Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)
      );
      if (!res?.path?.trim()) {
        throw new Error(
          isIOS && elapsedMs < 800
            ? "PICKER_ABNORMAL_DISMISS: System picker dismissed without selection"
            : "No directory was selected"
        );
      }
      const selected = installationSelection(res);
      const nextTarget = relocationTargetInParent(
        selected.path,
        currentRealPath || instance.installPath || instance.installDir || instance.id
      );
      setCustomPath(nextTarget);
      setErrorMsg(null);
      setErrorDiagnostic(null);
    } catch (error) {
      const elapsedMs = Math.max(
        0,
        Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - startedAt)
      );
      if (session === sessionRef.current && shouldShowDirectoryPickerError(error, isIOS)) {
        const friendly = humanizeNativeError(error);
        const context = createDiagnosticContext(error, {
          area: "picker",
          platform: platformName,
          elapsedMs,
          userMessage: friendly,
          extraSecrets: secrets,
        });
        setErrorMsg(friendly);
        setErrorDiagnostic(context);
        reportGlobalError(error, {
          area: "picker",
          platform: platformName,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: secrets,
        });
      }
    }
  };

  const handleExecuteRelocate = async () => {
    if (isRunning || busyRef.current || isClosing) return;

    let cleanTarget: string;
    try {
      const rawTarget = customPath.replace(/^["']|["']$/g, "").trim();
      if (!rawTarget) {
        setErrorMsg("请先选择或输入目标目录");
        setErrorDiagnostic(null);
        return;
      }
      const pathIssue = validateInstallPathInput(rawTarget, { isIOS });
      if (pathIssue) {
        setErrorMsg(pathIssue);
        setErrorDiagnostic(null);
        return;
      }
      cleanTarget = rawTarget;
    } catch {
      setErrorMsg("目标路径格式无效，请重新选择");
      setErrorDiagnostic(null);
      return;
    }

    const session = ++sessionRef.current;
    busyRef.current = true;
    onBusyChange?.(true);
    setErrorMsg(null);
    setErrorDiagnostic(null);
    setMigrating(true);

    try {
      const safeId = instance.installDir || instance.id;
      const res = await TarvenEnv.relocateInstance({
        instanceId: safeId,
        targetPath: cleanTarget,
        installPath: instance.installPath,
      });
      requireRelocationResult(res);
      onRelocated?.(instance.id, res);
      if (session === sessionRef.current) {
        setSuccessInfo(res);
        setCurrentRealPath(res.newPath);
      }
    } catch (err) {
      if (session === sessionRef.current) {
        const friendly = humanizeNativeError(err);
        const context = createDiagnosticContext(err, {
          area: "relocate",
          platform: platformName,
          userMessage: friendly,
          extraSecrets: secrets,
        });
        setErrorMsg(friendly);
        setErrorDiagnostic(context);
        reportGlobalError(err, {
          area: "relocate",
          platform: platformName,
          userMessage: friendly,
          diagnostic: context,
          extraSecrets: secrets,
        });
      }
    } finally {
      busyRef.current = false;
      onBusyChange?.(false);
      if (session === sessionRef.current) {
        setMigrating(false);
      }
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
        style={{ "--overlay-blur": "12px" } as React.CSSProperties}
        className={isLight ? "bg-black/25 backdrop-blur-[12px]" : "bg-black/55 backdrop-blur-[12px]"}
      />

      <div
        className={cn(
          "ios-task-surface reading-flat-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180",
          glassBg,
          isLight && "is-light",
          isClosing ? "animate-modal-dialog-exit" : "animate-modal-dialog"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(460px, calc(var(--ui-vw, 100vw) - 2rem))",
          maxHeight: "min(calc(var(--ui-vh, 100vh) * 0.85), calc(var(--ui-vh, 100vh) - 4rem))",
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
                  "px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide flex-shrink-0",
                  isLight
                    ? "bg-black/[0.045] text-[#1a1625]/55"
                    : "bg-white/[0.07] text-white/50"
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
            <div
              className={cn(
                "p-3 rounded-xl text-xs flex items-center gap-2",
                isLight
                  ? "bg-amber-900/[0.05] text-amber-900/70"
                  : "bg-amber-300/[0.08] text-amber-200/75"
              )}
            >
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
                  "text-[11px] font-mono break-all p-3 rounded-xl leading-relaxed",
                  isLight ? "bg-black/[0.035]" : "bg-white/[0.04]"
                )}
              >
                {successInfo.newPath}
              </div>
              <p className="text-[11px] opacity-50 leading-relaxed break-all">
                {successInfo.retainedSourcePath
                  ? `新路径已启用，原目录保留供核对：${successInfo.retainedSourcePath}`
                  : "实例位置已同步，可从新路径继续启动。"}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className={cn("text-xs font-medium block", isLight ? "text-[#1a1625]/70" : "text-white/70")}>
                  新目标位置
                </label>
              </div>

              <div className="w-full space-y-1.5">
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={customPath}
                    disabled={migrating}
                    onChange={(e) => {
                      setCustomPath(e.target.value);
                      if (errorMsg) {
                        setErrorMsg(null);
                        setErrorDiagnostic(null);
                      }
                    }}
                    placeholder="选择或输入完整目标目录绝对路径"
                    className={cn(
                      "ios-field-control motion-control flex-1 min-w-0 h-9 px-3 rounded-xl border-0 text-xs transition-colors focus:outline-none",
                      isLight
                        ? "bg-black/[0.04] text-[#1a1625] placeholder:text-black/30"
                        : "bg-white/[0.04] text-white placeholder:text-white/30"
                    )}
                  />
                  <button
                    type="button"
                    onClick={handlePickDirectory}
                    disabled={migrating}
                    className={cn(
                      "flat-capsule motion-control h-9 px-3 rounded-full text-[11px] font-medium border-0 flex-shrink-0",
                      isLight
                        ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                        : "text-white/60 hover:text-white"
                    )}
                  >
                    浏览
                  </button>
                </div>
                <p className={cn("text-[11px] opacity-45 leading-relaxed", isLight ? "text-[#1a1625]" : "text-white")}>
                  {isIOS
                    ? "请点击「浏览」进入目标文件夹后点击右上角「打开」确认；跨存储迁移时将校验副本并在完成后列出保留目录。"
                    : "支持任意磁盘或分区路径。跨盘迁移时将执行安全校验并自动清理原位置。"}
                </p>
              </div>

              {/* 异常提示 + 统一脱敏上报 */}
              <ErrorReportAlert
                error={errorMsg}
                diagnostic={errorDiagnostic}
                area="relocate"
                platform={platformName}
                isLight={isLight}
                extraSecrets={secrets}
              />

              {/* 底部小字解释说明 */}
              <div className="flex items-start gap-2 pt-1 text-[11px] leading-relaxed opacity-55">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <p>
                  这是已创建实例的存储目录调整，不会改变实例内容或运行配置；数据导入请在实例管理中选择目标实例后使用 ZIP 导入。
                </p>
              </div>
            </>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div
          className={cn(
            "px-5 py-4 flex-shrink-0 flex items-center justify-end gap-2.5",
          )}
        >
          {successInfo ? (
            <ActionButton
              onClick={onClose}
              className={cn(
                "px-5 !h-8 text-xs font-medium",
                isLight
                  ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                  : "text-white/70 hover:text-white"
              )}
            >
              完成
            </ActionButton>
          ) : (
            <>
              <ActionButton
                disabled={migrating}
                onClick={onClose}
                className={cn(
                  "px-4 !h-8 text-xs font-medium",
                  isLight
                    ? "text-[#1a1625]/60 hover:text-[#1a1625]"
                    : "text-white/60 hover:text-white"
                )}
              >
                取消
              </ActionButton>
              <ActionButton
                disabled={isRunning || migrating || !customPath.trim()}
                onClick={handleExecuteRelocate}
                className={cn(
                  "px-5 !h-8 text-xs font-medium",
                  isLight
                    ? "text-[#1a1625]/70 hover:text-[#1a1625]"
                    : "text-white/70 hover:text-white"
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
              </ActionButton>
            </>
          )}
        </div>
      </div>
    </>
  );
};
