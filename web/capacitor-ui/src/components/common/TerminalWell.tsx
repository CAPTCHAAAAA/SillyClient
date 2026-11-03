import React from "react";
import { cn } from "../../lib/utils";
import { terminalWellSurface } from "../../lib/menu-surface";

interface TerminalWellProps extends React.HTMLAttributes<HTMLDivElement> {
  isLight: boolean;
  isDynamic: boolean;
  compact?: boolean;
}

export const TerminalWell: React.FC<TerminalWellProps> = ({
  isLight,
  isDynamic,
  compact = false,
  className,
  style,
  ...props
}) => (
  <div
    {...props}
    data-terminal-well
    data-terminal-tone={isLight ? "light" : "dark"}
    className={cn("terminal-well", compact && "terminal-well--compact", className)}
    style={{ ...terminalWellSurface(isLight, isDynamic), ...style }}
  />
);
