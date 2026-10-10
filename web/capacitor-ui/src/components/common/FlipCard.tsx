import React, { useEffect, useRef, useState, useCallback } from "react";
import "./FlipCard.css";

const SLOP = { fine: 4, coarse: 8 };
const TILT_SPRING = { stiffness: 240, damping: 24, mass: 0.6 };
const LIFT_SPRING = { stiffness: 260, damping: 26, mass: 1 };
const FLING = 0.16;
const HISTORY_MS = 90;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const snap = (deg: number) => Math.round(deg / 180) * 180;
const isBack = (deg: number) => Math.abs(Math.round(deg / 180)) % 2 === 1;

class PhysicalSpring {
  current: number;
  target: number;
  velocity: number;
  stiffness: number;
  damping: number;
  mass: number;
  precision: number;

  constructor(init: number, stiffness = 240, damping = 24, mass = 0.6, precision = 0.005) {
    this.current = init;
    this.target = init;
    this.velocity = 0;
    this.stiffness = stiffness;
    this.damping = damping;
    this.mass = mass;
    this.precision = precision;
  }

  jump(val: number) {
    this.current = val;
    this.target = val;
    this.velocity = 0;
  }

  setTarget(val: number) {
    this.target = val;
  }

  // 采用高精度 0.002s (2ms) 固定微子步半隐式欧拉积分，完全还原 Popmotion / Motion.dev 物理弹簧临界阻尼曲线
  step(dt: number): boolean {
    const delta = this.current - this.target;
    if (Math.abs(delta) < this.precision && Math.abs(this.velocity) < this.precision) {
      this.current = this.target;
      this.velocity = 0;
      return true;
    }

    const subStep = 0.002;
    let remaining = dt;
    while (remaining > 0) {
      const stepDt = Math.min(remaining, subStep);
      const springForce = -this.stiffness * (this.current - this.target);
      const dampingForce = -this.damping * this.velocity;
      const acceleration = (springForce + dampingForce) / this.mass;
      this.velocity += acceleration * stepDt;
      this.current += this.velocity * stepDt;
      remaining -= stepDt;
    }

    if (Math.abs(this.current - this.target) < this.precision && Math.abs(this.velocity) < this.precision) {
      this.current = this.target;
      this.velocity = 0;
      return true;
    }

    return false;
  }
}

export interface FlipCardProps extends React.HTMLAttributes<HTMLDivElement> {
  front?: React.ReactNode;
  back?: React.ReactNode;
  flipped?: boolean;
  defaultFlipped?: boolean;
  onFlipChange?: (flipped: boolean) => void;
  onLongPress?: () => void;
  axis?: "x" | "y";
  flipOnClick?: boolean;
  draggable?: boolean;
  dragDistance?: number;
  tilt?: boolean;
  tiltMax?: number;
  pressTiltMax?: number;
  pressSinkDepth?: number;
  glare?: boolean;
  glareOpacity?: number;
  behindGlow?: boolean;
  behindGlowColor?: string;
  behindGlowSize?: string;
  borderColor?: string;
  hoverScale?: number;
  perspective?: number;
  stiffness?: number;
  damping?: number;
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  background?: string;
  color?: string;
  shadow?: boolean;
  shadowColor?: string;
  shadowOpacity?: number;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export const FlipCard: React.FC<FlipCardProps> = ({
  front = null,
  back = null,
  flipped,
  defaultFlipped = false,
  onFlipChange,
  onLongPress,
  axis = "y",
  flipOnClick = true,
  draggable = true,
  dragDistance = 0,
  tilt = true,
  tiltMax = 3.8,
  pressTiltMax = 7.5,
  pressSinkDepth = -5.5,
  glare = true,
  glareOpacity = 0.015,
  behindGlow = true,
  behindGlowColor,
  behindGlowSize,
  borderColor = "transparent",
  hoverScale = 1,
  perspective = 1100,
  stiffness = 160,
  damping = 28,
  width = 240,
  height = 320,
  radius = 26,
  background = "transparent",
  color = "#f5f5f5",
  shadow = true,
  shadowColor = "#000000",
  shadowOpacity = 0.22,
  disabled = false,
  ariaLabel = "Flip card",
  className = "",
  style,
  ...restProps
}) => {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduceMotion(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const controlled = flipped !== undefined;
  const [inner, setInner] = useState(defaultFlipped);
  const [dragging, setDragging] = useState(false);
  const shown = controlled ? !!flipped : inner;
  const shownRef = useRef(shown);
  const [facingBack, setFacingBack] = useState(shown);
  const [isPressed, setIsPressed] = useState(false);
  const [isLongPressed, setIsLongPressed] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const rootRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);

  const grip = useRef<{
    id: number;
    x: number;
    y: number;
    base: number;
    moved: boolean;
    slop: number;
    hist: Array<{ t: number; v: number }>;
  } | null>(null);

  // 严格基准物理弹簧引擎（对齐用户源码：stiffness: 240, damping: 24, mass: 0.6，完美临界阻尼）
  const turnSpring = useRef(new PhysicalSpring(shown ? 180 : 0, stiffness, damping, 1, 0.05));
  const tiltXSpring = useRef(new PhysicalSpring(0, TILT_SPRING.stiffness, TILT_SPRING.damping, TILT_SPRING.mass, 0.005));
  const tiltYSpring = useRef(new PhysicalSpring(0, TILT_SPRING.stiffness, TILT_SPRING.damping, TILT_SPRING.mass, 0.005));
  // 机械下沉二阶弹簧：按压时快速而沉稳下陷 -5.5px，松手时平滑无过冲优雅回弹至 0px
  const sinkSpring = useRef(new PhysicalSpring(0, 220, 26, 0.75, 0.01));
  const gxSpring = useRef(new PhysicalSpring(50, TILT_SPRING.stiffness, TILT_SPRING.damping, TILT_SPRING.mass, 0.05));
  const gySpring = useRef(new PhysicalSpring(50, TILT_SPRING.stiffness, TILT_SPRING.damping, TILT_SPRING.mass, 0.05));
  const sheenSpring = useRef(new PhysicalSpring(0, LIFT_SPRING.stiffness, LIFT_SPRING.damping, LIFT_SPRING.mass, 0.005));

  const targetDeg = useRef(shown ? 180 : 0);
  const rafId = useRef<number | null>(null);
  const lastTime = useRef<number | null>(null);

  // 更新 DOM transform（纯 3D 空间透视 + 机械深度下沉 + 跷跷板双轴角度倾斜）
  const renderTransforms = useCallback((tX = 0, tY = 0, sink = 0) => {
    const turn = turnSpring.current.current;

    const sumX = turn + tX;
    const sumY = turn + tY;

    if (rotorRef.current) {
      const sinkStr = Math.abs(sink) > 0.01 ? ` translateZ(${sink.toFixed(2)}px)` : "";
      if (axis === "x") {
        rotorRef.current.style.transform = `perspective(${perspective}px)${sinkStr} rotateY(${tY.toFixed(2)}deg) rotateX(${sumX.toFixed(2)}deg)`;
      } else {
        rotorRef.current.style.transform = `perspective(${perspective}px)${sinkStr} rotateX(${tX.toFixed(2)}deg) rotateY(${sumY.toFixed(2)}deg)`;
      }
    }

    const currentIsBack = isBack(turn);
    if (currentIsBack !== shownRef.current) {
      setFacingBack(currentIsBack);
    }
  }, [axis, perspective]);

  // 物理步进动画循环（全通道由二阶物理弹簧驱动）
  const startLoop = useCallback(() => {
    if (rafId.current !== null) return;
    lastTime.current = performance.now();

    const loop = (now: number) => {
      const dt = Math.min((now - (lastTime.current || now)) / 1000, 0.032);
      lastTime.current = now;

      const settledTurn = turnSpring.current.step(dt);
      const settledTiltX = tiltXSpring.current.step(dt);
      const settledTiltY = tiltYSpring.current.step(dt);
      const settledSink = sinkSpring.current.step(dt);
      const settledGx = gxSpring.current.step(dt);
      const settledGy = gySpring.current.step(dt);
      const settledSheen = sheenSpring.current.step(dt);

      const tX = tilt && !reduceMotion ? tiltXSpring.current.current : 0;
      const tY = tilt && !reduceMotion ? tiltYSpring.current.current : 0;
      const sinkVal = !reduceMotion ? sinkSpring.current.current : 0;
      const gxVal = gxSpring.current.current;
      const gyVal = gySpring.current.current;
      const sheenVal = sheenSpring.current.current;

      // 同步通过弹簧物理坐标更新 CSS 变量（光斑、阴影与倾角处于同一物理惯性相位）
      if (rootRef.current) {
        rootRef.current.style.setProperty("--pointer-x", `${gxVal.toFixed(2)}%`);
        rootRef.current.style.setProperty("--pointer-y", `${gyVal.toFixed(2)}%`);
        rootRef.current.style.setProperty("--pointer-from-left", (gxVal / 100).toFixed(4));
        rootRef.current.style.setProperty("--pointer-from-top", (gyVal / 100).toFixed(4));
        rootRef.current.style.setProperty("--fc-sheen", sheenVal.toFixed(3));
        rootRef.current.style.setProperty("--card-opacity", sheenVal.toFixed(3));
      }

      renderTransforms(tX, tY, sinkVal);

      if (settledTurn && settledTiltX && settledTiltY && settledSink && settledGx && settledGy && settledSheen) {
        rafId.current = null;
        lastTime.current = null;
        const finalBack = isBack(turnSpring.current.current);
        if (finalBack !== shownRef.current) {
          shownRef.current = finalBack;
          if (!controlled) setInner(finalBack);
          onFlipChange?.(finalBack);
        }
      } else {
        rafId.current = requestAnimationFrame(loop);
      }
    };

    rafId.current = requestAnimationFrame(loop);
  }, [controlled, onFlipChange, reduceMotion, renderTransforms, tilt]);

  const settle = useCallback((to: number, _velocity = 0, instant = false) => {
    targetDeg.current = to;
    if (instant || reduceMotion) {
      turnSpring.current.jump(to);
      const tX = tilt && !reduceMotion ? tiltXSpring.current.current : 0;
      const tY = tilt && !reduceMotion ? tiltYSpring.current.current : 0;
      const sinkVal = !reduceMotion ? sinkSpring.current.current : 0;
      renderTransforms(tX, tY, sinkVal);
      const next = isBack(to);
      if (next !== shownRef.current) {
        shownRef.current = next;
        setFacingBack(next);
        if (!controlled) setInner(next);
        onFlipChange?.(next);
      }
    } else {
      turnSpring.current.setTarget(to);
      startLoop();
    }
  }, [controlled, onFlipChange, reduceMotion, renderTransforms, startLoop, tilt]);

  const flip = useCallback((instant = false) => {
    const base = snap(turnSpring.current.current);
    settle(isBack(base) ? base - 180 : base + 180, 0, instant);
  }, [settle]);

  // 根据触控相对坐标计算物理跷跷板倾角与下沉
  const updateTiltFromPointer = useCallback((
    clientX: number,
    clientY: number,
    rect: DOMRect,
    pressed: boolean
  ) => {
    if (!tilt || reduceMotion) return;

    const px = clamp((clientX - rect.left) / rect.width, 0, 1);
    const py = clamp((clientY - rect.top) / rect.height, 0, 1);

    const maxAngle = pressed ? pressTiltMax : tiltMax;
    const back = isBack(turnSpring.current.current);

    // 跷跷板力矩几何计算（物理 3D 杠杆模型）：
    // py < 0.5 (上半部受压) => targetTx > 0 => rotateX(+) 顶部向屏幕深处下陷，底部向上跷起
    // py > 0.5 (下半部受压) => targetTx < 0 => rotateX(-) 底部向屏幕深处下陷，顶部向上跷起
    // px > 0.5 (右半部受压) => 正面时 targetTy > 0 => rotateY(+) 右侧向屏幕深处下陷，左侧向上跷起
    // px < 0.5 (左半部受压) => 正面时 targetTy < 0 => rotateY(-) 左侧向屏幕深处下陷，右侧向上跷起
    // 反面时绕 Y 轴反转 180°，故水平力矩需取反
    const targetTx = (0.5 - py) * 2 * maxAngle;
    const targetTy = back ? -(px - 0.5) * 2 * maxAngle : (px - 0.5) * 2 * maxAngle;

    tiltXSpring.current.setTarget(targetTx);
    tiltYSpring.current.setTarget(targetTy);
    gxSpring.current.setTarget(px * 100);
    gySpring.current.setTarget(py * 100);

    if (pressed) {
      sinkSpring.current.setTarget(pressSinkDepth);
      sheenSpring.current.setTarget(1.2);
    } else {
      sinkSpring.current.setTarget(0);
      sheenSpring.current.setTarget(1.0);
    }

    startLoop();
  }, [pressSinkDepth, pressTiltMax, reduceMotion, startLoop, tilt, tiltMax]);

  const startPress = useCallback((e?: React.PointerEvent) => {
    if (disabled || reduceMotion) return;
    setIsPressed(true);
    setIsLongPressed(false);

    if (e) {
      pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
    }

    cancelLongPress();
    longPressTimerRef.current = window.setTimeout(() => {
      setIsLongPressed(true);
      // 长按触发准备拖动重排时，跷跷板倾角与机械下沉平滑归零，为进入浮起态做准备
      tiltXSpring.current.setTarget(0);
      tiltYSpring.current.setTarget(0);
      sinkSpring.current.setTarget(0);
      startLoop();
      onLongPress?.();
    }, 380);
  }, [cancelLongPress, disabled, onLongPress, reduceMotion, startLoop]);

  const endPress = useCallback((e?: React.PointerEvent<HTMLDivElement>) => {
    cancelLongPress();
    setIsPressed(false);
    setIsLongPressed(false);
    pointerStartPosRef.current = null;

    if (reduceMotion) {
      sinkSpring.current.jump(0);
      tiltXSpring.current.jump(0);
      tiltYSpring.current.jump(0);
      renderTransforms(0, 0, 0);
      return;
    }

    // 机械下沉平滑优雅回弹
    sinkSpring.current.setTarget(0);

    // 抬手后若鼠标仍停留在卡片上，平滑过渡回 hover 倾角
    if (e && e.pointerType !== "touch" && rootRef.current?.matches(":hover")) {
      const r = rootRef.current.getBoundingClientRect();
      updateTiltFromPointer(e.clientX, e.clientY, r, false);
    } else {
      // 触屏或光标已离开，平滑回弹至水平静止态
      tiltXSpring.current.setTarget(0);
      tiltYSpring.current.setTarget(0);
      gxSpring.current.setTarget(50);
      gySpring.current.setTarget(50);
      sheenSpring.current.setTarget(0);
    }
    startLoop();
  }, [cancelLongPress, reduceMotion, renderTransforms, startLoop, updateTiltFromPointer]);

  useEffect(() => {
    return () => {
      cancelLongPress();
    };
  }, [cancelLongPress]);

  const rest = useCallback(() => {
    tiltXSpring.current.setTarget(0);
    tiltYSpring.current.setTarget(0);
    sinkSpring.current.setTarget(0);
    gxSpring.current.setTarget(50);
    gySpring.current.setTarget(50);
    sheenSpring.current.setTarget(0);
    if (rootRef.current) {
      rootRef.current.style.setProperty("--card-opacity", "0");
      rootRef.current.style.setProperty("--fc-sheen", "0");
    }
    startLoop();
  }, [startLoop]);

  // 受控属性 flipped 监听
  useEffect(() => {
    if (!controlled) return;
    const currentIsBack = isBack(targetDeg.current);
    if (currentIsBack === flipped) return;
    const base = targetDeg.current;
    const nextTarget = isBack(base) ? base - 180 : base + 180;
    targetDeg.current = nextTarget;
    if (reduceMotion) {
      turnSpring.current.jump(nextTarget);
      renderTransforms();
      setFacingBack(flipped);
    } else {
      turnSpring.current.setTarget(nextTarget);
      startLoop();
    }
  }, [controlled, flipped, reduceMotion, renderTransforms, startLoop]);

  useEffect(() => {
    renderTransforms();
  }, [renderTransforms]);

  useEffect(() => {
    return () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  useEffect(() => {
    if (disabled) rest();
  }, [disabled, rest]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    startPress(e);
    const r = e.currentTarget.getBoundingClientRect();
    updateTiltFromPointer(e.clientX, e.clientY, r, true);

    if (grip.current || !draggable) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}

    grip.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      base: turnSpring.current.current,
      moved: false,
      slop: e.pointerType === "touch" ? SLOP.coarse : SLOP.fine,
      hist: []
    };

    if (!reduceMotion) {
      startLoop();
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerStartPosRef.current && !isLongPressed) {
      const dist = Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y);
      if (dist > 8) {
        cancelLongPress();
      }
    }

    const g = grip.current;
    if (g && g.id === e.pointerId) {
      const d = axis === "x" ? e.clientY - g.y : e.clientX - g.x;
      if (!g.moved) {
        if (Math.abs(d) < g.slop || !draggable || reduceMotion) return;
        g.moved = true;
        setDragging(true);
        tiltXSpring.current.setTarget(0);
        tiltYSpring.current.setTarget(0);
        sinkSpring.current.setTarget(0);
        sheenSpring.current.jump(0);
      }
      const span = dragDistance > 0 ? dragDistance : axis === "x" ? (typeof height === "number" ? height : 320) : (typeof width === "number" ? width : 240);
      const deg = g.base + (axis === "x" ? -1 : 1) * (d / span) * 180;
      turnSpring.current.jump(deg);
      renderTransforms(0, 0, 0);

      const now = performance.now();
      g.hist.push({ t: now, v: deg });
      while (g.hist.length > 2 && now - g.hist[0].t > HISTORY_MS) g.hist.shift();
      return;
    }

    if (disabled) return;
    const r = e.currentTarget.getBoundingClientRect();

    if (isPressed && !isLongPressed) {
      // 处于按压中：跷跷板随手指滑动实时倾斜跟踪
      updateTiltFromPointer(e.clientX, e.clientY, r, true);
      return;
    }

    // 纯光标悬停态
    if (e.pointerType === "touch") return;
    updateTiltFromPointer(e.clientX, e.clientY, r, false);
  };

  const release = (e: React.PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    endPress(e);
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {}
    setDragging(false);

    if (e.pointerType === "touch" || !rootRef.current?.matches(":hover")) rest();

    if (!g.moved) {
      if (!cancelled && flipOnClick) flip(false);
      else settle(targetDeg.current, 0, false);
      return;
    }

    const here = turnSpring.current.current;
    let velocity = 0;
    const a = g.hist[0];
    const b = g.hist[g.hist.length - 1];
    if (!cancelled && a && b && b.t > a.t && performance.now() - b.t < 60) {
      velocity = ((b.v - a.v) / (b.t - a.t)) * 1000;
    }
    const to = cancelled ? snap(g.base) : clamp(snap(here + velocity * FLING), snap(here) - 180, snap(here) + 180);
    settle(to, velocity, false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    if (!e.repeat && flipOnClick) flip(true);
  };

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled && flipOnClick && e.detail === 0) flip(true);
  };

  const widthCss = typeof width === "number" ? `${width}px` : width;
  const heightCss = typeof height === "number" ? `${height}px` : height;
  const radiusCss = typeof radius === "number" ? `${radius}px` : radius;

  return (
    <div
      ref={rootRef}
      role="region"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={`flip-card${className ? ` ${className}` : ""}`}
      data-axis={axis}
      data-draggable={draggable && !disabled && !reduceMotion ? "" : undefined}
      data-dragging={dragging ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-fade={reduceMotion ? (shown ? "back" : "front") : undefined}
      data-pressed={isPressed && !isLongPressed ? "true" : undefined}
      data-long-pressed={isLongPressed ? "true" : undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={e => {
        release(e, false);
      }}
      onPointerCancel={e => {
        release(e, true);
      }}
      onLostPointerCapture={e => {
        release(e, true);
      }}
      onPointerEnter={e => {
        if (e.pointerType !== "touch" && !disabled) {
          const r = e.currentTarget.getBoundingClientRect();
          updateTiltFromPointer(e.clientX, e.clientY, r, false);
        }
      }}
      onPointerLeave={() => {
        endPress();
        if (!grip.current) rest();
      }}
      onKeyDown={onKeyDown}
      onClick={onClick}
      onDragStart={e => e.preventDefault()}
      style={{
        width: widthCss,
        height: heightCss,
        borderRadius: radiusCss,
        ["--fc-w" as string]: widthCss,
        ["--fc-h" as string]: heightCss,
        ["--fc-radius" as string]: radiusCss,
        ["--fc-bg" as string]: background,
        ["--fc-ink" as string]: color,
        ["--fc-shadow" as string]: shadowColor,
        ["--fc-shadow-o" as string]: shadowOpacity,
        ["--fc-glare" as string]: glareOpacity,
        ["--fc-behind-glow" as string]: behindGlowColor,
        ["--fc-behind-glow-size" as string]: behindGlowSize,
        ["--fc-border" as string]: borderColor,
        ...style
      }}
      {...restProps}
    >
      {/* ProfileCard 风格：背部漫反射光源，凸显卡片边缘与空间投影 */}
      {behindGlow ? (
        <span
          className="flip-card__behind-glow"
          aria-hidden="true"
        />
      ) : null}

      {/* 物理动态阴影 */}
      {shadow ? (
        <span
          ref={shadowRef}
          className="flip-card__shadow"
          aria-hidden="true"
        />
      ) : null}

      {/* 3D 转子容器 */}
      <div ref={rotorRef} className="flip-card__rotor">
        <div
          className="flip-card__face flip-card__face--front"
          style={{ visibility: facingBack ? "hidden" : "visible" }}
          aria-hidden={facingBack}
          {...({ inert: facingBack ? "" : undefined } as Record<string, unknown>)}
        >
          {front}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
        <div
          className="flip-card__face flip-card__face--back"
          style={{ visibility: facingBack ? "visible" : "hidden" }}
          aria-hidden={!facingBack}
          {...({ inert: !facingBack ? "" : undefined } as Record<string, unknown>)}
        >
          {back}
          {glare ? <span className="flip-card__glare" aria-hidden="true" /> : null}
        </div>
      </div>
    </div>
  );
};

export default FlipCard;
