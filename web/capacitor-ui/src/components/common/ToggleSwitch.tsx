import { useState } from "react";
import { cn } from "../../lib/utils";

interface ToggleSwitchProps {
  defaultOn?: boolean;
  on?: boolean;
  onChange?: (v: boolean) => void;
  isLight: boolean;
  ariaLabel?: string;
  disabled?: boolean;
}

export function ToggleSwitch({
  defaultOn = false,
  on,
  onChange,
  isLight,
  ariaLabel,
  disabled = false,
}: ToggleSwitchProps) {
  const [internal, setInternal] = useState(defaultOn);
  const isControlled = on !== undefined;
  const value = isControlled ? on! : internal;

  return (
    <button
      type="button"
      role="switch"
      aria-label={ariaLabel}
      aria-checked={value}
      aria-pressed={value}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        if (!isControlled) setInternal(!internal);
        onChange?.(!value);
      }}
      className={cn(
        "relative w-10 h-[22px] rounded-full transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
        value
          ? isLight
            ? "bg-[#1a1625]/60"
            : "bg-white/30"
          : isLight
          ? "bg-black/[0.08]"
          : "bg-white/[0.08]"
      )}
    >
      <div
        className={cn(
          "absolute left-[2px] top-[2px] w-[18px] h-[18px] rounded-full shadow-sm transition-transform duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
          isLight
            ? value
              ? "bg-white shadow-black/10"
              : "bg-white/90 shadow-black/5"
            : value
            ? "bg-white shadow-black/40"
            : "bg-white/60 shadow-black/20"
        )}
        style={{ transform: value ? "translateX(18px)" : "translateX(0px)" }}
      />
    </button>
  );
}
