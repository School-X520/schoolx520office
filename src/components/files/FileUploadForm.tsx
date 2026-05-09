"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

export function FileUploadForm({ roomId }: { roomId: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function upload(file: File) {
    const formData = new FormData();
    formData.set("roomId", roomId);
    formData.set("file", file);

    const response = await fetch("/api/files", {
      method: "POST",
      body: formData,
    });
    const result = (await response.json()) as { error?: string; message?: string };
    if (!response.ok) {
      throw new Error(result.error ?? result.message ?? "업로드에 실패했습니다.");
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        aria-label="파일 선택"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }
          setMessage(null);
          startTransition(async () => {
            try {
              await upload(file);
              setMessage("업로드됨");
              router.refresh();
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "업로드에 실패했습니다.");
            } finally {
              if (inputRef.current) {
                inputRef.current.value = "";
              }
            }
          });
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="size-4" />
        {isPending ? "업로드 중" : "파일 올리기"}
      </Button>
      {message ? <p className="text-xs text-ink-soft">{message}</p> : null}
    </div>
  );
}
