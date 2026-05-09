import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function WarmCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-line bg-card p-4 shadow-sm", className)}>
      {children}
    </div>
  );
}
