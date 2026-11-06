import React from "react";
import { cn } from "../../lib/utils";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: "default" | "warning" | "danger";
}

export function ActionButton({
  children,
  className,
  tone = "default",
  type = "button",
  ...props
}: ActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        "action-button flat-capsule motion-control inline-flex h-9 items-center justify-center gap-1.5 px-3 rounded-full text-[11px] font-medium border-0 flex-shrink-0 whitespace-nowrap disabled:pointer-events-none disabled:opacity-40",
        tone !== "default" && `is-${tone}`,
        className
      )}
    >
      {children}
    </button>
  );
}
