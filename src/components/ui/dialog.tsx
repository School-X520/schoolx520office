"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

export function Dialog({
  trigger,
  title,
  description,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="motion-context-overlay fixed inset-0 z-40 bg-ink/35" />
        <DialogPrimitive.Content
          className={cn(
            "motion-context-dialog fixed left-1/2 top-1/2 z-50 grid w-[min(92vw,34rem)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-lg border border-line bg-card p-5 shadow-xl",
          )}
        >
          <div className="space-y-1 pr-10">
            <DialogPrimitive.Title className="text-lg font-semibold text-balance text-ink">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-pretty text-ink-soft">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          {children}
          <DialogPrimitive.Close asChild>
            <Button aria-label="닫기" variant="ghost" size="icon" className="absolute right-3 top-3">
              <X className="size-4" />
            </Button>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
