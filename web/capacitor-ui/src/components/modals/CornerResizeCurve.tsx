import React from "react";

type CornerResizeCurveProps = {
  radius: number;
  gap?: number;
  isLight: boolean;
  label: string;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp: (event: React.PointerEvent<SVGSVGElement>) => void;
  onPointerCancel: (event: React.PointerEvent<SVGSVGElement>) => void;
};

/** 贴着外圆角、留出间隙的缩放曲线。盒子本身不接点击，只有弧线可拖。 */
export function CornerResizeCurve({
  radius,
  gap = 10,
  isLight,
  label,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: CornerResizeCurveProps) {
  const outer = radius + gap;
  const d = `M ${outer} 0 A ${outer} ${outer} 0 0 1 0 ${outer}`;
  return (
    <svg
      aria-label={label}
      role="button"
      className="absolute z-10 touch-none"
      style={{
        right: -gap,
        bottom: -gap,
        width: outer,
        height: outer,
        overflow: "visible",
        pointerEvents: "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <path d={d} fill="none" stroke="transparent" strokeWidth="18" pointerEvents="stroke" className="cursor-nwse-resize" />
      <path
        d={d}
        fill="none"
        stroke={isLight ? "rgba(28,18,24,0.34)" : "rgba(255,255,255,0.38)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        pointerEvents="stroke"
        className="cursor-nwse-resize"
      />
    </svg>
  );
}
