"use client";

import { useState } from "react";
import { Bot, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Agent, AgentRun, RoomMessage } from "@/types/domain";

type SubmitKind = "message" | "resident_agent" | "guest_agent";

export function MessageComposer({
  roomId,
  currentUserId,
  isMeeting,
  residentAgent,
  guestAgents,
  onOptimisticMessage,
  onMessagesCommitted,
  onMessageFailed,
  onAgentRunQueued,
}: {
  roomId: string;
  currentUserId: string;
  isMeeting: boolean;
  residentAgent?: Agent;
  guestAgents: Agent[];
  onOptimisticMessage: (message: RoomMessage) => void;
  onMessagesCommitted: (optimisticId: string, messages: RoomMessage[]) => void;
  onMessageFailed: (optimisticId: string) => void;
  onAgentRunQueued: (run: AgentRun) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [botEnabled, setBotEnabled] = useState(() => Boolean(!isMeeting && residentAgent));
  const [selectedGuestAgentIds, setSelectedGuestAgentIds] = useState<string[]>([]);
  const defaultKind: SubmitKind = !isMeeting && residentAgent && botEnabled ? "resident_agent" : "message";
  const selectedGuestAgents = guestAgents.filter((agent) => selectedGuestAgentIds.includes(agent.id));

  async function submit(kind: SubmitKind = defaultKind, guestAgent?: Agent) {
    const content = value.trim();

    if (!content || isSubmitting) {
      return;
    }

    const optimisticMessage = createOptimisticMessage(roomId, currentUserId, content);
    onOptimisticMessage(optimisticMessage);
    setValue("");
    setError(null);
    setIsSubmitting(true);

    try {
      if (isMeeting) {
        await submitMeetingMessage(content, optimisticMessage.id);
        return;
      }

      const isAgentRun = kind === "resident_agent" || kind === "guest_agent";
      const endpoint = isAgentRun ? `/api/rooms/${roomId}/agent-runs` : `/api/rooms/${roomId}/messages`;
      const body =
        kind === "resident_agent" && residentAgent
          ? { message: content, mode: "room", agentId: residentAgent.id }
          : kind === "guest_agent" && guestAgent
            ? {
                message: content,
                mode: "meeting_guest",
                agentId: guestAgent.id,
                guestSourceRoomId: guestAgent.roomId,
              }
            : { content };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as {
        error?: string;
        message?: RoomMessage;
        inputMessage?: RoomMessage;
        outputMessage?: RoomMessage;
        run?: AgentRun;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? "전송에 실패했습니다.");
      }

      const committedMessages =
        kind === "message"
          ? [payload.message].filter((message): message is RoomMessage => Boolean(message))
          : [payload.inputMessage, payload.outputMessage].filter((message): message is RoomMessage => Boolean(message));

      onMessagesCommitted(optimisticMessage.id, committedMessages);
      if (payload.run && !payload.outputMessage) {
        onAgentRunQueued(payload.run);
      }
    } catch (submitError) {
      onMessageFailed(optimisticMessage.id);
      setError(submitError instanceof Error ? submitError.message : "전송에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitMeetingMessage(content: string, optimisticId: string) {
    const messageResponse = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const messagePayload = (await messageResponse.json()) as { error?: string; message?: RoomMessage };
    if (!messageResponse.ok || !messagePayload.message) {
      throw new Error(messagePayload.error ?? "전송에 실패했습니다.");
    }

    onMessagesCommitted(optimisticId, [messagePayload.message]);

    if (!selectedGuestAgents.length) {
      return;
    }

    const results = await Promise.allSettled(
      selectedGuestAgents.map((agent) => startGuestAgentRun(agent, content, messagePayload.message!.id)),
    );
    const failedCount = results.filter((result) => result.status === "rejected").length;
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value.run) {
        onAgentRunQueued(result.value.run);
      }
    });

    if (failedCount) {
      setError(`${failedCount}개 봇 호출에 실패했습니다. 나머지 봇 응답은 계속 처리됩니다.`);
    }
  }

  async function startGuestAgentRun(agent: Agent, content: string, inputMessageId: string) {
    const response = await fetch(`/api/rooms/${roomId}/agent-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: content,
        inputMessageId,
        mode: "meeting_guest",
        agentId: agent.id,
        guestSourceRoomId: agent.roomId,
      }),
    });
    const payload = (await response.json()) as { error?: string; run?: AgentRun };
    if (!response.ok || !payload.run) {
      throw new Error(payload.error ?? `${agent.name} 호출에 실패했습니다.`);
    }
    return payload;
  }

  function toggleGuestAgent(agentId: string) {
    setSelectedGuestAgentIds((current) =>
      current.includes(agentId) ? current.filter((id) => id !== agentId) : [...current, agentId],
    );
  }

  return (
    <div className="border-t border-line bg-card p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-medium text-ink-soft">
          {isMeeting ? (
            <>
              <Users className="size-3.5" />
              단체 채팅
            </>
          ) : residentAgent ? (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper/70 px-2 py-1">
              <input
                type="checkbox"
                checked={botEnabled}
                onChange={(event) => setBotEnabled(event.target.checked)}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="flex h-5 w-9 items-center rounded-full border border-line bg-card px-0.5 peer-checked:justify-end peer-checked:border-sage peer-checked:bg-sage"
              >
                <span className="size-4 rounded-full bg-white shadow-sm" />
              </span>
              <Bot className="size-3.5" />
              <span>{residentAgent.name} 응답</span>
            </label>
          ) : (
            <>
              <Users className="size-3.5" />
              단체 채팅
            </>
          )}
        </div>
        {isMeeting ? (
          guestAgents.length ? (
            <div className="flex max-w-full flex-wrap justify-end gap-1.5">
              {guestAgents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  aria-pressed={selectedGuestAgentIds.includes(agent.id)}
                  disabled={isSubmitting}
                  onClick={() => toggleGuestAgent(agent.id)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-55",
                    selectedGuestAgentIds.includes(agent.id)
                      ? "border-sage bg-sage text-white shadow-sm"
                      : "border-line bg-paper/70 text-ink-soft hover:bg-card",
                  )}
                >
                  <Bot className="size-3.5" />
                  <span>{agent.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft">호출할 수 있는 봇이 없습니다.</p>
          )
        ) : null}
      </div>
      {isMeeting && selectedGuestAgents.length ? (
        <p className="mb-2 text-xs text-ink-soft">
          {selectedGuestAgents.map((agent) => agent.name).join(", ")} 응답
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            isMeeting
              ? "회의방에 메시지 보내기"
              : residentAgent && botEnabled
                ? `${residentAgent.name}에게 메시지 보내기`
                : "단체 채팅에 메시지 보내기"
          }
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-line bg-white/70 px-3 py-2 text-sm text-ink shadow-sm placeholder:text-ink-soft/60 focus-visible:outline-2 focus-visible:outline-offset-2"
          rows={1}
        />
        <Button type="button" disabled={isSubmitting || !value.trim()} onClick={() => submit()}>
          <Send className="size-4" />
          전송
        </Button>
      </div>
      {error ? (
        <p className="mt-2 rounded-md border border-terracotta/35 bg-terracotta/10 px-3 py-2 text-sm text-terracotta">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function createOptimisticMessage(roomId: string, currentUserId: string, content: string): RoomMessage {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    roomId,
    senderUserId: currentUserId,
    senderAgentId: null,
    agentRunId: null,
    type: "human",
    content,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}
