"use client";

import { useState, useTransition } from "react";
import { Bot, Send, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MessageComposer({
  roomId,
  hasResidentBot,
  isMeeting,
}: {
  roomId: string;
  hasResidentBot: boolean;
  isMeeting: boolean;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(kind: "message" | "agent") {
    const content = value.trim();
    if (!content) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const endpoint = kind === "agent" ? `/api/rooms/${roomId}/agent-runs` : `/api/rooms/${roomId}/messages`;
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content, message: content }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        setError(body.error ?? "전송에 실패했습니다.");
        return;
      }
      setValue("");
      window.location.reload();
    });
  }

  return (
    <div className="rounded-lg border border-line bg-card p-3 shadow-sm">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit("message");
          }
        }}
        placeholder={isMeeting ? "@재무봇 예산 가능성 브리핑해줘" : "메시지를 입력하세요"}
        className="min-h-24 w-full resize-y rounded-md border border-line bg-white/60 p-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      />
      {error ? <p className="mt-2 text-sm text-terracotta">{error}</p> : null}
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {isMeeting ? (
            <>
              <Button type="button" variant="secondary" size="sm">
                <Bot className="size-4" />
                @봇 호출
              </Button>
              <Button type="button" variant="secondary" size="sm">
                <Share2 className="size-4" />
                내 작업 공유
              </Button>
            </>
          ) : null}
          {hasResidentBot ? (
            <Button type="button" variant="secondary" size="sm" disabled={isPending} onClick={() => submit("agent")}>
              <Bot className="size-4" />
              봇에게 요청
            </Button>
          ) : null}
        </div>
        <Button type="button" size="sm" disabled={isPending} onClick={() => submit("message")}>
          <Send className="size-4" />
          전송
        </Button>
      </div>
    </div>
  );
}
