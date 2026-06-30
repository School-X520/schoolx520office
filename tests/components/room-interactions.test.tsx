import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MessageComposer } from "@/components/rooms/MessageComposer";
import { MessageTimeline } from "@/components/rooms/MessageTimeline";
import { RoomThreadControls } from "@/components/rooms/RoomThreadControls";
import type { Agent, AgentRun, RoomMessage, RoomThread } from "@/types/domain";

const financeBot: Agent = {
  id: "finance_bot",
  roomId: "finance",
  name: "재무봇",
  role: "재무 담당",
  defaultModel: "claude-sonnet-4-5",
  systemPrompt: "재무 지원",
  guestPrompt: "재무 게스트 지원",
  isActive: true,
  metadata: {},
  createdAt: "2026-05-08T00:00:00Z",
  updatedAt: "2026-05-08T00:00:00Z",
};

const baseThread: RoomThread = {
  id: "thread-1",
  roomId: "finance",
  title: "재무 기본 대화",
  summary: "재무 대화 요약",
  carryoverSummary: "이전 재무 대화 요약",
  status: "active",
  lastMessageAt: "2026-05-08T00:00:00Z",
  createdBy: "user-1",
  createdAt: "2026-05-08T00:00:00Z",
  updatedAt: "2026-05-08T00:00:00Z",
  metadata: {},
};

function message(id: string, content: string): RoomMessage {
  return {
    id,
    roomId: "finance",
    threadId: "thread-1",
    senderUserId: "user-1",
    senderAgentId: null,
    agentRunId: null,
    type: "human",
    content,
    metadata: {},
    createdAt: "2026-05-08T00:00:00Z",
  };
}

function agentRun(id: string): AgentRun {
  return {
    id,
    roomId: "finance",
    threadId: "thread-1",
    agentId: "finance_bot",
    initiatedBy: "user-1",
    mode: "room",
    runType: "room_agent",
    status: "queued",
    inputMessageId: "message-1",
    outputMessageId: null,
    tokenUsage: {},
    error: null,
    startedAt: "2026-05-08T00:00:00Z",
    endedAt: null,
    metadata: {},
  };
}

function composerProps() {
  return {
    roomId: "finance",
    threadId: "thread-1",
    currentUserId: "user-1",
    isMeeting: false,
    residentAgent: financeBot,
    guestAgents: [],
    onOptimisticMessage: vi.fn(),
    onMessagesCommitted: vi.fn(),
    onMessageFailed: vi.fn(),
    onAgentRunQueued: vi.fn(),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("RoomThreadControls", () => {
  it("renames the active thread and updates the selector label", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ thread: { ...baseThread, title: "정산 검토" } }));
    vi.stubGlobal("fetch", fetchMock);

    render(<RoomThreadControls roomId="finance" threads={[baseThread]} activeThreadId={baseThread.id} />);

    await userEvent.click(screen.getByLabelText("대화 제목 편집"));
    await userEvent.clear(screen.getByLabelText("대화 제목"));
    await userEvent.type(screen.getByLabelText("대화 제목"), "정산 검토");
    await userEvent.click(screen.getByLabelText("대화 제목 저장"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/rooms/finance/threads/thread-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ title: "정산 검토" }),
        }),
      );
    });
    expect(await screen.findByRole("option", { name: "정산 검토" })).toBeInTheDocument();
  });

  it("shows an inline error for an empty thread title", async () => {
    render(<RoomThreadControls roomId="finance" threads={[baseThread]} activeThreadId={baseThread.id} />);

    await userEvent.click(screen.getByLabelText("대화 제목 편집"));
    await userEvent.clear(screen.getByLabelText("대화 제목"));
    await userEvent.click(screen.getByLabelText("대화 제목 저장"));

    expect(screen.getByText("대화 제목을 입력해 주세요.")).toBeInTheDocument();
  });
});

describe("MessageTimeline", () => {
  it("does not force-scroll when the user is reading older messages and exposes a new-message control", async () => {
    const initialMessages = [message("message-1", "첫 메시지")];
    const { container, rerender } = render(
      <MessageTimeline
        messages={initialMessages}
        sharedItems={[]}
        imports={[]}
        currentUserId="user-1"
        agents={[]}
        memberProfiles={[]}
        isMeeting={false}
      />,
    );
    const timeline = container.querySelector(".overflow-y-auto") as HTMLDivElement;
    Object.defineProperty(timeline, "scrollHeight", { configurable: true, value: 1000 });
    Object.defineProperty(timeline, "clientHeight", { configurable: true, value: 300 });
    timeline.scrollTop = 0;

    fireEvent.scroll(timeline);
    rerender(
      <MessageTimeline
        messages={[...initialMessages, message("message-2", "새 메시지 내용")]}
        sharedItems={[]}
        imports={[]}
        currentUserId="user-1"
        agents={[]}
        memberProfiles={[]}
        isMeeting={false}
      />,
    );

    expect(await screen.findByRole("button", { name: /새 메시지/ })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /새 메시지/ }));
    expect(screen.queryByRole("button", { name: /새 메시지/ })).not.toBeInTheDocument();
  });
});

describe("MessageComposer", () => {
  it("queues the resident room bot by default after sending a room message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ message: message("message-1", "예산 확인") }))
      .mockResolvedValueOnce(Response.json({ run: agentRun("run-1") }));
    vi.stubGlobal("fetch", fetchMock);
    const props = composerProps();

    render(<MessageComposer {...props} />);

    expect(screen.getByLabelText("재무봇 응답")).toBeChecked();
    await userEvent.type(screen.getByLabelText("메시지 입력"), "예산 확인");
    await userEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/rooms/finance/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "예산 확인", threadId: "thread-1" }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/rooms/finance/agent-runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          message: "예산 확인",
          threadId: "thread-1",
          inputMessageId: "message-1",
          mode: "room",
          agentId: "finance_bot",
        }),
      }),
    );
    expect(props.onAgentRunQueued).toHaveBeenCalledWith(expect.objectContaining({ id: "run-1" }));
  });

  it("sends only the human message when the resident bot toggle is off", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ message: message("message-1", "단체 전달") }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MessageComposer {...composerProps()} />);

    await userEvent.click(screen.getByLabelText("재무봇 응답"));
    expect(screen.getByLabelText("재무봇 응답")).not.toBeChecked();
    await userEvent.type(screen.getByLabelText("메시지 입력"), "단체 전달");
    await userEvent.click(screen.getByRole("button", { name: "전송" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/rooms/finance/messages",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content: "단체 전달", threadId: "thread-1" }),
      }),
    );
  });
});
