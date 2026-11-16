import React from "react";
import { cn } from "../../lib/utils";
import { LAYERS } from "../../constants/layers";

interface LayerBackdropProps {
  isOpen?: boolean;
  isClosing?: boolean;
  onClick?: () => void;
  zIndex?: number;
  className?: string;
  style?: React.CSSProperties;
  blur?: boolean;
}

/**
 * 统一浮层遮罩组件 (LayerBackdrop)
 * 提供平滑淡入淡出（.overlay-backdrop / .overlay-backdrop-exit）与统一 Z-Index
 */
export const LayerBackdrop: React.FC<LayerBackdropProps> = ({
  isOpen = true,
  isClosing = false,
  onClick,
  zIndex = LAYERS.MODAL_BACKDROP,
  className,
  style,
  blur = true,
}) => {
  if (!isOpen && !isClosing) return null;

  const backdropStyle = {
    ...(blur ? undefined : { "--overlay-blur": "0px" }),
    ...style,
    zIndex,
  } as React.CSSProperties;

  return (
    <div
      onClick={onClick}
      style={backdropStyle}
      className={cn(
        "fixed inset-0 overlay-backdrop",
        blur ? "bg-black/25 backdrop-blur-[2px]" : "bg-black/15",
        isClosing && "overlay-backdrop-exit",
        className
      )}
    />
  );
};
