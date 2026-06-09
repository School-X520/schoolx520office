"use client";

import { useLayoutEffect, useRef } from "react";
import { MessageBubble } from "@/components/rooms/MessageBubble";
import type { Agent, MeetingImport, RoomMessage, SharedItem, UserProfile } from "@/types/domain";

export function MessageTimeline({
  messages,
  sharedItems,
  imports,
  currentUserId,
  agents,
  memberProfiles,
  isMeeting,
  cancellingAgentRunIds,
  onCancelAgentRun,
}: {
  messages: RoomMessage[];
  sharedItems: SharedItem[];
  imports: MeetingImport[];
  currentUserId: string;
  agents: Agent[];
  memberProfiles: UserProfile[];
  isMeeting: boolean;
  cancellingAgentRunIds?: Set<string>;
  onCancelAgentRun?: (runId: string) => void;
}) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages[messages.length - 1]?.id;

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }

    timeline.scrollTop = timeline.scrollHeight;
  }, [messages.length, lastMessageId]);

  return (
    <div
      ref={timelineRef}
      className="flex min-h-[28rem] max-h-[min(64dvh,44rem)] flex-col gap-3 overflow-y-auto bg-paper/45 px-4 py-4"
    >
      {messages.length ? (
        messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            sharedItems={sharedItems}
            imports={imports}
            currentUserId={currentUserId}
            agents={agents}
            memberProfiles={memberProfiles}
            cancellingAgentRunIds={cancellingAgentRunIds}
            onCancelAgentRun={onCancelAgentRun}
          />
        ))
      ) : (
        <div className="m-auto max-w-sm rounded-lg border border-dashed border-line bg-card p-6 text-center shadow-sm">
          <p className="font-medium text-balance">아직 대화가 없습니다.</p>
          <p className="mt-1 text-sm text-pretty text-ink-soft">
            {isMeeting ? "회의방에 첫 단체 메시지를 보내세요." : "상주 봇에게 첫 업무 메시지를 보내세요."}
          </p>
        </div>
      )}
    </div>
  );
}
