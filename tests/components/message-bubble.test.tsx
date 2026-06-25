import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageBubble } from "@/components/rooms/MessageBubble";
import type { Agent, RoomMessage, UserProfile } from "@/types/domain";

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

const financeAgent: Agent = {
  id: "finance_bot",
  roomId: "finance",
  name: "재무봇",
  role: "재무 담당",
  anthropicAgentId: null,
  anthropicEnvironmentId: null,
  defaultModel: "claude-sonnet-4-5",
  systemPrompt: "재무 지원",
  guestPrompt: "재무 게스트 지원",
  isActive: true,
  metadata: {},
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

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

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

  it("copies message text using the clipboard API", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

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

    await userEvent.click(screen.getByLabelText("메시지 복사"));

    expect(writeText).toHaveBeenCalledWith("안녕하세요.");
    expect(await screen.findByLabelText("메시지 복사됨")).toBeInTheDocument();
  });

  it("renders generated files on agent messages and requests signed downloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        signedUrl: "data:text/plain;charset=utf-8,download",
        file: { originalName: "분석결과.md" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const linkClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const agentMessage: RoomMessage = {
      id: "agent-message-1",
      roomId: "finance",
      threadId: "thread-1",
      senderUserId: null,
      senderAgentId: "finance_bot",
      agentRunId: "run-1",
      type: "agent",
      content: "파일을 생성했습니다.",
      metadata: {
        generatedFiles: [{ id: "file-generated-1", originalName: "분석결과.md", sizeBytes: 2048 }],
      },
      createdAt: "2026-05-08T00:00:00Z",
    };

    render(
      <MessageBubble
        message={agentMessage}
        sharedItems={[]}
        imports={[]}
        currentUserId={baseProfile.userId}
        agents={[financeAgent]}
        memberProfiles={[baseProfile]}
      />,
    );

    expect(screen.getByText("분석결과.md")).toBeInTheDocument();
    expect(screen.getByText("2KB")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "파일 다운로드" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/files/file-generated-1/download?roomId=finance");
    });
    expect(linkClick).toHaveBeenCalled();
  });
});
