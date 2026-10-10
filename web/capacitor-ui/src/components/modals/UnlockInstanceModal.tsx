import React, { useState, useEffect, useRef } from "react";
import { Lock, Eye, EyeOff, Loader2, AlertCircle, X } from "lucide-react";
import { TarvenEnv } from "../../capacitor-plugin";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";
import type { TavernInstance } from "../../types";

export interface UnlockInstanceModalProps {
  instance: TavernInstance | null;
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  onUnlockSuccess: (instance: TavernInstance) => void;
}

/**
 * 实例访问密码解锁弹窗 (UnlockInstanceModal)
 * 本地保险开关：仅在用户输入正确密码后，才执行实例启动或远程连接。
 */
export const UnlockInstanceModal: React.FC<UnlockInstanceModalProps> = ({
  instance,
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  onUnlockSuccess,
}) => {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword("");
      setShowPassword(false);
      setError(null);
      setVerifying(false);
      setIsShaking(false);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, instance?.id]);

  if (!isOpen && !isClosing) return null;
  if (!instance) return null;

  const handleUnlock = async () => {
    if (verifying) return;
    const cleanPassword = password.trim();
    if (!cleanPassword) {
      setError("请输入访问密码");
      triggerShake();
      return;
    }

    setVerifying(true);
    setError(null);

    try {
      const res = await TarvenEnv.verifyInstancePassword({
        instanceId: instance.installDir || instance.id,
        password: cleanPassword,
      });

      if (res && res.valid) {
        onUnlockSuccess(instance);
      } else {
        setError("密码错误，请重新输入");
        triggerShake();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    } catch (err: any) {
      setError(err?.message || "密码校验失败");
      triggerShake();
    } finally {
      setVerifying(false);
    }
  };

  const triggerShake = () => {
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 400);
  };

  const actionText = instance.type === "remote" ? "连接" : "启动";

  return (
    <>
      <LayerBackdrop
        isOpen={isOpen}
        isClosing={isClosing}
        onClick={verifying ? undefined : onClose}
        zIndex={LAYERS.DIALOG_BACKDROP}
        blur={true}
        className={cn(
          "transition-all duration-300",
          isLight ? "bg-black/25 backdrop-blur-[12px]" : "bg-black/55 backdrop-blur-[12px]"
        )}
      />
      <div
        className={cn(
          "ios-task-surface fixed rounded-2xl flex flex-col overflow-hidden backdrop-blur-[40px] saturate-180 shadow-2xl border",
          glassBg,
          isLight
            ? "is-light border-black/[0.08]"
            : "border-white/[0.08]",
          isClosing ? "animate-modal-dialog-exit" : "animate-modal-dialog"
        )}
        style={{
          zIndex: LAYERS.DIALOG_SURFACE,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(360px, calc(100vw - 2rem))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶部标题栏 */}
        <div
          className={cn(
            "flex items-center justify-between px-5 h-12 flex-shrink-0 border-b",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center",
                isLight ? "bg-black/[0.05] text-[#1a1625]" : "bg-white/[0.08] text-white"
              )}
            >
              <Lock className="w-3.5 h-3.5" />
            </div>
            <span
              className={cn(
                "text-sm font-semibold",
                isLight ? "text-[#1a1625]" : "text-white"
              )}
            >
              解锁实例
            </span>
          </div>
          {!verifying && (
            <button
              onClick={onClose}
              className={cn(
                "motion-control p-1.5 rounded-lg transition-colors",
                isLight
                  ? "text-[#1a1625]/40 hover:text-[#1a1625]/85"
                  : "text-white/40 hover:text-white/85"
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* 弹窗内容 */}
        <div className="p-5 space-y-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-xs font-semibold truncate max-w-[200px]",
                  isLight ? "text-[#1a1625]" : "text-white"
                )}
              >
                {instance.subtitle || instance.name}
              </span>
              <span
                className={cn(
                  "px-1.5 py-0.2 rounded text-[10px] font-medium border opacity-70",
                  isLight
                    ? "bg-black/[0.04] text-[#1a1625] border-black/[0.06]"
                    : "bg-white/[0.06] text-white border-white/[0.08]"
                )}
              >
                {instance.type === "remote" ? "远程连接" : "本地实例"}
              </span>
            </div>
            <p className={cn("text-[11px] opacity-45 leading-relaxed", isLight ? "text-[#1a1625]" : "text-white")}>
              此实例已开启本地访问保护，请输入密码以继续{actionText}。
            </p>
          </div>

          {/* 密码输入框 */}
          <div className={cn("space-y-1.5", isShaking && "animate-modal-shake")}>
            <div className="relative">
              <input
                ref={inputRef}
                type={showPassword ? "text" : "password"}
                value={password}
                disabled={verifying}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !verifying) handleUnlock();
                  if (e.key === "Escape" && !verifying) onClose();
                }}
                placeholder="输入访问密码"
                className={cn(
                  "ios-field-control motion-control w-full h-9 pl-3 pr-9 rounded-xl border text-xs transition-colors",
                  isLight
                    ? "bg-black/[0.04] border-black/[0.08] text-[#1a1625] placeholder:text-[#1a1625]/25 focus:border-black/20"
                    : "bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/25 focus:border-white/20"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className={cn(
                  "absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded transition-colors",
                  isLight ? "text-[#1a1625]/30 hover:text-[#1a1625]/70" : "text-white/30 hover:text-white/70"
                )}
              >
                {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span className="leading-tight">{error}</span>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div
          className={cn(
            "flex items-center justify-end gap-2 px-5 py-3 border-t flex-shrink-0",
            isLight ? "border-black/[0.06]" : "border-white/[0.06]"
          )}
        >
          <button
            onClick={onClose}
            disabled={verifying}
            className={cn(
              "motion-control h-8 px-3.5 rounded-xl text-xs font-medium border transition-colors",
              isLight
                ? "border-black/[0.08] text-[#1a1625]/60 hover:text-[#1a1625]"
                : "border-white/[0.08] text-white/60 hover:text-white"
            )}
          >
            取消
          </button>
          <button
            onClick={handleUnlock}
            disabled={verifying || !password.trim()}
            className={cn(
              "motion-control h-8 px-4 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all disabled:opacity-40",
              isLight
                ? "bg-black text-white/80 hover:text-white"
                : "bg-white text-[#14101e]/80 hover:text-[#14101e]"
            )}
          >
            {verifying ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>验证中...</span>
              </>
            ) : (
              <span>解锁并{actionText}</span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};
