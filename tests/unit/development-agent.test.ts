import { describe, expect, it } from "vitest";
import { DEVELOPMENT_AGENT_ID } from "@/lib/agents/development-agent";
import { mockUser } from "@/lib/mock-data";
import { backfillDevelopmentAgentRequestMirrors } from "@/server/agents/development-request-mirror";
import { executeTool } from "@/server/agents/tools/execute-tool";
import { startAgentRun } from "@/server/agents/run-agent";
import { mockStore } from "@/server/data/mock-store";
import { getProjectObserverContext } from "@/server/memory/domain-memory-service";
import { getRoomView } from "@/server/rooms/get-room-view";

describe("development bot global room observer", () => {
  it("shows the development bot as an extra callable bot in other work rooms", async () => {
    const financeView = await getRoomView(mockUser.userId, "finance");
    const developmentView = await getRoomView(mockUser.userId, "development");

    expect(financeView?.agent?.id).toBe("finance_bot");
    expect(financeView?.guestAgents?.map((agent) => agent.id)).toContain(DEVELOPMENT_AGENT_ID);
    expect(developmentView?.agent?.id).toBe(DEVELOPMENT_AGENT_ID);
    expect(developmentView?.guestAgents?.map((agent) => agent.id)).not.toContain(DEVELOPMENT_AGENT_ID);
  });

  it("allows the development bot to run inside another room", async () => {
    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "finance",
      agentId: DEVELOPMENT_AGENT_ID,
      message: "이 예산 대화에서 개발할 기능을 찾아줘.",
      mode: "room",
    });

    expect(started.run.roomId).toBe("finance");
    expect(started.run.agentId).toBe(DEVELOPMENT_AGENT_ID);
    expect(started.run.mode).toBe("room");
  });

  it("mirrors development bot requests from other rooms into the development room chat", async () => {
    const request = "화상회의 참여 버튼이 헷갈리니 개발 요구사항으로 남겨줘.";
    const beforeMessages = mockStore.listMessages("development");

    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "finance",
      agentId: DEVELOPMENT_AGENT_ID,
      message: request,
      mode: "room",
    });

    const newDevelopmentMessages = mockStore
      .listMessages("development")
      .filter((message) => !beforeMessages.some((previous) => previous.id === message.id));
    const mirrorMessage = newDevelopmentMessages.find(
      (message) => message.metadata.developmentRequestMirror === true,
    );

    expect(mirrorMessage).toBeTruthy();
    expect(mirrorMessage?.type).toBe("agent");
    expect(mirrorMessage?.senderAgentId).toBe(DEVELOPMENT_AGENT_ID);
    expect(mirrorMessage?.agentRunId).toBe(started.run.id);
    expect(mirrorMessage?.content).toContain("[개발 요청 접수]");
    expect(mirrorMessage?.content).toContain("원본 방: 재무");
    expect(mirrorMessage?.content).toContain("요청자: 총괄 관리자");
    expect(mirrorMessage?.content).toContain(request);
    expect(mirrorMessage?.metadata).toMatchObject({
      sourceRoomId: "finance",
      sourceMessageId: started.inputMessage.id,
      sourceAgentRunId: started.run.id,
      requesterUserId: mockUser.userId,
      requesterName: "총괄 관리자",
    });
    expect(started.run.metadata.developmentRoomMirrorMessageId).toBe(mirrorMessage?.id);
  });

  it("treats the development bot toggle as a development request without trigger wording", async () => {
    const request = "버튼 색이 너무 흐려서 잘 안 보여.";
    const beforeMessages = mockStore.listMessages("development");

    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "planning",
      agentId: DEVELOPMENT_AGENT_ID,
      message: request,
      mode: "room",
      intent: "development_request",
    });

    const mirrorMessage = mockStore
      .listMessages("development")
      .filter((message) => !beforeMessages.some((previous) => previous.id === message.id))
      .find((message) => message.metadata.developmentRequestMirror === true);

    expect(started.run.metadata.requestIntent).toBe("development_request");
    expect(mirrorMessage?.content).toContain(request);
    expect(mirrorMessage?.content).toContain("원본 방: 기획");
    expect(mirrorMessage?.content).toContain("요청자: 총괄 관리자");
    expect(mirrorMessage?.content).toContain("접수 방식: 개발봇 토글");
    expect(mirrorMessage?.metadata).toMatchObject({
      requestIntent: "development_request",
      sourceRoomId: "planning",
      sourceAgentRunId: started.run.id,
      requesterUserId: mockUser.userId,
      requesterName: "총괄 관리자",
    });
  });

  it("mirrors development bot guest requests from the main meeting room into the development room chat", async () => {
    const request = "메인 회의방에서 나온 개발 요청도 개발방에 남겨줘.";
    const meetingThread = mockStore.ensureRoomThread("meeting");
    const meetingMessage = mockStore.createMessage({
      roomId: "meeting",
      threadId: meetingThread.id,
      type: "human",
      content: request,
      senderUserId: mockUser.userId,
    });
    const beforeMessages = mockStore.listMessages("development");

    const started = await startAgentRun({
      userId: mockUser.userId,
      roomId: "meeting",
      threadId: meetingThread.id,
      inputMessageId: meetingMessage.id,
      agentId: DEVELOPMENT_AGENT_ID,
      message: request,
      mode: "meeting_guest",
      guestSourceRoomId: "development",
    });

    const mirrorMessage = mockStore
      .listMessages("development")
      .filter((message) => !beforeMessages.some((previous) => previous.id === message.id))
      .find((message) => message.metadata.developmentRequestMirror === true);

    expect(started.run.mode).toBe("meeting_guest");
    expect(mirrorMessage).toBeTruthy();
    expect(mirrorMessage?.content).toContain("[개발 요청 접수]");
    expect(mirrorMessage?.content).toContain("원본 방: 메인 회의방");
    expect(mirrorMessage?.content).toContain(request);
    expect(mirrorMessage?.metadata).toMatchObject({
      sourceRoomId: "meeting",
      sourceThreadId: meetingThread.id,
      sourceMessageId: meetingMessage.id,
      sourceAgentRunId: started.run.id,
    });
  });

  it("lets meeting members call the development bot without development room membership", async () => {
    const meetingOnlyUserId = "00000000-0000-4000-8000-000000000099";
    mockStore.upsertMembership({ userId: meetingOnlyUserId, roomId: "meeting", role: "member" });

    const meetingView = await getRoomView(meetingOnlyUserId, "meeting");
    expect(meetingView?.guestAgents.map((agent) => agent.id)).toContain(DEVELOPMENT_AGENT_ID);

    const started = await startAgentRun({
      userId: meetingOnlyUserId,
      roomId: "meeting",
      agentId: DEVELOPMENT_AGENT_ID,
      message: "개발방 권한은 없지만 개발 요청은 접수해줘.",
      mode: "meeting_guest",
      guestSourceRoomId: "development",
    });

    expect(started.run.agentId).toBe(DEVELOPMENT_AGENT_ID);
    expect(started.run.metadata.developmentRoomMirrorMessageId).toBeTruthy();
  });

  it("backfills missing development bot guest requests via the sweep backfill", async () => {
    const request = "백필되어야 하는 메인방 개발 요청";
    const meetingThread = mockStore.ensureRoomThread("meeting");
    const meetingMessage = mockStore.createMessage({
      roomId: "meeting",
      threadId: meetingThread.id,
      type: "human",
      content: request,
      senderUserId: mockUser.userId,
    });
    const run = mockStore.createAgentRun({
      roomId: "meeting",
      threadId: meetingThread.id,
      agentId: DEVELOPMENT_AGENT_ID,
      initiatedBy: mockUser.userId,
      mode: "meeting_guest",
      runType: "meeting_guest",
      guestSourceRoomId: "development",
      inputMessageId: meetingMessage.id,
      status: "completed",
    });

    expect(mockStore.listMessages("development").some((message) => message.metadata.sourceAgentRunId === run.id)).toBe(
      false,
    );

    // backfill은 페이지 렌더 지연을 막기 위해 방 열람이 아니라 sweep cron에서 실행된다.
    const backfillResult = await backfillDevelopmentAgentRequestMirrors({ source: mockStore });
    expect(backfillResult.created).toBeGreaterThanOrEqual(1);

    const developmentView = await getRoomView(mockUser.userId, "development");
    const mirrorMessage = developmentView?.messages.find((message) => message.metadata.sourceAgentRunId === run.id);

    expect(mirrorMessage).toBeTruthy();
    expect(mirrorMessage?.content).toContain(request);
    expect(developmentView?.activeThread.title).toBe("개발 요청 접수함");
  });

  it("does not mirror development bot requests already made in the development room", async () => {
    const beforeMessages = mockStore.listMessages("development");

    await startAgentRun({
      userId: mockUser.userId,
      roomId: "development",
      agentId: DEVELOPMENT_AGENT_ID,
      message: "개발방 안에서 직접 논의하는 요구사항",
      mode: "room",
    });

    const newDevelopmentMessages = mockStore
      .listMessages("development")
      .filter((message) => !beforeMessages.some((previous) => previous.id === message.id));

    expect(newDevelopmentMessages.some((message) => message.metadata.developmentRequestMirror === true)).toBe(false);
  });

  it("lets the development bot search accessible room conversations beyond the active room", async () => {
    const planningThread = mockStore.ensureRoomThread("planning");
    const uniquePlanningMessage = "개발봇 전역 관찰 테스트용 기획 대화";
    mockStore.createMessage({
      roomId: "planning",
      threadId: planningThread.id,
      type: "human",
      content: uniquePlanningMessage,
      senderUserId: mockUser.userId,
    });

    const developmentRun = mockStore.createAgentRun({
      roomId: "finance",
      threadId: mockStore.ensureRoomThread("finance").id,
      agentId: DEVELOPMENT_AGENT_ID,
      initiatedBy: mockUser.userId,
      mode: "room",
      runType: "room_agent",
    });
    const developmentResult = await executeTool(developmentRun.id, "search_room_messages", {
      room_id: "planning",
      query: uniquePlanningMessage,
      limit: 5,
    });

    expect(developmentResult.ok).toBe(true);
    expect(JSON.stringify(developmentResult)).toContain(uniquePlanningMessage);

    const financeRun = mockStore.createAgentRun({
      roomId: "finance",
      threadId: mockStore.ensureRoomThread("finance").id,
      agentId: "finance_bot",
      initiatedBy: mockUser.userId,
      mode: "room",
      runType: "room_agent",
    });
    const financeResult = await executeTool(financeRun.id, "search_room_messages", {
      room_id: "planning",
      query: uniquePlanningMessage,
    });

    expect(financeResult.ok).toBe(false);
    expect(financeResult.error).toContain("tool_room_out_of_scope");
  });

  it("builds a project overview from all rooms the user can read", async () => {
    const overview = await getProjectObserverContext(mockUser.userId, {
      currentRoomId: "finance",
      messageLimitPerRoom: 2,
    });

    expect(overview.currentRoomId).toBe("finance");
    expect(overview.rooms.map((room) => room.room.id)).toContain("finance");
    expect(overview.rooms.map((room) => room.room.id)).toContain("development");
    expect(overview.readableRoomCount).toBeGreaterThan(1);
  });
});
