import React from "react";
import { Check } from "lucide-react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";
import { LayerBackdrop } from "../common/LayerBackdrop";

export interface VersionDropdownMenuProps {
  isOpen: boolean;
  isClosing?: boolean;
  onClose: () => void;
  isLight: boolean;
  glassBg: string;
  releases: any[];
  currentVersion: string;
  onSelectVersion: (tag: string) => void;
  dropdownPos: { bottom?: number; left?: number; width?: number; maxHeight?: number };
}

/**
 * 版本选择下拉浮层 (VersionDropdownMenu)
 * 渲染在向导外部避免 transform 裁剪，采用统一 Z-Index (LAYERS.POPOVER_MENU)。
 */
export const VersionDropdownMenu: React.FC<VersionDropdownMenuProps> = ({
  isOpen,
  isClosing = false,
  onClose,
  isLight,
  glassBg,
  releases,
  currentVersion,
  onSelectVersion,
  dropdownPos,
}) => {
  if (!isOpen && !isClosing) return null;

  const options = [
    ...releases
      .slice(0, 20)
      .reverse()
      .map((r) => ({
        value: r.tag,
        label: r.tag,
        sublabel: r.prerelease ? "预发布版本" : "正式版本",
        zipballUrl: r.zipballUrl,
        recommended: r.tag === releases.find((x) => !x.prerelease)?.tag,
      })),
    {
      value: "stable",
      label: "内置版",
      sublabel: "本地内置最新版本",
      zipballUrl: undefined,
    },
  ];

  return (
    <>
      <LayerBackdrop
        isClosing={isClosing}
        onClick={onClose}
        zIndex={LAYERS.POPOVER_MENU - 1}
        blur={false}
      />
      <div
        className={cn(
          "motion-menu-list fixed rounded-md overflow-hidden backdrop-blur-[40px] saturate-180",
          isClosing ? "animate-dropdown-up-exit" : "animate-dropdown-up",
          glassBg
        )}
        style={{
          zIndex: LAYERS.POPOVER_MENU,
          bottom: dropdownPos.bottom,
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxHeight: dropdownPos.maxHeight,
          overflowY: "auto",
          overscrollBehavior: "contain",
          transformOrigin: "bottom center",
        }}
      >
        {options.map((opt, optionIndex) => (
          <button
            key={opt.value}
            onClick={() => {
              onSelectVersion(opt.value);
              onClose();
            }}
            className={cn(
              "motion-menu-item w-full px-4 py-2.5 text-left transition-colors flex items-center justify-between gap-2",
              currentVersion === opt.value
                ? isLight
                  ? "bg-[#1a1625]/8"
                  : "bg-white/10"
                : isLight
                ? "hover:bg-black/[0.04]"
                : "hover:bg-white/[0.06]"
            )}
            style={{
              animationDelay: `${
                Math.min(options.length - 1 - optionIndex, 5) * 14
              }ms`,
            }}
          >
            <div className="flex flex-col items-start min-w-0">
              <span
                className={cn(
                  "text-[13px] font-medium",
                  currentVersion === opt.value
                    ? isLight
                      ? "text-[#1a1625]"
                      : "text-white"
                    : isLight
                    ? "text-[#1a1625]/80"
                    : "text-white/80"
                )}
              >
                {opt.label}
                {(opt as any).recommended && (
                  <span
                    className={cn(
                      "ml-1 text-[10px] px-1.5 py-0.5 rounded-full",
                      isLight
                        ? "bg-[#1a1625]/10 text-[#1a1625]/60"
                        : "bg-white/10 text-white/60"
                    )}
                  >
                    推荐
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-[11px] mt-0.5",
                  isLight ? "text-[#1a1625]/40" : "text-white/40"
                )}
              >
                {opt.sublabel}
              </span>
            </div>
            {currentVersion === opt.value && (
              <Check
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isLight ? "text-[#1a1625]/60" : "text-white/60"
                )}
              />
            )}
          </button>
        ))}
      </div>
    </>
  );
};
