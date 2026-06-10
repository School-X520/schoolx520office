"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "@/components/rooms/MessageBubble";
import type { Agent, MeetingImport, RoomMessage, SharedItem, UserProfile } from "@/types/domain";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

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
  // 사용자가 하단 근처에 있을 때만 새 메시지에 맞춰 자동 스크롤한다. 위로 올려 읽는 중이면 방해하지 않는다.
  const pinnedToBottomRef = useRef(true);
  const [hasNewBelow, setHasNewBelow] = useState(false);
  const lastMessageId = messages[messages.length - 1]?.id;

  function scrollToBottom() {
    const timeline = timelineRef.current;
    if (timeline) {
      timeline.scrollTop = timeline.scrollHeight;
      pinnedToBottomRef.current = true;
      setHasNewBelow(false);
    }
  }

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    if (pinnedToBottomRef.current) {
      timeline.scrollTop = timeline.scrollHeight;
      setHasNewBelow(false);
    } else {
      setHasNewBelow(true);
    }
  }, [messages.length, lastMessageId]);

  function handleScroll() {
    const timeline = timelineRef.current;
    if (!timeline) {
      return;
    }
    const distanceFromBottom = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight;
    pinnedToBottomRef.current = distanceFromBottom < NEAR_BOTTOM_THRESHOLD_PX;
    if (pinnedToBottomRef.current) {
      setHasNewBelow(false);
    }
  }

  return (
    <div className="relative">
      <div
        ref={timelineRef}
        onScroll={handleScroll}
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
      {hasNewBelow ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute inset-x-0 bottom-3 mx-auto flex w-fit items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-xs font-medium text-ink shadow-md transition-colors hover:bg-paper-deep"
        >
          <ArrowDown className="size-3.5" />새 메시지
        </button>
      ) : null}
    </div>
  );
}
