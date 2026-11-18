import React from "react";
import { cn } from "../../lib/utils";
import "./CornerResizeCurve.css";

type CornerResizeCurveProps = {
  isLight: boolean;
  label: string;
  active?: boolean;
  className?: string;
  /** 宿主卡片外圆角（屏幕 px），缺省按 Terminal 卡片 16px 对齐。 */
  cornerRadius?: number;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
};

/** 弧线轻盈外移 10px，清晰落在窗体影晕之外，既一眼可辨又不遮挡内部内容。 */
const CORNER_OUTSET = 10;
const SVG_MARGIN = 4;
const HIT_STROKE = 24;

export const CORNER_RESIZE_SAFE_INSET = CORNER_OUTSET + HIT_STROKE / 2;

interface CornerArcGeometry {
  box: number;
  offset: number;
  path: string;
  totalLen: number;
  restLen: number;
  hoverLen: number;
  hotLen: number;
  restOffset: number;
  hoverOffset: number;
  hotOffset: number;
}

const arcGeometryCache = new Map<number, CornerArcGeometry>();

function getCornerArcGeometry(cornerRadius: number): CornerArcGeometry {
  const normalizedRadius = Math.max(12, Math.round(cornerRadius));
  const cached = arcGeometryCache.get(normalizedRadius);
  if (cached) return cached;

  const arcRadius = normalizedRadius + CORNER_OUTSET;
  const center = SVG_MARGIN;
  const box = arcRadius + SVG_MARGIN * 2;
  const offset = -(CORNER_OUTSET + SVG_MARGIN);
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  // 较小圆角（如终端 16px）自动采用更大弧度张角，确保物理弧长保持在 ~29–36px 舒适可读尺寸。
  const isCompactCorner = normalizedRadius < 24;
  const fullDeg = isCompactCorner ? 84 : 74;
  const hoverDeg = isCompactCorner ? 74 : 61;
  const restDeg = isCompactCorner ? 64 : 48;
  const startDeg = (90 - fullDeg) / 2;
  const endDeg = startDeg + fullDeg;

  const ax = center + arcRadius * Math.cos(toRad(startDeg));
  const ay = center + arcRadius * Math.sin(toRad(startDeg));
  const bx = center + arcRadius * Math.cos(toRad(endDeg));
  const by = center + arcRadius * Math.sin(toRad(endDeg));
  const path = `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${arcRadius} ${arcRadius} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;

  const totalLen = (arcRadius * fullDeg * Math.PI) / 180;
  const hoverLen = (arcRadius * hoverDeg * Math.PI) / 180;
  const restLen = (arcRadius * restDeg * Math.PI) / 180;

  const geometry: CornerArcGeometry = {
    box,
    offset,
    path,
    totalLen,
    restLen,
    hoverLen,
    hotLen: totalLen,
    restOffset: -(totalLen - restLen) / 2,
    hoverOffset: -(totalLen - hoverLen) / 2,
    hotOffset: 0,
  };
  arcGeometryCache.set(normalizedRadius, geometry);
  return geometry;
}

/**
 * 极简扁平同心缩放手柄：
 * - 单层纯色圆头扁平外弧线，零高斯模糊、零双重高光描边、零渐变节点；
 * - 悬停与拖动舒展完全走纯 CSS 状态机与 GPU 合成，不触发 React 状态重渲染。
 */
export const CornerResizeCurve = React.memo(function CornerResizeCurve({
  isLight,
  label,
  active = false,
  className,
  cornerRadius = 16,
  onPointerDown,
}: CornerResizeCurveProps) {
  const geom = getCornerArcGeometry(cornerRadius);

  const svgStyle = {
    position: "absolute",
    right: geom.offset,
    bottom: geom.offset,
    width: geom.box,
    height: geom.box,
    overflow: "visible",
    pointerEvents: "none",
    zIndex: 30,
    "--arc-total": `${geom.totalLen.toFixed(2)}px`,
    "--arc-rest": `${geom.restLen.toFixed(2)}px`,
    "--arc-hover": `${geom.hoverLen.toFixed(2)}px`,
    "--arc-hot": `${geom.hotLen.toFixed(2)}px`,
    "--arc-offset-rest": `${geom.restOffset.toFixed(2)}px`,
    "--arc-offset-hover": `${geom.hoverOffset.toFixed(2)}px`,
    "--arc-offset-hot": `${geom.hotOffset.toFixed(2)}px`,
  } as React.CSSProperties;

  return (
    <svg
      role="button"
      aria-label={label}
      data-active={active ? "true" : "false"}
      className={cn("corner-resize-curve touch-none select-none", isLight && "is-light", className)}
      style={svgStyle}
      onPointerDown={onPointerDown}
    >
      {/* 透明抓手热区：足够宽裕且仅局限在圆角弧段 */}
      <path
        d={geom.path}
        fill="none"
        stroke="transparent"
        strokeWidth={HIT_STROKE}
        strokeLinecap="round"
        pointerEvents="stroke"
        className="cursor-nwse-resize"
      />
      {/* 单层扁平可视弧线：清楚大方且保持柔和哑光质感，悬停/拖动自然延展 */}
      <path
        d={geom.path}
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        pointerEvents="none"
        className="corner-resize-curve-arc"
      />
    </svg>
  );
});
