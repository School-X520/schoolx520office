"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageComposer } from "@/components/rooms/MessageComposer";
import { MessageTimeline } from "@/components/rooms/MessageTimeline";
import type { Agent, AgentRun, MeetingImport, RoomMessage, SharedItem } from "@/types/domain";

export function RoomChat({
  roomId,
  currentUserId,
  isMeeting,
  residentAgent,
  guestAgents,
  initialMessages,
  sharedItems,
  imports,
}: {
  roomId: string;
  currentUserId: string;
  isMeeting: boolean;
  residentAgent?: Agent;
  guestAgents: Agent[];
  initialMessages: RoomMessage[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const chatAgents = [residentAgent, ...guestAgents].filter((agent): agent is Agent => Boolean(agent));

  function addOptimisticMessage(message: RoomMessage) {
    setMessages((current) => mergeMessages(current, [message]));
  }

  function commitMessages(optimisticId: string, committedMessages: RoomMessage[]) {
    setMessages((current) => mergeMessages(current.filter((message) => message.id !== optimisticId), committedMessages));
  }

  function removeOptimisticMessage(optimisticId: string) {
    setMessages((current) => current.filter((message) => message.id !== optimisticId));
  }

  function handleAgentRunQueued(run: AgentRun) {
    const pendingMessage = createPendingAgentMessage(roomId, run);
    setMessages((current) => mergeMessages(current, [pendingMessage]));
    void pollAgentRun(run.id, pendingMessage.id);
  }

  async function pollAgentRun(runId: string, pendingMessageId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await wait(attempt < 15 ? 1000 : 2000);

      try {
        const response = await fetch(`/api/rooms/${roomId}/agent-runs/${runId}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          error?: string;
          run?: AgentRun;
          outputMessage?: RoomMessage | null;
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "봇 실행 상태를 확인하지 못했습니다.");
        }

        const outputMessage = payload.outputMessage;
        if (outputMessage) {
          setMessages((current) =>
            mergeMessages(
              current.filter((message) => message.id !== pendingMessageId),
              [outputMessage],
            ),
          );
          router.refresh();
          return;
        }

        const checkedRun = payload.run;
        if (checkedRun?.status === "failed") {
          setMessages((current) =>
            mergeMessages(
              current.filter((message) => message.id !== pendingMessageId),
              [createAgentFailureMessage(roomId, runId, checkedRun.error)],
            ),
          );
          return;
        }
      } catch {
        if (attempt >= 10) {
          setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
          return;
        }
      }
    }

    setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
  }

  return (
    <>
      <MessageTimeline
        messages={messages}
        sharedItems={sharedItems}
        imports={imports}
        currentUserId={currentUserId}
        agents={chatAgents}
        isMeeting={isMeeting}
      />
      <MessageComposer
        roomId={roomId}
        currentUserId={currentUserId}
        isMeeting={isMeeting}
        residentAgent={residentAgent}
        guestAgents={guestAgents}
        onOptimisticMessage={addOptimisticMessage}
        onMessagesCommitted={commitMessages}
        onMessageFailed={removeOptimisticMessage}
        onAgentRunQueued={handleAgentRunQueued}
      />
    </>
  );
}

function createPendingAgentMessage(roomId: string, run: AgentRun): RoomMessage {
  return {
    id: `pending-${run.id}`,
    roomId,
    senderUserId: null,
    senderAgentId: run.agentId ?? null,
    agentRunId: run.id,
    type: run.mode === "meeting_guest" ? "guest_agent" : "agent",
    content: "응답 준비 중...",
    metadata: { pendingAgentRun: true },
    createdAt: new Date().toISOString(),
  };
}

function createAgentFailureMessage(roomId: string, runId: string, error?: string | null): RoomMessage {
  return {
    id: `failed-${runId}`,
    roomId,
    senderUserId: null,
    senderAgentId: null,
    agentRunId: runId,
    type: "system",
    content: error ? `봇 응답 생성에 실패했습니다. ${error}` : "봇 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

function mergeMessages(current: RoomMessage[], incoming: RoomMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
