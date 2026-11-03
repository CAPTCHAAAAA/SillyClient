import { cn } from "../../lib/utils";

export interface SegmentedSwitchOption<T extends string> {
  id: T;
  label: string;
}

interface SegmentedSwitchProps<T extends string> {
  value: T;
  options: readonly [SegmentedSwitchOption<T>, SegmentedSwitchOption<T>];
  onChange: (value: T) => void;
  isLight: boolean;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * 紧凑型行内双档分段开关 (SegmentedSwitch)
 * 专为设置列表右侧控制槽设计，与 ToggleSwitch 及 flat-capsule 保持同族玻璃材质与曲线。
 */
export function SegmentedSwitch<T extends string>({
  value,
  options,
  onChange,
  isLight,
  ariaLabel,
  disabled = false,
}: SegmentedSwitchProps<T>) {
  const activeIndex = options[1].id === value ? 1 : 0;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      aria-disabled={disabled}
      className={cn(
        "app-settings-segment relative inline-grid h-9 grid-cols-2 items-center rounded-full p-[3px] select-none transition-opacity duration-200",
        isLight && "is-light",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      <div
        aria-hidden="true"
        className="app-settings-segment-thumb pointer-events-none absolute top-[3px] bottom-[3px] left-[3px] w-[calc(50%-3px)] rounded-full"
        style={{
          transform: activeIndex === 1 ? "translateX(100%)" : "translateX(0%)",
        }}
      />
      {options.map((option) => {
        const isActive = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => {
              if (disabled || option.id === value) return;
              onChange(option.id);
            }}
            className={cn(
              "app-settings-segment-btn relative z-[1] h-[30px] min-w-[38px] px-2.5 rounded-full text-[11px] font-medium leading-none whitespace-nowrap transition-colors duration-200",
              disabled ? "cursor-not-allowed" : "cursor-pointer",
              isActive && "is-active",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
