import { useEffect, useState } from "react";

function formatClock(): string {
  return new Date().toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * 顶栏分钟级时钟：独立订阅分钟对齐定时器，避免在主视图交互期间随高频状态重绘。
 */
export function HeaderClock() {
  const [label, setLabel] = useState(formatClock);

  useEffect(() => {
    let timeoutId: number | undefined;
    const scheduleNext = () => {
      const now = Date.now();
      const msUntilNextMinute = 60_000 - (now % 60_000) + 50;
      timeoutId = window.setTimeout(() => {
        setLabel(formatClock());
        scheduleNext();
      }, msUntilNextMinute);
    };
    scheduleNext();
    return () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

  return <span className="text-sm font-medium truncate">{label}</span>;
}
