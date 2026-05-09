import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function StatusPill({
  children,
  tone = "sage",
}: {
  children: ReactNode;
  tone?: "sage" | "gold" | "terracotta" | "neutral" | "live";
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium tabular-nums",
        tone === "sage" && "border-sage/25 bg-sage/10 text-sage",
        tone === "gold" && "border-gold-soft bg-gold-soft text-ink",
        tone === "terracotta" && "border-terracotta/30 bg-terracotta/12 text-terracotta",
        tone === "neutral" && "border-line bg-card text-ink-soft",
        tone === "live" && "border-sage/30 bg-sage text-white",
      )}
    >
      {children}
    </span>
  );
}
