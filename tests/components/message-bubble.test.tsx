import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "@/components/rooms/MessageBubble";
import type { RoomMessage, UserProfile } from "@/types/domain";

const baseProfile: UserProfile = {
  userId: "00000000-0000-4000-8000-000000000002",
  email: "member@example.com",
  displayName: "홍길동",
  avatarUrl: null,
  bio: "연구 담당",
  isAdmin: false,
  createdAt: "2026-05-08T00:00:00Z",
  updatedAt: "2026-05-08T00:00:00Z",
};

function humanMessage(senderUserId: string): RoomMessage {
  return {
    id: "message-1",
    roomId: "meeting",
    threadId: "thread-1",
    senderUserId,
    senderAgentId: null,
    agentRunId: null,
    type: "human",
    content: "안녕하세요.",
    metadata: {},
    createdAt: "2026-05-08T00:00:00Z",
  };
}

describe("MessageBubble", () => {
  it("renders the sender profile name instead of a generic member label", () => {
    render(
      <MessageBubble
        message={humanMessage(baseProfile.userId)}
        sharedItems={[]}
        imports={[]}
        currentUserId="00000000-0000-4000-8000-000000000001"
        agents={[]}
        memberProfiles={[baseProfile]}
      />,
    );

    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.queryByText("구성원")).not.toBeInTheDocument();
  });

  it("shows the current user's configured name on own messages", () => {
    render(
      <MessageBubble
        message={humanMessage(baseProfile.userId)}
        sharedItems={[]}
        imports={[]}
        currentUserId={baseProfile.userId}
        agents={[]}
        memberProfiles={[baseProfile]}
      />,
    );

    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.queryByText("나")).not.toBeInTheDocument();
  });
});
