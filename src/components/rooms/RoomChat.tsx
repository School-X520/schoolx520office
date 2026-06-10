"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageComposer } from "@/components/rooms/MessageComposer";
import { MessageTimeline } from "@/components/rooms/MessageTimeline";
import type {
  Agent,
  AgentRun,
  AgentRunActivity,
  MeetingImport,
  RoomMessage,
  SharedItem,
  UserProfile,
} from "@/types/domain";

export function RoomChat({
  roomId,
  threadId,
  currentUserId,
  isMeeting,
  residentAgent,
  guestAgents,
  initialMessages,
  memberProfiles,
  sharedItems,
  imports,
}: {
  roomId: string;
  threadId: string;
  currentUserId: string;
  isMeeting: boolean;
  residentAgent?: Agent;
  guestAgents: Agent[];
  initialMessages: RoomMessage[];
  memberProfiles: UserProfile[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [cancellingAgentRunIds, setCancellingAgentRunIds] = useState<Set<string>>(() => new Set());
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

  function clearCancellingAgentRun(runId: string) {
    setCancellingAgentRunIds((current) => {
      const next = new Set(current);
      next.delete(runId);
      return next;
    });
  }

  function handleAgentRunQueued(run: AgentRun) {
    const pendingMessage = createPendingAgentMessage(roomId, threadId, run);
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
          activity?: AgentRunActivity[];
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
          clearCancellingAgentRun(runId);
          router.refresh();
          return;
        }

        const checkedRun = payload.run;
        if (checkedRun) {
          updatePendingAgentMessage(pendingMessageId, checkedRun, payload.activity ?? []);
        }
        if (checkedRun?.status === "failed") {
          setMessages((current) =>
            mergeMessages(
              current.filter((message) => message.id !== pendingMessageId),
              [createAgentFailureMessage(roomId, threadId, runId, checkedRun.error)],
            ),
          );
          clearCancellingAgentRun(runId);
          return;
        }
        if (checkedRun?.status === "cancelled") {
          setMessages((current) =>
            mergeMessages(
              current.filter((message) => message.id !== pendingMessageId),
              [createAgentCancelledMessage(roomId, threadId, runId)],
            ),
          );
          clearCancellingAgentRun(runId);
          return;
        }
      } catch {
        if (attempt >= 10) {
          setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
          clearCancellingAgentRun(runId);
          return;
        }
      }
    }

    setMessages((current) => current.filter((message) => message.id !== pendingMessageId));
    clearCancellingAgentRun(runId);
  }

  async function cancelAgentRun(runId: string) {
    setCancellingAgentRunIds((current) => new Set(current).add(runId));
    setMessages((current) =>
      current.map((message) =>
        message.agentRunId === runId && message.metadata.pendingAgentRun
          ? {
              ...message,
              content: "중단 요청 중...",
              metadata: { ...message.metadata, cancelRequested: true },
            }
          : message,
      ),
    );

    try {
      const response = await fetch(`/api/rooms/${roomId}/agent-runs/${runId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string; run?: AgentRun };
      if (!response.ok || !payload.run) {
        throw new Error(payload.error ?? "봇 실행을 중단하지 못했습니다.");
      }
    } catch (error) {
      setMessages((current) =>
        current.map((message) =>
          message.agentRunId === runId && message.metadata.pendingAgentRun
            ? {
                ...message,
                content: "응답 준비 중...",
                metadata: {
                  ...message.metadata,
                  cancelRequested: false,
                  cancelError: error instanceof Error ? error.message : "봇 실행을 중단하지 못했습니다.",
                },
              }
            : message,
        ),
      );
      setCancellingAgentRunIds((current) => {
        const next = new Set(current);
        next.delete(runId);
        return next;
      });
    }
  }

  function updatePendingAgentMessage(runMessageId: string, run: AgentRun, activity: AgentRunActivity[]) {
    setMessages((current) =>
      current.map((message) =>
        message.id === runMessageId
          ? {
              ...message,
              content: pendingAgentContent(run.status),
              metadata: {
                ...message.metadata,
                pendingAgentRun: true,
                agentRunStatus: run.status,
                agentRunActivity: latestAgentRunActivity(activity),
              },
            }
          : message,
      ),
    );
  }

  return (
    <>
      <MessageTimeline
        messages={messages}
        sharedItems={sharedItems}
        imports={imports}
        currentUserId={currentUserId}
        agents={chatAgents}
        memberProfiles={memberProfiles}
        isMeeting={isMeeting}
        cancellingAgentRunIds={cancellingAgentRunIds}
        onCancelAgentRun={cancelAgentRun}
      />
      <MessageComposer
        roomId={roomId}
        threadId={threadId}
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

function createPendingAgentMessage(roomId: string, threadId: string, run: AgentRun): RoomMessage {
  return {
    id: `pending-${run.id}`,
    roomId,
    threadId,
    senderUserId: null,
    senderAgentId: run.agentId ?? null,
    agentRunId: run.id,
    type: run.mode === "meeting_guest" ? "guest_agent" : "agent",
    content: pendingAgentContent(run.status),
    metadata: {
      pendingAgentRun: true,
      guestLabel: run.metadata.guestLabel,
      agentRunStatus: run.status,
      agentRunActivity: [
        {
          id: `${run.id}-queued`,
          title: "실행 요청 접수",
          detail: typeof run.metadata.guestLabel === "string" ? run.metadata.guestLabel : null,
          status: "pending",
          createdAt: run.startedAt,
        },
      ],
    },
    createdAt: new Date().toISOString(),
  };
}

function createAgentFailureMessage(roomId: string, threadId: string, runId: string, error?: string | null): RoomMessage {
  return {
    id: `failed-${runId}`,
    roomId,
    threadId,
    senderUserId: null,
    senderAgentId: null,
    agentRunId: runId,
    type: "system",
    content: error ? `봇 응답 생성에 실패했습니다. ${error}` : "봇 응답 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.",
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

function createAgentCancelledMessage(roomId: string, threadId: string, runId: string): RoomMessage {
  return {
    id: `cancelled-${runId}`,
    roomId,
    threadId,
    senderUserId: null,
    senderAgentId: null,
    agentRunId: runId,
    type: "system",
    content: "봇 실행이 중단되었습니다.",
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

function pendingAgentContent(status: AgentRun["status"]) {
  if (status === "queued") {
    return "실행 대기 중...";
  }
  if (status === "requires_action") {
    return "추가 작업을 기다리는 중...";
  }
  if (status === "idle") {
    return "작업 정리 중...";
  }
  return "응답 생성 중...";
}

function mergeMessages(current: RoomMessage[], incoming: RoomMessage[]) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function latestAgentRunActivity(activity: AgentRunActivity[]) {
  const latest = activity.at(-1);
  return latest ? [latest] : [];
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
