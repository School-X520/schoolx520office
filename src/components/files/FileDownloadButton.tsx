"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FileDownloadButton({ fileId, roomId }: { fileId: string; roomId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="shrink-0">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="파일 다운로드"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const response = await fetch(`/api/files/${fileId}/download?roomId=${roomId}`);
            const result = (await response.json()) as { signedUrl?: string; error?: string };
            if (!response.ok || !result.signedUrl) {
              setError(result.error ?? "다운로드 링크를 만들지 못했습니다.");
              return;
            }
            window.open(result.signedUrl, "_blank", "noopener,noreferrer");
          });
        }}
      >
        <Download className="size-4" />
      </Button>
      {error ? <p className="sr-only" role="alert">{error}</p> : null}
    </div>
  );
}
