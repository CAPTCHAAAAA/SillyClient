import React from "react";
import { cn } from "../../lib/utils";
import "./InstanceCardDrawer.css";

interface InstanceCardDrawerProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
}

export const InstanceCardDrawer: React.FC<InstanceCardDrawerProps> = ({
  isOpen,
  className,
  children,
  ...props
}) => (
  <div
    {...props}
    className={cn("instance-card-drawer motion-accordion", isOpen && "is-open", className)}
    aria-hidden={!isOpen}
    inert={!isOpen}
  >
    <div className="instance-card-drawer__content motion-accordion-inner">
      {children}
    </div>
  </div>
);
