import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-10 w-full rounded-md border border-line bg-white/70 px-3 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2",
        props.className,
      )}
    />
  );
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(
        "min-h-24 w-full resize-y rounded-md border border-line bg-white/70 px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2",
        props.className,
      )}
    />
  );
}
