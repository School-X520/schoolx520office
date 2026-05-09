import { Slot } from "@radix-ui/react-slot";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "icon";
  asChild?: boolean;
  children: ReactNode;
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-55",
        "active:translate-y-px",
        size === "sm" && "h-8 px-3 text-sm",
        size === "md" && "h-10 px-4 text-sm",
        size === "icon" && "size-9 p-0",
        variant === "primary" && "border-sage bg-sage text-white shadow-sm hover:bg-sage-soft",
        variant === "secondary" && "border-line bg-card text-ink shadow-sm hover:bg-gold-soft",
        variant === "ghost" && "border-transparent bg-transparent text-ink-soft hover:bg-card",
        variant === "danger" && "border-terracotta bg-terracotta text-white hover:bg-terracotta-soft",
        className,
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
