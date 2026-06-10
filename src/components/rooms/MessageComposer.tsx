"use client";

import { useState } from "react";
import { Bot, Send, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEVELOPMENT_AGENT_ID, DEVELOPMENT_AGENT_ROOM_ID } from "@/lib/agents/development-agent";
import { cn } from "@/lib/utils/cn";
import type { Agent, AgentRun, RoomMessage } from "@/types/domain";

export function MessageComposer({
  roomId,
  threadId,
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
  threadId: string;
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
  const selectedGuestAgents = guestAgents.filter((agent) => selectedGuestAgentIds.includes(agent.id));
  const selectedRoomAgents = isMeeting
    ? []
    : [
        ...(residentAgent && botEnabled ? [residentAgent] : []),
        ...selectedGuestAgents,
      ];

  async function submit() {
    const content = value.trim();

    if (!content || isSubmitting) {
      return;
    }

    const optimisticMessage = createOptimisticMessage(roomId, threadId, currentUserId, content);
    onOptimisticMessage(optimisticMessage);
    setValue("");
    setError(null);
    setIsSubmitting(true);

    try {
      if (isMeeting) {
        await submitMeetingMessage(content, optimisticMessage.id);
        return;
      }
      await submitRoomMessage(content, optimisticMessage.id);
    } catch (submitError) {
      onMessageFailed(optimisticMessage.id);
      setError(submitError instanceof Error ? submitError.message : "전송에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitRoomMessage(content: string, optimisticId: string) {
    const messageResponse = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, threadId }),
    });
    const messagePayload = (await messageResponse.json()) as { error?: string; message?: RoomMessage };
    if (!messageResponse.ok || !messagePayload.message) {
      throw new Error(messagePayload.error ?? "전송에 실패했습니다.");
    }

    onMessagesCommitted(optimisticId, [messagePayload.message]);

    if (!selectedRoomAgents.length) {
      return;
    }

    const results = await Promise.allSettled(
      selectedRoomAgents.map((agent) => startRoomAgentRun(agent, content, messagePayload.message!.id)),
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

  async function submitMeetingMessage(content: string, optimisticId: string) {
    const messageResponse = await fetch(`/api/rooms/${roomId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ content, threadId }),
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
        threadId,
        inputMessageId,
        mode: "meeting_guest",
        agentId: agent.id,
        guestSourceRoomId: agent.roomId,
        intent: isDevelopmentRequestAgent(agent) ? "development_request" : undefined,
      }),
    });
    const payload = (await response.json()) as { error?: string; run?: AgentRun };
    if (!response.ok || !payload.run) {
      throw new Error(payload.error ?? `${agent.name} 호출에 실패했습니다.`);
    }
    return payload;
  }

  async function startRoomAgentRun(agent: Agent, content: string, inputMessageId: string) {
    const response = await fetch(`/api/rooms/${roomId}/agent-runs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: content,
        threadId,
        inputMessageId,
        mode: "room",
        agentId: agent.id,
        intent: isDevelopmentRequestAgent(agent) ? "development_request" : undefined,
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
        <div className="flex max-w-full flex-wrap items-center gap-2 text-xs font-medium text-ink-soft">
          {isMeeting ? (
            <>
              <Users className="size-3.5" />
              단체 채팅
            </>
          ) : residentAgent ? (
            <AgentToggle
              agent={residentAgent}
              checked={botEnabled}
              disabled={isSubmitting}
              onChange={setBotEnabled}
            />
          ) : (
            <>
              <Users className="size-3.5" />
              단체 채팅
            </>
          )}
          {!isMeeting
            ? guestAgents.map((agent) => (
                <AgentToggle
                  key={agent.id}
                  agent={agent}
                  checked={selectedGuestAgentIds.includes(agent.id)}
                  disabled={isSubmitting}
                  onChange={() => toggleGuestAgent(agent.id)}
                />
              ))
            : null}
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
          {selectedGuestAgents.map(agentActionLabel).join(", ")}
        </p>
      ) : null}
      {!isMeeting && selectedRoomAgents.length > 1 ? (
        <p className="mb-2 text-xs text-ink-soft">
          {selectedRoomAgents.map(agentActionLabel).join(", ")}
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
              : selectedRoomAgents.length
                ? `${selectedRoomAgents.map(agentActionLabel).join(", ")}`
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

function AgentToggle({
  agent,
  checked,
  disabled,
  onChange,
}: {
  agent: Agent;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-line bg-paper/70 px-2 py-1">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex h-5 w-9 items-center rounded-full border border-line bg-card px-0.5 peer-checked:justify-end peer-checked:border-sage peer-checked:bg-sage peer-disabled:opacity-55"
      >
        <span className="size-4 rounded-full bg-white shadow-sm" />
      </span>
      <Bot className="size-3.5" />
      <span>{agentActionLabel(agent)}</span>
    </label>
  );
}

function isDevelopmentRequestAgent(agent: Agent) {
  return agent.id === DEVELOPMENT_AGENT_ID || agent.roomId === DEVELOPMENT_AGENT_ROOM_ID;
}

function agentActionLabel(agent: Agent) {
  return isDevelopmentRequestAgent(agent) ? `${agent.name} 개발 요청` : `${agent.name} 응답`;
}

function createOptimisticMessage(roomId: string, threadId: string, currentUserId: string, content: string): RoomMessage {
  return {
    id: `optimistic-${crypto.randomUUID()}`,
    roomId,
    threadId,
    senderUserId: currentUserId,
    senderAgentId: null,
    agentRunId: null,
    type: "human",
    content,
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}
