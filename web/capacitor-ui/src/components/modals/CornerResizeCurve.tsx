import React from "react";

type CornerResizeCurveProps = {
  isLight: boolean;
  label: string;
  active?: boolean;
  onPointerDown: (event: React.PointerEvent<SVGSVGElement>) => void;
};

/** 弧线外移的距离：手柄落在卡片外侧，贴着圆角走，不压住卡片内容。 */
const OUTSET = 12;
/** 端点圆头与外侧柔光需要的余量。 */
const MARGIN = 10;
const ARC_RADIUS = 32 + OUTSET;
const BOX = ARC_RADIUS + MARGIN;
const CENTER = OUTSET;

/** 静息露出中段，悬停与拖动时沿外圆角向两端展开。 */
const REST_ARC_DEG = 48;
const FULL_ARC_DEG = 78;
const ARC_START_DEG = 6;
const REST_STROKE = 2.6;
const HOT_STROKE = 3.4;

const MOTION = "320ms cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * 右下角缩放手柄。弧线与卡片外圆角同心，整体外移 OUTSET 落在卡片外侧，
 * 看上去是贴着圆角长出来的一道玻璃高边，而不是单独浮着的一条线。
 * 露出长度由 stroke-dasharray 控制，悬停与拖动时变长、变粗、提亮。
 */
export function CornerResizeCurve({
  isLight,
  label,
  active = false,
  onPointerDown,
}: CornerResizeCurveProps) {
  const [hover, setHover] = React.useState(false);
  const hot = hover || active;

  const gradientId = React.useId().replace(/:/g, "");
  const ink = isLight ? "26, 22, 37" : "255, 255, 255";

  // SVG 的 y 轴朝下，右下角圆弧对应角度 0 到 90 度这一段
  const arc = (fromDeg: number, toDeg: number) => {
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const ax = CENTER + ARC_RADIUS * Math.cos(rad(fromDeg));
    const ay = CENTER + ARC_RADIUS * Math.sin(rad(fromDeg));
    const bx = CENTER + ARC_RADIUS * Math.cos(rad(toDeg));
    const by = CENTER + ARC_RADIUS * Math.sin(rad(toDeg));
    return `M ${ax.toFixed(2)} ${ay.toFixed(2)} A ${ARC_RADIUS} ${ARC_RADIUS} 0 0 1 ${bx.toFixed(2)} ${by.toFixed(2)}`;
  };

  const path = arc(ARC_START_DEG, ARC_START_DEG + FULL_ARC_DEG);
  const totalLength = ARC_RADIUS * (FULL_ARC_DEG * Math.PI) / 180;
  const visibleLength = ARC_RADIUS * ((hot ? FULL_ARC_DEG : REST_ARC_DEG) * Math.PI) / 180;
  const dashOffset = -Math.max(0, (totalLength - visibleLength) / 2);

  const dashStyle: React.CSSProperties = {
    strokeDasharray: `${visibleLength.toFixed(2)} ${totalLength.toFixed(2)}`,
    strokeDashoffset: dashOffset.toFixed(2),
    transition: `stroke-dasharray ${MOTION}, stroke-dashoffset ${MOTION}, stroke-width ${MOTION}, opacity ${MOTION}`,
  };

  return (
    <svg
      role="button"
      aria-label={label}
      className="touch-none select-none"
      style={{
        position: "absolute",
        right: -MARGIN,
        bottom: -MARGIN,
        width: BOX,
        height: BOX,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: 30,
      }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
      onPointerDown={onPointerDown}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={BOX} y1={MARGIN} x2={MARGIN} y2={BOX}>
          <stop offset="0%" stopColor={`rgb(${ink})`} stopOpacity={hot ? 0.5 : 0.24} />
          <stop offset="50%" stopColor={`rgb(${ink})`} stopOpacity={hot ? 1 : 0.82} />
          <stop offset="100%" stopColor={`rgb(${ink})`} stopOpacity={hot ? 0.5 : 0.24} />
        </linearGradient>
      </defs>

      {/* 抓取热区：跟着可见弧线加粗，只有这一圈接事件 */}
      <path
        d={path}
        fill="none"
        stroke="transparent"
        strokeWidth={24}
        strokeLinecap="round"
        pointerEvents="stroke"
        className="cursor-nwse-resize"
        style={dashStyle}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
      />

      {/* 外侧柔光：让弧线像浮在玻璃上的一道光，而不是一根硬线 */}
      <path
        d={path}
        fill="none"
        stroke={`rgba(${ink}, ${hot ? 0.2 : 0.1})`}
        strokeWidth={hot ? 9 : 7}
        strokeLinecap="round"
        pointerEvents="none"
        transform="translate(-1.4 -1.4)"
        style={{ ...dashStyle, filter: "blur(2.5px)" }}
      />

      {/* 主弧线：中点最亮、两端收淡，形成一道玻璃高边 */}
      <path
        d={path}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={hot ? HOT_STROKE : REST_STROKE}
        style={dashStyle}
        strokeLinecap="round"
        pointerEvents="none"
      />

      {/* 内侧高光发丝：给弧线一点厚度，像嵌进玻璃的边缘 */}
      <path
        d={path}
        fill="none"
        stroke={isLight ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.3)"}
        strokeWidth={0.8}
        strokeLinecap="round"
        pointerEvents="none"
        transform="translate(-1.4 -1.4)"
        style={{ ...dashStyle, opacity: hot ? 0.9 : 0.55 }}
      />
    </svg>
  );
}
