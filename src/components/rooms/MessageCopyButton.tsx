"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type MessageCopyButtonProps = {
  text: string;
  className?: string;
};

export function MessageCopyButton({ text, className }: MessageCopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);
  const canCopy = Boolean(text.trim());

  useEffect(() => {
    return () => {
      if (resetTimer.current) {
        window.clearTimeout(resetTimer.current);
      }
    };
  }, []);

  async function handleCopy() {
    if (!canCopy) {
      return;
    }

    await copyText(text);
    setCopied(true);
    if (resetTimer.current) {
      window.clearTimeout(resetTimer.current);
    }
    resetTimer.current = window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <button
      type="button"
      aria-label={copied ? "메시지 복사됨" : "메시지 복사"}
      title={copied ? "복사됨" : "메시지 복사"}
      disabled={!canCopy}
      onClick={handleCopy}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-card text-ink-soft shadow-sm",
        "hover:bg-paper-deep hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage",
        "disabled:cursor-not-allowed disabled:opacity-40",
        copied && "border-sage/30 bg-sage/10 text-sage",
        className,
      )}
    >
      {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
    </button>
  );
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}
